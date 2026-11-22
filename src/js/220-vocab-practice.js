/* ---------------- 从生词本创建练习 ---------------- */
const PRACTICE_TEMPLATES=[
  {en:'My new word is %W.', cn:'我的新单词是「%C」。', hints:['我的','新的','单词','是','%C']},
  {en:'I can spell %W.',    cn:'我会拼「%C」。',       hints:['我','会','拼','%C']},
  {en:'Please write %W.',   cn:'请写出「%C」。',       hints:['请','写出','%C']}
];
function makePracticeSentences(words){
  const out=[];
  words.forEach((w,i)=>{
    const en=w[0], cn=w[1]&&w[1]!=='（未填词义）'?w[1]:'这个单词';
    out.push({cn:'听写：'+cn,en:en,hints:[cn],chunks:[[cn,1]],vocabWord:en});
    const t=PRACTICE_TEMPLATES[i%PRACTICE_TEMPLATES.length];
    out.push({cn:t.cn.replace('%C',cn),en:t.en.replace('%W',en),
              hints:t.hints.map(h=>String(h).replace('%C',cn)),vocabWord:en});
  });
  return out;
}
function createPracticeSet(name){
  let chosen=state.vocab.filter(v=>vocabSelected.has(v.id));
  if(!chosen.length) chosen=visibleVocab();
  if(!chosen.length){ toast('先添加或勾选几个生词','bad'); return null; }
  chosen=chosen.slice(0,15);
  const words=chosen.map(v=>[v.en,v.cn]);
  const sentences=makePracticeSentences(words);
  const sc=activeScopeIds(), d=new Date();
  const nm=String(name||'').trim()||
    ('生词 '+(d.getMonth()+1)+'/'+d.getDate()+' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'));
  const set={id:nextId('ps'),name:nm,gradeId:sc.gradeId,bookId:sc.bookId,
    words:words,sentences:sentences,created:d.getTime()};
  state.practiceSets.push(set); saveState();
  const keepFilter=state.filter||{};
  state.filter={stageId:keepFilter.stageId||'all',gradeId:sc.gradeId,bookId:sc.bookId,
    volumeId:keepFilter.volumeId||'all'};
  unitPos=findUnitIndex('ps:'+set.id);
  qPos=0; wordCur=null; sessionOrder={unitId:'',list:[]};
  vocabSelected.clear();
  renderFilters(); openDrawer(false); setMode('sentence'); renderDrawer();
  toast('已生成「'+nm+'」· '+sentences.length+' 道练习','ok');
  return set;
}
function startPracticeSet(id){
  unitPos=findUnitIndex('ps:'+id);
  qPos=0; wordCur=null; sessionOrder={unitId:'',list:[]};
  openDrawer(false); setMode(mode); renderHeader(); renderDrawer();
  toast('已切换到生词练习集','ok');
}
function deletePracticeSet(id){
  const s=state.practiceSets.find(x=>x.id===id); if(!s) return;
  if(!confirm('删除练习集「'+s.name+'」？')) return;
  state.practiceSets=state.practiceSets.filter(x=>x.id!==id);
  delete state.unitMeta['ps:'+id];
  saveState();
  qPos=0; wordCur=null; unitPos=Math.min(unitPos,Math.max(0,units().length-1));
  sessionOrder={unitId:'',list:[]};
  renderFilters(); setMode(mode); renderDrawer(); toast('练习集已删除');
}
function renderSets(){
  $('setList').innerHTML=state.practiceSets.length?state.practiceSets.slice().reverse().map(s=>
    '<div class="set-item"><div class="si-main"><div class="si-name">'+esc(s.name)+'</div>'+
    '<div class="si-meta">'+esc(gradeName(s.gradeId))+' · '+esc(bookName(s.bookId))+
    ' · '+(s.words||[]).length+' 词 / '+(s.sentences||[]).length+' 题</div></div>'+
    '<button class="mini-icon" data-set-start="'+esc(s.id)+'" title="开始练习">'+icon('play')+'</button>'+
    '<button class="mini-icon danger" data-set-del="'+esc(s.id)+'" title="删除">'+icon('trash')+'</button></div>'
  ).join(''):'<div class="empty">还没有练习集，勾选生词后点「生成练习集」</div>';
}

