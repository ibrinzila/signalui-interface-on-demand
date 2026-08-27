export type Role = 'operator' | 'manager' | 'auditor';
export type DeviceClass = 'mobile' | 'desktop';
export type Intent = 'overview' | 'resolve-actionable-anomalies' | 'audit-recent-decisions';
export type SurfaceRecipeId = 'full-workspace' | 'focused-decisions' | 'audit-trail';
export type CapabilityEffect = 'read' | 'ui' | 'write' | 'consequential-write';
export type EvidenceKind = 'photo' | 'history' | 'operator-note' | 'maintenance-record';
export type EvidenceMateriality = 'supporting' | 'material' | 'counterevidence';
export type AnomalyStatus =
  | 'open'
  | 'proposed'
  | 'evidence-requested'
  | 'awaiting-approval'
  | 'corrected'
  | 'held';
export type CommandSource = 'human' | 'webmcp' | 'fallback-tool';
export type CommandOutcome = 'read' | 'applied' | 'denied' | 'no-op';

export interface JsonSchema {
  readonly type: 'object';
  readonly properties: Readonly<Record<string, JsonSchemaProperty>>;
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean;
}

export interface JsonSchemaProperty {
  readonly type: 'string' | 'number' | 'integer' | 'boolean';
  readonly description: string;
  readonly enum?: readonly (string | number | boolean)[];
  readonly minimum?: number;
  readonly maximum?: number;
  readonly minLength?: number;
  readonly maxLength?: number;
}

export interface CapabilityContract {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly effect: CapabilityEffect;
  readonly roles: readonly Role[];
  readonly inputSchema: JsonSchema;
  readonly annotations: {
    readonly readOnlyHint: boolean;
    readonly untrustedContentHint: boolean;
  };
  readonly requiresConfirmation: boolean;
  readonly availableWhen: readonly string[];
}

export interface CapabilityContractDocument {
  readonly version: string;
  readonly capabilities: readonly CapabilityContract[];
}

export interface SurfaceRecipeContract {
  readonly id: SurfaceRecipeId;
  readonly title: string;
  readonly description: string;
  readonly regions: readonly string[];
  readonly maxPrimaryItems: number;
}

export interface SurfaceRecipeDocument {
  readonly version: string;
  readonly recipes: readonly SurfaceRecipeContract[];
}

export interface ValidationError {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly ValidationError[];
}

export interface AccessibilityPreferences {
  readonly largeTargets: boolean;
  readonly reducedMotion: boolean;
  readonly highContrast: boolean;
  readonly verboseLabels: boolean;
}

export interface InterfaceContext {
  readonly role: Role;
  readonly device: DeviceClass;
  readonly intent: Intent;
  readonly decisionBudget: number;
  readonly accessibility: AccessibilityPreferences;
  readonly explicitUserStatement: string;
}

export interface EvidenceItem {
  readonly id: string;
  readonly kind: EvidenceKind;
  readonly label: string;
  readonly summary: string;
  readonly source: string;
  readonly capturedAt: string;
  readonly materiality: EvidenceMateriality;
  readonly assetPath?: string;
  readonly untrusted: boolean;
}

export interface HistoryPoint {
  readonly period: string;
  readonly value: number;
}

export interface CorrectionProposal {
  readonly proposedValue: number;
  readonly reason: string;
  readonly proposedBy: string;
  readonly proposedAt: string;
  readonly baseVersion: number;
}

export interface ApprovalRequest {
  readonly id: string;
  readonly anomalyId: string;
  readonly expectedVersion: number;
  readonly proposedValue: number;
  readonly reason: string;
  readonly evidenceDigest: string;
  readonly stateHash: string;
  readonly fingerprint: string;
  readonly requestedBy: string;
  readonly requestedAt: string;
  readonly status: 'pending' | 'used' | 'invalidated';
}

export interface Anomaly {
  readonly id: string;
  readonly institutionId: string;
  readonly institutionName: string;
  readonly meterLabel: string;
  readonly reportedValue: number;
  readonly expectedMin: number;
  readonly expectedMax: number;
  readonly unit: 'kWh';
  readonly reportedAt: string;
  readonly version: number;
  readonly severity: 'medium' | 'high' | 'critical';
  readonly status: AnomalyStatus;
  readonly summary: string;
  readonly recommendation: string;
  readonly confidence: 'low' | 'medium' | 'high';
  readonly requiresHumanDecision: boolean;
  readonly evidence: readonly EvidenceItem[];
  readonly history: readonly HistoryPoint[];
  readonly proposal?: CorrectionProposal;
  readonly approval?: ApprovalRequest;
  readonly correctedValue?: number;
  readonly evidenceRequest?: string;
}

export interface ReceiptEvent {
  readonly id: string;
  readonly timestamp: string;
  readonly commandId: string;
  readonly capabilityId: string;
  readonly actorId: string;
  readonly actorRole: Role;
  readonly source: CommandSource;
  readonly outcome: CommandOutcome;
  readonly anomalyId?: string;
  readonly summary: string;
  readonly inputDigest: string;
  readonly priorStateHash: string;
  readonly currentStateHash: string;
  readonly reasonCode?: string;
  readonly previousReceiptHash: string;
  readonly receiptHash: string;
}

export interface WorkspaceState {
  readonly version: number;
  readonly generatedAt: string;
  readonly interfaceContext: InterfaceContext;
  readonly anomalies: readonly Anomaly[];
  readonly receipts: readonly ReceiptEvent[];
  readonly lastSurfaceId: string;
}

export interface AdaptationExplanation {
  readonly goal: string;
  readonly explicitInputs: readonly string[];
  readonly changed: readonly string[];
  readonly preserved: readonly string[];
  readonly notInferred: readonly string[];
}

export interface SurfaceRegion {
  readonly id: string;
  readonly title: string;
  readonly anomalyIds: readonly string[];
}

export interface SurfacePlan {
  readonly id: string;
  readonly recipe: SurfaceRecipeId;
  readonly regions: readonly SurfaceRegion[];
  readonly primaryAnomalyIds: readonly string[];
  readonly hiddenRegions: readonly string[];
  readonly explanation: AdaptationExplanation;
  readonly stateHash: string;
}

export interface Actor {
  readonly id: string;
  readonly role: Role;
  readonly source: CommandSource;
}

export interface CommandEnvelope {
  readonly id: string;
  readonly capabilityId: string;
  readonly input: Readonly<Record<string, unknown>>;
  readonly expectedWorkspaceVersion?: number;
}

export interface CommandResult<T = unknown> {
  readonly ok: boolean;
  readonly outcome: CommandOutcome;
  readonly code: string;
  readonly message: string;
  readonly data?: T;
  readonly receipt: ReceiptEvent;
}
