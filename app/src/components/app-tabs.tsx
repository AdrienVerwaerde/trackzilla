import { SelectedTabColor } from '@/constants/theme';
import { NativeTabs } from 'expo-router/unstable-native-tabs';

export default function AppTabs() {
  return (
    <NativeTabs
      // The app background photo runs under the tab bar. A transparent color is
      // not enough on iOS: UIKit still paints its own blur material and the
      // hairline separator on top of it, so both are turned off here.
      backgroundColor="transparent"
      blurEffect="none"
      shadowColor="transparent"
      disableIndicator
      // Android draws a ripple on press: transparent removes it.
      rippleColor="transparent"
      tintColor={SelectedTabColor}
      iconColor={{ selected: SelectedTabColor }}
      labelStyle={{ selected: { color: SelectedTabColor } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Accueil</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/home.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="dashboard">
        <NativeTabs.Trigger.Label>Contrôle Capteur</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/explore.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="journal">
        <NativeTabs.Trigger.Label>Journal</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="list.bullet" md="list" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
