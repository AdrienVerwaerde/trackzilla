import * as Sentry from '@sentry/node';

/**
 * Loaded with `node --import` before anything else: Sentry has to patch
 * Express and http before they are imported, or it sees none of their errors.
 *
 * No DSN, no Sentry: a laptop without the variable runs exactly as before, and
 * the tests never send anything.
 */
const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? 'development',
    // A greenhouse backend sees a handful of requests a minute: tracing them
    // all costs nothing and shows which route is slow.
    tracesSampleRate: 1.0,
    // Bodies carry passwords (/auth/login) and push tokens: keep them out.
    sendDefaultPii: false,
  });
  console.log('[sentry] enabled');
}
