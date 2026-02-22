import { useMemo, useRef } from "react";
import { Animated } from "react-native";

type TopBlurScroll = {
  scrollY: Animated.Value;
  onScroll: (event: any) => void;
};

export function useTopBlurScroll(): TopBlurScroll {
  const scrollY = useRef(new Animated.Value(0)).current;
  const onScroll = useMemo(
    () =>
      Animated.event(
        [{ nativeEvent: { contentOffset: { y: scrollY } } }],
        { useNativeDriver: true },
      ),
    [scrollY],
  );

  return { scrollY, onScroll };
}
