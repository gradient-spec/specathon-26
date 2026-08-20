import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { teamSupabase as supabase } from "@/services/supabase";

type TeamAuthState = {
  session: Session | null;
  loading: boolean;
  isTeam: boolean;
  teamId: string | null;
  signInTeam: (teamId: string, password: string) => Promise<void>;
  signOutTeam: () => Promise<void>;
};

const TeamAuthCtx = createContext<TeamAuthState | null>(null);

export function TeamAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isTeam, setIsTeam] = useState(false);
  const [teamId, setTeamId] = useState<string | null>(null);
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
      verifyTeam(data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      verifyTeam(s);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function verifyTeam(s: Session | null) {
    if (!supabase || !s || !s.user.email) {
      setIsTeam(false);
      setTeamId(null);
      setLoading(false);
      return;
    }
    // Check if email ends with @teams.specathon.in
    const email = s.user.email;
    if (email.endsWith("@teams.specathon.in")) {
      setIsTeam(true);
      setTeamId(email.split("@")[0].toUpperCase());
    } else {
      setIsTeam(false);
      setTeamId(null);
    }
    setLoading(false);
  }

  const signInTeam = async (id: string, password: string) => {
    if (!supabase) throw new Error("Supabase not configured.");
    const syntheticEmail = `${id.toLowerCase()}@teams.specathon.in`;
    const { error } = await supabase.auth.signInWithPassword({ email: syntheticEmail, password });
    if (error) throw error;
  };

  const signOutTeam = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
    setIsTeam(false);
    setTeamId(null);
    window.location.replace("/team/login");
  };

  return (
    <TeamAuthCtx.Provider
      value={{
        session,
        loading,
        isTeam,
        teamId,
        signInTeam,
        signOutTeam,
      }}
    >
      {children}
    </TeamAuthCtx.Provider>
  );
}

export function useTeamAuth() {
  const v = useContext(TeamAuthCtx);
  if (!v) throw new Error("useTeamAuth must be used within TeamAuthProvider");
  return v;
}

