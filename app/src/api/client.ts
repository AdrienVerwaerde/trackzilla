import { ApiUrl } from '@/api/config';
import type { CommandAck, Device, JournalEvent, Measurement, Thresholds } from '@/api/types';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${ApiUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!response.ok) throw new ApiError(response.status, `${init?.method ?? 'GET'} ${path} → ${response.status}`);
  // 204 has no body to parse.
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

/** The contract speaks seconds; `Date.now()` speaks milliseconds. */
export const nowSeconds = () => Math.floor(Date.now() / 1000);

export const getDevices = () => request<Device[]>('/devices');

function queryString(params: Record<string, number | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) query.set(key, String(value));
  }
  return query.size ? `?${query}` : '';
}

/** `step` absent: raw measurements. `step` in seconds: one average per slice. */
export function getMeasurements(device: string, range: { from?: number; to?: number; step?: number } = {}) {
  const path = `/devices/${encodeURIComponent(device)}/measurements${queryString(range)}`;
  return request<Measurement[]>(path);
}

/** Oldest first. `from` is inclusive: dedupe on `eventId`. */
export function getEvents(device: string, range: { from?: number; to?: number; limit?: number } = {}) {
  const path = `/devices/${encodeURIComponent(device)}/events${queryString(range)}`;
  return request<JournalEvent[]>(path);
}

export const getThresholds = (device: string) =>
  request<Thresholds>(`/devices/${encodeURIComponent(device)}/thresholds`);

/** A JWT valid for a few minutes; `expiresAt` in epoch seconds. */
export const login = (username: string, password: string) =>
  request<{ token: string; expiresAt: number }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });

// Reads stay open on the backend: only the two actions below carry the token.
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

export const putThresholds = (device: string, thresholds: Thresholds, token: string) =>
  request<Thresholds>(`/devices/${encodeURIComponent(device)}/thresholds`, {
    method: 'PUT',
    headers: bearer(token),
    body: JSON.stringify(thresholds),
  });

/** The `id` is ours: the backend publishes a given one only once. */
export const sendCommand = (device: string, command: { id: string; led: boolean }, token: string) =>
  request<CommandAck>(`/devices/${encodeURIComponent(device)}/commands`, {
    method: 'POST',
    headers: bearer(token),
    body: JSON.stringify(command),
  });

/** Lets the backend push alerts to this phone while the app is closed. */
export const registerPushToken = (pushToken: string, token: string) =>
  request<void>('/push-tokens', {
    method: 'POST',
    headers: bearer(token),
    body: JSON.stringify({ token: pushToken }),
  });

export const unregisterPushToken = (pushToken: string, token: string) =>
  request<void>('/push-tokens', {
    method: 'DELETE',
    headers: bearer(token),
    body: JSON.stringify({ token: pushToken }),
  });
