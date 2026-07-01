/**
 * Naver provider — DEFAULT renderer.
 *
 * Wraps the existing cost-minimized Naver Web Dynamic Map builders in
 * ../../lib/naverMap (kept as the Naver-specific implementation detail). The
 * live-ride page loads once and is updated via `window.__rideUpdate(...)`, so a
 * whole ride is a single map load — no per-fix billing.
 */
import { NAVER_CLIENT_ID, buildRouteMapHtml, buildRideMapHtml } from "../../lib/naverMap";
import type { MapProvider } from "../MapProvider";
import type { LngLat, MapProviderId, RideUpdate, StaticRouteOptions } from "../types";

export class NaverWebViewProvider implements MapProvider {
  readonly id: MapProviderId = "naver";
  readonly supportsOffline = false;
  readonly hasKoreanRoadDetail = true;

  get isConfigured(): boolean {
    return !!NAVER_CLIENT_ID;
  }

  buildStaticRouteHtml(coords: LngLat[], opts?: StaticRouteOptions): string {
    return buildRouteMapHtml(coords, opts);
  }

  buildLiveRideHtml(planned: LngLat[]): string {
    return buildRideMapHtml(planned);
  }

  liveRideUpdateScript(update: RideUpdate): string {
    const payload = JSON.stringify({
      track: update.track,
      deviated: update.deviated,
      pos: update.pos,
    });
    // Contract matches the page built by buildRideMapHtml (Naver-specific).
    return `window.__rideUpdate(${payload}); true;`;
  }
}
