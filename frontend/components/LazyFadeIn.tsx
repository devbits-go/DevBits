import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleProp, ViewStyle } from "react-native";
import { usePreferences } from "@/contexts/PreferencesContext";
import { useMotionConfig } from "@/hooks/useMotionConfig";

type LazyFadeInProps = {
  visible: boolean;
  duration?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

export function LazyFadeIn({
  visible,
  duration = 220,
  style,
  children,
}: LazyFadeInProps) {
  const { preferences } = usePreferences();
  const motion = useMotionConfig();
  const shouldAnimate =
    preferences.imageRevealEffect === "smooth" && !motion.prefersReducedMotion;
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(6)).current;
  const scale = useRef(new Animated.Value(0.996)).current;
  const hasAnimatedRef = useRef(false);
  const [hasMountedVisible, setHasMountedVisible] = useState(false);

  useEffect(() => {
    if (!visible) {
      hasAnimatedRef.current = false;
      setHasMountedVisible(false);
      opacity.setValue(0);
      translateY.setValue(6);
      scale.setValue(0.996);
      return;
    }

    if (!hasMountedVisible) {
      setHasMountedVisible(true);
    }

    if (!shouldAnimate) {
      hasAnimatedRef.current = true;
      opacity.setValue(1);
      translateY.setValue(0);
      scale.setValue(1);
      return;
    }

    if (hasAnimatedRef.current) {
      opacity.setValue(1);
      translateY.setValue(0);
      scale.setValue(1);
      return;
    }

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished) {
        return;
      }
      hasAnimatedRef.current = true;
      opacity.setValue(1);
      translateY.setValue(0);
      scale.setValue(1);
    });
  }, [
    duration,
    hasMountedVisible,
    opacity,
    scale,
    shouldAnimate,
    translateY,
    visible,
  ]);

  if (!visible) {
    return (
      <Animated.View
        style={[
          style,
          {
            opacity: 0,
            transform: [{ translateY: 6 }, { scale: 0.996 }],
          },
        ]}
      />
    );
  }

  return (
    <Animated.View
      renderToHardwareTextureAndroid
      style={[style, { opacity, transform: [{ translateY }, { scale }] }]}
    >
      {children}
    </Animated.View>
  );
}
