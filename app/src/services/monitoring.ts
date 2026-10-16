import * as Sentry from '@sentry/react-native';
import * as Updates from 'expo-updates';

/**
 * The DSN only says where to send reports, it grants no read access: it is
 * public by design and may sit in the bundle. It still comes from the
 * environment, so each EAS profile can point at its own Sentry project.
 */
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

export const monitoringEnabled = Boolean(dsn);

/** Called once, before the first render, so a crash at startup is caught too. */
export function initMonitoring() {
  if (!dsn) return;

  Sentry.init({
    dsn,
    // A crash in Expo Go or the dev client is ours, not a user's.
    environment: __DEV__ ? 'development' : (Updates.channel ?? 'unknown'),
    // Which OTA bundle crashed: after an `eas update`, the build number alone
    // no longer says which JavaScript was running.
    dist: Updates.updateId ?? undefined,
    // No IP address or device name: the reports are about the app, not about who uses it.
    sendDefaultPii: false,
    tracesSampleRate: 0,
  });
}

export const wrapRoot = Sentry.wrap;

/**
 * Shown only when EXPO_PUBLIC_SENTRY_CRASH_TEST is "true": the test crash is
 * a build setting, not code that has to be remembered and deleted before the
 * demo.
 */
export const crashTestEnabled = process.env.EXPO_PUBLIC_SENTRY_CRASH_TEST === 'true';

/** Thrown from a button handler: an uncaught JS error, with its stack trace. */
export function crashForSentryTest(): never {
  throw new Error('Potageek: crash de test Sentry');
}
