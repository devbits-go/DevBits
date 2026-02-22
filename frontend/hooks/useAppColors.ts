import { useMemo } from "react";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { usePreferences } from "@/contexts/PreferencesContext";

export const useAppColors = () => {
  const theme = useColorScheme() ?? "light";
  const { preferences } = usePreferences();
  const base = Colors[theme];

  const palette = useMemo(() => {
    const baseAccent = (preferences.accentColor || base.tint).toUpperCase();
    const accent = baseAccent;

    const intensity = clamp(preferences.visualizationIntensity ?? 0.55, 0, 1);
    const mode = preferences.visualizationMode ?? "monoAccent";
    const amount = {
      monoAccent: {
        bg: 0,
        surface: 0,
        alt: 0,
        border: 0.18,
        muted: 0,
      },
      retro: {
        bg: 0.28,
        surface: 0.34,
        alt: 0.38,
        border: 0.42,
        muted: 0.2,
      },
      classic: { bg: 0.02, surface: 0.04, alt: 0.06, border: 0.1, muted: 0.05 },
      vivid: { bg: 0.05, surface: 0.11, alt: 0.16, border: 0.2, muted: 0.1 },
      neon: { bg: 0.07, surface: 0.15, alt: 0.22, border: 0.28, muted: 0.12 },
      cinematic: {
        bg: 0.04,
        surface: 0.08,
        alt: 0.12,
        border: 0.18,
        muted: 0.08,
      },
      frost: {
        bg: 0.045,
        surface: 0.08,
        alt: 0.13,
        border: 0.18,
        muted: 0.09,
      },
    }[mode];

    const isDarkTheme = theme === "dark";

    const bgTarget =
      mode === "retro"
        ? isDarkTheme
          ? "#121A12"
          : "#F3EFDE"
        : mode === "cinematic"
          ? base.accent
          : accent;
    const surfaceTarget =
      mode === "retro"
        ? isDarkTheme
          ? "#1A281A"
          : "#E9E0BF"
        : mode === "frost"
          ? "#FFFFFF"
          : accent;
    const mutedTarget =
      mode === "retro"
        ? isDarkTheme
          ? "#9BB39B"
          : "#6A5D38"
        : mode === "cinematic"
          ? base.text
          : accent;

    const monoBackground = grayscaleHex(base.background, intensity);
    const monoSurface = grayscaleHex(base.surface, intensity);
    const monoSurfaceAlt = grayscaleHex(base.surfaceAlt, intensity);
    const monoMuted = grayscaleHex(base.muted, intensity);

    const mixedBackground =
      mode === "monoAccent"
        ? monoBackground
        : blendHex(base.background, bgTarget, amount.bg * intensity);
    const mixedSurface =
      mode === "monoAccent"
        ? monoSurface
        : blendHex(base.surface, surfaceTarget, amount.surface * intensity);
    const mixedSurfaceAlt =
      mode === "monoAccent"
        ? monoSurfaceAlt
        : blendHex(base.surfaceAlt, accent, amount.alt * intensity);
    const mixedBorder = blendHex(base.border, accent, amount.border * intensity);
    const mixedMuted =
      mode === "monoAccent"
        ? monoMuted
        : blendHex(base.muted, mutedTarget, amount.muted * intensity);

    return {
      accent,
      background: mixedBackground,
      surface: mixedSurface,
      surfaceAlt: mixedSurfaceAlt,
      border: mixedBorder,
      muted: mixedMuted,
    };
  }, [
    base.accent,
    base.background,
    base.border,
    base.muted,
    base.surface,
    base.surfaceAlt,
    base.text,
    base.tint,
    preferences.accentColor,
    preferences.visualizationIntensity,
    preferences.visualizationMode,
    theme,
  ]);

  const onTint = readableOnColor(palette.accent);

  return {
    ...base,
    background: palette.background,
    surface: palette.surface,
    surfaceAlt: palette.surfaceAlt,
    border: palette.border,
    muted: palette.muted,
    tint: palette.accent,
    onTint,
    tabIconSelected: palette.accent,
  };
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const normalizeHex = (hex: string) => {
  const normalized = hex.replace("#", "").trim();
  return normalized.length === 3
    ? normalized
        .split("")
        .map((chunk) => `${chunk}${chunk}`)
        .join("")
    : normalized.padEnd(6, "0").slice(0, 6);
};

const hexToRgb = (hex: string) => {
  const expanded = normalizeHex(hex);
  return {
    r: parseInt(expanded.slice(0, 2), 16),
    g: parseInt(expanded.slice(2, 4), 16),
    b: parseInt(expanded.slice(4, 6), 16),
  };
};

const rgbToHex = (red: number, green: number, blue: number) => {
  const toHex = (channel: number) =>
    clamp(Math.round(channel), 0, 255).toString(16).padStart(2, "0");
  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`.toUpperCase();
};

const blendHex = (fromHex: string, toHex: string, amount: number) => {
  const from = hexToRgb(fromHex);
  const to = hexToRgb(toHex);
  const ratio = clamp(amount, 0, 1);
  return rgbToHex(
    from.r + (to.r - from.r) * ratio,
    from.g + (to.g - from.g) * ratio,
    from.b + (to.b - from.b) * ratio,
  );
};

const grayscaleHex = (hex: string, amount = 1) => {
  const { r, g, b } = hexToRgb(hex);
  const gray = 0.299 * r + 0.587 * g + 0.114 * b;
  const ratio = clamp(amount, 0, 1);
  return rgbToHex(
    r + (gray - r) * ratio,
    g + (gray - g) * ratio,
    b + (gray - b) * ratio,
  );
};

const relativeLuminance = (hex: string) => {
  const { r, g, b } = hexToRgb(hex);
  const transform = (value: number) => {
    const channel = value / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : Math.pow((channel + 0.055) / 1.055, 2.4);
  };
  const rr = transform(r);
  const gg = transform(g);
  const bb = transform(b);
  return 0.2126 * rr + 0.7152 * gg + 0.0722 * bb;
};

const contrastRatio = (firstHex: string, secondHex: string) => {
  const first = relativeLuminance(firstHex);
  const second = relativeLuminance(secondHex);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
};

const readableOnColor = (backgroundHex: string) => {
  const darkText = "#0B0D10";
  const lightText = "#F7F9FC";
  return contrastRatio(backgroundHex, darkText) >=
    contrastRatio(backgroundHex, lightText)
    ? darkText
    : lightText;
};

