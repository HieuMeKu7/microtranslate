'use strict';

/* MicroTranslate v2.4 — AI/MT suggestions using Wikimedia MinT. */

const aiEl = {
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

function resetAiSuggestion() {
  aiState.itemId = null;
  aiState.suggestion = '';
  if (aiEl.text) aiEl.text.textContent = '';
  if (aiEl.panel) aiEl.panel.classList.add('hidden');
  aiStatus('');
}

function htmlToPlainText(html) {
  const template = document.createElement('template');
  template.innerHTML = String(html || '');
  return (template.content.textContent || '').replace(/\s+/g, ' ').trim();
}

async function requestMinTSuggestion() {
  if (aiState.busy) return;
  if (!state.current) {
    aiStatus('Lấy task trước rồi mới xin gợi ý AI.', 'error');
    return;
  }

  const item = state.current;
  const { src, dst } = languages();
  const endpoint = `https://cxserver.wikimedia.org/v1/mt/${encodeURIComponent(src)}/${encodeURIComponent(dst)}/MinT`;

  aiState.busy = true;
  aiEl.suggest.disabled = true;
  aiEl.again.disabled = true;
  aiEl.apply.disabled = true;
  aiStatus('MinT đang dịch…');

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    let response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: `<p>${String(item.sourceText)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')}</p>` }),
        cache: 'no-store',
        credentials: 'omit',
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
    }

    const raw = await response.text();
    let data = null;
    try { data = JSON.parse(raw); } catch (_) {}

    if (!response.ok) {
      const detail = (data && (data.detail || data.message || data.error)) || raw || `HTTP ${response.status}`;
      throw new Error(`HTTP ${response.status}: ${String(detail).slice(0, 400)}`);
    }

    const translatedHtml = data && data.html;
    const suggestion = htmlToPlainText(translatedHtml);
    if (!suggestion) throw new Error('MinT không trả bản dịch.');

    aiState.itemId = item.id;
    aiState.suggestion = suggestion;
    aiEl.text.textContent = suggestion;
    aiEl.panel.classList.remove('hidden');
    aiEl.apply.disabled = false;
    aiStatus(`Gợi ý từ Wikimedia MinT • ${suggestion.length} ký tự`, 'ok');
  } catch (error) {
    const msg = error && error.name === 'AbortError'
      ? 'MinT timeout sau 30 giây.'
      : (error && error.message ? error.message : String(error));
    aiStatus('AI lỗi: ' + msg, 'error');
  } finally {
    aiState.busy = false;
    aiEl.suggest.disabled = false;
    aiEl.again.disabled = false;
  }
}

function applyAiSuggestion() {
  if (!state.current || !aiState.suggestion || aiState.itemId !== state.current.id) {
    aiStatus('Gợi ý này không còn khớp task hiện tại. Bấm AI gợi ý lại.', 'error');
    return;
  }

  el.answer.value = aiState.suggestion;
  el.answer.dispatchEvent(new Event('input', { bubbles: true }));
  el.answer.focus();
  setStatus(el.taskStatus, 'Đã áp dụng gợi ý AI. Kiểm tra/sửa lại trước khi đăng.', 'ok');
}

if (aiEl.suggest) aiEl.suggest.addEventListener('click', requestMinTSuggestion);
if (aiEl.again) aiEl.again.addEventListener('click', requestMinTSuggestion);
if (aiEl.apply) aiEl.apply.addEventListener('click', applyAiSuggestion);

// A new title means a new task; never carry an old suggestion across tasks.
if (el.title) {
  new MutationObserver(() => resetAiSuggestion()).observe(el.title, {
    childList: true,
    characterData: true,
    subtree: true
  });
}
