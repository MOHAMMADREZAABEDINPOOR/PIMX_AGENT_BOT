const escape = text => String(text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function markdownToTelegram(text) {
  let t = escape(text);
  const blocks = [];
  const stash = html => { blocks.push(html); return `\x00B${blocks.length - 1}\x00`; };
  t = t.replace(/```([\w+-]*)\n?([\s\S]*?)```/g, (_, lang, code) => stash(`<pre><code${lang ? ` class="language-${lang}"` : ""}>${code.replace(/\n+$/, "")}</code></pre>`));
  t = t.replace(/`([^`\n]+)`/g, (_, code) => stash(`<code>${code}</code>`));
  t = t.replace(/(^|\n)((?:\|.+\|(?:\n|$))+)/g, (_, pre, table) => {
    const rows = table.trim().split("\n").filter(line => !/^\|[\s:|\-]+\|$/.test(line)).map(line => line.replace(/^\||\|$/g, "").split("|").map(cell => cell.trim()).join(" │ "));
    return pre + stash(`<pre>${rows.join("\n")}</pre>`);
  });
  t = t.replace(/\[([^\]\n]+)\]\((https?:[^\s)]+)\)/g, (_, label, url) => stash(`<a href="${url}">${label}</a>`));
  t = t.replace(/\*\*\*([^*]+)\*\*\*/g, "<b><i>$1</i></b>")
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/__([^_]+)__/g, "<u>$1</u>")
    .replace(/~~([^~]+)~~/g, "<s>$1</s>")
    .replace(/\|\|([^|]+)\|\|/g, "<tg-spoiler>$1</tg-spoiler>")
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s.,;:!?)]|$)/g, "$1<i>$2</i>")
    .replace(/(^|[\s(])_([^_\n]+)_(?=[\s.,;:!?)]|$)/g, "$1<i>$2</i>")
    .replace(/(^|\n)#{1,6}[ \t]*(.+)/g, "$1<b>$2</b>")
    .replace(/(^|\n)[ \t]*[-*][ \t]+/g, "$1• ");
  t = t.replace(/(^|\n)((?:&gt;[^\n]*(?:\n|$))+)/g, (_, prefix, quote) => {
    const content = quote.trimEnd().split("\n").map(line => line.replace(/^&gt;\s?/, "")).join("\n");
    const expandable = content.endsWith("||");
    return `${prefix}<blockquote${expandable ? " expandable" : ""}>${expandable ? content.slice(0, -2) : content}</blockquote>\n`;
  });
  return t.replace(/\x00B(\d+)\x00/g, (_, index) => blocks[Number(index)]);
}

// Split raw HTML while closing/reopening formatting at each Telegram boundary.
// Tokens keep entities, tags and UTF-16 surrogate pairs intact.
export function splitTelegramHtml(html, max = 3900) {
  const tokens = String(html || "").match(/<[^>]*>|&(?:#\d+|#x[\da-f]+|\w+);|[^<&]|[<&]/giu) || [];
  const chunks = [], stack = [];
  let current = "";
  const closes = () => stack.slice().reverse().map(tag => `</${tag.name}>`).join("");
  const flush = () => {
    if (current) chunks.push(current + closes());
    current = stack.map(tag => tag.open).join("");
  };
  for (const token of tokens) {
    const match = token.match(/^<(\/)?([\w-]+)(?:\s[^>]*)?>$/);
    const closeLength = match && !match[1] ? match[2].length + 3 : 0;
    if (current.length + token.length + closes().length + closeLength > max) flush();
    if (match) {
      if (match[1]) stack.pop();
      else stack.push({ name: match[2], open: token });
    }
    current += token;
  }
  if (current) chunks.push(current + closes());
  return chunks.length ? chunks : [""];
}
