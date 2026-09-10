# MicroTranslate

MicroTranslate is a mobile-first GitHub Pages tool for short Wikimedia translation tasks: Wikidata descriptions and Wikimedia Commons captions.

## AI suggestion modes

### 1. Wikimedia MinT

Default mode. Uses Wikimedia CXServer / MinT and requires no separate AI key.

### 2. OpenAI-compatible — BYOK

Designed for APIs that implement OpenAI-style text generation. Settings are editable in the UI:

- **API style**: Chat Completions or Responses
- **Full endpoint URL**
- **Model ID**
- **API key** (optional for local/keyless compatible servers)
- optional **temperature**
- optional **max output tokens**
- **extra headers JSON**
- **extra body JSON** for provider-specific parameters
- configurable **timeout**
- detailed **system prompt** and **user prompt template**

Chat Completions sends a standard `model + messages` body. Responses mode sends `model + instructions + input`. Provider-specific extra body fields are merged last so they can override defaults.

### 3. General JSON API — BYOK

For APIs that are not OpenAI-compatible. Configure:

- full endpoint URL
- POST or PUT
- optional model/deployment name
- optional API key/token
- headers JSON template
- request body JSON template
- response text JSON path
- timeout
- detailed system/user prompts

Supported placeholders inside General JSON templates:

- `{{key}}`
- `{{model}}`
- `{{taskType}}`
- `{{title}}`
- `{{source}}`
- `{{src}}`
- `{{dst}}`
- `{{system}}`
- `{{prompt}}`

Example OpenAI-shaped body template:

```json
{
  "model": "{{model}}",
  "messages": [
    {"role": "system", "content": "{{system}}"},
    {"role": "user", "content": "{{prompt}}"}
  ]
}
```

Example response path:

```text
choices.0.message.content
```

Other common response shapes can be auto-detected when the path is blank.

## Applying AI suggestions

AI output is shown separately. It is **not published automatically**. Press **Áp dụng bản dịch** to copy it into the editable translation field, review/edit it, then press **Đăng & tiếp**.

Suggestions over 250 characters are not auto-applied.

## Secret storage

No API key or Wikimedia token is committed to this repository.

- Wikimedia OAuth token can optionally be remembered in browser `localStorage`.
- BYOK keys are kept only in the current page unless **Nhớ key trên thiết bị này** is enabled.
- If enabled, the key is stored in `localStorage` for this GitHub Pages origin.

A static browser app cannot provide server-grade secret storage. In particular, OpenAI recommends not exposing OpenAI API keys in browser/client-side applications; use a backend/proxy if the key needs strong protection.

## CORS

General/OpenAI-compatible BYOK requests run directly from the browser. The selected provider must allow cross-origin requests from the GitHub Pages origin. MicroTranslate cannot bypass a provider's CORS policy.
