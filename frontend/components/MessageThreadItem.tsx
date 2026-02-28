import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { FadeInImage } from "@/components/FadeInImage";
import { useAppColors } from "@/hooks/useAppColors";

interface MessageThreadItemProps {
  username: string;
  lastMessage: string;
  timestamp: string;
  avatarUrl?: string;
  unreadCount?: number;
  isOnline?: boolean;
}

export function MessageThreadItem({
  username,
  lastMessage,
  timestamp,
  avatarUrl,
  unreadCount = 0,
  isOnline = false,
}: MessageThreadItemProps) {
  const colors = useAppColors();
  const router = useRouter();

  const handlePress = () => {
    router.push(`/conversation/${username}`);
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.avatarContainer}>
        <FadeInImage
          source={{
            uri: avatarUrl || `https://api.dicebear.com/7.x/avataaars/png?seed=${username}`,
          }}
          style={styles.avatar}
        />
        {isOnline && (
          <View
            style={[
              styles.onlineIndicator,
              { backgroundColor: colors.tint, borderColor: colors.surface },
            ]}
          />
        )}
      </View>

      <View style={styles.content}>
        <View style={styles.headerRow}>
          <ThemedText type="defaultSemiBold" numberOfLines={1} style={styles.username}>
            {username}
          </ThemedText>
          <ThemedText type="caption" style={{ color: colors.muted }}>
            {timestamp}
          </ThemedText>
        </View>

        <View style={styles.messageRow}>
          <ThemedText
            type="caption"
            numberOfLines={1}
            style={[
              styles.lastMessage,
              { color: unreadCount > 0 ? colors.text : colors.muted },
            ]}
          >
            {lastMessage}
          </ThemedText>
          {unreadCount > 0 && (
            <View style={[styles.unreadBadge, { backgroundColor: colors.tint }]}>
              <ThemedText
                type="caption"
                style={[styles.unreadText, { color: colors.onTint }]}
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </ThemedText>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 12,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  avatarContainer: {
    position: "relative",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  onlineIndicator: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
  },
  content: {
    flex: 1,
    gap: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  username: {
    flex: 1,
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  lastMessage: {
    flex: 1,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadText: {
    fontSize: 11,
    fontWeight: "600",
  },
});
