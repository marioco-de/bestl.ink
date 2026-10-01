import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getState } from "./api";
import type { FullState } from "./types";
import { cacheWorkspace, readWorkspaceCache, workspaceShell } from "./workspace-cache";
import type { CreateKind } from "./create-kind";

function isTyping(): boolean {
  if (typeof document === "undefined") return false;
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return Boolean(el.isContentEditable);
}

const Ctx = createContext<{
  data: FullState;
  setData: (s: FullState) => void;
  switchWorkspace: (id: string) => void;
  prefetchWorkspace: (id: string) => void;
  hydrating: boolean;
  createOpen: boolean;
  createSeed: string;
  createKind: CreateKind;
  openCreate: (seed?: string, kind?: CreateKind) => void;
  closeCreate: () => void;
  setCreateKind: (k: CreateKind) => void;
} | null>(null);

export function ControlProvider({
  initial,
  children,
}: {
  initial: FullState;
  children: ReactNode;
}) {
  const [data, setDataState] = useState(initial);
  const [hydrating, setHydrating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createSeed, setCreateSeed] = useState("");
  const [createKind, setCreateKind] = useState<CreateKind>("url");
  const tenantRef = useRef(initial.tenant.id);
  const dataRef = useRef(initial);
  const inflight = useRef(new Set<string>());

  const setData = useCallback((s: FullState) => {
    tenantRef.current = s.tenant.id;
    dataRef.current = s;
    cacheWorkspace(s);
    setDataState(s);
  }, []);

  const hydrate = useCallback(async (id: string, background: boolean) => {
    if (inflight.current.has(id)) return;
    inflight.current.add(id);
    if (!background && tenantRef.current === id) setHydrating(true);
    try {
      const fresh = (await getState({ data: { tenant_id: id } })) as FullState;
      cacheWorkspace(fresh);
      if (tenantRef.current === id) {
        if (background && isTyping()) return;
        dataRef.current = fresh;
        setDataState(fresh);
      }
    } catch {
      /* keep cache / shell */
    } finally {
      inflight.current.delete(id);
      if (tenantRef.current === id) setHydrating(false);
    }
  }, []);

  const switchWorkspace = useCallback(
    (id: string) => {
      if (!id || id === tenantRef.current) return;
      cacheWorkspace(dataRef.current);
      const cached = readWorkspaceCache(id);
      const ws = dataRef.current.workspaces.find((w) => w.id === id);
      const next =
        cached ??
        (ws ? workspaceShell(ws, dataRef.current) : null);
      if (!next) {
        void hydrate(id, false);
        return;
      }
      tenantRef.current = id;
      dataRef.current = next;
      setDataState(next);
      void hydrate(id, Boolean(cached));
    },
    [hydrate],
  );

  const prefetchWorkspace = useCallback(
    (id: string) => {
      if (!id || id === tenantRef.current) return;
      if (readWorkspaceCache(id)) return;
      void hydrate(id, true);
    },
    [hydrate],
  );

  useEffect(() => {
    cacheWorkspace(initial);
    if (initial.tenant.id !== tenantRef.current) {
      tenantRef.current = initial.tenant.id;
      dataRef.current = initial;
      setDataState(initial);
    }
  }, [initial]);

  useEffect(() => {
    const others = initial.workspaces
      .map((w) => w.id)
      .filter((id) => id !== initial.tenant.id);
    let i = 0;
    const tick = () => {
      const id = others[i++];
      if (!id) return;
      prefetchWorkspace(id);
      if (i < others.length) window.setTimeout(tick, 400);
    };
    const t = window.setTimeout(tick, 200);
    return () => window.clearTimeout(t);
  }, [initial.workspaces, initial.tenant.id, prefetchWorkspace]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (isTyping()) return;
      const tid = tenantRef.current;
      if (!tid || tid === "platform") return;
      void hydrate(tid, true);
    }, 8000);
    return () => window.clearInterval(id);
  }, [hydrate]);

  const openCreate = useCallback((seed?: string, kind?: CreateKind) => {
    setCreateSeed(seed && seed !== "1" ? seed : "");
    if (kind) setCreateKind(kind);
    setCreateOpen(true);
  }, []);

  const closeCreate = useCallback(() => {
    setCreateOpen(false);
    setCreateSeed("");
  }, []);

  const value = useMemo(
    () => ({
      data,
      setData,
      switchWorkspace,
      prefetchWorkspace,
      hydrating,
      createOpen,
      createSeed,
      createKind,
      openCreate,
      closeCreate,
      setCreateKind,
    }),
    [
      data,
      setData,
      switchWorkspace,
      prefetchWorkspace,
      hydrating,
      createOpen,
      createSeed,
      createKind,
      openCreate,
      closeCreate,
    ],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useControl() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("ControlProvider missing");
  return ctx;
}

export function useOptionalControl() {
  return useContext(Ctx);
}
