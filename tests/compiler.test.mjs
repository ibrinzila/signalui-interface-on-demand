import test from 'node:test';
import assert from 'node:assert/strict';

const compiler = await import('../.build/src/core/compiler.js');
const intent = await import('../.build/src/core/intent.js');
const fixtures = await import('../.build/src/core/fixtures.js');

const state = fixtures.createInitialState();

test('natural-language intent maps explicit phone context without inferring personal traits', () => {
  const result = intent.interpretIntent('I am on my phone and leaving shortly. Show only anomalies that genuinely need my decision.', state.interfaceContext);
  assert.equal(result.context.intent, 'resolve-actionable-anomalies');
  assert.equal(result.context.device, 'mobile');
  assert.equal(result.context.decisionBudget, 3);
  assert.deepEqual(result.notInferred, ['disability', 'emotion', 'cognitive capacity']);
  assert.ok(result.confidence >= 0.8);
});

test('focused compiler produces exactly three decision cards and preserves counterevidence', () => {
  const context = {
    ...state.interfaceContext,
    role: 'operator',
    device: 'mobile',
    intent: 'resolve-actionable-anomalies',
    decisionBudget: 3,
    explicitUserStatement: 'Show only the anomalies that need my decision.'
  };
  const plan = compiler.compileSurface(context, state);
  assert.equal(plan.recipe, 'focused-decisions');
  assert.equal(plan.primaryAnomalyIds.length, 3);
  assert.deepEqual(plan.primaryAnomalyIds, ['A-104', 'A-305', 'A-411']);
  const selected = state.anomalies.filter((item) => plan.primaryAnomalyIds.includes(item.id));
  assert.ok(selected.flatMap((item) => item.evidence).some((item) => item.materiality === 'counterevidence'));
  assert.ok(plan.regions.some((region) => region.id === 'material-evidence'));
  assert.ok(plan.explanation.preserved.some((item) => /counterevidence/i.test(item)));
  assert.ok(plan.hiddenRegions.includes('institution-settings'));
});

test('auditor context compiles a read-only audit trail while overview compiles the full workspace', () => {
  const audit = compiler.compileSurface({
    ...state.interfaceContext,
    role: 'auditor',
    intent: 'audit-recent-decisions',
    explicitUserStatement: 'Audit recent decisions.'
  }, state);
  const full = compiler.compileSurface(state.interfaceContext, state);
  assert.equal(audit.recipe, 'audit-trail');
  assert.ok(audit.regions.some((region) => region.id === 'receipt-timeline'));
  assert.equal(full.recipe, 'full-workspace');
  assert.equal(full.primaryAnomalyIds.length, 7);
});

test('surface plan changes presentation without mutating authority or workspace state', () => {
  const before = structuredClone(state);
  const plan = compiler.compileSurface({ ...state.interfaceContext, role: 'operator', intent: 'resolve-actionable-anomalies' }, state);
  assert.equal(plan.recipe, 'focused-decisions');
  assert.deepEqual(state, before);
  assert.equal(state.interfaceContext.role, 'manager');
});
