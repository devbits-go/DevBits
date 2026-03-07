import React from "react";
import { View, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useAppColors } from "@/hooks/useAppColors";

interface MessageBubbleProps {
  content: string;
  timestamp: string;
  isSent: boolean;
  isPending?: boolean;
  isError?: boolean;
  authorLabel?: string;
}

export function MessageBubble({
  content,
  timestamp,
  isSent,
  isPending = false,
  isError = false,
  authorLabel,
}: MessageBubbleProps) {
  const colors = useAppColors();

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <View
      style={[
        styles.container,
        isSent ? styles.sentContainer : styles.receivedContainer,
      ]}
    >
      <View
        style={[
          styles.bubble,
          isSent
            ? [styles.sentBubble, { backgroundColor: colors.tint }]
            : [
                styles.receivedBubble,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ],
          isPending && styles.pendingBubble,
          isError && styles.errorBubble,
        ]}
      >
        <ThemedText
          type="default"
          style={[
            styles.content,
            { color: isSent ? colors.onTint : colors.text },
            isPending && { opacity: 0.6 },
          ]}
        >
          {authorLabel ? `${authorLabel}: ` : ""}
          {content}
        </ThemedText>
        <ThemedText
          type="caption"
          style={[
            styles.timestamp,
            {
              color: isSent ? colors.onTint : colors.muted,
              opacity: isSent ? 0.8 : 1,
            },
          ]}
        >
          {formatTime(timestamp)}
          {isPending && " • Sending..."}
          {isError && " • Failed"}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sentContainer: {
    alignItems: "flex-end",
  },
  receivedContainer: {
    alignItems: "flex-start",
  },
  bubble: {
    maxWidth: "92%",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 4,
  },
  sentBubble: {
    borderBottomRightRadius: 3,
  },
  receivedBubble: {
    borderBottomLeftRadius: 3,
    borderWidth: 1,
  },
  pendingBubble: {
    opacity: 0.7,
  },
  errorBubble: {
    opacity: 0.5,
  },
  content: {
    fontFamily: "SpaceMono",
    fontSize: 14,
    lineHeight: 20,
  },
  timestamp: {
    fontFamily: "SpaceMono",
    fontSize: 10,
    marginTop: 2,
  },
});
