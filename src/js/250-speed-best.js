/* ---------------- 速度与个人最快纪录 ----------------
   所有答题型练习都走 addHistory，这里统一统计「完成一道题用了多久」。
   - 只认一次答对（借助提示、答错不计），避免靠提示刷快；
   - 300ms 以下视作误触，30 分钟以上视作挂机，都不计纪录；
   - key = 模式 + 英文题，同一个词/句跨单元共用一条个人最佳。 */
const SPEED_MODES={sentence:'整句',chunk:'分步',word:'单词',phonics:'自然拼读',
  review:'错词复习',dict:'听写',paperdict:'纸笔听写',typing:'打字练习'};
function fmtSpeed(ms){
  const s=Math.max(0,Number(ms)||0)/1000;
  if(s<60) return s.toFixed(1)+' 秒';
  return Math.floor(s/60)+' 分 '+(s%60).toFixed(1)+' 秒';
}
function speedKey(rec){
  return String(rec.mode||'')+'|'+String(rec.en||'').trim().toLowerCase();
}
function trackSpeed(rec){
  if(!rec || rec.ok!==true || rec.assisted || !SPEED_MODES[rec.mode]) return;
  const ms=Number(rec.ms);
  if(!Number.isFinite(ms) || ms<300 || ms>1800000) return;
  if(!String(rec.en||'').trim()) return;
  if(!state.bestTimes || typeof state.bestTimes!=='object') state.bestTimes={};
  const key=speedKey(rec), old=state.bestTimes[key], prev=old?Number(old.ms)||0:0;
  if(prev && prev<=ms) return;
  const breaks=(Number(old&&old.breaks)||0)+1;
  state.bestTimes[key]={ms:ms,t:rec.t||Date.now(),en:String(rec.en||''),cn:String(rec.cn||''),
    unit:String(rec.unit||''),mode:rec.mode,breaks:breaks};
  rec.record=true;
  if(prev){
    try{ showSpeedBurst({en:rec.en,cn:rec.cn,mode:rec.mode,ms:ms,prev:prev,breaks:breaks}); }catch(e){}
  }else{
    try{ if(typeof toast==='function') toast('已记下个人最快：'+fmtSpeed(ms),'ok'); }catch(e){}
  }
}

