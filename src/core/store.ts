import { createInitialState } from './fixtures.js';
import type { WorkspaceState } from './types.js';

export type StateListener = (state: WorkspaceState) => void;

function clone(state: WorkspaceState): WorkspaceState {
  return structuredClone(state);
}

export class WorkspaceStore {
  #state: WorkspaceState;
  readonly #initial: WorkspaceState;
  readonly #listeners = new Set<StateListener>();

  constructor(initial: WorkspaceState = createInitialState()) {
    this.#state = clone(initial);
    this.#initial = clone(initial);
  }

  getState(): WorkspaceState {
    return clone(this.#state);
  }

  replace(next: WorkspaceState): WorkspaceState {
    this.#state = clone(next);
    this.#emit();
    return this.getState();
  }

  update(updater: (state: WorkspaceState) => WorkspaceState): WorkspaceState {
    const candidate = updater(this.getState());
    return this.replace(candidate);
  }

  reset(): WorkspaceState {
    this.#state = clone(this.#initial);
    this.#emit();
    return this.getState();
  }

  subscribe(listener: StateListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #emit(): void {
    const snapshot = this.getState();
    for (const listener of this.#listeners) listener(snapshot);
  }
}
