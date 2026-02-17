import { useEffect, useRef, useState } from "react";
import { Animated, useWindowDimensions, type TextProps } from "react-native";

import { useThemeColor } from "@/hooks/useThemeColor";
import { usePreferences } from "@/contexts/PreferencesContext";
import { useMotionConfig } from "@/hooks/useMotionConfig";

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  animateOnMount?: boolean;
  animationMode?: "fade" | "typewriter" | "wave" | "none" | "auto";
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
  animateOnMount,
  animationMode = "auto",
  type = "default",
  children,
  onLayout,
  ...rest
}: ThemedTextProps) {
  const { fontScale } = useWindowDimensions();
  const { preferences } = usePreferences();
  const motion = useMotionConfig();
  const fadeOpacity = useRef(new Animated.Value(1)).current;
  const fadeTranslateY = useRef(new Animated.Value(0)).current;
  const fadeKeyRef = useRef<string | null>(null);
  const typeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wavePulseRef = useRef<Animated.CompositeAnimation | null>(null);
  const typewriterKeyRef = useRef<string | null>(null);
  const waveKeyRef = useRef<string | null>(null);
  const waveOpacity = useRef(new Animated.Value(1)).current;
  const waveTranslateY = useRef(new Animated.Value(0)).current;
  const color = useThemeColor(
    { light: lightColor, dark: darkColor },
    type === "link" ? "tint" : "text",
  );
  const rawTextChild =
    typeof children === "string" || typeof children === "number"
      ? String(children)
      : null;

  const chooseDeterministicMode = (text: string) => {
    let hash = 0;
    for (let index = 0; index < text.length; index += 1) {
      hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
    }
    const modes: Array<"fade" | "typewriter" | "wave"> = [
      "fade",
      "typewriter",
      "wave",
    ];
    return modes[hash % modes.length];
  };

  const preferenceMode =
    preferences.textRenderEffect === "off"
      ? "none"
      : preferences.textRenderEffect === "smooth"
        ? "fade"
        : preferences.textRenderEffect;

  const resolvedMode =
    animationMode === "auto"
      ? preferenceMode === "random"
        ? rawTextChild
          ? chooseDeterministicMode(rawTextChild)
          : "fade"
        : preferenceMode
      : animationMode;

  const shouldAnimate =
    (() => {
      const headingLike =
        type === "display" ||
        type === "title" ||
        type === "subtitle" ||
        type === "label";
      const effectMode =
        resolvedMode === "typewriter" || resolvedMode === "wave";
      return animateOnMount ?? (headingLike || effectMode);
    })() &&
    !motion.prefersReducedMotion &&
    resolvedMode !== "none";

  const canTypewriteLength = (rawTextChild?.length ?? 0) <= 180;
  const shouldTypewrite =
    resolvedMode === "typewriter" &&
    !!rawTextChild &&
    canTypewriteLength &&
    shouldAnimate;
  const shouldWave =
    resolvedMode === "wave" &&
    !!rawTextChild &&
    canTypewriteLength &&
    shouldAnimate;
  const shouldFade = resolvedMode === "fade" && shouldAnimate;
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
    if (!shouldFade) {
      fadeKeyRef.current = rawTextChild;
      fadeOpacity.setValue(1);
      fadeTranslateY.setValue(0);
      return;
    }

    const nextKey = rawTextChild ?? `__nontext__${type}`;
    if (fadeKeyRef.current === nextKey) {
      fadeOpacity.setValue(1);
      fadeTranslateY.setValue(0);
      return;
    }
    fadeKeyRef.current = nextKey;

    fadeOpacity.setValue(0.06);
    fadeTranslateY.setValue(8);
    Animated.parallel([
      Animated.timing(fadeOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(fadeTranslateY, {
        toValue: 0,
        duration: 240,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        fadeOpacity.setValue(1);
        fadeTranslateY.setValue(0);
      }
    });
  }, [fadeOpacity, fadeTranslateY, shouldFade, rawTextChild]);

  useEffect(() => {
    wavePulseRef.current?.stop();
    wavePulseRef.current = null;
    waveOpacity.setValue(1);
    waveTranslateY.setValue(0);

    if (shouldWave) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(waveOpacity, {
              toValue: 0.74,
              duration: 110,
              useNativeDriver: true,
            }),
            Animated.timing(waveTranslateY, {
              toValue: 1.5,
              duration: 110,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(waveOpacity, {
              toValue: 1,
              duration: 130,
              useNativeDriver: true,
            }),
            Animated.timing(waveTranslateY, {
              toValue: 0,
              duration: 130,
              useNativeDriver: true,
            }),
          ]),
        ]),
      );
      wavePulseRef.current = pulse;
      pulse.start();
    }

    return () => {
      wavePulseRef.current?.stop();
      wavePulseRef.current = null;
      waveOpacity.setValue(1);
      waveTranslateY.setValue(0);
    };
  }, [shouldWave, waveOpacity, waveTranslateY]);

  useEffect(() => {
    if (typeTimerRef.current) {
      clearInterval(typeTimerRef.current);
      typeTimerRef.current = null;
    }

    if (!rawTextChild) {
      typewriterKeyRef.current = null;
      waveKeyRef.current = null;
      setTypedText("");
      return;
    }

    if (!shouldTypewrite && !shouldWave) {
      typewriterKeyRef.current = rawTextChild;
      waveKeyRef.current = rawTextChild;
      setTypedText(rawTextChild);
      return;
    }

    if (shouldWave && waveKeyRef.current === rawTextChild) {
      setTypedText(rawTextChild);
      return;
    }

    if (typewriterKeyRef.current === rawTextChild) {
      setTypedText(rawTextChild);
      return;
    }

    const full = rawTextChild;
    const total = full.length;
    const chunks = shouldWave
      ? Math.min(22, Math.max(9, Math.ceil(total / 2.6)))
      : Math.min(28, Math.max(10, Math.ceil(total / 2.4)));
    const stepBase = Math.max(1, Math.ceil(total / chunks));
    const wavePattern = [1, 2, 1, 3, 2, 1, 2, 3];
    let wavePatternIndex = 0;
    let index = 0;
    setTypedText("");

    typeTimerRef.current = setInterval(
      () => {
        const step = shouldWave
          ? Math.max(1, Math.round(stepBase * wavePattern[wavePatternIndex]))
          : stepBase;
        wavePatternIndex = (wavePatternIndex + 1) % wavePattern.length;
        index = Math.min(total, index + step);
        const next = full.slice(0, index);
        setTypedText(next);
        if (index >= total) {
          typewriterKeyRef.current = full;
          waveKeyRef.current = full;
          wavePulseRef.current?.stop();
          wavePulseRef.current = null;
          waveOpacity.setValue(1);
          waveTranslateY.setValue(0);
          if (typeTimerRef.current) {
            clearInterval(typeTimerRef.current);
            typeTimerRef.current = null;
          }
        }
      },
      shouldWave ? 24 : 14,
    );

    return () => {
      if (typeTimerRef.current) {
        clearInterval(typeTimerRef.current);
        typeTimerRef.current = null;
      }
    };
  }, [rawTextChild, shouldTypewrite, shouldWave, waveOpacity, waveTranslateY]);

  return (
    <Animated.Text
      style={[
        { color },
        scaledStyle,
        shouldFade
          ? {
              opacity: fadeOpacity,
              transform: [{ translateY: fadeTranslateY }],
            }
          : null,
        shouldWave
          ? {
              opacity: waveOpacity,
              transform: [{ translateY: waveTranslateY }],
            }
          : null,
        style,
      ]}
      allowFontScaling
      maxFontSizeMultiplier={1.35}
      onLayout={onLayout}
      {...rest}
    >
      {shouldTypewrite || shouldWave ? typedText : children}
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
