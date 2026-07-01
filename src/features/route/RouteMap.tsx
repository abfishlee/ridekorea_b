import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import { buildRouteMapHtml, NAVER_CLIENT_ID, LngLat, SpotMarker } from "../../lib/naverMap";
import theme from "../../theme/theme";

export function RouteMap({
  coords,
  spots = [],
  height = 220,
}: {
  coords: LngLat[];
  spots?: SpotMarker[];
  height?: number;
}) {
  const html = useMemo(() => buildRouteMapHtml(coords, { spots }), [coords, spots]);

  // Without a Naver key the map can't render — show a graceful placeholder.
  if (!NAVER_CLIENT_ID) {
    return (
      <View style={[styles.fallback, { height }]}>
        <Text style={styles.fallbackText}>Map preview needs a Naver Map client ID</Text>
        <Text style={styles.fallbackSub}>Set EXPO_PUBLIC_NAVER_MAP_CLIENT_ID in .env</Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { height }]}>
      <WebView
        originWhitelist={["*"]}
        source={{ html, baseUrl: "http://localhost" }}
        style={styles.web}
        scrollEnabled={false}
        javaScriptEnabled
        domStorageEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: theme.radius.card,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.border,
  },
  web: { flex: 1, backgroundColor: "transparent" },
  fallback: {
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  fallbackText: {
    fontSize: theme.fontSize.body,
    fontFamily: theme.fontFamily.medium,
    color: theme.colors.textMuted,
  },
  fallbackSub: {
    fontSize: theme.fontSize.caption,
    fontFamily: theme.fontFamily.regular,
    color: theme.colors.textMuted,
  },
});

export default RouteMap;
