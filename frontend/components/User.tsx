import { useState } from "react";
import { Alert, Modal, Pressable, StyleSheet, View } from "react-native";
import * as Linking from "expo-linking";
import { FadeInImage } from "@/components/FadeInImage";
import { ThemedText } from "@/components/ThemedText";
import { MarkdownText } from "@/components/MarkdownText";
import { UserProps } from "@/constants/Types";
import { useAppColors } from "@/hooks/useAppColors";
import { usePreferences } from "@/contexts/PreferencesContext";
import { resolveMediaUrl } from "@/services/api";

export default function User({
  username,
  bio,
  links,
  created_on,
  picture,
}: UserProps) {
  const colors = useAppColors();
  const { preferences } = usePreferences();
  const creationDate = new Date(created_on);
  const hasValidCreationDate = !Number.isNaN(creationDate.getTime());
  const safeLinks = Array.isArray(links) ? links : [];
  const resolvedPicture = resolveMediaUrl(picture);
  const [pictureFailed, setPictureFailed] = useState(false);
  const hasPicture = Boolean(resolvedPicture) && !pictureFailed;
  const [isImageOpen, setIsImageOpen] = useState(false);
  const openUrlSafe = async (url: string) => {
    const trimmed = url.trim();
    if (!/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
      if (preferences.linkOpenMode === "promptScheme") {
        Alert.alert("Open link", `"${trimmed}" is missing a scheme.`, [
          { text: "Cancel", style: "cancel" },
          {
            text: "Add http://",
            onPress: () => void openUrlSafe(`http://${trimmed}`),
          },
          {
            text: "Add https://",
            onPress: () => void openUrlSafe(`https://${trimmed}`),
          },
        ]);
        return;
      }
      const normalizedHost = trimmed.startsWith("www.")
        ? trimmed
        : `www.${trimmed}`;
      await openUrlSafe(`https://${normalizedHost}`);
      return;
    }
    const supported = await Linking.canOpenURL(trimmed);
    if (!supported) {
      Alert.alert("Unable to open link", trimmed);
      return;
    }
    await Linking.openURL(trimmed);
  };
  const initials = username
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {hasPicture ? (
          <Pressable
            onPress={() => setIsImageOpen(true)}
            style={({ pressed }) => [
              styles.avatarButton,
              pressed && styles.pressed,
            ]}
          >
            <FadeInImage
              source={{ uri: resolvedPicture }}
              style={styles.avatar}
              onLoadFailed={() => setPictureFailed(true)}
            />
          </Pressable>
        ) : (
          <View
            style={[
              styles.avatar,
              { backgroundColor: colors.surfaceAlt },
              styles.avatarFallback,
              { borderColor: colors.border },
            ]}
          >
            <ThemedText type="caption">{initials}</ThemedText>
          </View>
        )}
        <View style={styles.headerText}>
          <ThemedText type="title">{username}</ThemedText>
          <ThemedText type="caption" style={{ color: colors.muted }}>
            Joined{" "}
            {hasValidCreationDate
              ? creationDate.toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })
              : "Unknown"}
          </ThemedText>
        </View>
      </View>
      {bio?.trim() ? (
        <View style={styles.bio}>
          <MarkdownText>{bio}</MarkdownText>
        </View>
      ) : null}
      <View style={styles.links}>
        {safeLinks.map((link, index) => (
          <Pressable
            key={index}
            onPress={() => void openUrlSafe(link)}
            style={({ pressed }) => [pressed && styles.pressedInline]}
          >
            <ThemedText type="link" style={styles.link}>
              {link}
            </ThemedText>
          </Pressable>
        ))}
      </View>
      <Modal
        visible={isImageOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsImageOpen(false)}
      >
        <Pressable
          style={styles.viewerBackdrop}
          onPress={() => setIsImageOpen(false)}
        >
          <View style={styles.viewerCard}>
            {hasPicture ? (
              <FadeInImage
                source={{ uri: resolvedPicture }}
                style={styles.viewerImage}
                resizeMode="contain"
              />
            ) : null}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
    minHeight: 132,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 64,
  },
  headerText: {
    flex: 1,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarButton: {
    borderRadius: 32,
    overflow: "hidden",
  },
  avatarFallback: {
    borderWidth: 1,
  },
  bio: {
    marginTop: 2,
    minHeight: 24,
  },
  links: {
    gap: 6,
    minHeight: 20,
  },
  link: {
    lineHeight: 20,
  },
  viewerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  viewerCard: {
    width: "100%",
    height: "100%",
    padding: 24,
  },
  viewerImage: {
    width: "100%",
    height: "100%",
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.98 }],
  },
  pressedInline: {
    opacity: 0.8,
  },
});
