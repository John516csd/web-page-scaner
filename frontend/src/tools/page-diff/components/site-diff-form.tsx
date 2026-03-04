"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { ArrowRight, ChevronDown, ChevronUp, Loader2, Filter, AlertCircle, CheckCircle2, RotateCcw, Globe, GitCompareArrows, Layers, Settings2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { filterPaths } from "@/lib/glob";
import type { DiffOptions, CheckType } from "../types";

interface ConfirmedState {
  baseUrlA: string;
  baseUrlB: string;
  paths: string[];
  checks: CheckType[];
  batchSize: number;
  options?: DiffOptions;
}

function ConfirmedSummary({
  state,
  onReset,
  loading,
  autoRun,
  onAutoRunChange,
}: {
  state: ConfirmedState;
  onReset: () => void;
  loading: boolean;
  autoRun: boolean;
  onAutoRunChange: (v: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Settings2 className="h-4 w-4" />
          对比配置
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onReset}
          disabled={loading}
        >
          <RotateCcw className="mr-1 h-3.5 w-3.5" />
          重置
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="flex items-start gap-2.5 rounded-lg border bg-muted/30 px-3.5 py-2.5">
          <Globe className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground mb-0.5">基准站点</p>
            <p className="text-sm font-mono truncate">{state.baseUrlA}</p>
          </div>
        </div>
        <div className="flex items-start gap-2.5 rounded-lg border bg-muted/30 px-3.5 py-2.5">
          <GitCompareArrows className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground mb-0.5">对比站点</p>
            <p className="text-sm font-mono truncate">{state.baseUrlB}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <div className="flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">对比页面:</span>
          <span className="font-medium">{state.paths.length} 个</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">每批:</span>
          <span className="font-medium">{state.batchSize} 个</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">页面并发:</span>
          <span className="font-medium">{state.options?.pageConcurrency ?? 2}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">检查项:</span>
          <div className="flex gap-1">
            {state.checks.map((check) => (
              <Badge key={check} variant="secondary" className="text-xs">
                {check.toUpperCase()}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Switch
            id="confirmed-autoRun"
            checked={autoRun}
            onCheckedChange={onAutoRunChange}
          />
          <Label htmlFor="confirmed-autoRun" className="cursor-pointer whitespace-nowrap">
            自动跑完全部
          </Label>
        </div>
      </div>
    </div>
  );
}

export function SiteDiffForm({
  onLoadSitemap,
  onSetPaths,
  onSubmit,
  onReset,
  loading,
  paths: sitemapPaths,
  totalPages,
  confirmed,
  confirmedState,
  autoRun,
  onAutoRunChange,
}: {
  onLoadSitemap: (url: string) => Promise<{ paths: string[]; total: number } | null>;
  onSetPaths: (paths: string[]) => void;
  onSubmit: (params: {
    baseUrlA: string;
    baseUrlB: string;
    paths: string[];
    checks: CheckType[];
    batchSize: number;
    options?: DiffOptions;
  }) => void;
  onReset: () => void;
  loading: boolean;
  paths: string[];
  totalPages: number;
  confirmed: boolean;
  confirmedState: ConfirmedState | null;
  autoRun: boolean;
  onAutoRunChange: (v: boolean) => void;
}) {
  if (confirmed && confirmedState) {
    return <ConfirmedSummary state={confirmedState} onReset={onReset} loading={loading} autoRun={autoRun} onAutoRunChange={onAutoRunChange} />;
  }
  const [baseUrlA, setBaseUrlA] = useState("");
  const [baseUrlB, setBaseUrlB] = useState("");
  const [checks, setChecks] = useState<CheckType[]>(["http", "seo", "content", "visual"]);
  const [batchSize, setBatchSize] = useState("10");
  const [pageConcurrency, setPageConcurrency] = useState(2);
  const [sitemapUrl, setSitemapUrl] = useState("");
  const [loadingSitemap, setLoadingSitemap] = useState(false);
  const [showPaths, setShowPaths] = useState(false);
  const [showSitemapInput, setShowSitemapInput] = useState(false);

  const [sitemapError, setSitemapError] = useState("");
  const [sitemapSuccess, setSitemapSuccess] = useState("");
  const [filterInput, setFilterInput] = useState("");
  const [extraPaths, setExtraPaths] = useState("");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAutoLoadedOrigin = useRef<string>("");

  const toggleCheck = (check: CheckType) => {
    setChecks((prev) =>
      prev.includes(check) ? prev.filter((c) => c !== check) : [...prev, check]
    );
  };

  const loadSitemapByUrl = useCallback(async (url: string) => {
    if (!url) return;
    setLoadingSitemap(true);
    setSitemapError("");
    setSitemapSuccess("");
    setShowSitemapInput(false);
    try {
      const result = await onLoadSitemap(url);
      if (!result || result.paths.length === 0) {
        setSitemapError(
          "未解析到任何页面路径，请检查 URL 是否正确，或尝试其他地址（如 /sitemap-index.xml、/sitemap-pages.xml 等）。"
        );
      } else {
        setSitemapSuccess(`已从 ${url} 加载 ${result.paths.length} 个页面路径`);
      }
    } catch {
      setSitemapError("Sitemap 加载失败，请检查 URL 是否可访问。");
    } finally {
      setLoadingSitemap(false);
    }
  }, [onLoadSitemap]);

  const handleBaselineChange = (value: string) => {
    setBaseUrlA(value);
    try {
      const url = new URL(value);
      const newSitemapUrl = `${url.origin}/sitemap.xml`;
      setSitemapUrl(newSitemapUrl);

      if (url.origin !== lastAutoLoadedOrigin.current) {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          lastAutoLoadedOrigin.current = url.origin;
          loadSitemapByUrl(newSitemapUrl);
        }, 800);
      }
    } catch {
      // not a valid URL yet
    }
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleLoadSitemap = () => {
    if (!sitemapUrl.trim()) return;
    lastAutoLoadedOrigin.current = "";
    loadSitemapByUrl(sitemapUrl.trim());
  };

  const filterPatterns = useMemo(
    () =>
      filterInput
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
    [filterInput]
  );

  const extraPathsList = useMemo(
    () =>
      extraPaths
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
    [extraPaths]
  );

  const filteredPaths = useMemo(() => {
    const filtered =
      filterPatterns.length > 0
        ? filterPaths(sitemapPaths, filterPatterns)
        : sitemapPaths;
    const combined = [...filtered, ...extraPathsList];
    return [...new Set(combined)];
  }, [sitemapPaths, filterPatterns, extraPathsList]);

  const effectivePaths = filteredPaths;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!baseUrlA.trim() || !baseUrlB.trim() || effectivePaths.length === 0) return;
    onSetPaths(effectivePaths);
    onSubmit({
      baseUrlA: baseUrlA.trim(),
      baseUrlB: baseUrlB.trim(),
      paths: effectivePaths,
      checks,
      batchSize: parseInt(batchSize),
      options: { pageConcurrency },
    });
  };

  const handleReset = () => {
    setBaseUrlA("");
    setBaseUrlB("");
    setSitemapUrl("");
    setSitemapError("");
    setSitemapSuccess("");
    setFilterInput("");
    setExtraPaths("");
    setShowPaths(false);
    setShowSitemapInput(false);
    setChecks(["http", "seo", "content", "visual"]);
    setBatchSize("10");
    setPageConcurrency(2);
    lastAutoLoadedOrigin.current = "";
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onReset();
  };

  const hasFilters = filterPatterns.length > 0;
  const isFiltered = hasFilters && sitemapPaths.length > 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="baseline">基准站点 (Baseline)</Label>
        <Input
          id="baseline"
          type="url"
          value={baseUrlA}
          onChange={(e) => handleBaselineChange(e.target.value)}
          placeholder="https://www.example.com"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="compare">对比站点 (Compare)</Label>
        <Input
          id="compare"
          type="url"
          value={baseUrlB}
          onChange={(e) => setBaseUrlB(e.target.value)}
          placeholder="https://staging.example.com"
          required
        />
      </div>

      <Separator />

      <div className="space-y-3">
        {loadingSitemap && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            正在从 {sitemapUrl} 加载页面...
          </p>
        )}

        {!loadingSitemap && sitemapSuccess && !sitemapError && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span className="text-emerald-600">{sitemapSuccess}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto px-1.5 py-0.5 text-xs text-muted-foreground"
                onClick={() => setShowSitemapInput(true)}
              >
                <Pencil className="mr-1 h-3 w-3" />
                修改
              </Button>
            </div>
            {sitemapPaths.length > 0 && (
              <div>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto gap-1 p-0"
                  onClick={() => setShowPaths(!showPaths)}
                >
                  查看全部 {sitemapPaths.length} 个路径
                  {showPaths ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </Button>
                {showPaths && (
                  <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border bg-muted p-3 text-xs font-mono">
                    {sitemapPaths.map((p, i) => (
                      <div key={i} className="py-0.5 text-muted-foreground">
                        {p}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {!loadingSitemap && sitemapError && (
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {sitemapError}
            </p>
            {!showSitemapInput && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto px-1.5 py-0.5 text-xs"
                onClick={() => setShowSitemapInput(true)}
              >
                <Pencil className="mr-1 h-3 w-3" />
                修改 Sitemap URL
              </Button>
            )}
          </div>
        )}

        {showSitemapInput && (
          <div className="space-y-2">
            <Label>Sitemap URL</Label>
            <div className="flex gap-2">
              <Input
                type="url"
                value={sitemapUrl}
                onChange={(e) => {
                  setSitemapUrl(e.target.value);
                  setSitemapError("");
                  setSitemapSuccess("");
                }}
                placeholder="https://www.example.com/sitemap.xml"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleLoadSitemap}
                disabled={loadingSitemap || !sitemapUrl.trim()}
              >
                加载
              </Button>
            </div>
          </div>
        )}
      </div>

      {sitemapPaths.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="filter" className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5" />
            路径过滤
            <span className="font-normal text-muted-foreground">（可选，每行一个）</span>
          </Label>
          <Textarea
            id="filter"
            value={filterInput}
            onChange={(e) => setFilterInput(e.target.value)}
            placeholder={"/en/*\n/blog/**\n/en/pricing"}
            rows={3}
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            支持 glob 通配符：<code className="rounded bg-muted px-1">*</code> 匹配单层路径（如 /en/* 匹配 /en/pricing），<code className="rounded bg-muted px-1">**</code> 匹配多层路径（如 /en/** 匹配 /en/blog/post-1）。也可直接写精确路径。不填则对比全部页面。
          </p>
          {isFiltered && (
            <p className="text-sm text-muted-foreground">
              过滤后剩余 <span className="font-medium text-foreground">{filterPaths(sitemapPaths, filterPatterns).length}</span> 个页面
              {extraPathsList.length > 0 && (
                <>，加上手动追加共 <span className="font-medium text-foreground">{effectivePaths.length}</span> 个</>
              )}
            </p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="extraPaths">
          手动追加路径
          <span className="font-normal text-muted-foreground">（可选，每行一个精确路径，会与上方结果合并）</span>
        </Label>
        <Textarea
          id="extraPaths"
          value={extraPaths}
          onChange={(e) => setExtraPaths(e.target.value)}
          placeholder={"/special-page\n/unlisted-page"}
          rows={3}
          className="font-mono"
        />
        <p className="text-xs text-muted-foreground">
          仅支持精确路径。如需通配符匹配，请先加载 Sitemap 后在上方「路径过滤」中使用 glob 模式（如 /en/*）。
        </p>
      </div>

      {effectivePaths.length > 0 && (
        <p className="text-sm text-muted-foreground">
          共计 <span className="font-medium text-foreground">{effectivePaths.length}</span> 个页面将参与对比
        </p>
      )}

      <Separator />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="batchSize" className="whitespace-nowrap">每批对比</Label>
          <Select value={batchSize} onValueChange={setBatchSize}>
            <SelectTrigger id="batchSize" className="w-20 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[5, 10, 20, 50].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">页</span>
        </div>

        <Separator orientation="vertical" className="h-5" />

        <div className="flex items-center gap-2">
          <Label htmlFor="site-pageConcurrency" className="whitespace-nowrap">页面并发</Label>
          <Input
            id="site-pageConcurrency"
            type="number"
            min={1}
            max={5}
            value={pageConcurrency}
            onChange={(e) => setPageConcurrency(parseInt(e.target.value) || 2)}
            className="w-16 h-8"
          />
        </div>

        <Separator orientation="vertical" className="h-5" />

        <div className="flex items-center gap-4">
          <Label className="whitespace-nowrap">检查项</Label>
          {(["http", "seo", "content", "visual"] as const).map((check) => (
            <div key={check} className="flex items-center gap-1.5">
              <Checkbox
                id={`site-check-${check}`}
                checked={checks.includes(check)}
                onCheckedChange={() => toggleCheck(check)}
              />
              <Label htmlFor={`site-check-${check}`} className="cursor-pointer font-normal text-sm">
                {check.toUpperCase()}
              </Label>
            </div>
          ))}
        </div>

        <Separator orientation="vertical" className="h-5" />

        <div className="flex items-center gap-2">
          <Switch
            id="site-autoRun"
            checked={autoRun}
            onCheckedChange={onAutoRunChange}
          />
          <Label htmlFor="site-autoRun" className="cursor-pointer whitespace-nowrap">
            自动跑完全部
          </Label>
        </div>
      </div>

      <div className="flex gap-3">
        <Button
          type="submit"
          disabled={loading || !baseUrlA.trim() || !baseUrlB.trim() || effectivePaths.length === 0}
        >
          {loading ? (
            <>
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              对比中...
            </>
          ) : (
            <>
              开始对比 (第 1-{Math.min(parseInt(batchSize), effectivePaths.length)} 个，共 {effectivePaths.length} 个)
              <ArrowRight className="ml-1 h-4 w-4" />
            </>
          )}
        </Button>
        <Button type="button" variant="outline" onClick={handleReset} disabled={loading}>
          <RotateCcw className="mr-1 h-4 w-4" />
          重置
        </Button>
      </div>
    </form>
  );
}
