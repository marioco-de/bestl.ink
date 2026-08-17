import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { authClient, signInGoogle } from "@/lib/auth/client";
import { getPublicHome } from "@/lib/docbay/api";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): { error?: string } => ({
    error: typeof s.error === "string" && s.error ? s.error : undefined,
  }),
  loader: async () => {
    try {
      return await getPublicHome();
    } catch {
      return { googleNative: false, product: "bestl.ink", platformHost: "bestl.ink" };
    }
  },
  component: LoginPage,
});

function looksLikeEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function LoginPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const home = Route.useLoaderData();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (search.error) toast.error(search.error);
  }, [search.error]);

  async function onEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await authClient.signIn.email({ email, password });
      if (res.error) {
        toast.error(res.error.message || "Login fehlgeschlagen");
        return;
      }
      toast.success("Angemeldet");
      void navigate({ to: "/control/links", search: {} as never });
    } catch {
      toast.error("Login fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  async function onForgot() {
    if (!looksLikeEmail(email)) {
      toast.error("Bitte zuerst eine gültige E-Mail eintragen");
      return;
    }
    setBusy(true);
    try {
      const origin = window.location.origin;
      const res = await authClient.requestPasswordReset({
        email: email.trim(),
        redirectTo: `${origin}/reset-password`,
      });
      if (res.error) {
        toast.error(res.error.message || "Reset fehlgeschlagen");
        return;
      }
      toast.success("Wenn das Konto existiert, ist eine Mail unterwegs.");
    } catch {
      toast.error("Reset fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    setBusy(true);
    try {
      await signInGoogle({
        callbackURL: "/control/links",
        errorCallbackURL: "/login",
      });
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Google-Login fehlgeschlagen. Pop-ups erlauben oder per E-Mail einloggen.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="metal mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-md">
            <Shield className="h-6 w-6" />
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">bestl.ink</h1>
          <p className="mt-1 text-sm text-fg-muted">
            Gated Docs · Attribution · Tracking
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Anmelden</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={onEmailLogin} className="space-y-3">
              <div>
                <Label>E-Mail</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
              <div>
                <Label>Passwort</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
              {looksLikeEmail(email) && (
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => void onForgot()}
                  disabled={busy}
                >
                  Passwort vergessen?
                </button>
              )}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "…" : "Einloggen"}
              </Button>
            </form>

            <div className="space-y-2 border-t border-border pt-4">
              <p className="text-xs text-fg-subtle">Oder weiter mit</p>
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                disabled={busy}
                onClick={() => void onGoogle()}
              >
                Mit Google anmelden
              </Button>
            </div>

            <p className="text-center text-sm text-fg-muted">
              Neu?{" "}
              <Link to="/signup" className="text-primary hover:underline">
                Workspace erstellen
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
