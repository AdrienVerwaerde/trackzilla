/** Types of the promo API contract. Every `ts` is in epoch seconds, UTC. */

export type DeviceStatus = 'online' | 'offline';

export type Device = {
  id: string;
  group: string;
  status: DeviceStatus;
  lastSeen: number;
};

export type Measurement = {
  ts: number;
  /** Null when the reading carried no temperature (the backend accepts either value alone). */
  t: number | null;
  h: number | null;
};

export type Thresholds = {
  tMin: number | null;
  tMax: number | null;
  hMin: number | null;
  hMax: number | null;
  holdMinutes: number;
};

export type ThresholdKind = 'tMin' | 'tMax' | 'hMin' | 'hMax';

/** Events pushed by the backend over the WebSocket. */
export type SocketEvent =
  | ({ type: 'measurement'; device: string } & Measurement)
  | { type: 'alert'; device: string; ts: number; kind: ThresholdKind; value: number; threshold: number }
  | { type: 'alert_cleared'; device: string; ts: number; kind: ThresholdKind }
  | { type: 'device_status'; device: string; status: DeviceStatus };
