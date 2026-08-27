import type { Anomaly, EvidenceItem, WorkspaceState } from './types.js';

const GENERATED_AT = '2026-08-27T00:00:00.000Z';

function evidence(
  id: string,
  kind: EvidenceItem['kind'],
  label: string,
  summary: string,
  source: string,
  capturedAt: string,
  materiality: EvidenceItem['materiality'],
  untrusted: boolean,
  assetPath?: string,
): EvidenceItem {
  const base = { id, kind, label, summary, source, capturedAt, materiality, untrusted } as const;
  return assetPath ? { ...base, assetPath } : base;
}

function anomalies(): Anomaly[] {
  return [
    {
      id: 'A-104', institutionId: 'I-014', institutionName: 'School No. 14', meterLabel: 'Main electricity meter',
      reportedValue: 48291, expectedMin: 4700, expectedMax: 5300, unit: 'kWh', reportedAt: '2026-08-26T08:14:00.000Z',
      version: 3, severity: 'critical', status: 'open',
      summary: 'Reported consumption is approximately ten times the established range.',
      recommendation: 'The meter image supports 4,829 kWh; prepare a correction and require manager approval.',
      confidence: 'high', requiresHumanDecision: true,
      evidence: [
        evidence('E-104-photo', 'photo', 'Meter photograph', 'Display appears to read 004829; surrounding metadata matches the reporting period.', 'Field operator upload', '2026-08-26T08:12:00.000Z', 'material', true, '/assets/meter-104.svg'),
        evidence('E-104-note', 'operator-note', 'Operator note', 'The operator reports that an extra digit may have been entered during transcription.', 'Field operator note', '2026-08-26T08:15:00.000Z', 'supporting', true),
      ],
      history: [
        { period: '2026-03', value: 4860 }, { period: '2026-04', value: 5012 }, { period: '2026-05', value: 4938 },
        { period: '2026-06', value: 5101 }, { period: '2026-07', value: 4977 }, { period: '2026-08', value: 48291 },
      ],
    },
    {
      id: 'A-305', institutionId: 'I-033', institutionName: 'Community Library No. 2', meterLabel: 'Main electricity meter',
      reportedValue: 0, expectedMin: 1180, expectedMax: 1760, unit: 'kWh', reportedAt: '2026-08-26T09:41:00.000Z',
      version: 1, severity: 'high', status: 'open',
      summary: 'A zero reading was submitted without a usable meter photograph.',
      recommendation: 'Request a clear meter image and confirmation of any outage or meter replacement.',
      confidence: 'high', requiresHumanDecision: true,
      evidence: [
        evidence('E-305-photo', 'photo', 'Unreadable meter photograph', 'The display is obscured by glare; no value can be verified.', 'Field operator upload', '2026-08-26T09:39:00.000Z', 'material', true, '/assets/meter-305.svg'),
        evidence('E-305-note', 'operator-note', 'Submission note', 'No outage or closure was declared with the reading.', 'Submission form', '2026-08-26T09:41:00.000Z', 'counterevidence', true),
      ],
      history: [
        { period: '2026-03', value: 1390 }, { period: '2026-04', value: 1435 }, { period: '2026-05', value: 1518 },
        { period: '2026-06', value: 1468 }, { period: '2026-07', value: 1554 }, { period: '2026-08', value: 0 },
      ],
    },
    {
      id: 'A-411', institutionId: 'I-041', institutionName: 'Youth Centre North', meterLabel: 'Main electricity meter',
      reportedValue: 15400, expectedMin: 5200, expectedMax: 6100, unit: 'kWh', reportedAt: '2026-08-26T10:05:00.000Z',
      version: 2, severity: 'high', status: 'open',
      summary: 'Consumption is nearly three times the expected range after a documented meter replacement.',
      recommendation: 'Hold the case for manual reconciliation because the photo and maintenance record use different meter serial numbers.',
      confidence: 'medium', requiresHumanDecision: true,
      evidence: [
        evidence('E-411-photo', 'photo', 'Current meter photograph', 'The photographed meter shows 015400 and serial EL-8824.', 'Field operator upload', '2026-08-26T10:02:00.000Z', 'material', true, '/assets/meter-411.svg'),
        evidence('E-411-maintenance', 'maintenance-record', 'Meter replacement record', 'Maintenance record lists replacement serial EL-8284, not EL-8824.', 'Facilities register', '2026-08-18T12:00:00.000Z', 'counterevidence', true),
      ],
      history: [
        { period: '2026-03', value: 5490 }, { period: '2026-04', value: 5710 }, { period: '2026-05', value: 5634 },
        { period: '2026-06', value: 5808 }, { period: '2026-07', value: 5901 }, { period: '2026-08', value: 15400 },
      ],
    },
    {
      id: 'A-207', institutionId: 'I-021', institutionName: 'Municipal Archive', meterLabel: 'Main electricity meter',
      reportedValue: 8118, expectedMin: 7900, expectedMax: 8500, unit: 'kWh', reportedAt: '2026-08-26T07:55:00.000Z',
      version: 2, severity: 'medium', status: 'held',
      summary: 'Automated screening flagged a formatting change, but the value remains within range.',
      recommendation: 'No human decision is required; retain the case as an explainable screening result.',
      confidence: 'high', requiresHumanDecision: false,
      evidence: [evidence('E-207-history', 'history', 'Historical range', 'The submitted value falls within the six-month expected range.', 'Consumption history', '2026-08-26T07:56:00.000Z', 'supporting', false)],
      history: [{ period: '2026-06', value: 8060 }, { period: '2026-07', value: 8184 }, { period: '2026-08', value: 8118 }],
    },
    {
      id: 'A-512', institutionId: 'I-052', institutionName: 'Sports Hall East', meterLabel: 'Main electricity meter',
      reportedValue: 9320, expectedMin: 6200, expectedMax: 7600, unit: 'kWh', reportedAt: '2026-08-25T15:21:00.000Z',
      version: 4, severity: 'medium', status: 'evidence-requested',
      summary: 'Additional evidence has already been requested after a temporary event load was reported.',
      recommendation: 'Wait for the event schedule and sub-meter export before further review.',
      confidence: 'medium', requiresHumanDecision: false,
      evidence: [evidence('E-512-note', 'operator-note', 'Event load note', 'The facility hosted a three-day competition during the period.', 'Facility manager note', '2026-08-25T15:25:00.000Z', 'material', true)],
      history: [{ period: '2026-06', value: 6710 }, { period: '2026-07', value: 7018 }, { period: '2026-08', value: 9320 }],
      evidenceRequest: 'Attach the event schedule and sub-meter export.',
    },
    {
      id: 'A-602', institutionId: 'I-061', institutionName: 'Kindergarten No. 6', meterLabel: 'Main electricity meter',
      reportedValue: 2774, expectedMin: 2600, expectedMax: 3100, unit: 'kWh', reportedAt: '2026-08-25T12:07:00.000Z',
      version: 5, severity: 'medium', status: 'corrected',
      summary: 'A prior transcription issue was corrected and approved.',
      recommendation: 'No action required.', confidence: 'high', requiresHumanDecision: false,
      evidence: [evidence('E-602-history', 'history', 'Correction evidence', 'Corrected value aligns with the image and expected range.', 'Correction receipt', '2026-08-25T13:00:00.000Z', 'supporting', false)],
      history: [{ period: '2026-07', value: 2810 }, { period: '2026-08', value: 2774 }], correctedValue: 2774,
    },
    {
      id: 'A-710', institutionId: 'I-070', institutionName: 'Civic Service Centre', meterLabel: 'Main electricity meter',
      reportedValue: 6450, expectedMin: 6000, expectedMax: 6800, unit: 'kWh', reportedAt: '2026-08-25T11:11:00.000Z',
      version: 3, severity: 'medium', status: 'corrected',
      summary: 'Duplicate submission was reconciled without changing the verified reading.',
      recommendation: 'No action required.', confidence: 'high', requiresHumanDecision: false,
      evidence: [evidence('E-710-history', 'history', 'Duplicate reconciliation', 'Both submissions refer to the same image and value.', 'Reconciliation log', '2026-08-25T11:30:00.000Z', 'supporting', false)],
      history: [{ period: '2026-07', value: 6310 }, { period: '2026-08', value: 6450 }], correctedValue: 6450,
    },
  ];
}

export function createInitialState(): WorkspaceState {
  return {
    version: 1,
    generatedAt: GENERATED_AT,
    interfaceContext: {
      role: 'manager', device: 'desktop', intent: 'overview', decisionBudget: 5,
      accessibility: { largeTargets: false, reducedMotion: false, highContrast: false, verboseLabels: false },
      explicitUserStatement: 'Show the full operations workspace.',
    },
    anomalies: anomalies(),
    receipts: [],
    lastSurfaceId: 'full-workspace',
  };
}
