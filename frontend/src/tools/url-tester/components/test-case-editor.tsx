"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Play,
  Plus,
  Trash2,
  Pencil,
  RotateCcw,
  Square,
} from "lucide-react";
import {
  DEFAULT_TEST_CASES,
  GEO_COUNTRY_LABELS,
  type UrlTestCase,
  type GeoCountry,
} from "../types";

interface TestCaseEditorProps {
  testCases: UrlTestCase[];
  onTestCasesChange: (cases: UrlTestCase[]) => void;
  selectedIds: Set<string>;
  onSelectedIdsChange: (ids: Set<string>) => void;
  onRun: (cases: UrlTestCase[]) => void;
  onStop: () => void;
  loading: boolean;
}

export function TestCaseEditor({
  testCases,
  onTestCasesChange,
  selectedIds,
  onSelectedIdsChange,
  onRun,
  onStop,
  loading,
}: TestCaseEditorProps) {
  const [editingCase, setEditingCase] = useState<UrlTestCase | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const toggleAll = useCallback(() => {
    if (selectedIds.size === testCases.length) {
      onSelectedIdsChange(new Set());
    } else {
      onSelectedIdsChange(new Set(testCases.map((tc) => tc.id)));
    }
  }, [selectedIds.size, testCases, onSelectedIdsChange]);

  const toggleOne = useCallback(
    (id: string) => {
      const next = new Set(selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      onSelectedIdsChange(next);
    },
    [selectedIds, onSelectedIdsChange]
  );

  const handleRun = useCallback(() => {
    const selected = testCases.filter((tc) => selectedIds.has(tc.id));
    if (selected.length > 0) onRun(selected);
  }, [testCases, selectedIds, onRun]);

  const handleReset = useCallback(() => {
    onTestCasesChange(DEFAULT_TEST_CASES);
    onSelectedIdsChange(new Set(DEFAULT_TEST_CASES.map((tc) => tc.id)));
  }, [onTestCasesChange, onSelectedIdsChange]);

  const handleDelete = useCallback(
    (id: string) => {
      onTestCasesChange(testCases.filter((tc) => tc.id !== id));
      const next = new Set(selectedIds);
      next.delete(id);
      onSelectedIdsChange(next);
    },
    [testCases, selectedIds, onTestCasesChange, onSelectedIdsChange]
  );

  const handleSaveEdit = useCallback(
    (updated: UrlTestCase) => {
      if (testCases.find((tc) => tc.id === updated.id)) {
        onTestCasesChange(
          testCases.map((tc) => (tc.id === updated.id ? updated : tc))
        );
      } else {
        onTestCasesChange([...testCases, updated]);
        const next = new Set(selectedIds);
        next.add(updated.id);
        onSelectedIdsChange(next);
      }
      setEditDialogOpen(false);
      setEditingCase(null);
    },
    [testCases, selectedIds, onTestCasesChange, onSelectedIdsChange]
  );

  const handleAddNew = useCallback(() => {
    setEditingCase({
      id: `custom-${Date.now()}`,
      name: "",
      description: "",
      url: "",
      expectedStatus: 200,
    });
    setEditDialogOpen(true);
  }, []);

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-1 py-1">
        <div className="flex items-center gap-1">
          <Checkbox
            checked={
              selectedIds.size === testCases.length && testCases.length > 0
            }
            onCheckedChange={toggleAll}
          />
          <span className="text-[11px] text-muted-foreground tabular-nums ml-1">
            {selectedIds.size}/{testCases.length}
          </span>
          <Separator orientation="vertical" className="h-3.5 mx-1.5" />
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-[11px] text-muted-foreground"
            onClick={handleReset}
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-[11px] text-muted-foreground"
                onClick={handleAddNew}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {editingCase &&
                  testCases.find((tc) => tc.id === editingCase.id)
                    ? "编辑测试用例"
                    : "新增测试用例"}
                </DialogTitle>
              </DialogHeader>
              {editingCase && (
                <TestCaseForm
                  testCase={editingCase}
                  onSave={handleSaveEdit}
                  onCancel={() => {
                    setEditDialogOpen(false);
                    setEditingCase(null);
                  }}
                />
              )}
            </DialogContent>
          </Dialog>
        </div>
        {loading ? (
          <Button variant="destructive" size="sm" className="h-6 px-2.5 text-[11px]" onClick={onStop}>
            <Square className="h-3 w-3 mr-1" />
            停止
          </Button>
        ) : (
          <Button
            size="sm"
            className="h-6 px-2.5 text-[11px]"
            onClick={handleRun}
            disabled={selectedIds.size === 0}
          >
            <Play className="h-3 w-3 mr-1" />
            运行 ({selectedIds.size})
          </Button>
        )}
      </div>

      <Separator className="my-1" />

      {/* Test case list */}
      <div>
        {testCases.map((tc) => (
          <div
            key={tc.id}
            className="group flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50"
          >
            <Checkbox
              checked={selectedIds.has(tc.id)}
              onCheckedChange={() => toggleOne(tc.id)}
              className="shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] font-medium truncate">
                  {tc.name}
                </span>
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1 py-0 shrink-0 ${
                    tc.expectedStatus === 200
                      ? "border-emerald-300 text-emerald-600"
                      : tc.expectedStatus === 301
                      ? "border-blue-300 text-blue-600"
                      : "border-amber-300 text-amber-600"
                  }`}
                >
                  {tc.expectedStatus}
                </Badge>
                {tc.country && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1 py-0 shrink-0 border-orange-200 text-orange-600"
                  >
                    {tc.country}
                  </Badge>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground font-mono truncate mt-0.5">
                {new URL(tc.url).pathname}
                {tc.expectedRedirectUrl && (
                  <>
                    <span className="text-muted-foreground/40 mx-1">→</span>
                    {(() => {
                      try {
                        const u = new URL(tc.expectedRedirectUrl);
                        return u.host !== new URL(tc.url).host
                          ? u.host + u.pathname
                          : u.pathname;
                      } catch {
                        return tc.expectedRedirectUrl;
                      }
                    })()}
                  </>
                )}
              </p>
            </div>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingCase({ ...tc });
                  setEditDialogOpen(true);
                }}
              >
                <Pencil className="h-2.5 w-2.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(tc.id);
                }}
              >
                <Trash2 className="h-2.5 w-2.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TestCaseForm({
  testCase,
  onSave,
  onCancel,
}: {
  testCase: UrlTestCase;
  onSave: (tc: UrlTestCase) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<UrlTestCase>(testCase);
  const [cookieStr, setCookieStr] = useState(
    testCase.cookies
      ? Object.entries(testCase.cookies)
          .map(([k, v]) => `${k}=${v}`)
          .join("; ")
      : ""
  );
  const [headerStr, setHeaderStr] = useState(
    testCase.headers
      ? Object.entries(testCase.headers)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\n")
      : ""
  );

  const handleSave = () => {
    const cookies: Record<string, string> = {};
    if (cookieStr.trim()) {
      cookieStr.split(";").forEach((pair) => {
        const [k, ...vParts] = pair.trim().split("=");
        if (k) cookies[k.trim()] = vParts.join("=").trim();
      });
    }

    const headers: Record<string, string> = {};
    if (headerStr.trim()) {
      headerStr.split("\n").forEach((line) => {
        const [k, ...vParts] = line.split(":");
        if (k) headers[k.trim()] = vParts.join(":").trim();
      });
    }

    onSave({
      ...form,
      cookies: Object.keys(cookies).length > 0 ? cookies : undefined,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs mb-1">名称</Label>
        <Input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="测试用例名称"
        />
      </div>
      <div>
        <Label className="text-xs mb-1">URL</Label>
        <Input
          value={form.url}
          onChange={(e) => setForm({ ...form, url: e.target.value })}
          placeholder="https://www.notta.ai/"
          className="font-mono text-sm"
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label className="text-xs mb-1">模拟国家（可选）</Label>
          <Select
            value={form.country || "__none__"}
            onValueChange={(v) =>
              setForm({
                ...form,
                country: v === "__none__" ? undefined : (v as GeoCountry),
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="不指定" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">不指定</SelectItem>
              {Object.entries(GEO_COUNTRY_LABELS).map(([code, label]) => (
                <SelectItem key={code} value={code}>
                  {code} - {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs mb-1">预期状态码</Label>
          <Input
            type="number"
            value={form.expectedStatus}
            onChange={(e) =>
              setForm({
                ...form,
                expectedStatus: parseInt(e.target.value) || 200,
              })
            }
          />
        </div>
        <div>
          <Label className="text-xs mb-1">预期重定向 URL（可选）</Label>
          <Input
            value={form.expectedRedirectUrl || ""}
            onChange={(e) =>
              setForm({
                ...form,
                expectedRedirectUrl: e.target.value || undefined,
              })
            }
            placeholder="https://..."
            className="font-mono text-sm"
          />
        </div>
      </div>
      <div>
        <Label className="text-xs mb-1">
          自定义 Headers（每行一个，格式：Key: Value）
        </Label>
        <Input
          value={headerStr}
          onChange={(e) => setHeaderStr(e.target.value)}
          placeholder="User-Agent: Googlebot/2.1"
          className="font-mono text-sm"
        />
      </div>
      <div>
        <Label className="text-xs mb-1">
          Cookies（格式：key=value; key2=value2）
        </Label>
        <Input
          value={cookieStr}
          onChange={(e) => setCookieStr(e.target.value)}
          placeholder="selected-lang=es"
          className="font-mono text-sm"
        />
      </div>
      <div>
        <Label className="text-xs mb-1">描述</Label>
        <Input
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="这个测试用例的说明..."
        />
      </div>
      <div>
        <Label className="text-xs mb-1">备注（可选）</Label>
        <Input
          value={form.notes || ""}
          onChange={(e) =>
            setForm({ ...form, notes: e.target.value || undefined })
          }
          placeholder="注意事项..."
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={onCancel}>
          取消
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!form.name || !form.url}
        >
          保存
        </Button>
      </div>
    </div>
  );
}
