import { parseJsonObj } from "./id";

export type EventPayload = {
  title: string;
  start: string;
  end?: string;
  allDay?: boolean;
  location?: string;
  description?: string;
  url?: string;
  organizer?: string;
  attendees?: string;
  categories?: string;
  priority?: number | null;
  alarmMinutes?: number | null;
  recurrence?: "" | "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  recurrenceCount?: number | null;
  recurrenceUntil?: string;
  status?: "" | "TENTATIVE" | "CONFIRMED" | "CANCELLED";
  transparency?: "" | "OPAQUE" | "TRANSPARENT";
};

export type ContactPayload = {
  name: string;
  title?: string;
  company?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  website?: string;
  address?: string;
  note?: string;
};

export function emptyEvent(): EventPayload {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return {
    title: "",
    start: toLocalInput(start),
    end: toLocalInput(end),
    allDay: false,
    location: "",
    description: "",
    url: "",
    organizer: "",
    attendees: "",
    categories: "",
    priority: null,
    alarmMinutes: 15,
    recurrence: "",
    recurrenceCount: null,
    recurrenceUntil: "",
    status: "CONFIRMED",
    transparency: "OPAQUE",
  };
}

export function emptyContact(): ContactPayload {
  return {
    name: "",
    title: "",
    company: "",
    email: "",
    phone: "",
    mobile: "",
    website: "",
    address: "",
    note: "",
  };
}

export function parseEventPayload(raw: unknown): EventPayload {
  const o = parseJsonObj(raw);
  const base = emptyEvent();
  return {
    ...base,
    title: String(o.title ?? base.title),
    start: String(o.start ?? base.start),
    end: o.end ? String(o.end) : "",
    allDay: Boolean(o.allDay),
    location: String(o.location ?? ""),
    description: String(o.description ?? ""),
    url: String(o.url ?? ""),
    organizer: String(o.organizer ?? ""),
    attendees: String(o.attendees ?? ""),
    categories: String(o.categories ?? ""),
    priority:
      o.priority == null || o.priority === "" ? null : Number(o.priority),
    alarmMinutes:
      o.alarmMinutes == null || o.alarmMinutes === ""
        ? null
        : Number(o.alarmMinutes),
    recurrence: (String(o.recurrence ?? "") || "") as EventPayload["recurrence"],
    recurrenceCount:
      o.recurrenceCount == null || o.recurrenceCount === ""
        ? null
        : Number(o.recurrenceCount),
    recurrenceUntil: String(o.recurrenceUntil ?? ""),
    status: (String(o.status ?? "CONFIRMED") || "") as EventPayload["status"],
    transparency: (String(o.transparency ?? "OPAQUE") ||
      "") as EventPayload["transparency"],
  };
}

export function parseContactPayload(raw: unknown): ContactPayload {
  const o = parseJsonObj(raw);
  return {
    name: String(o.name ?? ""),
    title: String(o.title ?? ""),
    company: String(o.company ?? ""),
    email: String(o.email ?? ""),
    phone: String(o.phone ?? ""),
    mobile: String(o.mobile ?? ""),
    website: String(o.website ?? ""),
    address: String(o.address ?? ""),
    note: String(o.note ?? ""),
  };
}

export function cardDownloadPath(resourceId: string, token: string): string {
  return `/api/cards/${encodeURIComponent(resourceId)}?access=${encodeURIComponent(token)}`;
}

export function formatEventWhen(event: EventPayload): string {
  if (!event.start) return "";
  const start = new Date(event.start);
  if (Number.isNaN(start.getTime())) return event.start;
  if (event.allDay) {
    return `${fmtDay(start)} · ganztägig`;
  }
  const head = new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(start);
  if (event.end) {
    const end = new Date(event.end);
    if (!Number.isNaN(end.getTime())) {
      return `${head} – ${new Intl.DateTimeFormat("de-DE", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(end)}`;
    }
  }
  return head;
}

export function eventDayParts(input: string): {
  month: string;
  day: string;
  weekday: string;
} {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) {
    return { month: "—", day: "–", weekday: "" };
  }
  return {
    month: new Intl.DateTimeFormat("de-DE", { month: "short" })
      .format(d)
      .replace(".", "")
      .toUpperCase(),
    day: String(d.getDate()),
    weekday: new Intl.DateTimeFormat("de-DE", { weekday: "long" }).format(d),
  };
}

export function contactInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

export function buildIcs(event: EventPayload, uid: string): string {
  const title = event.title.trim() || "Termin";
  const now = formatUtcStamp(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//bestl.ink//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcs(title)}`,
    "BEGIN:VEVENT",
    `UID:${uid}@bestl.ink`,
    `DTSTAMP:${now}`,
  ];

  if (event.allDay) {
    const start = dateOnly(event.start);
    const end = dateOnly(event.end || event.start);
    const endNext = addDays(end, 1);
    lines.push(`DTSTART;VALUE=DATE:${start}`, `DTEND;VALUE=DATE:${endNext}`);
  } else {
    lines.push(
      `DTSTART:${formatLocalStamp(event.start)}`,
      `DTEND:${formatLocalStamp(event.end || addHours(event.start, 1))}`,
    );
  }

  lines.push(`SUMMARY:${escapeIcs(title)}`);
  if (event.description?.trim())
    lines.push(`DESCRIPTION:${escapeIcs(event.description.trim())}`);
  if (event.location?.trim())
    lines.push(`LOCATION:${escapeIcs(event.location.trim())}`);
  if (event.url?.trim()) lines.push(`URL:${escapeIcs(event.url.trim())}`);
  const org = mailtoLine("ORGANIZER", event.organizer || "");
  if (org) lines.push(org);
  for (const raw of (event.attendees || "").split(/[,;\n]+/)) {
    const att = mailtoLine("ATTENDEE", raw);
    if (att) lines.push(att);
  }
  const cats = (event.categories || "")
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (cats.length) lines.push(`CATEGORIES:${cats.map(escapeIcs).join(",")}`);
  if (event.priority != null && event.priority >= 1 && event.priority <= 9) {
    lines.push(`PRIORITY:${Math.round(event.priority)}`);
  }
  if (event.status) lines.push(`STATUS:${event.status}`);
  if (event.transparency) lines.push(`TRANSP:${event.transparency}`);
  if (event.recurrence) {
    let rrule = `FREQ=${event.recurrence}`;
    if (event.recurrenceCount && event.recurrenceCount > 0)
      rrule += `;COUNT=${Math.min(999, event.recurrenceCount)}`;
    else if (event.recurrenceUntil)
      rrule += `;UNTIL=${dateOnly(event.recurrenceUntil)}T235959Z`;
    lines.push(`RRULE:${rrule}`);
  }
  if (event.alarmMinutes != null && event.alarmMinutes >= 0) {
    lines.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeIcs(title)}`,
      `TRIGGER:-PT${Math.round(event.alarmMinutes)}M`,
      "END:VALARM",
    );
  }
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.map(foldIcs).join("\r\n") + "\r\n";
}

export function buildVcf(contact: ContactPayload, uid?: string): string {
  const name = contact.name.trim() || "Kontakt";
  const parts = name.split(/\s+/);
  const last = parts.length > 1 ? parts[parts.length - 1]! : name;
  const first = parts.length > 1 ? parts.slice(0, -1).join(" ") : "";
  const now = formatUtcStamp(new Date());
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `UID:${(uid || "card").replace(/[^a-zA-Z0-9_-]/g, "")}@bestl.ink`,
    `FN:${escapeVcf(name)}`,
    `N:${escapeVcf(last)};${escapeVcf(first)};;;`,
  ];
  if (contact.company?.trim()) lines.push(`ORG:${escapeVcf(contact.company)}`);
  if (contact.title?.trim()) lines.push(`TITLE:${escapeVcf(contact.title)}`);
  if (contact.phone?.trim())
    lines.push(`TEL;TYPE=WORK,VOICE:${escapeVcf(contact.phone)}`);
  if (contact.mobile?.trim())
    lines.push(`TEL;TYPE=CELL:${escapeVcf(contact.mobile)}`);
  if (contact.email?.trim())
    lines.push(`EMAIL;TYPE=INTERNET,WORK:${escapeVcf(contact.email)}`);
  if (contact.website?.trim()) {
    const url = contact.website.startsWith("http")
      ? contact.website
      : `https://${contact.website}`;
    lines.push(`URL:${escapeVcf(url)}`);
  }
  if (contact.address?.trim())
    lines.push(`ADR;TYPE=WORK:;;${escapeVcf(contact.address)};;;;`);
  if (contact.note?.trim()) lines.push(`NOTE:${escapeVcf(contact.note)}`);
  lines.push(`REV:${now}`, "END:VCARD");
  return lines.join("\r\n") + "\r\n";
}

function mailtoLine(prefix: string, raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const angled = s.match(/^(.*)<([^>]+)>$/);
  const mail = (angled ? angled[2] : s).trim();
  const cn = (angled ? angled[1] : s).trim().replace(/^["']|["']$/g, "");
  if (!mail.includes("@")) return null;
  return `${prefix};CN=${escapeIcs(cn || mail)}:mailto:${mail}`;
}

function fmtDay(d: Date): string {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatLocalStamp(input: string): string {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return formatUtcStamp(new Date());
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

function formatUtcStamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function dateOnly(input: string): string {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) {
    return input.replace(/-/g, "").slice(0, 8);
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

function addHours(input: string, hours: number): string {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return input;
  d.setHours(d.getHours() + hours);
  return toLocalInput(d);
}

function addDays(yyyymmdd: string, days: number): string {
  const y = Number(yyyymmdd.slice(0, 4));
  const m = Number(yyyymmdd.slice(4, 6)) - 1;
  const d = Number(yyyymmdd.slice(6, 8));
  const dt = new Date(y, m, d + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}`;
}

function escapeIcs(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function escapeVcf(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function foldIcs(line: string): string {
  if (line.length <= 75) return line;
  let out = line.slice(0, 75);
  let rest = line.slice(75);
  while (rest.length) {
    out += "\r\n " + rest.slice(0, 74);
    rest = rest.slice(74);
  }
  return out;
}
