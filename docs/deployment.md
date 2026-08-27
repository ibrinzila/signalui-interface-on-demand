# Deployment package

The repository is deployment-ready but deliberately does not perform an external deployment. Publishing a live URL, changing repository visibility or attaching a production domain remains an explicit operator action.

## Cloudflare Pages

The static build is the simplest deployment shape.

- Build command: `npm run build`
- Build output directory: `dist`
- Runtime version: Node.js 22 or newer
- Pages configuration: `wrangler.toml`
- Static response headers: `public/_headers`, copied to `dist/_headers`

The checked-in Wrangler configuration contains only the project name, build-output directory, compatibility date and disabled metrics. Once used for a Pages deployment, treat it as the configuration source of truth and reconcile it with any existing dashboard settings before publication.

A direct deployment command, after authentication and explicit release approval, is:

```bash
npx wrangler pages deploy dist --project-name signalui-interface-on-demand
```

No Pages Function is required. The application has no server-side data or secrets, and `_headers` applies to its static responses.

## Container deployment

The two-stage `Dockerfile` builds the static distribution and runs only Node's dependency-free static server.

```bash
docker build -t signalui-interface-on-demand .
docker run --rm -p 8080:8080 signalui-interface-on-demand
```

The runtime listens on `0.0.0.0:8080`. The image contains `dist/` and `scripts/server.mjs`; it does not contain source fixtures outside the built distribution, development dependencies or credentials.

## Generic Node hosting

```bash
npm install
npm run build
HOST=0.0.0.0 PORT=8080 npm start
```

The `Procfile` exposes the same server command for platforms that support it. Configure the platform's build command as `npm run build`.

## Post-deployment checks

After publishing, verify the actual HTTPS URL rather than assuming local proof transfers automatically:

1. confirm `Content-Security-Policy`, `Permissions-Policy`, no-sniff, no-referrer and anti-framing headers;
2. confirm all ES modules and contract files load from the same origin;
3. confirm the browser either exposes native WebMCP or clearly reports fallback mode;
4. replay operator denial, manager approval and auditor receipt visibility;
5. run keyboard, mobile-width and screen-reader smoke checks;
6. record the deployment commit and rollback target.

## Production boundary

This vertical is suitable for public demonstration. It is not a production meter-management backend. A real adoption must add server-side authentication, tenant isolation, authoritative persistence, durable idempotency, audit retention, monitoring and explicit ownership of external side effects.
