"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Editor from "@monaco-editor/react";
import type { E2ETestCase } from "../types";

const DEFAULT_SCRIPT = `// page 已自动打开 url，直接操作即可
// 可用变量: page (Playwright Page), url (string), assert(condition, message)

const title = await page.title();
assert(title.length > 0, '页面标题不应为空');
`;

interface TestCaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  testCase: E2ETestCase | null;
  isNew: boolean;
  onSave: (tc: E2ETestCase) => void;
}

export function TestCaseDialog({
  open,
  onOpenChange,
  testCase,
  isNew,
  onSave,
}: TestCaseDialogProps) {
  const makeEmpty = (): E2ETestCase => ({
    id: `e2e-${Date.now()}`,
    name: "",
    url: "",
    script: DEFAULT_SCRIPT,
    timeout: 60000,
  });

  const [form, setForm] = useState<E2ETestCase>(testCase || makeEmpty());

  useEffect(() => {
    if (open) {
      setForm(testCase ? { ...testCase } : makeEmpty());
    }
  }, [open, testCase]);

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
  };

  const handleSave = () => {
    onSave(form);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{isNew ? "新增测试用例" : "编辑测试用例"}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1">名称</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="测试用例名称"
              />
            </div>
            <div>
              <Label className="text-xs mb-1">超时 (ms)</Label>
              <Input
                type="number"
                value={form.timeout}
                onChange={(e) =>
                  setForm({
                    ...form,
                    timeout: parseInt(e.target.value) || 60000,
                  })
                }
              />
            </div>
          </div>
          <div>
            <Label className="text-xs mb-1">URL</Label>
            <Input
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="https://www.example.com/page"
              className="font-mono text-sm"
            />
          </div>
          <div>
            <Label className="text-xs mb-1">标签（逗号分隔，可选）</Label>
            <Input
              value={form.tags?.join(", ") || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  tags: e.target.value
                    ? e.target.value.split(",").map((t) => t.trim())
                    : undefined,
                })
              }
              placeholder="smoke, upload"
            />
          </div>
          <div>
            <Label className="text-xs mb-1">Playwright 脚本</Label>
            <div className="rounded-md border overflow-hidden">
              <Editor
                height="300px"
                defaultLanguage="javascript"
                value={form.script}
                onChange={(val) =>
                  setForm({ ...form, script: val || "" })
                }
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: "on",
                  scrollBeyondLastLine: false,
                  wordWrap: "on",
                  tabSize: 2,
                  padding: { top: 8 },
                }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              可用变量：<code className="font-mono">page</code> (Playwright Page)、
              <code className="font-mono">url</code> (string)、
              <code className="font-mono">assert(condition, message)</code>、
              <code className="font-mono">__assets</code> (测试资源目录路径)
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
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
      </DialogContent>
    </Dialog>
  );
}
