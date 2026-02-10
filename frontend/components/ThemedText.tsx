import { Text, type TextProps } from "react-native";

import { useThemeColor } from "@/hooks/useThemeColor";
import { usePreferences } from "@/contexts/PreferencesContext";

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?:
    | "default"
    | "title"
    | "defaultSemiBold"
    | "subtitle"
    | "link"
    | "display"
    | "label"
    | "caption";
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = "default",
  ...rest
}: ThemedTextProps) {
  const { preferences } = usePreferences();
  const color = useThemeColor(
    { light: lightColor, dark: darkColor },
    type === "link" ? "tint" : "text",
  );
  const compactScale = preferences.compactMode ? 0.94 : 1;
  const baseStyle = styles[type as keyof typeof styles] ?? styles.default;
  const scaledStyle =
    compactScale === 1
      ? baseStyle
      : {
          ...baseStyle,
          fontSize: Math.round(baseStyle.fontSize * compactScale),
          lineHeight: baseStyle.lineHeight
            ? Math.round(baseStyle.lineHeight * compactScale)
            : undefined,
        };

  return <Text style={[{ color }, scaledStyle, style]} {...rest} />;
}

const styles = {
  default: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: "SpaceMono",
  },
  defaultSemiBold: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
    fontFamily: "SpaceMono",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    lineHeight: 28,
    fontFamily: "SpaceMono",
  },
  subtitle: {
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "SpaceMono",
  },
  link: {
    lineHeight: 22,
    fontSize: 15,
    fontFamily: "SpaceMono",
    textDecorationLine: "underline",
    textDecorationStyle: "solid",
  },
  display: {
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 32,
    letterSpacing: -0.3,
    fontFamily: "SpaceMono",
  },
  label: {
    fontSize: 12,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    fontFamily: "SpaceMono",
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "SpaceMono",
  },
} as const;
