import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeItem, exportProject } from '../js/project.js';
const field = (name, text) => ({field:{name},text});
const item = (changes={}) => ({id:'item-1',type:'DRAFT_ISSUE',content:{title:'A public draft',body:'Good notes'},fieldValues:{nodes:[field('Kind','Milestone'),field('Status','Todo'),field('Start','2026-10-21'),field('Outcome','Sensitive outcome'),{field:{name:'Baseline met'},options:[{name:'License'},{name:'Tests'}]}]},...changes});
test('drafts keep markdown, are bounded and preserve multiselect fields',()=>{
  const result=sanitizeItem(item({content:{title:'Draft',body:'x'.repeat(5000)}}));
  assert.equal(result.body.length,4000);assert.equal(result.type,'draft');assert.deepEqual(result.fields['Baseline met'],['License','Tests']);
});
test('private linked issues/PRs publish only title/kind/status/dates and an opaque ID',()=>{
  for(const type of ['ISSUE','PULL_REQUEST']){
    const result=sanitizeItem(item({type,content:{title:'Private title',body:'Never publish',url:'https://github.com/private/secret/1',repository:{nameWithOwner:'private/secret',isPrivate:true}}}));
    assert.deepEqual(Object.keys(result).sort(),['fields','id','private','title']);
    assert.deepEqual(result.fields,{Kind:'Milestone',Status:'Todo',Start:'2026-10-21',Target:''});
    assert.ok(!JSON.stringify(result).includes('Sensitive'));assert.ok(!JSON.stringify(result).includes('secret'));
  }
});
test('all private portfolio aliases fail closed when no repository is linked',()=>{
  for(const name of ['Bean','DeCentMaker','DecentMaker','JacobsLadder26','DuoDuel','DecentCalendar','DecentCanvas','DecentFoot','DecentFooter','TheJokerWillPlay']){
    const result=sanitizeItem(item({content:{title:`Portfolio: ${name}`,body:'Sensitive body'}}));
    assert.equal(result.body,undefined,name);assert.equal(result.bodyRedacted,true,name);
  }
});
test('linked repository privacy overrides the draft name fallback',()=>{
  const result=sanitizeItem(item({type:'ISSUE',content:{title:'Portfolio: Bean',body:'Public now',url:'https://github.com/org/Bean/issues/1',repository:{nameWithOwner:'org/Bean',isPrivate:false}}}));
  assert.equal(result.body,'Public now');assert.equal(result.repository,'org/Bean');assert.equal(result.type,'issue');
});
test('deleted or inaccessible contents are skipped',()=>assert.equal(sanitizeItem(item({content:null})),null));
test('exporter paginates and creates draft deep links',async()=>{
  const calls=[];
  const fetcher=async(url,options)=>{
    const input=JSON.parse(options.body);calls.push(input.variables.cursor);
    return {ok:true,json:async()=>({data:{node:{title:'Project',readme:'Notes',url:'https://github.com/orgs/test/projects/1',views:{nodes:[{name:'Board',layout:'BOARD_LAYOUT',filter:''}],pageInfo:{hasNextPage:false}},items:{nodes:[item({id:`item-${calls.length}`,databaseId:calls.length})],pageInfo:{hasNextPage:calls.length===1,endCursor:'cursor-1'}}}}})};
  };
  const result=await exportProject('test-token','id',fetcher);
  assert.deepEqual(calls,[null,'cursor-1']);assert.equal(result.items.length,2);assert.equal(result.items[0].url,'https://github.com/orgs/test/projects/1?pane=issue&itemId=1');
});
test('exporter refuses GraphQL partial failures',async()=>{
  await assert.rejects(exportProject('token','id',async()=>({ok:true,json:async()=>({errors:[{message:'No access'}]})})),/No access/);
  await assert.rejects(exportProject(''),/token/);
});

test('the checked-in real snapshot follows the privacy contract',async()=>{
  const {readFile}=await import('node:fs/promises');
  const project=JSON.parse(await readFile(new URL('../data/project.json',import.meta.url),'utf8'));
  assert.ok(project.items.length>100);assert.ok(project.views.length>=12);
  for(const item of project.items){
    if(item.private){assert.equal(item.body,undefined);assert.equal(item.url,undefined);assert.equal(item.repository,undefined);assert.deepEqual(Object.keys(item.fields).sort(),['Kind','Start','Status','Target']);}
    if(item.bodyRedacted)assert.equal(item.body,undefined);
    if(item.body)assert.ok(item.body.length<=4000);
  }
  assert.equal(project.items.find(item=>item.title==='Portfolio: Bean')?.body,undefined);
});

test('registry card bodies are redacted from public snapshots', () => {
  const out = sanitizeItem({ id: 'r1', type: 'DRAFT_ISSUE', content: { title: 'Registry: Contributors and collaborators', body: 'secret access review' }, fieldValues: { nodes: [] } });
  assert.equal(out.bodyRedacted, true);
  assert.equal(out.body, undefined);
});
