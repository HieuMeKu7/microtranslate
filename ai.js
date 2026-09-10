'use strict';

/* MicroTranslate v2.5 — MinT + detailed BYOK AI providers. */

const AI_SETTINGS_KEY = 'microtranslate.ai.settings.v2.5';
const AI_OPENAI_KEY = 'microtranslate.ai.openaiKey.v2.5';
const AI_GENERIC_KEY = 'microtranslate.ai.genericKey.v2.5';

const DEFAULT_SYSTEM_PROMPT = `You are a meticulous Wikimedia micro-translation assistant.
Translate exactly one short metadata string from the source language to the target language.

Rules:
1. Return ONLY the final translation. No explanation, markdown, quotation marks, alternatives, labels, or preface.
2. Preserve the factual meaning exactly. Do not add, infer, embellish, or remove facts.
3. Preserve proper nouns, technical terms, dates, numbers, and named entities accurately; transliterate only when natural in the target language.
4. Keep the result concise and natural in the target language.
5. For a Wikidata description, prefer a short neutral descriptive noun phrase rather than a full promotional sentence.
6. For a Wikimedia Commons image caption, describe the same content naturally and concisely without inventing visual details.
7. Keep the result under 250 Unicode characters.
8. If the source is ambiguous, choose the most literal faithful translation rather than guessing extra context.`;

const DEFAULT_USER_PROMPT = `Task type: {{taskType}}
Context/title: {{title}}
Source language: {{src}}
Target language: {{dst}}
Source text: {{source}}

Return only the final {{dst}} translation.`;

const AI_DEFAULTS = {
  provider: 'mint',
  openaiStyle: 'chat',
  openaiEndpoint: 'https://api.openai.com/v1/chat/completions',
  openaiModel: '',
  temperature: '',
  maxTokens: '',
  openaiHeaders: '{}',
  openaiBody: '{}',
  openaiRemember: false,
  genericEndpoint: '',
  genericMethod: 'POST',
  genericModel: '',
  genericHeaders: '{"Authorization":"Bearer {{key}}","Content-Type":"application/json"}',
  genericBody: '{"model":"{{model}}","messages":[{"role":"system","content":"{{system}}"},{"role":"user","content":"{{prompt}}"}]}',
  genericResponsePath: 'choices.0.message.content',
  genericRemember: false,
  timeout: 30,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  userPrompt: DEFAULT_USER_PROMPT
};

const aiEl = {
  provider: document.querySelector('#ai-provider'),
  providerNote: document.querySelector('#ai-provider-note'),
  providerLabel: document.querySelector('#ai-provider-label'),
  openaiBox: document.querySelector('#ai-openai-config'),
  genericBox: document.querySelector('#ai-generic-config'),
  commonBox: document.querySelector('#ai-byok-common'),
  openaiStyle: document.querySelector('#ai-openai-style'),
  openaiEndpoint: document.querySelector('#ai-openai-endpoint'),
  openaiModel: document.querySelector('#ai-openai-model'),
  openaiKey: document.querySelector('#ai-openai-key'),
  openaiRemember: document.querySelector('#ai-openai-remember'),
  openaiClearKey: document.querySelector('#ai-openai-clear-key'),
  temperature: document.querySelector('#ai-temperature'),
  maxTokens: document.querySelector('#ai-max-tokens'),
  openaiHeaders: document.querySelector('#ai-openai-headers'),
  openaiBody: document.querySelector('#ai-openai-body'),
  genericEndpoint: document.querySelector('#ai-generic-endpoint'),
  genericMethod: document.querySelector('#ai-generic-method'),
  genericModel: document.querySelector('#ai-generic-model'),
  genericKey: document.querySelector('#ai-generic-key'),
  genericRemember: document.querySelector('#ai-generic-remember'),
  genericClearKey: document.querySelector('#ai-generic-clear-key'),
  genericHeaders: document.querySelector('#ai-generic-headers'),
  genericBody: document.querySelector('#ai-generic-body'),
  genericResponsePath: document.querySelector('#ai-generic-response-path'),
  timeout: document.querySelector('#ai-timeout'),
  systemPrompt: document.querySelector('#ai-system-prompt'),
  userPrompt: document.querySelector('#ai-user-prompt'),
  save: document.querySelector('#ai-save-config'),
  reset: document.querySelector('#ai-reset-config'),
  configStatus: document.querySelector('#ai-config-status'),
  suggest: document.querySelector('#ai-suggest'),
  apply: document.querySelector('#ai-apply'),
  again: document.querySelector('#ai-again'),
  panel: document.querySelector('#ai-panel'),
  text: document.querySelector('#ai-text'),
  status: document.querySelector('#ai-status')
};

const aiState = { itemId: null, suggestion: '', busy: false };

function aiStatus(text, type = '') {
  if (!aiEl.status) return;
  aiEl.status.textContent = text;
  aiEl.status.className = 'ai-status' + (type ? ' ' + type : '');
}

function configStatus(text, type = '') {
  if (!aiEl.configStatus) return;
  aiEl.configStatus.textContent = text;
  aiEl.configStatus.className = 'ai-config-status' + (type ? ' ' + type : '');
}

function resetAiSuggestion() {
  aiState.itemId = null;
  aiState.suggestion = '';
  if (aiEl.text) aiEl.text.textContent = '';
  if (aiEl.panel) aiEl.panel.classList.add('hidden');
  if (aiEl.apply) aiEl.apply.disabled = true;
  aiStatus('');
}

function safeLocalGet(key) {
  try { return localStorage.getItem(key); } catch (_) { return null; }
}

function safeLocalSet(key, value) {
  try { localStorage.setItem(key, value); return true; } catch (_) { return false; }
}

function safeLocalRemove(key) {
  try { localStorage.removeItem(key); } catch (_) {}
}

function readSavedSettings() {
  const raw = safeLocalGet(AI_SETTINGS_KEY);
  if (!raw) return { ...AI_DEFAULTS };
  try { return { ...AI_DEFAULTS, ...JSON.parse(raw) }; }
  catch (_) { return { ...AI_DEFAULTS }; }
}

function putValue(node, value) {
  if (node) node.value = value == null ? '' : String(value);
}

function putChecked(node, value) {
  if (node) node.checked = Boolean(value);
}

function applySettingsToUi(settings) {
  putValue(aiEl.provider, settings.provider);
  putValue(aiEl.openaiStyle, settings.openaiStyle);
  putValue(aiEl.openaiEndpoint, settings.openaiEndpoint);
  putValue(aiEl.openaiModel, settings.openaiModel);
  putValue(aiEl.temperature, settings.temperature);
  putValue(aiEl.maxTokens, settings.maxTokens);
  putValue(aiEl.openaiHeaders, settings.openaiHeaders);
  putValue(aiEl.openaiBody, settings.openaiBody);
  putChecked(aiEl.openaiRemember, settings.openaiRemember);
  putValue(aiEl.genericEndpoint, settings.genericEndpoint);
  putValue(aiEl.genericMethod, settings.genericMethod);
  putValue(aiEl.genericModel, settings.genericModel);
  putValue(aiEl.genericHeaders, settings.genericHeaders);
  putValue(aiEl.genericBody, settings.genericBody);
  putValue(aiEl.genericResponsePath, settings.genericResponsePath);
  putChecked(aiEl.genericRemember, settings.genericRemember);
  putValue(aiEl.timeout, settings.timeout);
  putValue(aiEl.systemPrompt, settings.systemPrompt || DEFAULT_SYSTEM_PROMPT);
  putValue(aiEl.userPrompt, settings.userPrompt || DEFAULT_USER_PROMPT);

  if (settings.openaiRemember) putValue(aiEl.openaiKey, safeLocalGet(AI_OPENAI_KEY) || '');
  if (settings.genericRemember) putValue(aiEl.genericKey, safeLocalGet(AI_GENERIC_KEY) || '');
  updateProviderUi();
}

function collectSettings() {
  return {
    provider: aiEl.provider.value,
    openaiStyle: aiEl.openaiStyle.value,
    openaiEndpoint: aiEl.openaiEndpoint.value.trim(),
    openaiModel: aiEl.openaiModel.value.trim(),
    temperature: aiEl.temperature.value.trim(),
    maxTokens: aiEl.maxTokens.value.trim(),
    openaiHeaders: aiEl.openaiHeaders.value.trim() || '{}',
    openaiBody: aiEl.openaiBody.value.trim() || '{}',
    openaiRemember: aiEl.openaiRemember.checked,
    genericEndpoint: aiEl.genericEndpoint.value.trim(),
    genericMethod: aiEl.genericMethod.value,
    genericModel: aiEl.genericModel.value.trim(),
    genericHeaders: aiEl.genericHeaders.value.trim() || '{}',
    genericBody: aiEl.genericBody.value.trim() || '{}',
    genericResponsePath: aiEl.genericResponsePath.value.trim(),
    genericRemember: aiEl.genericRemember.checked,
    timeout: Math.max(5, Math.min(120, Number(aiEl.timeout.value) || 30)),
    systemPrompt: aiEl.systemPrompt.value.trim() || DEFAULT_SYSTEM_PROMPT,
    userPrompt: aiEl.userPrompt.value.trim() || DEFAULT_USER_PROMPT
  };
}

function validateJsonObject(text, label) {
  let value;
  try { value = JSON.parse(text || '{}'); }
  catch (error) { throw new Error(label + ' không phải JSON hợp lệ: ' + error.message); }
  if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error(label + ' phải là JSON object.');
  return value;
}

function validateSettings(settings) {
  if (settings.provider === 'openai') {
    if (!/^https?:\/\//i.test(settings.openaiEndpoint)) throw new Error('OpenAI-compatible endpoint phải là URL http/https đầy đủ.');
    if (!settings.openaiModel) throw new Error('OpenAI-compatible cần model ID.');
    validateJsonObject(settings.openaiHeaders, 'Extra headers');
    validateJsonObject(settings.openaiBody, 'Extra body');
  }
  if (settings.provider === 'generic') {
    if (!/^https?:\/\//i.test(settings.genericEndpoint)) throw new Error('General endpoint phải là URL http/https đầy đủ.');
    validateJsonObject(renderJsonTemplate(settings.genericHeaders, templateVars(null, settings)), 'Headers template');
    validateJsonObject(renderJsonTemplate(settings.genericBody, templateVars(null, settings)), 'Body template');
  }
}

function saveAiSettings(showStatus = true) {
  try {
    const settings = collectSettings();
    validateSettings(settings);
    safeLocalSet(AI_SETTINGS_KEY, JSON.stringify(settings));

    if (settings.openaiRemember) safeLocalSet(AI_OPENAI_KEY, aiEl.openaiKey.value.trim());
    else safeLocalRemove(AI_OPENAI_KEY);
    if (settings.genericRemember) safeLocalSet(AI_GENERIC_KEY, aiEl.genericKey.value.trim());
    else safeLocalRemove(AI_GENERIC_KEY);

    if (showStatus) configStatus('Đã lưu cài đặt AI. Secret chỉ được lưu nếu bạn tick “Nhớ key”.', 'ok');
    return settings;
  } catch (error) {
    if (showStatus) configStatus(error.message || String(error), 'error');
    throw error;
  }
}

function resetAiSettings() {
  safeLocalRemove(AI_SETTINGS_KEY);
  safeLocalRemove(AI_OPENAI_KEY);
  safeLocalRemove(AI_GENERIC_KEY);
  putValue(aiEl.openaiKey, '');
  putValue(aiEl.genericKey, '');
  applySettingsToUi({ ...AI_DEFAULTS });
  configStatus('Đã reset AI về Wikimedia MinT và xóa BYOK key đã lưu.', 'ok');
  resetAiSuggestion();
}

function updateProviderUi() {
  const provider = aiEl.provider ? aiEl.provider.value : 'mint';
  aiEl.openaiBox.classList.toggle('hidden', provider !== 'openai');
  aiEl.genericBox.classList.toggle('hidden', provider !== 'generic');
  aiEl.commonBox.classList.toggle('hidden', provider === 'mint');

  if (provider === 'mint') {
    aiEl.providerNote.textContent = 'Dịch máy Wikimedia MinT qua CXServer; không cần API key riêng.';
    aiEl.providerLabel.textContent = 'Wikimedia MinT';
  } else if (provider === 'openai') {
    const model = aiEl.openaiModel.value.trim();
    aiEl.providerNote.textContent = 'Chuẩn OpenAI-compatible. Chat Completions là mode tương thích rộng nhất; Responses dành cho endpoint hỗ trợ schema Responses.';
    aiEl.providerLabel.textContent = 'OpenAI-compatible' + (model ? ' · ' + model : '');
  } else {
    const model = aiEl.genericModel.value.trim();
    aiEl.providerNote.textContent = 'General mode cho API JSON tùy biến: tự đặt endpoint, header/body template và response path.';
    aiEl.providerLabel.textContent = 'General JSON' + (model ? ' · ' + model : '');
  }
}

function taskTypeName(item) {
  return item && item.kind === 'caption' ? 'Wikimedia Commons image caption' : 'Wikidata description';
}

function templateVars(item, settings) {
  let src = '', dst = '';
  try { ({ src, dst } = languages()); } catch (_) {}
  const system = settings && settings.systemPrompt ? settings.systemPrompt : (aiEl.systemPrompt.value || DEFAULT_SYSTEM_PROMPT);
  const vars = {
    taskType: taskTypeName(item),
    title: item && item.title ? item.title : '',
    source: item && item.sourceText ? item.sourceText : '',
    src,
    dst,
    model: settings ? (settings.openaiModel || settings.genericModel || '') : '',
    key: '',
    system,
    prompt: ''
  };
  const promptTemplate = settings && settings.userPrompt ? settings.userPrompt : (aiEl.userPrompt.value || DEFAULT_USER_PROMPT);
  vars.prompt = renderTextTemplate(promptTemplate, vars);
  return vars;
}

function renderTextTemplate(template, vars) {
  return String(template || '').replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key) => String(vars[key] == null ? '' : vars[key]));
}

function jsonStringEscape(value) {
  return JSON.stringify(String(value == null ? '' : value)).slice(1, -1);
}

function renderJsonTemplate(template, vars) {
  return String(template || '').replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key) => jsonStringEscape(vars[key] == null ? '' : vars[key]));
}

function parseJsonTemplate(template, vars, label) {
  const rendered = renderJsonTemplate(template, vars);
  return validateJsonObject(rendered, label);
}

function htmlToPlainText(html) {
  const template = document.createElement('template');
  template.innerHTML = String(html || '');
  return (template.content.textContent || '').replace(/\s+/g, ' ').trim();
}

function cleanSuggestion(text) {
  let value = String(text || '').trim();
  value = value.replace(/^```(?:text|markdown)?\s*/i, '').replace(/\s*```$/i, '').trim();
  if ((value.startsWith('“') && value.endsWith('”')) ||
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1).trim();
  }
  return value.replace(/\n{3,}/g, '\n\n');
}

function contentToText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map(part => {
      if (typeof part === 'string') return part;
      if (!part || typeof part !== 'object') return '';
      if (typeof part.text === 'string') return part.text;
      if (typeof part.content === 'string') return part.content;
      if (part.text && typeof part.text.value === 'string') return part.text.value;
      return '';
    }).join('');
  }
  if (content && typeof content === 'object') {
    if (typeof content.text === 'string') return content.text;
    if (typeof content.value === 'string') return content.value;
  }
  return '';
}

function extractOpenAIText(data) {
  if (!data) return '';
  if (typeof data.output_text === 'string') return data.output_text;
  if (data.choices && data.choices[0]) {
    const choice = data.choices[0];
    if (choice.message) {
      const text = contentToText(choice.message.content);
      if (text) return text;
    }
    if (typeof choice.text === 'string') return choice.text;
  }
  if (Array.isArray(data.output)) {
    for (const item of data.output) {
      if (!item) continue;
      const text = contentToText(item.content);
      if (text) return text;
    }
  }
  return '';
}

function pathTokens(path) {
  return String(path || '').replace(/\[(\d+)\]/g, '.$1').split('.').map(s => s.trim()).filter(Boolean);
}

function valueAtPath(data, path) {
  let value = data;
  for (const token of pathTokens(path)) {
    if (value == null) return undefined;
    value = value[token];
  }
  return value;
}

function extractGenericText(data, path, rawText) {
  if (path) {
    const found = valueAtPath(data, path);
    const text = contentToText(found) || (typeof found === 'number' ? String(found) : '');
    if (text) return text;
  }

  const common = extractOpenAIText(data);
  if (common) return common;

  const fallbackPaths = [
    'text', 'response', 'result', 'generated_text', 'data.0.text',
    'candidates.0.content.parts.0.text', 'content.0.text'
  ];
  for (const p of fallbackPaths) {
    const found = valueAtPath(data, p);
    const text = contentToText(found) || (typeof found === 'string' ? found : '');
    if (text) return text;
  }

  if (typeof rawText === 'string' && rawText.trim() && !data) return rawText.trim();
  return '';
}

function timeoutSignal(seconds) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(5, Math.min(120, Number(seconds) || 30)) * 1000);
  return { controller, timer };
}

async function fetchAiJson(url, options, timeoutSeconds) {
  const { controller, timer } = timeoutSignal(timeoutSeconds);
  const started = performance.now();
  try {
    const response = await fetch(url, { ...options, signal: controller.signal, cache: 'no-store', credentials: 'omit' });
    const raw = await response.text();
    let data = null;
    try { data = JSON.parse(raw); } catch (_) {}
    if (!response.ok) {
      const detail = (data && data.error && (data.error.message || data.error.info || data.error.code)) ||
        (data && (data.message || data.detail || data.error_description)) || raw || `HTTP ${response.status}`;
      throw new Error(`HTTP ${response.status}: ${String(detail).slice(0, 500)}`);
    }
    return { data, raw, ms: Math.round(performance.now() - started) };
  } catch (error) {
    if (error && error.name === 'AbortError') throw new Error(`Timeout sau ${timeoutSeconds} giây.`);
    if (/failed to fetch|load failed|networkerror/i.test(error && error.message || '')) {
      throw new Error((error.message || 'Network error') + ' — provider có thể không cho CORS từ GitHub Pages.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function requestMinT(item) {
  const { src, dst } = languages();
  const endpoint = `https://cxserver.wikimedia.org/v1/mt/${encodeURIComponent(src)}/${encodeURIComponent(dst)}/MinT`;
  const escaped = String(item.sourceText).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const result = await fetchAiJson(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html: `<p>${escaped}</p>` })
  }, Number(aiEl.timeout.value) || 30);
  const suggestion = htmlToPlainText(result.data && result.data.html);
  if (!suggestion) throw new Error('MinT không trả bản dịch.');
  return { suggestion, detail: `Wikimedia MinT • ${result.ms} ms` };
}

async function requestOpenAI(item, settings) {
  const endpoint = settings.openaiEndpoint;
  const model = settings.openaiModel;
  const apiKey = aiEl.openaiKey.value.trim();
  const vars = templateVars(item, settings);
  const system = renderTextTemplate(settings.systemPrompt, vars);
  const prompt = renderTextTemplate(settings.userPrompt, { ...vars, system });

  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = 'Bearer ' + apiKey;
  Object.assign(headers, validateJsonObject(settings.openaiHeaders, 'Extra headers'));

  let body;
  if (settings.openaiStyle === 'responses') {
    body = { model, instructions: system, input: prompt };
    if (settings.maxTokens !== '') body.max_output_tokens = Number(settings.maxTokens);
    if (settings.temperature !== '') body.temperature = Number(settings.temperature);
  } else {
    body = {
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt }
      ]
    };
    if (settings.maxTokens !== '') body.max_tokens = Number(settings.maxTokens);
    if (settings.temperature !== '') body.temperature = Number(settings.temperature);
  }
  Object.assign(body, validateJsonObject(settings.openaiBody, 'Extra body'));

  const result = await fetchAiJson(endpoint, {
    method: 'POST', headers, body: JSON.stringify(body)
  }, settings.timeout);

  const suggestion = cleanSuggestion(extractOpenAIText(result.data));
  if (!suggestion) throw new Error('Không tìm thấy text trong response OpenAI-compatible.');
  return { suggestion, detail: `OpenAI-compatible • ${model} • ${result.ms} ms` };
}

async function requestGeneric(item, settings) {
  const key = aiEl.genericKey.value.trim();
  const vars0 = templateVars(item, settings);
  const system = renderTextTemplate(settings.systemPrompt, vars0);
  const prompt = renderTextTemplate(settings.userPrompt, { ...vars0, system });
  const vars = { ...vars0, key, model: settings.genericModel, system, prompt };

  const headers = parseJsonTemplate(settings.genericHeaders, vars, 'Headers template');
  if (!Object.keys(headers).some(k => k.toLowerCase() === 'content-type')) headers['Content-Type'] = 'application/json';
  const body = parseJsonTemplate(settings.genericBody, vars, 'Body template');

  const result = await fetchAiJson(settings.genericEndpoint, {
    method: settings.genericMethod || 'POST', headers, body: JSON.stringify(body)
  }, settings.timeout);

  const suggestion = cleanSuggestion(extractGenericText(result.data, settings.genericResponsePath, result.raw));
  if (!suggestion) throw new Error('Không lấy được text. Kiểm tra “Response text JSON path”.');
  return { suggestion, detail: `General JSON${settings.genericModel ? ' • ' + settings.genericModel : ''} • ${result.ms} ms` };
}

async function requestAiSuggestion() {
  if (aiState.busy) return;
  if (!state.current) return aiStatus('Lấy task trước rồi mới xin gợi ý AI.', 'error');

  let settings;
  try {
    settings = collectSettings();
    validateSettings(settings);
  } catch (error) {
    aiStatus('Cấu hình AI lỗi: ' + (error.message || error), 'error');
    return;
  }

  aiState.busy = true;
  aiEl.suggest.disabled = true;
  aiEl.again.disabled = true;
  aiEl.apply.disabled = true;
  aiStatus('Đang gọi ' + aiEl.providerLabel.textContent + '…');

  try {
    const item = state.current;
    let result;
    if (settings.provider === 'openai') result = await requestOpenAI(item, settings);
    else if (settings.provider === 'generic') result = await requestGeneric(item, settings);
    else result = await requestMinT(item);

    const suggestion = cleanSuggestion(result.suggestion);
    if (!suggestion) throw new Error('AI trả bản dịch rỗng.');

    aiState.itemId = item.id;
    aiState.suggestion = suggestion;
    aiEl.text.textContent = suggestion;
    aiEl.panel.classList.remove('hidden');
    aiEl.apply.disabled = false;
    const lengthNote = suggestion.length > 250 ? ` • ${suggestion.length} ký tự (dài hơn 250)` : ` • ${suggestion.length} ký tự`;
    aiStatus(result.detail + lengthNote, suggestion.length > 250 ? 'error' : 'ok');
  } catch (error) {
    aiStatus('AI lỗi: ' + (error && error.message ? error.message : String(error)), 'error');
  } finally {
    aiState.busy = false;
    aiEl.suggest.disabled = false;
    aiEl.again.disabled = false;
  }
}

function applyAiSuggestion() {
  if (!state.current || !aiState.suggestion || aiState.itemId !== state.current.id) {
    return aiStatus('Gợi ý này không còn khớp task hiện tại. Bấm AI gợi ý lại.', 'error');
  }
  if (aiState.suggestion.length > 250) {
    aiStatus(`Gợi ý dài ${aiState.suggestion.length} ký tự; chưa áp dụng vì ô dịch giới hạn 250. Hãy chỉnh prompt hoặc gợi ý lại.`, 'error');
    return;
  }
  el.answer.value = aiState.suggestion;
  el.answer.dispatchEvent(new Event('input', { bubbles: true }));
  el.answer.focus();
  setStatus(el.taskStatus, 'Đã áp dụng gợi ý AI. Kiểm tra/sửa lại trước khi đăng.', 'ok');
}

function maybeAdjustOpenAIEndpoint() {
  const value = aiEl.openaiEndpoint.value.trim();
  if (aiEl.openaiStyle.value === 'responses' && /\/chat\/completions\/?$/i.test(value)) {
    aiEl.openaiEndpoint.value = value.replace(/\/chat\/completions\/?$/i, '/responses');
  } else if (aiEl.openaiStyle.value === 'chat' && /\/responses\/?$/i.test(value)) {
    aiEl.openaiEndpoint.value = value.replace(/\/responses\/?$/i, '/chat/completions');
  }
}

function persistProviderOnly() {
  const current = readSavedSettings();
  current.provider = aiEl.provider.value;
  safeLocalSet(AI_SETTINGS_KEY, JSON.stringify(current));
}

applySettingsToUi(readSavedSettings());

aiEl.provider.addEventListener('change', () => {
  updateProviderUi();
  persistProviderOnly();
  resetAiSuggestion();
});
aiEl.openaiModel.addEventListener('input', updateProviderUi);
aiEl.genericModel.addEventListener('input', updateProviderUi);
aiEl.openaiStyle.addEventListener('change', maybeAdjustOpenAIEndpoint);
aiEl.save.addEventListener('click', () => { try { saveAiSettings(true); updateProviderUi(); } catch (_) {} });
aiEl.reset.addEventListener('click', resetAiSettings);
aiEl.openaiClearKey.addEventListener('click', () => {
  aiEl.openaiKey.value = '';
  aiEl.openaiRemember.checked = false;
  safeLocalRemove(AI_OPENAI_KEY);
  configStatus('Đã xóa OpenAI-compatible key khỏi field và localStorage.', 'ok');
});
aiEl.genericClearKey.addEventListener('click', () => {
  aiEl.genericKey.value = '';
  aiEl.genericRemember.checked = false;
  safeLocalRemove(AI_GENERIC_KEY);
  configStatus('Đã xóa General API key khỏi field và localStorage.', 'ok');
});
aiEl.suggest.addEventListener('click', requestAiSuggestion);
aiEl.again.addEventListener('click', requestAiSuggestion);
aiEl.apply.addEventListener('click', applyAiSuggestion);

if (el.title) {
  new MutationObserver(() => resetAiSuggestion()).observe(el.title, {
    childList: true, characterData: true, subtree: true
  });
}
