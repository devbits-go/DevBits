import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { Picker } from "@react-native-picker/picker";
import { useRouter } from "expo-router";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { ApiProject } from "@/constants/Types";
import { ThemedText } from "@/components/ThemedText";
import { TopBlur } from "@/components/TopBlur";
import { useBottomTabOverflow } from "@/components/ui/TabBarBackground";
import { useAuth } from "@/contexts/AuthContext";
import {
  createPost,
  getProjectsByBuilderId,
  uploadMedia,
} from "@/services/api";
import { useAppColors } from "@/hooks/useAppColors";
import { useMotionConfig } from "@/hooks/useMotionConfig";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { MediaGallery } from "@/components/MediaGallery";

export default function CreateByteScreen() {
  const colors = useAppColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const motion = useMotionConfig();
  const bottom = useBottomTabOverflow();
  const reveal = React.useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [content, setContent] = useState("");
  const [media, setMedia] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const loadProjects = async () => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }
      try {
        const data = await getProjectsByBuilderId(user.id);
        const safeProjects = Array.isArray(data) ? data : [];
        setProjects(safeProjects);
        if (safeProjects.length) {
          setProjectId(safeProjects[0].id);
        }
      } catch {
        setProjects([]);
        setErrorMessage("Unable to load your streams.");
      } finally {
        setIsLoading(false);
      }
    };

    loadProjects();
  }, [user?.id]);

  useEffect(() => {
    if (motion.prefersReducedMotion) {
      reveal.setValue(1);
      return;
    }

    Animated.timing(reveal, {
      toValue: 1,
      duration: motion.duration(320),
      useNativeDriver: true,
    }).start();
  }, [motion, reveal]);

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

  const handleSubmit = async () => {
    if (!user?.id || !projectId || !content.trim()) {
      setErrorMessage("Pick a stream and add your update.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    try {
      await createPost({
        user: user.id,
        project: projectId,
        content,
        media,
      });
      router.replace("/(tabs)");
    } catch {
      setErrorMessage("Failed to post. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddMedia = async (source: "file" | "library") => {
    if (isUploading) {
      return;
    }
    setErrorMessage("");
    setIsUploading(true);
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
      setMedia((prev) => [...prev, ...urls]);
    } catch {
      setErrorMessage("Upload failed. Try again.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.screen} edges={[]}>
        <KeyboardAvoidingView
          style={styles.screen}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <ScrollView
              ref={scrollRef}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerStyle={[
                styles.content,
                {
                  paddingTop: insets.top + 8,
                  paddingBottom: insets.bottom + bottom + 140,
                },
              ]}
              scrollIndicatorInsets={{ bottom: insets.bottom + bottom + 140 }}
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
                  <ThemedText type="display">New byte</ThemedText>
                  <ThemedText type="caption" style={{ color: colors.muted }}>
                    Share a quick update.
                  </ThemedText>
                </View>

                {isLoading ? (
                  <View style={styles.loading}>
                    <ActivityIndicator size="small" color={colors.muted} />
                  </View>
                ) : (
                  <View style={styles.form}>
                    {projects.length ? (
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
                          selectedValue={projectId ?? undefined}
                          onValueChange={(value) => setProjectId(Number(value))}
                          style={{ color: colors.text }}
                          dropdownIconColor={colors.muted}
                        >
                          {projects.map((project) => (
                            <Picker.Item
                              key={project.id}
                              label={project.name}
                              value={project.id}
                            />
                          ))}
                        </Picker>
                      </View>
                    ) : (
                      <View
                        style={[
                          styles.emptyState,
                          {
                            borderColor: colors.border,
                            backgroundColor: colors.surface,
                          },
                        ]}
                      >
                        <ThemedText
                          type="caption"
                          style={{ color: colors.muted }}
                        >
                          Create a stream before posting a byte.
                        </ThemedText>
                      </View>
                    )}

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
                        value={content}
                        onChangeText={setContent}
                        placeholder="What did you ship today?"
                        placeholderTextColor={colors.muted}
                        onFocus={handleInputFocus}
                        multiline
                        style={[
                          styles.input,
                          { color: colors.text, minHeight: 120 },
                        ]}
                      />
                    </View>

                    <View style={styles.mediaSection}>
                      <ThemedText
                        type="caption"
                        style={{ color: colors.muted }}
                      >
                        Add media (images, video, files)
                      </ThemedText>
                      <View style={styles.mediaActions}>
                        <Pressable
                          onPress={() => handleAddMedia("library")}
                          style={[
                            styles.mediaButton,
                            { borderColor: colors.border },
                          ]}
                        >
                          <ThemedText
                            type="caption"
                            style={{ color: colors.muted }}
                          >
                            Pick photo/video
                          </ThemedText>
                        </Pressable>
                        <Pressable
                          onPress={() => handleAddMedia("file")}
                          style={[
                            styles.mediaButton,
                            { borderColor: colors.border },
                          ]}
                        >
                          <ThemedText
                            type="caption"
                            style={{ color: colors.muted }}
                          >
                            Pick file
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

                    <Pressable
                      onPress={handleSubmit}
                      style={[styles.button, { backgroundColor: colors.tint }]}
                      disabled={!projects.length || isUploading}
                    >
                      {isSubmitting ? (
                        <ActivityIndicator size="small" color={colors.accent} />
                      ) : (
                        <ThemedText
                          type="defaultSemiBold"
                          style={{ color: colors.accent }}
                        >
                          Post byte
                        </ThemedText>
                      )}
                    </Pressable>
                  </View>
                )}
              </Animated.View>
            </ScrollView>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </SafeAreaView>
      <TopBlur />
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
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  form: {
    marginTop: 20,
    gap: 12,
  },
  emptyState: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 16,
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
  button: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
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
});
