"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Play,
  Plus,
  Trash2,
  Pencil,
  RotateCcw,
  Square,
  Save,
} from "lucide-react";
import type { E2ETestCase } from "../types";
import { TestCaseDialog } from "./test-case-dialog";

interface E2ETestCaseEditorProps {
  testCases: E2ETestCase[];
  onTestCasesChange: (cases: E2ETestCase[]) => void;
  selectedIds: Set<string>;
  onSelectedIdsChange: (ids: Set<string>) => void;
  onRun: (cases: E2ETestCase[]) => void;
  onStop: () => void;
  loading: boolean;
  dirty?: boolean;
  saving?: boolean;
  onSave?: () => void;
  onReset?: () => void;
}

export function E2ETestCaseEditor({
  testCases,
  onTestCasesChange,
  selectedIds,
  onSelectedIdsChange,
  onRun,
  onStop,
  loading,
  dirty = false,
  saving = false,
  onSave,
  onReset,
}: E2ETestCaseEditorProps) {
  const [editingCase, setEditingCase] = useState<E2ETestCase | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isNew, setIsNew] = useState(false);

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
    (updated: E2ETestCase) => {
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
      setEditingCase(null);
    },
    [testCases, selectedIds, onTestCasesChange, onSelectedIdsChange]
  );

  const handleAddNew = useCallback(() => {
    setEditingCase(null);
    setIsNew(true);
    setDialogOpen(true);
  }, []);

  const handleEdit = useCallback((tc: E2ETestCase) => {
    setEditingCase({ ...tc });
    setIsNew(false);
    setDialogOpen(true);
  }, []);

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-1 py-1.5 sticky top-0 z-10 bg-card border-b border-border/50">
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
          {onReset && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[11px] text-muted-foreground"
              onClick={onReset}
              disabled={!dirty}
              title="重置为已保存版本"
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          )}
          {onSave && (
            <Button
              variant="ghost"
              size="sm"
              className={`h-6 px-1.5 text-[11px] ${dirty ? "text-primary" : "text-muted-foreground"}`}
              onClick={onSave}
              disabled={!dirty || saving}
              title="保存到集合"
            >
              <Save className="h-3 w-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-[11px] text-muted-foreground"
            onClick={handleAddNew}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
        {loading ? (
          <Button
            variant="destructive"
            size="sm"
            className="h-6 px-2.5 text-[11px]"
            onClick={onStop}
          >
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
        {testCases.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-xs text-muted-foreground">
              此集合尚无测试用例，点击 + 添加
            </p>
          </div>
        ) : (
          testCases.map((tc) => (
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
                  {tc.tags?.map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="text-[10px] px-1 py-0 shrink-0 border-violet-300 text-violet-600"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground font-mono truncate mt-0.5">
                  {tc.url}
                </p>
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEdit(tc);
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
          ))
        )}
      </div>

      <TestCaseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        testCase={editingCase}
        isNew={isNew}
        onSave={handleSaveEdit}
      />
    </div>
  );
}
