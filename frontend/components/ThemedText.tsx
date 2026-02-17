import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  useWindowDimensions,
  type TextProps,
} from "react-native";

import { useThemeColor } from "@/hooks/useThemeColor";
import { usePreferences } from "@/contexts/PreferencesContext";
import { useMotionConfig } from "@/hooks/useMotionConfig";

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  animateOnMount?: boolean;
  animationMode?: "fade" | "typewriter" | "none";
  type?:
    | "default"
    | "title"
    | "defaultSemiBold"
    | "subtitle"
    | "link"
    | "display"
    | "label"
    | "caption";
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  animateOnMount = true,
  animationMode = "typewriter",
  type = "default",
  children,
  onLayout,
  ...rest
}: ThemedTextProps) {
  const { fontScale } = useWindowDimensions();
  const { preferences } = usePreferences();
  const motion = useMotionConfig();
  const opacity = useRef(new Animated.Value(1)).current;
  const hasAnimatedRef = useRef(false);
  const typeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typewriterKeyRef = useRef<string | null>(null);
  const color = useThemeColor(
    { light: lightColor, dark: darkColor },
    type === "link" ? "tint" : "text",
  );
  const rawTextChild =
    typeof children === "string" || typeof children === "number"
      ? String(children)
      : null;
  const canTypewriteLength = (rawTextChild?.length ?? 0) <= 180;
  const shouldTypewrite =
    animationMode === "typewriter" &&
    !!rawTextChild &&
    canTypewriteLength &&
    Platform.OS !== "android" &&
    animateOnMount &&
    !motion.prefersReducedMotion;
  const waitingForTypewriterLayout = false;
  const [typedText, setTypedText] = useState(rawTextChild ?? "");
  const compactScale = preferences.compactMode ? 0.94 : 1;
  const accessibleScale = Math.min(1.35, Math.max(1, fontScale || 1));
  const responsiveScale = compactScale * accessibleScale;
  const baseStyle = styles[type as keyof typeof styles] ?? styles.default;
  const lineHeight =
    "lineHeight" in baseStyle ? baseStyle.lineHeight : undefined;
  const scaledStyle =
    responsiveScale === 1
      ? baseStyle
      : {
          ...baseStyle,
          fontSize: Math.round(baseStyle.fontSize * responsiveScale),
          lineHeight: lineHeight
            ? Math.round(lineHeight * responsiveScale)
            : undefined,
        };

  useEffect(() => {
    if (typeTimerRef.current) {
      clearInterval(typeTimerRef.current);
      typeTimerRef.current = null;
    }

    if (!rawTextChild) {
      typewriterKeyRef.current = null;
      setTypedText("");
      return;
    }

    if (!shouldTypewrite) {
      if (waitingForTypewriterLayout) {
        setTypedText("");
        return;
      }
      typewriterKeyRef.current = rawTextChild;
      setTypedText(rawTextChild);
      return;
    }

    if (typewriterKeyRef.current === rawTextChild) {
      setTypedText(rawTextChild);
      return;
    }

    const full = rawTextChild;
    const total = full.length;
    const chunks = Math.min(20, Math.max(8, Math.ceil(total / 3)));
    const step = Math.max(1, Math.ceil(total / chunks));
    let index = 0;
    setTypedText("");

    typeTimerRef.current = setInterval(() => {
      index = Math.min(total, index + step);
      const next = full.slice(0, index);
      setTypedText(next);
      if (index >= total) {
        typewriterKeyRef.current = full;
        if (typeTimerRef.current) {
          clearInterval(typeTimerRef.current);
          typeTimerRef.current = null;
        }
      }
    }, 12);

    return () => {
      if (typeTimerRef.current) {
        clearInterval(typeTimerRef.current);
        typeTimerRef.current = null;
      }
    };
  }, [
    animateOnMount,
    rawTextChild,
    shouldTypewrite,
    waitingForTypewriterLayout,
  ]);

  useEffect(() => {
    opacity.setValue(1);
    hasAnimatedRef.current = true;
  }, [motion, opacity]);

  const shouldBypassOpacityAnimation =
    !animateOnMount || animationMode === "none";
  const resolvedOpacity = shouldBypassOpacityAnimation ? 1 : opacity;

  return (
    <Animated.Text
      style={[{ color, opacity: resolvedOpacity }, scaledStyle, style]}
      allowFontScaling
      maxFontSizeMultiplier={1.35}
      onLayout={onLayout}
      {...rest}
    >
      {shouldTypewrite ? typedText : children}
    </Animated.Text>
  );
}

const styles = {
  default: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: "SpaceMono",
  },
  defaultSemiBold: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
    fontFamily: "SpaceMono",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    lineHeight: 28,
    fontFamily: "SpaceMono",
  },
  subtitle: {
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "SpaceMono",
  },
  link: {
    lineHeight: 22,
    fontSize: 15,
    fontFamily: "SpaceMono",
    textDecorationLine: "underline",
    textDecorationStyle: "solid",
  },
  display: {
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 32,
    letterSpacing: -0.3,
    fontFamily: "SpaceMono",
  },
  label: {
    fontSize: 12,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    fontFamily: "SpaceMono",
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "SpaceMono",
  },
} as const;
