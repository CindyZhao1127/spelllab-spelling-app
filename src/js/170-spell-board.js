/* ---------------- 拼写板（句子 / 短语 / 整句共用） ---------------- */
function boxesOn(){ return !!state.settings.letterBoxes; }
function revealCount(word){
  if(!boxesOn()) return 0;
  /* 简单难度额外露 1 个字母；至少留一个字母给用户 */
  const n=Math.max(0,Math.min(3,(Number(state.settings.revealLetters)||0)+difficulty().bonusReveal));
  return Math.min(n,Math.max(0,String(word).length-1));
}
function slotGiven(i){ const s=slots[i]; return s?Number(s.dataset.given||0):0; }
function boxesMarkup(word,given){
  let out='';
  for(let j=0;j<word.length;j++){
    const g=j<given;
    out+='<span class="lbox'+(g?' given':'')+'">'+(g?esc(word[j]):'')+'</span>';
  }
  return out;
}
function paintBoxes(i){
  const slot=slots[i]; if(!slot||!slot.classList.contains('boxed')) return;
  const word=curTokens[i].word, given=Number(slot.dataset.given)||0;
  const typed=String(draft[i]||'');
  const input=slot.querySelector('input');
  const bs=slot.querySelectorAll('.lbox');
  if(!bs.length) return;
  for(let j=0;j<bs.length;j++){
    const b=bs[j], ch=j<given?word[j]:(typed[j-given]||'');
    b.textContent=ch||'';
    b.classList.toggle('filled',!!ch);
    b.classList.toggle('current',!input.readOnly && j===given+typed.length);
  }
}
function renderBoard(tokens, cn, label, tip, onComplete){
  draft=[]; slots=[]; assisted=false; solved=false;
  curTokens=tokens; boardOnComplete=onComplete;
  $('stageLabel').textContent=label;
  $('questionCn').textContent=cn;
  $('tips').textContent=tip;
  $('slots').hidden=false;
  $('feedback').hidden=false;
  $('feedback').textContent=''; $('feedback').className='feedback';
  $('successCard').hidden=true;
  $('chunkCards').hidden=true;
  $('chunkProgress').hidden=true;
  renderPhaseBar();
  const box=$('slots'); box.innerHTML='';
  const useBoxes=boxesOn();
  if(box.style && typeof box.style.setProperty==='function'){
    box.style.setProperty('--word-gap',(Number(state.settings.wordGap)||22)+'px');
    box.style.setProperty('--hint-max','180px');
  }

  tokens.forEach((t,i)=>{
    const el=document.createElement('div');
    el.className='slot'+(t.punct?' punct':'');
    const hint=t.hint||'·';
    if(t.punct){
      el.innerHTML='<div class="slot-core"><div class="answer">'+esc(t.word)+'</div><div class="line"></div></div>';
      box.appendChild(el); slots.push(null); draft.push(t.word); return;
    }
    const given=revealCount(t.word);
    const inputHtml='<input type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" inputmode="text" aria-label="'+esc(hint)+'">';
    el.dataset.given=String(given);
    el.dataset.givenText=t.word.slice(0,given);
    if(useBoxes){
      el.classList.add('boxed');
      el.innerHTML='<div class="slot-core"><div class="answer"><div class="boxes">'+boxesMarkup(t.word,given)+'</div>'+inputHtml+'</div><div class="line"></div></div>'+
                   '<div class="hint">'+esc(hint)+'</div>';
    }else{
      /* 整词输入框也按内容给宽度，但不再卡死 210px；超长单词由
         .slot[max-width:100%] + .boxes[flex-wrap:wrap] 收在自身词槽内。 */
      const width=Math.max(t.word.length*1.2,hint.length*1.4,3.2);
      el.style.minWidth='min('+Math.round(Math.min(width*20,320))+'px,100%)';
      el.innerHTML='<div class="slot-core"><div class="answer">'+inputHtml+'</div><div class="line"></div></div>'+
                   '<div class="hint">'+esc(hint)+'</div>';
    }
    const input=el.querySelector('input');
    input.dataset.i=i;
    input.addEventListener('input',onSlotInput);
    input.addEventListener('keydown',onSlotKey);
    input.addEventListener('focus',()=>{
      box.querySelectorAll('.slot.focus').forEach(x=>x.classList.remove('focus'));
      el.classList.add('focus');
    });
    input.addEventListener('blur',()=>el.classList.remove('focus'));
    box.appendChild(el);
    slots.push(el); draft.push('');
  });
  if(useBoxes) slots.forEach((s,i)=>{ if(s) paintBoxes(i); });
  renderHeader();
  updateChunkMain();
  startQuestionTimer();
  const first=box.querySelector('input');
  if(first) first.focus();
}
function renderSentence(){
  questionStartedAt=Date.now(); questionMistakes=0;
  const cq=currentQuestion();
  const tip=boxesOn()
    ? '点击字母格逐字输入 · 输满自动判定 · 空格/回车确认 · Tab 跳到下一个词'
    : '点击横线输入单词 · 空格/回车确认 · 输满字母自动判定 · Tab 跳到下一个空';
  renderBoard(tokenize(cq.q.en,cq.q.hints,cq.q.cn), cq.q.cn,
    '看中文 · 按词义提示拼出英文', tip, finishQuestion);
  snapshotSession();
}
function onSlotInput(e){
  const input=e.target, i=Number(input.dataset.i);
  const oldLen=String(draft[i]||'').length;
  const given=slotGiven(i);
  const need=curTokens[i].word.length-given;
  let clean=input.value.replace(/[^A-Za-z'-]/g,'');
  if(clean.length>need) clean=clean.slice(0,need);
  if(clean!==input.value) input.value=clean;
  if(clean.length>oldLen) SFX.key(); else if(clean.length<oldLen) SFX.del();
  draft[i]=clean;
  const slot=slots[i];
  slot.classList.remove('wrong');
  slot.querySelectorAll('.answer').forEach(a=>a.style.color='');
  paintBoxes(i);
  if(clean.length===need) commitSlot(i);
}
function onSlotKey(e){
  const i=Number(e.target.dataset.i);
  if(e.key===' '||e.key==='Enter'){
    e.preventDefault();
    if(solved){
      if(e.key==='Enter'){
        if(mode==='sentence') gotoQuestion(1);
        else if(mode==='chunk' && chunkPhase===1){ clearTimeout(chunkTimer); chunkAdvance(); }
        else if(mode==='chunk' && chunkPhase===2) chunkNextQuestion(1);
      }
      return;
    }
    commitSlot(i);
  }else if(e.key==='Backspace' && e.target.value===''){
    const prev=prevEditable(i);
    if(prev!=null){ e.preventDefault(); slots[prev].querySelector('input').focus(); }
  }else if(e.key==='ArrowRight' && e.target.selectionStart===e.target.value.length){
    const n=nextEditable(i); if(n!=null){ e.preventDefault(); slots[n].querySelector('input').focus(); }
  }else if(e.key==='ArrowLeft' && e.target.selectionStart===0){
    const p=prevEditable(i); if(p!=null){ e.preventDefault(); slots[p].querySelector('input').focus(); }
  }
}
function nextEditable(from){
  for(let j=from+1;j<slots.length;j++){ const s=slots[j]; if(s&&!s.querySelector('input').readOnly) return j; }
  return null;
}
function prevEditable(from){
  for(let j=from-1;j>=0;j--){ const s=slots[j]; if(s&&!s.querySelector('input').readOnly) return j; }
  return null;
}
function equal(a,b){ return state.settings.ignoreCase ? a.toLowerCase()===b.toLowerCase() : a===b; }
function commitSlot(i,fromCheck){
  const slot=slots[i]; if(!slot) return false;
  const input=slot.querySelector('input');
  if(input.readOnly) return true;
  const answer=curTokens[i].word;
  const given=slotGiven(i);
  const typed=input.value.trim();
  if(!typed){ if(!fromCheck){ toast('先输入这个单词','bad'); } return false; }
  const val=answer.slice(0,given)+typed;
  if(equal(val,answer)){
    input.value=answer.slice(given); input.readOnly=true; draft[i]=answer.slice(given);
    slot.classList.remove('wrong'); slot.classList.add('correct');
    paintBoxes(i);
    const done=allCorrect();
    if(!done) SFX.correct();
    const n=nextEditable(i);
    if(n!=null && !fromCheck) slots[n].querySelector('input').focus();
    if(done && boardOnComplete) boardOnComplete();
    return true;
  }
  slot.classList.remove('wrong'); void slot.offsetWidth; slot.classList.add('wrong');
  SFX.wrong();
  if(!fromCheck){ toast('再检查一下这个词的拼写','bad'); }
  autoStarToken(i,'拼错自动收藏');
  markMistake();
  return false;
}
function allCorrect(){
  return slots.every(s=>!s || s.classList.contains('correct')||s.classList.contains('assisted'));
}
function finishQuestion(){
  if(solved) return;
  solved=true;
  const cq=currentQuestion(), id=uid(cq.unit.id,cq.idx);
  const p=state.progress[id]||{m:0,ok:0,bad:0};
  rollDay();
  /* 生词练习集里独立拼对一道题，同步回写生词本掌握度 */
  if(cq.q.vocabWord && !assisted){
    const v=state.vocab.find(x=>normWord(x.en)===normWord(cq.q.vocabWord));
    if(v){ v.ok=(v.ok||0)+1; v.m=Math.min(3,(v.m||0)+1); }
  }
  state.stats.attempted++; state.stats.todayDone++;
  if(!assisted){
    state.stats.correct++; state.stats.todayRight++;
    state.stats.streak++; state.stats.best=Math.max(state.stats.best,state.stats.streak);
    p.ok++; p.m=Math.min(3,(p.m||0)+1);
    state.wrong=state.wrong.filter(w=>w.id!==id);
    /* 整句答对：只巩固此前收录过的词，不把每个词都塞进复习清单 */
    try{ tokenize(cq.q.en,cq.q.hints,cq.q.cn).filter(t=>!t.punct)
      .forEach(t=>srEnroll(t.word,t.hint||cq.q.cn,true,false)); }catch(e){}
  }else{
    state.stats.streak=0;
    p.bad++;
  }
  addHistory({mode:mode,unit:(cq.unit&&cq.unit.name)||'',cn:cq.q.cn,en:cq.q.en,
    ok:!assisted,assisted:!!assisted,ms:Date.now()-questionStartedAt,bad:questionMistakes});
  stopQuestionTimer();
  if(!assisted && Number(state.plan.perCorrect||0)>0)
    addPoints(Number(state.plan.perCorrect),'一次答对');
  unitRoundCount++;
  state.progress[id]=p; saveState(true);   // 关键节点立刻写盘，不等防抖
  SFX.complete();
  $('feedback').textContent=''; $('feedback').className='feedback';
  $('scTitle').textContent=mode==='chunk'
    ? (assisted?'三步完成（借助提示）':'三步完成，整句拼对！')
    : (assisted?'借助提示完成啦':'完全正确！');
  $('scEn').textContent=cq.q.en;
  $('scNote').textContent=assisted?'不借助提示再做一次，记忆会更牢':'已加入掌握清单 · 连对 '+state.stats.streak+' 题';
  $('successCard').hidden=false;
  renderHeader(); renderDrawer(); updateChunkMain();
  if(state.settings.speakOnFinish && mode!=='word'){
    const en=cq.q.en;
    setTimeout(()=>speak(en),Number(state.settings.speakDelayMs)||0);
  }
  snapshotSession();
  const total=order().length||1;
  if(unitRoundCount>=total && !unitRoundPrompted){
    unitRoundPrompted=true;
    if(state.settings.askNextUnit && units().length>1 && typeof setTimeout==='function')
      setTimeout(()=>{ try{ promptNextUnit(); }catch(e){} },400);
  }
}
function markMistake(){
  if(solved) return;
  const cq=currentQuestion(), id=uid(cq.unit.id,cq.idx);
  if(!state.wrong.some(w=>w.id===id)){
    state.wrong.push({id:id,unitId:cq.unit.id,idx:cq.idx,cn:cq.q.cn,en:cq.q.en});
    if(state.wrong.length>60) state.wrong.shift();
    /* 出错的单词进入艾宾浩斯复习计划（整句按词拆开，句子本身也收录一条） */
    try{
      tokenize(cq.q.en,cq.q.hints,cq.q.cn).filter(t=>!t.punct)
        .forEach(t=>srEnroll(t.word,t.hint||cq.q.cn,false,true));
      srEnroll(cq.q.en,cq.q.cn,false,true);
    }catch(e){}
  }
  const p=state.progress[id]||{m:0,ok:0,bad:0};
  p.bad++; p.m=Math.max(0,(p.m||0)-1);
  state.progress[id]=p;
  state.stats.streak=0;
  questionMistakes++;
  saveState(true); renderHeader();
}
function checkAll(){
  if(solved){ if(mode==='sentence') gotoQuestion(1); return; }
  let wrong=0;
  slots.forEach((s,i)=>{ if(s && !s.querySelector('input').readOnly){ if(!commitSlot(i,true)) wrong++; } });
  if(wrong) toast('还有 '+wrong+' 个词需要修改','bad');
  else $('feedback').textContent='';
  if(allCorrect() && boardOnComplete) boardOnComplete();
  renderHeader();
}
function hintCurrent(){
  if(solved) return;
  const maxHints=difficulty().hints;
  if(maxHints<=0){ toast('困难模式不提供提示，试着自己想出来','bad'); return; }
  const active=document.activeElement;
  let i = active && active.dataset && active.dataset.i!=null ? Number(active.dataset.i) : null;
  if(i==null || !slots[i] || slots[i].querySelector('input').readOnly){
    i = slots.findIndex(s=>s && !s.querySelector('input').readOnly);
  }
  if(i<0 || !slots[i]){ toast('本题已经全部填完'); return; }
  const slot=slots[i], answer=curTokens[i].word, input=slot.querySelector('input');
  const hintEl=slot.querySelector('.hint');
  const given=slotGiven(i);
  if(!slot.dataset.hintLevel){
    slot.dataset.hintLevel='1';
    slot.dataset.origHint=hintEl.textContent;
    if(boxesOn()){
      const next=answer[given]||answer[0];
      const left=answer.length-given-String(draft[i]||'').length;
      hintEl.textContent='下一个字母：'+next.toUpperCase()+' · 还差 '+left+' 个字母';
      SFX.flip();
      toast('提示：下一个字母是 '+next.toUpperCase());
    }else{
      hintEl.textContent=answer[0]+' ' + Array(answer.length-1).fill('_').join(' ')+'（'+answer.length+'个字母）';
      SFX.flip();
      toast('提示：首字母是 '+answer[0].toUpperCase());
    }
  }else{
    if(maxHints<2){ toast('当前难度每个词只能提示一次','bad'); return; }
    autoStarToken(i,'用提示自动收藏');
    slot.dataset.hintLevel='2';
    input.value=answer.slice(given); draft[i]=answer.slice(given); input.readOnly=true;
    slot.classList.add('correct','assisted');
    slot.classList.remove('wrong');
    paintBoxes(i);
    hintEl.textContent=slot.dataset.origHint||'';
    assisted=true;
    toast('已显示完整答案（本题不计入掌握）');
    if(allCorrect() && boardOnComplete) boardOnComplete();
    else{ const n=nextEditable(i); if(n!=null) slots[n].querySelector('input').focus(); }
  }
  renderHeader();
}
function gotoQuestion(delta){
  const total=order().length||1;
  qPos=(qPos+delta+total)%total;
  if(mode==='chunk') startChunk(); else renderSentence();
}
function resetQuestion(){
  if(mode==='chunk'){ chunkReset(); return; }
  renderSentence(); toast('本题已重做');
}

