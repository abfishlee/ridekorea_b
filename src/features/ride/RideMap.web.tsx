import { View, Text, StyleSheet } from "react-native";
import type { LngLat } from "../../lib/naverMap";
import theme from "../../theme/theme";

/**
 * Web placeholder for the live ride map. react-native-webview doesn't run on
 * web, so the native Naver map is shown only in the app/dev build. Tracking and
 * the dashboard still work on web (browser geolocation). Option ① (web Ride
 * screen) can replace this with an inline web Naver map.
 */
export function RideMap(props: {
  planned?: LngLat[];
  track: LngLat[];
  deviated: LngLat[][];
  position: LngLat | null;
  version: number;
}) {
  const pts = props.track.length;
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>🗺️ Ride map</Text>
      <Text style={styles.sub}>
        {pts > 0
          ? `Recording — ${pts} point${pts === 1 ? "" : "s"} so far.`
          : "The live map renders in the app build. Start a ride to track."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.space.sm,
    padding: theme.space.xl,
    backgroundColor: theme.colors.border,
  },
  title: { fontSize: theme.fontSize.title, fontFamily: theme.fontFamily.semibold, color: theme.colors.text },
  sub: { fontSize: theme.fontSize.body, fontFamily: theme.fontFamily.regular, color: theme.colors.textMuted, textAlign: "center" },
});

export default RideMap;
