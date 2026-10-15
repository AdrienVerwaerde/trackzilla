import { randomBytes, scryptSync } from 'node:crypto';

// Usage: npm run hash-password -- '<password>'
// Prints the value to paste into AUTH_PASSWORD_HASH in .env.
const password = process.argv[2];
if (!password) {
  console.error("usage: npm run hash-password -- '<password>'");
  process.exit(1);
}

const salt = randomBytes(16);
const hash = scryptSync(password, salt, 64);
console.log(`scrypt$${salt.toString('hex')}$${hash.toString('hex')}`);
