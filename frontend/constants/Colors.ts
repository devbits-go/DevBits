/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const tintColorLight = "#24FF4A";
const tintColorDark = "#2DFF59";

export const Colors = {
  light: {
    text: "#CFFFD8",
    background: "#070B07",
    surface: "#0E130E",
    surfaceAlt: "#0A0F0A",
    tint: tintColorLight,
    accent: "#081108",
    muted: "#7EA98B",
    border: "#1C2A1E",
    chip: "#102114",
    chipText: "#B8FFC9",
    icon: "#7EA98B",
    tabIconDefault: "#7EA98B",
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: "#D6FFE0",
    background: "#050805",
    surface: "#0B0F0B",
    surfaceAlt: "#0D120D",
    tint: tintColorDark,
    accent: "#091209",
    muted: "#85B093",
    border: "#1A261C",
    chip: "#0E1C12",
    chipText: "#C6FFDB",
    icon: "#85B093",
    tabIconDefault: "#85B093",
    tabIconSelected: tintColorDark,
  },
};
