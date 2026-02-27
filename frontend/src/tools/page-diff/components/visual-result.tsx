"use client";

import { useState } from "react";
import { ZoomIn } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { VisualCheckResult, VisualViewportResult } from "../types";

export function VisualResult({ data }: { data: VisualCheckResult }) {
  const [zoomedImage, setZoomedImage] = useState<{ src: string; label: string } | null>(null);

  const defaultViewport = data.viewports[0]?.viewport || "desktop";

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">视觉对比</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.viewports.length > 1 ? (
            <Tabs defaultValue={defaultViewport}>
              <div className="border-b px-6">
                <TabsList className="h-9">
                  {data.viewports.map((vp) => (
                    <TabsTrigger key={vp.viewport} value={vp.viewport}>
                      {vp.viewport === "desktop" ? "Desktop" : "Mobile"}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
              {data.viewports.map((vp) => (
                <TabsContent key={vp.viewport} value={vp.viewport} className="mt-0">
                  <ViewportPanel vp={vp} onZoom={(src, label) => setZoomedImage({ src, label })} />
                </TabsContent>
              ))}
            </Tabs>
          ) : (
            <ViewportPanel
              vp={data.viewports[0]}
              onZoom={(src, label) => setZoomedImage({ src, label })}
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={!!zoomedImage} onOpenChange={() => setZoomedImage(null)}>
        <DialogContent className="max-w-[90vw] sm:max-w-[90vw] max-h-[90vh] overflow-y-auto p-4">
          <DialogTitle className="sr-only">{zoomedImage?.label ?? "放大查看"}</DialogTitle>
          <DialogDescription className="sr-only">截图放大查看</DialogDescription>
          {zoomedImage && (
            <img
              src={zoomedImage.src}
              alt={zoomedImage.label}
              className="w-full"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ViewportPanel({
  vp,
  onZoom,
}: {
  vp: VisualViewportResult;
  onZoom: (src: string, label: string) => void;
}) {
  const badgeVariant: "outline" | "destructive" =
    vp.diffPercentage === 0 ? "outline" : "destructive";

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center gap-2">
        <Badge variant={badgeVariant}>差异 {vp.diffPercentage}%</Badge>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <ScreenshotColumn
          label="基准"
          src={`data:image/png;base64,${vp.screenshotA}`}
          onZoom={onZoom}
        />
        <ScreenshotColumn
          label="差异图"
          src={`data:image/png;base64,${vp.diffImage}`}
          onZoom={onZoom}
        />
        <ScreenshotColumn
          label="对比"
          src={`data:image/png;base64,${vp.screenshotB}`}
          onZoom={onZoom}
        />
      </div>
    </div>
  );
}

function ScreenshotColumn({
  label,
  src,
  onZoom,
}: {
  label: string;
  src: string;
  onZoom: (src: string, label: string) => void;
}) {
  return (
    <div className="group relative overflow-hidden rounded-lg border bg-muted">
      <div className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">
        {label}
      </div>
      <div
        className="cursor-pointer transition-opacity hover:opacity-80"
        onClick={() => onZoom(src, label)}
      >
        <img src={src} alt={label} className="w-full" />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
          <ZoomIn className="h-6 w-6 text-white drop-shadow" />
        </div>
      </div>
    </div>
  );
}
