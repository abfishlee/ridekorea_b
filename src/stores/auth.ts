import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { signInWithGoogle as doGoogle, signInDev as doDevSignIn, signOut as doSignOut } from "../lib/auth";

type AuthState = {
  session: Session | null;
  initializing: boolean;
  /** Loads the current session and subscribes to changes. Returns an unsubscribe fn. */
  init: () => () => void;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInDev: () => Promise<void>;
  signOut: () => Promise<void>;
};

export const useAuth = create<AuthState>((set) => ({
  session: null,
  initializing: true,

  init: () => {
    supabase.auth
      .getSession()
      .then(({ data }) => set({ session: data.session, initializing: false }));

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      set({ session });
    });
    return () => data.subscription.unsubscribe();
  },

  signInWithGoogle: doGoogle,

  // DEV ONLY — bypass Google during local development.
  signInDev: doDevSignIn,

  // Enabled at commercialization (requires a paid Apple Developer account).
  signInWithApple: async () => {
    throw new Error("Apple sign-in will be available at launch.");
  },

  signOut: doSignOut,
}));
