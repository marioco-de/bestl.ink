import {
  CalendarDays,
  Contact,
  FileText,
  Globe,
  Link2,
  type LucideIcon,
} from "lucide-react";

export type CreateKind = "url" | "document" | "page" | "event" | "contact";

export const CREATE_KINDS: {
  id: CreateKind;
  labelKey: string;
  hue: string;
  icon: LucideIcon;
}[] = [
  { id: "url", labelKey: "create.url", hue: "azure", icon: Link2 },
  { id: "document", labelKey: "create.doc", hue: "violet", icon: FileText },
  { id: "page", labelKey: "create.page", hue: "lime", icon: Globe },
  { id: "event", labelKey: "create.event", hue: "amber", icon: CalendarDays },
  { id: "contact", labelKey: "create.contact", hue: "ruby", icon: Contact },
];

export function kindFromRoute(pathname: string, tab?: string): CreateKind {
  if (!pathname.startsWith("/control/links")) return "url";
  if (tab === "docs") return "document";
  if (tab === "pages") return "page";
  if (tab === "events") return "event";
  if (tab === "contacts") return "contact";
  return "url";
}

export function kindMeta(kind: CreateKind) {
  return CREATE_KINDS.find((k) => k.id === kind) || CREATE_KINDS[0];
}