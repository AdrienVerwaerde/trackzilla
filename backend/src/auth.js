import { scryptSync, timingSafeEqual } from 'node:crypto';

import jwt from 'jsonwebtoken';

const { AUTH_USERNAME, AUTH_PASSWORD_HASH, JWT_SECRET, JWT_TTL = '15m' } = process.env;

/**
 * One account per group, as the brief asks: a user table would be a feature
 * nobody needs yet. The password itself never sits in `.env`, only its scrypt
 * hash, so a leaked `.env` does not hand out the login.
 */
export function assertAuthConfig() {
  const missing = ['AUTH_USERNAME', 'AUTH_PASSWORD_HASH', 'JWT_SECRET'].filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`missing in .env: ${missing.join(', ')}`);

  // HS256 is only as strong as its secret: a short one is brute-forced offline
  // from a single captured token.
  if (JWT_SECRET.length < 32) throw new Error('JWT_SECRET must be at least 32 characters');
  if (!AUTH_PASSWORD_HASH.startsWith('scrypt$')) {
    throw new Error('AUTH_PASSWORD_HASH must come from `npm run hash-password`');
  }
}

/** `scrypt$<salt hex>$<hash hex>`, as written by scripts/hash-password.js. */
function passwordMatches(password) {
  const [, salt, expected] = AUTH_PASSWORD_HASH.split('$');
  const actual = scryptSync(password, Buffer.from(salt, 'hex'), 64);
  // Constant time: comparing byte by byte would leak how much of it was right.
  return timingSafeEqual(actual, Buffer.from(expected, 'hex'));
}

const sameString = (a, b) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

/** A short-lived token, or null when the credentials are wrong. */
export function login(username, password) {
  if (typeof username !== 'string' || typeof password !== 'string') return null;

  // Both checks always run, so a wrong username takes as long as a wrong
  // password and the timing does not reveal which one was right.
  const userOk = sameString(username, AUTH_USERNAME);
  const passwordOk = passwordMatches(password);
  if (!userOk || !passwordOk) return null;

  // Short-lived because nothing revokes it: a stolen token dies on its own.
  const token = jwt.sign({ sub: username }, JWT_SECRET, { algorithm: 'HS256', expiresIn: JWT_TTL });
  const { exp } = jwt.decode(token);
  return { token, expiresAt: exp };
}

/**
 * Guards every action. The algorithm is pinned: accepting whatever the token
 * header claims is how `alg: none` tokens get through.
 */
export function requireAuth(req, res, next) {
  const [scheme, token] = (req.get('Authorization') ?? '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'missing bearer token' });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }).sub;
    next();
  } catch {
    // Expired or forged: the app answers both the same way, by logging in again.
    res.status(401).json({ error: 'invalid or expired token' });
  }
}
