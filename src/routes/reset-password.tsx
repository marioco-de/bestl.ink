import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  validateSearch: (s: Record<string, unknown>) => ({
    token: typeof s.token === "string" ? s.token : "",
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const tokenFromUrl = useMemo(() => {
    if (search.token) return search.token;
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("token") || "";
  }, [search.token]);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tokenFromUrl) {
      toast.error("Reset-Link ist ungültig oder abgelaufen");
      return;
    }
    setBusy(true);
    try {
      const res = await authClient.resetPassword({
        newPassword: password,
        token: tokenFromUrl,
      });
      if (res.error) {
        toast.error(res.error.message || "Konnte nicht speichern");
        return;
      }
      toast.success("Passwort geändert");
      void navigate({ to: "/login" });
    } catch {
      toast.error("Konnte nicht speichern");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Neues Passwort</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <Label>Neues Passwort (min. 8 Zeichen)</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "…" : "Speichern"}
            </Button>
            <p className="text-center text-sm text-fg-muted">
              <Link to="/login" className="text-primary hover:underline">
                Zurück zum Login
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
