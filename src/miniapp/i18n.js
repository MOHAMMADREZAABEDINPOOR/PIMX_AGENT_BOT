import { ENGLISH, PHRASE_PATTERN, translateLiteral } from '../i18n/shared.js';

export const APP_I18N = `
const english = ${JSON.stringify(ENGLISH).replace(/</g, '\\u003c')};
const PHRASE_PATTERN = ${JSON.stringify(PHRASE_PATTERN)};
${translateLiteral.toString()}
let PX_LANGUAGE = 'fa';
try { PX_LANGUAGE = localStorage.getItem('pimx_language') === 'en' ? 'en' : 'fa'; } catch (_) {}
function pxText(value) {
  return translateLiteral(value, PX_LANGUAGE);
}
function pxTemplate(parts, ...values) {
  return parts.reduce((result, part, index) => result + pxText(part) + (index < values.length ? values[index] : ''), '');
}
function pxApplyLanguage() {
  document.documentElement.lang = PX_LANGUAGE;
  document.documentElement.dir = PX_LANGUAGE === 'en' ? 'ltr' : 'rtl';
  document.documentElement.dataset.language = PX_LANGUAGE;
}
function pxLocale() { return PX_LANGUAGE === 'en' ? 'en-US' : 'fa-IR'; }
window.pxText = pxText;
window.pxLocale = pxLocale;
window.pxLanguage = function() { return PX_LANGUAGE; };
pxApplyLanguage();
document.querySelectorAll('.boot .px-kicker, #bootMsg').forEach(function(node) { node.textContent = pxText(node.textContent); });
window.pxToggleLanguage = async function() {
  if (window.pxLanguageSwitching) return;
  window.pxLanguageSwitching = true;
  const button = document.getElementById('languageToggle');
  if (button) button.disabled = true;
  const previous = PX_LANGUAGE;
  const next = PX_LANGUAGE === 'fa' ? 'en' : 'fa';
  const draftInput = document.getElementById('cinput') || document.getElementById('homePrompt');
  const draft = draftInput ? { id: draftInput.id, value: draftInput.value } : null;
  function repaint(language) {
    PX_LANGUAGE = language;
    pxApplyLanguage();
    pxRefreshNavigationLanguage();
    document.getElementById('app').innerHTML = shell(loading());
    document.getElementById('languageToggle').disabled = true;
  }
  repaint(next);
  try {
    const preferences = await api('/preferences', { method: 'PATCH', body: { language: next }, timeout: 5000 });
    try {
      localStorage.setItem('pimx_language', next);
      localStorage.setItem('pimx_language_user', String(S.user.id));
    } catch (_) {}
    S.meta = await api('/meta', { timeout: 1500 }).catch(function() { return S.meta; });
    bust();
    S.cache.preferences = preferences;
    S.preferences = preferences;
    await render();
  } catch (error) {
    repaint(previous);
    await render();
    toast(error.message, 'bad');
  } finally {
    const input = draft && document.getElementById(draft.id);
    if (input) input.value = draft.value;
    const currentButton = document.getElementById('languageToggle');
    if (currentButton) currentButton.disabled = false;
    window.pxLanguageSwitching = false;
  }
};
window.pxRestoreLanguageDraft = function() {
  try {
    const saved = JSON.parse(sessionStorage.getItem('pimx_language_draft') || 'null');
    if (!saved) return;
    if (String(saved.userId) !== String(S.user.id)) { sessionStorage.removeItem('pimx_language_draft'); return; }
    const input = document.getElementById(saved.id);
    if (input) { input.value = saved.value; sessionStorage.removeItem('pimx_language_draft'); }
  } catch (_) {}
};
`;
