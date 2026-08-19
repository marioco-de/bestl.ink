import { createFileRoute } from "@tanstack/react-router";
import { loadShortAnalytics, tenantFromApiRequest } from "@/lib/docbay/shorts.server";

export const Route = createFileRoute("/api/v1/shorts/$id/analytics")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const tenantId = await tenantFromApiRequest(request);
        if (!tenantId) return Response.json({ error: "Unauthorized" }, { status: 401 });
        const range = new URL(request.url).searchParams.get("range") || "30d";
        try {
          const analytics = await loadShortAnalytics(tenantId, params.id, range);
          return Response.json({ analytics });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Fehler";
          const status = msg === "Nicht gefunden" ? 404 : 400;
          return Response.json({ error: msg }, { status });
        }
      },
    },
  },
});
