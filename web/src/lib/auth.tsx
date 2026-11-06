import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@halolesson/shared";
import { api } from "./api";
import { applyAccent, applySecondary } from "./theme";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api<User>("/api/auth/me")
      .then((nextUser) => {
        if (active) setUser(nextUser);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    applyAccent(user.accentColor);
    applySecondary(user.secondaryColor);
  }, [user]);

  async function login(identifier: string, password: string) {
    setUser(await api<User>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier, password }),
    }));
  }

  async function register(username: string, email: string, password: string) {
    setUser(await api<User>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, email: email || null, password }),
    }));
  }

  async function logout() {
    try {
      await api<void>("/api/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
    }
  }

  return <AuthContext.Provider value={{ user, loading, login, register, logout, setUser }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
