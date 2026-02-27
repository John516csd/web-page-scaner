"use client";

import { Card, CardContent } from "@/components/ui/card";
import { ProgressSteps } from "@/components/progress-steps";
import type { StepState } from "../hooks/use-diff";

export function DiffProgress({ steps }: { steps: StepState[] }) {
  if (steps.length === 0) return null;

  const allDone = steps.every((s) => s.status === "done" || s.status === "error");
  if (allDone) return null;

  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <ProgressSteps
          steps={steps.map((s) => ({
            id: s.id,
            label: s.label,
            status: s.status,
          }))}
        />
        {steps.some((s) => s.message && s.status === "running") && (
          <p className="mt-3 text-xs text-muted-foreground">
            {steps.find((s) => s.status === "running")?.message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
