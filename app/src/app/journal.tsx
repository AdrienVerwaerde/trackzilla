import { useMemo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { JournalRow } from '@/components/journal-row';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, Spacing, TopInset } from '@/constants/theme';
import { useCommandStore } from '@/stores/command-store';
import { useJournalStore } from '@/stores/journal-store';
import { toJournalEntries } from '@/utils/journal';

export default function JournalScreen() {
  const events = useJournalStore((state) => state.events);
  const commands = useCommandStore((state) => state.commands);

  const entries = useMemo(() => toJournalEntries(events, commands), [events, commands]);

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={styles.safeArea}>
        <View style={styles.header}>
          <ThemedText type="subtitle">Journal</ThemedText>
        </View>

        <FlatList
          data={entries}
          keyExtractor={(entry) => entry.key}
          renderItem={({ item, index }) => <JournalRow entry={item} striped={index % 2 === 0} />}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <ThemedText type="small" themeColor="textSecondary">
              Rien à signaler pour l’instant. Alertes, passages hors ligne et commandes
              s’afficheront ici.
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
    marginTop: TopInset,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
  },
  header: {
    paddingVertical: Spacing.three,
  },
  listContent: {
    gap: Spacing.two,
    paddingBottom: BottomTabInset + Spacing.three,
  },
});
