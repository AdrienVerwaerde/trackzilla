import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { nowSeconds, sendCommand } from '@/api/client';
import type { ThresholdKind } from '@/api/types';
import { Spacing } from '@/constants/theme';
import { type ActiveAlert, useTelemetryStore } from '@/stores/telemetry-store';
import { formatTime } from '@/utils/format';

const LiveColor = '#00ff88';
const WarningColor = '#ff6200';
const OfflineColor = '#ff3b30';
const WaitingColor = '#8e8e93';

/** The indicator counts minutes: refreshing more often would change nothing. */
const ClockTickMs = 15_000;

type Indicator = { color: string; label: string };

/** Comma as the decimal separator, one decimal: "22,4". */
function formatValue(value: number | null) {
  return value === null ? '–' : value.toFixed(1).replace('.', ',');
}

function sinceLabel(lastSeen: number | null, now: number) {
  if (lastSeen === null) return '';
  const minutes = Math.floor((now - lastSeen) / 60);
  return minutes < 1 ? " depuis moins d'une minute" : ` depuis ${minutes} min`;
}

/** Re-renders every `ClockTickMs`, so "depuis N min" keeps counting while no event arrives. */
function useNowSeconds() {
  const [now, setNow] = useState(nowSeconds);

  useEffect(() => {
    const timer = setInterval(() => setNow(nowSeconds()), ClockTickMs);
    return () => clearInterval(timer);
  }, []);

  return now;
}

export function LiveCard() {
  // The screen only reads: the socket lives in useTelemetrySocket.
  const deviceId = useTelemetryStore((state) => state.deviceId);
  const connection = useTelemetryStore((state) => state.connection);
  const deviceStatus = useTelemetryStore((state) => state.deviceStatus);
  const lastSeen = useTelemetryStore((state) => state.lastSeen);
  const last = useTelemetryStore((state) => state.last);
  const alerts = useTelemetryStore((state) => state.alerts);
  const now = useNowSeconds();

  // The backend never reports the LED state: this is the last order sent.
  const [led, setLed] = useState(false);
  const [sending, setSending] = useState(false);
  const [commandError, setCommandError] = useState<string | null>(null);

  // Two levels: app ↔ backend first, then box ↔ broker. A green dot while the
  // box has been unplugged for an hour would be a lie.
  let indicator: Indicator;
  if (connection === 'lost') {
    indicator = { color: OfflineColor, label: 'Vous êtes hors ligne' };
  } else if (connection !== 'open') {
    indicator = { color: WaitingColor, label: 'Connexion au backend…' };
  } else if (deviceStatus === 'offline') {
    indicator = { color: WarningColor, label: `Capteur hors ligne${sinceLabel(lastSeen, now)}` };
  } else if (deviceStatus === 'online') {
    indicator = { color: LiveColor, label: 'En direct' };
  } else {
    indicator = { color: WaitingColor, label: 'En attente du capteur…' };
  }

  const isLive = connection === 'open' && deviceStatus === 'online';
  // `alert_cleared` deletes the key, so every entry left is a real alert.
  const activeAlerts = Object.entries(alerts) as [ThresholdKind, ActiveAlert][];

  async function toggleLed() {
    const next = !led;
    setSending(true);
    setCommandError(null);

    try {
      await sendCommand(deviceId, { led: next });
      setLed(next);
    } catch {
      setCommandError('Commande non envoyée');
    } finally {
      setSending(false);
    }
  }

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.dot, { backgroundColor: indicator.color }]} />
        <ThemedText type="smallBold" style={styles.indicatorLabel}>
          {indicator.label}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {deviceId}
        </ThemedText>
      </View>

      <View style={[styles.values, !isLive && styles.stale]}>
        <ThemedText type="title">{formatValue(last?.t ?? null)} °C</ThemedText>
        <ThemedText type="subtitle" themeColor="textSecondary">
          {formatValue(last?.h ?? null)} %
        </ThemedText>
      </View>

      {last && (
        <ThemedText type="small" themeColor="textSecondary">
          {/* ts is in seconds, formatTime expects milliseconds. */}
          {isLive ? 'Mesure' : 'Dernière mesure'} à {formatTime(last.ts * 1000)}
        </ThemedText>
      )}

      {activeAlerts.map(([kind, alert]) => (
        <ThemedText key={kind} type="small" style={styles.alert}>
          Alerte {kind} : {formatValue(alert.value)} (seuil {formatValue(alert.threshold)})
        </ThemedText>
      ))}

      <Pressable onPress={toggleLed} disabled={sending || connection !== 'open'}>
        <ThemedView type="backgroundButton" style={styles.ledButton}>
          {sending ? (
            <ActivityIndicator size="small" />
          ) : (
            <ThemedText type="smallBold">{led ? 'ÉTEINDRE LA LED' : 'ALLUMER LA LED'}</ThemedText>
          )}
        </ThemedView>
      </Pressable>

      {commandError && (
        <ThemedText type="small" style={styles.alert}>
          {commandError}
        </ThemedText>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dot: {
    width: Spacing.two,
    height: Spacing.two,
    borderRadius: Spacing.one,
  },
  indicatorLabel: {
    flex: 1,
  },
  values: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.three,
  },
  stale: {
    opacity: 0.5,
  },
  alert: {
    color: OfflineColor,
  },
  ledButton: {
    alignItems: 'center',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
  },
});
