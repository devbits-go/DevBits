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
  FeedSort,
  getFollowingPostsFeed,
  getPostsFeed,
  getProjectById,
  getSavedPostsFeed,
  getUserById,
} from "@/services/api";
import { mapPostToUi } from "@/services/mappers";
import { Post } from "@/components/Post";
import { FloatingScrollTopButton } from "@/components/FloatingScrollTopButton";
import { ThemedText } from "@/components/ThemedText";
import { TopBlur } from "@/components/TopBlur";
import {
  UnifiedLoadingInline,
  UnifiedLoadingList,
} from "@/components/UnifiedLoading";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { useAppColors } from "@/hooks/useAppColors";
import { useMotionConfig } from "@/hooks/useMotionConfig";
import { useTopBlurScroll } from "@/hooks/useTopBlurScroll";
import { useRequestGuard } from "@/hooks/useRequestGuard";
import { subscribeToPostEvents } from "@/services/postEvents";
import { useAuth } from "@/contexts/AuthContext";
import { useSaved } from "@/contexts/SavedContext";

export default function BytesScreen() {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { savedPostIds } = useSaved();
  const [posts, setPosts] = useState([] as ReturnType<typeof mapPostToUi>[]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<
    "all" | "following" | "saved"
  >("all");
  const [activeSort, setActiveSort] = useState<
    "recent" | "new" | "popular" | "hot"
  >("recent");
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [pageIndex, setPageIndex] = useState(0);
  const motion = useMotionConfig();
  const requestGuard = useRequestGuard();
  const reveal = useRef(new Animated.Value(0.08)).current;
  const listRef = useRef<FlatList<ReturnType<typeof mapPostToUi>>>(null);
  const { scrollY, onScroll } = useTopBlurScroll();
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
      const requestId = requestGuard.beginRequest();
      try {
        if (showLoader && requestGuard.isMounted()) {
          setIsLoading(true);
        }
        const start = nextPage * pageSize;
        const postFeedPromise =
          activeFilter === "following" && user?.username
            ? getFollowingPostsFeed(user.username, start, pageSize, activeSort)
            : activeFilter === "saved" && user?.username
              ? getSavedPostsFeed(user.username, start, pageSize, activeSort)
              : getPostsFeed(activeSort as FeedSort, start, pageSize);

        let postFeedRaw: Awaited<ReturnType<typeof getPostsFeed>> = [];
        try {
          postFeedRaw = await postFeedPromise;
        } catch {
          if (activeFilter !== "all") {
            postFeedRaw = await getPostsFeed(
              activeSort as FeedSort,
              start,
              pageSize,
            );
            if (requestGuard.isMounted()) {
              setActiveFilter("all");
            }
          } else {
            throw new Error("Failed to load post feed");
          }
        }

        const postFeed = Array.isArray(postFeedRaw) ? postFeedRaw : [];

        const uiPosts = await Promise.all(
          postFeed.map(async (post) => {
            const [user, project] = await Promise.all([
              getUserById(post.user).catch(() => null),
              getProjectById(post.project).catch(() => null),
            ]);
            return mapPostToUi(post, user, project);
          }),
        );

        if (!requestGuard.isActive(requestId)) {
          return;
        }

        setPosts((prev) => (append ? prev.concat(uiPosts) : uiPosts));
        setPageIndex(nextPage);
        setHasMore(postFeed.length === pageSize);
        setHasError(false);
      } catch {
        if (!requestGuard.isActive(requestId)) {
          return;
        }
        if (!append) {
          setPosts([]);
        }
        setHasError(true);
      } finally {
        if (showLoader && requestGuard.isMounted()) {
          setIsLoading(false);
        }
      }
    },
    [activeFilter, activeSort, requestGuard, user?.username],
  );

  useEffect(() => {
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
    setHasMore(true);
    setPageIndex(0);
    await loadBytes({ showLoader: false, nextPage: 0 });
    setIsRefreshing(false);
  }, [loadBytes]);

  useAutoRefresh(() => loadBytes({ showLoader: false, nextPage: 0 }), {
    focusRefresh: false,
  });

  const handleLoadMore = useCallback(() => {
    if (isLoadingMore || isLoading) {
      return;
    }
    if (!hasMore) {
      return;
    }
    setIsLoadingMore(true);
    loadBytes({
      showLoader: false,
      nextPage: pageIndex + 1,
      append: true,
    }).finally(() => {
      if (requestGuard.isMounted()) {
        setIsLoadingMore(false);
      }
    });
  }, [hasMore, isLoading, isLoadingMore, loadBytes, pageIndex, requestGuard]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.background} pointerEvents="none" />
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <Animated.FlatList
          ref={listRef}
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
                  {["all", "following", "saved"].map((key) => {
                    const isActive = key === activeFilter;
                    return (
                      <Pressable
                        key={key}
                        onPress={() =>
                          setActiveFilter(key as "all" | "following" | "saved")
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
                            color: isActive ? colors.onTint : colors.muted,
                          }}
                        >
                          {key === "all"
                            ? "All"
                            : key === "following"
                              ? "Following"
                              : "Saved"}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={styles.sortRow}>
                  {[
                    { key: "recent", label: "Recent" },
                    { key: "new", label: "Newest" },
                    { key: "popular", label: "Popular" },
                    { key: "hot", label: "HOT" },
                  ].map(({ key, label }) => {
                    const isActive = key === activeSort;
                    return (
                      <Pressable
                        key={key}
                        onPress={() =>
                          setActiveSort(
                            key as "recent" | "new" | "popular" | "hot",
                          )
                        }
                        style={[
                          styles.sortChip,
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
                            color: isActive ? colors.onTint : colors.muted,
                          }}
                        >
                          {label}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </Animated.View>
              {isLoading ? (
                <UnifiedLoadingList rows={3} cardHeight={172} />
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
                      : activeFilter === "saved"
                        ? "No saved bytes yet."
                        : "No bytes yet."}
                </ThemedText>
              </View>
            ) : null
          }
          ListFooterComponent={
            isLoadingMore ? (
              <UnifiedLoadingInline label="Loading more..." />
            ) : null
          }
          contentContainerStyle={[
            styles.container,
            { paddingTop: 8, paddingBottom: 96 + insets.bottom },
          ]}
          removeClippedSubviews
          initialNumToRender={6}
          maxToRenderPerBatch={5}
          windowSize={5}
          updateCellsBatchingPeriod={60}
        />
      </SafeAreaView>
      <TopBlur scrollY={scrollY} />
      <FloatingScrollTopButton
        scrollY={scrollY}
        onPress={() =>
          listRef.current?.scrollToOffset({ offset: 0, animated: true })
        }
        bottomOffset={insets.bottom + 20}
      />
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
    paddingHorizontal: 16,
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
  sortRow: {
    flexDirection: "row",
    gap: 8,
    paddingTop: 8,
    flexWrap: "wrap",
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  sortChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 24,
  },
});
