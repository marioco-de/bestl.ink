import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QuickShorten } from "@/components/control/quick-shorten";
import { useControlData } from "@/lib/docbay/use-control";
import { listChat, listChatInbox, replyChat } from "@/lib/docbay/api";
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
              <div className="border-b border-border px-4 py-2.5">
                <p className="text-sm font-medium">{current.resource_title}</p>
                <p className="text-[11px] text-fg-subtle">/{current.resource_slug}</p>
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
