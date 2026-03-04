"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, GitMerge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CreateSessionForm } from "@/tools/migration-tracker/components/create-session-form";
import { useSessions } from "@/tools/migration-tracker/hooks/use-session";
import type { MigrationSession } from "@/tools/migration-tracker/types";

export default function MigrationTrackerPage() {
  const router = useRouter();
  const { sessions, loading, error, loadSessions, createSession } = useSessions();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleCreate = async (name: string, gatsbyUrl: string, nextjsUrl: string, sitemapUrl: string) => {
    setCreating(true);
    try {
      const session = await createSession(name, gatsbyUrl, nextjsUrl, sitemapUrl);
      setOpen(false);
      router.push(`/tools/migration-tracker/${session.id}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2 gap-1 text-muted-foreground">
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            返回首页
          </Link>
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="mb-1 text-2xl font-bold tracking-tight">Migration Tracker</h1>
            <p className="text-muted-foreground">
              Gatsby → Next.js 迁移验收闭环工具
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-1" />
                新建会话
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>新建迁移会话</DialogTitle>
              </DialogHeader>
              <CreateSessionForm onSubmit={handleCreate} loading={creating} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {error && (
        <p className="text-destructive text-sm mb-4">{error}</p>
      )}

      {loading ? (
        <p className="text-muted-foreground">加载中...</p>
      ) : sessions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <GitMerge className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">还没有迁移会话</p>
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              新建会话
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sessions.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
        </div>
      )}
    </div>
  );
}

function SessionCard({ session }: { session: MigrationSession }) {
  const statusColor: Record<string, string> = {
    pending: "bg-secondary text-secondary-foreground",
    running: "bg-blue-100 text-blue-700",
    done: "bg-green-100 text-green-700",
    error: "bg-red-100 text-red-700",
  };
  const statusLabel: Record<string, string> = {
    pending: "未开始",
    running: `扫描中 ${session.scan_progress}%`,
    done: "已完成",
    error: "出错",
  };

  return (
    <Link href={`/tools/migration-tracker/${session.id}`}>
      <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-base truncate">{session.name}</CardTitle>
          <Badge className={statusColor[session.scan_status]}>
            {statusLabel[session.scan_status]}
          </Badge>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-1">
          <p className="truncate">旧站: {session.gatsby_base_url}</p>
          <p className="truncate">新站: {session.nextjs_base_url}</p>
          <p>{new Date(session.created_at).toLocaleString()}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
