import { PropsWithChildren, type ReactNode, useState } from "react";
import { StyleSheet, TouchableOpacity } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { useAppColors } from "@/hooks/useAppColors";

type CollapsibleProps = PropsWithChildren & {
  title: ReactNode;
  defaultOpen?: boolean;
};

export function Collapsible({
  children,
  title,
  defaultOpen = false,
}: CollapsibleProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const colors = useAppColors();
  const isTitleText = typeof title === "string" || typeof title === "number";

  return (
    <ThemedView
      style={[
        styles.container,
        { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
      ]}
    >
      <TouchableOpacity
        style={[styles.heading, { backgroundColor: colors.surfaceAlt }]}
        onPress={() => setIsOpen((value) => !value)}
        activeOpacity={0.8}
      >
        <IconSymbol
          name="chevron.right"
          size={18}
          weight="medium"
          color={colors.icon}
          style={{ transform: [{ rotate: isOpen ? "90deg" : "0deg" }] }}
        />

        {isTitleText ? (
          <ThemedText type="defaultSemiBold">{title}</ThemedText>
        ) : (
          title
        )}
      </TouchableOpacity>
      {isOpen && (
        <ThemedView
          style={[styles.content, { backgroundColor: colors.surface }]}
        >
          {children}
        </ThemedView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  content: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
