// Auth helper: builds a Supabase client bound to the caller's JWT and resolves
// the authenticated user. Because the client carries the user's Authorization
// header, `auth.uid()` resolves correctly inside SECURITY DEFINER RPCs called
// through it — so the RPCs can bypass RLS for privileged writes while still
// knowing *who* is calling.
//
// SUPABASE_URL / SUPABASE_ANON_KEY are injected automatically by the platform.
import { createClient, SupabaseClient, User } from "https://esm.sh/@supabase/supabase-js@2";

export interface AuthContext {
  supabase: SupabaseClient;
  user: User;
}

/** Returns the authed client+user, or null if the request is unauthenticated. */
export async function getAuth(req: Request): Promise<AuthContext | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { supabase, user: data.user };
}
