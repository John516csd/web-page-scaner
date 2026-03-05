"use client";

import { useState, useCallback, useRef } from "react";
import { apiPost } from "@/lib/api";
import { createWebSocket } from "@/lib/api";
import type {
  RedirectTestCase,
  RedirectTestResult,
  TestBatchResult,
} from "../types";

export function useRedirectTester() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<RedirectTestResult[]>([]);
  const [summary, setSummary] = useState<TestBatchResult["summary"] | null>(
    null
  );
  const [currentTest, setCurrentTest] = useState<string | null>(null);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  const run = useCallback(async (testCases: RedirectTestCase[], proxy?: string) => {
    setLoading(true);
    setResults([]);
    setSummary(null);
    setCurrentTest(null);
    setProgress(null);
    setError(null);

    try {
      const { taskId } = await apiPost<{ taskId: string }>(
        "/tools/redirect-tester/run",
        { testCases, proxy: proxy || undefined }
      );

      const ws = createWebSocket(taskId);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        if (msg.type === "progress") {
          setCurrentTest(msg.message || null);
          if (msg.data?.index !== undefined && msg.data?.total !== undefined) {
            setProgress({ current: msg.data.index + 1, total: msg.data.total });
          }
          if (
            msg.data &&
            "testCase" in msg.data &&
            (msg.status === "done" || msg.status === "error")
          ) {
            setResults((prev) => [...prev, msg.data as RedirectTestResult]);
          }
        } else if (msg.type === "complete") {
          const batch = msg.result as TestBatchResult;
          setSummary(batch.summary);
          setLoading(false);
          setCurrentTest(null);
          ws.close();
        } else if (msg.type === "error") {
          setError(msg.message);
          setLoading(false);
          ws.close();
        } else if (msg.type === "cancelled") {
          setLoading(false);
          setCurrentTest(null);
          ws.close();
        }
      };

      ws.onerror = () => {
        setError("WebSocket connection error");
        setLoading(false);
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }, []);

  const stop = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setLoading(false);
    setCurrentTest(null);
  }, []);

  const reset = useCallback(() => {
    stop();
    setResults([]);
    setSummary(null);
    setProgress(null);
    setError(null);
  }, [stop]);

  return {
    loading,
    results,
    summary,
    currentTest,
    progress,
    error,
    run,
    stop,
    reset,
  };
}
