import { Platform, ViewStyle } from 'react-native';
import { Colors } from '../constants/theme';

export function getShadowStyle(
  elevation: number = 2,
  shadowColor: string = Colors.shadow,
  shadowOffset: { width: number; height: number } = { width: 0, height: 2 },
  shadowOpacity: number = 0.1,
  shadowRadius: number = 4
): ViewStyle {
  if (Platform.OS === 'web') {
    const yOffset = shadowOffset.height || Math.round(elevation / 2);
    const blur = shadowRadius || elevation * 2;
    return {
      boxShadow: `0px ${yOffset}px ${blur}px ${shadowColor}`,
    } as any;
  }

  return {
    elevation,
    shadowColor,
    shadowOffset,
    shadowOpacity,
    shadowRadius,
  };
}
