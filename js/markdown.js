export function escapeHTML(value = '') {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}
export function safeURL(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
}
// Deliberately small Markdown subset. Raw HTML, images and arbitrary protocols are never rendered.
export function markdown(source = '') {
  let fenced = false;
  return String(source).split('\n').map(line => {
    if (line.startsWith('```')) { fenced = !fenced; return fenced ? '<pre><code>' : '</code></pre>'; }
    const escaped = escapeHTML(line);
    if (fenced) return `${escaped}\n`;
    const inline = escaped.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1 ↗</a>')
      .replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    const heading = inline.match(/^(#{1,4})\s+(.+)$/);
    if (heading) return `<h${heading[1].length + 1}>${heading[2]}</h${heading[1].length + 1}>`;
    if (/^[-*] /.test(inline)) return `<p class="md-bullet">• ${inline.slice(2)}</p>`;
    return inline ? `<p>${inline}</p>` : '';
  }).join('\n') + (fenced ? '</code></pre>' : '');
}
