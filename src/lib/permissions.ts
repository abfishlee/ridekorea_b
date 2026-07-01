/**
 * Location permission helpers. The *rationale* (priming) is shown in the UI
 * BEFORE these are called, and they are only invoked at the moment they're
 * needed (e.g. starting a ride) — not at app launch.
 */
import * as Location from "expo-location";

export async function ensureForegroundLocation(): Promise<boolean> {
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
