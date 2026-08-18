import { DEFAULT_SWATCH, normalizeHex } from "./palette";

export const TAG_COLORS = [
  { id: "slate", hex: "#64748b", label: "Schiefer" },
  { id: "teal", hex: "#0f766e", label: "Petrol" },
  { id: "azure", hex: "#1d4ed8", label: "Blau" },
  { id: "amber", hex: "#b45309", label: "Bernstein" },
  { id: "ruby", hex: "#9f1239", label: "Rubin" },
  { id: "violet", hex: "#7c3aed", label: "Violett" },
  { id: "forest", hex: "#3f6212", label: "Moos" },
] as const;

export const DEFAULT_TAG_COLOR = DEFAULT_SWATCH;

export function normalizeTagColor(raw: string | undefined | null): string {
  const v = (raw || "").trim().toLowerCase();
  const named = TAG_COLORS.find((c) => c.id === v);
  if (named) return named.hex;
  return normalizeHex(raw);
}

export function tagColor(name: string, catalog: { name: string; color: string }[]): string {
  const hit = catalog.find((t) => t.name.toLowerCase() === name.toLowerCase());
  return normalizeTagColor(hit?.color);
}
