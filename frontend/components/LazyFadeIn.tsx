import React, { useEffect, useRef } from "react";
import { Animated, StyleProp, ViewStyle } from "react-native";

type LazyFadeInProps = {
  visible: boolean;
  duration?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

export function LazyFadeIn({
  visible,
  duration = 150,
  style,
  children,
}: LazyFadeInProps) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      return;
    }
    Animated.timing(opacity, {
      toValue: 1,
      duration,
      useNativeDriver: true,
    }).start();
  }, [duration, opacity, visible]);

  if (!visible) {
    return <Animated.View style={[style, { opacity: 0 }]} />;
  }

  return <Animated.View style={[style, { opacity }]}>{children}</Animated.View>;
}
