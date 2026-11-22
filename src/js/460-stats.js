/* ---------------- 学习统计 ---------------- */
function statsRender(){
  const h=Array.isArray(state.history)?state.history:[], s=state.stats;
  const ok=h.filter(x=>x.ok).length;
  const days=[]; for(let i=6;i>=0;i--) days.push(dateShift(today(),-i));
  const cnt=days.map(d=>h.filter(x=>histDate(x.t)===d).length);
  const okc=days.map(d=>h.filter(x=>histDate(x.t)===d&&x.ok).length);
  let streak=0; for(let i=h.length-1;i>=0;i--){ if(histDate(h[i].t)===today()) continue; break; }
  const seen=new Set(h.map(x=>histDate(x.t)));
  let cursor=today(); while(seen.has(cursor)){ streak++; cursor=dateShift(cursor,-1); }
  const mastered=Object.values(state.wordStats).filter(x=>(x.m||0)>=2).length
    +Object.values(memo().srs||{}).filter(x=>(Number(x.lv)||0)>=4).length;
  $('stGrid').innerHTML=box(h.length,'累计练习')+box(h.length?Math.round(ok/h.length*100)+'%':'--','一次答对率')+
    box(streak,'连续练习天数')+box(mastered,'掌握词句')+box(Number(state.plan.points)||0,'累计积分');

  const max=Math.max(1,...cnt,...okc), W=700,H=200,pad=30,slot=(W-pad*2)/7,bw=slot*0.32;
  let bars='';
  days.forEach((d,i)=>{
    const x=pad+slot*i+slot/2-bw-3, y1=H-pad-(cnt[i]/max)*(H-pad-24), y2=H-pad-(okc[i]/max)*(H-pad-24);
    bars+='<rect x="'+x.toFixed(1)+'" y="'+y1.toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+(H-pad-y1).toFixed(1)+'" rx="5" fill="#8b7bff"/>'+
      '<rect x="'+(x+bw+6).toFixed(1)+'" y="'+y2.toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+(H-pad-y2).toFixed(1)+'" rx="5" fill="#5ce2a0"/>'+
      '<text x="'+(pad+slot*i+slot/2).toFixed(1)+'" y="'+(H-8)+'" fill="#9aa5cf" font-size="11" text-anchor="middle">'+esc(d.slice(5).replace('-','/'))+'</text>';
  });
  $('stChart').innerHTML='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="近七天练习趋势">'+
    '<line x1="'+pad+'" y1="'+(H-pad)+'" x2="'+(W-pad)+'" y2="'+(H-pad)+'" stroke="rgba(226,232,255,.2)"/>'+bars+'</svg>';

  const modes={sentence:'句子拼写',chunk:'分步记忆',word:'单词速记',dict:'听写练习',review:'错词复习',typing:'打字练习'};
  const counts={}; h.forEach(x=>{ const k=modes[x.mode]||'其它'; counts[k]=(counts[k]||0)+1; });
  const entries=Object.keys(counts).map(k=>[k,counts[k]]).sort((a,b)=>b[1]-a[1]);
  const mx=Math.max(1,...entries.map(e=>e[1]));
  $('stModes').innerHTML=entries.length?entries.map(([k,v])=>
    '<div class="bar-row"><span class="bl">'+esc(k)+'</span><span class="bt"><i style="width:'+Math.round(v/mx*100)+'%"></i></span><span class="bv">'+v+' 次</span></div>').join(''):
    '<div class="empty">完成几次练习后，这里会显示各模式的分布。</div>';
}
function renderGrowthMini(){
  const all=srAllList();
  $('growthMini').innerHTML=box(srDueList().length,'今日待复习')+
    box(all.length,'复习清单')+box(Object.values(memo().stars||{}).filter(v=>v>=1).length,'已点亮关卡')+
    box(Number(state.plan.points)||0,'可用积分');
}
function growthRender(){
  srRenderList(); dcRenderPanel(); ppRenderPanel(); mapRender(); statsRender(); renderGrowthMini();
}
function switchGrowth(g){
  growthTab=g;
  ['review','dict','paper','map','stats'].forEach(k=>{
    const el=$('g'+k[0].toUpperCase()+k.slice(1)); if(el) el.classList.toggle('on',k===g);
  });
  document.querySelectorAll('#growthTabs button').forEach(b=>b.classList.toggle('active',b.dataset.g===g));
  if(g==='review') srRenderList();
  if(g==='dict') dcRenderPanel();
  if(g==='paper') ppRenderPanel();
  if(g==='map') mapRender();
  if(g==='stats') statsRender();
}
function growthEnter(){
  growthRender(); switchGrowth(growthTab);
  if(srPhase==='ask'&&srCurrent) srNextCard();
  if(dcPhase==='ask'&&dcCurrent) dcNextCard();
}

