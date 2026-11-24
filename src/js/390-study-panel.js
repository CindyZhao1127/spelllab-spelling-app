/* ---------------- 学习面板 ---------------- */
function renderDrawer(){
  const us=units();
  $('unitList').innerHTML=us.map((u,i)=>{
    const bank=isWordBankUnit(u);
    const detail=bank ? ('整体词库 · '+((u.words||[]).length)+' 词 · 单词速记')
      : (esc(u.scope)+' · '+esc(u.book)+' · '+u.sentences.length+' 题 · '+((u.words||[]).length)+' 词');
    return '<button class="unit-item'+(i===unitPos?' active':'')+'" data-unit="'+i+'">'+
      esc(u.name)+'<small>'+detail+'</small></button>';
  }).join('');
  const s=state.stats, acc=s.attempted?Math.round(s.correct/s.attempted*100)+'%':'--';
  $('statGrid').innerHTML=
    box(s.todayDone,'今日完成')+box(acc,'总正确率')+box(s.best,'最佳连对')+
    box(Object.values(state.wordStats).filter(x=>(x.m||0)>=2).length,'掌握单词')+
    box(state.vocab.length,'生词本')+box(state.practiceSets.length,'生词练习集');
  $('wrongList').innerHTML=state.wrong.length?state.wrong.slice().reverse().slice(0,12).map(w=>
    '<div class="wrong-item"><button data-wrong="'+esc(w.id)+'">'+esc(w.cn)+'</button><span style="color:var(--muted)">去练习</span></div>'
  ).join(''):'<div class="empty">还没有错题，保持住！</div>';
  [['swHints','showHints'],['swSpeakOnFinish','speakOnFinish'],['swCase','ignoreCase'],
   ['swSmart','smart'],['swSound','sound'],['swLetterBoxes','letterBoxes'],
   ['swAutoVocab','autoVocab'],['swAskResume','askResume'],['swAskNextUnit','askNextUnit']].forEach(([el,k])=>{
    $(el).classList.toggle('on',!!state.settings[k]);
  });
  const vol=typeof state.settings.volume==='number'?state.settings.volume:0.35;
  $('volRange').value=Math.round(vol*100);
  $('volVal').textContent=Math.round(vol*100);
  const reveal=Math.max(0,Math.min(3,Number(state.settings.revealLetters)||0));
  $('revealRange').value=reveal;
  $('revealVal').textContent=reveal;
  const gap=Math.max(10,Math.min(44,Number(state.settings.wordGap)||22));
  $('gapRange').value=gap; $('gapVal').textContent=gap;
  const delay=Math.max(0,Math.min(600,Number(state.settings.speakDelayMs)||0));
  $('speakDelayRange').value=delay; $('speakDelayVal').textContent=delay;
  $('timerModeSel').value=state.settings.timerMode;
  if($('wordOrderSel')) $('wordOrderSel').value=state.settings.wordLetterOrder||'auto';
  $('difficultySel').value=state.settings.difficulty;
  if($('accentSel')) $('accentSel').value=speechAccent();
  if($('accentSwitch')) $('accentSwitch').querySelectorAll('button').forEach(b=>
    b.classList.toggle('active',b.dataset.accent===speechAccent()));
  $('rateRange').value=state.settings.rate;
  $('rateVal').textContent=Number(state.settings.rate).toFixed(1);
  renderHistory(); renderSaveBadge(); renderPlan(); renderLottery();
  renderVocab(); renderPhonics(); renderGrowthMini(); renderSets(); renderManagement(); renderLibrary(); renderFilters();
  if(drawerTab==='storage') renderStorage();
}
function box(v,label){ return '<div class="stat-box"><b>'+esc(v)+'</b><span>'+esc(label)+'</span></div>'; }
function switchTab(t){
  drawerTab=t;
  ['learn','history','vocab','phonics','growth','plan','lottery','manage','library','storage'].forEach(k=>{
    const cap=k[0].toUpperCase()+k.slice(1);
    $('page'+cap).hidden=(k!==t);
    $('tab'+cap).classList.toggle('active',k===t);
  });
  if(t==='history') renderHistory();
  if(t==='storage') renderSaveBadge();
  if(t==='vocab') renderVocab();
  if(t==='phonics') renderPhonics();
  if(t==='growth') renderGrowthMini();
  if(t==='plan') renderPlan();
  if(t==='lottery') renderLottery();
  if(t==='manage') renderManagement();
  if(t==='library') renderLibrary();
  if(t==='storage'){ renderStorage(); if(DESKTOP && STORE.mode==='sqlite') bdStatus(true); }
}
function openDrawer(open,tab){
  $('drawer').classList.toggle('open',open);
  $('mask').classList.toggle('show',open);
  if(open){ if(tab) switchTab(tab); renderDrawer(); }
}
function setSetting(k,v){
  state.settings[k]=v; saveState(); renderDrawer();
  if(k==='showHints'){ $('stage').classList.toggle('hide-hints',!v); $('sHints').classList.toggle('on',v); renderGrammarBar(); }
  if(k==='letterBoxes') refreshBoardSettings();
  if(k==='wordLetterOrder' && mode==='word' && wordCur) renderWord();
  if(k==='difficulty'||k==='timerMode'){ startQuestionTimer(); if(mode!=='word') refreshBoardSettings(); }
  if(k==='smart' && mode!=='word'){
    const curIdx=currentQuestion().idx;
    sessionOrder={unitId:'',list:[]};
    qPos=Math.max(0,order().indexOf(curIdx));
    renderHeader();
  }
}
function refreshBoardSettings(){
  if(mode==='word') return;
  if(mode==='chunk'){ chunkReset(); toast('字母格设置已更新，当前步骤已重做'); return; }
  renderSentence(); toast('字母格设置已更新，本题已重做');
}

