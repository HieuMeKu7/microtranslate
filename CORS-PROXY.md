# MicroTranslate BYOK CORS proxy

This proxy is for AI providers whose API works from curl/Postman/server code but does **not** allow browser CORS from GitHub Pages.

The Worker does not store your AI provider key. MicroTranslate sends the provider request to your Worker, the Worker forwards it once, and returns the response with CORS headers that allow the MicroTranslate GitHub Pages origin.

## Security model

The included `cloudflare-worker.js` is deliberately not an open proxy.

It enforces:

- exact browser origin: `https://hieumeku7.github.io` by default;
- an explicit upstream host allowlist in `ALLOWED_HOSTS`;
- HTTPS-only upstream targets;
- only POST/PUT upstream methods;
- request size limits;
- removal of dangerous proxy/hop-by-hop headers;
- no redirects followed by the Worker;
- optional extra `PROXY_TOKEN` gate.

Do **not** change `ALLOWED_HOSTS` to a universal wildcard. Add only the API hosts you actually use.

## Deploy with Cloudflare Dashboard

1. Sign in to Cloudflare.
2. Open **Workers & Pages**.
3. Create a Worker application.
4. Open the Worker editor and replace the starter code with `cloudflare-worker.js` from this repository.
5. Deploy.
6. In the Worker, open **Settings → Variables and Secrets**.
7. Add these variables:

### Required: `ALLOWED_HOSTS`

Plaintext variable. Comma-separated API hostnames only, with no scheme/path.

Examples:

```text
api.myprovider.example
```

or multiple providers:

```text
api.myprovider.example,api.openai.com,generativelanguage.googleapis.com
```

A subdomain rule is also accepted:

```text
*.provider.example
```

### Optional: `ALLOWED_ORIGIN`

Plaintext variable. For the current MicroTranslate site use:

```text
https://hieumeku7.github.io
```

If omitted, the Worker already defaults to that exact origin.

### Optional: `PROXY_TOKEN`

Create this as a **Secret**, not a plaintext variable. Use a random string. This is an extra gate against casual use of the Worker URL.

The proxy token is not a substitute for the host allowlist. Because MicroTranslate is a browser app, any token entered in it exists client-side.

8. Deploy the variable changes.
9. Copy the Worker base URL, for example:

```text
https://microtranslate-ai-proxy.<your-subdomain>.workers.dev
```

Do not add `/proxy`; MicroTranslate adds `/proxy` and `/health` automatically.

## Configure MicroTranslate

Open **AI gợi ý / BYOK — cài đặt chi tiết**.

For OpenAI-compatible or General JSON mode:

1. Configure the AI provider endpoint/model/key as usual.
2. In **CORS proxy** enable **Dùng CORS proxy cho BYOK**.
3. Paste the Worker base URL.
4. If you set `PROXY_TOKEN`, paste the same value into the optional proxy-token field.
5. Press **Test proxy**. It should show `Proxy OK` and the allowed host list.
6. Press **Lưu cài đặt AI**.
7. Get a task and press **AI gợi ý**.

The provider endpoint remains the real provider endpoint. Do not replace the provider endpoint with the Worker URL; the proxy option handles routing automatically.

## Request path

Direct mode:

```text
MicroTranslate (browser) → AI provider
```

Proxy mode:

```text
MicroTranslate (browser) → your Cloudflare Worker → AI provider
```

The provider API key is forwarded through your Worker for that request. The included Worker source does not log request bodies or keys, but the request necessarily transits Cloudflare infrastructure.

## Troubleshooting

### `Target host not allowed`

Add the exact hostname from your provider endpoint to `ALLOWED_HOSTS`, then deploy the Worker settings again.

For:

```text
https://api.foo.example/v1/chat/completions
```

use:

```text
api.foo.example
```

### `Invalid proxy token`

Either make the token in MicroTranslate exactly match the Worker `PROXY_TOKEN` secret or remove the Worker secret if you do not want this extra gate.

### `Worker is not configured: set ALLOWED_HOSTS first`

The Worker code is deployed but the required allowlist variable has not been configured.

### `Load failed` while testing the Worker

Check that the Worker is deployed and that `ALLOWED_ORIGIN` is exactly:

```text
https://hieumeku7.github.io
```

Do not include a trailing slash.

### Provider returns 401/403 through the proxy

The CORS problem is solved at that point. Check the provider API key, endpoint, model, and provider-specific headers/body.

### Provider redirects

The Worker intentionally does not follow redirects because a redirect could bypass the host allowlist. Use the provider's final API endpoint URL directly.
