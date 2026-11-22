/* ---------------- 分步记忆：认短语 -> 练短语 -> 拼整句 ---------------- */
const PHASE_NAMES=['1 认短语','2 练短语','3 拼整句'];
function renderPhaseBar(){
  if(mode!=='chunk'){ $('phaseBar').hidden=true; return; }
  $('phaseBar').hidden=false;
  $('phaseBar').innerHTML=PHASE_NAMES.map((n,i)=>
    '<span class="phase'+(i===chunkPhase?' active':'')+(i<chunkPhase?' done':'')+'">'+n+'</span>'
  ).join('');
}
function updateChunkMain(){
  if(mode!=='chunk') return;
  const btn=$('cCheck'); if(!btn) return;
  btn.textContent = chunkPhase===0 ? '开始练短语'
    : (chunkPhase===1 && solved) ? '继续'
    : (chunkPhase===2 && solved) ? '下一题' : '检查答案';
}
function buildChunks(q){
  const toks=tokenize(q.en,q.hints,q.cn);
  const wordIdx=[]; toks.forEach((t,i)=>{ if(!t.punct) wordIdx.push(i); });
  const n=wordIdx.length;
  let plan=q.chunks;
  if(!plan || !plan.length || plan.reduce((s,c)=>s+(Number(c[1])||0),0)!==n){
    const groups=Math.min(3,Math.max(2,Math.round(n/2.5)));
    const base=Math.floor(n/groups), rem=n%groups;
    plan=[]; let p=0;
    for(let k=0;k<groups;k++){
      const cnt=base+(k<rem?1:0);
      const pieces=[];
      for(let j=0;j<cnt;j++) pieces.push(toks[wordIdx[p+j]].hint);
      plan.push([pieces.filter(Boolean).join(' ')||('第 '+(k+1)+' 组'),cnt]);
      p+=cnt;
    }
  }
  let p=0;
  return plan.map(c=>{
    const cnt=Number(c[1])||1;
    const idxs=wordIdx.slice(p,p+cnt); p+=cnt;
    if(!idxs.length) return null;
    const words=toks.slice(idxs[0],idxs[idxs.length-1]+1).filter(t=>!t.punct);
    return {cn:c[0], words:words, en:words.map(w=>w.word).join(' '), revealed:false, done:false};
  }).filter(Boolean);
}
function startChunk(){
  clearTimeout(chunkTimer);
  questionStartedAt=Date.now(); questionMistakes=0;
  const cq=currentQuestion();
  chunkPhase=0; chunkIdx=0; solved=false; boardOnComplete=null;
  chunkList=buildChunks(cq.q);
  $('stageLabel').textContent='分步记忆 · 第 1 步：先记住短语';
  $('questionCn').textContent=cq.q.cn;
  $('tips').textContent='先点开每张卡片，看英文、听读音，把长句拆成几块记住';
  $('slots').hidden=true;
  $('feedback').hidden=true;
  $('feedback').textContent='';
  $('successCard').hidden=true;
  $('chunkCards').hidden=false;
  $('chunkProgress').hidden=false;
  renderChunkCards(); renderPhaseBar(); renderHeader(); updateChunkMain();
  startQuestionTimer(); snapshotSession();
}
function renderChunkCards(){
  const box=$('chunkCards'); box.innerHTML='';
  chunkList.forEach((c,i)=>{
    const card=document.createElement('button');
    card.className='chunk-card'+(c.revealed?' revealed':'')+(c.done?' done':'');
    card.innerHTML='<div class="cc-idx">短语 '+(i+1)+' / '+chunkList.length+'</div>'+
      '<div class="cc-cn">'+esc(c.cn)+'</div>'+
      (c.revealed?'<div class="cc-en">'+esc(c.en)+'</div>':'<div class="cc-en masked">点击看英文</div>')+
      '<div class="cc-tip">'+(c.revealed?'点击再听一次读音':'点击翻看 · 自动朗读')+'</div>';
    card.addEventListener('click',()=>chunkReveal(i));
    box.appendChild(card);
  });
  $('chunkProgress').textContent='已翻开 '+chunkList.filter(c=>c.revealed).length+' / '+chunkList.length+' 个短语 · 记住后点「开始练短语」';
}
function chunkReveal(i){
  const c=chunkList[i]; if(!c) return;
  c.revealed=true; SFX.flip(); speak(c.en);
  renderChunkCards(); updateChunkMain();
}
function chunkStartPractice(){
  chunkList.forEach(c=>c.revealed=true);
  chunkPhase=1; chunkIdx=0;
  SFX.step();
  renderChunkPhase1();
  toast('第 2 步：一个一个短语拼出来','ok');
}
function renderChunkPhase1(){
  const c=chunkList[chunkIdx];
  if(!c){ chunkEnterFinal(); return; }
  renderBoard(c.words.slice(), c.cn,
    '分步记忆 · 第 2 步：练短语 '+(chunkIdx+1)+' / '+chunkList.length,
    '只拼这一个短语 · 拼对后自动进入下一块 · 灯泡可以给提示',
    chunkWordDone);
  renderPhaseBar(); updateChunkMain();
}
function chunkWordDone(){
  if(solved) return;
  solved=true;
  chunkList[chunkIdx].done=true;
  SFX.step();
  const last=chunkIdx>=chunkList.length-1;
  $('feedback').textContent=last?'最后一块也记住了，接着拼整句！':'这个短语拼对了，继续下一块';
  $('feedback').className='feedback ok';
  updateChunkMain();
  clearTimeout(chunkTimer);
  chunkTimer=setTimeout(()=>{ if(mode==='chunk'&&chunkPhase===1) chunkAdvance(); },1100);
}
function chunkAdvance(){
  chunkIdx++;
  if(chunkIdx<chunkList.length) renderChunkPhase1();
  else chunkEnterFinal();
}
function chunkEnterFinal(){
  chunkPhase=2;
  const cq=currentQuestion();
  SFX.step();
  renderBoard(tokenize(cq.q.en,cq.q.hints,cq.q.cn), cq.q.cn,
    '分步记忆 · 第 3 步：把整句连起来',
    '现在不看拆分，独立把完整句子拼出来',
    finishQuestion);
  renderPhaseBar(); updateChunkMain();
  toast('最后一步：拼出完整句子','ok');
}
function chunkNextQuestion(delta){
  clearTimeout(chunkTimer);
  const total=order().length||1;
  qPos=(qPos+(delta||1)+total)%total;
  startChunk();
}
function chunkSpeak(){
  if(chunkPhase===1 && chunkList[chunkIdx]) speak(chunkList[chunkIdx].en);
  else speak(currentQuestion().q.en);
}
function chunkHint(){
  if(chunkPhase===0){
    chunkList.forEach(c=>c.revealed=true);
    SFX.flip(); renderChunkCards(); updateChunkMain();
    speak(currentQuestion().q.en);
    toast('已翻开全部短语','ok');
  }else hintCurrent();
}
function chunkReset(){
  clearTimeout(chunkTimer);
  if(chunkPhase===0){ chunkList.forEach(c=>{c.revealed=false;c.done=false;}); renderChunkCards(); }
  else if(chunkPhase===1) renderChunkPhase1();
  else chunkEnterFinal();
  toast('当前步骤已重做');
}
function chunkMainAction(){
  if(chunkPhase===0){ chunkStartPractice(); return; }
  if(chunkPhase===1 && solved){ clearTimeout(chunkTimer); chunkAdvance(); return; }
  if(chunkPhase===2 && solved){ chunkNextQuestion(1); return; }
  if(solved) return;
  checkAll();
}

