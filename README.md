# MicroTranslate

MicroTranslate is a mobile-first GitHub Pages tool for short Wikimedia translation tasks: Wikidata descriptions and Wikimedia Commons captions.

Current UI version: **v2.6**.

## AI suggestion modes

### Wikimedia MinT

Default mode. Uses Wikimedia CXServer / MinT and requires no separate AI key.

### OpenAI-compatible — BYOK

For providers implementing OpenAI-style text generation. Configurable in the UI:

- Chat Completions or Responses API style
- full endpoint URL
- model ID
- API key
- optional temperature
- optional max output tokens
- extra headers JSON
- extra body JSON
- timeout
- detailed system prompt and user prompt template

### General JSON API — BYOK

For arbitrary JSON APIs. Configure:

- endpoint URL
- POST or PUT
- optional model/deployment
- optional key/token
- headers JSON template
- body JSON template
- response text JSON path
- timeout
- detailed prompts

Template placeholders include `{{key}}`, `{{model}}`, `{{taskType}}`, `{{title}}`, `{{source}}`, `{{src}}`, `{{dst}}`, `{{system}}`, and `{{prompt}}`.

## CORS proxy — v2.6

Some AI providers intentionally do not allow browser CORS. MicroTranslate v2.6 can optionally send BYOK requests through a Cloudflare Worker that you control.

Files:

- `cloudflare-worker.js` — Worker source
- `CORS-PROXY.md` — detailed deployment/configuration guide
- `proxy.js` — browser-side proxy routing and health test

The Worker is designed to fail closed rather than act as a public open proxy. It requires an `ALLOWED_HOSTS` allowlist, restricts browser origin to the MicroTranslate GitHub Pages origin, only permits HTTPS targets and POST/PUT upstream requests, and optionally supports a `PROXY_TOKEN` secret.

In MicroTranslate, open **AI gợi ý / BYOK — cài đặt chi tiết → Prompt / request chung → CORS proxy**. Enable the proxy, paste the Worker base URL, optionally paste the proxy token, then press **Test proxy**.

The AI provider endpoint stays set to the provider's real endpoint. The proxy routing is automatic.

## Applying AI suggestions

AI output is shown separately and is **not published automatically**. Press **Áp dụng bản dịch** to copy the suggestion into the editable translation field, review/edit it, then press **Đăng & tiếp**.

Suggestions over 250 characters are not auto-applied.

## Secret storage

No provider key or Wikimedia token is committed to this repository.

- Wikimedia OAuth token can optionally be remembered in browser `localStorage`.
- BYOK keys are kept only in the current page unless **Nhớ key trên thiết bị này** is enabled.
- Proxy token can also optionally be remembered locally.
- When proxy mode is enabled, the provider key necessarily transits your Worker so the Worker can forward the request. The included Worker source does not store or log provider keys.

A static browser app cannot provide server-grade secret storage. If you need stronger key isolation, store the provider key server-side in a backend/Worker and change the proxy design so the browser never receives that key.
