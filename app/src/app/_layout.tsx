import { Oi_400Regular, useFonts } from '@expo-google-fonts/oi';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AppBackground } from '@/components/app-background';
import AppTabs from '@/components/app-tabs';
import { NetworkBanner } from '@/components/network-banner';
import { useAppLifecycle } from '@/hooks/use-app-lifecycle';
import { useCachedTelemetry } from '@/hooks/use-cached-telemetry';
import { useCommandQueue } from '@/hooks/use-command-queue';
import { useNetwork } from '@/hooks/use-network';
import { useTelemetrySocket } from '@/hooks/use-telemetry-socket';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded] = useFonts({ Oi_400Regular });
  useAppLifecycle();
  useNetwork();
  // Before the socket: the screen is drawn from the cache, then revalidated.
  useCachedTelemetry();
  useCommandQueue();
  useTelemetrySocket();

  const theme = useMemo(() => {
    const base = colorScheme === 'dark' ? DarkTheme : DefaultTheme;

    return { ...base, colors: { ...base.colors, background: 'transparent' } };
  }, [colorScheme]);

  if (!fontsLoaded) return null;

  return (
    <ThemeProvider value={theme}>
      <AnimatedSplashOverlay />
      <AppBackground>
        <AppTabs />
        <NetworkBanner />
      </AppBackground>
    </ThemeProvider>
  );
}
