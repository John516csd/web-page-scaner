"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface Props {
  sessionId: number;
  sessionName: string;
}

const API = "/api/tools/migration-tracker";

export function ReportExport({ sessionId, sessionName }: Props) {
  const download = async (format: "json" | "html") => {
    const res = await fetch(`${API}/sessions/${sessionId}/report?format=${format}`);
    if (!res.ok) return;

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `migration-report-${sessionName}-${Date.now()}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={() => download("json")}>
        <Download className="h-4 w-4 mr-1" />
        导出 JSON
      </Button>
      <Button variant="outline" size="sm" onClick={() => download("html")}>
        <Download className="h-4 w-4 mr-1" />
        导出 HTML 报告
      </Button>
    </div>
  );
}
