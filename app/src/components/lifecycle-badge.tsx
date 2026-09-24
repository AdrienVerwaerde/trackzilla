import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { Spacing } from '@/constants/theme';
import { useSensorStore } from '@/stores/sensor-store';

const ActiveColor = '#00ff88';
const OtherStateColor = '#ff6200';

export function LifecycleBadge() {
  const insets = useSafeAreaInsets();
  const appState = useSensorStore((state) => state.appState);

  const color = appState === 'active' ? ActiveColor : OtherStateColor;

  return (
    // First element of the layout, so it carries the status bar inset itself.
    <View style={[styles.container, { paddingTop: insets.top + Spacing.two }]}>
      <ThemedView type="backgroundElement" style={styles.badge}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <ThemedText type="smallBold" style={[styles.state, { color }]}>
          {appState}
        </ThemedText>
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.five,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
  },
  dot: {
    width: Spacing.two,
    height: Spacing.two,
    borderRadius: Spacing.one,
  },
  state: {
    textTransform: 'uppercase',
  },
});
