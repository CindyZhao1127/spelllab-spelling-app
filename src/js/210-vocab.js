/* ---------------- 生词本 ---------------- */
let vocabSelected=new Set(), vocabQuery='', vocabOnlyNew=false, drawerTab='learn';
function normWord(w){ return String(w||'').trim().toLowerCase(); }
function activeScopeIds(){
  const f=state.filter||{}, stage=f.stageId||'all';
  const defaultGrade=stage==='junior'?(systemId()==='54'?'j6':'g7'):'g4';
  return {gradeId:(f.gradeId&&f.gradeId!=='all')?f.gradeId:defaultGrade,
          bookId:(f.bookId&&f.bookId!=='all')?f.bookId:'b_hj',
          volumeId:(f.volumeId&&f.volumeId!=='all')?f.volumeId:''};
}
function addVocab(en,cn,source,scope,quiet){
  const word=String(en||'').trim();
  if(!/^[A-Za-z][A-Za-z'-]*$/.test(word)){ if(!quiet) toast('请填写合法的英文单词','bad'); return null; }
  const key=normWord(word), exist=state.vocab.find(v=>normWord(v.en)===key);
  if(exist){
    if(cn) exist.cn=String(cn).trim()||exist.cn;
    saveState();
    if(!quiet){ renderDrawer(); toast('已在生词本中，词义已更新'); }
    return exist;
  }
  const sc=scope||activeScopeIds();
  const v={id:nextId('v'),en:word,cn:String(cn||'').trim()||'（未填词义）',
    source:String(source||'').trim()||'手动添加',gradeId:sc.gradeId,bookId:sc.bookId,
    m:0,ok:0,bad:0,added:Date.now()};
  state.vocab.push(v); saveState();
  if(!quiet){ renderDrawer(); toast('已加入生词本：'+word,'ok'); }
  return v;
}
function removeVocab(id){
  state.vocab=state.vocab.filter(v=>v.id!==id);
  vocabSelected.delete(id); saveState(); renderVocab(); toast('已从生词本移除');
}
function toggleVocabMastered(id){
  const v=state.vocab.find(x=>x.id===id); if(!v) return;
  v.m=(v.m||0)>=3?0:3; saveState(); renderVocab();
  toast(v.m?'已标记为掌握':'已放回待复习',v.m?'ok':'');
}
function visibleVocab(){
  const f=state.filter||{}, q=String(vocabQuery||'').trim().toLowerCase();
  return state.vocab.filter(v=>{
    if(f.stageId&&f.stageId!=='all'&&stageOfGrade(v.gradeId)!==f.stageId) return false;
    if(f.gradeId&&f.gradeId!=='all'&&!sameGrade(v.gradeId,f.gradeId)) return false;
    if(f.bookId&&f.bookId!=='all'&&v.bookId!==f.bookId) return false;
    if(vocabOnlyNew&&(v.m||0)>=3) return false;
    if(q && !(v.en.toLowerCase().includes(q)||String(v.cn).toLowerCase().includes(q)||String(v.source).toLowerCase().includes(q))) return false;
    return true;
  });
}
function renderVocab(){
  const list=visibleVocab();
  $('vocabCount').textContent=state.vocab.length+' 词';
  $('selectedCount').textContent='已选 '+vocabSelected.size+' 词';
  $('vocabOnlyNew').classList.toggle('on',vocabOnlyNew);
  $('vocabList').innerHTML=list.length?list.map(v=>
    '<div class="vocab-item'+(vocabSelected.has(v.id)?' selected':'')+'" data-vocab-row="'+esc(v.id)+'">'+
      '<input type="checkbox" data-vocab-check="'+esc(v.id)+'"'+(vocabSelected.has(v.id)?' checked':'')+' aria-label="选择 '+esc(v.en)+'">'+
      '<div class="vocab-main">'+
        '<div class="vocab-en">'+esc(v.en)+((v.m||0)>=3?' <span class="badge ok">已掌握</span>':'')+'</div>'+
        '<div class="vocab-cn">'+esc(v.cn)+'</div>'+
        '<div class="vocab-detail" id="vocabDetail-'+esc(v.id)+'" hidden>'+esc(wordDetail(v.en,v.cn))+'</div>'+
        '<div class="vocab-meta"><span class="badge">'+esc(gradeName(v.gradeId))+'</span>'+
          '<span class="badge">'+esc(bookName(v.bookId))+'</span>'+esc(v.source)+' · 拼对 '+(v.ok||0)+' 次</div>'+
      '</div>'+
      '<button class="mini-icon" data-vocab-detail="'+esc(v.id)+'" title="详细释义">详</button>'+
      '<button class="mini-icon" data-vocab-speak="'+esc(v.id)+'" title="朗读">'+icon('volume')+'</button>'+
      '<button class="mini-icon" data-vocab-master="'+esc(v.id)+'" title="标记掌握 / 取消">'+icon('star')+'</button>'+
      '<button class="mini-icon danger" data-vocab-del="'+esc(v.id)+'" title="移除">'+icon('trash')+'</button>'+
    '</div>'
  ).join(''):'<div class="empty">'+(state.vocab.length?'当前筛选下没有生词':'生词本还是空的，先添加几个词吧')+'</div>';
}
function selectVisibleVocab(on){
  visibleVocab().forEach(v=>{ if(on) vocabSelected.add(v.id); else vocabSelected.delete(v.id); });
  renderVocab();
}
function importUnitWords(){
  const u=currentUnit(), list=u.words||[];
  if(!list.length){ toast('当前单元没有单词卡','bad'); return 0; }
  const sc={gradeId:u.gradeId,bookId:u.bookId};
  let n=0;
  list.forEach(w=>{
    if(!state.vocab.some(v=>normWord(v.en)===normWord(w[0]))){
      if(addVocab(w[0],w[1],u.name,sc,true)) n++;
    }
  });
  renderVocab(); toast(n?('导入 '+n+' 个生词'):'这些词都已在生词本里',n?'ok':'');
  return n;
}
function importWrongWords(){
  let n=0;
  state.wrong.forEach(w=>{
    const u=unitById(w.unitId), q=u&&u.sentences[w.idx];
    tokenize(q?q.en:w.en,q?q.hints:[],q?q.cn:w.cn).forEach(t=>{
      if(t.punct||t.word.length<3) return;
      if(state.vocab.some(v=>normWord(v.en)===normWord(t.word))) return;
      if(addVocab(t.word,t.hint||'',u?u.name:'错题本',
        {gradeId:u?u.gradeId:'g4',bookId:u?u.bookId:'b_hj'},true)) n++;
    });
  });
  renderVocab(); toast(n?('从错题收录 '+n+' 个词'):'错题里没有可收录的新词',n?'ok':'');
  return n;
}
function starCurrentWord(){
  if(!wordCur) return;
  const u=currentUnit(), before=state.vocab.length;
  addVocab(wordCur[0],wordCur[1],u.name,{gradeId:u.gradeId,bookId:u.bookId});
  if(state.vocab.length>before) SFX.flip();
}

