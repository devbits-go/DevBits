import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { ApiUser, UserProps } from "@/constants/Types";
import { ProjectCard } from "@/components/ProjectCard";
import { SectionHeader } from "@/components/SectionHeader";
import { StatPill } from "@/components/StatPill";
import { ThemedText } from "@/components/ThemedText";
import { UserCard } from "@/components/UserCard";
import { Post } from "@/components/Post";
import User from "@/components/User";
import { TopBlur } from "@/components/TopBlur";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { useAppColors } from "@/hooks/useAppColors";
import { useMotionConfig } from "@/hooks/useMotionConfig";
import { useTopBlurScroll } from "@/hooks/useTopBlurScroll";
import { useAuth } from "@/contexts/AuthContext";
import {
  clearApiCache,
  getPostById,
  getPostsByUserId,
  getProjectById,
  getProjectBuilders,
  getProjectsByBuilderId,
  getUserById,
  getUserByUsername,
  getUsersFollowers,
  getUsersFollowersUsernames,
  getUsersFollowing,
  getUsersFollowingUsernames,
  followUser,
  unfollowUser,
} from "@/services/api";
import { mapPostToUi, mapProjectToUi } from "@/services/mappers";
import { useSaved } from "@/contexts/SavedContext";
import { useSavedStreams } from "@/contexts/SavedStreamsContext";
import { subscribeToPostEvents } from "@/services/postEvents";
import {
  applyProjectEvent,
  subscribeToProjectEvents,
} from "@/services/projectEvents";

export default function ProfileScreen() {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user: authUser } = useAuth();
  const { savedPostIds } = useSaved();
  const { savedProjectIds, removeSavedProjectIds } = useSavedStreams();
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
  const [builderProjectIds, setBuilderProjectIds] = useState<number[]>([]);
  const [isSavedLoading, setIsSavedLoading] = useState(false);
  const [isSavedStreamsLoading, setIsSavedStreamsLoading] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [streakCount, setStreakCount] = useState(0);
  const [shipsCount, setShipsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFollowersOpen, setIsFollowersOpen] = useState(false);
  const [isFollowingOpen, setIsFollowingOpen] = useState(false);
  const [followersList, setFollowersList] = useState<string[]>([]);
  const [followingList, setFollowingList] = useState<string[]>([]);
  const [isFollowersLoading, setIsFollowersLoading] = useState(false);
  const [isFollowingLoading, setIsFollowingLoading] = useState(false);
  const [followerUsers, setFollowerUsers] = useState<ApiUser[]>([]);
  const [followingUsers, setFollowingUsers] = useState<ApiUser[]>([]);
  const [followingSet, setFollowingSet] = useState<Set<number>>(new Set());
  const [isFollowingBusy, setIsFollowingBusy] = useState(false);
  const [followersQuery, setFollowersQuery] = useState("");
  const [followingQuery, setFollowingQuery] = useState("");
  const motion = useMotionConfig();
  const reveal = useRef(new Animated.Value(0)).current;
  const hasLoadedRef = useRef(false);
  const { scrollY, onScroll } = useTopBlurScroll();

  const filteredFollowerUsers = React.useMemo(() => {
    const trimmed = followersQuery.trim().toLowerCase();
    if (!trimmed) {
      return followerUsers;
    }
    return followerUsers.filter((user) =>
      user.username.toLowerCase().includes(trimmed),
    );
  }, [followerUsers, followersQuery]);

  const filteredFollowingUsers = React.useMemo(() => {
    const trimmed = followingQuery.trim().toLowerCase();
    if (!trimmed) {
      return followingUsers;
    }
    return followingUsers.filter((user) =>
      user.username.toLowerCase().includes(trimmed),
    );
  }, [followingUsers, followingQuery]);

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

  const fetchUser = useCallback(
    async (options?: { silent?: boolean }) => {
      const isSilent = options?.silent;
      const shouldShowLoader = !isSilent && !hasLoadedRef.current;
      try {
        if (shouldShowLoader) {
          setIsLoading(true);
        }
        if (!authUser?.username || !authUser.id) {
          setCurrentUser(null);
          setProjects([]);
          setPosts([]);
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
            const [userProjects, userPosts, followers, following] =
              await Promise.all([
                getProjectsByBuilderId(resolvedUser.id),
                getPostsByUserId(resolvedUser.id),
                getUsersFollowers(resolvedUser.username),
                getUsersFollowing(resolvedUser.username),
              ]);

            const safeProjects = Array.isArray(userProjects)
              ? userProjects
              : [];
            const safePosts = Array.isArray(userPosts) ? userPosts : [];
            const safeFollowers = Array.isArray(followers) ? followers : [];
            const safeFollowing = Array.isArray(following) ? following : [];

            const projectMap = new Map(
              safeProjects.map((project) => [project.id, project]),
            );

            const builderCounts = await Promise.all(
              safeProjects.map((project) =>
                getProjectBuilders(project.id).catch(() => []),
              ),
            );
            setProjects(
              safeProjects.map((project, index) =>
                mapProjectToUi(project, builderCounts[index]?.length ?? 0),
              ),
            );
            setBuilderProjectIds(safeProjects.map((project) => project.id));
            setShipsCount(safePosts.length);
            setFollowersCount(safeFollowers.length);
            setFollowingCount(safeFollowing.length);
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
            if (!isSilent) {
              setProjects([]);
              setPosts([]);
              setShipsCount(0);
              setFollowersCount(0);
              setFollowingCount(0);
              setStreakCount(0);
              setBuilderProjectIds([]);
            }
            setHasError(true);
          }
        }
      } catch {
        if (!isSilent) {
          setCurrentUser(null);
          setProjects([]);
          setPosts([]);
          setBuilderProjectIds([]);
        }
        setHasError(true);
      } finally {
        hasLoadedRef.current = true;
        if (shouldShowLoader) {
          setIsLoading(false);
        }
      }
    },
    [authUser],
  );

  const loadFollowers = useCallback(async () => {
    if (!authUser?.username) {
      return;
    }
    setIsFollowersLoading(true);
    try {
      const list = await getUsersFollowersUsernames(authUser.username);
      const names = Array.isArray(list) ? list : [];
      setFollowersList(names);
      const users = await Promise.all(
        names.map((name) => getUserByUsername(name).catch(() => null)),
      );
      setFollowerUsers(users.filter((item): item is ApiUser => item !== null));
      const followingIds = await getUsersFollowing(authUser.username).catch(
        () => [],
      );
      setFollowingSet(new Set(Array.isArray(followingIds) ? followingIds : []));
    } finally {
      setIsFollowersLoading(false);
    }
  }, [authUser?.username]);

  const loadFollowing = useCallback(async () => {
    if (!authUser?.username) {
      return;
    }
    setIsFollowingLoading(true);
    try {
      const list = await getUsersFollowingUsernames(authUser.username);
      const names = Array.isArray(list) ? list : [];
      setFollowingList(names);
      const users = await Promise.all(
        names.map((name) => getUserByUsername(name).catch(() => null)),
      );
      setFollowingUsers(users.filter((item): item is ApiUser => item !== null));
      const followingIds = await getUsersFollowing(authUser.username).catch(
        () => [],
      );
      setFollowingSet(new Set(Array.isArray(followingIds) ? followingIds : []));
    } finally {
      setIsFollowingLoading(false);
    }
  }, [authUser?.username]);

  const handleToggleFollow = async (target: ApiUser) => {
    if (!authUser?.username || isFollowingBusy) {
      return;
    }
    const targetId = target.id ?? -1;
    const isFollowing = followingSet.has(targetId);
    setIsFollowingBusy(true);
    try {
      if (isFollowing) {
        await unfollowUser(authUser.username, target.username);
      } else {
        await followUser(authUser.username, target.username);
      }
      setFollowingSet((prev) => {
        const next = new Set(prev);
        if (isFollowing) {
          next.delete(targetId);
        } else if (targetId > 0) {
          next.add(targetId);
        }
        return next;
      });
    } finally {
      setIsFollowingBusy(false);
    }
  };

  useEffect(() => {
    clearApiCache();
    fetchUser();
  }, [fetchUser]);

  const loadSaved = useCallback(
    async (showLoader = true) => {
      if (!savedPostIds.length) {
        setSavedPosts([]);
        return;
      }
      if (showLoader) {
        setIsSavedLoading(true);
      }
      try {
        const savedData = await Promise.all(
          savedPostIds.map(async (postId) => {
            try {
              const post = await getPostById(postId);
              const [user, project] = await Promise.all([
                getUserById(post.user).catch(() => null),
                getProjectById(post.project).catch(() => null),
              ]);
              return mapPostToUi(post, user, project);
            } catch {
              return null;
            }
          }),
        );

        setSavedPosts(
          savedData.filter(
            (post): post is ReturnType<typeof mapPostToUi> => post !== null,
          ),
        );
      } catch {
        if (showLoader) {
          setSavedPosts([]);
        }
      } finally {
        if (showLoader) {
          setIsSavedLoading(false);
        }
      }
    },
    [savedPostIds],
  );

  const loadSavedStreams = useCallback(
    async (showLoader = true) => {
      if (!savedProjectIds.length) {
        setSavedStreams([]);
        if (showLoader) {
          setIsSavedStreamsLoading(false);
        }
        return;
      }
      if (showLoader) {
        setIsSavedStreamsLoading(true);
      }
      try {
        const projectsData = await Promise.all(
          savedProjectIds.map((projectId) =>
            getProjectById(projectId).catch(() => null),
          ),
        );
        const missingIds = savedProjectIds.filter(
          (_, index) => !projectsData[index],
        );
        if (missingIds.length) {
          void removeSavedProjectIds(missingIds);
        }
        const validProjects = projectsData.filter((project) => project);
        const builderCounts = await Promise.all(
          validProjects.map((project) =>
            getProjectBuilders(project!.id).catch(() => []),
          ),
        );
        const mapped = validProjects.map((project, index) =>
          mapProjectToUi(project!, builderCounts[index]?.length ?? 0),
        );
        setSavedStreams(mapped);
      } catch {
        setSavedStreams([]);
      } finally {
        if (showLoader) {
          setIsSavedStreamsLoading(false);
        }
      }
    },
    [removeSavedProjectIds, savedProjectIds],
  );

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

  useEffect(() => {
    return subscribeToProjectEvents((event) => {
      setProjects((prev) => applyProjectEvent(prev, event));
      setSavedStreams((prev) => applyProjectEvent(prev, event));
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      clearApiCache();
      fetchUser({ silent: true });
      loadSaved(false);
      loadSavedStreams(false);
    }, [fetchUser, loadSaved, loadSavedStreams]),
  );

  const refreshProfile = useCallback(async () => {
    await Promise.all([
      fetchUser({ silent: true }),
      loadSaved(false),
      loadSavedStreams(false),
    ]);
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
                  <Pressable
                    onPress={() => {
                      setIsFollowersOpen(true);
                      loadFollowers();
                    }}
                  >
                    <StatPill label="Followers" value={followersCount} />
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setIsFollowingOpen(true);
                      loadFollowing();
                    }}
                  >
                    <StatPill label="Following" value={followingCount} />
                  </Pressable>
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
                    <ProjectCard
                      key={project.id}
                      project={project}
                      isBuilder={builderProjectIds.includes(project.id)}
                    />
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
              actionLabel="Library"
              actionOnPress={() => router.push("/saved-streams")}
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
                    <ProjectCard
                      key={project.id}
                      project={project}
                      saved
                      onSavedChange={(nextSaved) => {
                        if (!nextSaved) {
                          setSavedStreams((prev) =>
                            prev.filter((item) => item.id !== project.id),
                          );
                        }
                      }}
                    />
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
        </Animated.ScrollView>
      </SafeAreaView>
      <TopBlur scrollY={scrollY} />
      <Modal
        visible={isFollowersOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsFollowersOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setIsFollowersOpen(false)}
        >
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <ThemedText type="subtitle">Followers</ThemedText>
            <TextInput
              value={followersQuery}
              onChangeText={setFollowersQuery}
              placeholder="Search followers"
              placeholderTextColor={colors.muted}
              style={[
                styles.searchInput,
                {
                  backgroundColor: colors.surfaceAlt,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
            />
            <ScrollView>
              {isFollowersLoading ? (
                <ThemedText type="caption" style={{ color: colors.muted }}>
                  Loading...
                </ThemedText>
              ) : filteredFollowerUsers.length ? (
                filteredFollowerUsers.map((item) => (
                  <UserCard
                    key={item.username}
                    username={item.username}
                    picture={item.picture}
                    isFollowing={followingSet.has(item.id ?? -1)}
                    onPress={() => {
                      setIsFollowersOpen(false);
                      router.push({
                        pathname: "/user/[username]",
                        params: { username: item.username },
                      });
                    }}
                    onToggleFollow={() => handleToggleFollow(item)}
                  />
                ))
              ) : followersQuery.trim() ? (
                <ThemedText type="caption" style={{ color: colors.muted }}>
                  No matches found.
                </ThemedText>
              ) : (
                <ThemedText type="caption" style={{ color: colors.muted }}>
                  No followers yet.
                </ThemedText>
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
      <Modal
        visible={isFollowingOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsFollowingOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setIsFollowingOpen(false)}
        >
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <ThemedText type="subtitle">Following</ThemedText>
            <TextInput
              value={followingQuery}
              onChangeText={setFollowingQuery}
              placeholder="Search following"
              placeholderTextColor={colors.muted}
              style={[
                styles.searchInput,
                {
                  backgroundColor: colors.surfaceAlt,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
            />
            <ScrollView>
              {isFollowingLoading ? (
                <ThemedText type="caption" style={{ color: colors.muted }}>
                  Loading...
                </ThemedText>
              ) : filteredFollowingUsers.length ? (
                filteredFollowingUsers.map((item) => (
                  <UserCard
                    key={item.username}
                    username={item.username}
                    picture={item.picture}
                    isFollowing={followingSet.has(item.id ?? -1)}
                    onPress={() => {
                      setIsFollowingOpen(false);
                      router.push({
                        pathname: "/user/[username]",
                        params: { username: item.username },
                      });
                    }}
                    onToggleFollow={() => handleToggleFollow(item)}
                  />
                ))
              ) : followingQuery.trim() ? (
                <ThemedText type="caption" style={{ color: colors.muted }}>
                  No matches found.
                </ThemedText>
              ) : (
                <ThemedText type="caption" style={{ color: colors.muted }}>
                  Not following anyone yet.
                </ThemedText>
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxHeight: "70%",
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  modalRow: {
    paddingVertical: 8,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
});
