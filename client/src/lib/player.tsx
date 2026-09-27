/**
 * Текущая учётная запись сотрудника и тема оформления. Токен хранится отдельно,
 * а профиль восстанавливается через /api/auth/me при запуске приложения.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiRequest, getAuthToken, setAuthToken } from "./queryClient";

type Theme = "light" | "dark";
export type AuthUser = { id: number; name: string; role: "conductor" | "supervisor" };
interface AppCtx {
  player: string;
  user: AuthUser | null;
  loadingAuth: boolean;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  theme: Theme;
  toggleTheme: () => void;
}
const Ctx = createContext<AppCtx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [theme, setTheme] = useState<Theme>(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
  );
  const apply = (t: Theme) => {
    document.documentElement.classList.toggle("dark", t === "dark");
    setTheme(t);
  };
  useEffect(() => {
    if (!getAuthToken()) {
      setLoadingAuth(false);
      return;
    }
    apiRequest("GET", "/api/auth/me")
      .then((res) => res.json())
      .then((body) => setUser(body.user as AuthUser))
      .catch(() => setAuthToken(null))
      .finally(() => setLoadingAuth(false));
  }, []);
  const login = (token: string, nextUser: AuthUser) => {
    setAuthToken(token);
    setUser(nextUser);
  };
  const logout = () => {
    setAuthToken(null);
    setUser(null);
  };
  if (typeof document !== "undefined") document.documentElement.classList.toggle("dark", theme === "dark");
  return (
    <Ctx.Provider value={{ player: user?.name ?? "", user, loadingAuth, login, logout, theme, toggleTheme: () => apply(theme === "dark" ? "light" : "dark") }}>
      {children}
    </Ctx.Provider>
  );
}

export const useApp = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("AppProvider missing");
  return c;
};
