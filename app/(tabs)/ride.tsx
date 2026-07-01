import { useEffect } from "react";
import { View, Text, StyleSheet, Pressable, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";

import { useRide } from "../../src/stores/ride";
import type { LngLat } from "../../src/features/ride/deviation";
import RideMap from "../../src/features/ride/RideMap";
import GlassDashboard from "../../src/features/ride/GlassDashboard";
import { queueRidePhoto } from "../../src/features/ride/photos";
import { finalizeAndClear } from "../../src/features/ride/api";
import { useRoutePath, useRouteDetail } from "../../src/features/route/api";
import theme from "../../src/theme/theme";

export default function Ride() {
  const status = useRide((s) => s.status);
  const stats = useRide((s) => s.stats);
  const deviated = useRide((s) => s.deviated);
  const trackVersion = useRide((s) => s.trackVersion);
  const rideId = useRide((s) => s.rideId);
  const error = useRide((s) => s.error);
  const start = useRide((s) => s.start);
  const pause = useRide((s) => s.pause);
  const resume = useRide((s) => s.resume);
  const stop = useRide((s) => s.stop);
  const discard = useRide((s) => s.discard);
  const recover = useRide((s) => s.recover);
  const getTrackCoords = useRide((s) => s.getTrackCoords);
  const getDeviatedSegments = useRide((s) => s.getDeviatedSegments);
  const getPosition = useRide((s) => s.getPosition);

  // Route-ride mode: when opened with ?routeId=..., we ride that route's planned
  // line (deviation turns blue→pink) and finalize on the server when finished.
  const params = useLocalSearchParams<{ routeId?: string }>();
  const router = useRouter();
  const routeId = typeof params.routeId === "string" ? params.routeId : undefined;
  const { data: plannedPath } = useRoutePath(routeId ?? "");
  const { data: routeDetail } = useRouteDetail(routeId ?? "");
  const isRouteRide = !!routeId;
  const planned: LngLat[] = (plannedPath as LngLat[] | undefined) ?? [];
  const plannedReady = !isRouteRide || planned.length >= 2;

  // On mount, offer to resume an interrupted ride (if any was persisted).
  useEffect(() => {
    let cancelled = false;
    recover()
      .then((found) => {
        if (!found || cancelled) return;
        Alert.alert("Resume ride?", "An unfinished ride was found.", [
          {
            text: "Discard",
            style: "destructive",
            onPress: () => {
              const id = useRide.getState().rideId;
              if (id) discard(id);
            },
          },
          { text: "Resume", onPress: () => resume() },
        ]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tracking = status === "tracking";
  const paused = status === "paused";
  const active = tracking || paused;
  const busy = status === "starting" || status === "finishing";

  async function onStart() {
    if (isRouteRide && routeId) {
      // Ride a specific route: the planned line drives deviation; finalize on finish.
      await start({ id: routeId, plannedLine: planned, title: routeDetail?.title });
    } else {
      // Free ride: no planned route → pure tracking, no deviation.
      await start({ id: `free-${Date.now()}`, plannedLine: [], title: "Free ride" });
    }
  }

  async function onPhoto() {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Camera permission needed", "Enable camera access to drop photo pins.");
        return;
      }
      const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
      if (res.canceled || !res.assets?.[0] || !rideId) return;
      const pos = getPosition();
      await queueRidePhoto({
        rideId,
        localUri: res.assets[0].uri,
        lng: pos ? pos[0] : null,
        lat: pos ? pos[1] : null,
        spotType: "GENERAL",
      });
      Alert.alert("Photo pinned", "Saved to this ride — it'll sync when you finish.");
    } catch {
      Alert.alert("Couldn't add photo", "Please try again.");
    }
  }

  async function onFinish() {
    const result = await stop();
    if (!result) return;
    const km = (result.stats.distanceM / 1000).toFixed(2);
    const mins = Math.round(result.stats.durationS / 60);

    // Free ride (synthetic id): nothing to finalize on the server → summarize + clear.
    if (result.routeId.startsWith("free-")) {
      Alert.alert(
        "Ride finished",
        `${km} km in ${mins} min · ${result.stats.pointCount} points.`,
        [{ text: "OK", onPress: () => discard(result.rideId) }],
      );
      return;
    }

    // Route ride: post the track to finalize_ride (server verifies ownership,
    // builds geometry, flips the route to FINISHED). Keep local rows on failure.
    try {
      const outcome = await finalizeAndClear(
        {
          rideId: result.rideId,
          routeId: result.routeId,
          trackGeoJSON: result.trackGeoJSON,
          deviatedGeoJSON: result.deviatedGeoJSON,
        },
        discard,
      );
      if (outcome.finalized) {
        Alert.alert(
          "Ride saved! 🎉",
          `${km} km · ${mins} min — your journey is now part of the route.`,
          [
            {
              text: "View route",
              onPress: () =>
                router.replace({ pathname: "/route/[id]", params: { id: result.routeId } }),
            },
            { text: "OK" },
          ],
        );
      } else {
        Alert.alert("Ride too short", "Not enough movement to save this ride.");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const notOwner = /owner|permission|denied|not.*allow/i.test(msg);
      Alert.alert(
        "Couldn't save ride",
        notOwner
          ? "Make this route your own first, then ride it."
          : `Saved locally and will retry.\n${msg}`,
      );
    }
  }

  return (
    <View style={styles.fill}>
      <RideMap
        planned={planned}
        track={getTrackCoords()}
        deviated={getDeviatedSegments()}
        position={getPosition()}
        version={trackVersion}
      />

      <SafeAreaView style={styles.overlay} pointerEvents="box-none" edges={["top", "bottom"]}>
        {active ? (
          <GlassDashboard stats={stats} deviated={deviated} />
        ) : (
          <View style={styles.intro}>
            <Text style={styles.introTitle}>
              {isRouteRide ? routeDetail?.title ?? "Ride this route" : "Ready to ride"}
            </Text>
            <Text style={styles.introSub}>
              {isRouteRide
                ? "Follow the blue line. Wander off and it turns pink — your own path. Finish to save your journey."
                : "Track your line, drop photo pins, and stay found — even offline."}
            </Text>
          </View>
        )}

        <View style={styles.controls} pointerEvents="box-none">
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {!active && (
            <Pressable
              style={({ pressed }) => [styles.btn, styles.btnPrimary, pressed && styles.pressed]}
              onPress={onStart}
              disabled={busy || !plannedReady}
            >
              {busy || !plannedReady ? (
                <ActivityIndicator color={theme.colors.textOnPrimary} />
              ) : (
                <Text style={styles.btnPrimaryText}>
                  {isRouteRide ? "Start riding" : "Start ride"}
                </Text>
              )}
            </Pressable>
          )}

          {active && (
            <View style={styles.row}>
              <Pressable
                style={({ pressed }) => [styles.btn, styles.btnGhost, pressed && styles.pressed]}
                onPress={() => (tracking ? pause() : resume())}
              >
                <Text style={styles.btnGhostText}>{tracking ? "Pause" : "Resume"}</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.btnPhoto, pressed && styles.pressed]}
                onPress={onPhoto}
              >
                <Text style={styles.btnPhotoText}>📷</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.btn, styles.btnFinish, pressed && styles.pressed]}
                onPress={onFinish}
                disabled={busy}
              >
                <Text style={styles.btnFinishText}>Finish</Text>
              </Pressable>
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: theme.colors.border },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "space-between",
    padding: theme.space.lg,
  },
  intro: {
    backgroundColor: theme.colors.scrimDark,
    borderRadius: theme.radius.card,
    padding: theme.space.xl,
    gap: theme.space.xs,
  },
  introTitle: {
    fontSize: theme.fontSize.h2,
    fontFamily: theme.fontFamily.bold,
    color: theme.colors.textOnGlassDark,
  },
  introSub: {
    fontSize: theme.fontSize.body,
    fontFamily: theme.fontFamily.regular,
    color: theme.colors.textOnGlassDark,
    opacity: 0.9,
  },
  controls: { gap: theme.space.sm },
  error: {
    color: theme.colors.textOnGlassDark,
    backgroundColor: "rgba(220,38,38,0.85)",
    fontFamily: theme.fontFamily.medium,
    fontSize: theme.fontSize.body,
    paddingVertical: theme.space.sm,
    paddingHorizontal: theme.space.md,
    borderRadius: theme.radius.sm,
    overflow: "hidden",
  },
  row: { flexDirection: "row", gap: theme.space.sm },
  btn: {
    height: theme.space.touch,
    borderRadius: theme.radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.space.xl,
  },
  btnPrimary: { backgroundColor: theme.colors.primary },
  btnPrimaryText: {
    color: theme.colors.textOnPrimary,
    fontFamily: theme.fontFamily.semibold,
    fontSize: theme.fontSize.label,
  },
  btnGhost: {
    flex: 1,
    backgroundColor: theme.colors.scrimLight,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  btnGhostText: {
    color: theme.colors.text,
    fontFamily: theme.fontFamily.semibold,
    fontSize: theme.fontSize.label,
  },
  btnPhoto: {
    width: theme.space.touch,
    height: theme.space.touch,
    borderRadius: theme.radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  btnPhotoText: { fontSize: 24 },
  btnFinish: { flex: 1, backgroundColor: theme.colors.exploration },
  btnFinishText: {
    color: theme.colors.textOnPrimary,
    fontFamily: theme.fontFamily.semibold,
    fontSize: theme.fontSize.label,
  },
  pressed: { opacity: 0.85 },
});
