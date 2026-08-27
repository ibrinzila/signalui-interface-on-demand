import test from 'node:test';
import assert from 'node:assert/strict';

const preferences = await import('../.build/src/core/preferences.js');

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
}

test('explicit interface profile round-trips through a storage adapter', () => {
  const storage = new MemoryStorage();
  const first = preferences.createProfilePreferenceStore(storage);
  first.write('operator-mobile');

  const second = preferences.createProfilePreferenceStore(storage);
  assert.equal(second.read(), 'operator-mobile');
});

test('invalid persisted profile fails closed to the manager demonstration profile', () => {
  const storage = new MemoryStorage();
  storage.setItem(preferences.PROFILE_STORAGE_KEY, 'administrator-superuser');
  const store = preferences.createProfilePreferenceStore(storage);
  assert.equal(store.read(), 'manager-desktop');
});

test('unavailable browser storage falls back to session memory without throwing', () => {
  const storage = {
    getItem() { throw new Error('storage denied'); },
    setItem() { throw new Error('storage denied'); },
    removeItem() { throw new Error('storage denied'); },
  };
  const store = preferences.createProfilePreferenceStore(storage);
  store.write('auditor-desktop');
  assert.equal(store.read(), 'auditor-desktop');
  store.clear();
  assert.equal(store.read(), 'manager-desktop');
});
