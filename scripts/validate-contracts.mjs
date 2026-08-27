import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function validateContracts({ compile = true, root = process.cwd(), writeProof = false } = {}) {
  if (compile) {
    execFileSync('npm', ['run', 'compile', '--silent'], { cwd: root, stdio: 'inherit' });
  }
  const schemaUrl = pathToFileURL(resolve(root, '.build/src/core/schema.js')).href;
  const { validateCapabilityContracts, validateSurfaceRecipes } = await import(`${schemaUrl}?v=${Date.now()}`);
  const capabilitiesPath = resolve(root, 'contracts/capabilities.json');
  const recipesPath = resolve(root, 'contracts/surface-recipes.json');
  const capabilities = JSON.parse(await readFile(capabilitiesPath, 'utf8'));
  const recipes = JSON.parse(await readFile(recipesPath, 'utf8'));
  const capabilityResult = validateCapabilityContracts(capabilities);
  const recipeResult = validateSurfaceRecipes(recipes);
  const errors = [...capabilityResult.errors, ...recipeResult.errors];

  const ids = capabilities.capabilities?.map((item) => item.id) ?? [];
  if (ids.length !== 8) errors.push({ path: 'capabilities', message: `Expected exactly 8 capabilities, found ${ids.length}.` });
  if (!ids.includes('set_interface_context') || !ids.includes('approve_correction')) {
    errors.push({ path: 'capabilities', message: 'Required interface and approval boundaries are missing.' });
  }
  const recipeIds = recipes.recipes?.map((item) => item.id) ?? [];
  for (const required of ['full-workspace', 'focused-decisions', 'audit-trail']) {
    if (!recipeIds.includes(required)) errors.push({ path: 'recipes', message: `Required recipe ${required} is missing.` });
  }

  const report = {
    ok: errors.length === 0,
    errors,
    capabilityCount: ids.length,
    recipeCount: recipeIds.length,
    capabilityVersion: capabilities.version,
    recipeVersion: recipes.version,
    requiredCapabilityIds: ids,
  };
  if (writeProof) {
    const proofDirectory = resolve(root, 'artifacts/proof');
    await mkdir(proofDirectory, { recursive: true });
    await writeFile(resolve(proofDirectory, 'contract-validation.json'), `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      valid: report.ok,
      capabilityCount: report.capabilityCount,
      recipeCount: report.recipeCount,
      capabilityVersion: report.capabilityVersion,
      recipeVersion: report.recipeVersion,
      requiredCapabilityIds: report.requiredCapabilityIds,
      diagnostics: report.errors,
    }, null, 2)}\n`);
  }
  return report;
}

const invokedDirectly = process.argv[1]
  ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href
  : false;

if (invokedDirectly) {
  const report = await validateContracts({ writeProof: true });
  if (!report.ok) {
    for (const item of report.errors) console.error(`${item.path}: ${item.message}`);
    process.exitCode = 1;
  } else {
    console.log(`Contracts valid: ${report.capabilityCount} capabilities, ${report.recipeCount} surface recipes.`);
  }
}
