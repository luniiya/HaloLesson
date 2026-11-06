import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { AuthProvider } from "$lib/auth";
import { applyAccent, applySecondary, cachedAccent, cachedSecondary, initTheme } from "$lib/theme";
import AppLayout from "./components/AppLayout";
import AuthPage from "./routes/AuthPage";
import PracticePage from "./routes/PracticePage";
import SharedPage from "./routes/SharedPage";
import ShelfPage from "./routes/ShelfPage";
import SubjectPage from "./routes/SubjectPage";
import SubjectsPage from "./routes/SubjectsPage";
import AccountSettings from "./routes/settings/AccountSettings";
import AppearanceSettings from "./routes/settings/AppearanceSettings";
import AdminServer from "./routes/settings/AdminServer";
import AdminUsers from "./routes/settings/AdminUsers";
import DataSettings from "./routes/settings/DataSettings";
import SessionsSettings from "./routes/settings/SessionsSettings";
import SettingsLayout from "./routes/settings/SettingsLayout";
import "./app.css";

applyAccent(cachedAccent());
applySecondary(cachedSecondary());
initTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<AuthPage />} />
          <Route path="/register" element={<AuthPage />} />
          <Route path="/setup" element={<AuthPage />} />
          <Route element={<AppLayout />}>
            <Route index element={<SubjectsPage />} />
            <Route path="/archive" element={<ShelfPage key="archive" view="archived" />} />
            <Route path="/trash" element={<ShelfPage key="trash" view="trashed" />} />
            <Route path="/subjects/:subjectId" element={<SubjectPage />} />
            <Route path="/shared/:token" element={<SharedPage />} />
            <Route path="/skills/:skillId/practice" element={<PracticePage />} />
            <Route path="/settings" element={<SettingsLayout />}>
              <Route index element={<AccountSettings />} />
              <Route path="appearance" element={<AppearanceSettings />} />
              <Route path="sessions" element={<SessionsSettings />} />
              <Route path="data" element={<DataSettings />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="server" element={<AdminServer />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
