# WebMCP tool surface

## Standards status and target

This vertical targets Chrome's current imperative WebMCP shape: `document.modelContext.registerTool()`, JSON input schemas, annotations and `AbortSignal`-based tool removal. WebMCP is still a proposed, evolving web standard exposed through an origin trial or local development flag, so native registration is capability-detected and never required for the governed fallback journey.

Official references:

- [WebMCP overview](https://developer.chrome.com/docs/ai/webmcp)
- [Imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api)
- [WebMCP eval guidance](https://developer.chrome.com/docs/ai/webmcp/evals)
- [Secure WebMCP tools](https://developer.chrome.com/docs/ai/webmcp/secure-tools)

## Registration model

The page loads and validates `contracts/capabilities.json`, creates tool definitions from those contracts and registers only the capabilities admitted for the current actor and workflow state.

When native WebMCP is available:

```text
document.modelContext.registerTool(definition, { signal })
```

A refresh aborts the previous registration controller and registers the new admitted set. Tool availability therefore changes after role/state transitions without leaving stale write tools discoverable.

When native WebMCP is unavailable, the on-page fallback console uses the same catalog and command bus. It is a development/demo surface, not a separate authority path.

## Tools

| Tool | Effect | Roles | Availability | Important boundary |
|---|---|---|---|---|
| `set_interface_context` | UI write | operator, manager, auditor | always | Requested role must equal actor role; it cannot elevate authority |
| `list_actionable_anomalies` | read | all | workspace loaded | Returns bounded unresolved decision summaries |
| `inspect_anomaly` | read | all | anomaly exists | Evidence text is untrusted data and asset paths are withheld |
| `compare_reading_history` | read | all | anomaly exists | No state mutation |
| `propose_correction` | reversible write | operator, manager | target is `open` | Requires current anomaly version and evidence-grounded reason |
| `request_more_evidence` | reversible write | operator, manager | target unresolved | Records a specific request; does not change the meter value |
| `request_human_approval` | approval preparation | operator, manager | proposal exists | Creates exact preview and state/evidence fingerprint |
| `approve_correction` | consequential write | manager | current pending approval | Requires current approval ID, version and fingerprint |

## Annotations

Read tools use `readOnlyHint: true`. Tools that return externally supplied evidence mark `untrustedContentHint: true`. The command bus does not execute instructions found in evidence text.

## Shared execution

Both paths converge here:

```text
human button ─┐
              ├─→ CommandBus.execute(command, actor)
WebMCP tool ──┘
```

The command bus performs capability lookup, actor-role admission, JSON-schema validation, target-state checks, expected-version checks, approval checks, idempotency, mutation/read and receipt emission.

## Example: safe correction journey

```json
{
  "tool": "propose_correction",
  "input": {
    "anomalyId": "A-104",
    "correctedValue": 4829,
    "reason": "The photograph reads 004829 and the recent history supports an extra transcription digit.",
    "expectedVersion": 3
  }
}
```

Then:

```json
{
  "tool": "request_human_approval",
  "input": {
    "anomalyId": "A-104",
    "expectedVersion": 4
  }
}
```

The manager must approve the returned current `approvalId`, `expectedVersion` and 64-character `fingerprint`. The agent should not synthesize those values from memory.

## Eval coverage

`npm run eval` runs five scenarios:

1. mobile focused intent and correct tool selection;
2. auditor read-only surface and tool set;
3. operator-to-manager approval journey;
4. untrusted evidence remains data;
5. operator self-promotion through interface context is denied.
