import { createFileRoute } from "@tanstack/react-router";
import { handleCardRequest } from "@/lib/docbay/cards.server";

export const Route = createFileRoute("/vcf/$slug")({
  server: {
    handlers: {
      GET: ({ request, params }) => handleCardRequest(request, params.slug),
    },
  },
});
