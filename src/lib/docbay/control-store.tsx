import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { FullState } from "./types";

const Ctx = createContext<{
  data: FullState;
  setData: (s: FullState) => void;
  createOpen: boolean;
  createSeed: string;
  openCreate: (seed?: string) => void;
  closeCreate: () => void;
} | null>(null);

export function ControlProvider({
  initial,
  children,
}: {
  initial: FullState;
  children: ReactNode;
}) {
  const [data, setData] = useState(initial);
  const [createOpen, setCreateOpen] = useState(false);
  const [createSeed, setCreateSeed] = useState("");

  useEffect(() => {
    setData(initial);
  }, [initial]);

  const openCreate = useCallback((seed?: string) => {
    setCreateSeed(seed && seed !== "1" ? seed : "");
    setCreateOpen(true);
  }, []);

  const closeCreate = useCallback(() => {
    setCreateOpen(false);
    setCreateSeed("");
  }, []);

  const value = useMemo(
    () => ({ data, setData, createOpen, createSeed, openCreate, closeCreate }),
    [data, createOpen, createSeed, openCreate, closeCreate],
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
