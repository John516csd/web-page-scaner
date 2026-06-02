import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { computeGoNoGo } from './go-no-go.js';
import type {
  AcceptanceDefect,
  AcceptanceEvidence,
  AcceptanceItem,
  AcceptanceRun,
  AcceptanceSection,
  AcceptanceSession,
  AcceptanceSessionDetail,
  AcceptanceSignoff,
  AcceptanceStatus,
  AcceptanceSuite,
  AcceptanceStage,
  CreateAcceptanceSessionInput,
  CreateDefectInput,
  UpsertEvidenceInput,
  UpsertSignoffInput,
} from './types.js';

const DEFAULT_PRODUCTION_URL = 'https://www.notta.ai';

export class AcceptanceStore {
  private db: Database.Database;

  constructor(dbPath = defaultDbPath()) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.migrate();
  }

  close() {
    this.db.close();
  }

  createSession(input: CreateAcceptanceSessionInput): AcceptanceSession {
    const now = new Date().toISOString();
    const row = this.db.prepare(`
      INSERT INTO acceptance_sessions (
        name, env, base_url, gatsby_url, production_url, sitemap_url, source_repo_path,
        tracker_session_id, cloudfront_distribution, commit_sha, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `).get(
      input.name,
      input.env,
      input.baseUrl,
      input.gatsbyUrl || DEFAULT_PRODUCTION_URL,
      input.productionUrl || DEFAULT_PRODUCTION_URL,
      input.sitemapUrl || '',
      input.sourceRepoPath || '',
      input.trackerSessionId || null,
      input.cloudfrontDistribution || '',
      input.commitSha || '',
      now,
      now
    );
    return mapSession(row);
  }

  listSessions(): AcceptanceSession[] {
    return this.db.prepare('SELECT * FROM acceptance_sessions ORDER BY created_at DESC').all().map(mapSession);
  }

  getSession(id: number): AcceptanceSession | undefined {
    const row = this.db.prepare('SELECT * FROM acceptance_sessions WHERE id = ?').get(id);
    return row ? mapSession(row) : undefined;
  }

  getSessionDetail(id: number): AcceptanceSessionDetail | undefined {
    const session = this.getSession(id);
    if (!session) return undefined;
    const runs = this.listRuns(id);
    const sections = this.listSectionsForSession(id);
    const items = this.listItemsForSession(id);
    const evidence = this.listEvidence(id);
    const signoffs = this.listSignoffs(id);
    const defects = this.listDefects(id);
    return {
      session,
      runs,
      sections,
      items,
      evidence,
      signoffs,
      defects,
      goNoGo: computeGoNoGo({ sections, items, evidence, signoffs, defects }),
    };
  }

  createRun(input: {
    sessionId?: number;
    env: 'test' | 'production';
    baseUrl: string;
    gatsbyUrl: string;
    productionUrl: string;
    stages: AcceptanceStage[];
    suites: AcceptanceSuite[];
  }): AcceptanceRun {
    const summary = { total: 0, passed: 0, failed: 0, warned: 0, blocked: 0, duration: 0 };
    const row = this.db.prepare(`
      INSERT INTO acceptance_runs (
        session_id, env, base_url, gatsby_url, production_url, stages, suites, status, summary, started_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
      RETURNING *
    `).get(
      input.sessionId || null,
      input.env,
      input.baseUrl,
      input.gatsbyUrl,
      input.productionUrl,
      JSON.stringify(input.stages),
      JSON.stringify(input.suites),
      JSON.stringify(summary),
      new Date().toISOString()
    );
    return mapRun(row);
  }

  finishRun(id: number, status: AcceptanceStatus, summary: AcceptanceRun['summary']): AcceptanceRun {
    const row = this.db.prepare(`
      UPDATE acceptance_runs SET status = ?, summary = ?, finished_at = ? WHERE id = ? RETURNING *
    `).get(status, JSON.stringify(summary), new Date().toISOString(), id);
    return mapRun(row);
  }

  listRuns(sessionId: number): AcceptanceRun[] {
    return this.db.prepare('SELECT * FROM acceptance_runs WHERE session_id = ? ORDER BY id DESC').all(sessionId).map(mapRun);
  }

  insertSection(runId: number, section: AcceptanceSection): AcceptanceSection {
    const row = this.db.prepare(`
      INSERT INTO acceptance_sections (
        run_id, stage, suite, name, status, total, passed, failed, warned, blocked, duration_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `).get(
      runId,
      section.stage || null,
      section.suite || null,
      section.name,
      section.status,
      section.total,
      section.passed,
      section.failed,
      section.warned,
      section.blocked || 0,
      section.durationMs || 0
    );
    const saved = mapSection(row);
    for (const item of section.items) {
      this.insertItem(Number(saved.id), {
        ...item,
        stage: item.stage || section.stage,
        suite: item.suite || section.suite,
      });
    }
    return saved;
  }

  insertItem(sectionId: number, item: AcceptanceItem): AcceptanceItem {
    const row = this.db.prepare(`
      INSERT INTO acceptance_items (
        section_id, stage, suite, name, url, status, severity, expected, actual,
        failure_reason, duration_ms, response_headers, evidence_url, evidence_text
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `).get(
      sectionId,
      item.stage || null,
      item.suite || null,
      item.name,
      item.url || '',
      item.status,
      item.severity || 'P2',
      item.expected,
      item.actual,
      item.failureReason || '',
      item.durationMs,
      item.responseHeaders ? JSON.stringify(item.responseHeaders) : '',
      item.evidenceUrl || '',
      item.evidenceText || ''
    );
    return mapItem(row);
  }

  listSectionsForSession(sessionId: number): AcceptanceSection[] {
    const sections = this.db.prepare(`
      SELECT s.* FROM acceptance_sections s
      JOIN acceptance_runs r ON r.id = s.run_id
      WHERE r.session_id = ?
      ORDER BY s.id
    `).all(sessionId).map(mapSection);
    return sections.map((section) => ({
      ...section,
      items: this.db.prepare('SELECT * FROM acceptance_items WHERE section_id = ? ORDER BY id').all(section.id).map(mapItem),
    }));
  }

  listItemsForSession(sessionId: number): AcceptanceItem[] {
    return this.db.prepare(`
      SELECT i.* FROM acceptance_items i
      JOIN acceptance_sections s ON s.id = i.section_id
      JOIN acceptance_runs r ON r.id = s.run_id
      WHERE r.session_id = ?
      ORDER BY i.id
    `).all(sessionId).map(mapItem);
  }

  listSectionsForRun(runId: number): AcceptanceSection[] {
    const sections = this.db.prepare('SELECT * FROM acceptance_sections WHERE run_id = ? ORDER BY id').all(runId).map(mapSection);
    return sections.map((section) => ({
      ...section,
      items: this.db.prepare('SELECT * FROM acceptance_items WHERE section_id = ? ORDER BY id').all(section.id).map(mapItem),
    }));
  }

  upsertEvidence(sessionId: number, input: UpsertEvidenceInput): AcceptanceEvidence {
    const existing = this.db.prepare(
      'SELECT * FROM acceptance_evidence WHERE session_id = ? AND module_id = ?'
    ).get(sessionId, input.moduleId);
    const now = new Date().toISOString();
    if (existing) {
      const current = mapEvidence(existing);
      const row = this.db.prepare(`
        UPDATE acceptance_evidence
        SET name = ?, owner = ?, required = ?, status = ?, evidence_url = ?, evidence_text = ?,
            notes = ?, waiver_reason = ?, updated_at = ?
        WHERE session_id = ? AND module_id = ?
        RETURNING *
      `).get(
        input.name || current.name,
        input.owner ?? current.owner ?? '',
        input.required === undefined ? (current.required ? 1 : 0) : input.required ? 1 : 0,
        input.status || current.status,
        input.evidenceUrl ?? current.evidenceUrl ?? '',
        input.evidenceText ?? current.evidenceText ?? '',
        input.notes ?? current.notes ?? '',
        input.waiverReason ?? current.waiverReason ?? '',
        now,
        sessionId,
        input.moduleId
      );
      return mapEvidence(row);
    }

    const row = this.db.prepare(`
      INSERT INTO acceptance_evidence (
        session_id, module_id, name, owner, required, status, evidence_url, evidence_text,
        notes, waiver_reason, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `).get(
      sessionId,
      input.moduleId,
      input.name || input.moduleId,
      input.owner || '',
      input.required === false ? 0 : 1,
      input.status || 'pending',
      input.evidenceUrl || '',
      input.evidenceText || '',
      input.notes || '',
      input.waiverReason || '',
      now
    );
    return mapEvidence(row);
  }

  listEvidence(sessionId: number): AcceptanceEvidence[] {
    return this.db.prepare('SELECT * FROM acceptance_evidence WHERE session_id = ? ORDER BY id').all(sessionId).map(mapEvidence);
  }

  upsertSignoff(sessionId: number, input: UpsertSignoffInput): AcceptanceSignoff {
    const now = new Date().toISOString();
    const existing = this.db.prepare(
      'SELECT * FROM acceptance_signoffs WHERE session_id = ? AND module_id = ?'
    ).get(sessionId, input.moduleId);
    if (existing) {
      const row = this.db.prepare(`
        UPDATE acceptance_signoffs
        SET status = ?, owner = ?, signer = ?, notes = ?, waiver_reason = ?, signed_at = ?
        WHERE session_id = ? AND module_id = ?
        RETURNING *
      `).get(
        input.status || 'pending',
        input.owner || '',
        input.signer || '',
        input.notes || '',
        input.waiverReason || '',
        input.status === 'pass' || input.status === 'waived' ? now : '',
        sessionId,
        input.moduleId
      );
      return mapSignoff(row);
    }

    const row = this.db.prepare(`
      INSERT INTO acceptance_signoffs (
        session_id, module_id, status, owner, signer, notes, waiver_reason, signed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `).get(
      sessionId,
      input.moduleId,
      input.status || 'pending',
      input.owner || '',
      input.signer || '',
      input.notes || '',
      input.waiverReason || '',
      input.status === 'pass' || input.status === 'waived' ? now : ''
    );
    return mapSignoff(row);
  }

  listSignoffs(sessionId: number): AcceptanceSignoff[] {
    return this.db.prepare('SELECT * FROM acceptance_signoffs WHERE session_id = ? ORDER BY id').all(sessionId).map(mapSignoff);
  }

  createDefect(sessionId: number, input: CreateDefectInput): AcceptanceDefect {
    const now = new Date().toISOString();
    const row = this.db.prepare(`
      INSERT INTO acceptance_defects (
        session_id, title, severity, status, owner, issue_url, item_id, notes,
        retest_result, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `).get(
      sessionId,
      input.title,
      input.severity,
      input.status || 'open',
      input.owner || '',
      input.issueUrl || '',
      input.itemId || null,
      input.notes || '',
      input.retestResult || '',
      now,
      now
    );
    return mapDefect(row);
  }

  updateDefect(sessionId: number, defectId: number, input: Partial<CreateDefectInput>): AcceptanceDefect | undefined {
    const existing = this.db.prepare(
      'SELECT * FROM acceptance_defects WHERE id = ? AND session_id = ?'
    ).get(defectId, sessionId);
    if (!existing) return undefined;
    const current = mapDefect(existing);
    const row = this.db.prepare(`
      UPDATE acceptance_defects
      SET title = ?, severity = ?, status = ?, owner = ?, issue_url = ?, item_id = ?,
          notes = ?, retest_result = ?, updated_at = ?
      WHERE id = ? AND session_id = ?
      RETURNING *
    `).get(
      input.title || current.title,
      input.severity || current.severity,
      input.status || current.status,
      input.owner ?? current.owner ?? '',
      input.issueUrl ?? current.issueUrl ?? '',
      input.itemId ?? current.itemId ?? null,
      input.notes ?? current.notes ?? '',
      input.retestResult ?? current.retestResult ?? '',
      new Date().toISOString(),
      defectId,
      sessionId
    );
    return mapDefect(row);
  }

  listDefects(sessionId: number): AcceptanceDefect[] {
    return this.db.prepare('SELECT * FROM acceptance_defects WHERE session_id = ? ORDER BY id').all(sessionId).map(mapDefect);
  }

  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS acceptance_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        env TEXT NOT NULL,
        base_url TEXT NOT NULL,
        gatsby_url TEXT NOT NULL,
        production_url TEXT NOT NULL,
        sitemap_url TEXT NOT NULL DEFAULT '',
        source_repo_path TEXT NOT NULL DEFAULT '',
        tracker_session_id INTEGER,
        cloudfront_distribution TEXT NOT NULL DEFAULT '',
        commit_sha TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS acceptance_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER REFERENCES acceptance_sessions(id) ON DELETE CASCADE,
        env TEXT NOT NULL,
        base_url TEXT NOT NULL,
        gatsby_url TEXT NOT NULL,
        production_url TEXT NOT NULL,
        stages TEXT NOT NULL,
        suites TEXT NOT NULL,
        status TEXT NOT NULL,
        summary TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT
      );

      CREATE TABLE IF NOT EXISTS acceptance_sections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id INTEGER NOT NULL REFERENCES acceptance_runs(id) ON DELETE CASCADE,
        stage TEXT,
        suite TEXT,
        name TEXT NOT NULL,
        status TEXT NOT NULL,
        total INTEGER NOT NULL,
        passed INTEGER NOT NULL,
        failed INTEGER NOT NULL,
        warned INTEGER NOT NULL,
        blocked INTEGER NOT NULL DEFAULT 0,
        duration_ms INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS acceptance_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        section_id INTEGER NOT NULL REFERENCES acceptance_sections(id) ON DELETE CASCADE,
        stage TEXT,
        suite TEXT,
        name TEXT NOT NULL,
        url TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL,
        severity TEXT NOT NULL DEFAULT 'P2',
        expected TEXT NOT NULL,
        actual TEXT NOT NULL,
        failure_reason TEXT NOT NULL DEFAULT '',
        duration_ms INTEGER NOT NULL DEFAULT 0,
        response_headers TEXT NOT NULL DEFAULT '',
        evidence_url TEXT NOT NULL DEFAULT '',
        evidence_text TEXT NOT NULL DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS acceptance_evidence (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL REFERENCES acceptance_sessions(id) ON DELETE CASCADE,
        module_id TEXT NOT NULL,
        name TEXT NOT NULL,
        owner TEXT NOT NULL DEFAULT '',
        required INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'pending',
        evidence_url TEXT NOT NULL DEFAULT '',
        evidence_text TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        waiver_reason TEXT NOT NULL DEFAULT '',
        updated_at TEXT,
        UNIQUE(session_id, module_id)
      );

      CREATE TABLE IF NOT EXISTS acceptance_signoffs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL REFERENCES acceptance_sessions(id) ON DELETE CASCADE,
        module_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        owner TEXT NOT NULL DEFAULT '',
        signer TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        waiver_reason TEXT NOT NULL DEFAULT '',
        signed_at TEXT,
        UNIQUE(session_id, module_id)
      );

      CREATE TABLE IF NOT EXISTS acceptance_defects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL REFERENCES acceptance_sessions(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        severity TEXT NOT NULL,
        status TEXT NOT NULL,
        owner TEXT NOT NULL DEFAULT '',
        issue_url TEXT NOT NULL DEFAULT '',
        item_id INTEGER,
        notes TEXT NOT NULL DEFAULT '',
        retest_result TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS acceptance_observation_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL REFERENCES acceptance_sessions(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'pending',
        interval_minutes INTEGER NOT NULL DEFAULT 60,
        total_runs INTEGER NOT NULL DEFAULT 4,
        completed_runs INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  }
}

function defaultDbPath(): string {
  const dataDir = join(process.cwd(), 'data');
  return process.env.MIGRATION_ACCEPTANCE_DB_PATH || join(dataDir, 'migration-acceptance.db');
}

function mapSession(row: any): AcceptanceSession {
  return {
    id: row.id,
    name: row.name,
    env: row.env,
    baseUrl: row.base_url,
    gatsbyUrl: row.gatsby_url,
    productionUrl: row.production_url,
    sitemapUrl: row.sitemap_url || undefined,
    sourceRepoPath: row.source_repo_path || undefined,
    trackerSessionId: row.tracker_session_id || undefined,
    cloudfrontDistribution: row.cloudfront_distribution || undefined,
    commitSha: row.commit_sha || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRun(row: any): AcceptanceRun {
  return {
    id: row.id,
    sessionId: row.session_id || undefined,
    env: row.env,
    baseUrl: row.base_url,
    gatsbyUrl: row.gatsby_url,
    productionUrl: row.production_url,
    stages: JSON.parse(row.stages || '[]'),
    suites: JSON.parse(row.suites || '[]'),
    status: row.status,
    summary: JSON.parse(row.summary),
    startedAt: row.started_at,
    finishedAt: row.finished_at || undefined,
  };
}

function mapSection(row: any): AcceptanceSection {
  return {
    id: row.id,
    runId: row.run_id,
    stage: row.stage || undefined,
    suite: row.suite || undefined,
    name: row.name,
    status: row.status,
    total: row.total,
    passed: row.passed,
    failed: row.failed,
    warned: row.warned,
    blocked: row.blocked,
    durationMs: row.duration_ms,
    items: [],
  };
}

function mapItem(row: any): AcceptanceItem {
  return {
    id: row.id,
    sectionId: row.section_id,
    stage: row.stage || undefined,
    suite: row.suite || undefined,
    name: row.name,
    url: row.url || undefined,
    status: row.status,
    severity: row.severity,
    expected: row.expected,
    actual: row.actual,
    failureReason: row.failure_reason || undefined,
    durationMs: row.duration_ms,
    responseHeaders: row.response_headers ? JSON.parse(row.response_headers) : undefined,
    evidenceUrl: row.evidence_url || undefined,
    evidenceText: row.evidence_text || undefined,
  };
}

function mapEvidence(row: any): AcceptanceEvidence {
  return {
    id: row.id,
    sessionId: row.session_id,
    moduleId: row.module_id,
    name: row.name,
    owner: row.owner || undefined,
    required: !!row.required,
    status: row.status,
    evidenceUrl: row.evidence_url || undefined,
    evidenceText: row.evidence_text || undefined,
    notes: row.notes || undefined,
    waiverReason: row.waiver_reason || undefined,
    updatedAt: row.updated_at || undefined,
  };
}

function mapSignoff(row: any): AcceptanceSignoff {
  return {
    id: row.id,
    sessionId: row.session_id,
    moduleId: row.module_id,
    status: row.status,
    owner: row.owner || undefined,
    signer: row.signer || undefined,
    notes: row.notes || undefined,
    waiverReason: row.waiver_reason || undefined,
    signedAt: row.signed_at || undefined,
  };
}

function mapDefect(row: any): AcceptanceDefect {
  return {
    id: row.id,
    sessionId: row.session_id,
    title: row.title,
    severity: row.severity,
    status: row.status,
    owner: row.owner || undefined,
    issueUrl: row.issue_url || undefined,
    itemId: row.item_id || undefined,
    notes: row.notes || undefined,
    retestResult: row.retest_result || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const acceptanceStore = new AcceptanceStore();
