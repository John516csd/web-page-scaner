import type { AcceptanceItem, AcceptanceSection, AcceptanceStatus, AcceptanceCheck } from './types.js';

export function makeSection(
  id: AcceptanceCheck,
  name: string,
  items: AcceptanceItem[]
): AcceptanceSection {
  const failed = items.filter((item) => item.status === 'fail').length;
  const warned = items.filter((item) => item.status === 'warn').length;
  const passed = items.filter((item) => item.status === 'pass').length;
  const status: AcceptanceStatus = failed > 0 ? 'fail' : warned > 0 ? 'warn' : 'pass';

  return {
    id,
    name,
    status,
    total: items.length,
    passed,
    failed,
    warned,
    items,
  };
}

export function makeItem(input: {
  id: string;
  name: string;
  url: string;
  status: AcceptanceStatus;
  expected: string;
  actual: string;
  durationMs: number;
  failureReason?: string;
  responseHeaders?: Record<string, string>;
}): AcceptanceItem {
  return input;
}
