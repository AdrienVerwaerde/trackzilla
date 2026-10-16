import * as Sentry from '@sentry/node';

// Usage: npm run sentry-test
// Sends one test error to Sentry, to check the DSN without crashing the server.
// Run through `--import ./src/instrument.js`, so Sentry is initialised exactly
// as it is for the real backend.
if (!process.env.SENTRY_DSN) {
  console.error('SENTRY_DSN is not set in .env: nothing would be sent');
  process.exit(1);
}

// A malformed DSN does not throw: Sentry logs it and quietly creates no client.
if (!Sentry.getClient()?.getDsn()) {
  console.error('SENTRY_DSN is invalid: copy the full DSN from Sentry (it contains a key before the @)');
  process.exit(1);
}

Sentry.captureException(new Error('test backend Potageek'));

// Events leave in the background: without the flush, the process would exit first.
const delivered = await Sentry.flush(5000);
console.log(delivered ? 'envoyé à Sentry' : 'échec : Sentry injoignable dans les 5 s');
process.exit(delivered ? 0 : 1);
