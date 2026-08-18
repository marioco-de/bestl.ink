import { useEffect, useState } from "react";
import {
  CalendarDays,
  Contact,
  Pencil,
  Plus,
  Trash2,
  Link2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { HueButton } from "@/components/ui/hue-button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { FullScreenModal } from "@/components/ui/fullscreen-modal";
import { GeneratePanel } from "@/components/hashport/generate-panel";
import { useControlData, useSetControlData } from "@/lib/docbay/use-control";
import { createResource, deleteResource, updateResource, createTag } from "@/lib/docbay/api";
import { slugify, formatDateDe } from "@/lib/utils";
import type { FullState, Resource, JsonObject } from "@/lib/docbay/types";
import { TagChip, TagPicker } from "@/components/control/tag-picker";
import { tagColor } from "@/lib/docbay/tags";
import { RowMenu, VisitMeta } from "@/components/control/row-menu";
import { PresenceEye } from "@/components/control/presence-eye";
import { useT } from "@/lib/i18n";
import {
  contactInitials,
  emptyContact,
  emptyEvent,
  eventDayParts,
  formatEventWhen,
  parseContactPayload,
  parseEventPayload,
  type ContactPayload,
  type EventPayload,
} from "@/lib/docbay/cards";

const selectClass =
  "flex h-11 w-full rounded-md border border-border bg-bg-elevated px-3 text-sm";

export function CardsWorkspace({ kind }: { kind: "event" | "contact" }) {
  const data = useControlData();
  const setGlobal = useSetControlData();
  const [state, setState] = useState<FullState>(data);
  const [editing, setEditing] = useState<Resource | null | "new">(null);
  const [generateFor, setGenerateFor] = useState<Resource | null>(null);
  const t = useT();

  useEffect(() => setState(data), [data]);

  async function refresh(s: FullState) {
    setState(s);
    setGlobal?.(s);
  }

  const items = state.resources.filter((r) => r.type === kind);
  const label = kind === "event" ? "Termin" : "Kontakt";
  const ext = kind === "event" ? ".ics" : ".vcf";

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <p className="text-sm text-fg-muted">
          {kind === "event"
            ? "Termin anlegen, Link teilen. Der Empfänger bekommt eine Kalenderdatei."
            : "Visitenkarte hinterlegen. Der Link liefert eine vCard ins Adressbuch."}
        </p>
        <HueButton hue={kind === "event" ? "amber" : "ruby"} size="sm" className="shrink-0" onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4" /> {label}
        </HueButton>
      </div>

      {editing !== null && (
        <CardForm
          kind={kind}
          tenantId={state.tenant.id}
          existing={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async (s) => {
            await refresh(s);
            setEditing(null);
            toast.success(editing === "new" ? `${label} angelegt` : "Gespeichert");
          }}
        />
      )}

      <div className="space-y-3">
        {items.map((r) => {
          const event = kind === "event" ? parseEventPayload(r.payload) : null;
          const contact = kind === "contact" ? parseContactPayload(r.payload) : null;
          const extra = event
            ? [formatEventWhen(event), event.location].filter(Boolean).join(" · ")
            : [contact?.title, contact?.company, contact?.email]
                .filter(Boolean)
                .join(" · ");
          return (
            <Card key={r.id}>
              <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => setEditing(r)}
                  className="flex min-w-0 items-start gap-3 text-left"
                >
                  {kind === "event" && event ? (
                    <DayBadge start={event.start} />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-hue-ruby/12 font-display text-sm font-semibold text-hue-ruby">
                      {contactInitials(r.title)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <PresenceEye
                        presence={
                          state.links
                            .filter((l) => l.resource_id === r.id && l.presence)
                            .sort((a, b) =>
                              (b.presence?.at || "").localeCompare(a.presence?.at || ""),
                            )[0]?.presence || null
                        }
                      />
                      <p className="font-medium">{r.title}</p>
                      <Badge variant="secondary">{label}</Badge>
                    </div>
                    <p className="mt-0.5 font-mono text-xs text-fg-subtle">/{r.slug}</p>
                    {extra && (
                      <p className="mt-1 truncate text-xs text-fg-muted">{extra}</p>
                    )}
                    {(r.tags?.length ?? 0) > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {r.tags.map((n) => (
                          <TagChip key={n} name={n} color={tagColor(n, state.tags)} on />
                        ))}
                      </div>
                    )}
                  </div>
                </button>
                <div className="flex shrink-0 items-center gap-3">
                  <VisitMeta
                    clicks={state.links
                      .filter((l) => l.resource_id === r.id && !l.revoked)
                      .reduce((a, l) => a + l.human_click_count, 0)}
                    at={(() => {
                      const last = state.links
                        .filter((l) => l.resource_id === r.id && l.last_clicked_at)
                        .map((l) => l.last_clicked_at as string)
                        .sort()
                        .at(-1);
                      return last ? formatDateDe(last) : null;
                    })()}
                    lastLabel={t("links.lastVisit")}
                  />
                  <div className="flex items-center gap-1">
                    <Button size="sm" onClick={() => setGenerateFor(r)}>
                      <Link2 className="h-4 w-4" />
                    </Button>
                    <RowMenu
                      items={[
                        { label: t("links.edit"), icon: Pencil, onClick: () => setEditing(r) },
                        {
                          label: t("links.delete"),
                          icon: Trash2,
                          danger: true,
                          onClick: () => {
                            if (!confirm(`${label} löschen?`)) return;
                            void deleteResource({ data: { id: r.id } }).then((s) => {
                              void refresh(s as FullState);
                              toast.success("Gelöscht");
                            });
                          },
                        },
                      ]}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {items.length === 0 && (
          <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
            {kind === "event" ? (
              <CalendarDays className="mx-auto h-8 w-8 text-hue-amber" />
            ) : (
              <Contact className="mx-auto h-8 w-8 text-hue-ruby" />
            )}
            <p className="mt-3 font-medium">Noch kein {label}</p>
            <p className="mt-1 text-sm text-fg-muted">
              Anlegen, Link teilen – der Empfänger lädt eine {ext}-Datei.
            </p>
            <Button className="mt-4" onClick={() => setEditing("new")}>
              <Plus className="h-4 w-4" /> {label} anlegen
            </Button>
          </div>
        )}
      </div>

      {generateFor && (
        <GeneratePanel
          resource={generateFor}
          state={state}
          onClose={() => setGenerateFor(null)}
          onUpdated={(s) => void refresh(s)}
        />
      )}
    </div>
  );
}

function DayBadge({ start }: { start: string }) {
  const p = eventDayParts(start);
  return (
    <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-md bg-hue-amber/14 text-hue-amber">
      <span className="text-[9px] font-semibold tracking-wider">{p.month}</span>
      <span className="font-display text-lg leading-none font-semibold">{p.day}</span>
    </div>
  );
}

function CardForm({
  kind,
  tenantId,
  existing,
  onClose,
  onSaved,
}: {
  kind: "event" | "contact";
  tenantId: string;
  existing: Resource | null;
  onClose: () => void;
  onSaved: (s: FullState) => void;
}) {
  const [slug, setSlug] = useState(existing?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(existing));
  const [event, setEvent] = useState<EventPayload>(() =>
    existing && kind === "event" ? parseEventPayload(existing.payload) : emptyEvent(),
  );
  const [contact, setContact] = useState<ContactPayload>(() =>
    existing && kind === "contact"
      ? parseContactPayload(existing.payload)
      : emptyContact(),
  );
  const [busy, setBusy] = useState(false);
  const [tags, setTags] = useState<string[]>(existing?.tags ?? []);
  const catalog = useControlData().tags;
  const ext = kind === "event" ? ".ics" : ".vcf";

  function syncSlug(name: string) {
    if (slugTouched) return;
    setSlug(`${slugify(name) || (kind === "event" ? "termin" : "kontakt")}${ext}`);
  }

  async function save() {
    const name =
      (kind === "event" ? event.title : contact.name).trim();
    if (!name) {
      toast.error(kind === "event" ? "Titel fehlt" : "Name fehlt");
      return;
    }
    if (kind === "event" && !event.start) {
      toast.error("Startdatum fehlt");
      return;
    }
    setBusy(true);
    try {
      const payload = (
        kind === "event" ? { ...event, title: name } : { ...contact, name }
      ) as JsonObject;
      const body = {
        title: name,
        slug: (slug || slugify(name) + ext).replace(/^\//, ""),
        description:
          kind === "event" ? event.location || "" : contact.company || "",
        payload,
        file_name: slug || `${slugify(name)}${ext}`,
        tags,
      };
      const s = existing
        ? await updateResource({ data: { id: existing.id, ...body } })
        : await createResource({
            data: {
              type: kind,
              ...body,
              mime_type: kind === "event" ? "text/calendar" : "text/vcard",
              allow_download: true,
              tenant_id: tenantId !== "platform" ? tenantId : undefined,
            },
          });
      onSaved(s as FullState);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  return (
    <FullScreenModal
      title={
        existing
          ? kind === "event"
            ? "Termin bearbeiten"
            : "Kontakt bearbeiten"
          : kind === "event"
            ? "Neuer Termin"
            : "Neuer Kontakt"
      }
      description={
        kind === "event"
          ? "Der geteilte Link liefert eine .ics-Datei."
          : "Der geteilte Link liefert eine .vcf-Datei."
      }
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="ghost" className="min-h-11" onClick={onClose}>
            Abbrechen
          </Button>
          <Button className="min-h-11" disabled={busy} onClick={() => void save()}>
            {busy ? "…" : "Speichern"}
          </Button>
        </>
      }
    >
      {kind === "event" ? (
        <>
          <EventPreview event={event} />
          <EventFields
            event={event}
            setEvent={(next) => {
              setEvent(next);
              if (next.title) syncSlug(next.title);
            }}
          />
        </>
      ) : (
        <>
          <ContactPreview contact={contact} />
          <ContactFields
            contact={contact}
            setContact={(next) => {
              setContact(next);
              if (next.name) syncSlug(next.name);
            }}
          />
        </>
      )}
      <div>
        <Label>Pfad</Label>
        <Input
          className="font-mono"
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value);
          }}
        />
        <p className="mt-1 text-xs text-fg-subtle">
          Öffentlicher Pfad: /{slug || `name${ext}`}
        </p>
      </div>
      <div>
        <Label>Tags</Label>
        <TagPicker
          catalog={catalog}
          value={tags}
          onChange={setTags}
          onCreate={async (name, color) => {
            await createTag({ data: { name, color, tenant_id: tenantId } });
          }}
        />
      </div>
    </FullScreenModal>
  );
}

function EventPreview({ event }: { event: EventPayload }) {
  const p = eventDayParts(event.start);
  return (
    <div className="flex gap-3 rounded-lg border border-border bg-bg-subtle/50 p-3">
      <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-md bg-hue-amber/14 text-hue-amber">
        <span className="text-[10px] font-semibold tracking-wider">{p.month}</span>
        <span className="font-display text-xl leading-none font-semibold">{p.day}</span>
      </div>
      <div className="min-w-0">
        <p className="truncate font-medium">{event.title.trim() || "Ohne Titel"}</p>
        <p className="mt-0.5 text-xs text-fg-muted">{formatEventWhen(event) || p.weekday}</p>
        {event.location?.trim() && (
          <p className="mt-0.5 truncate text-xs text-fg-subtle">{event.location}</p>
        )}
      </div>
    </div>
  );
}

function ContactPreview({ contact }: { contact: ContactPayload }) {
  return (
    <div className="flex gap-3 rounded-lg border border-border bg-bg-subtle/50 p-3">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-hue-ruby/12 font-display text-lg font-semibold text-hue-ruby">
        {contactInitials(contact.name)}
      </div>
      <div className="min-w-0">
        <p className="truncate font-medium">{contact.name.trim() || "Ohne Namen"}</p>
        {(contact.title || contact.company) && (
          <p className="mt-0.5 truncate text-xs text-fg-muted">
            {[contact.title, contact.company].filter(Boolean).join(" · ")}
          </p>
        )}
        {contact.email && (
          <p className="mt-0.5 truncate text-xs text-fg-subtle">{contact.email}</p>
        )}
      </div>
    </div>
  );
}

function EventFields({
  event,
  setEvent,
}: {
  event: EventPayload;
  setEvent: (e: EventPayload) => void;
}) {
  const [advanced, setAdvanced] = useState(false);
  function set<K extends keyof EventPayload>(key: K, value: EventPayload[K]) {
    setEvent({ ...event, [key]: value });
  }
  return (
    <>
      <div>
        <Label htmlFor="ev-title">Titel *</Label>
        <Input
          id="ev-title"
          value={event.title}
          onChange={(e) => set("title", e.target.value)}
          maxLength={255}
          required
        />
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={Boolean(event.allDay)}
          onChange={(e) => set("allDay", e.target.checked)}
        />
        Ganztägig
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="ev-start">Start *</Label>
          <Input
            id="ev-start"
            type={event.allDay ? "date" : "datetime-local"}
            value={event.allDay ? event.start.slice(0, 10) : event.start}
            onChange={(e) => set("start", e.target.value)}
            required
          />
        </div>
        <div>
          <Label>Ende</Label>
          <Input
            type={event.allDay ? "date" : "datetime-local"}
            value={event.end ? (event.allDay ? event.end.slice(0, 10) : event.end) : ""}
            onChange={(e) => set("end", e.target.value)}
          />
        </div>
      </div>
      <div>
        <Label htmlFor="ev-location">Ort</Label>
        <Input
          id="ev-location"
          value={event.location}
          onChange={(e) => set("location", e.target.value)}
          maxLength={255}
        />
      </div>
      <div>
        <Label>Beschreibung</Label>
        <Textarea
          value={event.description}
          onChange={(e) => set("description", e.target.value)}
          maxLength={2000}
        />
      </div>
      <div>
        <Label>URL</Label>
        <Input
          type="url"
          value={event.url}
          onChange={(e) => set("url", e.target.value)}
          placeholder="https://"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Erinnerung (Min.)</Label>
          <Input
            type="number"
            min={0}
            max={9999}
            value={event.alarmMinutes ?? ""}
            onChange={(e) =>
              set("alarmMinutes", e.target.value === "" ? null : Number(e.target.value))
            }
          />
        </div>
        <div>
          <Label>Wiederholung</Label>
          <select
            className={selectClass}
            value={event.recurrence || ""}
            onChange={(e) =>
              set("recurrence", e.target.value as EventPayload["recurrence"])
            }
          >
            <option value="">Keine</option>
            <option value="DAILY">Täglich</option>
            <option value="WEEKLY">Wöchentlich</option>
            <option value="MONTHLY">Monatlich</option>
            <option value="YEARLY">Jährlich</option>
          </select>
        </div>
      </div>
      {event.recurrence ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Anzahl</Label>
            <Input
              type="number"
              min={1}
              max={999}
              value={event.recurrenceCount ?? ""}
              onChange={(e) =>
                set(
                  "recurrenceCount",
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
            />
          </div>
          <div>
            <Label>Bis</Label>
            <Input
              type="date"
              value={event.recurrenceUntil || ""}
              onChange={(e) => set("recurrenceUntil", e.target.value)}
            />
          </div>
        </div>
      ) : null}
      <button
        type="button"
        className="text-sm text-fg-muted underline-offset-2 hover:text-fg hover:underline"
        onClick={() => setAdvanced((v) => !v)}
      >
        {advanced ? "Weniger Felder" : "Weitere Felder"}
      </button>
      {advanced && (
        <div className="space-y-4 rounded-lg border border-border p-3">
          <div>
            <Label>Organisator (E-Mail)</Label>
            <Input
              type="email"
              value={event.organizer}
              onChange={(e) => set("organizer", e.target.value)}
            />
          </div>
          <div>
            <Label>Teilnehmer (E-Mails, getrennt)</Label>
            <Textarea
              value={event.attendees}
              onChange={(e) => set("attendees", e.target.value)}
            />
          </div>
          <div>
            <Label>Kategorien</Label>
            <Input
              value={event.categories}
              onChange={(e) => set("categories", e.target.value)}
              placeholder="Meeting, Intern"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Status</Label>
              <select
                className={selectClass}
                value={event.status || ""}
                onChange={(e) => set("status", e.target.value as EventPayload["status"])}
              >
                <option value="CONFIRMED">Bestätigt</option>
                <option value="TENTATIVE">Vorläufig</option>
                <option value="CANCELLED">Abgesagt</option>
              </select>
            </div>
            <div>
              <Label>Verfügbarkeit</Label>
              <select
                className={selectClass}
                value={event.transparency || ""}
                onChange={(e) =>
                  set("transparency", e.target.value as EventPayload["transparency"])
                }
              >
                <option value="OPAQUE">Beschäftigt</option>
                <option value="TRANSPARENT">Frei</option>
              </select>
            </div>
            <div>
              <Label>Priorität</Label>
              <select
                className={selectClass}
                value={event.priority ?? ""}
                onChange={(e) =>
                  set("priority", e.target.value === "" ? null : Number(e.target.value))
                }
              >
                <option value="">Keine</option>
                <option value="1">1 · Hoch</option>
                <option value="5">5 · Normal</option>
                <option value="9">9 · Niedrig</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ContactFields({
  contact,
  setContact,
}: {
  contact: ContactPayload;
  setContact: (c: ContactPayload) => void;
}) {
  function set<K extends keyof ContactPayload>(key: K, value: ContactPayload[K]) {
    setContact({ ...contact, [key]: value });
  }
  return (
    <>
      <div>
        <Label htmlFor="ct-name">Name *</Label>
        <Input id="ct-name" value={contact.name} onChange={(e) => set("name", e.target.value)} required />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="ct-title">Position</Label>
          <Input id="ct-title" value={contact.title} onChange={(e) => set("title", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="ct-company">Firma</Label>
          <Input id="ct-company" value={contact.company} onChange={(e) => set("company", e.target.value)} />
        </div>
      </div>
      <div>
        <Label htmlFor="ct-email">E-Mail</Label>
        <Input
          id="ct-email"
          type="email"
          value={contact.email}
          onChange={(e) => set("email", e.target.value)}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Telefon</Label>
          <Input value={contact.phone} onChange={(e) => set("phone", e.target.value)} />
        </div>
        <div>
          <Label>Mobil</Label>
          <Input value={contact.mobile} onChange={(e) => set("mobile", e.target.value)} />
        </div>
      </div>
      <div>
        <Label>Website</Label>
        <Input value={contact.website} onChange={(e) => set("website", e.target.value)} />
      </div>
      <div>
        <Label>Adresse</Label>
        <Input value={contact.address} onChange={(e) => set("address", e.target.value)} />
      </div>
      <div>
        <Label>Notiz</Label>
        <Textarea value={contact.note} onChange={(e) => set("note", e.target.value)} />
      </div>
    </>
  );
}
