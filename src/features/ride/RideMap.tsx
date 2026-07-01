import { useEffect, useRef } from "react";
import { View, Text, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import { buildRideMapHtml, NAVER_CLIENT_ID, type LngLat } from "../../lib/naverMap";
import theme from "../../theme/theme";

/**
 * Live ride map (native). Loads the Naver map once, then pushes incremental
 * track/position updates into the page via injectJavaScript on every `version`
 * bump — the map itself never reloads, so a long ride is a single map load.
 *
 * Without a Naver key it degrades to a notice; tracking keeps recording either
 * way (the dashboard + outbox don't depend on the map).
 */
export function RideMap({
  planned = [],
  track,
  deviated,
  position,
  version,
}: {
  planned?: LngLat[];
  track: LngLat[];
  deviated: LngLat[][];
  position: LngLat | null;
  version: number;
}) {
  const ref = useRef<WebView>(null);
  // Build the page once; `planned` is fixed for the duration of a ride.
  const html = useRef(buildRideMapHtml(planned)).current;

  // Keep the latest snapshot so we can push on load and on each version bump.
  const latest = useRef({ track, deviated, position });
  latest.current = { track, deviated, position };

  function push() {
    const { track, deviated, position } = latest.current;
    const payload = JSON.stringify({ track, deviated, pos: position });
    ref.current?.injectJavaScript(`window.__rideUpdate(${payload}); true;`);
  }

  useEffect(() => {
    push();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  if (!NAVER_CLIENT_ID) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackText}>Live map needs a Naver Map client ID</Text>
        <Text style={styles.fallbackSub}>
          Tracking still records — set EXPO_PUBLIC_NAVER_MAP_CLIENT_ID to see the map
        </Text>
      </View>
    );
  }

  return (
    <WebView
      ref={ref}
      originWhitelist={["*"]}
      source={{ html, baseUrl: "http://localhost" }}
      style={styles.web}
      scrollEnabled={false}
      javaScriptEnabled
      domStorageEnabled
      onLoadEnd={push}
    />
  );
}

const styles = StyleSheet.create({
  web: { flex: 1, backgroundColor: theme.colors.border },
  fallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.space.xl,
    gap: theme.space.xs,
    backgroundColor: theme.colors.border,
  },
  fallbackText: {
    fontSize: theme.fontSize.body,
    fontFamily: theme.fontFamily.medium,
    color: theme.colors.textMuted,
    textAlign: "center",
  },
  fallbackSub: {
    fontSize: theme.fontSize.caption,
    fontFamily: theme.fontFamily.regular,
    color: theme.colors.textMuted,
    textAlign: "center",
  },
});

export default RideMap;
