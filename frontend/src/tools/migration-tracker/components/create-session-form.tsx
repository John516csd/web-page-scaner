"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  onSubmit: (name: string, gatsbyUrl: string, nextjsUrl: string, sitemapUrl: string) => Promise<void>;
  loading?: boolean;
}

export function CreateSessionForm({ onSubmit, loading }: Props) {
  const [name, setName] = useState("");
  const [gatsbyUrl, setGatsbyUrl] = useState("");
  const [nextjsUrl, setNextjsUrl] = useState("");
  const [sitemapUrl, setSitemapUrl] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !gatsbyUrl.trim() || !nextjsUrl.trim() || !sitemapUrl.trim()) return;
    await onSubmit(name.trim(), gatsbyUrl.trim(), nextjsUrl.trim(), sitemapUrl.trim());
    setName("");
    setGatsbyUrl("");
    setNextjsUrl("");
    setSitemapUrl("");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="session-name">会话名称</Label>
        <Input
          id="session-name"
          placeholder="例如：v2.5 迁移验收"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="gatsby-url">Gatsby 旧站 Base URL</Label>
        <Input
          id="gatsby-url"
          placeholder="https://old.example.com"
          value={gatsbyUrl}
          onChange={(e) => setGatsbyUrl(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="nextjs-url">Next.js 新站 Base URL</Label>
        <Input
          id="nextjs-url"
          placeholder="https://new.example.com"
          value={nextjsUrl}
          onChange={(e) => setNextjsUrl(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sitemap-url">Sitemap URL</Label>
        <Input
          id="sitemap-url"
          placeholder="https://old.example.com/sitemap_index.xml"
          value={sitemapUrl}
          onChange={(e) => setSitemapUrl(e.target.value)}
          required
        />
        <p className="text-xs text-muted-foreground">
          完整的 sitemap 地址，支持 sitemap index（多级 sitemap）
        </p>
      </div>
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "创建中..." : "创建会话"}
      </Button>
    </form>
  );
}
