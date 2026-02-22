import React, { useState } from "react";
import { ActivityIndicator, Alert, Pressable, View } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useAuth } from "@/contexts/AuthContext";
import { useAppColors } from "@/hooks/useAppColors";
import { deleteUser } from "@/services/api";
import { SettingsPageShell, settingsStyles } from "@/features/settings/shared";

export default function SettingsSecurityScreen() {
  const colors = useAppColors();
  const { user, signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState("");

  const handleSignOut = async () => {
    if (isSigningOut) {
      return;
    }
    setIsSigningOut(true);
    setMessage("");
    try {
      await signOut();
    } catch {
      setMessage("Sign out failed. Try again.");
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleDeleteAccount = () => {
    if (!user?.username || isDeleting) {
      return;
    }

    Alert.alert(
      "Delete account?",
      "This permanently deletes your account, streams, bytes, and history.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setIsDeleting(true);
              setMessage("");
              try {
                await deleteUser(user.username);
                await signOut();
              } catch {
                setMessage("Account deletion failed. Try again.");
              } finally {
                setIsDeleting(false);
              }
            })();
          },
        },
      ],
    );
  };

  return (
    <SettingsPageShell
      title="Security"
      subtitle="Session controls and account protection"
    >
      <View
        style={[
          settingsStyles.sectionCard,
          { borderColor: colors.border, backgroundColor: colors.surface },
        ]}
      >
        <ThemedText type="defaultSemiBold">Session</ThemedText>
        <Pressable
          onPress={handleSignOut}
          style={({ pressed }) => [
            settingsStyles.buttonAlt,
            {
              borderColor: colors.border,
              backgroundColor: colors.surfaceAlt,
              opacity: pressed ? 0.82 : 1,
            },
          ]}
          disabled={isSigningOut}
        >
          {isSigningOut ? (
            <ActivityIndicator size="small" color={colors.muted} />
          ) : (
            <ThemedText type="defaultSemiBold" style={{ color: colors.muted }}>
              Sign out
            </ThemedText>
          )}
        </Pressable>
      </View>

      <View
        style={[
          settingsStyles.sectionCard,
          { borderColor: colors.border, backgroundColor: colors.surface },
        ]}
      >
        <ThemedText type="defaultSemiBold">Danger zone</ThemedText>
        <ThemedText type="caption" style={{ color: colors.muted }}>
          This permanently removes your account and all related content.
        </ThemedText>
        <Pressable
          onPress={handleDeleteAccount}
          style={({ pressed }) => [
            settingsStyles.button,
            {
              backgroundColor: colors.surfaceAlt,
              borderColor: colors.border,
              borderWidth: 1,
              opacity: pressed ? 0.78 : 1,
            },
          ]}
          disabled={isDeleting}
        >
          {isDeleting ? (
            <ActivityIndicator size="small" color={colors.muted} />
          ) : (
            <ThemedText type="defaultSemiBold" style={{ color: colors.muted }}>
              Delete account
            </ThemedText>
          )}
        </Pressable>
      </View>

      {message ? (
        <ThemedText type="caption" style={{ color: colors.muted }}>
          {message}
        </ThemedText>
      ) : null}
    </SettingsPageShell>
  );
}
