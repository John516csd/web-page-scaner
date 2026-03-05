export type GeoCountry = 'JP' | 'US' | 'SG' | 'HK' | 'TW' | 'DE' | 'FR' | 'GB' | 'KR' | 'IN' | 'BR' | 'AU' | 'CA';

export interface RedirectTestCase {
  id: string;
  name: string;
  description: string;
  category: 'viewer-request' | 'origin-request' | 'extra';
  url: string;
  method?: 'GET' | 'HEAD';
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
  expectedStatus: number;
  expectedRedirectUrl?: string;
  country?: GeoCountry;
  notes?: string;
}

export interface RedirectTestResult {
  testCase: RedirectTestCase;
  actualStatus: number;
  actualRedirectUrl?: string;
  responseHeaders?: Record<string, string>;
  passed: boolean;
  failureReason?: string;
  durationMs: number;
  usedNode?: string;
}

export interface RunTestsRequest {
  testCases: RedirectTestCase[];
  proxy?: string;
}

export interface RunTestsResponse {
  taskId: string;
}

export interface TestBatchResult {
  results: RedirectTestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    duration: number;
  };
}
