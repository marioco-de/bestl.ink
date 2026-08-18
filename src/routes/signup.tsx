import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { authClient, signInGoogle } from "@/lib/auth/client";
import { afterSignupSetup } from "@/lib/docbay/api";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await authClient.signUp.email({
        email,
        password,
        name: name || company || "Owner",
      });
      if (res.error) {
        toast.error(res.error.message || "Registrierung fehlgeschlagen");
        return;
      }
      await afterSignupSetup({
        data: {
          company: company || "Mein Unternehmen",
          name: name || "Owner",
          subdomain: subdomain || undefined,
        },
      });
      toast.success("Workspace erstellt");
      void navigate({ to: "/control", search: {} });
    } catch {
      toast.error("Registrierung fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  const previewSub =
    subdomain
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 40) || "firma";

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>BESTL.INK Workspace erstellen</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <Label>Firma</Label>
              <Input value={company} onChange={(e) => setCompany(e.target.value)} required />
            </div>
            <div>
              <Label>Subdomain (bestl.ink)</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={subdomain}
                  onChange={(e) => setSubdomain(e.target.value)}
                  placeholder="muster-gmbh"
                  className="font-mono"
                />
                <span className="shrink-0 text-xs text-fg-subtle">.bestl.ink</span>
              </div>
              <p className="mt-1 font-mono text-xs text-primary">
                https://{previewSub}.bestl.ink
              </p>
            </div>
            <div>
              <Label>E-Mail</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <Label>Passwort (min. 8 Zeichen)</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "…" : "Account anlegen"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void signInGoogle({
                  callbackURL: "/control/links",
                  errorCallbackURL: "/signup",
                }).finally(() => setBusy(false));
              }}
            >
              Mit Google starten
            </Button>
            <p className="text-center text-sm text-fg-muted">
              Bereits registriert?{" "}
              <Link to="/login" className="text-primary hover:underline">
                Login
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
