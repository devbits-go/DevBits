import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Pressable,
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
import {
  clearApiCache,
  getProjectBuilders,
  getProjectsByBuilderId,
  getProjectsFeed,
} from "@/services/api";
import { mapProjectToUi } from "@/services/mappers";
import { ProjectCard } from "@/components/ProjectCard";
import { ThemedText } from "@/components/ThemedText";
import { TopBlur } from "@/components/TopBlur";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { useAppColors } from "@/hooks/useAppColors";
import { useMotionConfig } from "@/hooks/useMotionConfig";
import { useAuth } from "@/contexts/AuthContext";
import { useSavedStreams } from "@/contexts/SavedStreamsContext";

export default function StreamsScreen() {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [projects, setProjects] = useState(
    [] as ReturnType<typeof mapProjectToUi>[],
  );
  const { savedProjectIds } = useSavedStreams();
  const [builderProjectIds, setBuilderProjectIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | "saved">("all");
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

  const loadStreams = useCallback(
    async (showLoader = true) => {
      try {
        if (showLoader) {
          setIsLoading(true);
        }
        const [projectFeedRaw, builderProjectsRaw] = await Promise.all([
          getProjectsFeed("time", 0, 30),
          user?.id ? getProjectsByBuilderId(user.id) : Promise.resolve([]),
        ]);
        const projectFeed = Array.isArray(projectFeedRaw) ? projectFeedRaw : [];
        const builderProjects = Array.isArray(builderProjectsRaw)
          ? builderProjectsRaw
          : [];
        const combinedMap = new Map(
          projectFeed.map((project) => [project.id, project]),
        );
        builderProjects.forEach((project) => {
          combinedMap.set(project.id, project);
        });
        const combinedProjects = Array.from(combinedMap.values());
        const builderIds = builderProjects.map((project) => project.id);
        const builderCounts = await Promise.all(
          combinedProjects.map((project) =>
            getProjectBuilders(project.id).catch(() => []),
          ),
        );
        const uiProjects = combinedProjects.map((project, index) =>
          mapProjectToUi(project, builderCounts[index]?.length ?? 0),
        );

        setProjects(uiProjects);
        setBuilderProjectIds(builderIds);
        setHasError(false);
      } catch {
        setProjects([]);
        setHasError(true);
      } finally {
        if (showLoader) {
          setIsLoading(false);
        }
      }
    },
    [user?.id],
  );
  const visibleProjects = useMemo(() => {
    if (activeFilter !== "saved") {
      return projects;
    }
    return projects.filter((project) => savedProjectIds.includes(project.id));
  }, [activeFilter, projects, savedProjectIds]);

  useEffect(() => {
    loadStreams();
  }, [loadStreams]);

  useFocusEffect(
    useCallback(() => {
      clearApiCache();
      loadStreams(false);
    }, [loadStreams]),
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    clearApiCache();
    await loadStreams(false);
    setIsRefreshing(false);
  }, [loadStreams]);

  useAutoRefresh(() => loadStreams(false), { focusRefresh: false });

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.background} pointerEvents="none" />
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
                  scale: reveal.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.985, 1],
                  }),
                },
              ],
            }}
          >
            <View style={styles.headerRow}>
              <View>
                <ThemedText type="display" style={styles.title}>
                  Active streams
                </ThemedText>
                <ThemedText type="caption" style={{ color: colors.muted }}>
                  Projects shipping right now.
                </ThemedText>
              </View>
            </View>
            <View style={styles.filterRow}>
              {["all", "saved"].map((key) => {
                const isActive = key === activeFilter;
                return (
                  <Pressable
                    key={key}
                    onPress={() => setActiveFilter(key as "all" | "saved")}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: isActive
                          ? colors.tint
                          : colors.surfaceAlt,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <ThemedText
                      type="caption"
                      style={{
                        color: isActive ? colors.accent : colors.muted,
                      }}
                    >
                      {key === "all" ? "All" : "Saved"}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
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
          ) : visibleProjects.length ? (
            <View style={styles.projectGrid}>
              {visibleProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  variant="full"
                  saved={savedProjectIds.includes(project.id)}
                  isBuilder={builderProjectIds.includes(project.id)}
                  onSavedChange={() => undefined}
                />
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <ThemedText type="caption" style={{ color: colors.muted }}>
                {hasError
                  ? "Streams unavailable. Check the API and try again."
                  : activeFilter === "saved"
                    ? "No saved streams yet."
                    : "No streams yet."}
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
  background: {
    ...StyleSheet.absoluteFillObject,
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
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingTop: 6,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  projectGrid: {
    gap: 12,
  },
  skeletonStack: {
    gap: 12,
  },
  skeletonCard: {
    borderRadius: 14,
    height: 110,
    borderWidth: 1,
    opacity: 0.7,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 24,
  },
});
