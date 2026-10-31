import { getDocument, GlobalWorkerOptions } from '../vendor/pdfjs/build/pdf.mjs';
import { canvasSize, fitScale, zoomAt, MAX_PDF_BYTES } from './viewport.js';

GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/build/pdf.worker.mjs', import.meta.url).href;
const $ = selector => document.querySelector(selector);
const canvas = $('#page-canvas'), container = canvas.parentElement;
const status = message => { $('#status').textContent = message; };
let documentTask, pdf, page, renderTask, generation = 0, pageGeneration = 0, timer, fileName = '', dragging;
let view = { x: 0, y: 0, zoom: 1 }, baseScale = 1;
function controls(enabled) { for (const id of ['page', 'zoom-in', 'zoom-out', 'fit', 'close']) $(`#${id}`).disabled = !enabled; }
function stopRender() { renderTask?.cancel(); renderTask = null; }
function fit() {
  if (!page) return;
  const bounds = page.getViewport({ scale: 1 });
  baseScale = fitScale(bounds.width, bounds.height, container.clientWidth, container.clientHeight);
  view = { x: (container.clientWidth - bounds.width * baseScale) / 2, y: (container.clientHeight - bounds.height * baseScale) / 2, zoom: 1 };
  schedule();
}
function schedule() { stopRender(); clearTimeout(timer); timer = setTimeout(render, 50); }
async function render() {
  if (!page) return;
  const currentPage = page;
  const size = canvasSize(container.clientWidth, container.clientHeight, devicePixelRatio || 1);
  canvas.width = size.width; canvas.height = size.height;
  const task = currentPage.render({
    canvasContext: canvas.getContext('2d'),
    viewport: currentPage.getViewport({ scale: baseScale * view.zoom }),
    transform: [size.scale, 0, 0, size.scale, view.x * size.scale, view.y * size.scale],
    background: '#ffffff',
  });
  renderTask = task;
  status(`Rendering ${fileName}, page ${currentPage.pageNumber}/${pdf.numPages}, ${view.zoom.toFixed(1)}x overview...`);
  try {
    await task.promise;
    if (renderTask !== task) return;
    status(`${fileName} / page ${currentPage.pageNumber} of ${pdf.numPages} / ${view.zoom.toFixed(1)}x overview / canvas ${size.width} x ${size.height}. Local only.`);
  } catch (error) {
    if (error.name !== 'RenderingCancelledException') status(`Could not render this view: ${error.message}. Try another page or zoom out.`);
  } finally { if (renderTask === task) renderTask = null; }
}
async function selectPage(number) {
  const id = ++pageGeneration, owner = pdf;
  stopRender(); clearTimeout(timer); page = null;
  try {
    const next = await owner.getPage(number);
    if (id !== pageGeneration || owner !== pdf) return;
    page = next; fit();
  } catch (error) { if (owner === pdf) status(`Could not open page ${number}: ${error.message}`); }
}
async function close() {
  const id = ++generation;
  ++pageGeneration; stopRender(); clearTimeout(timer); page = null; pdf = null;
  const previous = documentTask; documentTask = null;
  controls(false); $('#page').replaceChildren(); canvas.width = 1; canvas.height = 1;
  if (previous) await previous.destroy();
  return id;
}
$('#pdf-file').onchange = async event => {
  const file = event.target.files[0]; event.target.value = '';
  if (!file) return;
  if (file.size > MAX_PDF_BYTES) { status('PDF exceeds the 80 MB limit. Existing file retained.'); return; }
  const id = await close();
  if (id !== generation) return;
  fileName = file.name;
  status(`Reading ${fileName} locally...`);
  try {
    const data = new Uint8Array(await file.arrayBuffer());
    if (id !== generation) return;
    const task = getDocument({
      data, isEvalSupported: false, stopAtErrors: true,
      cMapUrl: new URL('../vendor/pdfjs/cmaps/', import.meta.url).href, cMapPacked: true,
      standardFontDataUrl: new URL('../vendor/pdfjs/standard_fonts/', import.meta.url).href,
      wasmUrl: new URL('../vendor/pdfjs/wasm/', import.meta.url).href,
      canvasMaxAreaInBytes: 16_000_000,
      useSystemFonts: false, enableXfa: false,
    });
    documentTask = task;
    const loaded = await task.promise;
    if (id !== generation) return;
    pdf = loaded;
    $('#page').replaceChildren(...Array.from({ length: pdf.numPages }, (_, index) => new Option(String(index + 1), String(index + 1))));
    const requestedPage = Number(new URLSearchParams(location.search).get('page')) || 1;
    const number = Math.max(1, Math.min(pdf.numPages, Math.floor(requestedPage)));
    $('#page').value = String(number);
    controls(true); await selectPage(number);
  } catch (error) { if (id === generation) { status(`Could not open PDF: ${error.message}. The source file is unchanged.`); await close(); } }
};
$('#page').onchange = event => selectPage(Number(event.target.value));
function zoom(factor, x = container.clientWidth / 2, y = container.clientHeight / 2) {
  if (!page) return;
  view = zoomAt(view, factor, x, y); schedule();
}
$('#zoom-in').onclick = () => zoom(2);
$('#zoom-out').onclick = () => zoom(.5);
$('#fit').onclick = fit;
$('#close').onclick = async () => { const id = await close(); if (id === generation) status('Local PDF closed and document resources released. Choose a file to reopen it.'); };
canvas.addEventListener('wheel', event => { event.preventDefault(); const rect = canvas.getBoundingClientRect(); zoom(event.deltaY < 0 ? 1.3 : 1 / 1.3, event.clientX - rect.left, event.clientY - rect.top); }, { passive: false });
canvas.addEventListener('pointerdown', event => { if (!page) return; dragging = { x: event.clientX, y: event.clientY }; canvas.setPointerCapture(event.pointerId); canvas.focus(); });
canvas.addEventListener('pointermove', event => {
  if (!dragging) return;
  view.x += event.clientX - dragging.x; view.y += event.clientY - dragging.y;
  dragging = { x: event.clientX, y: event.clientY }; schedule();
});
canvas.addEventListener('pointerup', () => { dragging = null; });
canvas.addEventListener('pointercancel', () => { dragging = null; });
canvas.addEventListener('keydown', event => {
  if (!page) return;
  if (['+', '=', '-'].includes(event.key)) { event.preventDefault(); zoom(event.key === '-' ? .5 : 2); }
  if (event.key === '0') { event.preventDefault(); fit(); }
  const delta = { ArrowLeft: [80, 0], ArrowRight: [-80, 0], ArrowUp: [0, 80], ArrowDown: [0, -80] }[event.key];
  if (delta) { event.preventDefault(); view.x += delta[0]; view.y += delta[1]; schedule(); }
});
new ResizeObserver(() => { if (page) fit(); }).observe(container);
document.addEventListener('visibilitychange', () => { if (document.hidden) { clearTimeout(timer); stopRender(); } else if (page) schedule(); });
