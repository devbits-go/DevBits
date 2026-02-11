import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  FlatList,
  Pressable,
  RefreshControl,
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
import { useTopBlurScroll } from "@/hooks/useTopBlurScroll";
import { useAuth } from "@/contexts/AuthContext";
import { useSavedStreams } from "@/contexts/SavedStreamsContext";
import {
  applyProjectEvent,
  subscribeToProjectEvents,
} from "@/services/projectEvents";

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
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [pageIndex, setPageIndex] = useState(0);
  const [builderProjects, setBuilderProjects] = useState(
    [] as ReturnType<typeof mapProjectToUi>[],
  );
  const motion = useMotionConfig();
  const reveal = useRef(new Animated.Value(0)).current;
  const { scrollY, onScroll } = useTopBlurScroll();
  const pageSize = 24;

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
    async ({
      showLoader = true,
      nextPage = 0,
      append = false,
    }: {
      showLoader?: boolean;
      nextPage?: number;
      append?: boolean;
    } = {}) => {
      try {
        if (showLoader) {
          setIsLoading(true);
        }
        const start = nextPage * pageSize;
        const [projectFeedRaw, builderProjectsRaw] = await Promise.all([
          getProjectsFeed("time", start, pageSize),
          nextPage === 0 && user?.id
            ? getProjectsByBuilderId(user.id)
            : Promise.resolve([]),
        ]);
        const projectFeed = Array.isArray(projectFeedRaw) ? projectFeedRaw : [];
        const builderProjects = Array.isArray(builderProjectsRaw)
          ? builderProjectsRaw
          : [];
        const builderIds = builderProjects.map((project) => project.id);
        const builderCounts = await Promise.all(
          projectFeed.map((project) =>
            getProjectBuilders(project.id).catch(() => []),
          ),
        );
        const uiProjects = projectFeed.map((project, index) =>
          mapProjectToUi(project, builderCounts[index]?.length ?? 0),
        );
        const builderUi = builderProjects.length
          ? await Promise.all(
              builderProjects.map(async (project) => {
                const builders = await getProjectBuilders(project.id).catch(
                  () => [],
                );
                return mapProjectToUi(project, builders.length ?? 0);
              }),
            )
          : [];

        setProjects((prev) => (append ? prev.concat(uiProjects) : uiProjects));
        if (nextPage === 0) {
          setBuilderProjects(builderUi);
        }
        if (nextPage === 0) {
          setBuilderProjectIds(builderIds);
        }
        setPageIndex(nextPage);
        setHasMore(projectFeed.length === pageSize);
        setHasError(false);
      } catch {
        if (!append) {
          setProjects([]);
        }
        setHasError(true);
      } finally {
        if (showLoader) {
          setIsLoading(false);
        }
      }
    },
    [user?.id],
  );
  const combinedProjects = useMemo(() => {
    const combinedMap = new Map<number, ReturnType<typeof mapProjectToUi>>();
    projects.forEach((project) => combinedMap.set(project.id, project));
    builderProjects.forEach((project) => combinedMap.set(project.id, project));
    return Array.from(combinedMap.values());
  }, [builderProjects, projects]);

  const visibleProjects = useMemo(() => {
    if (activeFilter !== "saved") {
      return combinedProjects;
    }
    return combinedProjects.filter((project) =>
      savedProjectIds.includes(project.id),
    );
  }, [activeFilter, combinedProjects, savedProjectIds]);

  useEffect(() => {
    setHasMore(true);
    setPageIndex(0);
    loadStreams({ nextPage: 0 });
  }, [loadStreams]);

  useEffect(() => {
    return subscribeToProjectEvents((event) => {
      setProjects((prev) => applyProjectEvent(prev, event));
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      clearApiCache();
      loadStreams({ showLoader: false, nextPage: 0 });
    }, [loadStreams]),
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    clearApiCache();
    setHasMore(true);
    setPageIndex(0);
    await loadStreams({ showLoader: false, nextPage: 0 });
    setIsRefreshing(false);
  }, [loadStreams]);

  useAutoRefresh(() => loadStreams({ showLoader: false, nextPage: 0 }), {
    focusRefresh: false,
  });

  const handleLoadMore = useCallback(() => {
    if (isLoadingMore || !hasMore || isLoading) {
      return;
    }
    setIsLoadingMore(true);
    loadStreams({
      showLoader: false,
      nextPage: pageIndex + 1,
      append: true,
    }).finally(() => setIsLoadingMore(false));
  }, [hasMore, isLoading, isLoadingMore, loadStreams, pageIndex]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.background} pointerEvents="none" />
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <Animated.FlatList
          data={visibleProjects}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <ProjectCard
              project={item}
              variant="full"
              saved={savedProjectIds.includes(item.id)}
              isBuilder={builderProjectIds.includes(item.id)}
              onSavedChange={() => undefined}
            />
          )}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          onScroll={onScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.tint}
              colors={[colors.tint]}
              titleColor={colors.tint}
              progressViewOffset={48}
            />
          }
          ListHeaderComponent={
            <View>
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
              ) : null}
            </View>
          }
          ListEmptyComponent={
            !isLoading ? (
              <View style={styles.emptyState}>
                <ThemedText type="caption" style={{ color: colors.muted }}>
                  {hasError
                    ? "Streams unavailable. Check the API and try again."
                    : activeFilter === "saved"
                      ? "No saved streams yet."
                      : "No streams yet."}
                </ThemedText>
              </View>
            ) : null
          }
          ListFooterComponent={
            isLoadingMore ? (
              <View style={styles.loadingMore}>
                <ThemedText type="caption" style={{ color: colors.muted }}>
                  Loading more...
                </ThemedText>
              </View>
            ) : null
          }
          contentContainerStyle={[
            styles.container,
            { paddingTop: 8, paddingBottom: 96 + insets.bottom },
          ]}
          removeClippedSubviews
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={8}
          updateCellsBatchingPeriod={50}
        />
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
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  container: {
    paddingVertical: 16,
    paddingHorizontal: 0,
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
  loadingMore: {
    alignItems: "center",
    paddingVertical: 18,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 24,
  },
});
