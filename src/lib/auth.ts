/**
 * OAuth sign-in helpers. Uses Supabase-managed OAuth via an in-app browser
 * (no provider client IDs baked into the app — Google is configured in Supabase).
 *
 * Google is the only provider enabled during development. Apple is added at
 * commercialization (requires a paid Apple Developer account); see stores/auth.ts.
 */
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { supabase } from "./supabase";

WebBrowser.maybeCompleteAuthSession();

/** Parse tokens from a redirect URL (implicit flow → fragment, fallback → query). */
function paramsFromUrl(url: string): Record<string, string> {
  const raw = url.includes("#") ? url.split("#")[1] : (url.split("?")[1] ?? "");
  return Object.fromEntries(new URLSearchParams(raw));
}

export async function signInWithGoogle(): Promise<void> {
  const redirectTo = Linking.createURL("auth-callback");

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data?.url) throw new Error("No auth URL returned from Supabase.");

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success") return; // dismissed / cancelled

  const params = paramsFromUrl(result.url);
  if (params.error_description) throw new Error(params.error_description);

  if (params.access_token && params.refresh_token) {
    const { error: sessionErr } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    if (sessionErr) throw sessionErr;
  }
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

// --- DEV ONLY: email/password sign-in to bypass Google during local dev. ---
// Local Supabase has email confirmations off, so sign-up yields a usable session.
const DEV_EMAIL = "dev@ridekorea.local";
const DEV_PASSWORD = "devpassword123";

export async function signInDev(): Promise<void> {
  let res = await supabase.auth.signInWithPassword({
    email: DEV_EMAIL,
    password: DEV_PASSWORD,
  });
  if (res.error) {
    const signUp = await supabase.auth.signUp({ email: DEV_EMAIL, password: DEV_PASSWORD });
    if (signUp.error && !/already/i.test(signUp.error.message)) throw signUp.error;
    res = await supabase.auth.signInWithPassword({ email: DEV_EMAIL, password: DEV_PASSWORD });
    if (res.error) throw res.error;
  }
}
