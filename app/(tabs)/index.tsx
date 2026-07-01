import { useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { useFeed, RouteType } from "../../src/features/explore/api";
import { RouteCard } from "../../src/features/explore/RouteCard";
import { useAuth } from "../../src/stores/auth";
import theme from "../../src/theme/theme";

export default function Explore() {
  const { t } = useTranslation();
  const router = useRouter();
  const [tab, setTab] = useState<RouteType>("USER");
  const signOut = useAuth((s) => s.signOut);
  const { data, isLoading, error, refetch, isRefetching } = useFeed(tab);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.brand}>{t("common.appName")}</Text>
        <Pressable onPress={() => signOut()} hitSlop={12}>
          <Ionicons name="log-out-outline" size={22} color={theme.colors.textMuted} />
        </Pressable>
      </View>

      {/* Segmented toggle: Rider Stories / Official */}
      <View style={styles.segment}>
        <Segment
          label={t("explore.riderStories")}
          active={tab === "USER"}
          onPress={() => setTab("USER")}
        />
        <Segment
          label={t("explore.official")}
          active={tab === "OFFICIAL"}
          onPress={() => setTab("OFFICIAL")}
        />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.muted}>{t("explore.loadError")}</Text>
          <Pressable onPress={() => refetch()} style={styles.retry}>
            <Text style={styles.retryText}>{t("common.retry")}</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <RouteCard route={item} onPress={() => router.push(`/route/${item.id}`)} />
          )}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: theme.space.lg }} />}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="compass-outline" size={40} color={theme.colors.textMuted} />
              <Text style={styles.muted}>{t("explore.empty")}</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function Segment({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.segmentBtn, active && styles.segmentBtnActive]}
    >
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.md,
  },
  brand: {
    fontSize: theme.fontSize.title,
    fontFamily: theme.fontFamily.bold,
    color: theme.colors.primary,
  },
  segment: {
    flexDirection: "row",
    gap: theme.space.sm,
    paddingHorizontal: theme.space.lg,
    paddingBottom: theme.space.sm,
  },
  segmentBtn: {
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.sm,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  segmentBtnActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  segmentText: {
    fontSize: theme.fontSize.body,
    fontFamily: theme.fontFamily.medium,
    color: theme.colors.textMuted,
  },
  segmentTextActive: { color: theme.colors.textOnPrimary },
  list: { padding: theme.space.lg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: theme.space.sm, paddingTop: 80 },
  muted: {
    fontSize: theme.fontSize.body,
    fontFamily: theme.fontFamily.regular,
    color: theme.colors.textMuted,
  },
  retry: {
    marginTop: theme.space.sm,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.sm,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  retryText: {
    fontSize: theme.fontSize.body,
    fontFamily: theme.fontFamily.medium,
    color: theme.colors.primary,
  },
});
