/**
 * Ride metrics — pure, dependency-light track summary.
 *
 * Post-hoc summary over an array of recorded track points: total distance,
 * elapsed time, average speed, deviated-point count. Kept free of expo /
 * react-native imports (only reuses the pure `haversine` from ./deviation) so it
 * is unit-testable in plain Node and shareable with web.
 *
 * Distance intentionally skips any single segment longer than `jumpThresholdM`,
 * so a lone GPS teleport spike between two fixes can't inflate the total. This
 * mirrors the live guard in ./track (createTrackAccumulator maxJumpM) but works
 * on already-persisted points, e.g. when re-summarizing a recovered ride.
 */

import { haversine, type LngLat } from "./deviation";

export interface MetricPoint {
  lng: number;
  lat: number;
  /** Epoch milliseconds when the fix was recorded. */
  t: number;
  /** true = off-route (pink). Optional; absent counts as on-route. */
  deviated?: boolean;
}

export interface TrackSummary {
  /** Total ridden distance in meters (jump segments excluded). */
  distanceM: number;
  /** Elapsed wall-clock between first and last fix, in seconds. */
  durationS: number;
  /** Average speed (distance / duration), km/h. */
  avgSpeedKmh: number;
  pointCount: number;
  /** Number of points tagged deviated (off-route). */
  deviatedCount: number;
  /** True when there are >= 2 points (enough to form a line / distance). */
  hasEnoughTrack: boolean;
}

export interface SummarizeOptions {
  /** Skip any segment longer than this (meters) when summing distance. Default 1000. */
  jumpThresholdM?: number;
}

const EMPTY_SUMMARY: TrackSummary = {
  distanceM: 0,
  durationS: 0,
  avgSpeedKmh: 0,
  pointCount: 0,
  deviatedCount: 0,
  hasEnoughTrack: false,
};

/**
 * Summarize a set of track points. Points are sorted by time first, so callers
 * don't have to pre-sort (recovered/outbox rows may be out of order).
 */
export function summarizeTrack(
  points: readonly MetricPoint[],
  options: SummarizeOptions = {},
): TrackSummary {
  if (!points || points.length === 0) return { ...EMPTY_SUMMARY };

  const jumpThresholdM = options.jumpThresholdM ?? 1000;
  const sorted = [...points].sort((a, b) => a.t - b.t);

  let distanceM = 0;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    const seg = haversine([prev.lng, prev.lat] as LngLat, [cur.lng, cur.lat] as LngLat);
    if (seg <= jumpThresholdM) distanceM += seg;
  }

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const durationS = Math.max(0, Math.floor((last.t - first.t) / 1000));
  const avgSpeedKmh = durationS > 0 ? (distanceM / durationS) * 3.6 : 0;
  const deviatedCount = sorted.reduce((n, p) => (p.deviated ? n + 1 : n), 0);

  return {
    distanceM,
    durationS,
    avgSpeedKmh,
    pointCount: sorted.length,
    deviatedCount,
    hasEnoughTrack: sorted.length >= 2,
  };
}
