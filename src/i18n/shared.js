import english from './en.json' with { type: 'json' };

// Only authored string literals pass through this function. Interpolated user
// content, identifiers, API keys and model responses are never translated.
export const PHRASE_PATTERN = '[\\u0600-\\u06ff][\\u0600-\\u06ff\\u200c\\u200d\\u200e\\u200f A-Za-z0-9،؛؟«».,:!…()/%+–—-]*';
export const ENGLISH = english;
export function translateLiteral(value, language = 'fa') {
  if (language !== 'en') return String(value);
  const source = String(value);
  return source.replace(new RegExp(PHRASE_PATTERN, 'g'), (phrase, offset) => {
    const key = phrase.trimEnd();
    let translated = english[key] ?? key;
    // A translated placeholder or inline action must remain inside its HTML
    // attribute, even when the English copy contains quotation marks.
    const prefix = source.slice(0, offset);
    const tagStart = prefix.lastIndexOf('<');
    if (tagStart > prefix.lastIndexOf('>')) {
      const tag = prefix.slice(tagStart);
      const attribute = /([\w-]+)\s*=\s*"[^"]*$/.exec(tag);
      if (attribute) {
        if (/^on/i.test(attribute[1])) translated = translated.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        translated = translated.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      }
    }
    return translated + phrase.slice(key.length);
  });
}
export function renderTemplate(language, parts, values) {
  return parts.reduce((result, part, index) => result + translateLiteral(part, language) + (index < values.length ? values[index] : ''), '');
}
export function validLanguage(value) { return value === 'fa' || value === 'en'; }
