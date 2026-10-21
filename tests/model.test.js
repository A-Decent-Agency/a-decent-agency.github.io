import test from 'node:test';
import assert from 'node:assert/strict';
import { viewMatches, tabMatches, relationships, spatialPages } from '../js/model.js';
import { validateMap, saveMap, loadMap, starterMap, projectToMap } from '../js/editor.js';
test('GitHub view filters match the real exported expression subset',()=>{
  const item={title:'Portfolio: DecentCanopy',fields:{Kind:'Shared solution',Workstream:'Storage and recovery',Horizon:'Now'}};
  assert.equal(viewMatches(item,'kind:"Shared solution"'),true);assert.equal(viewMatches(item,'-kind:Portfolio'),true);assert.equal(viewMatches(item,'workstream:"Storage and recovery"'),true);assert.equal(viewMatches(item,'kind:Standard,Decision'),false);assert.equal(viewMatches(item,'Horizon:Now'),true);
  assert.equal(tabMatches(item,'catalog'),true);assert.equal(tabMatches(item,'roadmap'),false);
});
test('dependency milestone references and crossover aliases become edges',()=>{
  const items=[{id:'1',title:'M1 — Start',fields:{Dependencies:'M2'}},{id:'2',title:'M2 — Finish',fields:{}},{id:'3',title:'Portfolio: BigNuten_Vanilla',fields:{Crossovers:'big-nuten -> decent-canopy'}},{id:'4',title:'Portfolio: DecentCanopy',fields:{}}];
  assert.deepEqual(relationships(items),[{from:'1',to:'2',kind:'dependency'},{from:'3',to:'4',kind:'crossover'}]);
  assert.equal(spatialPages(Array.from({length:13},()=>({fields:{Status:'Todo'}})),'board'),3);
});
test('map validation strips unknown fields, clamps positions and rejects broken links',()=>{
  const map=starterMap();map.token='secret';map.nodes[0].x=Infinity;map.nodes[0].color='url(unsafe)';
  const result=validateMap(map);assert.equal(result.token,undefined);assert.equal(result.nodes[0].x,0);assert.equal(result.nodes[0].color,'#aa8bea');
  assert.throws(()=>validateMap({...map,links:[{from:'seed',to:'missing'}]}),/different existing/);
  assert.throws(()=>validateMap({...map,nodes:[map.nodes[0],map.nodes[0]]}),/unique/);
});
test('map data round trips through browser-like storage, with no credentials',()=>{
  let value;const storage={getItem:()=>value,setItem:(key,next)=>value=next};
  saveMap(starterMap(),storage);assert.deepEqual(loadMap(storage),starterMap());assert.ok(!value.includes('token'));
});
test('project import produces a portable local map',()=>{
  const map=projectToMap({items:[{id:'1',title:'Card',body:'Notes',fields:{Kind:'Milestone',Status:'Todo'}}]});
  assert.equal(map.nodes.length,1);assert.match(map.nodes[0].notes,/Status: Todo/);
});
test('a maximum-size imported project has distinct bounded node positions',()=>{
  const map=projectToMap({items:Array.from({length:500},(_,i)=>({id:String(i),title:`Card ${i}`,body:'',fields:{Kind:'Idea'}}))});
  assert.equal(new Set(map.nodes.map(n=>`${n.x},${n.y}`)).size,500);
  assert.ok(map.nodes.every(n=>Math.abs(n.x)<200&&Math.abs(n.y)<200));
});
