"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Minus,
  LayoutList,
  Heading,
  Link2,
  ImageIcon,
  FileText,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { ContentCheckResult } from "../types";

function SectionToggle({
  title,
  icon: Icon,
  badge,
  badgeVariant = "outline",
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: React.ElementType;
  badge: string;
  badgeVariant?: "outline" | "destructive" | "secondary";
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left hover:bg-muted/50 transition-colors"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <Icon className="h-4 w-4 text-muted-foreground" />
            {title}
          </span>
          <span className="flex items-center gap-2">
            <Badge variant={badgeVariant}>{badge}</Badge>
            {open ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}

function DomSection({ data }: { data: ContentCheckResult["dom"] }) {
  const diffTags = data.tagCounts.filter((t) => t.countA !== t.countB);
  const hasDiff = data.totalA !== data.totalB || diffTags.length > 0;

  return (
    <SectionToggle
      title="DOM 结构"
      icon={LayoutList}
      badge={hasDiff ? `${diffTags.length} 项差异` : "一致"}
      badgeVariant={hasDiff ? "destructive" : "outline"}
      defaultOpen={hasDiff}
    >
      <div className="space-y-3">
        <div className="flex gap-6 text-sm">
          <span className="text-muted-foreground">
            基准元素总数: <span className="font-mono font-medium text-foreground">{data.totalA}</span>
          </span>
          <span className="text-muted-foreground">
            对比元素总数: <span className="font-mono font-medium text-foreground">{data.totalB}</span>
          </span>
          {data.totalA !== data.totalB && (
            <span className="font-mono text-sm">
              {data.totalB > data.totalA ? (
                <span className="text-green-600">+{data.totalB - data.totalA}</span>
              ) : (
                <span className="text-destructive">{data.totalB - data.totalA}</span>
              )}
            </span>
          )}
        </div>

        {diffTags.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">标签</TableHead>
                <TableHead className="text-right">基准</TableHead>
                <TableHead className="text-right">对比</TableHead>
                <TableHead className="text-right pr-4">差异</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {diffTags.map((t) => (
                <TableRow key={t.tag}>
                  <TableCell className="pl-4 font-mono text-xs">&lt;{t.tag}&gt;</TableCell>
                  <TableCell className="text-right font-mono text-xs">{t.countA}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{t.countB}</TableCell>
                  <TableCell className="text-right pr-4 font-mono text-xs">
                    {t.countB > t.countA ? (
                      <span className="text-green-600">+{t.countB - t.countA}</span>
                    ) : (
                      <span className="text-destructive">{t.countB - t.countA}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </SectionToggle>
  );
}

function HeadingsSection({ data }: { data: ContentCheckResult["headings"] }) {
  const match =
    JSON.stringify(data.listA) === JSON.stringify(data.listB);

  return (
    <SectionToggle
      title="标题大纲"
      icon={Heading}
      badge={match ? "一致" : "有差异"}
      badgeVariant={match ? "outline" : "destructive"}
      defaultOpen={!match}
    >
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">基准</p>
          <div className="rounded-lg border bg-muted/30 p-3 space-y-0.5">
            {data.listA.length === 0 ? (
              <p className="text-xs text-muted-foreground">（无标题）</p>
            ) : (
              data.listA.map((h, i) => (
                <p
                  key={i}
                  className="text-xs"
                  style={{ paddingLeft: `${(h.level - 1) * 16}px` }}
                >
                  <span className="font-mono text-muted-foreground">H{h.level}</span>{" "}
                  {h.text}
                </p>
              ))
            )}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">对比</p>
          <div className="rounded-lg border bg-muted/30 p-3 space-y-0.5">
            {data.listB.length === 0 ? (
              <p className="text-xs text-muted-foreground">（无标题）</p>
            ) : (
              data.listB.map((h, i) => (
                <p
                  key={i}
                  className="text-xs"
                  style={{ paddingLeft: `${(h.level - 1) * 16}px` }}
                >
                  <span className="font-mono text-muted-foreground">H{h.level}</span>{" "}
                  {h.text}
                </p>
              ))
            )}
          </div>
        </div>
      </div>
    </SectionToggle>
  );
}

function LinksSection({ data }: { data: ContentCheckResult["links"] }) {
  const hasDiff = data.added.length > 0 || data.removed.length > 0;

  return (
    <SectionToggle
      title="链接"
      icon={Link2}
      badge={
        hasDiff
          ? `+${data.added.length} / -${data.removed.length}`
          : `${data.common} 个一致`
      }
      badgeVariant={hasDiff ? "destructive" : "outline"}
      defaultOpen={hasDiff}
    >
      <div className="space-y-3">
        <div className="flex gap-6 text-sm">
          <span className="text-muted-foreground">
            基准: <span className="font-medium text-foreground">{data.countA}</span> 个
          </span>
          <span className="text-muted-foreground">
            对比: <span className="font-medium text-foreground">{data.countB}</span> 个
          </span>
          <span className="text-muted-foreground">
            相同: <span className="font-medium text-foreground">{data.common}</span> 个
          </span>
        </div>

        {hasDiff && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 pl-4">状态</TableHead>
                <TableHead>链接文本</TableHead>
                <TableHead>链接地址</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.removed.map((link, i) => (
                <TableRow key={`r-${i}`} className="bg-red-50/50 dark:bg-red-950/10">
                  <TableCell className="pl-4">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
                      <Minus className="h-3 w-3" /> 移除
                    </span>
                  </TableCell>
                  <TableCell className="text-xs break-all">{link.text || <span className="text-muted-foreground">(无文本)</span>}</TableCell>
                  <TableCell className="text-xs font-mono break-all">{link.href}</TableCell>
                </TableRow>
              ))}
              {data.added.map((link, i) => (
                <TableRow key={`a-${i}`} className="bg-green-50/50 dark:bg-green-950/10">
                  <TableCell className="pl-4">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                      <Plus className="h-3 w-3" /> 新增
                    </span>
                  </TableCell>
                  <TableCell className="text-xs break-all">{link.text || <span className="text-muted-foreground">(无文本)</span>}</TableCell>
                  <TableCell className="text-xs font-mono break-all">{link.href}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </SectionToggle>
  );
}

function ImagesSection({ data }: { data: ContentCheckResult["images"] }) {
  const hasDiff = data.added.length > 0 || data.removed.length > 0;

  return (
    <SectionToggle
      title="图片"
      icon={ImageIcon}
      badge={
        hasDiff
          ? `+${data.added.length} / -${data.removed.length}`
          : `${data.common} 个一致`
      }
      badgeVariant={hasDiff ? "destructive" : "outline"}
      defaultOpen={hasDiff}
    >
      <div className="space-y-3">
        <div className="flex gap-6 text-sm">
          <span className="text-muted-foreground">
            基准: <span className="font-medium text-foreground">{data.countA}</span> 个
          </span>
          <span className="text-muted-foreground">
            对比: <span className="font-medium text-foreground">{data.countB}</span> 个
          </span>
          <span className="text-muted-foreground">
            相同: <span className="font-medium text-foreground">{data.common}</span> 个
          </span>
        </div>

        {hasDiff && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 pl-4">状态</TableHead>
                <TableHead>Alt 文本</TableHead>
                <TableHead>图片地址</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.removed.map((img, i) => (
                <TableRow key={`r-${i}`} className="bg-red-50/50 dark:bg-red-950/10">
                  <TableCell className="pl-4">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
                      <Minus className="h-3 w-3" /> 移除
                    </span>
                  </TableCell>
                  <TableCell className="text-xs break-all">{img.alt || <span className="text-muted-foreground">(无 alt)</span>}</TableCell>
                  <TableCell className="text-xs font-mono break-all">{img.src}</TableCell>
                </TableRow>
              ))}
              {data.added.map((img, i) => (
                <TableRow key={`a-${i}`} className="bg-green-50/50 dark:bg-green-950/10">
                  <TableCell className="pl-4">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                      <Plus className="h-3 w-3" /> 新增
                    </span>
                  </TableCell>
                  <TableCell className="text-xs break-all">{img.alt || <span className="text-muted-foreground">(无 alt)</span>}</TableCell>
                  <TableCell className="text-xs font-mono break-all">{img.src}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </SectionToggle>
  );
}

function TextSection({ data }: { data: ContentCheckResult["text"] }) {
  const hasDiff = data.similarity < 100;

  return (
    <SectionToggle
      title="文本内容"
      icon={FileText}
      badge={`${data.similarity}% 相似`}
      badgeVariant={data.similarity >= 95 ? "outline" : data.similarity >= 80 ? "secondary" : "destructive"}
      defaultOpen={hasDiff && data.similarity < 95}
    >
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          {data.similarity === 100 ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : (
            <XCircle className="h-4 w-4 text-destructive" />
          )}
          <span className="text-sm">
            文本相似度 <span className="font-mono font-medium">{data.similarity}%</span>
          </span>
        </div>

        {data.removed.length > 0 && (
          <div>
            <p className="mb-1.5 flex items-center gap-1 text-xs font-medium text-destructive">
              <Minus className="h-3 w-3" />
              移除的文本行 ({data.removed.length})
            </p>
            <div className="max-h-60 overflow-y-auto rounded-lg border bg-red-50 dark:bg-red-950/20 p-3 space-y-0.5">
              {data.removed.map((line, i) => (
                <p key={i} className="text-xs font-mono text-destructive/80 break-all">
                  - {line}
                </p>
              ))}
            </div>
          </div>
        )}

        {data.added.length > 0 && (
          <div>
            <p className="mb-1.5 flex items-center gap-1 text-xs font-medium text-green-600">
              <Plus className="h-3 w-3" />
              新增的文本行 ({data.added.length})
            </p>
            <div className="max-h-60 overflow-y-auto rounded-lg border bg-green-50 dark:bg-green-950/20 p-3 space-y-0.5">
              {data.added.map((line, i) => (
                <p key={i} className="text-xs font-mono text-green-700 dark:text-green-400 break-all">
                  + {line}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </SectionToggle>
  );
}

export function ContentResult({ data }: { data: ContentCheckResult }) {
  const totalIssues =
    (data.dom.totalA !== data.dom.totalB ? 1 : 0) +
    (data.links.added.length + data.links.removed.length > 0 ? 1 : 0) +
    (data.images.added.length + data.images.removed.length > 0 ? 1 : 0) +
    (data.text.similarity < 100 ? 1 : 0) +
    (JSON.stringify(data.headings.listA) !== JSON.stringify(data.headings.listB) ? 1 : 0);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">内容结构对比</CardTitle>
        <Badge variant={totalIssues > 0 ? "destructive" : "outline"}>
          {totalIssues > 0 ? `${totalIssues} 项差异` : "一致"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <DomSection data={data.dom} />
        <HeadingsSection data={data.headings} />
        <LinksSection data={data.links} />
        <ImagesSection data={data.images} />
        <TextSection data={data.text} />
      </CardContent>
    </Card>
  );
}
