import { useState } from "react";
import { Settings } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useControl } from "@/lib/docbay/control-store";
import { createShort } from "@/lib/docbay/shorts-api";
import { upsertShort } from "@/lib/docbay/state-patch";
import { defaultHost, withHttp } from "@/lib/docbay/hosts";
import { useT } from "@/lib/i18n";

export function QuickShorten() {
  const t = useT();
  const { data, setData, openCreate } = useControl();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const host = defaultHost(data);

  async function quick(e: React.FormEvent) {
    e.preventDefault();
    const dest = withHttp(url);
    if (!dest) {
      toast.error(t("short.destMissing"));
      return;
    }
    if (data.tenant.id === "platform") {
      toast.error(t("domain.pick"));
      return;
    }
    setBusy(true);
    try {
      const created = await createShort({
        data: { destination: dest, tenant_id: data.tenant.id },
      });
      setData(upsertShort(data, created.short));
      toast.success(t("short.ready", { path: `${host}/${created.short.slug}` }));
      setUrl("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void quick(e)}
      className="flex flex-col gap-2 rounded-lg border border-border bg-bg-elevated p-1.5 shadow-sm @min-[36rem]/app:flex-row @min-[36rem]/app:items-center"
    >
      <Input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder={t("short.placeholder")}
        className="h-11 border-0 bg-transparent shadow-none focus-visible:ring-0"
      />
      <div className="flex shrink-0 gap-1">
        <button
          type="button"
          onClick={() => {
            openCreate(url.trim());
            setUrl("");
          }}
          className="inline-flex h-11 items-center gap-1.5 rounded-md px-2.5 text-sm text-fg-muted transition-colors hover:bg-bg-subtle hover:text-fg"
        >
          <Settings className="h-4 w-4" />
          <span className="hidden @min-[24rem]/app:inline">{t("short.options")}</span>
        </button>
        <Button
          type="submit"
          variant="secondary"
          className="h-11 bg-zinc-200 text-zinc-800 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
          disabled={busy}
        >
          {busy ? t("common.loading") : t("short.quick")}
        </Button>
      </div>
    </form>
  );
}
