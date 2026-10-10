import { StyleSheet } from 'react-native';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { Spacing } from '@/constants/theme';
import { formatTime } from '@/utils/format';
import type { JournalEntry, JournalTone } from '@/utils/journal';

const Tones: Record<JournalTone, { color: string; mark: string }> = {
  alert: { color: '#ff3b30', mark: '!' },
  ok: { color: '#00a06a', mark: '✓' },
  pending: { color: '#fe7f30', mark: '…' },
  neutral: { color: '#eaeaea', mark: '·' },
};

export function JournalRow({ entry, striped }: { entry: JournalEntry; striped: boolean }) {
  const tone = Tones[entry.tone];

  return (
    <ThemedView
      type={striped ? 'backgroundElement' : 'backgroundSelected'}
      style={styles.row}
      accessible
      accessibilityLabel={`${formatTime(entry.at * 1000)}, ${entry.tag}, ${entry.label}`}>
      <ThemedText type="code" themeColor="textSecondary">
        {formatTime(entry.at * 1000)}
      </ThemedText>
      <ThemedText type="code" style={[styles.mark, { color: tone.color }]}>
        {tone.mark}
      </ThemedText>
      <ThemedText type="code" style={styles.label}>
        {entry.label}
      </ThemedText>
      <ThemedView
        type={striped ? 'backgroundSelected' : 'backgroundElement'}
        style={styles.tag}>
        <ThemedText type="code" themeColor="textSecondary">
          {entry.tag}
        </ThemedText>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  mark: {
    width: Spacing.three,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  label: {
    flex: 1,
  },
  tag: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
  },
});
