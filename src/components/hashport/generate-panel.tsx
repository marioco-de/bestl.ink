import { useMemo, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LinkEditorShell } from "@/components/control/link-editor-shell";
import { defaultHost } from "@/lib/docbay/hosts";
import { generateLink, bulkGenerateLinks, createParamNode, createTag, saveNdaTemplate, uploadBegin, uploadChunk, updateResource } from "@/lib/docbay/api";
import type { FullState, ParamNode, Resource } from "@/lib/docbay/types";
import { buildPublicUrl, resourceRestricted } from "@/lib/docbay/public-url";
import { TagPicker } from "@/components/control/tag-picker";
import { Toggle } from "@/components/ui/toggle";
import { parseRequireRequest, withRequireRequest } from "@/lib/docbay/doc-actions";

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
  const [ndaTemplateId, setNdaTemplateId] = useState(state.ndaTemplates?.[0]?.id ?? "");
  const [ndaBusy, setNdaBusy] = useState(false);
  const [assignedEmail, setAssignedEmail] = useState("");
  const [assignedName, setAssignedName] = useState("");
  const [allowIdentityEdit, setAllowIdentityEdit] = useState(true);
  const [requireRequest, setRequireRequest] = useState(
    parseRequireRequest(resource.payload, resource.type),
  );
  const [bulk, setBulk] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    url: string;
    token: string;
    button: string;
  } | null>(null);

  async function uploadNda(file: File) {
    setNdaBusy(true);
    try {
      const started = await uploadBegin({
        data: {
          file_name: file.name,
          mime_type: file.type || "application/pdf",
          file_size: file.size,
          tenant_id: state.tenant.id,
        },
      });
      const buf = new Uint8Array(await file.arrayBuffer());
      const chunk = 0x8000;
      let binary = "";
      for (let i = 0; i < buf.length; i += chunk) {
        binary += String.fromCharCode(...buf.subarray(i, i + chunk));
      }
      await uploadChunk({
        data: { upload_id: started.upload_id, data: btoa(binary), tenant_id: state.tenant.id },
      });
      const next = (await saveNdaTemplate({
        data: {
          title: file.name.replace(/\.[^.]+$/, ""),
          upload_id: started.upload_id,
          file_name: file.name,
          mime_type: file.type || "application/pdf",
          tenant_id: state.tenant.id,
        },
      })) as FullState;
      onUpdated(next);
      const created = next.ndaTemplates?.find((n) => n.file_name === file.name);
      if (created) setNdaTemplateId(created.id);
      toast.success("NDA gespeichert");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "NDA-Upload fehlgeschlagen");
    } finally {
      setNdaBusy(false);
    }
  }

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
      const gated = await updateResource({
        data: {
          id: resource.id,
          payload: withRequireRequest(requireRequest, resource.payload),
          tenant_id: state.tenant.id,
        },
      });
      if (gated) onUpdated(gated as FullState);
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
          nda_template_id: requireNda ? ndaTemplateId || undefined : undefined,
          assigned_email: assignedEmail.trim() || undefined,
          assigned_name: assignedName.trim() || undefined,
          allow_identity_edit: allowIdentityEdit,
        },
      });
      if (res.state) onUpdated(res.state);
      await router.invalidate();
      const host = state.tenant.public_host || window.location.host;
      const restricted = resourceRestricted(resource.type, resource.payload, {
        password: Boolean(password),
        nda: requireNda,
        expires: Boolean(expiresHours),
        oneTime,
      }) || requireRequest;
      const url = buildPublicUrl({
        host,
        type: resource.type,
        slug: resource.slug,
        token: res.token,
        restricted,
        utm: {
          source: utm?.utm_source,
          medium: utm?.utm_medium,
          campaign: utm?.utm_campaign,
        },
      });
      setResult({ url, token: res.token, button: buttonName });
      toast.success(`Link für ${buttonName}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <LinkEditorShell
        title="Link bereit"
        onClose={onClose}
        url={result.url}
        slug={resource.slug}
        preview={{
          title: resource.title,
          text: note,
          image: "",
          host: state.tenant.public_host || "",
        }}
        footer={
          <Button
            className="w-full"
            onClick={() => {
              void navigator.clipboard.writeText(result.url);
              toast.success("Kopiert");
            }}
          >
            <Copy className="h-4 w-4" /> Kopieren
          </Button>
        }
      >
        <p className="break-all font-mono text-sm">{result.url}</p>
      </LinkEditorShell>
    );
  }

  const host = defaultHost(state);
  const previewUrl = buildPublicUrl({
    host,
    type: resource.type,
    slug: resource.slug,
    token: "",
    restricted: false,
  });

  return (
    <LinkEditorShell
      title="Link generieren"
      onClose={onClose}
      url={previewUrl}
      slug={resource.slug}
      preview={{
        title: resource.title,
        text: note,
        image: "",
        host,
      }}
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
            <TagPicker
              catalog={state.tags}
              value={selectedTags}
              onChange={setSelectedTags}
              onCreate={async (name, color) => {
                const s = (await createTag({
                  data: { name, color, tenant_id: state.tenant.id },
                })) as FullState;
                onUpdated(s);
              }}
            />
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
          <div className="space-y-3">
            {state.features.one_time_links && (
              <Toggle label="Einmal-Link" checked={oneTime} onChange={setOneTime} />
            )}
            {state.features.download_control && resource.type !== "page" && (
              <Toggle label="Download erlauben" checked={allowDownload} onChange={setAllowDownload} />
            )}
            {state.features.nda && (
              <Toggle label="NDA" checked={requireNda} onChange={setRequireNda} />
            )}
            <Toggle
              label="Zugriff muss angefragt werden"
              hint="Ohne gültigen Token erscheint das Anfrage-Formular."
              checked={requireRequest}
              onChange={setRequireRequest}
            />
            <Toggle
              label="Besucher darf Name und E-Mail ändern"
              checked={allowIdentityEdit}
              onChange={setAllowIdentityEdit}
            />
          </div>
          {state.features.nda && requireNda && (
            <div className="space-y-2">
              <Label>NDA-Dokument</Label>
              <select
                className="h-10 w-full rounded-lg border border-border bg-bg-elevated px-3 text-sm"
                value={ndaTemplateId}
                onChange={(e) => setNdaTemplateId(e.target.value)}
              >
                <option value="">— wählen —</option>
                {(state.ndaTemplates ?? []).map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.title}
                    {n.file_name ? ` (${n.file_name})` : ""}
                  </option>
                ))}
              </select>
              <label className="block cursor-pointer text-xs text-primary">
                {ndaBusy ? "Lädt…" : "Neue NDA hochladen"}
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,application/pdf"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadNda(f);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          )}
          <div className="space-y-2">
            <Label>Für Empfänger vorbelegen</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                type="email"
                placeholder="kunde@firma.de"
                value={assignedEmail}
                onChange={(e) => setAssignedEmail(e.target.value)}
              />
              <Input
                placeholder="Name (optional)"
                value={assignedName}
                onChange={(e) => setAssignedName(e.target.value)}
              />
            </div>
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
    </LinkEditorShell>
  );
}
