/* ============================================================
   记忆成长中心：艾宾浩斯复习 / 听写 / 闯关地图 / 学习统计
   全部状态挂在 state.memo 命名空间，不改旧存档结构。
   ============================================================ */
const SR_STEPS=[1,2,4,7,15,30];   // 答对后逐级拉开的复习间隔（天）
let growthTab='review';
let srQueue=[], srIdx=0, srRight=0, srCurrent=null, srPhase='idle', srT0=0;
let dcQueue=[], dcIdx=0, dcRight=0, dcStreak=0, dcCurrent=null, dcPhase='idle', dcT0=0;

function memo(){ return state.memo || (state.memo={srs:{},stars:{},dictBest:{},mapUnlockAll:false}); }
/* 收录 / 更新一条记忆记录。ok=true 升级并推远到期日；false 打回当天重练。
   create=false 时只升级已存在的条目（用于整句答对时只巩固之前错过的词）。 */
function srEnroll(en,cn,ok,create){
  const key=normWord(en); if(!key) return null;
  const m=memo(); if(!m.srs || typeof m.srs!=='object') m.srs={};
  if(create===false && !m.srs[key]) return null;
  const r=m.srs[key]||{en:en,cn:cn||'',lv:0,due:today(),seen:0,ok:0,bad:0,last:0};
  r.en=en; if(cn) r.cn=cn;
  r.seen=(Number(r.seen)||0)+1; r.last=Date.now();
  if(ok){
    r.ok=(Number(r.ok)||0)+1;
    r.lv=Math.min(6,(Number(r.lv)||0)+1);
    r.due=dateShift(today(),SR_STEPS[Math.min(5,r.lv-1)]);
  }else{
    r.bad=(Number(r.bad)||0)+1;
    r.lv=0; r.due=today();
  }
  m.srs[key]=r; return r;
}
function srDueList(){
  const all=Object.keys(memo().srs||{}).map(k=>Object.assign({key:k},memo().srs[k]));
  const t=dayNum(today());
  return all.filter(r=>dayNum(r.due)<=t).sort((a,b)=>dayNum(a.due)-dayNum(b.due));
}
function srAllList(){
  return Object.keys(memo().srs||{}).map(k=>Object.assign({key:k},memo().srs[k]))
    .sort((a,b)=>(Number(b.lv)||0)-(Number(a.lv)||0)||dayNum(a.due)-dayNum(b.due));
}
function srRenderList(){
  const all=srAllList(), t=dayNum(today());
  $('srDue').textContent=srDueList().length;
  $('srAll').textContent=all.length;
  $('srMastered').textContent=all.filter(r=>(Number(r.lv)||0)>=4).length;
  $('srList').innerHTML=all.length?all.slice(0,48).map(r=>
    '<div class="sr-item"><i class="due-dot'+(dayNum(r.due)>t?' later':'')+'"></i>'+
    '<span class="w" title="'+esc(r.en)+'">'+esc(r.en)+'</span>'+
    '<span class="lv">L'+(Number(r.lv)||0)+'</span>'+
    '<span class="m">'+esc(r.due)+'</span></div>').join(''):
    '<div class="empty">还没有收录。做错的单词会自动出现在这里，也可以直接在「生词本」里点星收藏。</div>';
}
function srStart(all){
  const q=all?srAllList():srDueList();
  if(!q.length){ toast(all?'复习清单还是空的':'今天没有要复习的，稍后再来 🎉','ok'); return; }
  srQueue=shuffle(q).slice(0,20); srIdx=0; srRight=0; srCurrent=null; srPhase='ask'; srT0=Date.now();
  srNextCard();
}
function srNextCard(){
  if(srIdx>=srQueue.length){
    srPhase='idle';
    $('srPrompt').hidden=true; $('srInput').hidden=true; $('srActions').hidden=true;
    $('srFeedback').className='gfeedback ok';
    $('srFeedback').textContent='复习完成！本轮 '+srQueue.length+' 条，一次答对 '+srRight+' 条。';
    $('srBar').style.width='100%';
    srRenderList(); renderHeader(); renderDrawer(); saveState(true); return;
  }
  srCurrent=srQueue[srIdx];
  /* 新的一题必须回到 ask，否则上一题的 answered 状态会残留，
     导致下一题无论点按钮还是回车都无法提交 */
  srPhase='ask';
  $('srPrompt').hidden=false; $('srPrompt').innerHTML='中文提示：<b>'+esc(srCurrent.cn||srCurrent.en)+'</b>';
  $('srInput').hidden=false; $('srInput').disabled=false; $('srInput').value='';
  $('srActions').hidden=true; $('srFeedback').textContent=''; $('srFeedback').className='gfeedback';
  $('srBar').style.width=Math.round(srIdx/srQueue.length*100)+'%';
  try{ $('srInput').focus(); }catch(e){}
  speak(srCurrent.en);
}
function srSubmit(){
  if(srPhase!=='ask'||!srCurrent) return;
  const val=String($('srInput').value||'').trim(); if(!val) return;
  const ok=equal(val,srCurrent.en);
  srEnroll(srCurrent.en,srCurrent.cn,ok,true);
  addHistory({mode:'review',unit:'错词复习',cn:srCurrent.cn||'',en:srCurrent.en,
    ok:ok,assisted:false,ms:Date.now()-srT0,bad:ok?0:1});
  if(ok){ srRight++; $('srFeedback').className='gfeedback ok'; $('srFeedback').textContent='答对啦！间隔会自动拉长 ✓'; }
  else{ $('srFeedback').className='gfeedback bad';
    $('srFeedback').innerHTML='再记一记：<span class="ganswer">'+esc(srCurrent.en)+'</span>'; }
  srPhase='answered'; srT0=Date.now();
  $('srInput').disabled=true; $('srActions').hidden=false;
  if(!ok && Number(state.plan.perCorrect||0)>0) { /* 答错不奖分 */ }
  if(ok && Number(state.plan.perCorrect||0)>0) addPoints(Number(state.plan.perCorrect),'错词复习答对');
  renderHeader();
}
