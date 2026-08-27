# INITIAL LIVE DEPLOY VERIFIED; CONVERGENCE REDEPLOY PENDING — Release Evidence

This record documents the initial public deployment. The evidence commit that contains this record has not yet been deployed, so repository, release record, and live deployment have not yet converged.

- **Source commit:** `aaab93a223df4715d8cf56521fcda3be23c1015f` (initial deployed source)
- **Deployment URL:** https://signalui-interface-on-demand.pages.dev
- **Immutable deployment URL:** https://604f0aa3.signalui-interface-on-demand.pages.dev
- **Deployment timestamp:** 2026-08-27T07:11:19Z
- **Deployment identity:** Cloudflare Pages deployment `604f0aa3`; production branch `main`
- **Smoke results:** PASS for the hosted initial deployment: HTTPS, headers, static asset MIME types, live human journey, and native WebMCP checks as recorded below.
- **Public source URL:** https://github.com/ibrinzila/signalui-interface-on-demand
- **Repository visibility and remote SHA:** Public `main` at initial deployed source `aaab93a`; GitHub Actions run `33048152440` passed with zero annotations.
- **HTTPS and header evidence:** Canonical and immutable URLs returned HTTPS 200. Canonical response had strict CSP (`default-src 'self'`; object/base/frame disabled; forms self), `Permissions-Policy: tools=(self)`, same-origin COOP/CORP, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and `Cache-Control: no-store`.
- **Browser identity:** In-app Browser human smoke and isolated Google Chrome 151 native WebMCP smoke.
- **Native WebMCP state:** VERIFIED in isolated Chrome with the official `enable-webmcp-testing` equivalent features: page labeled `WebMCP native`; DevTools WebMCP domain discovered six initial tools. `list_actionable_anomalies` and manager/mobile/budget context invocation completed with receipts; the latter refreshed the surface to exactly three decisions and emitted remove/add refresh events. A requested context role change from the authenticated manager to auditor was denied as `context-role-mismatch` and receipted.
- **Human journey state:** VERIFIED in the in-app Browser fallback runtime: page labeled `WebMCP fallback` because native API was unavailable there; no console warnings or errors. At 390x844 there was no horizontal overflow, the heading was “3 readings need your attention,” exactly three decision labels were shown, and material preservation/counterevidence remained visible. The in-memory sequence proposal `4,829` → manager approval request → fingerprint/version/evidence preview → manager confirmation → auditor Decision audit trail with correction-approved receipt completed.
- **Authority-boundary state:** VERIFIED. Native operator `propose_correction` and `request_human_approval` completed with receipts. A direct known-but-unexposed fallback attempt to execute `approve_correction` as operator was denied `role-denied`, preserved the state hash, and was receipted as a fallback-tool boundary result; it was not a native tool invocation. The auditor surface then had one denied receipt and zero write tools.
- **Asset and contract evidence:** JavaScript module served as `application/javascript`; manifest as `application/manifest+json`; contracts and build manifest as `application/json`; CSS as `text/css`; contracts and manifest loaded successfully.
- **Build proof:** Initial source verification: 48 unit tests, 5/5 eval, 24/24 browser, and 18/18 accessibility checks passed. Reproducible build hash: `b6ba2d394ec7e69e757a2d9cead40e82d7eeca3c343a63cad13535fb7978bf1e`.
- **Data and integration scope:** All state is synthetic and in-memory; no real data or external application integration was used.
- **Rollback target:** Initial rollback target for the forthcoming evidence-commit deployment is immutable deployment `604f0aa3` at source `aaab93a`. This is the first production deployment; no earlier production release exists.
- **Final video:** Pending operator upload; no YouTube upload or Devpost submission has been made.

## Recording rules

Record the exact published Git SHA, the deployment timestamp, HTTPS/header results, browser identity, native or fallback state, and the human-flow smoke outcome after each external step. Do not replace an unavailable native WebMCP result with fallback-console proof. Keep this record aligned with the exact commit deployed.
