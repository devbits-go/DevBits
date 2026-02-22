import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { UiProject } from "@/constants/Types";
import { ThemedText } from "@/components/ThemedText";
import { MarkdownText } from "@/components/MarkdownText";
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

type RetroActionButtonProps = {
  icon: keyof typeof Feather.glyphMap;
  label: string | number;
  active?: boolean;
  onPress: () => void;
};

function RetroActionButton({
  icon,
  label,
  active,
  onPress,
}: RetroActionButtonProps) {
  const colors = useAppColors();
  const scale = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(glowAnim, {
      toValue: active ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [active, glowAnim]);

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
        styles.metaItem,
        {
          shadowColor: colors.tint,
          shadowOpacity: glowAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.05, 0.32],
          }) as unknown as number,
          shadowRadius: glowAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [2, 8],
          }) as unknown as number,
          shadowOffset: { width: 0, height: 0 },
          elevation: active ? 3 : 1,
        },
      ]}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Pressable
          hitSlop={10}
          onPressIn={() => animateTo(0.94)}
          onPressOut={() => animateTo(1)}
          onPress={onPress}
          style={({ pressed }) => [
            styles.metaTouch,
            pressed && styles.metaPressed,
          ]}
        >
          <Feather
            name={icon}
            size={15}
            color={active ? colors.tint : colors.muted}
          />
          <ThemedText
            type="caption"
            style={{ color: active ? colors.tint : colors.muted }}
          >
            {label}
          </ThemedText>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

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
  const desiredLikeRef = useRef<boolean | null>(null);
  const desiredSaveRef = useRef<boolean | null>(null);
  const pendingEmitRef = useRef<{
    likes?: number;
    saves?: number;
    isLiked?: boolean;
  } | null>(null);
  const summaryCharLimit = 220;
  const summaryText =
    project.summary.length > summaryCharLimit
      ? `${project.summary.slice(0, summaryCharLimit).trimEnd()}…`
      : project.summary;
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
    if (!user?.username) {
      return;
    }

    const nextLiked = !isLiked;
    const nextLikes = Math.max(0, likeCount + (nextLiked ? 1 : -1));
    likeMutationRef.current = { value: nextLiked, ts: Date.now() };
    setIsLiked(nextLiked);
    setLikeCount(nextLikes);
    desiredLikeRef.current = nextLiked;
    pendingEmitRef.current = {
      ...(pendingEmitRef.current ?? {}),
      likes: nextLikes,
      isLiked: nextLiked,
    };

    if (isUpdating) {
      return;
    }

    setIsUpdating(true);
    try {
      while (desiredLikeRef.current !== null) {
        const targetLiked = desiredLikeRef.current;
        desiredLikeRef.current = null;

        if (targetLiked) {
          await likeProject(user.username, project.id);
        } else {
          await unlikeProject(user.username, project.id);
        }
      }
    } catch {
      try {
        const status = await isProjectLiked(user.username, project.id);
        setIsLiked(status.status);
      } catch {}
      const rollbackLikes = Math.max(0, likeCount);
      pendingEmitRef.current = {
        ...(pendingEmitRef.current ?? {}),
        likes: rollbackLikes,
        isLiked: isLiked,
      };
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveToggle = async () => {
    if (!user?.username) {
      return;
    }
    const nextSaved = !isSaved;
    const nextCount = Math.max(0, saveCount + (nextSaved ? 1 : -1));
    setIsSaved(nextSaved);
    setSaveCount(nextCount);
    desiredSaveRef.current = nextSaved;
    pendingEmitRef.current = {
      ...(pendingEmitRef.current ?? {}),
      saves: nextCount,
    };

    if (isSaving) {
      return;
    }

    setIsSaving(true);
    try {
      while (desiredSaveRef.current !== null) {
        const targetSaved = desiredSaveRef.current;
        desiredSaveRef.current = null;
        const currentlySaved = isStreamSaved(project.id);
        if (targetSaved !== currentlySaved) {
          await toggleSave(project.id);
          onSavedChange?.(targetSaved);
        }
      }
    } catch {
      const fallbackSaved = isStreamSaved(project.id);
      setIsSaved(fallbackSaved);
      setSaveCount(Math.max(0, saveCount));
      pendingEmitRef.current = {
        ...(pendingEmitRef.current ?? {}),
        saves: Math.max(0, saveCount),
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
        <View style={styles.summary}>
          <MarkdownText compact preferStatic>
            {summaryText}
          </MarkdownText>
        </View>
        <View style={styles.tagRow}>
          {isCreator ? (
            <TagChip label="Creator" tone="accent" />
          ) : isBuilder ? (
            <TagChip label="Builder" tone="accent" />
          ) : null}
          {project.tags.map((tag) => (
            <TagChip key={tag} label={tag} />
          ))}
        </View>
        <View style={styles.metaRow}>
          <Animated.View style={{ transform: [{ scale: likeScale }] }}>
            <RetroActionButton
              icon="heart"
              label={likeCount}
              active={isLiked}
              onPress={handleLikeToggle}
            />
          </Animated.View>
          <RetroActionButton
            icon="bookmark"
            label={saveCount}
            active={isSaved}
            onPress={handleSaveToggle}
          />
          <View style={styles.metaItem}>
            <Feather name="clock" size={14} color={colors.muted} />
            <ThemedText type="caption" style={{ color: colors.muted }}>
              {new Date(project.updated_on).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
              {" · "}
              {new Date(project.updated_on).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
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
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 8,
    minHeight: 156,
  },
  cardCompact: {
    minWidth: 220,
    maxWidth: 260,
    minHeight: 168,
  },
  cardFull: {
    width: "100%",
    alignSelf: "stretch",
    minHeight: 168,
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
    minHeight: 44,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    minHeight: 24,
  },
  metaRow: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
    minHeight: 34,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaTouch: {
    minHeight: 34,
    minWidth: 44,
    paddingHorizontal: 4,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  metaPressed: {
    opacity: 0.78,
  },
});
