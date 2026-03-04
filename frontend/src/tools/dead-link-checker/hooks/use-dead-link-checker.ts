"use client";

import { useState, useCallback, useRef } from "react";
import { apiPost } from "@/lib/api";
import type { DeadLinkRequest, DeadLinkResult } from "../types";

export interface DeadLinkProgress {
  checked: number;
  total: number;
  currentUrl: string;
  phase: "extracting" | "checking";
}

export function useDeadLinkChecker() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DeadLinkResult | null>(null);
  const [progress, setProgress] = useState<DeadLinkProgress | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const run = useCallback(async (request: DeadLinkRequest) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setProgress(null);

    try {
      const { taskId } = await apiPost<{ taskId: string }>(
        "/tools/dead-link-checker/check",
        request
      );

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(
        `${protocol}//${window.location.host}/ws/${taskId}`
      );
      wsRef.current = ws;

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "progress") {
          if (data.step === "extracting") {
            setProgress({ checked: 0, total: 0, currentUrl: "", phase: "extracting" });
          } else if (data.step === "checking" && data.status === "running" && data.data) {
            setProgress({
              checked: data.data.checked,
              total: data.data.total,
              currentUrl: data.data.currentUrl ?? "",
              phase: "checking",
            });
          }
        }

        if (data.type === "complete") {
          setResult(data.result as DeadLinkResult);
          setLoading(false);
          setProgress(null);
          ws.close();
        }

        if (data.type === "error") {
          setError(data.message);
          setLoading(false);
          setProgress(null);
          ws.close();
        }
      };

      ws.onerror = () => {
        setError("WebSocket 连接失败");
        setLoading(false);
        setProgress(null);
      };

      ws.onclose = () => {
        setLoading(false);
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
      setProgress(null);
    }
  }, []);

  const reset = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setLoading(false);
    setError(null);
    setResult(null);
    setProgress(null);
  }, []);

  return { loading, error, result, progress, run, reset };
}
