import { useMemo, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FullScreenModal } from "@/components/ui/fullscreen-modal";
import { generateLink, bulkGenerateLinks, createParamNode } from "@/lib/docbay/api";
import type { FullState, ParamNode, Resource } from "@/lib/docbay/types";
import { cn } from "@/lib/utils";
import { cardDownloadPath } from "@/lib/docbay/cards";

function collectButtons(
  nodes: ParamNode[],
  parentId: string | null = null,
  path: string[] = [],
): { node: ParamNode; path: string }[] {
  const children = nodes
    .filter((n) => n.parent_id === parentId)
    .sort((a, b) => a.sort_order - b.sort_order);
  const out: { node: ParamNode; path: string }[] = [];
  for (const c of children) {
    const p = [...path, c.name];
    if (c.kind === "button") out.push({ node: c, path: p.join(" / ") });
    else out.push(...collectButtons(nodes, c.id, p));
  }
  return out;
}

export function GeneratePanel({
  resource,
  state,
  onClose,
  onUpdated,
}: {
  resource: Resource;
  state: FullState;
  onClose: () => void;
  onUpdated: (s: FullState) => void;
}) {
  const router = useRouter();
  const buttons = useMemo(() => collectButtons(state.params), [state.params]);
  const [note, setNote] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [utmId, setUtmId] = useState("");
  const [expiresHours, setExpiresHours] = useState("");
  const [oneTime, setOneTime] = useState(false);
  const [password, setPassword] = useState("");
  const [allowDownload, setAllowDownload] = useState(resource.allow_download);
  const [requireNda, setRequireNda] = useState(resource.require_nda);
  const [bulk, setBulk] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    url: string;
    token: string;
    button: string;
  } | null>(null);

  async function ensureButton(): Promise<{ id: string; name: string }> {
    if (buttons[0]) return { id: buttons[0].node.id, name: buttons[0].node.name };
    const next = (await createParamNode({
      data: { name: "Direkt", kind: "button" },
    })) as FullState;
    onUpdated(next);
    const btn = next.params.find((p) => p.kind === "button");
    if (!btn) throw new Error("Kein Button");
    return { id: btn.id, name: btn.name };
  }

  async function onGenerate(buttonId: string, buttonName: string) {
    setBusy(true);
    try {
      if (bulk.trim() && state.features.bulk_links) {
        const lines = bulk.split("\n").map((l) => l.trim()).filter(Boolean);
        const res = await bulkGenerateLinks({
          data: {
            resource_id: resource.id,
            button_id: buttonId,
            lines,
          },
        });
        if (res.state) onUpdated(res.state);
        await router.invalidate();
        toast.success(`${res.tokens?.length || 0} Links erzeugt`);
        setBusy(false);
        return;
      }

      const utm = state.utmPresets.find((u) => u.id === utmId);
      const res = await generateLink({
        data: {
          resource_id: resource.id,
          button_id: buttonId,
          note: note.trim(),
          tags: selectedTags,
          utm_source: utm?.utm_source ?? undefined,
          utm_medium: utm?.utm_medium ?? undefined,
          utm_campaign: utm?.utm_campaign ?? undefined,
          expires_hours: expiresHours ? Number(expiresHours) : null,
          one_time: oneTime,
          password: password || undefined,
          allow_download: allowDownload,
          require_nda: requireNda,
        },
      });
      if (res.state) onUpdated(res.state);
      await router.invalidate();
      const host = state.tenant.public_host || window.location.host;
      const origin = window.location.origin;
      const params = new URLSearchParams();
      params.set("access", res.token);
      if (utm?.utm_source) params.set("utm_source", utm.utm_source);
      if (utm?.utm_medium) params.set("utm_medium", utm.utm_medium);
      if (utm?.utm_campaign) params.set("utm_campaign", utm.utm_campaign);
      const url =
        resource.type === "event" || resource.type === "contact"
          ? `${origin}${cardDownloadPath(resource.id, res.token)}`
          : `https://${host}${resource.slug.includes(".") ? `/${resource.slug}` : `/${resource.slug}/`}?${params.toString()}`;
      setResult({ url, token: res.token, button: buttonName });
      toast.success(`Link für ${buttonName}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  return (
    <FullScreenModal
      title="Link generieren"
      description={resource.title}
      onClose={onClose}
    >
      <div>
        <Label>Notiz</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Michael Müller, 0171-…"
            />
          </div>
          <div>
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-2">
              {state.tags.map((t) => {
                const on = selectedTags.includes(t.name);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() =>
                      setSelectedTags((p) =>
                        on ? p.filter((x) => x !== t.name) : [...p, t.name],
                      )
                    }
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs",
                      on
                        ? "border-primary/50 bg-primary/15 text-primary"
                        : "border-border text-fg-muted",
                    )}
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <Label>UTM-Preset</Label>
            <select
              className="h-10 w-full rounded-lg border border-border bg-bg-elevated px-3 text-sm"
              value={utmId}
              onChange={(e) => setUtmId(e.target.value)}
            >
              <option value="">— keine —</option>
              {state.utmPresets.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Ablauf (Stunden)</Label>
              <Input
                type="number"
                min={0}
                value={expiresHours}
                onChange={(e) => setExpiresHours(e.target.value)}
                placeholder="z.B. 168"
              />
            </div>
            {state.features.password_links && (
              <div>
                <Label>Zusatz-Passwort</Label>
                <Input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            {state.features.one_time_links && (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={oneTime}
                  onChange={(e) => setOneTime(e.target.checked)}
                />
                Einmal-Link
              </label>
            )}
            {state.features.download_control && (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={allowDownload}
                  onChange={(e) => setAllowDownload(e.target.checked)}
                />
                Download erlauben
              </label>
            )}
            {state.features.nda && (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={requireNda}
                  onChange={(e) => setRequireNda(e.target.checked)}
                />
                NDA
              </label>
            )}
          </div>
          {state.features.bulk_links && (
            <div>
              <Label>Bulk (eine Notiz pro Zeile)</Label>
              <Textarea
                value={bulk}
                onChange={(e) => setBulk(e.target.value)}
                placeholder={"Kunde A\nKunde B\nKunde C"}
              />
            </div>
          )}
          <div>
            <Label>Button</Label>
            <div className="mt-1 grid gap-2 sm:grid-cols-2">
              {buttons.length === 0 && (
                <Button
                  type="button"
                  disabled={busy}
                  className="h-auto flex-col items-start py-3"
                  onClick={async () => {
                    try {
                      const b = await ensureButton();
                      await onGenerate(b.id, b.name);
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Fehler");
                    }
                  }}
                >
                  <span>Direktlink</span>
                  <span className="text-[11px] font-normal text-fg-subtle">
                    Ohne Hierarchie
                  </span>
                </Button>
              )}
              {buttons.map(({ node, path }) => (
                <Button
                  key={node.id}
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  className="h-auto flex-col items-start py-3"
                  onClick={() => onGenerate(node.id, node.name)}
                >
                  <span>{node.name}</span>
                  <span className="text-[11px] font-normal text-fg-subtle">
                    {path}
                  </span>
                </Button>
              ))}
            </div>
          </div>
          {result && (
            <div className="rounded-md border border-border bg-bg-subtle p-4">
              <div className="flex items-center gap-2 text-sm text-primary">
                <Check className="h-4 w-4" /> {result.button}
              </div>
              <p className="mt-2 break-all font-mono text-xs">{result.url}</p>
              <Badge variant="outline" className="mt-2 font-mono">
                {result.token}
              </Badge>
              <Button
                className="mt-3 w-full"
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(result.url);
                  toast.success("Kopiert");
                }}
              >
                <Copy className="h-4 w-4" /> Kopieren
              </Button>
            </div>
          )}
    </FullScreenModal>
  );
}
