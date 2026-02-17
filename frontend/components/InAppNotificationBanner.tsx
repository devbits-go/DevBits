import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useAppColors } from "@/hooks/useAppColors";

type InAppNotificationBannerProps = {
  visible: boolean;
  title: string;
  body: string;
  onPress: () => void;
  onDismiss: () => void;
};

export function InAppNotificationBanner({
  visible,
  title,
  body,
  onPress,
  onDismiss,
}: InAppNotificationBannerProps) {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isRendered, setIsRendered] = useState(visible);
  const enterEase = Easing.bezier(0.22, 1, 0.36, 1);
  const swipeDismissDistance = -44;
  const swipeDismissVelocity = -0.85;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dy) > Math.abs(gestureState.dx) &&
        gestureState.dy < -4,
      onPanResponderMove: (_, gestureState) => {
        dragY.setValue(Math.min(0, gestureState.dy));
      },
      onPanResponderRelease: (_, gestureState) => {
        const shouldDismiss =
          gestureState.dy <= swipeDismissDistance ||
          gestureState.vy <= swipeDismissVelocity;

        if (shouldDismiss) {
          Animated.timing(dragY, {
            toValue: -28,
            duration: 90,
            easing: enterEase,
            useNativeDriver: true,
          }).start(() => {
            dragY.setValue(0);
            onDismiss();
          });
          return;
        }

        Animated.timing(dragY, {
          toValue: 0,
          duration: 160,
          easing: enterEase,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.timing(dragY, {
          toValue: 0,
          duration: 160,
          easing: enterEase,
          useNativeDriver: true,
        }).start();
      },
    }),
  ).current;

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (!visible) {
      dragY.setValue(0);
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -120,
          duration: 320,
          easing: enterEase,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 260,
          easing: enterEase,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          setIsRendered(false);
        }
      });
      return;
    }

    setIsRendered(true);
    dragY.setValue(0);

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 320,
        easing: enterEase,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 260,
        easing: enterEase,
        useNativeDriver: true,
      }),
    ]).start();

    timeoutRef.current = setTimeout(() => {
      onDismiss();
      timeoutRef.current = null;
    }, 4200);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [dragY, onDismiss, opacity, translateY, visible]);

  if (!isRendered) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.overlay,
        {
          top: insets.top + 8,
          opacity,
          transform: [{ translateY: Animated.add(translateY, dragY) }],
        },
      ]}
      {...panResponder.panHandlers}
    >
      <Pressable
        onPress={onPress}
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            shadowColor: colors.tint,
          },
        ]}
      >
        <View style={styles.row}>
          <Feather name="bell" size={16} color={colors.tint} />
          <View style={styles.textWrap}>
            <ThemedText type="defaultSemiBold">{title}</ThemedText>
            <ThemedText type="caption" style={{ color: colors.muted }}>
              {body}
            </ThemedText>
          </View>
          <Pressable onPress={onDismiss} hitSlop={8}>
            <Feather name="x" size={16} color={colors.muted} />
          </Pressable>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 2000,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
});
