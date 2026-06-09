import type {
  AcceptanceDefect,
  AcceptanceEvidence,
  AcceptanceItem,
  AcceptanceSection,
  AcceptanceSignoff,
  GoNoGoStatus,
} from './types.js';

export function computeGoNoGo(input: {
  sections: AcceptanceSection[];
  items: AcceptanceItem[];
  evidence: AcceptanceEvidence[];
  signoffs: AcceptanceSignoff[];
  defects: AcceptanceDefect[];
}): GoNoGoStatus {
  const automationBlockers = input.items
    .filter((item) => item.status === 'fail' || item.status === 'blocked')
    .filter((item) => item.severity === 'P0' || item.severity === 'P1')
    .map((item) => ({
      type: 'automation' as const,
      severity: item.severity,
      title: item.name,
      detail: item.failureReason || item.actual,
      url: item.url,
    }));

  const blockers = automationBlockers;

  return {
    decision: blockers.length > 0 ? 'no-go' : 'go',
    blockers,
    missingEvidence: [],
    openP0P1Defects: [],
  };
}
