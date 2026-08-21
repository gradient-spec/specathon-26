import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./admin/AuthContext";
import { TeamAuthProvider } from "./hooks/TeamAuthContext";
import RequireAdmin from "./admin/RequireAdmin";
import { ToastProvider } from "./components/Toast";

const Home = lazy(() => import("./pages/Home"));
const ShortlistedTeams = lazy(() => import("./pages/ShortlistedTeams"));
const ShortlistRecovery = lazy(() => import("./pages/ShortlistRecovery"));
const ShortlistDashboard = lazy(() => import("./pages/ShortlistDashboard"));
const ShortlistPayment = lazy(() => import("./pages/ShortlistPayment"));
const ShortlistConfirmation = lazy(() => import("./pages/ShortlistConfirmation"));
const ShortlistReceipt = lazy(() => import("./pages/ShortlistReceipt"));
const ShortlistInvalid = lazy(() => import("./pages/ShortlistInvalid"));
const PhotoBoothPage = lazy(() => import("./pages/PhotoBoothPage"));
const AdminLogin = lazy(() => import("./admin/AdminLogin"));
const Dashboard = lazy(() => import("./admin/Dashboard"));
const TeamLogin = lazy(() => import("./pages/TeamLogin"));
const TeamDashboard = lazy(() => import("./pages/TeamDashboard"));
const TeamPaymentSuccess = lazy(() => import("./pages/TeamPaymentSuccess"));
const TeamPaymentFailed = lazy(() => import("./pages/TeamPaymentFailed"));

const PageLoader = () => <div className="min-h-screen bg-void" />;

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <TeamAuthProvider>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* Public */}
                <Route path="/" element={<Home />} />
                <Route path="/shortlisted" element={<ShortlistedTeams />} />
                <Route path="/shortlist/recover" element={<ShortlistRecovery />} />
                <Route path="/shortlist/:token" element={<ShortlistDashboard />} />
                <Route path="/shortlist/:token/payment" element={<ShortlistPayment />} />
                <Route path="/shortlist/:token/confirmation" element={<ShortlistConfirmation />} />
                <Route path="/shortlist/:token/receipt" element={<ShortlistReceipt />} />
                <Route path="/shortlist/invalid" element={<ShortlistInvalid />} />
                <Route path="/photobooth" element={<PhotoBoothPage />} />

                {/* Team Authentication */}
                <Route path="/team/login" element={<TeamLogin />} />
                <Route path="/team/payment" element={<TeamDashboard />} />
                <Route path="/team/payment/f82b7c4a1e9d3a2f" element={<TeamPaymentSuccess />} />
                <Route path="/team/payment/x1y2z3a4b5c6d7e8" element={<TeamPaymentFailed />} />

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

                {/* Redirect /admin -> /admin/login for convenience */}
                <Route path="/admin" element={<Navigate to="/admin/login" replace />} />

                {/* Catch-all */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </TeamAuthProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}





