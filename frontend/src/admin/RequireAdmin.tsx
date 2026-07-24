import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "./AuthContext";

export default function RequireAdmin({ children }: { children: ReactNode }) {
  const { session, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <Loader2 className="animate-spin text-plasma" size={22} />
      </div>
    );
  }

  if (!session) return <Navigate to="/admin/login" replace />;
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-void flex flex-col items-center justify-center text-center px-6">
        <div className="font-display text-3xl tracking-tightest mb-2">Access denied</div>
        <p className="text-muted text-sm max-w-md mb-6">
          Your account is signed in but not on the admin allow-list. Ask an organizer to add your email to the <code className="font-mono text-fg/80">admins</code> table in Supabase.
        </p>
        <a href="/admin/login" className="btn-ghost">Back to sign in</a>
      </div>
    );
  }

  return <>{children}</>;
}
