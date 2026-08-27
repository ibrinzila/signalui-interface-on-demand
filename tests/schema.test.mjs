import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const schema = await import('../.build/src/core/schema.js');

async function json(path) {
  return JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
}

test('canonical capability contracts are valid and contain exactly eight unique tools', async () => {
  const contracts = await json('../contracts/capabilities.json');
  const result = schema.validateCapabilityContracts(contracts);
  assert.deepEqual(result.errors, []);
  assert.equal(contracts.capabilities.length, 8);
  assert.equal(new Set(contracts.capabilities.map((item) => item.id)).size, 8);
});

test('capability validation rejects duplicate IDs and write capabilities without roles', () => {
  const result = schema.validateCapabilityContracts({
    version: '1.0',
    capabilities: [
      {
        id: 'duplicate', title: 'One', description: 'Reads one thing.', effect: 'read',
        roles: ['operator'], inputSchema: { type: 'object', properties: {} }
      },
      {
        id: 'duplicate', title: 'Two', description: 'Writes one thing.', effect: 'write',
        roles: [], inputSchema: { type: 'object', properties: {} }
      }
    ]
  });
  assert.ok(result.errors.some((error) => error.code === 'duplicate-capability-id'));
  assert.ok(result.errors.some((error) => error.code === 'write-capability-without-role'));
});

test('surface recipes require explanation and reversal regions', async () => {
  const canonical = await json('../contracts/surface-recipes.json');
  assert.deepEqual(schema.validateSurfaceRecipes(canonical).errors, []);

  const invalid = {
    version: '1.0',
    recipes: [{ id: 'broken', title: 'Broken', regions: ['primary'] }]
  };
  const result = schema.validateSurfaceRecipes(invalid);
  assert.ok(result.errors.some((error) => error.code === 'missing-explanation-region'));
  assert.ok(result.errors.some((error) => error.code === 'missing-reversal-region'));
});
