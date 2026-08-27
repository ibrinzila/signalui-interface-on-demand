import { execFileSync } from 'node:child_process';
import { access, readFile, readdir } from 'node:fs/promises';
import { extname, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const unfinishedPattern = new RegExp(`\\b(?:${['TO' + 'DO', 'T' + 'BD', 'FIX' + 'ME'].join('|')})\\b`);
const excludedDirectories = new Set(['.git', '.build', 'dist', 'node_modules', 'artifacts']);
const textExtensions = new Set(['.css', '.html', '.js', '.json', '.md', '.mjs', '.svg', '.toml', '.ts', '.txt', '.webmanifest', '.yaml', '.yml', '']);
const secretPatterns = [{ name: 'private-key', pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/ }, { name: 'github-token', pattern: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/ }, { name: 'openai-key', pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/ }, { name: 'aws-access-key', pattern: /\bAKIA[0-9A-Z]{16}\b/ }];
const publicSourceUrl = 'https://github.com/ibrinzila/signalui-interface-on-demand';
const liveDemoUrl = 'https://signalui-interface-on-demand.pages.dev';
const pendingVideo = 'Operator upload' + ' pending';

function visibleMarkdown(body) {
  const visible = [];
  let fenced = false;
  let commented = false;
  for (const line of body.split('\n')) {
    if (fenced) {
      if (/^\s{0,3}(?:`{3,}|~{3,})/.test(line)) fenced = false;
      continue;
    }
    if (commented) {
      if (line.includes('-->')) commented = false;
      continue;
    }
    if (/^\s{0,3}(?:`{3,}|~{3,})/.test(line)) {
      fenced = true;
      continue;
    }
    if (line.includes('<!--')) {
      if (!line.includes('-->')) commented = true;
      continue;
    }
    visible.push(line);
  }
  return visible;
}

function section(body, heading) {
  const lines = visibleMarkdown(body);
  const start = lines.findIndex((line) => line.match(/^## (.+?)\s*$/)?.[1].trim() === heading);
  if (start < 0) return null;
  const end = lines.findIndex((line, index) => index > start && /^## .+?\s*$/.test(line));
  return lines.slice(start + 1, end < 0 ? undefined : end).join('\n').trim();
}

async function files(root, directory = root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue;
    const absolute = resolve(directory, entry.name);
    if (entry.isDirectory()) result.push(...await files(root, absolute));
    else if (entry.isFile() && textExtensions.has(extname(entry.name).toLowerCase())) result.push(absolute);
  }
  return result;
}

function isRelevantReleaseDocument(root, path) {
  const projectPath = relative(root, path);
  return extname(path).toLowerCase() === '.md' && !projectPath.startsWith('.superpowers/') && !projectPath.startsWith('docs/superpowers/');
}

function rawMarkdownWithoutComments(body) {
  return body.replace(/<!--[\s\S]*?(?:-->|$)/g, '');
}

export async function checkRelease({ root = process.cwd() } = {}) {
  const failures = [];
  const required = ['README.md', 'LICENSE', 'SECURITY.md', 'docs/deployment.md', 'docs/devpost-submission.md', 'docs/judge-testing.md', 'docs/release-evidence.md', 'wrangler.toml', 'public/_headers', 'public/manifest.webmanifest'];
  for (const path of required) {
    try { await access(resolve(root, path)); } catch { failures.push(`missing:${path}`); }
  }
  const projectFiles = await files(root);
  for (const path of projectFiles) {
    const body = await readFile(path, 'utf8');
    for (const candidate of secretPatterns) if (candidate.pattern.test(body)) failures.push(`${candidate.name}:${relative(root, path)}`);
    if (unfinishedPattern.test(body)) failures.push(`unfinished:${relative(root, path)}`);
    if (body.split('\n').some((line) => /[ \t]+$/.test(line))) failures.push(`trailing-whitespace:${relative(root, path)}`);
    if (body.length > 0 && !body.endsWith('\n')) failures.push(`missing-final-newline:${relative(root, path)}`);
  }
  try {
    const readme = await readFile(resolve(root, 'README.md'), 'utf8');
    for (const [heading, expected] of [['Live demo', liveDemoUrl], ['Public source', publicSourceUrl], ['Judge testing', 'docs/judge-testing.md']]) {
      if (section(readme, heading) === null || !section(readme, heading).includes(expected)) failures.push(`readme-release-field:${heading}`);
    }
    const videoField = section(readme, 'Three-minute demo');
    if (videoField !== pendingVideo) failures.push('readme-video-field');
    let pendingMarkerCount = 0;
    for (const path of projectFiles.filter((path) => isRelevantReleaseDocument(root, path))) {
      const body = rawMarkdownWithoutComments(await readFile(path, 'utf8'));
      pendingMarkerCount += body.split(pendingVideo).length - 1;
    }
    if (pendingMarkerCount !== 1) failures.push('video-marker-count');
    if (videoField !== pendingVideo) failures.push('video-marker-not-readme-field');
  } catch {
    failures.push('readme-release-fields');
  }
  try {
    await access(resolve(root, '.git'));
    execFileSync('git', ['diff', '--check'], { cwd: root, stdio: 'pipe' });
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error) failures.push('git-diff-check');
  }
  return { ok: failures.length === 0, failures };
}

const invokedDirectly = process.argv[1] ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href : false;
if (invokedDirectly) {
  const report = await checkRelease();
  if (!report.ok) { console.error(`Release check failed: ${report.failures.join(', ')}`); process.exitCode = 1; }
  else console.log('Release check passed (required files, unfinished markers, secret patterns, whitespace).');
}
