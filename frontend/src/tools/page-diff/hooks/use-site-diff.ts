"use client";

import { useState, useCallback, useRef } from "react";
import { apiPost } from "@/lib/api";
import type { SiteDiffRequest, PageResult, DiffOptions, CheckType } from "../types";

export function useSiteDiff() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paths, setPaths] = useState<string[]>([]);
  const [results, setResults] = useState<PageResult[]>([]);
  const [currentBatch, setCurrentBatch] = useState<{
    current: number;
    total: number;
    path: string;
  } | null>(null);
  const [batchDone, setBatchDone] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextStart, setNextStart] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);

  const loadSitemap = useCallback(async (sitemapUrl: string) => {
    try {
      const data = await apiPost<{ paths: string[]; total: number }>(
        "/tools/page-diff/sitemap",
        { sitemapUrl }
      );
      setPaths(data.paths);
      setTotalPages(data.total);
      return data;
    } catch {
      return null;
    }
  }, []);

  const runBatch = useCallback(
    async (
      baseUrlA: string,
      baseUrlB: string,
      pagePaths: string[],
      checks: CheckType[],
      batchSize: number,
      startIndex: number,
      options?: DiffOptions
    ) => {
      setLoading(true);
      setError(null);
      setBatchDone(false);
      setCurrentBatch(null);

      if (startIndex === 0) {
        setResults([]);
      }

      try {
        const body: SiteDiffRequest = {
          baseUrlA,
          baseUrlB,
          paths: pagePaths,
          checks,
          batchSize,
          startIndex,
          options,
        };

        const data = await apiPost<{
          taskId: string;
          totalPages: number;
          currentBatch: { start: number; end: number };
        }>("/tools/page-diff/site-diff", body);

        setTotalPages(data.totalPages);

        const protocol =
          window.location.protocol === "https:" ? "wss:" : "ws:";
        const ws = new WebSocket(
          `${protocol}//${window.location.host}/ws/${data.taskId}`
        );
        wsRef.current = ws;

        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data);

          if (msg.type === "batch_progress") {
            setCurrentBatch({
              current: msg.current,
              total: msg.total,
              path: msg.path,
            });

            if (msg.status === "done" && msg.data) {
              setResults((prev) => [...prev, msg.data as PageResult]);
            }
          }

          if (msg.type === "batch_complete") {
            setBatchDone(true);
            setHasMore(msg.hasMore);
            setNextStart(msg.nextStart);
            setLoading(false);
            setCurrentBatch(null);
            ws.close();
          }

          if (msg.type === "error") {
            setError(msg.message);
            setLoading(false);
            ws.close();
          }
        };

        ws.onerror = () => {
          setError("WebSocket 连接失败");
          setLoading(false);
        };
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      }
    },
    []
  );

  const reset = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setLoading(false);
    setError(null);
    setPaths([]);
    setResults([]);
    setCurrentBatch(null);
    setBatchDone(false);
    setHasMore(false);
    setNextStart(0);
    setTotalPages(0);
  }, []);

  return {
    loading,
    error,
    paths,
    setPaths,
    results,
    currentBatch,
    batchDone,
    hasMore,
    nextStart,
    totalPages,
    loadSitemap,
    runBatch,
    reset,
  };
}
