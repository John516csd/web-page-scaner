"use client";

import { ResultTable } from "@/components/result-table";
import type { CheckResult } from "../types";

export function SeoResult({ data }: { data: CheckResult }) {
  return (
    <ResultTable
      title="SEO 对比"
      rows={data.items.map((item) => ({
        name: item.name,
        valueA: item.valueA,
        valueB: item.valueB,
        match: item.match,
      }))}
    />
  );
}
