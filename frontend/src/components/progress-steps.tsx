"use client";

import { CheckCircle2, XCircle, Loader2, Circle } from "lucide-react";

export interface Step {
  id: string;
  label: string;
  status: "pending" | "running" | "done" | "error";
}

export function ProgressSteps({ steps }: { steps: Step[] }) {
  return (
    <div className="flex items-center gap-3">
      {steps.map((step, i) => (
        <div key={step.id} className="flex items-center gap-3">
          {i > 0 && (
            <div
              className={`h-px w-8 ${
                step.status === "pending"
                  ? "bg-border"
                  : "bg-primary"
              }`}
            />
          )}
          <div className="flex items-center gap-2">
            <StepIcon status={step.status} />
            <span
              className={`text-sm font-medium ${
                step.status === "running"
                  ? "text-primary"
                  : step.status === "error"
                    ? "text-destructive"
                    : step.status === "done"
                      ? "text-green-600 dark:text-green-400"
                      : "text-muted-foreground"
              }`}
            >
              {step.label}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function StepIcon({ status }: { status: Step["status"] }) {
  if (status === "done") {
    return <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />;
  }
  if (status === "error") {
    return <XCircle className="h-5 w-5 text-destructive" />;
  }
  if (status === "running") {
    return <Loader2 className="h-5 w-5 text-primary animate-spin" />;
  }
  return <Circle className="h-5 w-5 text-muted-foreground/40" />;
}
