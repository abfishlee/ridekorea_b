import { useMemo, useState } from "react";
import {
  View,
  Text,
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

import { useAuth } from "../src/stores/auth";
import {
  useLogisticsTips,
  useMyTipVotes,
  useToggleTipUpvote,
  LogisticsTip,
} from "../src/features/logistics/api";
import theme from "../src/theme/theme";

const ALL = "__ALL__";

export default function LogisticsBoard() {
  const { t } = useTranslation();
  const router = useRouter();
  const userId = useAuth((s) => s.session?.user.id);

  const { data: tips, isLoading, error, refetch, isRefetching } = useLogisticsTips();
  const myVotes = useMyTipVotes(userId);
  const toggle = useToggleTipUpvote(userId);
  const [filter, setFilter] = useState<string>(ALL);

  const votedIds = useMemo(() => new Set(myVotes.data ?? []), [myVotes.data]);

  // Distinct categories, in first-seen order, for the filter row.
  const categories = useMemo(() => {
    const seen: string[] = [];
    for (const tip of tips ?? []) {
      const c = tip.category ?? "GENERAL";
      if (!seen.includes(c)) seen.push(c);
    }
    return seen;
  }, [tips]);

  const shown = useMemo(
    () => (tips ?? []).filter((tip) => filter === ALL || (tip.category ?? "GENERAL") === filter),
    [tips, filter],
  );

  const catLabel = (c: string) => t(`logistics.categories.${c}`, { defaultValue: c });

  const onUpvote = (tip: LogisticsTip) => {
    if (!userId) {
      Alert.alert(t("logistics.signInTitle"), t("logistics.signInBody"));
      return;
    }
    toggle.mutate(tip.id, {
      onError: (e) =>
        Alert.alert(t("logistics.voteError"), e instanceof Error ? e.message : String(e)),
    });
  };

  return (
    <SafeAreaView style={styles.fill} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.h1}>{t("logistics.title")}</Text>
          <Text style={styles.sub}>{t("logistics.subtitle")}</Text>
        </View>
      </View>

      {/* Category filter */}
      {categories.length > 0 ? (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[ALL, ...categories]}
          keyExtractor={(c) => c}
          contentContainerStyle={styles.chips}
          renderItem={({ item }) => {
            const active = filter === item;
            const label = item === ALL ? t("logistics.all") : catLabel(item);
            return (
              <Pressable
                onPress={() => setFilter(item)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
              </Pressable>
            );
          }}
        />
      ) : null}

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.muted}>{t("logistics.loadError")}</Text>
        </View>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(tip) => tip.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={theme.colors.primary}
            />
          }
          renderItem={({ item }) => (
            <TipCard
              tip={item}
              voted={votedIds.has(item.id)}
              busy={toggle.isPending && toggle.variables === item.id}
              categoryLabel={catLabel(item.category ?? "GENERAL")}
              onUpvote={() => onUpvote(item)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="bicycle-outline" size={40} color={theme.colors.textMuted} />
              <Text style={styles.muted}>{t("logistics.empty")}</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function TipCard({
  tip,
  voted,
  busy,
  categoryLabel,
  onUpvote,
}: {
  tip: LogisticsTip;
  voted: boolean;
  busy: boolean;
  categoryLabel: string;
  onUpvote: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.catBadge}>
          <Text style={styles.catBadgeText}>{categoryLabel}</Text>
        </View>
        {tip.region ? (
          <View style={styles.regionRow}>
            <Ionicons name="location-outline" size={13} color={theme.colors.textMuted} />
            <Text style={styles.region}>{tip.region}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.title}>{tip.title}</Text>
      <Text style={styles.body}>{tip.body}</Text>

      <View style={styles.cardBottom}>
        <Pressable
          style={[styles.voteBtn, voted && styles.voteBtnOn]}
          onPress={onUpvote}
          disabled={busy}
          hitSlop={6}
        >
          {busy ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <>
              <Ionicons
                name={voted ? "arrow-up-circle" : "arrow-up-circle-outline"}
                size={18}
                color={voted ? theme.colors.primary : theme.colors.textMuted}
              />
              <Text style={[styles.voteText, voted && styles.voteTextOn]}>{tip.upvotes}</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: theme.colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.space.sm,
    paddingHorizontal: theme.space.lg,
    paddingTop: theme.space.md,
    paddingBottom: theme.space.sm,
  },
  back: { paddingTop: 2 },
  headerText: { flex: 1 },
  h1: { fontSize: theme.fontSize.h1, fontFamily: theme.fontFamily.bold, color: theme.colors.text },
  sub: {
    fontSize: theme.fontSize.body,
    fontFamily: theme.fontFamily.regular,
    color: theme.colors.textMuted,
    marginTop: 2,
  },

  chips: { paddingHorizontal: theme.space.lg, paddingBottom: theme.space.sm, gap: theme.space.sm },
  chip: {
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.sm,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: theme.space.sm,
  },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipText: { fontSize: theme.fontSize.body, fontFamily: theme.fontFamily.medium, color: theme.colors.textMuted },
  chipTextActive: { color: theme.colors.textOnPrimary },

  list: { paddingHorizontal: theme.space.lg, paddingTop: theme.space.xs, paddingBottom: theme.space.xxl, flexGrow: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: theme.space.sm, paddingTop: 80 },
  muted: {
    fontSize: theme.fontSize.body,
    fontFamily: theme.fontFamily.regular,
    color: theme.colors.textMuted,
    textAlign: "center",
    paddingHorizontal: theme.space.xl,
    lineHeight: 20,
  },

  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.space.md,
    marginBottom: theme.space.md,
    gap: theme.space.xs,
  },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  catBadge: {
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.space.sm,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  catBadgeText: {
    fontSize: theme.fontSize.caption,
    fontFamily: theme.fontFamily.semibold,
    color: theme.colors.primary,
    letterSpacing: 0.4,
  },
  regionRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  region: { fontSize: theme.fontSize.caption, fontFamily: theme.fontFamily.medium, color: theme.colors.textMuted },

  title: { fontSize: theme.fontSize.label, fontFamily: theme.fontFamily.bold, color: theme.colors.text, marginTop: 2 },
  body: {
    fontSize: theme.fontSize.body,
    fontFamily: theme.fontFamily.regular,
    color: theme.colors.text,
    lineHeight: 21,
    opacity: 0.9,
  },

  cardBottom: { flexDirection: "row", marginTop: theme.space.xs },
  voteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: theme.space.md,
    paddingVertical: 5,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minWidth: 60,
    justifyContent: "center",
  },
  voteBtnOn: { borderColor: theme.colors.primary, backgroundColor: theme.colors.bg },
  voteText: { fontSize: theme.fontSize.body, fontFamily: theme.fontFamily.semibold, color: theme.colors.textMuted },
  voteTextOn: { color: theme.colors.primary },
});
