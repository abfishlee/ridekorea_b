/**
 * Pure unit tests for ride-metrics (no test runner needed).
 *
 * Compile with the source, then run with node:
 *   npx tsc src/features/ride/ride-metrics.ts src/features/ride/ride-metrics.test.ts \
 *     src/features/ride/deviation.ts --outDir _t --rootDir src --target es2019 \
 *     --module commonjs --skipLibCheck --ignoreConfig
 *   node _t/features/ride/ride-metrics.test.js
 */

import { summarizeTrack, type MetricPoint } from "./ride-metrics";

let passed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  passed++;
}
function almost(actual: number, expected: number, tol: number, msg: string) {
  assert(Math.abs(actual - expected) <= tol, `${msg} (expected ~${expected}, got ${actual})`);
}

function p(lng: number, lat: number, t: number, deviated = false): MetricPoint {
  return { lng, lat, t, deviated };
}

// 1) Two points ~140 m apart -> distance + speed sane.
(function testBasicDistanceAndSpeed() {
  const s = summarizeTrack([
    p(126.9780, 37.5665, 0),
    p(126.9790, 37.5675, 60_000), // 60s later
  ]);
  almost(s.distanceM, 140, 25, "two-point distance ~140m");
  assert(s.pointCount === 2, "pointCount is 2");
  assert(s.durationS === 60, "durationS is 60");
  assert(s.hasEnoughTrack, "two points is enough track");
  assert(s.avgSpeedKmh > 0, "avg speed positive");
})();

// 2) Unsorted input is sorted; deviated counted; duration from first..last.
(function testSortAndDeviatedCount() {
  const s = summarizeTrack([
    p(127.002, 37.002, 1_200_000, true), // last in time, off-route
    p(127.000, 37.000, 0),               // first in time
    p(127.001, 37.001, 600_000),         // middle
  ]);
  assert(s.pointCount === 3, "counts all points");
  assert(s.deviatedCount === 1, "counts one deviated point");
  assert(s.durationS === 1200, "duration uses sorted first/last (1200s)");
  assert(s.distanceM > 0, "distance positive");
})();

// 3) A single huge GPS jump segment is excluded from distance.
(function testIgnoresGpsJump() {
  const withJump = summarizeTrack([
    p(127.000, 37.000, 0),
    p(127.001, 37.001, 600_000),
    p(128.000, 38.000, 1_200_000), // ~140km away = teleport spike
  ]);
  const withoutJump = summarizeTrack([
    p(127.000, 37.000, 0),
    p(127.001, 37.001, 600_000),
  ]);
  almost(withJump.distanceM, withoutJump.distanceM, 1, "jump segment excluded from distance");
  assert(withJump.pointCount === 3, "jumped point still counted");
})();

// 4) Empty input -> zeroed summary, not enough track.
(function testEmpty() {
  const s = summarizeTrack([]);
  assert(s.pointCount === 0, "empty pointCount 0");
  assert(s.distanceM === 0, "empty distance 0");
  assert(s.durationS === 0, "empty duration 0");
  assert(!s.hasEnoughTrack, "empty not enough track");
})();

// 5) Custom jump threshold keeps a moderate segment that the default would keep,
//    but a tighter threshold drops it.
(function testCustomThreshold() {
  const pts = [p(127.000, 37.000, 0), p(127.010, 37.010, 60_000)]; // ~1.4km apart
  const kept = summarizeTrack(pts); // default 1000m -> excluded (>1km)
  const keptLoose = summarizeTrack(pts, { jumpThresholdM: 5000 });
  assert(kept.distanceM === 0, "default 1km threshold drops 1.4km segment");
  assert(keptLoose.distanceM > 0, "loose threshold keeps 1.4km segment");
})();

console.log(`ride-metrics: all ${passed} assertions passed`);
