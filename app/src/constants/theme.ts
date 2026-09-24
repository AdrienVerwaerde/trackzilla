/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    backgroundButton: '#fe7f30',
    textSecondary: '#eaeaea',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#727236',
    backgroundSelected: '#999344',
    backgroundButton: '#fe7f30',
    textSecondary: '#eaeaea',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

/**
 * Oi (Google Fonts), loaded from `@expo-google-fonts/oi` in the root layout.
 * It only exists in one weight: 400 Regular.
 */
export const TitleFont = 'Oi_400Regular';

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/** Icon and label color of the selected tab. */
export const SelectedTabColor = '#fe7f30';

/**
 * Opacity of the app background photo, which fades into the theme `background`
 * color painted behind it. This is the single contrast knob: lowering it moves
 * the app toward a plain themed background, raising it toward the photo at full
 * strength.
 */
export const BackgroundImageOpacity = 0.2;

/** Space between the status bar and the top of each screen's content. */
export const TopInset = Spacing.five;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
