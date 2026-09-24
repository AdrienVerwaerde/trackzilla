import { LogRow } from '@/components/log-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useSensorStore } from '@/stores/sensor-store';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const LastEventsCount = 5;

export default function HomeScreen() {
  const log = useSensorStore((state) => state.log);
  // Sliced outside the selector: a selector returning a new array on every call
  // would re-render on every store notification.
  const lastEvents = log.slice(0, LastEventsCount);

  return (
    // Transparent: the app background photo shows through from the root layout.
    <View style={styles.container}>
      {/* The lifecycle badge above already covers the status bar inset. */}
      <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.safeArea}>
        <View style={styles.heroSection}>
          <Image
            source={require('@/assets/images/logo-glow.png')}
            style={{ width: 200, height: 200, position: 'absolute', top: -10, left: -10, right: 0, bottom: 0, zIndex: 100}}
          />
          <Image
            source={require('@/assets/images/icon.png')}
            style={{ width: 200, height: 200, borderRadius: 50 }}
          />
          <ThemedText type="subtitle">
            Trackzilla
          </ThemedText>
        </View>

        <View style={styles.lastEvents}>
          <ThemedText type="small" themeColor="textSecondary">
            Last events
          </ThemedText>
          {lastEvents.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              No event yet
            </ThemedText>
          ) : (
            lastEvents.map((event) => <LogRow key={event.id} event={event} />)
          )}

          <Link href="/dashboard" asChild>
            <Pressable style={({ pressed }) => pressed && styles.pressed}>
              <ThemedView type="backgroundElement" style={styles.seeMoreButton}>
                <ThemedText type="small" style={{ color: '#333' }}>
                  SEE MORE
                </ThemedText>
              </ThemedView>
            </Pressable>
          </Link>
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
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
  },
  heroSection: {
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  lastEvents: {
    flex: 1,
    justifyContent: 'flex-start',
    gap: Spacing.two,
  },
  seeMoreButton: {
    alignItems: 'center',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    backgroundColor: '#50A4C9',
  },
  pressed: {
    opacity: 0.7,

  },
  title: {
    textAlign: 'center',
  },
  code: {
    textTransform: 'uppercase',
  },
  stepContainer: {
    gap: Spacing.three,
    alignSelf: 'stretch',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.four,
    borderRadius: Spacing.four,
  },
});
