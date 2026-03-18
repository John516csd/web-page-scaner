export interface E2ETestCase {
  id: string;
  name: string;
  url: string;
  script: string;
  timeout: number;
  tags?: string[];
}

export interface E2ETestResult {
  testCase: E2ETestCase;
  passed: boolean;
  durationMs: number;
  error?: string;
  screenshot?: string;
  screenshots?: Array<{
    step: string;
    stepNumber?: number;
    timestamp: number;
    duration?: number;
    image: string;
    url?: string;
    selector?: string;
    status?: 'success' | 'warning' | 'error';
    metadata?: {
      elementText?: string;
      networkRequest?: string;
      consoleMessage?: string;
    };
  }>;
  consoleLogs?: string[];
}

export interface E2ETestCollection {
  id: string;
  name: string;
  description?: string;
  testCases: E2ETestCase[];
  createdAt: string;
  updatedAt: string;
}

export interface E2EBatchResult {
  results: E2ETestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    duration: number;
  };
}
