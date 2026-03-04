export type ScanStatus = 'pending' | 'running' | 'done' | 'error';
export type DiffStatus = 'pass' | 'warn' | 'fail' | 'error';
export type ChangeStatus = 'pending' | 'verified' | 'failed' | 'skipped';

export interface MigrationSession {
  id: number;
  name: string;
  gatsby_base_url: string;
  nextjs_base_url: string;
  sitemap_url: string;
  created_at: string;
  scan_status: ScanStatus;
  scan_progress: number;
}

export interface PagePair {
  id: number;
  session_id: number;
  path: string;
  scan_status: ScanStatus;
  diff_status: DiffStatus | null;
  diff_result: string | null; // JSON
  scanned_at: string | null;
}

export interface ChangeRecord {
  id: number;
  session_id: number;
  pr_url: string;
  description: string;
  status: ChangeStatus;
  confidence_score: number | null;
  ai_reasoning: string | null;
  pages_affected: string | null; // JSON array
  analyzed_at: string | null;
}

export interface CreateSessionRequest {
  name: string;
  gatsby_base_url: string;
  nextjs_base_url: string;
  sitemap_url: string;
}

export interface ImportChangesRequest {
  csv: string;
}

export interface PatchChangeRequest {
  status: ChangeStatus;
}

export interface SessionStats {
  total_pages: number;
  scanned_pages: number;
  pass_pages: number;
  warn_pages: number;
  fail_pages: number;
  error_pages: number;
  total_changes: number;
  verified_changes: number;
  failed_changes: number;
  skipped_changes: number;
  pending_changes: number;
}
