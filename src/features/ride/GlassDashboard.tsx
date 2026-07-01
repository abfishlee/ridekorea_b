import { View, Text, StyleSheet } from "react-native";
import type { RideStats } from "./track";
import theme from "../../theme/theme";

function fmtDuration(s: number): string {
  const total = Math.max(0, Math.floor(s));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Glanceable, glove-friendly ride stats over the map. White text on a dark scrim. */
export function GlassDashboard({
  stats,
  deviated,
}: {
  stats: RideStats;
  deviated: boolean;
}) {
  const km = (stats.distanceM / 1000).toFixed(2);
  const speed = Math.max(0, stats.lastSpeedKmh).toFixed(1);

  return (
    <View style={styles.card}>
      <View style={[styles.pill, deviated ? styles.pillOff : styles.pillOn]}>
        <View
          style={[
            styles.dot,
            { backgroundColor: deviated ? theme.colors.exploration : theme.colors.accent },
          ]}
        />
        <Text style={styles.pillText}>{deviated ? "OFF ROUTE" : "ON ROUTE"}</Text>
      </View>

      <View style={styles.speedRow}>
        <Text style={styles.speed}>{speed}</Text>
        <Text style={styles.speedUnit}>km/h</Text>
      </View>

      <View style={styles.metrics}>
        <Metric label="DISTANCE" value={`${km} km`} />
        <View style={styles.sep} />
        <Metric label="TIME" value={fmtDuration(stats.durationS)} />
        <View style={styles.sep} />
        <Metric label="POINTS" value={String(stats.pointCount)} />
      </View>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.scrimDark,
    borderRadius: theme.radius.card,
    paddingVertical: theme.space.lg,
    paddingHorizontal: theme.space.xl,
    gap: theme.space.sm,
  },
  pill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space.xs,
    paddingVertical: theme.space.xs,
    paddingHorizontal: theme.space.md,
    borderRadius: theme.radius.pill,
  },
  pillOn: { backgroundColor: "rgba(14,165,233,0.22)" },
  pillOff: { backgroundColor: "rgba(236,72,153,0.24)" },
  dot: { width: 8, height: 8, borderRadius: 4 },
  pillText: {
    fontSize: theme.fontSize.caption,
    fontFamily: theme.fontFamily.bold,
    letterSpacing: 0.8,
    color: theme.colors.textOnGlassDark,
  },
  speedRow: { flexDirection: "row", alignItems: "flex-end", gap: theme.space.sm },
  speed: {
    fontSize: theme.fontSize.metric,
    lineHeight: theme.fontSize.metric,
    fontFamily: theme.fontFamily.bold,
    color: theme.colors.textOnGlassDark,
  },
  speedUnit: {
    fontSize: theme.fontSize.label,
    fontFamily: theme.fontFamily.medium,
    color: theme.colors.textOnGlassDark,
    opacity: 0.85,
    marginBottom: 6,
  },
  metrics: { flexDirection: "row", alignItems: "center", marginTop: theme.space.xs },
  metric: { flex: 1, gap: 2 },
  metricValue: {
    fontSize: theme.fontSize.title,
    fontFamily: theme.fontFamily.semibold,
    color: theme.colors.textOnGlassDark,
  },
  metricLabel: {
    fontSize: 11,
    fontFamily: theme.fontFamily.medium,
    letterSpacing: 0.6,
    color: theme.colors.textOnGlassDark,
    opacity: 0.7,
  },
  sep: { width: 1, alignSelf: "stretch", marginVertical: 4, backgroundColor: "rgba(255,255,255,0.18)" },
});

export default GlassDashboard;
