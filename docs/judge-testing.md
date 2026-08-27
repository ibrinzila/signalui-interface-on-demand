# Judge testing guide

## What this demonstration is

SignalUI Interface on Demand is a synthetic, in-memory energy-reading anomaly-review vertical. It is not a production-authenticated service and has no real utility integration or external side effect.

## Human journey

1. Start in the full manager workspace.
2. Enter the mobile, time-limited intent from the README journey and select the operator profile.
3. Confirm that the focused surface presents exactly three decisions and still shows material counterevidence.
4. Propose the displayed correction, request approval, then attempt approval as operator. Confirm the denial is visible and receipted.
5. Select the manager profile and approve only the displayed current approval fingerprint.
6. Select the auditor profile and inspect the resulting receipt chain.

Human controls and tools use the same `CommandBus.execute` path. Changing interface context cannot grant authority or remove material counterevidence.

## Native WebMCP check

If the browser exposes `document.modelContext.registerTool`, use its tool-discovery interface to inspect the registered tools and execute an admitted read action. Confirm that the visible workspace state matches the tool result and that role/workflow changes update the available tools.

This is the only path that establishes native WebMCP availability. Record the browser identity and observed discovery result in the release evidence before representing native support as verified.

## Fallback console check

If native WebMCP is unavailable, use the page’s labeled fallback console to invoke the same catalog. Confirm that its result and visible state use the same catalog and command bus as the human controls.

The fallback console is a demonstration fallback, not native WebMCP. Its successful use does not establish browser tool discovery or native WebMCP availability.

## Evidence boundary

Local tests establish repository behavior only. Verify the deployed URL separately for HTTPS status, security headers, assets, responsive UI, the human journey, and—when available—the native WebMCP check. Use only the synthetic fixture data included with this repository.

- Public source target: https://github.com/ibrinzila/signalui-interface-on-demand
- Live deployment target: https://signalui-interface-on-demand.pages.dev
