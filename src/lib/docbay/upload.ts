/** Shared client/server upload limit. */
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
export const MAX_UPLOAD_LABEL = "100 MB";

export function isOverUploadLimit(bytes: number): boolean {
  return bytes > MAX_UPLOAD_BYTES;
}
