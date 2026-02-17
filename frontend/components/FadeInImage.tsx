import React, { useEffect, useRef } from "react";
import { Animated, Image, ImageProps } from "react-native";
import { usePreferences } from "@/contexts/PreferencesContext";
import { useMotionConfig } from "@/hooks/useMotionConfig";

type FadeInImageProps = ImageProps & {
  duration?: number;
};

const prefetchedImageSources = new Set<string>();

export function FadeInImage({
  duration = 180,
  onLoad,
  onError,
  onLoadEnd,
  style,
  ...props
}: FadeInImageProps) {
  const { preferences } = usePreferences();
  const motion = useMotionConfig();
  const shouldAnimate =
    preferences.imageRevealEffect === "smooth" && !motion.prefersReducedMotion;
  const opacity = useRef(new Animated.Value(shouldAnimate ? 0.06 : 1)).current;
  const scale = useRef(new Animated.Value(shouldAnimate ? 1.015 : 1)).current;
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasRevealedRef = useRef(false);
  const sourceUri =
    typeof props.source === "object" &&
    props.source !== null &&
    "uri" in props.source
      ? (props.source.uri ?? "")
      : "";

  useEffect(() => {
    hasRevealedRef.current = false;
    if (!shouldAnimate) {
      opacity.setValue(1);
      scale.setValue(1);
      hasRevealedRef.current = true;
      return;
    }
    opacity.setValue(0.06);
    scale.setValue(1.015);
  }, [opacity, scale, shouldAnimate, sourceUri]);

  useEffect(() => {
    if (!shouldAnimate) {
      opacity.setValue(1);
      scale.setValue(1);
      hasRevealedRef.current = true;
      return;
    }

    if (sourceUri && !prefetchedImageSources.has(sourceUri)) {
      prefetchedImageSources.add(sourceUri);
      void Image.prefetch(sourceUri);
    }

    fallbackTimerRef.current = setTimeout(
      () => {
        if (!hasRevealedRef.current) {
          hasRevealedRef.current = true;
          Animated.parallel([
            Animated.timing(opacity, {
              toValue: 1,
              duration: Math.max(140, duration),
              useNativeDriver: true,
            }),
            Animated.timing(scale, {
              toValue: 1,
              duration: Math.max(180, duration + 20),
              useNativeDriver: true,
            }),
          ]).start(({ finished }) => {
            if (finished) {
              opacity.setValue(1);
              scale.setValue(1);
            }
          });
        }
        fallbackTimerRef.current = null;
      },
      Math.max(90, duration - 40),
    );

    return () => {
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    };
  }, [duration, opacity, scale, shouldAnimate, sourceUri]);

  const reveal = () => {
    if (!shouldAnimate) {
      return;
    }
    if (hasRevealedRef.current) {
      return;
    }
    hasRevealedRef.current = true;
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    Animated.timing(opacity, {
      toValue: 1,
      duration,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        opacity.setValue(1);
      }
    });
    Animated.timing(scale, {
      toValue: 1,
      duration: Math.max(180, duration + 20),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        scale.setValue(1);
      }
    });
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
      style={[style, { opacity, transform: [{ scale }] }]}
    />
  );
}
