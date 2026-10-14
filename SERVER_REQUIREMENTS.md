# Server requirements and live health checks

This inventory describes configured dependencies, not a claim that any service is currently running. Runtime status must be obtained from a fresh probe on the device.

## Service matrix

| Service | Requirement | Endpoint / detection | Start or recover |
|---|---|---|---|
| Ollama | Required only when the Ollama chat engine or local LLM prompt enhancement is selected | Default `http://127.0.0.1:11434`; probe Ollama version/tags and confirm configured model exists | In Termux: `ollama serve`. The Android native bridge can request start through Termux RUN_COMMAND when Termux permissions and allow-external-apps are configured. Then verify the selected model with `ollama list`. |
| Local image generation (`sd-server`) | Required only for Local image generation | Default `http://127.0.0.1:1234`; probe `GET /` and test the A1111-compatible API | In Termux, start the installed `sd-server` build or the configured `~/sd-server.sh` wrapper with loopback bind and port 1234. Confirm model weights are installed. |
| Self-hosted A1111 / ComfyUI | Optional alternative image backend | User-configured URL; probe the backend's actual health/model endpoint | Start the configured backend on the host and set a reachable URL in Settings. For a separate device, use its LAN address, not that device's loopback address. |
| Hunyuan3D worker | Optional 3D generation dependency; feature unavailable until a compatible worker and weights are installed | Expected worker port has been documented as `8081`; do not report healthy until a real health request and a real generation job both succeed | Start/deploy the compatible worker and install its required weights, then configure its reachable endpoint. Current repository documentation alone does not establish that the worker exists or works. |
| Gemini | Optional cloud provider | HTTPS Google Generative Language API; health requires a configured key and a real, non-billable/low-cost supported request or provider-specific model listing | Configure the key in app Settings or local environment. Never commit the key or bundle a private key into a public web build. |
| OpenRouter | Optional cloud provider | HTTPS OpenRouter API; requires a configured key and valid model/provider response | Configure key and model in Settings. Keep the key out of source control. |
| Backend/account server | Not required for core client-side builder by the current README | No mandatory application backend established by this inventory | Do not invent a backend dependency. Verify any separately enabled integration independently. |

## Health-state contract

Every service status shown in the UI must be based on a new request, not a saved setting or a hard-coded green indicator.

- **HEALTHY**: request succeeded and the required capability was verified (for an LLM, also verify the configured model; for generation, complete a small real generation).
- **DEGRADED**: endpoint responds but the selected model, feature, or required capability is missing.
- **STOPPED**: connection refused / process not running.
- **UNREACHABLE**: timeout, DNS, routing, or remote host cannot be reached.
- **AUTH REQUIRED**: provider rejects missing/invalid credentials (401/403).
- **BLOCKED**: Android cleartext/CORS/network policy or permission prevented the request.
- **NOT CONFIGURED**: optional service has no endpoint/key configured.
- **UNVERIFIED**: no successful live probe has been performed. Never convert this to HEALTHY based on source code alone.

Show checked-at time, endpoint (redact credentials and query tokens), last error, and an actionable start/retry/configure instruction. A ping alone is not proof that generation works.

## Android / Termux startup

1. Install and start Termux and install the required server/model separately.
2. For app-initiated startup, enable Termux's external-app command support and grant the Android `com.termux.permission.RUN_COMMAND` permission. This is a prerequisite, not proof that startup succeeded.
3. Start one heavy generation job at a time on phone hardware. Check free storage, RAM, thermal state, model files, and logs before retrying after a crash.
4. Probe the service after start; poll with a bounded timeout and show the actual failure if it never becomes ready.

## Verification commands (run in Termux)

```sh
curl -fsS --max-time 3 http://127.0.0.1:11434/api/version
curl -fsS --max-time 5 http://127.0.0.1:11434/api/tags
curl -fsS --max-time 3 http://127.0.0.1:1234/
```

A failed command is a failed probe. The sd-server root response only proves the HTTP server responds; run a small real `/sdapi/v1/txt2img` request to verify image generation.

## Truth boundary

This file records repository-configured endpoints and start procedures. It does not assert that a server is running on the user's phone. Worker/model availability and physical-device runtime status remain UNVERIFIED until checked on that device.
