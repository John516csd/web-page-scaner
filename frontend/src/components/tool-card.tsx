import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { ToolMeta } from "@/tools/registry";

export function ToolCard({ tool }: { tool: ToolMeta }) {
  const Icon = tool.icon;
  return (
    <Link href={tool.href}>
      <Card className="group transition-all hover:shadow-lg hover:-translate-y-0.5 hover:border-primary">
        <CardHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <CardTitle className="group-hover:text-primary">{tool.name}</CardTitle>
          <CardDescription>{tool.description}</CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}
