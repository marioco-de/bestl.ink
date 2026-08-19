import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import {
  MessageSquare,
  Send,
  Flag,
  UserPlus,
  CheckCircle2,
  Tag,
  Archive,
  Trash2,
  MailOpen,
  Reply,
  Circle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QuickShorten } from "@/components/control/quick-shorten";
import { useControlData } from "@/lib/docbay/use-control";
import { deleteChatThread, listChat, listChatInbox, replyChat, saveChatThread } from "@/lib/docbay/api";
import { formatDateDe, cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/control/chat")({
  component: ChatInboxPage,
});

type Thread = Awaited<ReturnType<typeof listChatInbox>>[number];
type Msg = Awaited<ReturnType<typeof listChat>>[number];
type MemberLite = { user_id: string; name?: string; email?: string };
type TagLite = { name: string; color?: string };

const PRIOS = ["none", "low", "normal", "high", "urgent"] as const;
const UNREAD_TS = "1970-01-01T00:00:00.000Z";

function prioClass(p?: string) {
  if (p === "urgent") return "text-danger";
  if (p === "high") return "text-hue-amber";
  if (p === "normal") return "text-hue-azure";
  if (p === "low") return "text-hue-lime";
  return "text-fg-muted";
}

function isUnread(th: Thread) {
  if (!th.read_at) return true;
  return new Date(th.last_at).getTime() > new Date(th.read_at).getTime();
}

/** Outline check vs filled circle with cut-out check. */
function DoneIcon({ filled, className }: { filled?: boolean; className?: string }) {
  if (!filled) return <CheckCircle2 className={className} />;
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <path
        d="m8.2 12.2 2.4 2.4 5.2-5.4"
        fill="none"
        stroke="var(--color-bg-elevated, #13181b)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChatInboxPage() {
  const t = useT();
  const data = useControlData();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [active, setActive] = useState<{ resource_id: string; thread_key: string } | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number; th: Thread } | null>(null);

  async function loadInbox() {
    const rows = await listChatInbox({ data: { tenant_id: data.tenant.id } });
    setThreads(rows);
  }

  useEffect(() => {
    void loadInbox().catch((e) => toast.error(e instanceof Error ? e.message : t("common.error")));
    const tick = window.setInterval(() => {
      void loadInbox().catch(() => undefined);
    }, 2000);
    return () => window.clearInterval(tick);
  }, [data.tenant.id]);

  useEffect(() => {
    if (!active) {
      setMsgs([]);
      return;
    }
    void listChat({ data: { resource_id: active.resource_id, visitor_key: active.thread_key } }).then(setMsgs);
    const tick = window.setInterval(() => {
      void listChat({ data: { resource_id: active.resource_id, visitor_key: active.thread_key } }).then(setMsgs);
    }, 2000);
    return () => window.clearInterval(tick);
  }, [active]);

  const current = threads.find(
    (x) => x.resource_id === active?.resource_id && x.thread_key === active?.thread_key,
  );
  const openThreads = threads.filter((th) => th.status !== "archived");
  const archivedThreads = threads.filter((th) => th.status === "archived");

  function memberLabel(id: string | null | undefined) {
    if (!id) return "";
    const m = data.members.find((x) => x.user_id === id);
    return m?.name || m?.email || "";
  }

  function applyLocal(th: Thread, partial: Partial<Thread>) {
    setThreads((prev) =>
      prev.map((x) =>
        x.resource_id === th.resource_id && x.thread_key === th.thread_key ? { ...x, ...partial } : x,
      ),
    );
  }

  async function patchThread(th: Thread, partial: Partial<Thread> & { read_at?: string | null }) {
    applyLocal(th, partial);
    try {
      await saveChatThread({
        data: {
          resource_id: th.resource_id,
          visitor_key: th.thread_key,
          tenant_id: data.tenant.id,
          priority: partial.priority ?? th.priority,
          assigned_to: partial.assigned_to === undefined ? th.assigned_to : partial.assigned_to,
          status: partial.status ?? th.status,
          tags: partial.tags ?? th.tags,
          read_at: partial.read_at ?? undefined,
        },
      });
      await loadInbox();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    }
  }

  function openThread(th: Thread) {
    setActive({ resource_id: th.resource_id, thread_key: th.thread_key });
    setMenu(null);
    if (isUnread(th)) void patchThread(th, { read_at: new Date().toISOString() });
  }

  async function send() {
    if (!active || !body.trim()) return;
    setBusy(true);
    try {
      const next = await replyChat({
        data: {
          resource_id: active.resource_id,
          body: body.trim(),
          tenant_id: data.tenant.id,
          visitor_key: active.thread_key,
        },
      });
      setMsgs(next);
      setBody("");
      await loadInbox();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  const tools = {
    tenantId: data.tenant.id,
    members: data.members,
    tags: data.tags,
    onLocal: (partial: Partial<Thread>) => {
      if (current) applyLocal(current, partial);
    },
    onChanged: () => void loadInbox(),
    onDeleted: () => {
      setActive(null);
      void loadInbox();
    },
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">{t("chat.title")}</h1>
        <p className="mt-1 text-sm text-fg-muted">{t("chat.hint")}</p>
      </div>
      <QuickShorten />
      <div className="grid min-h-[28rem] overflow-hidden rounded-xl border border-border bg-bg-elevated md:grid-cols-[20rem_1fr]">
        <aside className="border-b border-border md:border-b-0 md:border-r">
          {openThreads.length === 0 && (
            <p className="p-4 text-sm text-fg-muted">{t("chat.empty")}</p>
          )}
          {openThreads.map((th) => (
            <ThreadRow
              key={`${th.resource_id}:${th.thread_key}`}
              th={th}
              active={active}
              tags={data.tags}
              memberLabel={memberLabel}
              onOpen={() => openThread(th)}
              onPatch={(p) => void patchThread(th, p)}
              onMenu={(e) => {
                e.preventDefault();
                setMenu({ x: e.clientX, y: e.clientY, th });
              }}
            />
          ))}
        </aside>
        <section className="flex min-h-[20rem] flex-col">
          {current ? (
            <>
              <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{current.resource_title}</p>
                  <p className="text-[11px] text-fg-subtle">/{current.resource_slug}</p>
                </div>
                <ThreadTools thread={current} {...tools} />
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto p-4">
                {msgs.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                      m.sender_type === "staff" ? "ml-auto bg-hue-teal/15" : "bg-bg-muted",
                    )}
                  >
                    <p className="text-[10px] text-fg-subtle">
                      {m.sender_name} · {formatDateDe(m.created_at)}
                    </p>
                    <p className="mt-0.5">{m.body}</p>
                  </div>
                ))}
              </div>
              <form
                className="flex gap-2 border-t border-border p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void send();
                }}
              >
                <Input
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={t("chat.reply")}
                />
                <Button type="submit" size="icon" disabled={busy}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-fg-muted">
              <MessageSquare className="h-8 w-8" />
              <p className="text-sm">{t("chat.pick")}</p>
            </div>
          )}
        </section>
      </div>
      <button
        type="button"
        className="text-[12px] text-fg-subtle hover:text-fg-muted"
        onClick={() => setShowArchived((v) => !v)}
      >
        {showArchived ? t("chat.hideArchived") : t("chat.showArchived")}
        {archivedThreads.length ? ` (${archivedThreads.length})` : ""}
      </button>
      {showArchived && (
        <div className="overflow-hidden rounded-xl border border-border bg-bg-elevated">
          {archivedThreads.length === 0 ? (
            <p className="p-4 text-sm text-fg-muted">{t("chat.empty")}</p>
          ) : (
            archivedThreads.map((th) => (
              <ThreadRow
                key={`a:${th.resource_id}:${th.thread_key}`}
                th={th}
                active={active}
                tags={data.tags}
                memberLabel={memberLabel}
                onOpen={() => openThread(th)}
                onPatch={(p) => void patchThread(th, p)}
                onMenu={(e) => {
                  e.preventDefault();
                  setMenu({ x: e.clientX, y: e.clientY, th });
                }}
              />
            ))
          )}
        </div>
      )}
      {menu && (
        <RowContextMenu
          x={menu.x}
          y={menu.y}
          th={menu.th}
          members={data.members}
          tags={data.tags}
          unread={isUnread(menu.th)}
          onClose={() => setMenu(null)}
          onPatch={(p) => void patchThread(menu.th, p)}
          onOpen={() => openThread(menu.th)}
          onDeleted={() => {
            setMenu(null);
            setActive(null);
            void loadInbox();
          }}
          tenantId={data.tenant.id}
        />
      )}
    </div>
  );
}

function ThreadRow({
  th,
  active,
  tags,
  memberLabel,
  onOpen,
  onPatch,
  onMenu,
}: {
  th: Thread;
  active: { resource_id: string; thread_key: string } | null;
  tags: TagLite[];
  memberLabel: (id: string | null | undefined) => string;
  onOpen: () => void;
  onPatch: (p: Partial<Thread> & { read_at?: string | null }) => void;
  onMenu: (e: MouseEvent) => void;
}) {
  const t = useT();
  const unread = isUnread(th);
  const done = th.status === "done";
  const assigned = memberLabel(th.assigned_to);
  const tagged = tags.filter((tg) => th.tags.includes(tg.name));
  const important = th.priority && th.priority !== "none";

  return (
    <div
      className={cn(
        "flex min-h-[4.75rem] w-full items-stretch gap-1.5 border-b border-border px-2 py-2",
        active?.resource_id === th.resource_id && active.thread_key === th.thread_key
          ? "bg-hue-violet/10"
          : "hover:bg-bg-subtle",
        done && "opacity-70",
      )}
      onContextMenu={onMenu}
    >
      <div className="flex w-5 shrink-0 flex-col items-center justify-between py-0.5">
        <button
          type="button"
          title={unread ? t("thread.markRead") : t("thread.markUnread")}
          className="flex h-4 w-4 items-center justify-center"
          onClick={(e) => {
            e.stopPropagation();
            onPatch({ read_at: unread ? new Date().toISOString() : UNREAD_TS });
          }}
        >
          {unread ? (
            <span className="h-2 w-2 rounded-full bg-hue-violet" />
          ) : (
            <Circle className="h-2.5 w-2.5 text-fg-subtle" />
          )}
        </button>
        <button
          type="button"
          title={t("thread.done")}
          className={cn("flex h-4 w-4 items-center justify-center", done && "opacity-50")}
          onClick={(e) => {
            e.stopPropagation();
            onPatch({ status: done ? "open" : "done" });
          }}
        >
          <DoneIcon filled={done} className={cn("h-3.5 w-3.5", done ? "text-hue-lime" : "text-fg-muted")} />
        </button>
        {th.last_sender === "visitor" ? (
          <MailOpen className="h-3.5 w-3.5 text-fg-muted" />
        ) : (
          <Reply className="h-3.5 w-3.5 text-fg-muted" />
        )}
      </div>
      <button
        type="button"
        onClick={onOpen}
        className={cn("min-w-0 flex-1 text-left", done && "opacity-50")}
      >
        <span className="block truncate text-sm font-medium">{th.resource_title}</span>
        <span className="block truncate text-[11px] text-fg-muted">
          {th.last_visitor || th.thread_key || t("chat.visitor")} · {th.n}
        </span>
        {assigned ? (
          <span className="block truncate text-[11px] text-hue-azure">{assigned}</span>
        ) : null}
        {tagged.length > 0 && (
          <span className="mt-0.5 flex flex-wrap gap-1">
            {tagged.map((tg) => (
              <span
                key={tg.name}
                className="rounded-sm px-1 py-px text-[9px] font-medium"
                style={{ background: `${tg.color || "#64748b"}22`, color: tg.color || undefined }}
              >
                {tg.name}
              </span>
            ))}
          </span>
        )}
        <span className="mt-0.5 block truncate text-[11px] text-fg-subtle">{th.last_body}</span>
      </button>
      <div className="flex w-5 shrink-0 flex-col items-center justify-between py-0.5">
        <span className="flex h-4 w-4 items-center justify-center">
          {important ? (
            <Flag className={cn("h-3.5 w-3.5", prioClass(th.priority))} fill="currentColor" />
          ) : null}
        </span>
        <button
          type="button"
          title={t("thread.archive")}
          className="flex h-4 w-4 items-center justify-center text-fg-muted hover:text-fg"
          onClick={(e) => {
            e.stopPropagation();
            onPatch({ status: th.status === "archived" ? "open" : "archived" });
          }}
        >
          <Archive className="h-3.5 w-3.5" />
        </button>
        <span className="flex h-4 w-4 items-center justify-center">
          {th.assigned_to ? <UserPlus className="h-3.5 w-3.5 text-hue-azure" /> : null}
        </span>
      </div>
    </div>
  );
}

function RowContextMenu({
  x,
  y,
  th,
  members,
  tags,
  unread,
  tenantId,
  onClose,
  onPatch,
  onOpen,
  onDeleted,
}: {
  x: number;
  y: number;
  th: Thread;
  members: MemberLite[];
  tags: TagLite[];
  unread: boolean;
  tenantId: string;
  onClose: () => void;
  onPatch: (p: Partial<Thread> & { read_at?: string | null }) => void;
  onOpen: () => void;
  onDeleted: () => void;
}) {
  const t = useT();
  const [sub, setSub] = useState<null | "prio" | "user" | "tag">(null);
  return (
    <>
      <button type="button" className="fixed inset-0 z-40" aria-label={t("common.close")} onClick={onClose} />
      <div
        className="fixed z-50 min-w-[13rem] rounded-md border border-border bg-bg-elevated py-1 shadow-lg"
        style={{ left: Math.min(x, window.innerWidth - 220), top: Math.min(y, window.innerHeight - 280) }}
      >
        <MenuItem
          onClick={() => {
            onPatch({ read_at: unread ? new Date().toISOString() : UNREAD_TS });
            onClose();
          }}
        >
          {unread ? t("thread.markRead") : t("thread.markUnread")}
        </MenuItem>
        <MenuItem onClick={() => setSub(sub === "prio" ? null : "prio")}>{t("thread.priority")}</MenuItem>
        {sub === "prio" &&
          PRIOS.map((p) => (
            <MenuItem
              key={p}
              indent
              onClick={() => {
                onPatch({ priority: p });
                onClose();
              }}
            >
              <Flag className={cn("h-3 w-3", prioClass(p))} fill={p === "none" ? "none" : "currentColor"} />
              {t(`thread.${p}`)}
            </MenuItem>
          ))}
        <MenuItem onClick={() => setSub(sub === "user" ? null : "user")}>{t("thread.delegate")}</MenuItem>
        {sub === "user" && (
          <>
            <MenuItem
              indent
              onClick={() => {
                onPatch({ assigned_to: null });
                onClose();
              }}
            >
              {t("thread.unassigned")}
            </MenuItem>
            {members.map((m) => (
              <MenuItem
                key={m.user_id}
                indent
                onClick={() => {
                  onPatch({ assigned_to: m.user_id });
                  onClose();
                }}
              >
                {m.name || m.email || m.user_id}
              </MenuItem>
            ))}
          </>
        )}
        <MenuItem
          onClick={() => {
            onPatch({ status: th.status === "done" ? "open" : "done" });
            onClose();
          }}
        >
          {t("thread.done")}
        </MenuItem>
        <MenuItem onClick={() => setSub(sub === "tag" ? null : "tag")}>{t("thread.tag")}</MenuItem>
        {sub === "tag" &&
          (tags.length ? (
            tags.map((tg) => (
              <MenuItem
                key={tg.name}
                indent
                onClick={() => {
                  const on = th.tags.includes(tg.name);
                  onPatch({
                    tags: on ? th.tags.filter((x) => x !== tg.name) : [...th.tags, tg.name],
                  });
                }}
              >
                {tg.name}
              </MenuItem>
            ))
          ) : (
            <p className="px-3 py-1.5 text-xs text-fg-muted">—</p>
          ))}
        <MenuItem
          onClick={() => {
            onPatch({ status: th.status === "archived" ? "open" : "archived" });
            onClose();
          }}
        >
          {t("thread.archive")}
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (!confirm(t("thread.delete"))) return;
            void deleteChatThread({
              data: {
                resource_id: th.resource_id,
                visitor_key: th.thread_key,
                tenant_id: tenantId,
              },
            }).then(onDeleted);
          }}
        >
          {t("thread.delete")}
        </MenuItem>
        <MenuItem
          onClick={() => {
            onOpen();
            onClose();
          }}
        >
          {t("chat.pick")}
        </MenuItem>
      </div>
    </>
  );
}

function MenuItem({
  children,
  onClick,
  indent,
}: {
  children: ReactNode;
  onClick: () => void;
  indent?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-bg-subtle",
        indent && "pl-6",
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function ThreadTools({
  thread,
  tenantId,
  members,
  tags,
  onLocal,
  onChanged,
  onDeleted,
}: {
  thread: Thread;
  tenantId: string;
  members: MemberLite[];
  tags: TagLite[];
  onLocal: (partial: Partial<Thread>) => void;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const t = useT();
  const [open, setOpen] = useState<null | "prio" | "user" | "tag">(null);

  async function patch(partial: {
    priority?: string;
    assigned_to?: string | null;
    status?: string;
    tags?: string[];
  }) {
    onLocal(partial);
    try {
      await saveChatThread({
        data: {
          resource_id: thread.resource_id,
          visitor_key: thread.thread_key,
          tenant_id: tenantId,
          priority: partial.priority ?? thread.priority,
          assigned_to: partial.assigned_to === undefined ? thread.assigned_to : partial.assigned_to,
          status: partial.status ?? thread.status,
          tags: partial.tags ?? thread.tags,
        },
      });
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    }
  }

  const iconBtn = "flex h-8 w-8 items-center justify-center rounded-md text-fg-muted hover:bg-bg-subtle hover:text-fg";
  const assigned = members.find((m) => m.user_id === thread.assigned_to);
  const done = thread.status === "done";

  return (
    <div className="relative flex shrink-0 items-center gap-0.5">
      <button type="button" title={t("thread.priority")} className={iconBtn} onClick={() => setOpen(open === "prio" ? null : "prio")}>
        <Flag
          className={cn("h-4 w-4", prioClass(thread.priority))}
          fill={thread.priority && thread.priority !== "none" ? "currentColor" : "none"}
        />
      </button>
      <button
        type="button"
        title={assigned ? `${t("thread.delegate")}: ${assigned.name || assigned.email}` : t("thread.delegate")}
        className={iconBtn}
        onClick={() => setOpen(open === "user" ? null : "user")}
      >
        <UserPlus className={cn("h-4 w-4", assigned && "text-hue-azure")} />
      </button>
      <button
        type="button"
        title={t("thread.done")}
        className={iconBtn}
        onClick={() => void patch({ status: done ? "open" : "done" })}
      >
        <DoneIcon filled={done} className={cn("h-4 w-4", done ? "text-hue-lime" : "text-fg-muted")} />
      </button>
      <button type="button" title={t("thread.tag")} className={iconBtn} onClick={() => setOpen(open === "tag" ? null : "tag")}>
        <Tag className={cn("h-4 w-4", thread.tags.length > 0 && "text-hue-violet")} />
      </button>
      <button type="button" title={t("thread.archive")} className={iconBtn} onClick={() => void patch({ status: "archived" })}>
        <Archive className="h-4 w-4" />
      </button>
      <button
        type="button"
        title={t("thread.delete")}
        className={iconBtn}
        onClick={() => {
          if (!confirm(t("thread.delete"))) return;
          void deleteChatThread({
            data: {
              resource_id: thread.resource_id,
              visitor_key: thread.thread_key,
              tenant_id: tenantId,
            },
          }).then(onDeleted);
        }}
      >
        <Trash2 className="h-4 w-4 text-danger" />
      </button>
      {open && (
        <>
          <button type="button" className="fixed inset-0 z-20" aria-label={t("common.close")} onClick={() => setOpen(null)} />
          <div className="absolute right-0 top-9 z-30 min-w-[12rem] rounded-md border border-border bg-bg-elevated p-1 shadow-lg">
            {open === "prio" &&
              PRIOS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs hover:bg-bg-subtle",
                    thread.priority === p && "font-medium",
                  )}
                  onClick={() => {
                    void patch({ priority: p });
                    setOpen(null);
                  }}
                >
                  <Flag className={cn("h-3 w-3", prioClass(p))} fill={p === "none" ? "none" : "currentColor"} />
                  {t(`thread.${p}`)}
                </button>
              ))}
            {open === "user" && (
              <>
                <button
                  type="button"
                  className="flex w-full rounded-sm px-2 py-1.5 text-left text-xs hover:bg-bg-subtle"
                  onClick={() => {
                    void patch({ assigned_to: null });
                    setOpen(null);
                  }}
                >
                  {t("thread.unassigned")}
                </button>
                {members.map((m) => (
                  <button
                    key={m.user_id}
                    type="button"
                    className={cn(
                      "flex w-full rounded-sm px-2 py-1.5 text-left text-xs hover:bg-bg-subtle",
                      thread.assigned_to === m.user_id && "bg-bg-subtle font-medium",
                    )}
                    onClick={() => {
                      void patch({ assigned_to: m.user_id });
                      setOpen(null);
                    }}
                  >
                    {m.name || m.email || m.user_id}
                  </button>
                ))}
              </>
            )}
            {open === "tag" &&
              (tags.length ? (
                tags.map((tg) => {
                  const on = thread.tags.includes(tg.name);
                  return (
                    <button
                      key={tg.name}
                      type="button"
                      className={cn("flex w-full rounded-sm px-2 py-1.5 text-left text-xs hover:bg-bg-subtle", on && "font-medium")}
                      onClick={() => {
                        const next = on
                          ? thread.tags.filter((x) => x !== tg.name)
                          : [...thread.tags, tg.name];
                        void patch({ tags: next });
                      }}
                    >
                      {tg.name}
                    </button>
                  );
                })
              ) : (
                <p className="px-2 py-1.5 text-xs text-fg-muted">—</p>
              ))}
          </div>
        </>
      )}
    </div>
  );
}
