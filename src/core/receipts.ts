import { sha256Hex, stableHash } from './hash.js';
import type {
  Actor,
  CommandEnvelope,
  CommandOutcome,
  ReceiptEvent,
  WorkspaceState,
} from './types.js';

export interface ReceiptDraft {
  readonly id: string;
  readonly timestamp: string;
  readonly command: CommandEnvelope;
  readonly actor: Actor;
  readonly outcome: CommandOutcome;
  readonly summary: string;
  readonly priorStateHash: string;
  readonly currentStateHash: string;
  readonly previousReceiptHash: string;
  readonly anomalyId?: string;
  readonly reasonCode?: string;
}

export function operationalStateHash(state: WorkspaceState): string {
  return stableHash({
    interfaceContext: state.interfaceContext,
    lastSurfaceId: state.lastSurfaceId,
    anomalies: state.anomalies,
  });
}

export async function evidenceDigest(anomaly: WorkspaceState['anomalies'][number]): Promise<string> {
  return sha256Hex(anomaly.evidence.map((item) => ({
    id: item.id,
    kind: item.kind,
    summary: item.summary,
    source: item.source,
    capturedAt: item.capturedAt,
    materiality: item.materiality,
    untrusted: item.untrusted,
  })));
}

export function approvalStateHash(anomaly: WorkspaceState['anomalies'][number]): string {
  return stableHash({
    id: anomaly.id,
    version: anomaly.version,
    status: anomaly.status,
    reportedValue: anomaly.reportedValue,
    expectedMin: anomaly.expectedMin,
    expectedMax: anomaly.expectedMax,
    proposal: anomaly.proposal ?? null,
    evidenceIds: anomaly.evidence.map((item) => item.id),
  });
}

export async function createApprovalFingerprint(input: {
  readonly anomalyId: string;
  readonly expectedVersion: number;
  readonly proposedValue: number;
  readonly reason: string;
  readonly evidenceDigest: string;
  readonly stateHash: string;
}): Promise<string> {
  return sha256Hex(input);
}

function hashableReceipt(receipt: Omit<ReceiptEvent, 'receiptHash'>): unknown {
  return receipt;
}

export async function createReceipt(draft: ReceiptDraft): Promise<ReceiptEvent> {
  const base = {
    id: draft.id,
    timestamp: draft.timestamp,
    commandId: draft.command.id,
    capabilityId: draft.command.capabilityId,
    actorId: draft.actor.id,
    actorRole: draft.actor.role,
    source: draft.actor.source,
    outcome: draft.outcome,
    ...(draft.anomalyId ? { anomalyId: draft.anomalyId } : {}),
    summary: draft.summary,
    inputDigest: await sha256Hex(draft.command.input),
    priorStateHash: draft.priorStateHash,
    currentStateHash: draft.currentStateHash,
    ...(draft.reasonCode ? { reasonCode: draft.reasonCode } : {}),
    previousReceiptHash: draft.previousReceiptHash,
  } satisfies Omit<ReceiptEvent, 'receiptHash'>;

  return {
    ...base,
    receiptHash: await sha256Hex(hashableReceipt(base)),
  };
}

export async function verifyReceiptLedger(
  receipts: readonly ReceiptEvent[],
): Promise<{ readonly valid: boolean; readonly invalidReceiptIds: readonly string[] }> {
  const invalidReceiptIds: string[] = [];
  let previous = 'GENESIS';
  for (const receipt of receipts) {
    const { receiptHash, ...base } = receipt;
    const expected = await sha256Hex(hashableReceipt(base));
    if (receipt.previousReceiptHash !== previous || receiptHash !== expected) invalidReceiptIds.push(receipt.id);
    previous = receiptHash;
  }
  return { valid: invalidReceiptIds.length === 0, invalidReceiptIds };
}
