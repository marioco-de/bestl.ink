import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useControlData } from "@/lib/docbay/use-control";
import { saveEmailSettings, saveEmailTemplate } from "@/lib/docbay/api";

export const Route = createFileRoute("/control/email")({
  component: EmailPage,
});

function EmailPage() {
  const data = useControlData();
  const router = useRouter();
  const es = data.emailSettings;
  const [provider, setProvider] = useState(es?.provider || "none");
  const [apiKey, setApiKey] = useState("");
  const [smtpHost, setSmtpHost] = useState(es?.smtp_host || "");
  const [smtpPort, setSmtpPort] = useState(String(es?.smtp_port || 587));
  const [smtpUser, setSmtpUser] = useState(es?.smtp_user || "");
  const [smtpPass, setSmtpPass] = useState("");
  const [fromEmail, setFromEmail] = useState(es?.from_email || "");
  const [fromName, setFromName] = useState(es?.from_name || "");
  const approved = data.emailTemplates.find((t) => t.kind === "access_approved");
  const [subj, setSubj] = useState(approved?.subject || "");
  const [body, setBody] = useState(approved?.body_html || "");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">E-Mail</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Bei Freigabe einer Zugriffsanfrage wird automatisch eine personalisierte
          E-Mail versendet. Provider: Platform-Emailit, eigene Emailit-API oder
          SMTP (IMAP-Zugangsdaten / Mailserver).
        </p>
      </div>



      <Card>
        <CardHeader>
          <CardTitle>Provider</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["none", "Aus"],
                ["emailit_platform", "BESTL.INK Emailit"],
                ["emailit_custom", "Eigene Emailit-API"],
                ["smtp", "SMTP / IMAP Login"],
              ] as const
            ).map(([v, label]) => {
              const locked =
                (v === "emailit_platform" && !data.features.emailit_platform) ||
                (v === "emailit_custom" && !data.features.emailit_custom) ||
                (v === "smtp" && !data.features.smtp_email);
              return (
                <button
                  key={v}
                  type="button"
                  disabled={locked}
                  onClick={() => setProvider(v)}
                  className={
                    provider === v
                      ? "rounded-lg bg-primary/15 px-3 py-2 text-sm text-primary"
                      : "rounded-lg border border-border px-3 py-2 text-sm text-fg-muted disabled:opacity-40"
                  }
                >
                  {label}
                  {locked && (
                    <Badge variant="outline" className="ml-1">
                      Super
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>

          {provider === "emailit_platform" && (
            <p className="text-sm text-fg-muted">
              Nutzt den platform-weiten Emailit-Key (nur wenn Super Admin die
              Feature-Flag aktiviert).
            </p>
          )}
          {provider === "emailit_custom" && (
            <div>
              <Label>Emailit API Key</Label>
              <Input
                type="password"
                placeholder={es?.emailit_api_key ? "•••• gespeichert" : "secret_…"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>
          )}
          {provider === "smtp" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>SMTP Host</Label>
                <Input
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  placeholder="smtp.mailbox.org"
                />
              </div>
              <div>
                <Label>Port</Label>
                <Input value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} />
              </div>
              <div>
                <Label>Benutzer (oft E-Mail / IMAP-User)</Label>
                <Input value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Label>Passwort</Label>
                <Input
                  type="password"
                  placeholder={es?.smtp_pass ? "•••• gespeichert" : ""}
                  value={smtpPass}
                  onChange={(e) => setSmtpPass(e.target.value)}
                />
              </div>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>From E-Mail</Label>
              <Input value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} />
            </div>
            <div>
              <Label>From Name</Label>
              <Input value={fromName} onChange={(e) => setFromName(e.target.value)} />
            </div>
          </div>
          <Button
            onClick={async () => {
              try {
                await saveEmailSettings({
                  data: {
                    provider: provider as "none" | "emailit_platform" | "emailit_custom" | "smtp",
                    emailit_api_key: apiKey || undefined,
                    smtp_host: smtpHost || undefined,
                    smtp_port: Number(smtpPort) || 587,
                    smtp_user: smtpUser || undefined,
                    smtp_pass: smtpPass || undefined,
                    from_email: fromEmail || undefined,
                    from_name: fromName || undefined,
                  },
                });
                await router.invalidate();
                toast.success("E-Mail-Einstellungen gespeichert");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Fehler");
              }
            }}
          >
            Speichern
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Template: Zugang freigeschaltet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-fg-subtle">
            Variablen: {"{{resource_title}} {{access_url}} {{company}} {{email}}"}
          </p>
          <div>
            <Label>Betreff</Label>
            <Input value={subj} onChange={(e) => setSubj(e.target.value)} />
          </div>
          <div>
            <Label>HTML-Body</Label>
            <Textarea
              className="min-h-[140px] font-mono text-xs"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
          <Button
            variant="secondary"
            onClick={async () => {
              await saveEmailTemplate({
                data: {
                  kind: "access_approved",
                  subject: subj,
                  body_html: body,
                },
              });
              await router.invalidate();
              toast.success("Template gespeichert");
            }}
          >
            Template speichern
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
