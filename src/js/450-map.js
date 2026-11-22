/* ---------------- 闯关地图 ---------------- */
function mapStars(u){
  const ids=(u.sentences||[]).map((_,i)=>uid(u.id,i));
  let got=0;
  ids.forEach(id=>{ if(((state.progress[id]||{}).m||0)>=2) got++; });
  (u.words||[]).forEach(w=>{ if(((state.wordStats[normWord(w[0])]||{}).m||0)>=2) got++; });
  const total=ids.length+(u.words||[]).length;
  if(!total) return 0;
  const r=got/total;
  return r>=0.85?3:r>=0.55?2:r>0?1:0;
}
function mapRender(){
  const us=units(), stars=us.map(mapStars), m=memo();
  if(!m.stars || typeof m.stars!=='object') m.stars={};
  us.forEach((u,i)=>{ if(stars[i]>(Number(m.stars[u.id]||0))) m.stars[u.id]=stars[i]; });
  $('mapToggle').textContent='🔓 自由闯关：'+(m.mapUnlockAll?'开':'关');
  $('mapGrid').innerHTML=us.map((u,i)=>{
    const locked=i>0 && !m.mapUnlockAll && !(stars[i-1]>=1 || (Number(m.stars[us[i-1].id]||0))>=1);
    return '<button class="map-node'+(locked?' locked':'')+'" data-lv="'+i+'"'+(locked?' disabled':'')+'>'+
      (locked?'<span class="lk">🔒</span>':'')+
      '<div class="idx">第 '+(i+1)+' 关 · '+(u.sentences||[]).length+' 句 / '+(u.words||[]).length+' 词</div>'+
      '<div class="nm">'+esc(u.name)+'</div>'+
      '<div class="st">'+'★'.repeat(stars[i])+'☆'.repeat(3-stars[i])+'</div></button>';
  }).join('')||'<div class="empty">当前范围没有单元，去「教材库」导入一个吧。</div>';
}
