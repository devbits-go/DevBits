import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { UiPost } from "@/constants/Types";
import { FadeInImage } from "@/components/FadeInImage";
import { LazyFadeIn } from "@/components/LazyFadeIn";
import { ThemedText } from "@/components/ThemedText";
import { TagChip } from "@/components/TagChip";
import { MarkdownText } from "@/components/MarkdownText";
import { MediaGallery } from "@/components/MediaGallery";
import { useAppColors } from "@/hooks/useAppColors";
import { useAuth } from "@/contexts/AuthContext";
import { useSaved } from "@/contexts/SavedContext";
import { useRouter } from "expo-router";
import {
  getCommentsByPostId,
  isPostLiked,
  likePost,
  deletePost,
  resolveMediaUrl,
  updatePost,
  uploadMedia,
  unlikePost,
} from "@/services/api";
import {
  emitPostDeleted,
  emitPostStats,
  emitPostUpdated,
  subscribeToPostEvents,
} from "@/services/postEvents";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";

const postCommentCountCache = new Map<number, number>();
const postCommentCountInFlight = new Map<number, Promise<number>>();

const getCachedCommentCount = async (postId: number) => {
  const cached = postCommentCountCache.get(postId);
  if (typeof cached === "number") {
    return cached;
  }

  const pending = postCommentCountInFlight.get(postId);
  if (pending) {
    return pending;
  }

  const request = getCommentsByPostId(postId)
    .then((list) => {
      const count = Array.isArray(list) ? list.length : 0;
      postCommentCountCache.set(postId, count);
      return count;
    })
    .catch(() => 0)
    .finally(() => {
      postCommentCountInFlight.delete(postId);
    });

  postCommentCountInFlight.set(postId, request);
  return request;
};

type PostProps = UiPost;

type PostActionProps = {
  icon: string;
  label: string | number;
  onPress?: () => void;
  color?: string;
  glow?: boolean;
};

function PostAction({ icon, label, onPress, color, glow }: PostActionProps) {
  const colors = useAppColors();
  const iconColor = color ?? colors.muted;
  const scale = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(glow ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(glowAnim, {
      toValue: glow ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [glow, glowAnim]);

  const animateTo = (toValue: number) => {
    Animated.spring(scale, {
      toValue,
      speed: 22,
      bounciness: 5,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View
      style={[
        styles.action,
        {
          shadowColor: colors.tint,
          shadowOpacity: glowAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.06, 0.34],
          }) as unknown as number,
          shadowRadius: glowAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [2, 8],
          }) as unknown as number,
          shadowOffset: { width: 0, height: 0 },
          elevation: glow ? 3 : 1,
        },
      ]}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Pressable
          hitSlop={10}
          onPressIn={() => animateTo(0.94)}
          onPressOut={() => animateTo(1)}
          style={({ pressed }) => [
            styles.actionTouch,
            pressed && styles.actionPressed,
          ]}
          onPress={onPress}
        >
          <Feather
            name={icon as keyof typeof Feather.glyphMap}
            size={16}
            color={iconColor}
          />
          <ThemedText type="caption" style={{ color: iconColor }}>
            {label}
          </ThemedText>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

export function Post({
  id,
  username,
  projectId,
  projectName,
  projectStage,
  likes,
  saves,
  comments,
  content,
  media,
  created_on,
  tags,
  userPicture,
  userId,
}: PostProps) {
  const colors = useAppColors();
  const router = useRouter();
  const { user } = useAuth();
  const { isSaved, savedPostIds, toggleSave } = useSaved();
  const [likeCount, setLikeCount] = useState(likes);
  const [saveCount, setSaveCount] = useState(saves);
  const [commentCount, setCommentCount] = useState(comments);
  const [isLiked, setIsLiked] = useState(false);
  const [isLikeUpdating, setIsLikeUpdating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(content);
  const [localContent, setLocalContent] = useState(content);
  const [localMedia, setLocalMedia] = useState<string[]>(media ?? []);
  const [editMedia, setEditMedia] = useState<string[]>(media ?? []);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const likeScale = useRef(new Animated.Value(1)).current;
  const resolvedUserPicture = resolveMediaUrl(userPicture);
  const longContentThreshold = 520;
  const previewCharLimit = 220;
  const likeMutationRef = useRef<{ value: boolean; ts: number } | null>(null);
  const saveMutationRef = useRef<{ value: boolean; ts: number } | null>(null);
  const desiredLikeRef = useRef<boolean | null>(null);
  const desiredSaveRef = useRef<boolean | null>(null);
  const [isSavedLocal, setIsSavedLocal] = useState(isSaved(id));
  const previewContent = useMemo(() => {
    if (localContent.length <= previewCharLimit) {
      return localContent;
    }
    return localContent.slice(0, previewCharLimit).trimEnd();
  }, [localContent, previewCharLimit]);
  const isTruncated = localContent.length > previewCharLimit;
  const isLongContent = localContent.length > longContentThreshold;
  const renderedContent = isLongContent ? previewContent : localContent;

  const initials = useMemo(() => {
    return username
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }, [username]);

  const timeLabel = new Date(created_on).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const dateLabel = new Date(created_on).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  const canEdit = !!user?.id && userId === user.id;
  const handleOpenProfile = () => {
    if (!username) {
      return;
    }
    router.push({ pathname: "/user/[username]", params: { username } });
  };

  const handleOpenStream = () => {
    if (!projectId) {
      return;
    }
    router.push({
      pathname: "/stream/[projectId]",
      params: { projectId: String(projectId) },
    });
  };

  const getMediaLabel = (url: string) => {
    const trimmed = url.split("?")[0].split("#")[0];
    return trimmed.split("/").pop() || "attachment";
  };

  useEffect(() => {
    if (!isEditing) {
      setDraft(content);
      setLocalContent(content);
      setLocalMedia(media ?? []);
      setEditMedia(media ?? []);
    }
  }, [content, isEditing, media]);

  useEffect(() => {
    setIsSavedLocal(isSaved(id));
  }, [id, isSaved, savedPostIds]);

  useEffect(() => {
    setLikeCount(likes);
  }, [likes]);

  useEffect(() => {
    setSaveCount(saves);
  }, [saves]);

  useEffect(() => {
    setCommentCount((prev) => {
      if (comments > 0 || (comments === 0 && prev === 0)) {
        return comments;
      }
      return prev;
    });
  }, [comments]);

  useEffect(() => {
    return subscribeToPostEvents((event) => {
      if (event.postId !== id || event.type !== "stats") {
        return;
      }
      if (typeof event.likes === "number") {
        setLikeCount(event.likes);
      }
      if (typeof event.comments === "number") {
        postCommentCountCache.set(id, event.comments);
        setCommentCount(event.comments);
      }
      if (typeof event.isLiked === "boolean") {
        const pending = likeMutationRef.current;
        if (pending && Date.now() - pending.ts < 1500) {
          if (event.isLiked === pending.value) {
            likeMutationRef.current = null;
          } else {
            return;
          }
        }
        setIsLiked(event.isLiked);
      }
    });
  }, [id]);

  useEffect(() => {
    let isMounted = true;
    const loadMeta = async () => {
      if (!user?.username) {
        const nextCount = await getCachedCommentCount(id);
        if (isMounted) {
          setCommentCount(nextCount);
        }
        return;
      }
      try {
        const [likeStatus, nextCount] = await Promise.all([
          isPostLiked(user.username, id),
          getCachedCommentCount(id),
        ]);
        if (isMounted) {
          const pending = likeMutationRef.current;
          if (!pending || Date.now() - pending.ts >= 1500) {
            setIsLiked(likeStatus.status);
          }
          setCommentCount(nextCount);
        }
      } catch {
        if (isMounted) {
          setIsLiked(false);
          const nextCount = await getCachedCommentCount(id);
          setCommentCount(nextCount);
        }
      }
    };

    loadMeta();
    return () => {
      isMounted = false;
    };
  }, [id, user?.username]);

  const handleToggleLike = async () => {
    if (!user?.username) {
      return;
    }

    let nextLiked = false;
    let nextLikes = 0;

    setIsLiked((prev) => {
      nextLiked = !prev;
      return nextLiked;
    });
    setLikeCount((prev) => {
      nextLikes = Math.max(0, prev + (nextLiked ? 1 : -1));
      return nextLikes;
    });

    emitPostStats(id, { likes: nextLikes, isLiked: nextLiked });
    likeMutationRef.current = { value: nextLiked, ts: Date.now() };
    desiredLikeRef.current = nextLiked;

    if (isLikeUpdating) {
      return;
    }

    setIsLikeUpdating(true);
    try {
      while (desiredLikeRef.current !== null) {
        const targetLiked = desiredLikeRef.current;
        desiredLikeRef.current = null;

        if (targetLiked) {
          await likePost(user.username, id);
        } else {
          await unlikePost(user.username, id);
        }
      }
    } catch {
      try {
        const serverStatus = await isPostLiked(user.username, id);
        setIsLiked(serverStatus.status);
      } catch {}
    } finally {
      likeMutationRef.current = null;
      setIsLikeUpdating(false);
    }
  };

  const handleToggleSave = async () => {
    let nextSaved = false;
    let nextCount = 0;

    setIsSavedLocal((prev) => {
      nextSaved = !prev;
      return nextSaved;
    });
    setSaveCount((prev) => {
      nextCount = Math.max(0, prev + (nextSaved ? 1 : -1));
      return nextCount;
    });

    saveMutationRef.current = { value: nextSaved, ts: Date.now() };
    desiredSaveRef.current = nextSaved;

    if (isSaving) {
      return;
    }

    setIsSaving(true);
    try {
      while (desiredSaveRef.current !== null) {
        const targetSaved = desiredSaveRef.current;
        desiredSaveRef.current = null;
        const currentlySaved = isSaved(id);
        if (targetSaved !== currentlySaved) {
          await toggleSave(id);
        }
      }
    } catch {
      const restoredSaved = isSaved(id);
      setIsSavedLocal(restoredSaved);
    } finally {
      saveMutationRef.current = null;
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (!isLiked) {
      return;
    }
    likeScale.setValue(1);
    Animated.sequence([
      Animated.timing(likeScale, {
        toValue: 1.12,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.timing(likeScale, {
        toValue: 1,
        duration: 110,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isLiked, likeScale]);

  const handleStartEdit = () => {
    setDraft(localContent);
    setEditMedia(localMedia);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setDraft(localContent);
    setEditMedia(localMedia);
    setIsEditing(false);
  };

  const handleAddEditMedia = async (source: "file" | "library") => {
    if (isUploadingMedia) {
      return;
    }
    setIsUploadingMedia(true);
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
      setEditMedia((prev) => [...prev, ...urls]);
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const handleRemoveEditMedia = (url: string) => {
    setEditMedia((prev) => prev.filter((item) => item !== url));
  };

  const handleSaveEdit = async () => {
    if (!draft.trim()) {
      Alert.alert("Byte cannot be empty.");
      return;
    }
    setIsUpdating(true);
    try {
      const response = await updatePost(id, {
        content: draft.trim(),
        media: editMedia,
      });
      const nextContent = response?.post?.content ?? draft.trim();
      const nextMedia = response?.post?.media ?? editMedia;
      setLocalContent(nextContent);
      setLocalMedia(nextMedia);
      setIsEditing(false);
      emitPostUpdated(id, nextContent, nextMedia);
    } catch {
      Alert.alert("Failed to update byte.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = () => {
    if (isDeleting) {
      return;
    }
    Alert.alert("Delete byte?", "This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void (async () => {
            setIsDeleting(true);
            try {
              await deletePost(id);
              emitPostDeleted(id);
            } catch {
              Alert.alert("Failed to delete byte.");
            } finally {
              setIsDeleting(false);
              setIsEditing(false);
            }
          })();
        },
      },
    ]);
  };

  const handleOpenPost = () => {
    router.push({
      pathname: "/post/[postId]",
      params: { postId: String(id) },
    });
  };

  return (
    <LazyFadeIn
      visible
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.headerMeta}>
          {resolvedUserPicture ? (
            <FadeInImage
              source={{ uri: resolvedUserPicture }}
              style={styles.avatar}
            />
          ) : (
            <View
              style={[styles.avatar, { backgroundColor: colors.surfaceAlt }]}
            >
              <ThemedText type="caption" style={styles.avatarText}>
                {initials}
              </ThemedText>
            </View>
          )}
          <View style={styles.headerInfo}>
            <Pressable
              onPress={handleOpenProfile}
              style={styles.profileTapTarget}
            >
              <ThemedText type="defaultSemiBold" style={styles.username}>
                {username}
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={handleOpenStream}
              style={styles.streamTapTarget}
            >
              <ThemedText type="caption" style={{ color: colors.tint }}>
                {projectName}
              </ThemedText>
            </Pressable>
          </View>
        </View>
        <View style={styles.headerActions}>
          <TagChip label={projectStage} tone="accent" />
        </View>
      </View>
      {isEditing ? (
        <View style={styles.editBlock}>
          <View style={styles.mediaSection}>
            <View style={styles.mediaActions}>
              <Pressable
                onPress={() => handleAddEditMedia("library")}
                style={[styles.mediaButton, { borderColor: colors.border }]}
                disabled={isUploadingMedia}
              >
                <ThemedText type="caption" style={{ color: colors.muted }}>
                  Add photo/video
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => handleAddEditMedia("file")}
                style={[styles.mediaButton, { borderColor: colors.border }]}
                disabled={isUploadingMedia}
              >
                <ThemedText type="caption" style={{ color: colors.muted }}>
                  Add file
                </ThemedText>
              </Pressable>
            </View>
            {isUploadingMedia ? (
              <View style={styles.uploadingRow}>
                <ActivityIndicator size="small" color={colors.muted} />
                <ThemedText type="caption" style={{ color: colors.muted }}>
                  Uploading...
                </ThemedText>
              </View>
            ) : null}
            {editMedia.length ? (
              <View style={styles.mediaChips}>
                {editMedia.map((item) => (
                  <Pressable
                    key={item}
                    onPress={() => handleRemoveEditMedia(item)}
                    style={[styles.mediaChip, { borderColor: colors.border }]}
                  >
                    <ThemedText type="caption" style={{ color: colors.muted }}>
                      {getMediaLabel(item)} ×
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <MediaGallery media={editMedia} />
          </View>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Update your byte"
            placeholderTextColor={colors.muted}
            style={[
              styles.editInput,
              {
                color: colors.text,
                borderColor: colors.border,
                backgroundColor: colors.surfaceAlt,
              },
            ]}
            multiline
          />
          <View style={styles.editActions}>
            <Pressable
              onPress={handleDelete}
              style={[
                styles.editButton,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceAlt,
                },
              ]}
              disabled={isUpdating || isDeleting}
            >
              <ThemedText type="caption" style={{ color: colors.muted }}>
                Delete
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={handleCancelEdit}
              style={[styles.editButton, { borderColor: colors.border }]}
              disabled={isUpdating}
            >
              <ThemedText type="caption" style={{ color: colors.muted }}>
                Cancel
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={handleSaveEdit}
              style={[styles.editButton, { backgroundColor: colors.tint }]}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <ActivityIndicator size="small" color={colors.onTint} />
              ) : (
                <ThemedText type="caption" style={{ color: colors.onTint }}>
                  Save
                </ThemedText>
              )}
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable onPress={handleOpenPost}>
          <View
            style={[
              styles.contentWrapper,
              isLongContent && isTruncated ? styles.contentClamped : null,
            ]}
          >
            <MarkdownText>{renderedContent}</MarkdownText>
            {isLongContent && isTruncated ? (
              <LinearGradient
                pointerEvents="none"
                colors={["transparent", colors.surface]}
                style={styles.contentFade}
              />
            ) : null}
          </View>
          {isLongContent ? (
            <ThemedText type="caption" style={{ color: colors.muted }}>
              Long byte preview · tap to open full byte
            </ThemedText>
          ) : null}
        </Pressable>
      )}
      <View style={styles.detailsBlock}>
        <MediaGallery media={localMedia} />
        <View style={styles.tagRow}>
          {tags.map((tag) => (
            <TagChip key={tag} label={tag} />
          ))}
        </View>
        <View style={styles.footer}>
          <View style={styles.footerActionsRow}>
            <Animated.View style={{ transform: [{ scale: likeScale }] }}>
              <PostAction
                icon="heart"
                label={likeCount}
                onPress={handleToggleLike}
                color={isLiked ? colors.tint : colors.muted}
                glow={isLiked}
              />
            </Animated.View>
            <PostAction
              icon="message-circle"
              label={commentCount}
              onPress={handleOpenPost}
            />
            <PostAction
              icon="bookmark"
              label={saveCount}
              color={isSavedLocal ? colors.tint : colors.muted}
              onPress={handleToggleSave}
            />
          </View>
          <ThemedText type="caption" style={{ color: colors.muted }}>
            {dateLabel} · {timeLabel}
          </ThemedText>
        </View>
      </View>
    </LazyFadeIn>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 10,
    borderWidth: 1,
    gap: 10,
    minHeight: 172,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerInfo: {
    flex: 1,
  },
  profileTapTarget: {
    alignSelf: "flex-start",
    paddingVertical: 2,
    paddingRight: 8,
  },
  streamTapTarget: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingRight: 10,
    marginTop: 1,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    letterSpacing: 1,
  },
  username: {
    fontSize: 15,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  detailsBlock: {
    gap: 8,
    minHeight: 98,
  },
  footer: {
    gap: 4,
    minHeight: 42,
  },
  footerActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.96 }],
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionTouch: {
    minHeight: 34,
    minWidth: 44,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 4,
  },
  actionShell: {
    borderRadius: 8,
    justifyContent: "center",
  },
  actionPressed: {
    opacity: 0.78,
  },
  editBlock: {
    gap: 10,
  },
  editInput: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontFamily: "SpaceMono",
    fontSize: 14,
    minHeight: 100,
  },
  editActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  editButton: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
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
  contentWrapper: {
    position: "relative",
    minHeight: 56,
  },
  contentClamped: {
    maxHeight: 148,
    overflow: "hidden",
  },
  contentFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 32,
  },
});
