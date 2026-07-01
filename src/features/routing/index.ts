/**
 * Routing layer entry point — factory + config.
 *
 * Feature code imports the default `router` (or builds one with a stored-course
 * lookup). The 3-tier chain: stored official course → GraphHopper (OSM bike) →
 * straight-line estimate. Today stored+GraphHopper are inert (no lookup / no
 * host), so requests resolve to a clearly-estimated straight line until those
 * tiers are wired — an honest MVP with a real upgrade path.
 */
import { StoredCourseProvider, type StoredCourseLookup } from "./providers/storedCourseProvider";
import { GraphHopperProvider } from "./providers/graphHopperProvider";
import { StraightLineProvider } from "./providers/straightLineProvider";
import { createRoutingOrchestrator, type Router } from "./orchestrator";

export * from "./types";
export type { RoutingProvider } from "./RoutingProvider";
export type { Router } from "./orchestrator";
export { createRoutingOrchestrator } from "./orchestrator";
export type { StoredCourseLookup } from "./providers/storedCourseProvider";

export const ROUTING_CONFIG = {
  graphHopperUrl: process.env.EXPO_PUBLIC_GRAPHHOPPER_URL ?? "",
  graphHopperKey: process.env.EXPO_PUBLIC_GRAPHHOPPER_KEY ?? "",
};

/** Build the 3-tier router. Pass a stored-course lookup to activate tier 1. */
export function createRouter(storedLookup?: StoredCourseLookup): Router {
  return createRoutingOrchestrator([
    new StoredCourseProvider(storedLookup),
    new GraphHopperProvider(
      ROUTING_CONFIG.graphHopperUrl,
      ROUTING_CONFIG.graphHopperKey || undefined,
    ),
    new StraightLineProvider(),
  ]);
}

/** Default router (stored + GraphHopper inert until configured). */
export const router: Router = createRouter();
