"use client";

import { useState, useCallback, useRef } from "react";
import { apiPost } from "@/lib/api";
import { createWebSocket } from "@/lib/api";
import type { E2ETestCase, E2ETestResult, E2EBatchResult } from "../types";

export function useE2ETester() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<E2ETestResult[]>([]);
  const [summary, setSummary] = useState<E2EBatchResult["summary"] | null>(
    null
  );
  const [currentTest, setCurrentTest] = useState<string | null>(null);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [slackSent, setSlackSent] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);

  const run = useCallback(
    async (
      testCases: E2ETestCase[],
      notifySlack?: boolean,
      collectionName?: string
    ) => {
      setLoading(true);
      setResults([]);
      setSummary(null);
      setCurrentTest(null);
      setProgress(null);
      setError(null);
      setSlackSent(false);

      try {
        const { taskId } = await apiPost<{ taskId: string }>(
          "/tools/e2e-tester/run",
          { testCases, notifySlack, collectionName }
        );

        const ws = createWebSocket(taskId);
        wsRef.current = ws;

        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data);

          if (msg.type === "progress") {
            setCurrentTest(msg.message || null);
            if (
              msg.data?.index !== undefined &&
              msg.data?.total !== undefined
            ) {
              setProgress({
                current: msg.data.index + 1,
                total: msg.data.total,
              });
            }
            if (
              msg.data &&
              "testCase" in msg.data &&
              (msg.status === "done" || msg.status === "error")
            ) {
              setResults((prev) => [...prev, msg.data as E2ETestResult]);
            }
          } else if (msg.type === "complete") {
            const batch = msg.result as E2EBatchResult;
            setSummary(batch.summary);
            setLoading(false);
            setCurrentTest(null);
            ws.close();
          } else if (msg.type === "slack_sent") {
            setSlackSent(true);
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
    },
    []
  );

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
    setSlackSent(false);
  }, [stop]);

  return {
    loading,
    results,
    summary,
    currentTest,
    progress,
    error,
    slackSent,
    run,
    stop,
    reset,
  };
}
