import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
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
import { useRouter } from "expo-router";
import { FloatingScrollTopButton } from "@/components/FloatingScrollTopButton";
import { ThemedText } from "@/components/ThemedText";
import { TopBlur } from "@/components/TopBlur";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { useAppColors } from "@/hooks/useAppColors";
import { useMotionConfig } from "@/hooks/useMotionConfig";
import { useTopBlurScroll } from "@/hooks/useTopBlurScroll";
import { useAuth } from "@/contexts/AuthContext";
import {
  addProjectBuilder,
  clearApiCache,
  deleteProject,
  getProjectBuilders,
  getProjectsByBuilderId,
  removeProjectBuilder,
} from "@/services/api";
import { ApiProject } from "@/constants/Types";
import { TagChip } from "@/components/TagChip";
import { MediaGallery } from "@/components/MediaGallery";
import { MarkdownText } from "@/components/MarkdownText";
import { emitProjectDeleted } from "@/services/projectEvents";

export default function ManageStreamsScreen() {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [builderMap, setBuilderMap] = useState<Record<number, string[]>>({});
  const [builderDrafts, setBuilderDrafts] = useState<Record<number, string>>(
    {},
  );
  const [deletingProjectId, setDeletingProjectId] = useState<number | null>(
    null,
  );
  const [leavingProjectId, setLeavingProjectId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const motion = useMotionConfig();
  const reveal = useRef(new Animated.Value(0.08)).current;
  const scrollRef = useRef<ScrollView | null>(null);
  const { scrollY, onScroll } = useTopBlurScroll();

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

  const loadStreams = useCallback(
    async (showLoader = true) => {
      if (!user?.id) {
        if (showLoader) {
          setIsLoading(false);
        }
        return;
      }
      try {
        if (showLoader) {
          setIsLoading(true);
        }
        const data = await getProjectsByBuilderId(user.id);
        const safeProjects = Array.isArray(data) ? data : [];
        setProjects(safeProjects);

        const builders = await Promise.all(
          safeProjects.map(async (project) => {
            const list = await getProjectBuilders(project.id).catch(() => []);
            return [project.id, list] as const;
          }),
        );
        setBuilderMap(Object.fromEntries(builders));
        setHasError(false);
      } catch {
        setProjects([]);
        setHasError(true);
      } finally {
        if (showLoader) {
          setIsLoading(false);
        }
      }
    },
    [user?.id],
  );

  useEffect(() => {
    loadStreams();
  }, [loadStreams]);

  useFocusEffect(
    useCallback(() => {
      clearApiCache();
      loadStreams(false);
    }, [loadStreams]),
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    clearApiCache();
    await loadStreams(false);
    setIsRefreshing(false);
  }, [loadStreams]);

  useAutoRefresh(() => loadStreams(false), { focusRefresh: false });

  const handleDeleteProject = (projectId: number) => {
    if (deletingProjectId) {
      return;
    }
    Alert.alert(
      "Delete stream?",
      "This deletes the stream and all of its bytes. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setDeletingProjectId(projectId);
              try {
                await deleteProject(projectId);
                emitProjectDeleted(projectId);
                setProjects((prev) =>
                  prev.filter((item) => item.id !== projectId),
                );
              } finally {
                setDeletingProjectId(null);
              }
            })();
          },
        },
      ],
    );
  };

  const handleAddBuilder = async (projectId: number) => {
    const username = builderDrafts[projectId]?.trim();
    if (!username) {
      return;
    }
    await addProjectBuilder(projectId, username);
    const list = await getProjectBuilders(projectId).catch(() => []);
    setBuilderMap((prev) => ({ ...prev, [projectId]: list }));
    setBuilderDrafts((prev) => ({ ...prev, [projectId]: "" }));
  };

  const handleRemoveBuilder = async (projectId: number, username: string) => {
    await removeProjectBuilder(projectId, username);
    const list = await getProjectBuilders(projectId).catch(() => []);
    setBuilderMap((prev) => ({ ...prev, [projectId]: list }));
  };

  const handleLeaveProject = (projectId: number) => {
    if (!user?.username || leavingProjectId) {
      return;
    }
    Alert.alert(
      "Leave stream?",
      "You will be removed as a builder from this stream.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setLeavingProjectId(projectId);
              try {
                await removeProjectBuilder(projectId, user.username);
                setProjects((prev) =>
                  prev.filter((item) => item.id !== projectId),
                );
                setBuilderMap((prev) => {
                  const next = { ...prev };
                  delete next[projectId];
                  return next;
                });
              } finally {
                setLeavingProjectId(null);
              }
            })();
          },
        },
      ],
    );
  };

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
                    outputRange: [16, 0],
                  }),
                },
              ],
            }}
          >
            <ThemedText type="display" style={styles.title}>
              Manage streams
            </ThemedText>
            <ThemedText type="caption" style={{ color: colors.muted }}>
              Your active projects and stream logs.
            </ThemedText>
          </Animated.View>

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
            <View style={styles.list}>
              {projects.map((project) => {
                const builders = builderMap[project.id] ?? [];
                const isOwner = project.owner === user?.id;
                const stageLabel =
                  project.status === 2
                    ? "launch"
                    : project.status === 1
                      ? "beta"
                      : "alpha";

                return (
                  <View
                    key={project.id}
                    style={[
                      styles.card,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <View style={styles.cardHeader}>
                      <View>
                        <MarkdownText compact preferStatic>
                          {project.name.replace(/\s+/g, " ").trim()}
                        </MarkdownText>
                        <ThemedText
                          type="caption"
                          style={{ color: colors.muted }}
                        >
                          {stageLabel.toUpperCase()} · Owner #{project.owner}
                        </ThemedText>
                      </View>
                      <TagChip label={stageLabel} tone="accent" />
                    </View>

                    <View style={styles.previewBlock}>
                      <MarkdownText compact preferStatic>
                        {(project.description ?? "")
                          .replace(/\s+/g, " ")
                          .trim()}
                      </MarkdownText>
                      {project.about_md ? (
                        <MarkdownText preferStatic>
                          {project.about_md}
                        </MarkdownText>
                      ) : null}
                      <MediaGallery media={project.media} />
                    </View>

                    <View style={styles.builderBlock}>
                      <ThemedText
                        type="caption"
                        style={{ color: colors.muted }}
                      >
                        Builders:{" "}
                        {builders.length ? builders.join(", ") : "none"}
                      </ThemedText>
                      {isOwner ? (
                        <View style={styles.builderRow}>
                          <TextInput
                            value={builderDrafts[project.id] ?? ""}
                            onChangeText={(value) =>
                              setBuilderDrafts((prev) => ({
                                ...prev,
                                [project.id]: value,
                              }))
                            }
                            placeholder="Add builder by username"
                            placeholderTextColor={colors.muted}
                            style={[
                              styles.input,
                              styles.builderInput,
                              {
                                color: colors.text,
                                borderColor: colors.border,
                                backgroundColor: colors.surfaceAlt,
                              },
                            ]}
                          />
                          <Pressable
                            onPress={() => handleAddBuilder(project.id)}
                            style={[
                              styles.builderButton,
                              { borderColor: colors.border },
                            ]}
                          >
                            <ThemedText
                              type="caption"
                              style={{ color: colors.muted }}
                            >
                              Add
                            </ThemedText>
                          </Pressable>
                        </View>
                      ) : null}

                      {isOwner && builders.length ? (
                        <View style={styles.builderTags}>
                          {builders.map((builder) => (
                            <Pressable
                              key={builder}
                              onPress={() =>
                                handleRemoveBuilder(project.id, builder)
                              }
                              style={[
                                styles.builderChip,
                                { borderColor: colors.border },
                              ]}
                            >
                              <ThemedText
                                type="caption"
                                style={{ color: colors.muted }}
                              >
                                {builder} ×
                              </ThemedText>
                            </Pressable>
                          ))}
                        </View>
                      ) : null}
                    </View>

                    <View style={styles.actionRow}>
                      <Pressable
                        onPress={() =>
                          router.push({
                            pathname: "/manage-stream/[projectId]",
                            params: { projectId: String(project.id) },
                          })
                        }
                        style={[
                          styles.actionButton,
                          { borderColor: colors.border },
                        ]}
                      >
                        <ThemedText
                          type="caption"
                          style={{ color: colors.muted }}
                        >
                          Edit
                        </ThemedText>
                      </Pressable>
                      {isOwner ? (
                        <Pressable
                          onPress={() => handleDeleteProject(project.id)}
                          style={[
                            styles.actionButton,
                            { borderColor: colors.border },
                          ]}
                          disabled={deletingProjectId === project.id}
                        >
                          <ThemedText
                            type="caption"
                            style={{ color: colors.muted }}
                          >
                            Delete
                          </ThemedText>
                        </Pressable>
                      ) : (
                        <Pressable
                          onPress={() => handleLeaveProject(project.id)}
                          style={[
                            styles.actionButton,
                            { borderColor: colors.border },
                          ]}
                          disabled={leavingProjectId === project.id}
                        >
                          <ThemedText
                            type="caption"
                            style={{ color: colors.muted }}
                          >
                            Leave
                          </ThemedText>
                        </Pressable>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <ThemedText type="caption" style={{ color: colors.muted }}>
                {hasError ? "Streams unavailable." : "No streams yet."}
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
  title: {
    fontSize: 26,
    lineHeight: 30,
  },
  list: {
    gap: 12,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  previewBlock: {
    gap: 8,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: "SpaceMono",
    fontSize: 14,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  actionButton: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  builderBlock: {
    gap: 10,
  },
  builderRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  builderInput: {
    flex: 1,
  },
  builderButton: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  builderTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  builderChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  skeletonStack: {
    gap: 12,
  },
  skeletonCard: {
    borderRadius: 14,
    height: 110,
    borderWidth: 1,
    opacity: 0.7,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 24,
  },
});
