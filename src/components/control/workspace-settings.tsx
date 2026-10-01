import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ColorPicker } from "@/components/control/color-picker";
import { useControl } from "@/lib/docbay/control-store";
import {
  addDashTeamMember,
  addDashTeamSection,
  createDashTeam,
  getDash,
  removeDashTeamMember,
  saveDashSettings,
} from "@/lib/docbay/dashboard-api";
import { updateTenant, saveNdaTemplate, deleteNdaTemplate, uploadBegin, uploadChunk } from "@/lib/docbay/api";
import { useT } from "@/lib/i18n";
import type { DashState, FullState } from "@/lib/docbay/types";
import { normalizeHex } from "@/lib/docbay/palette";
import { PLATFORM_LINK_HOST } from "@/lib/docbay/brand";
import { SplashSettingsCard } from "@/components/control/splash-settings";

export function WorkspaceSettings() {
  const t = useT();
  const { data, setData } = useControl();
  const dash = data.dash;
  const admin = data.member.role !== "member";
  const [name, setName] = useState(data.tenant.name);
  const [slug, setSlug] = useState(data.tenant.subdomain || data.tenant.slug);
  const [savingId, setSavingId] = useState(false);

  useEffect(() => {
    setName(data.tenant.name);
    setSlug(data.tenant.subdomain || data.tenant.slug);
  }, [data.tenant.id]);
  const team = dash.teams.find((x) => x.id === dash.active_team_id) || dash.teams[0];
  const above = dash.sections.filter((s) => s.kind === "team" && s.zone === "above");
  const below = dash.sections.filter((s) => s.kind === "team" && s.zone === "below");

  function apply(next: DashState) {
    setData({
      ...data,
      dash: next,
      tenant: { ...data.tenant, dash_user_buttons: next.user_buttons },
    });
  }

  async function run(fn: () => Promise<DashState>) {
    try {
      apply(await fn());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    }
  }

  if (!admin) {
    return <p className="text-sm text-fg-muted">{t("workspace.loadFail")}</p>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("workspace.identity")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setSavingId(true);
              void updateTenant({
                data: {
                  name: name.trim(),
                  brand_company: name.trim(),
                  subdomain: slug.trim(),
                  tenant_id: data.tenant.id !== "platform" ? data.tenant.id : undefined,
                },
              })
                .then((s) => {
                  const next = s as FullState;
                  setData({
                    ...next,
                    workspaces: next.workspaces.map((w) =>
                      w.id === next.tenant.id
                        ? { ...w, name: next.tenant.name, subdomain: next.tenant.subdomain }
                        : w,
                    ),
                  });
                  toast.success(t("common.saved"));
                })
                .catch((err) => toast.error(err instanceof Error ? err.message : t("common.error")))
                .finally(() => setSavingId(false));
            }}
          >
            <p className="text-sm text-fg-muted">
              {t("workspace.identityHint", { slug: slug.trim() || "firma" })}
            </p>
            <div>
              <Label>{t("common.name")}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>{t("domain.slug")}</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="font-mono"
                  placeholder="muster-gmbh"
                />
                <span className="shrink-0 text-xs text-fg-subtle">.{PLATFORM_LINK_HOST}</span>
              </div>
            </div>
            <Button type="submit" disabled={savingId}>
              {t("common.save")}
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("workspace.brand")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-fg-muted">{t("workspace.brandHint")}</p>
          <ColorPicker
            value={data.tenant.brand_color}
            onChange={(hex) => {
              const color = normalizeHex(hex);
              setData({ ...data, tenant: { ...data.tenant, brand_color: color } });
              void updateTenant({
                data: { brand_color: color, tenant_id: data.tenant.id },
              })
                .then((s) => setData(s as FullState))
                .catch((e) => toast.error(e instanceof Error ? e.message : t("common.error")));
            }}
          />
          <Button size="sm">{t("workspace.brandPreview")}</Button>
        </CardContent>
      </Card>
      <SplashSettingsCard />
      {data.has_nda && (
        <Card>
          <CardHeader>
            <CardTitle>{t("workspace.nda")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-fg-muted">{t("workspace.ndaHint")}</p>
            {(data.ndaTemplates ?? []).map((n) => (
              <div key={n.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{n.title}</p>
                  {n.file_name && <p className="truncate text-xs text-fg-muted">{n.file_name}</p>}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    void deleteNdaTemplate({ data: { id: n.id, tenant_id: data.tenant.id } })
                      .then((s) => setData(s as FullState))
                      .catch((e) => toast.error(e instanceof Error ? e.message : t("common.error")))
                  }
                >
                  <Trash2 className="h-3.5 w-3.5 text-danger" />
                </Button>
              </div>
            ))}
            <label className="inline-flex cursor-pointer">
              <span className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm">
                <Plus className="h-3.5 w-3.5" /> {t("workspace.ndaUpload")}
              </span>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,application/pdf"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  void (async () => {
                    try {
                      const started = await uploadBegin({
                        data: {
                          file_name: f.name,
                          mime_type: f.type || "application/pdf",
                          file_size: f.size,
                          tenant_id: data.tenant.id,
                        },
                      });
                      const buf = new Uint8Array(await f.arrayBuffer());
                      const step = 0x8000;
                      let binary = "";
                      for (let i = 0; i < buf.length; i += step) {
                        binary += String.fromCharCode(...buf.subarray(i, i + step));
                      }
                      await uploadChunk({
                        data: { upload_id: started.upload_id, data: btoa(binary), tenant_id: data.tenant.id },
                      });
                      const s = await saveNdaTemplate({
                        data: {
                          title: f.name.replace(/\.[^.]+$/, ""),
                          upload_id: started.upload_id,
                          file_name: f.name,
                          mime_type: f.type || "application/pdf",
                          tenant_id: data.tenant.id,
                        },
                      });
                      setData(s as FullState);
                      toast.success(t("common.saved"));
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : t("common.error"));
                    }
                  })();
                }}
              />
            </label>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{t("dash.personal")}</CardTitle>
        </CardHeader>
        <CardContent>
          <label className="block text-sm text-fg-muted">{t("dash.userAny")}</label>
          <select
            className="mt-1.5 h-10 w-full rounded-md border border-border bg-bg-elevated px-2 text-sm"
            value={dash.user_buttons}
            onChange={(e) =>
              void run(() =>
                saveDashSettings({
                  data: {
                    tenant_id: data.tenant.id,
                    user_buttons: e.target.value as DashState["user_buttons"],
                  },
                }),
              )
            }
          >
            <option value="off">{t("dash.userOff")}</option>
            <option value="anywhere">{t("dash.userAny")}</option>
            <option value="above">{t("dash.userAbove")}</option>
            <option value="below">{t("dash.userBelow")}</option>
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>{t("dash.teamBlock")}</CardTitle>
          <Button
            size="sm"
            onClick={() => {
              const name = window.prompt(t("dash.teamName"), "Team");
              if (name)
                void run(() =>
                  createDashTeam({ data: { name, tenant_id: data.tenant.id } }),
                );
            }}
          >
            <Plus className="h-3.5 w-3.5" /> {t("dash.newTeam")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {dash.teams.length === 0 && (
            <p className="text-sm text-fg-muted">{t("dash.noTeam")}</p>
          )}
          {dash.teams.length > 0 && (
            <select
              className="h-10 w-full rounded-md border border-border bg-bg-elevated px-2 text-sm"
              value={team?.id || ""}
              onChange={(e) => {
                const id = e.target.value;
                if (!id) return;
                void run(() => getDash({ data: { tenant_id: data.tenant.id, team_id: id } }));
              }}
            >
              {dash.teams.map((tm) => (
                <option key={tm.id} value={tm.id}>
                  {tm.name}
                </option>
              ))}
            </select>
          )}
          {team && (
            <>
              <div className="flex flex-wrap gap-2">
                {above.length + below.length < 2 && !above.length && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      void run(() =>
                        addDashTeamSection({
                          data: { team_id: team.id, zone: "above", tenant_id: data.tenant.id },
                        }),
                      )
                    }
                  >
                    {t("dash.addAbove")}
                  </Button>
                )}
                {above.length + below.length < 2 && !below.length && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      void run(() =>
                        addDashTeamSection({
                          data: { team_id: team.id, zone: "below", tenant_id: data.tenant.id },
                        }),
                      )
                    }
                  >
                    {t("dash.addBelow")}
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1 text-sm">
                <span className="text-fg-muted">{t("dash.members")}:</span>
                {team.member_ids.map((uid) => {
                  const m = data.members.find((x) => x.user_id === uid);
                  return (
                    <button
                      key={uid}
                      type="button"
                      className="rounded-full border border-border bg-bg-elevated px-2 py-0.5 text-xs hover:border-danger hover:text-danger"
                      onClick={() =>
                        void run(() =>
                          removeDashTeamMember({
                            data: { team_id: team.id, user_id: uid, tenant_id: data.tenant.id },
                          }),
                        )
                      }
                    >
                      {m?.name || m?.email || uid.slice(0, 6)}
                    </button>
                  );
                })}
                <select
                  className="h-8 rounded-md border border-border bg-bg-elevated px-1 text-xs"
                  defaultValue=""
                  onChange={(e) => {
                    const uid = e.target.value;
                    e.currentTarget.value = "";
                    if (!uid) return;
                    void run(() =>
                      addDashTeamMember({
                        data: { team_id: team.id, user_id: uid, tenant_id: data.tenant.id },
                      }),
                    );
                  }}
                >
                  <option value="">{t("dash.addMember")}</option>
                  {data.members
                    .filter((m) => !team.member_ids.includes(m.user_id))
                    .map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.name || m.email || m.user_id}
                      </option>
                    ))}
                </select>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
