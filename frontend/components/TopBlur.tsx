import React from "react";
import { StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColorScheme } from "@/hooks/useColorScheme";

export function TopBlur() {
  const insets = useSafeAreaInsets();
  const theme = useColorScheme() ?? "light";
  const height = Math.max(insets.top, 12) + 8;
  const backgroundColor =
    theme === "dark" ? "rgba(5, 8, 5, 0.7)" : "rgba(7, 11, 7, 0.7)";

  return (
    <BlurView
      tint={theme === "dark" ? "dark" : "light"}
      intensity={22}
      pointerEvents="none"
      style={[styles.blur, { height, backgroundColor }]}
    />
  );
}

const styles = StyleSheet.create({
  blur: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
  },
});
