import React, { useRef, useState } from "react";
import { Animated, ImageProps } from "react-native";

type FadeInImageProps = ImageProps & {
  duration?: number;
};

export function FadeInImage({
  duration = 150,
  onLoad,
  style,
  ...props
}: FadeInImageProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const [hasLoaded, setHasLoaded] = useState(false);

  const handleLoad: ImageProps["onLoad"] = (event) => {
    if (!hasLoaded) {
      setHasLoaded(true);
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        useNativeDriver: true,
      }).start();
    }
    onLoad?.(event);
  };

  return (
    <Animated.Image
      {...props}
      onLoad={handleLoad}
      style={[style, { opacity }]}
    />
  );
}
