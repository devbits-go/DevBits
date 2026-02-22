import React from "react";
import { StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useAppColors } from "@/hooks/useAppColors";
import { useColorScheme } from "@/hooks/useColorScheme";

type TagChipProps = {
  label: string;
  tone?: "default" | "accent";
};

export function TagChip({ label, tone = "default" }: TagChipProps) {
  const colors = useAppColors();
  const theme = useColorScheme() ?? "light";

  const liftHex = (hex: string, amount: number) => {
    const normalized = hex.replace("#", "").trim();
    const value =
      normalized.length === 3
        ? normalized
            .split("")
            .map((chunk) => `${chunk}${chunk}`)
            .join("")
        : normalized.padEnd(6, "0").slice(0, 6);

    const mix = (channel: number) =>
      Math.round(channel + (255 - channel) * amount)
        .toString(16)
        .padStart(2, "0");

    const red = parseInt(value.slice(0, 2), 16);
    const green = parseInt(value.slice(2, 4), 16);
    const blue = parseInt(value.slice(4, 6), 16);
    return `#${mix(red)}${mix(green)}${mix(blue)}`;
  };

  const backgroundColor =
    tone === "accent"
      ? colors.tint
      : theme === "dark"
        ? liftHex(colors.chip, 0.08)
        : colors.chip;
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
