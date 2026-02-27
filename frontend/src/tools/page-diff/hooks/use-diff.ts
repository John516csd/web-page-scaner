"use client";

import { useState, useCallback, useRef } from "react";
import { apiPost } from "@/lib/api";
import type {
  DiffRequest,
  DiffResult,
  CheckResult,
  ContentCheckResult,
  VisualCheckResult,
} from "../types";

export type StepStatus = "pending" | "running" | "done" | "error";

export interface StepState {
  id: string;
  label: string;
  status: StepStatus;
  message?: string;
}

export function useDiff() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DiffResult | null>(null);
  const [steps, setSteps] = useState<StepState[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  const runDiff = useCallback(async (request: DiffRequest) => {
    setLoading(true);
    setError(null);
    setResult(null);

    const initialSteps: StepState[] = request.checks.map((check) => ({
      id: check,
      label: check.toUpperCase(),
      status: "pending" as const,
    }));
    setSteps(initialSteps);

    try {
      const { taskId } = await apiPost<{ taskId: string }>(
        "/tools/page-diff/diff",
        request
      );

      const partialResult: DiffResult = {
        urlA: request.urlA,
        urlB: request.urlB,
        timestamp: new Date().toISOString(),
      };

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(
        `${protocol}//${window.location.host}/ws/${taskId}`
      );
      wsRef.current = ws;

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "progress") {
          setSteps((prev) =>
            prev.map((s) =>
              s.id === data.step
                ? { ...s, status: data.status, message: data.message }
                : s
            )
          );

          if (data.status === "done" && data.data) {
            if (data.step === "http") {
              partialResult.http = data.data as CheckResult;
            } else if (data.step === "seo") {
              partialResult.seo = data.data as CheckResult;
            } else if (data.step === "content") {
              partialResult.content = data.data as ContentCheckResult;
            } else if (data.step === "visual") {
              partialResult.visual = data.data as VisualCheckResult;
            }
            setResult({ ...partialResult });
          }
        }

        if (data.type === "complete") {
          setResult(data.result as DiffResult);
          setLoading(false);
          ws.close();
        }

        if (data.type === "error") {
          setError(data.message);
          setLoading(false);
          ws.close();
        }
      };

      ws.onerror = () => {
        setError("WebSocket 连接失败");
        setLoading(false);
      };

      ws.onclose = () => {
        setLoading(false);
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setLoading(false);
    setError(null);
    setResult(null);
    setSteps([]);
  }, []);

  return { loading, error, result, steps, runDiff, reset };
}
