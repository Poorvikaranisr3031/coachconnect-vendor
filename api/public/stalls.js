import { db } from 'hatchable';
export const access = 'public';

// Read-only, CORS-enabled discovery endpoint for the future passenger app.
// Example: GET /api/public/stalls?station=SBC&coach=S4
export default async function (req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).send('');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });

  try {
    const stationFilter = String(req.query?.station || '').trim().toLowerCase();
    const coachFilter = String(req.query?.coach || '').trim().toUpperCase();

    const vendorsResult = await db.query(
      'SELECT id, stall_name, station, platform, stall_location, served_coaches FROM vendors WHERE user_id IS NOT NULL ORDER BY stall_name ASC LIMIT 500'
    );
    if (!vendorsResult.rows.length) {
      return res.json({ stalls: [], count: 0, filters: { station: stationFilter || null, coach: coachFilter || null } });
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
      .filter(vendor => !stationFilter || String(vendor.station || '').toLowerCase().includes(stationFilter))
      .map(vendor => {
        const coaches = String(vendor.served_coaches || '')
          .split(/[\n,;]+/)
          .map(value => value.trim().toUpperCase())
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