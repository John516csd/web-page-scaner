import { tools } from "@/tools/registry";
import { ToolCard } from "@/components/tool-card";

export default function HomePage() {
  return (
    <div>
      <div className="mb-10">
        <h1 className="mb-2 text-3xl font-bold tracking-tight">工具集合</h1>
        <p className="text-muted-foreground">
          选择一个工具开始使用
        </p>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => (
          <ToolCard key={tool.id} tool={tool} />
        ))}
      </div>
    </div>
  );
}
