import { createFileRoute } from "@tanstack/react-router";
import {
  tenantFromApiRequest,
  getShortForTenant,
  patchShortForTenant,
  deleteShortForTenant,
} from "@/lib/docbay/shorts.server";

export const Route = createFileRoute("/api/v1/shorts/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const tenantId = await tenantFromApiRequest(request);
        if (!tenantId) return Response.json({ error: "Unauthorized" }, { status: 401 });
        const short = await getShortForTenant(tenantId, params.id);
        if (!short) return Response.json({ error: "Not found" }, { status: 404 });
        return Response.json({ short });
      },
      PATCH: async ({ request, params }) => {
        const tenantId = await tenantFromApiRequest(request);
        if (!tenantId) return Response.json({ error: "Unauthorized" }, { status: 401 });
        let body: {
          destination?: string;
          slug?: string;
          title?: string;
          note?: string;
          disabled?: boolean;
          cloak?: boolean;
        };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        try {
          const short = await patchShortForTenant(tenantId, params.id, body);
          return Response.json({ short });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Fehler";
          const status = msg === "Nicht gefunden" ? 404 : 400;
          return Response.json({ error: msg }, { status });
        }
      },
      DELETE: async ({ request, params }) => {
        const tenantId = await tenantFromApiRequest(request);
        if (!tenantId) return Response.json({ error: "Unauthorized" }, { status: 401 });
        const ok = await deleteShortForTenant(tenantId, params.id);
        if (!ok) return Response.json({ error: "Not found" }, { status: 404 });
        return Response.json({ ok: true, id: params.id });
      },
    },
  },
});
