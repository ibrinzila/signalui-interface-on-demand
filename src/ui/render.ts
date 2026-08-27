import type { Anomaly } from '../core/types.js';
import {
  renderApprovalDialog,
  renderEvidenceRequestDialog,
  renderProposalDialog,
  renderWorkspace,
  type WorkspaceViewModel,
} from './templates.js';

export class SignalUiRenderer {
  readonly #root: HTMLElement;
  readonly #dialog: HTMLDialogElement;

  constructor(root: HTMLElement, dialog: HTMLDialogElement) {
    this.#root = root;
    this.#dialog = dialog;
  }

  render(model: WorkspaceViewModel): void {
    this.#root.innerHTML = renderWorkspace(model);
    this.#root.ownerDocument.documentElement.dataset.surface = model.plan.recipe;
    this.#root.ownerDocument.documentElement.dataset.role = model.state.interfaceContext.role;
    this.#root.ownerDocument.documentElement.dataset.device = model.state.interfaceContext.device;
    this.#root.ownerDocument.documentElement.dataset.highContrast = String(model.state.interfaceContext.accessibility.highContrast);
    this.#root.ownerDocument.documentElement.dataset.largeTargets = String(model.state.interfaceContext.accessibility.largeTargets);
    this.#root.ownerDocument.documentElement.dataset.reducedMotion = String(model.state.interfaceContext.accessibility.reducedMotion);
  }

  openApproval(anomaly: Anomaly): void {
    this.#open(renderApprovalDialog(anomaly));
  }

  openProposal(anomaly: Anomaly): void {
    this.#open(renderProposalDialog(anomaly));
  }

  openEvidenceRequest(anomaly: Anomaly): void {
    this.#open(renderEvidenceRequestDialog(anomaly));
  }

  closeDialog(): void {
    this.#dialog.close();
  }

  #open(content: string): void {
    this.#dialog.innerHTML = content;
    if (!this.#dialog.open) this.#dialog.showModal();
  }
}
