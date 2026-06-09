"use client";

import { useCallback, useRef, useState } from "react";
import { apiPost, createWebSocket } from "@/lib/api";
import type {
  AcceptanceRequest,
  AcceptanceResult,
  AcceptanceSection,
} from "../types";

export function useMigrationAcceptance() {
  const [loading, setLoading] = useState(false);
  const [currentSuite, setCurrentSuite] = useState<string | null>(null);
  const [sections, setSections] = useState<AcceptanceSection[]>([]);
  const [result, setResult] = useState<AcceptanceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [slackSent, setSlackSent] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const run = useCallback(async (request: AcceptanceRequest) => {
    setLoading(true);
    setCurrentSuite(null);
    setSections([]);
    setResult(null);
    setError(null);
    setSlackSent(false);

    try {
      const { taskId } = await apiPost<{ taskId: string }>(
        "/tools/migration-acceptance/run",
        request
      );
      const ws = createWebSocket(taskId);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        if (msg.type === "progress") {
          setCurrentSuite(msg.step || null);
          if (msg.status === "done" && msg.data?.items) {
            const section = msg.data as AcceptanceSection;
            setSections((prev) => [
              ...prev.filter((item) => item.suite !== section.suite),
              section,
            ]);
          }
        } else if (msg.type === "complete") {
          const nextResult = msg.result as AcceptanceResult;
          setResult(nextResult);
          setSections(nextResult.sections);
          setLoading(false);
          setCurrentSuite(null);
          ws.close();
        } else if (msg.type === "slack_sent") {
          setSlackSent(true);
        } else if (msg.type === "error") {
          setError(msg.message || "Migration Acceptance failed");
          setLoading(false);
          ws.close();
        } else if (msg.type === "cancelled") {
          setLoading(false);
          setCurrentSuite(null);
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
    wsRef.current?.close();
    wsRef.current = null;
    setLoading(false);
    setCurrentSuite(null);
  }, []);

  return {
    loading,
    currentSuite,
    sections,
    result,
    error,
    slackSent,
    run,
    stop,
  };
}
