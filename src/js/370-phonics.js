/* ---------------- 自然拼读练习 ----------------
   内置课程进度存 state.phonics.done，教材单词进度存 state.phonics.textbookDone，
   都是 {best:星级,right:完成轮数}。两种来源共用「听音拼词 / 看词拼读」作答流程，
   教材单词额外提供音素分块提示，并按拼读规律自动归类。 */
let phLesson=null, phQueue=[], phPos=0, phSolved=false, phLast=null, phStartedAt=0;
let phSource='builtin', phTbMode=false, phChunkLevel=0, phRoundCorrect=0;
/* 拼读积分节流：每累计答对 5 个词才发一次「一次答对」分。
   词短且可反复练同一课，一词一分会刷太快（抽奖一次要 10 分）。 */
const PHONICS_POINTS_EVERY=5;
/* 拼读练习的「音节输入格」：与句子练习同款，一个音节一个格，逐格输入自动判定。
   独立于句子练习的 slots/draft/curTokens，避免模式间互相污染。 */
let phSlotEls=[], phDraft=[], phTokens=[];
/* 教材来源直接复用顶部「学习范围」（state.filter），不再单独配置学段/教材/册。
   PH_TB 只保留拼读自己的组织方式：按单元还是按拼读规律、选中哪个单元/组。 */
const PH_TB={groupBy:'unit',unit:'all'};
function renderPhonics(){ phRender(); }
function phStars(n){
  n=Math.max(0,Math.min(3,Math.round(Number(n)||0)));
  return '<span class="on">'+'★'.repeat(n)+'</span><span class="off">'+'★'.repeat(3-n)+'</span>';
}
function phDone(id){ const d=state.phonics.done[id]; return d&&d.best?d:null; }
function phRender(){
  const total=phonicsCount();
  const done=Object.values(state.phonics.done).filter(x=>x&&x.best>0).length;
  $('phStat').textContent=done+' / '+total.lessons;
  $('phGroupList').innerHTML=PHONICS_GROUPS.map(g=>
    '<div class="ph-group">'+esc(g.name)+' · '+esc(g.desc)+'</div>'+
    g.lessons.map(l=>{
      const d=phDone(l.id);
      return '<div class="ph-row'+(d?' done':'')+'" data-ph="'+esc(l.id)+'">'+
        '<span class="ph-name">'+esc(l.t)+'<span class="ph-desc">'+l.w.length+' 个代表词</span></span>'+
        '<span class="ph-stars">'+phStars(d?d.best:0)+'</span></div>';
    }).join('')
  ).join('');
  phRenderTextbook();
}
/* --- 教材单词来源：学段 → 教材 → 册 → 单元 / 拼读组 --- */
function phTbPacks(){
  return (state.textbooks||[]).filter(p=>p&&p.enabled!==false&&
    (p.units||[]).some(u=>u&&(u.words||[]).some(w=>w&&w[0])));
}
/* 教材包 JSON 本身不带 id（导入时才生成），这里给一个稳定的显示/分组键 */
function phPackKey(p){ return String((p&&p.id)||('name:'+((p&&p.name)||'教材包'))); }
/* 与顶部「学习范围」同源：学段/年级/教材/册别全部读 state.filter，
   顶部一改，这里的教材单词范围立刻跟着变，不用在拼读里再配一遍。 */
function phTbFilteredPacks(){
  const f=state.filter||{};
  return phTbPacks().filter(p=>{
    if(f.stageId&&f.stageId!=='all'&&stageOfGrade(p.gradeId)!==f.stageId) return false;
    if(f.gradeId&&f.gradeId!=='all'&&!sameGrade(p.gradeId,f.gradeId)) return false;
    if(f.bookId&&f.bookId!=='all'&&p.bookId!==f.bookId) return false;
    if(f.volumeId&&f.volumeId!=='all'&&packVolume(p)!==f.volumeId) return false;
    return true;
  });
}
/* 顶部学习范围的可读描述，显示在教材来源面板里，提示去顶部调整。 */
function phScopeText(){
  const f=state.filter||{};
  const bits=[];
  bits.push((f.stageId&&f.stageId!=='all')?(STAGES.find(s=>s.id===f.stageId)||{name:f.stageId}).name:'全部学段');
  bits.push((f.gradeId&&f.gradeId!=='all')?gradeName(f.gradeId):'全部年级');
  bits.push((f.bookId&&f.bookId!=='all')?bookName(f.bookId):'全部教材');
  bits.push((f.volumeId&&f.volumeId!=='all')?
    ((VOLUMES.find(v=>v.id===f.volumeId)||{name:f.volumeId}).name):'全部册别');
  return bits.join(' · ');
}
/* 词组、缩写、带连字符/撇号的词不做音素拆分，统一在源头过滤 */
function phWordOk(w){ return /^[a-z]+$/i.test(String(w&&w[0]||'').trim()); }
function phTbUnitRows(){
  const rows=[],seen=new Set();
  phTbFilteredPacks().forEach(p=>(p.units||[]).forEach((u,ui)=>{
    const words=(u.words||[]).filter(phWordOk);
    if(!words.length) return;
    const key='tb:'+phPackKey(p)+':'+(u.id||('i'+ui+':'+(u.name||'')));
    if(seen.has(key)) return; seen.add(key);
    rows.push({key:key,name:u.name||'未命名单元',packName:p.name||'教材包',
      words:words,kind:'unit'});
  }));
  return rows;
}
function phTbPatternRows(){
  const f=state.filter||{},scope=[f.stageId,f.gradeId,f.bookId,f.volumeId].join('/'),map=new Map();
  phTbUnitRows().forEach(u=>u.words.forEach(w=>{
    const g=phonicsGroup(w[0]); if(!g) return;
    const key='pt:'+scope+':'+g.id;
    let row=map.get(key);
    if(!row){ row={key:key,name:g.name,words:[],kind:'pattern',packName:'按拼读规律归类'}; map.set(key,row); }
    const en=String(w[0]).toLowerCase();
    if(!row.words.some(x=>String(x[0]).toLowerCase()===en)) row.words.push(w);
  }));
  return Array.from(map.values()).sort((a,b)=>b.words.length-a.words.length||a.name.localeCompare(b.name,'zh'));
}
function phTbRows(){ return PH_TB.groupBy==='pattern'?phTbPatternRows():phTbUnitRows(); }
function phRenderTextbook(){
  const packs=phTbPacks();
  const visible=phTbFilteredPacks();
  $('phScopeNote').innerHTML='教材范围跟随顶部「学习范围」：<b>'+esc(phScopeText())+'</b>'+
    ' · 当前 '+visible.length+' 个教材包。要换教材，请在页面顶部的「学制 / 学段 / 年级 / 教材 / 册别」里调整，这里会自动同步。';
  $('phGroupBy').value=PH_TB.groupBy;
  const rows=phTbRows(),keys=rows.map(r=>r.key);
  if(PH_TB.unit!=='all'&&keys.indexOf(PH_TB.unit)<0) PH_TB.unit='all';
  $('phUnit').innerHTML='<option value="all">全部'+(PH_TB.groupBy==='pattern'?'拼读组':'单元')+'（'+rows.length+'）</option>'+
    rows.map(r=>'<option value="'+esc(r.key)+'"'+(PH_TB.unit===r.key?' selected':'')+'>'+
      esc(r.name)+' · '+r.words.length+' 词</option>').join('');
  $('phUnit').value=PH_TB.unit;
  const td=state.phonics.textbookDone||{};
  const count=Object.keys(td).filter(k=>td[k]&&td[k].best>0).length;
  $('phTbStat').textContent=count+' / '+rows.length;
  const wordCount=rows.reduce((n,r)=>n+r.words.length,0);
  $('phUnitList').innerHTML=rows.length?
    '<div class="ph-tb-group">'+(PH_TB.groupBy==='pattern'?'按拼读规律自动归类':'当前范围')+' · 共 '+wordCount+' 词</div>'+
    rows.map(r=>{
      const d=td[r.key],stars=d&&d.best?d.best:0;
      return '<div class="ph-tb-row'+(stars?' done':'')+'" data-phunit="'+esc(r.key)+'">'+
        '<span class="ph-name">'+esc(r.name)+'<span class="ph-desc">'+esc(r.packName)+' · '+r.words.length+' 词</span></span>'+
        '<span class="ph-stars">'+phStars(stars)+'</span></div>';
    }).join(''):'<div class="empty">'+(packs.length?
      '当前范围没有带单词的教材单元，换个筛选试试。':'还没有导入教材包。到「教材库」导入课本词表后，就能在这里按拼读练习。')+'</div>';
}
function phSourceSwitch(v){
  phSource=v==='textbook'?'textbook':'builtin';
  $('phBuiltinPanel').hidden=phSource!=='builtin';
  $('phTextbookPanel').hidden=phSource!=='textbook';
  const tabs=$('phSourceTabs').querySelectorAll?$('phSourceTabs').querySelectorAll('button'):[];
  for(let i=0;i<tabs.length;i++) tabs[i].classList.toggle('on',tabs[i].dataset.phsource===phSource);
  renderPhonics();
}
function phBegin(lesson,queue,title){
  phLesson=lesson;
  phQueue=(queue&&queue.length)?queue.slice():lesson.l.w.map((x,i)=>i);
  phPos=0; phSolved=false; phLast=null; phChunkLevel=0; phRoundCorrect=0;
  $('phPickerPanel').hidden=true;
  $('phPracticePanel').hidden=false;
  $('phLessonTitle').textContent=title||(lesson.g.name+' · '+lesson.l.t);
  phShow();
}
function phStart(id,queue){
  const found=phonicsLesson(id); if(!found) return;
  phTbMode=false; phBegin(found,queue,found.g.name+' · '+found.l.t);
}
function phStartTextbook(key){
  const rows=phTbRows();
  const pick=(key&&key!=='all')?rows.filter(r=>r.key===key):rows;
  if(!pick.length){ toast('当前范围没有可练习的单词','bad'); return; }
  const seen=new Set(),words=[];
  pick.forEach(r=>r.words.forEach(w=>{
    const en=String(w[0]||'').trim();
    if(!phWordOk(w)) return;
    const k=en.toLowerCase();
    if(seen.has(k)) return; seen.add(k);
    words.push([en,String(w[1]||'')]);
  }));
  if(!words.length){ toast('这里的词含短语或缩写，暂时无法按拼读练习','bad'); return; }
  const all=!key||key==='all';
  const f=state.filter||{};
  const gid=all?('all:'+[f.stageId,f.gradeId,f.bookId,f.volumeId,PH_TB.groupBy].join(':')):pick[0].key;
  const title='教材单词 · '+(all?('全部'+(PH_TB.groupBy==='pattern'?'拼读组':'单元')):pick[0].name);
  phTbMode=true;
  phBegin({g:{name:'教材单词'},l:{id:gid,t:title,s:'',w:words}},null,title);
}
function phShuffle(){
  if(!phLesson) return;
  phQueue=phQueue.slice().sort(()=>Math.random()-0.5); phPos=0; phRoundCorrect=0; phShow();
}
/* 隐藏的旧音节块展示：仍供旧逻辑与测试读取（听音给空格、提示后给音节+音素） */
function phRenderChunks(){
  if(!phLast){ $('phChunks').innerHTML=''; return; }
  const show=phChunkLevel>0||$('phMode').value==='read'||phSolved;
  $('phChunks').innerHTML=phonicsChunks(phLast[0]).map(c=>show?
    '<span class="ph-chunk"><b>'+esc(c[0])+'</b>'+(c[1]?'<i>/'+esc(c[1])+'/</i>':'')+'</span>':
    '<span class="ph-blank" style="width:'+Math.max(1,c[0].length)+'ch"></span>').join('');
}
