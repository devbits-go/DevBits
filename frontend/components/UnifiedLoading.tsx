import React, { useEffect, useRef } from "react";
import { ActivityIndicator, Animated, StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useAppColors } from "@/hooks/useAppColors";
import { useMotionConfig } from "@/hooks/useMotionConfig";

type UnifiedLoadingListProps = {
  rows?: number;
  cardHeight?: number;
  cardRadius?: number;
  gap?: number;
};

export function UnifiedLoadingList({
  rows = 3,
  cardHeight = 112,
  cardRadius = 14,
  gap = 12,
}: UnifiedLoadingListProps) {
  const colors = useAppColors();
  const motion = useMotionConfig();
  const pulse = useRef(new Animated.Value(0.74)).current;

  useEffect(() => {
    if (motion.prefersReducedMotion) {
      pulse.setValue(0.88);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: motion.duration(740),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.74,
          duration: motion.duration(740),
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();
    return () => {
      loop.stop();
    };
  }, [motion, pulse]);

  return (
    <View style={{ gap }}>
      {Array.from({ length: rows }).map((_, index) => (
        <Animated.View
          key={index}
          style={[
            styles.card,
            {
              height: cardHeight,
              borderRadius: cardRadius,
              borderColor: colors.border,
              backgroundColor: colors.surfaceAlt,
              opacity: pulse,
            },
          ]}
        />
      ))}
    </View>
  );
}

type UnifiedLoadingInlineProps = {
  label?: string;
};

export function UnifiedLoadingInline({
  label = "Loading…",
}: UnifiedLoadingInlineProps) {
  const colors = useAppColors();

  return (
    <View style={styles.inlineWrap}>
      <ActivityIndicator size="small" color={colors.muted} />
      <ThemedText type="caption" style={{ color: colors.muted }}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
  },
  inlineWrap: {
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingVertical: 14,
  },
});
