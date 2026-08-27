# SignalUI Interface on Demand

**Tagline:** Governed adaptive interfaces where people and WebMCP agents share commands, authority, evidence, and state.

SignalUI Interface on Demand is a synthetic energy-reading anomaly-review reference vertical. It shows how a governed interface can adapt to an explicit role, intent, device, and accessibility profile without changing what the actor is authorized to do.

## WebMCP leverage

The page registers currently admitted, structured tools through the native imperative WebMCP API when the browser exposes `document.modelContext.registerTool`. Native tools and human controls both invoke `CommandBus.execute`, so they use the same schemas, policy checks, state-version checks, approval fingerprint, mutations, and receipts. Tool availability changes with the current role and workflow state; there is no agent-only mutation route.

When native WebMCP is unavailable, the in-page fallback console uses the same catalog and command bus for demonstration. The fallback console is not native WebMCP and does not claim to prove native tool discovery.

## People and agents together

The complete workspace begins as a broad operations workspace. An operator explicitly asking for mobile, time-limited help receives three evidence-backed decisions instead. Material uncertainty and counterevidence remain visible, and the person can explain the adaptation or restore the full workspace.

People and agents share the same governed workflow: inspect an anomaly, compare history, propose a correction, request approval, and inspect the receipt. An operator’s attempt to approve is denied, recorded, and leaves operational state unchanged. A manager can approve only the exact, current approval fingerprint.

## Implementation

The reference vertical uses TypeScript, deterministic capability and surface contracts, a policy engine, a surface compiler, `CommandBus.execute`, a browser WebMCP bridge, and an append-only receipt trail. The compiler selects validated surface recipes rather than generating arbitrary application code.

Every write is admitted at execution time. Consequential approval is bound to anomaly ID, proposed value, evidence digest, reading version, and state hash. Each outcome produces an audit receipt with actor, source, command, input digest, prior/current state hashes, and result.

## Impact

This project explores a practical alternative to adaptive interfaces that hide risk: reduce cognitive load while preserving the evidence and authority a decision requires. The demonstration is deliberately synthetic and local-state only. It does not claim production authentication, tenant isolation, durable storage, real utility integrations, or external side effects.

## Testing

The repository includes deterministic contract and command tests, governed WebMCP journey evaluations, Chromium browser journeys, accessibility checks, reproducible-build checks, and release-document checks. Judge instructions distinguish native WebMCP evidence from fallback-console evidence and keep live-deployment verification separate from local proof.

- Public source target: https://github.com/ibrinzila/signalui-interface-on-demand
- Live deployment target: https://signalui-interface-on-demand.pages.dev
- Judge guide: [docs/judge-testing.md](judge-testing.md)
