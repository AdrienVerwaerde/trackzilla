import { Colors, SelectedTabColor } from '@/constants/theme';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      disableIndicator
      // Android draws a ripple on press: transparent removes it.
      rippleColor="transparent"
      tintColor={SelectedTabColor}
      iconColor={{ selected: SelectedTabColor }}
      labelStyle={{ selected: { color: SelectedTabColor } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/home.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="motion">
        <NativeTabs.Trigger.Label>Motion</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="speedometer" md="speed" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="dashboard">
        <NativeTabs.Trigger.Label>Dashboard</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/explore.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
