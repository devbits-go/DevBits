import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { UiProject } from "@/constants/Types";
import { ThemedText } from "@/components/ThemedText";
import { TagChip } from "@/components/TagChip";
import { useAppColors } from "@/hooks/useAppColors";
import { useAuth } from "@/contexts/AuthContext";
import { useSavedStreams } from "@/contexts/SavedStreamsContext";
import { LazyFadeIn } from "@/components/LazyFadeIn";
import { isProjectLiked, likeProject, unlikeProject } from "@/services/api";
import {
  emitProjectStats,
  subscribeToProjectEvents,
} from "@/services/projectEvents";
import { useRouter } from "expo-router";

type ProjectCardProps = {
  project: UiProject;
  variant?: "compact" | "full";
  saved?: boolean;
  isBuilder?: boolean;
  onSavedChange?: (saved: boolean) => void;
};

export function ProjectCard({
  project,
  variant = "compact",
  saved,
  isBuilder,
  onSavedChange,
}: ProjectCardProps) {
  const colors = useAppColors();
  const router = useRouter();
  const { user } = useAuth();
  const { isSaved: isStreamSaved, toggleSave } = useSavedStreams();
  const isCreator =
    typeof project.ownerId === "number" && user?.id === project.ownerId;
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(project.likes);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSaved, setIsSaved] = useState(Boolean(saved));
  const [isSaving, setIsSaving] = useState(false);
  const [saveCount, setSaveCount] = useState(project.saves ?? 0);
  const likeMutationRef = useRef<{ value: boolean; ts: number } | null>(null);
  const pendingEmitRef = useRef<{
    likes?: number;
    saves?: number;
    isLiked?: boolean;
  } | null>(null);
  const likeScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (typeof saved === "boolean") {
      setIsSaved(saved);
      return;
    }
    setIsSaved(isStreamSaved(project.id));
  }, [isStreamSaved, project.id, saved]);

  useEffect(() => {
    setLikeCount(project.likes ?? 0);
  }, [project.id, project.likes]);

  useEffect(() => {
    setSaveCount(project.saves ?? 0);
  }, [project.id, project.saves]);

  useEffect(() => {
    let isMounted = true;
    const loadLike = async () => {
      if (!user?.username) {
        return;
      }
      try {
        const status = await isProjectLiked(user.username, project.id);
        if (isMounted) {
          const mutation = likeMutationRef.current;
          if (
            mutation &&
            mutation.value === status.status &&
            Date.now() - mutation.ts < 2000
          ) {
            return;
          }
          setIsLiked(status.status);
        }
      } catch {
        if (isMounted) {
          setIsLiked(false);
        }
      }
    };
    loadLike();
    return () => {
      isMounted = false;
    };
  }, [project.id, saved, user?.username]);

  const handleLikeToggle = async () => {
    if (!user?.username || isUpdating) {
      return;
    }
    setIsUpdating(true);
    const nextLiked = !isLiked;
    const nextLikes = Math.max(0, likeCount + (nextLiked ? 1 : -1));
    likeMutationRef.current = { value: nextLiked, ts: Date.now() };
    setIsLiked(nextLiked);
    setLikeCount(nextLikes);
    pendingEmitRef.current = {
      ...(pendingEmitRef.current ?? {}),
      likes: nextLikes,
      isLiked: nextLiked,
    };
    try {
      if (nextLiked) {
        await likeProject(user.username, project.id);
      } else {
        await unlikeProject(user.username, project.id);
      }
    } catch {
      const rollbackLikes = likeCount;
      setIsLiked(isLiked);
      setLikeCount(rollbackLikes);
      pendingEmitRef.current = {
        ...(pendingEmitRef.current ?? {}),
        likes: rollbackLikes,
        isLiked,
      };
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveToggle = async () => {
    if (!user?.username || isSaving) {
      return;
    }
    setIsSaving(true);
    const nextSaved = !isSaved;
    const nextCount = Math.max(0, saveCount + (nextSaved ? 1 : -1));
    setIsSaved(nextSaved);
    setSaveCount(nextCount);
    pendingEmitRef.current = {
      ...(pendingEmitRef.current ?? {}),
      saves: nextCount,
    };
    try {
      await toggleSave(project.id);
      onSavedChange?.(nextSaved);
    } catch {
      const fallbackSaved = isStreamSaved(project.id);
      setIsSaved(fallbackSaved);
      setSaveCount(saveCount);
      pendingEmitRef.current = {
        ...(pendingEmitRef.current ?? {}),
        saves: saveCount,
      };
    } finally {
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
        duration: 140,
        useNativeDriver: true,
      }),
      Animated.timing(likeScale, {
        toValue: 1,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isLiked, likeScale]);

  useEffect(() => {
    return subscribeToProjectEvents((event) => {
      if (event.type !== "stats" || event.projectId !== project.id) {
        return;
      }
      if (typeof event.likes === "number") {
        setLikeCount(event.likes);
      }
      if (typeof event.saves === "number") {
        setSaveCount(event.saves);
      }
      if (typeof event.isLiked === "boolean") {
        setIsLiked(event.isLiked);
      }
    });
  }, [project.id]);

  useEffect(() => {
    if (!pendingEmitRef.current) {
      return;
    }
    const payload = pendingEmitRef.current;
    pendingEmitRef.current = null;
    emitProjectStats(project.id, payload);
  }, [likeCount, project.id, saveCount]);

  return (
    <LazyFadeIn visible>
      <Pressable
        onPress={() =>
          router.push({
            pathname: "/stream/[projectId]",
            params: { projectId: String(project.id) },
          })
        }
        style={[
          styles.card,
          variant === "compact" && styles.cardCompact,
          variant === "full" && styles.cardFull,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={styles.headerRow}>
          <View>
            <ThemedText type="defaultSemiBold" style={styles.name}>
              {project.name}
            </ThemedText>
            <ThemedText type="caption" style={{ color: colors.muted }}>
              {project.stage.toUpperCase()} · {project.contributors} builders
            </ThemedText>
          </View>
          <View style={[styles.stageDot, { backgroundColor: colors.tint }]} />
        </View>
        <ThemedText type="default" style={styles.summary}>
          {project.summary}
        </ThemedText>
        <View style={styles.tagRow}>
          {isCreator ? (
            <TagChip label="Creator" tone="accent" />
          ) : isBuilder ? (
            <TagChip label="Builder" />
          ) : null}
          {project.tags.map((tag) => (
            <TagChip key={tag} label={tag} />
          ))}
        </View>
        <View style={styles.metaRow}>
          <Animated.View style={{ transform: [{ scale: likeScale }] }}>
            <Pressable
              style={({ pressed }) => [
                styles.metaItem,
                isLiked && {
                  shadowColor: colors.tint,
                  shadowOpacity: 0.35,
                  shadowRadius: 6,
                  shadowOffset: { width: 0, height: 0 },
                  elevation: 2,
                },
                pressed && styles.metaPressed,
              ]}
              onPress={handleLikeToggle}
            >
              <Feather
                name="heart"
                size={14}
                color={isLiked ? colors.tint : colors.muted}
              />
              <ThemedText
                type="caption"
                style={{ color: isLiked ? colors.tint : colors.muted }}
              >
                {likeCount}
              </ThemedText>
            </Pressable>
          </Animated.View>
          <Pressable
            style={({ pressed }) => [
              styles.metaItem,
              pressed && styles.metaPressed,
            ]}
            onPress={handleSaveToggle}
            disabled={false}
          >
            <Feather
              name="bookmark"
              size={14}
              color={isSaved ? colors.tint : colors.muted}
            />
            <ThemedText
              type="caption"
              style={{ color: isSaved ? colors.tint : colors.muted }}
            >
              {saveCount}
            </ThemedText>
          </Pressable>
          <View style={styles.metaItem}>
            <Feather name="clock" size={14} color={colors.muted} />
            <ThemedText type="caption" style={{ color: colors.muted }}>
              {new Date(project.updated_on).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </ThemedText>
          </View>
        </View>
      </Pressable>
    </LazyFadeIn>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  cardCompact: {
    minWidth: 220,
    maxWidth: 260,
  },
  cardFull: {
    width: "100%",
    alignSelf: "stretch",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  name: {
    fontSize: 15,
  },
  stageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  summary: {
    fontSize: 13,
    lineHeight: 18,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  metaRow: {
    flexDirection: "row",
    gap: 16,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
});
