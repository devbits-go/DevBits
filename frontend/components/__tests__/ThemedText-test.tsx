import * as React from "react";
import { Text } from "react-native";
import renderer from "react-test-renderer";

import { ThemedText } from "../ThemedText";

it("renders correctly", () => {
  const testRenderer = renderer.create(<ThemedText>Snapshot test!</ThemedText>);

  const textNode = testRenderer.root.findByType(Text);
  expect(textNode.props.children).toBe("Snapshot test!");
});
