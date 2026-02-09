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
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import { ApiProject } from "@/constants/Types";
import {
  clearApiCache,
  followProject,
  getPostsByProjectId,
  getProjectBuilders,
  getProjectById,
  getProjectFollowing,
  getUserById,
  unfollowProject,
} from "@/services/api";
import { mapPostToUi } from "@/services/mappers";
import { Post } from "@/components/Post";
import { TagChip } from "@/components/TagChip";
import { ThemedText } from "@/components/ThemedText";
import { MarkdownText } from "@/components/MarkdownText";
import { MediaGallery } from "@/components/MediaGallery";
import { TopBlur } from "@/components/TopBlur";
import { useBottomTabOverflow } from "@/components/ui/TabBarBackground";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { useAppColors } from "@/hooks/useAppColors";
import { useMotionConfig } from "@/hooks/useMotionConfig";
import { useAuth } from "@/contexts/AuthContext";

const ensureUrlScheme = (url: string) =>
  /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`;

export default function StreamDetailScreen() {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();
  const [project, setProject] = useState<ApiProject | null>(null);
  const [posts, setPosts] = useState([] as ReturnType<typeof mapPostToUi>[]);
  const [builders, setBuilders] = useState<string[]>([]);
  const [creatorName, setCreatorName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const bottom = useBottomTabOverflow();
  const motion = useMotionConfig();
  const reveal = useRef(new Animated.Value(0)).current;

  const projectIdNumber = useMemo(() => Number(projectId), [projectId]);

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
        const [projectData, projectPosts, builderList] = await Promise.all([
          getProjectById(projectIdNumber),
          getPostsByProjectId(projectIdNumber),
          getProjectBuilders(projectIdNumber).catch(() => []),
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
    [projectIdNumber],
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
    let isMounted = true;
    const loadSaved = async () => {
      if (!user?.username || !projectIdNumber) {
        return;
      }
      try {
        const savedIds = await getProjectFollowing(user.username);
        if (isMounted) {
          setIsSaved(savedIds.includes(projectIdNumber));
        }
      } catch {
        if (isMounted) {
          setIsSaved(false);
        }
      }
    };
    loadSaved();
    return () => {
      isMounted = false;
    };
  }, [projectIdNumber, user?.username]);

  const handleToggleSave = async () => {
    if (!user?.username || !projectIdNumber || isSaving) {
      return;
    }
    setIsSaving(true);
    try {
      if (isSaved) {
        await unfollowProject(user.username, projectIdNumber);
        setIsSaved(false);
      } else {
        await followProject(user.username, projectIdNumber);
        setIsSaved(true);
      }
    } catch {
      // Ignore conflicts when state is already in sync.
    } finally {
      setIsSaving(false);
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
          scrollIndicatorInsets={{ bottom: bottom + insets.bottom }}
          contentContainerStyle={[
            styles.container,
            {
              paddingTop: insets.top + 8,
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
                <View style={styles.titleRow}>
                  <View>
                    <ThemedText type="display" style={styles.title}>
                      {project.name}
                    </ThemedText>
                    {createdLabel || creatorName ? (
                      <ThemedText
                        type="caption"
                        style={{ color: colors.muted }}
                      >
                        {createdLabel ? `Created ${createdLabel}` : "Created"}
                        {creatorName ? ` · Creator ${creatorName}` : ""}
                      </ThemedText>
                    ) : null}
                  </View>
                  <View style={styles.titleActions}>
                    <TagChip label={stageLabel} tone="accent" />
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
                      <ThemedText
                        type="caption"
                        style={{ color: isSaved ? colors.tint : colors.muted }}
                      >
                        {isSaved ? "Saved" : "Save"}
                      </ThemedText>
                    </Pressable>
                  </View>
                </View>

                <ThemedText type="caption" style={{ color: colors.muted }}>
                  {project.description}
                </ThemedText>

                {project.about_md ? (
                  <MarkdownText>{project.about_md}</MarkdownText>
                ) : null}

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
  container: {
    padding: 16,
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
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  titleActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  saveButton: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderColor: "transparent",
  },
  saveButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  title: {
    fontSize: 24,
    lineHeight: 28,
  },
  linkList: {
    gap: 6,
  },
  builderRow: {
    paddingTop: 4,
  },
});
