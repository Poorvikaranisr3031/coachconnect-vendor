import { config, db } from 'hatchable';
import { currentPassengerUser } from '../lib/passenger-auth.js';

export const access = 'public';

function normalizeStation(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}
function stationMatches(value, filter) {
  const station = normalizeStation(value);
  const target = normalizeStation(filter);
  return !!station && !!target && (station === target || station.includes(target) || target.includes(station));
}

export default async function (req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });
  try {
    const passenger = await currentPassengerUser(req);
    if (!passenger) return res.status(401).json({ error: 'Please sign in as a passenger to track a train.' });

    const trainNumber = String(req.query?.trainNumber || '').trim();
    const dateRaw = String(req.query?.date || '').trim();
    if (!/^\d{5}$/.test(trainNumber)) return res.status(400).json({ error: 'Enter a valid 5-digit train number.' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) return res.status(400).json({ error: 'Enter the journey date.' });
    const date = dateRaw;

    const apiKey = await config.get('RAILRADAR_API_KEY');
    if (!apiKey) return res.status(503).json({ error: 'RailRadar API key is not connected. Open the project Setup page and link RAILRADAR_API_KEY from Vault.' });

    const headers = { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' };
    let upstream;
    let payload = null;
    let usedV1 = false;
    try {
      const liveUrl = `https://api.railradar.in/v1/trains/${encodeURIComponent(trainNumber)}/live?date=${encodeURIComponent(date)}&authoritative=true`;
      upstream = await fetch(liveUrl, { headers });
      payload = await upstream.json().catch(() => null);
    } catch (e) {
      return res.status(502).json({ error: 'Could not connect to RailRadar. Please try again.' });
    }
    if (!upstream.ok || !payload || payload.success !== true || !payload.data) {
      const providerMessage = payload?.error || payload?.message || payload?.details || payload?.data?.error;
      const safeMessage = typeof providerMessage === 'string' ? providerMessage.slice(0, 240) : '';
      if (upstream.status === 401 || upstream.status === 403) {
        return res.status(502).json({ error: safeMessage || 'RailRadar rejected the API key. Check that the correct active key is linked from Vault.' });
      }
      const detail = safeMessage || (!upstream.ok ? `RailRadar returned HTTP ${upstream.status}.` : !payload ? `RailRadar returned an unreadable response (HTTP ${upstream.status}).` : `RailRadar response did not include successful tracking data (HTTP ${upstream.status}).`);
      return res.status(422).json({ error: detail, providerStatus: upstream.status });
    }

    const live = payload.data;
    const route = Array.isArray(live.route) ? live.route : [];
    const rawCurrent = live.currentLocation || live.currentStation || null;
    const currentCode = rawCurrent?.stationCode || rawCurrent?.stnCode || rawCurrent?.code || null;
    const currentStop = route.find(stop => currentCode && String(stop.stationCode || stop.stnCode || stop.code || '').toUpperCase() === String(currentCode).toUpperCase())
      || route.find(stop => rawCurrent?.sequence != null && Number(stop.sequence) === Number(rawCurrent.sequence))
      || null;
    const currentLocation = rawCurrent ? {
      ...rawCurrent,
      stnName: rawCurrent.stationName || rawCurrent.stnName || rawCurrent.name || currentStop?.stationName || currentStop?.name || currentCode || null,
      stnCode: currentCode,
      status: rawCurrent.status || currentStop?.status || null
    } : null;
    let rawNext = live.nextHalt || live.nextStation || null;
    if (!rawNext && currentStop) {
      const currentSequence = Number(currentStop.sequence);
      rawNext = route.filter(stop => Number(stop.sequence) > currentSequence && stop.isHalt !== false)
        .sort((a, b) => Number(a.sequence) - Number(b.sequence))[0] || null;
    }
    const next = rawNext ? {
      ...rawNext,
      stnName: rawNext.stationName || rawNext.stnName || rawNext.name || rawNext.stationCode || rawNext.stnCode || rawNext.code || null,
      stnCode: rawNext.stationCode || rawNext.stnCode || rawNext.code || null,
      distance: rawNext.distance ?? rawNext.distanceKm ?? null
    } : null;
    let stalls = [];
    if (next?.stnName) {
      const vendorsResult = await db.query(
        'SELECT id, stall_name, station, platform, stall_location, served_coaches FROM vendors WHERE user_id IS NOT NULL ORDER BY stall_name ASC LIMIT 500'
      );
      const matching = vendorsResult.rows.filter(v => stationMatches(v.station, next.stnName) || (next.stnCode && normalizeStation(v.station) === normalizeStation(next.stnCode)));
      if (matching.length) {
        const menuResult = await db.query('SELECT id, vendor_id, name, category, price, description FROM menu_items WHERE available = true ORDER BY category, name');
        const menuByVendor = new Map();
        for (const item of menuResult.rows) {
          const key = String(item.vendor_id);
          if (!menuByVendor.has(key)) menuByVendor.set(key, []);
          menuByVendor.get(key).push({ id: item.id, name: item.name, category: item.category, price: item.price, description: item.description, available: true });
        }
        stalls = matching.map(v => ({ id: v.id, stall_name: v.stall_name, station: v.station, platform: v.platform, stall_location: v.stall_location, served_coaches: String(v.served_coaches || '').split(/[\n,;]+/).map(s => s.trim()).filter(Boolean), menu_items: menuByVendor.get(String(v.id)) || [] })).filter(v => v.menu_items.length > 0);
      }
    }

    return res.json({
      train: live.trainInfo?.[0] || live.train || { name: live.trainName || 'Train', number: live.trainNo || trainNumber },
      status: live.status || live.statusNote || null,
      statusText: live.statusText || live.statusNote || (live.status ? `Train status: ${String(live.status).replace(/[_-]/g, ' ')}` : null),
      isLive: live.isLive === true,
      lastUpdatedAt: live.lastUpdatedAt || live.lastUpdate || null,
      currentLocation,
      nextHalt: next,
      delayMinutes: live.delayMinutes ?? null,
      stalls,
      stallCount: stalls.length
    });
  } catch (error) {
    return res.status(500).json({ error: 'Could not load live train details. Please try again.' });
  }
}