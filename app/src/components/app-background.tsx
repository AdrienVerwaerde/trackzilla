import { Image } from 'expo-image';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { BackgroundImageOpacity } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Full-bleed background shared by every screen: the photo is mounted once here,
 * in the root layout, so switching tabs never reloads or re-animates it.
 *
 * The root paints the theme `background` color for the faded photo to sit on:
 * without it the photo would blend into whatever the native window happens to
 * paint, which does not follow the color scheme.
 *
 * Screens stack on top and must stay transparent — a screen whose root paints a
 * `background` color hides the photo.
 */
export function AppBackground({ style, children, ...otherProps }: ViewProps) {
  const theme = useTheme();

  return (
    <View style={[styles.root, { backgroundColor: theme.background }, style]} {...otherProps}>
      <Image
        source={require('@/assets/images/potager.jpg')}
        style={[StyleSheet.absoluteFill, styles.image]}
        contentFit="cover"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  image: {
    opacity: BackgroundImageOpacity,
  },
});
