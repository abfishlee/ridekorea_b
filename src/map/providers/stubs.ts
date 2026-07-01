/**
 * Placeholder providers — interface only, not implemented yet.
 *
 * These exist so the factory + capability flags are complete and callers can
 * reason about "is there an offline-capable provider?" today. Implement when we
 * actually adopt Mapbox (offline tiles / terrain) or Google's Korea navigation.
 */
import type { MapProvider } from "../MapProvider";
import type { LngLat, MapProviderId, RideUpdate, StaticRouteOptions } from "../types";

function notImplemented(id: MapProviderId): never {
  throw new Error(`Map provider "${id}" is not implemented yet.`);
}

/** Mapbox — future secondary renderer (offline tiles). */
export class MapboxProvider implements MapProvider {
  readonly id: MapProviderId = "mapbox";
  readonly supportsOffline = true;
  readonly hasKoreanRoadDetail = false;
  readonly isConfigured = false;

  buildStaticRouteHtml(_coords: LngLat[], _opts?: StaticRouteOptions): string {
    return notImplemented(this.id);
  }
  buildLiveRideHtml(_planned: LngLat[]): string {
    return notImplemented(this.id);
  }
  liveRideUpdateScript(_update: RideUpdate): string {
    return notImplemented(this.id);
  }
}

/** Google — future primary candidate once Korea turn-by-turn navigation ships. */
export class GoogleProvider implements MapProvider {
  readonly id: MapProviderId = "google";
  readonly supportsOffline = false;
  readonly hasKoreanRoadDetail = true;
  readonly isConfigured = false;

  buildStaticRouteHtml(_coords: LngLat[], _opts?: StaticRouteOptions): string {
    return notImplemented(this.id);
  }
  buildLiveRideHtml(_planned: LngLat[]): string {
    return notImplemented(this.id);
  }
  liveRideUpdateScript(_update: RideUpdate): string {
    return notImplemented(this.id);
  }
}
