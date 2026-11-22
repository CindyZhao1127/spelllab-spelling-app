/* ---------------- 渲染：顶部 / 工具条 ---------------- */
function renderStageControls(){
  const stage=(state.filter&&state.filter.stageId)||'all';
  const stageOpts='<option value="all">全部学段</option>'+
    STAGES.filter(s=>s.id!=='other').map(s=>'<option value="'+s.id+'">'+esc(s.name)+'</option>').join('');
  ['stageFilter','libStage'].forEach(id=>{
    const el=$(id); if(!el) return;
    el.innerHTML=stageOpts; el.value=stage;
  });
  const sys=systemId();
  const sysEl=$('systemFilter');
  if(sysEl){ sysEl.innerHTML=SYSTEMS.map(s=>'<option value="'+s.id+'">'+esc(s.name)+'</option>').join(''); sysEl.value=sys; }
  const tip=$('libStageTip');
  if(tip) tip.textContent=sys==='54'
    ?'五四制：小学一年级～五年级，初中六年级～九年级；六三制的六上/六下列在「其他」。'
    :'六三制：小学一年级～六年级，初中七年级～九年级。选择学段后，下面只显示对应学段的教材。';
}
function renderFilters(){
  const f=state.filter||{}, stage=f.stageId||'all';
  renderStageControls();
  /* 学制决定年级范围，学段决定只显示小学还是初中；年级、教材、册别逐级收窄 */
  const grades=gradeOptions(systemId());
  $('gradeFilter').innerHTML=optionGroups(grades,x=>stageOfGrade(x.id),
    canonicalGradeId(f.gradeId||'all',systemId()),'全部年级','all',x=>x.name,stage);
  $('bookFilter').innerHTML=optionGroups(state.books,stageOfBook,f.bookId||'all',
    '全部教材','all',null,stage);
  $('volumeFilter').innerHTML='<option value="all">全部册别</option>'+
    VOLUMES.map(v=>'<option value="'+esc(v.id)+'">'+esc(v.name)+'</option>').join('');
  $('gradeFilter').value=canonicalGradeId(f.gradeId||'all',systemId());
  $('bookFilter').value=f.bookId||'all';
  $('volumeFilter').value=f.volumeId||'all';
  const visible=units();
  $('filterInfo').textContent=(filterFallback?'该范围暂无课程，已显示全部 · ':'')+'当前 '+visible.length+' 个单元';
}
function resetScopePosition(){ unitPos=0; qPos=0; wordCur=null; sessionOrder={unitId:'',list:[]}; }
function setFilter(k,v){
  if(!state.filter) state.filter={stageId:'all',gradeId:'all',bookId:'all',volumeId:'all'};
  state.filter[k]=v;
  if(k==='stageId'){
    state.filter.gradeId='all'; state.filter.bookId='all'; state.filter.volumeId='all';
  }
  saveState(); resetScopePosition();
  renderFilters(); renderLibrary(); setMode(mode); renderDrawer();
}
function setSystem(v){
  if(v!=='54'&&v!=='63') return;
  state.system=v; ensureGradeCatalog(state);
  if(state.filter){
    state.filter.stageId=state.filter.stageId||'all';
    state.filter.gradeId='all'; state.filter.bookId='all'; state.filter.volumeId='all';
  }
  saveState(); resetScopePosition();
  renderFilters(); renderLibrary(); renderManagement(); setMode(mode); renderDrawer();
  toast('已切换为'+(v==='54'?'五四制（小学 1–5 / 初中 6–9）':'六三制（小学 1–6 / 初中 7–9）'));
}
function renderHeader(){
  const u=currentUnit();
  $('courseName').textContent=(filterFallback?'该范围暂无课程 · ':'')+u.scope+' · '+u.name+' ('+u.sentences.length+'题)';
  const total = order().length||1;
  $('progressBar').style.width = ((qPos+1)/total*100)+'%';
  $('statStreak').textContent = state.stats.streak;
  $('statAcc').textContent = state.stats.attempted ? Math.round(state.stats.correct/state.stats.attempted*100)+'%' : '--';
  renderPoints();
  $('diffChip').textContent='难度 · '+difficulty().label;
  $('stage').classList.toggle('hide-hints',!state.settings.showHints);
  $('sentenceView').hidden = (mode==='word' || mode==='phonics' || mode==='grammar' || mode==='typing' || mode==='growth');
  $('wordView').hidden = mode!=='word';
  $('grammarView').hidden = mode!=='grammar';
  $('phonicsView').hidden = mode!=='phonics';
  $('typingView').hidden = mode!=='typing';
  $('growthView').hidden = mode!=='growth';
  if (document.body && document.body.classList) document.body.classList.toggle('td-typing', mode==='typing');
  $('toolbarSentence').hidden = mode!=='sentence';
  $('toolbarWord').hidden = mode!=='word';
  $('toolbarChunk').hidden = mode!=='chunk';
  document.querySelectorAll('#modeSwitch button').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
}
function renderToolbars(){
  $('toolbarSentence').innerHTML =
    tb('sPrev','left','上一题')+
    tb('sSpeak','volume','朗读英文句子')+
    tb('sStar','star','把本题单词加入生词本')+
    tb('sHints','eye','显示/隐藏逐词中文提示')+
    tb('sHint','bulb','给一个提示')+
    tb('sReset','refresh','重做本题')+
    '<div class="sep"></div>'+
    '<button class="tb-main" id="sCheck">检查答案</button>'+
    '<div class="sep"></div>'+
    tb('sPaper','edit','纸笔听写：写在纸上，家长批阅')+
    tb('sNext','right','下一题')+
    tb('sMenu','menu','学习面板');
  $('toolbarWord').innerHTML =
    tb('wSpeak','volume','朗读这个单词')+
    tb('wStar','star','把这个词加入生词本')+
    tb('wShuffle','shuffle','换一个单词')+
    tb('wAnswer','key','看答案')+
    '<div class="sep"></div>'+
    '<button class="tb-main" id="wNext">下一个单词</button>'+
    '<div class="sep"></div>'+
    tb('wPaper','edit','纸笔听写：写在纸上，家长批阅')+
    tb('wMenu','menu','学习面板');
  $('toolbarChunk').innerHTML =
    tb('cPrev','left','上一题')+
    tb('cSpeak','volume','朗读当前内容')+
    tb('cHint','eye','翻开全部短语 / 拼写提示')+
    tb('cReset','refresh','重做当前步骤')+
    '<div class="sep"></div>'+
    '<button class="tb-main" id="cCheck">开始练短语</button>'+
    '<div class="sep"></div>'+
    tb('cNext','right','下一题')+
    tb('cMenu','menu','学习面板');
  $('btnMenu').innerHTML=icon('menu');
  $('drawerClose').innerHTML=icon('close');
  $('sHints').classList.toggle('on',state.settings.showHints);
}
function tb(id,ic,title,cls){ return '<button class="tb '+(cls||'')+'" id="'+id+'" title="'+title+'" aria-label="'+title+'">'+icon(ic)+'</button>'; }

