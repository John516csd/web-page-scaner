export type CheckType = "http" | "seo" | "content" | "visual";

export interface DiffRequest {
  urlA: string;
  urlB: string;
  checks: CheckType[];
  options?: DiffOptions;
}

export interface DiffOptions {
  viewports?: ("desktop" | "mobile")[];
  disableAnimations?: boolean;
  hideSelectors?: string[];
  waitTime?: number;
  failThreshold?: number;
}

export interface CheckItem {
  name: string;
  valueA: string | number | null;
  valueB: string | number | null;
  match: boolean;
}

export interface CheckResult {
  items: CheckItem[];
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
  http?: CheckResult;
  seo?: CheckResult;
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

export interface PageResult {
  path: string;
  status: "pass" | "warn" | "fail" | "error";
  duration: number;
  result?: DiffResult;
  error?: string;
}
