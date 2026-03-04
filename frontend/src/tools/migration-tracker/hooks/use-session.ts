"use client";

import { useState, useCallback } from "react";
import type { MigrationSession, SessionWithStats } from "../types";

const API = "/api/tools/migration-tracker";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

export function useSessions() {
  const [sessions, setSessions] = useState<MigrationSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<MigrationSession[]>("/sessions");
      setSessions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const createSession = useCallback(
    async (name: string, gatsby_base_url: string, nextjs_base_url: string, sitemap_url: string) => {
      const session = await apiFetch<MigrationSession>("/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, gatsby_base_url, nextjs_base_url, sitemap_url }),
      });
      setSessions((prev) => [session, ...prev]);
      return session;
    },
    []
  );

  return { sessions, loading, error, loadSessions, createSession };
}

export function useSession(id: number) {
  const [session, setSession] = useState<SessionWithStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<SessionWithStats>(`/sessions/${id}`);
      setSession(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  return { session, loading, error, loadSession, setSession };
}
