/* ---------------- 难度 / 计时 ---------------- */
function difficulty(){ return DIFFICULTY[state.settings.difficulty]||DIFFICULTY.normal; }
function fmtTime(ms){
  const s=Math.max(0,Math.round(Number(ms||0)/1000));
  return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');
}
function stopQuestionTimer(){
  if(questionTimer && typeof clearInterval==='function'){ try{ clearInterval(questionTimer); }catch(e){} }
  questionTimer=0;
}
function renderTimer(){
  if(state.settings.timerMode==='countdown'){
    const left=Math.max(0,questionDeadline-Date.now());
    $('timerChip').textContent='剩余 '+fmtTime(left);
    $('timerChip').classList.toggle('urgent',left<=10000);
    if(left<=0 && !solved){
      stopQuestionTimer();
      if(mode==='word') toast('时间到，继续试试或换一个词','bad');
      else if(slots.length) timeUp();
    }
  }else{
    $('timerChip').textContent='用时 '+fmtTime(Date.now()-questionStartedAt);
    $('timerChip').classList.remove('urgent');
  }
}
function startQuestionTimer(){
  stopQuestionTimer();
  questionDeadline=Date.now()+difficulty().seconds*1000;
  $('diffChip').textContent='难度 · '+difficulty().label;
  renderTimer();
  if(typeof setInterval==='function'){
    try{ questionTimer=setInterval(()=>{ try{ renderTimer(); }catch(e){} },250); }catch(e){}
  }
}
function timeUp(){
  if(solved) return;
  stopQuestionTimer();
  try{ SFX.wrong(); }catch(e){}
  toast('时间到，本题已显示答案','bad');
  revealWholeBoard();
}
function revealWholeBoard(){
  assisted=true;
  slots.forEach((s,i)=>{
    if(!s) return;
    const inp=s.querySelector('input'), given=slotGiven(i);
    inp.value=curTokens[i].word.slice(given);
    inp.readOnly=true;
    draft[i]=curTokens[i].word.slice(given);
    s.classList.add('correct','assisted'); s.classList.remove('wrong');
    paintBoxes(i);
  });
  if(boardOnComplete) boardOnComplete();
}

