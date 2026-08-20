import { createFileRoute } from "@tanstack/react-router";
import { readOgBlob } from "@/lib/docbay/storage.server";

export const Route = createFileRoute("/api/og/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const id = params.id.replace(/[^a-zA-Z0-9._-]/g, "");
        if (!id) return new Response("Not found", { status: 404 });
        const blob = await readOgBlob(id);
        if (!blob) return new Response("Not found", { status: 404 });
        return new Response(new Uint8Array(blob.buf), {
          status: 200,
          headers: {
            "Content-Type": blob.mime || "image/webp",
            "Cache-Control": "public, max-age=86400, immutable",
            "X-Content-Type-Options": "nosniff",
          },
        });
      },
    },
  },
});
