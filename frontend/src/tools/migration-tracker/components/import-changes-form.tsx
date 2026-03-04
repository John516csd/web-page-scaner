"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CheckCircle2, FileUp, KeyRound, X } from "lucide-react";

const API = "/api/tools/migration-tracker";
const TOKEN_KEY = "migration_tracker_github_token";

interface Props {
  sessionId: number;
  onImport: (csv: string) => Promise<number>;
  importing: boolean;
  onRefresh: () => void;
}

export function ImportChangesForm({ sessionId, onImport, importing, onRefresh }: Props) {
  const [token, setToken] = useState(() =>
    typeof window !== "undefined" ? (localStorage.getItem(TOKEN_KEY) ?? "") : ""
  );

  const handleTokenChange = (v: string) => {
    setToken(v);
    if (v.trim()) localStorage.setItem(TOKEN_KEY, v.trim());
    else localStorage.removeItem(TOKEN_KEY);
  };

  return (
    <div className="space-y-4">
      {/* Shared GitHub Token — always visible */}
      <div className="rounded-md border bg-muted/30 px-3 py-2.5 space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="gh-token" className="flex items-center gap-1.5 text-sm">
            <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
            GitHub Token
            <span className="font-normal text-muted-foreground">（私有仓库必填，公开仓库可留空）</span>
          </Label>
          <a
            href="https://github.com/settings/tokens/new?scopes=repo&description=MigrationTracker"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-500 hover:underline shrink-0"
          >
            去 GitHub 生成 →
          </a>
        </div>
        <div className="flex gap-2">
          <Input
            id="gh-token"
            type="password"
            placeholder="ghp_xxxxxxxxxxxx"
            value={token}
            onChange={(e) => handleTokenChange(e.target.value)}
            className="font-mono text-xs h-8"
          />
          {token && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-muted-foreground"
              onClick={() => handleTokenChange("")}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        {token && (
          <p className="text-xs text-green-600 flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" />已保存到浏览器本地，下次自动填入
          </p>
        )}
      </div>

      {/* Import methods */}
      <Tabs defaultValue="github">
        <TabsList>
          <TabsTrigger value="github">GitHub PR 链接导入</TabsTrigger>
          <TabsTrigger value="csv">CSV 导入</TabsTrigger>
        </TabsList>

        <TabsContent value="github" className="mt-3">
          <GitHubImport
            sessionId={sessionId}
            token={token}
            onRefresh={onRefresh}
          />
        </TabsContent>

        <TabsContent value="csv" className="mt-3">
          <CsvImport
            sessionId={sessionId}
            token={token}
            onImport={onImport}
            importing={importing}
            onRefresh={onRefresh}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── GitHub PR 链接导入 ─────────────────────────────────────────────────────────

function GitHubImport({
  sessionId,
  token,
  onRefresh,
}: {
  sessionId: number;
  token: string;
  onRefresh: () => void;
}) {
  const [prUrls, setPrUrls] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    imported: number;
    errors: { url: string; error: string }[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const urls = prUrls.split(/\n/).map((l) => l.trim()).filter(Boolean);
    if (!urls.length) return;

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch(`${API}/sessions/${sessionId}/changes/import-github`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pr_urls: urls, token: token || undefined }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setResult(data);
      if (data.imported > 0) { setPrUrls(""); onRefresh(); }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="pr-urls">PR 链接（每行一个）</Label>
        <Textarea
          id="pr-urls"
          rows={6}
          placeholder={
            "https://github.com/org/repo/pull/123\nhttps://github.com/org/repo/pull/124"
          }
          value={prUrls}
          onChange={(e) => setPrUrls(e.target.value)}
          className="font-mono text-xs"
        />
        <p className="text-xs text-muted-foreground">
          自动从 GitHub API 读取 PR 标题和描述，作为 AI 分析的变更内容
        </p>
      </div>

      {result && (
        <div className="space-y-1">
          {result.imported > 0 && (
            <p className="text-sm text-green-600 flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4" />成功导入 {result.imported} 条
            </p>
          )}
          {result.errors.length > 0 && (
            <div className="rounded border border-destructive/30 bg-destructive/5 p-2 space-y-1">
              <p className="text-xs font-medium text-destructive">{result.errors.length} 条失败：</p>
              {result.errors.map((e, i) => (
                <p key={i} className="text-xs text-destructive">
                  #{e.url.split("/pull/")[1] ?? e.url}：{e.error}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={loading || !prUrls.trim()}>
        {loading ? "读取中..." : "从 GitHub 导入"}
      </Button>
    </form>
  );
}

// ── CSV 导入 ──────────────────────────────────────────────────────────────────

function CsvImport({
  sessionId,
  token,
  onImport,
  importing,
  onRefresh,
}: {
  sessionId: number;
  token: string;
  onImport: (csv: string) => Promise<number>;
  importing: boolean;
  onRefresh: () => void;
}) {
  const [csv, setCsv] = useState("");
  const [autoFetch, setAutoFetch] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const readFile = useCallback((file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setCsv(ev.target?.result as string ?? "");
    reader.readAsText(file);
  }, []);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith(".csv") || file.type === "text/csv")) {
      readFile(file);
    }
  };

  const clearFile = () => {
    setFileName(null);
    setCsv("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csv.trim()) return;
    setMessage(null);

    // Check if CSV only has one column (URLs only) — if so, redirect to GitHub import
    if (autoFetch) {
      const lines = csv.trim().split(/\n/).map((l) => l.trim()).filter(Boolean);
      const urlsOnly = lines
        .filter((l) => !l.toLowerCase().startsWith("pr_url"))
        .filter((l) => l.includes("github.com"))
        .map((l) => l.split(",")[0].trim());

      if (urlsOnly.length > 0) {
        try {
          const res = await fetch(`${API}/sessions/${sessionId}/changes/import-github`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pr_urls: urlsOnly, token: token || undefined }),
          });
          if (!res.ok) throw new Error(await res.text());
          const data = await res.json();
          setMessage(`成功从 GitHub 导入 ${data.imported} 条${data.errors.length > 0 ? `（${data.errors.length} 条失败）` : ""}`);
          if (data.imported > 0) { clearFile(); onRefresh(); }
          return;
        } catch (err) {
          setMessage(`GitHub 导入失败：${err instanceof Error ? err.message : String(err)}`);
          return;
        }
      }
    }

    const count = await onImport(csv.trim());
    if (count > 0) {
      setMessage(`成功导入 ${count} 条变更记录`);
      clearFile();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Drop zone */}
      <div className="space-y-1.5">
        <Label>
          CSV 文件
          <span className="font-normal text-muted-foreground ml-1">（两列：pr_url, description）</span>
        </Label>
        <div
          className={`relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-5 text-sm transition-colors cursor-pointer
            ${dragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/30"}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFile}
            className="sr-only"
          />
          {fileName ? (
            <div className="flex items-center gap-2 text-sm">
              <FileUp className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-medium truncate max-w-[240px]">{fileName}</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); clearFile(); }}
                className="ml-1 rounded-full p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <>
              <FileUp className="h-6 w-6 text-muted-foreground" />
              <div className="text-center">
                <span className="font-medium">点击选择</span>
                <span className="text-muted-foreground">或拖拽 CSV 文件到此处</span>
              </div>
              <p className="text-xs text-muted-foreground">支持 .csv 格式</p>
            </>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="csv-text">或直接粘贴内容</Label>
        <Textarea
          id="csv-text"
          rows={5}
          placeholder={`pr_url,description\nhttps://github.com/org/repo/pull/123,修改了首页 Banner 背景色`}
          value={csv}
          onChange={(e) => { setCsv(e.target.value); if (e.target.value === "") setFileName(null); }}
          className="font-mono text-xs"
        />
      </div>

      <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
        <input
          type="checkbox"
          checked={autoFetch}
          onChange={(e) => setAutoFetch(e.target.checked)}
          className="rounded"
        />
        <span>
          CSV 中只有 PR 链接、没有描述时，自动从 GitHub 抓取
          {!token && autoFetch && (
            <span className="text-yellow-600 ml-1">（私有仓库需先填写上方 Token）</span>
          )}
        </span>
      </label>

      {message && (
        <p className={`text-sm ${message.includes("失败") ? "text-destructive" : "text-green-600"}`}>
          {message}
        </p>
      )}
      <Button type="submit" disabled={importing || !csv.trim()}>
        {importing ? "导入中..." : "导入变更记录"}
      </Button>
    </form>
  );
}
