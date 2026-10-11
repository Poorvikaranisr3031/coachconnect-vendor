import { db } from 'hatchable';
import { newSalt, passwordHash, validPassword } from '../lib/vendor-auth.js';
export const access = 'user';
export default async function (req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  try {
    const userId = String(req.user?.id || '');
    const email = String(req.user?.email || '').trim().toLowerCase();
    const password = req.body?.password;
    if (!userId || !email) return res.status(401).json({ error: 'Sign in with your email code first.' });
    if (!validPassword(password)) return res.status(400).json({ error: 'Use a password between 10 and 128 characters.' });
    const salt = newSalt();
    const hash = await passwordHash(password, salt);
    await db.query(
      'INSERT INTO vendor_password_credentials (user_id,email,password_salt,password_hash) VALUES ($1,$2,$3,$4) ON CONFLICT (user_id) DO UPDATE SET email=EXCLUDED.email,password_salt=EXCLUDED.password_salt,password_hash=EXCLUDED.password_hash,updated_at=now()',
      [userId, email, salt, hash]
    );
    return res.json({ ok: true, message: 'Password created. You can now sign in with email and password.' });
  } catch (error) {
    return res.status(500).json({ error: 'Could not save your password. Please try again.' });
  }
}