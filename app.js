'use strict';

const $ = s => document.querySelector(s);
const el = {
  where: $('#where'), authPill: $('#auth-pill'), token: $('#token'), remember: $('#remember-token'),
  testAuth: $('#test-auth'), clearToken: $('#clear-token'), authStatus: $('#auth-status'),
  mode: $('#mode'), src: $('#src'), dst: $('#dst'), next: $('#next'), empty: $('#empty'),
  task: $('#task'), kind: $('#kind'), title: $('#title'), image: $('#image'), source: $('#source'),
  links: $('#links'), answer: $('#answer'), count: $('#count'), skip: $('#skip'), publish: $('#publish'),
  taskStatus: $('#task-status'), stats: $('#stats')
};

const state = { token: '', current: null, busy: false, seen: new Set(), published: 0 };
const SAVED_TOKEN_KEY = 'microtranslate.oauth2.ownerOnlyToken';
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';

function setStatus(node, text, type = '') {
  node.textContent = text;
  node.className = 'status' + (type ? ' ' + type : '');
}

function networkHint(error) {
  const msg = error && error.message ? error.message : String(error);
  if (/failed to fetch|load failed|networkerror|network request failed/i.test(msg)) {
    return msg + '\n\nSafari/WebView chặn request hoặc mạng lỗi; token chưa chắc sai.';
  }
  return msg;
}

function cfg() {
  return el.mode.value === 'commons'
    ? { mode: 'commons', api: COMMONS_API }
    : { mode: 'wikidata', api: WIKIDATA_API };
}

function languages() {
  const src = el.src.value.trim().toLowerCase();
  const dst = el.dst.value.trim().toLowerCase();
  const re = /^[a-z][a-z0-9-]{1,14}$/i;
  if (!re.test(src) || !re.test(dst)) throw new Error('Mã ngôn ngữ không hợp lệ.');
  if (src === dst) throw new Error('Source và target đang giống nhau.');
  return { src, dst };
}

function setBusy(value) {
  state.busy = value;
  [el.mode, el.src, el.dst, el.next, el.skip, el.publish, el.answer]
    .forEach(node => { if (node) node.disabled = value; });
}

function normalizeToken(raw) {
  let token = String(raw || '').trim().replace(/^Bearer\s+/i, '').trim();
  if ((token.startsWith('"') && token.endsWith('"')) ||
      (token.startsWith("'") && token.endsWith("'"))) token = token.slice(1, -1).trim();
  return token;
}

function authHeaders() {
  if (!state.token) throw new Error('Chưa Test token.');
  return { Authorization: 'Bearer ' + state.token };
}

function apiUrl(api, params = {}, authenticated = false) {
  const url = new URL(api);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });
  if (authenticated) url.searchParams.set('crossorigin', '');
  else url.searchParams.set('origin', '*');
  return url;
}

async function readResponse(response) {
  const text = await response.text();
  let data = null;
  try { data = JSON.parse(text); } catch (_) {}
  if (!response.ok) {
    const detail = (data && data.error && (data.error.info || data.error.code)) ||
      (data && (data.error_description || data.message || data.error)) || text || ('HTTP ' + response.status);
    throw new Error('HTTP ' + response.status + ': ' + String(detail).slice(0, 500));
  }
  if (data && data.error) throw new Error(data.error.info || data.error.code || 'API error');
  return data !== null ? data : text;
}

async function publicGet(api, params) {
  const response = await fetch(apiUrl(api, params, false), {
    method: 'GET', credentials: 'omit', cache: 'no-store'
  });
  return await readResponse(response);
}

async function authGet(api, params) {
  const response = await fetch(apiUrl(api, params, true), {
    method: 'GET', headers: authHeaders(), credentials: 'omit', cache: 'no-store'
  });
  return await readResponse(response);
}

async function authPost(api, params) {
  const body = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) body.set(k, String(v));
  });
  const response = await fetch(apiUrl(api, {}, true), {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    credentials: 'omit', cache: 'no-store', body
  });
  return await readResponse(response);
}

function entities(data) {
  if (!data || !data.entities) return [];
  return Array.isArray(data.entities) ? data.entities : Object.values(data.entities);
}

try {
  const saved = localStorage.getItem(SAVED_TOKEN_KEY);
  if (saved) {
    el.token.value = saved;
    state.token = saved;
    el.remember.checked = true;
    el.authPill.textContent = 'token đã lưu';
    setStatus(el.authStatus, 'Đã nạp token lưu trên thiết bị. Bấm “Test token” để kiểm tra.');
  }
} catch (_) {}

el.where.textContent = location.hostname.includes('github.io') ? 'GitHub Pages' : location.protocol.replace(':', '');

async function testToken() {
  const typed = normalizeToken(el.token.value);
  if (!typed) return setStatus(el.authStatus, 'Chưa paste token.', 'error');
  state.token = typed;
  el.token.value = typed;
  el.testAuth.disabled = true;
  try {
    setStatus(el.authStatus, '1/2 — test OAuth trên Meta…');
    const profileResponse = await fetch('https://meta.wikimedia.org/w/rest.php/oauth2/resource/profile', {
      method: 'GET', headers: authHeaders(), credentials: 'omit', cache: 'no-store'
    });
    const profile = await readResponse(profileResponse);
    const profileName = profile && (profile.username || profile.name);

    setStatus(el.authStatus, '1/2 Meta OK' + (profileName ? ' — ' + profileName : '') + '\n2/2 — test Wikidata…');
    const data = await authGet(WIKIDATA_API, {
      action: 'query', meta: 'userinfo', uiprop: 'groups|rights', format: 'json', formatversion: 2
    });
    const info = data && data.query && data.query.userinfo;
    if (!info || !info.name || info.anon) throw new Error('Wikidata Action API vẫn xem request là anonymous.');

    el.authPill.textContent = info.name;
    if (el.remember.checked) localStorage.setItem(SAVED_TOKEN_KEY, state.token);
    else localStorage.removeItem(SAVED_TOKEN_KEY);
    setStatus(el.authStatus, 'OAuth OK — ' + info.name, 'ok');
  } catch (error) {
    state.token = '';
    el.authPill.textContent = 'lỗi';
    setStatus(el.authStatus, 'OAuth test fail:\n' + networkHint(error), 'error');
  } finally {
    el.testAuth.disabled = false;
  }
}

async function findWikidataTask() {
  const { src, dst } = languages();
  const random = await publicGet(`https://${dst}.wikipedia.org/w/api.php`, {
    action: 'query', generator: 'random', grnnamespace: 0, grnlimit: 40,
    prop: 'pageprops', ppprop: 'wikibase_item', format: 'json', formatversion: 2
  });
  const ids = ((random.query && random.query.pages) || [])
    .map(p => p.pageprops && p.pageprops.wikibase_item).filter(Boolean);
  if (!ids.length) return null;

  const data = await publicGet(WIKIDATA_API, {
    action: 'wbgetentities', ids: ids.join('|'), props: 'descriptions|sitelinks',
    languages: src + '|' + dst, sitefilter: src + 'wiki|' + dst + 'wiki',
    format: 'json', formatversion: 2
  });

  for (const entity of entities(data)) {
    if (!entity || state.seen.has(entity.id)) continue;
    const descriptions = entity.descriptions || {};
    const sitelinks = entity.sitelinks || {};
    const srcDescription = descriptions[src];
    const targetExists = Object.prototype.hasOwnProperty.call(descriptions, dst);
    const srcPage = sitelinks[src + 'wiki'];
    const dstPage = sitelinks[dst + 'wiki'];
    if (srcDescription && srcDescription.value && !targetExists && srcPage && dstPage) {
      return {
        kind: 'description', id: entity.id, title: dstPage.title, sourceText: srcDescription.value,
        sourceUrl: `https://${src}.wikipedia.org/wiki/${encodeURIComponent(srcPage.title.replace(/ /g, '_'))}`,
        targetUrl: `https://${dst}.wikipedia.org/wiki/${encodeURIComponent(dstPage.title.replace(/ /g, '_'))}`,
        entityUrl: `https://www.wikidata.org/wiki/${encodeURIComponent(entity.id)}`
      };
    }
  }
  return null;
}

async function findCommonsTask() {
  const { src, dst } = languages();
  const search = await publicGet(COMMONS_API, {
    action: 'query', generator: 'search', gsrsearch: `hascaption:${src} -hascaption:${dst}`,
    gsrnamespace: 6, gsrlimit: 40, prop: 'imageinfo', iiprop: 'url', iiurlwidth: 700,
    format: 'json', formatversion: 2
  });
  const pages = ((search.query && search.query.pages) || []).filter(p => !state.seen.has('M' + p.pageid));
  const ids = pages.map(p => 'M' + p.pageid);
  if (!ids.length) return null;

  const data = await publicGet(COMMONS_API, {
    action: 'wbgetentities', ids: ids.join('|'), props: 'labels', languages: src + '|' + dst,
    format: 'json', formatversion: 2
  });
  for (const entity of entities(data)) {
    if (!entity || state.seen.has(entity.id)) continue;
    const labels = entity.labels || {};
    const sourceLabel = labels[src];
    const targetExists = Object.prototype.hasOwnProperty.call(labels, dst);
    if (!sourceLabel || !sourceLabel.value || targetExists) continue;
    const page = pages.find(p => 'M' + p.pageid === entity.id);
    if (!page) continue;
    const info = page.imageinfo && page.imageinfo[0];
    return {
      kind: 'caption', id: entity.id, title: page.title.replace(/^File:/i, ''),
      sourceText: sourceLabel.value, image: info && (info.thumburl || info.url) || '',
      entityUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`
    };
  }
  return null;
}

async function findTask() {
  for (let i = 0; i < 8; i++) {
    const task = cfg().mode === 'wikidata' ? await findWikidataTask() : await findCommonsTask();
    if (task) return task;
  }
  return null;
}

function addLink(label, href) {
  const a = document.createElement('a');
  a.textContent = label; a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer';
  el.links.appendChild(a);
}

function renderTask() {
  if (!state.current) {
    el.task.classList.add('hidden'); el.empty.classList.remove('hidden'); return;
  }
  const item = state.current;
  const { src, dst } = languages();
  el.kind.textContent = item.kind === 'description'
    ? `Dịch mô tả ${src.toUpperCase()} → ${dst.toUpperCase()}`
    : `Dịch caption ${src.toUpperCase()} → ${dst.toUpperCase()}`;
  el.title.textContent = item.title;
  el.source.textContent = item.sourceText;
  el.answer.value = '';
  el.count.textContent = '0 / 250';
  el.links.innerHTML = '';
  if (item.image) { el.image.src = item.image; el.image.classList.remove('hidden'); }
  else { el.image.removeAttribute('src'); el.image.classList.add('hidden'); }
  if (item.sourceUrl) addLink(src.toUpperCase() + ' article', item.sourceUrl);
  if (item.targetUrl) addLink(dst.toUpperCase() + ' article', item.targetUrl);
  addLink(item.id, item.entityUrl);
  el.empty.classList.add('hidden'); el.task.classList.remove('hidden');
  setTimeout(() => el.answer.focus(), 50);
}

async function nextTask() {
  if (state.busy) return;
  try {
    languages(); setBusy(true); state.current = null; renderTask();
    setStatus(el.taskStatus, 'Đang tìm micro-edit…');
    const item = await findTask();
    if (!item) throw new Error('Chưa tìm được task phù hợp. Bấm Next thử lại.');
    state.current = item; renderTask(); setStatus(el.taskStatus, 'Task ' + item.id);
  } catch (error) {
    setStatus(el.taskStatus, 'Lỗi: ' + networkHint(error), 'error');
  } finally { setBusy(false); }
}

async function csrfToken(api) {
  const data = await authGet(api, {
    action: 'query', meta: 'tokens', type: 'csrf', format: 'json', formatversion: 2
  });
  const token = data && data.query && data.query.tokens && data.query.tokens.csrftoken;
  if (!token || token === '+\\') throw new Error('Không lấy được CSRF token.');
  return token;
}

async function recheckTarget(item) {
  const { dst } = languages();
  const api = item.kind === 'description' ? WIKIDATA_API : COMMONS_API;
  const prop = item.kind === 'description' ? 'descriptions' : 'labels';
  const data = await publicGet(api, {
    action: 'wbgetentities', ids: item.id, props: prop, languages: dst,
    format: 'json', formatversion: 2
  });
  const entity = entities(data)[0];
  if (!entity) throw new Error('Không đọc lại được entity.');
  if (Object.prototype.hasOwnProperty.call(entity[prop] || {}, dst)) {
    throw new Error(`Có người vừa thêm ${dst} rồi; không ghi đè.`);
  }
}

async function publishCurrent() {
  if (!state.current || state.busy) return;
  const value = el.answer.value.trim();
  if (!value) return setStatus(el.taskStatus, 'Chưa nhập bản dịch.', 'error');
  if (!state.token) return setStatus(el.taskStatus, 'Test token trước khi publish.', 'error');

  try {
    setBusy(true); setStatus(el.taskStatus, 'Đang kiểm tra target…');
    const item = state.current;
    const { src, dst } = languages();
    const api = item.kind === 'description' ? WIKIDATA_API : COMMONS_API;

    await recheckTarget(item);
    const csrf = await csrfToken(api);

    // v2.3: deliberately NO baserevid. It is optional for these Wikibase modules.
    await authPost(api, {
      action: item.kind === 'description' ? 'wbsetdescription' : 'wbsetlabel',
      id: item.id, language: dst, value, token: csrf,
      assert: 'user', maxlag: 5,
      summary: `MicroTranslate web v2.3: ${src} → ${dst}`,
      format: 'json', formatversion: 2
    });

    state.seen.add(item.id); state.published += 1;
    el.stats.textContent = 'Đã đăng phiên này: ' + state.published;
    setStatus(el.taskStatus, 'Đăng xong ✓', 'ok');
    state.current = null;
    await nextTask();
  } catch (error) {
    setStatus(el.taskStatus, 'Lỗi đăng: ' + networkHint(error), 'error');
  } finally { setBusy(false); }
}

el.testAuth.addEventListener('click', testToken);
el.clearToken.addEventListener('click', () => {
  state.token = ''; el.token.value = ''; el.remember.checked = false;
  try { localStorage.removeItem(SAVED_TOKEN_KEY); } catch (_) {}
  el.authPill.textContent = 'chưa test';
  setStatus(el.authStatus, 'Đã xóa token khỏi trang và browser storage.', 'ok');
});
el.next.addEventListener('click', nextTask);
el.skip.addEventListener('click', async () => {
  if (state.current) state.seen.add(state.current.id);
  state.current = null; await nextTask();
});
el.publish.addEventListener('click', publishCurrent);
el.answer.addEventListener('input', () => { el.count.textContent = `${el.answer.value.length} / 250`; });
el.mode.addEventListener('change', () => { state.current = null; renderTask(); });
