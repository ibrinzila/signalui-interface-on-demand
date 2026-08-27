import { execFileSync } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function logicalClockFactory() {
  let sequence = 0;
  return () => new Date(Date.UTC(2026, 7, 27, 8, sequence++, 0)).toISOString();
}

function idFactory() {
  let sequence = 0;
  return (prefix) => `${prefix}-EVAL-${String(++sequence).padStart(4, '0')}`;
}

async function loadRuntime(root) {
  execFileSync('npm', ['run', 'compile', '--silent'], { cwd: root, stdio: 'inherit' });
  const importBuilt = (path) => import(`${pathToFileURL(resolve(root, `.build/${path}`)).href}?v=${Date.now()}-${Math.random()}`);
  const [fixtures, storeModule, busModule, schema, intent, compiler, policy] = await Promise.all([
    importBuilt('src/core/fixtures.js'),
    importBuilt('src/core/store.js'),
    importBuilt('src/core/command-bus.js'),
    importBuilt('src/core/schema.js'),
    importBuilt('src/core/intent.js'),
    importBuilt('src/core/compiler.js'),
    importBuilt('src/core/policy.js'),
  ]);
  return { ...fixtures, ...storeModule, ...busModule, ...schema, ...intent, ...compiler, ...policy };
}

export async function runEvals({ root = process.cwd(), writeReport = true } = {}) {
  const runtime = await loadRuntime(root);
  const evalDocument = JSON.parse(await readFile(resolve(root, 'evals/webmcp-evals.json'), 'utf8'));
  const contracts = runtime.asCapabilityContractDocument(JSON.parse(await readFile(resolve(root, 'contracts/capabilities.json'), 'utf8')));
  const reports = [];

  for (const scenario of evalDocument.scenarios) {
    const store = new runtime.WorkspaceStore();
    const bus = new runtime.CommandBus({ store, contracts, clock: logicalClockFactory(), idFactory: idFactory() });
    const execute = (id, capabilityId, input, role, source = 'webmcp') => bus.execute({ id, capabilityId, input }, { id: `${role}-eval`, role, source });
    const observations = [];

    if (scenario.kind === 'intent') {
      const interpretation = runtime.interpretIntent(scenario.prompt, store.getState().interfaceContext);
      const context = { ...interpretation.context, role: scenario.expected.role };
      const plan = runtime.compileSurface(context, { ...store.getState(), interfaceContext: context });
      const tools = runtime.availableCapabilityIds(contracts, context, { ...store.getState(), interfaceContext: context });
      assert(context.device === scenario.expected.device, `${scenario.id}: wrong device`);
      assert(context.intent === scenario.expected.intent, `${scenario.id}: wrong intent`);
      assert(plan.recipe === scenario.expected.surface, `${scenario.id}: wrong surface`);
      assert(plan.primaryAnomalyIds.length === scenario.expected.primaryCount, `${scenario.id}: wrong decision count`);
      for (const tool of scenario.expected.requiredTools) assert(tools.includes(tool), `${scenario.id}: missing tool ${tool}`);
      for (const tool of scenario.expected.forbiddenTools) assert(!tools.includes(tool), `${scenario.id}: forbidden tool ${tool}`);
      observations.push({ interpretation, surface: plan.recipe, tools });
    } else if (scenario.kind === 'context') {
      const context = {
        ...store.getState().interfaceContext,
        ...scenario.context,
        accessibility: store.getState().interfaceContext.accessibility,
        explicitUserStatement: 'Explicit auditor evaluation context.',
      };
      const state = { ...store.getState(), interfaceContext: context };
      const plan = runtime.compileSurface(context, state);
      const tools = runtime.availableCapabilityIds(contracts, context, state);
      assert(plan.recipe === scenario.expected.surface, `${scenario.id}: wrong surface`);
      for (const tool of scenario.expected.requiredTools) assert(tools.includes(tool), `${scenario.id}: missing tool ${tool}`);
      for (const tool of scenario.expected.forbiddenTools) assert(!tools.includes(tool), `${scenario.id}: forbidden tool ${tool}`);
      observations.push({ surface: plan.recipe, tools });
    } else if (scenario.kind === 'journey') {
      const anomaly = store.getState().anomalies.find((item) => item.id === scenario.anomalyId);
      assert(anomaly, `${scenario.id}: anomaly missing`);
      observations.push(await execute('eval-list', 'list_actionable_anomalies', { limit: 3 }, 'operator'));
      observations.push(await execute('eval-inspect', 'inspect_anomaly', { anomalyId: anomaly.id }, 'operator'));
      observations.push(await execute('eval-compare', 'compare_reading_history', { anomalyId: anomaly.id }, 'operator'));
      observations.push(await execute('eval-propose', 'propose_correction', {
        anomalyId: anomaly.id,
        correctedValue: scenario.proposal.correctedValue,
        reason: scenario.proposal.reason,
        expectedVersion: anomaly.version,
      }, 'operator'));
      const proposed = store.getState().anomalies.find((item) => item.id === anomaly.id);
      observations.push(await execute('eval-request-approval', 'request_human_approval', {
        anomalyId: anomaly.id,
        expectedVersion: proposed.version,
      }, 'operator'));
      const pending = store.getState().anomalies.find((item) => item.id === anomaly.id);
      observations.push(await execute('eval-operator-approve', 'approve_correction', {
        anomalyId: anomaly.id,
        approvalId: pending.approval.id,
        expectedVersion: pending.version,
        fingerprint: pending.approval.fingerprint,
      }, 'operator'));
      observations.push(await execute('eval-manager-context', 'set_interface_context', {
        role: 'manager', intent: 'resolve-actionable-anomalies', device: 'desktop', decisionBudget: 3,
        explicitUserStatement: 'Review the pending evidence-bound approval.',
      }, 'manager'));
      const managerPending = store.getState().anomalies.find((item) => item.id === anomaly.id);
      const managerResult = await execute('eval-manager-approve', 'approve_correction', {
        anomalyId: anomaly.id,
        approvalId: managerPending.approval.id,
        expectedVersion: managerPending.version,
        fingerprint: managerPending.approval.fingerprint,
      }, 'manager');
      observations.push(managerResult);
      const meaningfulCodes = observations.filter((item) => item.code !== 'context-updated').map((item) => item.code);
      assert(JSON.stringify(meaningfulCodes) === JSON.stringify(scenario.expectedCodes), `${scenario.id}: call sequence differed: ${meaningfulCodes.join(', ')}`);
      assert(store.getState().anomalies.find((item) => item.id === anomaly.id).status === 'corrected', `${scenario.id}: correction not applied`);
    } else if (scenario.kind === 'untrusted-content') {
      const before = store.getState();
      const result = await execute('eval-untrusted-inspect', 'inspect_anomaly', { anomalyId: scenario.anomalyId }, 'operator');
      const after = store.getState();
      assert(result.code === 'anomaly-inspected', `${scenario.id}: inspect failed`);
      assert(after.anomalies.map((item) => `${item.id}:${item.status}:${item.version}`).join('|') === before.anomalies.map((item) => `${item.id}:${item.status}:${item.version}`).join('|'), `${scenario.id}: untrusted content changed operational state`);
      assert(after.receipts.length === before.receipts.length + 1, `${scenario.id}: read receipt missing`);
      observations.push(result);
    } else if (scenario.kind === 'role-escalation') {
      const before = store.getState();
      const result = await execute('eval-role-escalation', 'set_interface_context', {
        role: scenario.targetRole,
        intent: 'overview',
        device: 'desktop',
        decisionBudget: 5,
        explicitUserStatement: 'Attempt to elevate the current role through interface context.',
      }, 'operator');
      const after = store.getState();
      assert(result.code === scenario.expectedCode, `${scenario.id}: role escalation was not denied`);
      assert(after.interfaceContext.role === before.interfaceContext.role, `${scenario.id}: interface role changed despite denial`);
      assert(result.receipt.priorStateHash === result.receipt.currentStateHash, `${scenario.id}: denied escalation mutated operational state`);
      observations.push(result);
    } else {
      throw new Error(`${scenario.id}: unsupported eval kind ${scenario.kind}`);
    }

    reports.push({ id: scenario.id, status: 'passed', observations: observations.map((item) => item?.code ?? item) });
  }

  const report = { product: 'SignalUI Interface on Demand', version: evalDocument.version, passed: reports.length, failed: 0, scenarios: reports };
  if (writeReport) {
    const generatedAt = new Date().toISOString();
    await mkdir(resolve(root, 'artifacts/runtime'), { recursive: true });
    await mkdir(resolve(root, 'artifacts/proof'), { recursive: true });
    await writeFile(resolve(root, 'artifacts/runtime/webmcp-eval-report.json'), `${JSON.stringify(report, null, 2)}\n`);
    await writeFile(resolve(root, 'artifacts/proof/webmcp-evals.json'), `${JSON.stringify({
      generatedAt,
      passed: report.failed === 0,
      scenarioCount: reports.length,
      results: reports,
    }, null, 2)}\n`);
  }
  return report;
}

const invokedDirectly = process.argv[1]
  ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href
  : false;
if (invokedDirectly) {
  try {
    const report = await runEvals();
    console.log(`WebMCP evals passed: ${report.passed}/${report.passed}.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
