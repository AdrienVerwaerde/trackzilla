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

export const putThresholds = (device: string, thresholds: Thresholds) =>
  request<Thresholds>(`/devices/${encodeURIComponent(device)}/thresholds`, {
    method: 'PUT',
    body: JSON.stringify(thresholds),
  });

/** The `id` is ours: the backend publishes a given one only once. */
export const sendCommand = (device: string, command: { id: string; led: boolean }) =>
  request<CommandAck>(`/devices/${encodeURIComponent(device)}/commands`, {
    method: 'POST',
    body: JSON.stringify(command),
  });
