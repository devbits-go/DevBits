import React from "react";
import { ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAppColors } from "@/hooks/useAppColors";

interface ScrollToTopButtonProps {
  scrollViewRef: React.RefObject<ScrollView>;
}

const ScrollToTopButton: React.FC<ScrollToTopButtonProps> = ({
  scrollViewRef,
}) => {
  const colors = useAppColors();

  const scrollToTop = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor: colors.tint, borderColor: colors.border },
      ]}
      onPress={scrollToTop}
      activeOpacity={1}
    >
      <Feather name="arrow-up" color={colors.onTint} size={20} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    padding: 10,
    borderRadius: 30,
    zIndex: 2,
    borderWidth: 1,
  },
});

export default ScrollToTopButton;
