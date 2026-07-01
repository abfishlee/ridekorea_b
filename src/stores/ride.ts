/**
 * Ride session store (Zustand).
 *
 * Wires the device GPS stream (expo-location) into the pure track accumulator
 * (../features/ride/track) and the offline SQLite outbox (../features/ride/outbox):
 *
 *   watchPositionAsync ──► accumulator.add() ──► outbox.enqueuePoint()
 *                                │
 *                                └─► live stats + deviation state for the dashboard
 *
 * The accumulator and the location subscription are NOT serializable, so they
 * live in module scope; only plain state lives in the store.
 *
 * Map rendering / glass dashboard UI (4.1) reads `stats`, `deviated`, and pulls
 * GeoJSON via getTrackGeoJSON()/getDeviatedGeoJSON(). The finalize step (4.5)
 * consumes stop()'s return value and calls the finalize_ride RPC.
 */

import { create } from "zustand";
import * as Location from "expo-location";

import type { LngLat } from "../features/ride/deviation";
import {
  createTrackAccumulator,
  type RideStats,
  type TrackAccumulator,
  type RawFix,
} from "../features/ride/track";
import * as outbox from "../features/ride/outbox";
import { ensureForegroundLocation } from "../lib/permissions";

export type RideStatus = "idle" | "starting" | "tracking" | "paused" | "finishing";

export interface RideRoute {
  id: string;
  plannedLine: LngLat[];
  title?: string;
}

export interface RideResult {
  rideId: string;
  routeId: string;
  trackGeoJSON: string | null;
  deviatedGeoJSON: string | null;
  stats: RideStats;
}

interface RideState {
  status: RideStatus;
  rideId: string | null;
  route: RideRoute | null;
  stats: RideStats;
  deviated: boolean;
  /** Bumps on every accepted fix so the map can re-read the polyline cheaply. */
  trackVersion: number;
  error: string | null;

  start: (route: RideRoute) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  /** Stops tracking and returns the finalize payload (caller runs finalize_ride). */
  stop: () => Promise<RideResult | null>;
  /** Re-attach to an unfinished ride persisted in the outbox. Returns true if found. */
  recover: () => Promise<boolean>;
  /** Discard local rows for a ride (after a confirmed finalize). */
  discard: (rideId: string) => Promise<void>;

  getTrackGeoJSON: () => string | null;
  getDeviatedGeoJSON: () => string | null;
  getTrackCoords: () => LngLat[];
  getDeviatedSegments: () => LngLat[][];
  getPosition: () => LngLat | null;
}

const EMPTY_STATS: RideStats = {
  pointCount: 0,
  distanceM: 0,
  durationS: 0,
  movingSpeedKmh: 0,
  lastSpeedKmh: 0,
  deviated: false,
};

const WATCH_OPTIONS: Location.LocationOptions = {
  accuracy: Location.Accuracy.High,
  distanceInterval: 5, // meters
  timeInterval: 2000, // ms
};

// --- non-serializable session singletons (module scope) ---
let accumulator: TrackAccumulator | null = null;
let subscription: Location.LocationSubscription | null = null;

function fixFromLocation(loc: Location.LocationObject): RawFix {
  return {
    lng: loc.coords.longitude,
    lat: loc.coords.latitude,
    t: loc.timestamp ?? Date.now(),
    accuracy: loc.coords.accuracy ?? null,
    speed: loc.coords.speed ?? null,
  };
}

export const useRide = create<RideState>((set, get) => {
  async function attachWatcher() {
    // Detach any prior watcher first to avoid duplicates.
    subscription?.remove();
    subscription = await Location.watchPositionAsync(WATCH_OPTIONS, (loc) => {
      const acc = accumulator;
      if (!acc) return;
      const result = acc.add(fixFromLocation(loc));
      if (!result.accepted || !result.point) return;

      const { rideId } = get();
      if (rideId) {
        // Persist first (offline-safe); never let a DB hiccup crash the ride.
        outbox.enqueuePoint(rideId, result.point).catch(() => {});
      }

      set((s) => ({
        stats: result.stats,
        deviated: result.stats.deviated,
        trackVersion: s.trackVersion + 1,
      }));
    });
  }

  return {
    status: "idle",
    rideId: null,
    route: null,
    stats: EMPTY_STATS,
    deviated: false,
    trackVersion: 0,
    error: null,

    start: async (route) => {
      set({ status: "starting", error: null });
      try {
        const granted = await ensureForegroundLocation();
        if (!granted) {
          set({ status: "idle", error: "위치 권한이 필요합니다." });
          return;
        }

        const rideId = `${route.id}:${Date.now()}`;
        accumulator = createTrackAccumulator(route.plannedLine, {
          maxAccuracyM: 50,
          minStepM: 3,
          maxJumpM: 500,
        });

        // Outbox is best-effort: on platforms without SQLite (e.g. web) tracking
        // still runs in memory; only crash/offline persistence is unavailable.
        try {
          await outbox.initOutbox();
          await outbox.startRideRecord({
            rideId,
            routeId: route.id,
            startedAt: Date.now(),
            plannedGeoJSON: JSON.stringify({
              type: "LineString",
              coordinates: route.plannedLine,
            }),
          });
        } catch {
          // persistence unavailable — continue with in-memory tracking
        }

        set({
          status: "tracking",
          rideId,
          route,
          stats: EMPTY_STATS,
          deviated: false,
          trackVersion: 0,
        });

        await attachWatcher();
      } catch (e) {
        set({ status: "idle", error: e instanceof Error ? e.message : String(e) });
      }
    },

    pause: async () => {
      subscription?.remove();
      subscription = null;
      if (get().status === "tracking") set({ status: "paused" });
    },

    resume: async () => {
      if (get().status !== "paused" || !accumulator) return;
      set({ status: "tracking" });
      await attachWatcher();
    },

    stop: async () => {
      subscription?.remove();
      subscription = null;
      const acc = accumulator;
      const { rideId, route } = get();
      set({ status: "finishing" });

      if (!acc || !rideId || !route) {
        set({ status: "idle" });
        return null;
      }

      const result: RideResult = {
        rideId,
        routeId: route.id,
        trackGeoJSON: acc.buildTrackGeoJSON(),
        deviatedGeoJSON: acc.buildDeviatedGeoJSON(),
        stats: acc.getStats(),
      };

      await outbox.finishRideRecord(rideId).catch(() => {});
      // Keep local rows until the caller confirms finalize_ride succeeded.
      set({ status: "idle" });
      return result;
    },

    recover: async () => {
      let active: outbox.RideRecord | null = null;
      try {
        await outbox.initOutbox();
        active = await outbox.getActiveRide();
      } catch {
        return false; // no persistence (e.g. web) -> nothing to recover
      }
      if (!active) return false;

      let plannedLine: LngLat[] = [];
      if (active.plannedGeoJSON) {
        try {
          const parsed = JSON.parse(active.plannedGeoJSON) as { coordinates?: LngLat[] };
          plannedLine = parsed.coordinates ?? [];
        } catch {
          plannedLine = [];
        }
      }

      const acc = createTrackAccumulator(plannedLine, { maxAccuracyM: 50, minStepM: 3, maxJumpM: 500 });
      const saved = await outbox.getRidePoints(active.rideId);
      acc.hydrate(saved);
      accumulator = acc;

      set({
        status: "paused", // user explicitly resumes
        rideId: active.rideId,
        route: { id: active.routeId, plannedLine },
        stats: acc.getStats(),
        deviated: acc.getStats().deviated,
        trackVersion: 0,
        error: null,
      });
      return true;
    },

    discard: async (rideId) => {
      await outbox.clearRide(rideId).catch(() => {});
      if (get().rideId === rideId) {
        accumulator = null;
        set({
          status: "idle",
          rideId: null,
          route: null,
          stats: EMPTY_STATS,
          deviated: false,
          trackVersion: 0,
        });
      }
    },

    getTrackGeoJSON: () => accumulator?.buildTrackGeoJSON() ?? null,
    getDeviatedGeoJSON: () => accumulator?.buildDeviatedGeoJSON() ?? null,

    getTrackCoords: () =>
      accumulator?.getPoints().map((p) => [p.lng, p.lat] as LngLat) ?? [],

    getDeviatedSegments: () => {
      const raw = accumulator?.buildDeviatedGeoJSON();
      if (!raw) return [];
      try {
        const geo = JSON.parse(raw) as { coordinates: LngLat[][] };
        return geo.coordinates ?? [];
      } catch {
        return [];
      }
    },

    getPosition: () => {
      const pts = accumulator?.getPoints();
      if (!pts || pts.length === 0) return null;
      const last = pts[pts.length - 1];
      return [last.lng, last.lat];
    },
  };
});
