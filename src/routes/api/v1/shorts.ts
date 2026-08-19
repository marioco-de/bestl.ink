import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import {
  mapShortRow,
  tenantFromApiRequest,
  createShortForTenant,
} from "@/lib/docbay/shorts.server";

export const Route = createFileRoute("/api/v1/shorts")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const tenantId = await tenantFromApiRequest(request);
        if (!tenantId) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        const sql = await getSql();
        const rows = await sql`
          select * from db_short_links where tenant_id = ${tenantId}
          order by created_at desc limit 200
        `;
        return Response.json({
          shorts: rows.map((r) => mapShortRow(r as Record<string, unknown>)),
        });
      },
      POST: async ({ request }) => {
        const tenantId = await tenantFromApiRequest(request);
        if (!tenantId) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        let body: {
          destination?: string;
          slug?: string;
          title?: string;
          note?: string;
        };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        if (!body.destination) {
          return Response.json({ error: "destination required" }, { status: 400 });
        }
        try {
          const short = await createShortForTenant(tenantId, {
            destination: body.destination,
            slug: body.slug,
            title: body.title,
            note: body.note,
          });
          return Response.json({ short }, { status: 201 });
        } catch (e) {
          return Response.json(
            { error: e instanceof Error ? e.message : "Fehler" },
            { status: 400 },
          );
        }
      },
    },
  },
});
