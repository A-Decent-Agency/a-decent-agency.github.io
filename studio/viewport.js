export const MAX_CANVAS_PIXELS = 2_000_000;
export const MAX_PDF_BYTES = 80_000_000;

export function canvasSize(width, height, ratio = 1) {
  if (![width, height, ratio].every(value => Number.isFinite(value) && value > 0)) throw new Error('Invalid viewer dimensions.');
  const scale = Math.min(ratio, Math.sqrt(MAX_CANVAS_PIXELS / (width * height)));
  return { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)), scale };
}
export function fitScale(pageWidth, pageHeight, width, height) {
  if (![pageWidth, pageHeight, width, height].every(value => Number.isFinite(value) && value > 0)) throw new Error('Invalid PDF page bounds.');
  return Math.min(width / pageWidth, height / pageHeight) * .96;
}
export function zoomAt(view, factor, x, y) {
  const zoom = Math.max(1, Math.min(512, view.zoom * factor));
  const change = zoom / view.zoom;
  return { zoom, x: x - (x - view.x) * change, y: y - (y - view.y) * change };
}
