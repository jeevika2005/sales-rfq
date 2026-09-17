"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Trash2, Upload, Paperclip, Download } from "lucide-react";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export type Attachment = {
  id: string;
  kind: "rfq_source" | "spec_doc" | "export";
  fileName: string;
  byteSize: number;
  createdAt: string;
};

export const ATTACHMENT_KINDS = [
  { value: "rfq_source", label: "RFQ Source" },
  { value: "spec_doc", label: "Spec Document" },
] as const;

// FR3.3 — same 25MB ceiling enforced server-side, checked client-side too
// so the user gets instant feedback instead of waiting on a round trip.
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentsPanel({ quoteId }: { quoteId: string }) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadKind, setUploadKind] = useState<(typeof ATTACHMENT_KINDS)[number]["value"]>("rfq_source");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Attachment | null>(null);

  async function loadAttachments() {
    try {
      const response = await fetch(`/api/quotes/${quoteId}/attachments`);
      const result = await response.json();
      if (!result.success) throw new Error(result.message);
      setAttachments(result.data);
      setListError(null);
    } catch (exception) {
      setListError(exception instanceof Error ? exception.message : "Failed to load attachments.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount
    loadAttachments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteId]);

  async function handleUpload() {
    if (!uploadFile) {
      setUploadError("Choose a file first.");
      return;
    }
    if (uploadFile.size > MAX_FILE_BYTES) {
      setUploadError("File exceeds the 25MB upload limit.");
      return;
    }

    setUploadError(null);
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("kind", uploadKind);

      const response = await fetch(`/api/quotes/${quoteId}/attachments`, { method: "POST", body: formData });
      const result = await response.json();
      if (!result.success) throw new Error(result.message);

      setUploadFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadAttachments();
    } catch (exception) {
      setUploadError(exception instanceof Error ? exception.message : "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDelete(attachment: Attachment) {
    setConfirmDelete(null);
    setDeleteError(null);
    const response = await fetch(`/api/quotes/${quoteId}/attachments/${attachment.id}`, { method: "DELETE" });
    const result = await response.json();
    if (!result.success) {
      setDeleteError(result.message);
      return;
    }
    await loadAttachments();
  }

  return (
    <div className="w-full rounded-[8px] border border-border bg-card p-6 text-left shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Paperclip className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Attachments</h3>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={uploadKind}
          onChange={(event) => setUploadKind(event.target.value as typeof uploadKind)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-[12px] text-foreground outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card"
        >
          {ATTACHMENT_KINDS.map((kind) => (
            <option key={kind.value} value={kind.value}>
              {kind.label}
            </option>
          ))}
        </select>
        <input
          ref={fileInputRef}
          type="file"
          onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
          className="flex-1 text-[11px] text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-[11px] file:font-medium file:text-foreground"
        />
        <button
          type="button"
          onClick={handleUpload}
          disabled={isUploading}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-[11px] font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          Upload
        </button>
      </div>

      {uploadError ? (
        <p role="alert" className="mt-2 rounded-lg bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
          {uploadError}
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-2">
        {isLoading ? (
          <p className="text-[11px] text-muted-foreground">Loading…</p>
        ) : listError ? (
          <p className="text-[11px] text-destructive">{listError}</p>
        ) : attachments.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No attachments yet.</p>
        ) : (
          attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-[12px] font-medium text-foreground">{attachment.fileName}</p>
                <p className="text-[10px] text-muted-foreground">
                  {ATTACHMENT_KINDS.find((k) => k.value === attachment.kind)?.label ?? attachment.kind} ·{" "}
                  {formatBytes(attachment.byteSize)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <a
                  href={`/api/quotes/${quoteId}/attachments/${attachment.id}`}
                  className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title="Download"
                >
                  <Download className="h-3.5 w-3.5" />
                </a>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(attachment)}
                  className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {deleteError ? (
        <p role="alert" className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
          {deleteError}
        </p>
      ) : null}

      {confirmDelete ? (
        <ConfirmDialog
          title="Delete attachment"
          message={`Delete "${confirmDelete.fileName}"? This cannot be undone.`}
          confirmLabel="Delete"
          destructive
          onConfirm={() => handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      ) : null}
    </div>
  );
}
