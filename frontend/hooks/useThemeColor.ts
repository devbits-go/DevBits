/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { useColorScheme } from '@/hooks/useColorScheme';
import { useAppColors } from '@/hooks/useAppColors';

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof ReturnType<typeof useAppColors>
) {
  const theme = useColorScheme() ?? 'light';
  const colorFromProps = props[theme];
  const colors = useAppColors();

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return colors[colorName];
  }
}
