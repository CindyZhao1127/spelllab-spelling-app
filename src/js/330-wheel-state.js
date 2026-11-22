/* ---------------- 积分抽奖 · 转盘 ----------------
   扇区角度按奖项概率分配，结果先按现有概率逻辑同步产生（便于回归测试），
   再让转盘停到对应扇区；「谢谢参与」占剩余概率。 */
const WHEEL_COLORS=['#ff9aa8','#ffc785','#ffe28a','#a8e6b8','#8fdcf0',
  '#a9b8ff','#d5aaff','#ffa9d8','#c6d0e8'];
const WHEEL_THANKS='#6b769e';
let wheelSegs=[], wheelRotation=0, wheelSpinning=false, wheelInvalid=false, wheelTotal=0;
/* 最近一次中奖的扇区下标，用来在图例里高亮命中行（-99 表示无） */
let wheelHit=-99;

/* ---- 抽奖的「按天」状态 ----
   抽奖不限次数：没中奖永远按基础积分抽；只有抽中真实奖品（不含「再抽一次」
   这种自动兑换的免费重抽）才算中奖，当天最多中奖一次，中奖后再抽消耗按 2 的幂
   逐次翻倍（第 1 次再抽 2 倍、第 2 次 4 倍……）直到硬上限。换天自动清零。 */
function ensureLotteryDaily(){
  const L=state.lottery;
  if(!L.daily || typeof L.daily!=='object' || Array.isArray(L.daily))
    L.daily=clone(DEFAULT_LOTTERY.daily);
  const d=L.daily, tk=today();
  if(d.date!==tk){ d.date=tk; d.draws=0; d.won=false; d.afterWin=0; }
  d.draws=Math.max(0,Math.round(Number(d.draws)||0));
  d.afterWin=Math.max(0,Math.round(Number(d.afterWin)||0));
  d.won=!!d.won;
  return d;
}
function lotteryDailyLimit(){
  return Math.max(1,Math.min(10,Math.round(Number(state.lottery.dailyLimit)||3)));
}
/* 抽奖不限次数：剩余次数恒为「无限」，counts 仅用于展示今日已抽次数。 */
function lotteryLeft(){ return Infinity; }
/* 本次抽奖实际消耗：没中奖时恒为基础分；真实中奖后按 2^(afterWin+1) 翻倍
   （「再抽一次」是自动兑换的免费重抽，不算中奖，不进入翻倍状态）。 */
function lotteryCostNow(){
  const d=ensureLotteryDaily();
  const base=Math.max(1,Number(state.lottery.cost)||10);
  const mult=d.won?Math.pow(2,d.afterWin+1):1;
  return Math.min(LOTTERY_COST_CAP,Math.round(base*mult));
}

function prizeTotal(){
  return (Array.isArray(state.lottery.prizes)?state.lottery.prizes:[])
    .reduce((a,p)=>a+(Number(p.prob)||0),0);
}
/* 单项概率上限＝100 - 其它项之和。编辑时就收敛，避免溢出后转盘把扇区
   重新归一化铺满整圈（看着「全是奖」），抽奖却被拒绝。 */
function prizeProbCap(prizes,id,value){
  const others=prizes.filter(x=>x.id!==id).reduce((a,x)=>a+(Number(x.prob)||0),0);
  const want=Math.max(0,Math.min(100,Number(value)||0));
  return Math.min(want,Math.max(0,100-others));
}
function shortWheelName(name){
  const s=String(name==null?'':name).trim();
  const limit=/[\u3400-\u9fff]/.test(s)?5:9;
  return s.length>limit?s.slice(0,limit)+'…':s;
}
function wheelSegments(){
  const prizes=Array.isArray(state.lottery.prizes)?state.lottery.prizes:[];
  const raw=prizes.map((p,i)=>({
    name:String(p.name||('奖项'+(i+1))).trim()||('奖项'+(i+1)),
    prob:Math.max(0,Math.min(100,Number(p.prob)||0)),
    color:WHEEL_COLORS[i%WHEEL_COLORS.length],index:i}));
  wheelTotal=raw.reduce((a,s)=>a+s.prob,0);
  wheelInvalid=wheelTotal>100;
  const scale=wheelInvalid?100/wheelTotal:1;
  const segs=raw.filter(s=>s.prob>0).map(s=>({name:s.name,prob:s.prob*scale,
    color:s.color,index:s.index}));
  if(wheelTotal<100) segs.push({name:'谢谢参与',prob:100-wheelTotal,
    color:WHEEL_THANKS,index:-1});
  return segs;
}
function renderWheel(){
  wheelSegs=wheelSegments();
  const radius=(typeof innerWidth!=='undefined' && innerWidth<=640)?92:112;
  const total=wheelSegs.reduce((a,s)=>a+s.prob,0)||100;
  let acc=0; const stops=[], labels=[], rows=[];
  wheelSegs.forEach(s=>{
    const start=acc/total*360, end=(acc+s.prob)/total*360; acc+=s.prob;
    const mid=(start+end)/2;
    s.start=start; s.end=end; s.mid=mid;
    /* 每扇区尾部留一道细白线，扇区再多也能看清边界 */
    const gap=Math.min(.7,(end-start)/8);
    stops.push(s.color+' '+start.toFixed(2)+'deg '+(end-gap).toFixed(2)+'deg',
      'rgba(255,255,255,.5) '+(end-gap).toFixed(2)+'deg '+end.toFixed(2)+'deg');
    /* 窄扇区不画盘面文字，完整名称放下方图例，避免互相压字 */
    labels.push('<span class="wheel-label'+((end-start)<24?' tight':'')+
      '" style="transform:rotate('+mid.toFixed(2)+'deg) translateY(-'+radius+
      'px) rotate('+(-mid).toFixed(2)+'deg)">'+esc(shortWheelName(s.name))+'</span>');
    rows.push('<div class="ledger-item'+(s.index===wheelHit?' hit':'')+
      '" data-seg="'+s.index+'"><i style="background:'+s.color+'"></i><span>'+
      esc(s.name)+'</span><b>'+(Math.round(s.prob*10)/10)+'%</b></div>');
  });
  /* 0% 的奖项不占扇区，但保留在图例里，免得家长以为奖项被删了 */
  const prizes=Array.isArray(state.lottery.prizes)?state.lottery.prizes:[];
  prizes.forEach((p,i)=>{ if((Number(p.prob)||0)>0) return;
    rows.push('<div class="ledger-item off"><i style="background:'+
      WHEEL_COLORS[i%WHEEL_COLORS.length]+'"></i><span>'+esc(p.name||('奖项'+(i+1)))+
      '</span><b>0%</b></div>');
  });
  /* 角度基准必须是 0° = 12 点：CSS conic-gradient 的弧线默认就从正上方
     开始顺时针增加；这里若写成 from -90deg，会把整盘扇区逆时针挪 90°，
     而标签 rotate(mid)、12 点指针、spinWheel() 的落点仍按 0°=12 点计算，
     于是颜色扇区 / 盘面文字 / 指针 / 抽奖结果会整体错开一个象限。
     改角度时务必四者一起改。 */
  $('wheelDisc').style.background='conic-gradient(from 0deg,'+
    (stops.length?stops.join(','):WHEEL_THANKS+' 0deg 360deg')+')';
  $('wheelDisc').innerHTML=labels.join('');
  $('wheelList').innerHTML=rows.join('');
  return wheelSegs;
}
/* 关掉再打开、或改过奖项后，圆盘必须回到 0°，否则新扇区会叠在旧落点上：
   标签歪斜、指针指到的奖项和实际结果对不上。复位时临时关掉过渡动画。 */
function resetWheelAngle(){
  if(wheelSpinning) return false;
  wheelRotation=0;
  const d=$('wheelDisc');
  try{
    d.style.transition='none';
    d.style.transform='rotate(0deg)';
    if(d.offsetWidth!==undefined) void d.offsetWidth;
    d.style.transition='';
  }catch(e){ d.style.transform='rotate(0deg)'; }
  return true;
}
function syncWheelButtons(){
  const points=Number(state.plan.points)||0;
  const d=ensureLotteryDaily();
  const cost=lotteryCostNow();
  const disabled=wheelSpinning||wheelInvalid||points<cost;
  $('btnSpin').disabled=disabled;
  $('wheelHub').classList.toggle('off',disabled);
  $('wheelWarn').classList.toggle('show',wheelInvalid||d.won);
  $('wheelWarn').textContent=wheelInvalid?
    '奖项概率合计 '+wheelTotal+'%，超过 100%。请家长解锁后在「抽奖」页调整，暂时不能抽奖。':
    d.won? '今天已经中过奖啦！再抽不会再中奖，且消耗翻倍为 '+cost+' 分。':
    cost>Math.max(1,Number(state.lottery.cost)||10)? '本次消耗已翻倍为 '+cost+' 分。':'';
  $('wheelPoints').textContent=points;
  $('wheelCost').textContent=cost;
  if($('wheelDaily')) $('wheelDaily').textContent=d.draws;
  if($('btnSpin')) $('btnSpin').textContent=d.won?'再抽一次（翻倍）':'开始抽奖';
}
function openWheel(){
  if(wheelSpinning) return;
  wheelHit=-99;
  resetWheelAngle();
  renderWheel();
  $('wheelResult').textContent='点「开始抽奖」或点盒子，揭晓惊喜';
  $('wheelResult').className='wheel-result';
  $('wheelPrize').classList.remove('show');
  /* 盲盒每次打开都从盖好的初始态开始 */
  const scene=$('boxScene'); if(scene) scene.className='box-scene';
  if($('boxPrizeName')) $('boxPrizeName').textContent='';
  if($('boxPrizeTag')) $('boxPrizeTag').textContent='恭喜抽中';
  if($('boxPrizeNote')) $('boxPrizeNote').textContent='';
  syncWheelButtons();
  $('wheelMask').hidden=false;
}
function closeWheel(){ if(!wheelSpinning) $('wheelMask').hidden=true; }
function spinWheel(){
  if(wheelSpinning) return null;
  const res=drawLottery();
  if(!res) return null;                 // 积分不足 / 概率错误，已由 drawLottery 提示
  /* 每次转动前按当前奖项重画盘面：既保证扇区与奖项同步，也清掉上次高亮。
     只重画 background / 标签，transform 保持不变，落点仍按同一套扇区算。 */
  wheelHit=-99; renderWheel();
  let target=wheelSegs.findIndex(s=>s.index===res.index);
  if(target<0) target=wheelSegs.length-1;
  const seg=wheelSegs[target]||{start:0,end:360,mid:180};
  const landing=seg.start+(0.2+Math.random()*0.6)*(seg.end-seg.start);
  /* 指针固定在 12 点：要让 landing 角度的扇区停在指针处，圆盘的
     「绝对角度」必须 ≡ -landing (mod 360)。连抽时先减掉上一次的落点，
     否则第二次会叠加上一次的偏移，指针停错扇区。 */
  const current=((wheelRotation%360)+360)%360;
  const want=((360-landing)%360+360)%360;
  const delta=((want-current)%360+360)%360;
  wheelRotation += 360*5 + delta;
  $('wheelDisc').style.transform='rotate('+wheelRotation.toFixed(2)+'deg)';
  wheelSpinning=true;
  $('btnSpin').disabled=true;
  $('wheelHub').classList.add('off');
  $('wheelResult').textContent='正在开盒…';
  $('wheelResult').className='wheel-result';
  $('wheelPrize').classList.remove('show');
  $('wheelPoints').textContent=res.points;
  /* 结果文字先写好：揭晓时盒子隐去，中央直接显示奖品，不再停留未拆的红包 */
  if($('boxPrizeName')) $('boxPrizeName').textContent=res.prize||'谢谢参与';
  if($('boxPrizeTag')) $('boxPrizeTag').textContent=res.index>=0?'🎉 恭喜抽中':'本次结果';
  if($('boxPrizeNote')) $('boxPrizeNote').textContent=res.index>=0?'奖励已为你记下':'别灰心，再来一次';
  /* 盲盒动画：先晃动盒子，短暂后掀盖 + 光芒 + 彩带迸发 */
  const scene=$('boxScene');
  if(scene){
    scene.className='box-scene opening';
    if(typeof setTimeout==='function'){
      setTimeout(()=>{ if(wheelSpinning) scene.className='box-scene reveal'; },520);
    }
  }
  if(typeof setTimeout==='function') setTimeout(()=>finishSpin(res),4300);
  return res;
}
function finishSpin(res){
  res=res||{prize:'谢谢参与',index:-1,color:WHEEL_THANKS,
    points:Number(state.plan.points)||0};
  wheelSpinning=false;
  /* 高亮图例中真正被指针指到的那个扇区；renderWheel 只重画 background
     与标签，不触碰 transform，圆盘仍停在结果角度。 */
  wheelHit=res.index; renderWheel();
  syncWheelButtons();
  $('wheelResult').textContent=(res.index>=0?'恭喜抽中：':'本次结果：')+res.prize;
  $('wheelResult').className='wheel-result win';
  $('wheelPrizeTag').textContent=res.autoRedeem?'自动兑换 · 不扣分':
    (res.index>=0?'待兑换 · 线下发放后标记':'本次结果');
  $('wheelPrizeName').textContent=res.prize;
  $('wheelPrizeDot').style.background=res.color||WHEEL_THANKS;
  $('wheelPrize').classList.add('show');
  if($('boxPrizeName')) $('boxPrizeName').textContent=res.prize||'谢谢参与';
  if($('boxPrizeTag')) $('boxPrizeTag').textContent=res.autoRedeem?'🎉 自动兑换':
    (res.index>=0?'🎉 恭喜抽中':'本次结果');
  if($('boxPrizeNote')) $('boxPrizeNote').textContent=res.autoRedeem?'已经生效，未消耗积分':
    (res.index>=0?'到「抽奖」页点「标记已兑换」':'别灰心，再来一次');
  const scene=$('boxScene'); if(scene) scene.className='box-scene reveal';
  renderPoints(); renderDrawer();
}

