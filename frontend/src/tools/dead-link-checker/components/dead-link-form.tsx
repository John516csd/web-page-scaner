"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, ArrowRight, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { DeadLinkRequest } from "../types";

export function DeadLinkForm({
  onSubmit,
  onReset,
  loading,
}: {
  onSubmit: (req: DeadLinkRequest) => void;
  onReset: () => void;
  loading: boolean;
}) {
  const [url, setUrl] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [concurrency, setConcurrency] = useState(5);
  const [timeoutMs, setTimeoutMs] = useState(10000);
  const [checkExternal, setCheckExternal] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    onSubmit({
      url: url.trim(),
      options: { concurrency, timeoutMs, checkExternal },
    });
  };

  const handleReset = () => {
    setUrl("");
    setShowAdvanced(false);
    setConcurrency(5);
    setTimeoutMs(10000);
    setCheckExternal(true);
    onReset();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="url">页面 URL</Label>
        <Input
          id="url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
          required
        />
      </div>

      <div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="gap-1 px-0 text-muted-foreground hover:text-foreground"
        >
          {showAdvanced ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          高级选项
        </Button>

        {showAdvanced && (
          <div className="mt-3 space-y-4 rounded-lg border p-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="concurrency">并发数 (1–20)</Label>
                <Input
                  id="concurrency"
                  type="number"
                  min={1}
                  max={20}
                  value={concurrency}
                  onChange={(e) => setConcurrency(parseInt(e.target.value) || 5)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timeout">超时 (ms)</Label>
                <Input
                  id="timeout"
                  type="number"
                  min={1000}
                  step={1000}
                  value={timeoutMs}
                  onChange={(e) => setTimeoutMs(parseInt(e.target.value) || 10000)}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="checkExternal"
                checked={checkExternal}
                onCheckedChange={setCheckExternal}
              />
              <Label htmlFor="checkExternal" className="cursor-pointer">检查外链</Label>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={loading || !url.trim()}>
          {loading ? (
            <>
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              检查中...
            </>
          ) : (
            <>
              开始检查
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
