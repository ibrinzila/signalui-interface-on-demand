import type {
  CapabilityContract,
  CapabilityContractDocument,
  InterfaceContext,
  WorkspaceState,
} from './types.js';

export interface AdmissionDecision {
  readonly allowed: boolean;
  readonly code: 'admitted' | 'role-denied' | 'state-unavailable';
  readonly message: string;
}

function unresolvedAnomalyExists(state: WorkspaceState): boolean {
  return state.anomalies.some((anomaly) => anomaly.status !== 'corrected' && anomaly.status !== 'held');
}

function stateAllows(capability: CapabilityContract, state: WorkspaceState): boolean {
  switch (capability.id) {
    case 'set_interface_context':
      return true;
    case 'list_actionable_anomalies':
      return state.anomalies.length > 0;
    case 'inspect_anomaly':
    case 'compare_reading_history':
      return state.anomalies.length > 0;
    case 'propose_correction':
      return state.anomalies.some((anomaly) => anomaly.status === 'open');
    case 'request_more_evidence':
      return unresolvedAnomalyExists(state);
    case 'request_human_approval':
      return state.anomalies.some((anomaly) => anomaly.status === 'proposed' && anomaly.proposal !== undefined);
    case 'approve_correction':
      return state.anomalies.some(
        (anomaly) => anomaly.status === 'awaiting-approval' && anomaly.approval?.status === 'pending',
      );
    default:
      return false;
  }
}

export function admitCapability(
  capability: CapabilityContract,
  context: InterfaceContext,
  state: WorkspaceState,
): AdmissionDecision {
  if (!capability.roles.includes(context.role)) {
    return {
      allowed: false,
      code: 'role-denied',
      message: `${context.role} is not authorised to use ${capability.id}.`,
    };
  }

  if (!stateAllows(capability, state)) {
    return {
      allowed: false,
      code: 'state-unavailable',
      message: `${capability.id} is not available in the current workflow state.`,
    };
  }

  return {
    allowed: true,
    code: 'admitted',
    message: `${capability.id} is available for ${context.role}.`,
  };
}

export function availableCapabilityIds(
  document: CapabilityContractDocument,
  context: InterfaceContext,
  state: WorkspaceState,
): string[] {
  return document.capabilities
    .filter((capability) => admitCapability(capability, context, state).allowed)
    .map((capability) => capability.id);
}
