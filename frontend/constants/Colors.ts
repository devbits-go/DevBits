/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const tintColorLight = "#00f329";
const tintColorDark = "#00f329";

export const Colors = {
  light: {
    text: "#111418",
    background: "#F7F9FC",
    surface: "#FFFFFF",
    surfaceAlt: "#EEF2F7",
    tint: tintColorLight,
    accent: "#0B0D10",
    muted: "#5D6775",
    border: "#D7DEE8",
    chip: "#E8EDF5",
    chipText: "#1A212B",
    icon: "#5D6775",
    tabIconDefault: "#748091",
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: "#F0F3F7",
    background: "#05070A",
    surface: "#10141A",
    surfaceAlt: "#0C1016",
    tint: tintColorDark,
    accent: "#0A0D12",
    muted: "#94A0AF",
    border: "#1F2732",
    chip: "#151C24",
    chipText: "#E6ECF5",
    icon: "#94A0AF",
    tabIconDefault: "#94A0AF",
    tabIconSelected: tintColorDark,
  },
};
