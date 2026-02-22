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
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Picker } from "@react-native-picker/picker";
import { useRouter } from "expo-router";
import { FloatingScrollTopButton } from "@/components/FloatingScrollTopButton";
import { ThemedText } from "@/components/ThemedText";
import { TopBlur } from "@/components/TopBlur";
import { useBottomTabOverflow } from "@/components/ui/TabBarBackground";
import { useAuth } from "@/contexts/AuthContext";
import { useTopBlurScroll } from "@/hooks/useTopBlurScroll";
import { createProject, uploadMedia } from "@/services/api";
import { useAppColors } from "@/hooks/useAppColors";
import { useMotionConfig } from "@/hooks/useMotionConfig";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { MediaGallery } from "@/components/MediaGallery";
import { MarkdownText } from "@/components/MarkdownText";

const statusOptions = [
  { label: "Alpha", value: 0 },
  { label: "Beta", value: 1 },
  { label: "Launch", value: 2 },
];

export default function CreateStreamScreen() {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const motion = useMotionConfig();
  const bottom = useBottomTabOverflow();
  const reveal = React.useRef(new Animated.Value(0.08)).current;
  const scrollRef = useRef<ScrollView | null>(null);
  const { scrollY, onScroll } = useTopBlurScroll();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [aboutMd, setAboutMd] = useState("");
  const [tags, setTags] = useState("");
  const [links, setLinks] = useState("");
  const [status, setStatus] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [media, setMedia] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

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
    if (!user?.id || !name.trim() || !description.trim()) {
      setErrorMessage("Add a name and description for your stream.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    try {
      const tagList = tags
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      const linkList = links
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      await createProject({
        owner: user.id,
        name: name.trim(),
        description: description.trim(),
        about_md: aboutMd.trim(),
        status,
        tags: tagList,
        links: linkList,
        media,
      });
      router.replace("/(tabs)");
    } catch {
      setErrorMessage("Failed to create stream. Try again.");
    } finally {
      setIsSubmitting(false);
    }
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
                  <ThemedText type="display">New stream</ThemedText>
                  <ThemedText type="caption" style={{ color: colors.muted }}>
                    Start a project log.
                  </ThemedText>
                </View>

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
                    <TextInput
                      value={description}
                      onChangeText={setDescription}
                      placeholder="What are you building? (markdown supported)"
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
                      <MarkdownText>{description}</MarkdownText>
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
                      placeholder="Stream body (markdown supported)"
                      placeholderTextColor={colors.muted}
                      onFocus={handleInputFocus}
                      multiline
                      style={[
                        styles.input,
                        { color: colors.text, minHeight: 160 },
                      ]}
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
                    <ThemedText type="caption" style={{ color: colors.muted }}>
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
                        <ActivityIndicator size="small" color={colors.muted} />
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
                    <ThemedText type="caption" style={{ color: colors.muted }}>
                      {errorMessage}
                    </ThemedText>
                  ) : null}

                  <Pressable
                    onPress={handleSubmit}
                    style={[styles.button, { backgroundColor: colors.tint }]}
                    disabled={isSubmitting || isUploading}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator size="small" color={colors.onTint} />
                    ) : (
                      <ThemedText
                        type="defaultSemiBold"
                        style={{ color: colors.onTint }}
                      >
                        Create stream
                      </ThemedText>
                    )}
                  </Pressable>
                </View>
              </Animated.View>
            </Animated.ScrollView>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
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
  content: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  header: {
    marginTop: 20,
    gap: 6,
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
