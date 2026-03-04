"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Loader2,
  Filter,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  Globe,
  Layers,
  Settings2,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import type { DeadLinkOptions } from "../types";

export interface SiteDeadLinkFormState {
  baseUrl: string;
  paths: string[];
  batchSize: number;
  options: DeadLinkOptions;
}

function ConfirmedSummary({
  state,
  onReset,
  loading,
  autoRun,
  onAutoRunChange,
}: {
  state: SiteDeadLinkFormState;
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
          检查配置
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

      <div className="flex items-start gap-2.5 rounded-lg border bg-muted/30 px-3.5 py-2.5">
        <Globe className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground mb-0.5">目标站点</p>
          <p className="text-sm font-mono truncate">{state.baseUrl}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <div className="flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">检查页面:</span>
          <span className="font-medium">{state.paths.length} 个</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">每批:</span>
          <span className="font-medium">{state.batchSize} 个</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">链接并发:</span>
          <span className="font-medium">{state.options.concurrency ?? 5}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">页面并发:</span>
          <span className="font-medium">{state.options.pageConcurrency ?? 2}</span>
        </div>
        {state.options.checkExternal === false && (
          <Badge variant="secondary" className="text-xs">
            跳过外链
          </Badge>
        )}
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

export function SiteDeadLinkForm({
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
  onSubmit: (params: SiteDeadLinkFormState) => void;
  onReset: () => void;
  loading: boolean;
  paths: string[];
  totalPages: number;
  confirmed: boolean;
  confirmedState: SiteDeadLinkFormState | null;
  autoRun: boolean;
  onAutoRunChange: (v: boolean) => void;
}) {
  const [baseUrl, setBaseUrl] = useState("");
  const [batchSize, setBatchSize] = useState("10");
  const [sitemapUrl, setSitemapUrl] = useState("");
  const [loadingSitemap, setLoadingSitemap] = useState(false);
  const [showPaths, setShowPaths] = useState(false);
  const [showSitemapInput, setShowSitemapInput] = useState(false);
  const [sitemapError, setSitemapError] = useState("");
  const [sitemapSuccess, setSitemapSuccess] = useState("");
  const [filterInput, setFilterInput] = useState("");
  const [extraPaths, setExtraPaths] = useState("");

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [concurrency, setConcurrency] = useState(5);
  const [pageConcurrency, setPageConcurrency] = useState(2);
  const [timeoutMs, setTimeoutMs] = useState(10000);
  const [checkExternal, setCheckExternal] = useState(true);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAutoLoadedOrigin = useRef<string>("");

  const loadSitemapByUrl = useCallback(
    async (url: string) => {
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
    },
    [onLoadSitemap]
  );

  const handleBaseUrlChange = (value: string) => {
    setBaseUrl(value);
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
    if (!baseUrl.trim() || effectivePaths.length === 0) return;
    onSetPaths(effectivePaths);
    onSubmit({
      baseUrl: baseUrl.trim(),
      paths: effectivePaths,
      batchSize: parseInt(batchSize),
      options: { concurrency, pageConcurrency, timeoutMs, checkExternal },
    });
  };

  const handleReset = () => {
    setBaseUrl("");
    setSitemapUrl("");
    setSitemapError("");
    setSitemapSuccess("");
    setFilterInput("");
    setExtraPaths("");
    setShowPaths(false);
    setShowSitemapInput(false);
    setShowAdvanced(false);
    setBatchSize("10");
    setConcurrency(5);
    setPageConcurrency(2);
    setTimeoutMs(10000);
    setCheckExternal(true);
    lastAutoLoadedOrigin.current = "";
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onReset();
  };

  const hasFilters = filterPatterns.length > 0;
  const isFiltered = hasFilters && sitemapPaths.length > 0;

  if (confirmed && confirmedState) {
    return <ConfirmedSummary state={confirmedState} onReset={onReset} loading={loading} autoRun={autoRun} onAutoRunChange={onAutoRunChange} />;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="site-baseUrl">目标站点 URL</Label>
        <Input
          id="site-baseUrl"
          type="url"
          value={baseUrl}
          onChange={(e) => handleBaseUrlChange(e.target.value)}
          placeholder="https://www.example.com"
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
                  {showPaths ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
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
          <Label htmlFor="site-filter" className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5" />
            路径过滤
            <span className="font-normal text-muted-foreground">
              （可选，每行一个）
            </span>
          </Label>
          <Textarea
            id="site-filter"
            value={filterInput}
            onChange={(e) => setFilterInput(e.target.value)}
            placeholder={"/en/*\n/blog/**\n/en/pricing"}
            rows={3}
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            支持 glob 通配符：
            <code className="rounded bg-muted px-1">*</code> 匹配单层路径，
            <code className="rounded bg-muted px-1">**</code>{" "}
            匹配多层路径。不填则检查全部页面。
          </p>
          {isFiltered && (
            <p className="text-sm text-muted-foreground">
              过滤后剩余{" "}
              <span className="font-medium text-foreground">
                {filterPaths(sitemapPaths, filterPatterns).length}
              </span>{" "}
              个页面
              {extraPathsList.length > 0 && (
                <>
                  ，加上手动追加共{" "}
                  <span className="font-medium text-foreground">
                    {effectivePaths.length}
                  </span>{" "}
                  个
                </>
              )}
            </p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="site-extraPaths">
          手动追加路径
          <span className="font-normal text-muted-foreground">
            （可选，每行一个精确路径）
          </span>
        </Label>
        <Textarea
          id="site-extraPaths"
          value={extraPaths}
          onChange={(e) => setExtraPaths(e.target.value)}
          placeholder={"/special-page\n/unlisted-page"}
          rows={3}
          className="font-mono"
        />
      </div>

      {effectivePaths.length > 0 && (
        <p className="text-sm text-muted-foreground">
          共计{" "}
          <span className="font-medium text-foreground">
            {effectivePaths.length}
          </span>{" "}
          个页面将参与检查
        </p>
      )}

      <Separator />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="site-batchSize" className="whitespace-nowrap">
            每批检查
          </Label>
          <Select value={batchSize} onValueChange={setBatchSize}>
            <SelectTrigger id="site-batchSize" className="w-20 h-8">
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

      <div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="gap-1 px-0 text-muted-foreground hover:text-foreground"
        >
          {showAdvanced ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          高级选项
        </Button>

        {showAdvanced && (
          <div className="mt-3 space-y-4 rounded-lg border p-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="site-concurrency">链接并发 (1–20)</Label>
                <Input
                  id="site-concurrency"
                  type="number"
                  min={1}
                  max={20}
                  value={concurrency}
                  onChange={(e) =>
                    setConcurrency(parseInt(e.target.value) || 5)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="site-pageConcurrency">页面并发 (1–5)</Label>
                <Input
                  id="site-pageConcurrency"
                  type="number"
                  min={1}
                  max={5}
                  value={pageConcurrency}
                  onChange={(e) =>
                    setPageConcurrency(parseInt(e.target.value) || 2)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="site-timeout">超时 (ms)</Label>
                <Input
                  id="site-timeout"
                  type="number"
                  min={1000}
                  step={1000}
                  value={timeoutMs}
                  onChange={(e) =>
                    setTimeoutMs(parseInt(e.target.value) || 10000)
                  }
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="site-checkExternal"
                checked={checkExternal}
                onCheckedChange={setCheckExternal}
              />
              <Label htmlFor="site-checkExternal" className="cursor-pointer">
                检查外链
              </Label>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Button
          type="submit"
          disabled={loading || !baseUrl.trim() || effectivePaths.length === 0}
        >
          {loading ? (
            <>
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              检查中...
            </>
          ) : (
            <>
              开始检查 (第 1-
              {Math.min(parseInt(batchSize), effectivePaths.length)} 个，共{" "}
              {effectivePaths.length} 个)
              <ArrowRight className="ml-1 h-4 w-4" />
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleReset}
          disabled={loading}
        >
          <RotateCcw className="mr-1 h-4 w-4" />
          重置
        </Button>
      </div>
    </form>
  );
}
