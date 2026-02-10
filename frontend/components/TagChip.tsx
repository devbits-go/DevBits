import React from "react";
import { StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useAppColors } from "@/hooks/useAppColors";

type TagChipProps = {
  label: string;
  tone?: "default" | "accent";
};

export function TagChip({ label, tone = "default" }: TagChipProps) {
  const colors = useAppColors();

  const backgroundColor = tone === "accent" ? colors.tint : colors.chip;
  const textColor = tone === "accent" ? colors.accent : colors.chipText;

  return (
    <View
      style={[
        styles.chip,
        { backgroundColor },
        tone === "accent" && {
          shadowColor: colors.tint,
          shadowOpacity: 0.25,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 0 },
          elevation: 2,
        },
      ]}
    >
      <ThemedText type="caption" style={[styles.text, { color: textColor }]}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  text: {
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
