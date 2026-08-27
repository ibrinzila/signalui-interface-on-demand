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
  const required = ['README.md', 'LICENSE', 'SECURITY.md', 'docs/deployment.md', 'wrangler.toml', 'public/_headers', 'public/manifest.webmanifest'];
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
