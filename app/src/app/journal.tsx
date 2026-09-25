import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LogRow } from '@/components/log-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing, TopInset } from '@/constants/theme';
import { useSensorStore } from '@/stores/sensor-store';

export default function JournalScreen() {
  // The store already keeps the most recent event first.
  const log = useSensorStore((state) => state.log);
  const clearLog = useSensorStore((state) => state.clearLog);

  return (
    // Transparent: the app background photo shows through from the root layout.
    <View style={styles.container}>
      <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={styles.safeArea}>
        <View style={styles.header}>
          <ThemedText type="subtitle">Journal</ThemedText>
          <Pressable onPress={clearLog} disabled={log.length === 0}>
            <ThemedView type="backgroundButton" style={styles.clearButton}>
              <ThemedText type="small" themeColor="textSecondary">
                CLEAR
              </ThemedText>
            </ThemedView>
          </Pressable>
        </View>

        <FlatList
          data={log}
          keyExtractor={(event) => String(event.id)}
          renderItem={({ item }) => <LogRow event={item} />}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <ThemedText type="small" themeColor="textSecondary">
              Pas d’informations pour l’instant. Les relevés s’afficheront ici.
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
    flex: 1,
    width: '100%',
    // Margin, not padding: SafeAreaView owns its padding for the status bar.
    marginTop: TopInset,
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
  listContent: {
    gap: Spacing.two,
    paddingBottom: BottomTabInset + Spacing.three,
  },
});
