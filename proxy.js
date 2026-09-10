'use strict';

/* MicroTranslate v2.6 — optional CORS proxy for BYOK AI providers. */

const MT_PROXY_SETTINGS_KEY = 'microtranslate.ai.proxy.settings.v2.6';
const MT_PROXY_TOKEN_KEY = 'microtranslate.ai.proxy.token.v2.6';

const mtProxyEl = {
  enabled: document.querySelector('#ai-proxy-enabled'),
  url: document.querySelector('#ai-proxy-url'),
  token: document.querySelector('#ai-proxy-token'),
  remember: document.querySelector('#ai-proxy-remember'),
  clearToken: document.querySelector('#ai-proxy-clear-token'),
  test: document.querySelector('#ai-proxy-test'),
  status: document.querySelector('#ai-proxy-status')
};

const mtProxyDefaults = {
  enabled: false,
  url: '',
  remember: false
};

function mtProxyStatus(text, type = '') {
  if (!mtProxyEl.status) return;
  mtProxyEl.status.textContent = text;
  mtProxyEl.status.className = 'ai-config-status' + (type ? ' ' + type : '');
}

function mtProxyGet(key) {
  try { return localStorage.getItem(key); } catch (_) { return null; }
}

function mtProxySet(key, value) {
  try { localStorage.setItem(key, value); return true; } catch (_) { return false; }
}

function mtProxyRemove(key) {
  try { localStorage.removeItem(key); } catch (_) {}
}

function mtNormalizeProxyBase(raw) {
  const value = String(raw || '').trim().replace(/\/+$/, '');
  if (!value) return '';
  if (!/^https:\/\//i.test(value)) throw new Error('Proxy URL phải là HTTPS URL đầy đủ.');
  return value.replace(/\/proxy$/i, '').replace(/\/health$/i, '');
}

function mtProxyPath(base, path) {
  return mtNormalizeProxyBase(base) + '/' + String(path || '').replace(/^\/+/, '');
}

function mtReadProxySettings() {
  const raw = mtProxyGet(MT_PROXY_SETTINGS_KEY);
  if (!raw) return { ...mtProxyDefaults };
  try { return { ...mtProxyDefaults, ...JSON.parse(raw) }; }
  catch (_) { return { ...mtProxyDefaults }; }
}

function mtApplyProxySettings(settings) {
  if (!mtProxyEl.enabled) return;
  mtProxyEl.enabled.checked = Boolean(settings.enabled);
  mtProxyEl.url.value = settings.url || '';
  mtProxyEl.remember.checked = Boolean(settings.remember);
  if (settings.remember) mtProxyEl.token.value = mtProxyGet(MT_PROXY_TOKEN_KEY) || '';
  mtUpdateProxyUi();
}

function mtCollectProxySettings() {
  return {
    enabled: Boolean(mtProxyEl.enabled && mtProxyEl.enabled.checked),
    url: mtProxyEl.url ? mtProxyEl.url.value.trim() : '',
    remember: Boolean(mtProxyEl.remember && mtProxyEl.remember.checked)
  };
}

function mtValidateProxySettings(settings) {
  if (!settings.enabled) return;
  if (!settings.url) throw new Error('Đã bật proxy nhưng chưa nhập Worker URL.');
  mtNormalizeProxyBase(settings.url);
}

function mtSaveProxySettings(showStatus = false) {
  const settings = mtCollectProxySettings();
  mtValidateProxySettings(settings);
  mtProxySet(MT_PROXY_SETTINGS_KEY, JSON.stringify(settings));
  if (settings.remember) mtProxySet(MT_PROXY_TOKEN_KEY, mtProxyEl.token.value.trim());
  else mtProxyRemove(MT_PROXY_TOKEN_KEY);
  if (showStatus) mtProxyStatus('Đã lưu cấu hình proxy.', 'ok');
  return settings;
}

function mtResetProxySettings() {
  mtProxyRemove(MT_PROXY_SETTINGS_KEY);
  mtProxyRemove(MT_PROXY_TOKEN_KEY);
  if (mtProxyEl.token) mtProxyEl.token.value = '';
  mtApplyProxySettings({ ...mtProxyDefaults });
  mtProxyStatus('Đã reset proxy.', 'ok');
}

function mtUpdateProxyUi() {
  if (!mtProxyEl.enabled) return;
  const enabled = mtProxyEl.enabled.checked;
  [mtProxyEl.url, mtProxyEl.token, mtProxyEl.remember, mtProxyEl.clearToken, mtProxyEl.test]
    .forEach(node => { if (node) node.disabled = !enabled; });
}

function mtHeadersToObject(headersLike) {
  const result = {};
  const headers = new Headers(headersLike || {});
  headers.forEach((value, key) => { result[key] = value; });
  return result;
}

function mtShouldProxy(url) {
  if (!mtProxyEl.enabled || !mtProxyEl.enabled.checked) return false;
  if (aiEl && aiEl.provider && aiEl.provider.value === 'mint') return false;
  try {
    const target = new URL(String(url));
    return target.origin !== location.origin;
  } catch (_) {
    return true;
  }
}

async function mtTestProxy() {
  try {
    const settings = mtSaveProxySettings(false);
    if (!settings.enabled) throw new Error('Bật “Dùng CORS proxy” trước.');
    const endpoint = mtProxyPath(settings.url, 'health');
    mtProxyEl.test.disabled = true;
    mtProxyStatus('Đang test Worker…');

    const response = await fetch(endpoint, {
      method: 'GET',
      credentials: 'omit',
      cache: 'no-store'
    });
    const text = await response.text();
    let data = null;
    try { data = JSON.parse(text); } catch (_) {}
    if (!response.ok) {
      const detail = (data && (data.message || data.error)) || text || `HTTP ${response.status}`;
      throw new Error(`HTTP ${response.status}: ${String(detail).slice(0, 400)}`);
    }
    if (!data || data.ok !== true) throw new Error('Worker có trả lời nhưng health response không hợp lệ.');
    const hosts = Array.isArray(data.allowedHosts) ? data.allowedHosts.join(', ') : '(ẩn)';
    mtProxyStatus('Proxy OK ✓\nAllowed hosts: ' + hosts, 'ok');
  } catch (error) {
    const msg = error && error.message ? error.message : String(error);
    mtProxyStatus('Proxy lỗi: ' + msg, 'error');
  } finally {
    if (mtProxyEl.test) mtProxyEl.test.disabled = !mtProxyEl.enabled.checked;
  }
}

// Keep the direct implementation from ai.js, then route BYOK calls through the Worker when enabled.
const mtDirectFetchAiJson = fetchAiJson;
fetchAiJson = async function (url, options, timeoutSeconds) {
  if (!mtShouldProxy(url)) return mtDirectFetchAiJson(url, options, timeoutSeconds);

  let settings;
  try {
    settings = mtSaveProxySettings(false);
  } catch (error) {
    throw new Error('Proxy config: ' + (error.message || String(error)));
  }

  const payload = {
    target: String(url),
    method: String((options && options.method) || 'POST').toUpperCase(),
    headers: mtHeadersToObject(options && options.headers),
    body: options && options.body != null ? String(options.body) : '',
    proxyToken: mtProxyEl.token ? mtProxyEl.token.value.trim() : ''
  };

  const endpoint = mtProxyPath(settings.url, 'proxy');
  try {
    return await mtDirectFetchAiJson(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }, timeoutSeconds);
  } catch (error) {
    let msg = error && error.message ? error.message : String(error);
    msg = msg.replace(/provider có thể không cho CORS từ GitHub Pages\.?/gi, 'Worker/proxy có thể chưa cho CORS hoặc chưa deploy xong.');
    throw new Error('Qua proxy: ' + msg);
  }
};

if (mtProxyEl.enabled) {
  mtApplyProxySettings(mtReadProxySettings());
  mtProxyEl.enabled.addEventListener('change', () => {
    mtUpdateProxyUi();
    try { mtSaveProxySettings(false); } catch (_) {}
  });
  mtProxyEl.url.addEventListener('change', () => { try { mtSaveProxySettings(false); } catch (_) {} });
  mtProxyEl.remember.addEventListener('change', () => { try { mtSaveProxySettings(false); } catch (_) {} });
  mtProxyEl.test.addEventListener('click', mtTestProxy);
  mtProxyEl.clearToken.addEventListener('click', () => {
    mtProxyEl.token.value = '';
    mtProxyEl.remember.checked = false;
    mtProxyRemove(MT_PROXY_TOKEN_KEY);
    mtProxyStatus('Đã xóa proxy token khỏi field và localStorage.', 'ok');
  });

  // Reuse the existing AI save/reset buttons so there is one settings workflow.
  if (aiEl && aiEl.save) aiEl.save.addEventListener('click', () => {
    try { mtSaveProxySettings(true); } catch (error) { mtProxyStatus(error.message || String(error), 'error'); }
  });
  if (aiEl && aiEl.reset) aiEl.reset.addEventListener('click', mtResetProxySettings);
}
