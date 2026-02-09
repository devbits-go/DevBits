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
import { ThemedText } from "@/components/ThemedText";
import { TopBlur } from "@/components/TopBlur";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { useAppColors } from "@/hooks/useAppColors";
import { useMotionConfig } from "@/hooks/useMotionConfig";
import { useAuth } from "@/contexts/AuthContext";
import {
  addProjectBuilder,
  clearApiCache,
  deleteProject,
  getProjectBuilders,
  getProjectsByBuilderId,
  removeProjectBuilder,
  updateProject,
  uploadMedia,
} from "@/services/api";
import { ApiProject } from "@/constants/Types";
import { TagChip } from "@/components/TagChip";
import { MediaGallery } from "@/components/MediaGallery";
import { MarkdownText } from "@/components/MarkdownText";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";

export default function ManageStreamsScreen() {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const getMediaLabel = (url: string) => {
    const trimmed = url.split("?")[0].split("#")[0];
    return trimmed.split("/").pop() || "attachment";
  };
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [builderMap, setBuilderMap] = useState<Record<number, string[]>>({});
  const [editMap, setEditMap] = useState<Record<number, boolean>>({});
  const [draftMap, setDraftMap] = useState<
    Record<
      number,
      {
        name: string;
        description: string;
        about_md: string;
        tags: string;
        links: string;
        status: number;
        media: string[];
      }
    >
  >({});
  const [builderDrafts, setBuilderDrafts] = useState<Record<number, string>>(
    {},
  );
  const [updatingProjectId, setUpdatingProjectId] = useState<number | null>(
    null,
  );
  const [uploadingProjectId, setUploadingProjectId] = useState<number | null>(
    null,
  );
  const [deletingProjectId, setDeletingProjectId] = useState<number | null>(
    null,
  );
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
        setDraftMap((prev) => {
          const next = { ...prev };
          safeProjects.forEach((project) => {
            if (!next[project.id]) {
              next[project.id] = {
                name: project.name,
                description: project.description ?? "",
                about_md: project.about_md ?? "",
                tags: (project.tags ?? []).join(", "),
                links: (project.links ?? []).join(", "),
                status: project.status ?? 0,
                media: project.media ?? [],
              };
            }
          });
          return next;
        });
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

  const handleToggleEdit = (projectId: number) => {
    setEditMap((prev) => ({ ...prev, [projectId]: !prev[projectId] }));
  };

  const handleSaveProject = async (project: ApiProject) => {
    const draft = draftMap[project.id];
    if (!draft) {
      return;
    }
    setUpdatingProjectId(project.id);
    try {
      const payload = {
        name: draft.name.trim(),
        description: draft.description.trim(),
        about_md: draft.about_md.trim(),
        tags: draft.tags
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        links: draft.links
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        status: draft.status,
        media: draft.media,
      };
      const response = await updateProject(project.id, payload);
      const updated = response.project;
      setProjects((prev) =>
        prev.map((item) => (item.id === project.id ? updated : item)),
      );
      setEditMap((prev) => ({ ...prev, [project.id]: false }));
    } finally {
      setUpdatingProjectId(null);
    }
  };

  const handleAddProjectMedia = async (
    projectId: number,
    source: "file" | "library",
  ) => {
    if (uploadingProjectId) {
      return;
    }
    setUploadingProjectId(projectId);
    try {
      let files: { uri: string; name: string; type: string }[] = [];
      if (source === "library") {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images", "videos"],
          quality: 0.9,
        });
        if (!result.canceled && result.assets?.length) {
          files = result.assets.map((asset) => ({
            uri: asset.uri,
            name: asset.fileName ?? `media-${Date.now()}`,
            type: asset.type ?? "application/octet-stream",
          }));
        }
      } else {
        const result = await DocumentPicker.getDocumentAsync({
          type: "*/*",
          copyToCacheDirectory: true,
        });
        if (!result.canceled) {
          files = [
            {
              uri: result.assets[0].uri,
              name: result.assets[0].name,
              type: result.assets[0].mimeType ?? "application/octet-stream",
            },
          ];
        }
      }

      if (!files.length) {
        return;
      }

      const uploads = await Promise.all(files.map((file) => uploadMedia(file)));
      const urls = uploads.map((item) => item.url);
      setDraftMap((prev) => {
        const current = prev[projectId];
        if (!current) {
          return prev;
        }
        return {
          ...prev,
          [projectId]: {
            ...current,
            media: [...current.media, ...urls],
          },
        };
      });
    } finally {
      setUploadingProjectId(null);
    }
  };

  const handleRemoveProjectMedia = (projectId: number, url: string) => {
    setDraftMap((prev) => {
      const current = prev[projectId];
      if (!current) {
        return prev;
      }
      return {
        ...prev,
        [projectId]: {
          ...current,
          media: current.media.filter((item) => item !== url),
        },
      };
    });
  };

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
                const draft = draftMap[project.id];
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
                        <ThemedText type="defaultSemiBold">
                          {project.name}
                        </ThemedText>
                        <ThemedText
                          type="caption"
                          style={{ color: colors.muted }}
                        >
                          {stageLabel.toUpperCase()} · Owner #{project.owner}
                        </ThemedText>
                      </View>
                      <TagChip label={stageLabel} tone="accent" />
                    </View>

                    {editMap[project.id] && draft ? (
                      <View style={styles.editBlock}>
                        <TextInput
                          value={draft.name}
                          onChangeText={(value) =>
                            setDraftMap((prev) => ({
                              ...prev,
                              [project.id]: { ...draft, name: value },
                            }))
                          }
                          placeholder="Stream name"
                          placeholderTextColor={colors.muted}
                          style={[
                            styles.input,
                            {
                              color: colors.text,
                              borderColor: colors.border,
                              backgroundColor: colors.surfaceAlt,
                            },
                          ]}
                        />
                        <TextInput
                          value={draft.description}
                          onChangeText={(value) =>
                            setDraftMap((prev) => ({
                              ...prev,
                              [project.id]: { ...draft, description: value },
                            }))
                          }
                          placeholder="Summary"
                          placeholderTextColor={colors.muted}
                          style={[
                            styles.input,
                            {
                              color: colors.text,
                              borderColor: colors.border,
                              backgroundColor: colors.surfaceAlt,
                            },
                          ]}
                          multiline
                        />
                        <TextInput
                          value={draft.about_md}
                          onChangeText={(value) =>
                            setDraftMap((prev) => ({
                              ...prev,
                              [project.id]: { ...draft, about_md: value },
                            }))
                          }
                          placeholder="Markdown body"
                          placeholderTextColor={colors.muted}
                          style={[
                            styles.input,
                            styles.textArea,
                            {
                              color: colors.text,
                              borderColor: colors.border,
                              backgroundColor: colors.surfaceAlt,
                            },
                          ]}
                          multiline
                        />
                        <TextInput
                          value={draft.tags}
                          onChangeText={(value) =>
                            setDraftMap((prev) => ({
                              ...prev,
                              [project.id]: { ...draft, tags: value },
                            }))
                          }
                          placeholder="Tags"
                          placeholderTextColor={colors.muted}
                          style={[
                            styles.input,
                            {
                              color: colors.text,
                              borderColor: colors.border,
                              backgroundColor: colors.surfaceAlt,
                            },
                          ]}
                        />
                        <TextInput
                          value={draft.links}
                          onChangeText={(value) =>
                            setDraftMap((prev) => ({
                              ...prev,
                              [project.id]: { ...draft, links: value },
                            }))
                          }
                          placeholder="Links"
                          placeholderTextColor={colors.muted}
                          style={[
                            styles.input,
                            {
                              color: colors.text,
                              borderColor: colors.border,
                              backgroundColor: colors.surfaceAlt,
                            },
                          ]}
                        />
                        <View style={styles.mediaSection}>
                          <ThemedText
                            type="caption"
                            style={{ color: colors.muted }}
                          >
                            Edit attachments
                          </ThemedText>
                          <View style={styles.mediaActions}>
                            <Pressable
                              onPress={() =>
                                handleAddProjectMedia(project.id, "library")
                              }
                              style={[
                                styles.mediaButton,
                                { borderColor: colors.border },
                              ]}
                              disabled={uploadingProjectId === project.id}
                            >
                              <ThemedText
                                type="caption"
                                style={{ color: colors.muted }}
                              >
                                Add photo/video
                              </ThemedText>
                            </Pressable>
                            <Pressable
                              onPress={() =>
                                handleAddProjectMedia(project.id, "file")
                              }
                              style={[
                                styles.mediaButton,
                                { borderColor: colors.border },
                              ]}
                              disabled={uploadingProjectId === project.id}
                            >
                              <ThemedText
                                type="caption"
                                style={{ color: colors.muted }}
                              >
                                Add file
                              </ThemedText>
                            </Pressable>
                          </View>
                          {uploadingProjectId === project.id ? (
                            <View style={styles.uploadingRow}>
                              <ThemedText
                                type="caption"
                                style={{ color: colors.muted }}
                              >
                                Uploading...
                              </ThemedText>
                            </View>
                          ) : null}
                          {draft.media.length ? (
                            <View style={styles.mediaChips}>
                              {draft.media.map((item) => (
                                <Pressable
                                  key={item}
                                  onPress={() =>
                                    handleRemoveProjectMedia(project.id, item)
                                  }
                                  style={[
                                    styles.mediaChip,
                                    { borderColor: colors.border },
                                  ]}
                                >
                                  <ThemedText
                                    type="caption"
                                    style={{ color: colors.muted }}
                                  >
                                    {getMediaLabel(item)} ×
                                  </ThemedText>
                                </Pressable>
                              ))}
                            </View>
                          ) : null}
                          <MediaGallery media={draft.media} />
                        </View>
                        <View style={styles.actionRow}>
                          <Pressable
                            onPress={() => handleToggleEdit(project.id)}
                            style={[
                              styles.actionButton,
                              { borderColor: colors.border },
                            ]}
                          >
                            <ThemedText
                              type="caption"
                              style={{ color: colors.muted }}
                            >
                              Cancel
                            </ThemedText>
                          </Pressable>
                          <Pressable
                            onPress={() => handleSaveProject(project)}
                            style={[
                              styles.actionButton,
                              { backgroundColor: colors.tint },
                            ]}
                            disabled={updatingProjectId === project.id}
                          >
                            <ThemedText
                              type="caption"
                              style={{ color: colors.accent }}
                            >
                              Save
                            </ThemedText>
                          </Pressable>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.previewBlock}>
                        <ThemedText type="default">
                          {project.description}
                        </ThemedText>
                        {project.about_md ? (
                          <MarkdownText>{project.about_md}</MarkdownText>
                        ) : null}
                        <MediaGallery media={project.media} />
                      </View>
                    )}

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
                        onPress={() => handleToggleEdit(project.id)}
                        style={[
                          styles.actionButton,
                          { borderColor: colors.border },
                        ]}
                      >
                        <ThemedText
                          type="caption"
                          style={{ color: colors.muted }}
                        >
                          {editMap[project.id] ? "Close" : "Edit"}
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
                      ) : null}
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
  editBlock: {
    gap: 10,
  },
  mediaSection: {
    gap: 10,
  },
  mediaActions: {
    flexDirection: "row",
    gap: 10,
  },
  mediaButton: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  uploadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  mediaChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  mediaChip: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: "SpaceMono",
    fontSize: 14,
  },
  textArea: {
    minHeight: 120,
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
