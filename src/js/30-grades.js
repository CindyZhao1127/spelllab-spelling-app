/* ---------------- 年级 / 教材版本 ---------------- */
const DEFAULT_GRADES = [
  {id:'g1',name:'小学一年级'},{id:'g2',name:'小学二年级'},{id:'g3',name:'小学三年级'},
  {id:'g4',name:'小学四年级'},{id:'g5',name:'小学五年级'},{id:'g6',name:'小学六年级'},
  {id:'j1',name:'初中一年级'},{id:'j2',name:'初中二年级'},{id:'j3',name:'初中三年级'}
];
const DEFAULT_BOOKS = [
  {id:'b_hj',name:'沪教版（三年级起点）'},
  {id:'b_pep',name:'人教版 PEP（三年级起点）'},
  {id:'b_wy',name:'外研版（三年级起点）'},
  {id:'b_yl',name:'译林版'},
  {id:'b_bsd',name:'北师大版'}
];
/* 册别：上册 / 下册 / 全册（不分册）。默认从教材包名称里推断，老数据无需手工补录。 */
const VOLUMES = [{id:'upper',name:'上册'},{id:'lower',name:'下册'},{id:'whole',name:'全册'}];
function inferVolume(name){
  const s=String(name||'');
  if(/上册|上冊/.test(s)) return 'upper';
  if(/下册|下冊/.test(s)) return 'lower';
  return '';
}
function volumeName(id){ const v=VOLUMES.find(x=>x.id===id); return v?v.name:'未分册'; }
function packVolume(p){ return (p && p.volume!=null) ? p.volume : (inferVolume(p&&p.name)||''); }
const clone = o => JSON.parse(JSON.stringify(o));
const HISTORY_LIMIT = 500;   // 练习记录最多保留 500 条，避免存档无限膨胀
function gradeName(id){ const g=(state.grades||[]).find(x=>x.id===id); return g?g.name:'未分类'; }
function bookName(id){ const b=(state.books||[]).find(x=>x.id===id); return b?b.name:'未分类'; }
/* 学段 / 学制：小学 / 初中 / 其他；六三制（小学 1–6，初中 7–9）或五四制（小学 1–5，初中 6–9）。
   初中教材包导入时会自建 g7~g9 / j1~j3，名称也是「初中七年级」，这里统一折算成年级序号，
   这样两种 id 写法都能按同一年级筛选，不会被别名拆成两套。 */
const STAGES=[{id:'primary',name:'小学'},{id:'junior',name:'初中'},{id:'other',name:'其他'}];
const SYSTEMS=[{id:'63',name:'六三制'},{id:'54',name:'五四制'}];
const CN_NUMS=['一','二','三','四','五','六','七','八','九'];
function stageName(id){ const s=STAGES.find(x=>x.id===id); return s?s.name:'其他'; }
function systemId(){ return state.system==='54'?'54':'63'; }
function primaryMax(sys){ return sys==='54'?5:6; }
/* 年级序号：g1..g9 就是 1..9；j1..j3 是初中一至三年级，对应 7..9；j6 是五四制初中六年级。 */
function gradeNum(id,name){
  const s=String(id||''), m=/^([gj])([1-9])$/.exec(s);
  if(m){ const n=Number(m[2]); return m[1]==='j'?(n===6?6:n+6):n; }
  const nm=String(name||''), t=/(?:小学|初中)?([一二三四五六七八九1-9])年级/.exec(nm);
  if(!t) return 0;
  const raw=t[1];
  return /^\d$/.test(raw)?Number(raw):(CN_NUMS.indexOf(raw)+1);
}
function gradeLabelFor(id,sys,name){
  const n=gradeNum(id,name||'');
  return n?CN_NUMS[n-1]+'年级':'未分年级';
}
function gradeLabel(id){
  const g=(state.grades||[]).find(x=>x.id===String(id));
  return gradeLabelFor(id,systemId(),g?g.name:'');
}
function gradeCatalogIds(sys){
  const ids=[];
  for(let n=1;n<=9;n++) ids.push(sys==='54'&&n===6?'j6':'g'+n);
  return ids;
}
/* 旧存档里的 j1/j2/j3 折算到 g7/g8/g9，筛选只认规范 id，别名由 sameGrade 兼容。 */
function canonicalGradeId(id,sys){
  const n=gradeNum(id);
  if(!n) return id;
  return sys==='54'&&n===6?'j6':'g'+n;
}
function gradeOptions(sys){ return gradeCatalogIds(sys||systemId()).map(id=>({id:id,name:gradeLabelFor(id,sys||systemId())})); }
function ensureGradeCatalog(target){
  const sys=target.system==='54'?'54':'63';
  gradeCatalogIds(sys).forEach(id=>{
    if(!(target.grades||[]).some(x=>x.id===id)) target.grades.push({id:id,name:gradeLabelFor(id,sys)});
  });
}
function stageOfGrade(id){
  const s=String(id||''), g=(state.grades||[]).find(x=>x.id===s), nm=g?String(g.name||''):'';
  if(s==='j6'||/初中六年级/.test(nm)) return 'junior';
  /* 五四制下 g6 是六三制小学六上/六下的旧归类，不能误当初中六年级 */
  if(systemId()==='54'&&(s==='g6'||/小学六年级/.test(nm))) return 'other';
  const n=gradeNum(s,nm);
  if(!n) return 'other';
  return n<=primaryMax(systemId())?'primary':'junior';
}
function gradeNumOf(id){
  const g=(state.grades||[]).find(x=>x.id===String(id));
  return gradeNum(id,g?g.name:'');
}
function sameGrade(a,b){
  if(a===b) return true;
  if(systemId()==='54'&&((a==='g6'&&b==='j6')||(a==='j6'&&b==='g6'))) return false;
  const x=gradeNumOf(a), y=gradeNumOf(b);
  return x>0&&y>0&&x===y;
}
function stageOfBook(b){
  const nm=String((b&&b.name)||'');
  if(/初中|七年级|八年级|九年级/.test(nm)) return 'junior';
  return systemId()==='54'&&/六年级/.test(nm)?'junior':'primary';
}
/* 教材册显示名：三年级(上) / 八年级(下)，年级名里已有的「小学/初中」前缀去掉 */
function packLabel(p){
  const name=String((p&&p.gradeId)||'');
  const g=gradeLabel(name);
  const base=(g&&g!=='未分年级')?g:'未分年级';
  const v=packVolume(p), tail=v==='upper'?'(上)':v==='lower'?'(下)':v==='whole'?'(全)':'';
  return base+tail;
}
/* 教材库树：学段 → 教材类别 → 册（每个册包下面再展开单元） */
function groupPacks(packs,stage){
  const groups=[], only=(stage&&stage!=='all')?stage:'';
  const volRank=v=>v==='upper'?0:v==='lower'?1:2;
  (packs||[]).forEach(function(p){
    const st=stageOfGrade(p&&p.gradeId), bk=String(bookName(p&&p.bookId)||'未分类');
    if(only&&st!==only) return;
    let g=groups.find(x=>x.stage===st);
    if(!g){ g={stage:st,books:[]}; groups.push(g); }
    let b=g.books.find(x=>x.name===bk);
    if(!b){ b={name:bk,packs:[]}; g.books.push(b); }
    b.packs.push(p);
  });
  const order={primary:0,junior:1,other:2};
  const rank=s=>Object.prototype.hasOwnProperty.call(order,s)?order[s]:9;
  groups.sort((a,b)=>rank(a.stage)-rank(b.stage));
  groups.forEach(g=>{
    g.books.sort((a,b)=>a.name.localeCompare(b.name,'zh'));
    g.books.forEach(b=>b.packs.sort((a,c)=>
      gradeNumOf(a.gradeId)-gradeNumOf(c.gradeId)||volRank(packVolume(a))-volRank(packVolume(c))||
      String(a.name).localeCompare(String(c.name),'zh')));
  });
  return groups;
}
function optionGroups(list,stageFn,current,allLabel,allValue,labelFn,onlyStage){
  let html='<option value="'+(allValue||'all')+'">'+esc(allLabel)+'</option>';
  STAGES.forEach(function(st){
    if(onlyStage&&onlyStage!=='all'&&st.id!==onlyStage&&st.id!=='other') return;
    const items=list.filter(x=>stageFn(x)===st.id);
    if(!items.length) return;
    html+='<optgroup label="'+esc(st.name)+'">'+items.map(x=>
      '<option value="'+esc(x.id)+'"'+(x.id===current?' selected':'')+'>'+
      esc(labelFn?labelFn(x):x.name)+'</option>').join('')+'</optgroup>';
  });
  return html;
}

