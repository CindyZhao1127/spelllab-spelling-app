/* ---------------- 年级 / 教材版本管理 ---------------- */
function addTaxonomy(kind,name){
  const list=kind==='grade'?state.grades:state.books;
  const n=String(name||'').trim();
  if(!n){ toast('请先输入名称','bad'); return null; }
  if(list.some(x=>x.name===n)){ toast('已经有同名项了','bad'); return null; }
  const item={id:nextId(kind==='grade'?'g':'b'),name:n};
  list.push(item); saveState();
  renderFilters(); renderDrawer(); toast('已添加「'+n+'」','ok');
  return item;
}
function renameTaxonomy(kind,id){
  const list=kind==='grade'?state.grades:state.books;
  const item=list.find(x=>x.id===id); if(!item) return;
  let n=prompt('修改名称',item.name);
  if(n==null) return;
  n=String(n).trim();
  if(!n||n===item.name) return;
  if(list.some(x=>x.id!==id&&x.name===n)){ toast('名称重复','bad'); return; }
  item.name=n; saveState(); renderFilters(); renderDrawer(); toast('名称已更新','ok');
}
function removeTaxonomy(kind,id){
  const list=kind==='grade'?state.grades:state.books;
  const item=list.find(x=>x.id===id); if(!item) return;
  const key=kind==='grade'?'gradeId':'bookId';
  const used=allUnits().filter(u=>u[key]===id).length;
  if(!confirm('删除「'+item.name+'」？'+(used?'有 '+used+' 个单元会归到「未分类」。':''))) return;
  list.splice(list.indexOf(item),1);
  allUnits().forEach(u=>{
    if(u[key]===id) state.unitMeta[u.id]=Object.assign({},state.unitMeta[u.id],{[key]:'none'});
  });
  state.vocab.forEach(v=>{ if(v[key]===id) v[key]='none'; });
  state.practiceSets.forEach(s=>{ if(s[key]===id) s[key]='none'; });
  if(state.filter[key]===id) state.filter[key]='all';
  saveState(); renderFilters(); renderHeader(); setMode(mode); renderDrawer();
  toast('已删除，关联内容标为未分类');
}
function setUnitScope(id,key,v){
  state.unitMeta[id]=Object.assign({},state.unitMeta[id],{[key]:v});
  saveState();
  sessionOrder={unitId:'',list:[]};
  qPos=0; wordCur=null; unitPos=Math.min(unitPos,Math.max(0,units().length-1));
  renderFilters(); setMode(mode); renderDrawer(); toast('课程归属已更新','ok');
}
function scopeOptions(list,cur){
  /* 归属下拉同样按学段分组，学段名直接作为 optgroup 标签；
     内置整体词库是固定练习类别，不能当作普通教材的归属 */
  if(list===state.grades) return optionGroups(list,g=>stageOfGrade(g.id),cur,'未分类','none');
  return optionGroups(list.filter(b=>!isWordBankBookId(b&&b.id)),stageOfBook,cur,'未分类','none');
}
function renderGrades(){
  const counts={}; allUnits().forEach(u=>counts[u.gradeId]=(counts[u.gradeId]||0)+1);
  $('gradeList').innerHTML=state.grades.length?state.grades.map(g=>
    '<div class="manage-row"><span class="mr-name">'+esc(g.name)+'</span>'+
    '<span class="mr-count">'+(counts[g.id]||0)+' 单元</span>'+
    '<button class="mini-icon" data-rename-grade="'+esc(g.id)+'" title="改名">'+icon('edit')+'</button>'+
    '<button class="mini-icon danger" data-del-grade="'+esc(g.id)+'" title="删除">'+icon('trash')+'</button></div>'
  ).join(''):'<div class="empty">还没有年级，添加一个吧</div>';
}
function renderBooks(){
  const counts={}; allUnits().forEach(u=>counts[u.bookId]=(counts[u.bookId]||0)+1);
  const books=state.books.filter(b=>!isWordBankBookId(b&&b.id));
  $('bookList').innerHTML=books.length?books.map(b=>
    '<div class="manage-row"><span class="mr-name">'+esc(b.name)+'</span>'+
    '<span class="mr-count">'+(counts[b.id]||0)+' 单元</span>'+
    '<button class="mini-icon" data-rename-book="'+esc(b.id)+'" title="改名">'+icon('edit')+'</button>'+
    '<button class="mini-icon danger" data-del-book="'+esc(b.id)+'" title="删除">'+icon('trash')+'</button></div>'
  ).join(''):'<div class="empty">还没有教材版本，添加一个吧</div>';
}
function renderUnitMetaList(){
  /* 词库单元的归属固定内置，不出现在可编辑列表里，避免误改后筛选失效 */
  $('unitMetaList').innerHTML=allUnits().filter(u=>!isWordBankUnit(u)).map(u=>
    '<div class="unit-meta-row"><div class="umr-top">'+esc(u.name)+
      ' <span style="color:var(--muted);font-weight:400">· '+u.sentences.length+' 题</span></div>'+
      '<div class="umr-row">'+
        '<label>年级 <span class="sel"><select data-unit-grade="'+esc(u.id)+'">'+scopeOptions(state.grades,u.gradeId)+'</select></span></label>'+
        '<label>教材 <span class="sel"><select data-unit-book="'+esc(u.id)+'">'+scopeOptions(state.books,u.bookId)+'</select></span></label>'+
      '</div></div>'
  ).join('');
}
function renderManagement(){ renderGrades(); renderBooks(); renderUnitMetaList(); }

