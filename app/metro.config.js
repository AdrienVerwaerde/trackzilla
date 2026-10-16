// Adds Sentry's debug ids to the bundle, so a crash reported from an installed
// build points at the original source lines instead of minified code.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

module.exports = getSentryExpoConfig(__dirname);
