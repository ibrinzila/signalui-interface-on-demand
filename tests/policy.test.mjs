import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const policy = await import('../.build/src/core/policy.js');
const fixtures = await import('../.build/src/core/fixtures.js');
const schema = await import('../.build/src/core/schema.js');

const document = schema.asCapabilityContractDocument(JSON.parse(await readFile(new URL('../contracts/capabilities.json', import.meta.url), 'utf8')));
const state = fixtures.createInitialState();

function capability(id) {
  return document.capabilities.find((item) => item.id === id);
}

test('operator cannot approve while manager role is admitted only when approval is pending', () => {
  const approve = capability('approve_correction');
  assert.equal(policy.admitCapability(approve, { ...state.interfaceContext, role: 'operator' }, state).code, 'role-denied');
  assert.equal(policy.admitCapability(approve, { ...state.interfaceContext, role: 'manager' }, state).code, 'state-unavailable');

  const pending = structuredClone(state);
  pending.anomalies[0].status = 'awaiting-approval';
  pending.anomalies[0].approval = {
    id: 'APR-1', anomalyId: 'A-104', expectedVersion: 3, proposedValue: 4829, reason: 'Evidence-backed correction',
    evidenceDigest: 'evidence', stateHash: 'state', fingerprint: 'fingerprint', requestedBy: 'operator-1',
    requestedAt: '2026-08-27T00:00:00.000Z', status: 'pending'
  };
  assert.equal(policy.admitCapability(approve, { ...state.interfaceContext, role: 'manager' }, pending).allowed, true);
});

test('auditor receives only interface and read capabilities', () => {
  const ids = policy.availableCapabilityIds(document, { ...state.interfaceContext, role: 'auditor' }, state);
  assert.deepEqual(ids, [
    'set_interface_context',
    'list_actionable_anomalies',
    'inspect_anomaly',
    'compare_reading_history'
  ]);
});

test('state-aware availability exposes proposal and evidence actions but not approval', () => {
  const ids = policy.availableCapabilityIds(document, { ...state.interfaceContext, role: 'operator' }, state);
  assert.ok(ids.includes('propose_correction'));
  assert.ok(ids.includes('request_more_evidence'));
  assert.ok(!ids.includes('request_human_approval'));
  assert.ok(!ids.includes('approve_correction'));
});
