import { StyleSheet } from 'react-native';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { Spacing } from '@/constants/theme';
import { type LogEvent } from '@/stores/sensor-store';
import { formatTime } from '@/utils/format';

export function LogRow({ event }: { event: LogEvent }) {
  // Rows alternate between two backgrounds. Ids are consecutive, so their parity
  // stripes the list like an index would, but a row keeps its color when new
  // events are inserted above it.
  const isEven = event.id % 2 === 0;

  return (
    <ThemedView type={isEven ? 'backgroundElement' : 'backgroundSelected'} style={styles.row}>
      <ThemedText type="code" themeColor="textSecondary">
        {formatTime(event.at)}
      </ThemedText>
      <ThemedText type="code" style={styles.message}>
        {event.message}
      </ThemedText>
      <ThemedView type={isEven ? 'backgroundSelected' : 'backgroundElement'} style={styles.sourceTag}>
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
