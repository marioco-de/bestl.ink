import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MessageSquare, Send, Flag, UserPlus, CheckCircle2, Tag, Archive, Trash2 } from "lucide-react";
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

function ChatInboxPage() {
  const t = useT();
  const data = useControlData();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [active, setActive] = useState<{ resource_id: string; thread_key: string } | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadInbox() {
    const rows = await listChatInbox({ data: { tenant_id: data.tenant.id } });
    setThreads(rows);
    setActive((cur) => cur || (rows[0] ? { resource_id: rows[0].resource_id, thread_key: rows[0].thread_key } : null));
  }

  useEffect(() => {
    void loadInbox().catch((e) => toast.error(e instanceof Error ? e.message : t("common.error")));
    const tick = window.setInterval(() => {
      void loadInbox().catch(() => undefined);
    }, 8000);
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
    }, 4000);
    return () => window.clearInterval(tick);
  }, [active]);

  const current = threads.find(
    (x) => x.resource_id === active?.resource_id && x.thread_key === active?.thread_key,
  );

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

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">{t("chat.title")}</h1>
        <p className="mt-1 text-sm text-fg-muted">{t("chat.hint")}</p>
      </div>
      <QuickShorten />
      <div className="grid min-h-[28rem] overflow-hidden rounded-xl border border-border bg-bg-elevated md:grid-cols-[16rem_1fr]">
        <aside className="border-b border-border md:border-b-0 md:border-r">
          {threads.length === 0 && (
            <p className="p-4 text-sm text-fg-muted">{t("chat.empty")}</p>
          )}
          {threads.map((th) => (
            <button
              key={`${th.resource_id}:${th.thread_key}`}
              type="button"
              onClick={() => setActive({ resource_id: th.resource_id, thread_key: th.thread_key })}
              className={cn(
                "relative flex w-full flex-col gap-0.5 border-b border-border px-3 py-2.5 text-left",
                active?.resource_id === th.resource_id && active.thread_key === th.thread_key
                  ? "bg-hue-violet/10"
                  : "hover:bg-bg-subtle",
              )}
            >
              {th.last_sender === "visitor" && (
                <span className="absolute right-2.5 top-3 h-2 w-2 rounded-full bg-hue-violet" />
              )}
              <span className="truncate pr-4 text-sm font-medium">{th.resource_title}</span>
              <span className="truncate text-[11px] text-fg-muted">
                {th.last_visitor || th.thread_key || t("chat.visitor")} · {th.n}
              </span>
              <span className="truncate text-[11px] text-fg-subtle">{th.last_body}</span>
            </button>
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
                <ThreadTools
                  thread={current}
                  tenantId={data.tenant.id}
                  members={data.members}
                  tags={data.tags}
                  onChanged={() => void loadInbox()}
                  onDeleted={() => {
                    setActive(null);
                    void loadInbox();
                  }}
                />
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto p-4">
                {msgs.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                      m.sender_type === "staff"
                        ? "ml-auto bg-hue-teal/15"
                        : "bg-bg-muted",
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
    </div>
  );
}

const PRIOS = ["none", "low", "normal", "high", "urgent"] as const;

function ThreadTools({
  thread,
  tenantId,
  members,
  tags,
  onChanged,
  onDeleted,
}: {
  thread: Thread;
  tenantId: string;
  members: { user_id: string; name?: string; email?: string }[];
  tags: { name: string }[];
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

  return (
    <div className="relative flex shrink-0 items-center gap-0.5">
      <button type="button" title={t("thread.priority")} className={iconBtn} onClick={() => setOpen(open === "prio" ? null : "prio")}>
        <Flag className={cn("h-4 w-4", thread.priority === "urgent" && "text-danger", thread.priority === "high" && "text-hue-amber")} />
      </button>
      <button type="button" title={t("thread.delegate")} className={iconBtn} onClick={() => setOpen(open === "user" ? null : "user")}>
        <UserPlus className="h-4 w-4" />
      </button>
      <button
        type="button"
        title={t("thread.done")}
        className={iconBtn}
        onClick={() => void patch({ status: thread.status === "done" ? "open" : "done" })}
      >
        <CheckCircle2 className={cn("h-4 w-4", thread.status === "done" && "text-hue-lime")} />
      </button>
      <button type="button" title={t("thread.tag")} className={iconBtn} onClick={() => setOpen(open === "tag" ? null : "tag")}>
        <Tag className="h-4 w-4" />
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
          <div className="absolute right-0 top-9 z-30 min-w-[10rem] rounded-md border border-border bg-bg-elevated p-1 shadow-lg">
            {open === "prio" &&
              PRIOS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className="flex w-full rounded-sm px-2 py-1.5 text-left text-xs hover:bg-bg-subtle"
                  onClick={() => {
                    void patch({ priority: p });
                    setOpen(null);
                  }}
                >
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
                    className="flex w-full rounded-sm px-2 py-1.5 text-left text-xs hover:bg-bg-subtle"
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
