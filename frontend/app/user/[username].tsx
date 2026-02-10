import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { UserProps } from "@/constants/Types";
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
import { useAuth } from "@/contexts/AuthContext";
import {
  clearApiCache,
  followUser,
  getPostsByUserId,
  getProjectById,
  getProjectBuilders,
  getProjectsByBuilderId,
  getProjectsByUserId,
  getUserByUsername,
  getUsersFollowers,
  getUsersFollowersUsernames,
  getUsersFollowing,
  getUsersFollowingUsernames,
  unfollowUser,
} from "@/services/api";
import { mapPostToUi, mapProjectToUi } from "@/services/mappers";
import { subscribeToPostEvents } from "@/services/postEvents";

export default function UserProfileScreen() {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { username } = useLocalSearchParams<{ username?: string }>();
  const { user: authUser } = useAuth();
  const [profileUser, setProfileUser] = useState<UserProps | null>(null);
  const [projects, setProjects] = useState(
    [] as ReturnType<typeof mapProjectToUi>[],
  );
  const [posts, setPosts] = useState([] as ReturnType<typeof mapPostToUi>[]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [shipsCount, setShipsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isUpdatingFollow, setIsUpdatingFollow] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFollowersOpen, setIsFollowersOpen] = useState(false);
  const [isFollowingOpen, setIsFollowingOpen] = useState(false);
  const [followersList, setFollowersList] = useState<string[]>([]);
  const [followingList, setFollowingList] = useState<string[]>([]);
  const [isFollowersLoading, setIsFollowersLoading] = useState(false);
  const [isFollowingLoading, setIsFollowingLoading] = useState(false);
  const [followerUsers, setFollowerUsers] = useState<UserProps[]>([]);
  const [followingUsers, setFollowingUsers] = useState<UserProps[]>([]);
  const [followingSet, setFollowingSet] = useState<Set<number>>(new Set());
  const [isFollowingBusy, setIsFollowingBusy] = useState(false);
  const [followersQuery, setFollowersQuery] = useState("");
  const [followingQuery, setFollowingQuery] = useState("");
  const motion = useMotionConfig();
  const reveal = useRef(new Animated.Value(0)).current;

  const filteredFollowerUsers = useMemo(() => {
    const trimmed = followersQuery.trim().toLowerCase();
    if (!trimmed) {
      return followerUsers;
    }
    return followerUsers.filter((user) =>
      user.username.toLowerCase().includes(trimmed),
    );
  }, [followerUsers, followersQuery]);

  const filteredFollowingUsers = useMemo(() => {
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

  const loadUser = useCallback(async () => {
    if (!username || Array.isArray(username)) {
      return;
    }
    setIsLoading(true);
    try {
      const userData = await getUserByUsername(username);
      setProfileUser(userData);

      const isSelf =
        !!authUser?.username && authUser.username === userData.username;
      const loadProjects = async () => {
        if (!userData.id) {
          return [];
        }
        if (isSelf) {
          try {
            return await getProjectsByBuilderId(userData.id);
          } catch {
            return await getProjectsByUserId(userData.id);
          }
        }
        return await getProjectsByUserId(userData.id);
      };

      const [userProjects, userPosts, followers, followingIds, following] =
        await Promise.all([
          loadProjects().catch(() => []),
          userData.id ? getPostsByUserId(userData.id) : Promise.resolve([]),
          getUsersFollowers(userData.username).catch(() => []),
          authUser?.username
            ? getUsersFollowing(authUser.username).catch(() => [])
            : Promise.resolve([]),
          getUsersFollowing(userData.username).catch(() => []),
        ]);

      const safeProjects = Array.isArray(userProjects) ? userProjects : [];
      const safePosts = Array.isArray(userPosts) ? userPosts : [];
      const safeFollowers = Array.isArray(followers) ? followers : [];
      const safeFollowing = Array.isArray(followingIds) ? followingIds : [];
      const safeProfileFollowing = Array.isArray(following) ? following : [];

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
      setShipsCount(safePosts.length);
      setFollowersCount(safeFollowers.length);
      setFollowingCount(safeProfileFollowing.length);
      setPosts(
        await Promise.all(
          safePosts.slice(0, 4).map(async (post) => {
            const project = projectMap.get(post.project)
              ? Promise.resolve(projectMap.get(post.project)!)
              : getProjectById(post.project).catch(() => null);
            return mapPostToUi(post, userData, await project);
          }),
        ),
      );

      setIsFollowing(safeFollowing.includes(userData.id));
      setHasError(false);
    } catch {
      setProfileUser(null);
      setProjects([]);
      setPosts([]);
      setFollowersCount(0);
      setFollowingCount(0);
      setShipsCount(0);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [authUser?.username, username]);

  useEffect(() => {
    clearApiCache();
    loadUser();
  }, [loadUser]);

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
      loadUser();
    }, [loadUser]),
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    clearApiCache();
    await loadUser();
    setIsRefreshing(false);
  }, [loadUser]);

  useAutoRefresh(loadUser, { focusRefresh: false });

  const loadFollowers = useCallback(async () => {
    if (!profileUser?.username) {
      return;
    }
    setIsFollowersLoading(true);
    try {
      const list = await getUsersFollowersUsernames(profileUser.username);
      const names = Array.isArray(list) ? list : [];
      setFollowersList(names);
      const users = await Promise.all(
        names.map((name) => getUserByUsername(name).catch(() => null)),
      );
      setFollowerUsers(users.filter((item): item is UserProps => !!item));
      if (authUser?.username) {
        const followingIds = await getUsersFollowing(authUser.username).catch(
          () => [],
        );
        setFollowingSet(
          new Set(Array.isArray(followingIds) ? followingIds : []),
        );
      }
    } finally {
      setIsFollowersLoading(false);
    }
  }, [authUser?.username, profileUser?.username]);

  const loadFollowing = useCallback(async () => {
    if (!profileUser?.username) {
      return;
    }
    setIsFollowingLoading(true);
    try {
      const list = await getUsersFollowingUsernames(profileUser.username);
      const names = Array.isArray(list) ? list : [];
      setFollowingList(names);
      const users = await Promise.all(
        names.map((name) => getUserByUsername(name).catch(() => null)),
      );
      setFollowingUsers(users.filter((item): item is UserProps => !!item));
      if (authUser?.username) {
        const followingIds = await getUsersFollowing(authUser.username).catch(
          () => [],
        );
        setFollowingSet(
          new Set(Array.isArray(followingIds) ? followingIds : []),
        );
      }
    } finally {
      setIsFollowingLoading(false);
    }
  }, [authUser?.username, profileUser?.username]);

  const handleToggleModalFollow = async (target: UserProps) => {
    if (!authUser?.username || isFollowingBusy) {
      return;
    }
    const targetId = target.id ?? -1;
    const isCurrentlyFollowing = followingSet.has(targetId);
    setIsFollowingBusy(true);
    try {
      if (isCurrentlyFollowing) {
        await unfollowUser(authUser.username, target.username);
      } else {
        await followUser(authUser.username, target.username);
      }
      setFollowingSet((prev) => {
        const next = new Set(prev);
        if (isCurrentlyFollowing) {
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

  const handleToggleFollow = async () => {
    if (!authUser?.username || !profileUser || isUpdatingFollow) {
      return;
    }
    setIsUpdatingFollow(true);
    try {
      if (isFollowing) {
        await unfollowUser(authUser.username, profileUser.username);
        setIsFollowing(false);
        setFollowersCount((prev) => Math.max(0, prev - 1));
      } else {
        await followUser(authUser.username, profileUser.username);
        setIsFollowing(true);
        setFollowersCount((prev) => prev + 1);
      }
    } finally {
      setIsUpdatingFollow(false);
    }
  };

  const canFollow = useMemo(
    () => authUser?.username && profileUser?.username !== authUser.username,
    [authUser?.username, profileUser?.username],
  );

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
              {profileUser?.username || "Profile"}
            </ThemedText>
            <ThemedText type="default" style={{ color: colors.muted }}>
              Builder profile and streams.
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
                    { backgroundColor: colors.surfaceAlt },
                  ]}
                />
                <View
                  style={[
                    styles.skeletonLine,
                    { backgroundColor: colors.surfaceAlt },
                  ]}
                />
                <View
                  style={[
                    styles.skeletonLineShort,
                    { backgroundColor: colors.surfaceAlt },
                  ]}
                />
              </View>
            ) : profileUser ? (
              <View style={styles.profileContent}>
                <User {...profileUser} />
                {canFollow ? (
                  <Pressable
                    onPress={handleToggleFollow}
                    style={[
                      styles.followButton,
                      { backgroundColor: colors.tint },
                    ]}
                  >
                    <ThemedText
                      type="defaultSemiBold"
                      style={{ color: colors.accent }}
                    >
                      {isFollowing ? "Following" : "Follow"}
                    </ThemedText>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <ThemedText type="caption" style={{ color: colors.muted }}>
                  {hasError ? "Unable to load profile." : "User not found."}
                </ThemedText>
              </View>
            )}
          </View>

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
            <View style={styles.statsRow}>
              <StatPill label="Streams" value={projects.length} />
              <StatPill label="Bytes" value={shipsCount} />
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
            </View>
          </Animated.View>

          <View>
            <SectionHeader title="Streams" />
            {projects.length ? (
              <View style={styles.projectGrid}>
                {projects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    variant="full"
                  />
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <ThemedText type="caption" style={{ color: colors.muted }}>
                  {hasError ? "Streams unavailable." : "No streams yet."}
                </ThemedText>
              </View>
            )}
          </View>

          <View>
            <SectionHeader title="Recent bytes" />
            {posts.length ? (
              posts.map((post) => <Post key={post.id} {...post} />)
            ) : (
              <View style={styles.emptyState}>
                <ThemedText type="caption" style={{ color: colors.muted }}>
                  {hasError ? "Bytes unavailable." : "No bytes yet."}
                </ThemedText>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
      <TopBlur />
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
                    onToggleFollow={() => handleToggleModalFollow(item)}
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
                    onToggleFollow={() => handleToggleModalFollow(item)}
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
    padding: 16,
    gap: 16,
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
    gap: 12,
  },
  profileContent: {
    gap: 12,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  projectGrid: {
    gap: 12,
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
  emptyState: {
    alignItems: "center",
    paddingVertical: 16,
  },
  followButton: {
    alignSelf: "flex-start",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  skeletonStack: {
    gap: 10,
  },
  skeletonAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
  },
  skeletonLineShort: {
    height: 12,
    borderRadius: 6,
    width: "60%",
  },
});
