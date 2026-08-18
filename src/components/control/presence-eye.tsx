import { useEffect, useState } from "react";
import { Eye } from "lucide-react";
import { listActivity } from "@/lib/docbay/api";
import { eventLabel, presenceTone } from "@/lib/docbay/activity";
import { useT } from "@/lib/i18n";
import { formatDateDe } from "@/lib/utils";
import type { ActivityEvent, LinkPresence } from "@/lib/docbay/types";

export function PresenceEye({ presence }: { presence?: LinkPresence | null }) {
  const t = useT();
  const [, tick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 30000);
    return () => window.clearInterval(id);
  }, []);
  const tone = presenceTone(presence);
  if (!tone.show) return null;
  const email = presence?.email || t("eye.visitor");
  const country = presence?.country || "";
  const title = tone.live
    ? country
      ? t("eye.live", { email, country })
      : t("eye.liveNoCountry", { email })
    : tone.ageMin >= 60
      ? t("eye.agoHours", { n: String(Math.round(tone.ageMin / 60)) })
      : t("eye.agoMin", { n: String(tone.ageMin) });
  return (
    <span
      title={title}
      className="inline-flex h-6 w-6 items-center justify-center"
      style={{ color: tone.color, opacity: tone.opacity }}
    >
      <Eye
        className={tone.live ? "eye-live h-3.5 w-3.5" : "h-3.5 w-3.5"}
        fill={tone.live ? "currentColor" : "none"}
      />
    </span>
  );
}

export function ActivityList({
  tenantId,
  shortId,
  linkId,
}: {
  tenantId: string;
  shortId?: string;
  linkId?: string;
}) {
  const t = useT();
  const [rows, setRows] = useState<ActivityEvent[] | null>(null);
  useEffect(() => {
    void listActivity({
      data: { tenant_id: tenantId, short_id: shortId, link_id: linkId },
    }).then(setRows);
  }, [tenantId, shortId, linkId]);
  if (!rows) return <p className="text-xs text-fg-subtle">{t("common.loading")}</p>;
  if (rows.length === 0) return <p className="text-xs text-fg-muted">{t("eye.none")}</p>;
  return (
    <ul className="space-y-1">
      {rows.map((r) => (
        <li key={r.id} className="font-mono text-[11px] text-fg-muted">
          <span className="text-fg">{eventLabel(r.event)}</span>
          {r.email ? ` · ${r.email}` : ""}
          {r.country ? ` · ${r.country}` : ""}
          {r.ip ? ` · ${r.ip}` : ""}
          {" · "}
          {formatDateDe(r.created_at)}
        </li>
      ))}
    </ul>
  );
}
