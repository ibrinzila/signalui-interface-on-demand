export {};

declare global {
  interface Document {
    readonly modelContext?: {
      registerTool(
        definition: {
          name: string;
          title?: string;
          description: string;
          inputSchema: unknown;
          annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
          execute(input: Readonly<Record<string, unknown>>): Promise<string> | string;
        },
        options?: { signal?: AbortSignal; exposedTo?: readonly string[] },
      ): Promise<void> | void;
    };
  }
}
