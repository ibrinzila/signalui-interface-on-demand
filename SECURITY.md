# Security policy

## Supported scope

The current `1.0.x` line is a synthetic reference implementation. Security fixes are accepted for the current release archive and the active Interface on Demand branch. A production support policy begins only after an explicit public release.

## Reporting a vulnerability

Please use a private GitHub security advisory for the repository rather than opening a public issue containing exploit details. Include:

- affected commit or archive version;
- reproducible steps;
- expected and observed authority boundary;
- whether the issue changes operational state, exposes data or weakens approval;
- a minimal proof that does not use real personal or organizational data.

## Trust boundaries

### What the reference vertical enforces

- Roles are supplied by the actor/identity adapter, not granted by the requested interface.
- `set_interface_context` rejects a requested role that differs from the actor role.
- Every capability is admitted again at command execution.
- Approval is tied to the current anomaly version, proposal, evidence digest, approval ID and fingerprint.
- Duplicate command IDs, stale versions, invalid state and mismatched fingerprints fail closed.
- Denials create non-mutating receipt events.
- Evidence marked untrusted is escaped in UI and returned as bounded data.
- Tool outputs are capped and do not return evidence asset paths.
- Browser delivery uses self-only script/style/connect policies, no framing and no sniffing.

### What this repository does not provide

- production login, identity federation or session management;
- server-authoritative persistence;
- tenant isolation;
- encryption key management;
- external service credentials;
- real-world meter updates or other side effects;
- distributed exactly-once execution.

The demo profile switcher is an explicit identity simulator. In a host product, replace `currentActor()` with the authenticated server/host identity and never trust a role supplied by browser form data.

## Deployment requirements

Before production adoption:

1. Move operational state and receipts to an authenticated backend.
2. Bind every command to the server-side principal and tenant.
3. Recompute approval fingerprints on the server.
4. Use idempotency records with durable storage and expiry.
5. Add CSRF/session protections appropriate to the host architecture.
6. Validate all contracts and state migrations at startup.
7. Add rate limits, monitoring, audit retention and incident procedures.
8. Run threat modeling for every external side effect.
