import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BatteryCard } from '@/components/battery-card';
import { LiveCard } from '@/components/live-card';
import { LogRow } from '@/components/log-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useSensorStore } from '@/stores/sensor-store';
import { formatDuration } from '@/utils/format';

export default function JournalScreen() {
  // The store already keeps the most recent event first.
  const log = useSensorStore((state) => state.log);
  const clearLog = useSensorStore((state) => state.clearLog);
  const backgroundMs = useSensorStore((state) => state.backgroundMs);

  return (
    // Transparent: the app background photo shows through from the root layout.
    <View style={styles.container}>
      {/* The lifecycle badge above already covers the status bar inset. */}
      <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.safeArea}>
        <View style={styles.header}>
          <ThemedText type="subtitle">Dashboard</ThemedText>
          <Pressable onPress={clearLog} disabled={log.length === 0}>
            <ThemedView type="backgroundElement" style={styles.clearButton}>
              <ThemedText type="small" themeColor="textSecondary">
                CLEAR
              </ThemedText>
            </ThemedView>
          </Pressable>
        </View>

        <ThemedView type="backgroundElement" style={styles.summary}>
          <ThemedText type="small" themeColor="textSecondary">
            Time in background
          </ThemedText>
          <ThemedText type="smallBold">{formatDuration(backgroundMs)}</ThemedText>
        </ThemedView>

        <LiveCard />
        <BatteryCard />

        <FlatList
          data={log}
          keyExtractor={(event) => String(event.id)}
          renderItem={({ item }) => <LogRow event={item} />}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <ThemedText type="small" themeColor="textSecondary">
              No event yet: send the app to the background and come back
            </ThemedText>
          }
        />
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
    display: 'flex',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three,
  },
  clearButton: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.three,
  },
  listContent: {
    gap: Spacing.two,
    paddingBottom: BottomTabInset + Spacing.three,
  },
});
