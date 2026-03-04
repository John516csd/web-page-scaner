"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import type { DeadLinkResult, LinkCheckResult, LinkStatus } from "../types";

function StatusBadge({ status, statusCode }: { status: LinkStatus; statusCode: number | null }) {
  if (status === "alive") {
    return (
      <Badge variant="outline" className="border-green-500 text-green-600">
        {statusCode ?? "OK"}
      </Badge>
    );
  }
  if (status === "dead") {
    return (
      <Badge variant="destructive">
        {statusCode ?? "Dead"}
      </Badge>
    );
  }
  if (status === "blocked") {
    return (
      <Badge variant="outline" className="border-amber-500 text-amber-600">
        403 Blocked
      </Badge>
    );
  }
  if (status === "error") {
    return (
      <Badge variant="outline" className="border-yellow-500 text-yellow-600">
        Error
      </Badge>
    );
  }
  return (
    <Badge variant="secondary">Skip</Badge>
  );
}

function sortLinks(links: LinkCheckResult[]): LinkCheckResult[] {
  const order: Record<LinkStatus, number> = { dead: 0, error: 1, blocked: 2, alive: 3, skipped: 4 };
  return [...links].sort((a, b) => order[a.status] - order[b.status]);
}

export function DeadLinkResultView({ result }: { result: DeadLinkResult }) {
  const sorted = sortLinks(result.links);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Card>
          <CardContent className="pt-5">
            <p className="text-2xl font-bold">{result.summary.total}</p>
            <p className="text-sm text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-2xl font-bold text-red-600">{result.summary.dead}</p>
            <p className="text-sm text-muted-foreground">Broken</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-2xl font-bold text-green-600">{result.summary.alive}</p>
            <p className="text-sm text-muted-foreground">Working</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-2xl font-bold text-amber-600">{result.summary.blocked}</p>
            <p className="text-sm text-muted-foreground">Blocked (403)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-2xl font-bold text-muted-foreground">
              {result.summary.skipped + result.summary.error}
            </p>
            <p className="text-sm text-muted-foreground">Skipped / Error</p>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Status</TableHead>
              <TableHead>URL</TableHead>
              <TableHead className="hidden sm:table-cell">Link Text</TableHead>
              <TableHead className="w-24 text-right">Time (ms)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((link) => (
              <TableRow key={link.url}>
                <TableCell>
                  <StatusBadge status={link.status} statusCode={link.statusCode} />
                </TableCell>
                <TableCell className="max-w-xs">
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate font-mono text-xs hover:underline"
                    title={link.url}
                  >
                    {link.url}
                  </a>
                  {link.errorMessage && (
                    <p className="mt-0.5 text-xs text-yellow-600">{link.errorMessage}</p>
                  )}
                  {link.redirectedTo && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      → {link.redirectedTo}
                    </p>
                  )}
                </TableCell>
                <TableCell className="hidden max-w-[200px] truncate text-sm text-muted-foreground sm:table-cell">
                  {link.text || <span className="italic opacity-50">—</span>}
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  {link.durationMs > 0 ? link.durationMs : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
