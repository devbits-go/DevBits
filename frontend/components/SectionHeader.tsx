import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useAppColors } from "@/hooks/useAppColors";

type SectionHeaderProps = {
  title: string;
  actionLabel?: string;
  actionOnPress?: () => void;
};

export function SectionHeader({
  title,
  actionLabel,
  actionOnPress,
}: SectionHeaderProps) {
  const colors = useAppColors();

  return (
    <View style={styles.container}>
      <ThemedText
        type="subtitle"
        style={[styles.title, { color: colors.text }]}
      >
        {title}
      </ThemedText>
      {actionLabel ? (
        <Pressable
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          onPress={actionOnPress}
        >
          <ThemedText type="caption" style={{ color: colors.tint }}>
            {actionLabel}
          </ThemedText>
          <Feather name="arrow-up-right" size={12} color={colors.tint} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  title: {
    fontSize: 16,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginRight: 16,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ translateY: -1 }],
  },
});
