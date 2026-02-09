import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { usePreferences } from "@/contexts/PreferencesContext";

export const useAppColors = () => {
  const theme = useColorScheme() ?? "light";
  const { preferences } = usePreferences();
  const base = Colors[theme];
  const accent = preferences.accentColor || base.tint;

  return {
    ...base,
    tint: accent,
    tabIconSelected: accent,
  };
};
