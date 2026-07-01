import "../src/i18n"; // initialize i18n (side effect)
import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import * as SplashScreen from "expo-splash-screen";
import { useAppFonts } from "../src/theme/fonts";
import { queryClient } from "../src/lib/queryClient";
import { useAuth } from "../src/stores/auth";

SplashScreen.preventAutoHideAsync();

/** Redirects between /login and the app based on auth state. */
function useProtectedRoute() {
  const session = useAuth((s) => s.session);
  const initializing = useAuth((s) => s.initializing);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (initializing) return;
    const inAuthScreen = segments[0] === "login";
    if (!session && !inAuthScreen) {
      router.replace("/login");
    } else if (session && inAuthScreen) {
      router.replace("/");
    }
  }, [session, initializing, segments, router]);
}

function RootNavigator() {
  useProtectedRoute();
  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  const { loaded, error } = useAppFonts();
  const init = useAuth((s) => s.init);

  // Subscribe to auth session on mount.
  useEffect(() => {
    const unsubscribe = init();
    return unsubscribe;
  }, [init]);

  // Hide splash once fonts are ready.
  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <RootNavigator />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
