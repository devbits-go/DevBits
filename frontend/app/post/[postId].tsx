import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
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
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { ApiComment, ApiPost, ApiProject, ApiUser } from "@/constants/Types";
import {
  clearApiCache,
  createCommentOnPost,
  deleteComment,
  deletePost,
  getCommentsByPostId,
  getPostById,
  getProjectById,
  getUserById,
  isCommentLiked,
  likeComment,
  updateComment,
  updatePost,
  uploadMedia,
  unlikeComment,
} from "@/services/api";
import {
  emitPostDeleted,
  emitPostStats,
  emitPostUpdated,
  subscribeToPostEvents,
} from "@/services/postEvents";
import { TagChip } from "@/components/TagChip";
import { ThemedText } from "@/components/ThemedText";
import { TopBlur } from "@/components/TopBlur";
import { MarkdownText } from "@/components/MarkdownText";
import { MediaGallery } from "@/components/MediaGallery";
import { useAuth } from "@/contexts/AuthContext";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { useAppColors } from "@/hooks/useAppColors";
import { useMotionConfig } from "@/hooks/useMotionConfig";
import { useTopBlurScroll } from "@/hooks/useTopBlurScroll";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";

type CommentState = {
  data: ApiComment;
  author?: ApiUser | null;
  liked: boolean;
};

export default function PostDetailScreen() {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { postId } = useLocalSearchParams<{ postId?: string }>();
  const { user } = useAuth();
  const motion = useMotionConfig();
  const reveal = useRef(new Animated.Value(0)).current;
  const { scrollY, onScroll } = useTopBlurScroll();
  const [post, setPost] = useState<ApiPost | null>(null);
  const [project, setProject] = useState<ApiProject | null>(null);
  const [author, setAuthor] = useState<ApiUser | null>(null);
  const [comments, setComments] = useState<CommentState[]>([]);
  const [content, setContent] = useState("");
  const [commentMedia, setCommentMedia] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [postDraft, setPostDraft] = useState("");
  const [postEditMedia, setPostEditMedia] = useState<string[]>([]);
  const [isPostUpdating, setIsPostUpdating] = useState(false);
  const [isPostDeleting, setIsPostDeleting] = useState(false);
  const [isPostMediaUploading, setIsPostMediaUploading] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [editingCommentMedia, setEditingCommentMedia] = useState<string[]>([]);
  const [isCommentUpdating, setIsCommentUpdating] = useState(false);
  const [isCommentMediaUploading, setIsCommentMediaUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const postIdNumber = useMemo(() => Number(postId), [postId]);

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

  const loadPost = useCallback(
    async (showLoader = true) => {
      if (!postIdNumber) {
        if (showLoader) {
          setIsLoading(false);
        }
        return;
      }
      try {
        if (showLoader) {
          setIsLoading(true);
        }
        const postData = await getPostById(postIdNumber);
        const [postAuthor, postProject, postComments] = await Promise.all([
          getUserById(postData.user).catch(() => null),
          getProjectById(postData.project).catch(() => null),
          getCommentsByPostId(postData.id),
        ]);

        const safeComments = Array.isArray(postComments) ? postComments : [];

        const commentStates = await Promise.all(
          safeComments.map(async (comment) => {
            const [commentAuthor, likedStatus] = await Promise.all([
              getUserById(comment.user).catch(() => null),
              user?.username
                ? isCommentLiked(user.username, comment.id).catch(() => ({
                    status: false,
                  }))
                : Promise.resolve({ status: false }),
            ]);
            return {
              data: comment,
              author: commentAuthor,
              liked: likedStatus.status,
            };
          }),
        );

        setPost(postData);
        setAuthor(postAuthor);
        setProject(postProject);
        setComments(commentStates);
        setErrorMessage("");
      } catch {
        setErrorMessage("Unable to load post.");
      } finally {
        if (showLoader) {
          setIsLoading(false);
        }
      }
    },
    [postIdNumber, user?.username],
  );

  useEffect(() => {
    loadPost();
  }, [loadPost]);

  useEffect(() => {
    if (post && !isEditingPost) {
      setPostDraft(post.content);
      setPostEditMedia(post.media ?? []);
    }
  }, [isEditingPost, post]);

  useFocusEffect(
    useCallback(() => {
      clearApiCache();
      loadPost(false);
    }, [loadPost]),
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    clearApiCache();
    await loadPost(false);
    setIsRefreshing(false);
  }, [loadPost]);

  useAutoRefresh(() => loadPost(false), { focusRefresh: false });

  useEffect(() => {
    if (!post?.id) {
      return;
    }
    return subscribeToPostEvents((event) => {
      if (event.postId !== post.id) {
        return;
      }
      if (event.type === "updated") {
        setPost((prev) =>
          prev
            ? {
                ...prev,
                content: event.content,
                media: event.media ?? prev.media,
              }
            : prev,
        );
      }
      if (event.type === "stats") {
        if (typeof event.likes === "number") {
          setPost((prev) =>
            prev ? { ...prev, likes: event.likes ?? prev.likes } : prev,
          );
        }
      }
      if (event.type === "deleted") {
        router.back();
      }
    });
  }, [post?.id, router]);

  const canEditPost = !!user?.id && !!post && post.user === user.id;
  const handleOpenProfile = (username?: string | null) => {
    if (!username) {
      return;
    }
    router.push({ pathname: "/user/[username]", params: { username } });
  };

  const getMediaLabel = (url: string) => {
    const trimmed = url.split("?")[0].split("#")[0];
    return trimmed.split("/").pop() || "attachment";
  };

  const handleSubmit = async () => {
    if (!user?.id || !post) {
      return;
    }
    if (!content.trim()) {
      setErrorMessage("Comment cannot be empty.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    try {
      await createCommentOnPost(post.id, {
        user: user.id,
        content: content.trim(),
        parent_comment: null,
        media: commentMedia,
      });
      setContent("");
      setCommentMedia([]);
      const refreshed = await getCommentsByPostId(post.id);
      const safeComments = Array.isArray(refreshed) ? refreshed : [];
      const commentStates = await Promise.all(
        safeComments.map(async (comment) => {
          const commentAuthor = await getUserById(comment.user).catch(
            () => null,
          );
          const likedStatus = user?.username
            ? await isCommentLiked(user.username, comment.id).catch(() => ({
                status: false,
              }))
            : { status: false };
          return {
            data: comment,
            author: commentAuthor,
            liked: likedStatus.status,
          };
        }),
      );
      setComments(commentStates);
      emitPostStats(post.id, { comments: commentStates.length });
    } catch (error) {
      setErrorMessage("Failed to post comment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddCommentMedia = async (source: "file" | "library") => {
    if (isUploadingMedia) {
      return;
    }
    setIsUploadingMedia(true);
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
      setCommentMedia((prev) => [...prev, ...urls]);
    } catch {
      setErrorMessage("Upload failed. Try again.");
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const handleStartEditPost = () => {
    if (!post) {
      return;
    }
    setPostDraft(post.content);
    setPostEditMedia(post.media ?? []);
    setIsEditingPost(true);
    setErrorMessage("");
  };

  const handleCancelEditPost = () => {
    if (post) {
      setPostDraft(post.content);
      setPostEditMedia(post.media ?? []);
    }
    setIsEditingPost(false);
  };

  const handleAddPostMedia = async (source: "file" | "library") => {
    if (isPostMediaUploading) {
      return;
    }
    setIsPostMediaUploading(true);
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
      setPostEditMedia((prev) => [...prev, ...urls]);
    } catch {
      setErrorMessage("Upload failed. Try again.");
    } finally {
      setIsPostMediaUploading(false);
    }
  };

  const handleRemovePostMedia = (url: string) => {
    setPostEditMedia((prev) => prev.filter((item) => item !== url));
  };

  const handleSavePost = async () => {
    if (!post) {
      return;
    }
    if (!postDraft.trim()) {
      setErrorMessage("Post cannot be empty.");
      return;
    }
    setIsPostUpdating(true);
    setErrorMessage("");
    try {
      const response = await updatePost(post.id, {
        content: postDraft.trim(),
        media: postEditMedia,
      });
      const nextPost = response?.post ?? {
        ...post,
        content: postDraft.trim(),
        media: postEditMedia,
      };
      setPost(nextPost);
      setIsEditingPost(false);
      emitPostUpdated(nextPost.id, nextPost.content, nextPost.media ?? []);
    } catch {
      setErrorMessage("Failed to update post.");
    } finally {
      setIsPostUpdating(false);
    }
  };

  const handleDeletePost = () => {
    if (!post || isPostDeleting) {
      return;
    }
    Alert.alert("Delete byte?", "This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void (async () => {
            setIsPostDeleting(true);
            setErrorMessage("");
            try {
              await deletePost(post.id);
              emitPostDeleted(post.id);
              router.back();
            } catch {
              setErrorMessage("Failed to delete post.");
            } finally {
              setIsPostDeleting(false);
            }
          })();
        },
      },
    ]);
  };

  const handleToggleLike = async (comment: CommentState) => {
    if (!user?.username) {
      return;
    }
    try {
      if (comment.liked) {
        await unlikeComment(user.username, comment.data.id);
      } else {
        await likeComment(user.username, comment.data.id);
      }
      setComments((prev) =>
        prev.map((item) =>
          item.data.id === comment.data.id
            ? {
                ...item,
                liked: !item.liked,
                data: {
                  ...item.data,
                  likes: item.liked
                    ? Math.max(0, item.data.likes - 1)
                    : item.data.likes + 1,
                },
              }
            : item,
        ),
      );
    } catch {
      // keep current state
    }
  };

  const handleStartEditComment = (comment: CommentState) => {
    setEditingCommentId(comment.data.id);
    setEditingCommentText(comment.data.content);
    setEditingCommentMedia(comment.data.media ?? []);
  };

  const handleCancelEditComment = () => {
    setEditingCommentId(null);
    setEditingCommentText("");
    setEditingCommentMedia([]);
  };

  const handleAddEditCommentMedia = async (source: "file" | "library") => {
    if (!editingCommentId || isCommentMediaUploading) {
      return;
    }
    setIsCommentMediaUploading(true);
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
      setEditingCommentMedia((prev) => [...prev, ...urls]);
    } catch {
      setErrorMessage("Upload failed. Try again.");
    } finally {
      setIsCommentMediaUploading(false);
    }
  };

  const handleRemoveEditCommentMedia = (url: string) => {
    setEditingCommentMedia((prev) => prev.filter((item) => item !== url));
  };

  const handleSaveComment = async () => {
    if (!editingCommentId) {
      return;
    }
    if (!editingCommentText.trim()) {
      setErrorMessage("Comment cannot be empty.");
      return;
    }
    setIsCommentUpdating(true);
    setErrorMessage("");
    try {
      const response = await updateComment(editingCommentId, {
        content: editingCommentText.trim(),
        media: editingCommentMedia,
      });
      const nextContent =
        response?.comment?.content ?? editingCommentText.trim();
      setComments((prev) =>
        prev.map((item) =>
          item.data.id === editingCommentId
            ? {
                ...item,
                data: {
                  ...item.data,
                  content: nextContent,
                  media: response?.comment?.media ?? editingCommentMedia,
                },
              }
            : item,
        ),
      );
      setEditingCommentId(null);
      setEditingCommentText("");
      setEditingCommentMedia([]);
    } catch {
      setErrorMessage("Failed to update comment.");
    } finally {
      setIsCommentUpdating(false);
    }
  };

  const handleDeleteComment = (commentId: number) => {
    Alert.alert("Delete comment?", "This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void (async () => {
            setErrorMessage("");
            try {
              await deleteComment(commentId);
              setComments((prev) => {
                const next = prev.filter((item) => item.data.id !== commentId);
                if (post?.id) {
                  emitPostStats(post.id, { comments: next.length });
                }
                return next;
              });
              if (editingCommentId === commentId) {
                handleCancelEditComment();
              }
            } catch {
              setErrorMessage("Failed to delete comment.");
            }
          })();
        },
      },
    ]);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safeArea} edges={[]}>
        <KeyboardAvoidingView
          style={styles.safeArea}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <Animated.ScrollView
              contentInsetAdjustmentBehavior="never"
              onScroll={onScroll}
              scrollEventThrottle={16}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={handleRefresh}
                  tintColor={colors.tint}
                />
              }
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerStyle={[
                styles.container,
                {
                  paddingTop: insets.top + 8,
                  paddingBottom: 96 + insets.bottom,
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
                      Loading post...
                    </ThemedText>
                  </View>
                ) : post ? (
                  <>
                    <View
                      style={[
                        styles.postCard,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <View style={styles.postHeader}>
                        <Pressable
                          onPress={() => handleOpenProfile(author?.username)}
                        >
                          <ThemedText type="defaultSemiBold">
                            {author?.username ?? "Unknown"}
                          </ThemedText>
                          <ThemedText
                            type="caption"
                            style={{ color: colors.muted }}
                          >
                            {project?.name ?? "Project"}
                          </ThemedText>
                        </Pressable>
                        <View style={styles.postHeaderActions}>
                          {project?.status !== undefined ? (
                            <TagChip
                              label={
                                project.status === 2
                                  ? "launch"
                                  : project.status === 1
                                    ? "beta"
                                    : "alpha"
                              }
                              tone="accent"
                            />
                          ) : null}
                          {canEditPost ? (
                            <View style={styles.postActionRow}>
                              <Pressable
                                onPress={handleStartEditPost}
                                style={({ pressed }) => [
                                  styles.iconButton,
                                  pressed && styles.iconButtonPressed,
                                ]}
                                disabled={isPostUpdating || isPostDeleting}
                              >
                                <Feather
                                  name="edit-3"
                                  size={14}
                                  color={colors.muted}
                                />
                              </Pressable>
                              <Pressable
                                onPress={handleDeletePost}
                                style={({ pressed }) => [
                                  styles.iconButton,
                                  pressed && styles.iconButtonPressed,
                                ]}
                                disabled={isPostUpdating || isPostDeleting}
                              >
                                <Feather
                                  name="trash-2"
                                  size={14}
                                  color={colors.muted}
                                />
                              </Pressable>
                            </View>
                          ) : null}
                        </View>
                      </View>
                      {isEditingPost ? (
                        <View style={styles.editBlock}>
                          <TextInput
                            value={postDraft}
                            onChangeText={setPostDraft}
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
                          <View style={styles.commentMediaSection}>
                            <View style={styles.commentMediaActions}>
                              <Pressable
                                onPress={() => handleAddPostMedia("library")}
                                style={[
                                  styles.mediaButton,
                                  { borderColor: colors.border },
                                ]}
                                disabled={isPostMediaUploading}
                              >
                                <ThemedText
                                  type="caption"
                                  style={{ color: colors.muted }}
                                >
                                  Add photo/video
                                </ThemedText>
                              </Pressable>
                              <Pressable
                                onPress={() => handleAddPostMedia("file")}
                                style={[
                                  styles.mediaButton,
                                  { borderColor: colors.border },
                                ]}
                                disabled={isPostMediaUploading}
                              >
                                <ThemedText
                                  type="caption"
                                  style={{ color: colors.muted }}
                                >
                                  Add file
                                </ThemedText>
                              </Pressable>
                            </View>
                            {isPostMediaUploading ? (
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
                            {postEditMedia.length ? (
                              <View style={styles.mediaChips}>
                                {postEditMedia.map((item) => (
                                  <Pressable
                                    key={item}
                                    onPress={() => handleRemovePostMedia(item)}
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
                            <MediaGallery media={postEditMedia} />
                          </View>
                          <View style={styles.editActions}>
                            <Pressable
                              onPress={handleCancelEditPost}
                              style={[
                                styles.editButton,
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
                              onPress={handleSavePost}
                              style={[
                                styles.editButton,
                                { backgroundColor: colors.tint },
                              ]}
                              disabled={isPostUpdating}
                            >
                              {isPostUpdating ? (
                                <ActivityIndicator
                                  size="small"
                                  color={colors.accent}
                                />
                              ) : (
                                <ThemedText
                                  type="caption"
                                  style={{ color: colors.accent }}
                                >
                                  Save
                                </ThemedText>
                              )}
                            </Pressable>
                          </View>
                        </View>
                      ) : (
                        <MarkdownText>{post.content}</MarkdownText>
                      )}
                      <MediaGallery media={post.media} />
                      <View style={styles.metaRow}>
                        <Feather name="heart" size={14} color={colors.muted} />
                        <ThemedText
                          type="caption"
                          style={{ color: colors.muted }}
                        >
                          {post.likes} likes
                        </ThemedText>
                      </View>
                    </View>

                    <View style={styles.commentSection}>
                      <ThemedText type="subtitle">Comments</ThemedText>
                      {comments.length ? (
                        comments.map((comment) => (
                          <View
                            key={comment.data.id}
                            style={[
                              styles.commentCard,
                              {
                                borderColor: colors.border,
                                backgroundColor: colors.surface,
                              },
                            ]}
                          >
                            <View style={styles.commentHeader}>
                              <Pressable
                                onPress={() =>
                                  handleOpenProfile(comment.author?.username)
                                }
                              >
                                <ThemedText type="caption">
                                  {comment.author?.username ?? "Unknown"}
                                </ThemedText>
                              </Pressable>
                              <View style={styles.commentActions}>
                                <Pressable
                                  style={styles.likeButton}
                                  onPress={() => handleToggleLike(comment)}
                                >
                                  <Feather
                                    name="heart"
                                    size={14}
                                    color={
                                      comment.liked ? colors.tint : colors.muted
                                    }
                                  />
                                  <ThemedText
                                    type="caption"
                                    style={{
                                      color: comment.liked
                                        ? colors.tint
                                        : colors.muted,
                                    }}
                                  >
                                    {comment.data.likes}
                                  </ThemedText>
                                </Pressable>
                                {comment.data.user === user?.id ? (
                                  <View style={styles.inlineActionRow}>
                                    <Pressable
                                      onPress={() =>
                                        handleStartEditComment(comment)
                                      }
                                      style={({ pressed }) => [
                                        styles.iconButton,
                                        pressed && styles.iconButtonPressed,
                                      ]}
                                    >
                                      <Feather
                                        name="edit-3"
                                        size={14}
                                        color={colors.muted}
                                      />
                                    </Pressable>
                                    <Pressable
                                      onPress={() =>
                                        handleDeleteComment(comment.data.id)
                                      }
                                      style={({ pressed }) => [
                                        styles.iconButton,
                                        pressed && styles.iconButtonPressed,
                                      ]}
                                    >
                                      <Feather
                                        name="trash-2"
                                        size={14}
                                        color={colors.muted}
                                      />
                                    </Pressable>
                                  </View>
                                ) : null}
                              </View>
                            </View>
                            {editingCommentId === comment.data.id ? (
                              <View style={styles.editBlock}>
                                <TextInput
                                  value={editingCommentText}
                                  onChangeText={setEditingCommentText}
                                  placeholder="Update comment"
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
                                <View style={styles.commentMediaSection}>
                                  <View style={styles.commentMediaActions}>
                                    <Pressable
                                      onPress={() =>
                                        handleAddEditCommentMedia("library")
                                      }
                                      style={[
                                        styles.mediaButton,
                                        { borderColor: colors.border },
                                      ]}
                                      disabled={isCommentMediaUploading}
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
                                        handleAddEditCommentMedia("file")
                                      }
                                      style={[
                                        styles.mediaButton,
                                        { borderColor: colors.border },
                                      ]}
                                      disabled={isCommentMediaUploading}
                                    >
                                      <ThemedText
                                        type="caption"
                                        style={{ color: colors.muted }}
                                      >
                                        Add file
                                      </ThemedText>
                                    </Pressable>
                                  </View>
                                  {isCommentMediaUploading ? (
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
                                  {editingCommentMedia.length ? (
                                    <View style={styles.mediaChips}>
                                      {editingCommentMedia.map((item) => (
                                        <Pressable
                                          key={item}
                                          onPress={() =>
                                            handleRemoveEditCommentMedia(item)
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
                                  <MediaGallery media={editingCommentMedia} />
                                </View>
                                <View style={styles.editActions}>
                                  <Pressable
                                    onPress={handleCancelEditComment}
                                    style={[
                                      styles.editButton,
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
                                    onPress={handleSaveComment}
                                    style={[
                                      styles.editButton,
                                      { backgroundColor: colors.tint },
                                    ]}
                                    disabled={isCommentUpdating}
                                  >
                                    {isCommentUpdating ? (
                                      <ActivityIndicator
                                        size="small"
                                        color={colors.accent}
                                      />
                                    ) : (
                                      <ThemedText
                                        type="caption"
                                        style={{ color: colors.accent }}
                                      >
                                        Save
                                      </ThemedText>
                                    )}
                                  </Pressable>
                                </View>
                              </View>
                            ) : (
                              <>
                                <MarkdownText>
                                  {comment.data.content}
                                </MarkdownText>
                                <MediaGallery media={comment.data.media} />
                              </>
                            )}
                          </View>
                        ))
                      ) : (
                        <View style={styles.emptyState}>
                          <ThemedText
                            type="caption"
                            style={{ color: colors.muted }}
                          >
                            No comments yet. Start the thread.
                          </ThemedText>
                        </View>
                      )}
                    </View>

                    <View style={styles.commentComposerBlock}>
                      <View
                        style={[
                          styles.composer,
                          {
                            borderColor: colors.border,
                            backgroundColor: colors.surface,
                          },
                        ]}
                      >
                        <TextInput
                          value={content}
                          onChangeText={setContent}
                          placeholder="Add a comment"
                          placeholderTextColor={colors.muted}
                          style={[styles.input, { color: colors.text }]}
                        />
                        <Pressable
                          onPress={handleSubmit}
                          style={[
                            styles.submitButton,
                            { backgroundColor: colors.tint },
                          ]}
                          disabled={isSubmitting || isUploadingMedia}
                        >
                          {isSubmitting ? (
                            <ActivityIndicator
                              size="small"
                              color={colors.accent}
                            />
                          ) : (
                            <ThemedText
                              type="caption"
                              style={{ color: colors.accent }}
                            >
                              Send
                            </ThemedText>
                          )}
                        </Pressable>
                      </View>
                      <View style={styles.commentMediaSection}>
                        <View style={styles.commentMediaActions}>
                          <Pressable
                            onPress={() => handleAddCommentMedia("library")}
                            style={[
                              styles.mediaButton,
                              { borderColor: colors.border },
                            ]}
                          >
                            <ThemedText
                              type="caption"
                              style={{ color: colors.muted }}
                            >
                              Add photo/video
                            </ThemedText>
                          </Pressable>
                          <Pressable
                            onPress={() => handleAddCommentMedia("file")}
                            style={[
                              styles.mediaButton,
                              { borderColor: colors.border },
                            ]}
                          >
                            <ThemedText
                              type="caption"
                              style={{ color: colors.muted }}
                            >
                              Add file
                            </ThemedText>
                          </Pressable>
                        </View>
                        {isUploadingMedia ? (
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
                        <MediaGallery media={commentMedia} />
                      </View>
                      {errorMessage ? (
                        <ThemedText
                          type="caption"
                          style={{ color: colors.muted }}
                        >
                          {errorMessage}
                        </ThemedText>
                      ) : null}
                    </View>
                  </>
                ) : (
                  <View style={styles.emptyState}>
                    <ThemedText type="caption" style={{ color: colors.muted }}>
                      {errorMessage || "Post not found."}
                    </ThemedText>
                  </View>
                )}
              </Animated.View>
            </Animated.ScrollView>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </SafeAreaView>
      <TopBlur scrollY={scrollY} />
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
    paddingHorizontal: 0,
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
    paddingVertical: 16,
  },
  postCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    gap: 12,
  },
  postHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  postHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  postActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  commentSection: {
    gap: 16,
    paddingTop: 4,
  },
  commentComposerBlock: {
    gap: 10,
    paddingTop: 4,
  },
  commentCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  commentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  commentActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  inlineActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  likeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  editBlock: {
    gap: 10,
  },
  editInput: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: "SpaceMono",
    fontSize: 14,
  },
  editActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  editButton: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: "center",
    minWidth: 72,
  },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    fontFamily: "SpaceMono",
  },
  submitButton: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  commentMediaSection: {
    gap: 10,
    paddingHorizontal: 2,
  },
  commentMediaActions: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
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
});
