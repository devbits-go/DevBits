import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  InteractionManager,
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
import { Feather } from "@expo/vector-icons";
import { ApiUser, UserProps } from "@/constants/Types";
import { ProjectCard } from "@/components/ProjectCard";
import { InfiniteHorizontalCycle } from "@/components/InfiniteHorizontalCycle";
import { SectionHeader } from "@/components/SectionHeader";
import { StatPill } from "@/components/StatPill";
import { ThemedText } from "@/components/ThemedText";
import { UserCard } from "@/components/UserCard";
import { Post } from "@/components/Post";
import User from "@/components/User";
import { FloatingScrollTopButton } from "@/components/FloatingScrollTopButton";
import { TopBlur } from "@/components/TopBlur";
import { UnifiedLoadingList } from "@/components/UnifiedLoading";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { useAppColors } from "@/hooks/useAppColors";
import { useMotionConfig } from "@/hooks/useMotionConfig";
import { useTopBlurScroll } from "@/hooks/useTopBlurScroll";
import { useAuth } from "@/contexts/AuthContext";
import {
  beginFreshReadWindow,
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
  const [isFollowersLoading, setIsFollowersLoading] = useState(false);
  const [isFollowingLoading, setIsFollowingLoading] = useState(false);
  const [followerUsers, setFollowerUsers] = useState<ApiUser[]>([]);
  const [followingUsers, setFollowingUsers] = useState<ApiUser[]>([]);
  const [followingSet, setFollowingSet] = useState<Set<number>>(new Set());
  const [isFollowingBusy, setIsFollowingBusy] = useState(false);
  const [followersQuery, setFollowersQuery] = useState("");
  const [followingQuery, setFollowingQuery] = useState("");
  const [visibleProjectCount, setVisibleProjectCount] = useState(0);
  const [visibleSavedStreamCount, setVisibleSavedStreamCount] = useState(0);
  const [visiblePostCount, setVisiblePostCount] = useState(0);
  const [visibleSavedPostCount, setVisibleSavedPostCount] = useState(0);
  const motion = useMotionConfig();
  const reveal = useRef(new Animated.Value(0.08)).current;
  const hasLoadedRef = useRef(false);
  const hasFocusedRef = useRef(false);
  const scrollRef = useRef<ScrollView | null>(null);
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

  const scheduleProgressiveCount = useCallback(
    (
      total: number,
      setCount: React.Dispatch<React.SetStateAction<number>>,
      config: { initial: number; step: number; delayMs: number },
    ) => {
      let cancelled = false;
      let timer: ReturnType<typeof setTimeout> | null = null;

      const initialCount = Math.min(total, config.initial);
      setCount(initialCount);

      const task = InteractionManager.runAfterInteractions(() => {
        if (cancelled || initialCount >= total) {
          return;
        }

        const advance = () => {
          if (cancelled) {
            return;
          }
          setCount((prev) => {
            const next = Math.min(total, prev + config.step);
            if (next < total) {
              timer = setTimeout(advance, config.delayMs);
            }
            return next;
          });
        };

        timer = setTimeout(advance, config.delayMs);
      });

      return () => {
        cancelled = true;
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        task.cancel?.();
      };
    },
    [],
  );

  useEffect(() => {
    return scheduleProgressiveCount(projects.length, setVisibleProjectCount, {
      initial: 4,
      step: 2,
      delayMs: 56,
    });
  }, [projects.length, scheduleProgressiveCount]);

  useEffect(() => {
    return scheduleProgressiveCount(
      savedStreams.length,
      setVisibleSavedStreamCount,
      {
        initial: 4,
        step: 2,
        delayMs: 56,
      },
    );
  }, [savedStreams.length, scheduleProgressiveCount]);

  useEffect(() => {
    return scheduleProgressiveCount(posts.length, setVisiblePostCount, {
      initial: 2,
      step: 1,
      delayMs: 72,
    });
  }, [posts.length, scheduleProgressiveCount]);

  useEffect(() => {
    return scheduleProgressiveCount(
      savedPosts.length,
      setVisibleSavedPostCount,
      {
        initial: 2,
        step: 1,
        delayMs: 72,
      },
    );
  }, [savedPosts.length, scheduleProgressiveCount]);

  const visibleProjects = React.useMemo(
    () => projects.slice(0, visibleProjectCount),
    [projects, visibleProjectCount],
  );

  const visibleSavedStreams = React.useMemo(
    () => savedStreams.slice(0, visibleSavedStreamCount),
    [savedStreams, visibleSavedStreamCount],
  );

  const visiblePosts = React.useMemo(
    () => posts.slice(0, visiblePostCount),
    [posts, visiblePostCount],
  );

  const visibleSavedPosts = React.useMemo(
    () => savedPosts.slice(0, visibleSavedPostCount),
    [savedPosts, visibleSavedPostCount],
  );

  useEffect(() => {
    if (motion.prefersReducedMotion) {
      reveal.setValue(1);
      return;
    }

    Animated.spring(reveal, {
      toValue: 1,
      speed: 16,
      bounciness: 7,
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
    loadSaved();
  }, [loadSaved]);

  useEffect(() => {
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
      if (!hasFocusedRef.current) {
        hasFocusedRef.current = true;
        return;
      }

      const task = InteractionManager.runAfterInteractions(() => {
        beginFreshReadWindow();
        void fetchUser({ silent: true });
        void loadSaved(false);
        void loadSavedStreams(false);
      });

      return () => {
        task.cancel?.();
      };
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
    beginFreshReadWindow();
    await refreshProfile();
    setIsRefreshing(false);
  }, [refreshProfile]);

  useAutoRefresh(refreshProfile, { focusRefresh: false });

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.background} pointerEvents="none" />
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <Animated.ScrollView
          ref={scrollRef}
          contentInsetAdjustmentBehavior="never"
          removeClippedSubviews
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
          contentContainerStyle={[
            styles.container,
            { paddingTop: 8, paddingBottom: 96 + insets.bottom },
          ]}
        >
          <Animated.View
            style={{
              opacity: reveal,
              transform: [
                {
                  translateY: reveal.interpolate({
                    inputRange: [0, 1],
                    outputRange: [18, 0],
                  }),
                },
                {
                  scale: reveal.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.97, 1],
                  }),
                },
              ],
            }}
          >
            <View style={styles.headerRow}>
              <View style={styles.headerTextWrap}>
                <ThemedText type="display" style={styles.title}>
                  Profile
                </ThemedText>
                <ThemedText type="default" style={{ color: colors.muted }}>
                  Hello World!
                </ThemedText>
              </View>
              <Pressable
                hitSlop={10}
                style={({ pressed }) => [
                  styles.headerSettingsButton,
                  {
                    borderColor: colors.tint,
                    backgroundColor: colors.surfaceAlt,
                    shadowColor: colors.tint,
                    opacity: pressed ? 0.82 : 1,
                  },
                ]}
                onPress={() => router.push("/settings")}
              >
                <Feather name="settings" size={18} color={colors.tint} />
              </Pressable>
            </View>
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

          <View style={styles.sectionBlock}>
            <SectionHeader
              title="Active streams"
              actionLabel="Manage"
              actionOnPress={() => router.push("/manage-streams")}
            />
            <View style={styles.streamSectionBody}>
              {isLoading ? (
                <UnifiedLoadingList rows={2} cardHeight={188} cardRadius={14} />
              ) : projects.length ? (
                <View style={styles.edgeToEdgeRail}>
                  <InfiniteHorizontalCycle
                    data={visibleProjects}
                    itemWidth={246}
                    repeat={false}
                    keyExtractor={(project) => String(project.id)}
                    renderItem={(project) => (
                      <View style={styles.projectCardSlot}>
                        <ProjectCard
                          project={project}
                          isBuilder={builderProjectIds.includes(project.id)}
                        />
                      </View>
                    )}
                  />
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <ThemedText type="caption" style={{ color: colors.muted }}>
                    No projects yet.
                  </ThemedText>
                </View>
              )}
            </View>
          </View>

          <View style={styles.sectionBlock}>
            <SectionHeader
              title="Saved streams"
              actionLabel="Library"
              actionOnPress={() => router.push("/saved-streams")}
            />
            <View style={styles.streamSectionBody}>
              {isSavedStreamsLoading ? (
                <UnifiedLoadingList rows={2} cardHeight={188} cardRadius={14} />
              ) : savedStreams.length ? (
                <View style={styles.edgeToEdgeRail}>
                  <InfiniteHorizontalCycle
                    data={visibleSavedStreams}
                    itemWidth={246}
                    repeat={false}
                    keyExtractor={(project) => String(project.id)}
                    renderItem={(project) => (
                      <View style={styles.projectCardSlot}>
                        <ProjectCard
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
                      </View>
                    )}
                  />
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <ThemedText type="caption" style={{ color: colors.muted }}>
                    No saved streams yet.
                  </ThemedText>
                </View>
              )}
            </View>
          </View>

          <View style={styles.sectionBlock}>
            <SectionHeader
              title="Recent bytes"
              actionLabel="Archive"
              actionOnPress={() => router.push("/archive-bytes")}
            />
            <View style={styles.postSectionBody}>
              {isLoading ? (
                <UnifiedLoadingList rows={2} cardHeight={124} cardRadius={14} />
              ) : posts.length ? (
                visiblePosts.map((post) => <Post key={post.id} {...post} />)
              ) : (
                <View style={styles.emptyState}>
                  <ThemedText type="caption" style={{ color: colors.muted }}>
                    No recent posts yet.
                  </ThemedText>
                </View>
              )}
            </View>
          </View>

          <View style={styles.sectionBlock}>
            <SectionHeader
              title="Saved bytes"
              actionLabel="Library"
              actionOnPress={() => router.push("/saved-library")}
            />
            <View style={styles.postSectionBody}>
              {isSavedLoading ? (
                <UnifiedLoadingList rows={2} cardHeight={124} cardRadius={14} />
              ) : savedPosts.length ? (
                visibleSavedPosts.map((post) => (
                  <Post key={post.id} {...post} />
                ))
              ) : (
                <View style={styles.emptyState}>
                  <ThemedText type="caption" style={{ color: colors.muted }}>
                    No saved bytes yet.
                  </ThemedText>
                </View>
              )}
            </View>
          </View>
        </Animated.ScrollView>
      </SafeAreaView>
      <TopBlur scrollY={scrollY} />
      <FloatingScrollTopButton
        scrollY={scrollY}
        onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
        bottomOffset={insets.bottom + 20}
      />
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
    paddingHorizontal: 16,
    gap: 20,
    paddingTop: 0,
  },
  edgeToEdgeRail: {
    marginHorizontal: -16,
    overflow: "visible",
  },
  title: {
    fontSize: 26,
    lineHeight: 30,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  headerTextWrap: {
    flex: 1,
    gap: 2,
  },
  headerSettingsButton: {
    borderWidth: 1,
    borderRadius: 10,
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
    marginRight: 24,
  },
  profileCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    gap: 16,
  },
  sectionBlock: {
    paddingTop: 0,
    minHeight: 180,
  },
  streamSectionBody: {
    minHeight: 190,
  },
  postSectionBody: {
    minHeight: 210,
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
  projectCardSlot: {
    width: 246,
    minHeight: 186,
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
