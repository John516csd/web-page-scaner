"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { apiPost, createWebSocket } from "@/lib/api";
import type {
  AcceptanceItem,
  AcceptanceProgressItem,
  AcceptanceRequest,
  AcceptanceResult,
  AcceptanceSection,
  AcceptanceSuite,
  AcceptanceSuiteProgress,
} from "../types";

const ACCEPTANCE_SUITES = [
  "build-readiness",
  "smoke",
  "routing",
  "seo-geo",
  "page-parity",
  "cms-storyblok",
  "i18n",
  "functional-e2e",
  "visual-responsive",
  "performance",
  "analytics",
  "assets",
  "deploy-monitoring",
  "rollback",
  "post-launch",
] as const satisfies readonly AcceptanceSuite[];

const DEFAULT_SELECTED_SUITE: AcceptanceSuite = "smoke";

interface SuiteItemProgressPayload {
  kind: "suite-item";
  suite: AcceptanceSuite;
  itemId: number | string;
  itemName: string;
  index: number;
  total: number;
  item?: AcceptanceItem;
}

export function useMigrationAcceptance() {
  const [loading, setLoading] = useState(false);
  const [currentSuite, setCurrentSuite] = useState<string | null>(null);
  const [currentItem, setCurrentItem] = useState<AcceptanceProgressItem | null>(null);
  const [selectedSuite, setSelectedSuite] = useState<AcceptanceSuite | null>(DEFAULT_SELECTED_SUITE);
  const [suiteProgress, setSuiteProgress] = useState<Partial<Record<AcceptanceSuite, AcceptanceSuiteProgress>>>({});
  const [sections, setSections] = useState<AcceptanceSection[]>([]);
  const [result, setResult] = useState<AcceptanceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [slackSent, setSlackSent] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const manualSuiteSelectionRef = useRef(false);

  const run = useCallback(async (request: AcceptanceRequest) => {
    setLoading(true);
    setCurrentSuite(null);
    setCurrentItem(null);
    setSelectedSuite(DEFAULT_SELECTED_SUITE);
    setSuiteProgress({});
    setSections([]);
    setResult(null);
    setError(null);
    setSlackSent(false);
    manualSuiteSelectionRef.current = false;

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
          const suite = isAcceptanceSuite(msg.step) ? msg.step : null;
          const itemPayload = parseSuiteItemProgress(msg.data);

          if (itemPayload) {
            const progressItem = toProgressItem(itemPayload, msg.status === "running" ? "running" : itemPayload.item?.status || (msg.status === "error" ? "fail" : "pass"));
            setSuiteProgress((prev) => updateSuiteProgress(prev, itemPayload.suite, (progress) => {
              const items = upsertProgressItem(progress.items, progressItem);
              return deriveSuiteProgress({
                ...progress,
                status: msg.status === "running" ? "running" : progress.status,
                total: Math.max(progress.total, itemPayload.total),
                currentItem: msg.status === "running" ? progressItem : undefined,
                items,
              });
            }));
            setCurrentItem(msg.status === "running" ? progressItem : null);
            if (!manualSuiteSelectionRef.current) {
              setSelectedSuite(itemPayload.suite);
            }
            return;
          }

          setCurrentSuite(suite || msg.step || null);
          if (suite && msg.status === "running") {
            setSuiteProgress((prev) => updateSuiteProgress(prev, suite, (progress) => ({
              ...progress,
              status: "running",
            })));
            if (!manualSuiteSelectionRef.current) {
              setSelectedSuite(suite);
            }
          }

          if (msg.status === "done" && msg.data?.items) {
            const section = msg.data as AcceptanceSection;
            setSections((prev) => [
              ...prev.filter((item) => item.suite !== section.suite),
              section,
            ]);
            const sectionSuite = section.suite;
            if (isAcceptanceSuite(sectionSuite)) {
              setSuiteProgress((prev) => ({
                ...prev,
                [sectionSuite]: sectionToSuiteProgress(section),
              }));
            }
          }
        } else if (msg.type === "complete") {
          const nextResult = msg.result as AcceptanceResult;
          setResult(nextResult);
          setSections(nextResult.sections);
          setSuiteProgress((prev) =>
            nextResult.sections.reduce<Partial<Record<AcceptanceSuite, AcceptanceSuiteProgress>>>((nextProgress, section) => {
              const sectionSuite = section.suite;
              if (isAcceptanceSuite(sectionSuite)) {
                nextProgress[sectionSuite] = sectionToSuiteProgress(section);
              }
              return nextProgress;
            }, { ...prev })
          );
          setLoading(false);
          setCurrentSuite(null);
          setCurrentItem(null);
          ws.close();
        } else if (msg.type === "slack_sent") {
          setSlackSent(true);
        } else if (msg.type === "error") {
          setError(msg.message || "Migration Acceptance failed");
          setLoading(false);
          setCurrentItem(null);
          ws.close();
        } else if (msg.type === "cancelled") {
          setLoading(false);
          setCurrentSuite(null);
          setCurrentItem(null);
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
    setCurrentItem(null);
  }, []);

  const selectSuite = useCallback((suite: AcceptanceSuite) => {
    manualSuiteSelectionRef.current = true;
    setSelectedSuite(suite);
  }, []);

  const selectedSuiteProgress = useMemo(() => {
    if (!selectedSuite) return null;
    return suiteProgress[selectedSuite] || null;
  }, [selectedSuite, suiteProgress]);

  return {
    loading,
    currentSuite,
    currentItem,
    selectedSuite,
    selectedSuiteProgress,
    suiteProgress,
    sections,
    result,
    error,
    slackSent,
    run,
    stop,
    selectSuite,
  };
}

function parseSuiteItemProgress(data: unknown): SuiteItemProgressPayload | null {
  if (!data || typeof data !== "object") return null;
  const payload = data as Partial<SuiteItemProgressPayload>;
  if (payload.kind !== "suite-item") return null;
  if (!isAcceptanceSuite(payload.suite)) return null;
  if (payload.itemId === undefined || !payload.itemName) return null;
  return {
    kind: "suite-item",
    suite: payload.suite,
    itemId: payload.itemId,
    itemName: payload.itemName,
    index: typeof payload.index === "number" ? payload.index : 0,
    total: typeof payload.total === "number" ? payload.total : 0,
    item: payload.item,
  };
}

function toProgressItem(
  payload: SuiteItemProgressPayload,
  status: AcceptanceProgressItem["status"]
): AcceptanceProgressItem {
  return {
    id: payload.item?.id || payload.itemId,
    suite: payload.suite,
    name: payload.item?.name || payload.itemName,
    status,
    index: payload.index,
    total: payload.total,
    item: payload.item,
  };
}

function updateSuiteProgress(
  prev: Partial<Record<AcceptanceSuite, AcceptanceSuiteProgress>>,
  suite: AcceptanceSuite,
  updater: (progress: AcceptanceSuiteProgress) => AcceptanceSuiteProgress
): Partial<Record<AcceptanceSuite, AcceptanceSuiteProgress>> {
  const current = prev[suite] || emptySuiteProgress(suite);
  return {
    ...prev,
    [suite]: updater(current),
  };
}

function emptySuiteProgress(suite: AcceptanceSuite): AcceptanceSuiteProgress {
  return {
    suite,
    status: "pending",
    total: 0,
    completed: 0,
    failed: 0,
    warned: 0,
    items: [],
  };
}

function upsertProgressItem(
  items: AcceptanceProgressItem[],
  nextItem: AcceptanceProgressItem
): AcceptanceProgressItem[] {
  const key = progressItemKey(nextItem);
  const existingIndex = items.findIndex((item) => progressItemKey(item) === key);
  if (existingIndex < 0) {
    return [...items, nextItem].sort((a, b) => a.index - b.index);
  }
  return items.map((item, index) => (index === existingIndex ? { ...item, ...nextItem } : item));
}

function deriveSuiteProgress(progress: AcceptanceSuiteProgress): AcceptanceSuiteProgress {
  const completed = progress.items.filter((item) => item.status !== "pending" && item.status !== "running").length;
  const failed = progress.items.filter((item) => item.status === "fail" || item.status === "blocked").length;
  const warned = progress.items.filter((item) => item.status === "warn").length;
  return {
    ...progress,
    total: Math.max(progress.total, ...progress.items.map((item) => item.total), progress.items.length),
    completed,
    failed,
    warned,
  };
}

function sectionToSuiteProgress(section: AcceptanceSection): AcceptanceSuiteProgress {
  const suite = section.suite as AcceptanceSuite;
  const items = section.items.map((item, index) => ({
    id: item.id,
    suite,
    name: item.name,
    status: item.status,
    index,
    total: section.total,
    item,
  }));
  return {
    suite,
    status: section.status,
    total: section.total,
    completed: section.items.length,
    failed: section.failed,
    warned: section.warned,
    items,
  };
}

function progressItemKey(item: AcceptanceProgressItem): string {
  return `${item.suite}-${item.id}`;
}

function isAcceptanceSuite(value: unknown): value is AcceptanceSuite {
  return typeof value === "string" && (ACCEPTANCE_SUITES as readonly string[]).includes(value);
}
