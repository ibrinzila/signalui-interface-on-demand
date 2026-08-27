# Adoption path into canonical SignalUI and host products

## Why this vertical is standalone

The reference product was built in an isolated TypeScript repository so the hackathon/product proof could be public, synthetic and independently testable without mutating active SignalUI, EnergEficient or Dopomoha work. It is not a replacement for the canonical `.NET/Blazor` SignalUI repository.

## Portable seams

### 1. Contract model

Map the JSON contracts to versioned `SignalUI.Core` records:

- `CapabilityContract`
- `SurfaceRecipeContract`
- `InterfaceContext`
- `SurfacePlan`
- `AdaptationExplanation`
- `ReceiptEvent`

Keep file-backed JSON fixtures and diagnostics so contracts remain inspectable by humans and agents.

### 2. Validator

Port the deterministic checks into the existing `signalui validate` conveyor:

- unique IDs and complete descriptions;
- write roles and confirmation rules;
- JSON input schema;
- required explanation/reversal regions;
- effect/annotation consistency;
- role-changing context denial;
- material-evidence preservation.

The CLI should fail closed with stable diagnostic codes.

### 3. Blazor adapter

`SignalUI.Blazor` should consume `SurfacePlan`; it must not reimplement policy.

Suggested component seam:

```text
<SignalUiSurface Plan="plan"
                 State="projection"
                 OnCommand="DispatchAsync" />
```

Initial approved blocks:

- `FullWorkspaceFrame`
- `FocusedDecisionStack`
- `AuditTimeline`
- `AdaptationExplanation`
- `ExactApprovalPreview`
- `ReversalControls`

The adapter should render only known regions and commands admitted by Core.

### 4. Host command adapter

Replace the in-memory `CommandBus` mutations with host-owned authenticated handlers. Preserve the order:

1. resolve principal and tenant server-side;
2. admit capability;
3. validate schema;
4. load authoritative current state;
5. validate target state/version;
6. validate approval fingerprint;
7. reserve durable idempotency key;
8. execute side effect;
9. persist receipt;
10. publish state update.

Do not reuse the browser role/profile switcher as authentication.

### 5. WebMCP bridge

Keep WebMCP as a browser projection:

```text
SignalUI contracts → admitted tool definitions → document.modelContext
```

The browser adapter may manage registration lifecycle and translate results. Authority, approval and mutations remain in Core/host handlers.

### 6. State transport

The existing SignalUI AG-UI work can transport snapshots, deltas and interrupts, but it must remain a transport seam rather than the authority seam. Preserve:

- provider-neutral region state;
- atomic admission;
- state-hash binding;
- reconnect/resume revalidation;
- one-time approval replay protection;
- transition provenance.

## First host adoption: EnergEficient

Recommended first real workflow:

1. manager asks to resolve only actionable meter anomalies;
2. SignalUI compiles a focused evidence surface;
3. deterministic cases are removed from the primary decision budget;
4. operator proposes corrections or requests evidence;
5. manager approves through the existing host authority;
6. auditor sees provenance and reporting consequences.

Use synthetic/staging data first. Do not connect write commands to production until server identity, idempotency, audit retention, rollback and monitoring are verified.

## Second adoption candidates

- **Dopomoha procurement:** evidence review, clarification, recommendation and exact approval.
- **WizSupport:** agent/client/manager surfaces around the same support case.
- **Project Intelligence:** evidence-bound decision branches and receipts.

## Extraction order

```text
reference vertical
  → freeze portable contracts and invariants
  → port validator and SurfacePlan to SignalUI.Core
  → implement Blazor blocks
  → connect one staging host
  → run cross-surface parity and security tests
  → open explicit production-adoption gate
```
