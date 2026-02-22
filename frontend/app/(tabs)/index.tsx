import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  InteractionManager,
  Platform,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useRootNavigationState, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import {
  beginFreshReadWindow,
  getPostsFeed,
  getProjectBuilders,
  getProjectsByBuilderId,
  getProjectsFeed,
  getUserById,
} from "@/services/api";
import { mapPostToUi, mapProjectToUi } from "@/services/mappers";
import { useAppColors } from "@/hooks/useAppColors";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { useMotionConfig } from "@/hooks/useMotionConfig";
import { useRequestGuard } from "@/hooks/useRequestGuard";
import { MyHeader } from "@/components/header";
import CreatePost from "@/components/CreatePost";
import { Post } from "@/components/Post";
import { ProjectCard } from "@/components/ProjectCard";
import { InfiniteHorizontalCycle } from "@/components/InfiniteHorizontalCycle";
import { SectionHeader } from "@/components/SectionHeader";
import { ThemedText } from "@/components/ThemedText";
import { FloatingScrollTopButton } from "@/components/FloatingScrollTopButton";
import { TopBlur } from "@/components/TopBlur";
import { UnifiedLoadingList } from "@/components/UnifiedLoading";
import { useTopBlurScroll } from "@/hooks/useTopBlurScroll";
import { subscribeToPostEvents } from "@/services/postEvents";
import {
  applyProjectEvent,
  subscribeToProjectEvents,
} from "@/services/projectEvents";
import { useAuth } from "@/contexts/AuthContext";
import { useSavedStreams } from "@/contexts/SavedStreamsContext";
import Reanimated, {
  Easing as ReanimatedEasing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useHyprMotion } from "@/hooks/useHyprMotion";

export default function HomeScreen() {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const { user } = useAuth();
  const { savedProjectIds } = useSavedStreams();
  const [posts, setPosts] = useState([] as ReturnType<typeof mapPostToUi>[]);
  const [projects, setProjects] = useState(
    [] as ReturnType<typeof mapProjectToUi>[],
  );
  const [builderProjectIds, setBuilderProjectIds] = useState<number[]>([]);
  const [tags, setTags] = useState([] as string[]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const motion = useMotionConfig();
  const hyprMotion = useHyprMotion();
  const requestGuard = useRequestGuard();
  const scrollRef = useRef<Animated.ScrollView>(null);
  const hasFocusedRef = useRef(false);
  const { scrollY, onScroll } = useTopBlurScroll();
  const heroProgress = useSharedValue(0.08);
  const streamsProgress = useSharedValue(0.08);
  const postsProgress = useSharedValue(0.08);
  const cursorOpacity = useSharedValue(1);
  const homePostFetchCount = 8;
  const homeProjectFetchCount = 8;
  const homeVisiblePostsCount = 8;
  const homeVisibleProjectsCount = 8;

  useEffect(() => {
    if (motion.prefersReducedMotion) {
      heroProgress.value = 1;
      streamsProgress.value = 1;
      postsProgress.value = 1;
      return;
    }
    heroProgress.value = withDelay(0, withSpring(1, hyprMotion.spring));
    streamsProgress.value = withDelay(
      hyprMotion.staggerMs,
      withSpring(1, hyprMotion.spring),
    );
    postsProgress.value = withDelay(
      hyprMotion.staggerMs * 2,
      withSpring(1, hyprMotion.spring),
    );
  }, [
    heroProgress,
    hyprMotion.spring,
    hyprMotion.staggerMs,
    motion.prefersReducedMotion,
    postsProgress,
    streamsProgress,
  ]);

  useEffect(() => {
    if (motion.prefersReducedMotion) {
      cursorOpacity.value = 1;
      return;
    }

    cursorOpacity.value = withRepeat(
      withTiming(0.28, {
        duration: hyprMotion.pulseDuration,
        easing: ReanimatedEasing.inOut(ReanimatedEasing.quad),
      }),
      -1,
      true,
    );
    return () => {
      cursorOpacity.value = 1;
    };
  }, [cursorOpacity, hyprMotion.pulseDuration, motion.prefersReducedMotion]);

  useEffect(() => {
    if (!rootNavigationState?.key) {
      return;
    }

    const task = InteractionManager.runAfterInteractions(() => {
      router.prefetch("/streams");
      router.prefetch("/bytes");
      router.prefetch("/terminal");
    });

    return () => {
      task.cancel?.();
    };
  }, [rootNavigationState?.key, router]);

  const loadFeed = useCallback(
    async (showLoader = true) => {
      const requestId = requestGuard.beginRequest();
      try {
        if (showLoader && requestGuard.isMounted()) {
          setIsLoading(true);
        }
        const [postFeedRaw, projectFeedRaw, builderProjectsRaw] =
          await Promise.all([
            getPostsFeed("time", 0, homePostFetchCount),
            getProjectsFeed("time", 0, homeProjectFetchCount),
            user?.id ? getProjectsByBuilderId(user.id) : Promise.resolve([]),
          ]);

        const postFeed = Array.isArray(postFeedRaw) ? postFeedRaw : [];
        const projectFeed = Array.isArray(projectFeedRaw) ? projectFeedRaw : [];
        const builderProjects = Array.isArray(builderProjectsRaw)
          ? builderProjectsRaw
          : [];

        const selectedPosts = postFeed.slice(0, homeVisiblePostsCount);

        const projectMap = new Map(
          projectFeed.map((project) => [project.id, project]),
        );
        builderProjects.forEach((project) => {
          projectMap.set(project.id, project);
        });
        const combinedProjects = Array.from(projectMap.values()).slice(
          0,
          homeVisibleProjectsCount,
        );
        const builderCounts = await Promise.all(
          combinedProjects.map((project) =>
            getProjectBuilders(project.id).catch(() => []),
          ),
        );
        const uiProjects = combinedProjects.map((project, index) =>
          mapProjectToUi(project, builderCounts[index]?.length ?? 0),
        );

        const uiPosts = await Promise.all(
          selectedPosts.map(async (post) => {
            const [postUser, project] = await Promise.all([
              getUserById(post.user).catch(() => null),
              projectMap.get(post.project)
                ? Promise.resolve(projectMap.get(post.project)!)
                : Promise.resolve(null),
            ]);
            return mapPostToUi(post, postUser, project);
          }),
        );

        const tagCounts = new Map<string, number>();
        uiProjects.forEach((project) =>
          project.tags.forEach((tag) =>
            tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1),
          ),
        );
        uiPosts.forEach((post) =>
          post.tags.forEach((tag) =>
            tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1),
          ),
        );

        if (!requestGuard.isActive(requestId)) {
          return;
        }

        setProjects(uiProjects);
        setPosts(uiPosts);
        setBuilderProjectIds(builderProjects.map((project) => project.id));
        setTags(
          Array.from(tagCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([tag]) => tag),
        );
        setHasError(false);
      } catch {
        if (!requestGuard.isActive(requestId)) {
          return;
        }
        setProjects([]);
        setPosts([]);
        setTags([]);
        setHasError(true);
      } finally {
        if (showLoader && requestGuard.isMounted()) {
          setIsLoading(false);
        }
      }
    },
    [
      homePostFetchCount,
      homeProjectFetchCount,
      homeVisiblePostsCount,
      homeVisibleProjectsCount,
      requestGuard,
      user?.id,
    ],
  );

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

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

  useEffect(() => {
    return subscribeToProjectEvents((event) => {
      setProjects((prev) => applyProjectEvent(prev, event));
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!hasFocusedRef.current) {
        hasFocusedRef.current = true;
        return;
      }

      const task = InteractionManager.runAfterInteractions(() => {
        beginFreshReadWindow();
        void loadFeed(false);
      });

      return () => {
        task.cancel?.();
      };
    }, [loadFeed]),
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    beginFreshReadWindow();
    await loadFeed(false);
    setIsRefreshing(false);
  }, [loadFeed]);

  useAutoRefresh(() => loadFeed(false), { focusRefresh: false });

  const heroRevealStyle = useAnimatedStyle(() => ({
    opacity: heroProgress.value,
    transform: [
      { translateY: (1 - heroProgress.value) * 22 },
      { scale: 0.97 + heroProgress.value * 0.03 },
    ],
  }));

  const streamsRevealStyle = useAnimatedStyle(() => ({
    opacity: streamsProgress.value,
    transform: [
      { translateY: (1 - streamsProgress.value) * 22 },
      { scale: 0.97 + streamsProgress.value * 0.03 },
    ],
  }));

  const postsRevealStyle = useAnimatedStyle(() => ({
    opacity: postsProgress.value,
    transform: [
      { translateY: (1 - postsProgress.value) * 22 },
      { scale: 0.97 + postsProgress.value * 0.03 },
    ],
  }));

  const cursorStyle = useAnimatedStyle(() => ({
    opacity: cursorOpacity.value,
  }));

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.background} pointerEvents="none" />
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <Animated.ScrollView
          ref={scrollRef}
          contentInsetAdjustmentBehavior="never"
          onScroll={onScroll}
          scrollEventThrottle={16}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={
            Platform.OS === "ios" ? "interactive" : "on-drag"
          }
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
          contentContainerStyle={[
            styles.scrollContainer,
            { paddingTop: 8, paddingBottom: 96 + insets.bottom },
          ]}
        >
          <Reanimated.View style={heroRevealStyle}>
            <MyHeader />
            <View
              style={[
                styles.heroCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={styles.shipTopRow}>
                <ThemedText type="label" style={{ color: colors.muted }}>
                  TODAY&apos;S SHIP LOG
                </ThemedText>
                <View
                  style={[styles.shipDot, { backgroundColor: colors.tint }]}
                />
              </View>
              <View style={styles.shipCommandRow}>
                <ThemedText type="caption" style={{ color: colors.tint }}>
                  $ feed.sync --today
                </ThemedText>
                <Reanimated.View
                  style={[
                    styles.shipCursor,
                    { backgroundColor: colors.tint },
                    cursorStyle,
                  ]}
                />
              </View>
              <View style={styles.shipMiniGrid}>
                <View
                  style={[
                    styles.shipMiniCard,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.surfaceAlt,
                    },
                  ]}
                >
                  <ThemedText type="caption" style={{ color: colors.muted }}>
                    Streams
                  </ThemedText>
                  <ThemedText type="defaultSemiBold">
                    {projects.length}
                  </ThemedText>
                </View>
                <View
                  style={[
                    styles.shipMiniCard,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.surfaceAlt,
                    },
                  ]}
                >
                  <ThemedText type="caption" style={{ color: colors.muted }}>
                    Bytes
                  </ThemedText>
                  <ThemedText type="defaultSemiBold">{posts.length}</ThemedText>
                </View>
                <View
                  style={[
                    styles.shipMiniCard,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.surfaceAlt,
                    },
                  ]}
                >
                  <ThemedText type="caption" style={{ color: colors.muted }}>
                    Tags
                  </ThemedText>
                  <ThemedText type="defaultSemiBold">{tags.length}</ThemedText>
                </View>
              </View>
            </View>
          </Reanimated.View>

          <Reanimated.View style={streamsRevealStyle}>
            <SectionHeader
              title="Top streams today"
              actionLabel="See all"
              actionOnPress={() => router.push("/streams")}
            />
            {isLoading ? (
              <View style={styles.edgeToEdgeRail}>
                <UnifiedLoadingList rows={2} cardHeight={196} cardRadius={16} />
              </View>
            ) : projects.length ? (
              <View style={styles.edgeToEdgeRail}>
                <InfiniteHorizontalCycle
                  data={projects}
                  itemWidth={260}
                  minRepeatCount={8}
                  keyExtractor={(project) => String(project.id)}
                  renderItem={(project) => (
                    <View style={styles.carouselCardWrap}>
                      <ProjectCard
                        project={project}
                        variant="full"
                        saved={savedProjectIds.includes(project.id)}
                        isBuilder={builderProjectIds.includes(project.id)}
                      />
                    </View>
                  )}
                />
              </View>
            ) : (
              <View style={styles.emptyState}>
                <ThemedText type="caption" style={{ color: colors.muted }}>
                  {hasError
                    ? "Streams unavailable. Check the API and try again."
                    : "No streams yet."}
                </ThemedText>
              </View>
            )}
          </Reanimated.View>

          <Reanimated.View style={postsRevealStyle}>
            <SectionHeader
              title="Top bytes today"
              actionLabel="See all"
              actionOnPress={() => router.push("/bytes")}
            />
            {isLoading ? (
              <View style={styles.edgeToEdgeRail}>
                <UnifiedLoadingList rows={2} cardHeight={246} cardRadius={16} />
              </View>
            ) : posts.length ? (
              <View style={styles.edgeToEdgeRail}>
                <InfiniteHorizontalCycle
                  data={posts}
                  itemWidth={300}
                  minRepeatCount={8}
                  keyExtractor={(post) => String(post.id)}
                  renderItem={(post) => (
                    <View style={styles.carouselPostWrap}>
                      <Post {...post} />
                    </View>
                  )}
                />
              </View>
            ) : (
              <View style={styles.emptyState}>
                <ThemedText type="caption" style={{ color: colors.muted }}>
                  {hasError
                    ? "Feed unavailable. Check the API and try again."
                    : "No posts yet. Be the first to ship."}
                </ThemedText>
              </View>
            )}
          </Reanimated.View>
        </Animated.ScrollView>
      </SafeAreaView>
      <TopBlur scrollY={scrollY} />
      <FloatingScrollTopButton
        scrollY={scrollY}
        onPress={() =>
          (scrollRef.current as any)
            ?.getNode?.()
            .scrollTo({ y: 0, animated: true })
        }
        bottomOffset={insets.bottom + 20}
      />
      <CreatePost />
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
  scrollContainer: {
    gap: 20,
    paddingHorizontal: 16,
    paddingTop: 0,
  },
  edgeToEdgeRail: {
    marginHorizontal: -16,
  },
  loadingState: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 24,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 24,
  },
  heroCard: {
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 7,
    borderWidth: 1,
  },
  shipTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  shipDot: {
    width: 7,
    height: 7,
    borderRadius: 99,
  },
  shipCommandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  shipCursor: {
    width: 8,
    height: 2,
    borderRadius: 1,
  },
  shipMiniGrid: {
    flexDirection: "row",
    gap: 8,
  },
  shipMiniCard: {
    flex: 1,
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
    justifyContent: "center",
  },
  carouselRow: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 4,
    paddingHorizontal: 16,
  },
  carouselCard: {
    borderRadius: 14,
    height: 110,
    width: 240,
    borderWidth: 1,
    opacity: 0.7,
  },
  carouselCardWrap: {
    width: 260,
  },
  carouselPost: {
    borderRadius: 14,
    height: 140,
    width: 280,
    borderWidth: 1,
    opacity: 0.7,
  },
  carouselPostWrap: {
    width: 300,
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
  skeletonChip: {
    height: 22,
    width: 70,
    borderRadius: 8,
    opacity: 0.7,
  },
  tagCloud: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
