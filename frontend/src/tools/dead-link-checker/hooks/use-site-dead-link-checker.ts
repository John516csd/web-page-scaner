"use client";

import { useState, useCallback, useRef } from "react";
import { apiPost } from "@/lib/api";
import type {
  SiteDeadLinkRequest,
  PageDeadLinkResult,
  DeadLinkOptions,
} from "../types";

export function useSiteDeadLinkChecker() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paths, setPaths] = useState<string[]>([]);
  const [results, setResults] = useState<PageDeadLinkResult[]>([]);
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
        "/tools/dead-link-checker/sitemap",
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
      baseUrl: string,
      pagePaths: string[],
      batchSize: number,
      startIndex: number,
      options?: DeadLinkOptions
    ) => {
      setLoading(true);
      setError(null);
      setBatchDone(false);
      setCurrentBatch(null);

      if (startIndex === 0) {
        setResults([]);
      }

      try {
        const body: SiteDeadLinkRequest = {
          baseUrl,
          paths: pagePaths,
          batchSize,
          startIndex,
          options,
        };

        const data = await apiPost<{
          taskId: string;
          totalPages: number;
          currentBatch: { start: number; end: number };
        }>("/tools/dead-link-checker/site-check", body);

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
              setResults((prev) => [...prev, msg.data as PageDeadLinkResult]);
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

          if (msg.type === "cancelled") {
            setLoading(false);
            setBatchDone(true);
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

  const stop = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setLoading(false);
    setBatchDone(true);
    setCurrentBatch(null);
  }, []);

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
    stop,
    reset,
  };
}
