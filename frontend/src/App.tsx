import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { AppShell } from "./components/layout/AppShell";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ToastViewport } from "./features/toast/ToastViewport";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { OAuthCallbackPage } from "./pages/OAuthCallbackPage";
import { RegisterPage } from "./pages/RegisterPage";
import { DashboardPage } from "./pages/DashboardPage";
import { CreateJsonPage } from "./pages/CreateJsonPage";
import { DocumentDetailsPage } from "./pages/DocumentDetailsPage";
import { PublicJsonPage } from "./pages/PublicJsonPage";
import { CompareJsonPage } from "./pages/CompareJsonPage";
import { SettingsPage } from "./pages/SettingsPage";
import { AdminDashboardPage } from "./pages/AdminDashboardPage";
import { ApiPlaygroundPage } from "./pages/ApiPlaygroundPage";
import { useThemeStore } from "./store/themeStore";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

function ThemeBoot() {
  const apply = useThemeStore((s) => s.apply);
  const mode = useThemeStore((s) => s.mode);
  useEffect(() => {
    apply();
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [apply, mode]);
  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeBoot />
      <ErrorBoundary>
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<LandingPage />} />
              <Route path="login" element={<LoginPage />} />
              <Route path="login/oauth" element={<OAuthCallbackPage />} />
              <Route path="register" element={<RegisterPage />} />
              <Route path="documents/new" element={<CreateJsonPage />} />
              <Route path="compare" element={<CompareJsonPage />} />
              <Route path="api-playground" element={<ApiPlaygroundPage />} />
              <Route path="view/:id" element={<PublicJsonPage />} />
              <Route element={<ProtectedRoute />}>
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="documents/:id" element={<DocumentDetailsPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="admin" element={<AdminDashboardPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
          <ToastViewport />
        </BrowserRouter>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
