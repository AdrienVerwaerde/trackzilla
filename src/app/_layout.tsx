import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StyleSheet, useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { LifecycleBadge } from '@/components/lifecycle-badge';
import { ThemedView } from '@/components/themed-view';
import { useAccelerometer } from '@/hooks/use-accelerometer';
import { useAppLifecycle } from '@/hooks/use-app-lifecycle';
import { useBattery } from '@/hooks/use-battery';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  useAppLifecycle();
  useAccelerometer();
  useBattery();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <ThemedView style={styles.root}>
        <LifecycleBadge />
        <AppTabs />
      </ThemedView>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
