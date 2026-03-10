"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  FolderOpen,
  Clock,
} from "lucide-react";
import type { E2ETestCollection } from "../types";

interface ScheduleInfo {
  enabled: boolean;
  cron: string;
  config: { collectionId?: string };
}

interface E2ECollectionPickerProps {
  collections: E2ETestCollection[];
  activeId: string | null;
  onSelect: (collection: E2ETestCollection) => void;
  onCreate: (name: string, description?: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  disabled?: boolean;
  scheduleMap?: Record<string, ScheduleInfo>;
}

export function E2ECollectionPicker({
  collections,
  activeId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  disabled,
  scheduleMap = {},
}: E2ECollectionPickerProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTarget, setRenameTarget] =
    useState<E2ETestCollection | null>(null);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await onCreate(newName.trim(), newDesc.trim() || undefined);
      setCreateOpen(false);
      setNewName("");
      setNewDesc("");
    } finally {
      setSaving(false);
    }
  };

  const handleRename = async () => {
    if (!renameTarget || !newName.trim()) return;
    setSaving(true);
    try {
      await onRename(renameTarget.id, newName.trim());
      setRenameOpen(false);
      setRenameTarget(null);
      setNewName("");
    } finally {
      setSaving(false);
    }
  };

  const openRename = (col: E2ETestCollection) => {
    setRenameTarget(col);
    setNewName(col.name);
    setRenameOpen(true);
  };

  return (
    <div className="flex items-center gap-1.5">
      <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <Select
        value={activeId || ""}
        onValueChange={(id) => {
          const col = collections.find((c) => c.id === id);
          if (col) onSelect(col);
        }}
        disabled={disabled}
      >
        <SelectTrigger className="h-7 text-xs flex-1 min-w-0">
          <SelectValue placeholder="选择测试集合..." />
        </SelectTrigger>
        <SelectContent>
          {collections.map((col) => {
            const hasSchedule = scheduleMap[col.id]?.enabled;
            return (
              <SelectItem key={col.id} value={col.id}>
                {hasSchedule && "⏱ "}
                {col.name} ({col.testCases.length})
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      {activeId && scheduleMap[activeId]?.enabled && (
        <Clock className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
      )}

      {activeId && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              disabled={disabled}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                const col = collections.find((c) => c.id === activeId);
                if (col) openRename(col);
              }}
            >
              <Pencil className="h-3.5 w-3.5 mr-2" />
              重命名
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => {
                if (activeId) onDelete(activeId);
              }}
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" />
              删除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={() => {
          setNewName("");
          setNewDesc("");
          setCreateOpen(true);
        }}
        disabled={disabled}
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>新建测试集合</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs mb-1">集合名称</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="例如：小工具页面功能测试"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            <div>
              <Label className="text-xs mb-1">描述（可选）</Label>
              <Input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="这个集合的用途..."
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCreateOpen(false)}
              >
                取消
              </Button>
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={!newName.trim() || saving}
              >
                {saving ? "创建中..." : "创建"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>重命名集合</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs mb-1">新名称</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleRename()}
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRenameOpen(false)}
              >
                取消
              </Button>
              <Button
                size="sm"
                onClick={handleRename}
                disabled={!newName.trim() || saving}
              >
                {saving ? "保存中..." : "保存"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
