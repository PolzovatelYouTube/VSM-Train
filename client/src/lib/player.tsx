/**
 * Имя текущего сотрудника (игрока). Хранится только в React-состоянии:
 * localStorage недоступен в песочнице iframe, а на хакатоне сюда встанет настоящая авторизация.
 */
import { createContext, useContext, useState, type ReactNode } from "react";

type Theme = "light" | "dark";
interface AppCtx {
  player: string;
  setPlayer: (n: string) => void;
  theme: Theme;
  toggleTheme: () => void;
}
const Ctx = createContext<AppCtx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [player, setPlayer] = useState("Проводник-1");
  const [theme, setTheme] = useState<Theme>(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
  );
  const apply = (t: Theme) => {
    document.documentElement.classList.toggle("dark", t === "dark");
    setTheme(t);
  };
  if (typeof document !== "undefined") document.documentElement.classList.toggle("dark", theme === "dark");
  return (
    <Ctx.Provider value={{ player, setPlayer, theme, toggleTheme: () => apply(theme === "dark" ? "light" : "dark") }}>
      {children}
    </Ctx.Provider>
  );
}

export const useApp = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("AppProvider missing");
  return c;
};
