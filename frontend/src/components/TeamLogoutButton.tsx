import { LogOut } from "lucide-react";
import { useTeamAuth } from "@/hooks/TeamAuthContext";

/* Shared logout control for /team/payment — the only Team Portal page that
   shows it. Inline (not fixed/floating) so pages can place it precisely;
   uses the existing signOutTeam() mechanism (Team Supabase sign-out +
   redirect to "/team/login"). */
export default function TeamLogoutButton() {
  const { signOutTeam } = useTeamAuth();

  return (
    <button
      type="button"
      onClick={() => signOutTeam()}
      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-line text-fg/70 bg-void/60 backdrop-blur-md hover:border-ember/50 hover:text-ember hover:bg-ember/[0.06] transition-all duration-300"
    >
      <LogOut size={12} />
      Logout
    </button>
  );
}
