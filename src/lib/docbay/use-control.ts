import { getRouteApi } from "@tanstack/react-router";
import type { FullState } from "./types";
import { useOptionalControl } from "./control-store";

const controlRoute = getRouteApi("/control");

export function useControlData(): FullState {
  const ctx = useOptionalControl();
  const loader = controlRoute.useLoaderData() as FullState;
  return ctx?.data ?? loader;
}

export function useSetControlData() {
  const ctx = useOptionalControl();
  return ctx?.setData;
}

export function useOpenCreate() {
  const ctx = useOptionalControl();
  return ctx?.openCreate ?? (() => undefined);
}
