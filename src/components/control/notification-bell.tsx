import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell, Globe2 } from "lucide-react";
import { useControl } from "@/lib/docbay/control-store";
import { markNotificationsRead } from "@/lib/docbay/api";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { FullState } from "@/lib/docbay/types";

type Alert = {
  id: string;
  title: string;
  body: string;
  href?: string;
  sticky?: boolean;
};

function domainAlerts(data: FullState, t: (k: string, v?: Record<string, string>) => string): Alert[] {
  return (data.domains ?? [])
    .filter((d) => !d.dns_ok)
    .map((d) => ({
      id: `dns:${d.id}`,
      title: t("notif.dnsTitle", { host: d.host }),
      body: d.connected ? t("notif.dnsConnected") : t("notif.dnsPending"),
      href: "/control/domain",
      sticky: true,
    }));
}

export function NotificationBell() {
  const t = useT();
  const navigate = useNavigate();
  const { data, setData } = useControl();
  const [open, setOpen] = useState(false);

  const stored = data.notifications ?? [];
  const unreadStored = stored.filter((n) => !n.read);
  const problems = useMemo(() => domainAlerts(data, t), [data, t]);
  const count = problems.length + unreadStored.length;
  const items: Alert[] = [
    ...problems,
    ...stored.slice(0, 20).map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      href: n.href || undefined,
    })),
  ];

  async function openPanel() {
    const next = !open;
    setOpen(next);
    if (next && unreadStored.length) {
      try {
        const s = (await markNotificationsRead({
          data: { tenant_id: data.tenant.id },
        })) as FullState;
        setData({
          ...s,
          notifications: s.notifications.map((n) => ({ ...n, read: true })),
        });
      } catch {
        /* keep unread */
      }
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => void openPanel()}
        className="relative flex h-10 w-10 items-center justify-center rounded-md border border-border text-fg-muted transition-colors hover:bg-bg-subtle hover:text-fg"
        aria-label={t("notif.label")}
        aria-expanded={open}
      >
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-warning px-1 text-[10px] font-medium text-warning-fg">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>
      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40"
            aria-label={t("common.close")}
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-1.5 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-lg border border-border bg-bg-elevated shadow-lg">
            <p className="border-b border-border px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-fg-subtle">
              {t("notif.label")}
            </p>
            {items.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-fg-muted">{t("notif.empty")}</p>
            ) : (
              <ul className="max-h-80 overflow-y-auto py-1">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-bg-subtle"
                      onClick={() => {
                        setOpen(false);
                        if (item.href) {
                          void navigate({
                            to: item.href,
                            search: data.tenant.id
                              ? ({ tenant: data.tenant.id } as never)
                              : undefined,
                          });
                        }
                      }}
                    >
                      <Globe2
                        className={cn(
                          "mt-0.5 h-3.5 w-3.5 shrink-0",
                          item.sticky ? "text-warning" : "text-fg-subtle",
                        )}
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{item.title}</span>
                        <span className="mt-0.5 block text-xs text-fg-muted">{item.body}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
