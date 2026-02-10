/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const tintColorLight = "#00f329";
const tintColorDark = "#00f329";

export const Colors = {
  light: {
    text: "#E6E6E6",
    background: "#0B0B0B",
    surface: "#151515",
    surfaceAlt: "#111111",
    tint: tintColorLight,
    accent: "#0F0F0F",
    muted: "#A0A0A0",
    border: "#252525",
    chip: "#1A1A1A",
    chipText: "#E0E0E0",
    icon: "#A0A0A0",
    tabIconDefault: "#A0A0A0",
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: "#F0F0F0",
    background: "#050505",
    surface: "#101010",
    surfaceAlt: "#0D0D0D",
    tint: tintColorDark,
    accent: "#0A0A0A",
    muted: "#9A9A9A",
    border: "#1F1F1F",
    chip: "#141414",
    chipText: "#E6E6E6",
    icon: "#9A9A9A",
    tabIconDefault: "#9A9A9A",
    tabIconSelected: tintColorDark,
  },
};
