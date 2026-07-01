import { useState } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import {
  useRouteDetail,
  useImportRoute,
  useToggleLike,
  useRoutePath,
  useRouteSpots,
  RouteSpot,
  SpotType,
} from "../../src/features/route/api";
import { formatDistance, formatDuration, flagEmoji } from "../../src/features/explore/api";
import { RouteMap } from "../../src/features/route/RouteMap";
import theme from "../../src/theme/theme";

const SPOT_ICON: Record<SpotType, keyof typeof Ionicons.glyphMap> = {
  SCENERY: "image-outline",
  REPAIR: "construct-outline",
  FOOD: "restaurant-outline",
  LODGING: "bed-outline",
  DANGER: "warning-outline",
  START: "flag-outline",
  FINISH: "trophy-outline",
  GENERAL: "location-outline",
};

export default function RouteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { data: route, isLoading, error } = useRouteDetail(id);

  const importRoute = useImportRoute();
  const toggleLike = useToggleLike(id);
  const { data: path } = useRoutePath(id);
  const { data: spots } = useRouteSpots(id);
  const [liked, setLiked] = useState(false);

  const onImport = () => {
    importRoute.mutate(id, {
      onSuccess: () => {
        Alert.alert("Added to your routes", "Find it in your Diary to start the ride.", [
          { text: "OK", onPress: () => router.back() },
        ]);
      },
      onError: (e) =>
        Alert.alert("Couldn't import", e instanceof Error ? e.message : String(e)),
    });
  };

  const onToggleLike = () => {
    toggleLike.mutate(undefined, {
      onSuccess: (nowLiked) => setLiked(nowLiked),
      onError: (e) => Alert.alert("Error", e instanceof Error ? e.message : String(e)),
    });
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.fill}>
        <ActivityIndicator color={theme.colors.primary} />
      </SafeAreaView>
    );
  }
  if (error || !route) {
    return (
      <SafeAreaView style={styles.fill}>
        <Text style={styles.muted}>Couldn't load this route.</Text>
        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Cover */}
        {route.cover_photo_url ? (
          <Image source={{ uri: route.cover_photo_url }} style={styles.cover} />
        ) : (
          <View style={[styles.cover, styles.coverPlaceholder]}>
            <Ionicons name="map-outline" size={48} color={theme.colors.textMuted} />
          </View>
        )}

        <View style={styles.body}>
          <Text style={styles.title}>{route.title}</Text>
          <Text style={styles.author}>
            {route.author
              ? `${flagEmoji(route.author.nationality)} ${route.author.display_name ?? "Rider"}`.trim()
              : "Official route"}
          </Text>

          {/* Stats */}
          <View style={styles.stats}>
            <Stat icon="navigate-outline" value={formatDistance(route.distance_m)} label="distance" />
            <Stat
              icon="trending-up-outline"
              value={route.elevation_gain_m ? `${Math.round(route.elevation_gain_m)} m` : "—"}
              label="climb"
            />
            <Stat icon="time-outline" value={formatDuration(route.est_duration_s)} label="time" />
          </View>

          {path && path.length > 0 ? (
            <View style={styles.mapBlock}>
              <RouteMap coords={path} spots={spots ?? []} />
            </View>
          ) : null}

          {route.summary ? <Text style={styles.summary}>{route.summary}</Text> : null}

          {/* Social */}
          <View style={styles.social}>
            <Pressable style={styles.likeBtn} onPress={onToggleLike} disabled={toggleLike.isPending}>
              <Ionicons
                name={liked ? "heart" : "heart-outline"}
                size={20}
                color={liked ? theme.colors.exploration : theme.colors.textMuted}
              />
              <Text style={styles.socialText}>{route.likes_count}</Text>
            </Pressable>
            <View style={styles.likeBtn}>
              <Ionicons name="chatbubble-outline" size={18} color={theme.colors.textMuted} />
              <Text style={styles.socialText}>{route.comments_count}</Text>
            </View>
          </View>

          {/* Journey timeline */}
          {route.spots.length > 0 ? (
            <View style={styles.timeline}>
              <Text style={styles.sectionTitle}>Journey</Text>
              {route.spots.map((spot, i) => (
                <TimelineRow key={spot.id} spot={spot} last={i === route.spots.length - 1} />
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Back button (floating) */}
      <SafeAreaView style={styles.topBar} edges={["top"]} pointerEvents="box-none">
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </Pressable>
      </SafeAreaView>

      {/* CTA */}
      <SafeAreaView style={styles.ctaWrap} edges={["bottom"]}>
        <Pressable style={styles.cta} onPress={onImport} disabled={importRoute.isPending}>
          {importRoute.isPending ? (
            <ActivityIndicator color={theme.colors.textOnPrimary} />
          ) : (
            <Text style={styles.ctaText}>{t("explore.makeItMyRoute")}</Text>
          )}
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
}) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={18} color={theme.colors.primary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function TimelineRow({ spot, last }: { spot: RouteSpot; last: boolean }) {
  return (
    <View style={styles.row}>
      <View style={styles.rail}>
        <View style={styles.dot}>
          <Ionicons name={SPOT_ICON[spot.spot_type] ?? "location-outline"} size={14} color={theme.colors.surface} />
        </View>
        {!last ? <View style={styles.line} /> : null}
      </View>
      <View style={styles.rowBody}>
        {spot.photo_url ? <Image source={{ uri: spot.photo_url }} style={styles.spotPhoto} /> : null}
        {spot.title ? <Text style={styles.spotTitle}>{spot.title}</Text> : null}
        {spot.memo ? <Text style={styles.spotMemo}>{spot.memo}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  fill: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.bg, gap: theme.space.sm },
  scroll: { paddingBottom: 120 },
  cover: { width: "100%", height: 240, backgroundColor: theme.colors.border },
  coverPlaceholder: { alignItems: "center", justifyContent: "center" },
  body: { padding: theme.space.lg, gap: theme.space.sm },
  title: { fontSize: theme.fontSize.h1, fontFamily: theme.fontFamily.bold, color: theme.colors.text },
  author: { fontSize: theme.fontSize.label, fontFamily: theme.fontFamily.medium, color: theme.colors.textMuted },
  stats: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: theme.space.md,
    marginTop: theme.space.sm,
  },
  stat: { alignItems: "center", gap: 2 },
  statValue: { fontSize: theme.fontSize.label, fontFamily: theme.fontFamily.semibold, color: theme.colors.text },
  statLabel: { fontSize: theme.fontSize.caption, fontFamily: theme.fontFamily.regular, color: theme.colors.textMuted },
  mapBlock: { marginTop: theme.space.sm },
  summary: { fontSize: theme.fontSize.body, fontFamily: theme.fontFamily.regular, color: theme.colors.text, lineHeight: 22, marginTop: theme.space.sm },
  social: { flexDirection: "row", gap: theme.space.lg, marginTop: theme.space.sm },
  likeBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  socialText: { fontSize: theme.fontSize.body, fontFamily: theme.fontFamily.medium, color: theme.colors.textMuted },
  timeline: { marginTop: theme.space.lg, gap: 0 },
  sectionTitle: { fontSize: theme.fontSize.title, fontFamily: theme.fontFamily.bold, color: theme.colors.text, marginBottom: theme.space.md },
  row: { flexDirection: "row", gap: theme.space.md },
  rail: { alignItems: "center", width: 28 },
  dot: { width: 28, height: 28, borderRadius: 14, backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center" },
  line: { flex: 1, width: 2, backgroundColor: theme.colors.border, marginVertical: 4 },
  rowBody: { flex: 1, paddingBottom: theme.space.lg, gap: theme.space.xs },
  spotPhoto: { width: "100%", height: 160, borderRadius: theme.radius.card, backgroundColor: theme.colors.border },
  spotTitle: { fontSize: theme.fontSize.label, fontFamily: theme.fontFamily.semibold, color: theme.colors.text },
  spotMemo: { fontSize: theme.fontSize.body, fontFamily: theme.fontFamily.regular, color: theme.colors.textMuted, lineHeight: 20 },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, paddingHorizontal: theme.space.lg, paddingTop: theme.space.sm },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.surface, alignItems: "center", justifyContent: "center", ...shadow() },
  backLink: { marginTop: theme.space.md },
  backLinkText: { color: theme.colors.primary, fontFamily: theme.fontFamily.medium },
  muted: { fontSize: theme.fontSize.body, fontFamily: theme.fontFamily.regular, color: theme.colors.textMuted },
  ctaWrap: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: theme.space.lg, paddingTop: theme.space.sm, backgroundColor: theme.colors.bg },
  cta: {
    minHeight: theme.space.touch,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.space.sm,
  },
  ctaText: { fontSize: theme.fontSize.label, fontFamily: theme.fontFamily.bold, color: theme.colors.textOnPrimary },
});

function shadow() {
  return {
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  };
}
