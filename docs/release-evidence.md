# LIVE RELEASE VERIFIED — Release Evidence

The stable release anchor is tag `v1.0.0`, which MUST point to the commit containing this record. Resolve its exact source with `git rev-list -n 1 v1.0.0`; that SHA MUST match GitHub `main` and the Cloudflare production deployment Source. This prevents a documentation commit from falsely embedding its own future SHA or deployment ID.

- **Source commit:** Resolve with `git rev-list -n 1 v1.0.0` after the release tag is published; it must be the commit containing this record and match GitHub `main` and Cloudflare Source.
- **Deployment URL:** https://signalui-interface-on-demand.pages.dev
- **Deployment timestamp:** Resolve from the Cloudflare receipt for the `v1.0.0` source commit.
- **Smoke results:** Live release evidence is verified; judge readiness is conditional on the published `v1.0.0` receipt resolving tag, GitHub `main`, and Cloudflare Source to the same commit.
- **Public source URL:** https://github.com/ibrinzila/signalui-interface-on-demand
- **Repository visibility and remote SHA:** Public `main`; the final exact SHA and CI run belong in the `v1.0.0` GitHub Release receipt.
- **HTTPS and header evidence:** Canonical and immutable URLs returned HTTPS 200. Canonical response had strict CSP (`default-src 'self'`; object/base/frame disabled; forms self), `Permissions-Policy: tools=(self)`, same-origin COOP/CORP, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and `Cache-Control: no-store`.
- **Browser identity:** In-app Browser human smoke and isolated Google Chrome 151 native WebMCP smoke.
- **Native WebMCP state:** VERIFIED in isolated Chrome with the official `enable-webmcp-testing` equivalent features: page labeled `WebMCP native`; DevTools WebMCP domain discovered six initial tools. The final canonical smoke completed `set_interface_context` (`context-updated`) and `list_actionable_anomalies` (`actionable-listed`), then showed the focused native surface with three decisions, material preservation, and counterevidence.
- **Human journey state:** VERIFIED. The final in-app Browser journey had no console warnings or errors, exactly three decision labels, two counterevidence labels, material preservation, exact fingerprint/version preview, manager approval, and an auditor `approve_correction` receipt.
- **Authority-boundary state:** VERIFIED. Native operator `propose_correction` and `request_human_approval` completed with receipts. A direct known-but-unexposed fallback attempt to execute `approve_correction` as operator was denied `role-denied`, preserved the state hash, and was receipted as a fallback-tool boundary result; it was not a native tool invocation. The auditor surface then had one denied receipt and zero write tools.
- **Asset and contract evidence:** JavaScript module served as `application/javascript`; manifest as `application/manifest+json`; contracts and build manifest as `application/json`; CSS as `text/css`; contracts and manifest loaded successfully.
- **Build proof:** 48 unit tests, 5/5 eval, 24/24 browser, and 18/18 accessibility checks passed. Reproducible build hash: `b6ba2d394ec7e69e757a2d9cead40e82d7eeca3c343a63cad13535fb7978bf1e`. This documentation-only sealing commit does not enter `dist/`.
- **Data and integration scope:** All state is synthetic and in-memory; no real data or external application integration was used.
- **Rollback target:** Immutable deployment `604f0aa3` at source `aaab93a` is the initial release rollback target. This was the first production deployment; no earlier production release exists.
- **Converged candidate evidence:** The immediate predecessor proof is Cloudflare deployment `d67ef8e2` at source `6399e15` on `main`, with GitHub Actions run `33049778988` passing. Canonical and immutable HTTPS/header checks passed, followed by the final in-app Browser and Chrome 151 native smoke recorded above.
- **Release receipt:** After this sealing commit, publish the GitHub Release `v1.0.0` receipt with the exact tag SHA, final Cloudflare deployment ID and timestamp, CI run, and smoke results. Those values are resolved evidence, not fields guessed in this source file.
- **Final video:** Pending operator upload. No YouTube upload or Devpost submission has been made.

## Recording rules

Verify `git rev-list -n 1 v1.0.0`, GitHub `main`, and Cloudflare deployment Source resolve to the same SHA. Record that SHA, Cloudflare deployment ID/timestamp, CI run, HTTPS/header results, browser identity, native/fallback state, and human-flow smoke outcome in the GitHub Release `v1.0.0` receipt. Do not replace unavailable native WebMCP evidence with fallback-console proof.
