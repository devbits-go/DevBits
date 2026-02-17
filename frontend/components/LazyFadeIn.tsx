import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleProp, ViewStyle } from "react-native";

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
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(6)).current;
  const scale = useRef(new Animated.Value(0.996)).current;
  const hasAnimatedRef = useRef(false);
  const [hasLaidOut, setHasLaidOut] = useState(false);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) {
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
      hasAnimatedRef.current = false;
      setHasLaidOut(false);
      opacity.setValue(1);
      translateY.setValue(6);
      scale.setValue(0.996);
      return;
    }

    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }

    fallbackTimerRef.current = setTimeout(
      () => {
        hasAnimatedRef.current = true;
        opacity.setValue(1);
        translateY.setValue(0);
        scale.setValue(1);
        setHasLaidOut(true);
        fallbackTimerRef.current = null;
      },
      Math.max(260, duration + 120),
    );

    if (!hasLaidOut) {
      return;
    }

    if (hasAnimatedRef.current) {
      opacity.setValue(1);
      translateY.setValue(0);
      scale.setValue(1);
      return;
    }

    Animated.parallel([
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
    ]).start(() => {
      hasAnimatedRef.current = true;
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    });

    return () => {
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    };
  }, [duration, hasLaidOut, opacity, scale, translateY, visible]);

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
      onLayout={() => {
        if (!hasLaidOut) {
          setHasLaidOut(true);
        }
      }}
      renderToHardwareTextureAndroid
      style={[style, { opacity, transform: [{ translateY }, { scale }] }]}
    >
      {children}
    </Animated.View>
  );
}
