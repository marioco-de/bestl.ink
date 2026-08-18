import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell, Globe2, MousePointerClick } from "lucide-react";
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
  kind: "warn" | "info";
};

function domainAlerts(data: FullState, t: (k: string, v?: Record<string, string>) => string): Alert[] {
  return (data.domains ?? [])
    .filter((d) => !d.dns_ok)
    .map((d) => ({
      id: `dns:${d.id}`,
      title: t("notif.dnsTitle", { host: d.host }),
      body: d.connected ? t("notif.dnsConnected") : t("notif.dnsPending"),
      href: "/control/domain",
      kind: "warn" as const,
    }));
}

function isWarningNotif(title: string, href?: string | null): boolean {
  const h = href || "";
  return (
    h.includes("/control/domain") ||
    h.includes("/control/requests") ||
    /dns|warn|anfrage|zugriff/i.test(title)
  );
}

export function NotificationBell() {
  const t = useT();
  const navigate = useNavigate();
  const { data, setData } = useControl();
  const [open, setOpen] = useState(false);

  const stored = data.notifications ?? [];
  const unreadStored = stored.filter((n) => !n.read);
  const problems = useMemo(() => domainAlerts(data, t), [data, t]);
  const warnStored = unreadStored.filter((n) => isWarningNotif(n.title, n.href));
  const infoStored = unreadStored.filter((n) => !isWarningNotif(n.title, n.href));
  const warnCount = problems.length + warnStored.length;
  const infoCount = infoStored.length;
  const items: Alert[] = [
    ...problems,
    ...stored.slice(0, 20).map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      href: n.href || undefined,
      kind: isWarningNotif(n.title, n.href) ? ("warn" as const) : ("info" as const),
    })),
  ];

  const tone = warnCount > 0 ? "warn" : infoCount > 0 ? "info" : "idle";
  const tip = [
    warnCount ? t("notif.warnCount", { n: String(warnCount) }) : "",
    infoCount ? t("notif.infoCount", { n: String(infoCount) }) : "",
  ]
    .filter(Boolean)
    .join(" · ");

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
        title={tip || t("notif.empty")}
        className={cn(
          "relative flex h-10 w-10 items-center justify-center rounded-md transition-colors hover:bg-bg-subtle",
          tone === "idle" && "text-fg-muted opacity-50",
          tone === "info" && "text-fg",
          tone === "warn" && "text-red-600",
        )}
        aria-label={tip || t("notif.label")}
        aria-expanded={open}
      >
        <Bell className={cn("h-4 w-4", tone === "warn" && "bell-ring")} />
        {infoCount > 0 && (
          <span className="absolute -left-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-fg px-1 text-[10px] font-medium text-bg">
            {infoCount > 9 ? "9+" : infoCount}
          </span>
        )}
        {warnCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-medium text-white">
            {warnCount > 9 ? "9+" : warnCount}
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
              {(warnCount > 0 || infoCount > 0) && (
                <span className="ml-2 normal-case tracking-normal text-fg-muted">{tip}</span>
              )}
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
                      {item.kind === "warn" ? (
                        <Globe2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" />
                      ) : (
                        <MousePointerClick className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fg" />
                      )}
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
