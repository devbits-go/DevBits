import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { useFocusEffect } from "@react-navigation/native";
import { UserProps } from "@/constants/Types";
import { ProjectCard } from "@/components/ProjectCard";
import { SectionHeader } from "@/components/SectionHeader";
import { StatPill } from "@/components/StatPill";
import { ThemedText } from "@/components/ThemedText";
import { Post } from "@/components/Post";
import User from "@/components/User";
import { TopBlur } from "@/components/TopBlur";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { useAppColors } from "@/hooks/useAppColors";
import { useMotionConfig } from "@/hooks/useMotionConfig";
import { useAuth } from "@/contexts/AuthContext";
import {
  clearApiCache,
  getPostById,
  getPostsByUserId,
  getProjectById,
  getProjectFollowing,
  getProjectsByUserId,
  getUserById,
  getUserByUsername,
  getUsersFollowers,
} from "@/services/api";
import { mapPostToUi, mapProjectToUi } from "@/services/mappers";
import { useSaved } from "@/contexts/SavedContext";
import { subscribeToPostEvents } from "@/services/postEvents";

export default function ProfileScreen() {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signOut, user: authUser } = useAuth();
  const { savedPostIds } = useSaved();
  const [currentUser, setCurrentUser] = useState<UserProps | null>(null);
  const [projects, setProjects] = useState(
    [] as ReturnType<typeof mapProjectToUi>[],
  );
  const [posts, setPosts] = useState([] as ReturnType<typeof mapPostToUi>[]);
  const [savedPosts, setSavedPosts] = useState(
    [] as ReturnType<typeof mapPostToUi>[],
  );
  const [savedStreams, setSavedStreams] = useState(
    [] as ReturnType<typeof mapProjectToUi>[],
  );
  const [isSavedLoading, setIsSavedLoading] = useState(false);
  const [isSavedStreamsLoading, setIsSavedStreamsLoading] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [streakCount, setStreakCount] = useState(0);
  const [shipsCount, setShipsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const motion = useMotionConfig();
  const reveal = useRef(new Animated.Value(0)).current;

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

  const fetchUser = useCallback(async () => {
    try {
      setIsLoading(true);
      if (!authUser?.username || !authUser.id) {
        setCurrentUser(null);
        setProjects([]);
        setPosts([]);
        setIsLoading(false);
        return;
      }
      let resolvedUser = authUser as UserProps;
      try {
        const userData = await getUserByUsername(authUser.username);
        if (userData) {
          resolvedUser = userData;
        }
        setHasError(false);
      } catch {
        setHasError(true);
      }

      setCurrentUser(resolvedUser);

      if (resolvedUser?.id) {
        try {
          const [userProjects, userPosts, followers] = await Promise.all([
            getProjectsByUserId(resolvedUser.id),
            getPostsByUserId(resolvedUser.id),
            getUsersFollowers(resolvedUser.username),
          ]);

          const safeProjects = Array.isArray(userProjects) ? userProjects : [];
          const safePosts = Array.isArray(userPosts) ? userPosts : [];
          const safeFollowers = Array.isArray(followers) ? followers : [];

          const projectMap = new Map(
            safeProjects.map((project) => [project.id, project]),
          );

          setProjects(safeProjects.map(mapProjectToUi));
          setShipsCount(safePosts.length);
          setFollowersCount(safeFollowers.length);
          const uniqueDays = Array.from(
            new Set(
              safePosts.map((post) =>
                new Date(post.created_on).toISOString().slice(0, 10),
              ),
            ),
          ).sort((a, b) => (a > b ? -1 : 1));
          let streak = 0;
          let cursor = new Date();
          for (const day of uniqueDays) {
            const dayDate = new Date(day + "T00:00:00Z");
            if (
              cursor.toISOString().slice(0, 10) ===
              dayDate.toISOString().slice(0, 10)
            ) {
              streak += 1;
              cursor.setUTCDate(cursor.getUTCDate() - 1);
            } else {
              break;
            }
          }
          setStreakCount(streak);
          setPosts(
            safePosts
              .slice(0, 2)
              .map((post) =>
                mapPostToUi(
                  post,
                  { ...resolvedUser, id: resolvedUser.id! },
                  projectMap.get(post.project) ?? null,
                ),
              ),
          );
        } catch {
          setProjects([]);
          setPosts([]);
          setShipsCount(0);
          setFollowersCount(0);
          setStreakCount(0);
          setHasError(true);
        }
      }
    } catch {
      setCurrentUser(null);
      setProjects([]);
      setPosts([]);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [authUser]);

  useEffect(() => {
    clearApiCache();
    fetchUser();
  }, [fetchUser]);

  const loadSaved = useCallback(async () => {
    if (!savedPostIds.length) {
      setSavedPosts([]);
      return;
    }
    setIsSavedLoading(true);
    try {
      const savedData = await Promise.all(
        savedPostIds.map(async (postId) => {
          const post = await getPostById(postId);
          const [user, project] = await Promise.all([
            getUserById(post.user).catch(() => null),
            getProjectById(post.project).catch(() => null),
          ]);
          return mapPostToUi(post, user, project);
        }),
      );

      setSavedPosts(savedData);
    } catch {
      setSavedPosts([]);
    } finally {
      setIsSavedLoading(false);
    }
  }, [savedPostIds]);

  const loadSavedStreams = useCallback(async () => {
    if (!authUser?.username) {
      setSavedStreams([]);
      return;
    }
    setIsSavedStreamsLoading(true);
    try {
      const savedIds = await getProjectFollowing(authUser.username);
      const safeIds = Array.isArray(savedIds) ? savedIds : [];
      if (!safeIds.length) {
        setSavedStreams([]);
        return;
      }
      const projectsData = await Promise.all(
        safeIds.map((projectId) => getProjectById(projectId).catch(() => null)),
      );
      const mapped = projectsData
        .filter((project) => project)
        .map((project) => mapProjectToUi(project!));
      setSavedStreams(mapped);
    } catch {
      setSavedStreams([]);
    } finally {
      setIsSavedStreamsLoading(false);
    }
  }, [authUser?.username]);

  useEffect(() => {
    clearApiCache();
    loadSaved();
  }, [loadSaved]);

  useEffect(() => {
    clearApiCache();
    loadSavedStreams();
  }, [loadSavedStreams]);

  useEffect(() => {
    return subscribeToPostEvents((event) => {
      const applyUpdate = (prev: ReturnType<typeof mapPostToUi>[]) => {
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
      };

      setPosts(applyUpdate);
      setSavedPosts(applyUpdate);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      clearApiCache();
      fetchUser();
      loadSaved();
      loadSavedStreams();
    }, [fetchUser, loadSaved, loadSavedStreams]),
  );

  const refreshProfile = useCallback(async () => {
    await Promise.all([fetchUser(), loadSaved(), loadSavedStreams()]);
  }, [fetchUser, loadSaved, loadSavedStreams]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    clearApiCache();
    await refreshProfile();
    setIsRefreshing(false);
  }, [refreshProfile]);

  useAutoRefresh(refreshProfile, { focusRefresh: false });

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
            styles.container,
            { paddingTop: insets.top + 8, paddingBottom: 96 + insets.bottom },
          ]}
        >
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
            <ThemedText type="display" style={styles.title}>
              Profile
            </ThemedText>
            <ThemedText type="default" style={{ color: colors.muted }}>
              Your stream log, bytes, and community signals.
            </ThemedText>
          </Animated.View>

          <View
            style={[
              styles.profileCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            {isLoading ? (
              <View style={styles.skeletonStack}>
                <View
                  style={[
                    styles.skeletonAvatar,
                    {
                      backgroundColor: colors.surfaceAlt,
                      borderColor: colors.border,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.skeletonLine,
                    {
                      backgroundColor: colors.surfaceAlt,
                      borderColor: colors.border,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.skeletonLineShort,
                    {
                      backgroundColor: colors.surfaceAlt,
                      borderColor: colors.border,
                    },
                  ]}
                />
              </View>
            ) : currentUser ? (
              <>
                <User
                  username={currentUser.username}
                  bio={currentUser.bio}
                  links={currentUser.links}
                  created_on={currentUser.created_on}
                  picture={currentUser.picture}
                />
                <View style={styles.statRow}>
                  <StatPill label="Streak" value={`${streakCount}d`} />
                  <StatPill label="Followers" value={followersCount} />
                  <StatPill label="Ships" value={shipsCount} />
                </View>
                <Pressable
                  style={[
                    styles.settingsButton,
                    { borderColor: colors.border },
                  ]}
                  onPress={() => router.push("/settings")}
                >
                  <ThemedText type="caption" style={{ color: colors.muted }}>
                    Settings
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.signOutButton, { borderColor: colors.border }]}
                  onPress={signOut}
                >
                  <ThemedText type="caption" style={{ color: colors.muted }}>
                    Sign out
                  </ThemedText>
                </Pressable>
              </>
            ) : (
              <View style={styles.emptyState}>
                <ThemedText type="caption" style={{ color: colors.muted }}>
                  {hasError
                    ? "Profile unavailable. Check the API and try again."
                    : "Profile not found."}
                </ThemedText>
              </View>
            )}
          </View>

          <View>
            <SectionHeader
              title="Active streams"
              actionLabel="Manage"
              actionOnPress={() => router.push("/manage-streams")}
            />
            {isLoading ? (
              <View style={styles.skeletonStack}>
                {[0, 1].map((key) => (
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
            ) : projects.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.projectRow}>
                  {projects.map((project) => (
                    <ProjectCard key={project.id} project={project} />
                  ))}
                </View>
              </ScrollView>
            ) : (
              <View style={styles.emptyState}>
                <ThemedText type="caption" style={{ color: colors.muted }}>
                  No projects yet.
                </ThemedText>
              </View>
            )}
          </View>

          <View>
            <SectionHeader
              title="Saved streams"
              actionLabel="See all"
              actionOnPress={() => router.push("/streams")}
            />
            {isSavedStreamsLoading ? (
              <View style={styles.skeletonStack}>
                {[0, 1].map((key) => (
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
            ) : savedStreams.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.projectRow}>
                  {savedStreams.map((project) => (
                    <ProjectCard key={project.id} project={project} />
                  ))}
                </View>
              </ScrollView>
            ) : (
              <View style={styles.emptyState}>
                <ThemedText type="caption" style={{ color: colors.muted }}>
                  No saved streams yet.
                </ThemedText>
              </View>
            )}
          </View>

          <View>
            <SectionHeader
              title="Recent bytes"
              actionLabel="Archive"
              actionOnPress={() => router.push("/archive-bytes")}
            />
            {isLoading ? (
              <View style={styles.skeletonStack}>
                {[0, 1].map((key) => (
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
                  No recent posts yet.
                </ThemedText>
              </View>
            )}
          </View>

          <View>
            <SectionHeader
              title="Saved bytes"
              actionLabel="Library"
              actionOnPress={() => router.push("/saved-library")}
            />
            {isSavedLoading ? (
              <View style={styles.skeletonStack}>
                {[0, 1].map((key) => (
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
            ) : savedPosts.length ? (
              savedPosts.map((post) => <Post key={post.id} {...post} />)
            ) : (
              <View style={styles.emptyState}>
                <ThemedText type="caption" style={{ color: colors.muted }}>
                  No saved bytes yet.
                </ThemedText>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
      <TopBlur />
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
    padding: 16,
    gap: 20,
    paddingTop: 0,
  },
  title: {
    fontSize: 26,
    lineHeight: 30,
  },
  profileCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    gap: 16,
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
  skeletonAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    opacity: 0.7,
  },
  skeletonLine: {
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    opacity: 0.7,
  },
  skeletonLineShort: {
    height: 12,
    width: 140,
    borderRadius: 6,
    borderWidth: 1,
    opacity: 0.7,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 12,
  },
  statRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  signOutButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  deleteAccountButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  settingsButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  projectRow: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 4,
    paddingRight: 20,
  },
});
