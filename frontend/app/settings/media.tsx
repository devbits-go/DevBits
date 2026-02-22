import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Animated, Pressable, StyleSheet, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { ThemedText } from "@/components/ThemedText";
import { TopBlur } from "@/components/TopBlur";
import { useAuth } from "@/contexts/AuthContext";
import { useAppColors } from "@/hooks/useAppColors";
import { useTopBlurScroll } from "@/hooks/useTopBlurScroll";
import {
  deleteMyManagedMedia,
  getMyManagedMedia,
  ManagedMediaItem,
  resolveMediaUrl,
} from "@/services/api";
import { FadeInImage } from "@/components/FadeInImage";

const isImageFile = (filename: string) =>
  /\.(png|jpe?g|gif|webp|heic|bmp|svg)$/i.test(filename);

export default function SettingsMediaScreen() {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { scrollY, onScroll } = useTopBlurScroll();

  const [items, setItems] = useState<ManagedMediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyFile, setBusyFile] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const username = user?.username ?? "";

  const load = useCallback(async () => {
    if (!username) {
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const response = await getMyManagedMedia(username);
      setItems(response.items ?? []);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Failed to load media.",
      );
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    void load();
  }, [load]);

  const deleteOne = useCallback(
    async (filename: string) => {
      if (!username) {
        return;
      }
      setBusyFile(filename);
      setMessage("");
      try {
        await deleteMyManagedMedia(username, { filenames: [filename] });
        setItems((prev) => prev.filter((item) => item.filename !== filename));
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Failed to delete media.",
        );
      } finally {
        setBusyFile(null);
      }
    },
    [username],
  );

  const deleteAll = useCallback(() => {
    if (!username || !items.length) {
      return;
    }
    Alert.alert(
      "Delete all media?",
      "This removes all uploaded media and files from your account.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete all",
          style: "destructive",
          onPress: async () => {
            setBusyFile("__all__");
            setMessage("");
            try {
              await deleteMyManagedMedia(username, { deleteAll: true });
              setItems([]);
            } catch (error) {
              setMessage(
                error instanceof Error
                  ? error.message
                  : "Failed to delete all media.",
              );
            } finally {
              setBusyFile(null);
            }
          },
        },
      ],
    );
  }, [items.length, username]);

  const header = useMemo(
    () => (
      <View style={styles.headerWrap}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            style={[styles.backBtn, { borderColor: colors.border }]}
          >
            <ThemedText type="defaultSemiBold">Back</ThemedText>
          </Pressable>
          <Pressable
            onPress={deleteAll}
            disabled={!items.length || busyFile !== null}
            style={[
              styles.deleteAllBtn,
              {
                borderColor: colors.border,
                opacity: !items.length || busyFile !== null ? 0.5 : 1,
              },
            ]}
          >
            <ThemedText type="defaultSemiBold" style={{ color: "#ff6b6b" }}>
              Delete All
            </ThemedText>
          </Pressable>
        </View>

        <ThemedText type="title">Your Media & Files</ThemedText>
        <ThemedText type="caption" style={{ color: colors.muted }}>
          Includes uploaded photos, videos, files, and profile picture files.
        </ThemedText>

        {message ? (
          <ThemedText type="caption" style={{ color: "#ff6b6b", marginTop: 8 }}>
            {message}
          </ThemedText>
        ) : null}
      </View>
    ),
    [
      busyFile,
      colors.border,
      colors.muted,
      deleteAll,
      items.length,
      message,
      router,
    ],
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.screen} edges={["top"]}>
        <Animated.FlatList
          data={items}
          keyExtractor={(item) => item.filename}
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: insets.bottom + 28,
            gap: 12,
          }}
          ListHeaderComponent={header}
          ListEmptyComponent={
            <View
              style={[
                styles.empty,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceAlt,
                },
              ]}
            >
              <ThemedText type="caption">
                {loading ? "Loading media..." : "No uploaded media found."}
              </ThemedText>
            </View>
          }
          renderItem={({ item }) => {
            const image = isImageFile(item.filename);
            const resolved = resolveMediaUrl(item.url);
            const deleting =
              busyFile === item.filename || busyFile === "__all__";

            return (
              <View
                style={[
                  styles.card,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceAlt,
                  },
                ]}
              >
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="defaultSemiBold" numberOfLines={1}>
                      {item.filename}
                    </ThemedText>
                    <ThemedText
                      type="caption"
                      style={{ color: colors.muted }}
                      numberOfLines={1}
                    >
                      {item.url}
                    </ThemedText>
                  </View>
                  <Pressable
                    onPress={() => deleteOne(item.filename)}
                    disabled={deleting}
                    style={[
                      styles.deleteBtn,
                      {
                        borderColor: colors.border,
                        opacity: deleting ? 0.5 : 1,
                      },
                    ]}
                  >
                    <ThemedText type="caption" style={{ color: "#ff6b6b" }}>
                      Delete
                    </ThemedText>
                  </Pressable>
                </View>
                {image ? (
                  <FadeInImage
                    source={{ uri: resolved }}
                    style={styles.preview}
                    resizeMode="cover"
                  />
                ) : null}
              </View>
            );
          }}
        />
      </SafeAreaView>
      <TopBlur scrollY={scrollY} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  headerWrap: { paddingTop: 8, gap: 8, marginBottom: 12 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  backBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  deleteAllBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  card: { borderWidth: 1, borderRadius: 14, padding: 10, gap: 10 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  deleteBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  preview: { width: "100%", height: 160, borderRadius: 10 },
  empty: { borderWidth: 1, borderRadius: 12, padding: 12 },
});
