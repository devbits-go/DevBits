import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  Platform,
  LayoutAnimation,
  UIManager,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useAppColors } from "@/hooks/useAppColors";
import { useMotionConfig } from "@/hooks/useMotionConfig";

interface MessageComposerProps {
  onSend: (message: string) => Promise<void>;
  placeholder?: string;
  autoFocus?: boolean;
}

export function MessageComposer({
  onSend,
  placeholder = "Type a message...",
  autoFocus = false,
}: MessageComposerProps) {
  const colors = useAppColors();
  const motion = useMotionConfig();
  const [text, setText] = useState("");
  const [height, setHeight] = useState(40);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (
      Platform.OS === "android" &&
      UIManager.setLayoutAnimationEnabledExperimental
    ) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const animateResize = () => {
    LayoutAnimation.configureNext({
      duration: motion.duration(140),
      update: {
        type: LayoutAnimation.Types.easeInEaseOut,
      },
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
    });
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    setIsLoading(true);
    try {
      await onSend(trimmed);
      animateResize();
      setText("");
      setHeight(40); // Reset height after sending
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleContentSizeChange = (event: any) => {
    const newHeight = event.nativeEvent.contentSize.height;
    // Min 40, max 120
    const nextHeight = Math.min(Math.max(40, newHeight), 120);
    if (Math.abs(nextHeight - height) < 2) {
      return;
    }
    animateResize();
    setHeight(nextHeight);
  };

  const canSend = text.trim().length > 0 && !isLoading;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={[
          styles.input,
          {
            color: colors.text,
            height: Math.max(40, height),
          },
        ]}
        multiline
        textAlignVertical="top"
        autoCapitalize="sentences"
        autoCorrect={true}
        autoFocus={autoFocus}
        blurOnSubmit={false}
        returnKeyType="default"
        scrollEnabled={height >= 120}
        onContentSizeChange={handleContentSizeChange}
      />
      <Pressable
        onPress={handleSend}
        disabled={!canSend}
        style={[
          styles.sendButton,
          {
            backgroundColor: canSend ? colors.tint : colors.border,
          },
        ]}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={colors.onTint} />
        ) : (
          <Feather
            name="send"
            size={16}
            color={canSend ? colors.onTint : colors.muted}
          />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginBottom: 0,
  },
  input: {
    flex: 1,
    fontFamily: "SpaceMono",
    fontSize: 15,
    paddingTop: Platform.OS === "ios" ? 8 : 6,
    paddingBottom: Platform.OS === "ios" ? 8 : 6,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
});
