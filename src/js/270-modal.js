/* ---------------- 通用弹窗 ---------------- */
let modalDismissible = false;
function showModal(opts){
  try{
    $('modalTitle').textContent=opts.title||'';
    $('modalText').textContent=opts.text||'';
    $('modalResult').innerHTML=opts.result||'';
    const acts=opts.actions||[{label:'知道了'}];
    const host=$('modalActions'); host.innerHTML='';
    acts.forEach(a=>{
      const b=document.createElement('button');
      b.textContent=a.label;
      if(a.primary) b.className='primary';
      b.addEventListener('click',()=>{ hideModal(); if(a.onClick) a.onClick(); });
      host.appendChild(b);
    });
    modalDismissible=!!opts.dismissible;
    $('modalMask').hidden=false;
  }catch(e){}
}
function hideModal(){ try{ $('modalMask').hidden=true; }catch(e){} }

/* 速度突破动画：只展示不拦截操作，连续破纪录会重置计时并更新内容 */
let speedBurstTimer=0;
function showSpeedBurst(info){
  const el=$('speedMask'); if(!el) return;
  $('speedWord').textContent=String(info.en||info.cn||'练习');
  $('speedNow').textContent=fmtSpeed(info.ms);
  $('speedPrev').textContent=fmtSpeed(info.prev);
  const gain=Math.max(0,Number(info.prev)-Number(info.ms));
  $('speedGain').textContent='比上次快了 '+fmtSpeed(gain)+' · 第 '+info.breaks+' 次刷新纪录';
  const host=$('speedConfetti');
  if(host){
    const colors=['#ffd166','#ff6b9d','#6ee7b7','#8b7bff','#4cc9f0'];
    let parts='';
    for(let i=0;i<20;i++){
      parts+='<i style="--a:'+(i*18)+'deg;--d:'+(36+(i*7)%64)+
        'px;--c:'+colors[i%5]+';--delay:'+((i%5)*0.04).toFixed(2)+'s"></i>';
    }
    host.innerHTML=parts;
  }
  el.hidden=false;
  if(speedBurstTimer){ clearTimeout(speedBurstTimer); speedBurstTimer=0; }
  speedBurstTimer=setTimeout(function(){ el.hidden=true; speedBurstTimer=0; },2600);
}

