import { ReactNode } from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import theme from "../theme/theme";

/** Placeholder screen used for tab stubs until each phase fills them in. */
export function ScreenStub({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children?: ReactNode;
}) {
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.center}>
        <Text style={styles.title}>{title}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: theme.space.sm },
  title: {
    fontSize: theme.fontSize.h2,
    fontFamily: theme.fontFamily.bold,
    color: theme.colors.primary,
  },
  hint: {
    fontSize: theme.fontSize.caption,
    fontFamily: theme.fontFamily.regular,
    color: theme.colors.textMuted,
  },
});

export default ScreenStub;
