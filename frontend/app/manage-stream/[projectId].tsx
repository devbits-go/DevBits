import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
import { Picker } from "@react-native-picker/picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { ThemedText } from "@/components/ThemedText";
import { TopBlur } from "@/components/TopBlur";
import { FloatingScrollTopButton } from "@/components/FloatingScrollTopButton";
import { MediaGallery } from "@/components/MediaGallery";
import { MarkdownText } from "@/components/MarkdownText";
import { useTopBlurScroll } from "@/hooks/useTopBlurScroll";
import { useAppColors } from "@/hooks/useAppColors";
import { useMotionConfig } from "@/hooks/useMotionConfig";
import {
  clearApiCache,
  getProjectById,
  updateProject,
  uploadMedia,
} from "@/services/api";
import { emitProjectUpdated } from "@/services/projectEvents";

type StatusOption = { label: string; value: number };

const statusOptions: StatusOption[] = [
  { label: "Alpha", value: 0 },
  { label: "Beta", value: 1 },
  { label: "Launch", value: 2 },
];

export default function ManageSingleStreamScreen() {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const motion = useMotionConfig();
  const reveal = useRef(new Animated.Value(0.08)).current;
  const scrollRef = useRef<ScrollView | null>(null);
  const { scrollY, onScroll } = useTopBlurScroll();
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();
  const projectIdNumber = useMemo(() => Number(projectId), [projectId]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [aboutMd, setAboutMd] = useState("");
  const [tags, setTags] = useState("");
  const [links, setLinks] = useState("");
  const [status, setStatus] = useState(0);
  const [media, setMedia] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (motion.prefersReducedMotion) {
      reveal.setValue(1);
      return;
    }

    Animated.timing(reveal, {
      toValue: 1,
      duration: motion.duration(300),
      useNativeDriver: true,
    }).start();
  }, [motion, reveal]);

  useEffect(() => {
    let cancelled = false;
    if (!projectIdNumber) {
      setErrorMessage("Invalid stream id.");
      setIsLoading(false);
      return;
    }

    void (async () => {
      setIsLoading(true);
      setErrorMessage("");
      try {
        const project = await getProjectById(projectIdNumber);
        if (cancelled) {
          return;
        }
        setName(project.name ?? "");
        setDescription(project.description ?? "");
        setAboutMd(project.about_md ?? "");
        setTags((project.tags ?? []).join(", "));
        setLinks((project.links ?? []).join(", "));
        setStatus(project.status ?? 0);
        setMedia(project.media ?? []);
      } catch {
        if (!cancelled) {
          setErrorMessage("Unable to load stream.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectIdNumber]);

  const getMediaLabel = (url: string) => {
    const trimmed = url.split("?")[0].split("#")[0];
    return trimmed.split("/").pop() || "attachment";
  };

  const handleInputFocus = (event: any) => {
    const target = event?.target ?? event?.nativeEvent?.target;
    if (!target) {
      return;
    }
    scrollRef.current?.scrollResponderScrollNativeHandleToKeyboard(
      target,
      84,
      true,
    );
  };

  const handleAddMedia = async (source: "file" | "library") => {
    if (isUploading) {
      return;
    }
    setIsUploading(true);
    setErrorMessage("");
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
      const urls = uploads
        .map((item) => item?.url)
        .filter((url): url is string => !!url);
      setMedia((prev) => [...prev, ...urls]);
    } catch {
      setErrorMessage("Upload failed. Try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveMedia = (url: string) => {
    setMedia((prev) => prev.filter((item) => item !== url));
  };

  const handleSave = async () => {
    if (!projectIdNumber) {
      return;
    }
    if (!name.trim() || !description.trim()) {
      setErrorMessage("Add a stream name and summary.");
      return;
    }

    setIsSaving(true);
    setErrorMessage("");
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        about_md: aboutMd.trim(),
        status,
        tags: tags
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        links: links
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        media,
      };
      const response = await updateProject(projectIdNumber, payload);
      const updated = response.project;
      clearApiCache();
      emitProjectUpdated(updated.id, {
        name: updated.name,
        summary: updated.description ?? "",
        about_md: updated.about_md ?? "",
        stage:
          updated.status === 2
            ? "launch"
            : updated.status === 1
              ? "beta"
              : "alpha",
        tags: updated.tags ?? [],
        media: updated.media ?? [],
        updated_on: updated.creation_date,
        likes: updated.likes,
        saves: updated.saves ?? 0,
      });
      router.back();
    } catch {
      setErrorMessage("Failed to update stream.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (isSaving) {
      return;
    }
    router.back();
  };

  const confirmDiscard = () => {
    if (isSaving) {
      return;
    }
    Alert.alert("Discard changes?", "Your edits will be lost.", [
      { text: "Keep editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: handleCancel },
    ]);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.screen} edges={[]}>
        <KeyboardAvoidingView
          style={styles.screen}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <Animated.ScrollView
              ref={scrollRef}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              onScroll={onScroll}
              scrollEventThrottle={16}
              contentContainerStyle={[
                styles.content,
                {
                  paddingTop: insets.top + 8,
                  paddingBottom: insets.bottom + 120,
                },
              ]}
            >
              <Animated.View
                style={{
                  opacity: reveal,
                  transform: [
                    {
                      translateY: reveal.interpolate({
                        inputRange: [0, 1],
                        outputRange: [12, 0],
                      }),
                    },
                  ],
                }}
              >
                <View style={styles.header}>
                  <ThemedText type="display">Edit stream</ThemedText>
                  <ThemedText type="caption" style={{ color: colors.muted }}>
                    Update details in one clean editor.
                  </ThemedText>
                </View>

                {isLoading ? (
                  <View style={styles.loadingState}>
                    <ActivityIndicator size="small" color={colors.muted} />
                  </View>
                ) : (
                  <View style={styles.form}>
                    <View
                      style={[
                        styles.inputRow,
                        {
                          borderColor: colors.border,
                          backgroundColor: colors.surface,
                        },
                      ]}
                    >
                      <TextInput
                        value={name}
                        onChangeText={setName}
                        placeholder="Stream name"
                        placeholderTextColor={colors.muted}
                        onFocus={handleInputFocus}
                        style={[styles.input, { color: colors.text }]}
                      />
                    </View>

                    <View
                      style={[
                        styles.inputRow,
                        {
                          borderColor: colors.border,
                          backgroundColor: colors.surface,
                        },
                      ]}
                    >
                      <TextInput
                        value={description}
                        onChangeText={setDescription}
                        placeholder="Summary (markdown supported)"
                        placeholderTextColor={colors.muted}
                        onFocus={handleInputFocus}
                        multiline
                        style={[
                          styles.input,
                          { color: colors.text, minHeight: 110 },
                        ]}
                      />
                    </View>

                    {description.trim() ? (
                      <View
                        style={[
                          styles.previewRow,
                          {
                            borderColor: colors.border,
                            backgroundColor: colors.surface,
                          },
                        ]}
                      >
                        <ThemedText
                          type="caption"
                          style={[styles.previewLabel, { color: colors.muted }]}
                        >
                          Preview
                        </ThemedText>
                        <MarkdownText preferStatic>{description}</MarkdownText>
                      </View>
                    ) : null}

                    <View
                      style={[
                        styles.inputRow,
                        {
                          borderColor: colors.border,
                          backgroundColor: colors.surface,
                        },
                      ]}
                    >
                      <TextInput
                        value={aboutMd}
                        onChangeText={setAboutMd}
                        placeholder="Body (markdown supported)"
                        placeholderTextColor={colors.muted}
                        onFocus={handleInputFocus}
                        multiline
                        style={[
                          styles.input,
                          { color: colors.text, minHeight: 160 },
                        ]}
                      />
                    </View>

                    {aboutMd.trim() ? (
                      <View
                        style={[
                          styles.previewRow,
                          {
                            borderColor: colors.border,
                            backgroundColor: colors.surface,
                          },
                        ]}
                      >
                        <ThemedText
                          type="caption"
                          style={[styles.previewLabel, { color: colors.muted }]}
                        >
                          Body preview
                        </ThemedText>
                        <MarkdownText preferStatic>{aboutMd}</MarkdownText>
                      </View>
                    ) : null}

                    <View
                      style={[
                        styles.inputRow,
                        {
                          borderColor: colors.border,
                          backgroundColor: colors.surface,
                        },
                      ]}
                    >
                      <Picker
                        selectedValue={status}
                        onValueChange={(value) => setStatus(Number(value))}
                        style={{ color: colors.text }}
                        dropdownIconColor={colors.muted}
                      >
                        {statusOptions.map((option) => (
                          <Picker.Item
                            key={option.value}
                            label={option.label}
                            value={option.value}
                          />
                        ))}
                      </Picker>
                    </View>

                    <View
                      style={[
                        styles.inputRow,
                        {
                          borderColor: colors.border,
                          backgroundColor: colors.surface,
                        },
                      ]}
                    >
                      <TextInput
                        value={tags}
                        onChangeText={setTags}
                        placeholder="Tags (comma separated)"
                        placeholderTextColor={colors.muted}
                        onFocus={handleInputFocus}
                        style={[styles.input, { color: colors.text }]}
                      />
                    </View>

                    <View
                      style={[
                        styles.inputRow,
                        {
                          borderColor: colors.border,
                          backgroundColor: colors.surface,
                        },
                      ]}
                    >
                      <TextInput
                        value={links}
                        onChangeText={setLinks}
                        placeholder="Links (comma separated)"
                        placeholderTextColor={colors.muted}
                        onFocus={handleInputFocus}
                        style={[styles.input, { color: colors.text }]}
                      />
                    </View>

                    <View style={styles.mediaSection}>
                      <ThemedText
                        type="caption"
                        style={{ color: colors.muted }}
                      >
                        Edit attachments
                      </ThemedText>
                      <View style={styles.mediaActions}>
                        <Pressable
                          onPress={() => handleAddMedia("library")}
                          style={[
                            styles.mediaButton,
                            { borderColor: colors.border },
                          ]}
                          disabled={isUploading}
                        >
                          <ThemedText
                            type="caption"
                            style={{ color: colors.muted }}
                          >
                            Add photo/video
                          </ThemedText>
                        </Pressable>
                        <Pressable
                          onPress={() => handleAddMedia("file")}
                          style={[
                            styles.mediaButton,
                            { borderColor: colors.border },
                          ]}
                          disabled={isUploading}
                        >
                          <ThemedText
                            type="caption"
                            style={{ color: colors.muted }}
                          >
                            Add file
                          </ThemedText>
                        </Pressable>
                      </View>
                      {isUploading ? (
                        <View style={styles.uploadingRow}>
                          <ActivityIndicator
                            size="small"
                            color={colors.muted}
                          />
                          <ThemedText
                            type="caption"
                            style={{ color: colors.muted }}
                          >
                            Uploading...
                          </ThemedText>
                        </View>
                      ) : null}
                      {media.length ? (
                        <View style={styles.mediaChips}>
                          {media.map((item) => (
                            <Pressable
                              key={item}
                              onPress={() => handleRemoveMedia(item)}
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
                      <MediaGallery media={media} />
                    </View>

                    {errorMessage ? (
                      <ThemedText
                        type="caption"
                        style={{ color: colors.muted }}
                      >
                        {errorMessage}
                      </ThemedText>
                    ) : null}

                    <View style={styles.actionRow}>
                      <Pressable
                        onPress={confirmDiscard}
                        style={[
                          styles.actionButton,
                          { borderColor: colors.border },
                        ]}
                        disabled={isSaving}
                      >
                        <ThemedText
                          type="caption"
                          style={{ color: colors.muted }}
                        >
                          Cancel
                        </ThemedText>
                      </Pressable>
                      <Pressable
                        onPress={handleSave}
                        style={[
                          styles.actionButton,
                          { backgroundColor: colors.tint },
                        ]}
                        disabled={isSaving || isUploading}
                      >
                        {isSaving ? (
                          <ActivityIndicator
                            size="small"
                            color={colors.onTint}
                          />
                        ) : (
                          <ThemedText
                            type="caption"
                            style={{ color: colors.onTint }}
                          >
                            Save
                          </ThemedText>
                        )}
                      </Pressable>
                    </View>
                  </View>
                )}
              </Animated.View>
            </Animated.ScrollView>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </SafeAreaView>
      <TopBlur scrollY={scrollY} />
      <FloatingScrollTopButton
        scrollY={scrollY}
        bottomOffset={insets.bottom + 20}
        onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  header: {
    marginTop: 20,
    gap: 6,
  },
  loadingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
  },
  form: {
    marginTop: 20,
    gap: 12,
  },
  inputRow: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  input: {
    fontFamily: "SpaceMono",
    fontSize: 15,
  },
  previewRow: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  previewLabel: {
    marginBottom: 6,
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
  actionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  actionButton: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 78,
    alignItems: "center",
  },
});
