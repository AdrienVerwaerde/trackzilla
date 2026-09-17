import { StyleSheet } from 'react-native';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { Spacing } from '@/constants/theme';
import { type LogEvent } from '@/stores/sensor-store';
import { formatDuration, formatTime } from '@/utils/format';

export function LogRow({ event }: { event: LogEvent }) {
  return (
    <ThemedView type="backgroundElement" style={styles.row}>
      <ThemedText type="code" themeColor="textSecondary">
        {formatTime(event.at)}
      </ThemedText>
      <ThemedText type="code" style={styles.message}>
        {event.message}
      </ThemedText>
      {event.durationMs !== undefined && (
        <ThemedText type="code" themeColor="textSecondary">
          {formatDuration(event.durationMs)}
        </ThemedText>
      )}
      <ThemedView type="backgroundSelected" style={styles.sourceTag}>
        <ThemedText type="code" themeColor="textSecondary">
          {event.source}
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
  message: {
    flex: 1,
  },
  sourceTag: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
  },
});
