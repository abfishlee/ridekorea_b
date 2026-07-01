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
  TextInput,
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
import {
  useComments,
  useAddComment,
  useDeleteComment,
  RouteComment,
} from "../../src/features/route/social";
import { RouteMap } from "../../src/features/route/RouteMap";
import { useAuth } from "../../src/stores/auth";
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
  const session = useAuth((s) => s.session);

  const importRoute = useImportRoute();
  const toggleLike = useToggleLike(id);
  const { data: path } = useRoutePath(id);
  const { data: spots } = useRouteSpots(id);
  const [liked, setLiked] = useState(false);

  const comments = useComments(id);
  const addComment = useAddComment(id);
  const deleteComment = useDeleteComment(id);
  const [commentText, setCommentText] = useState("");

  const onAddComment = () => {
    const body = commentText.trim();
    if (!body) return;
    addComment.mutate(body, {
      onSuccess: () => setCommentText(""),
      onError: (e) =>
        Alert.alert(t("route.commentError"), e instanceof Error ? e.message : String(e)),
    });
  };

  const onDeleteComment = (commentId: string) => {
    Alert.alert(t("route.deleteCommentTitle"), t("route.deleteCommentBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: () =>
          deleteComment.mutate(commentId, {
            onError: (e) => Alert.alert(t("common.error"), e instanceof Error ? e.message : String(e)),
          }),
      },
    ]);
  };

  const onImport = () => {
    importRoute.mutate(id, {
      onSuccess: (newRouteId) => {
        Alert.alert(t("route.importedTitle"), t("route.importedBody"), [
          { text: t("common.later"), style: "cancel", onPress: () => router.back() },
          {
            text: t("route.rideNow"),
            onPress: () =>
              router.replace({ pathname: "/ride", params: { routeId: newRouteId } }),
          },
        ]);
      },
      onError: (e) =>
        Alert.alert(t("route.couldntImport"), e instanceof Error ? e.message : String(e)),
    });
  };

  const onToggleLike = () => {
    toggleLike.mutate(undefined, {
      onSuccess: (nowLiked) => setLiked(nowLiked),
      onError: (e) => Alert.alert(t("common.error"), e instanceof Error ? e.message : String(e)),
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
        <Text style={styles.muted}>{t("route.loadError")}</Text>
        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>{t("common.goBack")}</Text>
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
              ? `${flagEmoji(route.author.nationality)} ${route.author.display_name ?? t("route.rider")}`.trim()
              : t("route.official")}
          </Text>

          {/* Stats */}
          <View style={styles.stats}>
            <Stat icon="navigate-outline" value={formatDistance(route.distance_m)} label={t("route.distance")} />
            <Stat
              icon="trending-up-outline"
              value={route.elevation_gain_m ? `${Math.round(route.elevation_gain_m)} m` : "\u2014"}
              label={t("route.climb")}
            />
            <Stat icon="time-outline" value={formatDuration(route.est_duration_s)} label={t("route.time")} />
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
              <Text style={styles.sectionTitle}>{t("route.journey")}</Text>
              {route.spots.map((spot, i) => (
                <TimelineRow key={spot.id} spot={spot} last={i === route.spots.length - 1} />
              ))}
            </View>
          ) : null}

          {/* Comments */}
          <View style={styles.comments}>
            <Text style={styles.sectionTitle}>
              {t("route.comments")}{route.comments_count ? ` (${route.comments_count})` : ""}
            </Text>

            {(comments.data ?? []).map((c) => (
              <CommentRow
                key={c.id}
                comment={c}
                mine={!!session && c.author?.id === session.user.id}
                onDelete={() => onDeleteComment(c.id)}
              />
            ))}
            {comments.data && comments.data.length === 0 ? (
              <Text style={styles.noComments}>{t("route.commentsEmpty")}</Text>
            ) : null}

            <View style={styles.commentInputRow}>
              <TextInput
                style={styles.commentInput}
                placeholder={t("route.commentPlaceholder")}
                placeholderTextColor={theme.colors.textMuted}
                value={commentText}
                onChangeText={setCommentText}
                multiline
              />
              <Pressable
                style={[
                  styles.sendBtn,
                  (!commentText.trim() || addComment.isPending) && styles.sendBtnOff,
                ]}
                onPress={onAddComment}
                disabled={!commentText.trim() || addComment.isPending}
              >
                {addComment.isPending ? (
                  <ActivityIndicator size="small" color={theme.colors.textOnPrimary} />
                ) : (
                  <Ionicons name="send" size={16} color={theme.colors.textOnPrimary} />
                )}
              </Pressable>
            </View>
          </View>
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
        {session && route.author?.id === session.user.id ? (
          <Pressable
            style={styles.cta}
            onPress={() => router.push({ pathname: "/ride", params: { routeId: id } })}
          >
            <Text style={styles.ctaText}>{t("route.rideThisRoute")}</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.cta} onPress={onImport} disabled={importRoute.isPending}>
            {importRoute.isPending ? (
              <ActivityIndicator color={theme.colors.textOnPrimary} />
            ) : (
              <Text style={styles.ctaText}>{t("explore.makeItMyRoute")}</Text>
            )}
          </Pressable>
        )}
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

function CommentRow({
  comment,
  mine,
  onDelete,
}: {
  comment: RouteComment;
  mine: boolean;
  onDelete: () => void;
}) {
  const flag = flagEmoji(comment.author?.nationality ?? null);
  const { t } = useTranslation();
  return (
    <View style={styles.commentRow}>
      <View style={styles.commentAvatar}>
        {comment.author?.profile_image_url ? (
          <Image
            source={{ uri: comment.author.profile_image_url }}
            style={styles.commentAvatarImg}
          />
        ) : (
          <Text style={styles.commentAvatarText}>{flag || "\ud83d\udeb2"}</Text>
        )}
      </View>
      <View style={styles.commentContent}>
        <View style={styles.commentHead}>
          <Text style={styles.commentAuthor} numberOfLines={1}>
            {comment.author?.display_name ?? t("route.rider")}
          </Text>
          <Text style={styles.commentDate}>
            {new Date(comment.created_at).toLocaleDateString()}
          </Text>
        </View>
        <Text style={styles.commentBody}>{comment.body}</Text>
      </View>
      {mine ? (
        <Pressable onPress={onDelete} hitSlop={8} style={styles.commentDelete}>
          <Ionicons name="trash-outline" size={16} color={theme.colors.textMuted} />
        </Pressable>
      ) : null}
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

  comments: { marginTop: theme.space.lg },
  noComments: {
    fontSize: theme.fontSize.body,
    fontFamily: theme.fontFamily.regular,
    color: theme.colors.textMuted,
    marginBottom: theme.space.md,
  },
  commentRow: { flexDirection: "row", gap: theme.space.sm, marginBottom: theme.space.md, alignItems: "flex-start" },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.bg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  commentAvatarImg: { width: 32, height: 32 },
  commentAvatarText: { fontSize: 16 },
  commentContent: { flex: 1, gap: 2 },
  commentHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.space.sm },
  commentAuthor: { flex: 1, fontSize: theme.fontSize.body, fontFamily: theme.fontFamily.semibold, color: theme.colors.text },
  commentDate: { fontSize: theme.fontSize.caption, fontFamily: theme.fontFamily.regular, color: theme.colors.textMuted },
  commentBody: { fontSize: theme.fontSize.body, fontFamily: theme.fontFamily.regular, color: theme.colors.text, lineHeight: 20 },
  commentDelete: { paddingTop: 2 },
  commentInputRow: { flexDirection: "row", alignItems: "flex-end", gap: theme.space.sm, marginTop: theme.space.sm },
  commentInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.space.md,
    paddingTop: theme.space.sm,
    paddingBottom: theme.space.sm,
    fontSize: theme.fontSize.body,
    fontFamily: theme.fontFamily.regular,
    color: theme.colors.text,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center" },
  sendBtnOff: { opacity: 0.5 },
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
