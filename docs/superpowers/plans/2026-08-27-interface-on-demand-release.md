# SignalUI Interface on Demand Public Release Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the recovered SignalUI Interface on Demand v1.0.0 vertical into a reproducibly verified, public, live, and judge-ready WebMCP Challenge entry while keeping final Devpost submission behind explicit operator confirmation.

**Architecture:** Preserve the dependency-free TypeScript vertical and its existing capability, policy, compiler, CommandBus, WebMCP, and receipt boundaries. Make the browser proof portable across Linux CI and macOS development, publish the exact verified Git commit to a dedicated MIT-licensed repository, deploy the static `dist/` output to Cloudflare Pages, and bind judge materials to the same commit and live URL.

**Tech Stack:** TypeScript 5.8.3, Node.js 22+, Node test runner, Chromium DevTools Protocol, WebMCP Imperative API, GitHub Actions, Cloudflare Pages.

**Spec:** `docs/superpowers/specs/2026-08-27-interface-on-demand-design.md`

## Global Constraints

- Repository: `https://github.com/ibrinzila/signalui-interface-on-demand`.
- Deployment project: `signalui-interface-on-demand` on Cloudflare Pages.
- Public license: existing MIT license, copyright Ion Brînzilă, 2026.
- All demonstration data remains synthetic; no EnergEficient, Dopomoha, participant, client, or production data may enter the repository or deployment.
- Human UI and WebMCP tools continue to invoke the same `CommandBus.execute` path.
- Interface adaptation cannot grant authority or omit material counterevidence.
- The fallback console must be identified as fallback and must not be represented as native WebMCP.
- The exact Git commit published to GitHub must be the commit built and deployed.
- A local or CI PASS does not prove the live deployment; the HTTPS deployment requires its own header, asset, responsive, human-flow, and WebMCP smoke evidence.
- Do not submit the final Devpost entry, accept contest representations, or publish to the operator's YouTube account without a separate explicit confirmation.

---

### Task 1: Make Chromium verification portable and diagnostic

**Files:**
- Modify: `tests/browser-helpers.mjs`
- Create: `tests/browser-helpers.test.mjs`
- Modify: `README.md`
- Modify: `docs/verification.md`

**Interfaces:**
- Produces: `resolveChromiumExecutable({ env, platform, exists }) -> string`.
- Consumes: `CHROMIUM_PATH` when explicitly provided.

- [ ] **Step 1: Write failing executable-resolution tests**

  Test these exact cases with injected `exists` predicates: explicit `CHROMIUM_PATH` wins; Linux finds `/usr/bin/chromium`; macOS finds `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`; no candidate throws an error listing `CHROMIUM_PATH` and attempted paths.

- [ ] **Step 2: Run the focused test and confirm the current helper has no resolver**

  Run: `node --test tests/browser-helpers.test.mjs`

  Expected: FAIL because `resolveChromiumExecutable` is not exported.

- [ ] **Step 3: Implement deterministic browser discovery and immediate spawn diagnostics**

  Use only Node built-ins. Respect an explicit environment override; otherwise check platform-specific stable Chrome/Chromium locations. Attach a spawn `error` handler so `ENOENT` fails immediately instead of waiting fifteen seconds for the DevTools timeout.

- [ ] **Step 4: Document portable execution**

  State that Linux CI uses Chromium and macOS development auto-detects Google Chrome, with `CHROMIUM_PATH` as the explicit override.

- [ ] **Step 5: Run focused and complete verification**

  Run: `node --test tests/browser-helpers.test.mjs`

  Run: `npm run verify`

  Expected: resolver tests pass; full conveyor reports 0 failures, including 24/24 Chromium and 18/18 accessibility checks.

- [ ] **Step 6: Commit**

  Commit message: `fix: make Chromium verification portable`

### Task 2: Add judge-facing release documents and bind public coordinates

**Files:**
- Create: `docs/devpost-submission.md`
- Create: `docs/judge-testing.md`
- Create: `docs/release-evidence.md`
- Modify: `README.md`
- Modify: `scripts/check-docs.mjs`
- Modify: `scripts/check-release.mjs`
- Test: `tests/tooling.test.mjs`

**Interfaces:**
- Produces: complete English Devpost copy, judge testing instructions, release evidence schema, and README public links.
- Consumes: repository URL `https://github.com/ibrinzila/signalui-interface-on-demand` and live URL `https://signalui-interface-on-demand.pages.dev`.

- [ ] **Step 1: Add failing release-document checks**

  Require all three new documents. Require the Devpost document to contain sections named `WebMCP leverage`, `People and agents together`, `Implementation`, `Impact`, and `Testing`. Require judge instructions to contain native WebMCP and fallback distinctions. Require release evidence to record source commit, deployment URL, deployment timestamp, and smoke results.

- [ ] **Step 2: Run the focused tooling test and confirm the missing-document failure**

  Run: `node --test tests/tooling.test.mjs`

  Expected: FAIL identifying the required judge documents.

- [ ] **Step 3: Write concise judge-facing English copy**

  Explain the real audience, the 47-controls-to-three-decisions transformation, the shared CommandBus, the authority denial, exact approval fingerprint, audit receipt, native WebMCP registration, and honest fallback boundary. Do not claim production authentication, real utility integrations, or native WebMCP when fallback is active.

- [ ] **Step 4: Bind public repository and deployment links in README**

  Add `Live demo`, `Public source`, `Judge testing`, and `Three-minute demo` sections. The video line may say `Operator upload pending` until the final operator gate; release checks must permit that exact phrase only in the video field.

- [ ] **Step 5: Run documentation, release, tooling, and full verification**

  Run: `npm run docs:check && npm run release:check && node --test tests/tooling.test.mjs && npm run verify`

  Expected: all checks pass.

- [ ] **Step 6: Commit**

  Commit message: `docs: add WebMCP Challenge judge package`

### Task 3: Publish the verified public repository

**Files:**
- Verify: `.github/workflows/verify.yml`
- Verify: `LICENSE`
- Verify: `SECURITY.md`
- Verify: `README.md`

**Interfaces:**
- Produces: public GitHub repository `ibrinzila/signalui-interface-on-demand` with default branch `main` and detectable MIT license.
- Consumes: clean verified local `main` commit from Tasks 1-2.

- [ ] **Step 1: Run pre-publication secret, privacy, generated-file, and license audit**

  Run: `npm run release:check && git diff --check && git status --short --branch`.

  Inspect tracked files for private paths, credentials, tokens, personal contacts, real meter data, private hostnames, and unrelated SignalUI artifacts.

- [ ] **Step 2: Verify the exact public repository target is unused or intentionally empty**

  Run: `gh repo view ibrinzila/signalui-interface-on-demand`.

  Expected before creation: repository not found.

- [ ] **Step 3: Create the public repository and push `main` without force**

  Run: `gh repo create ibrinzila/signalui-interface-on-demand --public --source=. --remote=origin --push --description "Governed adaptive interfaces where humans and WebMCP agents share capabilities, authority, evidence, and state."`.

- [ ] **Step 4: Verify public state**

  Confirm visibility `PUBLIC`, default branch `main`, detectable MIT license, repository description, exact remote SHA, and successful GitHub Actions verification.

### Task 4: Deploy the exact verified commit to Cloudflare Pages

**Files:**
- Verify: `wrangler.toml`
- Verify: `dist/_headers`
- Update: `docs/release-evidence.md`

**Interfaces:**
- Produces: `https://signalui-interface-on-demand.pages.dev` from the exact public Git commit.
- Consumes: clean `npm run build` output and authenticated Cloudflare Wrangler session.

- [ ] **Step 1: Record source commit and build it cleanly**

  Run: `git rev-parse HEAD && npm ci && npm run verify && npm run build`.

- [ ] **Step 2: Verify Cloudflare identity and deployment target**

  Run: `npx wrangler whoami` and inspect whether the Pages project already exists.

- [ ] **Step 3: Deploy the exact `dist/` output**

  Run: `npx wrangler pages deploy dist --project-name signalui-interface-on-demand --branch main --commit-hash "$(git rev-parse HEAD)"`.

- [ ] **Step 4: Verify live HTTP behavior**

  Confirm HTTPS 200, CSP, `Permissions-Policy: tools=(self)`, no-sniff, no-referrer, anti-framing, module MIME types, contract loading, manifest loading, and absence of console errors.

- [ ] **Step 5: Run live human and WebMCP smoke**

  In ChatGPT's in-app browser, verify full workspace, explicit mobile adaptation, exactly three decisions, material counterevidence, operator denial, manager approval, auditor receipt, native WebMCP tool discovery, tool execution, and visible shared-state update. If native WebMCP is unavailable, record that as a blocker rather than substituting fallback proof.

- [ ] **Step 6: Commit live evidence**

  Record deployment URL, deployment timestamp, source SHA, header results, browser identity, native/fallback state, smoke results, and rollback target.

  Commit message: `docs: record verified public release`

  Push the evidence commit, redeploy that exact commit, and repeat the live header and critical-journey smoke so repository, evidence, and deployment converge.

### Task 5: Produce the sub-three-minute judge package

**Files:**
- Create: `artifacts/submission/signalui-interface-on-demand-demo.mp4`
- Create: `artifacts/submission/video-verification.md`
- Create: `artifacts/submission/devpost-field-map.md`
- Update: `docs/release-evidence.md`

**Interfaces:**
- Produces: a locally verified English demo video under 180 seconds, exact Devpost field mapping, and final operator checklist.
- Consumes: verified public URL and the narrative in `docs/demo-script.md`.

- [ ] **Step 1: Record the live deployed application**

  Show the full workspace, adaptation to three decisions, material counterevidence, agent tool state, denied operator approval, exact manager approval, and auditor receipt. Use only synthetic data and no private browser UI.

- [ ] **Step 2: Add clear English narration and captions**

  Keep the final duration below 180 seconds. Do not use copyrighted music or third-party trademarks beyond nominative WebMCP/SignalUI references needed to explain the project.

- [ ] **Step 3: Verify the video artifact**

  Record duration, resolution, audio stream, caption visibility, first/last frame, public URL shown, repository shown, and absence of credentials/private tabs.

- [ ] **Step 4: Prepare exact Devpost field values**

  Map title, tagline, description, WebMCP fit, people-and-agents workflow, implementation, repository, live URL, video URL placeholder, testing instructions, license, and representative confirmation.

- [ ] **Step 5: Present the operator gate**

  Provide the verified video file, suggested YouTube title/description, exact Devpost draft fields, and the representations the operator must confirm. Do not upload to YouTube or submit Devpost until the operator explicitly approves those exact materials.
