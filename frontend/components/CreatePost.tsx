import React, { useState } from "react";
import { Animated, Modal, Pressable, StyleSheet, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "@/components/ThemedText";
import { useAppColors } from "@/hooks/useAppColors";

export default function CreatePost() {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [slideAnim] = useState(new Animated.Value(24));

  const openMenu = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setMenuOpen(true);
    slideAnim.setValue(24);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  };

  const closeMenu = () => {
    setMenuOpen(false);
  };

  const handleAddByte = () => {
    closeMenu();
    router.push("/create-byte");
  };

  const handleAddStream = () => {
    closeMenu();
    router.push("/create-stream");
  };

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Pressable
        onPress={openMenu}
        style={[
          styles.button,
          {
            backgroundColor: colors.tint,
            borderColor: colors.border,
            bottom: Math.max(14, insets.bottom + 10),
          },
        ]}
      >
        <Feather name="plus" size={16} color={colors.accent} />
      </Pressable>

      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={closeMenu}
      >
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeMenu} />
          <Animated.View
            style={[
              styles.menu,
              {
                transform: [{ translateY: slideAnim }],
                backgroundColor: colors.surface,
                borderColor: colors.border,
                bottom: Math.max(72, insets.bottom + 66),
              },
            ]}
          >
            <Pressable
              style={[styles.menuButton, { borderColor: colors.border }]}
              onPress={handleAddStream}
            >
              <Feather name="radio" size={16} color={colors.tint} />
              <ThemedText type="default">Add stream</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.menuButton, { borderColor: colors.border }]}
              onPress={handleAddByte}
            >
              <Feather name="message-circle" size={16} color={colors.tint} />
              <ThemedText type="default">Add byte</ThemedText>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    position: "absolute",
    right: 16,
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
  },
  menu: {
    position: "absolute",
    right: 16,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 10,
    minWidth: 170,
  },
  menuButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
});
