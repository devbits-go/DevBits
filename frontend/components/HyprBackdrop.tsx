import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useColorScheme } from "@/hooks/useColorScheme";

export function HyprBackdrop() {
  const scheme = useColorScheme() ?? "light";
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 12000,
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 12000,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [drift]);

  const translateX = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [-20, 20],
  });
  const translateY = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [10, -10],
  });

  const baseColors =
    scheme === "dark" ? ["#0a1110", "#0e1715"] : ["#f2f7f3", "#e6f2eb"];
  const glowColors =
    scheme === "dark"
      ? ["rgba(58, 227, 186, 0.18)", "rgba(51, 184, 255, 0.12)"]
      : ["rgba(61, 211, 176, 0.22)", "rgba(77, 176, 255, 0.18)"];

  return (
    <View style={styles.container} pointerEvents="none">
      <LinearGradient
        colors={baseColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View
        style={[
          styles.glowLayer,
          { transform: [{ translateX }, { translateY }] },
        ]}
      >
        <LinearGradient
          colors={glowColors}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  glowLayer: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.9,
  },
});
