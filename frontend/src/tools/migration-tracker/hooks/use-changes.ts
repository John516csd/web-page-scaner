"use client";

import { useState, useCallback } from "react";
import type { ChangeRecord, ChangeStatus } from "../types";

const API = "/api/tools/migration-tracker";

export function useChanges(sessionId: number) {
  const [changes, setChanges] = useState<ChangeRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadChanges = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/sessions/${sessionId}/changes`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setChanges(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const importCsv = useCallback(
    async (csv: string) => {
      setImporting(true);
      setError(null);
      try {
        const res = await fetch(`${API}/sessions/${sessionId}/changes/import`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ csv }),
        });
        if (!res.ok) throw new Error(await res.text());
        const { imported } = await res.json();
        await loadChanges();
        return imported as number;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return 0;
      } finally {
        setImporting(false);
      }
    },
    [sessionId, loadChanges]
  );

  const updateStatus = useCallback(
    async (changeId: number, status: ChangeStatus) => {
      try {
        const res = await fetch(`${API}/sessions/${sessionId}/changes/${changeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        if (!res.ok) throw new Error(await res.text());
        setChanges((prev) =>
          prev.map((c) => (c.id === changeId ? { ...c, status } : c))
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [sessionId]
  );

  const deleteChange = useCallback(
    async (changeId: number) => {
      try {
        const res = await fetch(`${API}/sessions/${sessionId}/changes/${changeId}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error(await res.text());
        setChanges((prev) => prev.filter((c) => c.id !== changeId));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [sessionId]
  );

  const deleteAllChanges = useCallback(async () => {
    try {
      const res = await fetch(`${API}/sessions/${sessionId}/changes`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      setChanges([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [sessionId]);

  return { changes, loading, importing, error, loadChanges, importCsv, updateStatus, deleteChange, deleteAllChanges };
}
