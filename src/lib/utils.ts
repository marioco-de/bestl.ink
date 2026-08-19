import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function toDatetimeLocal(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromDatetimeLocal(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function formatDateDe(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function lastClickedRel(iso: string): {
  key:
    | "lastToday"
    | "lastYesterday"
    | "lastTwoDays"
    | "lastWeek"
    | "lastWeeks"
    | "lastMonth"
    | "lastMonths"
    | "lastYear"
    | "lastYears";
  n: number;
  time: string;
} {
  const then = new Date(iso);
  const now = new Date();
  const time = `${then.getHours()}:${String(then.getMinutes()).padStart(2, "0")}`;
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.max(0, Math.round((start(now) - start(then)) / 86400000));
  if (days <= 0) return { key: "lastToday", n: 0, time };
  if (days === 1) return { key: "lastYesterday", n: 1, time };
  if (days === 2) return { key: "lastTwoDays", n: 2, time };
  if (days < 365) {
    const months = Math.max(1, Math.round(days / 30));
    if (months >= 12) return { key: "lastYear", n: 1, time };
    if (months >= 2) return { key: "lastMonths", n: months, time };
    if (months === 1 && days >= 25) return { key: "lastMonth", n: 1, time };
    const weeks = Math.max(1, Math.round(days / 7));
    if (weeks >= 2) return { key: "lastWeeks", n: weeks, time };
    return { key: "lastWeek", n: 1, time };
  }
  const years = Math.max(1, Math.round(days / 365));
  if (years === 1) return { key: "lastYear", n: 1, time };
  return { key: "lastYears", n: years, time };
}

export function formatBytes(n: number | null | undefined): string {
  if (!n || n <= 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
