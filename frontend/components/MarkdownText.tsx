import React, { useEffect, useState } from "react";
import Markdown from "react-native-markdown-display";
import * as Linking from "expo-linking";
import {
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Collapsible } from "@/components/Collapsible";
import { useAppColors } from "@/hooks/useAppColors";
import { usePreferences } from "@/contexts/PreferencesContext";

type MarkdownTextProps = {
  children: string;
};

export function MarkdownText({ children }: MarkdownTextProps) {
  const colors = useAppColors();
  const { preferences } = usePreferences();
  const { width: windowWidth } = useWindowDimensions();
  const linkifyText = (text: string) =>
    text.replace(
      /(^|\s)((?:https?:\/\/|www\.)[^\s<]+[^\s<\.)])/g,
      (_match, prefix, url) => `${prefix}[${url}](${url})`,
    );
  const sanitizeGithubCallouts = (text: string) =>
    text.replace(
      /^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*>\s*/gim,
      "> [!$1] ",
    );
  const applyTaskCheckboxes = (text: string) =>
    text.replace(
      /(^|\n)(\s*)[-*]\s+\[( |x|X)\]\s+/g,
      (_match, lineStart, indent, mark) =>
        `${lineStart}${indent.replace(/\s/g, "\u00A0")}${
          mark.trim().toLowerCase() === "x" ? "☑" : "☐"
        }\u00A0`,
    );
  const normalizeListTransitions = (text: string) => {
    const lines = text.split(/\r?\n/);
    const result: string[] = [];
    let prevType: "ordered" | "unordered" | null = null;
    let prevIndent = "";

    const getListInfo = (line: string) => {
      const match = line.match(/^((?:>\s*)*)(\s*)(\d+\.|[-*+])\s+/);
      if (!match) return null;
      const marker = match[3];
      return {
        indent: `${match[1]}${match[2]}`,
        type: /\d+\./.test(marker) ? "ordered" : "unordered",
      } as const;
    };

    lines.forEach((line) => {
      const info = getListInfo(line);
      if (
        info &&
        prevType &&
        info.indent === prevIndent &&
        info.type !== prevType &&
        result.length > 0 &&
        result[result.length - 1].trim() !== ""
      ) {
        result.push("");
      }
      result.push(line);
      if (info) {
        prevType = info.type;
        prevIndent = info.indent;
      } else if (line.trim() === "") {
        prevType = null;
        prevIndent = "";
      }
    });

    return result.join("\n");
  };
  const preprocessMarkdown = (text: string) =>
    linkifyText(
      normalizeListTransitions(
        applyTaskCheckboxes(sanitizeGithubCallouts(text)),
      ),
    );

  const normalizeDetailsTags = (text: string) =>
    text
      .replace(/&amp;lt;(\/?details[^&]*)&amp;gt;/gi, "<$1>")
      .replace(/&amp;lt;(\/?summary[^&]*)&amp;gt;/gi, "<$1>")
      .replace(/&lt;(\/?details[^&]*)&gt;/gi, "<$1>")
      .replace(/&lt;(\/?summary[^&]*)&gt;/gi, "<$1>")
      .replace(/\\<(\/?details[^>]*)>/gi, "<$1>")
      .replace(/\\<(\/?summary[^>]*)>/gi, "<$1>");

  const parseDetailsBlocks = (text: string) => {
    const blocks: Array<
      | { type: "markdown"; content: string }
      | { type: "details"; summary: string; content: string; open: boolean }
    > = [];
    const tagRegex = /<\/?details[^>]*>/gi;
    let cursor = 0;
    let depth = 0;
    let openContentStart = -1;
    let openTagIndex = -1;
    let openByDefault = false;
    let match: RegExpExecArray | null = tagRegex.exec(text);

    while (match) {
      const tag = match[0];
      const isClose = tag.startsWith("</");
      if (!isClose) {
        if (depth === 0) {
          if (match.index > cursor) {
            blocks.push({
              type: "markdown",
              content: text.slice(cursor, match.index),
            });
          }
          openTagIndex = match.index;
          openContentStart = match.index + tag.length;
          openByDefault = /<details\b[^>]*\bopen\b/i.test(tag);
        }
        depth += 1;
      } else {
        if (depth > 0) {
          depth -= 1;
          if (depth === 0 && openContentStart !== -1) {
            const inner = text.slice(openContentStart, match.index);
            const summaryMatch = inner.match(
              /<summary[^>]*>([\s\S]*?)<\/summary>/i,
            );
            const summaryRaw = summaryMatch?.[1]?.trim() ?? "Details";
            const content = summaryMatch
              ? inner.replace(summaryMatch[0], "").trim()
              : inner.trim();
            blocks.push({
              type: "details",
              summary: summaryRaw,
              content,
              open: openByDefault,
            });
            cursor = match.index + tag.length;
            openContentStart = -1;
            openTagIndex = -1;
            openByDefault = false;
          }
        }
      }
      match = tagRegex.exec(text);
    }

    if (depth > 0 && openTagIndex !== -1) {
      blocks.push({ type: "markdown", content: text.slice(openTagIndex) });
      return blocks;
    }

    if (cursor < text.length) {
      blocks.push({ type: "markdown", content: text.slice(cursor) });
    }

    return blocks;
  };
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
    return (
      <View
        key={node.key}
        style={[
          styles.codeBlock,
          { backgroundColor: colors.background, borderColor: colors.border },
        ]}
      >
        <Text
          selectable
          style={[
            styles.codeText,
            {
              color: colors.text,
              backgroundColor: "transparent",
            },
          ]}
        >
          {content}
        </Text>
      </View>
    );
  };

  const renderImage = (node: { key?: string; attributes?: any }) => {
    const src = node.attributes?.src ?? "";
    if (!src) {
      return null;
    }
    const maxWidth = Math.min(windowWidth - 32, 520);
    return <MarkdownImage key={node.key} src={src} maxWidth={maxWidth} />;
  };

  const renderLink = (
    node: { key?: string; attributes?: any; children?: any[] },
    children: React.ReactNode[] = [],
  ) => {
    const href = node.attributes?.href ?? "";
    const hasImageChild = Array.isArray(node.children)
      ? node.children.some((child) => child?.type === "image")
      : false;

    if (hasImageChild) {
      return (
        <Pressable
          key={node.key}
          onPress={() => void openUrlSafe(href)}
          style={styles.imageLink}
        >
          {children}
        </Pressable>
      );
    }

    return (
      <Text
        key={node.key}
        style={[styles.link, { color: colors.tint }]}
        onPress={() => void openUrlSafe(href)}
      >
        {children}
      </Text>
    );
  };

  const extractText = (value: React.ReactNode): string => {
    if (typeof value === "string" || typeof value === "number") {
      return String(value);
    }
    if (Array.isArray(value)) {
      return value.map(extractText).join("");
    }
    if (React.isValidElement(value)) {
      return extractText((value.props as any)?.children);
    }
    return "";
  };

  const stripPrefix = (
    nodes: React.ReactNode,
    prefix: string,
  ): React.ReactNode[] => {
    let remaining = prefix;
    const stripNode = (node: React.ReactNode): React.ReactNode | null => {
      if (!remaining) return node;
      if (typeof node === "string" || typeof node === "number") {
        const text = String(node);
        if (text.startsWith(remaining)) {
          const updated = text.slice(remaining.length);
          remaining = "";
          return updated;
        }
        if (remaining.startsWith(text)) {
          remaining = remaining.slice(text.length);
          return null;
        }
        return node;
      }
      if (React.isValidElement(node)) {
        const childNodes = React.Children.toArray(
          (node.props as any)?.children,
        );
        const updatedChildren = childNodes
          .map(stripNode)
          .filter((child) => child !== null);
        return React.cloneElement(node, node.props as any, updatedChildren);
      }
      return node;
    };

    return React.Children.toArray(nodes)
      .map(stripNode)
      .filter((child) => child !== null);
  };

  const renderBlockquote = (
    node: { key?: string },
    children: React.ReactNode,
  ) => {
    const text = extractText(children);
    const match = text.match(
      /^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i,
    );
    const type = match?.[1]?.toLowerCase() as
      | "note"
      | "tip"
      | "important"
      | "warning"
      | "caution"
      | undefined;
    if (!type) {
      return (
        <View
          key={node.key}
          style={[
            styles.blockquoteBase,
            {
              borderColor: colors.border,
              borderLeftColor: colors.border,
              backgroundColor: colors.surfaceAlt,
            },
          ]}
        >
          {children}
        </View>
      );
    }

    const palette = calloutPalette[type];
    const cleanedChildren = stripPrefix(children, match?.[0] ?? "");

    return (
      <View
        key={node.key}
        style={[
          styles.blockquoteBase,
          styles.calloutBase,
          (palette as any).glow && styles.calloutGlow,
          {
            borderColor: palette.border,
            borderLeftColor: palette.border,
            backgroundColor: palette.background,
            shadowColor: palette.border,
          },
        ]}
      >
        <Text style={[styles.calloutTitle, { color: palette.title }]}>
          {type.charAt(0).toUpperCase() + type.slice(1)}
        </Text>
        <View style={styles.calloutContent}>{cleanedChildren}</View>
      </View>
    );
  };

  const markdownRules = {
    code_inline: (node: { key?: string; content?: string }) => (
      <Text
        key={node.key}
        style={[
          styles.inlineCode,
          {
            color: colors.background,
            backgroundColor: colors.tint,
          },
        ]}
      >
        {`\u00A0${node.content}\u00A0`}
      </Text>
    ),
    code_block: renderCodeBlock,
    fence: renderCodeBlock,
    image: renderImage,
    blockquote: renderBlockquote,
    link: renderLink,
  };

  const markdownStyle = {
    body: { color: colors.text, fontSize: 14, lineHeight: 20 },
    heading1: { color: colors.text, fontSize: 20, marginBottom: 6 },
    heading2: { color: colors.text, fontSize: 18, marginBottom: 6 },
    heading3: { color: colors.text, fontSize: 16, marginBottom: 6 },
    hr: {
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      marginVertical: 16,
    },
    bullet_list: { paddingLeft: 12 },
    ordered_list: { paddingLeft: 12 },
    list_item: { marginBottom: 4 },
    task_list_item: { marginBottom: 4 },
    checkbox: {
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    table: {
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 8,
      overflow: "hidden",
    },
    th: {
      backgroundColor: colors.surfaceAlt,
      borderColor: colors.border,
      borderWidth: 1,
      paddingHorizontal: 8,
      paddingVertical: 6,
    },
    td: {
      borderColor: colors.border,
      borderWidth: 1,
      paddingHorizontal: 8,
      paddingVertical: 6,
    },
    image: {
      borderRadius: 10,
      marginVertical: 8,
    },
    link: { color: colors.tint },
    em: { fontStyle: "italic" },
    strong: { fontWeight: "700" },
    s: { textDecorationLine: "line-through" },
  } as const;

  const summaryMarkdownStyle = {
    body: { color: colors.text, fontSize: 15, lineHeight: 20 },
    paragraph: { marginTop: 0, marginBottom: 0 },
    link: { color: colors.tint },
    em: { fontStyle: "italic" },
    strong: { fontWeight: "700" },
    s: { textDecorationLine: "line-through" },
  } as const;

  const renderMarkdownSegments = (text: string, keyPrefix: string) => {
    const normalized = normalizeDetailsTags(text);
    return parseDetailsBlocks(normalized).map((block, index) => {
      const keyBase = `${keyPrefix}-${index}`;
      if (block.type === "details") {
        const summaryText = block.summary.replace(/\s+/g, " ").trim();
        return (
          <Collapsible
            key={`details-${keyBase}`}
            title={
              <Markdown
                onLinkPress={(url) => {
                  void openUrlSafe(url);
                  return false;
                }}
                rules={markdownRules}
                style={summaryMarkdownStyle}
              >
                {preprocessMarkdown(summaryText)}
              </Markdown>
            }
            defaultOpen={block.open}
          >
            <View style={styles.markdownStack}>
              {renderMarkdownSegments(block.content, `nested-${keyBase}`)}
            </View>
          </Collapsible>
        );
      }
      return (
        <Markdown
          key={`markdown-${keyBase}`}
          onLinkPress={(url) => {
            void openUrlSafe(url);
            return false;
          }}
          rules={markdownRules}
          style={markdownStyle}
        >
          {preprocessMarkdown(block.content)}
        </Markdown>
      );
    });
  };

  return (
    <View style={styles.markdownStack}>
      {renderMarkdownSegments(children, "root")}
    </View>
  );
}

type MarkdownImageProps = {
  src: string;
  maxWidth: number;
};

const calloutPalette = {
  note: {
    border: "#3B82F6",
    background: "rgba(59, 130, 246, 0.12)",
    title: "#3B82F6",
  },
  tip: {
    border: "#22C55E",
    background: "rgba(34, 197, 94, 0.12)",
    title: "#22C55E",
  },
  important: {
    border: "#EF4444",
    background: "rgba(239, 68, 68, 0.12)",
    title: "#EF4444",
  },
  warning: {
    border: "#F59E0B",
    background: "rgba(245, 158, 11, 0.12)",
    title: "#F59E0B",
  },
  caution: {
    border: "#FF3B30",
    background: "rgba(255, 59, 48, 0.16)",
    title: "#FF3B30",
    glow: true,
  },
} as const;

function MarkdownImage({ src, maxWidth }: MarkdownImageProps) {
  const [aspectRatio, setAspectRatio] = useState<number>(16 / 9);

  useEffect(() => {
    let active = true;
    Image.getSize(
      src,
      (width, height) => {
        if (!active || width <= 0 || height <= 0) return;
        setAspectRatio(width / height);
      },
      () => {
        if (active) {
          setAspectRatio(16 / 9);
        }
      },
    );
    return () => {
      active = false;
    };
  }, [src]);

  return (
    <Image
      source={{ uri: src }}
      resizeMode="contain"
      style={[styles.image, { width: maxWidth, maxWidth: "100%", aspectRatio }]}
    />
  );
}

const styles = StyleSheet.create({
  markdownStack: {
    gap: 10,
  },
  codeBlock: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 0,
    marginVertical: 10,
    gap: 8,
  },
  blockquoteBase: {
    borderLeftWidth: 1,
    borderWidth: 1,
    paddingLeft: 12,
    paddingRight: 12,
    paddingVertical: 8,
    marginVertical: 8,
    borderRadius: 10,
  },
  calloutBase: {
    gap: 4,
  },
  calloutGlow: {
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  calloutTitle: {
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    fontFamily: "SpaceMono",
  },
  calloutContent: {
    marginTop: 2,
  },
  codeText: {
    fontFamily: "SpaceMono",
    fontSize: 13,
    lineHeight: 18,
    borderRadius: 10,
    borderWidth: 0,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 0,
    paddingVertical: 0,
  },
  inlineCode: {
    fontFamily: "SpaceMono",
    fontSize: 13,
    lineHeight: 16,
    borderRadius: 2,
    paddingHorizontal: 0.5,
    paddingVertical: 0.5,
    overflow: "hidden",
    includeFontPadding: false,
  },
  imageLink: {
    alignSelf: "flex-start",
  },
  link: {
    textDecorationLine: "underline",
  },
  image: {
    borderRadius: 10,
  },
});
