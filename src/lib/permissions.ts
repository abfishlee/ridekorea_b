/**
 * Location permission helpers. The *rationale* (priming) is shown in the UI
 * BEFORE these are called, and they are only invoked at the moment they're
 * needed (e.g. starting a ride) — not at app launch.
 *
 * Web note: the browser Geolocation API only works in a secure context
 * (https or localhost). On a LAN-IP http origin (e.g. http://192.168.x.x:8081)
 * the permission request can hang forever, trapping the ride in "starting".
 * So on web we guard for availability and time out gracefully, letting the
 * ride run in-memory for preview rather than spinning indefinitely.
 */
import * as Location from "expo-location";
import { Platform } from "react-native";

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(fallback);
      }
    }, ms);
    p.then((v) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(v);
      }
    }).catch(() => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(fallback);
      }
    });
  });
}

export async function ensureForegroundLocation(): Promise<boolean> {
  if (Platform.OS === "web") {
    const geo =
      typeof navigator !== "undefined"
        ? (navigator as Navigator & { geolocation?: unknown }).geolocation
        : undefined;
    const secure = typeof window !== "undefined" ? window.isSecureContext : false;
    // No geolocation, or insecure origin (LAN-IP http): skip the (hang-prone)
    // prompt and proceed so the ride UI is viewable in preview.
    if (!geo || !secure) return true;
    // Secure web: request, but never hang — time out to "proceed" after 8s.
    return withTimeout(
      Location.requestForegroundPermissionsAsync()
        .then((r) => r.status === "granted")
        .catch(() => false),
      8000,
      true,
    );
  }
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === "granted";
}

/** Foreground first, then background — required for ride tracking when the screen is off. */
export async function ensureBackgroundLocation(): Promise<boolean> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== "granted") return false;
  const bg = await Location.requestBackgroundPermissionsAsync();
  return bg.status === "granted";
}

export async function getLocationStatus() {
  return Location.getForegroundPermissionsAsync();
}
