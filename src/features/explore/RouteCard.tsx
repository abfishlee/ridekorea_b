import { View, Text, Image, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import theme from "../../theme/theme";
import { FeedRoute, formatDistance, formatDuration, flagEmoji } from "./api";

function Meta({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.meta}>
      <Ionicons name={icon} size={14} color={theme.colors.textMuted} />
      <Text style={styles.metaText}>{text}</Text>
    </View>
  );
}

export function RouteCard({ route, onPress }: { route: FeedRoute; onPress?: () => void }) {
  const author = route.author;
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={onPress}
    >
      {route.cover_photo_url ? (
        <Image source={{ uri: route.cover_photo_url }} style={styles.cover} />
      ) : (
        <View style={[styles.cover, styles.coverPlaceholder]}>
          <Ionicons name="map-outline" size={36} color={theme.colors.textMuted} />
        </View>
      )}

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {route.title}
        </Text>

        <Text style={styles.author}>
          {author
            ? `${flagEmoji(author.nationality)} ${author.display_name ?? "Rider"}`.trim()
            : "Official route"}
        </Text>

        <View style={styles.row}>
          <Meta icon="navigate-outline" text={formatDistance(route.distance_m)} />
          <Meta icon="time-outline" text={formatDuration(route.est_duration_s)} />
          <Meta icon="heart-outline" text={String(route.likes_count)} />
          <Meta icon="chatbubble-outline" text={String(route.comments_count)} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  pressed: { opacity: 0.9 },
  cover: { width: "100%", height: 170, backgroundColor: theme.colors.bg },
  coverPlaceholder: { alignItems: "center", justifyContent: "center" },
  body: { padding: theme.space.lg, gap: theme.space.xs },
  title: {
    fontSize: theme.fontSize.title,
    fontFamily: theme.fontFamily.bold,
    color: theme.colors.text,
  },
  author: {
    fontSize: theme.fontSize.body,
    fontFamily: theme.fontFamily.medium,
    color: theme.colors.textMuted,
  },
  row: { flexDirection: "row", gap: theme.space.lg, marginTop: theme.space.xs },
  meta: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: {
    fontSize: theme.fontSize.caption,
    fontFamily: theme.fontFamily.regular,
    color: theme.colors.textMuted,
  },
});

export default RouteCard;
