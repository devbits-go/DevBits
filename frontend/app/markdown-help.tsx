import React, { useRef, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { FloatingScrollTopButton } from "@/components/FloatingScrollTopButton";
import { MarkdownText } from "@/components/MarkdownText";
import { ThemedText } from "@/components/ThemedText";
import { TopBlur } from "@/components/TopBlur";
import { useAppColors } from "@/hooks/useAppColors";
import { useTopBlurScroll } from "@/hooks/useTopBlurScroll";

type MarkdownSample = {
  title: string;
  note?: string;
  code: string;
};

const markdownSamples: MarkdownSample[] = [
  {
    title: "Core formatting",
    code: `**bold**\n*italic*\n~~strikethrough~~\n\`inline code\``,
  },
  {
    title: "Headings",
    code: `# Heading 1\n## Heading 2\n### Heading 3`,
  },
  {
    title: "Links",
    note: "Plain URLs are auto-linkified too.",
    code: `[DevBits](https://example.com)\nhttps://example.com\nwww.example.com/docs`,
  },
  {
    title: "Images",
    note: "Supports standard image URLs, .svg files, and GitHub blob/raw links.",
    code: `![DevBits SVG](https://github.com/devbits-go/.github/blob/main/profile/svg/DevBits.svg)`,
  },
  {
    title: "Lists and tasks",
    code: `- Item one\n- Item two\n\n1. First\n2. Second\n\n- [ ] Todo\n- [x] Done`,
  },
  {
    title: "Blockquotes and callouts",
    code: `> Regular blockquote\n\n> [!NOTE]\n> Helpful note\n\n> [!TIP]\n> Helpful tip\n\n> [!IMPORTANT]\n> Important info\n\n> [!WARNING]\n> Warning text\n\n> [!CAUTION]\n> Caution text`,
  },
  {
    title: "Code blocks",
    code: "```ts\nconst greet = (name: string) => 'Hello, ' + name;\n```",
  },
  {
    title: "Table",
    code: `| Feature | Supported |\n| --- | --- |\n| Tables | Yes |\n| Task lists | Yes |`,
  },
  {
    title: "Horizontal rule",
    code: `---`,
  },
  {
    title: "Dropdown (collapsed by default)",
    code: `<details>\n<summary>Open details</summary>\nHidden content here.\n</details>`,
  },
  {
    title: "Dropdown (open by default)",
    note: "Use the open attribute on <details>.",
    code: `<details open>\n<summary>Open by default</summary>\nThis starts expanded.\n</details>`,
  },
  {
    title: "Styled summary",
    note: "Summary text supports markdown styling in your renderer.",
    code: `<details>\n<summary>**Build Notes** · *v2* · ~~old~~ · [spec](https://example.com)</summary>\nSummary can include bold/italic/strike/link styling.\n</details>`,
  },
];

export default function MarkdownHelpScreen() {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollRef = useRef<ScrollView | null>(null);
  const [activePreview, setActivePreview] = useState<string | null>(null);
  const { scrollY, onScroll } = useTopBlurScroll();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.screen} edges={["top"]}>
        <Animated.ScrollView
          ref={scrollRef}
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={[
            styles.container,
            { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 96 },
          ]}
        >
          <View style={styles.headerRow}>
            <Pressable
              onPress={() => router.back()}
              style={[styles.backButton, { borderColor: colors.border }]}
            >
              <Feather name="arrow-left" size={14} color={colors.muted} />
            </Pressable>
            <ThemedText type="display">Markdown help</ThemedText>
          </View>

          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <ThemedText type="default" style={{ color: colors.muted }}>
              Raw syntax examples for everything currently supported by your
              custom markdown renderer.
            </ThemedText>

            {markdownSamples.map((sample) => (
              <View key={sample.title} style={styles.sampleBlock}>
                <ThemedText type="subtitle">{sample.title}</ThemedText>
                {sample.note ? (
                  <ThemedText type="caption" style={{ color: colors.muted }}>
                    {sample.note}
                  </ThemedText>
                ) : null}
                <View
                  style={[
                    styles.codeCard,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    selectable
                    style={[styles.codeText, { color: colors.text }]}
                  >
                    {sample.code}
                  </Text>
                </View>
                <Pressable
                  onPress={() =>
                    setActivePreview((prev) =>
                      prev === sample.title ? null : sample.title,
                    )
                  }
                  style={[
                    styles.previewButton,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.surfaceAlt,
                    },
                  ]}
                >
                  <ThemedText type="caption" style={{ color: colors.muted }}>
                    {activePreview === sample.title
                      ? "Hide rendered preview"
                      : "Render preview"}
                  </ThemedText>
                </Pressable>
                {activePreview === sample.title ? (
                  <View
                    style={[
                      styles.previewCard,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.background,
                      },
                    ]}
                  >
                    <MarkdownText preferStatic>{sample.code}</MarkdownText>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
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
  container: {
    paddingHorizontal: 16,
    gap: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 14,
  },
  sampleBlock: {
    gap: 8,
  },
  codeCard: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  codeText: {
    fontFamily: "SpaceMono",
    fontSize: 13,
    lineHeight: 19,
  },
  previewButton: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignSelf: "flex-start",
  },
  previewCard: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
