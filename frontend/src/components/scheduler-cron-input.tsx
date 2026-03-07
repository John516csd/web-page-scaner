"use client";

import { useState } from "react";
import cronstrue from "cronstrue/i18n";
import { Check, ChevronsUpDown } from "lucide-react";
import { Input } from "./ui/input";
import { Separator } from "./ui/separator";

interface CronPreset {
  value: string;
  label: string;
  description: string;
}

const CRON_PRESETS: CronPreset[] = [
  { value: "0 9 * * 1-5", label: "工作日 9:00", description: "周一到周五，每天早上 9 点" },
  { value: "0 9 * * *", label: "每天 9:00", description: "每天早上 9 点" },
  { value: "0 10 * * *", label: "每天 10:00", description: "每天上午 10 点" },
  { value: "0 */2 * * *", label: "每 2 小时", description: "每隔 2 小时运行一次" },
  { value: "0 */4 * * *", label: "每 4 小时", description: "每隔 4 小时运行一次" },
  { value: "0 0 * * *", label: "每天 0:00", description: "每天午夜 12 点" },
];

interface SchedulerCronInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function SchedulerCronInput({ value, onChange, disabled }: SchedulerCronInputProps) {
  const [showCustom, setShowCustom] = useState(false);
  const matchedPreset = CRON_PRESETS.find(p => p.value === value);

  let cronDescription = "";
  let cronValid = true;
  try {
    cronDescription = cronstrue.toString(value, {
      locale: "zh_CN",
      use24HourTimeFormat: true,
    });
  } catch {
    cronDescription = "无效的 Cron 表达式";
    cronValid = false;
  }

  return (
    <div className="space-y-3">
      {/* Preset grid */}
      <div className="grid grid-cols-2 gap-2">
        {CRON_PRESETS.map((preset) => {
          const isSelected = value === preset.value;
          return (
            <button
              key={preset.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(preset.value)}
              className={`relative flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-all duration-150 hover:bg-accent/50 disabled:opacity-50 disabled:cursor-not-allowed ${
                isSelected
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : "border-border hover:border-foreground/20"
              }`}
            >
              {isSelected && (
                <span className="absolute top-2 right-2 flex items-center justify-center w-4 h-4 rounded-full bg-primary">
                  <Check className="h-2.5 w-2.5 text-primary-foreground" />
                </span>
              )}
              <span className={`text-sm font-medium leading-none ${
                isSelected ? "text-primary" : "text-foreground"
              }`}>
                {preset.label}
              </span>
              <span className="text-[11px] text-muted-foreground leading-snug pr-4">
                {preset.description}
              </span>
            </button>
          );
        })}
      </div>

      {/* Custom toggle */}
      <div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setShowCustom(!showCustom)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronsUpDown className="h-3 w-3" />
          {showCustom ? "收起" : "自定义 Cron 表达式"}
        </button>

        {showCustom && (
          <div className="mt-2 space-y-2">
            <div className="flex items-center gap-2">
              <Input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="0 9 * * 1-5"
                className="font-mono text-xs h-8 flex-1"
                disabled={disabled}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              格式: 分 时 日 月 周 — 例如 &ldquo;0 9 * * 1-5&rdquo; 表示工作日 9:00
            </p>
          </div>
        )}
      </div>

      <Separator />

      {/* Current status */}
      <div className={`flex items-center gap-2 text-xs ${
        cronValid ? "text-muted-foreground" : "text-destructive"
      }`}>
        <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
          cronValid ? "bg-emerald-500" : "bg-destructive"
        }`} />
        {!matchedPreset && cronValid && (
          <code className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded shrink-0">
            {value}
          </code>
        )}
        <span>{cronDescription}</span>
      </div>
    </div>
  );
}
