function normalizeState(s){
  const fresh=()=>clone(DEFAULT_STATE);
  if(!s || typeof s!=='object') return fresh();
  const out = Object.assign(fresh(), s, {
    settings:Object.assign({},DEFAULT_STATE.settings,s.settings||{}),
    stats:Object.assign({},DEFAULT_STATE.stats,s.stats||{}),
    filter:Object.assign({},DEFAULT_STATE.filter,s.filter||{}),
    customMeta:Object.assign({},DEFAULT_STATE.customMeta,s.customMeta||{}),
    plan:Object.assign({},DEFAULT_PLAN,(s.plan&&typeof s.plan==='object')?s.plan:{}),
    lottery:Object.assign({},DEFAULT_LOTTERY,(s.lottery&&typeof s.lottery==='object')?s.lottery:{}),
    grammar:Object.assign({},DEFAULT_STATE.grammar,(s.grammar&&typeof s.grammar==='object')?s.grammar:{})
  });
  /* 老存档里 done/pointsPaid 可能是数组或字符串，数组是 truthy，单用 ||{} 不会纠正 */
  ['done','pointsPaid'].forEach(k=>{
    const v=out.grammar[k];
    if(!v || typeof v!=='object' || Array.isArray(v)) out.grammar[k]={};
  });
  if(!Array.isArray(out.grammar.wrong)) out.grammar.wrong=[];
  out.grammar.stats=Object.assign({answered:0,correct:0},out.grammar.stats||{});
  ['custom','wrong','vocab','practiceSets','grades','books','textbooks','history'].forEach(k=>{
    if(!Array.isArray(out[k])) out[k]=clone(DEFAULT_STATE[k]);
  });
  ['progress','wordStats','unitMeta'].forEach(k=>{
    if(!out[k] || typeof out[k]!=='object' || Array.isArray(out[k])) out[k]={};
  });
  /* 记忆进阶：把 srs/stars/dictBest 规范为纯对象，剔除非法条目。 */
  if(!out.memo || typeof out.memo!=='object' || Array.isArray(out.memo)) out.memo={};
  ['srs','stars','dictBest','paperDict'].forEach(k=>{
    if(!out.memo[k] || typeof out.memo[k]!=='object' || Array.isArray(out.memo[k])) out.memo[k]={};
  });
  out.memo.mapUnlockAll=!!out.memo.mapUnlockAll;
  /* 打字小鸭存档并入主存档（旧存档缺字段时给空对象，由打字模块补默认值）。 */
  if(!out.typingDuck || typeof out.typingDuck!=='object' || Array.isArray(out.typingDuck)) out.typingDuck={};
  if(out.history.length>HISTORY_LIMIT) out.history=out.history.slice(-HISTORY_LIMIT);
  if(!out.grades.length) out.grades=clone(DEFAULT_GRADES);
  if(!out.books.length) out.books=clone(DEFAULT_BOOKS);
  /* 六套整体词库：各自作为独立教材类别，老存档幂等补齐；旧合并类别迁移掉 */
  wordBankBooks().forEach(function(b){
    if(!out.books.some(x=>x&&x.id===b.id)) out.books.push({id:b.id,name:b.name});
  });
  out.books=out.books.filter(x=>x&&x.id!==WORDBANK_LEGACY_BOOK_ID);
  if(out.filter.bookId===WORDBANK_LEGACY_BOOK_ID ||
     (isWordBankBookId(out.filter.bookId) && !wordBankBooks().some(b=>b.id===out.filter.bookId)))
    out.filter.bookId='all';
  /* 学制与学段筛选：默认六三制 / 全部学段；旧存档缺字段时自动补齐 */
  out.system=out.system==='54'?'54':'63';
  if(!out.filter.stageId||!STAGES.some(x=>x.id===out.filter.stageId)) out.filter.stageId='all';
  if(out.filter.gradeId&&out.filter.gradeId!=='all') out.filter.gradeId=canonicalGradeId(out.filter.gradeId,out.system);
  ensureGradeCatalog(out);
  /* 教材包册别：老存档没有 volume 字段时按名称推断；显式设为未分册('')要保留 */
  (out.textbooks||[]).forEach(p=>{ if(p && p.volume==null) p.volume=inferVolume(p.name)||''; });
  /* 已导入的六上包补齐新句型：按单元名匹配、按英文去重，重复加载安全。 */
  (out.textbooks||[]).forEach(p=>{
    if(!p || p.sixaPatched || !/六年级上册/.test(String(p.name||''))) return;
    (p.units||[]).forEach(u=>{
      const add=SIXA_SENTENCE_PATCH[String((u&&u.name)||'').trim()];
      if(!add || !Array.isArray(u.sentences)) return;
      const seen={};
      u.sentences.forEach(q=>{ if(q&&q.en) seen[String(q.en).trim().toLowerCase()]=1; });
      add.forEach(q=>{
        const key=q.en.trim().toLowerCase();
        if(!seen[key]){
          u.sentences.push({cn:q.cn,en:q.en,hints:q.hints.slice()});
          seen[key]=1;
        }
      });
    });
    p.sixaPatched=true;
  });
  if(!Array.isArray(out.plan.ledger)) out.plan.ledger=[];
  if(!out.plan.results || typeof out.plan.results!=='object' || Array.isArray(out.plan.results)) out.plan.results={};
  if(out.plan.ledger.length>LEDGER_LIMIT) out.plan.ledger=out.plan.ledger.slice(-LEDGER_LIMIT);
  if(!Array.isArray(out.lottery.prizes) || !out.lottery.prizes.length) out.lottery.prizes=clone(DEFAULT_PRIZES);
  /* 旧存档 / 导入的备份里概率可能超过 100%，加载时收敛，
     否则转盘会把扇区重新归一化铺满整圈，看起来全是奖却抽不了。 */
  let pacc=0;
  out.lottery.prizes.forEach((p,i)=>{
    if(!p || typeof p!=='object'){
      out.lottery.prizes[i]={id:'p'+(i+1),name:'奖项'+(i+1),prob:0,autoRedeem:false}; return;
    }
    if(!p.id) p.id='p'+(i+1);
    p.name=String(p.name||('奖项'+(i+1))).slice(0,40);
    const v=Math.max(0,Math.min(100,Number(p.prob)||0));
    p.prob=Math.min(v,Math.max(0,100-pacc)); pacc+=p.prob;
    p.autoRedeem=!!p.autoRedeem;
  });
  if(!Array.isArray(out.lottery.log)) out.lottery.log=[];
  /* 老存档抽奖记录的一次性修复：早期版本只按奖品名匹配当前奖项表，名字对不上
     （家长改过奖项名/删过奖）就把真实中奖也标成已兑换，用户看到「一个也没迁移过来」。
     这里按奖品名重新判定：
       · 谢谢参与 / 未中奖 → 不冒成待兑换
       · 再抽一次 → 自动奖，抽到即生效
       · 命中当前奖项表 → 按该奖的 autoRedeem 定状态
       · 其余真实中奖（奖项表已改名/删除）→ 恢复为待兑换，仍用原奖品名显示
     legacyPrizeFix 保证只跑一次，用户之后手动标记兑换不会被下次加载重置。 */
  if(!out.lottery.legacyPrizeFix){
    const noWin=/^(谢谢参与|未中奖)$/, autoWin=/^(再抽一次)$/;
    out.lottery.log.forEach(x=>{
      if(!x || typeof x!=='object') return;
      const name=String(x.prize||'').trim();
      const hit=name?(out.lottery.prizes||[]).find(p=>p && String(p.name||'').trim()===name):null;
      if(!name || noWin.test(name)){
        x.autoRedeem=true; x.redeemed=true;
      }else if(autoWin.test(name)){
        x.autoRedeem=true; x.redeemed=true;
        if(hit) x.prizeId=hit.id;
      }else if(hit){
        x.prizeId=hit.id;
        x.autoRedeem=!!hit.autoRedeem;
        x.redeemed=!!hit.autoRedeem;
      }else{
        x.prizeId=typeof x.prizeId==='string'?x.prizeId:'';
        x.autoRedeem=false; x.redeemed=false;
      }
    });
    out.lottery.legacyPrizeFix=true;
  }
  out.lottery.log.forEach(x=>{
    if(!x || typeof x!=='object') return;
    if(typeof x.autoRedeem!=='boolean') x.autoRedeem=true;
    if(typeof x.redeemed!=='boolean') x.redeemed=true;
    if(!Number.isFinite(Number(x.t))) x.t=Date.now();
  });
  /* 自然拼读进度：每课 best 星级、答对/尝试次数，独立命名空间、旧存档自动补齐 */
  if(!out.phonics || typeof out.phonics!=='object' || Array.isArray(out.phonics))
    out.phonics=clone(DEFAULT_PHONICS);
  out.phonics.done=(out.phonics.done && typeof out.phonics.done==='object' && !Array.isArray(out.phonics.done))
    ?out.phonics.done:{};
  out.phonics.correct=Math.max(0,Math.round(Number(out.phonics.correct)||0));
  out.phonics.attempted=Math.max(0,Math.round(Number(out.phonics.attempted)||0));
  Object.keys(out.phonics.done).forEach(k=>{
    const v=out.phonics.done[k]||{};
    out.phonics.done[k]={best:Math.max(0,Math.min(3,Math.round(Number(v.best)||0))),
      right:Math.max(0,Math.round(Number(v.right)||0))};
  });
  /* 教材单词拼读进度：键为单元 id 或拼读组 id，与内置课程分开存放 */
  out.phonics.textbookDone=(out.phonics.textbookDone && typeof out.phonics.textbookDone==='object' &&
    !Array.isArray(out.phonics.textbookDone))?out.phonics.textbookDone:{};
  Object.keys(out.phonics.textbookDone).forEach(k=>{
    const v=out.phonics.textbookDone[k]||{};
    out.phonics.textbookDone[k]={best:Math.max(0,Math.min(3,Math.round(Number(v.best)||0))),
      right:Math.max(0,Math.round(Number(v.right)||0)),
      name:String(v.name||'').slice(0,60)};
  });
  if(out.lottery.log.length>LOTTERY_LOG_LIMIT) out.lottery.log=out.lottery.log.slice(-LOTTERY_LOG_LIMIT);
  /* 打字得分转换：允许 0（纯娱乐不积分）～ 99；默认 1。 */
  out.lottery.typingPoints=Math.max(0,Math.min(99,Math.round(Number(out.lottery.typingPoints)||0)));
  /* 每天抽奖上限：1～10 次，默认 3。 */
  out.lottery.dailyLimit=Math.max(1,Math.min(10,Math.round(Number(out.lottery.dailyLimit)||3)));
  /* 当天抽奖计数：跨天自动清零；字段缺失/类型错误都回退到干净计数。 */
  const dl=out.lottery.daily;
  out.lottery.daily=(dl && typeof dl==='object' && !Array.isArray(dl) && typeof dl.date==='string')?{
    date:dl.date, draws:Math.max(0,Math.round(Number(dl.draws)||0)),
    won:!!dl.won, afterWin:Math.max(0,Math.round(Number(dl.afterWin)||0))
  }:clone(DEFAULT_LOTTERY.daily);
  if(out.session && typeof out.session!=='object') out.session=null;
  out.parent=Object.assign({},DEFAULT_PARENT,
    (s.parent&&typeof s.parent==='object')?s.parent:{});
  if(typeof out.parent.salt!=='string' || !out.parent.salt) out.parent.salt=DEFAULT_PARENT.salt;
  out.parent.changed=!!out.parent.changed;
  if(typeof out.parent.hash!=='string' || !/^[0-9a-f]{32}$/i.test(out.parent.hash))
    out.parent.hash=hashPassword(INITIAL_PARENT_PASSWORD,out.parent.salt);
  const st=out.settings;
  /* 英美口音：影响朗读 voice 和拼读音节/音素校订（数据源 soundwhy.com） */
  if(st.accent!=='us') st.accent='uk';
  /* 语法成分标注默认关闭；老存档缺字段时不会突然打开 */
  st.showGrammar=!!st.showGrammar;
  st.wordGap=Math.max(10,Math.min(44,Number(st.wordGap)||22));
  st.speakDelayMs=Math.max(0,Math.min(600,Number(st.speakDelayMs)||0));
  st.revealLetters=Math.max(0,Math.min(3,Number(st.revealLetters)||0));
  /* 字母块顺序：auto=不熟时顺序提示、掌握后打乱；老存档默认 auto */
  if(['auto','ordered','shuffle'].indexOf(st.wordLetterOrder)<0) st.wordLetterOrder='auto';
  if(!DIFFICULTY[st.difficulty]) st.difficulty='normal';
  if(st.timerMode!=='countdown') st.timerMode='count';
  /* 个人最快用时：旧存档没有这个命名空间，补齐为空对象；
     非法条目直接丢弃，避免记录页出现 NaN 或负数。 */
  if(!out.bestTimes || typeof out.bestTimes!=='object' || Array.isArray(out.bestTimes)) out.bestTimes={};
  Object.keys(out.bestTimes).forEach(function(k){
    const b=out.bestTimes[k];
    if(!b || !Number.isFinite(Number(b.ms)) || Number(b.ms)<=0) delete out.bestTimes[k];
    else { b.ms=Number(b.ms); b.breaks=Math.max(0,Number(b.breaks)||0); }
  });
  normalizeProfiles(out);
  return out;
}

/* ---------------- 多孩子档案 ----------------
   设计：运行时的顶层字段永远是「当前档案」的数据，7000 行业务代码零改动。
   state.profiles 只保存档案名册 + 其余档案的完整快照；切换时把当前顶层字段
   存回快照、再把目标档案铺回顶层。这样备份 / SQLite / IndexedDB 只要序列化
   整个 state，就天然带上所有孩子的进度，不需要改任何存储格式。
   共享字段（家长锁、教材包、计划/奖项规则）不进快照，切换时保持当前值。 */
function profileId(){
  return 'p'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
}
function profileBlank(id,name){
  return {id:id,name:name,createdAt:Date.now(),updatedAt:Date.now(),color:0};
}
/* 老存档 / 全新安装：把当前整份数据收进第一个档案，之后一切以档案为准。
   只在当前档案缺快照时补一份，绝不覆盖用户已有的切换现场。 */
function normalizeProfiles(out){
  let ps=out.profiles;
  if(!ps || typeof ps!=='object' || Array.isArray(ps)){
    ps=out.profiles={activeId:'',list:[],data:{}};
  }
  if(typeof ps.activeId!=='string') ps.activeId='';
  if(!Array.isArray(ps.list)) ps.list=[];
  if(!ps.data || typeof ps.data!=='object' || Array.isArray(ps.data)) ps.data={};
  ps.list=ps.list.filter(function(p){ return p && typeof p==='object' && typeof p.id==='string' && p.id; })
    .map(function(p){
      return {id:p.id,name:String(p.name||'孩子').slice(0,16),
        createdAt:Number(p.createdAt)||Date.now(),updatedAt:Number(p.updatedAt)||Date.now(),
        color:Math.max(0,Math.min(5,Math.round(Number(p.color)||0)))};
    });
  const ids={}; ps.list.forEach(function(p){ ids[p.id]=1; });
  Object.keys(ps.data).forEach(function(k){ if(!ids[k]) delete ps.data[k]; });
  if(!ps.list.length){
    const first=profileBlank(profileId(),PROFILE_DEFAULT_NAME);
    ps.list.push(first); ps.activeId=first.id;
  }
  if(!ids[ps.activeId]) ps.activeId=ps.list[0].id;
  if(!ps.data[ps.activeId] || typeof ps.data[ps.activeId]!=='object'){
    ps.data[ps.activeId]=profilePickChild(out);
  }
}
function profilePickChild(src){
  const snap={};
  PROFILE_FIELDS.forEach(function(k){ if(src[k]!==undefined) snap[k]=clone(src[k]); });
  snap.plan={}; PROFILE_PLAN_CHILD.forEach(function(k){ snap.plan[k]=clone(src.plan?src.plan[k]:undefined); });
  snap.lottery={}; PROFILE_LOTTERY_CHILD.forEach(function(k){ snap.lottery[k]=clone(src.lottery?src.lottery[k]:undefined); });
  return snap;
}
function profileMergeChild(snap,target){
  PROFILE_FIELDS.forEach(function(k){ if(snap[k]!==undefined) target[k]=clone(snap[k]); });
  if(snap.plan) PROFILE_PLAN_CHILD.forEach(function(k){
    if(snap.plan[k]!==undefined) target.plan[k]=clone(snap.plan[k]);
  });
  if(snap.lottery) PROFILE_LOTTERY_CHILD.forEach(function(k){
    if(snap.lottery[k]!==undefined) target.lottery[k]=clone(snap.lottery[k]);
  });
}
/* 把当前顶层字段存入当前档案快照（切换 / 建删档案前调用）。 */
function profileStoreCurrent(){
  if(typeof state==='undefined' || !state.profiles) return;
  const id=state.profiles.activeId;
  state.profiles.data[id]=profilePickChild(state);
  const cur=state.profiles.list.find(function(p){ return p.id===id; });
  if(cur) cur.updatedAt=Date.now();
}
/* 把目标档案的快照铺回顶层；共享字段（教材包 / 家长密码 / 规则）保持当前值。 */
function profileApply(id){
  if(typeof state==='undefined' || !state.profiles) return false;
  const ps=state.profiles;
  if(!ps.list.some(function(p){ return p.id===id; })) return false;
  profileStoreCurrent();
  const snap=ps.data[id]||{};
  /* 以干净档案为底，注入当前共享配置，再合并目标孩子的数据；
     normalizeState 保证新档案缺字段时也有完整默认结构。 */
  const next=normalizeState(clone(DEFAULT_STATE));
  PROFILE_SHARED_FIELDS.forEach(function(k){ next[k]=clone(state[k]); });
  PROFILE_PLAN_SHARED.forEach(function(k){ next.plan[k]=clone(state.plan[k]); });
  PROFILE_LOTTERY_SHARED.forEach(function(k){ next.lottery[k]=clone(state.lottery[k]); });
  profileMergeChild(snap,next);
  next.profiles=ps;
  ps.activeId=id;
  Object.keys(state).forEach(function(k){ delete state[k]; });
  Object.keys(next).forEach(function(k){ state[k]=next[k]; });
  return true;
}
function profileActive(){
  if(typeof state==='undefined' || !state.profiles) return null;
  return state.profiles.list.find(function(p){ return p.id===state.profiles.activeId; })||null;
}
function profileList(){ return (typeof state!=='undefined' && state.profiles)?state.profiles.list:[]; }
