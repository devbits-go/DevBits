import React from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { usePreferences } from "@/contexts/PreferencesContext";
import { useAppColors } from "@/hooks/useAppColors";
import {
  LabeledSwitchRow,
  SettingsPageShell,
  settingsStyles,
} from "@/features/settings/shared";
import {
  pageTransitionOptions,
  imageRevealOptions,
  intervalOptions,
  textRenderOptions,
} from "@/features/settings/utils";

export default function SettingsSystemScreen() {
  const colors = useAppColors();
  const router = useRouter();
  const { preferences, updatePreferences } = usePreferences();

  return (
    <SettingsPageShell
      title="System"
      subtitle="Performance, behavior and rendering controls"
    >
      <View
        style={[
          settingsStyles.sectionCard,
          { borderColor: colors.border, backgroundColor: colors.surface },
        ]}
      >
        <LabeledSwitchRow
          label="Background refresh"
          value={preferences.backgroundRefreshEnabled}
          onChange={(value) =>
            void updatePreferences({ backgroundRefreshEnabled: value })
          }
        />
        <LabeledSwitchRow
          label="Prompt for link scheme"
          value={preferences.linkOpenMode === "promptScheme"}
          onChange={(value) =>
            void updatePreferences({
              linkOpenMode: value ? "promptScheme" : "asTyped",
            })
          }
        />
        <LabeledSwitchRow
          label="Zen mode"
          value={preferences.zenMode}
          onChange={(value) => void updatePreferences({ zenMode: value })}
        />
        <LabeledSwitchRow
          label="Compact layout"
          value={preferences.compactMode}
          onChange={(value) => void updatePreferences({ compactMode: value })}
        />
      </View>

      <View
        style={[
          settingsStyles.sectionCard,
          { borderColor: colors.border, backgroundColor: colors.surface },
        ]}
      >
        <ThemedText type="defaultSemiBold">Refresh interval</ThemedText>
        <View style={settingsStyles.chips}>
          {intervalOptions.map((option) => {
            const active = preferences.refreshIntervalMs === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() =>
                  void updatePreferences({ refreshIntervalMs: option.value })
                }
                disabled={!preferences.backgroundRefreshEnabled}
                style={({ pressed }) => [
                  settingsStyles.chip,
                  {
                    borderColor: colors.border,
                    backgroundColor: active ? colors.tint : colors.surfaceAlt,
                    opacity: preferences.backgroundRefreshEnabled ? 1 : 0.5,
                  },
                  pressed && { opacity: 0.82 },
                ]}
              >
                <ThemedText
                  type="caption"
                  style={{ color: active ? colors.onTint : colors.muted }}
                >
                  {option.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View
        style={[
          settingsStyles.sectionCard,
          { borderColor: colors.border, backgroundColor: colors.surface },
        ]}
      >
        <ThemedText type="defaultSemiBold">Text render effect</ThemedText>
        <View style={settingsStyles.chips}>
          {textRenderOptions.map((option) => {
            const active = preferences.textRenderEffect === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() =>
                  void updatePreferences({ textRenderEffect: option.value })
                }
                style={({ pressed }) => [
                  settingsStyles.chip,
                  {
                    borderColor: colors.border,
                    backgroundColor: active ? colors.tint : colors.surfaceAlt,
                  },
                  pressed && { opacity: 0.82 },
                ]}
              >
                <ThemedText
                  type="caption"
                  style={{ color: active ? colors.onTint : colors.muted }}
                >
                  {option.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View
        style={[
          settingsStyles.sectionCard,
          { borderColor: colors.border, backgroundColor: colors.surface },
        ]}
      >
        <ThemedText type="defaultSemiBold">Page transition</ThemedText>
        <View style={settingsStyles.chips}>
          {pageTransitionOptions.map((option) => {
            const active = preferences.pageTransitionEffect === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() =>
                  void updatePreferences({ pageTransitionEffect: option.value })
                }
                style={({ pressed }) => [
                  settingsStyles.chip,
                  {
                    borderColor: colors.border,
                    backgroundColor: active ? colors.tint : colors.surfaceAlt,
                  },
                  pressed && { opacity: 0.82 },
                ]}
              >
                <ThemedText
                  type="caption"
                  style={{ color: active ? colors.onTint : colors.muted }}
                >
                  {option.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View
        style={[
          settingsStyles.sectionCard,
          { borderColor: colors.border, backgroundColor: colors.surface },
        ]}
      >
        <ThemedText type="defaultSemiBold">Image reveal effect</ThemedText>
        <View style={settingsStyles.chips}>
          {imageRevealOptions.map((option) => {
            const active = preferences.imageRevealEffect === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() =>
                  void updatePreferences({ imageRevealEffect: option.value })
                }
                style={({ pressed }) => [
                  settingsStyles.chip,
                  {
                    borderColor: colors.border,
                    backgroundColor: active ? colors.tint : colors.surfaceAlt,
                  },
                  pressed && { opacity: 0.82 },
                ]}
              >
                <ThemedText
                  type="caption"
                  style={{ color: active ? colors.onTint : colors.muted }}
                >
                  {option.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Pressable
        onPress={() => router.push("/settings/theme")}
        style={({ pressed }) => [
          settingsStyles.buttonAlt,
          {
            borderColor: colors.border,
            backgroundColor: colors.surface,
          },
          pressed && { opacity: 0.82 },
        ]}
      >
        <ThemedText type="defaultSemiBold" style={{ color: colors.muted }}>
          Open Theme settings
        </ThemedText>
      </Pressable>
    </SettingsPageShell>
  );
}
