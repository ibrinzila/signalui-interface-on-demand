import type { InterfaceContext, Intent } from './types.js';

export interface IntentInterpretation {
  readonly context: InterfaceContext;
  readonly confidence: number;
  readonly matchedSignals: readonly string[];
  readonly notInferred: readonly string[];
}

function includesAny(text: string, phrases: readonly string[]): boolean {
  return phrases.some((phrase) => text.includes(phrase));
}

function detectIntent(text: string, fallback: Intent): { intent: Intent; confidence: number; signals: string[] } {
  if (includesAny(text, ['audit', 'receipt', 'provenance', 'timeline', 'who approved'])) {
    return { intent: 'audit-recent-decisions', confidence: 0.94, signals: ['audit-language'] };
  }
  if (includesAny(text, ['anomal', 'need my decision', 'needs my decision', 'resolve', 'clear the queue', 'actionable'])) {
    return { intent: 'resolve-actionable-anomalies', confidence: 0.91, signals: ['decision-language'] };
  }
  if (includesAny(text, ['overview', 'dashboard', 'everything', 'full workspace'])) {
    return { intent: 'overview', confidence: 0.9, signals: ['overview-language'] };
  }
  return { intent: fallback, confidence: 0.55, signals: ['current-context-fallback'] };
}

export function interpretIntent(statement: string, current: InterfaceContext): IntentInterpretation {
  const normalized = statement.trim().toLocaleLowerCase('en');
  const detected = detectIntent(normalized, current.intent);
  const mobile = includesAny(normalized, ['phone', 'mobile', 'small screen', 'on the go']);
  const desktop = includesAny(normalized, ['desktop', 'large screen', 'computer']);
  const urgent = includesAny(normalized, ['leaving shortly', 'quickly', 'only', 'just the', 'few minutes']);

  const signals = [...detected.signals];
  if (mobile) signals.push('explicit-mobile-context');
  if (desktop) signals.push('explicit-desktop-context');
  if (urgent) signals.push('explicit-attention-constraint');

  const context: InterfaceContext = {
    ...current,
    intent: detected.intent,
    device: mobile ? 'mobile' : desktop ? 'desktop' : current.device,
    decisionBudget: detected.intent === 'resolve-actionable-anomalies'
      ? Math.min(current.decisionBudget, urgent || mobile ? 3 : 5)
      : current.decisionBudget,
    explicitUserStatement: statement.trim() || current.explicitUserStatement,
  };

  return {
    context,
    confidence: Math.min(0.99, detected.confidence + (mobile || desktop ? 0.03 : 0) + (urgent ? 0.03 : 0)),
    matchedSignals: signals,
    notInferred: ['disability', 'emotion', 'cognitive capacity'],
  };
}
