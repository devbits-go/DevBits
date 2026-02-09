import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useAppColors } from "@/hooks/useAppColors";

const TopBar = () => {
  const colors = useAppColors();
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <Pressable
        style={[styles.iconButton, { backgroundColor: colors.surfaceAlt }]}
      >
        <Feather name="menu" size={18} color={colors.text} />
      </Pressable>
      <ThemedText type="defaultSemiBold" style={styles.title}>
        DevBits
      </ThemedText>
      <Pressable
        style={[styles.iconButton, { backgroundColor: colors.surfaceAlt }]}
      >
        <Feather name="search" size={18} color={colors.text} />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default TopBar;
