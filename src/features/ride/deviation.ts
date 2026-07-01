/**
 * Deviation detection engine (pure geometry, no React Native imports).
 *
 * Core of the "blue line (on-route) <-> pink line (deviated)" experience.
 * Given the planned route polyline and a stream of GPS points, it reports
 * whether the rider is currently ON_ROUTE or DEVIATED, using hysteresis so
 * the state does not flicker when the rider hovers near the threshold.
 *
 * Coordinates are [lng, lat] tuples throughout (matching our map adapters).
 *
 * This module is intentionally free of `expo-*` / `react-native` imports so it
 * can be unit-tested in plain Node and reused on web.
 */

export type LngLat = [number, number];
export type DeviationState = "ON_ROUTE" | "DEVIATED";

const EARTH_RADIUS_M = 6_371_000;
const M_PER_DEG_LAT = 111_320;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance in meters between two [lng, lat] points. */
export function haversine(a: LngLat, b: LngLat): number {
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Distance (meters) from point `p` to the segment `a`-`b`.
 *
 * Uses a local equirectangular projection centered on `p`'s latitude. At the
 * scale of deviation thresholds (tens of meters) this is accurate well within
 * a meter, and is far cheaper than repeated haversine calls.
 */
export function pointToSegmentDistance(p: LngLat, a: LngLat, b: LngLat): number {
  const mPerDegLng = M_PER_DEG_LAT * Math.cos(toRad(p[1]));

  const px = p[0] * mPerDegLng;
  const py = p[1] * M_PER_DEG_LAT;
  const ax = a[0] * mPerDegLng;
  const ay = a[1] * M_PER_DEG_LAT;
  const bx = b[0] * mPerDegLng;
  const by = b[1] * M_PER_DEG_LAT;

  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;

  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));

  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/** Minimum distance (meters) from point `p` to a polyline (array of vertices). */
export function distanceToPolyline(p: LngLat, line: LngLat[]): number {
  if (line.length === 0) return Infinity;
  if (line.length === 1) return haversine(p, line[0]);

  let min = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const d = pointToSegmentDistance(p, line[i], line[i + 1]);
    if (d < min) min = d;
  }
  return min;
}

export interface DeviationUpdate {
  /** Resulting state after applying this point. */
  state: DeviationState;
  /** Distance (meters) from the point to the route at this update. */
  distance: number;
  /** True only on the update where the state flipped. */
  changed: boolean;
}

export interface DeviationOptions {
  /** Cross this (meters, while ON_ROUTE) to flip to DEVIATED. Default 40. */
  enterM?: number;
  /** Drop below this (meters, while DEVIATED) to flip back to ON_ROUTE. Default 25. */
  exitM?: number;
  /** Starting state. Default "ON_ROUTE". */
  initial?: DeviationState;
}

export interface DeviationDetector {
  readonly state: DeviationState;
  /** Feed the next GPS fix; returns the (possibly unchanged) state. */
  update(point: LngLat): DeviationUpdate;
  /** Reset to the initial state (e.g. when restarting a ride). */
  reset(): void;
}

/**
 * Create a stateful deviation detector with hysteresis.
 *
 * Hysteresis means the "enter" threshold is larger than the "exit" threshold:
 * the rider must stray > enterM to be marked deviated, then come back within
 * exitM to be marked on-route again. The gap (default 40m vs 25m) absorbs GPS
 * jitter so the line color does not strobe at the boundary.
 */
export function createDeviationDetector(
  line: LngLat[],
  opts: DeviationOptions = {},
): DeviationDetector {
  const enterM = opts.enterM ?? 40;
  const exitM = opts.exitM ?? 25;
  const initial: DeviationState = opts.initial ?? "ON_ROUTE";

  if (exitM > enterM) {
    throw new Error(
      `deviation: exitM (${exitM}) must be <= enterM (${enterM}) for hysteresis`,
    );
  }

  let state: DeviationState = initial;
  const hasRoute = line.length >= 2;

  return {
    get state() {
      return state;
    },
    update(point: LngLat): DeviationUpdate {
      // No planned route (free ride) -> never "deviated".
      const distance = hasRoute ? distanceToPolyline(point, line) : 0;
      const prev = state;

      if (hasRoute) {
        if (state === "ON_ROUTE" && distance > enterM) {
          state = "DEVIATED";
        } else if (state === "DEVIATED" && distance < exitM) {
          state = "ON_ROUTE";
        }
      }

      return { state, distance, changed: state !== prev };
    },
    reset() {
      state = initial;
    },
  };
}
