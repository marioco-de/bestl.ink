export const TAG_COLORS = [
  { id: "slate", hex: "#64748b", label: "Schiefer" },
  { id: "teal", hex: "#0f766e", label: "Petrol" },
  { id: "azure", hex: "#1d4ed8", label: "Blau" },
  { id: "amber", hex: "#b45309", label: "Bernstein" },
  { id: "ruby", hex: "#9f1239", label: "Rubin" },
  { id: "violet", hex: "#7c3aed", label: "Violett" },
  { id: "forest", hex: "#3f6212", label: "Moos" },
] as const;

export const DEFAULT_TAG_COLOR = TAG_COLORS[0].hex;

export function normalizeTagColor(raw: string | undefined | null): string {
  const v = (raw || "").trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(v)) return v;
  const named = TAG_COLORS.find((c) => c.id === v);
  return named?.hex ?? DEFAULT_TAG_COLOR;
}

export function tagColor(name: string, catalog: { name: string; color: string }[]): string {
  const hit = catalog.find((t) => t.name.toLowerCase() === name.toLowerCase());
  return normalizeTagColor(hit?.color);
}
