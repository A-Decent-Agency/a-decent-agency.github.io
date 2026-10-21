import test from 'node:test';
import assert from 'node:assert/strict';
import { markdown, escapeHTML, safeURL } from '../js/markdown.js';
test('escapes raw HTML and attribute delimiters',()=>{
  assert.equal(escapeHTML('<script x="a">&\'</script>'),'&lt;script x=&quot;a&quot;&gt;&amp;&#39;&lt;/script&gt;');
  assert.ok(!markdown('<img src=x onerror=alert(1)>').includes('<img'));
  assert.ok(markdown('<script>alert(1)</script>').includes('&lt;script&gt;'));
});
test('supports safe markdown without images or executable links',()=>{
  const output=markdown('# Heading\n**bold** and `code`\n[safe](https://github.com)\n[unsafe](javascript:alert(1))\n```\n<script>\n```');
  assert.match(output,/<h2>Heading<\/h2>/);assert.match(output,/<strong>bold<\/strong>/);assert.match(output,/<code>code<\/code>/);assert.match(output,/rel="noopener noreferrer"/);assert.ok(!output.includes('href="javascript:'));assert.ok(!output.includes('<script>'));
});
test('item links accept HTTP(S) only',()=>{
  for(const url of ['javascript:alert(1)','data:text/html,hello','//evil.example','./foo'])assert.equal(safeURL(url),'');
  assert.equal(safeURL('https://github.com/a'),'https://github.com/a');
});
