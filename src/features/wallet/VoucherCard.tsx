/**
 * VoucherCard — a claimed voucher rendered as a tear-off ticket.
 *
 * Springs in on mount (staggered by list index) so a freshly claimed reward
 * feels like it "drops" into the wallet. Pure presentational: the parent owns
 * the redeem mutation and passes `onRedeem` + `redeeming`.
 */

import { useEffect, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from "react-native";
import type { VoucherClaim } from "./api";
import { useTranslation } from "react-i18next";
import theme from "../../theme/theme";

function formatDiscount(type: string, value: number): string {
  // discount_type is a free-ish enum; treat anything percent-like as %, else KRW.
  if (/percent|pct|rate|%/i.test(type)) return `${value}%`;
  return `\u20a9${value.toLocaleString()}`;
}

const STATUS: Record<
  VoucherClaim["status"],
  { label: string; color: string }
> = {
  ISSUED: { label: "wallet.statusReady", color: theme.colors.success },
  REDEEMED: { label: "wallet.statusUsed", color: theme.colors.textMuted },
  EXPIRED: { label: "wallet.statusExpired", color: theme.colors.textMuted },
};

export default function VoucherCard({
  claim,
  index = 0,
  onRedeem,
  redeeming = false,
}: {
  claim: VoucherClaim;
  index?: number;
  onRedeem: (claimId: string) => void;
  redeeming?: boolean;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const { t } = useTranslation();
  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 7,
      tension: 60,
      delay: index * 80,
    }).start();
  }, [anim, index]);

  const v = claim.voucher;
  const title = v?.title_en || v?.title || t("wallet.voucherFallback");
  const region = v?.region?.name_en || v?.region?.name || null;
  const discount = v ? formatDiscount(v.discount_type, v.discount_value) : "\u2014";
  const isIssued = claim.status === "ISSUED";
  const isRedeemed = claim.status === "REDEEMED";
  const badge = STATUS[claim.status];

  const animStyle = {
    opacity: anim,
    transform: [
      { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
      { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
    ],
  };

  return (
    <Animated.View style={[styles.card, animStyle, !isIssued && styles.cardMuted]}>
      {/* Left stub — the discount */}
      <View style={[styles.stub, isIssued ? styles.stubActive : styles.stubUsed]}>
        <Text style={styles.stubValue} numberOfLines={1} adjustsFontSizeToFit>
          {discount}
        </Text>
        <Text style={styles.stubOff}>{t("wallet.off")}</Text>
      </View>

      {/* Perforated divider */}
      <View style={styles.perf}>
        {Array.from({ length: 7 }).map((_, i) => (
          <View key={i} style={styles.perfDot} />
        ))}
      </View>

      {/* Right body — details + action */}
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {v?.partner_name ? (
          <Text style={styles.partner} numberOfLines={1}>
            {v.partner_name}
          </Text>
        ) : null}

        <View style={styles.metaRow}>
          {region ? (
            <Text style={styles.region} numberOfLines={1}>
              {"\ud83d\udccd "}
              {region}
            </Text>
          ) : (
            <View />
          )}
          <View style={[styles.badge, { backgroundColor: badge.color }]}>
            <Text style={styles.badgeText}>{t(badge.label)}</Text>
          </View>
        </View>

        {isIssued ? (
          <Pressable
            style={({ pressed }) => [styles.redeemBtn, pressed && styles.pressed]}
            onPress={() => onRedeem(claim.id)}
            disabled={redeeming}
          >
            {redeeming ? (
              <ActivityIndicator color={theme.colors.textOnPrimary} size="small" />
            ) : (
              <Text style={styles.redeemText}>{t("wallet.redeem")}</Text>
            )}
          </Pressable>
        ) : (
          <Text style={styles.usedNote}>
            {isRedeemed
              ? `${t("wallet.statusUsed")}${claim.redeemed_at ? ` \u00b7 ${new Date(claim.redeemed_at).toLocaleDateString()}` : ""}`
              : t("wallet.statusExpired")}
          </Text>
        )}

        <Text style={styles.code}>{t("wallet.code", { code: claim.code })}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden",
    marginBottom: theme.space.md,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  cardMuted: { opacity: 0.72 },

  stub: {
    width: 104,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.space.lg,
    paddingHorizontal: theme.space.sm,
  },
  stubActive: { backgroundColor: theme.colors.primary },
  stubUsed: { backgroundColor: theme.colors.textMuted },
  stubValue: {
    color: theme.colors.textOnPrimary,
    fontFamily: theme.fontFamily.bold,
    fontSize: theme.fontSize.h2,
  },
  stubOff: {
    color: theme.colors.textOnPrimary,
    fontFamily: theme.fontFamily.medium,
    fontSize: theme.fontSize.caption,
    opacity: 0.9,
    marginTop: 2,
  },

  perf: {
    width: 2,
    justifyContent: "space-evenly",
    alignItems: "center",
    paddingVertical: theme.space.sm,
  },
  perfDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
  },

  body: { flex: 1, padding: theme.space.md, gap: 2 },
  title: {
    fontSize: theme.fontSize.label,
    fontFamily: theme.fontFamily.bold,
    color: theme.colors.text,
  },
  partner: {
    fontSize: theme.fontSize.body,
    fontFamily: theme.fontFamily.medium,
    color: theme.colors.textMuted,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: theme.space.xs,
    gap: theme.space.sm,
  },
  region: {
    flex: 1,
    fontSize: theme.fontSize.caption,
    fontFamily: theme.fontFamily.regular,
    color: theme.colors.textMuted,
  },
  badge: {
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.space.sm,
    paddingVertical: 2,
  },
  badgeText: {
    color: theme.colors.textOnPrimary,
    fontSize: theme.fontSize.caption,
    fontFamily: theme.fontFamily.semibold,
  },

  redeemBtn: {
    marginTop: theme.space.sm,
    height: 40,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.exploration,
    alignItems: "center",
    justifyContent: "center",
  },
  redeemText: {
    color: theme.colors.textOnPrimary,
    fontFamily: theme.fontFamily.bold,
    fontSize: theme.fontSize.body,
  },
  usedNote: {
    marginTop: theme.space.sm,
    fontSize: theme.fontSize.body,
    fontFamily: theme.fontFamily.medium,
    color: theme.colors.textMuted,
  },
  code: {
    marginTop: theme.space.xs,
    fontSize: theme.fontSize.caption,
    fontFamily: theme.fontFamily.regular,
    color: theme.colors.textMuted,
    letterSpacing: 1,
  },
  pressed: { opacity: 0.85 },
});
