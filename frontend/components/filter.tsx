import React, { useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ThemedText } from "@/components/ThemedText";
import { useAppColors } from "@/hooks/useAppColors";

export const MyFilter: React.FC = () => {
  const [modalVisible, setModalVisible] = useState(false);
  const [slideAnim] = useState(new Animated.Value(40));
  const [value, setValue] = useState(false);
  const [trendingOnly, setTrendingOnly] = useState(true);
  const colors = useAppColors();

  const toggleModal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setModalVisible(!modalVisible);
    if (!modalVisible) {
      slideAnim.setValue(40);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start();
    }
  };

  return (
    <View style={{ backgroundColor: "transparent" }}>
      <Pressable
        onPress={toggleModal}
        style={({ pressed }) => [
          styles.filterButton,
          { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
          pressed && styles.pressed,
        ]}
      >
        <Feather name="sliders" size={14} color={colors.muted} />
        <ThemedText type="caption" style={{ color: colors.muted }}>
          Filter
        </ThemedText>
      </Pressable>
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={toggleModal}
      >
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={toggleModal} />
          <Animated.View
            style={[
              styles.panel,
              {
                transform: [{ translateY: slideAnim }],
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.panelHeader}>
              <ThemedText type="subtitle">Filter feed</ThemedText>
              <Pressable
                onPress={toggleModal}
                style={({ pressed }) => [pressed && styles.pressedInline]}
              >
                <Feather name="x" color={colors.muted} size={20} />
              </Pressable>
            </View>
            <View style={styles.toggleRow}>
              <ThemedText type="default">
                Only show projects with new updates
              </ThemedText>
              <Switch
                trackColor={{ false: colors.surfaceAlt, true: colors.tint }}
                thumbColor={colors.accent}
                value={value}
                onValueChange={() => {
                  Haptics.selectionAsync();
                  setValue(!value);
                }}
              />
            </View>
            <View style={styles.toggleRow}>
              <ThemedText type="default">Trending this week</ThemedText>
              <Switch
                trackColor={{ false: colors.surfaceAlt, true: colors.tint }}
                thumbColor={colors.accent}
                value={trendingOnly}
                onValueChange={() => {
                  Haptics.selectionAsync();
                  setTrendingOnly(!trendingOnly);
                }}
              />
            </View>
            <Pressable
              style={({ pressed }) => [
                styles.applyButton,
                { backgroundColor: colors.tint },
                pressed && styles.pressed,
              ]}
              onPress={toggleModal}
            >
              <ThemedText
                type="defaultSemiBold"
                style={{ color: colors.onTint }}
              >
                Apply filters
              </ThemedText>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(9, 14, 12, 0.4)",
    padding: 20,
  },
  panel: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 16,
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  applyButton: {
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  pressedInline: {
    opacity: 0.75,
  },
});
