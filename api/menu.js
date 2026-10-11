import { db } from 'hatchable';
import { currentVendorUser } from '../lib/vendor-auth.js';
export const access = 'public';

async function getVendorId(userId) {
  const result = await db.query('SELECT id FROM vendors WHERE user_id = $1 LIMIT 1', [userId]);
  return result.rows[0]?.id || null;
}

const publicFields = 'id, name, category, price, available, description, created_at';

export default async function (req, res) {
  try {
    const user = await currentVendorUser(req);
    if (!user) return res.status(401).json({ error: 'Please sign in with your email and password.' });
    const vendorId = await getVendorId(String(user.id));

    if (req.method === 'GET') {
      if (!vendorId) return res.json([]);
      const result = await db.query(
        'SELECT ' + publicFields + ' FROM menu_items WHERE vendor_id = $1 ORDER BY created_at DESC',
        [vendorId]
      );
      return res.json(result.rows);
    }

    if (!vendorId) return res.status(400).json({ error: 'Save your stall details first.' });

    const body = req.body || {};
    if (req.method === 'POST' || req.method === 'PUT') {
      const name = String(body.name || '').trim();
      const price = Number(body.price);
      const available = body.available !== false;
      if (!name) return res.status(400).json({ error: 'Item name is required.' });
      if (name.length > 120) return res.status(400).json({ error: 'Item name is too long.' });
      if (!Number.isFinite(price) || price < 0) return res.status(400).json({ error: 'Enter a valid non-negative price.' });

      const values = [
        name,
        String(body.category || 'Other').trim() || 'Other',
        price,
        available,
        String(body.description || '').trim(),
        available ? 1 : 0
      ];

      if (req.method === 'POST') {
        const result = await db.query(
          'INSERT INTO menu_items (vendor_id, name, category, price, available, description, stock_quantity) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING ' + publicFields,
          [vendorId, ...values]
        );
        return res.status(201).json(result.rows[0]);
      }

      if (!body.id) return res.status(400).json({ error: 'Item ID is required.' });
      const result = await db.query(
        'UPDATE menu_items SET name=$1, category=$2, price=$3, available=$4, description=$5, stock_quantity=$6 WHERE id=$7 AND vendor_id=$8 RETURNING ' + publicFields,
        [...values, body.id, vendorId]
      );
      return result.rows[0] ? res.json(result.rows[0]) : res.status(404).json({ error: 'Menu item not found.' });
    }

    if (req.method === 'DELETE') {
      if (!body.id) return res.status(400).json({ error: 'Item ID is required.' });
      const result = await db.query('DELETE FROM menu_items WHERE id=$1 AND vendor_id=$2', [body.id, vendorId]);
      return res.json({ ok: true, deleted: result.rowCount || 0 });
    }

    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (error) {
    return res.status(500).json({ error: 'Menu request failed. Please try again.' });
  }
}