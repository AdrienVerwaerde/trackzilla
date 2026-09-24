/**
 * Backend location, read from app/.env. Expo inlines EXPO_PUBLIC_* at build
 * time, so restart `expo start` after editing it.
 */
function required(name: string, value: string | undefined) {
  if (!value) throw new Error(`${name} is missing: copy app/.env.example to app/.env`);
  return value.replace(/\/$/, '');
}

export const ApiUrl = required('EXPO_PUBLIC_API_URL', process.env.EXPO_PUBLIC_API_URL);
export const WsUrl = required('EXPO_PUBLIC_WS_URL', process.env.EXPO_PUBLIC_WS_URL);
export const DeviceId = process.env.EXPO_PUBLIC_DEVICE_ID ?? 'esp-01';
