import type { CommandBus } from '../core/command-bus.js';
import type { Actor, CapabilityContractDocument, CommandResult } from '../core/types.js';

export interface WebMcpToolDefinition {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly inputSchema: unknown;
  readonly annotations: {
    readonly readOnlyHint: boolean;
    readonly untrustedContentHint: boolean;
  };
  readonly execute: (input: Readonly<Record<string, unknown>>) => Promise<string>;
}

export interface ToolExecutionContext {
  readonly commandBus: CommandBus;
  readonly actorProvider: () => Actor;
  readonly source: Actor['source'];
  readonly nextCommandId: (toolName: string) => string;
  readonly onResult?: (toolName: string, result: CommandResult) => void;
}

function boundedResult(result: CommandResult): string {
  const payload = {
    ok: result.ok,
    outcome: result.outcome,
    code: result.code,
    message: result.message,
    ...(result.data === undefined ? {} : { data: result.data }),
    receipt: {
      id: result.receipt.id,
      commandId: result.receipt.commandId,
      outcome: result.receipt.outcome,
      currentStateHash: result.receipt.currentStateHash,
      receiptHash: result.receipt.receiptHash,
    },
  };
  const serialized = JSON.stringify(payload);
  if (serialized.length > 32_000) {
    return JSON.stringify({
      ok: false,
      outcome: 'denied',
      code: 'output-limit',
      message: 'The bounded WebMCP output exceeded 32,000 characters.',
    });
  }
  return serialized;
}

export function createToolCatalog(
  contracts: CapabilityContractDocument,
  context: ToolExecutionContext,
): readonly WebMcpToolDefinition[] {
  return contracts.capabilities.map((capability) => ({
    name: capability.id,
    title: capability.title,
    description: capability.description,
    inputSchema: capability.inputSchema,
    annotations: capability.annotations,
    execute: async (input) => {
      const actor = { ...context.actorProvider(), source: context.source };
      const result = await context.commandBus.execute({
        id: context.nextCommandId(capability.id),
        capabilityId: capability.id,
        input,
      }, actor);
      context.onResult?.(capability.id, result);
      return boundedResult(result);
    },
  }));
}
