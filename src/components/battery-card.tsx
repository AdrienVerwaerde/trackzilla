import { BatteryState } from 'expo-battery';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { Spacing } from '@/constants/theme';
import { useSensorStore } from '@/stores/sensor-store';

const LevelColor = '#00ff88';
const WarningColor = '#ff6200';

/** Below this level, the bar turns to the warning color. */
const LowLevel = 0.2;

const StateLabels: Record<BatteryState, string> = {
  [BatteryState.UNKNOWN]: 'unknown',
  [BatteryState.UNPLUGGED]: 'on battery',
  [BatteryState.CHARGING]: 'charging',
  [BatteryState.FULL]: 'full',
  [BatteryState.NOT_CHARGING]: 'plugged in, not charging',
};

export function BatteryCard() {
  // The screen only reads: the listeners live in useBattery.
  const level = useSensorStore((state) => state.batteryLevel);
  const batteryState = useSensorStore((state) => state.batteryState);
  const lowPowerMode = useSensorStore((state) => state.lowPowerMode);
  const available = useSensorStore((state) => state.batteryAvailable);

  if (!available) {
    return (
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="small" themeColor="textSecondary">
          No battery information on this device
        </ThemedText>
      </ThemedView>
    );
  }

  // -1 means the platform could not read the level.
  const isKnown = level >= 0;
  const percent = Math.round(level * 100);
  const color = lowPowerMode || level < LowLevel ? WarningColor : LevelColor;

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.header}>
        <ThemedText type="small" themeColor="textSecondary">
          Battery · {StateLabels[batteryState]}
        </ThemedText>
        <ThemedText type="smallBold">{isKnown ? `${percent} %` : 'unknown'}</ThemedText>
      </View>

      <ThemedView type="backgroundSelected" style={styles.track}>
        {isKnown && <View style={[styles.fill, { width: `${percent}%`, backgroundColor: color }]} />}
      </ThemedView>

      {lowPowerMode && (
        <ThemedText type="small" style={styles.warning}>
          Low power mode is on — sensors should slow down and background work should stop.
        </ThemedText>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Spacing.two,
  },
  track: {
    height: Spacing.two,
    borderRadius: Spacing.one,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
  warning: {
    color: WarningColor,
  },
});
