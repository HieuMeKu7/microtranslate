// MicroTranslate BYOK CORS proxy for Cloudflare Workers.
//
// Required Worker variable:
//   ALLOWED_HOSTS = api.provider.example,api.openai.com
// Optional variables:
//   ALLOWED_ORIGIN = https://hieumeku7.github.io
//   PROXY_TOKEN = a random secret string (set as Secret, not plaintext var)
//
// This Worker is intentionally NOT an open proxy. It only accepts requests from
// ALLOWED_ORIGIN and only forwards to hosts listed in ALLOWED_HOSTS.

const DEFAULT_ORIGIN = 'https://hieumeku7.github.io';
const MAX_WRAPPER_BYTES = 384 * 1024;
const MAX_UPSTREAM_BODY_BYTES = 256 * 1024;

function parseAllowedHosts(raw) {
  return String(raw || '')
    .split(',')
    .map(v => v.trim().toLowerCase())
    .filter(Boolean);
}

function hostMatches(host, rule) {
  host = String(host || '').toLowerCase();
  rule = String(rule || '').toLowerCase();
  if (!host || !rule || rule === '*') return false;
  if (rule.startsWith('*.')) {
    const suffix = rule.slice(2);
    return host === suffix || host.endsWith('.' + suffix);
  }
  return host === rule;
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  };
}

function jsonResponse(origin, value, status = 200) {
  const headers = new Headers(corsHeaders(origin));
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(value), { status, headers });
}

function reject(origin, message, status = 400) {
  return jsonResponse(origin || DEFAULT_ORIGIN, { ok: false, error: message }, status);
}

function cleanForwardHeaders(input) {
  const output = new Headers();
  const blocked = new Set([
    'host', 'origin', 'referer', 'cookie', 'set-cookie', 'content-length',
    'accept-encoding', 'connection', 'keep-alive', 'proxy-authorization',
    'proxy-authenticate', 'te', 'trailer', 'transfer-encoding', 'upgrade',
    'forwarded', 'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto'
  ]);

  if (!input || typeof input !== 'object' || Array.isArray(input)) return output;

  for (const [rawName, rawValue] of Object.entries(input)) {
    const name = String(rawName || '').trim();
    const lower = name.toLowerCase();
    if (!name || blocked.has(lower) || lower.startsWith('cf-')) continue;
    if (rawValue == null) continue;
    const value = String(rawValue);
    if (value.length > 8192) continue;
    output.set(name, value);
  }
  return output;
}

function copyUsefulUpstreamHeaders(upstream, headers) {
  const exact = ['content-type', 'retry-after', 'x-request-id', 'request-id'];
  for (const name of exact) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }

  for (const [name, value] of upstream.headers) {
    const lower = name.toLowerCase();
    if (lower.startsWith('x-ratelimit-') || lower.startsWith('ratelimit-')) {
      headers.set(name, value);
    }
  }
}

export default {
  async fetch(request, env) {
    const allowedOrigin = String(env.ALLOWED_ORIGIN || DEFAULT_ORIGIN).trim();
    const requestOrigin = request.headers.get('Origin') || '';
    const url = new URL(request.url);

    // Browser access is limited to the exact MicroTranslate Pages origin.
    if (requestOrigin !== allowedOrigin) {
      return new Response('Origin not allowed', { status: 403 });
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(allowedOrigin) });
    }

    if (url.pathname === '/health' && request.method === 'GET') {
      const hosts = parseAllowedHosts(env.ALLOWED_HOSTS);
      return jsonResponse(allowedOrigin, {
        ok: true,
        service: 'MicroTranslate BYOK CORS proxy',
        configured: hosts.length > 0,
        allowedHosts: hosts,
        proxyTokenRequired: Boolean(env.PROXY_TOKEN)
      });
    }

    if (url.pathname !== '/proxy' || request.method !== 'POST') {
      return reject(allowedOrigin, 'Use GET /health or POST /proxy.', 404);
    }

    const contentLength = Number(request.headers.get('Content-Length') || 0);
    if (contentLength > MAX_WRAPPER_BYTES) {
      return reject(allowedOrigin, 'Proxy wrapper request too large.', 413);
    }

    let payload;
    try {
      payload = await request.json();
    } catch (_) {
      return reject(allowedOrigin, 'Body must be valid JSON.', 400);
    }

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return reject(allowedOrigin, 'Body must be a JSON object.', 400);
    }

    if (env.PROXY_TOKEN && String(payload.proxyToken || '') !== String(env.PROXY_TOKEN)) {
      return reject(allowedOrigin, 'Invalid proxy token.', 401);
    }

    let target;
    try {
      target = new URL(String(payload.target || ''));
    } catch (_) {
      return reject(allowedOrigin, 'Invalid target URL.', 400);
    }

    if (target.protocol !== 'https:') {
      return reject(allowedOrigin, 'Only HTTPS upstream targets are allowed.', 400);
    }
    if (target.username || target.password) {
      return reject(allowedOrigin, 'Credentials in target URL are not allowed.', 400);
    }

    const allowedHosts = parseAllowedHosts(env.ALLOWED_HOSTS);
    if (!allowedHosts.length) {
      return reject(allowedOrigin, 'Worker is not configured: set ALLOWED_HOSTS first.', 503);
    }
    if (!allowedHosts.some(rule => hostMatches(target.hostname, rule))) {
      return reject(allowedOrigin, `Target host not allowed: ${target.hostname}`, 403);
    }

    const method = String(payload.method || 'POST').toUpperCase();
    if (!['POST', 'PUT'].includes(method)) {
      return reject(allowedOrigin, 'Only POST and PUT upstream methods are allowed.', 405);
    }

    const upstreamBody = payload.body == null ? '' : String(payload.body);
    if (new TextEncoder().encode(upstreamBody).byteLength > MAX_UPSTREAM_BODY_BYTES) {
      return reject(allowedOrigin, 'Upstream body too large.', 413);
    }

    const upstreamHeaders = cleanForwardHeaders(payload.headers);
    if (!upstreamHeaders.has('Accept')) upstreamHeaders.set('Accept', 'application/json');

    let upstream;
    try {
      upstream = await fetch(target.toString(), {
        method,
        headers: upstreamHeaders,
        body: upstreamBody,
        redirect: 'manual'
      });
    } catch (error) {
      return reject(allowedOrigin, 'Upstream fetch failed: ' + (error && error.message ? error.message : String(error)), 502);
    }

    const responseBody = await upstream.arrayBuffer();
    const responseHeaders = new Headers(corsHeaders(allowedOrigin));
    copyUsefulUpstreamHeaders(upstream, responseHeaders);
    responseHeaders.set('X-MicroTranslate-Proxy', '1');

    return new Response(responseBody, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders
    });
  }
};
