import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { AuthProvider } from "$lib/auth";
import AppLayout from "./components/AppLayout";
import AuthPage from "./routes/AuthPage";
import PracticePage from "./routes/PracticePage";
import SubjectPage from "./routes/SubjectPage";
import SubjectsPage from "./routes/SubjectsPage";
import "./app.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<AuthPage />} />
          <Route path="/register" element={<AuthPage />} />
          <Route element={<AppLayout />}>
            <Route index element={<SubjectsPage />} />
            <Route path="/subjects/:subjectId" element={<SubjectPage />} />
            <Route path="/skills/:skillId/practice" element={<PracticePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
