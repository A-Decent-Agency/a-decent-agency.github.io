import { validateMap, MAX_FILE_BYTES } from '../js/editor.js';

export const MAX_DIAGRAM_BYTES = MAX_FILE_BYTES;
export const EMPTY_DIAGRAM = '<mxfile><diagram id="plan" name="My plan"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>';
const xml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]);

export function officeMapToDiagram(value) {
  const map = validateMap(value);
  const nodes = map.nodes.map(node => `<object id="node-${xml(node.id)}" label="${xml(node.title)}" notes="${xml(node.notes)}" kind="${xml(node.kind)}"><mxCell style="rounded=1;whiteSpace=wrap;html=0;fillColor=${node.color};fontColor=#151020;" vertex="1" parent="1"><mxGeometry x="${Math.round(node.x * 10 + 2100)}" y="${Math.round(-node.y * 10 + 2100)}" width="180" height="80" as="geometry"/></mxCell></object>`);
  const edges = map.links.map((link, index) => `<mxCell id="edge-${index}" edge="1" parent="1" source="node-${xml(link.from)}" target="node-${xml(link.to)}" style="edgeStyle=orthogonalEdgeStyle;endArrow=block;"><mxGeometry relative="1" as="geometry"/></mxCell>`);
  return `<mxfile><diagram id="office" name="Office map"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${nodes.join('')}${edges.join('')}</root></mxGraphModel></diagram></mxfile>`;
}

export function readDiagram(text, name, parseXML) {
  if (new TextEncoder().encode(text).byteLength > MAX_DIAGRAM_BYTES) throw new Error('Map exceeds the 16 MB editable-file limit.');
  if (/\.json$/i.test(name)) return officeMapToDiagram(JSON.parse(text));
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('XML document types and entities are not supported.');
  const document = parseXML(text);
  if (document.querySelector('parsererror')) throw new Error('The diagram XML is malformed.');
  if (!['mxfile', 'mxGraphModel'].includes(document.documentElement?.nodeName)) throw new Error('Open a .drawio/.xml diagram or an Office map JSON. Use the historical viewer for PDFs.');
  return text;
}

export function editorMessage(event, source, origin) {
  if (event.source !== source || event.origin !== origin || typeof event.data !== 'string' || event.data.length > 64_000_000) return null;
  try { return JSON.parse(event.data); } catch { return null; }
}
