import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseMigrationSource } from './source-parser.js';

const DEFAULT_OUTPUT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'generated-source-data.ts'
);

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourceRepoPath = args['source-repo-path'] || process.env.NOTTA_NEXT_REPO_PATH;
  if (!sourceRepoPath) {
    throw new Error('--source-repo-path or NOTTA_NEXT_REPO_PATH is required');
  }

  const source = await parseMigrationSource(sourceRepoPath);
  const outputPath = args.output || DEFAULT_OUTPUT;
  const contents = `import type { MigrationSourceData } from './types.js';

export const GENERATED_MIGRATION_SOURCE_META = {
  counts: {
    exactRedirects: ${source.exactRedirects.length},
    prefixRedirects: ${source.prefixRedirects.length},
    externalRedirects: ${source.externalRedirects.length},
    goneUrls: ${source.goneUrls.length},
    noindexPaths: ${source.noindexPaths.length},
  },
};

export const GENERATED_MIGRATION_SOURCE: MigrationSourceData = ${JSON.stringify(source, null, 2)};
`;

  await fs.writeFile(outputPath, contents, 'utf-8');
  console.log(`Generated ${outputPath}`);
  console.log(JSON.stringify(sourceCounts(source), null, 2));
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

function sourceCounts(source: Awaited<ReturnType<typeof parseMigrationSource>>) {
  return {
    exactRedirects: source.exactRedirects.length,
    prefixRedirects: source.prefixRedirects.length,
    externalRedirects: source.externalRedirects.length,
    goneUrls: source.goneUrls.length,
    noindexPaths: source.noindexPaths.length,
  };
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
