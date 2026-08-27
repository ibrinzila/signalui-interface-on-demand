# Verification model

## One-command conveyor

```bash
npm run verify
```

The command performs, in order:

1. clean transient build and proof output;
2. validate eight capability contracts and three surface recipes;
3. validate release documentation and local links;
4. scan required release files, unfinished markers, secret patterns and whitespace;
5. compile TypeScript and run unit/tooling tests;
6. create `dist/`, check required files and compare two independent build manifests;
7. run five WebMCP journey evals;
8. run the complete real-Chromium workflow;
9. run DOM and accessibility-tree checks;
10. verify that every fresh proof report and screenshot exists and passes.

Any failure stops the conveyor.

## Proof files

Fresh verification generates:

- `artifacts/proof/contract-validation.json`
- `artifacts/proof/webmcp-evals.json`
- `artifacts/proof/browser-e2e.json`
- `artifacts/proof/accessibility.json`
- `artifacts/proof/interface-on-demand-desktop.png`
- `artifacts/proof/interface-on-demand-mobile.png`
- `artifacts/proof/interface-on-demand-audit.png`
- `dist/build-manifest.json`

The release archive includes these freshly generated files. Stable documentation copies of the screenshots live under `docs/images/`; `artifacts/proof/` is ignored so routine verification does not create Git noise.

## Unit coverage

The Node test suite covers:

- contract and command-input validation;
- deterministic fixtures, hashing and cryptographic fallback;
- immutable state updates and reset;
- profile-preference persistence and denied-storage fallback;
- role/state capability policy;
- intent interpretation and deterministic surface compilation;
- material counterevidence preservation;
- proposal, evidence request, approval request and approval;
- stale version, role escalation, fingerprint and duplicate denials;
- receipt lineage verification;
- native WebMCP registration lifecycle and fallback behavior;
- safe rendering and HTML escaping;
- CSP/security headers, path traversal and distribution completeness.

## Browser journey

The E2E test proves:

- manager full workspace starts without fatal error;
- explicit intent compiles the focused recipe;
- exactly three decisions remain;
- counterevidence and preservation explanation remain visible;
- mobile profile has no horizontal overflow and retains all decisions;
- explicit profile preference is retained by the storage adapter;
- operator proposes and requests approval;
- operator approval is denied;
- manager exact approval applies once;
- visible reading/state updates;
- auditor receives a read-only receipt surface;
- every receipt appears and write tools are absent for auditor.

## Accessibility proof

The accessibility pass checks:

- declared document language;
- one main landmark and active `h1`;
- skip link and live status region;
- accessible names for every visible button;
- minimum 44×44 CSS-pixel targets in large-target mode;
- unique IDs;
- image alternative text;
- no horizontal overflow;
- explicit reduced-motion and large-target projection;
- explanation and full-workspace reversal controls;
- main/heading/control names in Chromium’s accessibility tree;
- operable explanation panel and focus movement;
- disclosure of what the system did not infer.

## Managed-browser constraint

The container’s system Chromium carries an enterprise `URLBlocklist: ["*"]`, which blocks navigation even to localhost. The test suite does not alter or bypass that policy.

Instead, the CDP harness:

1. starts a clean headless Chromium profile on `about:blank`;
2. injects the compiled `dist/` document, CSS and module graph;
3. replaces only same-origin contract fetches with the validated contract files;
4. uses real Chromium JavaScript, DOM layout, accessibility tree and screenshots;
5. drives the public demo/fallback-tool surfaces.

The HTTP static server is verified separately with real requests and security-header assertions. Native `document.modelContext` registration is verified with a deterministic API double; the E2E journey verifies the same contracts through the fallback because this Chromium build does not expose the experimental API in the managed environment.

## Release verification

The final packaging process additionally performs:

- `git diff --check`;
- documentation, unfinished-marker and secret-pattern scans;
- image inspection;
- SHA-256 hashes for release artifacts;
- archive extraction into a clean temporary directory;
- a second full `npm run verify` inside the extracted archive.
