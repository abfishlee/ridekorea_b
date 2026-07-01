/**
 * Ride track accumulator (pure logic, no React Native / expo imports).
 *
 * Folds a stream of raw GPS fixes into:
 *   - an ordered list of track points (each tagged on-route / deviated)
 *   - live ride stats (distance, duration, speed)
 *   - finalize-ready GeoJSON (full track LineString + deviated MultiLineString)
 *
 * The deviation tagging reuses the hysteresis detector from ./deviation, so the
 * pink (deviated) runs are stable against GPS jitter.
 *
 * Kept import-free of expo/react-native so it is unit-testable in plain Node and
 * shareable with web. The SQLite outbox and the Zustand store wrap this.
 */

import {
  LngLat,
  createDeviationDetector,
  haversine,
} from "./deviation";

export interface RawFix {
  lng: number;
  lat: number;
  /** Epoch milliseconds when the fix was recorded. */
  t: number;
  /** Horizontal accuracy in meters (lower is better), if known. */
  accuracy?: number | null;
  /** Instantaneous ground speed in m/s, if known. */
  speed?: number | null;
}

export interface TrackPoint {
  lng: number;
  lat: number;
  t: number;
  accuracy: number | null;
  speed: number | null;
  /** true = off-route (pink), false = on-route (blue). */
  deviated: boolean;
}

export interface RideStats {
  pointCount: number;
  /** Cumulative ridden distance in meters. */
  distanceM: number;
  /** Elapsed wall-clock between first and last fix, in seconds. */
  durationS: number;
  /** Average moving speed (distance / duration), km/h. */
  movingSpeedKmh: number;
  /** Latest instantaneous speed (from the fix if present, else moving avg), km/h. */
  lastSpeedKmh: number;
  /** Current deviation state. */
  deviated: boolean;
}

export interface AddResult {
  /** The accepted point, or null if the fix was filtered out. */
  point: TrackPoint | null;
  stats: RideStats;
  /** True only on the fix where on-route/deviated flipped. */
  deviationChanged: boolean;
  /** False when the fix was rejected (bad accuracy or below min step). */
  accepted: boolean;
}

export interface AccumulatorOptions {
  enterM?: number;
  exitM?: number;
  /** Drop fixes whose accuracy is worse than this (meters). Default: no limit. */
  maxAccuracyM?: number;
  /** Ignore fixes that moved less than this from the last point (meters). Default 0. */
  minStepM?: number;
}

export interface TrackAccumulator {
  add(fix: RawFix): AddResult;
  getPoints(): TrackPoint[];
  getStats(): RideStats;
  /** Full ridden path as a GeoJSON LineString string, or null if < 2 points. */
  buildTrackGeoJSON(): string | null;
  /** Deviated runs as a GeoJSON MultiLineString string, or null if none. */
  buildDeviatedGeoJSON(): string | null;
  /** Re-seed from persisted points (crash/offline recovery). */
  hydrate(points: TrackPoint[]): void;
  reset(): void;
}

export function createTrackAccumulator(
  plannedLine: LngLat[],
  opts: AccumulatorOptions = {},
): TrackAccumulator {
  const maxAccuracyM = opts.maxAccuracyM ?? Infinity;
  const minStepM = opts.minStepM ?? 0;

  let detector = createDeviationDetector(plannedLine, {
    enterM: opts.enterM,
    exitM: opts.exitM,
  });

  const points: TrackPoint[] = [];
  let distanceM = 0;

  function computeStats(): RideStats {
    const n = points.length;
    const last = points[n - 1];
    const first = points[0];
    const durationS = n >= 2 ? Math.max(0, (last.t - first.t) / 1000) : 0;
    const movingSpeedKmh = durationS > 0 ? (distanceM / durationS) * 3.6 : 0;
    const lastSpeedKmh =
      last && last.speed != null && last.speed >= 0
        ? last.speed * 3.6
        : movingSpeedKmh;
    return {
      pointCount: n,
      distanceM,
      durationS,
      movingSpeedKmh,
      lastSpeedKmh,
      deviated: detector.state === "DEVIATED",
    };
  }

  return {
    add(fix: RawFix): AddResult {
      const here: LngLat = [fix.lng, fix.lat];

      if (fix.accuracy != null && fix.accuracy > maxAccuracyM) {
        return { point: null, stats: computeStats(), deviationChanged: false, accepted: false };
      }

      const last = points[points.length - 1];
      let stepDist = 0;
      if (last) {
        stepDist = haversine([last.lng, last.lat], here);
        if (stepDist < minStepM) {
          return { point: null, stats: computeStats(), deviationChanged: false, accepted: false };
        }
      }

      const dev = detector.update(here);
      const point: TrackPoint = {
        lng: fix.lng,
        lat: fix.lat,
        t: fix.t,
        accuracy: fix.accuracy ?? null,
        speed: fix.speed ?? null,
        deviated: dev.state === "DEVIATED",
      };
      points.push(point);
      if (last) distanceM += stepDist;

      return { point, stats: computeStats(), deviationChanged: dev.changed, accepted: true };
    },

    getPoints() {
      return points.slice();
    },

    getStats: computeStats,

    buildTrackGeoJSON() {
      if (points.length < 2) return null;
      return JSON.stringify({
        type: "LineString",
        coordinates: points.map((p) => [p.lng, p.lat]),
      });
    },

    buildDeviatedGeoJSON() {
      const lines: LngLat[][] = [];
      let current: LngLat[] | null = null;
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        if (p.deviated) {
          if (!current) {
            current = [];
            // seed with the previous on-route point so the pink run connects
            if (i > 0) current.push([points[i - 1].lng, points[i - 1].lat]);
          }
          current.push([p.lng, p.lat]);
        } else if (current) {
          current.push([p.lng, p.lat]); // close the run on the return-to-route point
          lines.push(current);
          current = null;
        }
      }
      if (current) lines.push(current);

      const usable = lines.filter((l) => l.length >= 2);
      if (usable.length === 0) return null;
      return JSON.stringify({ type: "MultiLineString", coordinates: usable });
    },

    hydrate(saved: TrackPoint[]) {
      points.length = 0;
      distanceM = 0;
      detector.reset();
      for (let i = 0; i < saved.length; i++) {
        const p = saved[i];
        points.push(p);
        if (i > 0) {
          distanceM += haversine(
            [saved[i - 1].lng, saved[i - 1].lat],
            [p.lng, p.lat],
          );
        }
        // replay through the detector so live state matches persisted tags
        detector.update([p.lng, p.lat]);
      }
    },

    reset() {
      points.length = 0;
      distanceM = 0;
      detector.reset();
    },
  };
}
