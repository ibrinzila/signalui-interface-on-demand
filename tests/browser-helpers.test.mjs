import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveChromiumExecutable } from './browser-helpers.mjs';

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
