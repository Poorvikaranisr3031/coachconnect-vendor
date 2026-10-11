import { db } from 'hatchable';
import { cookieHeader, currentVendorUser, newSalt, passwordHash, randomToken, sha256, readCookie } from '../lib/vendor-auth.js';
export const access = 'public';
function sameOrigin(req) {
  const origin = String(req.headers?.origin || '');
  const host = String(req.headers?.host || '');
  return !origin || origin === 'https://' + host || origin === 'http://' + host;
}
export default async function (req, res) {
  try {
    if (req.method === 'GET') {
      const user = await currentVendorUser(req);
      return res.json({ user: user ? { id: user.id, email: user.email } : null });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
    if (!sameOrigin(req)) return res.status(403).json({ error: 'Request origin was rejected.' });
    const action = String(req.body?.action || 'login');
    const token = readCookie(req, 'cc_vendor_session');
    if (action === 'logout') {
      if (token) await db.query('DELETE FROM vendor_password_sessions WHERE token_hash=$1', [await sha256(token)]);
      res.setHeader('Set-Cookie', cookieHeader('', 0));
      return res.json({ ok: true });
    }
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = req.body?.password;
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof password !== 'string' || password.length > 128) {
      return res.status(400).json({ error: 'Enter a valid email and password.' });
    }
    const attempts = await db.query('SELECT count(*)::int AS count FROM vendor_password_login_attempts WHERE email=$1 AND attempted_at > now() - interval \'15 minutes\'', [email]);
    if (Number(attempts.rows[0]?.count || 0) >= 8) return res.status(429).json({ error: 'Too many sign-in attempts. Try again in 15 minutes.' });
    const found = await db.query('SELECT user_id,email,password_salt,password_hash FROM vendor_password_credentials WHERE email=$1 LIMIT 1', [email]);
    let valid = false;
    if (found.rows[0]) {
      const candidate = await passwordHash(password, found.rows[0].password_salt);
      valid = candidate === found.rows[0].password_hash;
    }
    if (!valid) {
      await db.query('INSERT INTO vendor_password_login_attempts (email) VALUES ($1)', [email]);
      return res.status(401).json({ error: 'Email or password is incorrect. First-time users must verify their email and create a password.' });
    }
    await db.query('DELETE FROM vendor_password_login_attempts WHERE email=$1', [email]);
    await db.query('DELETE FROM vendor_password_sessions WHERE expires_at < now()');
    const sessionToken = randomToken();
    await db.query('INSERT INTO vendor_password_sessions (token_hash,user_id,expires_at) VALUES ($1,$2,now() + interval \'30 days\')', [await sha256(sessionToken), String(found.rows[0].user_id)]);
    res.setHeader('Set-Cookie', cookieHeader(sessionToken, 60 * 60 * 24 * 30));
    return res.json({ user: { id: String(found.rows[0].user_id), email: found.rows[0].email } });
  } catch (error) {
    return res.status(500).json({ error: 'Sign-in failed. Please try again.' });
  }
}