"use client";

import { useState, useCallback, useRef, useEffect } from "react";

const API = "/api/tools/migration-tracker";

export interface ScanProgress {
  current: number;
  total: number;   // total in current batch
  path: string;
  scanned: number; // total scanned across all batches
  totalPages: number;
}

export function useScan(sessionId: number) {
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [batchDone, setBatchDone] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batchSize, setBatchSize] = useState(50);
  const [autoRun, setAutoRun] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  // Keep a stable ref so autoRun effect doesn't re-register callbacks
  const autoRunRef = useRef(autoRun);
  useEffect(() => { autoRunRef.current = autoRun; }, [autoRun]);

  const runBatch = useCallback(async (size: number) => {
    setScanning(true);
    setBatchDone(false);
    setError(null);

    try {
      const res = await fetch(`${API}/sessions/${sessionId}/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchSize: size }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { taskId } = await res.json();

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws/${taskId}`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        if (msg.type === "batch_progress") {
          setProgress({
            current: msg.current,
            total: msg.total,
            path: msg.path,
            scanned: msg.data?.scanned ?? msg.current,
            totalPages: msg.data?.totalPages ?? 0,
          });
        }

        if (msg.type === "batch_complete") {
          setBatchDone(true);
          setHasMore(msg.hasMore);
          setScanning(false);
          ws.close();
        }

        if (msg.type === "error") {
          setError(msg.message);
          setScanning(false);
          ws.close();
        }

        if (msg.type === "cancelled") {
          setScanning(false);
          ws.close();
        }
      };

      ws.onerror = () => {
        setError("WebSocket 连接失败");
        setScanning(false);
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setScanning(false);
    }
  }, [sessionId]);

  // Auto-run next batch
  useEffect(() => {
    if (batchDone && hasMore && autoRunRef.current && !scanning) {
      runBatch(batchSize);
    }
  }, [batchDone, hasMore, scanning, runBatch, batchSize]);

  const startScan = useCallback(() => runBatch(batchSize), [runBatch, batchSize]);

  const continueScan = useCallback(() => runBatch(batchSize), [runBatch, batchSize]);

  const stopScan = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setScanning(false);
    setAutoRun(false);
  }, []);

  return {
    scanning, progress, batchDone, hasMore, error,
    batchSize, setBatchSize,
    autoRun, setAutoRun,
    startScan, continueScan, stopScan,
  };
}

export function useAnalyze(sessionId: number) {
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState(0);
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const startAnalyze = useCallback(async () => {
    setAnalyzing(true);
    setDone(false);
    setError(null);
    setAnalyzed(0);

    try {
      const res = await fetch(`${API}/sessions/${sessionId}/changes/analyze-all`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      const { taskId } = await res.json();

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws/${taskId}`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        if (msg.type === "progress" && msg.status === "done" && msg.data) {
          setAnalyzed(msg.data.analyzed);
          setTotal(msg.data.total);
        }

        if (msg.type === "complete") {
          setDone(true);
          setAnalyzing(false);
          ws.close();
        }

        if (msg.type === "error") {
          setError(msg.message);
          setAnalyzing(false);
          ws.close();
        }
      };

      ws.onerror = () => {
        setError("WebSocket 连接失败");
        setAnalyzing(false);
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setAnalyzing(false);
    }
  }, [sessionId]);

  return { analyzing, analyzed, total, done, error, startAnalyze };
}
