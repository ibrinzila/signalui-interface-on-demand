import { availableCapabilityIds } from '../core/policy.js';
import type { CommandBus } from '../core/command-bus.js';
import type { WorkspaceStore } from '../core/store.js';
import type { Actor, CapabilityContractDocument, CommandResult } from '../core/types.js';
import { createToolCatalog, type WebMcpToolDefinition } from './tool-registry.js';

export interface ModelContextLike {
  registerTool(
    definition: WebMcpToolDefinition,
    options?: { signal?: AbortSignal; exposedTo?: readonly string[] },
  ): Promise<void> | void;
}

export interface WebMcpBridgeOptions {
  readonly store: WorkspaceStore;
  readonly contracts: CapabilityContractDocument;
  readonly commandBus: CommandBus;
  readonly actorProvider: () => Actor;
  readonly modelContext?: ModelContextLike;
  readonly onResult?: (toolName: string, result: CommandResult) => void;
}

export class WebMcpBridge {
  readonly #store: WorkspaceStore;
  readonly #contracts: CapabilityContractDocument;
  readonly #commandBus: CommandBus;
  readonly #actorProvider: () => Actor;
  readonly #modelContext: ModelContextLike | undefined;
  readonly #onResult: ((toolName: string, result: CommandResult) => void) | undefined;
  #catalog: readonly WebMcpToolDefinition[];
  #controller: AbortController | undefined;
  #unsubscribe: (() => void) | undefined;
  #started = false;
  #refreshPromise: Promise<void> = Promise.resolve();
  #sequence = 0;

  constructor(options: WebMcpBridgeOptions) {
    this.#store = options.store;
    this.#contracts = options.contracts;
    this.#commandBus = options.commandBus;
    this.#actorProvider = options.actorProvider;
    this.#modelContext = options.modelContext ?? (typeof document === 'undefined' ? undefined : document.modelContext);
    this.#onResult = options.onResult;
    this.#catalog = this.#buildCatalog('webmcp');
  }

  get nativeAvailable(): boolean {
    return this.#modelContext !== undefined;
  }

  getCatalog(): readonly WebMcpToolDefinition[] {
    return [...this.#catalog];
  }

  listFallbackTools(): readonly WebMcpToolDefinition[] {
    const admitted = new Set(this.#availableIds());
    return this.#catalog.filter((tool) => admitted.has(tool.name));
  }

  async start(): Promise<void> {
    if (this.#started) return this.refresh();
    this.#started = true;
    this.#unsubscribe = this.#store.subscribe(() => {
      void this.refresh();
    });
    await this.refresh();
  }

  async refresh(): Promise<void> {
    this.#refreshPromise = this.#refreshPromise.then(async () => {
      this.#catalog = this.#buildCatalog('webmcp');
      this.#controller?.abort();
      this.#controller = undefined;
      if (!this.#started || !this.#modelContext) return;
      const controller = new AbortController();
      this.#controller = controller;
      const admitted = new Set(this.#availableIds());
      for (const tool of this.#catalog) {
        if (!admitted.has(tool.name)) continue;
        await this.#modelContext.registerTool(tool, { signal: controller.signal });
      }
    });
    return this.#refreshPromise;
  }

  stop(): void {
    this.#started = false;
    this.#unsubscribe?.();
    this.#unsubscribe = undefined;
    this.#controller?.abort();
    this.#controller = undefined;
  }

  async executeFallbackTool(name: string, input: Readonly<Record<string, unknown>>): Promise<CommandResult> {
    const known = this.#contracts.capabilities.some((capability) => capability.id === name);
    if (!known) throw new Error(`Unknown fallback tool: ${name}.`);
    return this.#executeDirect(name, input, 'fallback-tool');
  }

  async #executeDirect(
    name: string,
    input: Readonly<Record<string, unknown>>,
    source: Actor['source'],
  ): Promise<CommandResult> {
    const actor = { ...this.#actorProvider(), source };
    const result = await this.#commandBus.execute({
      id: this.#nextCommandId(name), capabilityId: name, input,
    }, actor);
    this.#onResult?.(name, result);
    await this.refresh();
    return result;
  }

  #availableIds(): string[] {
    const state = this.#store.getState();
    return availableCapabilityIds(this.#contracts, state.interfaceContext, state);
  }

  #nextCommandId(name: string): string {
    this.#sequence += 1;
    return `webmcp-${name}-${this.#sequence}`;
  }

  #buildCatalog(source: Actor['source']): readonly WebMcpToolDefinition[] {
    return createToolCatalog(this.#contracts, {
      commandBus: this.#commandBus,
      actorProvider: this.#actorProvider,
      source,
      nextCommandId: (name) => this.#nextCommandId(name),
      ...(this.#onResult ? { onResult: this.#onResult } : {}),
    });
  }
}
