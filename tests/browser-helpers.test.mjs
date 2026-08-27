import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import test from 'node:test';
import { tmpdir } from 'node:os';
import { launchBrowserHarness, resolveChromiumExecutable } from './browser-helpers.mjs';

test('explicit CHROMIUM_PATH takes precedence over discovered executables', () => {
  assert.equal(resolveChromiumExecutable({
    env: { CHROMIUM_PATH: '/custom/chromium' },
    platform: 'linux',
    exists: () => false,
  }), '/custom/chromium');
});

test('Linux resolves the system Chromium executable', () => {
  assert.equal(resolveChromiumExecutable({
    env: {},
    platform: 'linux',
    exists: (candidate) => candidate === '/usr/bin/chromium',
  }), '/usr/bin/chromium');
});

test('macOS resolves the stable Google Chrome executable', () => {
  assert.equal(resolveChromiumExecutable({
    env: {},
    platform: 'darwin',
    exists: (candidate) => candidate === '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  }), '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
});

test('missing executables report the override and every attempted path', () => {
  assert.throws(() => resolveChromiumExecutable({
    env: {},
    platform: 'darwin',
    exists: () => false,
  }), (error) => {
    assert.match(error.message, /CHROMIUM_PATH/);
    assert.match(error.message, /\/Applications\/Google Chrome\.app\/Contents\/MacOS\/Google Chrome/);
    return true;
  });
});

test('an invalid explicit CHROMIUM_PATH fails promptly and cleans its temporary profile', async () => {
  const profilePrefix = 'signalui-chromium-';
  const profilesBefore = (await readdir(tmpdir())).filter((name) => name.startsWith(profilePrefix)).sort();
  const startedAt = performance.now();

  await assert.rejects(() => launchBrowserHarness({
    env: { CHROMIUM_PATH: '/definitely-missing/signalui-chromium' },
  }), /Unable to start Chromium at .*ENOENT/);

  const elapsedMs = performance.now() - startedAt;
  const profilesAfter = (await readdir(tmpdir())).filter((name) => name.startsWith(profilePrefix)).sort();
  assert.ok(elapsedMs < 2_000, `launch failure took ${elapsedMs}ms instead of failing promptly`);
  assert.deepEqual(profilesAfter, profilesBefore);
});
