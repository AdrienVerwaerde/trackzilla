import { nowSeconds } from '@/api/client';
import type { SocketEvent } from '@/api/types';
import { notify } from '@/services/notifications';
import { useTelemetryStore } from '@/stores/telemetry-store';
import { formatValue, ThresholdLabels } from '@/utils/format';

const OfflineAlertAfterSeconds = 3 * 60;

/** The `lastSeen` of the silence already reported, so each one is notified once. */
let reportedSilence: number | null = null;

/**
 * One notification per `alert` frame, never per measurement: the backend sends
 * a single `alert` per breach, once it has lasted `holdMinutes`.
 */
export function handleAlertEvent(event: SocketEvent, device: string) {
  if (event.type !== 'alert' || event.device !== device) return;

  const unit = event.kind.startsWith('t') ? '°C' : '%';
  notify(
    `Alerte ${ThresholdLabels[event.kind]}`,
    `${formatValue(event.value)} ${unit} (seuil ${formatValue(event.threshold)} ${unit})`
  );
}

/**
 * Notifies once when the box has been silent for more than 3 minutes. Only
 * trusts the backend's live verdict: with the socket closed, the status on
 * screen comes from the cache and the silence may be ours, not the box's.
 */
export function checkSilentDevice() {
  const { connection, deviceStatus, lastSeen, deviceId } = useTelemetryStore.getState();

  if (connection !== 'open' || deviceStatus !== 'offline' || !lastSeen) return;

  const silent = nowSeconds() - lastSeen;
  if (silent < OfflineAlertAfterSeconds || reportedSilence === lastSeen) return;

  reportedSilence = lastSeen;
  notify('Capteur hors ligne', `${deviceId} ne répond plus depuis ${Math.floor(silent / 60)} min.`);
}
