import type { CSSProperties } from "react";

export const PALETTE = [
  "#64748b", "#475569", "#0f766e", "#0d9488", "#14b8a6",
  "#1d4ed8", "#2563eb", "#0ea5e9", "#0369a1", "#155e75",
  "#b45309", "#d97706", "#ca8a04", "#65a30d", "#3f6212",
  "#9f1239", "#e11d48", "#be123c", "#c2410c", "#9a3412",
  "#7c3aed", "#6d28d9", "#5b21b6", "#a21caf", "#86198f",
  "#334155", "#1e293b", "#78716c", "#44403c", "#171717",
] as const;

export const DEFAULT_SWATCH = PALETTE[0];

export function normalizeHex(raw: string | undefined | null): string {
  const v = (raw || "").trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(v)) return v;
  if (/^[0-9a-f]{6}$/.test(v)) return `#${v}`;
  return DEFAULT_SWATCH;
}

export const HUE_VARS: Record<string, string> = {
  teal: "var(--color-hue-teal)",
  azure: "var(--color-hue-azure)",
  amber: "var(--color-hue-amber)",
  ruby: "var(--color-hue-ruby)",
  violet: "var(--color-hue-violet)",
  lime: "var(--color-hue-lime)",
};

export function hueStyle(hue: string): CSSProperties {
  return { ["--hue"]: HUE_VARS[hue] || HUE_VARS.teal } as CSSProperties;
}
