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
import { ProjectCard } from "@/components/ProjectCard";
import { ThemedText } from "@/components/ThemedText";
import { TopBlur } from "@/components/TopBlur";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { useAppColors } from "@/hooks/useAppColors";
import { useMotionConfig } from "@/hooks/useMotionConfig";
import { useSavedStreams } from "@/contexts/SavedStreamsContext";
import {
  clearApiCache,
  getProjectById,
  getProjectBuilders,
} from "@/services/api";
import { mapProjectToUi } from "@/services/mappers";
import {
  applyProjectEvent,
  subscribeToProjectEvents,
} from "@/services/projectEvents";

export default function SavedStreamsScreen() {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const { savedProjectIds, removeSavedProjectIds } = useSavedStreams();
  const [projects, setProjects] = useState(
    [] as ReturnType<typeof mapProjectToUi>[],
  );
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
      if (!savedProjectIds.length) {
        setProjects([]);
        if (showLoader) {
          setIsLoading(false);
        }
        return;
      }
      try {
        if (showLoader) {
          setIsLoading(true);
        }
        const projectsData = await Promise.all(
          savedProjectIds.map((projectId) =>
            getProjectById(projectId).catch(() => null),
          ),
        );
        const missingIds = savedProjectIds.filter(
          (_, index) => !projectsData[index],
        );
        if (missingIds.length) {
          void removeSavedProjectIds(missingIds);
        }
        const validProjects = projectsData.filter((project) => project);
        const builderCounts = await Promise.all(
          validProjects.map((project) =>
            getProjectBuilders(project!.id).catch(() => []),
          ),
        );
        const mapped = validProjects.map((project, index) =>
          mapProjectToUi(project!, builderCounts[index]?.length ?? 0),
        );

        setProjects(mapped);
      } finally {
        if (showLoader) {
          setIsLoading(false);
        }
      }
    },
    [savedProjectIds],
  );

  useEffect(() => {
    loadSaved();
  }, [loadSaved]);

  useEffect(() => {
    return subscribeToProjectEvents((event) => {
      setProjects((prev) => applyProjectEvent(prev, event));
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
              Saved streams
            </ThemedText>
            <ThemedText type="caption" style={{ color: colors.muted }}>
              Your saved stream library.
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
          ) : projects.length ? (
            projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                variant="full"
                saved={savedProjectIds.includes(project.id)}
                onSavedChange={(nextSaved) => {
                  if (!nextSaved) {
                    setProjects((prev) =>
                      prev.filter((item) => item.id !== project.id),
                    );
                  }
                }}
              />
            ))
          ) : (
            <View style={styles.emptyState}>
              <ThemedText type="caption" style={{ color: colors.muted }}>
                No saved streams yet.
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
    height: 120,
    borderWidth: 1,
    opacity: 0.7,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 24,
  },
});
