# HH Tool Runtime

`tool-manifests.js` declares Tool metadata only. `tool-runtime.js` owns validation, capability checks, lifecycle, cancellation, logs, history and local-first persistence.

Load order:

```html
<script src="tool-manifests.js"></script>
<script src="tool-runtime.js"></script>
```

Mount integration:

```js
const runtime = await window.HHToolRuntime.createRuntime({
  manifests: window.HHToolManifests.TOOL_MANIFESTS
});

runtime.registerAdapter("fps-monitor", fpsMonitorAdapter);
const manifest = runtime.registry.get(routeSlug);
const task = await runtime.run(manifest.id, formValue, { action: "start" });
```

Browser Tool adapters receive `{ action, input, manifest, signal, taskId, progress }`. They must stop work when `signal` is aborted and must never read credentials from the manifest.

Non-browser Tools use one of six shared gateways:

- `POST /api/tools/run`
- `GET|DELETE /api/jobs`
- `GET|POST|DELETE /api/files`
- `GET|POST /api/ai`
- `GET|POST /api/integrations`
- `POST /api/events`

Server and AI adapters are allowlisted by `toolId + action`. Provider credentials stay in Vercel environment variables and are never returned by capability/status responses. Analytics events require explicit consent and discard input, prompt, message, form, keystroke, token and credential fields.

Local persistence uses IndexedDB first, a bounded `hh.tool-runtime.v1.*` localStorage fallback second, and memory as the final degraded mode. Binary workspace files should use OPFS; the file gateway intentionally accepts only small text payloads.
