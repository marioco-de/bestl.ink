import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemePref = "system" | "light" | "dark";

const KEY = "ltis-theme";

function resolve(pref: ThemePref): "light" | "dark" {
  if (pref === "light" || pref === "dark") return pref;
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

function apply(pref: ThemePref) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = resolve(pref);
}

const ThemeCtx = createContext<{
  pref: ThemePref;
  resolved: "light" | "dark";
  setPref: (p: ThemePref) => void;
  cycle: () => void;
} | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(() => {
    if (typeof localStorage === "undefined") return "system";
    const s = localStorage.getItem(KEY);
    return s === "light" || s === "dark" || s === "system" ? s : "system";
  });
  const [resolved, setResolved] = useState<"light" | "dark">(() => resolve(pref));

  const setPref = useCallback((p: ThemePref) => {
    setPrefState(p);
    localStorage.setItem(KEY, p);
    apply(p);
    setResolved(resolve(p));
  }, []);

  useEffect(() => {
    apply(pref);
    setResolved(resolve(pref));
    if (pref !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const on = () => {
      apply("system");
      setResolved(resolve("system"));
    };
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [pref]);

  const cycle = useCallback(() => {
    setPref(pref === "system" ? "light" : pref === "light" ? "dark" : "system");
  }, [pref, setPref]);

  const value = useMemo(
    () => ({ pref, resolved, setPref, cycle }),
    [pref, resolved, setPref, cycle],
  );

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) {
    return {
      pref: "system" as ThemePref,
      resolved: "dark" as const,
      setPref: () => undefined,
      cycle: () => undefined,
    };
  }
  return ctx;
}

export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem('${KEY}')||'system';var r=t==='light'||t==='dark'?t:(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');document.documentElement.dataset.theme=r;}catch(e){}})();`;
