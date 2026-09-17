"use client";

import { useEffect, useState } from "react";
import { History, Loader2, RotateCcw, ScrollText } from "lucide-react";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type VersionRow = {
  version: number;
  changeNotes: string | null;
  changesSummaryJson: { description: string } | null;
  createdAt: string;
  creator: { fullName: string; email: string } | null;
};

const AUDIT_ACTION_LABELS: Record<string, string> = {
  "quote.create": "Quote created",
  "quote.update": "Quote updated",
  "quote.restore": "Version restored",
  "quote.delete": "Quote deleted",
};

type AuditLogRow = {
  id: string;
  action: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user: { fullName: string; email: string } | null;
};

export function VersionHistoryPanel({
  quoteId,
  currentVersion,
  onRestored,
}: {
  quoteId: string;
  currentVersion: number;
  onRestored: () => void;
}) {
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restoringVersion, setRestoringVersion] = useState<number | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [confirmVersion, setConfirmVersion] = useState<number | null>(null);

  async function loadVersions() {
    try {
      const response = await fetch(`/api/quotes/${quoteId}/versions`);
      const result = await response.json();
      if (!result.success) throw new Error(result.message);
      setVersions(result.data);
      setError(null);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : "Failed to load version history.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount
    loadVersions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteId]);

  async function performRestore(version: number) {
    setConfirmVersion(null);
    setRestoreError(null);
    setRestoringVersion(version);
    try {
      const response = await fetch(`/api/quotes/${quoteId}/versions/${version}/restore`, { method: "POST" });
      const result = await response.json();
      if (!result.success) throw new Error(result.message);

      await loadVersions();
      onRestored();
    } catch (exception) {
      setRestoreError(exception instanceof Error ? exception.message : "Restore failed.");
    } finally {
      setRestoringVersion(null);
    }
  }

  return (
    <div className="rounded-[8px] border border-border bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <History className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Version History</h3>
      </div>

      {isLoading ? (
        <p className="text-[11px] text-muted-foreground">Loading…</p>
      ) : error ? (
        <p className="text-[11px] text-destructive">{error}</p>
      ) : versions.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">No versions yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {versions.map((row) => (
            <div
              key={row.version}
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-foreground">
                    v{row.version}
                  </span>
                  {row.version === currentVersion ? (
                    <span className="text-[10px] font-medium uppercase tracking-wide text-primary">Current</span>
                  ) : null}
                </div>
                <p className="mt-1 truncate text-[12px] text-foreground">
                  {row.changeNotes || row.changesSummaryJson?.description || "Initial version"}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {row.creator?.fullName ?? "Unknown"} · {new Date(row.createdAt).toLocaleString()}
                </p>
              </div>
              {row.version !== currentVersion ? (
                <button
                  type="button"
                  disabled={restoringVersion !== null}
                  onClick={() => setConfirmVersion(row.version)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {restoringVersion === row.version ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3.5 w-3.5" />
                  )}
                  Restore
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {restoreError ? (
        <p role="alert" className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
          {restoreError}
        </p>
      ) : null}

      {confirmVersion !== null ? (
        <ConfirmDialog
          title="Restore version"
          message={`Restore this quote to version ${confirmVersion}? This creates a new version from that snapshot — nothing is deleted.`}
          confirmLabel="Restore"
          onConfirm={() => performRestore(confirmVersion)}
          onCancel={() => setConfirmVersion(null)}
        />
      ) : null}
    </div>
  );
}

function describeAuditLog(log: AuditLogRow): string {
  const label = AUDIT_ACTION_LABELS[log.action] ?? log.action;
  const metadata = log.metadata as { fromVersion?: number; toVersion?: number } | null;
  if (metadata?.fromVersion !== undefined && metadata.toVersion !== undefined) {
    return `${label} (v${metadata.fromVersion} → v${metadata.toVersion})`;
  }
  return label;
}

export function ActivityLogPanel({ quoteId }: { quoteId: string }) {
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/quotes/${quoteId}/logs`)
      .then((response) => response.json())
      .then((result) => {
        if (!result.success) throw new Error(result.message);
        setLogs(result.data);
      })
      .catch((exception) => setError(exception instanceof Error ? exception.message : "Failed to load activity."))
      .finally(() => setIsLoading(false));
  }, [quoteId]);

  return (
    <div className="rounded-[8px] border border-border bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <ScrollText className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Activity Log</h3>
      </div>

      {isLoading ? (
        <p className="text-[11px] text-muted-foreground">Loading…</p>
      ) : error ? (
        <p className="text-[11px] text-destructive">{error}</p>
      ) : logs.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">No activity yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {logs.map((log, index) => (
            <div key={log.id} className="relative flex gap-3 pl-1">
              <div className="flex flex-col items-center">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                {index < logs.length - 1 ? <span className="mt-1 w-px flex-1 bg-border" /> : null}
              </div>
              <div className="min-w-0 pb-3">
                <p className="text-[12px] text-foreground">{describeAuditLog(log)}</p>
                <p className="text-[10px] text-muted-foreground">
                  {log.user?.fullName ?? "System"} · {new Date(log.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
