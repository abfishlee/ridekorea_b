/**
 * Pure unit tests for outbox-validate (no test runner needed).
 * Run via `npm run test:cores`.
 */

import {
  isValidLngLat,
  sanitizePlannedLine,
  sanitizeTrackPoints,
} from "./outbox-validate";

let passed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  passed++;
}

// --- isValidLngLat ---
(function testIsValidLngLat() {
  assert(isValidLngLat([127.0, 37.5]), "valid pair");
  assert(!isValidLngLat([127.0]), "wrong length");
  assert(!isValidLngLat([127.0, 37.5, 1]), "too long");
  assert(!isValidLngLat([NaN, 37.5]), "NaN rejected");
  assert(!isValidLngLat([181, 37.5]), "lng out of range");
  assert(!isValidLngLat([127, 95]), "lat out of range");
  assert(!isValidLngLat(["127", "37"]), "string coords rejected");
  assert(!isValidLngLat(null), "null rejected");
  assert(!isValidLngLat({ lng: 127, lat: 37 }), "object rejected");
})();

// --- sanitizePlannedLine ---
(function testSanitizePlannedLineFromString() {
  const gj = JSON.stringify({ type: "LineString", coordinates: [[127.0, 37.5], [127.01, 37.51]] });
  const out = sanitizePlannedLine(gj);
  assert(out.length === 2, "parses GeoJSON string");
  assert(out[0][0] === 127.0 && out[0][1] === 37.5, "keeps coords");
})();

(function testSanitizePlannedLineFromObjectAndArray() {
  const fromObj = sanitizePlannedLine({ coordinates: [[1, 2], [3, 4]] });
  assert(fromObj.length === 2, "parses object with .coordinates");
  const fromArr = sanitizePlannedLine([[1, 2], [3, 4]]);
  assert(fromArr.length === 2, "parses bare array");
})();

(function testSanitizePlannedLineFiltersJunk() {
  const mixed = sanitizePlannedLine([[127, 37], [999, 0], ["x", 1], null, [1], [10, 20]]);
  assert(mixed.length === 2, "keeps only the two valid pairs");
  assert(sanitizePlannedLine("not json {").length === 0, "bad JSON string -> []");
  assert(sanitizePlannedLine({ coordinates: "nope" }).length === 0, "non-array coordinates -> []");
  assert(sanitizePlannedLine(null).length === 0, "null -> []");
  assert(sanitizePlannedLine(undefined).length === 0, "undefined -> []");
  assert(sanitizePlannedLine(42).length === 0, "number -> []");
})();

// --- sanitizeTrackPoints ---
(function testSanitizeTrackPoints() {
  const rows = [
    { lng: 127.0, lat: 37.5, t: 1000, accuracy: 5, speed: 3, deviated: true },
    { lng: NaN, lat: 37.5, t: 2000 },            // bad lng
    { lng: 127.0, lat: 200, t: 3000 },           // lat out of range
    { lng: 127.1, lat: 37.6, t: 4000 },          // ok, missing accuracy/speed
    null,                                         // junk
    { lng: 127.2, lat: 37.7 },                    // missing t
  ];
  const out = sanitizeTrackPoints(rows);
  assert(out.length === 2, "keeps only the two valid points");
  assert(out[0].deviated === true, "preserves deviated flag");
  assert(out[1].accuracy === null && out[1].speed === null, "missing accuracy/speed -> null");
  assert(sanitizeTrackPoints(null).length === 0, "null -> []");
  assert(sanitizeTrackPoints(undefined).length === 0, "undefined -> []");
  assert(sanitizeTrackPoints("nope" as unknown as unknown[]).length === 0, "non-array -> []");
})();

console.log(`outbox-validate: all ${passed} assertions passed`);
