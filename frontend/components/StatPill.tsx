import React from "react";
import { StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useAppColors } from "@/hooks/useAppColors";

type StatPillProps = {
  label: string;
  value: string | number;
};

export function StatPill({ label, value }: StatPillProps) {
  const colors = useAppColors();

  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: colors.surfaceAlt,
          borderColor: colors.border,
          shadowColor: colors.tint,
        },
      ]}
    >
      <ThemedText type="caption" style={{ color: colors.muted }}>
        {label}
      </ThemedText>
      <ThemedText type="defaultSemiBold" style={styles.value}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 2,
    minWidth: 74,
    borderWidth: 1,
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
  value: {
    fontSize: 16,
  },
});
