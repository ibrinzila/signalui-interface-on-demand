# SignalUI Interface on Demand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Build and verify a complete, public-ready reference vertical in which SignalUI compiles role-, intent-, device- and accessibility-aware anomaly-review interfaces while human controls and WebMCP tools share one governed command path.

**Architecture:** A dependency-free TypeScript core owns contracts, policy, deterministic surface compilation, state, commands and receipts. A browser UI renders approved surface recipes, while a thin WebMCP bridge registers the same capabilities through `document.modelContext` or an in-page fallback simulator. A static Node server, unit tests and a CDP-based Chromium harness make the package independently runnable and verifiable.

**Tech Stack:** TypeScript 5.8, browser DOM APIs, Node.js 22 built-ins, Node test runner, Chromium DevTools Protocol, CSS, WebMCP Imperative API with feature detection.

**Spec:** `docs/superpowers/specs/2026-08-27-interface-on-demand-design.md`

## Global Constraints

- No arbitrary model-generated frontend code.
- Human and agent mutations use the same `CommandBus.execute` path.
- Authority is checked at execution time and never inferred from presentation.
- Consequential approval is bound to anomaly ID, expected version, proposal and state hash.
- Material evidence and counterevidence cannot be omitted from focused decision surfaces.
- Adaptation is explicit, reversible and explainable.
- Accessibility preferences are explicit inputs; no disability or emotional-state inference.
- Runtime has no third-party production dependencies.
- All reference data is synthetic.

---

### Task 1: Project foundation and contract validator

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `contracts/capabilities.json`
- Create: `contracts/surface-recipes.json`
- Create: `src/core/types.ts`
- Create: `src/core/schema.ts`
- Test: `tests/schema.test.ts`

**Interfaces:**
- Produces: `validateCapabilityContracts(value): ValidationResult`, `validateSurfaceRecipes(value): ValidationResult` and shared domain types.

- [x] Write schema tests that reject duplicate capability IDs, missing descriptions, write capabilities without roles, and recipes without required explanation/reversal regions.
- [x] Run the focused schema tests and confirm they fail because validator modules do not exist.
- [x] Implement the shared types and deterministic validators.
- [x] Add eight complete capability contracts and three surface recipes.
- [x] Run focused tests and confirm they pass.
- [x] Commit `feat: add governed capability and surface contracts`.

### Task 2: Synthetic workspace state and hashing

**Files:**
- Create: `src/core/fixtures.ts`
- Create: `src/core/hash.ts`
- Create: `src/core/store.ts`
- Test: `tests/store.test.ts`

**Interfaces:**
- Consumes: shared types from Task 1.
- Produces: `createInitialState()`, `stableHash(value)`, `WorkspaceStore` with `getState`, `replace`, `update`, `subscribe`, `reset`.

- [x] Write tests for deterministic fixture state, order-independent hashing, immutable updates, subscriber notification and reset.
- [x] Confirm the tests fail at missing imports.
- [x] Implement synthetic institutions, readings, evidence, history and initial receipts.
- [x] Implement canonical serialization and SHA-256 hashing using Web Crypto with a portable synchronous SHA-256 fallback for environments without Web Crypto.
- [x] Implement the store and run all tests.
- [x] Commit `feat: add synthetic anomaly workspace state`.

### Task 3: Policy engine and surface compiler

**Files:**
- Create: `src/core/policy.ts`
- Create: `src/core/intent.ts`
- Create: `src/core/compiler.ts`
- Test: `tests/policy.test.ts`
- Test: `tests/compiler.test.ts`

**Interfaces:**
- Produces: `admitCapability`, `availableCapabilityIds`, `interpretIntent`, `compileSurface`.

- [x] Write role-admission tests, including manager-only approval and auditor read-only behavior.
- [x] Write compiler tests proving a mobile operator receives at most three material decisions, counterevidence remains visible, and auditor receives the audit recipe.
- [x] Confirm all focused tests fail for missing implementation.
- [x] Implement exact role/state capability admission.
- [x] Implement explicit intent parsing with visible confidence and no personal-state inference.
- [x] Implement deterministic surface compilation and explanation payloads.
- [x] Run focused and full tests.
- [x] Commit `feat: compile explainable interfaces from governed context`.

### Task 4: Shared command bus, approvals and receipts

**Files:**
- Create: `src/core/commands.ts`
- Create: `src/core/command-bus.ts`
- Create: `src/core/receipts.ts`
- Test: `tests/command-bus.test.ts`

**Interfaces:**
- Produces: `CommandBus.execute(command, actor)`, `createApprovalFingerprint`, `CommandResult`.

- [x] Write tests for proposal, evidence request, approval request, unauthorized approval, stale approval, successful approval and duplicate idempotency denial.
- [x] Confirm failures occur because the command bus is missing.
- [x] Implement input validation and policy admission before mutation.
- [x] Implement state/version/fingerprint-bound approval requests.
- [x] Implement mutation and denial receipts with prior/current hashes.
- [x] Run focused and full tests.
- [x] Commit `feat: govern human and agent commands with receipts`.

### Task 5: WebMCP bridge and fallback simulator

**Files:**
- Create: `src/webmcp/types.d.ts`
- Create: `src/webmcp/tool-registry.ts`
- Create: `src/webmcp/bridge.ts`
- Test: `tests/webmcp.test.ts`

**Interfaces:**
- Consumes: policy, compiler and command bus.
- Produces: `WebMcpBridge.start`, `WebMcpBridge.refresh`, `WebMcpBridge.stop`, `executeFallbackTool`, `listFallbackTools`.

- [x] Write tests proving exactly eight tool definitions, read-only annotations, role/state availability, shared command-bus execution and AbortSignal-based refresh.
- [x] Confirm tests fail for missing bridge.
- [x] Implement definitions with clear JSON Schemas and bounded outputs.
- [x] Register natively through `document.modelContext.registerTool` when available.
- [x] Implement the same registry as an in-page fallback simulator.
- [x] Run focused and full tests.
- [x] Commit `feat: expose governed capabilities through WebMCP`.

### Task 6: Complete adaptive web experience

**Files:**
- Create: `index.html`
- Create: `src/ui/icons.ts`
- Create: `src/ui/templates.ts`
- Create: `src/ui/render.ts`
- Create: `src/ui/app.ts`
- Create: `src/styles.css`
- Create: `public/assets/meter-104.svg`
- Create: `public/assets/meter-305.svg`
- Create: `public/assets/meter-411.svg`
- Test: `tests/templates.test.ts`

**Interfaces:**
- Produces: full, focused and audit renderers; explanation drawer; native/fallback tool console; profile and intent controls.

- [x] Write template tests for required landmarks, explanation/reversal controls, material evidence and exact approval preview.
- [x] Confirm they fail for missing renderer.
- [x] Implement semantic templates and safe HTML escaping.
- [x] Implement responsive visual system, large targets, reduced-motion and high-contrast handling.
- [x] Wire all human actions to the command bus and re-render on state changes.
- [x] Add synthetic SVG evidence images.
- [x] Run template and unit tests.
- [x] Commit `feat: build the Interface on Demand reference experience`.

### Task 7: Build, server and developer tooling

**Files:**
- Create: `scripts/build.mjs`
- Create: `scripts/validate-contracts.mjs`
- Create: `scripts/server.mjs`
- Create: `scripts/check-dist.mjs`
- Create: `evals/webmcp-evals.json`
- Create: `scripts/run-evals.mjs`

**Interfaces:**
- Produces: `npm run build`, `npm run validate`, `npm run eval`, `npm start`.

- [x] Write a distribution check that fails before build output exists.
- [x] Run it and confirm the intended failure.
- [x] Implement TypeScript compilation, asset copying and deterministic cleanup.
- [x] Implement contract validation and rule-based WebMCP call-sequence evals.
- [x] Implement a static server with CSP, tools Permissions-Policy and no-cache development headers.
- [x] Build and confirm the distribution check passes.
- [x] Commit `build: add deterministic build and verification tooling`.

### Task 8: Chromium end-to-end and accessibility proof

**Files:**
- Create: `scripts/cdp-client.mjs`
- Create: `tests/e2e.mjs`
- Create: `tests/accessibility.mjs`
- Create: `artifacts/.gitkeep`

**Interfaces:**
- Produces: `npm run test:e2e`, desktop/mobile PNG screenshots and JSON proof report.

- [x] Write the E2E journey and run it against the unimplemented browser hooks to confirm the intended failure.
- [x] Implement the minimal test hooks only through public UI/fallback-tool surfaces.
- [x] Verify focused adaptation, shared state, denied operator approval, successful manager approval and auditor receipt.
- [x] Verify landmarks, accessible names, live region, focus order, target sizes and reduced-motion CSS.
- [x] Generate desktop and mobile screenshots plus proof JSON.
- [x] Run all browser tests twice to detect state leakage.
- [x] Commit `test: prove adaptive workflow and accessibility in Chromium`.

### Task 9: Product documentation and release package

**Files:**
- Create: `README.md`
- Create: `LICENSE`
- Create: `SECURITY.md`
- Create: `docs/architecture.md`
- Create: `docs/webmcp-tools.md`
- Create: `docs/demo-script.md`
- Create: `docs/adoption-path.md`
- Create: `docs/verification.md`
- Remove: `.bootstrap`

**Interfaces:**
- Produces: self-contained setup, architecture, security, demo and SignalUI/Blazor adoption documentation.

- [x] Document exact local commands, browser support and fallback behavior.
- [x] Document all eight tools and authority boundaries.
- [x] Document the three-minute demo and migration seam back to canonical SignalUI/Blazor.
- [x] Add MIT license and security limitations.
- [x] Run link/path checks and repository hygiene checks.
- [x] Commit `docs: complete Interface on Demand release package`.

### Task 10: Final verification and artifact assembly

**Files:**
- Create: `artifacts/verification-report.json`
- Create: `artifacts/verification-report.md`
- Create: `/mnt/data/SignalUI-Interface-on-Demand-v1.0.0.zip`

**Interfaces:**
- Produces: a verified source archive and evidence report.

- [x] Run `npm run verify` from a clean build.
- [x] Run `git diff --check` and confirm clean status.
- [x] Inspect desktop and mobile screenshots.
- [x] Record exact command outcomes, test counts, commit and file hashes.
- [x] Create a source archive excluding `.git`, transient processes and caches.
- [x] Extract the archive into a separate temporary directory and run `npm run verify` again.
- [x] Commit `chore: seal verified Interface on Demand vertical`.

## Completion evidence

Implemented and sealed on 2026-08-27. The clean conveyor passed 39 unit/tooling tests, 5 WebMCP evaluations, 24 Chromium checks and 18 accessibility checks. The release is accompanied by a source archive, deployable distribution, verification reports and SHA-256 checksums.
