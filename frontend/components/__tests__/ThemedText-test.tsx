import * as React from "react";
import { Text } from "react-native";
import renderer from "react-test-renderer";

import { ThemedText } from "../ThemedText";

jest.mock("@/contexts/PreferencesContext", () => ({
  usePreferences: () => ({
    preferences: {
      zenMode: false,
      compactMode: false,
      textRenderEffect: "off",
    },
  }),
}));

jest.mock("@/hooks/useThemeColor", () => ({
  useThemeColor: () => "#000",
}));

it("renders correctly", () => {
  let testRenderer: renderer.ReactTestRenderer;
  renderer.act(() => {
    testRenderer = renderer.create(
      <ThemedText animateOnMount={false} animationMode="none">
        Snapshot test!
      </ThemedText>,
    );
  });

  const textNode = testRenderer!.root.findByType(Text);
  expect(textNode.props.children).toBe("Snapshot test!");
  renderer.act(() => {
    testRenderer!.unmount();
  });
});
