/* ---------------- 练习记录 ---------------- */
const MODE_CN={sentence:'整句',chunk:'分步',word:'单词',dict:'听写',paperdict:'纸笔听写',review:'错词复习',typing:'打字练习',phonics:'自然拼读'};
function goPaperDict(){ openDrawer(false); setMode('growth'); switchGrowth('paper'); }
function histDate(t){
  const d=new Date(t||Date.now());
  return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();   // 与 today() 同格式
}
function addHistory(rec){
  if(!Array.isArray(state.history)) state.history=[];
  const entry=Object.assign({t:Date.now()},rec);
  state.history.push(entry);
  if(state.history.length>HISTORY_LIMIT) state.history.splice(0,state.history.length-HISTORY_LIMIT);
  /* 所有练习模式统一在这里统计用时、更新个人最快纪录 */
  try{ trackSpeed(entry); }catch(e){}
  /* 有练习记录的那天就算打卡，日历与主程序进度保持同一份数据 */
  if(typeof window!=='undefined' && window.TypingDuck && typeof window.TypingDuck.syncPracticeCheckin==='function'){
    try{ window.TypingDuck.syncPracticeCheckin(); }catch(e){}
  }
}
function renderHistory(){
  const h=(Array.isArray(state.history)?state.history:[]).slice().sort((a,b)=>(b.t||0)-(a.t||0));
  const tk=today();
  const okCount=h.filter(x=>x.ok).length;
  const mins=Math.round(h.reduce((n,x)=>n+(Number(x.ms)||0),0)/60000);
  /* 个人最快榜：同一词/句只保留一条最佳，按用时升序取前 10 */
  const allBest=Object.keys(state.bestTimes||{}).map(function(k){
    return Object.assign({key:k},state.bestTimes[k]||{});
  }).filter(x=>Number(x.ms)>0).sort((a,b)=>Number(a.ms)-Number(b.ms));
  $('bestList').innerHTML=allBest.length?allBest.slice(0,10).map(function(x,i){
    return '<div class="best-row"><span class="best-rank">'+(i+1)+'</span>'+
      '<div class="best-body"><div class="best-en">'+esc(x.en||x.cn||'练习')+'</div>'+
      '<div class="best-meta">'+esc(SPEED_MODES[x.mode]||'练习')+' · '+esc(x.unit||'')+
      ' · '+esc(x.cn||'')+' · 刷新 '+Number(x.breaks||0)+' 次</div></div>'+
      '<span class="best-ms">'+fmtSpeed(x.ms)+'</span></div>';
  }).join(''):'<div class="empty">还没有最快纪录。一次答对一道题后，这里会自动记下用时；再快一点就会收到鼓励动画。</div>';
  const todayMs=h.filter(x=>histDate(x.t)===tk && x.ok && Number(x.ms)>0).map(x=>Number(x.ms));
  $('histGrid').innerHTML=
    box(h.filter(x=>histDate(x.t)===tk).length,'今日练习')+box(h.length,'累计练习')+
    box(h.length?Math.round(okCount/h.length*100)+'%':'--','一次答对率')+box(mins,'累计分钟')+
    box(allBest.length,'速度纪录')+box(todayMs.length?fmtSpeed(Math.min.apply(null,todayMs)):'--','今日最快');
  if(!h.length){
    const legacy=Number((state.stats||{}).attempted||0);
    $('histList').innerHTML='<div class="empty">'+(legacy
      ? '升级前已有 '+legacy+' 次练习，累计数据仍保留在「学习」面板的统计里；逐条明细从现在开始记录，完成下一道题后就会出现在这里。'
      : '还没有练习记录。完成一道题后，这里会自动记下时间和结果。')+'</div>';
    return;
  }
  const shown=h.slice(0,120), parts=[]; let lastDay='';
  shown.forEach(x=>{
    const d=histDate(x.t);
    if(d!==lastDay){ parts.push('<div class="hist-day">'+esc(d===tk?d+' · 今天':d)+'</div>'); lastDay=d; }
    const time=new Date(x.t).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});
    parts.push(
      '<div class="hist-item"><span class="hist-time">'+esc(time)+'</span>'+
      '<div class="hist-body"><div class="hist-en">'+esc(x.en||'')+'</div>'+
      '<div class="hist-cn">'+esc(x.cn||'')+'</div>'+
      '<div class="hist-meta">'+esc(MODE_CN[x.mode]||'练习')+' · '+esc(x.unit||'')+
      ' · '+Math.max(1,Math.round((Number(x.ms)||0)/1000))+' 秒'+
      (x.record?' · ⚡新纪录':'')+(x.bad?' · 错 '+Number(x.bad)+' 次':'')+'</div></div>'+
      '<span class="hist-badge'+(x.ok?'':' assist')+'">'+esc(x.ok?'一次过':'借助提示')+'</span></div>'
    );
  });
  if(h.length>shown.length) parts.push('<div class="empty">仅显示最近 120 条，完整记录可导出 CSV。</div>');
  $('histList').innerHTML=parts.join('');
}
function exportHistoryCSV(){
  const h=Array.isArray(state.history)?state.history:[];
  if(!h.length){ toast('还没有练习记录','bad'); return; }
  const q=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';
  const rows=[['时间','模式','单元','中文','英文','结果','用时秒','错误次数'].map(q).join(',')];
  h.slice().sort((a,b)=>(a.t||0)-(b.t||0)).forEach(x=>{
    rows.push([new Date(x.t).toLocaleString('zh-CN'),MODE_CN[x.mode]||x.mode,
      x.unit||'',x.cn||'',x.en||'',x.ok?'一次过':'借助提示',
      Math.round((Number(x.ms)||0)/1000),x.bad||0].map(q).join(','));
  });
  const name='spelllab-history-'+today()+'.csv';
  if(downloadText(name,'\ufeff'+rows.join('\r\n'),'text/csv;charset=utf-8'))
    toast('已导出 '+h.length+' 条记录','ok');
  else toast('浏览器未开放下载，请用桌面版导出','bad');
}

