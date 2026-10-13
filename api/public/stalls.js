import { db } from 'hatchable';
import { currentPassengerUser } from '../../lib/passenger-auth.js';
export const access = 'public';

// Read-only directory consumed by the separate CoachConnect Passenger App.
// Ordering and payments are intentionally not supported.
const STATION_ALIASES = {
  sbc: ['sbc', 'bengaluru city junction', 'bengaluru city', 'bangalore city junction']
};
function normalizeStation(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}
function stationMatches(value, filter) {
  if (!filter) return true;
  const station = normalizeStation(value);
  const aliases = STATION_ALIASES[filter] || [filter];
  // Accept the same station written with a common longer/shorter name
  // (for example "Mysuru" and "Mysuru Junction"), not just SBC aliases.
  return aliases.includes(station) || station === filter || station.includes(filter) || filter.includes(station);
}
function normalizeCoach(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
}
export default async function (req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).send('');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });

  try {
    const passenger = await currentPassengerUser(req);
    if (!passenger) return res.status(401).json({ error: 'Please verify your location and sign in as a passenger to search stalls and menus.' });
    const stationFilter = normalizeStation(req.query?.station);
    const coachFilter = normalizeCoach(req.query?.coach);
    if (stationFilter.length > 150) return res.status(400).json({ error: 'Station filter is too long.' });
    if (coachFilter && !/^[A-Z0-9-]{1,12}$/.test(coachFilter)) {
      return res.status(400).json({ error: 'Enter a valid coach number such as S4 or B2.' });
    }

    const vendorsResult = await db.query(
      'SELECT id, stall_name, station, platform, stall_location, served_coaches FROM vendors WHERE user_id IS NOT NULL ORDER BY stall_name ASC LIMIT 500'
    );
    if (!vendorsResult.rows.length) {
      return res.json({ stalls: [], count: 0, filters: { station: stationFilter || null, coach: coachFilter || null }, note: 'No registered vendor profiles are available yet.' });
    }

    const menuResult = await db.query(
      'SELECT id, vendor_id, name, category, price, description FROM menu_items WHERE available = true ORDER BY category, name'
    );
    const menuByVendor = new Map();
    for (const item of menuResult.rows) {
      const key = String(item.vendor_id);
      if (!menuByVendor.has(key)) menuByVendor.set(key, []);
      menuByVendor.get(key).push({
        id: item.id,
        name: item.name,
        category: item.category,
        price: item.price,
        description: item.description,
        available: true
      });
    }

    const stalls = vendorsResult.rows
      .filter(vendor => stationMatches(vendor.station, stationFilter))
      .map(vendor => {
        const coaches = String(vendor.served_coaches || '')
          .split(/[\n,;]+/)
          .map(normalizeCoach)
          .filter(Boolean);
        return {
          id: vendor.id,
          stall_name: vendor.stall_name,
          station: vendor.station,
          platform: vendor.platform,
          stall_location: vendor.stall_location,
          served_coaches: coaches,
          menu_items: menuByVendor.get(String(vendor.id)) || []
        };
      })
      .filter(vendor => vendor.menu_items.length > 0)
      .filter(vendor => !coachFilter || vendor.served_coaches.includes('ALL') || vendor.served_coaches.includes(coachFilter));

    return res.json({
      stalls,
      count: stalls.length,
      filters: { station: stationFilter || null, coach: coachFilter || null },
      note: 'Read-only stall and available-menu data. Ordering and payments are not supported.'
    });
  } catch (error) {
    return res.status(500).json({ error: 'Could not load stall directory.' });
  }
}