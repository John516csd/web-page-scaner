export type AcceptanceEnv = "test" | "production";
export type AcceptanceStage = "T0" | "T1" | "T2" | "T3" | "T4" | "T5";
export type AcceptanceStatus = "pass" | "warn" | "fail" | "blocked" | "pending" | "manual";
export type DefectSeverity = "P0" | "P1" | "P2" | "P3";
export type DefectStatus = "open" | "fixed" | "retested" | "waived";
export type EvidenceStatus = "pending" | "pass" | "fail" | "waived";
export type SignoffStatus = "pending" | "pass" | "fail" | "waived";
export type GoNoGoDecision = "go" | "no-go";

export type AcceptanceSuite =
  | "build-readiness"
  | "smoke"
  | "routing"
  | "seo-geo"
  | "page-parity"
  | "cms-storyblok"
  | "i18n"
  | "functional-e2e"
  | "visual-responsive"
  | "performance"
  | "analytics"
  | "assets"
  | "deploy-monitoring"
  | "rollback"
  | "post-launch";

export interface AcceptanceSampleSize {
  exactRedirects?: number;
  goneUrls?: number;
  noindex?: number;
}

export interface AcceptanceSession {
  id: number;
  name: string;
  env: AcceptanceEnv;
  baseUrl: string;
  gatsbyUrl: string;
  productionUrl: string;
  sitemapUrl?: string;
  sourceRepoPath?: string;
  trackerSessionId?: number;
  cloudfrontDistribution?: string;
  commitSha?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAcceptanceSessionInput {
  name: string;
  env: AcceptanceEnv;
  baseUrl: string;
  gatsbyUrl?: string;
  productionUrl?: string;
  sitemapUrl?: string;
  sourceRepoPath?: string;
  trackerSessionId?: number;
  cloudfrontDistribution?: string;
  commitSha?: string;
}

export interface AcceptanceRun {
  id: number;
  sessionId?: number;
  env: AcceptanceEnv;
  baseUrl: string;
  gatsbyUrl: string;
  productionUrl: string;
  stages: AcceptanceStage[];
  suites: AcceptanceSuite[];
  status: AcceptanceStatus;
  summary: AcceptanceSummary;
  startedAt: string;
  finishedAt?: string;
}

export interface AcceptanceSummary {
  total: number;
  passed: number;
  failed: number;
  warned: number;
  blocked?: number;
  duration: number;
}

export interface AcceptanceItem {
  id: number | string;
  sectionId?: number;
  stage?: AcceptanceStage;
  suite?: AcceptanceSuite;
  name: string;
  url?: string;
  status: AcceptanceStatus;
  severity?: DefectSeverity;
  expected: string;
  actual: string;
  durationMs: number;
  failureReason?: string;
  responseHeaders?: Record<string, string>;
  evidenceUrl?: string;
  evidenceText?: string;
}

export interface AcceptanceSection {
  id: number | string;
  runId?: number;
  stage?: AcceptanceStage;
  suite?: AcceptanceSuite;
  name: string;
  status: AcceptanceStatus;
  total: number;
  passed: number;
  failed: number;
  warned: number;
  blocked?: number;
  durationMs?: number;
  items: AcceptanceItem[];
}

export interface AcceptanceEvidence {
  id: number;
  sessionId: number;
  moduleId: string;
  name: string;
  owner?: string;
  required: boolean;
  status: EvidenceStatus;
  evidenceUrl?: string;
  evidenceText?: string;
  notes?: string;
  waiverReason?: string;
  updatedAt?: string;
}

export interface AcceptanceSignoff {
  id: number;
  sessionId: number;
  moduleId: string;
  status: SignoffStatus;
  owner?: string;
  signer?: string;
  notes?: string;
  waiverReason?: string;
  signedAt?: string;
}

export interface AcceptanceDefect {
  id: number;
  sessionId: number;
  title: string;
  severity: DefectSeverity;
  status: DefectStatus;
  owner?: string;
  issueUrl?: string;
  itemId?: number;
  notes?: string;
  retestResult?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GoNoGoBlocker {
  type: "automation" | "defect" | "evidence" | "signoff";
  severity?: DefectSeverity;
  title: string;
  detail?: string;
  url?: string;
}

export interface GoNoGoStatus {
  decision: GoNoGoDecision;
  blockers: GoNoGoBlocker[];
  missingEvidence: AcceptanceEvidence[];
  openP0P1Defects: AcceptanceDefect[];
}

export interface AcceptanceSessionDetail {
  session: AcceptanceSession;
  runs: AcceptanceRun[];
  sections: AcceptanceSection[];
  items: AcceptanceItem[];
  evidence: AcceptanceEvidence[];
  signoffs: AcceptanceSignoff[];
  defects: AcceptanceDefect[];
  goNoGo: GoNoGoStatus;
}

export interface AcceptanceRunRequest {
  sessionId?: number;
  env?: AcceptanceEnv;
  baseUrl?: string;
  gatsbyUrl?: string;
  productionUrl?: string;
  sourceRepoPath?: string;
  stages?: AcceptanceStage[];
  suites?: AcceptanceSuite[];
  sampleSize?: AcceptanceSampleSize;
  notifySlack?: boolean;
  requireSignoff?: boolean;
  minSitemapUrls?: number;
}

export interface WorkbenchRunResult {
  run: AcceptanceRun;
  sections: AcceptanceSection[];
  items: AcceptanceItem[];
  summary: AcceptanceSummary;
  goNoGo: GoNoGoStatus;
}

export interface AcceptanceRequest {
  env: AcceptanceEnv;
  baseUrl: string;
  gatsbyUrl?: string;
  productionUrl?: string;
  sampleSize?: AcceptanceSampleSize;
  notifySlack?: boolean;
}

export interface AcceptanceResult {
  env: AcceptanceEnv;
  baseUrl: string;
  productionUrl: string;
  timestamp: string;
  summary: AcceptanceSummary;
  sections: AcceptanceSection[];
  goNoGo?: GoNoGoStatus;
  run?: AcceptanceRun;
}
