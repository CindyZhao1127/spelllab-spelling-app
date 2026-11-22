/* ---------------- 积分 / 学习计划 ---------------- */
function addPoints(delta,reason){
  const p=state.plan, d=Number(delta)||0;
  p.points=Math.max(0,(Number(p.points)||0)+d);
  if(!Array.isArray(p.ledger)) p.ledger=[];
  p.ledger.push({t:Date.now(),delta:d,reason:reason||''});
  if(p.ledger.length>LEDGER_LIMIT) p.ledger.splice(0,p.ledger.length-LEDGER_LIMIT);
  renderPoints();
}
function renderPoints(){ $('statPoints').textContent=Number(state.plan.points)||0; }
function dayNum(day){ const a=String(day).split('-').map(Number); return (a[0]||0)*10000+(a[1]||0)*100+(a[2]||0); }
function dateShift(day,delta){
  const a=String(day).split('-').map(Number);
  const d=new Date(a[0],(a[1]||1)-1,(a[2]||1)+delta);
  return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();
}
function dayStats(day){
  const h=(state.history||[]).filter(x=>histDate(x.t)===day);
  const set=new Set(h.map(x=>x.unit||'').filter(Boolean));
  return {count:h.length,units:set.size,
    minutes:Math.round(h.reduce((a,x)=>a+(Number(x.ms)||0),0)/60000)};
}
function planActual(day){
  const s=dayStats(day);
  return state.plan.type==='minutes'?s.minutes:s.units;
}
function settlePlan(){
  const p=state.plan, tk=today();
  renderPoints();
  if(!p.enabled) return;
  if(!p.since) p.since=tk;
  let cursor=p.lastEval||p.since;
  if(dayNum(cursor)>dayNum(tk)) cursor=p.since;
  let guard=0;
  while(dayNum(cursor)<dayNum(tk) && guard++<31){
    const actual=planActual(cursor), ok=actual>=Math.max(1,Number(p.target)||1);
    const delta=ok?(Number(p.reward)||0):-(Number(p.penalty)||0);
    p.results[cursor]={actual:actual,target:Math.max(1,Number(p.target)||1),ok:ok,delta:delta};
    addPoints(delta,(ok?'计划达标 · ':'计划未达标 · ')+cursor);
    cursor=dateShift(cursor,1);
  }
  p.lastEval=tk;
  saveState(true);
}
function renderPlan(){
  const p=state.plan, tk=today();
  $('planPoints').textContent=Number(p.points)||0;
  $('planPerCorrect').textContent=Number(p.perCorrect)||0;
  $('swPlanEnabled').classList.toggle('on',!!p.enabled);
  $('planType').value=p.type==='minutes'?'minutes':'units';
  $('planTarget').value=Number(p.target)||3;
  $('planReward').value=Number(p.reward)||0;
  $('planPenalty').value=Number(p.penalty)||0;
  $('planPerCorrectInput').value=Number(p.perCorrect)||0;
  const s=dayStats(tk), target=Math.max(1,Number(p.target)||1);
  const actual=p.type==='minutes'?s.minutes:s.units;
  $('planTodayGrid').innerHTML=
    box(actual,'今日已完成')+box(target,'今日目标')+
    box(p.enabled?(actual>=target?'已达标':'进行中'):'未启用','计划状态')+box(s.count,'今日练习');
  const days=Object.keys(p.results||{}).sort((a,b)=>dayNum(b)-dayNum(a)).slice(0,7);
  $('planResults').innerHTML=days.length?days.map(d=>{
    const r=p.results[d];
    return '<div class="ledger-item"><span>'+esc(d)+' · 完成 '+r.actual+' / '+r.target+'</span>'+
      '<b class="'+(r.ok?'plus':'minus')+'">'+esc(r.ok?'达标':'未达标')+' '+(r.delta>=0?'+':'')+r.delta+'</b></div>';
  }).join(''):'<div class="empty">启用计划后，每天首次打开会自动结算前一天。</div>';
  const led=(p.ledger||[]).slice(-12).reverse();
  $('planLedger').innerHTML=led.length?led.map(x=>
    '<div class="ledger-item"><span>'+esc(new Date(x.t).toLocaleString('zh-CN'))+' · '+esc(x.reason||'')+'</span>'+
    '<b class="'+(x.delta>=0?'plus':'minus')+'">'+(x.delta>=0?'+':'')+x.delta+'</b></div>'
  ).join(''):'<div class="empty">还没有积分流水。</div>';
  renderPoints();
}
function savePlanForm(){
  const p=state.plan, was=!!p.enabled;
  p.enabled=$('swPlanEnabled').classList.contains('on');
  p.type=$('planType').value==='minutes'?'minutes':'units';
  p.target=Math.max(1,Math.min(600,Number($('planTarget').value)||3));
  p.reward=Math.max(0,Math.min(999,Number($('planReward').value)||0));
  p.penalty=Math.max(0,Math.min(999,Number($('planPenalty').value)||0));
  p.perCorrect=Math.max(0,Math.min(20,Number($('planPerCorrectInput').value)||0));
  if(p.enabled && !was){ p.since=today(); p.lastEval=today(); }
  if(!p.enabled) p.lastEval=today();
  saveState(true); renderDrawer(); toast('学习计划已保存','ok');
}

