import { createFileRoute } from "@tanstack/react-router";
import { handleFileRequest } from "@/lib/docbay/storage.server";

export const Route = createFileRoute("/api/files/$resourceId")({
  server: {
    handlers: {
      GET: ({ request, params }) => handleFileRequest(request, params.resourceId),
    },
  },
});
