export type GeoCountry = 'JP' | 'US' | 'SG' | 'HK' | 'TW' | 'DE' | 'FR' | 'GB' | 'KR' | 'IN' | 'BR' | 'AU' | 'CA';

export interface UrlTestCase {
  id: string;
  name: string;
  description: string;
  url: string;
  method?: 'GET' | 'HEAD';
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
  expectedStatus: number;
  expectedRedirectUrl?: string;
  country?: GeoCountry;
  notes?: string;
}

export interface UrlTestResult {
  testCase: UrlTestCase;
  actualStatus: number;
  actualRedirectUrl?: string;
  responseHeaders?: Record<string, string>;
  passed: boolean;
  failureReason?: string;
  durationMs: number;
  usedNode?: string;
  vpnWarning?: string;
  vpnFailure?: boolean;
  triedNodes?: string[];
}

export interface RunTestsRequest {
  testCases: UrlTestCase[];
  proxy?: string;
  notifySlack?: boolean;
  collectionName?: string;
}

export interface RunTestsResponse {
  taskId: string;
}

export interface TestBatchResult {
  results: UrlTestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    duration: number;
  };
}
