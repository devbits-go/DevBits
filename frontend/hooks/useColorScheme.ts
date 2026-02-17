import { Appearance, useColorScheme as useRNColorScheme } from "react-native";

export function useColorScheme() {
	const scheme = useRNColorScheme();
	if (scheme) {
		return scheme;
	}
	return Appearance.getColorScheme() ?? "light";
}
