import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from './themed-text';

import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useNetworkBanner } from '@/hooks/use-network-banner';

/**
 * Both pairs clear 4.5:1, the contrast floor of the accessibility criterion.
 * White on this orange would only reach 2.5:1, which is why the reconnecting
 * bar is written in black.
 */
const Appearance = {
  offline: { background: '#17171b', text: '#ffffff', icon: 'airplane' },
  reconnecting: { background: '#fe7f30', text: '#000000', icon: 'sync' },
} as const;

/**
 * The honest state of the connection, over every screen.
 *
 * It floats rather than taking a row of its own: appearing and disappearing is
 * normal for this bar, and a layout that jumped each time would be worse than
 * the few pixels it covers. It never blocks — no modal, no error screen — so
 * the cached data underneath stays readable while it is up.
 */
export function NetworkBanner() {
  const insets = useSafeAreaInsets();
  const banner = useNetworkBanner();

  if (!banner) return null;

  const { background, text, icon } = Appearance[banner.state];

  return (
    <View style={[styles.layer, { paddingTop: insets.top }]} pointerEvents="none">
      <View style={[styles.bar, { backgroundColor: background }]}>
        {/* The icon carries the state as well as the colour does: the criterion
            forbids leaning on colour alone, and 8% of men would miss it. */}
        <MaterialCommunityIcons name={icon} size={16} color={text} />
        <ThemedText
          type="smallBold"
          style={[styles.label, { color: text }]}
          // One label for the whole bar, so TalkBack reads a sentence instead
          // of an icon name followed by a fragment.
          accessible
          accessibilityRole="alert"
          accessibilityLiveRegion="polite">
          {banner.label}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    // Above the screens, below nothing: the splash overlay sits at 1000.
    zIndex: 10,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  label: {
    // Wraps instead of truncating: the longest sentence must survive the
    // system font at its largest setting.
    flexShrink: 1,
  },
});
