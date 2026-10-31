import { EMPTY_DIAGRAM, MAX_DIAGRAM_BYTES, readDiagram, editorMessage } from './diagram-format.js';

const $ = selector => document.querySelector(selector);
const frame = $('#diagram');
let current = EMPTY_DIAGRAM, filename = 'my-decent-map.drawio', ready = false, dirty = false, exportPending = false;
let timeout;
const status = message => { $('#status').textContent = message; };
function send(value) { frame.contentWindow.postMessage(JSON.stringify(value), location.origin); }
function download(blob, name) {
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function setReady() {
  ready = true;
  for (const id of ['download', 'svg', 'png']) $(`#${id}`).disabled = false;
}
function setBusy(value) {
  exportPending = value;
  for (const id of ['download', 'svg', 'png', 'new', 'open']) $(`#${id}`).disabled = value;
}
function load() { send({ action: 'load', xml: current, title: filename, autosave: 1, saveAndExit: 0, noExitBtn: 1 }); }
function replace(xml, name) {
  if (dirty && !confirm('Replace the current diagram? Download it first to keep your changes.')) return;
  current = xml; filename = name.replace(/\.(json|xml)$/i, '.drawio'); dirty = false;
  if (ready) load();
  status(`${filename} opened in this tab. No upload. Download to keep a copy.`);
}
window.addEventListener('message', event => {
  const message = editorMessage(event, frame.contentWindow, location.origin);
  if (!message) return;
  if (message.event === 'init') { clearTimeout(timeout); setReady(); load(); status('Ready. Work stays in this tab; download before closing.'); }
  if (message.event === 'autosave' || message.event === 'save') {
    if (typeof message.xml !== 'string' || message.xml.length > MAX_DIAGRAM_BYTES) { status('Diagram is too large to keep here (16 MB). Reduce embedded image sizes before saving.'); return; }
    current = message.xml; dirty = true;
    status('Changed in memory only. Download editable map to keep your work.');
    if (message.event === 'save') save();
  }
  if (message.event === 'export') {
    clearTimeout(timeout); setBusy(false);
    if (message.format === 'xml') {
      if (typeof message.xml !== 'string' || new TextEncoder().encode(message.xml).byteLength > MAX_DIAGRAM_BYTES) { status('Download failed: editable map exceeds the 16 MB limit or no XML was returned.'); return; }
      current = message.xml;
      download(new Blob([current], { type: 'application/xml' }), filename);
      dirty = false; status('Editable map downloaded. You can reopen it here later.');
      return;
    }
    if (message.error || typeof message.data !== 'string') { status(`Export failed: ${message.error || 'No image returned.'} Try a smaller diagram or SVG.`); return; }
    const format = message.format;
    if (!['svg', 'png'].includes(format) || !message.data.startsWith(`data:image/${format === 'svg' ? 'svg+xml' : 'png'};base64,`)) { status('Export failed: unexpected image format.'); return; }
    let bytes;
    try { bytes = Uint8Array.from(atob(message.data.split(',')[1]), char => char.charCodeAt(0)); }
    catch (error) { status(`Export failed: invalid image data (${error.message}). Your editable map is retained.`); return; }
    if (format === 'png') {
      if (bytes.length < 24) { status('PNG export failed: incomplete image. Your editable map is retained.'); return; }
      const size = new DataView(bytes.buffer);
      if (size.getUint32(16) <= 1 && size.getUint32(20) <= 1) { status('No drawable PNG was returned. Add a shape, try SVG, or download the editable map.'); return; }
    }
    download(new Blob([bytes], { type: `image/${format === 'svg' ? 'svg+xml' : 'png'}` }), filename.replace(/\.drawio$/i, '') + `.${format}`);
    status(`${format.toUpperCase()} downloaded locally. Keep a .drawio file for future editing.`);
  }
});
function save() {
  requestExport('xml');
}
$('#download').onclick = save;
$('#new').onclick = () => replace(EMPTY_DIAGRAM, 'my-decent-map.drawio');
$('#open').onchange = async event => {
  try {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > MAX_DIAGRAM_BYTES) throw new Error('Map exceeds the 16 MB limit.');
    const text = readDiagram(await file.text(), file.name, value => new DOMParser().parseFromString(value, 'application/xml'));
    replace(text, file.name);
  } catch (error) { status(`Could not open map: ${error.message} Your existing diagram was retained.`); }
  finally { event.target.value = ''; }
};
function requestExport(format) {
  if (!ready || exportPending) return;
  setBusy(true); status(`Rendering ${format.toUpperCase()} locally...`);
  send({ action: 'export', format, spin: 'Exporting locally', scale: 1, border: 16, currentPage: true });
  timeout = setTimeout(() => { setBusy(false); status('Export did not finish. Try SVG or reduce the diagram size. No server export was attempted.'); }, 30_000);
}
for (const format of ['svg', 'png']) $(`#${format}`).onclick = () => requestExport(format);
window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
frame.src = '../vendor/drawio/index.html?embed=1&proto=json&spin=1&libraries=1&noExitBtn=1&saveAndExit=0&offline=1&local=1&stealth=1&math=0&plugins=0&enableSW=0';
timeout = setTimeout(() => status('The diagram engine did not start. Check that vendor assets were installed; reload to retry. Your local file has not been changed.'), 30_000);
