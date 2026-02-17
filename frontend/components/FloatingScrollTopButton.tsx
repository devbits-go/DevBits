import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAppColors } from "@/hooks/useAppColors";

type FloatingScrollTopButtonProps = {
  scrollY: Animated.Value;
  onPress: () => void;
  bottomOffset?: number;
};

export function FloatingScrollTopButton({
  scrollY,
  onPress,
  bottomOffset = 20,
}: FloatingScrollTopButtonProps) {
  const colors = useAppColors();
  const [isVisible, setIsVisible] = useState(false);
  const visibilityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const listenerId = scrollY.addListener(({ value }) => {
      const nextVisible = value > 360;
      setIsVisible((prev) => {
        if (prev === nextVisible) {
          return prev;
        }
        Animated.timing(visibilityAnim, {
          toValue: nextVisible ? 1 : 0,
          duration: nextVisible ? 180 : 140,
          useNativeDriver: true,
        }).start();
        return nextVisible;
      });
    });

    return () => {
      scrollY.removeListener(listenerId);
    };
  }, [scrollY, visibilityAnim]);

  const handlePress = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <Animated.View
      pointerEvents={isVisible ? "auto" : "none"}
      style={[
        styles.container,
        {
          bottom: bottomOffset,
          opacity: visibilityAnim,
          transform: [
            {
              scale: visibilityAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.92, 1],
              }),
            },
          ],
        },
      ]}
    >
      <Pressable
        onPress={handlePress}
        style={[
          styles.button,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Feather name="arrow-up" size={18} color={colors.tint} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 16,
    zIndex: 3,
  },
  button: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
