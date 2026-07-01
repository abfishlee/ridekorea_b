import {
  View,
  Text,
  Image,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "../../src/stores/auth";
import { useMyJourneys, MyJourney, JourneyStatus } from "../../src/features/diary/api";
import { usePublishRoute } from "../../src/features/route/social";
import { formatDistance, formatDuration } from "../../src/features/explore/api";
import theme from "../../src/theme/theme";

const STATUS_LABEL: Record<JourneyStatus, string> = {
  DRAFT: "Draft",
  ACTIVE: "Riding",
  FINISHED: "Finished",
};
const STATUS_COLOR: Record<JourneyStatus, string> = {
  DRAFT: theme.colors.textMuted,
  ACTIVE: theme.colors.accent,
  FINISHED: theme.colors.success,
};

export default function Diary() {
  const { t } = useTranslation();
  const router = useRouter();
  const userId = useAuth((s) => s.session?.user.id);
  const { data: journeys, isLoading, error, refetch, isRefetching } = useMyJourneys(userId);
  const publish = usePublishRoute();

  const onTogglePublish = (j: MyJourney) => {
    const makePublic = j.visibility !== "PUBLIC";
    publish.mutate(
      { routeId: j.id, isPublic: makePublic },
      {
        onError: (e) =>
          Alert.alert("Couldn't update", e instanceof Error ? e.message : String(e)),
      },
    );
  };

  return (
    <SafeAreaView style={styles.fill} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.h1}>{t("tabs.diary")}</Text>
        <Text style={styles.sub}>Routes you've made your own — ride again or share.</Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.muted}>Couldn't load your journeys.</Text>
        </View>
      ) : (
        <FlatList
          data={journeys ?? []}
          keyExtractor={(j) => j.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <JourneyCard
              journey={item}
              onOpen={() => router.push({ pathname: "/route/[id]", params: { id: item.id } })}
              onRide={() => router.push({ pathname: "/ride", params: { routeId: item.id } })}
              onTogglePublish={() => onTogglePublish(item)}
              publishing={publish.isPending && publish.variables?.routeId === item.id}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={theme.colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>{"\ud83e\udded"}</Text>
              <Text style={styles.emptyTitle}>No journeys yet</Text>
              <Text style={styles.muted}>
                Find a route in Explore, tap “Make it my route,” then ride it — it lands here.
              </Text>
              <Pressable style={styles.exploreBtn} onPress={() => router.push("/(tabs)")}>
                <Text style={styles.exploreText}>Explore routes</Text>
              </Pressable>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function JourneyCard({
  journey,
  onOpen,
  onRide,
  onTogglePublish,
  publishing,
}: {
  journey: MyJourney;
  onOpen: () => void;
  onRide: () => void;
  onTogglePublish: () => void;
  publishing: boolean;
}) {
  const isPublic = journey.visibility === "PUBLIC";
  const isFinished = journey.status === "FINISHED";

  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={onOpen}>
      {journey.cover_photo_url ? (
        <Image source={{ uri: journey.cover_photo_url }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]}>
          <Ionicons name="map-outline" size={26} color={theme.colors.textMuted} />
        </View>
      )}

      <View style={styles.cardBody}>
        <Text style={styles.title} numberOfLines={1}>
          {journey.title}
        </Text>

        <View style={styles.metaRow}>
          <Text style={styles.meta}>{formatDistance(journey.distance_m)}</Text>
          <Text style={styles.dot}>·</Text>
          <Text style={styles.meta}>{formatDuration(journey.est_duration_s)}</Text>
          <Ionicons
            name={isPublic ? "earth" : "lock-closed"}
            size={13}
            color={theme.colors.textMuted}
            style={styles.visIcon}
          />
        </View>

        <View style={styles.actionRow}>
          <View style={[styles.badge, { backgroundColor: STATUS_COLOR[journey.status] }]}>
            <Text style={styles.badgeText}>{STATUS_LABEL[journey.status]}</Text>
          </View>

          <Pressable style={styles.rideBtn} onPress={onRide} hitSlop={6}>
            <Ionicons name="bicycle" size={15} color={theme.colors.primary} />
            <Text style={styles.rideText}>Ride</Text>
          </Pressable>

          {isFinished ? (
            <Pressable
              style={[styles.shareBtn, isPublic && styles.shareBtnOn]}
              onPress={onTogglePublish}
              disabled={publishing}
              hitSlop={6}
            >
              {publishing ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <Text style={[styles.shareText, isPublic && styles.shareTextOn]}>
                  {isPublic ? "Shared" : "Share"}
                </Text>
              )}
            </Pressable>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: theme.colors.bg },
  header: { paddingHorizontal: theme.space.lg, paddingTop: theme.space.md, paddingBottom: theme.space.sm },
  h1: { fontSize: theme.fontSize.h1, fontFamily: theme.fontFamily.bold, color: theme.colors.text },
  sub: {
    fontSize: theme.fontSize.body,
    fontFamily: theme.fontFamily.regular,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  list: { paddingHorizontal: theme.space.lg, paddingTop: theme.space.sm, paddingBottom: theme.space.xxl, flexGrow: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  muted: {
    fontSize: theme.fontSize.body,
    fontFamily: theme.fontFamily.regular,
    color: theme.colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },

  card: {
    flexDirection: "row",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden",
    marginBottom: theme.space.md,
  },
  pressed: { opacity: 0.9 },
  thumb: { width: 96, height: 96, backgroundColor: theme.colors.border },
  thumbPlaceholder: { alignItems: "center", justifyContent: "center" },
  cardBody: { flex: 1, padding: theme.space.md, justifyContent: "center", gap: theme.space.xs },
  title: { fontSize: theme.fontSize.label, fontFamily: theme.fontFamily.bold, color: theme.colors.text },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  meta: { fontSize: theme.fontSize.caption, fontFamily: theme.fontFamily.medium, color: theme.colors.textMuted },
  dot: { color: theme.colors.textMuted },
  visIcon: { marginLeft: 4 },

  actionRow: { flexDirection: "row", alignItems: "center", gap: theme.space.sm, marginTop: 2 },
  badge: { borderRadius: theme.radius.pill, paddingHorizontal: theme.space.sm, paddingVertical: 2 },
  badgeText: {
    color: theme.colors.textOnPrimary,
    fontSize: theme.fontSize.caption,
    fontFamily: theme.fontFamily.semibold,
  },
  rideBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: theme.space.sm, paddingVertical: 3 },
  rideText: { color: theme.colors.primary, fontSize: theme.fontSize.caption, fontFamily: theme.fontFamily.semibold },
  shareBtn: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.space.md,
    paddingVertical: 3,
  },
  shareBtnOn: { backgroundColor: theme.colors.bg, borderColor: theme.colors.primary },
  shareText: { color: theme.colors.textMuted, fontSize: theme.fontSize.caption, fontFamily: theme.fontFamily.semibold },
  shareTextOn: { color: theme.colors.primary },

  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: theme.space.xxl * 2,
    paddingHorizontal: theme.space.xl,
    gap: theme.space.sm,
  },
  emptyEmoji: { fontSize: 44 },
  emptyTitle: { fontSize: theme.fontSize.title, fontFamily: theme.fontFamily.bold, color: theme.colors.text },
  exploreBtn: {
    marginTop: theme.space.sm,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.space.xl,
    paddingVertical: theme.space.sm,
  },
  exploreText: { color: theme.colors.textOnPrimary, fontFamily: theme.fontFamily.bold, fontSize: theme.fontSize.body },
});
