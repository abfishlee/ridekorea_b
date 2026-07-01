/**
 * Pure unit tests for the routing layer (no test runner needed).
 * Run via `npm run test:cores`.
 */

import { createRoutingOrchestrator } from "./orchestrator";
import type { RoutingProvider } from "./RoutingProvider";
import type { RouteRequest, RouteResult, RouteSource } from "./types";
import { StraightLineProvider } from "./providers/straightLineProvider";
import { StoredCourseProvider } from "./providers/storedCourseProvider";
import {
  GraphHopperProvider,
  buildGraphHopperUrl,
  parseGraphHopperResponse,
} from "./providers/graphHopperProvider";

let passed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  passed++;
}

const REQ: RouteRequest = { from: [127.0, 37.5], to: [127.05, 37.55] };

// A fake provider that returns a canned result (or null to fall through).
function fake(id: RouteSource, result: RouteResult | null): RoutingProvider {
  return { id, isConfigured: true, route: async () => result };
}
function res(source: RouteSource): RouteResult {
  return { coordinates: [REQ.from, REQ.to], distanceM: 100, durationS: 60, source, estimated: false };
}

async function main() {
  // --- orchestrator fallthrough ---
  {
    const router = createRoutingOrchestrator([
      fake("stored", null),
      fake("graphhopper", res("graphhopper")),
      fake("straight", res("straight")),
    ]);
    const r = await router.route(REQ);
    assert(r?.source === "graphhopper", "falls through null tier to next (graphhopper wins)");
  }
  {
    const router = createRoutingOrchestrator([
      fake("stored", res("stored")),
      fake("graphhopper", res("graphhopper")),
    ]);
    const r = await router.route(REQ);
    assert(r?.source === "stored", "first non-null tier wins (order preserved)");
  }
  {
    const router = createRoutingOrchestrator([fake("stored", null), fake("graphhopper", null)]);
    const r = await router.route(REQ);
    assert(r === null, "all tiers null -> null");
  }

  // --- straight-line provider ---
  {
    const p = new StraightLineProvider();
    const r = await p.route(REQ);
    assert(r.coordinates.length === 2, "straight line has 2 points");
    assert(r.source === "straight" && r.estimated, "marked straight + estimated");
    assert(r.distanceM > 5000 && r.distanceM < 8000, "haversine distance ~6.4km");
    assert((r.durationS ?? 0) > 0, "duration estimated positive");
  }

  // --- stored-course provider (DI) ---
  {
    const inert = new StoredCourseProvider();
    assert(!inert.isConfigured, "no lookup -> not configured");
    assert((await inert.route(REQ)) === null, "no lookup -> null");

    const withLookup = new StoredCourseProvider(async () => res("stored"));
    assert(withLookup.isConfigured, "lookup -> configured");
    assert((await withLookup.route(REQ))?.source === "stored", "lookup result returned");
  }

  // --- GraphHopper URL builder ---
  {
    const url = buildGraphHopperUrl("https://gh.example.com/", REQ, "SECRET");
    assert(url.includes("/route?"), "route endpoint");
    assert(url.includes("point=37.5,127"), "point is lat,lng (from)");
    assert(url.includes("point=37.55,127.05"), "point is lat,lng (to)");
    assert(url.includes("profile=bike"), "bike profile");
    assert(url.includes("points_encoded=false"), "geojson coords");
    assert(url.includes("key=SECRET"), "key appended when provided");
    assert(!url.includes("//route"), "trailing slash trimmed");
    const noKey = buildGraphHopperUrl("https://gh.example.com", REQ);
    assert(!noKey.includes("key="), "no key param when absent");
  }

  // --- GraphHopper response parser ---
  {
    const ok = parseGraphHopperResponse({
      paths: [{ distance: 1234.5, time: 300000, points: { coordinates: [[127.0, 37.5], [127.05, 37.55]] } }],
    });
    assert(ok?.source === "graphhopper" && ok?.estimated === false, "parsed as graphhopper, not estimated");
    assert(ok?.distanceM === 1234.5, "distance parsed");
    assert(ok?.durationS === 300, "time ms -> s");
    assert(ok?.coordinates.length === 2, "coords parsed");

    assert(parseGraphHopperResponse({ paths: [] }) === null, "empty paths -> null");
    assert(parseGraphHopperResponse({}) === null, "no paths -> null");
    assert(
      parseGraphHopperResponse({ paths: [{ points: { coordinates: [[1, 2]] } }] }) === null,
      "single-point path -> null",
    );
  }

  // --- GraphHopper provider inert when unconfigured (no network) ---
  {
    const p = new GraphHopperProvider("");
    assert(!p.isConfigured, "empty base url -> not configured");
    assert((await p.route(REQ)) === null, "unconfigured -> null (falls through)");
  }

  console.log(`routing: all ${passed} assertions passed`);
}

main().catch((e) => {
  console.error(e);
  // Re-throw so an assertion failure surfaces as a non-zero exit (unhandled
  // rejection is fatal on Node 18+), without referencing the node `process` global.
  throw e;
});
