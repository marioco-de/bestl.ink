import { createFileRoute } from "@tanstack/react-router";
import { handleUploadRequest } from "@/lib/docbay/storage.server";

export const Route = createFileRoute("/api/uploads")({
  server: {
    handlers: {
      POST: ({ request }) => handleUploadRequest(request),
    },
  },
});
