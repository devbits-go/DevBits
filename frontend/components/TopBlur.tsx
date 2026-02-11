import React, { useMemo } from "react";
import { Animated, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColorScheme } from "@/hooks/useColorScheme";

type TopBlurProps = {
  scrollY?: Animated.Value;
};

export function TopBlur({ scrollY }: TopBlurProps) {
  const insets = useSafeAreaInsets();
  const theme = useColorScheme() ?? "light";
  const height = Math.max(insets.top, 12) + 28;
  const veilColors = useMemo(() => {
    if (theme === "dark") {
      return ["rgba(0, 0, 0, 0.24)", "rgba(0, 0, 0, 0.12)", "rgba(0, 0, 0, 0)"];
    }
    return [
      "rgba(255, 255, 255, 0.2)",
      "rgba(255, 255, 255, 0.1)",
      "rgba(255, 255, 255, 0)",
    ];
  }, [theme]);
  const veilStops = [0, 0.5, 1];
  const opacity = scrollY
    ? scrollY.interpolate({
        inputRange: [0, 60],
        outputRange: [0, 1],
        extrapolate: "clamp",
      })
    : 0;

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.blur, { height, opacity }]}
    >
      <BlurView tint="default" intensity={30} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={veilColors}
        locations={veilStops}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  blur: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    backgroundColor: "transparent",
    overflow: "hidden",
  },
});
