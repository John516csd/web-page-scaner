"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, ArrowRight, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { DiffRequest, DiffOptions, CheckType } from "../types";

export function DiffForm({
  onSubmit,
  onReset,
  loading,
}: {
  onSubmit: (req: DiffRequest) => void;
  onReset: () => void;
  loading: boolean;
}) {
  const [urlA, setUrlA] = useState("");
  const [urlB, setUrlB] = useState("");
  const [checks, setChecks] = useState<CheckType[]>(["http", "seo", "content", "visual"]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [options, setOptions] = useState<DiffOptions>({
    viewports: ["desktop", "mobile"],
    disableAnimations: true,
    hideSelectors: [],
    waitTime: 0,
    failThreshold: 15,
  });

  const toggleCheck = (check: CheckType) => {
    setChecks((prev) =>
      prev.includes(check) ? prev.filter((c) => c !== check) : [...prev, check]
    );
  };

  const toggleViewport = (vp: "desktop" | "mobile") => {
    setOptions((prev) => {
      const current = prev.viewports || ["desktop", "mobile"];
      const next = current.includes(vp)
        ? current.filter((v) => v !== vp)
        : [...current, vp];
      return { ...prev, viewports: next.length ? next : current };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlA.trim() || !urlB.trim() || checks.length === 0) return;
    onSubmit({
      urlA: urlA.trim(),
      urlB: urlB.trim(),
      checks,
      options: checks.includes("visual") ? options : undefined,
    });
  };

  const handleReset = () => {
    setUrlA("");
    setUrlB("");
    setChecks(["http", "seo", "content", "visual"]);
    setShowAdvanced(false);
    setOptions({
      viewports: ["desktop", "mobile"],
      disableAnimations: true,
      hideSelectors: [],
      waitTime: 0,
      failThreshold: 15,
    });
    onReset();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="urlA">基准 URL (Baseline)</Label>
        <Input
          id="urlA"
          type="url"
          value={urlA}
          onChange={(e) => setUrlA(e.target.value)}
          placeholder="https://example.com/page"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="urlB">对比 URL (Compare)</Label>
        <Input
          id="urlB"
          type="url"
          value={urlB}
          onChange={(e) => setUrlB(e.target.value)}
          placeholder="https://staging.example.com/page"
          required
        />
      </div>

      <div className="space-y-2">
        <Label>检查项</Label>
        <div className="flex gap-6">
          {(["http", "seo", "content", "visual"] as const).map((check) => (
            <div key={check} className="flex items-center gap-2">
              <Checkbox
                id={`check-${check}`}
                checked={checks.includes(check)}
                onCheckedChange={() => toggleCheck(check)}
              />
              <Label htmlFor={`check-${check}`} className="cursor-pointer font-normal">
                {check === "content" ? "CONTENT" : check.toUpperCase()}
              </Label>
            </div>
          ))}
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
          {showAdvanced ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          高级选项
        </Button>

        {showAdvanced && (
          <div className="mt-3 space-y-4 rounded-lg border p-4">
            <div className="space-y-2">
              <Label>视口尺寸</Label>
              <div className="flex gap-6">
                {(["desktop", "mobile"] as const).map((vp) => (
                  <div key={vp} className="flex items-center gap-2">
                    <Checkbox
                      id={`vp-${vp}`}
                      checked={options.viewports?.includes(vp) ?? true}
                      onCheckedChange={() => toggleViewport(vp)}
                    />
                    <Label htmlFor={`vp-${vp}`} className="cursor-pointer font-normal">
                      {vp === "desktop" ? "Desktop (1440×900)" : "Mobile (375×812)"}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="disableAnim"
                checked={options.disableAnimations ?? true}
                onCheckedChange={(checked) =>
                  setOptions((prev) => ({ ...prev, disableAnimations: checked }))
                }
              />
              <Label htmlFor="disableAnim" className="cursor-pointer">禁用动画</Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="hideSelectors">隐藏元素（CSS 选择器，每行一个）</Label>
              <Textarea
                id="hideSelectors"
                value={options.hideSelectors?.join("\n") || ""}
                onChange={(e) =>
                  setOptions((prev) => ({
                    ...prev,
                    hideSelectors: e.target.value
                      .split("\n")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  }))
                }
                placeholder={".cookie-banner\n.floating-chat"}
                rows={3}
                className="font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="waitTime">额外等待时间 (ms)</Label>
                <Input
                  id="waitTime"
                  type="number"
                  min={0}
                  step={100}
                  value={options.waitTime || 0}
                  onChange={(e) =>
                    setOptions((prev) => ({
                      ...prev,
                      waitTime: parseInt(e.target.value) || 0,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="threshold">差异阈值 (%)</Label>
                <Input
                  id="threshold"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={options.failThreshold || 15}
                  onChange={(e) =>
                    setOptions((prev) => ({
                      ...prev,
                      failThreshold: parseInt(e.target.value) || 15,
                    }))
                  }
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Button
          type="submit"
          disabled={loading || !urlA.trim() || !urlB.trim() || checks.length === 0}
        >
          {loading ? (
            <>
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              对比中...
            </>
          ) : (
            <>
              开始对比
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
