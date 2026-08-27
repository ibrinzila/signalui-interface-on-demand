import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { startServer } = await import('../scripts/server.mjs');

test('judge-facing release documents provide the required evidence and testing boundaries', async () => {
  const [devpost, judgeTesting, releaseEvidence] = await Promise.all([
    readFile(new URL('../docs/devpost-submission.md', import.meta.url), 'utf8'),
    readFile(new URL('../docs/judge-testing.md', import.meta.url), 'utf8'),
    readFile(new URL('../docs/release-evidence.md', import.meta.url), 'utf8'),
  ]);

  for (const heading of ['WebMCP leverage', 'People and agents together', 'Implementation', 'Impact', 'Testing']) {
    assert.match(devpost, new RegExp(`^## ${heading}$`, 'm'));
  }
  assert.match(judgeTesting, /native WebMCP/i);
  assert.match(judgeTesting, /fallback console/i);
  for (const field of ['Source commit', 'Deployment URL', 'Deployment timestamp', 'Smoke results']) {
    assert.match(releaseEvidence, new RegExp(`^[-*] \\*\\*${field}:\\*\\*`, 'm'));
  }
});

test('static server serves same-origin assets with fail-closed security headers', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'signalui-server-'));
  await writeFile(join(root, 'index.html'), '<!doctype html><title>SignalUI</title>');
  const server = await startServer({ root, host: '127.0.0.1', port: 0, quiet: true });
  t.after(async () => {
    await server.close();
    await rm(root, { recursive: true, force: true });
  });
  const response = await fetch(`${server.url}/`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-security-policy') ?? '', /default-src 'self'/);
  assert.doesNotMatch(response.headers.get('content-security-policy') ?? '', /unsafe-inline/);
  assert.equal(response.headers.get('permissions-policy'), 'tools=(self)');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(await response.text(), '<!doctype html><title>SignalUI</title>');
});

test('static server rejects path traversal and unknown files', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'signalui-server-'));
  await writeFile(join(root, 'index.html'), 'ok');
  const server = await startServer({ root, host: '127.0.0.1', port: 0, quiet: true });
  t.after(async () => {
    await server.close();
    await rm(root, { recursive: true, force: true });
  });
  const missing = await fetch(`${server.url}/missing.txt`);
  assert.equal(missing.status, 404);
  const traversal = await fetch(`${server.url}/%2e%2e/package.json`);
  assert.ok([400, 404].includes(traversal.status));
});


test('static server serves the web app manifest with its registered content type', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'signalui-server-'));
  await writeFile(join(root, 'manifest.webmanifest'), '{"name":"SignalUI"}');
  const server = await startServer({ root, host: '127.0.0.1', port: 0, quiet: true });
  t.after(async () => {
    await server.close();
    await rm(root, { recursive: true, force: true });
  });
  const response = await fetch(`${server.url}/manifest.webmanifest`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/manifest+json; charset=utf-8');
});
