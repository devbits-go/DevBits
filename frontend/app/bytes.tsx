import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import {
  clearApiCache,
  getUsersFollowing,
  getPostsFeed,
  getProjectById,
  getUserById,
} from "@/services/api";
import { mapPostToUi } from "@/services/mappers";
import { Post } from "@/components/Post";
import { ThemedText } from "@/components/ThemedText";
import { TopBlur } from "@/components/TopBlur";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { useAppColors } from "@/hooks/useAppColors";
import { useMotionConfig } from "@/hooks/useMotionConfig";
import { useTopBlurScroll } from "@/hooks/useTopBlurScroll";
import { subscribeToPostEvents } from "@/services/postEvents";
import { useAuth } from "@/contexts/AuthContext";

export default function BytesScreen() {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [posts, setPosts] = useState([] as ReturnType<typeof mapPostToUi>[]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | "following">("all");
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [pageIndex, setPageIndex] = useState(0);
  const motion = useMotionConfig();
  const reveal = useRef(new Animated.Value(0)).current;
  const { scrollY, onScroll } = useTopBlurScroll();
  const followingIdsRef = useRef<number[]>([]);
  const pageSize = 20;

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

  const loadBytes = useCallback(
    async ({
      showLoader = true,
      nextPage = 0,
      append = false,
    }: {
      showLoader?: boolean;
      nextPage?: number;
      append?: boolean;
    } = {}) => {
      try {
        if (showLoader) {
          setIsLoading(true);
        }
        const start = nextPage * pageSize;
        const [postFeedRaw, followingIdsRaw] = await Promise.all([
          getPostsFeed("time", start, pageSize),
          activeFilter === "following" && user?.username
            ? followingIdsRef.current.length
              ? Promise.resolve(followingIdsRef.current)
              : getUsersFollowing(user.username)
            : Promise.resolve([]),
        ]);
        const postFeed = Array.isArray(postFeedRaw) ? postFeedRaw : [];
        const followingIds = Array.isArray(followingIdsRaw)
          ? followingIdsRaw
          : [];

        if (activeFilter === "following") {
          followingIdsRef.current = followingIds;
        }

        const visiblePosts =
          activeFilter === "following" && followingIds.length
            ? postFeed.filter((post) => followingIds.includes(post.user))
            : postFeed;

        const uiPosts = await Promise.all(
          visiblePosts.map(async (post) => {
            const [user, project] = await Promise.all([
              getUserById(post.user).catch(() => null),
              getProjectById(post.project).catch(() => null),
            ]);
            return mapPostToUi(post, user, project);
          }),
        );

        setPosts((prev) => (append ? prev.concat(uiPosts) : uiPosts));
        setPageIndex(nextPage);
        setHasMore(postFeed.length === pageSize);
        setHasError(false);
      } catch {
        if (!append) {
          setPosts([]);
        }
        setHasError(true);
      } finally {
        if (showLoader) {
          setIsLoading(false);
        }
      }
    },
    [activeFilter, user?.username],
  );

  useEffect(() => {
    followingIdsRef.current = [];
    setHasMore(true);
    setPageIndex(0);
    loadBytes({ nextPage: 0 });
  }, [activeFilter, loadBytes]);

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
      loadBytes({ showLoader: false, nextPage: 0 });
    }, [loadBytes]),
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    clearApiCache();
    followingIdsRef.current = [];
    setHasMore(true);
    setPageIndex(0);
    await loadBytes({ showLoader: false, nextPage: 0 });
    setIsRefreshing(false);
  }, [loadBytes]);

  useAutoRefresh(() => loadBytes({ showLoader: false, nextPage: 0 }), {
    focusRefresh: false,
  });

  const handleLoadMore = useCallback(() => {
    if (isLoadingMore || !hasMore || isLoading) {
      return;
    }
    setIsLoadingMore(true);
    loadBytes({
      showLoader: false,
      nextPage: pageIndex + 1,
      append: true,
    }).finally(() => setIsLoadingMore(false));
  }, [hasMore, isLoading, isLoadingMore, loadBytes, pageIndex]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.background} pointerEvents="none" />
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <Animated.FlatList
          data={posts}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <Post {...item} />}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          onScroll={onScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.tint}
              colors={[colors.tint]}
              titleColor={colors.tint}
              progressViewOffset={48}
            />
          }
          ListHeaderComponent={
            <View>
              <Animated.View
                style={{
                  opacity: reveal,
                  transform: [
                    {
                      scale: reveal.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.985, 1],
                      }),
                    },
                  ],
                }}
              >
                <View style={styles.headerRow}>
                  <View>
                    <ThemedText type="display" style={styles.title}>
                      All bytes
                    </ThemedText>
                    <ThemedText type="caption" style={{ color: colors.muted }}>
                      Full feed of shipped updates.
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.filterRow}>
                  {["all", "following"].map((key) => {
                    const isActive = key === activeFilter;
                    return (
                      <Pressable
                        key={key}
                        onPress={() =>
                          setActiveFilter(key as "all" | "following")
                        }
                        style={[
                          styles.filterChip,
                          {
                            backgroundColor: isActive
                              ? colors.tint
                              : colors.surfaceAlt,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <ThemedText
                          type="caption"
                          style={{
                            color: isActive ? colors.accent : colors.muted,
                          }}
                        >
                          {key === "all" ? "All" : "Following"}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
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
              ) : null}
            </View>
          }
          ListEmptyComponent={
            !isLoading ? (
              <View style={styles.emptyState}>
                <ThemedText type="caption" style={{ color: colors.muted }}>
                  {hasError
                    ? "Feed unavailable. Check the API and try again."
                    : activeFilter === "following"
                      ? "No bytes from people you follow yet."
                      : "No bytes yet."}
                </ThemedText>
              </View>
            ) : null
          }
          ListFooterComponent={
            isLoadingMore ? (
              <View style={styles.loadingMore}>
                <ThemedText type="caption" style={{ color: colors.muted }}>
                  Loading more...
                </ThemedText>
              </View>
            ) : null
          }
          contentContainerStyle={[
            styles.container,
            { paddingTop: 8, paddingBottom: 96 + insets.bottom },
          ]}
          removeClippedSubviews
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={8}
          updateCellsBatchingPeriod={50}
        />
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
  background: {
    ...StyleSheet.absoluteFillObject,
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
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingTop: 6,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
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
  loadingMore: {
    alignItems: "center",
    paddingVertical: 18,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 24,
  },
});
