/* ---------------- 纸笔听写（家长批阅） ----------------
   听中文/英文 → 写在纸上 → 家长解锁后逐题判对错。
   状态存 state.memo.paperDict：{done:[[unitId,时间,对数,总数]], ...} */
let ppQueue=[], ppIdx=0, ppMarks=[], ppLang='cn', ppKind='mix', ppCurrent=null, ppPhase='idle', ppStartedAt=0;
function ppUnitKey(){ try{ return currentUnit().id||''; }catch(e){ return ''; } }
function ppRenderPanel(){
  const total=ppQueue.length;
  const right=ppMarks.filter(x=>x===true).length;
  $('ppRound').textContent=total; $('ppRight').textContent=right;
  $('ppRate').textContent=total?Math.round(right/total*100)+'%':'--';
  $('ppBar').style.width=total?Math.round(ppIdx/total*100)+'%':'0%';
}
function ppStart(){
  const u=currentUnit(), pool=[];
  ppKind=$('ppKind').value||'mix';
  if(ppKind!=='sentence') (u.words||[]).forEach(w=>{ if(w&&w[0]) pool.push({en:String(w[0]),cn:String(w[1]||''),kind:'单词'}); });
  if(ppKind!=='word') (u.sentences||[]).forEach(q=>{ if(q&&q.en) pool.push({en:q.en,cn:q.cn||'',kind:'句子'}); });
  if(!pool.length){ toast('这个单元还没有可听写的内容','bad'); return; }
  ppLang=$('ppLang').value||'cn';
  const n=Number($('ppCount').value)||8;
  ppQueue=shuffle(pool).slice(0,n); ppIdx=0; ppMarks=ppQueue.map(()=>null);
  ppCurrent=null; ppPhase='ask'; ppStartedAt=Date.now();
  $('ppGradeCard').hidden=true; $('ppFeedback').textContent=''; $('ppFeedback').className='gfeedback';
  $('ppGradeFeedback').textContent=''; $('ppGradeFeedback').className='gfeedback';
  ppNextCard();
}
function ppSpeakText(item){
  if(!item) return;
  if(ppLang==='cn'){
    const cn=String(item.cn||'').trim();
    if(cn) speakLang(cn,'zh-CN',0.95);
    else { toast('这条内容没有中文释义，改放英文','bad'); speakLang(item.en,'en-US'); }
  } else speakLang(item.en,'en-US');
}
function ppNextCard(){
  if(ppIdx>=ppQueue.length){
    ppPhase='idle';
    $('ppPrompt').hidden=true; $('ppActions').hidden=true;
    $('ppFeedback').className='gfeedback ok';
    $('ppFeedback').textContent='听写完成！共 '+ppQueue.length+' 题。请点「听写完，家长批阅」，输入家长密码后对照答案打分。';
    ppRenderPanel(); return;
  }
  ppCurrent=ppQueue[ppIdx];
  $('ppPrompt').hidden=false;
  $('ppPrompt').innerHTML='第 '+(ppIdx+1)+' / '+ppQueue.length+' 题 · <b>'+esc(ppCurrent.kind)+'</b> · 仔细听，写在纸上';
  $('ppActions').hidden=false;
  $('ppFeedback').textContent=''; $('ppFeedback').className='gfeedback';
  ppSpeakText(ppCurrent); ppRenderPanel();
}
function ppNext(){ if(ppPhase!=='ask') return; ppIdx++; ppNextCard(); }
function ppShowGrade(){
  if(!ppQueue.length || ppPhase!=='idle'){ toast('请先完成一轮纸笔听写','bad'); return; }
  guardParent('paperdict', ppReveal);
}
function ppReveal(){
  ppPhase='grade';
  $('ppGradeCard').hidden=false;
  $('ppLockBadge').textContent=(parentUnlocked?'🔓 家长已解锁':'🔒 家长模式未解锁');
  ppRenderGrade();
}
function ppRenderGrade(){
  $('ppList').innerHTML=ppQueue.map((it,i)=>{
    const mark=ppMarks[i];
    const cls=mark===true?' pp-ok':mark===false?' pp-no2':'';
    return '<div class="pp-row'+cls+'" data-i="'+i+'">'+
      '<span class="pp-no">'+(i+1)+'</span>'+
      '<div class="pp-body"><div class="pp-en">'+esc(it.en)+'</div>'+
        '<div class="pp-cn">'+esc(it.cn||'（无中文释义）')+'<span class="pp-kind">'+esc(it.kind)+'</span></div></div>'+
      '<div class="pp-btns">'+
        '<button class="pp-speak" data-pp-speak="'+i+'" title="重听这一题">🔊</button>'+
        '<button class="pp-mark yes'+(mark===true?' on':'')+'" data-pp-mark="'+i+'" data-pp-val="1">✅</button>'+
        '<button class="pp-mark no'+(mark===false?' on':'')+'" data-pp-mark="'+i+'" data-pp-val="0">❌</button>'+
      '</div></div>';
  }).join('');
  ppRenderPanel();
}
function ppSave(){
  if(ppPhase!=='grade') return;
  guardParent('paperdict', function(){
    const unmarked=ppMarks.filter(x=>x==null).length;
    if(unmarked){ toast('还有 '+unmarked+' 题没判，请全部批阅后再保存','bad'); return; }
    const unitName=currentUnit().name||'';
    ppQueue.forEach((it,i)=>{
      const ok=ppMarks[i]===true;
      srEnroll(it.en,it.cn,ok,true);
      /* 纸笔听写按整轮平均每道题的用时记速，避免后面几题"白捡"快时间 */
      const avgMs=ppStartedAt?Math.round((Date.now()-ppStartedAt)/Math.max(1,ppQueue.length)):0;
      addHistory({mode:'paperdict',unit:unitName,cn:it.cn,en:it.en,
        ok:ok,assisted:false,ms:avgMs,bad:ok?0:1});
      if(ok && Number(state.plan.perCorrect||0)>0) addPoints(Number(state.plan.perCorrect),'纸笔听写答对');
    });
    const m=memo(), rec=m.paperDict||(m.paperDict={});
    if(!Array.isArray(rec.done)) rec.done=[];
    rec.done.push([ppUnitKey(),Date.now(),ppMarks.filter(x=>x===true).length,ppQueue.length]);
    if(rec.done.length>60) rec.done=rec.done.slice(-60);
    rec.last={unit:unitName,lang:ppLang,total:ppQueue.length,right:ppMarks.filter(x=>x===true).length,t:Date.now()};
    const right=rec.last.right;
    ppPhase='done';
    $('ppGradeFeedback').className='gfeedback ok';
    $('ppGradeFeedback').textContent='批阅结果已保存：'+right+' / '+ppQueue.length+' 题正确。错题已加入复习计划，可以在「错词复习」里巩固。';
    ppRenderPanel(); saveState(true); renderHeader(); renderDrawer();
    toast('已保存 '+right+' / '+ppQueue.length,'ok');
  });
}
