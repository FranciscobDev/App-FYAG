import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Role, User } from "@/core/types";
import { USERS } from "@/data/mock";

interface AuthValue {
  user: User | null;
  signInAs: (role: Role) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);
const STORAGE_KEY = "fyag.role";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Role | null;
    return saved && USERS[saved] ? USERS[saved] : null;
  });

  const value = useMemo<AuthValue>(
    () => ({
      user,
      signInAs: (role) => {
        localStorage.setItem(STORAGE_KEY, role);
        setUser(USERS[role]);
      },
      signOut: () => {
        localStorage.removeItem(STORAGE_KEY);
        setUser(null);
      },
    }),
    [user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
