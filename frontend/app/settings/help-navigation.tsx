import React from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { useAuth } from "@/contexts/AuthContext";
import { useAppColors } from "@/hooks/useAppColors";
import { SettingsPageShell, settingsStyles } from "@/features/settings/shared";

export default function SettingsHelpNavigationScreen() {
  const colors = useAppColors();
  const router = useRouter();
  const { user } = useAuth();

  return (
    <SettingsPageShell
      title="Help & Navigation"
      subtitle="Guides, shortcuts and quick destinations"
    >
      <View
        style={[
          settingsStyles.sectionCard,
          { borderColor: colors.border, backgroundColor: colors.surface },
        ]}
      >
        <ThemedText type="defaultSemiBold">Guides</ThemedText>
        <ActionRow
          label="Open welcome tour"
          detail="Replay onboarding walkthrough"
          onPress={() =>
            router.push({ pathname: "/welcome", params: { mode: "help" } })
          }
        />
        <ActionRow
          label="Markdown syntax help"
          detail="Formatting reference and examples"
          onPress={() => router.push("/markdown-help")}
        />
      </View>

      <View
        style={[
          settingsStyles.sectionCard,
          { borderColor: colors.border, backgroundColor: colors.surface },
        ]}
      >
        <ThemedText type="defaultSemiBold">Quick navigation</ThemedText>
        <ActionRow
          label="Notifications"
          detail="Open activity feed"
          onPress={() => router.push("/notifications")}
        />
        <ActionRow
          label="Terminal"
          detail="Open direct messages and chats"
          onPress={() => router.push("/terminal")}
        />
        <ActionRow
          label="Public profile"
          detail="Preview how others see you"
          onPress={() => {
            if (!user?.username) {
              return;
            }
            router.push({
              pathname: "/user/[username]",
              params: { username: user.username },
            });
          }}
        />
      </View>
    </SettingsPageShell>
  );
}

function ActionRow({
  label,
  detail,
  onPress,
}: {
  label: string;
  detail: string;
  onPress: () => void;
}) {
  const colors = useAppColors();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        settingsStyles.buttonAlt,
        {
          borderColor: colors.border,
          backgroundColor: colors.surfaceAlt,
          opacity: pressed ? 0.82 : 1,
        },
      ]}
    >
      <View style={{ alignItems: "center", gap: 2 }}>
        <ThemedText type="defaultSemiBold">{label}</ThemedText>
        <ThemedText type="caption" style={{ color: colors.muted }}>
          {detail}
        </ThemedText>
      </View>
    </Pressable>
  );
}
