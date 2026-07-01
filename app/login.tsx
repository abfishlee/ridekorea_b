import { useState } from "react";
import { View, Text, Pressable, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useAuth } from "../src/stores/auth";
import theme from "../src/theme/theme";

export default function Login() {
  const { t } = useTranslation();
  const signInWithGoogle = useAuth((s) => s.signInWithGoogle);
  const signInDev = useAuth((s) => s.signInDev);
  const [busy, setBusy] = useState(false);

  const onGoogle = async () => {
    try {
      setBusy(true);
      await signInWithGoogle();
    } catch (e) {
      Alert.alert(t("onboarding.signInFailed"), e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onDev = async () => {
    try {
      setBusy(true);
      await signInDev();
    } catch (e) {
      Alert.alert("Dev sign-in failed", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.emoji}>🚴</Text>
        <Text style={styles.brand}>{t("common.appName")}</Text>
        <Text style={styles.tagline}>{t("onboarding.tagline")}</Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.btn, styles.google, pressed && styles.pressed]}
          onPress={onGoogle}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color={theme.colors.text} />
          ) : (
            <Text style={styles.googleText}>{t("onboarding.continueWithGoogle")}</Text>
          )}
        </Pressable>

        {/* Apple is enabled at commercialization (paid Apple Developer account). */}
        <Pressable style={[styles.btn, styles.apple]} disabled>
          <Text style={styles.appleText}>{t("onboarding.continueWithApple")}</Text>
          <Text style={styles.soon}>{t("onboarding.appleSoon")}</Text>
        </Pressable>

        <Text style={styles.priming}>{t("onboarding.locationPriming")}</Text>

        {__DEV__ ? (
          <Pressable style={styles.devBtn} onPress={onDev} disabled={busy}>
            <Text style={styles.devText}>Dev sign-in (skip Google)</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.space.xl,
    justifyContent: "space-between",
    paddingVertical: theme.space.xxl,
  },
  hero: { flex: 1, alignItems: "center", justifyContent: "center", gap: theme.space.md },
  emoji: { fontSize: 72 },
  brand: {
    fontSize: theme.fontSize.h1,
    fontFamily: theme.fontFamily.bold,
    color: theme.colors.textOnPrimary,
  },
  tagline: {
    fontSize: theme.fontSize.label,
    fontFamily: theme.fontFamily.regular,
    color: theme.colors.textOnPrimary,
    textAlign: "center",
    opacity: 0.9,
    lineHeight: 24,
  },
  actions: { gap: theme.space.md },
  btn: {
    minHeight: theme.space.touch,
    borderRadius: theme.radius.card,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: theme.space.sm,
  },
  pressed: { opacity: 0.85 },
  google: { backgroundColor: theme.colors.surface },
  googleText: {
    fontSize: theme.fontSize.label,
    fontFamily: theme.fontFamily.semibold,
    color: theme.colors.text,
  },
  apple: { backgroundColor: "rgba(255,255,255,0.12)", opacity: 0.6 },
  appleText: {
    fontSize: theme.fontSize.label,
    fontFamily: theme.fontFamily.semibold,
    color: theme.colors.textOnPrimary,
  },
  soon: {
    fontSize: theme.fontSize.caption,
    fontFamily: theme.fontFamily.regular,
    color: theme.colors.textOnPrimary,
    opacity: 0.8,
  },
  priming: {
    fontSize: theme.fontSize.caption,
    fontFamily: theme.fontFamily.regular,
    color: theme.colors.textOnPrimary,
    opacity: 0.75,
    textAlign: "center",
    lineHeight: 18,
  },
  devBtn: { alignSelf: "center", paddingVertical: theme.space.sm, paddingHorizontal: theme.space.lg },
  devText: {
    fontSize: theme.fontSize.caption,
    fontFamily: theme.fontFamily.medium,
    color: theme.colors.textOnPrimary,
    textDecorationLine: "underline",
    opacity: 0.85,
  },
});
