import React, { useState } from "react";
import Markdown from "react-native-markdown-display";
import * as Linking from "expo-linking";
import * as Clipboard from "expo-clipboard";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useAppColors } from "@/hooks/useAppColors";
import { usePreferences } from "@/contexts/PreferencesContext";

type MarkdownTextProps = {
  children: string;
};

export function MarkdownText({ children }: MarkdownTextProps) {
  const colors = useAppColors();
  const { preferences } = usePreferences();
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const linkifyText = (text: string) =>
    text.replace(
      /(^|\s)((?:https?:\/\/|www\.)[^\s<]+[^\s<\.)])/g,
      (_match, prefix, url) => `${prefix}[${url}](${url})`,
    );
  const content = linkifyText(children);
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

  const handleCopy = async (text: string) => {
    await Clipboard.setStringAsync(text);
    setCopiedText(text);
    setTimeout(() => {
      setCopiedText((prev) => (prev === text ? null : prev));
    }, 1400);
  };

  const getCodeContent = (node: { content?: string; children?: any[] }) => {
    if (typeof node.content === "string") {
      return node.content;
    }
    if (Array.isArray(node.children)) {
      return node.children.map((child) => child.content ?? "").join("");
    }
    return "";
  };

  const renderCodeBlock = (node: {
    key?: string;
    content?: string;
    children?: any[];
  }) => {
    const content = getCodeContent(node);
    const copied = copiedText === content;
    return (
      <View
        key={node.key}
        style={[
          styles.codeBlock,
          { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
        ]}
      >
        <View style={styles.codeHeader}>
          <Text style={[styles.codeLabel, { color: colors.muted }]}>Code</Text>
          <Pressable
            onPress={() => void handleCopy(content)}
            style={({ pressed }) => [
              styles.copyButton,
              { borderColor: colors.border, backgroundColor: colors.surface },
              pressed && styles.copyButtonPressed,
            ]}
          >
            <Text style={[styles.copyLabel, { color: colors.muted }]}>
              {copied ? "Copied" : "Copy"}
            </Text>
          </Pressable>
        </View>
        <Text
          selectable
          style={[
            styles.codeText,
            {
              color: colors.text,
              borderColor: colors.border,
              backgroundColor: colors.surface,
            },
          ]}
        >
          {content}
        </Text>
      </View>
    );
  };

  return (
    <Markdown
      onLinkPress={(url) => {
        void openUrlSafe(url);
        return false;
      }}
      rules={{
        code_inline: (node) => (
          <Text
            key={node.key}
            style={[
              styles.inlineCode,
              {
                color: colors.text,
                backgroundColor: colors.surfaceAlt,
                borderColor: colors.border,
              },
            ]}
          >
            {node.content}
          </Text>
        ),
        code_block: renderCodeBlock,
        fence: renderCodeBlock,
      }}
      style={{
        body: { color: colors.text, fontSize: 14, lineHeight: 20 },
        heading1: { color: colors.text, fontSize: 20, marginBottom: 6 },
        heading2: { color: colors.text, fontSize: 18, marginBottom: 6 },
        heading3: { color: colors.text, fontSize: 16, marginBottom: 6 },
        blockquote: {
          borderLeftColor: colors.border,
          borderLeftWidth: 3,
          paddingLeft: 10,
          color: colors.muted,
        },
        link: { color: colors.tint },
      }}
    >
      {content}
    </Markdown>
  );
}

const styles = StyleSheet.create({
  codeBlock: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    gap: 8,
  },
  codeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  codeLabel: {
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  codeText: {
    fontFamily: "SpaceMono",
    fontSize: 13,
    lineHeight: 18,
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
  inlineCode: {
    fontFamily: "SpaceMono",
    fontSize: 13,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  copyButton: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  copyButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  copyLabel: {
    fontSize: 12,
  },
});
