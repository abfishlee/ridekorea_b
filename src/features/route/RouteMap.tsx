import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import { useTranslation } from "react-i18next";
import { mapProvider, type LngLat, type SpotMarker } from "../../map";
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
  const { t } = useTranslation();
  const html = useMemo(
    () => mapProvider.buildStaticRouteHtml(coords, { spots }),
    [coords, spots],
  );

  // Without a configured map key the map can't render — show a graceful placeholder.
  if (!mapProvider.isConfigured) {
    return (
      <View style={[styles.fallback, { height }]}>
        <Text style={styles.fallbackText}>{t("route.mapFallback")}</Text>
        <Text style={styles.fallbackSub}>{t("route.mapFallbackSub")}</Text>
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
