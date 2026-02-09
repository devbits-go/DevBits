import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { UiProject } from "@/constants/Types";
import { ThemedText } from "@/components/ThemedText";
import { TagChip } from "@/components/TagChip";
import { useAppColors } from "@/hooks/useAppColors";
import { useAuth } from "@/contexts/AuthContext";
import {
  followProject,
  getProjectFollowing,
  isProjectLiked,
  likeProject,
  unfollowProject,
  unlikeProject,
} from "@/services/api";
import { useRouter } from "expo-router";

type ProjectCardProps = {
  project: UiProject;
  variant?: "compact" | "full";
  saved?: boolean;
  onSavedChange?: (saved: boolean) => void;
};

export function ProjectCard({
  project,
  variant = "compact",
  saved,
  onSavedChange,
}: ProjectCardProps) {
  const colors = useAppColors();
  const router = useRouter();
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(project.likes);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSaved, setIsSaved] = useState(Boolean(saved));
  const [isSaving, setIsSaving] = useState(false);
  const likeScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (typeof saved === "boolean") {
      setIsSaved(saved);
    }
  }, [saved]);

  useEffect(() => {
    let isMounted = true;
    const loadLike = async () => {
      if (!user?.username) {
        return;
      }
      try {
        const [status, following] = await Promise.all([
          isProjectLiked(user.username, project.id),
          typeof saved === "boolean"
            ? Promise.resolve(null)
            : getProjectFollowing(user.username).catch(() => null),
        ]);
        if (isMounted) {
          setIsLiked(status.status);
          if (following && Array.isArray(following)) {
            setIsSaved(following.includes(project.id));
          }
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
  }, [project.id, user?.username]);

  const handleLikeToggle = async () => {
    if (!user?.username || isUpdating) {
      return;
    }
    setIsUpdating(true);
    try {
      if (isLiked) {
        await unlikeProject(user.username, project.id);
        setIsLiked(false);
        setLikeCount((prev) => Math.max(0, prev - 1));
      } else {
        await likeProject(user.username, project.id);
        setIsLiked(true);
        setLikeCount((prev) => prev + 1);
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveToggle = async () => {
    if (!user?.username || isSaving) {
      return;
    }
    setIsSaving(true);
    try {
      if (isSaved) {
        await unfollowProject(user.username, project.id);
        setIsSaved(false);
        onSavedChange?.(false);
      } else {
        await followProject(user.username, project.id);
        setIsSaved(true);
        onSavedChange?.(true);
      }
    } catch {
      // Ignore conflicts when state is already in sync.
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

  return (
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
        >
          <Feather
            name={isSaved ? "bookmark" : "bookmark"}
            size={14}
            color={isSaved ? colors.tint : colors.muted}
          />
          <ThemedText
            type="caption"
            style={{ color: isSaved ? colors.tint : colors.muted }}
          >
            {isSaved ? "Saved" : "Save"}
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
