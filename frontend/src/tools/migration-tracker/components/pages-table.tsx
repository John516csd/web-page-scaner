"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageDetailDialog } from "./page-detail-dialog";
import type { PagePair, DiffStatus } from "../types";

const API = "/api/tools/migration-tracker";
const PAGE_SIZE = 50;

interface Props {
  sessionId: number;
  refreshTrigger?: number;
}

export function PagesTable({ sessionId, refreshTrigger }: Props) {
  const [rows, setRows] = useState<PagePair[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [diffStatus, setDiffStatus] = useState<string>("all");
  const [pathFilter, setPathFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<PagePair | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      if (diffStatus !== "all") params.set("diffStatus", diffStatus);
      if (pathFilter) params.set("path", pathFilter);

      const res = await fetch(`${API}/sessions/${sessionId}/pages?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setRows(data.rows);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, [sessionId, offset, diffStatus, pathFilter]);

  useEffect(() => {
    load();
  }, [load, refreshTrigger]);

  const handleFilterChange = (fn: () => void) => {
    setOffset(0);
    fn();
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  // Stat counts for quick filter chips
  const counts = { fail: 0, warn: 0, pass: 0, error: 0 };
  rows.forEach((r) => { if (r.diff_status) counts[r.diff_status] = (counts[r.diff_status] ?? 0) + 1; });

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap items-center">
        <Input
          placeholder="过滤路径..."
          value={pathFilter}
          onChange={(e) => handleFilterChange(() => setPathFilter(e.target.value))}
          className="max-w-xs h-8 text-sm"
        />
        <Select
          value={diffStatus}
          onValueChange={(v) => handleFilterChange(() => setDiffStatus(v))}
        >
          <SelectTrigger className="w-28 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            <SelectItem value="pass">通过</SelectItem>
            <SelectItem value="warn">警告</SelectItem>
            <SelectItem value="fail">失败</SelectItem>
            <SelectItem value="error">出错</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">共 {total} 条</span>
        <span className="text-xs text-muted-foreground ml-1">（点击行查看详情）</span>
      </div>

      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left font-medium">路径</th>
              <th className="px-3 py-2 text-left font-medium w-20">状态</th>
              <th className="px-3 py-2 text-left font-medium w-28">扫描时间</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3} className="px-3 py-8 text-center text-muted-foreground">加载中...</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-8 text-center text-muted-foreground">暂无数据</td>
              </tr>
            ) : (
              rows.map((row) => {
                const clickable = row.scan_status === "done";
                return (
                  <tr
                    key={row.id}
                    className={`border-t transition-colors ${clickable ? "cursor-pointer hover:bg-muted/40 active:bg-muted/60" : "hover:bg-muted/20"}`}
                    onClick={() => clickable && setSelected(row)}
                  >
                    <td className="px-3 py-2 font-mono text-xs truncate max-w-0 w-full">
                      {row.path}
                    </td>
                    <td className="px-3 py-2">
                      <DiffBadge status={row.diff_status} scanStatus={row.scan_status} />
                    </td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">
                      {row.scanned_at ? new Date(row.scanned_at + "Z").toLocaleTimeString() : "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-2 justify-end">
          <Button
            variant="outline" size="sm"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
          >上一页</Button>
          <span className="text-sm text-muted-foreground">{currentPage} / {totalPages}</span>
          <Button
            variant="outline" size="sm"
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => setOffset(offset + PAGE_SIZE)}
          >下一页</Button>
        </div>
      )}

      <PageDetailDialog
        page={selected}
        open={selected !== null}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

function DiffBadge({ status, scanStatus }: { status: DiffStatus | null; scanStatus: string }) {
  if (scanStatus === "pending") return <Badge variant="secondary" className="text-xs">待扫描</Badge>;
  if (scanStatus === "running") return <Badge className="bg-blue-100 text-blue-700 text-xs">扫描中</Badge>;
  if (!status) return <Badge variant="secondary" className="text-xs">—</Badge>;

  const map: Record<DiffStatus, { label: string; className: string }> = {
    pass: { label: "通过", className: "bg-green-100 text-green-700" },
    warn: { label: "警告", className: "bg-yellow-100 text-yellow-700" },
    fail: { label: "失败", className: "bg-red-100 text-red-700" },
    error: { label: "出错", className: "bg-gray-100 text-gray-700" },
  };
  const v = map[status];
  return <Badge className={`${v.className} text-xs`}>{v.label}</Badge>;
}
