import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { FadeInImage } from "@/components/FadeInImage";
import { ThemedText } from "@/components/ThemedText";
import { useAppColors } from "@/hooks/useAppColors";
import { resolveMediaUrl } from "@/services/api";

type UserCardProps = {
  username: string;
  picture?: string | null;
  isFollowing?: boolean;
  onPress?: () => void;
  onToggleFollow?: () => void;
  showFollow?: boolean;
};

export function UserCard({
  username,
  picture,
  isFollowing,
  onPress,
  onToggleFollow,
  showFollow = true,
}: UserCardProps) {
  const colors = useAppColors();
  const resolvedPicture = resolveMediaUrl(picture ?? "");
  const [picFailed, setPicFailed] = React.useState(false);
  const showPicture = Boolean(resolvedPicture) && !picFailed;
  const initial = username?.[0]?.toUpperCase() ?? "?";

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.header}>
        <View
          style={[
            styles.avatar,
            { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
          ]}
        >
          {showPicture ? (
            <FadeInImage
              source={{ uri: resolvedPicture }}
              style={styles.avatarImage}
              onLoadFailed={() => setPicFailed(true)}
            />
          ) : (
            <ThemedText type="caption" style={{ color: colors.muted }}>
              {initial}
            </ThemedText>
          )}
        </View>
        <View style={styles.text}>
          <ThemedText type="defaultSemiBold">{username}</ThemedText>
        </View>
      </View>
      {showFollow ? (
        <Pressable
          onPress={onToggleFollow}
          style={({ pressed }) => [
            styles.followButton,
            { backgroundColor: colors.tint },
            pressed && styles.pressed,
          ]}
        >
          <ThemedText type="caption" style={{ color: colors.onTint }}>
            {isFollowing ? "Following" : "Follow"}
          </ThemedText>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 10,
    minHeight: 90,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  text: {
    flex: 1,
    minHeight: 20,
  },
  followButton: {
    alignSelf: "flex-start",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minHeight: 30,
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
});
