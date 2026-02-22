import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { useAppColors } from "@/hooks/useAppColors";
import { useNotifications } from "@/contexts/NotificationsContext";

export function MyHeader() {
  const colors = useAppColors();
  const router = useRouter();
  const { unreadCount } = useNotifications();
  const badgeCount = unreadCount > 99 ? "99+" : String(unreadCount);
  const bellScale = useRef(new Animated.Value(1)).current;
  const bellGlow = useRef(
    new Animated.Value(unreadCount > 0 ? 1 : 0.25),
  ).current;
  const terminalScale = useRef(new Animated.Value(1)).current;
  const terminalGlow = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(terminalGlow, {
          toValue: 0.8,
          duration: 900,
          useNativeDriver: false,
        }),
        Animated.timing(terminalGlow, {
          toValue: 0.35,
          duration: 900,
          useNativeDriver: false,
        }),
      ]),
    );
    pulse.start();
    return () => {
      pulse.stop();
    };
  }, [terminalGlow]);

  useEffect(() => {
    Animated.timing(bellGlow, {
      toValue: unreadCount > 0 ? 1 : 0.25,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [bellGlow, unreadCount]);

  const animateBell = (toValue: number) => {
    Animated.spring(bellScale, {
      toValue,
      speed: 22,
      bounciness: 5,
      useNativeDriver: true,
    }).start();
  };

  const animateTerminal = (toValue: number) => {
    Animated.spring(terminalScale, {
      toValue,
      speed: 22,
      bounciness: 5,
      useNativeDriver: true,
    }).start();
  };

  return (
    <View style={styles.container}>
      <View style={styles.brandRow}>
        <View>
          <ThemedText
            type="display"
            style={[styles.logoText, { color: colors.text }]}
          >
            DevBits
          </ThemedText>
          <ThemedText
            type="caption"
            style={[styles.tagline, { color: colors.muted }]}
          >
            A Place for Devs
          </ThemedText>
        </View>
      </View>
      <View style={styles.actions}>
        <Animated.View
          style={{
            shadowColor: colors.tint,
            shadowOpacity: bellGlow.interpolate({
              inputRange: [0, 1],
              outputRange: [0.08, 0.3],
            }) as unknown as number,
            shadowRadius: bellGlow.interpolate({
              inputRange: [0, 1],
              outputRange: [2, 8],
            }) as unknown as number,
            shadowOffset: { width: 0, height: 0 },
            elevation: unreadCount > 0 ? 3 : 1,
          }}
        >
          <Animated.View style={{ transform: [{ scale: bellScale }] }}>
            <Pressable
              hitSlop={10}
              onPressIn={() => animateBell(0.93)}
              onPressOut={() => animateBell(1)}
              style={[
                styles.iconButton,
                {
                  borderColor: colors.tint,
                  backgroundColor: colors.surfaceAlt,
                  shadowColor: colors.tint,
                },
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                router.push("/notifications");
              }}
            >
              <Feather name="bell" color={colors.tint} size={18} />
              {unreadCount > 0 ? (
                <View style={[styles.badge, { backgroundColor: colors.tint }]}>
                  <ThemedText
                    type="caption"
                    style={[styles.badgeText, { color: colors.onTint }]}
                  >
                    {badgeCount}
                  </ThemedText>
                </View>
              ) : null}
            </Pressable>
          </Animated.View>
        </Animated.View>
        <Animated.View
          style={[
            styles.iconShell,
            {
              shadowColor: colors.tint,
              shadowOpacity: terminalGlow.interpolate({
                inputRange: [0, 1],
                outputRange: [0.1, 0.36],
              }) as unknown as number,
              shadowRadius: terminalGlow.interpolate({
                inputRange: [0, 1],
                outputRange: [2, 9],
              }) as unknown as number,
              shadowOffset: { width: 0, height: 0 },
              elevation: 3,
            },
          ]}
        >
          <Animated.View style={{ transform: [{ scale: terminalScale }] }}>
            <Pressable
              hitSlop={10}
              onPressIn={() => animateTerminal(0.93)}
              onPressOut={() => animateTerminal(1)}
              style={[
                styles.iconButton,
                {
                  borderColor: colors.tint,
                  backgroundColor: colors.surfaceAlt,
                  shadowColor: colors.tint,
                },
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                router.push("/terminal");
              }}
            >
              <Feather name="terminal" color={colors.tint} size={19} />
            </Pressable>
          </Animated.View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 4,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  logoText: {
    fontSize: 24,
    lineHeight: 26,
  },
  tagline: {
    marginTop: 2,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginRight: 24,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
  iconShell: {
    borderRadius: 10,
  },
  badge: {
    position: "absolute",
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    lineHeight: 12,
  },
});
