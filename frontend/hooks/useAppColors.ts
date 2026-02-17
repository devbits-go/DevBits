import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { usePreferences } from "@/contexts/PreferencesContext";

export const useAppColors = () => {
  const theme = useColorScheme() ?? "light";
  const { preferences } = usePreferences();
  const base = Colors[theme];
  const accent = preferences.accentColor || base.tint;
  const normalized = accent.replace("#", "").trim();
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((chunk) => `${chunk}${chunk}`)
          .join("")
      : normalized.padEnd(6, "0").slice(0, 6);
  const red = parseInt(expanded.slice(0, 2), 16);
  const green = parseInt(expanded.slice(2, 4), 16);
  const blue = parseInt(expanded.slice(4, 6), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  const onTint = luminance > 0.62 ? "#0B0D10" : "#F7F9FC";

  return {
    ...base,
    tint: accent,
    onTint,
    tabIconSelected: accent,
  };
};
