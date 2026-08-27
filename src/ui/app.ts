import { CommandBus } from '../core/command-bus.js';
import { compileSurface } from '../core/compiler.js';
import { interpretIntent } from '../core/intent.js';
import { availableCapabilityIds } from '../core/policy.js';
import { asCapabilityContractDocument } from '../core/schema.js';
import { WorkspaceStore } from '../core/store.js';
import { createProfilePreferenceStore, type InterfaceProfileId, type PreferenceStorage } from '../core/preferences.js';
import type {
  Actor,
  CapabilityContractDocument,
  CommandResult,
  InterfaceContext,
  Role,
  WorkspaceState,
} from '../core/types.js';
import { WebMcpBridge } from '../webmcp/bridge.js';
import type { WebMcpToolDefinition } from '../webmcp/tool-registry.js';
import { SignalUiRenderer } from './render.js';
import { renderToolConsole, type UiModel } from './templates.js';

interface DemoApi {
  readonly ready: boolean;
  getState(): WorkspaceState;
  getPlan(): ReturnType<typeof compileSurface>;
  getTools(): readonly string[];
  executeTool(name: string, input: Readonly<Record<string, unknown>>): Promise<CommandResult>;
  setProfile(profileId: ProfileId): Promise<void>;
  submitIntent(statement: string): Promise<void>;
  reset(): void;
  getPersistedProfile(): ProfileId;
}

interface FallbackApi {
  listTools(): readonly Pick<WebMcpToolDefinition, 'name' | 'title' | 'description' | 'annotations'>[];
  executeTool(name: string, input: Readonly<Record<string, unknown>>): Promise<CommandResult>;
}

type ProfileId = InterfaceProfileId;

interface Profile {
  readonly actorId: string;
  readonly context: InterfaceContext;
}

const profiles: Readonly<Record<ProfileId, Profile>> = {
  'operator-mobile': {
    actorId: 'operator-demo-1',
    context: {
      role: 'operator', device: 'mobile', intent: 'resolve-actionable-anomalies', decisionBudget: 3,
      accessibility: { largeTargets: true, reducedMotion: true, highContrast: false, verboseLabels: true },
      explicitUserStatement: 'Show only what needs my decision on this phone.',
    },
  },
  'manager-desktop': {
    actorId: 'manager-demo-1',
    context: {
      role: 'manager', device: 'desktop', intent: 'overview', decisionBudget: 5,
      accessibility: { largeTargets: false, reducedMotion: false, highContrast: false, verboseLabels: false },
      explicitUserStatement: 'Show the full operations workspace.',
    },
  },
  'auditor-desktop': {
    actorId: 'auditor-demo-1',
    context: {
      role: 'auditor', device: 'desktop', intent: 'audit-recent-decisions', decisionBudget: 8,
      accessibility: { largeTargets: false, reducedMotion: true, highContrast: false, verboseLabels: true },
      explicitUserStatement: 'Show provenance, authority and recent decisions without mutation controls.',
    },
  },
};

const appRoot = requiredElement<HTMLElement>('app');
const modal = requiredElement<HTMLDialogElement>('modal');
const sidePanelLayer = requiredElement<HTMLElement>('side-panel-layer');
const intentForm = requiredElement<HTMLFormElement>('intent-form');
const intentInput = requiredElement<HTMLTextAreaElement>('intent-input');
const fatalError = requiredElement<HTMLElement>('fatal-error');
const controls = requiredElement<HTMLElement>('experience-controls');

let contracts: CapabilityContractDocument;
let store: WorkspaceStore;
let bus: CommandBus;
let bridge: WebMcpBridge;
let renderer: SignalUiRenderer;

function availableSessionStorage(): PreferenceStorage | undefined {
  try { return window.sessionStorage; } catch { return undefined; }
}

const profilePreferences = createProfilePreferenceStore(availableSessionStorage());
let activeProfile: ProfileId = profilePreferences.read();
let selectedAnomalyId: string | null = 'A-104';
let lastResult: CommandResult | null = null;
let intentConfidence: number | null = null;
let toolConsoleOpen = false;
let explanationOpen = false;
let commandSequence = 0;
let logicalTimeSequence = 0;

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Required element #${id} is missing.`);
  return element as T;
}

function commandId(prefix: string): string {
  commandSequence += 1;
  return `human-${prefix}-${commandSequence}`;
}

function logicalClock(): string {
  const value = new Date(Date.UTC(2026, 7, 27, 7, logicalTimeSequence, 0)).toISOString();
  logicalTimeSequence += 1;
  return value;
}

function logicalId(prefix: string): string {
  commandSequence += 1;
  return `${prefix}-DEMO-${String(commandSequence).padStart(4, '0')}`;
}

function currentActor(source: Actor['source'] = 'human'): Actor {
  const profile = profiles[activeProfile];
  return { id: profile.actorId, role: profile.context.role, source };
}

function currentModel(): UiModel {
  const state = store.getState();
  const plan = compileSurface(state.interfaceContext, state);
  return {
    state,
    plan,
    tools: bridge.listFallbackTools(),
    webMcpMode: bridge.nativeAvailable ? 'native' : 'fallback',
    selectedAnomalyId,
    lastResult,
    intentConfidence,
  };
}

function render(): void {
  const model = currentModel();
  renderer.render(model);
  appRoot.setAttribute('aria-busy', 'false');
  renderSidePanels(model);
  syncProfileButtons(model.state.interfaceContext.role, model.state.interfaceContext.device);
  if (explanationOpen) openInlinePanel('adaptation-explanation');
}

function renderSidePanels(model: UiModel): void {
  sidePanelLayer.innerHTML = toolConsoleOpen ? renderToolConsole(model) : '';
  if (toolConsoleOpen) {
    const panel = sidePanelLayer.querySelector<HTMLElement>('#tool-console');
    if (panel) {
      panel.hidden = false;
      requestAnimationFrame(() => panel.classList.add('is-open'));
    }
  }
}

function syncProfileButtons(role: Role, device: InterfaceContext['device']): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-profile]')) {
    const profile = profiles[button.dataset.profile as ProfileId];
    button.setAttribute('aria-pressed', String(profile.context.role === role && profile.context.device === device));
  }
}

function openInlinePanel(id: string): void {
  const panel = document.getElementById(id);
  if (!panel) return;
  panel.hidden = false;
  requestAnimationFrame(() => panel.classList.add('is-open'));
  panel.querySelector<HTMLElement>('button, [href], input, textarea, [tabindex]:not([tabindex="-1"])')?.focus();
}

function closeInlinePanel(id: string): void {
  const panel = document.getElementById(id);
  if (!panel) return;
  panel.classList.remove('is-open');
  window.setTimeout(() => { panel.hidden = true; }, 170);
}

async function executeHuman(capabilityId: string, input: Readonly<Record<string, unknown>>): Promise<CommandResult> {
  const result = await bus.execute({ id: commandId(capabilityId), capabilityId, input }, currentActor());
  lastResult = result;
  return result;
}

async function applyContext(context: InterfaceContext): Promise<CommandResult> {
  return executeHuman('set_interface_context', {
    role: context.role,
    intent: context.intent,
    device: context.device,
    decisionBudget: context.decisionBudget,
    explicitUserStatement: context.explicitUserStatement,
    largeTargets: context.accessibility.largeTargets,
    reducedMotion: context.accessibility.reducedMotion,
    highContrast: context.accessibility.highContrast,
    verboseLabels: context.accessibility.verboseLabels,
  });
}

async function setProfile(profileId: ProfileId): Promise<void> {
  const previousProfile = activeProfile;
  activeProfile = profileId;
  const profile = profiles[profileId];
  intentConfidence = 1;
  intentInput.value = profile.context.explicitUserStatement;
  const result = await applyContext(profile.context);
  if (!result.ok) {
    activeProfile = previousProfile;
    throw new Error(`Profile change was denied: ${result.code}.`);
  }
  profilePreferences.write(profileId);
  if (profile.context.device === 'mobile') controls.classList.remove('is-open');
}

async function submitIntent(statement: string): Promise<void> {
  intentInput.value = statement;
  const current = store.getState().interfaceContext;
  const interpretation = interpretIntent(statement, current);
  intentConfidence = interpretation.confidence;
  await applyContext(interpretation.context);
  document.getElementById('workspace')?.focus();
}

function anomaly(id: string | undefined) {
  return id ? store.getState().anomalies.find((item) => item.id === id) : undefined;
}

async function onAction(action: string, target: HTMLElement): Promise<void> {
  const anomalyId = target.dataset.anomalyId;
  const currentAnomaly = anomaly(anomalyId);
  switch (action) {
    case 'toggle-controls': {
      const button = target as HTMLButtonElement;
      const open = !controls.classList.contains('is-open');
      controls.classList.toggle('is-open', open);
      button.setAttribute('aria-expanded', String(open));
      break;
    }
    case 'adapt-interface':
      await submitIntent(intentInput.value);
      break;
    case 'show-explanation':
      explanationOpen = true;
      openInlinePanel('adaptation-explanation');
      break;
    case 'close-explanation':
      explanationOpen = false;
      closeInlinePanel('adaptation-explanation');
      break;
    case 'show-full-workspace': {
      const context = store.getState().interfaceContext;
      await applyContext({ ...context, intent: 'overview', device: 'desktop', explicitUserStatement: 'Show the full operations workspace.' });
      break;
    }
    case 'reset-workspace':
      bridge.stop();
      store.reset();
      activeProfile = 'manager-desktop';
      profilePreferences.clear();
      selectedAnomalyId = 'A-104';
      lastResult = null;
      intentConfidence = null;
      toolConsoleOpen = false;
      explanationOpen = false;
      intentInput.value = profiles['manager-desktop'].context.explicitUserStatement;
      await bridge.start();
      render();
      break;
    case 'open-tool-console':
      toolConsoleOpen = true;
      renderSidePanels(currentModel());
      break;
    case 'close-tool-console':
      toolConsoleOpen = false;
      sidePanelLayer.innerHTML = '';
      break;
    case 'inspect-anomaly':
      if (!currentAnomaly) return;
      selectedAnomalyId = currentAnomaly.id;
      lastResult = await executeHuman('inspect_anomaly', { anomalyId: currentAnomaly.id });
      if (store.getState().interfaceContext.intent === 'overview') {
        await submitIntent('Resolve the actionable anomalies and show material evidence.');
      }
      document.getElementById(`decision-${currentAnomaly.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      break;
    case 'propose-correction':
      if (currentAnomaly) renderer.openProposal(currentAnomaly);
      break;
    case 'request-evidence':
      if (currentAnomaly) renderer.openEvidenceRequest(currentAnomaly);
      break;
    case 'submit-proposal': {
      if (!currentAnomaly) return;
      const value = Number(requiredElement<HTMLInputElement>('proposal-value').value);
      const reason = requiredElement<HTMLTextAreaElement>('proposal-reason').value;
      lastResult = await executeHuman('propose_correction', {
        anomalyId: currentAnomaly.id, correctedValue: value, reason, expectedVersion: currentAnomaly.version,
      });
      renderer.closeDialog();
      break;
    }
    case 'submit-evidence-request': {
      if (!currentAnomaly) return;
      const request = requiredElement<HTMLTextAreaElement>('evidence-request-text').value;
      lastResult = await executeHuman('request_more_evidence', {
        anomalyId: currentAnomaly.id, request, expectedVersion: currentAnomaly.version,
      });
      renderer.closeDialog();
      break;
    }
    case 'request-approval':
      if (!currentAnomaly) return;
      lastResult = await executeHuman('request_human_approval', {
        anomalyId: currentAnomaly.id, expectedVersion: currentAnomaly.version,
      });
      break;
    case 'open-approval':
      if (currentAnomaly) renderer.openApproval(currentAnomaly);
      break;
    case 'close-approval':
    case 'close-dialog':
      renderer.closeDialog();
      break;
    case 'confirm-approval':
      if (!currentAnomaly?.approval) return;
      lastResult = await executeHuman('approve_correction', {
        anomalyId: currentAnomaly.id,
        approvalId: currentAnomaly.approval.id,
        expectedVersion: currentAnomaly.version,
        fingerprint: currentAnomaly.approval.fingerprint,
      });
      renderer.closeDialog();
      break;
  }
}

function bindEvents(): void {
  intentForm.addEventListener('submit', (event) => {
    event.preventDefault();
    void submitIntent(intentInput.value);
  });
  document.addEventListener('click', (event) => {
    const target = (event.target as Element).closest<HTMLElement>('[data-profile], button[data-action]');
    if (!target) return;
    if (target.dataset.profile) {
      void setProfile(target.dataset.profile as ProfileId);
      return;
    }
    if (target.dataset.action) void onAction(target.dataset.action, target);
  });
  document.addEventListener('change', (event) => {
    const target = event.target as HTMLInputElement;
    if (target.id === 'approval-confirmation') {
      const confirm = document.querySelector<HTMLButtonElement>('[data-action="confirm-approval"]');
      if (confirm) confirm.disabled = !target.checked;
    }
  });
  modal.addEventListener('click', (event) => {
    if (event.target === modal) renderer.closeDialog();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      explanationOpen = false;
      toolConsoleOpen = false;
      closeInlinePanel('adaptation-explanation');
      sidePanelLayer.innerHTML = '';
      if (modal.open) renderer.closeDialog();
    }
  });
}

async function loadContracts(): Promise<CapabilityContractDocument> {
  const response = await fetch('/contracts/capabilities.json', { cache: 'no-store' });
  if (!response.ok) throw new Error(`Capability contracts failed to load (${response.status}).`);
  return asCapabilityContractDocument(await response.json());
}

function installPublicApis(): void {
  const fallback: FallbackApi = {
    listTools: () => bridge.listFallbackTools().map(({ name, title, description, annotations }) => ({ name, title, description, annotations })),
    executeTool: async (name, input) => {
      const result = await bridge.executeFallbackTool(name, input);
      lastResult = result;
      return result;
    },
  };
  const demo: DemoApi = {
    ready: true,
    getState: () => store.getState(),
    getPlan: () => compileSurface(store.getState().interfaceContext, store.getState()),
    getTools: () => availableCapabilityIds(contracts, store.getState().interfaceContext, store.getState()),
    executeTool: fallback.executeTool,
    setProfile,
    submitIntent,
    reset: () => { document.querySelector<HTMLElement>('[data-action="reset-workspace"]')?.click(); },
    getPersistedProfile: () => profilePreferences.read(),
  };
  Object.assign(window, { SignalUIWebMCP: fallback, SignalUIDemo: demo });
}

async function bootstrap(): Promise<void> {
  contracts = await loadContracts();
  store = new WorkspaceStore();
  bus = new CommandBus({ store, contracts, clock: logicalClock, idFactory: logicalId });
  renderer = new SignalUiRenderer(appRoot, modal);
  bridge = new WebMcpBridge({
    store,
    contracts,
    commandBus: bus,
    actorProvider: () => currentActor('webmcp'),
    onResult: (_name, result) => { lastResult = result; render(); },
  });
  bindEvents();
  intentInput.value = profiles[activeProfile].context.explicitUserStatement;
  if (activeProfile !== 'manager-desktop') await setProfile(activeProfile);
  store.subscribe(() => render());
  await bridge.start();
  installPublicApis();
  render();
}

bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  fatalError.hidden = false;
  fatalError.textContent = `SignalUI failed closed: ${message}`;
  appRoot.setAttribute('aria-busy', 'false');
  appRoot.innerHTML = '<div class="empty-state"><h1>The governed interface could not start.</h1><p>Contracts or runtime requirements did not validate, so no partial interface was rendered.</p></div>';
  console.error(error);
});
