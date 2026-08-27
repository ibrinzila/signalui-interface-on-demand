import { icons } from './icons.js';
import type {
  Anomaly,
  ApprovalRequest,
  CommandResult,
  EvidenceItem,
  ReceiptEvent,
  SurfacePlan,
  WorkspaceState,
} from '../core/types.js';

export interface VisibleTool {
  readonly name: string;
  readonly title: string;
  readonly annotations: {
    readonly readOnlyHint: boolean;
    readonly untrustedContentHint: boolean;
  };
}

export interface UiModel {
  readonly state: WorkspaceState;
  readonly plan: SurfacePlan;
  readonly tools: readonly VisibleTool[];
  readonly webMcpMode: 'native' | 'fallback';
  readonly selectedAnomalyId: string | null;
  readonly lastResult: CommandResult | null;
  readonly intentConfidence: number | null;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

const formatNumber = (value: number): string => new Intl.NumberFormat('en-US').format(value);
const formatDate = (value: string): string => new Intl.DateTimeFormat('en-GB', {
  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
}).format(new Date(value));

function sentence(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).replaceAll('-', ' ');
}

function statusTone(status: Anomaly['status']): string {
  if (status === 'corrected') return 'success';
  if (status === 'awaiting-approval' || status === 'proposed') return 'accent';
  if (status === 'evidence-requested' || status === 'held') return 'neutral';
  return 'warning';
}

function severityLabel(anomaly: Anomaly): string {
  return `<span class="badge badge--${escapeHtml(anomaly.severity)}">${icons.warning}<span>${escapeHtml(sentence(anomaly.severity))}</span></span>`;
}

function statusLabel(anomaly: Anomaly): string {
  return `<span class="badge badge--${statusTone(anomaly.status)}"><span class="status-dot"></span><span>${escapeHtml(sentence(anomaly.status))}</span></span>`;
}

function metric(label: string, value: string, note: string, icon: string): string {
  return `<article class="metric-card">
    <span class="metric-card__icon">${icon}</span>
    <div><p>${escapeHtml(label)}</p><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></div>
  </article>`;
}

function renderEvidenceItem(item: EvidenceItem): string {
  const materiality = item.materiality === 'counterevidence' ? 'Counterevidence' : sentence(item.materiality);
  const media = item.assetPath
    ? `<img class="evidence-card__image" src="${escapeHtml(item.assetPath)}" alt="Synthetic illustration for ${escapeHtml(item.label)}">`
    : `<span class="evidence-card__placeholder">${item.kind === 'photo' ? icons.photo : icons.evidence}</span>`;
  return `<article class="evidence-card evidence-card--${escapeHtml(item.materiality)}">
    ${media}
    <div class="evidence-card__body">
      <div class="evidence-card__meta"><span class="eyebrow">${escapeHtml(materiality)}</span>${item.untrusted ? '<span class="untrusted">Untrusted source text</span>' : ''}</div>
      <h4>${escapeHtml(item.label)}</h4>
      <p>${escapeHtml(item.summary)}</p>
      <small>${escapeHtml(item.source)} · ${escapeHtml(formatDate(item.capturedAt))}</small>
    </div>
  </article>`;
}

function renderEvidence(anomaly: Anomaly): string {
  return `<div class="evidence-grid" aria-label="Evidence for ${escapeHtml(anomaly.id)}">
    ${anomaly.evidence.map(renderEvidenceItem).join('')}
  </div>`;
}

function renderHistory(anomaly: Anomaly): string {
  const maximum = Math.max(...anomaly.history.map((point) => point.value), anomaly.expectedMax);
  return `<div class="history-chart" role="img" aria-label="Recent reading history for ${escapeHtml(anomaly.institutionName)}">
    ${anomaly.history.map((point) => {
      const height = Math.max(8, Math.round((point.value / maximum) * 100));
      const abnormal = point.value < anomaly.expectedMin || point.value > anomaly.expectedMax;
      return `<div class="history-chart__point">
        <span class="history-chart__value">${escapeHtml(formatNumber(point.value))}</span>
        <svg class="history-chart__bar${abnormal ? ' history-chart__bar--abnormal' : ''}" viewBox="0 0 10 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <rect x="0" y="${100 - height}" width="10" height="${height}" rx="1"></rect>
        </svg>
        <span class="history-chart__period">${escapeHtml(point.period.slice(5))}</span>
      </div>`;
    }).join('')}
  </div>`;
}

function recommendation(anomaly: Anomaly): string {
  return `<div class="recommendation">
    <span class="recommendation__icon">${icons.spark}</span>
    <div><span class="eyebrow">Governed recommendation · ${escapeHtml(anomaly.confidence)} confidence</span><p>${escapeHtml(anomaly.recommendation)}</p></div>
  </div>`;
}

function actionButtons(anomaly: Anomaly, role: WorkspaceState['interfaceContext']['role']): string {
  if (role === 'auditor') return '<p class="read-only-notice">Read-only authority: mutation controls are suppressed.</p>';
  if (anomaly.status === 'open' && anomaly.id === 'A-104') {
    return `<button class="button button--primary" type="button" data-action="propose-correction" data-anomaly-id="${escapeHtml(anomaly.id)}">${icons.check}<span>Propose 4,829 kWh</span></button>
      <button class="button button--secondary" type="button" data-action="request-evidence" data-anomaly-id="${escapeHtml(anomaly.id)}">${icons.evidence}<span>Request evidence</span></button>`;
  }
  if (anomaly.status === 'proposed') {
    return `<button class="button button--primary" type="button" data-action="request-approval" data-anomaly-id="${escapeHtml(anomaly.id)}">${icons.lock}<span>Request manager approval</span></button>`;
  }
  if (anomaly.status === 'awaiting-approval') {
    return role === 'manager'
      ? `<button class="button button--primary" type="button" data-action="open-approval" data-anomaly-id="${escapeHtml(anomaly.id)}">${icons.shield}<span>Review exact approval</span></button>`
      : '<p class="awaiting-note">Manager approval is required. The proposal cannot be applied by this role.</p>';
  }
  if (anomaly.status === 'corrected') {
    return '<p class="completed-note">This case is complete and its receipt is available in the audit surface.</p>';
  }
  return `<button class="button button--primary" type="button" data-action="request-evidence" data-anomaly-id="${escapeHtml(anomaly.id)}">${icons.evidence}<span>Request specific evidence</span></button>
    <button class="button button--secondary" type="button" data-action="inspect-anomaly" data-anomaly-id="${escapeHtml(anomaly.id)}">${icons.eye}<span>Inspect details</span></button>`;
}

function decisionCard(anomaly: Anomaly, role: WorkspaceState['interfaceContext']['role'], index: number, total: number): string {
  return `<article class="decision-card" data-decision-card="${escapeHtml(anomaly.id)}" id="decision-${escapeHtml(anomaly.id)}">
    <header class="decision-card__header">
      <div><span class="eyebrow">Decision ${index + 1} of ${total} · ${escapeHtml(anomaly.id)}</span><h2>${escapeHtml(anomaly.institutionName)}</h2><p>${escapeHtml(anomaly.meterLabel)}</p></div>
      <div class="badge-row">${severityLabel(anomaly)}${statusLabel(anomaly)}</div>
    </header>
    <div class="reading-comparison">
      <div><span>Reported</span><strong>${escapeHtml(formatNumber(anomaly.reportedValue))} ${anomaly.unit}</strong></div>
      <span class="reading-comparison__arrow">${icons.arrow}</span>
      <div><span>Expected range</span><strong>${escapeHtml(formatNumber(anomaly.expectedMin))}–${escapeHtml(formatNumber(anomaly.expectedMax))} ${anomaly.unit}</strong></div>
    </div>
    <p class="decision-card__summary">${escapeHtml(anomaly.summary)}</p>
    ${renderHistory(anomaly)}
    ${renderEvidence(anomaly)}
    ${recommendation(anomaly)}
    <div class="decision-card__actions">${actionButtons(anomaly, role)}</div>
  </article>`;
}

function renderExplanation(plan: SurfacePlan): string {
  const list = (items: readonly string[]) => items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  return `<aside class="explanation-panel" id="adaptation-explanation" data-panel="explanation" aria-labelledby="explanation-title" hidden>
    <div class="panel-header"><div><span class="eyebrow">Inspect the adaptation</span><h2 id="explanation-title">Why am I seeing this?</h2></div><button class="icon-button" type="button" data-action="close-explanation" aria-label="Close interface explanation">${icons.close}</button></div>
    <p class="explanation-goal">${escapeHtml(plan.explanation.goal)}</p>
    <section><h3>Explicit inputs</h3><ul>${list(plan.explanation.explicitInputs)}</ul></section>
    <section><h3>What changed</h3><ul>${list(plan.explanation.changed)}</ul></section>
    <section><h3>What was preserved</h3><ul>${list(plan.explanation.preserved)}</ul></section>
    <section><h3>What was not inferred</h3><ul>${list(plan.explanation.notInferred)}</ul></section>
    <p class="hash-line">Surface state hash <code>${escapeHtml(plan.stateHash)}</code></p>
  </aside>`;
}

function renderToolbar(model: UiModel): string {
  const profile = model.state.interfaceContext;
  return `<section class="workspace-toolbar" aria-label="Interface controls">
    <div class="workspace-toolbar__context">
      <span class="context-pill">${icons.user}<span>Demo identity: ${escapeHtml(profile.role)}</span></span>
      <span class="context-pill">${profile.device === 'mobile' ? icons.focus : icons.grid}<span>${escapeHtml(profile.device)}</span></span>
      <span class="context-pill context-pill--status"><span class="status-dot"></span><span>WebMCP ${escapeHtml(model.webMcpMode)}</span></span>
    </div>
    <div class="workspace-toolbar__actions">
      <button class="button button--ghost" type="button" data-action="show-explanation" aria-label="Why am I seeing this?">${icons.info}<span>Why am I seeing this?</span></button>
      <button class="button button--ghost" type="button" data-action="show-full-workspace" aria-label="Show full workspace">${icons.grid}<span>Show full workspace</span></button>
      <button class="button button--ghost" type="button" data-action="reset-workspace" aria-label="Reset demonstration">${icons.rotate}<span>Reset</span></button>
    </div>
  </section>`;
}

function renderResult(result: CommandResult | null): string {
  if (!result) return '<div class="live-result" role="status" aria-live="polite"><span>Ready. Human controls and agent tools share the same command bus.</span></div>';
  return `<div class="live-result live-result--${result.ok ? 'success' : 'denied'}" role="status" aria-live="polite">
    <span>${result.ok ? icons.check : icons.warning}</span>
    <div><strong>${escapeHtml(result.code)}</strong><p>${escapeHtml(result.message)}</p><small>Receipt ${escapeHtml(result.receipt.id)} · ${escapeHtml(result.receipt.receiptHash.slice(0, 12))}…</small></div>
  </div>`;
}

function renderFullWorkspace(model: UiModel): string {
  const state = model.state;
  const actionable = state.anomalies.filter((item) => item.requiresHumanDecision && item.status !== 'corrected' && item.status !== 'held');
  const completed = state.anomalies.filter((item) => item.status === 'corrected').length;
  return `<main id="workspace" class="workspace workspace--full" data-signalui-recipe="full-workspace" tabindex="-1">
    ${renderToolbar(model)}
    <header class="workspace-heading">
      <div><span class="eyebrow">Portfolio operations · 27 August 2026</span><h1>Energy reading control room</h1><p>One governed workspace for anomaly review, evidence, approvals and audit continuity.</p></div>
      <button class="button button--primary" type="button" data-action="adapt-interface">${icons.wand}<span>Adapt to my task</span></button>
    </header>
    ${renderResult(model.lastResult)}
    <section class="metric-grid" aria-labelledby="portfolio-summary-title">
      <h2 class="sr-only" id="portfolio-summary-title">Portfolio summary</h2>
      ${metric('Total queue', `${state.anomalies.length} readings`, 'Across the synthetic portfolio', icons.grid)}
      ${metric('Human judgement', `${actionable.length} need human judgement`, 'Material decisions only', icons.focus)}
      ${metric('Completed', `${completed} reconciled`, 'Receipts retained', icons.check)}
      ${metric('Governed tools', `${model.tools.length} available`, `${model.webMcpMode} exposure`, icons.shield)}
    </section>
    <div class="workspace-layout">
      <section class="queue-panel" aria-labelledby="queue-title">
        <div class="section-heading"><div><span class="eyebrow">Current operational state</span><h2 id="queue-title">Anomaly queue</h2></div><span>${state.anomalies.length} readings</span></div>
        <div class="queue-table" role="table" aria-label="Meter-reading anomaly queue">
          <div class="queue-row queue-row--header" role="row"><span role="columnheader">Institution</span><span role="columnheader">Reading</span><span role="columnheader">State</span><span role="columnheader">Action</span></div>
          ${state.anomalies.map((anomaly) => `<div class="queue-row" role="row" data-anomaly-row="${escapeHtml(anomaly.id)}">
            <div role="cell"><strong>${escapeHtml(anomaly.institutionName)}</strong><small>${escapeHtml(anomaly.id)} · v${anomaly.version}</small><p class="queue-row__summary">${escapeHtml(anomaly.summary)}</p></div>
            <div role="cell"><strong>${escapeHtml(formatNumber(anomaly.correctedValue ?? anomaly.reportedValue))} ${anomaly.unit}</strong><small>Expected ${escapeHtml(formatNumber(anomaly.expectedMin))}–${escapeHtml(formatNumber(anomaly.expectedMax))}</small></div>
            <div role="cell">${statusLabel(anomaly)}</div>
            <div role="cell"><button class="icon-button" type="button" data-action="inspect-anomaly" data-anomaly-id="${escapeHtml(anomaly.id)}" aria-label="Inspect ${escapeHtml(anomaly.institutionName)}">${icons.arrow}</button></div>
          </div>`).join('')}
        </div>
      </section>
      <aside class="system-panel" aria-labelledby="system-panel-title">
        <span class="eyebrow">Capability-first runtime</span><h2 id="system-panel-title">What the application knows</h2>
        <div class="system-stack">
          <div><span>${icons.shield}</span><p><strong>Authority remains fixed</strong>Interface composition never grants a command.</p></div>
          <div><span>${icons.evidence}</span><p><strong>Evidence remains material</strong>Counterevidence cannot be hidden by simplification.</p></div>
          <div><span>${icons.terminal}</span><p><strong>One semantic command bus</strong>Human clicks and WebMCP calls create the same receipts.</p></div>
        </div>
        <button class="button button--secondary button--block" type="button" data-action="open-tool-console">${icons.terminal}<span>Inspect exposed tools</span></button>
      </aside>
    </div>
    ${renderExplanation(model.plan)}
  </main>`;
}

function renderFocused(model: UiModel): string {
  const primary = model.plan.primaryAnomalyIds
    .map((id) => model.state.anomalies.find((item) => item.id === id))
    .filter((item): item is Anomaly => item !== undefined);
  return `<main id="workspace" class="workspace workspace--focused" data-signalui-recipe="focused-decisions" tabindex="-1">
    ${renderToolbar(model)}
    <header class="focus-heading">
      <div><span class="eyebrow">Interface on Demand · governed focus</span><h1>${primary.length} readings need your attention</h1><p>Four other cases were removed from the primary surface because they require no decision from this role now.</p></div>
      <div class="focus-progress" aria-label="Decision progress"><strong>0 / ${primary.length}</strong><span>decisions completed in this session</span></div>
    </header>
    ${renderResult(model.lastResult)}
    <section class="preservation-banner" aria-label="Preserved information">
      ${icons.shield}<div><strong>Nothing material was removed.</strong><p>All material evidence and counterevidence, authority gates, exact previews and reversal controls remain available.</p></div>
    </section>
    <section class="decision-stack" aria-label="Decisions requiring human judgement">
      ${primary.map((anomaly, index) => decisionCard(anomaly, model.state.interfaceContext.role, index, primary.length)).join('')}
    </section>
    ${renderExplanation(model.plan)}
  </main>`;
}

function renderReceipt(receipt: ReceiptEvent): string {
  return `<article class="receipt-card">
    <div class="receipt-card__rail"><span>${receipt.outcome === 'denied' ? icons.warning : icons.check}</span></div>
    <div class="receipt-card__body">
      <div class="receipt-card__heading"><div><span class="eyebrow">${escapeHtml(formatDate(receipt.timestamp))} · ${escapeHtml(receipt.id)}</span><h3>${escapeHtml(receipt.capabilityId)}</h3></div><span class="badge badge--${receipt.outcome === 'denied' ? 'warning' : 'success'}">${escapeHtml(receipt.outcome)}</span></div>
      <p>${escapeHtml(receipt.summary)}</p>
      <dl class="receipt-details">
        <div><dt>Actor</dt><dd>${escapeHtml(receipt.actorId)} · ${escapeHtml(receipt.actorRole)} · ${escapeHtml(receipt.source)}</dd></div>
        <div><dt>Command</dt><dd><code>${escapeHtml(receipt.commandId)}</code></dd></div>
        <div><dt>Prior state</dt><dd><code>${escapeHtml(receipt.priorStateHash)}</code></dd></div>
        <div><dt>Current state</dt><dd><code>${escapeHtml(receipt.currentStateHash)}</code></dd></div>
        <div><dt>Receipt chain</dt><dd><code>${escapeHtml(receipt.previousReceiptHash)} → ${escapeHtml(receipt.receiptHash)}</code></dd></div>
      </dl>
    </div>
  </article>`;
}

function renderAudit(model: UiModel): string {
  const receipts = [...model.state.receipts].reverse();
  return `<main id="workspace" class="workspace workspace--audit" data-signalui-recipe="audit-trail" tabindex="-1">
    ${renderToolbar(model)}
    <header class="workspace-heading">
      <div><span class="eyebrow">Provenance and consequence review</span><h1>Decision audit trail</h1><p>Every human and agent operation is bound to identity, authority, input and before/after state.</p></div>
      <span class="read-only-banner">${icons.lock}<span>Read-only audit surface</span></span>
    </header>
    ${renderResult(model.lastResult)}
    <section class="audit-summary" aria-label="Audit summary">
      ${metric('Receipts', String(receipts.length), 'Hash-linked events', icons.audit)}
      ${metric('Denied actions', String(receipts.filter((item) => item.outcome === 'denied').length), 'Visible, not discarded', icons.warning)}
      ${metric('Human actions', String(receipts.filter((item) => item.source === 'human').length), 'Same command path', icons.user)}
      ${metric('Agent actions', String(receipts.filter((item) => item.source !== 'human').length), 'WebMCP or fallback', icons.terminal)}
    </section>
    <section class="audit-layout" aria-labelledby="receipt-timeline-title">
      <div class="section-heading"><div><span class="eyebrow">Append-only semantic history</span><h2 id="receipt-timeline-title">Receipt timeline</h2></div><span>${receipts.length} events</span></div>
      ${receipts.length > 0 ? `<div class="receipt-list">${receipts.map(renderReceipt).join('')}</div>` : `<div class="empty-state">${icons.audit}<h3>No commands executed yet</h3><p>Complete a decision in the focused surface, then return here to inspect its lineage.</p></div>`}
    </section>
    ${renderExplanation(model.plan)}
  </main>`;
}

export function renderApprovalDialog(anomaly: Anomaly): string {
  const approval: ApprovalRequest | undefined = anomaly.approval;
  const proposal = anomaly.proposal;
  if (!approval || !proposal) return '';
  return `<form class="approval-dialog" id="approval-dialog" method="dialog" aria-labelledby="approval-title">
      <div class="panel-header"><div><span class="eyebrow">Consequential action · manager only</span><h2 id="approval-title">Exact approval preview</h2></div><button class="icon-button" type="button" data-action="close-approval" aria-label="Close approval preview">${icons.close}</button></div>
      <div class="approval-change">
        <div><span>Current recorded value</span><strong>${escapeHtml(formatNumber(anomaly.reportedValue))} ${anomaly.unit}</strong></div>
        <span>${icons.arrow}</span>
        <div><span>Proposed corrected value</span><strong>${escapeHtml(formatNumber(proposal.proposedValue))} ${anomaly.unit}</strong></div>
      </div>
      <section class="approval-consequence"><h3>Consequence</h3><p>Replace the recorded reading for ${escapeHtml(anomaly.institutionName)} with the proposed value and mark this anomaly corrected.</p></section>
      <dl class="approval-facts">
        <div><dt>Approval request</dt><dd>${escapeHtml(approval.id)}</dd></div>
        <div><dt>State binding</dt><dd>Version ${anomaly.version}</dd></div>
        <div><dt>Reason</dt><dd>${escapeHtml(proposal.reason)}</dd></div>
        <div><dt>Evidence digest</dt><dd><code>${escapeHtml(approval.evidenceDigest)}</code></dd></div>
        <div><dt>Approval fingerprint</dt><dd><code>${escapeHtml(approval.fingerprint)}</code></dd></div>
      </dl>
      <label class="confirmation-check"><input type="checkbox" id="approval-confirmation"><span>I confirm this exact value, version, evidence digest and consequence.</span></label>
      <div class="dialog-actions"><button class="button button--secondary" type="button" data-action="close-approval">Cancel</button><button class="button button--primary" type="button" data-action="confirm-approval" data-anomaly-id="${escapeHtml(anomaly.id)}" disabled>${icons.shield}<span>Approve correction</span></button></div>
  </form>`;
}

export function renderToolConsole(model: UiModel): string {
  return `<aside class="tool-console" id="tool-console" aria-labelledby="tool-console-title" hidden>
    <div class="panel-header"><div><span class="eyebrow">Semantic capability surface</span><h2 id="tool-console-title">Exposed WebMCP tools</h2></div><button class="icon-button" type="button" data-action="close-tool-console" aria-label="Close tool console">${icons.close}</button></div>
    <p>${model.webMcpMode === 'native' ? 'The browser exposes these tools through document.modelContext.' : 'This browser does not expose native WebMCP, so the same tools are available through the deterministic fallback console.'}</p>
    <div class="tool-list">${model.tools.map((tool) => `<article class="tool-item"><span>${tool.annotations.readOnlyHint ? icons.eye : icons.terminal}</span><div><strong>${escapeHtml(tool.name)}</strong><p>${escapeHtml(tool.title)}</p></div><span class="badge badge--${tool.annotations.readOnlyHint ? 'neutral' : 'accent'}">${tool.annotations.readOnlyHint ? 'read-only' : 'stateful'}</span></article>`).join('')}</div>
  </aside>`;
}

export function renderWorkspace(model: UiModel): string {
  if (model.plan.recipe === 'focused-decisions') return renderFocused(model);
  if (model.plan.recipe === 'audit-trail') return renderAudit(model);
  return renderFullWorkspace(model);
}

export type WorkspaceViewModel = UiModel;

export function renderProposalDialog(anomaly: Anomaly): string {
  const suggestedValue = anomaly.id === 'A-104' ? 4829 : Math.round((anomaly.expectedMin + anomaly.expectedMax) / 2);
  return `<form class="modal-form" aria-labelledby="proposal-title">
    <div class="panel-header"><div><span class="eyebrow">Reversible proposal · no value is changed</span><h2 id="proposal-title">Propose a correction</h2></div><button class="icon-button" type="button" data-action="close-dialog" aria-label="Close correction proposal">${icons.close}</button></div>
    <p>Prepare an evidence-grounded proposal for <strong>${escapeHtml(anomaly.institutionName)}</strong>. A manager must approve it before the recorded reading changes.</p>
    <label><span>Corrected value (${anomaly.unit})</span><input id="proposal-value" name="correctedValue" type="number" min="0" step="1" value="${suggestedValue}" required></label>
    <label><span>Evidence-grounded reason</span><textarea id="proposal-reason" name="reason" minlength="20" maxlength="600" rows="5" required>The meter photograph shows 004829 and the recent history is within the expected range, indicating one extra digit was entered during transcription.</textarea></label>
    <input type="hidden" id="proposal-version" value="${anomaly.version}">
    <div class="dialog-actions"><button class="button button--secondary" type="button" data-action="close-dialog">Cancel</button><button class="button button--primary" type="button" data-action="submit-proposal" data-anomaly-id="${escapeHtml(anomaly.id)}">${icons.check}<span>Create proposal</span></button></div>
  </form>`;
}

export function renderEvidenceRequestDialog(anomaly: Anomaly): string {
  const defaultRequest = anomaly.id === 'A-305'
    ? 'Upload a clear meter photograph and confirm whether an outage, closure or meter replacement occurred.'
    : 'Confirm the installed meter serial number and attach the signed meter replacement record.';
  return `<form class="modal-form" aria-labelledby="evidence-request-title">
    <div class="panel-header"><div><span class="eyebrow">Reversible workflow action</span><h2 id="evidence-request-title">Request more evidence</h2></div><button class="icon-button" type="button" data-action="close-dialog" aria-label="Close evidence request">${icons.close}</button></div>
    <p>The current evidence for <strong>${escapeHtml(anomaly.institutionName)}</strong> is insufficient for a reliable correction.</p>
    <label><span>Specific evidence required</span><textarea id="evidence-request-text" name="request" minlength="12" maxlength="600" rows="5" required>${escapeHtml(defaultRequest)}</textarea></label>
    <input type="hidden" id="evidence-request-version" value="${anomaly.version}">
    <div class="dialog-actions"><button class="button button--secondary" type="button" data-action="close-dialog">Cancel</button><button class="button button--primary" type="button" data-action="submit-evidence-request" data-anomaly-id="${escapeHtml(anomaly.id)}">${icons.evidence}<span>Record request</span></button></div>
  </form>`;
}
