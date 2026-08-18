import type { FullState, ShortLink, WorkspaceSummary } from "./types";

export function upsertShort(state: FullState, short: ShortLink): FullState {
  const i = state.shorts.findIndex((s) => s.id === short.id);
  const shorts =
    i >= 0
      ? state.shorts.map((s) => (s.id === short.id ? short : s))
      : [short, ...state.shorts];
  return {
    ...state,
    shorts,
    stats: { ...state.stats, shorts: shorts.length },
  };
}

export function removeShort(state: FullState, id: string): FullState {
  const shorts = state.shorts.filter((s) => s.id !== id);
  return {
    ...state,
    shorts,
    stats: { ...state.stats, shorts: shorts.length },
  };
}

export function withWorkspace(
  state: FullState,
  ws: WorkspaceSummary,
): FullState {
  if (state.workspaces.some((w) => w.id === ws.id)) return state;
  return { ...state, workspaces: [...state.workspaces, ws] };
}
