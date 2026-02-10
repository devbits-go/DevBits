import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Post } from "@/components/Post";
import { ThemedText } from "@/components/ThemedText";
import { TopBlur } from "@/components/TopBlur";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { useAppColors } from "@/hooks/useAppColors";
import { useMotionConfig } from "@/hooks/useMotionConfig";
import { useSaved } from "@/contexts/SavedContext";
import {
  clearApiCache,
  getPostById,
  getProjectById,
  getUserById,
} from "@/services/api";
import { mapPostToUi } from "@/services/mappers";
import { subscribeToPostEvents } from "@/services/postEvents";

export default function SavedLibraryScreen() {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const { savedPostIds } = useSaved();
  const [posts, setPosts] = useState([] as ReturnType<typeof mapPostToUi>[]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const motion = useMotionConfig();
  const reveal = useRef(new Animated.Value(0)).current;

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

  const loadSaved = useCallback(
    async (showLoader = true) => {
      if (!savedPostIds.length) {
        setPosts([]);
        if (showLoader) {
          setIsLoading(false);
        }
        return;
      }
      try {
        if (showLoader) {
          setIsLoading(true);
        }
        const savedData = await Promise.all(
          savedPostIds.map(async (postId) => {
            try {
              const post = await getPostById(postId);
              const [postUser, postProject] = await Promise.all([
                getUserById(post.user).catch(() => null),
                getProjectById(post.project).catch(() => null),
              ]);
              return mapPostToUi(post, postUser, postProject);
            } catch {
              return null;
            }
          }),
        );

        setPosts(
          savedData.filter(
            (post): post is ReturnType<typeof mapPostToUi> => post !== null,
          ),
        );
      } finally {
        if (showLoader) {
          setIsLoading(false);
        }
      }
    },
    [savedPostIds],
  );

  useEffect(() => {
    loadSaved();
  }, [loadSaved]);

  useEffect(() => {
    return subscribeToPostEvents((event) => {
      setPosts((prev) => {
        if (event.type === "updated") {
          return prev.map((post) =>
            post.id === event.postId
              ? {
                  ...post,
                  content: event.content,
                  media: event.media ?? post.media,
                }
              : post,
          );
        }
        if (event.type === "stats") {
          return prev.map((post) =>
            post.id === event.postId
              ? {
                  ...post,
                  likes: event.likes ?? post.likes,
                  comments: event.comments ?? post.comments,
                }
              : post,
          );
        }
        if (event.type === "deleted") {
          return prev.filter((post) => post.id !== event.postId);
        }
        return prev;
      });
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      clearApiCache();
      loadSaved(false);
    }, [loadSaved]),
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    clearApiCache();
    await loadSaved(false);
    setIsRefreshing(false);
  }, [loadSaved]);

  useAutoRefresh(() => loadSaved(false), { focusRefresh: false });

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safeArea} edges={[]}>
        <ScrollView
          contentInsetAdjustmentBehavior="never"
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.tint}
            />
          }
          contentContainerStyle={[
            styles.container,
            { paddingTop: insets.top + 8, paddingBottom: 96 + insets.bottom },
          ]}
        >
          <Animated.View
            style={{
              opacity: reveal,
              transform: [
                {
                  translateY: reveal.interpolate({
                    inputRange: [0, 1],
                    outputRange: [16, 0],
                  }),
                },
              ],
            }}
          >
            <ThemedText type="display" style={styles.title}>
              Saved library
            </ThemedText>
            <ThemedText type="caption" style={{ color: colors.muted }}>
              Everything you bookmarked.
            </ThemedText>
          </Animated.View>

          {isLoading ? (
            <View style={styles.skeletonStack}>
              {[0, 1, 2].map((key) => (
                <View
                  key={key}
                  style={[
                    styles.skeletonCard,
                    {
                      backgroundColor: colors.surfaceAlt,
                      borderColor: colors.border,
                    },
                  ]}
                />
              ))}
            </View>
          ) : posts.length ? (
            posts.map((post) => <Post key={post.id} {...post} />)
          ) : (
            <View style={styles.emptyState}>
              <ThemedText type="caption" style={{ color: colors.muted }}>
                No saved bytes yet.
              </ThemedText>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
      <TopBlur />
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
    padding: 16,
    gap: 16,
    paddingTop: 0,
  },
  title: {
    fontSize: 26,
    lineHeight: 30,
  },
  skeletonStack: {
    gap: 12,
  },
  skeletonCard: {
    borderRadius: 14,
    height: 96,
    borderWidth: 1,
    opacity: 0.7,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 24,
  },
});
