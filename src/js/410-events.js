/* ---------------- 事件绑定 ---------------- */
function setMode(m){
  var prev = mode;
  mode=m;
  clearTimeout(chunkTimer);
  // 切模式时收起学习面板与遮罩，避免深色抽屉盖住新视图（打字模式尤其明显）
  if($('drawer') && $('drawer').classList.contains('open')) openDrawer(false);
  renderHeader();
  if(m==='typing'){
    if(typeof window.TypingDuck!=='undefined') window.TypingDuck.enter();
  } else {
    if(prev==='typing' && typeof window.TypingDuck!=='undefined') window.TypingDuck.leave();
    if(m==='growth'){ try{ growthEnter(); }catch(e){} }
    else if(m==='grammar'){ try{ grEnter(); }catch(e){ console.error(e); } }
    else if(m==='phonics'){ try{ phRender(); }catch(e){} }
    else if(m==='word'){ if(!wordCur) pickWord(); else renderWord(); }
    else if(m==='chunk') startChunk();
    else renderSentence();
  }
  snapshotSession();
}
function bind(){
  $('modeSwitch').addEventListener('click',e=>{
    const b=e.target.closest('button[data-mode]'); if(b) setMode(b.dataset.mode);
  });
  if($('grammarTabs')) $('grammarTabs').addEventListener('click',e=>{
    const b=e.target.closest('[data-gtab]'); if(!b) return;
    grTab=b.dataset.gtab; grPos=0; grAnswered=false; grRender();
  });
  $('btnMenu').addEventListener('click',()=>openDrawer(true));
  $('btnManage').addEventListener('click',()=>openDrawer(true,'manage'));
  $('btnLibrary').addEventListener('click',()=>openDrawer(true,'library'));
  $('btnStorage').addEventListener('click',()=>openDrawer(true,'storage'));
  $('goGrowth').addEventListener('click',()=>{ openDrawer(false); setMode('growth'); });
  $('goPaper').addEventListener('click',goPaperDict);
  $('drawerClose').addEventListener('click',()=>openDrawer(false));
  $('mask').addEventListener('click',()=>openDrawer(false));
  $('drawerTabs').addEventListener('click',e=>{
    const b=e.target.closest('button[data-tab]'); if(!b) return;
    if(b.dataset.tab==='phonics'){ openDrawer(false); setMode('phonics'); return; }
    switchTab(b.dataset.tab);
  });
  $('btnPoints').addEventListener('click',()=>openDrawer(true,'plan'));
  $('btnWheel').addEventListener('click',openWheel);
  $('btnParent').addEventListener('click',()=>openParentCenter());
  $('scStar').addEventListener('click',starQuestionWords);
  $('modalMask').addEventListener('click',e=>{
    if(modalDismissible && e.target===$('modalMask')){ hideModal(); sessionSuspended=false; snapshotSession(); }
  });
  /* 盲盒 / 家长弹层 */
  $('btnWheelClose').addEventListener('click',closeWheel);
  $('btnWheelDone').addEventListener('click',closeWheel);
  $('btnSpin').addEventListener('click',spinWheel);
  $('wheelHub').addEventListener('click',spinWheel);
  $('mysteryBox').addEventListener('click',spinWheel);
  $('mysteryBox').addEventListener('keydown',e=>{
    if(e.key==='Enter'||e.key===' '){ e.preventDefault(); spinWheel(); }
  });
  $('wheelMask').addEventListener('click',e=>{ if(e.target===$('wheelMask')) closeWheel(); });
  $('btnParentClose').addEventListener('click',hideParentCenter);
  $('btnParentUnlock').addEventListener('click',unlockParent);
  $('btnParentLock').addEventListener('click',lockParent);
  $('btnParentChange').addEventListener('click',changeParentPassword);
  $('parentMask').addEventListener('click',e=>{ if(e.target===$('parentMask')) hideParentCenter(); });
  $('parentPwd').addEventListener('keydown',e=>{ if(e.key==='Enter') unlockParent(); });
  $('prizeUnlock').addEventListener('click',()=>openParentCenter());
  document.addEventListener('keydown',e=>{
    if(e.key!=='Escape') return;
    if(!$('parentMask').hidden){ hideParentCenter(); return; }
    if(!$('wheelMask').hidden){ closeWheel(); return; }
    if(modalDismissible && !$('modalMask').hidden){
      hideModal(); sessionSuspended=false; snapshotSession();
    }
  });

  /* 练习显示 / 计时 / 难度 */
  $('gapRange').addEventListener('input',e=>{
    state.settings.wordGap=Number(e.target.value);
    $('gapVal').textContent=e.target.value;
    const box=$('slots');
    if(box.style && typeof box.style.setProperty==='function')
      box.style.setProperty('--word-gap',Number(e.target.value)+'px');
    saveState();
  });
  $('speakDelayRange').addEventListener('input',e=>{
    state.settings.speakDelayMs=Number(e.target.value);
    $('speakDelayVal').textContent=e.target.value;
    saveState();
  });
  $('timerModeSel').addEventListener('change',e=>setSetting('timerMode',e.target.value));
  $('difficultySel').addEventListener('change',e=>setSetting('difficulty',e.target.value));
  /* 英美口音：顶栏切换与设置下拉双向同步，重绘当前拼读题的音节格 */
  const setAccent=a=>{
    state.settings.accent=(a==='us')?'us':'uk';
    if($('accentSel')) $('accentSel').value=state.settings.accent;
    if($('accentSwitch')) $('accentSwitch').querySelectorAll('button').forEach(b=>
      b.classList.toggle('active',b.dataset.accent===state.settings.accent));
    saveState(true);
    if(typeof phShow==='function' && phLesson && phLast && !phSolved)
      phBuildSlots(phLast[0], $('phMode')&&$('phMode').value==='read');
    if(typeof speak==='function' && phLast) speak(phLast[0]);
  };
  if($('accentSel')) $('accentSel').addEventListener('change',e=>setAccent(e.target.value));
  if($('accentSwitch')) $('accentSwitch').addEventListener('click',e=>{
    const b=e.target.closest && e.target.closest('button[data-accent]');
    if(b) setAccent(b.dataset.accent);
  });

  /* 学习计划 */
  $('planGoLottery').addEventListener('click',()=>switchTab('lottery'));
  $('swPlanEnabled').addEventListener('click',()=>{
    $('swPlanEnabled').classList.toggle('on');
    savePlanForm();
  });
  $('planSave').addEventListener('click',savePlanForm);

  /* 抽奖设置：所有写操作都过 guardParent('lottery')。
     以后要保护其它设置，在 PARENT_SCOPES 注册新域并照此包一层即可。 */
  $('lotteryCost').addEventListener('change',e=>{
    const v=e.target.value;
    guardParent('lottery',()=>{
      state.lottery.cost=Math.max(1,Math.min(999,Number(v)||10));
      saveState(); lotteryChanged();
    });
  });
  $('typingPointsInput').addEventListener('change',e=>{
    const v=e.target.value;
    guardParent('lottery',()=>{
      state.lottery.typingPoints=Math.max(0,Math.min(99,Math.round(Number(v)||0)));
      saveState(); lotteryChanged(); toast('打字积分兑换已更新','ok');
    });
  });
  $('prizeAdd').addEventListener('click',()=>guardParent('lottery',addPrize));
  $('prizeReset').addEventListener('click',()=>guardParent('lottery',resetPrizes));
  $('prizeList').addEventListener('click',e=>{
    const b=e.target.closest('button[data-prize-del]');
    if(b){ const id=b.dataset.prizeDel; guardParent('lottery',()=>delPrize(id)); }
  });
  $('prizeList').addEventListener('change',e=>{
    const t=e.target, d=t.dataset||{}, v=t.value;
    if(d.prizeName!=null) guardParent('lottery',()=>updatePrizeField(d.prizeName,'name',v));
    else if(d.prizeProb!=null) guardParent('lottery',()=>updatePrizeField(d.prizeProb,'prob',v));
    else if(d.prizeAuto!=null) guardParent('lottery',()=>updatePrizeField(d.prizeAuto,'autoRedeem',!!t.checked));
  });
  /* 线下发放后直接点「标记已兑换」即可，无需家长解锁（设置类操作仍受家长锁保护） */
  if($('prizeWonList')) $('prizeWonList').addEventListener('click',e=>{
    const b=e.target.closest&&e.target.closest('button[data-prize-redeem]');
    if(b) redeemPrize(b.dataset.prizeRedeem);
  });

  $('systemFilter').addEventListener('change',e=>setSystem(e.target.value));
  $('stageFilter').addEventListener('change',e=>setFilter('stageId',e.target.value));
  $('libStage').addEventListener('change',e=>setFilter('stageId',e.target.value));
  $('gradeFilter').addEventListener('change',e=>setFilter('gradeId',e.target.value));
  $('bookFilter').addEventListener('change',e=>setFilter('bookId',e.target.value));
  $('volumeFilter').addEventListener('change',e=>setFilter('volumeId',e.target.value));

  $('toolbarSentence').addEventListener('click',e=>{
    const b=e.target.closest('button'); if(!b) return;
    const cq=currentQuestion();
    switch(b.id){
      case 'sPrev': gotoQuestion(-1); break;
      case 'sNext': gotoQuestion(1); break;
      case 'sSpeak': speak(cq.q.en); break;
      case 'sStar': starQuestionWords(); break;
      case 'sHints': setSetting('showHints',!state.settings.showHints); break;
      case 'sHint': hintCurrent(); break;
      case 'sReset': resetQuestion(); break;
      case 'sCheck': checkAll(); break;
      case 'sPaper': goPaperDict(); break;
      case 'sMenu': openDrawer(true); break;
    }
  });
  $('toolbarWord').addEventListener('click',e=>{
    const b=e.target.closest('button'); if(!b) return;
    switch(b.id){
      case 'wSpeak': if(wordCur) speak(wordCur[0]); break;
      case 'wStar': starCurrentWord(); break;
      case 'wShuffle': pickWord(); break;
      case 'wAnswer': showWordAnswer(); break;
      case 'wNext': pickWord(); break;
      case 'wPaper': goPaperDict(); break;
      case 'wMenu': openDrawer(true); break;
    }
  });
  $('toolbarChunk').addEventListener('click',e=>{
    const b=e.target.closest('button'); if(!b) return;
    switch(b.id){
      case 'cPrev': chunkNextQuestion(-1); break;
      case 'cNext': chunkNextQuestion(1); break;
      case 'cSpeak': chunkSpeak(); break;
      case 'cHint': chunkHint(); break;
      case 'cReset': chunkReset(); break;
      case 'cCheck': chunkMainAction(); break;
      case 'cMenu': openDrawer(true); break;
    }
  });
  $('scSpeak').addEventListener('click',()=>speak(currentQuestion().q.en));
  $('scNext').addEventListener('click',()=>{ if(mode==='chunk') chunkNextQuestion(1); else gotoQuestion(1); });

  $('unitList').addEventListener('click',e=>{
    const b=e.target.closest('button[data-unit]'); if(!b) return;
    unitPos=Number(b.dataset.unit); qPos=0; wordCur=null;
    unitRoundCount=0; unitRoundPrompted=false;
    sessionOrder={unitId:'',list:[]};
    openDrawer(false);
    setMode(mode);
    renderHeader(); renderDrawer();
  });
  $('wrongList').addEventListener('click',e=>{
    const b=e.target.closest('button[data-wrong]'); if(!b) return;
    const w=state.wrong.find(x=>x.id===b.dataset.wrong); if(!w) return;
    if(!unitById(w.unitId)){ toast('该单元已不存在','bad'); return; }
    unitPos=findUnitIndex(w.unitId); qPos=Math.max(0,order().indexOf(w.idx));
    if(mode==='word') mode='sentence';
    openDrawer(false);
    setMode(mode); renderHeader();
  });
  $('clearWrong').addEventListener('click',()=>{ state.wrong=[]; saveState(); renderDrawer(); toast('错题本已清空'); });
  $('exportHistory').addEventListener('click',exportHistoryCSV);
  $('clearHistory').addEventListener('click',()=>{
    if(!(state.history||[]).length){ toast('还没有练习记录'); return; }
    if(!confirm('确定清空全部练习记录？学习统计和掌握进度不会受影响。')) return;
    state.history=[]; saveState(true); renderDrawer(); toast('练习记录已清空');
  });
  document.querySelectorAll('.switch[data-set]').forEach(sw=>{
    sw.addEventListener('click',()=>setSetting(sw.dataset.set,!state.settings[sw.dataset.set]));
  });
  $('rateRange').addEventListener('input',e=>{ state.settings.rate=Number(e.target.value); $('rateVal').textContent=state.settings.rate.toFixed(1); saveState(); });
  $('volRange').addEventListener('input',e=>{
    state.settings.volume=Number(e.target.value)/100;
    $('volVal').textContent=e.target.value;
    saveState(); SFX.key();
  });
  $('revealRange').addEventListener('input',e=>{
    state.settings.revealLetters=Number(e.target.value);
    $('revealVal').textContent=e.target.value;
    saveState();
  });
  $('revealRange').addEventListener('change',()=>refreshBoardSettings());
  $('doImport').addEventListener('click',doImport);
  $('fillExample').addEventListener('click',()=>{
    $('importText').value='今天很冷。| It is cold today. | 它,是,冷的,今天\n我喜欢下雪天。| I like snowy days. | 我,喜欢,下雪的,日子\n外面在刮风吗？| Is it windy outside? | 是,它,有风的,外面';
  });
  $('clearCustom').addEventListener('click',()=>{
    if(!state.custom.length){ toast('我的题库是空的'); return; }
    if(!confirm('确定清空自己导入的全部题目？')) return;
    state.custom=[]; saveState(); unitPos=0; qPos=0; wordCur=null;
    sessionOrder={unitId:'',list:[]};
    renderDrawer(); setMode(mode); toast('已清空自定义题库');
  });
  $('resetAll').addEventListener('click',()=>{
    if(!confirm('确定重置全部学习进度、生词本、教材包和自定义题库？此操作不可恢复（建议先导出全库备份）。')) return;
    state=clone(DEFAULT_STATE); saveState();
    if(STORE.mode==='idb') writeNow();
    unitPos=0; qPos=0; wordCur=null;
    vocabSelected=new Set(); vocabQuery=''; vocabOnlyNew=false;
    libSel={packId:'',unitId:'',qIdx:-1};
    sessionOrder={unitId:'',list:[]};
    switchTab('learn'); renderFilters(); renderDrawer(); setMode(mode); toast('学习数据已重置');
  });

  /* 年级 / 教材版本管理 */
  $('gradeAdd').addEventListener('click',()=>{
    if(addTaxonomy('grade',$('gradeName').value)) $('gradeName').value='';
  });
  $('gradeName').addEventListener('keydown',e=>{
    if(e.key==='Enter' && addTaxonomy('grade',$('gradeName').value)) $('gradeName').value='';
  });
  $('bookAdd').addEventListener('click',()=>{
    if(addTaxonomy('book',$('bookName').value)) $('bookName').value='';
  });
  $('bookName').addEventListener('keydown',e=>{
    if(e.key==='Enter' && addTaxonomy('book',$('bookName').value)) $('bookName').value='';
  });
  $('gradeList').addEventListener('click',e=>{
    const b=e.target.closest('button'); if(!b) return;
    if(b.dataset.renameGrade) renameTaxonomy('grade',b.dataset.renameGrade);
    else if(b.dataset.delGrade) removeTaxonomy('grade',b.dataset.delGrade);
  });
  $('bookList').addEventListener('click',e=>{
    const b=e.target.closest('button'); if(!b) return;
    if(b.dataset.renameBook) renameTaxonomy('book',b.dataset.renameBook);
    else if(b.dataset.delBook) removeTaxonomy('book',b.dataset.delBook);
  });
  $('unitMetaList').addEventListener('change',e=>{
    const t=e.target, d=t.dataset||{};
    if(d.unitGrade) setUnitScope(d.unitGrade,'gradeId',t.value);
    else if(d.unitBook) setUnitScope(d.unitBook,'bookId',t.value);
  });

  /* 生词本 */
  $('vocabAdd').addEventListener('click',()=>{
    if(addVocab($('vocabEn').value,$('vocabCn').value,$('vocabSource').value)){
      $('vocabEn').value=''; $('vocabCn').value='';
    }
  });
  $('vocabEn').addEventListener('keydown',e=>{ if(e.key==='Enter') $('vocabCn').focus(); });
  $('vocabCn').addEventListener('keydown',e=>{
    if(e.key==='Enter' && addVocab($('vocabEn').value,$('vocabCn').value,$('vocabSource').value)){
      $('vocabEn').value=''; $('vocabCn').value='';
    }
  });
  $('vocabImportUnit').addEventListener('click',importUnitWords);
  $('vocabImportWrong').addEventListener('click',importWrongWords);
  $('vocabSearch').addEventListener('input',e=>{ vocabQuery=e.target.value; renderVocab(); });
  $('vocabSelectAll').addEventListener('click',()=>selectVisibleVocab(true));
  $('vocabSelectNone').addEventListener('click',()=>selectVisibleVocab(false));
  $('vocabOnlyNew').addEventListener('click',()=>{ vocabOnlyNew=!vocabOnlyNew; renderVocab(); });
  $('vocabList').addEventListener('change',e=>{
    const cb=e.target.closest&&e.target.closest('input[data-vocab-check]'); if(!cb) return;
    if(cb.checked) vocabSelected.add(cb.dataset.vocabCheck);
    else vocabSelected.delete(cb.dataset.vocabCheck);
    renderVocab();
  });
  $('vocabList').addEventListener('click',e=>{
    const b=e.target.closest&&e.target.closest('button');
    if(b){
      if(b.dataset.vocabSpeak){ const v=state.vocab.find(x=>x.id===b.dataset.vocabSpeak); if(v) speak(v.en); }
      else if(b.dataset.vocabMaster) toggleVocabMastered(b.dataset.vocabMaster);
      else if(b.dataset.vocabDel) removeVocab(b.dataset.vocabDel);
      return;
    }
    if(e.target.tagName==='INPUT') return;
    const row=e.target.closest&&e.target.closest('.vocab-item');
    if(row && row.dataset.vocabRow){
      const id=row.dataset.vocabRow;
      if(vocabSelected.has(id)) vocabSelected.delete(id); else vocabSelected.add(id);
      renderVocab();
    }
  });

  /* 自然拼读 */
  $('phOpenMain').addEventListener('click',()=>{ openDrawer(false); setMode('phonics'); });
  $('phSourceTabs').addEventListener('click',e=>{
    const b=e.target.closest&&e.target.closest('[data-phsource]');
    if(b) phSourceSwitch(b.dataset.phsource);
  });
  $('phGroupList').addEventListener('click',e=>{
    const row=e.target.closest&&e.target.closest('[data-ph]');
    if(row) phStart(row.dataset.ph);
  });
  $('phUnitList').addEventListener('click',e=>{
    const row=e.target.closest&&e.target.closest('[data-phunit]');
    if(row) phStartTextbook(row.dataset.phunit);
  });
  $('phGroupBy').addEventListener('change',e=>{
    PH_TB.groupBy=e.target.value==='pattern'?'pattern':'unit'; PH_TB.unit='all'; phRenderTextbook();
  });
  $('phUnit').addEventListener('change',e=>{ PH_TB.unit=e.target.value; phRenderTextbook(); });
  $('phTbStart').addEventListener('click',()=>phStartTextbook(PH_TB.unit));
  $('phContinue').addEventListener('click',phContinue);
  $('phBack').addEventListener('click',phBack);
  $('phSpeak').addEventListener('click',phSpeak);
  $('phChunkBtn').addEventListener('click',()=>{
    if(!phLast) return;
    phChunkLevel=phChunkLevel?0:1; phRenderChunks();
    if(!phSolved) phBuildSlots(phLast[0],phChunkLevel>0||$('phMode').value==='read');
  });
  $('phShow').addEventListener('click',()=>{
    if(phLast){
      phChunkLevel=1; phRenderChunks();
      $('phFeedback').textContent='答案：'+phLast[0]; $('phFeedback').className='ph-feedback ok';
    }
  });
  $('phShuffle').addEventListener('click',phShuffle);
  $('phAddVocab').addEventListener('click',()=>{ if(typeof phAddVocab==='function') phAddVocab(); });
  $('phNext').addEventListener('click',phAdvance);
  $('phScNext').addEventListener('click',phAdvance);
  $('phScSpeak').addEventListener('click',phSpeak);
  $('phInput').addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); phAdvance(); } });
  /* 音节输入格：事件委托，逐格输入与 Tab/回车跳格 */
  $('phSlots').addEventListener('input',phOnSlotInput);
  $('phSlots').addEventListener('keydown',phOnSlotKey);
  $('phSlots').addEventListener('focusin',e=>{
    const s=e.target.closest&&e.target.closest('.slot');
    if(s){ $('phSlots').querySelectorAll('.slot.focus').forEach(x=>x.classList.remove('focus')); s.classList.add('focus'); }
  });
  $('phSlots').addEventListener('focusout',e=>{
    const s=e.target.closest&&e.target.closest('.slot'); if(s) s.classList.remove('focus');
  });
  $('phMode').addEventListener('change',()=>{ if(phLesson && !phSolved) phShow(); });

  /* 从生词本创建练习 */
  $('createSet').addEventListener('click',()=>{
    if(createPracticeSet($('setName').value)) $('setName').value='';
  });
  $('setList').addEventListener('click',e=>{
    const b=e.target.closest&&e.target.closest('button'); if(!b) return;
    if(b.dataset.setStart) startPracticeSet(b.dataset.setStart);
    else if(b.dataset.setDel) deletePracticeSet(b.dataset.setDel);
  });

  /* 教材库 */
  $('tbCreate').addEventListener('click',()=>{
    if(makePack($('tbName').value,$('tbGrade').value,$('tbBook').value,$('tbVolume').value)) $('tbName').value='';
  });
  $('tbName').addEventListener('keydown',e=>{
    if(e.key==='Enter' && makePack($('tbName').value,$('tbGrade').value,$('tbBook').value,$('tbVolume').value)) $('tbName').value='';
  });
  $('tbList').addEventListener('click',e=>{
    const b=e.target.closest&&e.target.closest('button');
    const row=e.target.closest&&e.target.closest('[data-tb-unit]');
    const unitId=row?row.dataset.tbUnit:'';
    if(b){
      const d=b.dataset;
      if(d.tbAddunit) addUnit(d.tbAddunit,'');
      else if(d.tbToggle) togglePack(d.tbToggle);
      else if(d.tbVolume) setPackVolume(d.tbVolume);
      else if(d.tbDelpack) removePack(d.tbDelpack);
      else if(d.tbRename) renameUnit(d.tbRename,unitId);
      else if(d.tbDelunit) removeUnit(d.tbDelunit,unitId);
      else if(d.tbExport){
        const p=tbPack(d.tbExport);
        if(p) emitJSON('spelllab-'+p.name.replace(/[\\/:*?"<>|]/g,'_')+'.json',packExportPayload([p]));
      }
      return;
    }
    const opener=e.target.closest&&e.target.closest('[data-tb-open]');
    if(opener){
      libSel={packId:opener.dataset.tbOpen,unitId:opener.dataset.tbUnit||'',qIdx:-1};
      renderLibrary();
    }
  });
  $('tbEditor').addEventListener('click',e=>{
    const b=e.target.closest&&e.target.closest('button'); if(!b) return;
    const d=b.dataset;
    if(d.tbEditq!=null) editQuestion(Number(d.tbEditq));
    else if(d.tbDelq!=null) removeQuestion(Number(d.tbDelq));
    else if(d.tbDelword!=null) removeWord(Number(d.tbDelword));
    else switch(b.id){
      case 'tbRenameUnit': renameUnit(libSel.packId,libSel.unitId,$('tbUnitName').value); break;
      case 'qSave': saveQuestion(); break;
      case 'qCancel': libSel.qIdx=-1; renderTbEditor(); break;
      case 'qBulkAdd': tbBulkQuestions(); break;
      case 'wBulkAdd': tbBulkWords(); break;
    }
  });
  $('packImport').addEventListener('click',()=>importPackText($('packIO').value));
  $('packExportAll').addEventListener('click',()=>{
    if(!tbPacks().length){ toast('还没有教材包可导出','bad'); return; }
    emitJSON('spelllab-textbooks.json',packExportPayload(tbPacks()));
  });
  $('backupAll').addEventListener('click',()=>emitJSON('spelllab-backup-'+today()+'.json',backupPayload()));
  $('restoreAll').addEventListener('click',()=>{
    if(!$('packIO').value.trim()){ toast('请先把备份 JSON 粘贴到文本框，或选择文件','bad'); return; }
    restoreBackup($('packIO').value);
  });
  $('packFile').addEventListener('change',e=>{
    const f=e.target.files&&e.target.files[0]; if(!f) return;
    const read=txt=>{
      $('packIO').value=String(txt||'');
      const r=parsePackJSON($('packIO').value);
      if(r.error) toast(r.error,'bad'); else importPackText($('packIO').value);
    };
    if(f.text&&typeof f.text==='function'){ f.text().then(read).catch(()=>toast('文件读取失败','bad')); }
    else if(typeof FileReader!=='undefined'){
      const fr=new FileReader();
      fr.onload=()=>read(String(fr.result||''));
      fr.onerror=()=>toast('文件读取失败','bad');
      fr.readAsText(f,'utf-8');
    } else { toast('当前浏览器不支持读取本地文件，请粘贴 JSON 文本','bad'); }
    e.target.value='';
  });

  /* 本地数据库 */
  $('dbRefresh').addEventListener('click',async()=>{
    if(DESKTOP){
      try{
        const info=await DESKTOP_API.info();
        STORE.dbPath=info.dbPath||''; STORE.dbSize=info.size||0;
        STORE.dbCounts=info.counts||null; STORE.savedAt=info.savedAt||STORE.savedAt;
        STORE.error='';
      }catch(e){ STORE.error='读取数据库信息失败：'+String((e&&e.message)||e); }
    }else await refreshStorageInfo();
    renderStorage(); toast('存储状态已刷新');
  });
  $('dbPersist').addEventListener('click',()=>requestPersist());
  $('dbVacuum').addEventListener('click',async()=>{
    STORE.queued=false;
    if(DESKTOP){
      try{
        const r=await DESKTOP_API.save(clone(state));
        STORE.savedAt=r.savedAt||STORE.savedAt; STORE.error='';
        toast('已写入 SQLite 数据库','ok');
      }catch(e){ STORE.error='SQLite 写入失败：'+String((e&&e.message)||e); toast('写入失败','bad'); }
      renderStorage(); return;
    }
    writeMirror(true); const ok=await writeNow(); renderStorage();
    toast(ok?'已写入本地数据库':'已写入镜像（数据库不可用）',ok?'ok':'bad');
  });
  $('dbBindFile').addEventListener('click',()=>bindDataFile());
  $('dbSyncFile').addEventListener('click',()=>syncDataFile());
  $('dbUnbindFile').addEventListener('click',()=>unbindDataFile());
  $('dbBackup').addEventListener('click',()=>emitJSON('spelllab-backup-'+today()+'.json',backupPayload()));
  $('dbExportSQL').addEventListener('click',()=>{
    const name='spelllab-'+today()+'.sql', text=exportSQLite();
    if(downloadText(name,text,'text/plain;charset=utf-8')) toast('已导出 '+name+'（'+text.split('\n').length+' 行）','ok');
    else toast('浏览器未开放直接下载','bad');
  });
  $('dbImportFile').addEventListener('click',()=>{ if($('dbRestoreFile').click) $('dbRestoreFile').click(); });
  $('dbRestoreFile').addEventListener('change',readRestoreFile);
  $('dbWipe').addEventListener('click',()=>wipeDatabase());

  /* 桌面版专用：SQLite 数据文件夹 / 备份 / 从网页版迁移 */
  $('dbOpenFolder').addEventListener('click',()=>{
    DESKTOP_API.openFolder().then(()=>toast('已打开数据文件夹'))
      .catch(e=>toast('打开失败：'+String((e&&e.message)||e),'bad'));
  });
  $('dbExportBackup').addEventListener('click',()=>{
    const name='spelllab-backup-'+today()+'.json';
    DESKTOP_API.exportFile(JSON.stringify(backupPayload(),null,2),name)
      .then(r=>toast('备份已保存到 '+r.path,'ok'))
      .catch(e=>toast('保存失败：'+String((e&&e.message)||e),'bad'));
  });
  $('dbImportBackup').addEventListener('click',()=>{
    if($('desktopImportFile').click) $('desktopImportFile').click();
  });
  $('desktopImportFile').addEventListener('change',e=>{
    const f=e.target.files&&e.target.files[0]; if(!f) return;
    const read=txt=>{
      if(restoreBackup(String(txt||''))){ saveState(); toast('已从备份恢复并写入 SQLite','ok'); }
    };
    if(f.text&&typeof f.text==='function') f.text().then(read).catch(()=>toast('文件读取失败','bad'));
    else if(typeof FileReader!=='undefined'){
      const fr=new FileReader();
      fr.onload=()=>read(String(fr.result||''));
      fr.onerror=()=>toast('文件读取失败','bad');
      fr.readAsText(f,'utf-8');
    }else toast('当前窗口不支持读取本地文件','bad');
    e.target.value='';
  });

  document.addEventListener('keydown',e=>{
    if(mode!=='word') return;
    if(e.target.tagName==='TEXTAREA'||e.target.tagName==='INPUT') return;
    if(e.target.tagName==='BUTTON' && (e.key==='Enter'||e.key===' ')) return;
    if($('drawer').classList.contains('open')) return;
    if(/^[a-zA-Z']$/.test(e.key)){ e.preventDefault(); addLetterByKey(e.key); }
    else if(e.key==='Backspace'){ e.preventDefault(); undoAt(placed.length-1); }
    else if(e.key==='Enter'){ e.preventDefault(); pickWord(); }
    else if(e.key===' '){ e.preventDefault(); if(wordCur) speak(wordCur[0]); }
  });

  /* ---- 成长中心 ---- */
  $('growthTabs').addEventListener('click',e=>{
    const b=e.target.closest('button[data-g]'); if(b) switchGrowth(b.dataset.g);
  });
  $('srStart').addEventListener('click',()=>srStart(false));
  $('srStartAll').addEventListener('click',()=>srStart(true));
  $('srWipe').addEventListener('click',()=>{
    showModal({title:'清空复习计划',text:'将删除全部间隔复习记录，主练习进度和生词本不受影响。确定吗？',
      actions:[{label:'取消'},{label:'确定清空',primary:true,onClick:()=>{
        memo().srs={}; srQueue=[]; srIdx=0; srCurrent=null; srPhase='idle';
        $('srPrompt').hidden=true; $('srInput').hidden=true; $('srActions').hidden=true;
        $('srFeedback').textContent=''; srRenderList(); saveState(true); toast('复习计划已清空','ok');
      }}]});
  });
  $('srInput').addEventListener('keydown',e=>{
    if(e.key!=='Enter'||e.isComposing) return;
    e.preventDefault(); if(e.stopPropagation) e.stopPropagation();
    if(srPhase==='ask') srSubmit();
    else if(srPhase==='answered'){ srIdx++; srNextCard(); }
  });
  $('srShow').addEventListener('click',()=>{
    if(!srCurrent) return;
    srEnroll(srCurrent.en,srCurrent.cn,false,true);
    $('srFeedback').className='gfeedback';
    $('srFeedback').innerHTML='答案：<span class="ganswer">'+esc(srCurrent.en)+'</span>';
    srPhase='answered'; $('srInput').disabled=true;
  });
  $('srAgain').addEventListener('click',()=>{
    if(!srCurrent) return;
    srEnroll(srCurrent.en,srCurrent.cn,false,true);
    srPhase='ask'; $('srInput').disabled=false; $('srInput').value='';
    try{ $('srInput').focus(); }catch(e){}
  });
  $('srNext').addEventListener('click',()=>{ if(srPhase==='answered'){ srIdx++; srNextCard(); } });

  $('dcStart').addEventListener('click',dcStart);
  $('dcSpeak').addEventListener('click',()=>{ if(dcCurrent) speak(dcCurrent.en); });
  $('dcInput').addEventListener('keydown',e=>{
    if(e.key!=='Enter'||e.isComposing) return;
    e.preventDefault(); if(e.stopPropagation) e.stopPropagation();
    if(dcPhase==='ask') dcSubmit();
    else if(dcPhase==='answered') dcAdvance(false);
  });
  $('dcNext').addEventListener('click',()=>dcAdvance(false));
  $('dcSkip').addEventListener('click',()=>dcAdvance(true));

  /* ---- 纸笔听写（家长批阅） ---- */
  $('ppStart').addEventListener('click',ppStart);
  $('ppSpeak').addEventListener('click',()=>ppSpeakText(ppCurrent));
  $('ppNext').addEventListener('click',ppNext);
  $('ppFinish').addEventListener('click',ppShowGrade);
  $('ppSave').addEventListener('click',ppSave);
  $('ppAgain').addEventListener('click',()=>{ $('ppGradeCard').hidden=true; ppPhase='idle'; ppStart(); });
  $('ppList').addEventListener('click',e=>{
    const sp=e.target.closest('button[data-pp-speak]');
    if(sp){ const i=Number(sp.dataset.ppSpeak); ppSpeakText(ppQueue[i]); return; }
    const b=e.target.closest('button[data-pp-mark]');
    if(b){
      const i=Number(b.dataset.ppMark);
      if(ppMarks[i]!=null && ppMarks[i]===(b.dataset.ppVal==='1')) ppMarks[i]=null;
      else ppMarks[i]=(b.dataset.ppVal==='1');
      ppRenderGrade();
    }
  });

  /* 答完后输入框会被 disabled，键盘事件不再落到它身上：
     用文档级兜底让「答完再按回车」直接进入下一题，复习/听写都适用。 */
  document.addEventListener('keydown',e=>{
    if(e.key!=='Enter'||e.repeat||e.isComposing) return;
    if($('growthView').hidden) return;
    if(!$('wheelMask').hidden||!$('parentMask').hidden||!$('modalMask').hidden) return;
    if(typeof window.TypingDuck!=='undefined'&&typeof window.TypingDuck.isActive==='function'&&window.TypingDuck.isActive()) return;
    const t=e.target, tag=t&&t.tagName;
    if(tag==='BUTTON'||tag==='TEXTAREA'||(tag==='INPUT'&&t.id!=='srInput'&&t.id!=='dcInput')) return;
    if(growthTab==='review'&&srPhase==='answered'&&srCurrent&&!$('srInput').hidden){
      e.preventDefault(); srIdx++; srNextCard(); return;
    }
    if(growthTab==='dict'&&dcPhase==='answered'&&dcCurrent&&!$('dcInput').hidden){
      e.preventDefault(); dcAdvance(false);
    }
  });

  $('mapToggle').addEventListener('click',()=>{ memo().mapUnlockAll=!memo().mapUnlockAll; saveState(); mapRender(); });
  $('mapGrid').addEventListener('click',e=>{
    const b=e.target.closest('button[data-lv]'); if(!b||b.disabled) return;
    const u=units()[Number(b.dataset.lv)]; if(!u) return;
    unitPos=Number(b.dataset.lv); qPos=0; wordCur=null; unitRoundCount=0; unitRoundPrompted=false;
    sessionOrder={unitId:'',list:[]};
    setMode('sentence'); toast('已跳到第 '+(unitPos+1)+' 关：'+u.name,'ok');
  });
}

