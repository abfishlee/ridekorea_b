/**
 * Map layer entry point — factory + config.
 *
 * Feature code imports ONLY from here:
 *   import { mapProvider } from "../../map";       // default (primary) provider
 *   import { createMapProvider, MAP_CONFIG } from "../../map";
 *
 * Swapping the primary renderer (Naver -> Google when its Korea navigation ships)
 * is a one-line change to MAP_CONFIG.primary — no edits to screens/features.
 */
import { NAVER_CLIENT_ID } from "../lib/naverMap";
import type { MapProvider } from "./MapProvider";
import type { MapProviderId } from "./types";
import { NaverWebViewProvider } from "./providers/NaverWebViewProvider";
import { MapboxProvider, GoogleProvider } from "./providers/stubs";

export * from "./types";
export type { MapProvider } from "./MapProvider";

/** Central map configuration. Credentials come from Expo public env, never hardcoded. */
export const MAP_CONFIG = {
  /** Primary renderer. Naver today; 'google' is a future candidate. */
  primary: "naver" as MapProviderId,
  /** Secondary renderer for offline/terrain once implemented. */
  secondary: "mapbox" as MapProviderId,
  naverClientId: NAVER_CLIENT_ID,
  mapboxToken: process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "",
};

/** Build a provider by id (defaults to the configured primary). */
export function createMapProvider(which: MapProviderId = MAP_CONFIG.primary): MapProvider {
  switch (which) {
    case "naver":
      return new NaverWebViewProvider();
    case "mapbox":
      return new MapboxProvider();
    case "google":
      return new GoogleProvider();
    default:
      throw new Error(`Unknown map provider: ${which}`);
  }
}

/** Shared default instance (providers are stateless string-builders). */
export const mapProvider: MapProvider = createMapProvider();
