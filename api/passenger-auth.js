import { db, email } from 'hatchable';
import { cookieHeader, currentPassengerUser, newSalt, passwordHash, randomToken, sha256, readCookie, validPassword } from '../lib/passenger-auth.js';
export const access = 'public';
export const methods = ['GET','POST'];
function sameOrigin(req) { const origin=String(req.headers?.origin||''); const host=String(req.headers?.host||''); return !origin || origin==='https://'+host || origin==='http://'+host; }
function validEmail(email) { return email.length<=254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
async function createSession(res,userId,emailAddress) { await db.query('DELETE FROM passenger_password_sessions WHERE expires_at<now()'); const token=randomToken(); await db.query('INSERT INTO passenger_password_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval \'30 days\')',[await sha256(token),userId]); res.setHeader('Set-Cookie',cookieHeader(token,60*60*24*30)); return {user:{id:userId,email:emailAddress}}; }
export default async function(req,res) {
  res.setHeader('Cache-Control','no-store');
  try {
    if(req.method==='GET') { const user=await currentPassengerUser(req); return res.json({user}); }
    if(req.method!=='POST') return res.status(405).json({error:'Method not allowed.'});
    if(!sameOrigin(req)) return res.status(403).json({error:'Request origin was rejected.'});
    const action=String(req.body?.action||'login');
    const token=readCookie(req,'cc_passenger_session');
    if(action==='logout') { if(token) await db.query('DELETE FROM passenger_password_sessions WHERE token_hash=$1',[await sha256(token)]); res.setHeader('Set-Cookie',cookieHeader('',0)); return res.json({ok:true}); }
    if(action==='forgot_password') {
      const emailAddress=String(req.body?.email||'').trim().toLowerCase();
      if(!validEmail(emailAddress)) return res.status(400).json({error:'Enter a valid email address.'});
      await db.query('DELETE FROM passenger_password_reset_tokens WHERE expires_at<now()');
      const found=await db.query('SELECT user_id,email FROM passenger_password_credentials WHERE email=$1 LIMIT 1',[emailAddress]);
      if(!found.rows[0]) return res.json({ok:true,message:'If an account exists for that email, a password reset link will be sent.'});
      const userId=String(found.rows[0].user_id), rawToken=randomToken(), tokenHash=await sha256(rawToken);
      await db.query('DELETE FROM passenger_password_reset_tokens WHERE user_id=$1',[userId]);
      await db.query('INSERT INTO passenger_password_reset_tokens(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval \'30 minutes\')',[tokenHash,userId]);
      const base='https://coachconnect-vendor.hatchable.site/passenger/login?reset='+encodeURIComponent(rawToken);
      try {
        await email.send({to:emailAddress,subject:'Reset your CoachConnect passenger password',text:'Use this one-time link to reset your CoachConnect passenger password. It expires in 30 minutes. If you did not request this, ignore this email.\n\n'+base,html:'<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#173d39"><h2>Reset your password</h2><p>We received a request to reset your CoachConnect passenger password.</p><p><a href="'+base+'" style="display:inline-block;background:#177b67;color:white;padding:12px 18px;border-radius:9px;text-decoration:none">Reset password</a></p><p>This one-time link expires in 30 minutes. If you did not request this, ignore this email.</p></div>'});
      } catch(sendError) {
        await db.query('DELETE FROM passenger_password_reset_tokens WHERE token_hash=$1',[tokenHash]);
        return res.status(503).json({error:'Password reset email could not be delivered. The current email plan may restrict sending to this address. Please contact the CoachConnect project owner.'});
      }
      return res.json({ok:true,message:'If an account exists for that email, a password reset link will be sent.'});
    }
    if(action==='reset_password') {
      const rawReset=String(req.body?.token||'');
      const newPassword=req.body?.password;
      if(rawReset.length<40||rawReset.length>200||!validPassword(newPassword)) return res.status(400).json({error:'Use a valid reset link and a password with at least 10 characters.'});
      const hashed=await sha256(rawReset);
      const found=await db.query('SELECT user_id FROM passenger_password_reset_tokens WHERE token_hash=$1 AND expires_at>now() LIMIT 1',[hashed]);
      if(!found.rows[0]) return res.status(400).json({error:'This reset link is invalid or expired. Request a new one.'});
      const userId=String(found.rows[0].user_id), salt=newSalt(), hash=await passwordHash(newPassword,salt);
      await db.query('UPDATE passenger_password_credentials SET password_salt=$1,password_hash=$2 WHERE user_id=$3',[salt,hash,userId]);
      await db.query('DELETE FROM passenger_password_reset_tokens WHERE user_id=$1',[userId]);
      await db.query('DELETE FROM passenger_password_sessions WHERE user_id=$1',[userId]);
      return res.json({ok:true,message:'Password updated. Please sign in with your new password.'});
    }
    const emailAddress=String(req.body?.email||'').trim().toLowerCase();
    const password=req.body?.password;
    if(!validEmail(emailAddress)||typeof password!=='string'||password.length>128) return res.status(400).json({error:'Enter a valid email and password.'});
    if(action==='register') {
      if(!validPassword(password)) return res.status(400).json({error:'Choose a password with at least 10 characters.'});
      const existing=await db.query('SELECT user_id FROM passenger_password_credentials WHERE email=$1 LIMIT 1',[emailAddress]);
      if(existing.rows.length) return res.status(409).json({error:'An account already exists for this email. Please sign in.'});
      const salt=newSalt(), hash=await passwordHash(password,salt), userId=crypto.randomUUID();
      await db.query('INSERT INTO passenger_password_credentials(user_id,email,password_salt,password_hash) VALUES($1,$2,$3,$4)',[userId,emailAddress,salt,hash]);
      return res.status(201).json(await createSession(res,userId,emailAddress));
    }
    if(action!=='login') return res.status(400).json({error:'Unknown account action.'});
    const attempts=await db.query('SELECT count(*)::int AS count FROM passenger_password_login_attempts WHERE email=$1 AND attempted_at>now()-interval \'15 minutes\'',[emailAddress]);
    if(Number(attempts.rows[0]?.count||0)>=8) return res.status(429).json({error:'Too many sign-in attempts. Try again in 15 minutes.'});
    const found=await db.query('SELECT user_id,email,password_salt,password_hash FROM passenger_password_credentials WHERE email=$1 LIMIT 1',[emailAddress]);
    let valid=false;
    if(found.rows[0]) valid=(await passwordHash(password,found.rows[0].password_salt))===found.rows[0].password_hash;
    if(!valid) { await db.query('INSERT INTO passenger_password_login_attempts(email) VALUES($1)',[emailAddress]); return res.status(401).json({error:'Email or password is incorrect.'}); }
    await db.query('DELETE FROM passenger_password_login_attempts WHERE email=$1',[emailAddress]);
    return res.json(await createSession(res,String(found.rows[0].user_id),found.rows[0].email));
  } catch(error) { return res.status(500).json({error:'Passenger account request failed. Please try again.'}); }
}