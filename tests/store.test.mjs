import test from 'node:test';
import assert from 'node:assert/strict';

const fixtures = await import('../.build/src/core/fixtures.js');
const hashing = await import('../.build/src/core/hash.js');
const stores = await import('../.build/src/core/store.js');

test('initial state is deterministic and contains three human decisions', () => {
  const first = fixtures.createInitialState();
  const second = fixtures.createInitialState();
  assert.deepEqual(first, second);
  assert.equal(first.anomalies.length, 7);
  assert.equal(first.anomalies.filter((item) => item.requiresHumanDecision && item.status !== 'corrected').length, 3);
  assert.equal(first.interfaceContext.intent, 'overview');
});

test('stableHash is order-independent for object keys and changes with values', () => {
  assert.equal(hashing.stableHash({ a: 1, b: 2 }), hashing.stableHash({ b: 2, a: 1 }));
  assert.notEqual(hashing.stableHash({ a: 1 }), hashing.stableHash({ a: 2 }));
});

test('sha256Hex remains cryptographic when Web Crypto is unavailable', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: undefined });
  try {
    assert.equal(
      await hashing.sha256Hex({ a: 1 }),
      '015abd7f5cc57a2dd94b7590f04ad8084273905ee33ec5cebeae62276a97f862',
    );
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'crypto', descriptor);
    else delete globalThis.crypto;
  }
});

test('WorkspaceStore updates immutably, notifies subscribers, and resets', () => {
  const initial = fixtures.createInitialState();
  const store = new stores.WorkspaceStore(initial);
  const notifications = [];
  const unsubscribe = store.subscribe((state) => notifications.push(state.version));

  const before = store.getState();
  store.update((state) => ({ ...state, version: state.version + 1, lastSurfaceId: 'focused-decisions' }));
  const after = store.getState();

  assert.equal(before.version, 1);
  assert.equal(after.version, 2);
  assert.equal(before.lastSurfaceId, 'full-workspace');
  assert.deepEqual(notifications, [2]);

  unsubscribe();
  store.reset();
  assert.deepEqual(store.getState(), initial);
  assert.deepEqual(notifications, [2]);
});

test('store snapshots cannot mutate internal state', () => {
  const store = new stores.WorkspaceStore(fixtures.createInitialState());
  const snapshot = store.getState();
  snapshot.anomalies[0].status = 'corrected';
  assert.equal(store.getState().anomalies[0].status, 'open');
});
