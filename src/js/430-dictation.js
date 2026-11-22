/* ---------------- 听写 ---------------- */
function dcRenderPanel(){
  const best=Math.max(0,Number(memo().dictBest[srDictUnit()]||0));
  $('dcRound').textContent=dcQueue.length; $('dcRight').textContent=dcRight; $('dcBest').textContent=best;
  $('dcBar').style.width=dcQueue.length?Math.round(dcIdx/dcQueue.length*100)+'%':'0%';
}
function srDictUnit(){ try{ return currentUnit().id; }catch(e){ return ''; } }
function dcStart(){
  const u=currentUnit(), pool=[];
  (u.sentences||[]).forEach(q=>pool.push({en:q.en,cn:q.cn||'',kind:'句子'}));
  (u.words||[]).forEach(w=>pool.push({en:w[0],cn:w[1]||'',kind:'单词'}));
  if(!pool.length){ toast('这个单元还没有可听写的内容','bad'); return; }
  dcQueue=shuffle(pool).slice(0,12); dcIdx=0; dcRight=0; dcStreak=0; dcCurrent=null; dcPhase='ask'; dcT0=Date.now();
  dcNextCard();
}
function dcNextCard(){
  if(dcIdx>=dcQueue.length){
    dcPhase='idle';
    $('dcPrompt').hidden=true; $('dcInput').hidden=true; $('dcActions').hidden=true;
    $('dcFeedback').className='gfeedback ok';
    $('dcFeedback').textContent='听写完成！'+dcQueue.length+' 题，一次写对 '+dcRight+' 题。';
    const key=srDictUnit(), m=memo();
    if(dcRight>(Number(m.dictBest[key]||0))) m.dictBest[key]=dcRight;
    dcRenderPanel(); saveState(true); renderDrawer(); return;
  }
  dcCurrent=dcQueue[dcIdx];
  $('dcPrompt').hidden=false; $('dcPrompt').innerHTML='第 '+(dcIdx+1)+' / '+dcQueue.length+' 题 · <b>'+esc(dcCurrent.kind)+'</b> · 仔细听';
  $('dcInput').hidden=false; $('dcInput').disabled=false; $('dcInput').value='';
  $('dcActions').hidden=true; $('dcFeedback').textContent=''; $('dcFeedback').className='gfeedback';
  try{ $('dcInput').focus(); }catch(e){}
  speak(dcCurrent.en); dcRenderPanel();
}
function dcSubmit(){
  if(dcPhase!=='ask'||!dcCurrent) return;
  const val=String($('dcInput').value||'').trim(); if(!val) return;
  const ok=equal(val,dcCurrent.en);
  srEnroll(dcCurrent.en,dcCurrent.cn,ok,true);
  addHistory({mode:'dict',unit:currentUnit().name||'',cn:dcCurrent.cn,en:dcCurrent.en,
    ok:ok,assisted:false,ms:Date.now()-dcT0,bad:ok?0:1});
  if(ok){ dcRight++; dcStreak++; $('dcFeedback').className='gfeedback ok'; $('dcFeedback').textContent='完全正确！连续写对 '+dcStreak+' 题'; }
  else{ dcStreak=0; $('dcFeedback').className='gfeedback bad';
    $('dcFeedback').innerHTML='正确写法：<span class="ganswer">'+esc(dcCurrent.en)+'</span>'; }
  dcPhase='answered'; dcT0=Date.now();
  $('dcInput').disabled=true; $('dcActions').hidden=false;
  if(ok && Number(state.plan.perCorrect||0)>0) addPoints(Number(state.plan.perCorrect),'听写答对');
  dcRenderPanel(); renderHeader();
}
function dcAdvance(skip){
  if(dcPhase!=='answered' && !skip) return;
  if(skip && dcCurrent && dcPhase==='ask'){
    srEnroll(dcCurrent.en,dcCurrent.cn,false,true);
    addHistory({mode:'dict',unit:currentUnit().name||'',cn:dcCurrent.cn,en:dcCurrent.en,
      ok:false,assisted:true,ms:Date.now()-dcT0,bad:1});
  }
  dcIdx++; dcPhase='ask'; dcNextCard();
}
