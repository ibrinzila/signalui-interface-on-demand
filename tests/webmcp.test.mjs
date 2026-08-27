import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const bridgeModule = await import('../.build/src/webmcp/bridge.js');
const fixtures = await import('../.build/src/core/fixtures.js');
const schema = await import('../.build/src/core/schema.js');
const stores = await import('../.build/src/core/store.js');
const commands = await import('../.build/src/core/command-bus.js');

const contracts = schema.asCapabilityContractDocument(
  JSON.parse(await readFile(new URL('../contracts/capabilities.json', import.meta.url), 'utf8')),
);

class FakeModelContext {
  registrations = [];

  registerTool(definition, options = {}) {
    const record = { definition, signal: options.signal, active: true };
    this.registrations.push(record);
    options.signal?.addEventListener('abort', () => { record.active = false; }, { once: true });
  }
}

function harness({ native = true } = {}) {
  const store = new stores.WorkspaceStore(fixtures.createInitialState());
  const bus = new commands.CommandBus({ store, contracts });
  const modelContext = native ? new FakeModelContext() : undefined;
  const bridge = new bridgeModule.WebMcpBridge({
    store,
    contracts,
    commandBus: bus,
    actorProvider: () => ({ id: 'manager-1', role: store.getState().interfaceContext.role, source: 'webmcp' }),
    ...(modelContext ? { modelContext } : {}),
  });
  return { store, bus, modelContext, bridge };
}

test('tool catalog contains exactly eight semantic definitions with correct annotations', () => {
  const { bridge } = harness({ native: false });
  const definitions = bridge.getCatalog();
  assert.equal(definitions.length, 8);
  assert.equal(new Set(definitions.map((item) => item.name)).size, 8);
  for (const definition of definitions) {
    assert.equal(typeof definition.description, 'string');
    assert.equal(definition.inputSchema.type, 'object');
    assert.equal(typeof definition.annotations.readOnlyHint, 'boolean');
    assert.equal(typeof definition.annotations.untrustedContentHint, 'boolean');
  }
  assert.equal(definitions.find((item) => item.name === 'inspect_anomaly').annotations.untrustedContentHint, true);
  assert.equal(definitions.find((item) => item.name === 'approve_correction').annotations.readOnlyHint, false);
});

test('native registration exposes only currently admitted tools and aborts prior registrations on refresh', async () => {
  const { bridge, modelContext } = harness();
  await bridge.start();
  const initial = modelContext.registrations.filter((item) => item.active);
  assert.deepEqual(initial.map((item) => item.definition.name), [
    'set_interface_context',
    'list_actionable_anomalies',
    'inspect_anomaly',
    'compare_reading_history',
    'propose_correction',
    'request_more_evidence',
  ]);
  assert.ok(initial.every((item) => item.signal instanceof AbortSignal));

  await bridge.refresh();
  assert.ok(initial.every((item) => item.signal.aborted));
  assert.equal(modelContext.registrations.filter((item) => item.active).length, 6);
  bridge.stop();
  assert.equal(modelContext.registrations.filter((item) => item.active).length, 0);
});

test('fallback and native tool execution use the shared command bus and visible state', async () => {
  const { store, bridge, modelContext } = harness();
  await bridge.start();

  const fallback = await bridge.executeFallbackTool('request_more_evidence', {
    anomalyId: 'A-305',
    request: 'Upload a glare-free meter photograph and confirm whether the meter was replaced.',
    expectedVersion: 1,
  });
  assert.equal(fallback.ok, true);
  assert.equal(store.getState().anomalies.find((item) => item.id === 'A-305').status, 'evidence-requested');
  assert.equal(store.getState().receipts.at(-1).source, 'fallback-tool');

  const inspect = modelContext.registrations
    .filter((item) => item.active)
    .find((item) => item.definition.name === 'inspect_anomaly');
  const output = JSON.parse(await inspect.definition.execute({ anomalyId: 'A-104' }));
  assert.equal(output.ok, true);
  assert.equal(output.code, 'anomaly-inspected');
  assert.equal(store.getState().receipts.at(-1).source, 'webmcp');
  assert.equal(output.data.id, 'A-104');
});

test('tool availability advances with proposal and approval workflow state', async () => {
  const { bridge } = harness({ native: false });
  await bridge.start();
  assert.ok(!bridge.listFallbackTools().some((item) => item.name === 'request_human_approval'));

  const proposed = await bridge.executeFallbackTool('propose_correction', {
    anomalyId: 'A-104', correctedValue: 4829,
    reason: 'The meter image confirms that one extra digit was entered during transcription.', expectedVersion: 3,
  });
  assert.equal(proposed.ok, true);
  await bridge.refresh();
  assert.ok(bridge.listFallbackTools().some((item) => item.name === 'request_human_approval'));

  const requested = await bridge.executeFallbackTool('request_human_approval', { anomalyId: 'A-104', expectedVersion: 4 });
  assert.equal(requested.ok, true);
  await bridge.refresh();
  assert.ok(bridge.listFallbackTools().some((item) => item.name === 'approve_correction'));
});

test('auditor fallback registry is read-only apart from explicit interface context', async () => {
  const { store, bridge } = harness({ native: false });
  store.update((state) => ({
    ...state,
    interfaceContext: { ...state.interfaceContext, role: 'auditor', intent: 'audit-recent-decisions' },
  }));
  await bridge.start();
  assert.deepEqual(bridge.listFallbackTools().map((item) => item.name), [
    'set_interface_context',
    'list_actionable_anomalies',
    'inspect_anomaly',
    'compare_reading_history',
  ]);
});

test('a known but unexposed fallback attempt is denied through the command bus and receipted', async () => {
  const { store, bridge } = harness({ native: false });
  store.update((state) => ({
    ...state,
    interfaceContext: { ...state.interfaceContext, role: 'operator', intent: 'resolve-actionable-anomalies' },
  }));
  await bridge.start();
  await bridge.executeFallbackTool('propose_correction', {
    anomalyId: 'A-104', correctedValue: 4829,
    reason: 'The meter image confirms that one extra digit was entered during transcription.', expectedVersion: 3,
  });
  await bridge.executeFallbackTool('request_human_approval', { anomalyId: 'A-104', expectedVersion: 4 });
  const pending = store.getState().anomalies.find((item) => item.id === 'A-104');
  assert.ok(!bridge.listFallbackTools().some((item) => item.name === 'approve_correction'));

  const denied = await bridge.executeFallbackTool('approve_correction', {
    anomalyId: pending.id,
    approvalId: pending.approval.id,
    expectedVersion: pending.version,
    fingerprint: pending.approval.fingerprint,
  });

  assert.equal(denied.ok, false);
  assert.equal(denied.code, 'role-denied');
  assert.equal(denied.receipt.outcome, 'denied');
  assert.equal(denied.receipt.source, 'fallback-tool');
  assert.equal(store.getState().anomalies.find((item) => item.id === 'A-104').status, 'awaiting-approval');
});
