import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/services/supabase";

type AuthState = {
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  email: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      verifyAdmin(data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      verifyAdmin(s);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function verifyAdmin(s: Session | null) {
    if (!supabase || !s) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.rpc("is_admin");
    setIsAdmin(!error && Boolean(data));
    setLoading(false);
  }

  const signIn = async (email: string, password: string) => {
    if (!supabase) throw new Error("Supabase not configured.");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
    setIsAdmin(false);
    // Replace history so the browser Back button cannot re-enter the dashboard.
    window.history.replaceState(null, "", "/admin/login");
    window.location.replace("/admin/login");
  };

  return (
    <AuthCtx.Provider
      value={{
        session,
        loading,
        isAdmin,
        email: session?.user.email ?? null,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const v = useContext(AuthCtx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
