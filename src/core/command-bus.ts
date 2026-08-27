import { compileSurface } from './compiler.js';
import { findAnomaly, replaceAnomaly, validateCommandInput } from './commands.js';
import { admitCapability } from './policy.js';
import {
  approvalStateHash,
  createApprovalFingerprint,
  createReceipt,
  evidenceDigest,
  operationalStateHash,
} from './receipts.js';
import { capabilityById } from './schema.js';
import type { WorkspaceStore } from './store.js';
import type {
  Actor,
  Anomaly,
  CapabilityContractDocument,
  CommandEnvelope,
  CommandOutcome,
  CommandResult,
  InterfaceContext,
  ReceiptEvent,
  WorkspaceState,
} from './types.js';

export interface CommandBusOptions {
  readonly store: WorkspaceStore;
  readonly contracts: CapabilityContractDocument;
  readonly clock?: () => string;
  readonly idFactory?: (prefix: string) => string;
}

interface Completion<T = unknown> {
  readonly ok: boolean;
  readonly outcome: CommandOutcome;
  readonly code: string;
  readonly message: string;
  readonly next: WorkspaceState;
  readonly data?: T;
  readonly anomalyId?: string | undefined;
}

function inputString(input: Readonly<Record<string, unknown>>, name: string): string {
  return input[name] as string;
}

function inputNumber(input: Readonly<Record<string, unknown>>, name: string): number {
  return input[name] as number;
}

function boundedEvidence(anomaly: Anomaly): readonly Record<string, unknown>[] {
  return anomaly.evidence.map((item) => ({
    id: item.id,
    kind: item.kind,
    label: item.label,
    summary: item.summary,
    source: item.source,
    capturedAt: item.capturedAt,
    materiality: item.materiality,
    untrusted: item.untrusted,
  }));
}

function approvalPreview(anomaly: Anomaly): Record<string, unknown> {
  if (!anomaly.proposal) throw new Error('Approval preview requires a proposal.');
  return {
    anomalyId: anomaly.id,
    institutionName: anomaly.institutionName,
    meterLabel: anomaly.meterLabel,
    reportedValue: anomaly.reportedValue,
    proposedValue: anomaly.proposal.proposedValue,
    reason: anomaly.proposal.reason,
    expectedVersion: anomaly.version,
    evidenceIds: anomaly.evidence.map((item) => item.id),
    consequence: 'Replace the recorded reading, mark the anomaly corrected, and preserve the approval receipt.',
  };
}

function anomalyIdFrom(command: CommandEnvelope): string | undefined {
  return typeof command.input.anomalyId === 'string' ? command.input.anomalyId : undefined;
}

export class CommandBus {
  readonly #store: WorkspaceStore;
  readonly #contracts: CapabilityContractDocument;
  readonly #clock: () => string;
  readonly #idFactory: (prefix: string) => string;
  readonly #seenCommandIds: Set<string>;

  constructor(options: CommandBusOptions) {
    this.#store = options.store;
    this.#contracts = options.contracts;
    this.#clock = options.clock ?? (() => new Date().toISOString());
    this.#idFactory = options.idFactory ?? ((prefix) => `${prefix}-${globalThis.crypto.randomUUID()}`);
    this.#seenCommandIds = new Set(options.store.getState().receipts.map((receipt) => receipt.commandId));
  }

  async execute<T = unknown>(command: CommandEnvelope, actor: Actor): Promise<CommandResult<T>> {
    const before = this.#store.getState();
    if (this.#seenCommandIds.has(command.id)) {
      return this.#finish<T>(command, actor, before, {
        ok: false,
        outcome: 'denied',
        code: 'duplicate-command',
        message: 'This command ID was already processed; no operation was repeated.',
        next: before,
        ...(anomalyIdFrom(command) ? { anomalyId: anomalyIdFrom(command) } : {}),
      });
    }

    const capability = capabilityById(this.#contracts, command.capabilityId);
    if (!capability) {
      return this.#finish<T>(command, actor, before, {
        ok: false, outcome: 'denied', code: 'unknown-capability',
        message: `Unknown capability: ${command.capabilityId}.`, next: before,
      });
    }

    const actorContext: InterfaceContext = { ...before.interfaceContext, role: actor.role };
    const admission = admitCapability(capability, actorContext, before);
    if (!admission.allowed) {
      return this.#finish<T>(command, actor, before, {
        ok: false, outcome: 'denied', code: admission.code, message: admission.message, next: before,
        ...(anomalyIdFrom(command) ? { anomalyId: anomalyIdFrom(command) } : {}),
      });
    }

    const inputErrors = validateCommandInput(capability.inputSchema, command.input);
    if (inputErrors.length > 0) {
      return this.#finish<T>(command, actor, before, {
        ok: false, outcome: 'denied', code: 'invalid-input',
        message: inputErrors.map((item) => `${item.path}: ${item.message}`).join(' '),
        next: before,
        data: { diagnostics: inputErrors } as T,
        ...(anomalyIdFrom(command) ? { anomalyId: anomalyIdFrom(command) } : {}),
      });
    }

    const completion = await this.#dispatch(command, actor, before);
    return this.#finish<T>(command, actor, before, completion as Completion<T>);
  }

  async #dispatch(command: CommandEnvelope, actor: Actor, state: WorkspaceState): Promise<Completion> {
    switch (command.capabilityId) {
      case 'set_interface_context':
        return this.#setInterfaceContext(command, actor, state);
      case 'list_actionable_anomalies':
        return this.#listActionable(command, state);
      case 'inspect_anomaly':
        return this.#inspect(command, state);
      case 'compare_reading_history':
        return this.#compare(command, state);
      case 'propose_correction':
        return this.#propose(command, actor, state);
      case 'request_more_evidence':
        return this.#requestEvidence(command, state);
      case 'request_human_approval':
        return this.#requestApproval(command, actor, state);
      case 'approve_correction':
        return this.#approve(command, state);
      default:
        return { ok: false, outcome: 'denied', code: 'unknown-capability', message: 'No command handler exists.', next: state };
    }
  }

  #setInterfaceContext(command: CommandEnvelope, actor: Actor, state: WorkspaceState): Completion {
    const requestedRole = inputString(command.input, 'role') as InterfaceContext['role'];
    if (requestedRole !== actor.role) {
      return {
        ok: false,
        outcome: 'denied',
        code: 'context-role-mismatch',
        message: `Interface context cannot change authenticated role ${actor.role} to ${requestedRole}.`,
        next: state,
      };
    }
    const accessibility = {
      largeTargets: typeof command.input.largeTargets === 'boolean' ? command.input.largeTargets : state.interfaceContext.accessibility.largeTargets,
      reducedMotion: typeof command.input.reducedMotion === 'boolean' ? command.input.reducedMotion : state.interfaceContext.accessibility.reducedMotion,
      highContrast: typeof command.input.highContrast === 'boolean' ? command.input.highContrast : state.interfaceContext.accessibility.highContrast,
      verboseLabels: typeof command.input.verboseLabels === 'boolean' ? command.input.verboseLabels : state.interfaceContext.accessibility.verboseLabels,
    };
    const context: InterfaceContext = {
      ...state.interfaceContext,
      role: requestedRole,
      intent: inputString(command.input, 'intent') as InterfaceContext['intent'],
      device: inputString(command.input, 'device') as InterfaceContext['device'],
      decisionBudget: inputNumber(command.input, 'decisionBudget'),
      accessibility,
      explicitUserStatement: typeof command.input.explicitUserStatement === 'string'
        ? command.input.explicitUserStatement.trim()
        : `Explicit interface context: ${inputString(command.input, 'intent')}.`,
    };
    const plan = compileSurface(context, state);
    return {
      ok: true, outcome: 'applied', code: 'context-updated', message: 'The interface context was updated explicitly.',
      next: { ...state, interfaceContext: context, lastSurfaceId: plan.recipe },
      data: { context, surfacePlan: plan },
    };
  }

  #listActionable(command: CommandEnvelope, state: WorkspaceState): Completion {
    const limit = typeof command.input.limit === 'number' ? command.input.limit : 10;
    const anomalies = state.anomalies
      .filter((item) => item.requiresHumanDecision && item.status !== 'corrected' && item.status !== 'held')
      .slice(0, limit)
      .map((item) => ({
        id: item.id, institutionName: item.institutionName, meterLabel: item.meterLabel,
        reportedValue: item.reportedValue, expectedRange: [item.expectedMin, item.expectedMax],
        unit: item.unit, severity: item.severity, status: item.status, summary: item.summary,
        confidence: item.confidence, version: item.version,
      }));
    return { ok: true, outcome: 'read', code: 'actionable-listed', message: `Returned ${anomalies.length} actionable anomalies.`, next: state, data: { anomalies } };
  }

  #inspect(command: CommandEnvelope, state: WorkspaceState): Completion {
    const anomaly = findAnomaly(state, command.input.anomalyId);
    if (!anomaly) return this.#missing(state, command);
    return {
      ok: true, outcome: 'read', code: 'anomaly-inspected', message: `Inspected ${anomaly.id}.`, next: state,
      anomalyId: anomaly.id,
      data: {
        id: anomaly.id, institutionName: anomaly.institutionName, meterLabel: anomaly.meterLabel,
        reportedValue: anomaly.reportedValue, expectedMin: anomaly.expectedMin, expectedMax: anomaly.expectedMax,
        unit: anomaly.unit, status: anomaly.status, version: anomaly.version, severity: anomaly.severity,
        summary: anomaly.summary, recommendation: anomaly.recommendation, confidence: anomaly.confidence,
        evidence: boundedEvidence(anomaly), proposal: anomaly.proposal ?? null, approval: anomaly.approval ?? null,
      },
    };
  }

  #compare(command: CommandEnvelope, state: WorkspaceState): Completion {
    const anomaly = findAnomaly(state, command.input.anomalyId);
    if (!anomaly) return this.#missing(state, command);
    const historical = anomaly.history.slice(0, -1);
    const average = historical.length > 0
      ? Math.round(historical.reduce((total, point) => total + point.value, 0) / historical.length)
      : null;
    return {
      ok: true, outcome: 'read', code: 'history-compared', message: `Compared ${anomaly.id} with recent history.`, next: state,
      anomalyId: anomaly.id,
      data: {
        anomalyId: anomaly.id, reportedValue: anomaly.reportedValue,
        expectedRange: { minimum: anomaly.expectedMin, maximum: anomaly.expectedMax },
        historicalAverage: average, history: anomaly.history,
        deviationFromAverage: average === null ? null : anomaly.reportedValue - average,
      },
    };
  }

  #propose(command: CommandEnvelope, actor: Actor, state: WorkspaceState): Completion {
    const anomaly = findAnomaly(state, command.input.anomalyId);
    if (!anomaly) return this.#missing(state, command);
    const precondition = this.#requireVersionAndStatus(state, command, anomaly, ['open']);
    if (precondition) return precondition;
    const nextAnomaly: Anomaly = {
      ...anomaly,
      status: 'proposed',
      version: anomaly.version + 1,
      proposal: {
        proposedValue: inputNumber(command.input, 'correctedValue'),
        reason: inputString(command.input, 'reason').trim(),
        proposedBy: actor.id,
        proposedAt: this.#clock(),
        baseVersion: anomaly.version,
      },
    };
    return {
      ok: true, outcome: 'applied', code: 'correction-proposed', message: `A non-final correction was proposed for ${anomaly.id}.`,
      next: replaceAnomaly(state, nextAnomaly), anomalyId: anomaly.id,
      data: { anomalyId: anomaly.id, proposal: nextAnomaly.proposal, version: nextAnomaly.version },
    };
  }

  #requestEvidence(command: CommandEnvelope, state: WorkspaceState): Completion {
    const anomaly = findAnomaly(state, command.input.anomalyId);
    if (!anomaly) return this.#missing(state, command);
    const precondition = this.#requireVersionAndStatus(state, command, anomaly, ['open', 'proposed', 'evidence-requested']);
    if (precondition) return precondition;
    const nextAnomaly: Anomaly = {
      ...anomaly,
      status: 'evidence-requested',
      version: anomaly.version + 1,
      evidenceRequest: inputString(command.input, 'request').trim(),
    };
    return {
      ok: true, outcome: 'applied', code: 'evidence-requested', message: `Additional evidence was requested for ${anomaly.id}.`,
      next: replaceAnomaly(state, nextAnomaly), anomalyId: anomaly.id,
      data: { anomalyId: anomaly.id, request: nextAnomaly.evidenceRequest, version: nextAnomaly.version },
    };
  }

  async #requestApproval(command: CommandEnvelope, actor: Actor, state: WorkspaceState): Promise<Completion> {
    const anomaly = findAnomaly(state, command.input.anomalyId);
    if (!anomaly) return this.#missing(state, command);
    const precondition = this.#requireVersionAndStatus(state, command, anomaly, ['proposed']);
    if (precondition) return precondition;
    if (!anomaly.proposal) return { ok: false, outcome: 'denied', code: 'proposal-missing', message: 'No correction proposal exists.', next: state, anomalyId: anomaly.id };

    const prepared: Anomaly = { ...anomaly, status: 'awaiting-approval', version: anomaly.version + 1 };
    const digest = await evidenceDigest(prepared);
    const stateHash = approvalStateHash(prepared);
    const fingerprint = await createApprovalFingerprint({
      anomalyId: prepared.id,
      expectedVersion: prepared.version,
      proposedValue: anomaly.proposal.proposedValue,
      reason: anomaly.proposal.reason,
      evidenceDigest: digest,
      stateHash,
    });
    const approval = {
      id: this.#idFactory('APR'),
      anomalyId: prepared.id,
      expectedVersion: prepared.version,
      proposedValue: anomaly.proposal.proposedValue,
      reason: anomaly.proposal.reason,
      evidenceDigest: digest,
      stateHash,
      fingerprint,
      requestedBy: actor.id,
      requestedAt: this.#clock(),
      status: 'pending' as const,
    };
    const nextAnomaly: Anomaly = { ...prepared, approval };
    return {
      ok: true, outcome: 'applied', code: 'approval-requested', message: `Exact manager approval was requested for ${anomaly.id}.`,
      next: replaceAnomaly(state, nextAnomaly), anomalyId: anomaly.id,
      data: { approval, preview: approvalPreview(nextAnomaly) },
    };
  }

  async #approve(command: CommandEnvelope, state: WorkspaceState): Promise<Completion> {
    const anomaly = findAnomaly(state, command.input.anomalyId);
    if (!anomaly) return this.#missing(state, command);
    const precondition = this.#requireVersionAndStatus(state, command, anomaly, ['awaiting-approval']);
    if (precondition) return precondition;
    if (!anomaly.proposal || !anomaly.approval || anomaly.approval.status !== 'pending') {
      return { ok: false, outcome: 'denied', code: 'approval-unavailable', message: 'No pending approval is available.', next: state, anomalyId: anomaly.id };
    }
    if (inputString(command.input, 'approvalId') !== anomaly.approval.id) {
      return { ok: false, outcome: 'denied', code: 'approval-id-mismatch', message: 'The approval request ID is not current.', next: state, anomalyId: anomaly.id };
    }
    const digest = await evidenceDigest(anomaly);
    const stateHash = approvalStateHash(anomaly);
    const fingerprint = await createApprovalFingerprint({
      anomalyId: anomaly.id,
      expectedVersion: anomaly.version,
      proposedValue: anomaly.proposal.proposedValue,
      reason: anomaly.proposal.reason,
      evidenceDigest: digest,
      stateHash,
    });
    if (
      inputString(command.input, 'fingerprint') !== anomaly.approval.fingerprint
      || fingerprint !== anomaly.approval.fingerprint
      || digest !== anomaly.approval.evidenceDigest
      || stateHash !== anomaly.approval.stateHash
    ) {
      return { ok: false, outcome: 'denied', code: 'approval-fingerprint-mismatch', message: 'The approval binding is stale or has been altered.', next: state, anomalyId: anomaly.id };
    }
    const nextAnomaly: Anomaly = {
      ...anomaly,
      reportedValue: anomaly.proposal.proposedValue,
      correctedValue: anomaly.proposal.proposedValue,
      status: 'corrected',
      version: anomaly.version + 1,
      approval: { ...anomaly.approval, status: 'used' },
    };
    return {
      ok: true, outcome: 'applied', code: 'correction-approved', message: `The correction for ${anomaly.id} was approved and applied.`,
      next: replaceAnomaly(state, nextAnomaly), anomalyId: anomaly.id,
      data: { anomalyId: anomaly.id, correctedValue: nextAnomaly.correctedValue, version: nextAnomaly.version },
    };
  }

  #missing(state: WorkspaceState, command: CommandEnvelope): Completion {
    return {
      ok: false, outcome: 'denied', code: 'anomaly-not-found',
      message: `Anomaly ${String(command.input.anomalyId)} does not exist.`, next: state,
      ...(anomalyIdFrom(command) ? { anomalyId: anomalyIdFrom(command) } : {}),
    };
  }

  #requireVersionAndStatus(
    state: WorkspaceState,
    command: CommandEnvelope,
    anomaly: Anomaly,
    allowedStatuses: readonly Anomaly['status'][],
  ): Completion | undefined {
    const expectedVersion = inputNumber(command.input, 'expectedVersion');
    if (expectedVersion !== anomaly.version) {
      return {
        ok: false, outcome: 'denied', code: 'stale-version',
        message: `Expected anomaly version ${expectedVersion}, but the current version is ${anomaly.version}.`,
        next: state, anomalyId: anomaly.id,
      };
    }
    if (!allowedStatuses.includes(anomaly.status)) {
      return {
        ok: false, outcome: 'denied', code: 'invalid-state',
        message: `${command.capabilityId} is not valid while ${anomaly.id} is ${anomaly.status}.`,
        next: state, anomalyId: anomaly.id,
      };
    }
    return undefined;
  }

  async #finish<T>(
    command: CommandEnvelope,
    actor: Actor,
    before: WorkspaceState,
    completion: Completion<T>,
  ): Promise<CommandResult<T>> {
    const priorStateHash = operationalStateHash(before);
    const currentStateHash = operationalStateHash(completion.next);
    const previousReceiptHash = before.receipts.at(-1)?.receiptHash ?? 'GENESIS';
    const receipt = await createReceipt({
      id: this.#idFactory('RCT'),
      timestamp: this.#clock(),
      command,
      actor,
      outcome: completion.outcome,
      summary: completion.message,
      priorStateHash,
      currentStateHash,
      previousReceiptHash,
      ...(completion.anomalyId ? { anomalyId: completion.anomalyId } : {}),
      ...(!completion.ok ? { reasonCode: completion.code } : {}),
    });
    const finalState: WorkspaceState = {
      ...completion.next,
      version: before.version + 1,
      receipts: [...before.receipts, receipt],
    };
    this.#store.replace(finalState);
    this.#seenCommandIds.add(command.id);
    return {
      ok: completion.ok,
      outcome: completion.outcome,
      code: completion.code,
      message: completion.message,
      ...(completion.data === undefined ? {} : { data: completion.data }),
      receipt,
    };
  }
}
