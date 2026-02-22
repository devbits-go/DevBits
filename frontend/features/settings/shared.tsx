import React, { useEffect, useRef } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { FloatingScrollTopButton } from "@/components/FloatingScrollTopButton";
import { ThemedText } from "@/components/ThemedText";
import { TopBlur } from "@/components/TopBlur";
import { useAppColors } from "@/hooks/useAppColors";
import { useMotionConfig } from "@/hooks/useMotionConfig";
import { useTopBlurScroll } from "@/hooks/useTopBlurScroll";

type SettingsPageShellProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  headerAction?: React.ReactNode;
};

export function SettingsPageShell({
  title,
  subtitle,
  children,
  contentStyle,
  headerAction,
}: SettingsPageShellProps) {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const motion = useMotionConfig();
  const reveal = useRef(new Animated.Value(0.08)).current;
  const scrollRef = useRef<ScrollView | null>(null);
  const { scrollY, onScroll } = useTopBlurScroll();

  useEffect(() => {
    if (motion.prefersReducedMotion) {
      reveal.setValue(1);
      return;
    }

    Animated.timing(reveal, {
      toValue: 1,
      duration: motion.duration(320),
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
            contentStyle,
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
            <View style={styles.headerRow}>
              <Pressable
                onPress={() => router.back()}
                style={({ pressed }) => [
                  styles.iconButton,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                  },
                  pressed && styles.pressFeedback,
                ]}
              >
                <Feather name="chevron-left" size={18} color={colors.muted} />
              </Pressable>
              <View style={styles.headerTextWrap}>
                <ThemedText type="display">{title}</ThemedText>
                {subtitle ? (
                  <ThemedText type="caption" style={{ color: colors.muted }}>
                    {subtitle}
                  </ThemedText>
                ) : null}
              </View>
              {headerAction ? (
                <View style={styles.headerActionWrap}>{headerAction}</View>
              ) : null}
            </View>

            <View style={styles.body}>{children}</View>
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

type SettingsCardProps = {
  title: string;
  subtitle: string;
  onPress: () => void;
};

export function SettingsCard({ title, subtitle, onPress }: SettingsCardProps) {
  const colors = useAppColors();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          borderColor: colors.border,
          backgroundColor: colors.surface,
        },
        pressed && styles.pressFeedback,
      ]}
    >
      <View style={styles.cardTextWrap}>
        <ThemedText type="defaultSemiBold">{title}</ThemedText>
        <ThemedText type="caption" style={{ color: colors.muted }}>
          {subtitle}
        </ThemedText>
      </View>
      <Feather name="chevron-right" size={18} color={colors.muted} />
    </Pressable>
  );
}

type LabeledSwitchRowProps = {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
};

export function LabeledSwitchRow({
  label,
  value,
  onChange,
}: LabeledSwitchRowProps) {
  const colors = useAppColors();

  return (
    <View style={styles.rowBetween}>
      <ThemedText type="default">{label}</ThemedText>
      <View
        style={[
          styles.switchContainer,
          {
            backgroundColor: value ? colors.tint : colors.surfaceAlt,
            borderColor: colors.border,
          },
        ]}
      >
        <Pressable
          onPress={() => onChange(!value)}
          style={styles.switchHit}
          hitSlop={8}
        >
          <View
            style={[
              styles.switchThumb,
              {
                backgroundColor: value ? colors.onTint : colors.muted,
                transform: [{ translateX: value ? 16 : 0 }],
              },
            ]}
          />
        </Pressable>
      </View>
    </View>
  );
}

export const settingsStyles = StyleSheet.create({
  section: {
    gap: 10,
    marginTop: 10,
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  inputWrap: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  input: {
    fontFamily: "SpaceMono",
    fontSize: 15,
  },
  button: {
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  buttonAlt: {
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  slider: {
    width: "100%",
    height: 36,
  },
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginTop: 4,
  },
  headerTextWrap: {
    flex: 1,
    gap: 4,
  },
  headerActionWrap: {
    alignItems: "flex-end",
    justifyContent: "flex-start",
    paddingTop: 2,
  },
  body: {
    marginTop: 12,
    gap: 10,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  cardTextWrap: {
    flex: 1,
    gap: 4,
  },
  pressFeedback: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  switchContainer: {
    width: 44,
    height: 26,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: "center",
  },
  switchHit: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  switchThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
});
