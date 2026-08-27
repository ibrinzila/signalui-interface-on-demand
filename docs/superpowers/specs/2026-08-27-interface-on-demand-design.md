# SignalUI Interface on Demand — Design Specification

**Date:** 2026-08-27
**Status:** Approved for implementation
**Demonstration vertical:** Governed energy-reading anomaly review

## 1. Product promise

> Software used to make humans learn its interface. What if the interface learned what the human needs?

SignalUI Interface on Demand is a governed interface runtime. It takes the current human intent, role, device and explicit accessibility preferences; intersects them with application capabilities, current state and authority rules; then compiles the smallest adequate interface from validated components. The human interface and WebMCP tools are projections of the same commands and state.

The system does not generate arbitrary frontend code. It selects and configures approved surface recipes.

## 2. Complete vertical

The reference application contains:

1. A credible full operations workspace for institutional meter readings.
2. A natural-language intent box plus explicit persona controls.
3. Three interface modes produced by the same runtime:
   - full operations workspace;
   - focused decision surface;
   - audit/provenance surface.
4. Eight semantic capabilities exposed through a shared command bus and WebMCP.
5. Exact authority, state-version and confirmation gates.
6. A complete evidence, approval and execution receipt trail.
7. A WebMCP fallback console for browsers without the origin-trial API.
8. Contract validation, deterministic unit tests, browser end-to-end tests, accessibility checks and screenshots.

## 3. Architectural invariants

### 3.1 Authority is independent of presentation

Changing the interface cannot grant a capability. Role and capability admission are evaluated by the policy engine at command time. A `set_interface_context` request whose role differs from the actor role is denied and receipted without operational mutation.

### 3.2 Human and agent actions share one path

Buttons and WebMCP tools invoke the same `CommandBus.execute()` method. No agent-only mutation endpoint exists.

### 3.3 No arbitrary generated code

The planner returns a `SurfacePlan` composed from known recipes and regions. The renderer accepts only validated plans.

### 3.4 Consequential approval is state-bound

An approval request captures anomaly ID, reading version, proposed value, reason, evidence digest and state hash. Any relevant state change invalidates it.

### 3.5 Material uncertainty cannot be hidden

The compiler must include all evidence marked `material` or `counterevidence` on a decision surface.

### 3.6 Adaptation is reversible and explainable

Every adaptive surface exposes “Why am I seeing this?”, “Show full workspace” and profile controls.

### 3.7 Accessibility is an input constraint

Large targets, reduced motion, high contrast and screen-reader verbosity are explicit preferences. The runtime never infers disability or emotional state.

### 3.8 Receipts are mandatory for writes

Every write produces a receipt event with actor, source, command, input digest, prior/current state hash and outcome.

## 4. Domain model

### 4.1 Roles

- `operator`: inspect, compare, propose corrections and request evidence or approval.
- `manager`: all operator capabilities plus final approval.
- `auditor`: read-only access to evidence, state transitions and receipts.

### 4.2 Interface profiles

- `operator-mobile`: focused, decision budget 3, large targets, reduced motion.
- `manager-desktop`: full/focused, decision budget 5.
- `auditor-desktop`: provenance-first, read-only.

### 4.3 Anomaly lifecycle

`open -> proposed -> awaiting-approval -> corrected`

Alternative paths:

- `open -> evidence-requested`
- `open -> held`

### 4.4 Eight capabilities

1. `set_interface_context` — update explicit interface context and recompile the visible surface.
2. `list_actionable_anomalies` — list current actionable anomalies.
3. `inspect_anomaly` — return current reading, evidence and uncertainty.
4. `compare_reading_history` — return expected range and historical values.
5. `propose_correction` — create a non-final correction proposal.
6. `request_more_evidence` — request additional evidence without changing a reading.
7. `request_human_approval` — create an exact, state-bound approval request.
8. `approve_correction` — manager-only consequential correction using a valid approval request.

Read tools carry `readOnlyHint: true`. Tool registration is synchronized with current role and workflow state. Native WebMCP registration uses `document.modelContext.registerTool` with `AbortSignal`; unsupported browsers use the same registry through an in-page simulator.

## 5. Data and security

All data is synthetic. No network API is required. Operational state is held in memory; only the explicit demo profile preference is stored in `sessionStorage` for same-tab continuity, with a memory fallback when storage is unavailable. Client storage is not treated as authoritative domain state. A reset control restores the canonical fixture and clears the stored demo profile.

Untrusted evidence notes are returned as data with `untrustedContentHint: true`. The command bus never interprets evidence text as instructions. Tool outputs contain bounded structured summaries rather than full raw evidence.

The static server applies:

- `Content-Security-Policy` limited to self;
- `X-Content-Type-Options: nosniff`;
- `Referrer-Policy: no-referrer`;
- `Permissions-Policy: tools=(self)`.

## 6. Surface compiler

The compiler input is:

```ts
interface CompilationContext {
  intent: Intent;
  role: Role;
  device: DeviceClass;
  accessibility: AccessibilityPreferences;
  decisionBudget: number;
  state: WorkspaceState;
}
```

It produces:

```ts
interface SurfacePlan {
  id: string;
  recipe: 'full-workspace' | 'focused-decisions' | 'audit-trail';
  regions: SurfaceRegion[];
  primaryAnomalyIds: string[];
  hiddenRegions: string[];
  explanation: AdaptationExplanation;
  stateHash: string;
}
```

The planner is deterministic. Natural-language input is mapped into an explicit intent before compilation, and the selected intent is shown to the user.

## 7. Shared command bus

`CommandBus.execute(command, actor)` performs, in order:

1. capability existence check;
2. role admission;
3. input-schema validation;
4. current-state precondition validation;
5. expected-version validation;
6. approval fingerprint validation when required;
7. idempotency check;
8. domain mutation;
9. receipt emission;
10. state notification and surface recompilation.

Denials also produce non-mutating receipt events, allowing the demo to show an unauthorized operator approval attempt.

## 8. User experience

### 8.1 Full workspace

A responsive operations dashboard shows portfolio summary, anomaly queue, historical mini-visuals, evidence status and activity.

### 8.2 Focused surface

The interface reduces to at most the decision budget. Each decision card contains:

- material facts;
- expected range;
- evidence status;
- recommendation and uncertainty;
- allowed actions;
- exact approval preview when applicable.

### 8.3 Audit surface

The same state renders as a chronological receipt and provenance view with actors, sources, prior/current hashes and evidence references.

### 8.4 Explanation drawer

The drawer states the current goal, explicit context, what changed, what was preserved and what was not inferred.

## 9. Testing and acceptance

### Unit acceptance

- operator cannot execute `approve_correction`;
- manager cannot approve with a stale version or mismatched approval fingerprint;
- idempotency prevents duplicate correction;
- material counterevidence appears in focused plans;
- interface context cannot elevate the authenticated/demo actor role;
- receipt hashes connect prior/current state;
- WebMCP tool availability follows current role/state.

### Browser acceptance

- full workspace renders without console errors;
- mobile intent produces focused surface with three decisions;
- a tool invocation updates the same visible state as a button action;
- unauthorized approval is visibly denied and logged;
- manager approval succeeds only after proposal and approval request;
- auditor profile shows the resulting receipt;
- keyboard focus reaches every interactive control;
- landmarks, names and live regions are present;
- desktop and mobile screenshots are generated.

## 10. Deliberately excluded

- arbitrary model-generated HTML/React/Razor;
- silent behavioral or disability inference;
- production authentication, tenancy or external side effects;
- multi-site missions;
- automatic adaptation of third-party websites;
- package publication and canonical SignalUI merge.

These are separate adoption or productization gates. The delivered vertical is complete within its declared synthetic reference scope.
