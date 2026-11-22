/* ---------------- 积分抽奖 ---------------- */
function renderLottery(){
  const L=state.lottery, points=Number(state.plan.points)||0;
  const cost=Math.max(1,Number(L.cost)||10);
  const d=ensureLotteryDaily();
  $('lotteryPoints').textContent=points;
  $('lotteryCost').value=cost;
  $('lotteryCostTag').textContent='每次 '+cost+' 分';
  $('lotteryCostText').textContent=cost;
  if($('typingPointsInput')) $('typingPointsInput').value=Number(L.typingPoints)||0;
  if($('lotteryDailyText')) $('lotteryDailyText').textContent=d.draws;
  /* 未解锁时只展示只读奖项，编辑器整体隐藏；所有写操作再经 guardParent 兜底 */
  const locked=!parentUnlocked;
  $('prizeLocked').hidden=!locked;
  $('prizeEditor').hidden=locked;
  $('prizeLockBadge').textContent=locked?'家长锁定':'已解锁';
  $('prizeLockBadge').classList.toggle('on',!locked);
  const prizes=Array.isArray(L.prizes)?L.prizes:[];
  $('prizeLockedList').innerHTML=prizes.length?prizes.map(p=>
    '<span>'+esc(p.name||'奖项')+' · '+(Number(p.prob)||0)+'% · '+
    (p.autoRedeem?'自动兑换':'待兑换')+'</span>').join(''):
    '<span>暂无奖项</span>';
  $('prizeList').innerHTML=prizes.length?prizes.map(p=>
    '<div class="prize-row">'+
      '<input class="field" data-prize-name="'+esc(p.id)+'" value="'+esc(p.name)+'" placeholder="奖项内容">'+
      '<input class="field prob" type="number" min="0" max="100" step="1" data-prize-prob="'+esc(p.id)+'" value="'+(Number(p.prob)||0)+'" aria-label="中奖概率 %">'+
      '<span class="unit">%</span>'+
      '<label class="prize-auto" title="自动兑换：抽到即生效、不扣本次积分；关闭则抽到后标记为待兑换，线下发放后点标记已兑换">'+
        '<input type="checkbox" data-prize-auto="'+esc(p.id)+'"'+(p.autoRedeem?' checked':'')+'> 自动兑换</label>'+
      '<button class="mini-btn danger sm" data-prize-del="'+esc(p.id)+'">删</button>'+
    '</div>').join(''):'<div class="empty">还没有奖项，点「添加奖项」新建一个。</div>';
  const sum=prizeTotal(), over=sum>100;
  $('prizeSum').textContent=over?
    '⚠ 概率合计 '+sum+'%，超过 100%，盲盒暂时不能抽，请调低某一项。':
    '当前总中奖概率 '+sum+'%（剩余 '+(100-sum)+'% 为「谢谢参与」）';
  $('prizeSum').classList.toggle('warn',over);
  /* 获得奖品列表：只列真实中奖（装了 prizeId 的记录），显示自动/待兑换状态 */
  const allLog=Array.isArray(L.log)?L.log:[];
  const won=allLog.filter(x=>x && x.prizeId).slice().reverse();
  const pending=won.filter(x=>!x.autoRedeem && !x.redeemed).length;
  if($('prizePending')) $('prizePending').textContent=pending+' 待兑换';
  $('prizeWonList').innerHTML=won.length?won.map(x=>{
    const tag=x.autoRedeem?'<span class="pw-tag auto">自动兑换</span>':
      x.redeemed?'<span class="pw-tag done">已兑换</span>':
      '<span class="pw-tag wait">待兑换</span>';
    const btn=(!x.autoRedeem && !x.redeemed)?
      '<button class="mini-btn sm" data-prize-redeem="'+esc(x.t)+'">标记已兑换</button>':'';
    return '<div class="prize-won"><span class="pw-name">🎁 '+esc(x.prize||'奖品')+'</span>'+
      '<span class="pw-time">'+esc(new Date(x.t).toLocaleString('zh-CN'))+'</span>'+tag+btn+'</div>';
  }).join(''):'<div class="empty">还没抽到奖品，点右上角「🎁 抽盲盒」试试。</div>';
  const log=allLog.slice(-12).reverse();
  $('lotteryLog').innerHTML=log.length?log.map(x=>
    '<div class="ledger-item"><span>'+esc(new Date(x.t).toLocaleString('zh-CN'))+'</span><b>'+esc(x.prize||'谢谢参与')+'</b></div>'
  ).join(''):'<div class="empty">还没有抽奖记录。</div>';
}
/* 标记一件待兑换奖品为已兑换（时间作唯一标识，抽奖写日志时保证不重复）。
   线下发放（如现金）后直接点按钮即可确认，不受家长锁限制；
   奖项内容、概率、积分等设置仍由 PARENT_SCOPES.lottery 保护。 */
function redeemPrize(t){
  const L=state.lottery, hit=(L.log||[]).find(x=>x && Number(x.t)===Number(t));
  if(!hit || hit.autoRedeem || hit.redeemed){ toast('这件奖品已兑换或不存在','bad'); return false; }
  hit.redeemed=true;
  saveState(true); renderLottery(); renderWheel();
  toast('已标记兑换：'+hit.prize,'ok');
  return true;
}
/* 奖项 / 消耗积分一变，侧栏和已打开的转盘一起刷新；转盘还要复位角度，
   否则新扇区会叠在上一次的落点上。抽奖进行中不打断动画。 */
function lotteryChanged(){
  renderLottery();
  if($('wheelMask').hidden || wheelSpinning) return;
  wheelHit=-99;
  resetWheelAngle();
  renderWheel();
  syncWheelButtons();
  $('wheelResult').textContent='奖项已更新，盲盒已重置';
  $('wheelResult').className='wheel-result';
  $('wheelPrize').classList.remove('show');
  $('btnSpin').textContent='开始抽奖';
}
function updatePrizeField(id,field,value){
  const prizes=Array.isArray(state.lottery.prizes)?state.lottery.prizes:[];
  const p=prizes.find(x=>x.id===id); if(!p) return;
  if(field==='name'){
    p.name=String(value).trim().slice(0,40)||('奖项'+(prizes.indexOf(p)+1));
  }else if(field==='autoRedeem'){
    p.autoRedeem=!!value;
  }else{
    const want=Math.max(0,Math.min(100,Number(value)||0));
    p.prob=prizeProbCap(prizes,id,value);
    if(want>p.prob) toast('所有奖项概率合计不能超过 100%，已调整为 '+p.prob+'%','bad');
  }
  saveState(); lotteryChanged();
}
function addPrize(){
  if(!Array.isArray(state.lottery.prizes)) state.lottery.prizes=[];
  const rest=Math.max(0,100-prizeTotal());
  state.lottery.prizes.push({id:nextId('p'),name:'新奖项',prob:Math.min(5,rest),autoRedeem:false});
  if(rest<=0) toast('概率已满 100%，新奖项暂设为 0%','bad');
  saveState(); lotteryChanged();
}
function delPrize(id){
  state.lottery.prizes=(state.lottery.prizes||[]).filter(x=>x.id!==id);
  saveState(); lotteryChanged();
}
function resetPrizes(){
  state.lottery.prizes=clone(DEFAULT_PRIZES); saveState(); lotteryChanged(); toast('已恢复默认奖项');
}
function drawLottery(){
  const L=state.lottery, d=ensureLotteryDaily();
  const cost=lotteryCostNow();
  L.cost=Math.max(1,Number(L.cost)||10);   // 基础消耗保持家长设置值，翻倍只作用于本次
  /* 抽奖不限次数：没中奖可以一直抽，积分够就能继续；不再做每日次数拦截。 */
  const points=Number(state.plan.points)||0;
  if(points<cost){ toast('积分不足，本次需要 '+cost+' 分（还差 '+(cost-points)+' 分）','bad'); return null; }
  /* 抽奖与盘面共用 wheelSegments()：结果的名称、下标、颜色都来自指针
     真正能停到的那个扇区，避免两套概率逻辑各自漂移后「奖项对不上分区」。 */
  const segs=wheelSegments();
  if(wheelTotal>100){ toast('奖项概率合计超过 100%，请先调整','bad'); return null; }
  let hit;
  if(d.won){
    /* 当天已经中过奖：本次必为「谢谢参与」，不再抽中真实奖项。 */
    hit=segs.find(s=>s.index===-1)||{name:'谢谢参与',index:-1,color:WHEEL_THANKS,prob:0};
  }else{
    const total=segs.reduce((a,s)=>a+s.prob,0)||100;
    const r=Math.random()*total;
    let acc=0; hit=segs[segs.length-1]||
      {name:'谢谢参与',index:-1,color:WHEEL_THANKS};
    for(let k=0;k<segs.length;k++){
      acc+=segs[k].prob;
      if(r<acc){ hit=segs[k]; break; }
    }
  }
  /* 自动兑换的奖品抽到即生效、返还本次积分：净消耗为 0。
     其余奖品扣积分后记为「待兑换」，线下发放后在获得奖品列表点「标记已兑换」确认。 */
  const prizes=Array.isArray(L.prizes)?L.prizes:[];
  const prize=hit.index>=0?prizes[hit.index]:null;
  const autoRedeem=!!(prize && prize.autoRedeem);
  /* 自动兑换：本次根本不扣积分（不是先扣后退，避免流水刷两条） */
  if(!autoRedeem) addPoints(-cost,'积分抽奖');
  const charge=autoRedeem?0:cost;
  const name=hit.name;
  if(!Array.isArray(L.log)) L.log=[];
  L.log.push({t:Date.now(),cost:charge,prize:name,prizeId:prize?prize.id:'',
    autoRedeem:autoRedeem,redeemed:autoRedeem});
  if(L.log.length>LOTTERY_LOG_LIMIT) L.log.splice(0,L.log.length-LOTTERY_LOG_LIMIT);
  /* 更新当天计数：中奖后 afterWin 归零，之后再抽逐次 +1 供翻倍使用。 */
  const wasWon=!!d.won;
  /* 「再抽一次」是自动兑换的免费重抽，不算中奖：既不锁定当天「必不中奖」，
     也不让下次抽奖进入翻倍状态。只有其它真实奖才算中奖。 */
  const realWin=hit.index>=0 && !autoRedeem;
  d.draws++;
  if(realWin && !wasWon){ d.won=true; d.afterWin=0; }
  else if(wasWon){ d.afterWin++; }
  saveState(true); renderDrawer();
  /* 结果同步返回给转盘（也方便回归测试）；界面不再弹旧的结果对话框 */
  return {prize:name,index:hit.index,color:hit.color,cost:charge,
    points:Number(state.plan.points)||0,left:lotteryLeft(),
    realWin:realWin&&!wasWon, doubled:wasWon,
    autoRedeem:autoRedeem,redeemed:autoRedeem,
    status:autoRedeem?'auto':(realWin?'待兑换':'')};
}

