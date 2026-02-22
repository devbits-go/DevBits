import { useMemo } from "react";
import { Easing } from "react-native-reanimated";
import { useMotionConfig } from "@/hooks/useMotionConfig";

export const useHyprMotion = () => {
  const motion = useMotionConfig();

  return useMemo(() => {
    if (motion.prefersReducedMotion) {
      return {
        spring: {
          damping: 100,
          stiffness: 1000,
          mass: 1,
          overshootClamping: true,
        },
        enterDuration: 0,
        fadeDuration: 0,
        staggerMs: 0,
        pulseDuration: 0,
        easing: Easing.linear,
      };
    }

    return {
      spring: {
        damping: 13,
        stiffness: 150,
        mass: 0.82,
        overshootClamping: false,
      },
      enterDuration: 280,
      fadeDuration: 200,
      staggerMs: 72,
      pulseDuration: 420,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
    };
  }, [motion.prefersReducedMotion]);
};
