"use client";

import { Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { DeadLinkProgress } from "../hooks/use-dead-link-checker";

export function DeadLinkProgressView({ progress }: { progress: DeadLinkProgress }) {
  if (progress.phase === "extracting") {
    return (
      <div className="flex items-center gap-3 rounded-lg border p-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Fetching page and extracting links...</span>
      </div>
    );
  }

  const pct = progress.total > 0 ? Math.round((progress.checked / progress.total) * 100) : 0;

  return (
    <div className="space-y-2 rounded-lg border p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">检查链接中...</span>
        <span className="text-muted-foreground">
          {progress.checked} / {progress.total}
        </span>
      </div>
      <Progress value={pct} className="h-2" />
      {progress.currentUrl && (
        <p className="truncate font-mono text-xs text-muted-foreground">
          {progress.currentUrl}
        </p>
      )}
    </div>
  );
}
