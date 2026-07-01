import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { useMyClaims, useRedeemVoucher } from "../../src/features/wallet/api";
import VoucherCard from "../../src/features/wallet/VoucherCard";
import theme from "../../src/theme/theme";

export default function Wallet() {
  const { t } = useTranslation();
  const { data: claims, isLoading, error, refetch, isRefetching } = useMyClaims();
  const redeem = useRedeemVoucher();

  const onRedeem = (claimId: string) => {
    Alert.alert(
      t("wallet.redeemTitle"),
      t("wallet.redeemBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("wallet.redeem"),
          style: "destructive",
          onPress: () =>
            redeem.mutate(claimId, {
              onError: (e) =>
                Alert.alert(t("wallet.redeemError"), e instanceof Error ? e.message : String(e)),
            }),
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.fill} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.h1}>{t("tabs.wallet")}</Text>
        <Text style={styles.sub}>{t("wallet.subtitle")}</Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.muted}>{t("wallet.loadError")}</Text>
        </View>
      ) : (
        <FlatList
          data={claims ?? []}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => (
            <VoucherCard
              claim={item}
              index={index}
              onRedeem={onRedeem}
              redeeming={redeem.isPending && redeem.variables === item.id}
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
              <Text style={styles.emptyEmoji}>{"\ud83c\udf9f\ufe0f"}</Text>
              <Text style={styles.emptyTitle}>{t("wallet.emptyTitle")}</Text>
              <Text style={styles.muted}>{t("wallet.emptyBody")}</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
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
  empty: { alignItems: "center", justifyContent: "center", paddingTop: theme.space.xxl * 2, paddingHorizontal: theme.space.xl, gap: theme.space.xs },
  emptyEmoji: { fontSize: 44 },
  emptyTitle: { fontSize: theme.fontSize.title, fontFamily: theme.fontFamily.bold, color: theme.colors.text },
});
