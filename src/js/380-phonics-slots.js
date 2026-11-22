/* ---- 音节输入格：与句子练习完全同款，一个音节一个 .slot，逐格输入自动判定 ---- */
function phPaintBoxes(i){
  const slot=phSlotEls[i]; if(!slot||!slot.classList.contains('boxed')) return;
  const word=phTokens[i].word, given=Number(slot.dataset.given)||0;
  const typed=String(phDraft[i]||''), input=slot.querySelector('input');
  const bs=slot.querySelectorAll('.lbox');
  for(let j=0;j<bs.length;j++){
    const b=bs[j], ch=j<given?word[j]:(typed[j-given]||'');
    b.textContent=ch||'';
    b.classList.toggle('filled',!!ch);
    b.classList.toggle('current',!input.readOnly && j===given+typed.length);
  }
}
function phBuildSlots(word,show){
  const box=$('phSlots'); box.innerHTML=''; phSlotEls=[];
  if(!word) return;
  phTokens=phonicsChunks(word).map(c=>({word:c[0],hint:c[1]||''}));
  phDraft=phTokens.map(()=>'');
  if(box.style && box.style.setProperty){
    box.style.setProperty('--word-gap',(Number(state.settings.wordGap)||22)+'px');
    box.style.setProperty('--hint-max','180px');
  }
  phTokens.forEach((t,i)=>{
    const el=document.createElement('div');
    el.className='slot boxed';
    const given=show?Math.max(0,t.word.length-1):revealCount(t.word);
    el.dataset.given=String(given);
    const hint=show?(t.hint?('/'+t.hint+'/'):'第'+(i+1)+'音节'):('第'+(i+1)+'音节 · '+t.word.length+' 字母');
    const inputHtml='<input type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" inputmode="text" aria-label="'+esc(hint)+'">';
    let boxes='';
    for(let j=0;j<t.word.length;j++){ const g=j<given; boxes+='<span class="lbox'+(g?' given':'')+'">'+(g?esc(t.word[j]):'')+'</span>'; }
    el.innerHTML='<div class="slot-core"><div class="answer"><div class="boxes">'+boxes+'</div>'+inputHtml+'</div><div class="line"></div></div>'+
      '<div class="hint">'+esc(hint)+'</div>';
    const input=el.querySelector('input'); input.dataset.i=i;
    box.appendChild(el); phSlotEls.push(el);
  });
  phSlotEls.forEach((s,i)=>{ if(s) phPaintBoxes(i); });
}
function phSyncInput(){
  $('phInput').value=phTokens.map((t,i)=>
    t.word.slice(0,Number(phSlotEls[i]&&phSlotEls[i].dataset.given)||0)+String(phDraft[i]||'')).join('');
}
function phNextEditable(from){
  for(let j=from+1;j<phSlotEls.length;j++){ const s=phSlotEls[j]; if(s&&!s.querySelector('input').readOnly) return j; }
  return null;
}
function phOnSlotInput(e){
  const input=e.target, i=Number(input.dataset.i);
  const slot=phSlotEls[i]; if(!slot||input.readOnly) return;
  const given=Number(slot.dataset.given)||0, need=Math.max(1,phTokens[i].word.length-given);
  let clean=input.value.replace(/[^A-Za-z]/g,'');
  if(clean.length>need) clean=clean.slice(0,need);
  if(clean!==input.value) input.value=clean;
  phDraft[i]=clean; phPaintBoxes(i); phSyncInput();
  if(clean.length===need) phCommitSlot(i);
}
function phCommitSlot(i){
  const slot=phSlotEls[i]; if(!slot) return false;
  const input=slot.querySelector('input'); if(input.readOnly) return true;
  const word=phTokens[i].word, given=Number(slot.dataset.given)||0, typed=String(phDraft[i]||'');
  if(!typed) return false;
  const val=(word.slice(0,given)+typed).toLowerCase();
  if(val===word.toLowerCase()){
    input.value=word.slice(given); input.readOnly=true; phDraft[i]=word.slice(given);
    slot.classList.remove('wrong'); slot.classList.add('correct'); phPaintBoxes(i); SFX.correct();
    const n=phNextEditable(i);
    if(n!=null){ phSlotEls[n].querySelector('input').focus(); return true; }
    phSyncInput();
    if(!phSolved) phCheck();
    return true;
  }
  slot.classList.remove('wrong'); void slot.offsetWidth; slot.classList.add('wrong'); SFX.wrong();
  return false;
}
function phOnSlotKey(e){
  const i=Number(e.target.dataset.i);
  if(e.key===' '||e.key==='Enter'){
    e.preventDefault();
    if(phSolved){ if(e.key==='Enter') phAdvance(); return; }
    phCommitSlot(i);
  }else if(e.key==='Backspace'&&e.target.value===''){
    for(let j=i-1;j>=0;j--){ const s=phSlotEls[j]; if(s&&!s.querySelector('input').readOnly){ e.preventDefault(); s.querySelector('input').focus(); break; } }
  }else if(e.key==='ArrowRight'&&e.target.selectionStart===e.target.value.length){
    const n=phNextEditable(i); if(n!=null){ e.preventDefault(); phSlotEls[n].querySelector('input').focus(); }
  }else if(e.key==='ArrowLeft'&&e.target.selectionStart===0){
    for(let j=i-1;j>=0;j--){ const s=phSlotEls[j]; if(s&&!s.querySelector('input').readOnly){ e.preventDefault(); s.querySelector('input').focus(); break; } }
  }
}
function phShow(){
  if(!phLesson || !phQueue.length) return;
  const idx=phQueue[phPos%phQueue.length];
  const item=phLesson.l.w[idx]||phLesson.l.w[0];
  phLast=item; phSolved=false; phChunkLevel=0; phStartedAt=Date.now();
  const mode=$('phMode').value==='read'?'read':'listen';
  const show=mode==='read';
  /* 真实界面：句子练习同款大字题干 + 音节输入格 */
  $('phQuestionCn').textContent=String(item[1]||'');
  $('phStageLabel').textContent=mode==='listen'?'听发音 · 按音节拼出英文单词':'看中文 · 按音节拼出英文单词';
  $('phMetaChip').textContent='自然拼读 · '+(mode==='listen'?'听音拼词':'看词拼读');
  $('phSuccessCard').hidden=true;
  $('phFeedbackNew').textContent=''; $('phFeedbackNew').className='feedback';
  phBuildSlots(item[0],show);
  /* 兼容旧逻辑/测试 */
  $('phPrompt').innerHTML=(mode==='listen'?'听发音，按音节拼出这个英文单词':'看中文，结合音素分块拼出单词')+
    '<b>'+esc(item[1])+'</b>';
  const ph=phLesson.l.s||phonicsChunks(item[0]).map(c=>c[1]).filter(Boolean).join(' ');
  $('phHint').textContent=mode==='read'?('音素 /'+ph+'/ · 首字母 '+item[0][0].toUpperCase()):'';
  $('phInput').value=''; $('phInput').disabled=false;
  $('phFeedback').textContent=''; $('phFeedback').className='ph-feedback';
  $('phNext').hidden=true;
  $('phBar').style.width=Math.round((phPos+1)/phQueue.length*100)+'%';
  phRenderChunks();
  if(mode==='listen') phSpeak();
  const first=$('phSlots').querySelector('input');
  if(first) first.focus(); else { try{ $('phInput').focus(); }catch(e){} }
}
function phSpeak(){ if(phLast && typeof speak==='function') speak(phLast[0]); }
function phStore(){ return phTbMode?state.phonics.textbookDone:state.phonics.done; }
function phCheck(){
  if(!phLesson || !phLast || phSolved) return;
  const raw=String($('phInput').value||'').trim();
  if(!raw) return;
  const ok=raw.toLowerCase()===String(phLast[0]).toLowerCase();
  state.phonics.attempted++;
  if(ok){
    state.phonics.correct++; SFX.correct();
    /* 做一部分也能拿分，但按累计答对数节流，避免一词一分刷太快 */
    if(state.phonics.correct%PHONICS_POINTS_EVERY===0 && Number(state.plan.perCorrect||0)>0)
      addPoints(Number(state.plan.perCorrect),'自然拼读答对');
  }
  else SFX.wrong();
  phSolved=true; if(ok) phRoundCorrect++;
  $('phInput').disabled=true; $('phNext').hidden=false;
  $('phFeedback').textContent=ok?'✔ 拼对了！'+phLast[0]:'✘ 正确答案：'+phLast[0];
  $('phFeedback').className='ph-feedback '+(ok?'ok':'bad');
  /* 真实界面：锁定格子、标记对错、显示成功卡片 */
  phSlotEls.forEach((s,i)=>{
    if(!s) return;
    const inp=s.querySelector('input'); if(inp) inp.readOnly=true;
    s.classList.remove('wrong');
    if(ok) s.classList.add('correct');
    else if(!s.classList.contains('correct')) s.classList.add('assisted');
    phPaintBoxes(i);
  });
  $('phFeedbackNew').textContent=ok?'完全正确':'再看一下正确答案';
  $('phFeedbackNew').className='feedback '+(ok?'ok':'bad');
  $('phScTitle').textContent=ok?'完全正确！':'正确答案';
  $('phScEn').textContent=phLast[0];
  $('phScNote').textContent=ok?('已把 '+phLast[0]+' 记住了 · 连对 '+state.stats.streak+' 题'):'照着正确拼写再读两遍，记忆更牢';
  $('phSuccessCard').hidden=false;
  phRenderChunks();
  if(ok) phSpeak();
  /* 每答一次记一条练习记录，和拼写练习共用打卡日历 */
  try{ addHistory({mode:'phonics',unit:phLesson.l.id,cn:phLast[1],en:phLast[0],ok:ok,
    ms:phStartedAt?Date.now()-phStartedAt:0,bad:ok?0:1}); }catch(e){}
  saveState();
}
function phAdvance(){
  if(!phLesson) return;
  if(!phSolved){ phCheck(); return; }
  phPos=(phPos+1)%phQueue.length;
  if(phPos===0){
    const id=phLesson.l.id,store=phStore();
    const d=store[id]||{best:0,right:0,name:''};
    const rate=phQueue.length?phRoundCorrect/phQueue.length:0;
    const stars=rate>=0.9?3:rate>=0.6?2:1;
    d.best=Math.max(Number(d.best)||0,stars);
    d.right=Math.max(0,Math.round(Number(d.right)||0)+1);
    if(phTbMode) d.name=String(phLesson.l.t||'').slice(0,60);
    store[id]=d; phRoundCorrect=0; saveState();
    toast('这一轮完成，获得 '+stars+' 星 · 正确 '+Math.round(rate*100)+'%','ok');
  }
  phShow();
}
function phFinishLesson(){
  if(!phLesson) return;
  const id=phLesson.l.id,store=phStore();
  const d=store[id]||{best:0,right:0,name:''};
  d.best=Math.max(Number(d.best)||0,3);
  d.right=Math.max(0,Math.round(Number(d.right)||0));
  if(phTbMode) d.name=String(phLesson.l.t||'').slice(0,60);
  store[id]=d; saveState();
  phBack(); toast('本课已完成，获得 3 星','ok');
}
function phBack(){
  $('phPracticePanel').hidden=true; $('phPickerPanel').hidden=false;
  phLesson=null; phLast=null; phTbMode=false;
  phSlotEls=[]; phDraft=[]; phTokens=[];
  phRender();
}
function phContinue(){
  if(phSource==='textbook'){
    const rows=phTbRows(),done=state.phonics.textbookDone||{};
    const next=rows.find(r=>!(done[r.key]&&done[r.key].best>0));
    if(!next){ toast('当前范围的教材单词都练过了，可以换一组或选「全部」复习','ok'); return; }
    PH_TB.unit=next.key; phRenderTextbook(); phStartTextbook(next.key); return;
  }
  const ids=Object.keys(state.phonics.done);
  let next=null;
  PHONICS_GROUPS.forEach(g=>g.lessons.forEach(l=>{ if(!next && ids.indexOf(l.id)<0) next=l.id; }));
  if(!next) next=PHONICS_GROUPS[0].lessons[0].id;
  phStart(next);
}

