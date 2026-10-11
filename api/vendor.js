import { db } from 'hatchable';
import { currentVendorUser } from '../lib/vendor-auth.js';
export const access = 'public';

export default async function (req, res) {
  try {
    const user = await currentVendorUser(req);
    if (!user) return res.status(401).json({ error: 'Please sign in with your email and password.' });
    const uid = String(user.id);

    if (req.method === 'GET') {
      let result = await db.query(
        'SELECT * FROM vendors WHERE user_id = $1 LIMIT 1',
        [uid]
      );
      // Preserve an existing unclaimed profile created before sign-in.
      if (!result.rows.length) {
        result = await db.query(
          "UPDATE vendors SET user_id = $1, updated_at = now() WHERE id = (SELECT id FROM vendors WHERE user_id IS NULL ORDER BY updated_at DESC LIMIT 1) RETURNING *",
          [uid]
        );
      }
      return res.json(result.rows[0] || null);
    }

    if (req.method === 'PUT') {
      const body = req.body || {};
      const stallName = String(body.stall_name || '').trim();
      const station = String(body.station || '').trim();
      const servedCoaches = String(body.served_coaches || '')
        .split(/[\n,;]+/)
        .map(value => value.trim().toUpperCase())
        .filter(Boolean)
        .filter((value, index, values) => values.indexOf(value) === index)
        .join(', ');

      if (!stallName || !station) {
        return res.status(400).json({ error: 'Stall name and station are required.' });
      }
      if (stallName.length > 100 || station.length > 150) {
        return res.status(400).json({ error: 'Stall name or station is too long.' });
      }
      if (servedCoaches.length > 500) {
        return res.status(400).json({ error: 'Coach coverage is too long.' });
      }

      const result = await db.query(
        "INSERT INTO vendors (user_id, stall_name, station, platform, stall_location, contact_name, contact_phone, served_coaches) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (user_id) WHERE user_id IS NOT NULL DO UPDATE SET stall_name=EXCLUDED.stall_name, station=EXCLUDED.station, platform=EXCLUDED.platform, stall_location=EXCLUDED.stall_location, contact_name=EXCLUDED.contact_name, contact_phone=EXCLUDED.contact_phone, served_coaches=EXCLUDED.served_coaches, updated_at=now() RETURNING *",
        [
          uid,
          stallName,
          station,
          String(body.platform || '').trim(),
          String(body.stall_location || '').trim(),
          String(body.contact_name || '').trim(),
          String(body.contact_phone || '').trim(),
          servedCoaches
        ]
      );
      return res.json(result.rows[0]);
    }

    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (error) {
    return res.status(500).json({ error: 'Could not save your stall profile. Please try again.' });
  }
}