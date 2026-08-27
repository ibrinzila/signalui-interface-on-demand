import { mkdir, writeFile } from 'node:fs/promises';
import { launchBrowserHarness, browserAssert } from './browser-helpers.mjs';

await mkdir('artifacts/proof', { recursive: true });
const harness = await launchBrowserHarness({ width: 1440, height: 1000 });
const checks = [];
const check = (condition, message) => { checks.push({ message, passed: Boolean(condition) }); browserAssert(condition, message); };
try {
  const initial = await harness.client.evaluate(`({
    recipe: window.SignalUIDemo.getPlan().recipe,
    role: window.SignalUIDemo.getState().interfaceContext.role,
    tools: window.SignalUIDemo.getTools(),
    fatal: document.getElementById('fatal-error')?.hidden === false,
    h1: document.querySelector('main h1')?.textContent
  })`);
  check(initial.recipe === 'full-workspace', 'Initial manager surface must be the full workspace.');
  check(initial.role === 'manager', 'Initial synthetic identity must be manager.');
  check(initial.tools.length >= 6, 'Manager must receive the admitted capability set.');
  check(!initial.fatal, 'The application must not enter fail-closed error mode.');

  await harness.client.evaluate(`window.SignalUIDemo.submitIntent("I'm on my phone and leaving shortly. Help me resolve only the anomalies that genuinely need my decision.")`);
  const focused = await harness.client.evaluate(`({
    recipe: window.SignalUIDemo.getPlan().recipe,
    decisions: document.querySelectorAll('[data-decision-card]').length,
    counterevidence: document.body.textContent.includes('Counterevidence'),
    explanation: document.body.textContent.includes('Nothing material was removed'),
    role: window.SignalUIDemo.getState().interfaceContext.role,
    intentInput: document.getElementById('intent-input')?.value
  })`);
  check(focused.recipe === 'focused-decisions', 'Explicit intent must compile the focused surface.');
  check(focused.decisions === 3, 'Focused surface must contain exactly three decisions.');
  check(focused.counterevidence, 'Counterevidence must remain visible.');
  check(focused.explanation, 'The preservation explanation must remain visible.');
  check(focused.intentInput.includes('leaving shortly'), 'The visible intent field must reflect the context that produced the surface.');
  await harness.client.screenshot('artifacts/proof/interface-on-demand-desktop.png', { fullPage: false });

  await harness.client.viewport(390, 844, 2, true);
  await harness.client.evaluate(`window.SignalUIDemo.setProfile('operator-mobile')`);
  await harness.client.evaluate(`new Promise(resolve => { window.scrollTo(0, 0); requestAnimationFrame(() => requestAnimationFrame(resolve)); })`);
  const mobile = await harness.client.evaluate(`({
    role: window.SignalUIDemo.getState().interfaceContext.role,
    device: window.SignalUIDemo.getState().interfaceContext.device,
    decisions: document.querySelectorAll('[data-decision-card]').length,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    persistedProfile: window.SignalUIDemo.getPersistedProfile(),
    toolbarBottom: Math.round(document.querySelector('.workspace-toolbar').getBoundingClientRect().bottom),
    headingTop: Math.round(document.querySelector('.focus-heading').getBoundingClientRect().top)
  })`);
  check(mobile.role === 'operator' && mobile.device === 'mobile', 'Mobile operator profile must be explicit.');
  check(mobile.decisions === 3, 'Mobile adaptation must retain three material decisions.');
  check(!mobile.overflow, 'Mobile surface must not overflow horizontally.');
  check(mobile.persistedProfile === 'operator-mobile', 'Explicit interface profile must persist for same-tab refresh continuity.');
  check(mobile.toolbarBottom <= mobile.headingTop + 1, 'Mobile controls must not cover the focused heading.');
  await harness.client.screenshot('artifacts/proof/interface-on-demand-mobile.png');

  const proposed = await harness.client.evaluate(`(async () => {
    const current = window.SignalUIDemo.getState().anomalies.find(item => item.id === 'A-104');
    return window.SignalUIDemo.executeTool('propose_correction', {
      anomalyId: 'A-104', correctedValue: 4829,
      reason: 'The meter photograph shows 004829 and recent history confirms an extra transcription digit.',
      expectedVersion: current.version
    });
  })()`);
  check(proposed.code === 'correction-proposed', 'Operator tool must create a reversible proposal.');
  const requested = await harness.client.evaluate(`(async () => {
    const current = window.SignalUIDemo.getState().anomalies.find(item => item.id === 'A-104');
    return window.SignalUIDemo.executeTool('request_human_approval', { anomalyId: 'A-104', expectedVersion: current.version });
  })()`);
  check(requested.code === 'approval-requested', 'Proposal must advance to an exact approval request.');
  const operatorDenied = await harness.client.evaluate(`(async () => {
    const current = window.SignalUIDemo.getState().anomalies.find(item => item.id === 'A-104');
    try {
      return await window.SignalUIDemo.executeTool('approve_correction', {
        anomalyId: current.id, approvalId: current.approval.id, expectedVersion: current.version, fingerprint: current.approval.fingerprint
      });
    } catch (error) { return { ok: false, code: 'not-exposed', message: String(error) }; }
  })()`);
  check(operatorDenied.ok === false && operatorDenied.code === 'role-denied', 'Operator approval must be denied through the shared command bus.');

  await harness.client.viewport(1440, 1000, 1, false);
  await harness.client.evaluate(`window.SignalUIDemo.setProfile('manager-desktop')`);
  const approved = await harness.client.evaluate(`(async () => {
    const current = window.SignalUIDemo.getState().anomalies.find(item => item.id === 'A-104');
    return window.SignalUIDemo.executeTool('approve_correction', {
      anomalyId: current.id, approvalId: current.approval.id, expectedVersion: current.version, fingerprint: current.approval.fingerprint
    });
  })()`);
  check(approved.code === 'correction-approved', 'Manager must approve the exact current fingerprint.');
  const corrected = await harness.client.evaluate(`window.SignalUIDemo.getState().anomalies.find(item => item.id === 'A-104')`);
  check(corrected.status === 'corrected' && corrected.reportedValue === 4829, 'Approved correction must update visible operational state.');

  await harness.client.evaluate(`window.SignalUIDemo.setProfile('auditor-desktop')`);
  await harness.client.evaluate(`new Promise(resolve => { window.scrollTo(0, 0); requestAnimationFrame(() => requestAnimationFrame(resolve)); })`);
  const audit = await harness.client.evaluate(`({
    recipe: window.SignalUIDemo.getPlan().recipe,
    role: window.SignalUIDemo.getState().interfaceContext.role,
    receiptCount: window.SignalUIDemo.getState().receipts.length,
    receiptCards: document.querySelectorAll('.receipt-card').length,
    deniedReceipts: window.SignalUIDemo.getState().receipts.filter(item => item.outcome === 'denied').length,
    text: document.querySelector('main')?.textContent,
    tools: window.SignalUIDemo.getTools()
  })`);
  check(audit.recipe === 'audit-trail' && audit.role === 'auditor', 'Auditor profile must compile a read-only audit surface.');
  check(audit.receiptCards === audit.receiptCount, 'Every receipt must be visible in the audit timeline.');
  check(audit.deniedReceipts === 1, 'The denied operator approval must remain visible in the audit trail.');
  check(audit.text.includes('approve_correction'), 'Audit surface must show the consequential approval receipt.');
  check(!audit.tools.some((id) => ['propose_correction','request_more_evidence','request_human_approval','approve_correction'].includes(id)), 'Auditor must receive no write tools.');
  await harness.client.screenshot('artifacts/proof/interface-on-demand-audit.png', { fullPage: false });

  const report = { generatedAt: new Date().toISOString(), passed: true, checks, finalReceiptCount: audit.receiptCount };
  await writeFile('artifacts/proof/browser-e2e.json', `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Browser E2E passed (${checks.length}/${checks.length}).`);
} catch (error) {
  await writeFile('artifacts/proof/browser-e2e.json', `${JSON.stringify({ generatedAt: new Date().toISOString(), passed: false, checks, error: String(error) }, null, 2)}\n`);
  throw error;
} finally {
  await harness.close();
}
