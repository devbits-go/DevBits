import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { FloatingScrollTopButton } from "@/components/FloatingScrollTopButton";
import { ThemedText } from "@/components/ThemedText";
import { TopBlur } from "@/components/TopBlur";
import { useAuth } from "@/contexts/AuthContext";
import { useAppColors } from "@/hooks/useAppColors";
import { useMotionConfig } from "@/hooks/useMotionConfig";
import { useTopBlurScroll } from "@/hooks/useTopBlurScroll";
import { SettingsCard } from "@/features/settings/shared";

export default function SettingsHubScreen() {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const motion = useMotionConfig();
  const reveal = useRef(new Animated.Value(0.08)).current;
  const scrollRef = useRef<Animated.ScrollView | null>(null);
  const { scrollY, onScroll } = useTopBlurScroll();
  const { user } = useAuth();

  useEffect(() => {
    if (motion.prefersReducedMotion) {
      reveal.setValue(1);
      return;
    }

    Animated.timing(reveal, {
      toValue: 1,
      duration: motion.duration(340),
      useNativeDriver: true,
    }).start();
  }, [motion, reveal]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.screen} edges={["top"]}>
        <Animated.ScrollView
          ref={scrollRef}
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + 96 },
          ]}
        >
          <Animated.View
            style={{
              opacity: reveal,
              transform: [
                {
                  translateY: reveal.interpolate({
                    inputRange: [0, 1],
                    outputRange: [12, 0],
                  }),
                },
              ],
            }}
          >
            <View style={styles.header}>
              <ThemedText type="display">Settings</ThemedText>
              <ThemedText type="caption" style={{ color: colors.muted }}>
                Organized, fast controls for your DevBits account.
              </ThemedText>
            </View>

            <View style={styles.list}>
              <SettingsCard
                title="Bio"
                subtitle="Profile, links, picture and public identity"
                onPress={() => router.push("/settings/bio")}
              />
              <SettingsCard
                title="System"
                subtitle="Refresh, link behavior and app performance"
                onPress={() => router.push("/settings/system")}
              />
              <SettingsCard
                title="Theme"
                subtitle="Accent color, visual style and rendering"
                onPress={() => router.push("/settings/theme")}
              />
              <SettingsCard
                title="Help & Navigation"
                subtitle="Guides, tours and shortcuts"
                onPress={() => router.push("/settings/help-navigation")}
              />
              <SettingsCard
                title="Security"
                subtitle="Session, sign out and account deletion"
                onPress={() => router.push("/settings/security")}
              />
              <SettingsCard
                title="My Media"
                subtitle="View and delete uploaded photos, videos and files"
                onPress={() => router.push("/settings/media")}
              />
              <SettingsCard
                title="About"
                subtitle="App version and key account details"
                onPress={() => router.push("/settings/about")}
              />
            </View>

            <View
              style={[
                styles.identityCard,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceAlt,
                },
              ]}
            >
              <ThemedText type="defaultSemiBold">Signed in as</ThemedText>
              <ThemedText type="caption" style={{ color: colors.muted }}>
                {user?.username || "Anonymous"}
              </ThemedText>
            </View>
          </Animated.View>
        </Animated.ScrollView>
      </SafeAreaView>
      <TopBlur scrollY={scrollY} />
      <FloatingScrollTopButton
        scrollY={scrollY}
        onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
        bottomOffset={insets.bottom + 20}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 14,
  },
  header: {
    gap: 4,
  },
  list: {
    marginTop: 10,
    gap: 10,
  },
  identityCard: {
    marginTop: 6,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
});
