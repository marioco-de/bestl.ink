import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { de, type Messages } from "./messages/de";
import { en } from "./messages/en";
import { it } from "./messages/it";

export type Locale = "de" | "en" | "it";

const PACKS: Record<Locale, Messages> = { de, en, it };
const KEY = "bestl.locale";

function detect(): Locale {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === "de" || stored === "en" || stored === "it") return stored;
  } catch {
    /* ignore */
  }
  if (typeof navigator === "undefined") return "en";
  const lang = navigator.language.toLowerCase();
  if (lang.startsWith("de")) return "de";
  if (lang.startsWith("it")) return "it";
  return "en";
}

type Vars = Record<string, string | number>;

function lookup(tree: unknown, path: string): unknown {
  let cur: unknown = tree;
  for (const part of path.split(".")) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function format(raw: string, vars?: Vars): string {
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k: string) =>
    vars[k] == null ? `{${k}}` : String(vars[k]),
  );
}

export function translate(
  locale: Locale,
  path: string,
  vars?: Vars,
): string {
  const hit = lookup(PACKS[locale], path) ?? lookup(de, path);
  if (typeof hit === "string") return format(hit, vars);
  if (Array.isArray(hit) && typeof hit[0] === "string") return hit[0];
  return path;
}

export function translateList(locale: Locale, path: string): string[] {
  const hit = lookup(PACKS[locale], path) ?? lookup(de, path);
  if (Array.isArray(hit) && hit.every((x) => typeof x === "string")) {
    return hit as string[];
  }
  return [];
}

const Ctx = createContext<{
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (path: string, vars?: Vars) => string;
  list: (path: string) => string[];
} | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() =>
    typeof window === "undefined" ? "de" : detect(),
  );

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {
      /* ignore */
    }
    if (typeof document !== "undefined") document.documentElement.lang = l;
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const t = useCallback(
    (path: string, vars?: Vars) => translate(locale, path, vars),
    [locale],
  );
  const list = useCallback((path: string) => translateList(locale, path), [locale]);

  const value = useMemo(
    () => ({ locale, setLocale, t, list }),
    [locale, setLocale, t, list],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("I18nProvider missing");
  return ctx;
}

export function useT() {
  return useI18n().t;
}
