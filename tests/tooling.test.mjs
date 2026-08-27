import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [{ startServer }, { checkDocs }, { checkRelease }] = await Promise.all([
  import('../scripts/server.mjs'),
  import('../scripts/check-docs.mjs'),
  import('../scripts/check-release.mjs'),
]);

const publicSourceUrl = 'https://github.com/ibrinzila/signalui-interface-on-demand';
const liveDemoUrl = 'https://signalui-interface-on-demand.pages.dev';

async function writeReleaseFixture(root, overrides = {}) {
  await mkdir(join(root, 'docs'), { recursive: true });
  await mkdir(join(root, 'public'), { recursive: true });
  const files = {
    'README.md': `# SignalUI\n\n## Live demo\n\n${liveDemoUrl}\n\n## Public source\n\n${publicSourceUrl}\n\n## Judge testing\n\n[Guide](docs/judge-testing.md)\n\n## Three-minute demo\n\nOperator upload pending\n`,
    'LICENSE': 'MIT\n', 'SECURITY.md': '# Security\n', 'CHANGELOG.md': '# Changes\n', 'llms.txt': 'SignalUI\n',
    'docs/architecture.md': '# Architecture\n', 'docs/webmcp-tools.md': '# Tools\n', 'docs/demo-script.md': '# Demo\n', 'docs/adoption-path.md': '# Adoption\n', 'docs/verification.md': '# Verification\n', 'docs/deployment.md': '# Deployment\n',
    'docs/devpost-submission.md': `# Submission\n\n## WebMCP leverage\n\nNative registration uses CommandBus.execute.\n\n## People and agents together\n\nShared authority.\n\n## Implementation\n\nTypeScript.\n\n## Impact\n\nSynthetic scope.\n\n## Testing\n\n${publicSourceUrl}\n${liveDemoUrl}\n`,
    'docs/judge-testing.md': `# Judge guide\n\n## Native WebMCP check\n\nNative WebMCP uses document.modelContext.registerTool. This is the only path that establishes native WebMCP availability.\n\n## Fallback console check\n\nThe fallback console is not native WebMCP. It uses the same catalog as native WebMCP tools and the same CommandBus.execute path as human controls.\n\n${publicSourceUrl}\n${liveDemoUrl}\n`,
    'docs/release-evidence.md': `# NOT YET VERIFIED / NOT YET DEPLOYED\n\n- **Source commit:** NOT YET RECORDED\n- **Deployment URL:** ${liveDemoUrl}\n- **Deployment timestamp:** NOT YET DEPLOYED\n- **Smoke results:** NOT YET VERIFIED\n- **Public source URL:** ${publicSourceUrl}\n`,
    'wrangler.toml': 'name = "signalui"\n', 'public/_headers': '/*\n', 'public/manifest.webmanifest': '{}\n',
    ...overrides,
  };
  await Promise.all(Object.entries(files).map(async ([path, body]) => {
    await mkdir(join(root, path, '..'), { recursive: true });
    await writeFile(join(root, path), body);
  }));
}

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
  for (const body of [devpost, judgeTesting, releaseEvidence]) {
    assert.match(body, new RegExp(publicSourceUrl.replaceAll('.', '\\.'), 'i'));
    assert.match(body, new RegExp(liveDemoUrl.replaceAll('.', '\\.'), 'i'));
  }
  assert.match(judgeTesting, /^## Native WebMCP check\n\n[\s\S]*document\.modelContext\.registerTool/m);
  assert.match(judgeTesting, /^## Fallback console check\n\n[\s\S]*same catalog as native WebMCP tools[\s\S]*same `CommandBus\.execute` path as human controls/m);
  assert.match(judgeTesting, /The fallback console is a demonstration fallback, not native WebMCP\./);
  for (const field of ['Source commit', 'Deployment URL', 'Deployment timestamp', 'Smoke results']) {
    assert.match(releaseEvidence, new RegExp(`^[-*] \\*\\*${field}:\\*\\*`, 'm'));
  }
});

test('documentation checks reject wrong coordinates and misleading WebMCP boundaries', async (t) => {
  const wrongUrlRoot = await mkdtemp(join(tmpdir(), 'signalui-docs-wrong-url-'));
  const misleadingRoot = await mkdtemp(join(tmpdir(), 'signalui-docs-misleading-boundary-'));
  t.after(async () => Promise.all([
    rm(wrongUrlRoot, { recursive: true, force: true }),
    rm(misleadingRoot, { recursive: true, force: true }),
  ]));
  await writeReleaseFixture(wrongUrlRoot, {
    'docs/release-evidence.md': `# NOT YET VERIFIED / NOT YET DEPLOYED\n\n- **Source commit:** NOT YET RECORDED\n- **Deployment URL:** https://wrong.example\n- **Deployment timestamp:** NOT YET DEPLOYED\n- **Smoke results:** NOT YET VERIFIED\n- **Public source URL:** ${publicSourceUrl}\n`,
  });
  await writeReleaseFixture(misleadingRoot, {
    'docs/judge-testing.md': `# Judge guide\n\n## Native WebMCP check\n\nThe fallback console demonstrates tools.\n\n## Fallback console check\n\nNative WebMCP is always available.\n\n${publicSourceUrl}\n${liveDemoUrl}\n`,
  });
  await assert.rejects(checkDocs({ root: wrongUrlRoot }), /signalui-interface-on-demand\.pages\.dev/);
  await assert.rejects(checkDocs({ root: misleadingRoot }), /Native WebMCP check/);
});

test('documentation checks ignore headings and evidence hidden in fenced blocks or comments', async (t) => {
  const fencedRoot = await mkdtemp(join(tmpdir(), 'signalui-docs-fenced-content-'));
  const commentRoot = await mkdtemp(join(tmpdir(), 'signalui-docs-comment-content-'));
  t.after(async () => Promise.all([
    rm(fencedRoot, { recursive: true, force: true }),
    rm(commentRoot, { recursive: true, force: true }),
  ]));
  const hiddenContent = `\`\`\`md\n## WebMCP leverage\n## People and agents together\n## Implementation\n## Impact\n## Testing\n## Native WebMCP check\ndocument.modelContext.registerTool is the only path that establishes native WebMCP availability.\n## Fallback console check\nThis is not native WebMCP and uses the same catalog as native WebMCP tools and the same CommandBus.execute path as human controls.\n${publicSourceUrl}\n${liveDemoUrl}\n\`\`\`\n`;
  await writeReleaseFixture(fencedRoot, {
    'docs/devpost-submission.md': hiddenContent,
    'docs/judge-testing.md': hiddenContent,
    'docs/release-evidence.md': `# NOT YET VERIFIED / NOT YET DEPLOYED\n\n- **Source commit:** NOT YET RECORDED\n- **Deployment URL:** ${liveDemoUrl}\n- **Deployment timestamp:** NOT YET DEPLOYED\n- **Smoke results:** NOT YET VERIFIED\n- **Public source URL:** ${publicSourceUrl}\n`,
    'README.md': `# SignalUI\n\n\`\`\`md\n## Live demo\n${liveDemoUrl}\n## Public source\n${publicSourceUrl}\n## Judge testing\ndocs/judge-testing.md\n## Three-minute demo\nOperator upload pending\n\`\`\`\n`,
  });
  const hiddenComment = `<!--\n## WebMCP leverage\n## People and agents together\n## Implementation\n## Impact\n## Testing\n## Native WebMCP check\ndocument.modelContext.registerTool is the only path that establishes native WebMCP availability.\n## Fallback console check\nThis is not native WebMCP and uses the same catalog as native WebMCP tools and the same CommandBus.execute path as human controls.\n${publicSourceUrl}\n${liveDemoUrl}\n-->\n`;
  await writeReleaseFixture(commentRoot, {
    'docs/devpost-submission.md': hiddenComment,
    'docs/judge-testing.md': hiddenComment,
  });
  await assert.rejects(checkDocs({ root: fencedRoot }), /WebMCP leverage/);
  await assert.rejects(checkDocs({ root: commentRoot }), /WebMCP leverage/);
  const release = await checkRelease({ root: fencedRoot });
  assert.ok(release.failures.includes('readme-release-field:Live demo'));
  assert.ok(release.failures.includes('readme-video-field'));
});

test('release check rejects a moved or duplicated video pending marker', async (t) => {
  const movedRoot = await mkdtemp(join(tmpdir(), 'signalui-release-moved-marker-'));
  const duplicatedRoot = await mkdtemp(join(tmpdir(), 'signalui-release-duplicate-marker-'));
  const fencedRoot = await mkdtemp(join(tmpdir(), 'signalui-release-fenced-marker-'));
  t.after(async () => Promise.all([
    rm(movedRoot, { recursive: true, force: true }),
    rm(duplicatedRoot, { recursive: true, force: true }),
    rm(fencedRoot, { recursive: true, force: true }),
  ]));
  await writeReleaseFixture(movedRoot, {
    'README.md': `# SignalUI\n\n## Live demo\n\n${liveDemoUrl}\n\n## Public source\n\n${publicSourceUrl}\n\n## Judge testing\n\n[Guide](docs/judge-testing.md)\n\n## Three-minute demo\n\nhttps://video.example/demo\n\n## Notes\n\nOperator upload pending\n`,
  });
  await writeReleaseFixture(duplicatedRoot, {
    'README.md': `# SignalUI\n\n## Live demo\n\n${liveDemoUrl}\n\n## Public source\n\n${publicSourceUrl}\n\n## Judge testing\n\n[Guide](docs/judge-testing.md)\n\n## Three-minute demo\n\nOperator upload pending\n\n## Notes\n\nOperator upload pending\n`,
  });
  await writeReleaseFixture(fencedRoot, {
    'docs/devpost-submission.md': `# Submission\n\n\`\`\`text\nOperator upload pending\n\`\`\`\n`,
  });
  const moved = await checkRelease({ root: movedRoot });
  const duplicated = await checkRelease({ root: duplicatedRoot });
  const fenced = await checkRelease({ root: fencedRoot });
  assert.ok(moved.failures.includes('readme-video-field'));
  assert.ok(moved.failures.includes('video-marker-not-readme-field'));
  assert.ok(duplicated.failures.includes('video-marker-count'));
  assert.ok(fenced.failures.includes('video-marker-count'));
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
