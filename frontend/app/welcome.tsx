import React, { useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { useAuth } from "@/contexts/AuthContext";
import { usePreferences } from "@/contexts/PreferencesContext";
import { useAppColors } from "@/hooks/useAppColors";
import { useMotionConfig } from "@/hooks/useMotionConfig";

type Slide = {
  id: string;
  title: string;
  body: string;
  bulletA: string;
  bulletB: string;
  bulletC: string;
};

const slides: Slide[] = [
  {
    id: "welcome",
    title: "Welcome to DevBits",
    body: "A fast social builder space for sharing work, progress, and ideas.",
    bulletA: "Streams = projects",
    bulletB: "Bytes = posts",
    bulletC:
      "Profiles, follows, saves, comments, and DMs keep everything connected",
  },
  {
    id: "streams",
    title: "Streams are your projects",
    body: "Create streams for products, experiments, or learning journeys.",
    bulletA: "Describe the goal and context",
    bulletB: "Add builders and collaborators",
    bulletC: "Each stream has its own timeline and discussion",
  },
  {
    id: "bytes",
    title: "Bytes are your posts",
    body: "Publish quick updates, demos, media, and notes as bytes.",
    bulletA: "Post to a stream to keep progress organized",
    bulletB: "People can save, comment, and react",
    bulletC: "Use bytes for daily updates or major milestones",
  },
  {
    id: "navigate",
    title: "How to navigate",
    body: "Use tabs for discovery, profile, and your main feed.",
    bulletA: "Explore: find builders, streams, and bytes",
    bulletB: "Terminal: handle direct messages and commands",
    bulletC:
      "Settings: customize profile, preferences, and open this tour anytime",
  },
];

export default function WelcomeScreen() {
  const colors = useAppColors();
  const motion = useMotionConfig();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const router = useRouter();
  const { acknowledgeSignUp } = useAuth();
  const { updatePreferences } = usePreferences();
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<Slide> | null>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const isFirstRun = String(mode ?? "") === "first-run";

  const completeTour = async () => {
    await updatePreferences({ hasSeenWelcomeTour: true });
    acknowledgeSignUp();
    router.replace("/(tabs)");
  };

  const skipTour = async () => {
    if (isFirstRun) {
      await completeTour();
      return;
    }
    router.back();
  };

  const nextSlide = () => {
    if (index >= slides.length - 1) {
      void completeTour();
      return;
    }
    listRef.current?.scrollToIndex({ index: index + 1, animated: true });
  };

  const onMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    setIndex(Math.max(0, Math.min(slides.length - 1, nextIndex)));
  };

  const slideRender = ({
    item,
    index: itemIndex,
  }: {
    item: Slide;
    index: number;
  }) => {
    const inputRange = [
      (itemIndex - 1) * width,
      itemIndex * width,
      (itemIndex + 1) * width,
    ];
    const opacity = motion.prefersReducedMotion
      ? 1
      : scrollX.interpolate({
          inputRange,
          outputRange: [0.9, 1, 0.9],
          extrapolate: "clamp",
        });
    const translateY = motion.prefersReducedMotion
      ? 0
      : scrollX.interpolate({
          inputRange,
          outputRange: [8, 0, 8],
          extrapolate: "clamp",
        });

    return (
      <View style={[styles.slide, { width }]}>
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity,
              transform: [{ translateY }],
            },
          ]}
        >
          <ThemedText type="label" style={{ color: colors.muted }}>
            DevBits Tour
          </ThemedText>
          <ThemedText type="display">{item.title}</ThemedText>
          <ThemedText type="default" style={{ color: colors.muted }}>
            {item.body}
          </ThemedText>

          <View style={styles.listWrap}>
            {[item.bulletA, item.bulletB, item.bulletC].map((point) => (
              <View key={point} style={styles.listRow}>
                <View
                  style={[
                    styles.dot,
                    {
                      backgroundColor: colors.tint,
                    },
                  ]}
                />
                <ThemedText type="default">{point}</ThemedText>
              </View>
            ))}
          </View>
        </Animated.View>
      </View>
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.screen} edges={[]}>
        <View style={[styles.topRow, { paddingTop: insets.top + 8 }]}>
          <ThemedText type="caption" style={{ color: colors.muted }}>
            {index + 1} / {slides.length}
          </ThemedText>
          <Pressable onPress={skipTour}>
            <ThemedText type="link">{isFirstRun ? "Skip" : "Close"}</ThemedText>
          </Pressable>
        </View>

        <Animated.FlatList
          ref={listRef}
          data={slides}
          keyExtractor={(item) => item.id}
          renderItem={slideRender}
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumEnd}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: false },
          )}
          scrollEventThrottle={16}
        />

        <View
          style={[styles.bottomArea, { paddingBottom: insets.bottom + 12 }]}
        >
          <View style={styles.pagination}>
            {slides.map((slide, dotIndex) => {
              const isActive = dotIndex === index;
              return (
                <View
                  key={slide.id}
                  style={[
                    styles.paginationDot,
                    {
                      backgroundColor: isActive
                        ? colors.tint
                        : colors.surfaceAlt,
                      width: isActive ? 22 : 8,
                    },
                  ]}
                />
              );
            })}
          </View>

          <Pressable
            onPress={nextSlide}
            style={[styles.cta, { backgroundColor: colors.tint }]}
          >
            <ThemedText type="defaultSemiBold" style={{ color: colors.onTint }}>
              {index === slides.length - 1 ? "Start building" : "Next"}
            </ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  slide: {
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    gap: 10,
  },
  listWrap: {
    marginTop: 8,
    gap: 10,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 7,
  },
  bottomArea: {
    paddingHorizontal: 16,
    gap: 12,
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    alignItems: "center",
  },
  paginationDot: {
    height: 8,
    borderRadius: 999,
  },
  cta: {
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
  },
});
