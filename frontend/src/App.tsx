import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./admin/AuthContext";
import RequireAdmin from "./admin/RequireAdmin";

// Public site
const Home = lazy(() => import("./pages/Home"));

// Admin routes remain operational
const AdminLogin = lazy(() => import("./admin/AdminLogin"));
const Dashboard = lazy(() => import("./admin/Dashboard"));

const PageLoader = () => <div className="min-h-screen bg-void" />;

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public route */}
            <Route path="/" element={<Home />} />

            {/* Admin routes - OPERATIONAL */}
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

            {/* Catch-all - redirect to maintenance page */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}