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
  Pressable,
  RefreshControl,
  ScrollView,
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
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();
  const [project, setProject] = useState<ApiProject | null>(null);
  const [posts, setPosts] = useState([] as ReturnType<typeof mapPostToUi>[]);
  const [builders, setBuilders] = useState<string[]>([]);
  const [creatorName, setCreatorName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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
  const prevSavedRef = useRef(false);
  const hasInitializedSaveRef = useRef(false);

  const projectIdNumber = useMemo(() => Number(projectId), [projectId]);
  const isCreator = useMemo(
    () => (project && user?.id ? project.owner === user.id : false),
    [project, user?.id],
  );
  const isBuilder = useMemo(
    () =>
      !isCreator && user?.username ? builders.includes(user.username) : false,
    [builders, isCreator, user?.username],
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
      if (!projectIdNumber) {
        return;
      }
      try {
        if (showLoader) {
          setIsLoading(true);
        }
        const [projectData, projectPosts, builderList, likeStatus] =
          await Promise.all([
            getProjectById(projectIdNumber),
            getPostsByProjectId(projectIdNumber),
            getProjectBuilders(projectIdNumber).catch(() => []),
            user?.username
              ? isProjectLiked(user.username, projectIdNumber).catch(() => ({
                  status: false,
                }))
              : Promise.resolve({ status: false }),
          ]);
        const ownerUser = await getUserById(projectData.owner).catch(
          () => null,
        );
        const safePosts = Array.isArray(projectPosts) ? projectPosts : [];
        const uiPosts = await Promise.all(
          safePosts.map(async (post) => {
            const user = await getUserById(post.user).catch(() => null);
            return mapPostToUi(post, user, projectData);
          }),
        );

        setProject(projectData);
        setPosts(uiPosts);
        setBuilders(Array.isArray(builderList) ? builderList : []);
        setCreatorName(ownerUser?.username ?? `user-${projectData.owner}`);
        setIsLiked(likeStatus.status);
        setHasError(false);
      } catch {
        setProject(null);
        setPosts([]);
        setBuilders([]);
        setCreatorName(null);
        setHasError(true);
      } finally {
        if (showLoader) {
          setIsLoading(false);
        }
      }
    },
    [projectIdNumber, user?.username],
  );

  useEffect(() => {
    loadStream();
  }, [loadStream]);

  useFocusEffect(
    useCallback(() => {
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
    if (!projectIdNumber) {
      return;
    }
    setIsSaved(savedProjectIds.includes(projectIdNumber));
  }, [projectIdNumber, savedProjectIds]);

  useEffect(() => {
    if (!project) {
      return;
    }
    setSaveCount(project.saves ?? 0);
  }, [project?.id, project?.saves]);

  useEffect(() => {
    if (!project) {
      return;
    }
    setLikeCount(project.likes ?? 0);
  }, [project?.id, project?.likes]);

  const handleToggleSave = async () => {
    if (!user?.username || !projectIdNumber || isSaving) {
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
    if (!user?.username || !projectIdNumber || isLiking) {
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
    if (!user?.username || !projectIdNumber || !isBuilder || isLeaving) {
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
              <View style={styles.loadingState}>
                <ActivityIndicator size="small" color={colors.muted} />
                <ThemedText type="caption" style={{ color: colors.muted }}>
                  Loading stream...
                </ThemedText>
              </View>
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
                            pathname: "/manage-streams",
                            params: { editId: String(projectIdNumber) },
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

          {posts.length ? (
            posts.map((post) => <Post key={post.id} {...post} />)
          ) : (
            <View style={styles.emptyState}>
              <ThemedText type="caption" style={{ color: colors.muted }}>
                {hasError ? "Unable to load bytes." : "No bytes yet."}
              </ThemedText>
            </View>
          )}
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
  loadingState: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 8,
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
