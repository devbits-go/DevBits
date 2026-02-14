import React, { useEffect, useRef } from "react";
import {
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { TopBlur } from "@/components/TopBlur";
import { useAppColors } from "@/hooks/useAppColors";
import { useMotionConfig } from "@/hooks/useMotionConfig";
import { useTopBlurScroll } from "@/hooks/useTopBlurScroll";
import { useNotifications } from "@/contexts/NotificationsContext";

export default function NotificationsScreen() {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const motion = useMotionConfig();
  const reveal = useRef(new Animated.Value(0)).current;
  const { scrollY, onScroll } = useTopBlurScroll();
  const { notifications, isLoading, refresh, markRead, remove, clearAll } =
    useNotifications();

  useEffect(() => {
    if (motion.prefersReducedMotion) {
      reveal.setValue(1);
      return;
    }

    Animated.timing(reveal, {
      toValue: 1,
      duration: motion.duration(360),
      useNativeDriver: true,
    }).start();
  }, [motion, reveal]);

  const getNotificationTitle = (type: string) => {
    switch (type) {
      case "direct_message":
        return "New message";
      case "builder_added":
        return "Builder invite";
      case "comment_post":
        return "New comment";
      case "save_post":
        return "Byte saved";
      case "save_project":
        return "Stream saved";
      case "follow_user":
        return "New follower";
      default:
        return "Notification";
    }
  };

  const getNotificationBody = (item: { type: string; actor_name: string }) => {
    const actor = item.actor_name || "Someone";
    switch (item.type) {
      case "direct_message":
        return `${actor} sent you a message.`;
      case "builder_added":
        return `${actor} added you as a builder.`;
      case "comment_post":
        return `${actor} commented on your byte.`;
      case "save_post":
        return `${actor} saved your byte.`;
      case "save_project":
        return `${actor} saved your stream.`;
      case "follow_user":
        return `${actor} followed you.`;
      default:
        return `${actor} sent you a notification.`;
    }
  };

  const handleOpen = async (item: any) => {
    await markRead(item.id);
    if (item.type === "direct_message" && item.actor_name) {
      router.push({
        pathname: "/terminal",
        params: { chat: item.actor_name },
      });
      return;
    }
    if (item.type === "follow_user" && item.actor_name) {
      router.push({
        pathname: "/user/[username]",
        params: { username: item.actor_name },
      });
      return;
    }
    if (
      (item.type === "save_project" || item.type === "builder_added") &&
      item.project_id
    ) {
      router.push({
        pathname: "/stream/[projectId]",
        params: { projectId: String(item.project_id) },
      });
      return;
    }
    if (
      (item.type === "save_post" || item.type === "comment_post") &&
      item.post_id
    ) {
      router.push({
        pathname: "/post/[postId]",
        params: { postId: String(item.post_id) },
      });
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.screen} edges={["top"]}>
        <Animated.ScrollView
          onScroll={onScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={refresh}
              tintColor={colors.tint}
              colors={[colors.tint]}
              titleColor={colors.tint}
              progressViewOffset={48}
            />
          }
          contentContainerStyle={{ paddingBottom: 96 + insets.bottom }}
        >
          <Animated.View
            style={[
              styles.content,
              {
                paddingTop: 8,
                opacity: reveal,
                transform: [
                  {
                    translateY: reveal.interpolate({
                      inputRange: [0, 1],
                      outputRange: [10, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.headerRow}>
              <View>
                <ThemedText type="display">Notifications</ThemedText>
                <ThemedText type="caption" style={{ color: colors.muted }}>
                  {notifications.length ? "New activity" : "Nothing new yet."}
                </ThemedText>
              </View>
              {notifications.length ? (
                <Pressable
                  onPress={clearAll}
                  style={[
                    styles.clearButton,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.surfaceAlt,
                    },
                  ]}
                >
                  <ThemedText type="caption" style={{ color: colors.muted }}>
                    Clear all
                  </ThemedText>
                </Pressable>
              ) : null}
            </View>

            {notifications.length ? (
              <View style={styles.list}>
                {notifications.map((item) => (
                  <View
                    key={item.id}
                    style={[
                      styles.card,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        opacity: item.read_at ? 0.6 : 1,
                      },
                    ]}
                  >
                    <View style={styles.cardHeader}>
                      <ThemedText type="defaultSemiBold">
                        {getNotificationTitle(item.type)}
                      </ThemedText>
                      <Pressable
                        onPress={() => remove(item.id)}
                        style={[
                          styles.deleteButton,
                          { borderColor: colors.border },
                        ]}
                      >
                        <ThemedText
                          type="caption"
                          style={{ color: colors.muted }}
                        >
                          Delete
                        </ThemedText>
                      </Pressable>
                    </View>
                    <Pressable onPress={() => void handleOpen(item)}>
                      <ThemedText
                        type="caption"
                        style={{ color: colors.muted }}
                      >
                        {getNotificationBody(item)}
                      </ThemedText>
                      <ThemedText
                        type="caption"
                        style={{ color: colors.muted }}
                      >
                        {new Date(item.created_at).toLocaleString()}
                      </ThemedText>
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <ThemedText type="caption" style={{ color: colors.muted }}>
                  You are all caught up.
                </ThemedText>
              </View>
            )}
          </Animated.View>
        </Animated.ScrollView>
      </SafeAreaView>
      <TopBlur scrollY={scrollY} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 0,
    gap: 6,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  clearButton: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  list: {
    marginTop: 16,
    gap: 12,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  deleteButton: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  emptyState: {
    marginTop: 24,
  },
});
