import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const commands = await import('../.build/src/core/command-bus.js');
const fixtures = await import('../.build/src/core/fixtures.js');
const schema = await import('../.build/src/core/schema.js');
const stores = await import('../.build/src/core/store.js');
const receipts = await import('../.build/src/core/receipts.js');

const contractDocument = schema.asCapabilityContractDocument(
  JSON.parse(await readFile(new URL('../contracts/capabilities.json', import.meta.url), 'utf8')),
);

function harness() {
  const store = new stores.WorkspaceStore(fixtures.createInitialState());
  let tick = 0;
  const bus = new commands.CommandBus({
    store,
    contracts: contractDocument,
    clock: () => new Date(Date.UTC(2026, 7, 27, 1, 0, tick++)).toISOString(),
    idFactory: (prefix) => `${prefix}-${String(tick).padStart(3, '0')}`,
  });
  return { store, bus };
}

const operator = { id: 'operator-1', role: 'operator', source: 'human' };
const manager = { id: 'manager-1', role: 'manager', source: 'human' };
const auditor = { id: 'auditor-1', role: 'auditor', source: 'human' };

async function proposeAndRequest(bus) {
  const proposal = await bus.execute({
    id: 'CMD-PROPOSE-104',
    capabilityId: 'propose_correction',
    input: {
      anomalyId: 'A-104',
      correctedValue: 4829,
      reason: 'The meter image confirms that one extra digit was entered during transcription.',
      expectedVersion: 3,
    },
  }, operator);
  assert.equal(proposal.ok, true);

  const request = await bus.execute({
    id: 'CMD-REQUEST-104',
    capabilityId: 'request_human_approval',
    input: { anomalyId: 'A-104', expectedVersion: 4 },
  }, operator);
  assert.equal(request.ok, true);
  return request;
}

test('proposal and approval request preserve exact evidence-bound state', async () => {
  const { store, bus } = harness();
  const request = await proposeAndRequest(bus);
  const anomaly = store.getState().anomalies.find((item) => item.id === 'A-104');

  assert.equal(anomaly.status, 'awaiting-approval');
  assert.equal(anomaly.version, 5);
  assert.equal(anomaly.proposal.proposedValue, 4829);
  assert.equal(anomaly.approval.expectedVersion, 5);
  assert.match(anomaly.approval.fingerprint, /^[a-f0-9]{64}$/);
  assert.match(anomaly.approval.evidenceDigest, /^[a-f0-9]{64}$/);
  assert.equal(request.data.preview.institutionName, 'School No. 14');
  assert.equal(request.data.preview.reportedValue, 48291);
  assert.equal(request.data.preview.proposedValue, 4829);
  assert.equal(request.data.preview.expectedVersion, 5);
  assert.deepEqual(request.data.preview.evidenceIds, ['E-104-photo', 'E-104-note']);
});

test('operator approval is denied without changing the anomaly state', async () => {
  const { store, bus } = harness();
  const request = await proposeAndRequest(bus);
  const approval = request.data.approval;
  const before = store.getState().anomalies.find((item) => item.id === 'A-104');

  const result = await bus.execute({
    id: 'CMD-UNAUTHORISED-104',
    capabilityId: 'approve_correction',
    input: {
      anomalyId: 'A-104', approvalId: approval.id, expectedVersion: 5, fingerprint: approval.fingerprint,
    },
  }, operator);

  const after = store.getState().anomalies.find((item) => item.id === 'A-104');
  assert.equal(result.ok, false);
  assert.equal(result.code, 'role-denied');
  assert.deepEqual(after, before);
  assert.equal(result.receipt.priorStateHash, result.receipt.currentStateHash);
});

test('stale approval is denied and a fresh manager approval applies once', async () => {
  const { store, bus } = harness();
  const request = await proposeAndRequest(bus);
  const approval = request.data.approval;

  const stale = await bus.execute({
    id: 'CMD-STALE-104',
    capabilityId: 'approve_correction',
    input: {
      anomalyId: 'A-104', approvalId: approval.id, expectedVersion: 4, fingerprint: approval.fingerprint,
    },
  }, manager);
  assert.equal(stale.ok, false);
  assert.equal(stale.code, 'stale-version');
  assert.equal(store.getState().anomalies.find((item) => item.id === 'A-104').status, 'awaiting-approval');

  const applied = await bus.execute({
    id: 'CMD-APPROVE-104',
    capabilityId: 'approve_correction',
    input: {
      anomalyId: 'A-104', approvalId: approval.id, expectedVersion: 5, fingerprint: approval.fingerprint,
    },
  }, manager);
  const corrected = store.getState().anomalies.find((item) => item.id === 'A-104');
  assert.equal(applied.ok, true);
  assert.equal(applied.outcome, 'applied');
  assert.equal(corrected.status, 'corrected');
  assert.equal(corrected.reportedValue, 4829);
  assert.equal(corrected.correctedValue, 4829);
  assert.equal(corrected.version, 6);
  assert.equal(corrected.approval.status, 'used');

  const duplicate = await bus.execute({
    id: 'CMD-APPROVE-104',
    capabilityId: 'approve_correction',
    input: {
      anomalyId: 'A-104', approvalId: approval.id, expectedVersion: 5, fingerprint: approval.fingerprint,
    },
  }, manager);
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.code, 'duplicate-command');
  assert.equal(store.getState().anomalies.find((item) => item.id === 'A-104').version, 6);
});

test('requesting evidence is reversible, version-bound, and produces a receipt', async () => {
  const { store, bus } = harness();
  const result = await bus.execute({
    id: 'CMD-EVIDENCE-305',
    capabilityId: 'request_more_evidence',
    input: {
      anomalyId: 'A-305',
      request: 'Upload a glare-free meter photo and confirm whether the meter was replaced.',
      expectedVersion: 1,
    },
  }, operator);
  const anomaly = store.getState().anomalies.find((item) => item.id === 'A-305');
  assert.equal(result.ok, true);
  assert.equal(anomaly.status, 'evidence-requested');
  assert.equal(anomaly.version, 2);
  assert.equal(anomaly.evidenceRequest, 'Upload a glare-free meter photo and confirm whether the meter was replaced.');
  assert.notEqual(result.receipt.priorStateHash, result.receipt.currentStateHash);
});

test('auditor can read bounded evidence but cannot submit a proposal', async () => {
  const { store, bus } = harness();
  const inspection = await bus.execute({
    id: 'CMD-INSPECT-104', capabilityId: 'inspect_anomaly', input: { anomalyId: 'A-104' },
  }, auditor);
  assert.equal(inspection.ok, true);
  assert.equal(inspection.outcome, 'read');
  assert.equal(inspection.data.evidence.length, 2);
  assert.ok(inspection.data.evidence.every((item) => !Object.hasOwn(item, 'assetPath')));

  const denied = await bus.execute({
    id: 'CMD-AUDITOR-PROPOSE', capabilityId: 'propose_correction', input: {
      anomalyId: 'A-104', correctedValue: 4829,
      reason: 'The meter image confirms that one extra digit was entered during transcription.', expectedVersion: 3,
    },
  }, auditor);
  assert.equal(denied.ok, false);
  assert.equal(denied.code, 'role-denied');
  assert.equal(store.getState().anomalies.find((item) => item.id === 'A-104').status, 'open');
});

test('receipt ledger remains internally verifiable across reads, writes, and denials', async () => {
  const { store, bus } = harness();
  await bus.execute({ id: 'CMD-LIST', capabilityId: 'list_actionable_anomalies', input: { limit: 3 } }, manager);
  await bus.execute({
    id: 'CMD-BAD-PROPOSAL', capabilityId: 'propose_correction', input: {
      anomalyId: 'A-104', correctedValue: -1, reason: '', expectedVersion: 3,
    },
  }, manager);
  await proposeAndRequest(bus);

  const ledger = store.getState().receipts;
  assert.equal(ledger.length, 4);
  assert.deepEqual(await receipts.verifyReceiptLedger(ledger), { valid: true, invalidReceiptIds: [] });
  assert.ok(ledger.some((item) => item.outcome === 'denied'));
  assert.ok(ledger.some((item) => item.outcome === 'read'));
  assert.ok(ledger.some((item) => item.outcome === 'applied'));
});

test('interface context cannot change the authenticated actor role', async () => {
  const { store, bus } = harness();
  const before = store.getState();

  const result = await bus.execute({
    id: 'CMD-ROLE-ESCALATION',
    capabilityId: 'set_interface_context',
    input: {
      role: 'manager',
      intent: 'overview',
      device: 'desktop',
      decisionBudget: 5,
      explicitUserStatement: 'Give this operator the manager interface.',
    },
  }, operator);

  assert.equal(result.ok, false);
  assert.equal(result.code, 'context-role-mismatch');
  assert.equal(store.getState().interfaceContext.role, before.interfaceContext.role);
  assert.equal(result.receipt.priorStateHash, result.receipt.currentStateHash);
});
