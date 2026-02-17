import React, { useEffect, useRef } from "react";
import { Animated, ImageProps } from "react-native";

type FadeInImageProps = ImageProps & {
  duration?: number;
};

export function FadeInImage({
  duration = 150,
  onLoad,
  onError,
  onLoadEnd,
  style,
  ...props
}: FadeInImageProps) {
  const opacity = useRef(new Animated.Value(0.08)).current;
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fallbackTimerRef.current = setTimeout(
      () => {
        Animated.timing(opacity, {
          toValue: 1,
          duration: Math.max(120, duration),
          useNativeDriver: true,
        }).start();
        fallbackTimerRef.current = null;
      },
      Math.max(300, duration + 120),
    );

    return () => {
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    };
  }, [duration, opacity]);

  const reveal = () => {
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    Animated.timing(opacity, {
      toValue: 1,
      duration,
      useNativeDriver: true,
    }).start();
  };

  const handleLoad: ImageProps["onLoad"] = (event) => {
    reveal();
    onLoad?.(event);
  };

  const handleError: ImageProps["onError"] = (event) => {
    reveal();
    onError?.(event);
  };

  const handleLoadEnd: ImageProps["onLoadEnd"] = (event) => {
    reveal();
    onLoadEnd?.(event);
  };

  return (
    <Animated.Image
      {...props}
      onLoad={handleLoad}
      onError={handleError}
      onLoadEnd={handleLoadEnd}
      style={[style, { opacity }]}
    />
  );
}
