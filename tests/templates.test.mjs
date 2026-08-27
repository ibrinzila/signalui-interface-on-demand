import test from 'node:test';
import assert from 'node:assert/strict';

const templates = await import('../.build/src/ui/templates.js');
const compiler = await import('../.build/src/core/compiler.js');
const fixtures = await import('../.build/src/core/fixtures.js');

function model(state, context = state.interfaceContext) {
  return {
    state,
    plan: compiler.compileSurface(context, state),
    tools: [
      { name: 'inspect_anomaly', title: 'Inspect anomaly', annotations: { readOnlyHint: true, untrustedContentHint: true } },
      { name: 'propose_correction', title: 'Propose correction', annotations: { readOnlyHint: false, untrustedContentHint: true } },
    ],
    webMcpMode: 'fallback',
    selectedAnomalyId: 'A-104',
    lastResult: null,
    intentConfidence: null,
  };
}

test('full workspace includes semantic landmarks, explanation, and reversal controls', () => {
  const state = fixtures.createInitialState();
  const html = templates.renderWorkspace(model(state));
  assert.match(html, /data-signalui-recipe="full-workspace"/);
  assert.match(html, /<main[^>]+id="workspace"/);
  assert.match(html, /aria-labelledby="portfolio-summary-title"/);
  assert.match(html, /Why am I seeing this\?/);
  assert.match(html, /data-action="show-full-workspace"/);
  assert.match(html, /7 readings/);
  assert.match(html, /3 need human judgement/);
  assert.doesNotMatch(html, /\sstyle=/, 'SignalUI surfaces must not require inline style permissions.');
});

test('focused surface renders exactly three decisions and preserves material counterevidence', () => {
  const state = fixtures.createInitialState();
  const context = {
    ...state.interfaceContext,
    role: 'operator',
    device: 'mobile',
    intent: 'resolve-actionable-anomalies',
    decisionBudget: 3,
    explicitUserStatement: 'Show only what needs my decision.',
  };
  const html = templates.renderWorkspace(model(state, context));
  assert.match(html, /data-signalui-recipe="focused-decisions"/);
  assert.equal((html.match(/data-decision-card=/g) ?? []).length, 3);
  assert.match(html, /School No\. 14/);
  assert.match(html, /Community Library No\. 2/);
  assert.match(html, /Youth Centre North/);
  assert.match(html, /Counterevidence/);
  assert.match(html, /Meter replacement record/);
  assert.match(html, /All material evidence and counterevidence/);
  assert.doesNotMatch(html, /Institution settings/);
  assert.doesNotMatch(html, /\sstyle=/, 'Focused surfaces must not require inline style permissions.');
});

test('approval dialog presents the exact state-bound consequence and never hides fingerprint data', () => {
  const state = fixtures.createInitialState();
  const anomaly = {
    ...state.anomalies[0],
    status: 'awaiting-approval',
    version: 5,
    proposal: {
      proposedValue: 4829,
      reason: 'The meter image confirms that one extra digit was entered during transcription.',
      proposedBy: 'operator-1',
      proposedAt: '2026-08-27T01:00:00.000Z',
      baseVersion: 3,
    },
    approval: {
      id: 'APR-104', anomalyId: 'A-104', expectedVersion: 5, proposedValue: 4829,
      reason: 'The meter image confirms that one extra digit was entered during transcription.',
      evidenceDigest: 'e'.repeat(64), stateHash: 'state-104', fingerprint: 'f'.repeat(64),
      requestedBy: 'operator-1', requestedAt: '2026-08-27T01:01:00.000Z', status: 'pending',
    },
  };
  const html = templates.renderApprovalDialog(anomaly);
  assert.match(html, /Exact approval preview/);
  assert.match(html, /48,291 kWh/);
  assert.match(html, /4,829 kWh/);
  assert.match(html, /Version 5/);
  assert.match(html, new RegExp('f'.repeat(64)));
  assert.match(html, /Replace the recorded reading/);
  assert.match(html, /data-action="confirm-approval"/);
});

test('audit surface renders receipt provenance and read-only authority', () => {
  const base = fixtures.createInitialState();
  const receipt = {
    id: 'RCT-1', timestamp: '2026-08-27T01:00:00.000Z', commandId: 'CMD-1', capabilityId: 'approve_correction',
    actorId: 'manager-1', actorRole: 'manager', source: 'human', outcome: 'applied', anomalyId: 'A-104',
    summary: 'Correction approved.', inputDigest: 'a'.repeat(64), priorStateHash: 'before-hash', currentStateHash: 'after-hash',
    previousReceiptHash: 'GENESIS', receiptHash: 'b'.repeat(64),
  };
  const state = {
    ...base,
    receipts: [receipt],
    interfaceContext: { ...base.interfaceContext, role: 'auditor', intent: 'audit-recent-decisions' },
  };
  const html = templates.renderWorkspace(model(state));
  assert.match(html, /data-signalui-recipe="audit-trail"/);
  assert.match(html, /Read-only audit surface/);
  assert.match(html, /approve_correction/);
  assert.match(html, /before-hash/);
  assert.match(html, /after-hash/);
  assert.match(html, /manager-1/);
});

test('untrusted evidence and user-provided text are escaped before rendering', () => {
  assert.equal(templates.escapeHtml('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
  const state = fixtures.createInitialState();
  const malicious = {
    ...state,
    anomalies: state.anomalies.map((item, index) => index === 0
      ? { ...item, summary: '<script>window.pwned=true</script>' }
      : item),
  };
  const html = templates.renderWorkspace(model(malicious));
  assert.doesNotMatch(html, /<script>window\.pwned/);
  assert.match(html, /&lt;script&gt;window\.pwned=true&lt;\/script&gt;/);
});
