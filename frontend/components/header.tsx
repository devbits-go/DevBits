import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
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
  return (
    <View style={styles.container}>
      <View style={styles.brandRow}>
        <View style={[styles.logoDot, { backgroundColor: colors.tint }]} />
        <View>
          <ThemedText type="display" style={styles.logoText}>
            DevBits
          </ThemedText>
          <ThemedText
            type="caption"
            style={[styles.tagline, { color: colors.muted }]}
          >
            bytes, streams, and late-night commits
          </ThemedText>
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable
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
                style={[styles.badgeText, { color: colors.accent }]}
              >
                {badgeCount}
              </ThemedText>
            </View>
          ) : null}
        </Pressable>
        <Pressable
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
            router.push("/(tabs)/explore");
          }}
        >
          <Feather name="search" color={colors.tint} size={18} />
        </Pressable>
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
    alignItems: "center",
    gap: 10,
  },
  logoDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
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
