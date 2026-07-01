import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  usePoi,
  useMyPoiFeedback,
  useSetPoiFeedback,
  useCreateReport,
  type PoiType,
  type FeedbackType,
} from "../../src/features/poi/api";
import { useAuth } from "../../src/stores/auth";
import theme from "../../src/theme/theme";

const POI_META: Record<PoiType, { icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  RESTAURANT: { icon: "restaurant-outline", label: "Restaurant" },
  CAFE: { icon: "cafe-outline", label: "Cafe" },
  REPAIR: { icon: "construct-outline", label: "Repair" },
  BICYCLE_SHOP: { icon: "bicycle-outline", label: "Bicycle shop" },
  LODGING: { icon: "bed-outline", label: "Lodging" },
  CAMPSITE: { icon: "bonfire-outline", label: "Campsite" },
  CONVENIENCE: { icon: "basket-outline", label: "Convenience" },
  REST_AREA: { icon: "pause-circle-outline", label: "Rest area" },
  TRANSPORT: { icon: "train-outline", label: "Transport" },
  CERT_CENTER: { icon: "ribbon-outline", label: "Certification center" },
};

export default function PoiDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const userId = useAuth((s) => s.session?.user.id);

  const { data: poi, isLoading, error } = usePoi(id);
  const myFeedback = useMyPoiFeedback(id, userId);
  const setFeedback = useSetPoiFeedback(id, userId);
  const createReport = useCreateReport();

  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");

  const requireAuth = (): boolean => {
    if (!userId) {
      Alert.alert("Sign in required", "Log in to share feedback and report issues.");
      return false;
    }
    return true;
  };

  const onFeedback = (type: FeedbackType) => {
    if (!requireAuth()) return;
    // Tapping the active choice clears it; otherwise set/switch to it.
    const next: FeedbackType | null = myFeedback.data === type ? null : type;
    setFeedback.mutate(next, {
      onError: (e) =>
        Alert.alert("Couldn't save", e instanceof Error ? e.message : String(e)),
    });
  };

  const onSubmitReport = () => {
    const text = reason.trim();
    if (!text) return;
    createReport.mutate(
      { targetType: "POI", targetId: id, reason: text },
      {
        onSuccess: () => {
          setReason("");
          setReporting(false);
          Alert.alert("Report sent", "Thanks — our team will review this place.");
        },
        onError: (e) =>
          Alert.alert("Couldn't send report", e instanceof Error ? e.message : String(e)),
      },
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.fill}>
        <ActivityIndicator color={theme.colors.primary} />
      </SafeAreaView>
    );
  }
  if (error || !poi) {
    return (
      <SafeAreaView style={styles.fill}>
        <Text style={styles.muted}>Couldn't load this place.</Text>
        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const meta = POI_META[poi.poi_type] ?? { icon: "location-outline", label: poi.poi_type };
  const title = poi.name_en || poi.name || meta.label;
  const subtitle = poi.name_en && poi.name && poi.name_en !== poi.name ? poi.name : null;
  const bikePolicy = poi.bike_policy_en || poi.bike_policy;
  const packingNotes = poi.packing_notes_en || poi.packing_notes;
  const hasLogistics =
    !!poi.transport_mode ||
    !!bikePolicy ||
    poi.packing_required != null ||
    !!packingNotes ||
    !!poi.booking_url;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.body}>
          {/* Header */}
          <View style={styles.badge}>
            <Ionicons name={meta.icon} size={16} color={theme.colors.primary} />
            <Text style={styles.badgeText}>{meta.label}</Text>
          </View>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

          {/* Feedback */}
          <View style={styles.feedbackRow}>
            <FeedbackButton
              icon="thumbs-up"
              label="Recommend"
              count={poi.recommend_count}
              active={myFeedback.data === "recommend"}
              activeColor={theme.colors.primary}
              disabled={setFeedback.isPending}
              onPress={() => onFeedback("recommend")}
            />
            <FeedbackButton
              icon="warning"
              label="Caution"
              count={poi.caution_count}
              active={myFeedback.data === "caution"}
              activeColor={theme.colors.exploration ?? "#EC4899"}
              disabled={setFeedback.isPending}
              onPress={() => onFeedback("caution")}
            />
          </View>

          {/* Logistics */}
          {hasLogistics ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Getting there with your bike</Text>
              {poi.transport_mode ? (
                <InfoRow icon="train-outline" label="Transport" value={poi.transport_mode} />
              ) : null}
              {bikePolicy ? (
                <InfoRow icon="bicycle-outline" label="Bike policy" value={bikePolicy} />
              ) : null}
              {poi.packing_required != null ? (
                <InfoRow
                  icon="cube-outline"
                  label="Bag/box required"
                  value={poi.packing_required ? "Yes" : "No"}
                />
              ) : null}
              {packingNotes ? (
                <InfoRow icon="information-circle-outline" label="Notes" value={packingNotes} />
              ) : null}
              {poi.booking_url ? (
                <Pressable
                  style={styles.linkBtn}
                  onPress={() => Linking.openURL(poi.booking_url as string)}
                >
                  <Ionicons name="open-outline" size={16} color={theme.colors.textOnPrimary} />
                  <Text style={styles.linkBtnText}>Booking / info</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {/* Report */}
          {reporting ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Report an issue</Text>
              <Text style={styles.reportHint}>
                Closed down, wrong location, unsafe? Let us know.
              </Text>
              <TextInput
                style={styles.reportInput}
                placeholder="What's wrong with this place?"
                placeholderTextColor={theme.colors.textMuted}
                value={reason}
                onChangeText={setReason}
                multiline
              />
              <View style={styles.reportActions}>
                <Pressable
                  style={styles.reportCancel}
                  onPress={() => {
                    setReporting(false);
                    setReason("");
                  }}
                >
                  <Text style={styles.reportCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.reportSubmit,
                    (!reason.trim() || createReport.isPending) && styles.btnOff,
                  ]}
                  onPress={onSubmitReport}
                  disabled={!reason.trim() || createReport.isPending}
                >
                  {createReport.isPending ? (
                    <ActivityIndicator size="small" color={theme.colors.textOnPrimary} />
                  ) : (
                    <Text style={styles.reportSubmitText}>Send report</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              style={styles.reportOpen}
              onPress={() => {
                if (!requireAuth()) return;
                setReporting(true);
              }}
            >
              <Ionicons name="flag-outline" size={16} color={theme.colors.textMuted} />
              <Text style={styles.reportOpenText}>Report an issue</Text>
            </Pressable>
          )}

          {/* Provenance / attribution */}
          {poi.attribution || poi.source_name || poi.license_type ? (
            <View style={styles.attribution}>
              <Text style={styles.attributionText}>
                {poi.attribution ||
                  [poi.source_name, poi.license_type].filter(Boolean).join(" · ")}
              </Text>
              {poi.source_url ? (
                <Pressable onPress={() => Linking.openURL(poi.source_url as string)}>
                  <Text style={styles.attributionLink}>Source</Text>
                </Pressable>
              ) : null}
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
    </View>
  );
}

function FeedbackButton({
  icon,
  label,
  count,
  active,
  activeColor,
  disabled,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  count: number;
  active: boolean;
  activeColor: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.fbBtn, active && { borderColor: activeColor, backgroundColor: activeColor + "14" }]}
      onPress={onPress}
      disabled={disabled}
    >
      <Ionicons
        name={active ? icon : ((icon + "-outline") as keyof typeof Ionicons.glyphMap)}
        size={22}
        color={active ? activeColor : theme.colors.textMuted}
      />
      <Text style={[styles.fbCount, active && { color: activeColor }]}>{count}</Text>
      <Text style={[styles.fbLabel, active && { color: activeColor }]}>{label}</Text>
    </Pressable>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color={theme.colors.primary} />
      <View style={styles.infoText}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  fill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.bg,
    gap: theme.space.sm,
  },
  scroll: { paddingBottom: 60, paddingTop: 56 },
  body: { padding: theme.space.lg, gap: theme.space.sm },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.pill ?? 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.space.md,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: theme.fontSize.caption,
    fontFamily: theme.fontFamily.medium,
    color: theme.colors.textMuted,
  },
  title: { fontSize: theme.fontSize.h1, fontFamily: theme.fontFamily.bold, color: theme.colors.text },
  subtitle: {
    fontSize: theme.fontSize.label,
    fontFamily: theme.fontFamily.regular,
    color: theme.colors.textMuted,
  },
  feedbackRow: { flexDirection: "row", gap: theme.space.md, marginTop: theme.space.sm },
  fbBtn: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    paddingVertical: theme.space.md,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  fbCount: { fontSize: theme.fontSize.title, fontFamily: theme.fontFamily.bold, color: theme.colors.text },
  fbLabel: { fontSize: theme.fontSize.caption, fontFamily: theme.fontFamily.medium, color: theme.colors.textMuted },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.space.lg,
    gap: theme.space.md,
    marginTop: theme.space.sm,
  },
  sectionTitle: { fontSize: theme.fontSize.label, fontFamily: theme.fontFamily.bold, color: theme.colors.text },
  infoRow: { flexDirection: "row", gap: theme.space.md, alignItems: "flex-start" },
  infoText: { flex: 1, gap: 1 },
  infoLabel: { fontSize: theme.fontSize.caption, fontFamily: theme.fontFamily.medium, color: theme.colors.textMuted },
  infoValue: { fontSize: theme.fontSize.body, fontFamily: theme.fontFamily.regular, color: theme.colors.text, lineHeight: 20 },
  linkBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.card,
    paddingVertical: theme.space.sm,
    marginTop: 2,
  },
  linkBtnText: { fontSize: theme.fontSize.body, fontFamily: theme.fontFamily.semibold, color: theme.colors.textOnPrimary },
  reportHint: { fontSize: theme.fontSize.body, fontFamily: theme.fontFamily.regular, color: theme.colors.textMuted },
  reportInput: {
    minHeight: 64,
    maxHeight: 140,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.bg,
    padding: theme.space.md,
    fontSize: theme.fontSize.body,
    fontFamily: theme.fontFamily.regular,
    color: theme.colors.text,
  },
  reportActions: { flexDirection: "row", justifyContent: "flex-end", gap: theme.space.sm },
  reportCancel: { paddingVertical: theme.space.sm, paddingHorizontal: theme.space.md },
  reportCancelText: { fontSize: theme.fontSize.body, fontFamily: theme.fontFamily.medium, color: theme.colors.textMuted },
  reportSubmit: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.card,
    paddingVertical: theme.space.sm,
    paddingHorizontal: theme.space.lg,
    justifyContent: "center",
  },
  reportSubmitText: { fontSize: theme.fontSize.body, fontFamily: theme.fontFamily.semibold, color: theme.colors.textOnPrimary },
  btnOff: { opacity: 0.5 },
  reportOpen: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: theme.space.md,
    marginTop: theme.space.sm,
  },
  reportOpenText: { fontSize: theme.fontSize.body, fontFamily: theme.fontFamily.medium, color: theme.colors.textMuted },
  attribution: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.space.sm,
    marginTop: theme.space.lg,
  },
  attributionText: { flex: 1, fontSize: theme.fontSize.caption, fontFamily: theme.fontFamily.regular, color: theme.colors.textMuted },
  attributionLink: { fontSize: theme.fontSize.caption, fontFamily: theme.fontFamily.medium, color: theme.colors.primary },
  muted: { fontSize: theme.fontSize.body, fontFamily: theme.fontFamily.regular, color: theme.colors.textMuted },
  backLink: { marginTop: theme.space.md },
  backLinkText: { color: theme.colors.primary, fontFamily: theme.fontFamily.medium },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, paddingHorizontal: theme.space.lg, paddingTop: theme.space.sm },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
});
