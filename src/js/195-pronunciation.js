/* ---------------- 发音练习与打分 ----------------
   Chrome / Edge 内置 SpeechRecognition（localhost 或 HTTPS，需麦克风权限并联网）。
   打分依据是「识别出来的文本」与目标文本的逐词对齐，不是音素级评测；
   浏览器不支持时给出明确提示，不影响原有拼写练习。 */
let pronSession = null, pronRunning = false;

function pronCtor(){
  if(typeof window==='undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}
function pronSupported(){ return !!pronCtor() && window.isSecureContext!==false; }
function pronWords(s){
  const raw = String(s==null?'':s).toLowerCase()
    .replace(/[’']/g,' ').replace(/[^a-z0-9\s]/g,' ');
  return raw.split(/\s+/).filter(Boolean);
}
function pronKey(s){ return pronWords(s).join(' '); }
function pronAlign(a,b){
  const n=a.length, m=b.length, dp=[];
  for(let i=0;i<=n;i++) dp[i]=new Array(m+1).fill(0);
  for(let i=0;i<=n;i++) dp[i][0]=i;
  for(let j=0;j<=m;j++) dp[0][j]=j;
  for(let i=1;i<=n;i++){
    for(let j=1;j<=m;j++){
      dp[i][j] = a[i-1]===b[j-1] ? dp[i-1][j-1]
        : Math.min(dp[i-1][j-1],dp[i-1][j],dp[i][j-1])+1;
    }
  }
  let i=n, j=m; const ops=[];
  while(i>0 || j>0){
    if(i>0 && j>0 && a[i-1]===b[j-1] && dp[i][j]===dp[i-1][j-1]){
      ops.push({op:'ok',word:a[i-1]}); i--; j--;
    }else if(i>0 && j>0 && dp[i][j]===dp[i-1][j-1]+1){
      ops.push({op:'bad',word:a[i-1]}); i--; j--;
    }else if(i>0 && dp[i][j]===dp[i-1][j]+1){
      ops.push({op:'miss',word:a[i-1]}); i--;
    }else if(j>0){
      ops.push({op:'extra',word:b[j-1]}); j--;
    }else{
      ops.push({op:'miss',word:a[i-1]}); i--;
    }
  }
  return ops.reverse();
}
function pronSimilarity(a,b){
  const n=a.length, m=b.length, dp=[];
  for(let i=0;i<=n;i++) dp[i]=new Array(m+1).fill(0);
  for(let i=0;i<=n;i++) dp[i][0]=i;
  for(let j=0;j<=m;j++) dp[0][j]=j;
  for(let i=1;i<=n;i++){
    for(let j=1;j<=m;j++){
      dp[i][j]=a[i-1]===b[j-1]?dp[i-1][j-1]:Math.min(dp[i-1][j-1],dp[i-1][j],dp[i][j-1])+1;
    }
  }
  const max=Math.max(n,m)||1;
  return Math.max(0,1-dp[n][m]/max);
}
function pronScore(target,heard){
  const a=pronWords(target), b=pronWords(heard);
  /* 单个英文词：逐词对齐会把拼错当成「整词没读 + 多读一个词」，
     这里改用字母级相似度，读错一两个字母仍能给出合理分数。 */
  if(a.length===1 && b.length===1 && a[0]!==b[0]){
    const s=pronSimilarity(a[0],b[0]);
    return {score:Math.round(s*100),ops:[{op:'bad',word:a[0]}],extras:[],
            hits:0,total:1,heard:b[0],similar:true};
  }
  const ops=pronAlign(a,b);
  const extras=ops.filter(x=>x.op==='extra').map(x=>x.word);
  const hits=ops.filter(x=>x.op==='ok').length;
  const denom=a.length+extras.length;
  return {score:denom?Math.round(hits/denom*100):0, ops:ops, extras:extras,
          hits:hits, total:a.length, heard:b.join(' ')};
}
function pronLevel(score){ return score>=85?'good':(score>=60?'mid':'bad'); }
function pronBest(key){
  const all=(state.pronunciation && state.pronunciation.best)||{};
  return all[key]||{score:0,t:0,heard:''};
}
function pronStore(source,text,result){
  if(!state.pronunciation || typeof state.pronunciation!=='object')
    state.pronunciation={records:[],best:{}};
  const p=state.pronunciation;
  if(!Array.isArray(p.records)) p.records=[];
  if(!p.best || typeof p.best!=='object' || Array.isArray(p.best)) p.best={};
  const rec={t:Date.now(),source:String(source||'发音练习'),
    text:String(text||''),heard:result.heard,score:result.score,
    hits:result.hits,total:result.total};
  p.records.push(rec);
  if(p.records.length>200) p.records=p.records.slice(-200);
  const key=pronKey(text), best=p.best[key];
  if(!best || result.score>Number(best.score)) p.best[key]={score:result.score,t:rec.t,heard:result.heard};
  try{ saveState(true); }catch(e){}
  return rec;
}
function pronStatus(msg){
  const el=$('pronStatus'); if(el) el.textContent=msg;
}
function pronOpen(text,source){
  const t=String(text||'').trim();
  const mask=$('pronMask');
  if(!t || !mask) return;
  if(pronSession) pronStop(true);
  pronSession={text:t,source:String(source||'发音练习'),start:Date.now(),
    rec:null,final:'',confidence:0,done:false,manual:false};
  $('pronSource').textContent=pronSession.source;
  $('pronTarget').textContent=t;
  $('pronHeard').hidden=true; $('pronScore').hidden=true; $('pronTokens').hidden=true;
  $('pronStart').hidden=false; $('pronStart').disabled=false; $('pronStop').hidden=true;
  mask.hidden=false;
  const best=pronBest(pronKey(t));
  $('pronBest').textContent=best.score?('这项历史最好 '+best.score+' 分'):'这项还没有成绩，读一次试试';
  if(!pronSupported()){
    pronStatus('当前浏览器不支持语音识别。请用桌面版或 Chrome / Edge 打开，并允许麦克风权限；页面需在本机服务或 HTTPS 下运行。');
    $('pronStart').disabled=true;
    return;
  }
  pronStatus('请清楚读出上面的英文…');
  /* 直接开始：本次点击就是用户手势，浏览器会弹出麦克风授权。 */
  pronStart();
}
function pronStart(){
  if(!pronSession) return;
  if(pronRunning) return;
  if(pronSession.done){
    /* 「再读一次」：沿用当前题目，清掉上一轮结果重新记 */
    pronSession.final=''; pronSession.confidence=0;
    pronSession.done=false; pronSession.manual=false;
    $('pronHeard').hidden=true; $('pronScore').hidden=true; $('pronTokens').hidden=true;
    pronStatus('请再读一遍…');
  }
  const SR=pronCtor();
  if(!SR){ pronStatus('当前浏览器不支持语音识别'); return; }
  try{
    const rec=new SR();
    rec.lang=englishLang();          /* 跟随顶栏英美口音 */
    rec.continuous=false;
    rec.interimResults=true;
    rec.maxAlternatives=1;
    rec.onstart=()=>{
      pronRunning=true;
      $('pronStart').hidden=true; $('pronStop').hidden=false;
      pronStatus('正在听…读完稍等一下，或点「停止」结束');
    };
    rec.onresult=e=>{
      let interim='';
      for(let i=e.resultIndex;i<e.results.length;i++){
        const r=e.results[i], txt=String(r[0]&&r[0].transcript||'').trim();
        if(r.isFinal){
          pronSession.final=(pronSession.final?pronSession.final+' ':'')+txt;
          pronSession.confidence=Number(r[0].confidence)||0;
        }else interim+=(interim?' ':'')+txt;
      }
      if(interim) pronStatus('听到：'+interim+'…');
      if(pronSession.final) pronFinish();
    };
    rec.onerror=e=>{
      const err=String(e&&e.error||'error');
      const msg={ 'not-allowed':'麦克风权限被拒绝，请在浏览器地址栏允许麦克风后重试',
        'service-not-allowed':'浏览器语音服务不可用，请检查网络或换 Chrome / Edge',
        'network':'语音识别服务连接失败，请检查网络',
        'audio-capture':'没有检测到麦克风，请检查设备',
        'no-speech':'没有听到声音，再读一次试试' }[err]||('识别失败：'+err);
      if(err!=='aborted') pronStatus(msg);
    };
    rec.onend=()=>{
      pronRunning=false;
      if(!pronSession || pronSession.done) return;
      $('pronStart').hidden=false; $('pronStop').hidden=true;
      if(!pronSession.final) pronStatus(pronSession.manual?'已停止，没有获得识别结果':'没有听清，点「再读一次」试试');
    };
    pronSession.rec=rec;
    rec.start();
  }catch(e){
    pronRunning=false;
    pronStatus('启动语音识别失败：'+(e&&e.message||'未知错误'));
  }
}
function pronFinish(){
  if(!pronSession || pronSession.done) return;
  pronSession.done=true; pronRunning=false;
  const result=pronScore(pronSession.text,pronSession.final||'');
  const rec=pronStore(pronSession.source,pronSession.text,result);
  $('pronHeard').hidden=false;
  $('pronHeard').textContent='识别结果：'+(result.heard||'（没有听清）');
  $('pronScore').hidden=false;
  $('pronScore').className='pron-score '+pronLevel(result.score);
  $('pronScoreNum').textContent=result.score;
  $('pronTokens').hidden=false;
  const parts=result.ops.filter(x=>x.op!=='extra').map(x=>
    '<span class="pron-token '+x.op+'">'+esc(x.word)+'</span>');
  if(result.extras.length) parts.push('<span class="pron-token extra">多读：'+esc(result.extras.join(' '))+'</span>');
  $('pronTokens').innerHTML=parts.join('');
  const best=pronBest(pronKey(pronSession.text));
  $('pronBest').textContent='这项历史最好 '+best.score+' 分';
  pronStatus(rec && best && best.t===rec.t ? '已记录 · 本次 '+result.score+' 分 · 新纪录！'
    : '已记录 · 本次 '+result.score+' 分');
  $('pronStart').textContent='再读一次';
  $('pronStart').hidden=false; $('pronStop').hidden=true;
  if(pronSession.rec){ try{ pronSession.rec.stop(); }catch(e){} }
  SFX[result.score>=85?'complete':(result.score>=60?'step':'wrong')]();
}
function pronStop(manual){
  if(!pronSession) return;
  if(manual) pronSession.manual=true;
  if(pronRunning && pronSession.rec){ try{ pronSession.rec.stop(); }catch(e){} }
  else if(manual && !pronSession.done){ pronStatus('已停止，没有获得识别结果'); }
}
function pronClose(){
  if(pronSession) pronStop(true);
  const mask=$('pronMask'); if(mask) mask.hidden=true;
  pronSession=null; pronRunning=false;
}
function renderPronRecords(){
  if(!$('pronGrid') || !$('pronList')) return;
  const p=state.pronunciation||{}, rs=Array.isArray(p.records)?p.records.slice().sort((a,b)=>(b.t||0)-(a.t||0)):[];
  const tk=today(), td=rs.filter(x=>histDate(x.t)===tk);
  const avg=rs.length?Math.round(rs.reduce((n,x)=>n+(Number(x.score)||0),0)/rs.length):'--';
  const best=Object.keys(p.best||{}).reduce((n,k)=>Math.max(n,Number(p.best[k].score)||0),0);
  $('pronGrid').innerHTML=box(td.length,'今日朗读')+box(rs.length,'累计朗读')+
    box(avg+(rs.length?' 分':''),'平均得分')+box(best?best+' 分':'--','最好成绩');
  $('pronList').innerHTML=rs.length?rs.slice(0,40).map(x=>{
    const time=new Date(x.t).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
    const lv=pronLevel(Number(x.score)||0);
    return '<div class="hist-item"><span class="hist-time">'+esc(time)+'</span>'+
      '<div class="hist-body"><div class="hist-en">'+esc(x.text)+'</div>'+
      '<div class="hist-cn">'+esc(x.heard||'')+'</div>'+
      '<div class="hist-meta">'+esc(x.source)+' · 读对 '+(Number(x.hits)||0)+'/'+(Number(x.total)||0)+'</div></div>'+
      '<span class="hist-badge '+lv+'">'+esc(x.score)+' 分</span></div>';
  }).join(''):'<div class="empty">还没有朗读成绩。在句子练习、单词速记或生词本里点麦克风，读一遍就能看到分数。</div>';
}
