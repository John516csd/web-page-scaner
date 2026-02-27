export type CheckType = 'http' | 'seo' | 'content' | 'visual';

export interface DiffRequest {
  urlA: string;
  urlB: string;
  checks: CheckType[];
  options?: DiffOptions;
}

export interface DiffOptions {
  viewports?: ('desktop' | 'mobile')[];
  disableAnimations?: boolean;
  hideSelectors?: string[];
  waitTime?: number;
  failThreshold?: number;
}

export interface HttpCheckItem {
  name: string;
  valueA: string | number;
  valueB: string | number;
  match: boolean;
}

export interface HttpCheckResult {
  items: HttpCheckItem[];
}

export interface SeoCheckItem {
  name: string;
  valueA: string | null;
  valueB: string | null;
  match: boolean;
}

export interface SeoCheckResult {
  items: SeoCheckItem[];
}

export interface VisualViewportResult {
  viewport: string;
  screenshotA: string;
  screenshotB: string;
  diffImage: string;
  diffPercentage: number;
  width: number;
  height: number;
}

export interface VisualCheckResult {
  viewports: VisualViewportResult[];
}

export interface ContentTagCount {
  tag: string;
  countA: number;
  countB: number;
}

export interface ContentHeading {
  level: number;
  text: string;
}

export interface ContentLink {
  href: string;
  text: string;
}

export interface ContentImage {
  src: string;
  alt: string;
}

export interface ContentCheckResult {
  dom: {
    totalA: number;
    totalB: number;
    tagCounts: ContentTagCount[];
  };
  headings: {
    listA: ContentHeading[];
    listB: ContentHeading[];
  };
  links: {
    countA: number;
    countB: number;
    added: ContentLink[];
    removed: ContentLink[];
    common: number;
  };
  images: {
    countA: number;
    countB: number;
    added: ContentImage[];
    removed: ContentImage[];
    common: number;
  };
  text: {
    similarity: number;
    added: string[];
    removed: string[];
  };
}

export interface DiffResult {
  urlA: string;
  urlB: string;
  timestamp: string;
  http?: HttpCheckResult;
  seo?: SeoCheckResult;
  content?: ContentCheckResult;
  visual?: VisualCheckResult;
}

export interface SiteDiffRequest {
  baseUrlA: string;
  baseUrlB: string;
  paths: string[];
  checks: CheckType[];
  batchSize: number;
  startIndex: number;
  options?: DiffOptions;
}

export interface SitemapRequest {
  sitemapUrl: string;
}

export interface SitemapResponse {
  paths: string[];
  total: number;
}

export interface PageResult {
  path: string;
  status: 'pass' | 'warn' | 'fail' | 'error';
  duration: number;
  result?: DiffResult;
  error?: string;
}
