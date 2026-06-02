import fs from 'node:fs/promises';
import path from 'node:path';
import { GENERATED_MIGRATION_SOURCE } from './generated-source-data.js';
import type { MigrationSourceData, RedirectRule } from './types.js';

const CONSTANTS_DIR = 'src/constants';

export async function loadMigrationSource(sourceRepoPath?: string): Promise<MigrationSourceData> {
  if (sourceRepoPath?.trim()) {
    return normalizeMigrationSource(await parseMigrationSource(sourceRepoPath.trim()));
  }

  return normalizeMigrationSource(GENERATED_MIGRATION_SOURCE);
}

export async function parseMigrationSource(sourceRepoPath: string): Promise<MigrationSourceData> {
  const [exactText, prefixText, externalText, goneText, noindexText] = await Promise.all([
    readConstant(sourceRepoPath, 'exact-redirect-rules.ts'),
    readConstant(sourceRepoPath, 'prefix-redirect-rules.ts'),
    readConstant(sourceRepoPath, 'external-redirect-rules.ts'),
    readConstant(sourceRepoPath, 'gone-urls.ts'),
    readConstant(sourceRepoPath, 'noindex-paths.data.ts'),
  ]);

  return {
    exactRedirects: parseRecord(exactText).sort(compareRules),
    prefixRedirects: parseRecord(prefixText).sort(compareRules),
    externalRedirects: parseRecord(externalText).sort(compareRules),
    goneUrls: parseStringList(goneText).sort(),
    noindexPaths: parseStringList(noindexText).sort(),
  };
}

function normalizeMigrationSource(source: MigrationSourceData): MigrationSourceData {
  return {
    ...source,
    exactRedirects: [...source.exactRedirects].sort(compareRules),
    prefixRedirects: [...source.prefixRedirects].sort(compareRules),
    externalRedirects: [...source.externalRedirects].sort(compareRules),
    goneUrls: [...source.goneUrls].sort(),
    noindexPaths: [...source.noindexPaths].sort(),
  };
}

async function readConstant(sourceRepoPath: string, filename: string): Promise<string> {
  return await fs.readFile(path.join(sourceRepoPath, CONSTANTS_DIR, filename), 'utf-8');
}

function parseRecord(text: string): RedirectRule[] {
  const rules: RedirectRule[] = [];
  const re = /["']([^"']+)["']\s*:\s*["']([^"']*)["']/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    rules.push({ source: match[1], target: match[2] });
  }
  return rules;
}

function parseStringList(text: string): string[] {
  const values: string[] = [];
  const listMatch = text.match(/=\s*\[\s*([\s\S]*?)\s*\]/);
  const listText = listMatch ? listMatch[1] : text;
  const re = /["']([^"']+)["']/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(listText)) !== null) {
    values.push(match[1]);
  }
  return [...new Set(values)];
}

function compareRules(a: RedirectRule, b: RedirectRule): number {
  return a.source.localeCompare(b.source);
}
