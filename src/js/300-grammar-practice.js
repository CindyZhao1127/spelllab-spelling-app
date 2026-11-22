/* ---------------- 语法练习（六年级上册）----------------
   题库 GRAMMAR_BANK 内嵌自两份资料：语法精选 100 题（含详解）与语法重难点突破 12 专题。
   进度存 state.grammar：done / wrong / stats / pointsPaid（每题只发一次积分）。 */
let grTab='points', grQueue=[], grPos=0, grAnswered=false, grTopicOpen=null;
const GR_LETTERS=['A','B','C'];
const grBank=()=> (typeof GRAMMAR_BANK!=='undefined' ? GRAMMAR_BANK : {choices:[],fills:[],topics:[]});
function grState(){ return state.grammar || {done:{},wrong:[],stats:{answered:0,correct:0},pointsPaid:{}}; }
function grEnter(){
  grTab='points'; grPos=0; grAnswered=false;
  grRenderTabs(); grRender();
}
function grRenderTabs(){
  const st=grState(), b=grBank();
  const doneChoice=(b.choices||[]).filter(x=>st.done['c'+x.id]).length;
  const doneFill=(b.fills||[]).filter(x=>st.done[x.id]).length;
  const wrongN=(st.wrong||[]).length;
  const set=(id,txt)=>{ const e=$(id); if(e) e.textContent=txt?(' '+txt):''; };
  set('gChoiceCount',doneChoice+'/'+b.choices.length);
  set('gFillCount',doneFill+'/'+b.fills.length);
  set('gWrongCount',wrongN?String(wrongN):'');
  document.querySelectorAll('#grammarTabs button').forEach(x=>x.classList.toggle('active',x.dataset.gtab===grTab));
}
function grRender(){
  grRenderTabs();
  if(grTab==='points') return grRenderPoints();
  if(grTab==='wrong') return grRenderWrong();
  grBuildQueue();
  if(!grQueue.length){ $('grammarPanel').innerHTML='<div class="tips">这个分类暂时没有题目了。</div>'; return; }
  if(grPos>=grQueue.length) return grRenderDone();
  return grQueue[grPos].type==='fill' ? grRenderFill() : grRenderChoice();
}
function grBuildQueue(){
  if(grQueue.length && grQueue._tab===grTab) return;
  const st=grState(), b=grBank();
  if(grTab==='choice') grQueue=(b.choices||[]).map(q=>({q,type:'choice',key:'c'+q.id}));
  else if(grTab==='fill') grQueue=(b.fills||[]).map(q=>({q,type:'fill',key:q.id}));
  else grQueue=[];
  grQueue._tab=grTab;
  // 未做过的排前面，做过的排后面，便于先练新题
  grQueue.sort((a,b2)=>(st.done[a.key]?1:0)-(st.done[b2.key]?1:0));
  if(grPos>=grQueue.length) grPos=0;
}
function grRenderChoice(){
  const it=grQueue[grPos], q=it.q, st=grState();
  const letters=['A','B','C'];
  const opts=q.opts.map((o,i)=>'<div class="gq-opt" data-gopt="'+i+'"><span class="gk">'+letters[i]+'</span><span>'+esc(o)+'</span></div>').join('');
  $('grammarPanel').innerHTML=
    '<div class="gq-head"><span class="gq-point">'+esc(q.point||'综合语法')+'</span>'+
    '<span class="gq-count">'+(grPos+1)+' / '+grQueue.length+'</span></div>'+
    '<div class="gq-stem">'+esc(q.stem)+'</div>'+
    '<div class="gq-opts" id="gqOpts">'+opts+'</div>'+
    '<div id="gqResult"></div>';
  grAnswered=false;
  $('gqOpts').addEventListener('click',e=>{
    if(grAnswered) return;
    const el=e.target.closest('[data-gopt]'); if(!el) return;
    grAnswerChoice(Number(el.dataset.gopt));
  });
}
function grAnswerChoice(idx){
  const it=grQueue[grPos], q=it.q, correct=lettersToIdx(q.ans);
  grAnswered=true;
  document.querySelectorAll('#gqOpts .gq-opt').forEach((el,i)=>{
    el.classList.add('locked');
    if(i===correct) el.classList.add('correct');
    else if(i===idx) el.classList.add('wrong');
  });
  grFinish(it, idx===correct, GR_LETTERS[idx]+'. '+q.opts[idx], q.opts[correct]);
}
function lettersToIdx(ans){ return String(ans||'A').trim().toUpperCase().charCodeAt(0)-65; }
function grRenderFill(){
  const it=grQueue[grPos], q=it.q;
  $('grammarPanel').innerHTML=
    '<div class="gq-head"><span class="gq-point">'+esc(q.section||'语法填空')+'</span>'+
    '<span class="gq-count">'+(grPos+1)+' / '+grQueue.length+'</span></div>'+
    '<div class="gq-stem">'+esc(q.stem)+'</div>'+
    '<input class="gq-input" id="gqFillInput" placeholder="输入答案，多空用分号隔开" autocomplete="off">'+
    '<div class="gq-actions"><button class="primary" id="gqFillSubmit">提交答案</button>'+
    '<button id="gqFillSkip">跳过</button></div>'+
    '<div id="gqResult"></div>';
  grAnswered=false;
  const submit=()=>{ if(grAnswered) return; const v=$('gqFillInput').value.trim(); if(!v){ toast('先输入答案','bad'); return; } grAnswerFill(v); };
  $('gqFillSubmit').addEventListener('click',submit);
  $('gqFillInput').addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); submit(); } });
  $('gqFillSkip').addEventListener('click',()=>{ if(grAnswered) return; grAnswered=true; grFinish(it,false,'（跳过）',q.ans); });
  $('gqFillInput').focus();
}
function grAnswerFill(val){
  const it=grQueue[grPos], q=it.q;
  const norm=s=>String(s).toLowerCase().replace(/[’']/g,"'").replace(/[.。!?！？,，;；\s]+/g,'');
  const ok=norm(val)===norm(q.ans);
  grAnswered=true;
  $('gqFillInput').disabled=true;
  grFinish(it, ok, val, q.ans);
}
function grFinish(it, ok, given, right){
  const st=grState(), q=it.q;
  const isNew=!st.done[it.key];
  /* done 只代表「做过」，首次做错后仍要允许在错题本答对时拿到积分；
     发分闸门改用 pointsPaid（首次答对），避免先错后对永久丢分。 */
  const firstRight=!st.pointsPaid[it.key];
  st.done[it.key]={ok:!!ok,t:Date.now()};
  /* 同一题重复提交只记一次进度与全局统计，避免刷分/刷正确率 */
  if(isNew){
    st.stats.answered++; if(ok) st.stats.correct++;
    try{ state.stats.attempted++; if(ok) state.stats.correct++; }catch(e){}
  }
  if(!ok){
    const list=st.wrong.filter(x=>x.key!==it.key);
    list.push({key:it.key,type:it.type,type2:q.section||q.point||'',t:Date.now()});
    st.wrong=list.slice(-120);
  } else {
    st.wrong=st.wrong.filter(x=>x.key!==it.key);
  }
  /* 积分：每题首次答对给一次，按每日计划 perCorrect；答错不发 */
  if(ok && firstRight){
    const pts=Number(state.plan&&state.plan.perCorrect)||0;
    if(pts>0){ addPoints(pts,'语法练习答对'); st.pointsPaid[it.key]=Date.now(); }
  }
  saveState(true);
  const detail=(it.type==='choice'?q.detail:(q.detail||''));
  $('gqResult').innerHTML=
    '<div class="gq-detail"><b>'+(ok?'✅ 答对了！':'❌ 再看看')+'</b>　正确答案：<b>'+esc(right)+'</b>'+
    (given&&!ok?'　你的答案：'+esc(given):'')+
    (detail?'<br>'+esc(detail):'')+'</div>'+
    '<div class="gq-actions"><button class="primary" id="gqNext">'+(grPos+1>=grQueue.length?'完成本轮':'下一题')+'</button>'+
    '<button id="gqRetry">再做一题</button></div>';
  $('gqNext').addEventListener('click',()=>{ grPos++; grRender(); });

  $('gqRetry').addEventListener('click',()=>{ grPos=(grPos+1)%grQueue.length; grRender(); });
  grRenderTabs();
}
function grRenderDone(){
  const st=grState(), a=st.stats.answered||0, c=st.stats.correct||0;
  $('grammarPanel').innerHTML=
    '<div class="gq-stem">本轮已完成 🎉</div>'+
    '<div class="gq-detail">累计答题 <b>'+a+'</b> 道，答对 <b>'+c+'</b> 道，正确率 <b>'+(a?Math.round(c/a*100):0)+'%</b>。<br>'+
    '每题首次答对可得积分，错题会进「错题本」，随时回来重练。</div>'+
    '<div class="gq-actions"><button class="primary" id="gqAgain">再练一轮</button>'+
    '<button id="gqBackPoints">看知识点</button></div>';
  $('gqAgain').addEventListener('click',()=>{ grPos=0; grRender(); });
  $('gqBackPoints').addEventListener('click',()=>{ grTab='points'; grRender(); });
}
function grRenderPoints(){
  const b=grBank(), st=grState();
  const cards=(b.topics||[]).map(t=>
    '<div class="gk-topic" data-gtopic="'+t.id+'"><h4>('+t.id+') '+esc(t.title)+'</h4>'+
    '<p>'+esc(t.summary)+'</p></div>').join('');
  $('grammarPanel').innerHTML=
    '<div class="panel-note">六年级上册语法重难点，点开看要点讲解。看完去做「单项选择 / 填空练习」巩固，答对得积分。</div>'+
    (grTopicOpen!=null ? (()=>{ const t=(b.topics||[]).find(x=>x.id===grTopicOpen); return t ?
      '<div class="gq-detail gk-detail"><b>('+t.id+') '+esc(t.title)+'</b><br>'+esc(t.summary)+'</div>'+
      '<div class="gq-actions"><button id="gkClose">收起</button></div>':'';
    })() : '<div class="gk-topics">'+cards+'</div>');
  const back=$('gkClose'); if(back) back.addEventListener('click',()=>{ grTopicOpen=null; grRenderPoints(); });
  document.querySelectorAll('[data-gtopic]').forEach(el=>el.addEventListener('click',()=>{
    grTopicOpen=Number(el.dataset.gtopic); grRenderPoints();
  }));
}
function grRenderWrong(){
  const st=grState(), b=grBank();
  const list=st.wrong||[];
  if(!list.length){ $('grammarPanel').innerHTML='<div class="tips">错题本是空的，先去做几道题吧。</div>'; return; }
  const rows=list.slice().reverse().map(w=>{
    const it = w.type==='choice'
      ? (b.choices||[]).find(q=>'c'+q.id===w.key)
      : (b.fills||[]).find(q=>q.id===w.key);
    if(!it) return '';
    const text=w.type==='choice'?it.stem:it.stem;
    return '<div class="gk-topic" data-gwrong="'+esc(w.key)+'"><h4>'+esc(w.type2||'语法')+'</h4><p>'+esc(text)+'</p></div>';
  }).join('');
  $('grammarPanel').innerHTML='<div class="panel-note">这些题之前做错了，答对一次就会自动移出错题本。</div><div class="gk-topics">'+rows+'</div>'+
    '<div class="gq-actions"><button id="gqClearWrong">清空错题本</button></div>';
  $('gqClearWrong').addEventListener('click',()=>{ if(!confirm('确定清空语法错题本？')) return; st.wrong=[]; saveState(true); grRender(); });
}

