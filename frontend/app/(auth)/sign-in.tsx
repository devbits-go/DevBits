import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Link } from "expo-router";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { ThemedText } from "@/components/ThemedText";
import { useAuth } from "@/contexts/AuthContext";
import { useAppColors } from "@/hooks/useAppColors";
import { useMotionConfig } from "@/hooks/useMotionConfig";

export default function SignInScreen() {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const motion = useMotionConfig();
  const reveal = useRef(new Animated.Value(0)).current;
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (motion.prefersReducedMotion) {
      reveal.setValue(1);
      return;
    }

    Animated.timing(reveal, {
      toValue: 1,
      duration: motion.duration(320),
      useNativeDriver: true,
    }).start();
  }, [motion, reveal]);

  const handleSubmit = async () => {
    if (!username || !password) {
      setErrorMessage("Enter username and password.");
      return;
    }
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      await signIn({ username, password });
    } catch (error) {
      setErrorMessage("Sign in failed. Check credentials.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: colors.background }]}
      edges={[]}
    >
      <Animated.View
        style={[
          styles.content,
          {
            paddingTop: insets.top + 8,
            opacity: reveal,
            transform: [
              {
                translateY: reveal.interpolate({
                  inputRange: [0, 1],
                  outputRange: [12, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.header}>
          <ThemedText type="display">DevBits</ThemedText>
          <ThemedText type="caption" style={{ color: colors.muted }}>
            Sign in to ship bytes.
          </ThemedText>
        </View>

        <View style={styles.form}>
          <View
            style={[
              styles.inputRow,
              { borderColor: colors.border, backgroundColor: colors.surface },
            ]}
          >
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="Username"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              style={[styles.input, { color: colors.text }]}
            />
          </View>
          <View
            style={[
              styles.inputRow,
              { borderColor: colors.border, backgroundColor: colors.surface },
            ]}
          >
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={colors.muted}
              secureTextEntry
              style={[styles.input, { color: colors.text }]}
            />
          </View>

          {errorMessage ? (
            <ThemedText type="caption" style={{ color: colors.muted }}>
              {errorMessage}
            </ThemedText>
          ) : null}

          <Pressable
            onPress={handleSubmit}
            style={[styles.button, { backgroundColor: colors.tint }]}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <ThemedText
                type="defaultSemiBold"
                style={{ color: colors.accent }}
              >
                Sign in
              </ThemedText>
            )}
          </Pressable>
        </View>

        <View style={styles.footer}>
          <ThemedText type="caption" style={{ color: colors.muted }}>
            New here?
          </ThemedText>
          <Link href="/(auth)/sign-up">
            <ThemedText type="link">Create account</ThemedText>
          </Link>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 24,
    justifyContent: "space-between",
  },
  header: {
    marginTop: 20,
    gap: 6,
  },
  form: {
    gap: 12,
  },
  inputRow: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  input: {
    fontFamily: "SpaceMono",
    fontSize: 15,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  footer: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
});
