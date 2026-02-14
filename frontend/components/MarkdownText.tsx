import React, { useEffect, useMemo, useState } from "react";
import Markdown from "react-native-markdown-display";
import * as Linking from "expo-linking";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { Collapsible } from "@/components/Collapsible";
import { FadeInImage } from "@/components/FadeInImage";
import { LazyFadeIn } from "@/components/LazyFadeIn";
import { useAppColors } from "@/hooks/useAppColors";
import { useDeferredRender } from "@/hooks/useDeferredRender";
import { usePreferences } from "@/contexts/PreferencesContext";

type MarkdownTextProps = {
  children: string;
};

const normalizeImageSourceUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const source = trimmed
    .replace(/^<+|>+$/g, "")
    .replace(/&amp;/g, "&")
    .trim();

  const withScheme = source.startsWith("//")
    ? `https:${source}`
    : source.startsWith("www.")
      ? `https://${source}`
      : source;

  try {
    const parsed = new URL(withScheme);
    if (!/^https?:$/i.test(parsed.protocol)) {
      return "";
    }

    if (parsed.hostname !== "github.com") {
      return parsed.toString();
    }

    const segments = parsed.pathname.split("/").filter(Boolean);
    const blobIndex = segments.indexOf("blob");
    const rawIndex = segments.indexOf("raw");

    if (segments.length >= 5 && blobIndex === 2) {
      const owner = segments[0];
      const repo = segments[1];
      const branch = segments[3];
      const assetPath = segments.slice(4).join("/");
      if (owner && repo && branch && assetPath) {
        return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${assetPath}`;
      }
    }

    if (segments.length >= 5 && rawIndex === 2) {
      const owner = segments[0];
      const repo = segments[1];
      const branch = segments[3];
      const assetPath = segments.slice(4).join("/");
      if (owner && repo && branch && assetPath) {
        return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${assetPath}`;
      }
    }

    return parsed.toString();
  } catch {
    return "";
  }
};

const isSvgUrl = (value: string) => {
  const clean = value.split("?")[0].split("#")[0].toLowerCase();
  return clean.endsWith(".svg");
};

type InlineCodeScope = "callout" | "blockquote" | null;

const InlineCodeContext = React.createContext<{ scope: InlineCodeScope }>({
  scope: null,
});

export function MarkdownText({ children }: MarkdownTextProps) {
  const colors = useAppColors();
  const { preferences } = usePreferences();
  const { width: windowWidth } = useWindowDimensions();
  const isReady = useDeferredRender();
  const toRgba = (hex: string, alpha: number) => {
    const normalized = hex.replace("#", "");
    const value =
      normalized.length === 3
        ? normalized
            .split("")
            .map((channel) => channel + channel)
            .join("")
        : normalized;
    if (value.length !== 6) return hex;
    const red = parseInt(value.slice(0, 2), 16);
    const green = parseInt(value.slice(2, 4), 16);
    const blue = parseInt(value.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  };
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

  // Inline code pill styles are self-contained to avoid inherited markdown styles.
  const inlineCodeStyles = useMemo(() => {
    const background = toRgba(colors.text, 0.08);
    const border = toRgba(colors.text, 0.18);
    return StyleSheet.create({
      pill: {
        backgroundColor: background,
        borderColor: border,
        borderWidth: 0.7,
        borderRadius: 6,
        paddingHorizontal: 1,
        paddingVertical: 1,
        alignSelf: "flex-start",
        justifyContent: "center",
      },
      text: {
        color: colors.tint,
        fontFamily: "SpaceMono",
        fontSize: 12,
        lineHeight: 15,
        includeFontPadding: false,
      },
    });
  }, [colors.text, colors.tint]);

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
    const src = normalizeImageSourceUrl(node.attributes?.src ?? "");
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
          <InlineCodeContext.Provider value={{ scope: "blockquote" }}>
            {children}
          </InlineCodeContext.Provider>
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
        <View style={styles.calloutContent}>
          <InlineCodeContext.Provider value={{ scope: "callout" }}>
            {cleanedChildren}
          </InlineCodeContext.Provider>
        </View>
      </View>
    );
  };

  const inlineCodeOffsets: Record<string, number> = {
    body: 8,
    paragraph: 1,
    heading1: 7,
    heading2: 8,
    heading3: 8,
    heading4: 7,
    heading5: 9,
    heading6: 10,
    blockquote: 7.5,
    callout: 7.5,
  };
  const tableTypes = new Set(["table", "thead", "tbody", "tr", "th", "td"]);
  const blockquoteTypes = new Set(["blockquote"]);
  const headerTypes = new Set([
    "heading1",
    "heading2",
    "heading3",
    "heading4",
    "heading5",
    "heading6",
  ]);

  const InlineCodePill = ({
    content,
    parentTypes,
    parentType,
    nodeParentType,
    nodeGrandParentType,
  }: {
    content: string;
    parentTypes: Array<{ type?: string }>;
    parentType: string;
    nodeParentType?: string;
    nodeGrandParentType?: string;
  }) => {
    const { scope } = React.useContext(InlineCodeContext);
    const headerType =
      parentTypes.find((item) => headerTypes.has(item.type ?? ""))?.type ??
      (nodeParentType && headerTypes.has(nodeParentType)
        ? nodeParentType
        : undefined) ??
      (nodeGrandParentType && headerTypes.has(nodeGrandParentType)
        ? nodeGrandParentType
        : undefined);
    const isInTable =
      parentTypes.some((item) => tableTypes.has(item.type ?? "")) ||
      tableTypes.has(parentType) ||
      (nodeParentType ? tableTypes.has(nodeParentType) : false) ||
      (nodeGrandParentType ? tableTypes.has(nodeGrandParentType) : false);
    const isInBlockquote =
      parentTypes.some((item) => blockquoteTypes.has(item.type ?? "")) ||
      blockquoteTypes.has(parentType) ||
      (nodeParentType ? blockquoteTypes.has(nodeParentType) : false) ||
      (nodeGrandParentType ? blockquoteTypes.has(nodeGrandParentType) : false);
    const scopedOffset =
      scope === "callout"
        ? inlineCodeOffsets.callout
        : scope === "blockquote"
          ? inlineCodeOffsets.blockquote
          : null;
    const translateY = isInTable
      ? 0
      : scopedOffset !== null
        ? scopedOffset
        : headerType
          ? (inlineCodeOffsets[headerType] ?? inlineCodeOffsets.body)
          : isInBlockquote
            ? inlineCodeOffsets.blockquote
            : (inlineCodeOffsets[parentType] ?? inlineCodeOffsets.body);
    const translateStyle = translateY ? { transform: [{ translateY }] } : null;
    return (
      <View style={[inlineCodeStyles.pill, translateStyle]}>
        <Text style={inlineCodeStyles.text}>{`\u00A0${content}\u00A0`}</Text>
      </View>
    );
  };

  const renderInlineCode = (
    node: { key?: string; content?: string },
    _children: React.ReactNode[] = [],
    parent?: { type?: string } | Array<{ type?: string }>,
  ) => {
    const content = node.content ?? getCodeContent(node);
    const parentTypes = Array.isArray(parent) ? parent : parent ? [parent] : [];
    const parentType = parentTypes[0]?.type ?? "body";
    const nodeParentType = (node as any)?.parent?.type as string | undefined;
    const nodeGrandParentType = (node as any)?.parent?.parent?.type as
      | string
      | undefined;
    return (
      <InlineCodePill
        key={node.key}
        content={content}
        parentTypes={parentTypes}
        parentType={parentType}
        nodeParentType={nodeParentType}
        nodeGrandParentType={nodeGrandParentType}
      />
    );
  };

  const renderText = (
    node: { key?: string; content?: string },
    _children: React.ReactNode[] = [],
    parent?: { type?: string } | Array<{ type?: string }>,
    styles?: any,
    inheritedStyles: any = {},
  ) => {
    const content = node.content ?? "";
    const hasCheckbox = /[☑☐]/.test(content);

    if (!hasCheckbox || !styles) {
      return (
        <Text key={node.key} style={[inheritedStyles, styles?.text]}>
          {content}
        </Text>
      );
    }
    const parts = content.split(/([☑☐])/g);

    return (
      <Text key={node.key} style={[inheritedStyles, styles.text]}>
        {parts.map((part, index) => {
          if (part === "☑" || part === "☐") {
            const markerColor = part === "☑" ? colors.tint : colors.muted;
            return (
              <Text
                key={`${node.key}-chk-${index}`}
                style={{ color: markerColor }}
              >
                {part}
              </Text>
            );
          }
          return part;
        })}
      </Text>
    );
  };

  const renderStrikethrough = (
    node: { key?: string },
    children: React.ReactNode[] = [],
    _parent?: { type?: string } | Array<{ type?: string }>,
    styles?: any,
    inheritedStyles: any = {},
  ) => (
    <Text key={node.key} style={[inheritedStyles, styles?.s]}>
      {children}
    </Text>
  );

  const renderListItem = (
    node: { key?: string; index?: number; markup?: string },
    children: React.ReactNode[] = [],
    parent?:
      | { type?: string; attributes?: any }
      | Array<{ type?: string; attributes?: any }>,
    mdStyles?: any,
    inheritedStyles: any = {},
  ) => {
    const parents = Array.isArray(parent) ? parent : parent ? [parent] : [];
    const isBullet = parents.some((item) => item.type === "bullet_list");
    const isOrdered = parents.some((item) => item.type === "ordered_list");

    if (isBullet && mdStyles) {
      return (
        <View key={node.key} style={mdStyles._VIEW_SAFE_list_item}>
          <View
            style={[
              styles.bulletMarker,
              {
                backgroundColor: colors.tint,
                borderColor: colors.border,
              },
            ]}
          />
          <View style={mdStyles._VIEW_SAFE_bullet_list_content}>
            {children}
          </View>
        </View>
      );
    }

    if (isOrdered && mdStyles) {
      const orderedListIndex = parents.findIndex(
        (item) => item.type === "ordered_list",
      );
      const orderedList = parents[orderedListIndex] as
        | { attributes?: { start?: number } }
        | undefined;
      const listItemNumber = orderedList?.attributes?.start
        ? orderedList.attributes.start + (node.index ?? 0)
        : (node.index ?? 0) + 1;
      return (
        <View key={node.key} style={mdStyles._VIEW_SAFE_list_item}>
          <Text style={[inheritedStyles, mdStyles.ordered_list_icon]}>
            {listItemNumber}
            {node.markup}
          </Text>
          <View style={mdStyles._VIEW_SAFE_ordered_list_content}>
            {children}
          </View>
        </View>
      );
    }

    return (
      <View key={node.key} style={mdStyles?._VIEW_SAFE_list_item}>
        {children}
      </View>
    );
  };

  const markdownRules = {
    code_inline: renderInlineCode,
    text: renderText,
    s: renderStrikethrough,
    list_item: renderListItem,
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
    bullet_list_icon: { color: colors.tint },
    ordered_list_icon: { color: colors.tint },
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
    link: { color: colors.tint },
    marginTop: 1,
    borderColor: colors.border,
    em: { fontStyle: "italic" },
    strong: { fontWeight: "700" },
    s: {
      textDecorationLine: "line-through",
      textDecorationStyle: "solid",
      textDecorationColor: colors.text,
    },
  } as const;

  const summaryMarkdownStyle = {
    body: { color: colors.text, fontSize: 15, lineHeight: 20 },
    paragraph: { marginTop: 0, marginBottom: 0 },
    link: { color: colors.tint },
    em: { fontStyle: "italic" },
    strong: { fontWeight: "700" },
    s: {
      textDecorationLine: "line-through",
      textDecorationStyle: "solid",
      textDecorationColor: colors.text,
    },
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

  const markdownNodes = useMemo(() => {
    if (!isReady) {
      return null;
    }
    return renderMarkdownSegments(children, "root");
  }, [children, colors, isReady, preferences.linkOpenMode, windowWidth]);

  return (
    <LazyFadeIn visible={isReady} style={styles.markdownStack}>
      {markdownNodes}
    </LazyFadeIn>
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
  const colors = useAppColors();
  const [aspectRatio, setAspectRatio] = useState<number>(16 / 9);
  const [svgMarkup, setSvgMarkup] = useState<string | null>(null);
  const [isSvgLoaded, setIsSvgLoaded] = useState(false);
  const isReady = useDeferredRender();
  const isSvg = useMemo(() => isSvgUrl(src), [src]);

  useEffect(() => {
    if (isSvg) {
      setAspectRatio(16 / 9);
      return;
    }
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
  }, [isSvg, src]);

  useEffect(() => {
    if (!isSvg) {
      setSvgMarkup(null);
      return;
    }

    let active = true;
    setSvgMarkup(null);
    setIsSvgLoaded(false);

    void fetch(src)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to load SVG");
        }
        return response.text();
      })
      .then((text) => {
        if (!active) {
          return;
        }
        setSvgMarkup(text);
      })
      .catch(() => {
        if (active) {
          setSvgMarkup(null);
        }
      });

    return () => {
      active = false;
    };
  }, [isSvg, src]);

  const svgHtml = useMemo(() => {
    const content = svgMarkup
      ? svgMarkup
      : `<img src="${src.replace(/"/g, "&quot;")}" style="max-width:100%;height:auto;" />`;
    return `<!doctype html><html><body style="margin:0;padding:0;background:transparent;display:flex;align-items:center;justify-content:center;">${content}</body></html>`;
  }, [src, svgMarkup]);

  return (
    <LazyFadeIn visible={isReady}>
      {isReady ? (
        isSvg ? (
          <View
            style={[
              styles.image,
              styles.svgImage,
              styles.svgImageContainer,
              {
                width: maxWidth,
                maxWidth: "100%",
                backgroundColor: colors.surfaceAlt,
              },
            ]}
          >
            <WebView
              originWhitelist={["*"]}
              source={{ html: svgHtml }}
              style={[styles.svgWebView, !isSvgLoaded && styles.hidden]}
              scrollEnabled={false}
              onLoadEnd={() => setIsSvgLoaded(true)}
            />
            {!isSvgLoaded ? (
              <View style={styles.svgLoadingOverlay}>
                <ActivityIndicator size="small" color={colors.muted} />
              </View>
            ) : null}
          </View>
        ) : (
          <FadeInImage
            source={{ uri: src }}
            resizeMode="contain"
            style={[
              styles.image,
              { width: maxWidth, maxWidth: "100%", aspectRatio },
            ]}
          />
        )
      ) : null}
    </LazyFadeIn>
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
    paddingBottom: 1,
    paddingVertical: 0,
  },
  inlineCodePill: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 1,
    paddingVertical: 1,
    alignSelf: "flex-start",
  },
  inlineCodeText: {
    fontFamily: "SpaceMono",
    fontSize: 12,
    lineHeight: 15,
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
  svgImage: {
    height: 220,
    backgroundColor: "transparent",
  },
  svgWebView: {
    width: "100%",
    height: "100%",
    backgroundColor: "transparent",
  },
  svgImageContainer: {
    borderRadius: 10,
    overflow: "hidden",
  },
  svgLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  hidden: {
    opacity: 0,
  },
  bulletMarker: {
    width: 7,
    height: 7,
    borderRadius: 999,
    borderWidth: 0.5,
    marginLeft: 10,
    marginRight: 10,
    marginTop: 6,
  },
});
