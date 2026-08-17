import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";

function loginError(request: Request, err: unknown) {
  const msg =
    err instanceof Error && err.message && err.message !== "HTTPError"
      ? err.message
      : "Anmeldung fehlgeschlagen. Bitte per E-Mail einloggen.";
  const url = new URL("/login", request.url);
  url.searchParams.set("error", msg);
  return Response.redirect(url, 302);
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          return await auth.handler(request);
        } catch (err) {
          console.error("[auth GET]", err);
          return loginError(request, err);
        }
      },
      POST: async ({ request }) => {
        try {
          return await auth.handler(request);
        } catch (err) {
          console.error("[auth POST]", err);
          const msg = err instanceof Error ? err.message : "Auth fehlgeschlagen";
          return Response.json({ error: msg, message: msg }, { status: 400 });
        }
      },
    },
  },
});
