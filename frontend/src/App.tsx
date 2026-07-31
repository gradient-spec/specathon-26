import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./admin/AuthContext";
import RequireAdmin from "./admin/RequireAdmin";

const Home = lazy(() => import("./pages/Home"));
const ShortlistedTeams = lazy(() => import("./pages/ShortlistedTeams"));
const Payment = lazy(() => import("./pages/Payment"));
const AdminLogin = lazy(() => import("./admin/AdminLogin"));
const Dashboard = lazy(() => import("./admin/Dashboard"));

const PageLoader = () => <div className="min-h-screen bg-void" />;

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public */}
            <Route path="/" element={<Home />} />
            <Route path="/shortlisted" element={<ShortlistedTeams />} />
            <Route path="/payment" element={<Payment />} />

            {/* Admin */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route
              path="/admin/dashboard"
              element={
                <RequireAdmin>
                  <Dashboard />
                </RequireAdmin>
              }
            />

            {/* Redirect /admin → /admin/login for convenience */}
            <Route path="/admin" element={<Navigate to="/admin/login" replace />} />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
