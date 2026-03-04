"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import type { ChangeRecord, ChangeStatus } from "../types";

interface Props {
  changes: ChangeRecord[];
  onUpdateStatus: (id: number, status: ChangeStatus) => void;
  onDelete: (id: number) => void;
}

export function ChangesTable({ changes, onUpdateStatus, onDelete }: Props) {
  if (changes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        暂无变更记录。请先上传 CSV。
      </p>
    );
  }

  return (
    <div className="border rounded-md overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-3 py-2 text-left font-medium">PR</th>
            <th className="px-3 py-2 text-left font-medium">描述</th>
            <th className="px-3 py-2 text-left font-medium w-24">置信度</th>
            <th className="px-3 py-2 text-left font-medium">关联页面</th>
            <th className="px-3 py-2 text-left font-medium w-36">状态</th>
            <th className="px-3 py-2 w-10"></th>
          </tr>
        </thead>
        <tbody>
          {changes.map((c) => {
            const pages: string[] = c.pages_affected
              ? JSON.parse(c.pages_affected)
              : [];
            return (
              <tr key={c.id} className="border-t hover:bg-muted/30 align-top">
                <td className="px-3 py-2">
                  <a
                    href={c.pr_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-xs font-mono"
                  >
                    {c.pr_url.split("/").pop() ?? c.pr_url}
                  </a>
                </td>
                <td className="px-3 py-2 max-w-xs">
                  <p className="line-clamp-2 text-xs">{c.description}</p>
                  {c.ai_reasoning && (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                      AI: {c.ai_reasoning}
                    </p>
                  )}
                </td>
                <td className="px-3 py-2">
                  {c.confidence_score !== null ? (
                    <ConfidenceBadge score={c.confidence_score} />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-2 max-w-xs">
                  <div className="flex flex-wrap gap-1">
                    {pages.slice(0, 3).map((p) => (
                      <Badge key={p} variant="outline" className="font-mono text-xs">
                        {p}
                      </Badge>
                    ))}
                    {pages.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{pages.length - 3}
                      </Badge>
                    )}
                    {pages.length === 0 && (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <Select
                    value={c.status}
                    onValueChange={(v) => onUpdateStatus(c.id, v as ChangeStatus)}
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">待处理</SelectItem>
                      <SelectItem value="verified">已验证</SelectItem>
                      <SelectItem value="failed">验证失败</SelectItem>
                      <SelectItem value="skipped">已跳过</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => onDelete(c.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ConfidenceBadge({ score }: { score: number }) {
  let className = "bg-green-100 text-green-700";
  if (score < 50) className = "bg-red-100 text-red-700";
  else if (score < 75) className = "bg-yellow-100 text-yellow-700";
  return <Badge className={className}>{score}%</Badge>;
}
