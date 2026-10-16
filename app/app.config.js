/**
 * Everything that varies between machines or builds comes from the
 * environment: `app/.env` locally, EAS environment variables on a cloud build.
 * `app.json` keeps what never changes and is passed in as `config`.
 *
 * Nothing secret ends up in the bundle: the app only knows the backend URL and
 * the Sentry DSN, which are public by design. Secrets used during the build
 * (SENTRY_AUTH_TOKEN for the source maps, the google-services.json file) stay
 * on the build machine.
 */
const fs = require('node:fs');

/** EAS file variable on a cloud build, a git-ignored local copy otherwise. */
function googleServicesFile() {
  if (process.env.GOOGLE_SERVICES_JSON) return process.env.GOOGLE_SERVICES_JSON;
  return fs.existsSync('./google-services.json') ? './google-services.json' : undefined;
}

module.exports = ({ config }) => {
  const projectId = config.extra?.eas?.projectId;

  // A build without a backend URL installs fine and then shows a blank app:
  // better to fail the build, where the error is readable. Expo Go and a local
  // `expo start` read app/.env, so this only bites a misconfigured EAS profile.
  if (process.env.EAS_BUILD && !process.env.EXPO_PUBLIC_API_URL) {
    throw new Error('EXPO_PUBLIC_API_URL is not set for this EAS environment');
  }

  return {
    ...config,
    // OTA updates are only compatible with builds of the same native code.
    // Tying them to the app version means: bump `version` whenever a native
    // library is added, and old builds stop receiving JS they cannot run.
    runtimeVersion: { policy: 'appVersion' },
    updates: {
      url: `https://u.expo.dev/${projectId}`,
    },
    android: {
      ...config.android,
      // Expo Push goes through Firebase on Android. The file is uploaded as an
      // EAS file variable, so it never sits in Git.
      googleServicesFile: googleServicesFile(),
    },
    plugins: [
      ...config.plugins,
      [
        '@sentry/react-native/expo',
        {
          organization: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
          url: 'https://sentry.io/',
        },
      ],
    ],
  };
};
