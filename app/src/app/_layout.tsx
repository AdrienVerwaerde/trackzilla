import { Oi_400Regular, useFonts } from '@expo-google-fonts/oi';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AppBackground } from '@/components/app-background';
import AppTabs from '@/components/app-tabs';
import { useAppLifecycle } from '@/hooks/use-app-lifecycle';
import { useTelemetrySocket } from '@/hooks/use-telemetry-socket';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded] = useFonts({ Oi_400Regular });
  useAppLifecycle();
  useTelemetrySocket();

  // The navigator paints `colors.background` behind each screen, which would sit
  // between the background photo and the screen content.
  const theme = useMemo(() => {
    const base = colorScheme === 'dark' ? DarkTheme : DefaultTheme;

    return { ...base, colors: { ...base.colors, background: 'transparent' } };
  }, [colorScheme]);

  // The native splash screen stays up (auto-hide is disabled above) until Oi
  // is registered, so no screen ever paints with a fallback font first.
  if (!fontsLoaded) return null;

  return (
    <ThemeProvider value={theme}>
      <AnimatedSplashOverlay />
      <AppBackground>
        <AppTabs />
      </AppBackground>
    </ThemeProvider>
  );
}
