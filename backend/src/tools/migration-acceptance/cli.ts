import fs from 'node:fs/promises';
import { closeBrowser } from '../../shared/browser.js';
import { runAcceptanceWorkbench, type WorkbenchRunResult } from './runner.js';
import type { AcceptanceStage, AcceptanceSuite } from './types.js';

async function main() {
  const args = parseArgs(process.argv.slice(2));

  try {
    const result = await runAcceptanceWorkbench({
      sessionId: parseOptionalInt(args.session),
      env: args.env as 'test' | 'production' | undefined,
      baseUrl: args['base-url'],
      gatsbyUrl: args['gatsby-url'],
      productionUrl: args['production-url'],
      sourceRepoPath: args['source-repo-path'],
      stages: args.stage ? parseStages(args.stage) : undefined,
      suites: args.suites ? parseSuites(args.suites) : undefined,
      sampleSize: {
        exactRedirects: parseOptionalInt(args['exact-redirects']),
        goneUrls: parseOptionalInt(args['gone-urls']),
        noindex: parseOptionalInt(args.noindex),
      },
      minSitemapUrls: parseOptionalInt(args['min-sitemap-urls']),
    });

    printSummary(result);

    if (args.json) {
      await fs.writeFile(args.json, JSON.stringify(result, null, 2), 'utf-8');
      console.log(`JSON report written to ${args.json}`);
    }

    process.exitCode = exitCodeFor(result);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  } finally {
    await closeBrowser();
  }
}

function parseArgs(argv: string[]): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      out[key] = 'true';
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

function parseOptionalInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseStages(value: string): AcceptanceStage[] {
  const allowed = new Set<AcceptanceStage>(['T0', 'T1', 'T2', 'T3', 'T4', 'T5']);
  const stages = value.split(',').map((item) => item.trim()).filter((item): item is AcceptanceStage => allowed.has(item as AcceptanceStage));
  if (stages.length === 0) throw new Error('--stage must contain one of T0,T1,T2,T3,T4,T5');
  return stages;
}

function parseSuites(value: string): AcceptanceSuite[] {
  const allowed = new Set<AcceptanceSuite>([
    'build-readiness',
    'smoke',
    'routing',
    'seo-geo',
    'page-parity',
    'cms-storyblok',
    'i18n',
    'functional-e2e',
    'visual-responsive',
    'performance',
    'analytics',
    'assets',
    'deploy-monitoring',
    'rollback',
    'post-launch',
  ]);
  const suites = value.split(',').map((item) => item.trim()).filter((item): item is AcceptanceSuite => allowed.has(item as AcceptanceSuite));
  if (suites.length === 0) throw new Error('--suites must contain a valid suite id');
  return suites;
}

function printSummary(result: WorkbenchRunResult) {
  console.log('');
  console.log(`Migration Acceptance ${result.goNoGo.decision === 'go' ? 'GO' : 'NO-GO'}`);
  console.log(`Run: #${result.run.id}`);
  console.log(`Env: ${result.run.env}`);
  console.log(`Base URL: ${result.run.baseUrl}`);
  console.log(`Passed: ${result.summary.passed}/${result.summary.total}`);
  console.log(`Failed: ${result.summary.failed}`);
  console.log(`Warned: ${result.summary.warned}`);
  console.log(`Blocked: ${result.summary.blocked || 0}`);
  console.log(`Duration: ${(result.summary.duration / 1000).toFixed(1)}s`);

  for (const section of result.sections) {
    console.log(`- ${section.stage || ''} ${section.name}: ${section.status.toUpperCase()} (${section.passed}/${section.total}, failed ${section.failed}, warned ${section.warned})`);
    for (const item of section.items.filter((entry) => entry.status === 'fail' || entry.status === 'blocked').slice(0, 10)) {
      console.log(`  x [${item.severity || 'P2'}] ${item.name}: ${item.failureReason || item.actual}`);
      if (item.url) console.log(`    ${item.url}`);
    }
  }

  if (result.goNoGo.blockers.length > 0) {
    console.log('');
    console.log('Blockers:');
    for (const blocker of result.goNoGo.blockers.slice(0, 20)) {
      console.log(`- [${blocker.type}] ${blocker.severity || ''} ${blocker.title}${blocker.detail ? `: ${blocker.detail}` : ''}`);
    }
  }
}

function exitCodeFor(result: WorkbenchRunResult): number {
  const automationBlocker = result.goNoGo.blockers.some((blocker) =>
    blocker.type === 'automation'
  );
  return automationBlocker ? 1 : 0;
}

main();
