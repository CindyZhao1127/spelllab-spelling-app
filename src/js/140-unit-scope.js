function nextId(pfx){
  state.seq=(Number(state.seq)||0)+1;
  return pfx+state.seq+Math.random().toString(36).slice(2,6);
}
function today(){ const d=new Date();return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }
function rollDay(){
  if(state.stats.today!==today()){ state.stats.today=today(); state.stats.todayDone=0; state.stats.todayRight=0; saveState(); }
}

/* 单元归属：内置默认 + 用户在管理页的覆盖 */
function unitMeta(u){
  return Object.assign({gradeId:u.gradeId||'g4',bookId:u.bookId||'b_hj'}, state.unitMeta[u.id]||{});
}
function allUnits(){
  const base = BUILTIN_UNITS.slice();
  if(state.custom.length){
    const cm=state.customMeta||{};
    base.push({
      id:'custom', name:'我的题库 · 自定义', book:'自己导入的句子',
      gradeId:cm.gradeId||'g4', bookId:cm.bookId||'b_hj',
      sentences:state.custom.slice(), words:collectCustomWords()
    });
  }
  (state.practiceSets||[]).forEach(s=>{
    base.push({
      id:'ps:'+s.id, name:'生词练习 · '+s.name, book:'来自生词本 · '+(s.words||[]).length+' 个词',
      gradeId:s.gradeId||'g4', bookId:s.bookId||'b_hj',
      sentences:s.sentences||[], words:s.words||[], practiceSetId:s.id
    });
  });
  (state.textbooks||[]).forEach(tb=>{
    if(!tb || tb.enabled===false) return;
    (tb.units||[]).forEach(tu=>{
      if(!tu || !(tu.sentences||[]).length) return;
      base.push({
        id:'tb:'+tb.id+':'+tu.id, name:tu.name||'未命名单元', book:tb.name||'教材包',
        gradeId:tb.gradeId||'g4', bookId:tb.bookId||'b_hj', volume:packVolume(tb),
        sentences:tu.sentences, words:tu.words||[], packId:tb.id, tuId:tu.id
      });
    });
  });
  return base.map(u=>{
    const n=Object.assign({},u,unitMeta(u));
    n.scope=gradeName(n.gradeId)+' · '+bookName(n.bookId);
    return n;
  });
}
let filterFallback=false;
function unitsInScope(){
  const f=state.filter||{};
  return allUnits().filter(u=>{
    if(f.stageId && f.stageId!=='all' && stageOfGrade(u.gradeId)!==f.stageId) return false;
    if(f.gradeId && f.gradeId!=='all' && !sameGrade(u.gradeId,f.gradeId)) return false;
    if(f.bookId && f.bookId!=='all' && u.bookId!==f.bookId) return false;
    if(f.volumeId && f.volumeId!=='all' && u.volume!==f.volumeId) return false;
    return true;
  });
}
/* 当前可见单元：筛选为空时回退到全部，保证任何组合下都能正常练习 */
function units(){
  const scoped=unitsInScope();
  filterFallback=scoped.length===0;
  return filterFallback?allUnits():scoped;
}
function findUnitIndex(id){
  let i=units().findIndex(u=>u.id===id);
  if(i>=0) return i;
  state.filter={stageId:'all',gradeId:'all',bookId:'all',volumeId:'all'};
  renderFilters(); saveState();
  return Math.max(0,units().findIndex(u=>u.id===id));
}
function unitById(id){ return allUnits().find(u=>u.id===id); }
function collectCustomWords(){
  const map = new Map();
  state.custom.forEach(q=>{
    tokenize(q.en,q.hints,q.cn).forEach(t=>{
      if(!t.punct && t.word.length>2 && !map.has(t.word.toLowerCase())){
        map.set(t.word.toLowerCase(),[t.word.toLowerCase(),t.hint||'']);
      }
    });
  });
  return Array.from(map.values()).slice(0,60);
}
function currentUnit(){ return units()[unitPos] || units()[0]; }
function uid(unitId,idx){ return unitId+':'+idx; }
/* 题序在本轮练习中保持快照，避免答对后掌握度变化导致当前题目指针漂移 */
function order(){
  const u = currentUnit();
  if(sessionOrder.unitId!==u.id || sessionOrder.list.length!==u.sentences.length){
    const arr = u.sentences.map((q,i)=>({i,m:(state.progress[uid(u.id,i)]||{}).m||0}));
    if(state.settings.smart) arr.sort((a,b)=>a.m-b.m || a.i-b.i);
    sessionOrder={unitId:u.id,list:arr.map(x=>x.i)};
  }
  return sessionOrder.list;
}
function currentQuestion(){
  const u = currentUnit();
  const idx = order()[qPos] != null ? order()[qPos] : 0;
  return {unit:u, q:u.sentences[idx], idx:idx};
}

