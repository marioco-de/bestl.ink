import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { fetchPageHtml } from "@/lib/docbay/page-frame.server";
import { absoluteHttpUrl } from "@/lib/docbay/hosts";

export const Route = createFileRoute("/api/page-frame/$resourceId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const sql = await getSql();
        const row = (
          await sql`
            select type, content_url from db_resources where id = ${params.resourceId} limit 1
          `
        )[0] as { type?: string; content_url?: string } | undefined;
        if (!row || row.type !== "page") {
          return new Response("Nicht gefunden", { status: 404 });
        }
        const target = absoluteHttpUrl(row.content_url || "");
        if (!target) return new Response("Keine Ziel-URL", { status: 400 });
        try {
          const html = await fetchPageHtml(target);
          return new Response(html, {
            status: 200,
            headers: {
              "Content-Type": "text/html; charset=utf-8",
              "Cache-Control": "private, max-age=60",
              "X-Frame-Options": "SAMEORIGIN",
              "Content-Security-Policy": "frame-ancestors 'self'",
            },
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Fehler";
          return new Response(`<!doctype html><p>${msg}</p>`, {
            status: 502,
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        }
      },
    },
  },
});
