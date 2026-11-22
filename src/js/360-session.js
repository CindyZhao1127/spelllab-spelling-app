/* ---------------- 练习现场保存 / 恢复 ---------------- */
function snapshotSession(write){
  if(sessionSuspended) return;
  let cq;
  try{ cq=currentQuestion(); }catch(e){ return; }
  const next={
    savedAt:Date.now(), mode:mode, unitId:cq.unit.id, unitName:cq.unit.name||'',
    unitPos:unitPos, qPos:qPos, idx:cq.idx, filter:clone(state.filter),
    solved:!!solved, draft:draft.slice(), chunkPhase:chunkPhase,
    wordEn:wordCur?wordCur[0]:'', unitRoundCount:unitRoundCount,
    elapsed:Math.max(0,Date.now()-questionStartedAt)
  };
  const key=o=>JSON.stringify({m:o.mode,u:o.unitId,p:o.qPos,i:o.idx,s:o.solved,
    d:o.draft||[],c:o.chunkPhase,w:o.wordEn,f:o.filter,r:o.unitRoundCount,up:o.unitPos});
  const changed=key(next)!==key(state.session||{});
  state.session=next;
  if(write!==false) saveState();
  else if(changed) STORE.dirty=true;   // 只输入了字母没换题，关窗也要补写
}
function restoreDraft(saved){
  if(!Array.isArray(saved)) return;
  slots.forEach((s,i)=>{
    if(!s) return;
    const inp=s.querySelector('input');
    if(inp.readOnly) return;
    const v=String(saved[i]||'');
    inp.value=v; draft[i]=v; paintBoxes(i);
  });
}
function resumePractice(choice){
  const snap=resumeCandidate;
  sessionSuspended=false;
  if(choice==='continue' && snap){
    try{
      if(snap.filter){ state.filter=Object.assign({},state.filter,snap.filter); renderFilters(); }
      mode=['sentence','chunk','word'].indexOf(snap.mode)>=0?snap.mode:'sentence';
      unitPos=findUnitIndex(snap.unitId);
      sessionOrder={unitId:'',list:[]};
      qPos=Math.max(0,Math.min(Number(snap.qPos)||0,(order().length||1)-1));
      chunkPhase=Number(snap.chunkPhase)||0;
      unitRoundCount=Number(snap.unitRoundCount)||0;
      setMode(mode);
      if(!snap.solved) restoreDraft(snap.draft);
      toast('已恢复上次练习现场','ok');
    }catch(e){ qPos=0; setMode('sentence'); }
  }else{
    state.session=null;
    unitPos=0; qPos=0; unitRoundCount=0; unitRoundPrompted=false;
    sessionOrder={unitId:'',list:[]}; wordCur=null;
    setMode(mode); toast('已开始新的练习');
  }
  snapshotSession(false);
  saveState(true);
  renderHeader(); renderDrawer();
}
function offerResume(){
  if(resumeOffered) return;
  resumeOffered=true;
  settlePlan();
  const snap=resumeCandidate;
  if(!snap || !state.settings.askResume || !snap.unitId ||
     (Date.now()-(Number(snap.savedAt)||0))>SESSION_MAX_AGE){
    sessionSuspended=false; snapshotSession(); return;
  }
  showModal({title:'要继续上次的练习吗？',
    text:'上次退出停在「'+(snap.unitName||snap.unitId)+'」第 '+(Number(snap.qPos)+1)+' 题'+
         (snap.solved?'（已完成）':'，未填完的字母也会恢复')+'。\n可以继续上次进度，也可以从第一题重新开始。',
    dismissible:true,
    actions:[
      {label:'重新开始',onClick:()=>resumePractice('restart')},
      {label:'继续上次练习',primary:true,onClick:()=>resumePractice('continue')}
    ]});
}

