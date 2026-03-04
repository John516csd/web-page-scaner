import Database from 'better-sqlite3';
import { join } from 'path';
import { mkdirSync } from 'fs';
import type {
  MigrationSession,
  PagePair,
  ChangeRecord,
  ScanStatus,
  DiffStatus,
  ChangeStatus,
  SessionStats,
} from './types.js';

const DB_DIR = join(process.cwd(), 'data');
mkdirSync(DB_DIR, { recursive: true });

const db = new Database(join(DB_DIR, 'migration-tracker.db'));

// Enable WAL for better concurrent performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS migration_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    gatsby_base_url TEXT NOT NULL,
    nextjs_base_url TEXT NOT NULL,
    sitemap_url TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    scan_status TEXT NOT NULL DEFAULT 'pending',
    scan_progress INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS page_pairs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES migration_sessions(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    scan_status TEXT NOT NULL DEFAULT 'pending',
    diff_status TEXT,
    diff_result TEXT,
    scanned_at TEXT,
    UNIQUE(session_id, path)
  );

  CREATE INDEX IF NOT EXISTS idx_page_pairs_session ON page_pairs(session_id);
  CREATE INDEX IF NOT EXISTS idx_page_pairs_scan_status ON page_pairs(session_id, scan_status);

  CREATE TABLE IF NOT EXISTS change_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES migration_sessions(id) ON DELETE CASCADE,
    pr_url TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    confidence_score INTEGER,
    ai_reasoning TEXT,
    pages_affected TEXT,
    analyzed_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_change_records_session ON change_records(session_id);
`);

// Migrate existing DB: add sitemap_url if it doesn't exist yet
try {
  db.exec(`ALTER TABLE migration_sessions ADD COLUMN sitemap_url TEXT NOT NULL DEFAULT '';`);
} catch { /* column already exists — safe to ignore */ }

// Sessions
export function createSession(
  name: string,
  gatsby_base_url: string,
  nextjs_base_url: string,
  sitemap_url: string
): MigrationSession {
  const stmt = db.prepare(
    `INSERT INTO migration_sessions (name, gatsby_base_url, nextjs_base_url, sitemap_url)
     VALUES (?, ?, ?, ?) RETURNING *`
  );
  return stmt.get(name, gatsby_base_url, nextjs_base_url, sitemap_url) as MigrationSession;
}

export function listSessions(): MigrationSession[] {
  return db.prepare('SELECT * FROM migration_sessions ORDER BY created_at DESC').all() as MigrationSession[];
}

export function getSession(id: number): MigrationSession | undefined {
  return db.prepare('SELECT * FROM migration_sessions WHERE id = ?').get(id) as MigrationSession | undefined;
}

export function updateSessionScanStatus(id: number, status: ScanStatus, progress?: number) {
  if (progress !== undefined) {
    db.prepare('UPDATE migration_sessions SET scan_status = ?, scan_progress = ? WHERE id = ?')
      .run(status, progress, id);
  } else {
    db.prepare('UPDATE migration_sessions SET scan_status = ? WHERE id = ?')
      .run(status, id);
  }
}

export function getSessionStats(sessionId: number): SessionStats {
  const pageStats = db.prepare(`
    SELECT
      COUNT(*) as total_pages,
      COUNT(CASE WHEN scan_status = 'done' THEN 1 END) as scanned_pages,
      COUNT(CASE WHEN diff_status = 'pass' THEN 1 END) as pass_pages,
      COUNT(CASE WHEN diff_status = 'warn' THEN 1 END) as warn_pages,
      COUNT(CASE WHEN diff_status = 'fail' THEN 1 END) as fail_pages,
      COUNT(CASE WHEN diff_status = 'error' THEN 1 END) as error_pages
    FROM page_pairs WHERE session_id = ?
  `).get(sessionId) as Record<string, number>;

  const changeStats = db.prepare(`
    SELECT
      COUNT(*) as total_changes,
      COUNT(CASE WHEN status = 'verified' THEN 1 END) as verified_changes,
      COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_changes,
      COUNT(CASE WHEN status = 'skipped' THEN 1 END) as skipped_changes,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_changes
    FROM change_records WHERE session_id = ?
  `).get(sessionId) as Record<string, number>;

  return { ...pageStats, ...changeStats } as unknown as SessionStats;
}

// Page pairs
export function bulkInsertPagePaths(sessionId: number, paths: string[]) {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO page_pairs (session_id, path) VALUES (?, ?)`
  );
  const insertMany = db.transaction((paths: string[]) => {
    for (const path of paths) {
      insert.run(sessionId, path);
    }
  });
  insertMany(paths);
}

export function countTotalPages(sessionId: number): number {
  return (db.prepare('SELECT COUNT(*) as cnt FROM page_pairs WHERE session_id = ?').get(sessionId) as { cnt: number }).cnt;
}

export function getPendingPages(sessionId: number, limit?: number): PagePair[] {
  if (limit !== undefined) {
    return db.prepare(
      `SELECT * FROM page_pairs WHERE session_id = ? AND scan_status != 'done' ORDER BY id LIMIT ?`
    ).all(sessionId, limit) as PagePair[];
  }
  return db.prepare(
    `SELECT * FROM page_pairs WHERE session_id = ? AND scan_status != 'done' ORDER BY id`
  ).all(sessionId) as PagePair[];
}

export function updatePageResult(
  id: number,
  diffStatus: DiffStatus,
  diffResult: unknown
) {
  db.prepare(
    `UPDATE page_pairs SET scan_status = 'done', diff_status = ?, diff_result = ?, scanned_at = datetime('now') WHERE id = ?`
  ).run(diffStatus, JSON.stringify(diffResult), id);
}

export function updatePageScanStatus(id: number, status: ScanStatus) {
  db.prepare('UPDATE page_pairs SET scan_status = ? WHERE id = ?').run(status, id);
}

export function listPages(
  sessionId: number,
  opts: { limit: number; offset: number; diffStatus?: DiffStatus; pathFilter?: string }
): { rows: PagePair[]; total: number } {
  let where = 'WHERE session_id = ?';
  const params: unknown[] = [sessionId];

  if (opts.diffStatus) {
    where += ' AND diff_status = ?';
    params.push(opts.diffStatus);
  }
  if (opts.pathFilter) {
    where += ' AND path LIKE ?';
    params.push(`%${opts.pathFilter}%`);
  }

  const total = (db.prepare(`SELECT COUNT(*) as cnt FROM page_pairs ${where}`).get(...params) as { cnt: number }).cnt;
  const rows = db.prepare(
    `SELECT * FROM page_pairs ${where} ORDER BY id LIMIT ? OFFSET ?`
  ).all(...params, opts.limit, opts.offset) as PagePair[];

  return { rows, total };
}

export function getDiffPages(sessionId: number, statuses: DiffStatus[]): PagePair[] {
  const placeholders = statuses.map(() => '?').join(',');
  return db.prepare(
    `SELECT * FROM page_pairs WHERE session_id = ? AND diff_status IN (${placeholders})`
  ).all(sessionId, ...statuses) as PagePair[];
}

// Change records
export function bulkInsertChanges(
  sessionId: number,
  changes: { pr_url: string; description: string }[]
): number {
  const insert = db.prepare(
    `INSERT INTO change_records (session_id, pr_url, description) VALUES (?, ?, ?)`
  );
  const insertMany = db.transaction((changes: { pr_url: string; description: string }[]) => {
    for (const c of changes) {
      insert.run(sessionId, c.pr_url, c.description);
    }
  });
  insertMany(changes);
  return changes.length;
}

export function listChanges(sessionId: number): ChangeRecord[] {
  return db.prepare(
    'SELECT * FROM change_records WHERE session_id = ? ORDER BY id'
  ).all(sessionId) as ChangeRecord[];
}

export function getPendingChanges(sessionId: number): ChangeRecord[] {
  return db.prepare(
    `SELECT * FROM change_records WHERE session_id = ? AND status = 'pending' AND analyzed_at IS NULL ORDER BY id`
  ).all(sessionId) as ChangeRecord[];
}

export function updateChangeAnalysis(
  id: number,
  pagesAffected: string[],
  confidenceScore: number,
  aiReasoning: string
) {
  db.prepare(
    `UPDATE change_records SET pages_affected = ?, confidence_score = ?, ai_reasoning = ?, analyzed_at = datetime('now') WHERE id = ?`
  ).run(JSON.stringify(pagesAffected), confidenceScore, aiReasoning, id);
}

export function updateChangeStatus(id: number, status: ChangeStatus) {
  db.prepare('UPDATE change_records SET status = ? WHERE id = ?').run(status, id);
}

export function getChange(id: number): ChangeRecord | undefined {
  return db.prepare('SELECT * FROM change_records WHERE id = ?').get(id) as ChangeRecord | undefined;
}

export function deleteChange(id: number) {
  db.prepare('DELETE FROM change_records WHERE id = ?').run(id);
}

export function deleteAllChanges(sessionId: number) {
  db.prepare('DELETE FROM change_records WHERE session_id = ?').run(sessionId);
}
