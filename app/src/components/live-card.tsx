import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { LiveChart } from './live-chart';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { nowSeconds, sendCommand } from '@/api/client';
import type { ThresholdKind } from '@/api/types';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { type ActiveAlert, type LiveWindow, LiveWindows, useTelemetryStore } from '@/stores/telemetry-store';
import { formatTime, ThresholdLabels } from '@/utils/format';

const LiveColor = '#00ff88';
const WarningColor = '#ff6200';
const OfflineColor = '#ff3b30';
const WaitingColor = '#8e8e93';

/** The indicator counts minutes: refreshing more often would change nothing. */
const ClockTickMs = 15_000;

type Indicator = { color: string; label: string };

/** Size of the pumpkin behind each window chip: wide enough to hold "10 min". */
const PumpkinSize = 64;

const WindowLabels: Record<LiveWindow, string> = {
  600: '10 min',
  3600: '1 h',
  10800: '3 h',
};

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
  const measurements = useTelemetryStore((state) => state.measurements);
  const windowSeconds = useTelemetryStore((state) => state.windowSeconds);
  const setWindowSeconds = useTelemetryStore((state) => state.setWindowSeconds);
  const now = useNowSeconds();
  const theme = useTheme();

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

  // The window ends at the newest reading, so the curve slides one step per
  // measurement instead of jumping on a timer.
  const windowEnd = last?.ts ?? now;
  const windowStart = windowEnd - windowSeconds;
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

      {last && (
        <ThemedText type="small" themeColor="textSecondary">
          {/* ts is in seconds, formatTime expects milliseconds. */}
          {isLive ? 'Mesure' : 'Dernière mesure'} à {formatTime(last.ts * 1000)}
        </ThemedText>
      )}

      <View style={styles.chips}>
        {LiveWindows.map((window) => {
          const selected = window === windowSeconds;
          return (
            <Pressable
              key={window}
              onPress={() => setWindowSeconds(window)}
              accessibilityRole="button"
              accessibilityState={{ selected }}>
              {/* The pumpkin is the chip's shape: the label sits centered on top of it. */}
              <View style={styles.chip}>
                <MaterialCommunityIcons
                  name="pumpkin"
                  size={PumpkinSize}
                  color={selected ? theme.backgroundButton : theme.backgroundSelected}
                  style={styles.pumpkin}
                />
                <ThemedText type={selected ? 'smallBold' : 'small'} style={styles.chipLabel}>
                  {WindowLabels[window]}
                </ThemedText>
              </View>
            </Pressable>
          );
        })}
      </View>

      <LiveChart
        title="Température"
        unit="°C"
        points={measurements.map((m) => ({ ts: m.ts, value: m.t }))}
        from={windowStart}
        to={windowEnd}
        windowLabel={`-${WindowLabels[windowSeconds]}`}
      />
      <LiveChart
        title="Humidité"
        unit="%"
        points={measurements.map((m) => ({ ts: m.ts, value: m.h }))}
        from={windowStart}
        to={windowEnd}
        windowLabel={`-${WindowLabels[windowSeconds]}`}
      />

      {activeAlerts.map(([kind, alert]) => (
        <ThemedText key={kind} type="small" style={styles.alert}>
          Alerte {ThresholdLabels[kind]} : {formatValue(alert.value)} (seuil {formatValue(alert.threshold)})
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
    fontWeight: 'bold',
    backgroundColor: '#eaeaea',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  chips: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  chip: {
    width: PumpkinSize,
    height: PumpkinSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pumpkin: {
    position: 'absolute',
  },
  chipLabel: {
    // The pumpkin's body sits below its stem: nudge the label onto the body.
    marginTop: Spacing.two,
    fontSize: 12,
  },
  ledButton: {
    alignItems: 'center',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
  },
});
