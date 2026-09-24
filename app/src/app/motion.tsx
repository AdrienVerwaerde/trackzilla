import { Image, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import {
  ShakeThreshold,
  UpdateIntervals,
  useSensorStore,
  type AccelerometerStatus,
  type UpdateInterval,
} from '@/stores/sensor-store';

/** Full-scale deflection of a bar, in g. */
const MaxG = 2;

/** Above this magnitude, something much bigger than a shake is going on. */
const GodzillaThreshold = 2;

const AxisColors = {
  x: '#50A4C9',
  y: '#00ff88',
  z: '#C6311D',
} as const;

const StatusLabels: Record<AccelerometerStatus, string> = {
  idle: 'Starting...',
  active: 'Active',
  paused: 'Paused (app in background)',
  unavailable: 'No accelerometer on this device',
  denied: 'Motion permission denied',
};

function AxisBar({ axis, value }: { axis: keyof typeof AxisColors; value: number }) {
  // Bars grow from the middle so the sign of the axis stays readable.
  const width = `${Math.min(Math.abs(value) / MaxG, 1) * 50}%` as const;

  return (
    <View style={styles.axisRow}>
      <ThemedText type="code">{axis}</ThemedText>
      <ThemedView type="backgroundElement" style={styles.track}>
        <View
          style={[
            styles.fill,
            { width, backgroundColor: AxisColors[axis] },
            value >= 0 ? styles.fillPositive : styles.fillNegative,
          ]}
        />
      </ThemedView>
      <ThemedText type="code" style={styles.axisValue}>
        {value.toFixed(2)}
      </ThemedText>
    </View>
  );
}

function IntervalButton({ interval }: { interval: UpdateInterval }) {
  const updateInterval = useSensorStore((state) => state.updateInterval);
  const setUpdateInterval = useSensorStore((state) => state.setUpdateInterval);
  const isSelected = interval === updateInterval;

  return (
    <Pressable
      style={({ pressed }) => [styles.intervalButton, pressed && styles.pressed]}
      onPress={() => setUpdateInterval(interval)}>
      <ThemedView
        type={isSelected ? 'backgroundSelected' : 'backgroundElement'}
        style={styles.intervalButtonInner}>
        <ThemedText type="smallBold" themeColor={isSelected ? 'text' : 'textSecondary'}>
          {interval} ms
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

export default function MotionScreen() {
  // The screen only reads: the subscription lives in useAccelerometer.
  const { x, y, z } = useSensorStore((state) => state.accelerometer);
  const magnitude = useSensorStore((state) => state.magnitude);
  const samples = useSensorStore((state) => state.samples);
  const status = useSensorStore((state) => state.accelerometerStatus);

  const isShaking = magnitude > ShakeThreshold;
  const isGodzilla = magnitude > GodzillaThreshold;

  return (
    // Transparent: the app background photo shows through from the root layout.
    <View style={styles.container}>
      {/* The lifecycle badge above already covers the status bar inset. */}
      <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.safeArea}>
        <View style={styles.header}>
          <ThemedText type="subtitle">Motion</ThemedText>
          {isShaking && (
            <View style={styles.badge}>
              <ThemedText type="smallBold" style={styles.badgeText}>
                SHAKES DETECTED
              </ThemedText>
            </View>
          )}
        </View>

        <ThemedView type="backgroundElement" style={styles.summary}>
          <ThemedText type="small" themeColor="textSecondary">
            Magnitude
          </ThemedText>
          <ThemedText type="smallBold">{magnitude.toFixed(2)} g</ThemedText>
        </ThemedView>

        {isGodzilla && (
          <View style={[styles.badge, styles.godzillaBadge]}>
            <Image source={require('@/assets/images/icon.png')} style={styles.badgeImage} />
            <ThemedText type="smallBold" style={styles.godzillaBadgeText}>
              GODZILLA DETECTED !!
            </ThemedText>
          </View>
        )}

        <View style={styles.axes}>
          <AxisBar axis="x" value={x} />
          <AxisBar axis="y" value={y} />
          <AxisBar axis="z" value={z} />
        </View>

        <View style={styles.intervals}>
          {UpdateIntervals.map((interval) => (
            <IntervalButton key={interval} interval={interval} />
          ))}
        </View>

        <View style={styles.footer}>
          <ThemedText type="small" themeColor="textSecondary">
            {StatusLabels[status]}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {samples} samples
          </ThemedText>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    flexDirection: 'row',
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.three,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three,
  },
  badge: {
    backgroundColor: '#C6311D',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
  badgeText: {
    color: '#efffff',
  },
  godzillaBadge: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  badgeImage: {
    width: 75,
    height: 75,
    marginRight: Spacing.two,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#C6311D',
  },
  godzillaBadgeText: {
    color: '#efffff',
    backgroundColor: '#C6311D',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.two,
    textAlign: 'center',
    flex: 1,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  axes: {
    gap: Spacing.two,
  },
  axisRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  track: {
    flex: 1,
    height: Spacing.four,
    borderRadius: Spacing.two,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  fillPositive: {
    left: '50%',
  },
  fillNegative: {
    right: '50%',
  },
  axisValue: {
    width: 44,
    textAlign: 'right',
  },
  intervals: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  intervalButton: {
    flex: 1,
  },
  intervalButtonInner: {
    alignItems: 'center',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
