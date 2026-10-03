import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

/** Rasterize a PDF into page images, the way a bio page can show it without a plugin. */
export async function renderPdfPages(file: File, maxPages = 16): Promise<{ blobs: Blob[]; total: number }> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const count = Math.min(doc.numPages, maxPages);
  const blobs: Blob[] = [];
  for (let i = 1; i <= count; i++) {
    const page = await doc.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(2, 1100 / base.width) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), "image/webp", 0.82));
    if (blob) blobs.push(blob);
  }
  return { blobs, total: doc.numPages };
}
