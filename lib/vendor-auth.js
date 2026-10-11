import { db } from 'hatchable';

function bytesToHex(bytes) { return Array.from(new Uint8Array(bytes)).map(b => b.toString(16).padStart(2, '0')).join(''); }
export async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return bytesToHex(digest);
}
export function readCookie(req, name) {
  const raw = String(req.headers?.cookie || '');
  const pair = raw.split(';').map(x => x.trim()).find(x => x.startsWith(name + '='));
  if (!pair) return '';
  try { return decodeURIComponent(pair.slice(name.length + 1)); } catch { return ''; }
}
export async function currentVendorUser(req) {
  const token = readCookie(req, 'cc_vendor_session');
  if (!token || token.length < 40 || token.length > 200) return null;
  const tokenHash = await sha256(token);
  const result = await db.query(
    'SELECT s.user_id, c.email FROM vendor_password_sessions s JOIN vendor_password_credentials c ON c.user_id=s.user_id WHERE s.token_hash=$1 AND s.expires_at > now() LIMIT 1',
    [tokenHash]
  );
  return result.rows[0] ? { id: String(result.rows[0].user_id), email: result.rows[0].email } : null;
}
export function cookieHeader(value, maxAge) {
  return 'cc_vendor_session=' + encodeURIComponent(value) + '; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=' + maxAge;
}
export function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}
export async function passwordHash(password, saltHex) {
  const salt = new Uint8Array(saltHex.match(/.{2}/g).map(x => parseInt(x, 16)));
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' }, material, 256);
  return bytesToHex(bits);
}
export function newSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}
export function validPassword(password) { return typeof password === 'string' && password.length >= 10 && password.length <= 128; }