import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { File as ExpoFile } from "expo-file-system";
import { FadeInImage } from "@/components/FadeInImage";
import { MarkdownText } from "@/components/MarkdownText";
import { ThemedText } from "@/components/ThemedText";
import { useAuth } from "@/contexts/AuthContext";
import { useAppColors } from "@/hooks/useAppColors";
import {
  invalidateCachedUserById,
  getMe,
  resolveMediaUrl,
  uploadMedia,
  upsertCachedUser,
  updateUser,
} from "@/services/api";
import { SettingsPageShell, settingsStyles } from "@/features/settings/shared";
import { buildLinks, parseLinks } from "@/features/settings/utils";

type ProfileDraft = {
  picture: string;
  bio: string;
  website: string;
  github: string;
  twitter: string;
  linkedin: string;
  extraLinks: string;
};

type PendingPicture = {
  uri: string;
  dataUri: string;
  name: string;
  type: string;
};

export default function SettingsBioScreen() {
  const colors = useAppColors();
  const { user, setUserDirect } = useAuth();

  const [draft, setDraft] = useState<ProfileDraft>({
    picture: user?.picture ?? "",
    bio: user?.bio ?? "",
    website: "",
    github: "",
    twitter: "",
    linkedin: "",
    extraLinks: "",
  });

  const [pendingPicture, setPendingPicture] = useState<PendingPicture | null>(
    null,
  );
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [hasMediaPermission, setHasMediaPermission] = useState<boolean | null>(
    null,
  );
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const initialDraft = useMemo<ProfileDraft>(() => {
    const parsed = parseLinks(user?.links ?? []);
    return {
      picture: user?.picture ?? "",
      bio: user?.bio ?? "",
      website: parsed.website,
      github: parsed.github,
      twitter: parsed.twitter,
      linkedin: parsed.linkedin,
      extraLinks: parsed.extraLinks.join(", "),
    };
  }, [user]);

  useEffect(() => {
    setDraft(initialDraft);
    setIsDirty(false);
    setPendingPicture(null);
  }, [initialDraft]);

  useEffect(() => {
    const dirty =
      pendingPicture !== null ||
      draft.picture !== initialDraft.picture ||
      draft.bio !== initialDraft.bio ||
      draft.website !== initialDraft.website ||
      draft.github !== initialDraft.github ||
      draft.twitter !== initialDraft.twitter ||
      draft.linkedin !== initialDraft.linkedin ||
      draft.extraLinks !== initialDraft.extraLinks;
    setIsDirty(dirty);
  }, [draft, initialDraft, pendingPicture]);

  const updateDraft = (updates: Partial<ProfileDraft>) => {
    setDraft((prev) => ({ ...prev, ...updates }));
  };

  useEffect(() => {
    let mounted = true;

    ImagePicker.getMediaLibraryPermissionsAsync()
      .then((permission) => {
        if (!mounted) return;
        setHasMediaPermission(
          permission.granted || permission.accessPrivileges === "limited",
        );
      })
      .catch(() => {
        if (mounted) setHasMediaPermission(null);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handlePickImage = async () => {
    if (isPickingImage) return;

    setIsPickingImage(true);
    setMessage("");

    try {
      let hasPermission = hasMediaPermission;
      if (!hasPermission) {
        const permission =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        hasPermission =
          permission.granted || permission.accessPrivileges === "limited";
        setHasMediaPermission(hasPermission);
      }

      if (!hasPermission) {
        setMessage("Photo access is required to pick an image.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
        exif: false,
      });

      if (!result.canceled && result.assets?.length) {
        const asset = result.assets[0];

        // 400x400 looks sharp on retina screens while keeping the
        // base64 data URI small enough (~20-40 KB) for reliable
        // JSON PUT on iOS.
        const MAX_PROFILE_PIC_SIZE = 400;

        const manipulated = await manipulateAsync(
          asset.uri,
          [
            {
              resize: {
                width: MAX_PROFILE_PIC_SIZE,
                height: MAX_PROFILE_PIC_SIZE,
              },
            },
          ],
          { compress: 0.65, format: SaveFormat.JPEG },
        );

        const fileName = `profile-${Date.now()}.jpg`;
        const mimeType = "image/jpeg";

        // Read the manipulated file as base64 immediately (while the
        // temp file is guaranteed to exist) so we can send it as a
        // data URI through the normal JSON update endpoint, avoiding
        // the unreliable multipart FormData upload on iOS.
        const base64 = await new ExpoFile(manipulated.uri).base64();
        const dataUri = `data:${mimeType};base64,${base64}`;

        setPendingPicture({
          uri: manipulated.uri,
          dataUri,
          name: fileName,
          type: mimeType,
        });
        updateDraft({ picture: manipulated.uri });
        setIsDirty(true);
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Failed to pick image.",
      );
    } finally {
      setIsPickingImage(false);
    }
  };

  const getActiveUsername = useCallback(async () => {
    return user?.username?.trim() || (await getMe())?.username?.trim() || "";
  }, [user?.username]);

  const onSaveSuccess = useCallback(() => {
    if (isMountedRef.current) {
      setPendingPicture(null);
      setMessage("Profile updated successfully.");
      setTimeout(() => {
        if (isMountedRef.current) {
          setMessage("");
        }
      }, 3000);
    }
  }, []);

  const handleSave = async () => {
    if (isSubmitting || isPickingImage || !isDirty) return;

    setIsSubmitting(true);
    setMessage("");

    try {
      const username = await getActiveUsername();
      if (!username) {
        setMessage("You must be signed in to update your profile.");
        return;
      }

      // Build the update payload — bio, links, and (optionally) picture.
      const links = buildLinks({
        website: draft.website,
        github: draft.github,
        twitter: draft.twitter,
        linkedin: draft.linkedin,
        extraLinks: draft.extraLinks,
      });

      const profilePayload: { bio: string; links: string[]; picture?: string } =
        {
          bio: draft.bio,
          links,
        };

      // If a new picture was picked, try the fast path first:
      // upload via POST /media/upload (multipart POST is reliable on
      // iOS) and send the resulting URL in the profile PUT.  The PUT
      // body stays tiny (~200 B) so iOS CFNetwork won't drop it.
      // Only fall back to the large base64 data URI approach if the
      // multipart upload fails.
      if (pendingPicture) {
        try {
          const uploaded = await uploadMedia({
            uri: pendingPicture.uri,
            name: pendingPicture.name,
            type: pendingPicture.type,
          });
          // uploaded.url is already resolved to an absolute URL;
          // the backend's materializeMediaReference will normalise
          // it back to a relative /uploads/ path.
          profilePayload.picture = uploaded.url;
        } catch {
          // Multipart upload failed — fall back to data URI
          profilePayload.picture = pendingPicture.dataUri;
        }
      } else if (draft.picture !== initialDraft.picture) {
        profilePayload.picture = draft.picture;
      }

      // iOS CFNetwork sometimes silently drops the request body.
      // Retry up to 6 times with a short delay.
      const MAX_RETRIES = 6;
      let lastError: unknown;
      let response: Awaited<ReturnType<typeof updateUser>> | null = null;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          response = await updateUser(username, profilePayload);
          break; // success
        } catch (err) {
          lastError = err;
          if (attempt < MAX_RETRIES) {
            await new Promise((r) => setTimeout(r, 250));
          }
        }
      }

      if (!response) {
        throw lastError instanceof Error
          ? lastError
          : new Error("Profile update failed after multiple attempts.");
      }

      const latestUser = response?.user;

      if (latestUser) {
        upsertCachedUser(latestUser);
        if (typeof latestUser.id === "number") {
          invalidateCachedUserById(latestUser.id);
        }
        // Update the AuthContext user immediately from the PUT response
        // instead of making a redundant GET /auth/me round-trip.
        setUserDirect(latestUser);
        onSaveSuccess();
      } else {
        throw new Error("Failed to get updated user from server.");
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "An unknown error occurred.",
      );
    } finally {
      if (isMountedRef.current) {
        setIsSubmitting(false);
      }
    }
  };

  const handleRemovePicture = () => {
    if (isSubmitting) return;
    updateDraft({ picture: "" });
    setPendingPicture(null);
  };

  const resetDraft = useCallback(() => {
    setDraft(initialDraft);
    setPendingPicture(null);
    setMessage("");
    setIsDirty(false);
  }, [initialDraft]);

  const resolvedPicture = useMemo(() => {
    // When a pending local image is selected (file:// or content:// URI),
    // use it directly — resolveMediaUrl is for server paths only.
    if (pendingPicture) {
      return pendingPicture.uri;
    }
    return resolveMediaUrl(draft.picture);
  }, [draft.picture, pendingPicture]);

  return (
    <SettingsPageShell
      title="Bio"
      subtitle="Edit your public profile, links and image"
      headerAction={
        <View style={styles.headerActionRow}>
          <Pressable
            onPress={handleSave}
            style={({ pressed }) => [
              settingsStyles.button,
              styles.topSaveButton,
              {
                backgroundColor:
                  !isDirty || isSubmitting || isPickingImage
                    ? colors.surfaceAlt
                    : colors.tint,
              },
              pressed && isDirty && !isSubmitting && styles.pressFeedback,
            ]}
            disabled={!isDirty || isSubmitting || isPickingImage}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={colors.onTint} />
            ) : (
              <ThemedText
                type="caption"
                style={{
                  color:
                    !isDirty || isSubmitting || isPickingImage
                      ? colors.muted
                      : colors.onTint,
                }}
              >
                Save
              </ThemedText>
            )}
          </Pressable>
          {isDirty ? (
            <Pressable
              onPress={resetDraft}
              style={({ pressed }) => [
                settingsStyles.buttonAlt,
                styles.cancelButton,
                { borderColor: colors.border },
                pressed && styles.pressFeedback,
              ]}
            >
              <ThemedText type="caption" style={{ color: colors.muted }}>
                Cancel
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      }
    >
      <View
        style={[
          styles.avatarCard,
          { borderColor: colors.border, backgroundColor: colors.surface },
        ]}
      >
        <View
          style={[
            styles.avatar,
            { borderColor: colors.border, backgroundColor: colors.surfaceAlt },
          ]}
        >
          {resolvedPicture ? (
            <FadeInImage
              source={{ uri: resolvedPicture }}
              style={styles.avatarImage}
            />
          ) : (
            <ThemedText type="caption" style={{ color: colors.muted }}>
              Add photo
            </ThemedText>
          )}
        </View>
        <View style={styles.imageActionRow}>
          <Pressable
            onPress={handlePickImage}
            style={({ pressed }) => [
              settingsStyles.buttonAlt,
              styles.chooseImageButton,
              { borderColor: colors.border },
              pressed && styles.pressFeedback,
            ]}
            disabled={isPickingImage || isSubmitting}
          >
            {isPickingImage ? (
              <ActivityIndicator size="small" color={colors.muted} />
            ) : (
              <ThemedText
                type="defaultSemiBold"
                style={{ color: colors.muted }}
              >
                Choose image
              </ThemedText>
            )}
          </Pressable>
          {draft.picture.trim() ? (
            <Pressable
              onPress={handleRemovePicture}
              style={({ pressed }) => [
                settingsStyles.buttonAlt,
                styles.removeImageButton,
                { borderColor: colors.border },
                pressed && styles.pressFeedback,
              ]}
              disabled={isSubmitting}
            >
              <ThemedText
                type="defaultSemiBold"
                style={{ color: colors.muted }}
              >
                Remove photo
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View
        style={[
          settingsStyles.sectionCard,
          { borderColor: colors.border, backgroundColor: colors.surface },
        ]}
      >
        <Field
          label="Profile image URL"
          value={draft.picture}
          onChange={(value) => {
            // If the user pasted Markdown like `![alt](/path)` or an <img src="..."> tag,
            // extract the actual URL so the profile image field isn't set to raw MD.
            const mdMatch = value.match(/!\[[^\]]*\]\(([^)]+)\)/);
            const imgTagMatch = value.match(
              /<img[^>]*src=["']([^"']+)["'][^>]*>/i,
            );
            const normalized = mdMatch
              ? mdMatch[1]
              : imgTagMatch
                ? imgTagMatch[1]
                : value;
            updateDraft({ picture: normalized });
            setPendingPicture(null);
          }}
        />
        <Field
          label="Bio"
          value={draft.bio}
          onChange={(value) => updateDraft({ bio: value })}
          multiline
        />
        {draft.bio.trim() ? (
          <View style={styles.bioPreview}>
            <ThemedText type="caption" style={{ color: colors.muted }}>
              Bio preview
            </ThemedText>
            <MarkdownText preferStatic>{draft.bio}</MarkdownText>
          </View>
        ) : null}
        <Field
          label="Website"
          value={draft.website}
          onChange={(value) => updateDraft({ website: value })}
        />
        <Field
          label="GitHub"
          value={draft.github}
          onChange={(value) => updateDraft({ github: value })}
        />
        <Field
          label="Twitter/X"
          value={draft.twitter}
          onChange={(value) => updateDraft({ twitter: value })}
        />
        <Field
          label="LinkedIn"
          value={draft.linkedin}
          onChange={(value) => updateDraft({ linkedin: value })}
        />
        <Field
          label="Other links (comma separated)"
          value={draft.extraLinks}
          onChange={(value) => updateDraft({ extraLinks: value })}
        />

        {message ? (
          <ThemedText type="caption" style={{ color: colors.muted }}>
            {message}
          </ThemedText>
        ) : null}
      </View>
    </SettingsPageShell>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline,
  onBlur,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  onBlur?: () => void;
}) {
  const colors = useAppColors();

  return (
    <View style={{ gap: 6 }}>
      <ThemedText type="caption" style={{ color: colors.muted }}>
        {label}
      </ThemedText>
      <View
        style={[
          settingsStyles.inputWrap,
          { borderColor: colors.border, backgroundColor: colors.surfaceAlt },
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChange}
          onEndEditing={onBlur}
          multiline={multiline}
          textAlignVertical={multiline ? "top" : "center"}
          style={[
            settingsStyles.input,
            {
              color: colors.text,
              minHeight: multiline ? 88 : undefined,
            },
          ]}
          placeholder={label}
          placeholderTextColor={colors.muted}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  avatarCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 10,
    alignItems: "flex-start",
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  chooseImageButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 42,
  },
  removeImageButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 42,
  },
  imageActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  cancelButton: {
    minHeight: 32,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  topSaveButton: {
    minHeight: 32,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  headerActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pressFeedback: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
  bioPreview: {
    gap: 6,
  },
});
