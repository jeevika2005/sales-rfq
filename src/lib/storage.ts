// Local-disk attachment storage. Fine for a single dev/small-deployment
// instance (same caveat as rate-limit.ts) — a multi-instance production
// deployment would need object storage (S3 or similar) instead, since
// each instance would otherwise only see files written to its own disk.
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const ATTACHMENTS_DIR = path.join(process.cwd(), "storage", "attachments");

// storageKey is disk-relative, e.g. "<attachmentId>__<sanitizedFileName>" —
// never the client-supplied path, so this never escapes ATTACHMENTS_DIR.
export function buildStorageKey(attachmentId: string, fileName: string): string {
  const safeName = fileName.replace(/[/\\]/g, "_").slice(-150);
  return `${attachmentId}__${safeName}`;
}

export async function saveAttachmentFile(storageKey: string, buffer: Buffer): Promise<void> {
  await mkdir(ATTACHMENTS_DIR, { recursive: true });
  await writeFile(path.join(ATTACHMENTS_DIR, storageKey), buffer);
}

export async function readAttachmentFile(storageKey: string): Promise<Buffer> {
  return readFile(path.join(ATTACHMENTS_DIR, storageKey));
}

export async function deleteAttachmentFile(storageKey: string): Promise<void> {
  try {
    await unlink(path.join(ATTACHMENTS_DIR, storageKey));
  } catch (exception) {
    // Best-effort: DB row is the source of truth for the delete; a
    // missing file on disk shouldn't block the API response.
    if ((exception as NodeJS.ErrnoException).code !== "ENOENT") throw exception;
  }
}
