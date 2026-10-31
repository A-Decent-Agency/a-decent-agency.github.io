import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const revision = 'dcd4f1ba3e8ebca47286ec2524e866a05b04afcd';
const root = new URL('../', import.meta.url);
const target = new URL('vendor/drawio/', root);
const source = process.env.DRAWIO_SOURCE;
if (!source) throw new Error('Set DRAWIO_SOURCE to an extracted draw.io v32.6.9 source checkout. See README.');
const webapp = join(source, 'src/main/webapp');
const engineHash = createHash('sha256').update(await readFile(join(webapp, 'js/app.min.js'))).digest('hex');
if (engineHash !== 'b4b89c4b779949efe4a6bc0a5a17942880eaa53332a4247b6057f3b0e3259765') throw new Error('Editor source does not match the pinned v32.6.9 runtime.');
await mkdir(target, { recursive: true });
for (const name of ['images', 'img', 'resources', 'styles', 'mxgraph', 'templates', 'js']) {
  await cp(join(webapp, name), new URL(`${name}/`, target), {
    recursive: true,
    filter: path => !/\/(integrate\.min\.js|diagramly|simplepeer|dropbox|onedrive)$/.test(path),
  });
}
for (const name of ['LICENSE', 'README.md']) await cp(join(source, name), new URL(name, target));
await cp(join(webapp, 'favicon.ico'), new URL('favicon.ico', target));
let html = await readFile(join(webapp, 'index.html'), 'utf8');
const policy = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'none'";
html = html.replace('<head>', `<head>\n<meta http-equiv="Content-Security-Policy" content="${policy}">`);
html = html.replace('<title>Flowchart Maker &amp; Online Diagram Software</title>', '<title>Diagram engine / Decent Planning Studio</title>');
await writeFile(new URL('index.html', target), html);
await writeFile(new URL('js/PreConfig.js', target), `
// Decent Office adaptation: local assets only; no cloud integrations.
window.DRAWIO_PUBLIC_BUILD = true;
window.EXPORT_URL = null;
window.PLANT_URL = null;
window.DRAWIO_BASE_URL = '.';
window.DRAWIO_VIEWER_URL = 'js/viewer.min.js';
window.DRAWIO_LIGHTBOX_URL = null;
window.DRAW_MATH_URL = null;
window.DRAWIO_CONFIG = { enableCustomLibraries: false, defaultFonts: ['Arial', 'Helvetica', 'Times New Roman', 'Courier New'] };
urlParams['sync'] = 'manual';
urlParams['offline'] = '1';
urlParams['local'] = '1';
urlParams['gapi'] = '0';
urlParams['drive'] = '0';
urlParams['db'] = '0';
urlParams['od'] = '0';
urlParams['gh'] = '0';
urlParams['gl'] = '0';
urlParams['tr'] = '0';
urlParams['stealth'] = '1';
urlParams['plugins'] = '0';
urlParams['enableSW'] = '0';
`);
await writeFile(new URL('js/PostConfig.js', target), `
window.VSD_CONVERT_URL = null;
window.EMF_CONVERT_URL = null;
window.ICONSEARCH_PATH = null;
Editor.enableServiceWorker = false;
EditorUi.prototype.maxCanvasExportArea = 8000000;
`);
const pdf = new URL('../node_modules/pdfjs-dist/', import.meta.url);
const pdfTarget = new URL('vendor/pdfjs/', root);
await mkdir(pdfTarget, { recursive: true });
for (const name of ['build/pdf.mjs', 'build/pdf.worker.mjs', 'cmaps', 'standard_fonts', 'wasm', 'LICENSE']) {
  await cp(new URL(name, pdf), new URL(name, pdfTarget), { recursive: true });
}
await writeFile(new URL('vendor/studio-provenance.json', root), JSON.stringify({
  drawio: { version: '32.6.9', revision, runtimeSHA256: engineHash, source: `https://github.com/jgraph/drawio/tree/${revision}`, license: 'Apache-2.0; see bundled README for stencil/icon terms', modifications: ['Network-restricting CSP', 'Local-only PreConfig/PostConfig', 'Page title', 'Omitted unused integrations'] },
  pdfjs: { version: '5.4.296', license: 'Apache-2.0' },
}, null, 2) + '\n');
console.log(`Vendored draw.io ${revision} and PDF.js 5.4.296. Runtime files are static; no CDN required.`);
