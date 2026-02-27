"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CheckCircle2, XCircle } from "lucide-react";

export interface ResultRow {
  name: string;
  valueA: string | number | null;
  valueB: string | number | null;
  match: boolean;
}

function CellValue({ value }: { value: string | number | null }) {
  if (value === null || value === undefined) {
    return <span className="text-destructive">(缺失)</span>;
  }

  const text = String(value);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="line-clamp-3 font-mono text-xs break-all">
          {text}
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="max-w-sm whitespace-pre-wrap break-all text-xs"
      >
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

export function ResultTable({
  title,
  rows,
  status,
}: {
  title: string;
  rows: ResultRow[];
  status?: "pass" | "warn" | "fail";
}) {
  const diffCount = rows.filter((r) => !r.match).length;
  const hasDiff = status === "fail" || diffCount > 0;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <Badge variant={hasDiff ? "destructive" : "outline"}>
          {hasDiff ? `${diffCount} 项差异` : "一致"}
        </Badge>
      </CardHeader>
      <CardContent className="p-0">
        <Table className="table-fixed w-full">
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6 w-[120px]">检查项</TableHead>
              <TableHead>基准</TableHead>
              <TableHead>对比</TableHead>
              <TableHead className="w-16 text-center">状态</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.name}>
                <TableCell className="pl-6 font-medium align-top">
                  {row.name}
                </TableCell>
                <TableCell className="align-top">
                  <CellValue value={row.valueA} />
                </TableCell>
                <TableCell className="align-top">
                  <CellValue value={row.valueB} />
                </TableCell>
                <TableCell className="text-center align-top">
                  {row.match ? (
                    <CheckCircle2 className="inline-block h-4 w-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <XCircle className="inline-block h-4 w-4 text-destructive" />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
