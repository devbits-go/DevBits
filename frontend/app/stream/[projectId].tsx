import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { ApiProject } from "@/constants/Types";
import {
  clearApiCache,
  getPostsByProjectId,
  isProjectLiked,
  likeProject,
  getProjectBuilders,
  getProjectById,
  getUserById,
  removeProjectBuilder,
  unlikeProject,
} from "@/services/api";
import { mapPostToUi } from "@/services/mappers";
import { Post } from "@/components/Post";
import { TagChip } from "@/components/TagChip";
import { ThemedText } from "@/components/ThemedText";
import { MarkdownText } from "@/components/MarkdownText";
import { FloatingScrollTopButton } from "@/components/FloatingScrollTopButton";
import { MediaGallery } from "@/components/MediaGallery";
import { TopBlur } from "@/components/TopBlur";
import {
  UnifiedLoadingInline,
  UnifiedLoadingList,
} from "@/components/UnifiedLoading";
import { useBottomTabOverflow } from "@/components/ui/TabBarBackground";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { useAppColors } from "@/hooks/useAppColors";
import { useMotionConfig } from "@/hooks/useMotionConfig";
import { useTopBlurScroll } from "@/hooks/useTopBlurScroll";
import { useAuth } from "@/contexts/AuthContext";
import { useSavedStreams } from "@/contexts/SavedStreamsContext";
import { emitProjectStats } from "@/services/projectEvents";

const ensureUrlScheme = (url: string) =>
  /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`;

const toOneLine = (value: string) => value.replace(/\s+/g, " ").trim();

const StreamTitleMarkdown = React.memo(function StreamTitleMarkdown({
  title,
}: {
  title: string;
}) {
  return <MarkdownText>{toOneLine(title)}</MarkdownText>;
});

const StreamBodyMarkdown = React.memo(function StreamBodyMarkdown({
  description,
  aboutMd,
}: {
  description: string;
  aboutMd?: string;
}) {
  return (
    <>
      <MarkdownText>{description}</MarkdownText>
      {aboutMd ? <MarkdownText>{aboutMd}</MarkdownText> : null}
    </>
  );
});

export default function StreamDetailScreen() {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { savedProjectIds, toggleSave } = useSavedStreams();
  const { projectId } = useLocalSearchParams<{
    projectId?: string | string[];
  }>();
  const [project, setProject] = useState<ApiProject | null>(null);
  const [posts, setPosts] = useState([] as ReturnType<typeof mapPostToUi>[]);
  const [builders, setBuilders] = useState<string[]>([]);
  const [creatorName, setCreatorName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPostsLoading, setIsPostsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [saveCount, setSaveCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [isLiking, setIsLiking] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const bottom = useBottomTabOverflow();
  const motion = useMotionConfig();
  const reveal = useRef(new Animated.Value(0.08)).current;
  const scrollRef = useRef<Animated.ScrollView>(null);
  const { scrollY, onScroll } = useTopBlurScroll();
  const hasLoadedOnceRef = useRef(false);
  const loadSequenceRef = useRef(0);
  const revealPostsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const appendPostsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [visiblePostCount, setVisiblePostCount] = useState(0);

  const normalizedProjectId = useMemo(
    () => (Array.isArray(projectId) ? projectId[0] : projectId),
    [projectId],
  );
  const projectIdNumber = useMemo(() => {
    const parsed = Number.parseInt(String(normalizedProjectId ?? ""), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }
    return parsed;
  }, [normalizedProjectId]);
  const isCreator = useMemo(
    () => (project && user?.id ? project.owner === user.id : false),
    [project, user?.id],
  );
  const isBuilder = useMemo(
    () =>
      !isCreator && user?.username ? builders.includes(user.username) : false,
    [builders, isCreator, user?.username],
  );

  const visiblePosts = useMemo(
    () => posts.slice(0, visiblePostCount),
    [posts, visiblePostCount],
  );

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

  const loadStream = useCallback(
    async (showLoader = true) => {
      if (projectIdNumber == null) {
        setProject(null);
        setPosts([]);
        setVisiblePostCount(0);
        setBuilders([]);
        setCreatorName(null);
        setIsPostsLoading(false);
        setHasError(true);
        if (showLoader) {
          setIsLoading(false);
        }
        return;
      }
      const loadSequence = ++loadSequenceRef.current;
      if (appendPostsTimerRef.current) {
        clearTimeout(appendPostsTimerRef.current);
        appendPostsTimerRef.current = null;
      }
      try {
        if (showLoader) {
          setIsLoading(true);
        }
        const projectPromise = getProjectById(projectIdNumber);
        const postsPromise = getPostsByProjectId(projectIdNumber);
        const projectData = await projectPromise;
        if (loadSequence !== loadSequenceRef.current) {
          return;
        }

        const [builderList, likeStatus, ownerUser] = await Promise.all([
          getProjectBuilders(projectIdNumber).catch(() => []),
          user?.username
            ? isProjectLiked(user.username, projectIdNumber).catch(() => ({
                status: false,
              }))
            : Promise.resolve({ status: false }),
          getUserById(projectData.owner).catch(() => null),
        ]);
        if (loadSequence !== loadSequenceRef.current) {
          return;
        }

        setProject(projectData);
        setBuilders(Array.isArray(builderList) ? builderList : []);
        setCreatorName(ownerUser?.username ?? `user-${projectData.owner}`);
        setIsLiked(likeStatus.status);
        setHasError(false);
        hasLoadedOnceRef.current = true;
        if (showLoader) {
          setIsPostsLoading(true);
          setPosts([]);
          setVisiblePostCount(0);
        }
        if (showLoader) {
          setIsLoading(false);
        }

        const projectPosts = await postsPromise;
        if (loadSequence !== loadSequenceRef.current) {
          return;
        }
        const safePosts = Array.isArray(projectPosts) ? projectPosts : [];
        const userCache = new Map<
          number,
          Awaited<ReturnType<typeof getUserById>> | null
        >();

        const mapBatch = async (batch: typeof safePosts) =>
          Promise.all(
            batch.map(async (post) => {
              let postUser = userCache.get(post.user);
              if (typeof postUser === "undefined") {
                postUser = await getUserById(post.user).catch(() => null);
                userCache.set(post.user, postUser);
              }
              return mapPostToUi(post, postUser, projectData);
            }),
          );

        const firstBatchSize = 10;
        const appendBatchSize = 14;
        const firstMapped = await mapBatch(safePosts.slice(0, firstBatchSize));
        if (loadSequence !== loadSequenceRef.current) {
          return;
        }

        setPosts(firstMapped);

        let nextStart = firstBatchSize;
        const appendNextBatch = async () => {
          if (loadSequence !== loadSequenceRef.current) {
            return;
          }
          if (nextStart >= safePosts.length) {
            setIsPostsLoading(false);
            return;
          }

          const nextEnd = Math.min(
            safePosts.length,
            nextStart + appendBatchSize,
          );
          const mapped = await mapBatch(safePosts.slice(nextStart, nextEnd));
          if (loadSequence !== loadSequenceRef.current) {
            return;
          }
          setPosts((prev) => prev.concat(mapped));
          nextStart = nextEnd;

          if (nextStart < safePosts.length) {
            appendPostsTimerRef.current = setTimeout(() => {
              void appendNextBatch();
            }, 0);
          } else {
            setIsPostsLoading(false);
          }
        };

        if (safePosts.length > firstBatchSize) {
          appendPostsTimerRef.current = setTimeout(() => {
            void appendNextBatch();
          }, 0);
        } else {
          setIsPostsLoading(false);
        }
      } catch {
        if (loadSequence !== loadSequenceRef.current) {
          return;
        }
        if (showLoader) {
          setProject(null);
          setPosts([]);
          setVisiblePostCount(0);
          setBuilders([]);
          setCreatorName(null);
        }
        setIsPostsLoading(false);
        setHasError(true);
      } finally {
        if (showLoader && loadSequence === loadSequenceRef.current) {
          setIsLoading(false);
        }
      }
    },
    [projectIdNumber, user?.username],
  );

  useEffect(() => {
    if (revealPostsTimerRef.current) {
      clearTimeout(revealPostsTimerRef.current);
      revealPostsTimerRef.current = null;
    }

    const initialCount = Math.min(posts.length, 8);
    setVisiblePostCount(initialCount);

    if (initialCount >= posts.length) {
      return;
    }

    const step = 8;
    const revealNext = () => {
      setVisiblePostCount((prev) => {
        const next = Math.min(posts.length, prev + step);
        if (next < posts.length) {
          revealPostsTimerRef.current = setTimeout(revealNext, 24);
        }
        return next;
      });
    };

    revealPostsTimerRef.current = setTimeout(revealNext, 24);

    return () => {
      if (revealPostsTimerRef.current) {
        clearTimeout(revealPostsTimerRef.current);
        revealPostsTimerRef.current = null;
      }
    };
  }, [posts.length]);

  useEffect(() => {
    return () => {
      loadSequenceRef.current += 1;
      if (appendPostsTimerRef.current) {
        clearTimeout(appendPostsTimerRef.current);
        appendPostsTimerRef.current = null;
      }
      if (revealPostsTimerRef.current) {
        clearTimeout(revealPostsTimerRef.current);
        revealPostsTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    loadStream();
  }, [loadStream]);

  useFocusEffect(
    useCallback(() => {
      if (!hasLoadedOnceRef.current) {
        return;
      }
      clearApiCache();
      loadStream(false);
    }, [loadStream]),
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    clearApiCache();
    await loadStream(false);
    setIsRefreshing(false);
  }, [loadStream]);

  useAutoRefresh(() => loadStream(false), { focusRefresh: false });

  useEffect(() => {
    if (projectIdNumber == null) {
      return;
    }
    setIsSaved(savedProjectIds.includes(projectIdNumber));
  }, [projectIdNumber, savedProjectIds]);

  useEffect(() => {
    setSaveCount(project?.saves ?? 0);
  }, [project?.saves]);

  useEffect(() => {
    setLikeCount(project?.likes ?? 0);
  }, [project?.likes]);

  const handleToggleSave = async () => {
    if (!user?.username || projectIdNumber == null || isSaving) {
      return;
    }
    setIsSaving(true);
    try {
      const nextSaved = !isSaved;
      const nextCount = Math.max(0, saveCount + (nextSaved ? 1 : -1));
      await toggleSave(projectIdNumber);
      setIsSaved(nextSaved);
      setSaveCount(nextCount);
      emitProjectStats(projectIdNumber, { saves: nextCount });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleLike = async () => {
    if (!user?.username || projectIdNumber == null || isLiking) {
      return;
    }
    setIsLiking(true);
    const nextLiked = !isLiked;
    const nextCount = Math.max(0, likeCount + (nextLiked ? 1 : -1));
    setIsLiked(nextLiked);
    setLikeCount(nextCount);
    emitProjectStats(projectIdNumber, { likes: nextCount, isLiked: nextLiked });
    try {
      if (nextLiked) {
        await likeProject(user.username, projectIdNumber);
      } else {
        await unlikeProject(user.username, projectIdNumber);
      }
    } catch {
      setIsLiked(!nextLiked);
      setLikeCount(likeCount);
      emitProjectStats(projectIdNumber, { likes: likeCount, isLiked });
    } finally {
      setIsLiking(false);
    }
  };

  const handleLeaveBuilder = async () => {
    if (projectIdNumber == null || !user?.username || !isBuilder || isLeaving) {
      return;
    }
    setIsLeaving(true);
    try {
      await removeProjectBuilder(projectIdNumber, user.username);
      setBuilders((prev) =>
        prev.filter((builder) => builder !== user.username),
      );
    } finally {
      setIsLeaving(false);
    }
  };

  const stageLabel = project
    ? project.status === 2
      ? "launch"
      : project.status === 1
        ? "beta"
        : "alpha"
    : "alpha";

  const createdLabel = useMemo(() => {
    if (!project?.creation_date) {
      return "";
    }
    const createdAt = new Date(project.creation_date);
    if (Number.isNaN(createdAt.getTime())) {
      return "";
    }
    return createdAt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, [project?.creation_date]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <Animated.ScrollView
          ref={scrollRef}
          contentInsetAdjustmentBehavior="never"
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
          scrollIndicatorInsets={{ bottom: bottom + insets.bottom }}
          contentContainerStyle={[
            styles.container,
            {
              paddingTop: 8,
              paddingBottom: bottom + insets.bottom + 32,
            },
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
            {isLoading ? (
              <UnifiedLoadingList rows={1} cardHeight={312} />
            ) : project ? (
              <View style={styles.streamCard}>
                <View style={styles.headerBlock}>
                  <StreamTitleMarkdown title={project.name} />
                  {createdLabel || creatorName ? (
                    <View style={styles.metaRow}>
                      {createdLabel ? (
                        <ThemedText
                          type="caption"
                          style={{ color: colors.muted }}
                        >
                          Created {createdLabel}
                        </ThemedText>
                      ) : null}
                      {creatorName ? (
                        <Pressable
                          onPress={() =>
                            router.push({
                              pathname: "/user/[username]",
                              params: { username: creatorName },
                            })
                          }
                        >
                          <ThemedText
                            type="caption"
                            style={{ color: colors.tint }}
                          >
                            Creator {creatorName}
                          </ThemedText>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}
                  <View style={styles.chipRow}>
                    <TagChip label={stageLabel} tone="accent" />
                    {isCreator ? (
                      <TagChip label="Creator" tone="accent" />
                    ) : null}
                    {isBuilder ? (
                      <TagChip label="Builder" tone="accent" />
                    ) : null}
                  </View>
                  <View style={styles.actionRow}>
                    {isBuilder ? (
                      <Pressable
                        onPress={handleLeaveBuilder}
                        style={({ pressed }) => [
                          styles.saveButton,
                          {
                            borderColor: colors.border,
                            backgroundColor: colors.surfaceAlt,
                          },
                          pressed && styles.saveButtonPressed,
                        ]}
                        disabled={isLeaving}
                      >
                        <ThemedText
                          type="caption"
                          style={{ color: colors.muted }}
                        >
                          Leave
                        </ThemedText>
                      </Pressable>
                    ) : null}
                    {isCreator || isBuilder ? (
                      <Pressable
                        onPress={() =>
                          router.push({
                            pathname: "/manage-stream/[projectId]",
                            params: { projectId: String(projectIdNumber) },
                          })
                        }
                        style={({ pressed }) => [
                          styles.saveButton,
                          {
                            borderColor: colors.border,
                            backgroundColor: colors.surfaceAlt,
                          },
                          pressed && styles.saveButtonPressed,
                        ]}
                      >
                        <View style={styles.saveButtonContent}>
                          <Feather
                            name="edit-2"
                            size={14}
                            color={colors.muted}
                          />
                          <ThemedText
                            type="caption"
                            style={{ color: colors.muted }}
                          >
                            Edit
                          </ThemedText>
                        </View>
                      </Pressable>
                    ) : null}
                    <Pressable
                      onPress={handleToggleLike}
                      style={({ pressed }) => [
                        styles.saveButton,
                        {
                          borderColor: colors.border,
                          backgroundColor: colors.surfaceAlt,
                        },
                        pressed && styles.saveButtonPressed,
                      ]}
                      disabled={isLiking}
                    >
                      <View style={styles.saveButtonContent}>
                        <Feather
                          name="heart"
                          size={14}
                          color={isLiked ? colors.tint : colors.muted}
                        />
                        <ThemedText
                          type="caption"
                          style={{
                            color: isLiked ? colors.tint : colors.muted,
                          }}
                        >
                          {likeCount}
                        </ThemedText>
                      </View>
                    </Pressable>
                    <Pressable
                      onPress={handleToggleSave}
                      style={({ pressed }) => [
                        styles.saveButton,
                        {
                          borderColor: colors.border,
                          backgroundColor: colors.surfaceAlt,
                        },
                        pressed && styles.saveButtonPressed,
                      ]}
                      disabled={isSaving}
                    >
                      <View style={styles.saveButtonContent}>
                        <Feather
                          name="bookmark"
                          size={14}
                          color={isSaved ? colors.tint : colors.muted}
                        />
                        <ThemedText
                          type="caption"
                          style={{
                            color: isSaved ? colors.tint : colors.muted,
                          }}
                        >
                          {saveCount}
                        </ThemedText>
                      </View>
                    </Pressable>
                  </View>
                </View>

                <StreamBodyMarkdown
                  description={project.description ?? ""}
                  aboutMd={project.about_md}
                />

                <MediaGallery media={project.media} />

                {project.links?.length ? (
                  <View style={styles.linkList}>
                    {project.links.map((link) => (
                      <Pressable
                        key={link}
                        onPress={() => Linking.openURL(ensureUrlScheme(link))}
                      >
                        <ThemedText
                          type="caption"
                          style={{ color: colors.tint }}
                        >
                          {link}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </View>
                ) : null}

                {builders.length ? (
                  <View style={styles.builderRow}>
                    <ThemedText type="caption" style={{ color: colors.muted }}>
                      Builders: {builders.join(", ")}
                    </ThemedText>
                  </View>
                ) : null}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <ThemedText type="caption" style={{ color: colors.muted }}>
                  {hasError ? "Unable to load stream." : "Stream not found."}
                </ThemedText>
              </View>
            )}
          </Animated.View>

          {visiblePosts.length ? (
            visiblePosts.map((post) => <Post key={post.id} {...post} />)
          ) : isPostsLoading ? (
            <UnifiedLoadingInline label="Loading bytes..." />
          ) : (
            <View style={styles.emptyState}>
              <ThemedText type="caption" style={{ color: colors.muted }}>
                {hasError ? "Unable to load bytes." : "No bytes yet."}
              </ThemedText>
            </View>
          )}
          {isPostsLoading && visiblePosts.length > 0 ? (
            <UnifiedLoadingInline label="Loading more bytes..." />
          ) : null}
        </Animated.ScrollView>
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
  container: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 16,
    paddingTop: 0,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 24,
  },
  streamCard: {
    gap: 12,
  },
  headerBlock: {
    gap: 8,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
  },
  saveButton: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderColor: "transparent",
  },
  saveButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  saveButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  linkList: {
    gap: 6,
  },
  builderRow: {
    paddingTop: 4,
  },
});
