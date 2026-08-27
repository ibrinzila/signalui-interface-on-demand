import { execFileSync } from 'node:child_process';
import { access, readFile, readdir } from 'node:fs/promises';
import { extname, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const unfinishedPattern = new RegExp(`\\b(?:${['TO' + 'DO', 'T' + 'BD', 'FIX' + 'ME'].join('|')})\\b`);
const excludedDirectories = new Set(['.git', '.build', 'dist', 'node_modules', 'artifacts']);
const textExtensions = new Set(['.css', '.html', '.js', '.json', '.md', '.mjs', '.svg', '.toml', '.ts', '.txt', '.webmanifest', '.yaml', '.yml', '']);
const secretPatterns = [
  { name: 'private-key', pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'github-token', pattern: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/ },
  { name: 'openai-key', pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
  { name: 'aws-access-key', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
];

async function files(directory = root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue;
    const absolute = resolve(directory, entry.name);
    if (entry.isDirectory()) result.push(...await files(absolute));
    else if (entry.isFile() && textExtensions.has(extname(entry.name).toLowerCase())) result.push(absolute);
  }
  return result;
}

export async function checkRelease() {
  const failures = [];
  const required = [
    'README.md', 'LICENSE', 'SECURITY.md', 'docs/deployment.md',
    'docs/devpost-submission.md', 'docs/judge-testing.md', 'docs/release-evidence.md',
    'wrangler.toml', 'public/_headers', 'public/manifest.webmanifest',
  ];
  for (const path of required) {
    try { await access(resolve(root, path)); } catch { failures.push(`missing:${path}`); }
  }
  for (const path of await files()) {
    const body = await readFile(path, 'utf8');
    for (const candidate of secretPatterns) {
      if (candidate.pattern.test(body)) failures.push(`${candidate.name}:${relative(root, path)}`);
    }
    if (unfinishedPattern.test(body)) failures.push(`unfinished:${relative(root, path)}`);
    if (body.split('\n').some((line) => /[ \t]+$/.test(line))) failures.push(`trailing-whitespace:${relative(root, path)}`);
    if (body.length > 0 && !body.endsWith('\n')) failures.push(`missing-final-newline:${relative(root, path)}`);
  }
  const readProjectFile = async (path) => readFile(resolve(root, path), 'utf8');
  try {
    const readme = await readProjectFile('README.md');
    for (const [heading, expected] of [
      ['Live demo', 'https://signalui-interface-on-demand.pages.dev'],
      ['Public source', 'https://github.com/ibrinzila/signalui-interface-on-demand'],
      ['Judge testing', 'docs/judge-testing.md'],
      ['Three-minute demo', 'Operator upload pending'],
    ]) {
      if (!new RegExp(`^## ${heading}$`, 'm').test(readme) || !readme.includes(expected)) {
        failures.push(`readme-release-field:${heading}`);
      }
    }
    const videoMarker = 'Operator upload pending';
    if ((readme.match(new RegExp(videoMarker, 'g')) ?? []).length !== 1 || !/^Operator upload pending$/m.test(readme)) {
      failures.push('readme-video-marker');
    }
  } catch {
    failures.push('readme-release-fields');
  }
  for (const path of await files()) {
    const projectPath = relative(root, path);
    if (projectPath === 'README.md' || projectPath === 'scripts/check-release.mjs' || projectPath.startsWith('.superpowers/') || projectPath.startsWith('docs/superpowers/')) continue;
    if ((await readFile(path, 'utf8')).includes('Operator upload pending')) failures.push(`video-marker-outside-readme:${relative(root, path)}`);
  }
  try {
    await access(resolve(root, '.git'));
    execFileSync('git', ['diff', '--check'], { cwd: root, stdio: 'pipe' });
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error) failures.push('git-diff-check');
  }
  return { ok: failures.length === 0, failures };
}

const invokedDirectly = process.argv[1]
  ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href
  : false;

if (invokedDirectly) {
  const report = await checkRelease();
  if (!report.ok) {
    console.error(`Release check failed: ${report.failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('Release check passed (required files, unfinished markers, secret patterns, whitespace).');
  }
}
