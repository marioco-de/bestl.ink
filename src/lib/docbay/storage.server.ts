import {
  createWriteStream,
  createReadStream,
} from "node:fs";
import {
  mkdir,
  rename,
  unlink,
  stat,
  writeFile,
  readFile,
  appendFile,
} from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { getSql } from "@/lib/db";
import { auth } from "@/lib/auth/server";
import { getMembership } from "./load-state.server";
import { uid } from "./id";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "./upload";

const STORAGE_PREFIX = "storage:";

export function isStoredContentUrl(url: string | null | undefined): boolean {
  return Boolean(url && url.startsWith(STORAGE_PREFIX));
}

export function storageKeyFromUrl(url: string): string {
  return url.slice(STORAGE_PREFIX.length);
}

export function storageContentUrl(key: string): string {
  return `${STORAGE_PREFIX}${key}`;
}

function uploadsRoot(): string {
  const fromEnv =
    typeof process !== "undefined" ? process.env.UPLOAD_DIR?.trim() : "";
  if (fromEnv) return fromEnv;
  const onLambda =
    typeof process !== "undefined" &&
    Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  if (onLambda) return path.join("/tmp", "bestl-uploads");
  return path.join(process.cwd(), "data", "uploads");
}

function assertSafeKey(key: string): string {
  if (
    !/^[a-zA-Z0-9._-]+(?:\/[a-zA-Z0-9._-]+)+$/.test(key) &&
    !/^[a-zA-Z0-9._-]+$/.test(key)
  ) {
    throw new Error("Ungültiger Speicherpfad");
  }
  if (key.includes("..")) throw new Error("Ungültiger Speicherpfad");
  return key;
}

function absPath(key: string): string {
  return path.join(uploadsRoot(), assertSafeKey(key));
}

async function putBlob(key: string, buf: Buffer, mime: string): Promise<void> {
  const sql = await getSql();
  await sql`
    insert into db_blobs (key, mime, body, byte_size)
    values (${key}, ${mime || "application/octet-stream"}, ${buf.toString("base64")}, ${buf.length})
    on conflict (key) do update set
      mime = excluded.mime,
      body = excluded.body,
      byte_size = excluded.byte_size
  `;
}

async function getBlob(
  key: string,
): Promise<{ buf: Buffer; mime: string } | null> {
  const sql = await getSql();
  const row = (
    await sql`select mime, body from db_blobs where key = ${assertSafeKey(key)} limit 1`
  )[0] as { mime?: string; body?: string } | undefined;
  if (!row?.body) return null;
  return {
    buf: Buffer.from(row.body, "base64"),
    mime: row.mime || "application/octet-stream",
  };
}

async function writeStreamToFile(
  stream: ReadableStream<Uint8Array> | Readable,
  dest: string,
): Promise<number> {
  await mkdir(path.dirname(dest), { recursive: true });
  const nodeStream =
    stream instanceof Readable
      ? stream
      : Readable.fromWeb(stream as import("node:stream/web").ReadableStream);
  const ws = createWriteStream(dest);
  let size = 0;
  try {
    await new Promise<void>((resolve, reject) => {
      nodeStream.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_UPLOAD_BYTES) {
          nodeStream.destroy();
          ws.destroy();
          reject(new Error(`Datei zu groß (max. ${MAX_UPLOAD_LABEL})`));
          return;
        }
        if (!ws.write(chunk)) {
          nodeStream.pause();
          ws.once("drain", () => nodeStream.resume());
        }
      });
      nodeStream.on("end", () => {
        ws.end();
      });
      nodeStream.on("error", reject);
      ws.on("error", reject);
      ws.on("finish", resolve);
    });
  } catch (err) {
    await unlink(dest).catch(() => undefined);
    throw err;
  }
  return size;
}

export async function saveTempUpload(file: File): Promise<{
  upload_id: string;
  file_name: string;
  mime_type: string;
  file_size: number;
}> {
  if (!file || file.size <= 0) throw new Error("Leere Datei");
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`Datei zu groß (max. ${MAX_UPLOAD_LABEL})`);
  }
  const uploadId = uid("upl");
  const dest = absPath(`tmp/${uploadId}`);
  const size = await writeStreamToFile(file.stream(), dest);
  return {
    upload_id: uploadId,
    file_name: file.name || "dokument.pdf",
    mime_type: file.type || "application/octet-stream",
    file_size: size || file.size,
  };
}

export async function beginTempUpload(meta: {
  file_name: string;
  mime_type: string;
  file_size: number;
  user_id: string;
  tenant_id: string;
}): Promise<string> {
  if (meta.file_size <= 0) throw new Error("Leere Datei");
  if (meta.file_size > MAX_UPLOAD_BYTES) {
    throw new Error(`Datei zu groß (max. ${MAX_UPLOAD_LABEL})`);
  }
  const uploadId = uid("upl");
  const dest = absPath(`tmp/${uploadId}`);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, Buffer.alloc(0));
  await writeFile(
    `${dest}.json`,
    JSON.stringify({ ...meta, received: 0 }),
    "utf8",
  );
  return uploadId;
}

export async function appendTempChunk(
  uploadId: string,
  base64: string,
): Promise<{ received: number; file_size: number }> {
  const dest = absPath(`tmp/${assertSafeKey(uploadId)}`);
  const metaPath = `${dest}.json`;
  let meta: {
    file_size: number;
    received: number;
    user_id: string;
    tenant_id: string;
  };
  try {
    meta = JSON.parse(await readFile(metaPath, "utf8")) as typeof meta;
  } catch {
    throw new Error("Upload nicht gefunden – Datei erneut wählen");
  }
  const buf = Buffer.from(base64, "base64");
  const next = meta.received + buf.length;
  if (next > MAX_UPLOAD_BYTES || next > meta.file_size + 4096) {
    await unlink(dest).catch(() => undefined);
    await unlink(metaPath).catch(() => undefined);
    throw new Error(`Datei zu groß (max. ${MAX_UPLOAD_LABEL})`);
  }
  await appendFile(dest, buf);
  meta.received = next;
  await writeFile(metaPath, JSON.stringify(meta), "utf8");
  return { received: meta.received, file_size: meta.file_size };
}

export async function assertTempUploadOwner(
  uploadId: string,
  userId: string,
  tenantId: string,
): Promise<void> {
  const dest = absPath(`tmp/${assertSafeKey(uploadId)}`);
  try {
    const meta = JSON.parse(await readFile(`${dest}.json`, "utf8")) as {
      user_id: string;
      tenant_id: string;
    };
    if (meta.user_id !== userId || meta.tenant_id !== tenantId) {
      throw new Error("Upload gehört zu einem anderen Account");
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("anderen")) throw err;
    throw new Error("Upload nicht gefunden – Datei erneut wählen");
  }
}

export async function commitUpload(
  uploadId: string,
  tenantId: string,
  resourceId: string,
): Promise<string> {
  const from = absPath(`tmp/${assertSafeKey(uploadId)}`);
  const key = `${assertSafeKey(tenantId)}/${assertSafeKey(resourceId)}`;
  const to = absPath(key);
  let mime = "application/octet-stream";
  try {
    const meta = JSON.parse(await readFile(`${from}.json`, "utf8")) as {
      mime_type?: string;
    };
    if (meta.mime_type) mime = meta.mime_type;
  } catch {
    /* ignore */
  }
  await mkdir(path.dirname(to), { recursive: true });
  try {
    await rename(from, to);
    await unlink(`${from}.json`).catch(() => undefined);
  } catch {
    throw new Error("Upload nicht gefunden oder abgelaufen – Datei erneut wählen");
  }
  try {
    const buf = await readFile(to);
    await putBlob(key, buf, mime);
  } catch (err) {
    console.error("[storage] persist blob", err);
    throw new Error("Datei konnte nicht gespeichert werden – bitte erneut versuchen");
  }
  return key;
}

export async function deleteStoredFile(key: string): Promise<void> {
  await unlink(absPath(key)).catch(() => undefined);
  try {
    const sql = await getSql();
    await sql`delete from db_blobs where key = ${assertSafeKey(key)}`;
  } catch {
    /* table may not exist yet */
  }
}

async function userFromRequest(request: Request): Promise<{ id: string } | null> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) return null;
  return { id: session.user.id };
}

export async function handleUploadRequest(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  const user = await userFromRequest(request);
  if (!user) return Response.json({ error: "Nicht angemeldet" }, { status: 401 });
  const mem = await getMembership(user.id);
  if (!mem || mem.tenant.id === "platform") {
    return Response.json({ error: "Kein Workspace" }, { status: 403 });
  }

  const len = Number(request.headers.get("content-length") || "0");
  if (len > MAX_UPLOAD_BYTES + 1024 * 1024) {
    return Response.json(
      { error: `Datei zu groß (max. ${MAX_UPLOAD_LABEL})` },
      { status: 413 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Ungültiger Upload" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Keine Datei" }, { status: 400 });
  }
  try {
    const saved = await saveTempUpload(file);
    return Response.json(saved);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upload fehlgeschlagen";
    return Response.json({ error: msg }, { status: 400 });
  }
}

export async function handleFileRequest(
  request: Request,
  resourceId: string,
): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get("access") || "";
  if (!token) {
    return new Response("Zugriff verweigert", { status: 401 });
  }
  const sql = await getSql();
  const res = (
    await sql`select * from db_resources where id = ${resourceId} limit 1`
  )[0] as
    | {
        id: string;
        tenant_id: string;
        content_url: string | null;
        content_base64: string | null;
        mime_type: string | null;
        file_name: string | null;
        allow_download: boolean;
      }
    | undefined;
  if (!res) return new Response("Nicht gefunden", { status: 404 });

  const link = (
    await sql`
      select * from db_links
      where token = ${token} and resource_id = ${resourceId}
      limit 1
    `
  )[0] as
    | {
        revoked: boolean;
        expires_at: string | null;
        allow_download: boolean | null;
      }
    | undefined;
  if (!link || link.revoked) {
    return new Response("Zugriff verweigert", { status: 403 });
  }
  if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) {
    return new Response("Link abgelaufen", { status: 403 });
  }

  const allowDl =
    link.allow_download != null ? Boolean(link.allow_download) : Boolean(res.allow_download);
  const mime = res.mime_type || "application/octet-stream";
  const fileName = res.file_name || "dokument";
  const headers = new Headers({
    "Content-Type": mime,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": `${allowDl ? "inline" : "inline"}; filename="${fileName.replace(/"/g, "")}"`,
  });

  if (isStoredContentUrl(res.content_url)) {
    const key = storageKeyFromUrl(res.content_url!);
    const filePath = absPath(key);
    let body: Buffer | null = null;
    try {
      const st = await stat(filePath);
      headers.set("Content-Length", String(st.size));
      const stream = Readable.toWeb(createReadStream(filePath));
      return new Response(stream as unknown as ReadableStream, { status: 200, headers });
    } catch {
      const blob = await getBlob(key);
      if (blob) {
        body = blob.buf;
        if (!res.mime_type) headers.set("Content-Type", blob.mime);
      }
    }
    if (body) {
      headers.set("Content-Length", String(body.length));
      return new Response(new Uint8Array(body), { status: 200, headers });
    }
    return new Response("Datei fehlt", { status: 404 });
  }

  if (res.content_base64) {
    const buf = Buffer.from(res.content_base64, "base64");
    headers.set("Content-Length", String(buf.length));
    return new Response(buf, { status: 200, headers });
  }

  return new Response("Keine Datei", { status: 404 });
}

export function nodeToWebRequest(req: IncomingMessage): Request {
  const host = String(req.headers.host ?? "127.0.0.1:8080");
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else {
      headers.set(key, value);
    }
  }
  const method = (req.method ?? "GET").toUpperCase();
  const body =
    method === "GET" || method === "HEAD"
      ? undefined
      : (Readable.toWeb(req) as unknown as ReadableStream);
  return new Request(`http://${host}${req.url ?? "/"}`, {
    method,
    headers,
    body,
    duplex: "half",
  } as RequestInit);
}

export async function writeNodeResponse(
  web: Response,
  res: ServerResponse,
): Promise<void> {
  res.statusCode = web.status;
  web.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") return;
    res.setHeader(key, value);
  });
  if (!web.body) {
    res.end();
    return;
  }
  const nodeBody = Readable.fromWeb(web.body as import("node:stream/web").ReadableStream);
  await new Promise<void>((resolve, reject) => {
    nodeBody.on("error", reject);
    res.on("error", reject);
    res.on("finish", resolve);
    nodeBody.pipe(res);
  });
}
