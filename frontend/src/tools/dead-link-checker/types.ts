export interface DeadLinkRequest {
  url: string;
  options?: {
    concurrency?: number;
    timeoutMs?: number;
    checkExternal?: boolean;
  };
}

export type LinkStatus = 'alive' | 'dead' | 'blocked' | 'skipped' | 'error';

export interface LinkCheckResult {
  url: string;
  text: string;
  rawHref: string;
  status: LinkStatus;
  statusCode: number | null;
  redirectedTo?: string;
  errorMessage?: string;
  isExternal: boolean;
  durationMs: number;
}

export interface DeadLinkResult {
  pageUrl: string;
  timestamp: string;
  summary: {
    total: number;
    alive: number;
    dead: number;
    blocked: number;
    skipped: number;
    error: number;
  };
  links: LinkCheckResult[];
}

export interface DeadLinkOptions {
  concurrency?: number;
  timeoutMs?: number;
  checkExternal?: boolean;
  pageConcurrency?: number;
}

export interface SiteDeadLinkRequest {
  baseUrl: string;
  paths: string[];
  batchSize: number;
  startIndex: number;
  options?: DeadLinkOptions;
}

export interface PageDeadLinkResult {
  path: string;
  status: 'pass' | 'warn' | 'fail' | 'error';
  deadCount: number;
  totalLinks: number;
  duration: number;
  result?: DeadLinkResult;
  error?: string;
}
