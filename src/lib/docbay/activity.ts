import type { LinkPresence } from "./types";

const LIVE_MS = 5 * 60 * 1000;
const HIDE_MS = 48 * 60 * 60 * 1000;
const STEPS_MIN = [5, 15, 30, 60, 120, 240, 360, 720, 1440];
const BLUES = [
  "#93c5fd",
  "#60a5fa",
  "#3b82f6",
  "#2563eb",
  "#1d4ed8",
  "#1e40af",
  "#1e3a8a",
  "#172554",
  "#0f172a",
];

export function presenceTone(p: LinkPresence | null | undefined, now = Date.now()): {
  show: boolean;
  live: boolean;
  color: string;
  opacity: number;
  ageMin: number;
} {
  if (!p?.at) return { show: false, live: false, color: "#000", opacity: 0.5, ageMin: 0 };
  const age = now - new Date(p.at).getTime();
  if (age < 0 || age > HIDE_MS) return { show: false, live: false, color: "#000", opacity: 0.5, ageMin: 0 };
  const live = p.open && age < LIVE_MS;
  if (live) return { show: true, live: true, color: "#22c55e", opacity: 1, ageMin: Math.max(1, Math.round(age / 60000)) };
  if (age > 24 * 60 * 60 * 1000) {
    return { show: true, live: false, color: "#000", opacity: 0.5, ageMin: Math.round(age / 60000) };
  }
  const mins = age / 60000;
  let idx = 0;
  for (let i = 0; i < STEPS_MIN.length; i++) {
    if (mins >= STEPS_MIN[i]) idx = i;
  }
  return { show: true, live: false, color: BLUES[idx] || BLUES[0], opacity: 1, ageMin: Math.max(1, Math.round(mins)) };
}

export function eventLabel(event: string): string {
  const map: Record<string, string> = {
    open: "Geöffnet",
    close: "Tab geschlossen",
    heartbeat: "Aktiv",
    click: "Klick",
    nda: "NDA akzeptiert",
    accept: "Akzeptiert",
    reject: "Abgelehnt",
    sign: "Unterzeichnet",
    call: "Anruf",
    email: "E-Mail",
    chat: "Chat",
  };
  return map[event] || event;
}
