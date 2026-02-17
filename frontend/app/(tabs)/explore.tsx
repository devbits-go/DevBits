import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { FadeInImage } from "@/components/FadeInImage";
import { UiPerson } from "@/constants/Types";
import {
  clearApiCache,
  followUser,
  getAllUsers,
  getPostsFeed,
  getProjectById,
  getProjectBuilders,
  getProjectsFeed,
  getProjectsByUserId,
  getUserById,
  getUsersFollowing,
  getPostsByUserId,
  unfollowUser,
} from "@/services/api";
import { mapPostToUi, mapProjectToUi } from "@/services/mappers";
import { ProjectCard } from "@/components/ProjectCard";
import { InfiniteHorizontalCycle } from "@/components/InfiniteHorizontalCycle";
import { Post } from "@/components/Post";
import { SectionHeader } from "@/components/SectionHeader";
import { TagChip } from "@/components/TagChip";
import { ThemedText } from "@/components/ThemedText";
import { FloatingScrollTopButton } from "@/components/FloatingScrollTopButton";
import { TopBlur } from "@/components/TopBlur";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { useAppColors } from "@/hooks/useAppColors";
import { useMotionConfig } from "@/hooks/useMotionConfig";
import { useTopBlurScroll } from "@/hooks/useTopBlurScroll";
import { useRequestGuard } from "@/hooks/useRequestGuard";
import { useAuth } from "@/contexts/AuthContext";
import { usePreferences } from "@/contexts/PreferencesContext";
import { subscribeToPostEvents } from "@/services/postEvents";

const categories = [
  "None",
  "Search results",
  "All",
  "bytes",
  "Streams",
  "users",
  "Tags",
];

export default function ExploreScreen() {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { preferences } = usePreferences();
  const [activeCategory, setActiveCategory] = useState("None");
  const [projects, setProjects] = useState(
    [] as ReturnType<typeof mapProjectToUi>[],
  );
  const [posts, setPosts] = useState([] as ReturnType<typeof mapPostToUi>[]);
  const [tags, setTags] = useState([] as string[]);
  const [people, setPeople] = useState<UiPerson[]>([]);
  const [following, setFollowing] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [searchProjects, setSearchProjects] = useState(
    [] as ReturnType<typeof mapProjectToUi>[],
  );
  const [searchPosts, setSearchPosts] = useState(
    [] as ReturnType<typeof mapPostToUi>[],
  );
  const [searchPeople, setSearchPeople] = useState<UiPerson[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const motion = useMotionConfig();
  const requestGuard = useRequestGuard();
  const reveal = useRef(new Animated.Value(0.08)).current;
  const scrollRef = useRef<Animated.ScrollView>(null);
  const { scrollY, onScroll } = useTopBlurScroll();

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

  const loadExplore = useCallback(
    async (showLoader = true) => {
      const requestId = requestGuard.beginRequest();
      try {
        if (showLoader && requestGuard.isMounted()) {
          setIsLoading(true);
        }
        const [projectFeedRaw, postFeedRaw, usersRaw, followingIdsRaw] =
          await Promise.all([
            getProjectsFeed("time", 0, 8),
            getPostsFeed("time", 0, 8),
            getAllUsers(0, 50),
            user?.username
              ? getUsersFollowing(user.username)
              : Promise.resolve([]),
          ]);

        const projectFeed = Array.isArray(projectFeedRaw) ? projectFeedRaw : [];
        const postFeed = Array.isArray(postFeedRaw) ? postFeedRaw : [];
        const users = Array.isArray(usersRaw) ? usersRaw : [];
        const followingIds = Array.isArray(followingIdsRaw)
          ? followingIdsRaw
          : [];

        const builderCounts = await Promise.all(
          projectFeed.map((project) =>
            getProjectBuilders(project.id).catch(() => []),
          ),
        );
        const uiProjects = projectFeed.map((project, index) =>
          mapProjectToUi(project, builderCounts[index]?.length ?? 0),
        );
        const projectMap = new Map(
          projectFeed.map((project) => [project.id, project]),
        );
        const uiPosts = await Promise.all(
          postFeed.map(async (post) => {
            const [postUser, postProject] = await Promise.all([
              getUserById(post.user).catch(() => null),
              projectMap.get(post.project)
                ? Promise.resolve(projectMap.get(post.project)!)
                : getProjectById(post.project).catch(() => null),
            ]);
            return mapPostToUi(post, postUser, postProject);
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

        const uiPeople = users.map((item) => ({
          id: item.id,
          name: item.username,
          title: "",
          focus: item.bio ?? "",
          picture: item.picture,
        }));

        if (!requestGuard.isActive(requestId)) {
          return;
        }

        setProjects(uiProjects);
        setPosts(uiPosts);
        setTags(
          Array.from(tagCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([tag]) => tag),
        );
        setPeople(uiPeople.filter((person) => person.name !== user?.username));
        setFollowing(new Set(followingIds));
        setHasError(false);
      } catch {
        if (!requestGuard.isActive(requestId)) {
          return;
        }
        setProjects([]);
        setPosts([]);
        setTags([]);
        setPeople([]);
        setHasError(true);
      } finally {
        if (showLoader && requestGuard.isMounted()) {
          setIsLoading(false);
        }
      }
    },
    [requestGuard, user?.username],
  );

  useEffect(() => {
    clearApiCache();
    loadExplore();
  }, [loadExplore]);

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
      loadExplore(false);
    }, [loadExplore]),
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    clearApiCache();
    await loadExplore(false);
    setIsRefreshing(false);
  }, [loadExplore]);

  useAutoRefresh(() => loadExplore(false), { focusRefresh: false });

  const filteredProjects = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return projects.filter((project) => {
      const matchesTerm = term
        ? project.name.toLowerCase().includes(term) ||
          project.summary.toLowerCase().includes(term) ||
          project.tags.some((tag) => tag.toLowerCase().includes(term))
        : true;
      return matchesTerm;
    });
  }, [projects, searchTerm]);

  const filteredPosts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return posts.filter((post) => {
      if (!term) {
        return true;
      }
      return (
        post.content.toLowerCase().includes(term) ||
        post.projectName.toLowerCase().includes(term) ||
        post.tags.some((tag) => tag.toLowerCase().includes(term))
      );
    });
  }, [posts, searchTerm]);

  const filteredPeople = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return people;
    }
    return people.filter(
      (person) =>
        person.name.toLowerCase().includes(term) ||
        person.focus.toLowerCase().includes(term),
    );
  }, [people, searchTerm]);

  const scoreMatch = (text: string, term: string) => {
    const trimmed = term.trim().toLowerCase();
    if (!trimmed) {
      return 0;
    }
    const haystack = text.toLowerCase();
    let score = 0;
    if (haystack.includes(trimmed)) {
      score += 4;
    }
    const tokens = trimmed.split(/\s+/).filter(Boolean);
    tokens.forEach((token) => {
      if (haystack.includes(token)) {
        score += 1;
      }
      if (haystack.startsWith(token)) {
        score += 1;
      }
    });
    return score;
  };

  const handleSearchSubmit = useCallback(async () => {
    const term = searchTerm.trim();
    if (!term) {
      setActiveCategory("None");
      setSearchProjects([]);
      setSearchPosts([]);
      setSearchPeople([]);
      return;
    }

    setActiveCategory("Search results");
    setIsSearching(true);

    const scoredUsers = people
      .map((person) => ({
        person,
        score: scoreMatch(`${person.name} ${person.focus}`, term),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.person);

    const scoredProjects = projects
      .map((project) => ({
        project,
        score: scoreMatch(
          `${project.name} ${project.summary} ${project.tags.join(" ")}`,
          term,
        ),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.project);

    const scoredPosts = posts
      .map((post) => ({
        post,
        score: scoreMatch(
          `${post.content} ${post.projectName} ${post.tags.join(" ")}`,
          term,
        ),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.post);

    try {
      const [userProjectsList, userPostsList] = await Promise.all([
        Promise.all(
          scoredUsers.map((person) =>
            getProjectsByUserId(person.id).catch(() => []),
          ),
        ),
        Promise.all(
          scoredUsers.map((person) =>
            getPostsByUserId(person.id).catch(() => []),
          ),
        ),
      ]);

      const extraProjects = userProjectsList.flat();
      const userPosts = userPostsList.flat();
      const extraPostsUi = await Promise.all(
        userPosts.map(async (post) => {
          const [postUser, postProject] = await Promise.all([
            getUserById(post.user).catch(() => null),
            getProjectById(post.project).catch(() => null),
          ]);
          return mapPostToUi(post, postUser, postProject);
        }),
      );

      const extraBuilderCounts = await Promise.all(
        extraProjects.map((project) =>
          getProjectBuilders(project.id).catch(() => []),
        ),
      );
      const extraProjectsUi = extraProjects.map((project, index) =>
        mapProjectToUi(project, extraBuilderCounts[index]?.length ?? 0),
      );
      const mergedProjects = [...scoredProjects, ...extraProjectsUi];
      const uniqueProjects = Array.from(
        new Map(
          mergedProjects.map((project) => [project.id, project]),
        ).values(),
      );

      const mergedPosts = [...scoredPosts, ...extraPostsUi];
      const uniquePosts = Array.from(
        new Map(mergedPosts.map((post) => [post.id, post])).values(),
      );

      setSearchPeople(scoredUsers);
      setSearchProjects(uniqueProjects);
      setSearchPosts(uniquePosts);
    } finally {
      setIsSearching(false);
    }
  }, [people, posts, projects, searchTerm]);

  const handleTagSearch = (tag: string) => {
    setSearchTerm(tag);
    setActiveCategory("All");
  };

  const handleFollowToggle = async (target: UiPerson) => {
    if (!user?.username) {
      return;
    }
    const isFollowing = following.has(target.id);
    try {
      if (isFollowing) {
        await unfollowUser(user.username, target.name);
      } else {
        await followUser(user.username, target.name);
      }
      setFollowing((prev) => {
        const next = new Set(prev);
        if (isFollowing) {
          next.delete(target.id);
        } else {
          next.add(target.id);
        }
        return next;
      });
    } catch {
      // keep current state on failure
    }
  };

  const activeKey = activeCategory.toLowerCase();
  const showSearchResults = activeKey === "search results";
  const showStreams = activeKey === "streams" || activeKey === "all";
  const showBytes = activeKey === "bytes" || activeKey === "all";
  const showUsers = activeKey === "users" || activeKey === "all";
  const showTags = activeKey === "tags" || activeKey === "all";
  const isRetro = preferences.visualizationMode === "retro";

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.background} pointerEvents="none" />
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <Animated.ScrollView
            ref={scrollRef}
            contentInsetAdjustmentBehavior="never"
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
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
              <ThemedText type="display" style={styles.title}>
                Explore
              </ThemedText>
              <ThemedText type="default" style={{ color: colors.muted }}>
                Find streams, bytes, and builders.
              </ThemedText>
            </Animated.View>

            <View
              style={[
                styles.searchBar,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  borderRadius: isRetro ? 4 : 12,
                },
              ]}
            >
              <Feather name="search" color={colors.muted} size={18} />
              <TextInput
                placeholder="Search streams, tags, or people"
                placeholderTextColor={colors.muted}
                value={searchTerm}
                onChangeText={setSearchTerm}
                onSubmitEditing={() => void handleSearchSubmit()}
                returnKeyType="search"
                style={[styles.searchInput, { color: colors.text }]}
              />
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.edgeToEdgeRail}
            >
              <View style={styles.categoryRow}>
                {categories.map((category) => {
                  const isActive = category === activeCategory;
                  return (
                    <Pressable
                      key={category}
                      onPress={() => setActiveCategory(category)}
                      style={[
                        styles.categoryChip,
                        {
                          backgroundColor: isActive
                            ? colors.tint
                            : colors.surfaceAlt,
                          borderColor: colors.border,
                          borderRadius: isRetro ? 3 : 10,
                        },
                      ]}
                    >
                      <ThemedText
                        type="caption"
                        style={{
                          color: isActive ? colors.onTint : colors.muted,
                        }}
                      >
                        {category}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            {showSearchResults ? (
              <View>
                <SectionHeader title="Search results" />
                {isSearching ? (
                  <View style={styles.loadingState}>
                    <ActivityIndicator size="small" color={colors.muted} />
                    <ThemedText type="caption" style={{ color: colors.muted }}>
                      Searching...
                    </ThemedText>
                  </View>
                ) : (
                  <View style={styles.searchStack}>
                    <View>
                      <SectionHeader title="Users" />
                      <View style={styles.peopleGrid}>
                        {searchPeople.length ? (
                          searchPeople.map((person) => {
                            const isFollowing = following.has(person.id);
                            return (
                              <Pressable
                                key={person.id}
                                style={[
                                  styles.personCard,
                                  {
                                    backgroundColor: colors.surface,
                                    borderColor: colors.border,
                                    borderRadius: isRetro ? 4 : 14,
                                  },
                                ]}
                                onPress={() =>
                                  router.push({
                                    pathname: "/user/[username]",
                                    params: { username: person.name },
                                  })
                                }
                              >
                                <View style={styles.personHeader}>
                                  <View
                                    style={[
                                      styles.personAvatar,
                                      { backgroundColor: colors.surfaceAlt },
                                    ]}
                                  >
                                    {person.picture ? (
                                      <FadeInImage
                                        source={{ uri: person.picture }}
                                        style={styles.personAvatarImage}
                                      />
                                    ) : (
                                      <ThemedText type="caption">
                                        {person.name[0]}
                                      </ThemedText>
                                    )}
                                  </View>
                                  <View style={styles.personText}>
                                    <ThemedText type="defaultSemiBold">
                                      {person.name}
                                    </ThemedText>
                                  </View>
                                </View>
                                <Pressable
                                  onPress={() => handleFollowToggle(person)}
                                  style={[
                                    styles.followButton,
                                    { backgroundColor: colors.tint },
                                  ]}
                                >
                                  <ThemedText
                                    type="caption"
                                    style={{ color: colors.onTint }}
                                  >
                                    {isFollowing ? "Following" : "Follow"}
                                  </ThemedText>
                                </Pressable>
                              </Pressable>
                            );
                          })
                        ) : (
                          <View style={styles.emptyState}>
                            <ThemedText
                              type="caption"
                              style={{ color: colors.muted }}
                            >
                              No users found.
                            </ThemedText>
                          </View>
                        )}
                      </View>
                    </View>
                    <View>
                      <SectionHeader title="Streams" />
                      {searchProjects.length ? (
                        <View style={styles.edgeToEdgeRail}>
                          <InfiniteHorizontalCycle
                            data={searchProjects}
                            itemWidth={260}
                            keyExtractor={(project) => String(project.id)}
                            renderItem={(project) => (
                              <ProjectCard project={project} />
                            )}
                          />
                        </View>
                      ) : (
                        <View style={styles.emptyState}>
                          <ThemedText
                            type="caption"
                            style={{ color: colors.muted }}
                          >
                            No streams found.
                          </ThemedText>
                        </View>
                      )}
                    </View>
                    <View>
                      <SectionHeader title="Bytes" />
                      {searchPosts.length ? (
                        searchPosts.map((post) => (
                          <Post key={post.id} {...post} />
                        ))
                      ) : (
                        <View style={styles.emptyState}>
                          <ThemedText
                            type="caption"
                            style={{ color: colors.muted }}
                          >
                            No bytes found.
                          </ThemedText>
                        </View>
                      )}
                    </View>
                  </View>
                )}
              </View>
            ) : null}

            {showStreams ? (
              <View>
                <SectionHeader
                  title="Spotlight"
                  actionLabel="See all"
                  actionOnPress={() => router.push("/streams")}
                />
                {isLoading ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.edgeToEdgeRail}
                  >
                    <View style={styles.projectRow}>
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
                  </ScrollView>
                ) : filteredProjects.length ? (
                  <View style={styles.edgeToEdgeRail}>
                    <InfiniteHorizontalCycle
                      data={filteredProjects}
                      itemWidth={260}
                      keyExtractor={(project) => String(project.id)}
                      renderItem={(project) => (
                        <ProjectCard project={project} />
                      )}
                    />
                  </View>
                ) : (
                  <View style={styles.emptyState}>
                    <ThemedText type="caption" style={{ color: colors.muted }}>
                      {hasError
                        ? "Spotlight unavailable. Check the API and try again."
                        : "No streams yet."}
                    </ThemedText>
                  </View>
                )}
              </View>
            ) : null}

            {showBytes ? (
              <View>
                <SectionHeader
                  title="Latest bytes"
                  actionLabel="Browse"
                  actionOnPress={() => router.push("/bytes")}
                />
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
                ) : filteredPosts.length ? (
                  filteredPosts.map((post) => <Post key={post.id} {...post} />)
                ) : (
                  <View style={styles.emptyState}>
                    <ThemedText type="caption" style={{ color: colors.muted }}>
                      {hasError ? "Bytes unavailable." : "No bytes yet."}
                    </ThemedText>
                  </View>
                )}
              </View>
            ) : null}

            {showUsers ? (
              <View>
                <SectionHeader title="People to follow" />
                <View style={styles.peopleGrid}>
                  {filteredPeople.length ? (
                    filteredPeople.map((person) => {
                      const isFollowing = following.has(person.id);
                      return (
                        <Pressable
                          key={person.id}
                          style={[
                            styles.personCard,
                            {
                              backgroundColor: colors.surface,
                              borderColor: colors.border,
                              borderRadius: isRetro ? 4 : 14,
                            },
                          ]}
                          onPress={() =>
                            router.push({
                              pathname: "/user/[username]",
                              params: { username: person.name },
                            })
                          }
                        >
                          <View style={styles.personHeader}>
                            <View
                              style={[
                                styles.personAvatar,
                                { backgroundColor: colors.surfaceAlt },
                              ]}
                            >
                              {person.picture ? (
                                <FadeInImage
                                  source={{ uri: person.picture }}
                                  style={styles.personAvatarImage}
                                />
                              ) : (
                                <ThemedText type="caption">
                                  {person.name[0]}
                                </ThemedText>
                              )}
                            </View>
                            <View style={styles.personText}>
                              <ThemedText type="defaultSemiBold">
                                {person.name}
                              </ThemedText>
                              {person.title ? (
                                <ThemedText
                                  type="caption"
                                  style={{ color: colors.muted }}
                                >
                                  {person.title}
                                </ThemedText>
                              ) : null}
                            </View>
                          </View>
                          <Pressable
                            onPress={() => handleFollowToggle(person)}
                            style={[
                              styles.followButton,
                              { backgroundColor: colors.tint },
                            ]}
                          >
                            <ThemedText
                              type="caption"
                              style={{ color: colors.onTint }}
                            >
                              {isFollowing ? "Following" : "Follow"}
                            </ThemedText>
                          </Pressable>
                        </Pressable>
                      );
                    })
                  ) : (
                    <View style={styles.emptyState}>
                      <ThemedText
                        type="caption"
                        style={{ color: colors.muted }}
                      >
                        {hasError
                          ? "People feed unavailable."
                          : "No builders yet."}
                      </ThemedText>
                    </View>
                  )}
                </View>
              </View>
            ) : null}

            {showTags ? (
              <View>
                <SectionHeader title="Trending tags" />
                <ThemedText type="caption" style={{ color: colors.muted }}>
                  Tap a tag to search.
                </ThemedText>
                {isLoading ? (
                  <View style={styles.tagGrid}>
                    {[0, 1, 2, 3].map((key) => (
                      <View
                        key={key}
                        style={[
                          styles.skeletonChip,
                          {
                            backgroundColor: colors.surfaceAlt,
                            borderColor: colors.border,
                            borderWidth: 1,
                          },
                        ]}
                      />
                    ))}
                  </View>
                ) : tags.length ? (
                  <View style={styles.tagGrid}>
                    {tags.map((tag) => (
                      <Pressable key={tag} onPress={() => handleTagSearch(tag)}>
                        <TagChip label={tag} />
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <View style={styles.emptyState}>
                    <ThemedText type="caption" style={{ color: colors.muted }}>
                      No tags yet.
                    </ThemedText>
                  </View>
                )}
              </View>
            ) : null}
          </Animated.ScrollView>
        </TouchableWithoutFeedback>
      </SafeAreaView>
      <TopBlur scrollY={scrollY} />
      <FloatingScrollTopButton
        scrollY={scrollY}
        onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
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
    gap: 20,
    paddingTop: 0,
  },
  edgeToEdgeRail: {
    marginHorizontal: -16,
  },
  title: {
    fontSize: 26,
    lineHeight: 30,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: "SpaceMono",
  },
  categoryRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 2,
    paddingHorizontal: 16,
  },
  categoryChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  projectRow: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 4,
    paddingHorizontal: 16,
  },
  skeletonStack: {
    gap: 12,
  },
  skeletonCard: {
    width: 220,
    height: 110,
    borderRadius: 14,
    borderWidth: 1,
    opacity: 0.7,
  },
  skeletonChip: {
    height: 22,
    width: 70,
    borderRadius: 8,
    opacity: 0.7,
  },
  tagGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  peopleGrid: {
    gap: 12,
  },
  searchStack: {
    gap: 20,
  },
  loadingState: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 20,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 16,
  },
  personCard: {
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    gap: 10,
  },
  personHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  personAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  personAvatarImage: {
    width: "100%",
    height: "100%",
  },
  personText: {
    flex: 1,
  },
  followButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
});
