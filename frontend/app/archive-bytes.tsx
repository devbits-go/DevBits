import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Post } from "@/components/Post";
import { ThemedText } from "@/components/ThemedText";
import { TopBlur } from "@/components/TopBlur";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { useAppColors } from "@/hooks/useAppColors";
import { useMotionConfig } from "@/hooks/useMotionConfig";
import { useTopBlurScroll } from "@/hooks/useTopBlurScroll";
import { useAuth } from "@/contexts/AuthContext";
import {
  clearApiCache,
  getPostsByUserId,
  getProjectById,
  getUserById,
} from "@/services/api";
import { mapPostToUi } from "@/services/mappers";
import { subscribeToPostEvents } from "@/services/postEvents";

export default function ArchiveBytesScreen() {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [posts, setPosts] = useState([] as ReturnType<typeof mapPostToUi>[]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const motion = useMotionConfig();
  const reveal = useRef(new Animated.Value(0)).current;
  const { scrollY, onScroll } = useTopBlurScroll();

  useEffect(() => {
    if (motion.prefersReducedMotion) {
      reveal.setValue(1);
      return;
    }

    Animated.timing(reveal, {
      toValue: 1,
      duration: motion.duration(420),
      useNativeDriver: true,
    }).start();
  }, [motion, reveal]);

  const loadArchive = useCallback(
    async (showLoader = true) => {
      if (!user?.id) {
        if (showLoader) {
          setIsLoading(false);
        }
        return;
      }
      try {
        if (showLoader) {
          setIsLoading(true);
        }
        const userPosts = await getPostsByUserId(user.id);
        const projectMap = new Map<
          number,
          Awaited<ReturnType<typeof getProjectById>> | null
        >();
        const mapped = await Promise.all(
          userPosts.map(async (post) => {
            const [postUser, postProject] = await Promise.all([
              getUserById(post.user).catch(() => null),
              projectMap.get(post.project)
                ? Promise.resolve(projectMap.get(post.project)!)
                : getProjectById(post.project).catch(() => null),
            ]);
            projectMap.set(post.project, postProject);
            return mapPostToUi(post, postUser, postProject);
          }),
        );

        setPosts(mapped);
        setHasError(false);
      } catch {
        setPosts([]);
        setHasError(true);
      } finally {
        if (showLoader) {
          setIsLoading(false);
        }
      }
    },
    [user?.id],
  );

  useEffect(() => {
    loadArchive();
  }, [loadArchive]);

  useEffect(() => {
    return subscribeToPostEvents((event) => {
      setPosts((prev) => {
        if (event.type === "updated") {
          return prev.map((post) =>
            post.id === event.postId
              ? {
                  ...post,
                  content: event.content,
                  media: event.media ?? post.media,
                }
              : post,
          );
        }
        if (event.type === "stats") {
          return prev.map((post) =>
            post.id === event.postId
              ? {
                  ...post,
                  likes: event.likes ?? post.likes,
                  comments: event.comments ?? post.comments,
                }
              : post,
          );
        }
        if (event.type === "deleted") {
          return prev.filter((post) => post.id !== event.postId);
        }
        return prev;
      });
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      clearApiCache();
      loadArchive(false);
    }, [loadArchive]),
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    clearApiCache();
    await loadArchive(false);
    setIsRefreshing(false);
  }, [loadArchive]);
  useAutoRefresh(() => loadArchive(false), { focusRefresh: false });

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safeArea} edges={[]}>
        <Animated.ScrollView
          contentInsetAdjustmentBehavior="never"
          onScroll={onScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.tint}
            />
          }
          contentContainerStyle={[
            styles.container,
            { paddingTop: insets.top + 8, paddingBottom: 96 + insets.bottom },
          ]}
        >
          <Animated.View
            style={{
              opacity: reveal,
              transform: [
                {
                  translateY: reveal.interpolate({
                    inputRange: [0, 1],
                    outputRange: [16, 0],
                  }),
                },
              ],
            }}
          >
            <ThemedText type="display" style={styles.title}>
              Byte archive
            </ThemedText>
            <ThemedText type="caption" style={{ color: colors.muted }}>
              All your shipped updates in one place.
            </ThemedText>
          </Animated.View>

          {isLoading ? (
            <View style={styles.skeletonStack}>
              {[0, 1, 2].map((key) => (
                <View
                  key={key}
                  style={[
                    styles.skeletonCard,
                    {
                      backgroundColor: colors.surfaceAlt,
                      borderColor: colors.border,
                    },
                  ]}
                />
              ))}
            </View>
          ) : posts.length ? (
            posts.map((post) => <Post key={post.id} {...post} />)
          ) : (
            <View style={styles.emptyState}>
              <ThemedText type="caption" style={{ color: colors.muted }}>
                {hasError ? "Bytes unavailable." : "No bytes yet."}
              </ThemedText>
            </View>
          )}
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
  safeArea: {
    flex: 1,
  },
  container: {
    paddingVertical: 16,
    paddingHorizontal: 0,
    gap: 16,
    paddingTop: 0,
  },
  title: {
    fontSize: 26,
    lineHeight: 30,
  },
  skeletonStack: {
    gap: 12,
  },
  skeletonCard: {
    borderRadius: 14,
    height: 96,
    borderWidth: 1,
    opacity: 0.7,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 24,
  },
});
