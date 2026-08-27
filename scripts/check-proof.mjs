import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const REQUIRED_PROOF_FILES = Object.freeze([
  'contract-validation.json',
  'webmcp-evals.json',
  'browser-e2e.json',
  'accessibility.json',
  'interface-on-demand-desktop.png',
  'interface-on-demand-mobile.png',
  'interface-on-demand-audit.png',
]);

async function json(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export async function checkProof(root = process.cwd()) {
  const proofRoot = resolve(root, 'artifacts/proof');
  const missing = [];
  for (const file of REQUIRED_PROOF_FILES) {
    try { await access(resolve(proofRoot, file)); } catch { missing.push(file); }
  }
  if (missing.length > 0) return { ok: false, missing };

  const [contracts, evals, browser, accessibility] = await Promise.all([
    json(resolve(proofRoot, 'contract-validation.json')),
    json(resolve(proofRoot, 'webmcp-evals.json')),
    json(resolve(proofRoot, 'browser-e2e.json')),
    json(resolve(proofRoot, 'accessibility.json')),
  ]);
  const failures = [];
  if (contracts.valid !== true || contracts.capabilityCount !== 8 || contracts.recipeCount !== 3) failures.push('contract-validation.json');
  if (evals.passed !== true || evals.scenarioCount !== 5) failures.push('webmcp-evals.json');
  if (browser.passed !== true || browser.checks?.length !== 24) failures.push('browser-e2e.json');
  if (accessibility.passed !== true || accessibility.checks?.length !== 18) failures.push('accessibility.json');
  return {
    ok: failures.length === 0,
    missing: [],
    failures,
    counts: {
      capabilities: contracts.capabilityCount,
      recipes: contracts.recipeCount,
      evals: evals.scenarioCount,
      browserChecks: browser.checks?.length ?? 0,
      accessibilityChecks: accessibility.checks?.length ?? 0,
    },
  };
}

const invokedDirectly = process.argv[1]
  ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href
  : false;

if (invokedDirectly) {
  const result = await checkProof();
  if (!result.ok) {
    console.error(`Proof check failed: ${[...result.missing, ...(result.failures ?? [])].join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log(`Proof check passed (${result.counts.evals} evals, ${result.counts.browserChecks} browser checks, ${result.counts.accessibilityChecks} accessibility checks).`);
  }
}
