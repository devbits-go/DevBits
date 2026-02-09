import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import {
  clearApiCache,
  getUsersFollowing,
  getPostsFeed,
  getProjectById,
  getProjectsFeed,
  getUserById,
} from "@/services/api";
import { mapPostToUi, mapProjectToUi } from "@/services/mappers";
import { useAppColors } from "@/hooks/useAppColors";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { useMotionConfig } from "@/hooks/useMotionConfig";
import { MyHeader } from "@/components/header";
import CreatePost from "@/components/CreatePost";
import { Post } from "@/components/Post";
import { ProjectCard } from "@/components/ProjectCard";
import { SectionHeader } from "@/components/SectionHeader";
import { StatPill } from "@/components/StatPill";
import { ThemedText } from "@/components/ThemedText";
import { TopBlur } from "@/components/TopBlur";
import { subscribeToPostEvents } from "@/services/postEvents";
import { useAuth } from "@/contexts/AuthContext";

export default function HomeScreen() {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [posts, setPosts] = useState([] as ReturnType<typeof mapPostToUi>[]);
  const [projects, setProjects] = useState(
    [] as ReturnType<typeof mapProjectToUi>[],
  );
  const [tags, setTags] = useState([] as string[]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const motion = useMotionConfig();
  const revealValues = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  useEffect(() => {
    if (motion.prefersReducedMotion) {
      revealValues.forEach((value) => value.setValue(1));
      return;
    }

    Animated.stagger(
      motion.delay(120),
      revealValues.map((value) =>
        Animated.timing(value, {
          toValue: 1,
          duration: motion.duration(420),
          useNativeDriver: true,
        }),
      ),
    ).start();
  }, [motion, revealValues]);

  const loadFeed = useCallback(
    async (showLoader = true) => {
      try {
        if (showLoader) {
          setIsLoading(true);
        }
        const [postFeedRaw, projectFeedRaw, followingIdsRaw] =
          await Promise.all([
            getPostsFeed("time", 0, 20),
            getProjectsFeed("time", 0, 4),
            user?.username
              ? getUsersFollowing(user.username)
              : Promise.resolve([]),
          ]);

        const postFeed = Array.isArray(postFeedRaw) ? postFeedRaw : [];
        const projectFeed = Array.isArray(projectFeedRaw) ? projectFeedRaw : [];
        const followingIds = Array.isArray(followingIdsRaw)
          ? followingIdsRaw
          : [];

        const followingPosts = followingIds.length
          ? postFeed.filter((post) => followingIds.includes(post.user))
          : [];
        const fallbackPosts = postFeed.filter(
          (post) => !followingIds.includes(post.user),
        );
        const selectedPosts = followingPosts.concat(fallbackPosts).slice(0, 10);

        const projectMap = new Map(
          projectFeed.map((project) => [project.id, project]),
        );
        const uiProjects = projectFeed.map(mapProjectToUi);

        const uiPosts = await Promise.all(
          selectedPosts.map(async (post) => {
            const [user, project] = await Promise.all([
              getUserById(post.user).catch(() => null),
              projectMap.get(post.project)
                ? Promise.resolve(projectMap.get(post.project)!)
                : getProjectById(post.project).catch(() => null),
            ]);
            return mapPostToUi(post, user, project);
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

        setProjects(uiProjects);
        setPosts(uiPosts);
        setTags(
          Array.from(tagCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([tag]) => tag),
        );
        setHasError(false);
      } catch {
        setProjects([]);
        setPosts([]);
        setTags([]);
        setHasError(true);
      } finally {
        if (showLoader) {
          setIsLoading(false);
        }
      }
    },
    [user?.username],
  );

  useEffect(() => {
    clearApiCache();
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

  useFocusEffect(
    useCallback(() => {
      clearApiCache();
      loadFeed(false);
    }, [loadFeed]),
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    clearApiCache();
    await loadFeed(false);
    setIsRefreshing(false);
  }, [loadFeed]);

  useAutoRefresh(() => loadFeed(false), { focusRefresh: false });

  const revealStyle = (index: number) => ({
    opacity: revealValues[index],
    transform: [
      {
        scale: revealValues[index].interpolate({
          inputRange: [0, 1],
          outputRange: [0.985, 1],
        }),
      },
    ],
  });

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.background} pointerEvents="none" />
      <SafeAreaView style={styles.safeArea} edges={[]}>
        <ScrollView
          contentInsetAdjustmentBehavior="never"
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.tint}
            />
          }
          contentContainerStyle={[
            styles.scrollContainer,
            { paddingTop: insets.top + 8, paddingBottom: 96 + insets.bottom },
          ]}
        >
          <Animated.View style={revealStyle(0)}>
            <MyHeader />
            <View
              style={[
                styles.heroCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <ThemedText type="label" style={{ color: colors.muted }}>
                TODAY'S SHIP LOG
              </ThemedText>
              <View style={styles.statRow}>
                <StatPill label="Streams" value={projects.length} />
                <StatPill label="Bytes" value={posts.length} />
                <StatPill label="Tags" value={tags.length} />
              </View>
            </View>
          </Animated.View>

          <Animated.View style={revealStyle(1)}>
            <SectionHeader
              title="Active streams"
              actionLabel="See all"
              actionOnPress={() => router.push("/streams")}
            />
            {isLoading ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.carouselRow}>
                  {[0, 1, 2, 3].map((key) => (
                    <View
                      key={key}
                      style={[
                        styles.carouselCard,
                        {
                          backgroundColor: colors.surfaceAlt,
                          borderColor: colors.border,
                        },
                      ]}
                    />
                  ))}
                </View>
              </ScrollView>
            ) : projects.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.carouselRow}>
                  {projects.map((project) => (
                    <View key={project.id} style={styles.carouselCardWrap}>
                      <ProjectCard project={project} variant="full" />
                    </View>
                  ))}
                </View>
              </ScrollView>
            ) : (
              <View style={styles.emptyState}>
                <ThemedText type="caption" style={{ color: colors.muted }}>
                  {hasError
                    ? "Streams unavailable. Check the API and try again."
                    : "No streams yet."}
                </ThemedText>
              </View>
            )}
          </Animated.View>

          <Animated.View style={revealStyle(2)}>
            <SectionHeader
              title="Fresh bytes"
              actionLabel="See all"
              actionOnPress={() => router.push("/bytes")}
            />
            {isLoading ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.carouselRow}>
                  {[0, 1, 2].map((key) => (
                    <View
                      key={key}
                      style={[
                        styles.carouselPost,
                        {
                          backgroundColor: colors.surfaceAlt,
                          borderColor: colors.border,
                        },
                      ]}
                    />
                  ))}
                </View>
              </ScrollView>
            ) : posts.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.carouselRow}>
                  {posts.map((post) => (
                    <View key={post.id} style={styles.carouselPostWrap}>
                      <Post {...post} />
                    </View>
                  ))}
                </View>
              </ScrollView>
            ) : (
              <View style={styles.emptyState}>
                <ThemedText type="caption" style={{ color: colors.muted }}>
                  {hasError
                    ? "Feed unavailable. Check the API and try again."
                    : "No posts yet. Be the first to ship."}
                </ThemedText>
              </View>
            )}
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
      <TopBlur />
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
    borderRadius: 16,
    padding: 10,
    gap: 8,
    borderWidth: 1,
  },
  statRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  carouselRow: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 4,
    paddingRight: 20,
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
