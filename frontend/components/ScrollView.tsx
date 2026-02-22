import type { PropsWithChildren } from "react";
import { StyleSheet, SafeAreaView } from "react-native";
import Animated, { useAnimatedRef } from "react-native-reanimated";
import { ThemedView } from "@/components/ThemedView";
import { useBottomTabOverflow } from "@/components/ui/TabBarBackground";

const HEADER_HEIGHT = 250;

type Props = PropsWithChildren;

export default function ScrollView({ children }: Props) {
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const bottom = useBottomTabOverflow();

  return (
    <SafeAreaView style={styles.container}>
      <ThemedView style={styles.container}>
        <Animated.ScrollView
          ref={scrollRef}
          scrollEventThrottle={16}
          scrollIndicatorInsets={{ bottom }}
          contentContainerStyle={{
            paddingBottom: bottom,
            flexGrow: 1,
          }}
        >
          <ThemedView style={styles.content}>{children}</ThemedView>
        </Animated.ScrollView>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: HEADER_HEIGHT,
    overflow: "hidden",
  },
  content: {
    flex: 1,
    paddingVertical: 32,
    paddingHorizontal: 0,
    gap: 16,
    overflow: "hidden",
  },
});
