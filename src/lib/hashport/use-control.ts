import { getRouteApi } from "@tanstack/react-router";
import type { FullState } from "./types";

const controlRoute = getRouteApi("/control");

export function useControlData(): FullState {
  return controlRoute.useLoaderData();
}
