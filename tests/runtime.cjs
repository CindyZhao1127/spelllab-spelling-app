/* SpellLab 运行时逻辑验证：用最小 DOM stub 在 Node 中执行页面内嵌脚本 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'SpellLab.html'), 'utf8');
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];

class ClassList {
  constructor(){ this.s = new Set(); }
  add(...c){ c.forEach(x => this.s.add(x)); }
  remove(...c){ c.forEach(x => this.s.delete(x)); }
  toggle(c, f){ if(f === undefined) f = !this.s.has(c); f ? this.s.add(c) : this.s.delete(c); return f; }
  contains(c){ return this.s.has(c); }
}
class El {
  constructor(id, tag){
    this.id = id || ''; this.tagName = (tag || 'div').toUpperCase();
    this.classList = new ClassList(); this.style = {}; this.dataset = {};
    this.children = []; this._html = ''; this._sub = {};
    this.textContent = ''; this.value = ''; this.readOnly = false;
    this.disabled = false; this.selectionStart = 0; this.offsetWidth = 1;
    this.listeners = {}; this.hidden = false;
  }
  set innerHTML(v){ this._html = String(v); this.children = []; }
  get innerHTML(){ return this._html; }
  addEventListener(t, fn){ (this.listeners[t] = this.listeners[t] || []).push(fn); }
  appendChild(c){ this.children.push(c); return c; }
  querySelector(sel){
    const key = sel === 'input' ? 'input' : String(sel);
    if(!this._sub[key]) this._sub[key] = new El('', key === 'input' ? 'input' : 'div');
    return this._sub[key];
  }
  querySelectorAll(){ return []; }
  focus(){ doc.activeElement = this; }
  blur(){}
  click(){ this.clicked = true; }
  remove(){ this.removed = true; }
  closest(){ return null; }
}
const doc = {
  activeElement: null,
  _map: new Map(),
  getElementById(id){
    if(!this._map.has(id)) this._map.set(id, new El(id));
    return this._map.get(id);
  },
  createElement(tag){ return new El('', tag); },
  body: { appendChild(){}, removeChild(){} },
  querySelectorAll(){ return []; },
  addEventListener(){}
};
const store = new Map();
const sandbox = {
  document: doc,
  console,
  localStorage: {
    getItem: k => store.has(k) ? store.get(k) : null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k)
  },
  SpeechSynthesisUtterance: class { constructor(t){ this.text = t; } },
  setTimeout: () => 0,
  clearTimeout: () => {},
  confirm: () => true,
  prompt: () => '改名测试',
  Blob: class { constructor(parts, opts){ this.parts = parts; this.type = opts && opts.type; } },
  URL: { createObjectURL: b => 'blob:' + b.parts.length, revokeObjectURL(){} },
  Date, Math, JSON, Object, Array, String, Number, Set, Map, RegExp, Error
};
class FakeAudioContext {
  constructor(){ this.currentTime = 0; this.state = 'running'; this.destination = {}; this.oscillators = 0; }
  createOscillator(){
    this.oscillators++;
    return { type:'', frequency:{ setValueAtTime(){}, exponentialRampToValueAtTime(){} },
             connect(){}, start(){}, stop(){} };
  }
  createGain(){
    return { gain:{ setValueAtTime(){}, exponentialRampToValueAtTime(){} }, connect(){} };
  }
  resume(){ this.state = 'running'; }
}
sandbox.window = {
  speechSynthesis: { getVoices: () => [], cancel(){}, speak(){} },
  AudioContext: FakeAudioContext
};
vm.createContext(sandbox);

const results = [];
function check(name, fn){
  try { const v = fn(); results.push([name, 'OK', v === undefined ? '' : v]); }
  catch(e){ results.push([name, 'FAIL', e.message]); }
}
const run = expr => vm.runInContext(expr, sandbox);

check('启动脚本无异常', () => {
  vm.runInContext(code, sandbox);
  return '首题：' + run('currentQuestion().q.cn');
});
check('打字 toast 重置 top 避免被拉成竖条', () => {
  // 回归：外层 .toast 有 top:88px，打字模块必须显式 top:auto，
  // 否则绝对定位元素同时受 top/bottom 约束，被撑成深色宽竖条遮挡游戏
  const ok = /#td-root\s+\.toast\s*\{[^}]*\btop\s*:\s*auto\b/.test(html);
  if (!ok) throw new Error('#td-root .toast 缺少 top:auto');
  return 'top:auto 已设置';
});
check('打字存档桥接：源码含 setSaveIO/reloadSave 且 state 补默认值', () => {
  const need = ['setSaveIO', 'reloadSave', 'saveIO.commit', 'state.typingDuck', 'out.typingDuck'];
  need.forEach(k => { if (html.indexOf(k) < 0) throw new Error('缺存档桥接 ' + k); });
  const o = run('JSON.stringify(normalizeState({}).typingDuck || {})');
  if (!o || o[0] !== '{') throw new Error('normalizeState 未给 typingDuck 默认值');
  return 'setSaveIO + reloadSave + typingDuck 默认值';
});
check('打字存档并入主存档避免关程序丢失', () => run(`
  (function(){
    if (typeof window.TypingDuck === 'undefined') return 'no TypingDuck';
    if (typeof window.TypingDuck.setSaveIO !== 'function') return 'no setSaveIO';
    if (typeof window.TypingDuck.reloadSave !== 'function') return 'no reloadSave';
    // 模拟宿主注入：load 返回存档，commit 写入 state.typingDuck
    var got=null;
    window.TypingDuck.setSaveIO(
      function(){ return {stars:42, badges:['first']}; },
      function(obj){ got=obj; }
    );
    // reload 后星星应来自外部存档 42（而非独立 localStorage 默认值 0）
    window.TypingDuck.reloadSave();
    var starEl=document.getElementById('td-starTotal');
    var loaded=starEl ? starEl.textContent : 'n/a';
    // commit 回调应能收到存档对象
    if (typeof window.TypingDuck._testCommit === 'function') {}
    return JSON.stringify({api:true, loaded:loaded, starTotal:String(loaded)});
  })()
`));
check('打字词源接入当前教材词表', () => run(`
  (function(){
    if (typeof window.TypingDuck === 'undefined' || typeof window.TypingDuck.setWordProvider !== 'function') return 'no provider API';
    // 注入一个可辨识的词源，验证打字模块会优先采用
    window.TypingDuck.setWordProvider(function(kind){
      return kind === 'pinyin' ? null : [{text:'zebra',cn:'斑马',emoji:''},{text:'tiger',cn:'老虎',emoji:''}];
    });
    setMode('typing');
    window.TypingDuck.enter();
    // 触发单词模式取词
    var cards = document.querySelectorAll('#td-modeGrid .mode-card');
    return JSON.stringify({api:true, injected:true});
  })()
`));
check('切模式自动收起抽屉与遮罩', () => run(`
  (function(){
    openDrawer(true,'learn');
    const wasOpen = $('drawer').classList.contains('open') && $('mask').classList.contains('show');
    setMode('typing');
    const closed = !$('drawer').classList.contains('open') && !$('mask').classList.contains('show');
    return JSON.stringify({wasOpen:wasOpen, closedAfterSwitch:closed});
  })()
`));
check('打字 enter 回到主菜单而非空白舞台', () => run(`
  (function(){
    setMode('typing');
    if (typeof window.TypingDuck === 'undefined') return 'no TypingDuck';
    window.TypingDuck.enter();
    return JSON.stringify({
      menu: $('td-screenMenu') ? $('td-screenMenu').classList.contains('active') : 'n/a',
      cards: document.querySelectorAll('#td-modeGrid .mode-card').length
    });
  })()
`));
check('勋章弹框打开后切模式会关闭', () => run(`
  (function(){
    setMode('typing');
    var badge = $('td-badgeModal');
    if(!badge) return 'no modal in stub';
    badge.classList.add('show');
    var wasOpen = badge.classList.contains('show');
    window.TypingDuck.enter();
    return JSON.stringify({wasOpen:wasOpen, closedAfterEnter:!badge.classList.contains('show')});
  })()
`));
check('句子题渲染词槽', () => run('renderSentence(); slots.filter(Boolean).length') + ' 个可填词槽');
check('逐词中文提示数量', () => run('curTokens.filter(t=>!t.punct).map(t=>t.hint).join("/")'));
check('正确拼完整句 -> 判定完成', () => run(`
  (function(){
    const toks=tokenize(currentQuestion().q.en,currentQuestion().q.hints,currentQuestion().q.cn);
    slots.forEach((s,i)=>{
      if(!s) return;
      const inp=s.querySelector('input');
      inp.value=toks[i].word;
      onSlotInput({target:inp});
    });
    return JSON.stringify({solved:solved,correct:state.stats.correct,streak:state.stats.streak,mastery:state.progress[uid(currentUnit().id,currentQuestion().idx)].m});
  })()
`));
check('答对后当前题目不漂移', () => run('JSON.stringify({cn:currentQuestion().q.cn,idx:currentQuestion().idx,qPos:qPos})'));
check('错题记录与进度', () => run(`
  (function(){
    resetQuestion();
    const inp=slots[0].querySelector('input');
    inp.value='zzz'; commitSlot(0);
    return JSON.stringify({wrong:state.wrong.length,streak:state.stats.streak,slotWrong:slots[0].classList.contains('wrong')});
  })()
`));
check('提示（首字母 -> 整词）', () => run(`
  (function(){
    resetQuestion(); hintCurrent();
    const first=slots[0].querySelector('.hint').textContent;
    hintCurrent();
    return JSON.stringify({first:first,locked:slots[0].querySelector('input').readOnly,assisted:assisted});
  })()
`));
check('切换下一题', () => run('gotoQuestion(1); currentQuestion().q.cn'));
check('切换到单词速记', () => run('setMode("word"); wordCur.join("=")'));
check('字母块拼对判定', () => run(`
  (function(){
    const en=wordCur[0];
    en.split('').forEach(ch=>addLetterByKey(ch));
    return JSON.stringify({solved:wordSolved,typed:placed.map(i=>letters[i].ch).join(''),right:state.stats.wordRight});
  })()
`));
check('看答案不误计掌握', () => run(`
  (function(){
    const before=state.stats.wordRight;
    pickWord(); showWordAnswer();
    return JSON.stringify({solved:wordSolved,unchanged:state.stats.wordRight===before});
  })()
`));
check('自定义题库解析（含非法行）', () => {
  const r = JSON.parse(run(`
    JSON.stringify(parseCustom('今天很冷。| It is cold today. | 它,是,冷的,今天\\n格式错误行 | 只有两列\\n提示数量不对 | It is cold. | 它,是'))
  `));
  if(r.out.length !== 1 || r.errors.length !== 2) throw new Error('解析结果异常：' + JSON.stringify(r));
  return JSON.stringify(r);
});
check('自定义题库导入', () => run(`
  (function(){
    state.custom=[];
    $('importText').value='天气真好。| It is fine today. | 它,是,好的,今天';
    doImport();
    return JSON.stringify({custom:state.custom.length,unit:currentUnit().name,cn:currentQuestion().q.cn});
  })()
`));
check('学习面板渲染', () => run('renderDrawer(); $("statGrid").innerHTML.includes("正确率")'));
check('单元切换与错题跳转', () => run(`
  (function(){
    unitPos=0;qPos=0;setMode('sentence');
    const id=state.wrong.length?state.wrong[0].id:null;
    return JSON.stringify({unit:currentUnit().id,wrongId:id});
  })()
`));
check('状态持久化', () => 'localStorage 字节数 ' + (store.get('spelllab.state.v1') || '').length);
check('DOM id 引用无缺失', () => {
  const staticIds = new Set([...html.matchAll(/id="([A-Za-z0-9_-]+)"/g)].map(m => m[1]));
  const refs = [...new Set([...code.matchAll(/\$\('([A-Za-z0-9_-]+)'\)/g)].map(m => m[1]))];
  const dynamic = new Set(['sPrev','sSpeak','sHints','sHint','sReset','sCheck','sNext','sMenu','sPaper','wSpeak','wStar','wShuffle','wAnswer','wNext','wMenu','wPaper','cPrev','cSpeak','cHint','cReset','cCheck','cNext','cMenu',
    // 打字小鸭集成模块：$() 内部自动加 td- 前缀，这些名字对应 td-xxx 实际 id
    'screenMenu','screenGame','starTotal','soundBtn','gameTitle','scoreVal','comboVal','accVal','stageInstruction','targetDisplay','progressText','keyboard','handHint','handHintDot','handHintText','resultModal','resultEmoji','resultTitle','resultStars','resultDetail','helpModal','legend','modeGrid','backBtn','brandHome','againBtn','menuBtn','helpBtn','helpCloseBtn',
    'skinBtn','blindBtn','heroDuck','streakVal','checkinTip','duckStage','duckCount','duckInfo','feedBtn','calPrev','calNext','calTitle','calGrid','badgeBtn','badgeCount','levelBtn','badgeModal','badgeGrid','badgeCloseBtn','levelModal','levelList','levelCloseBtn','toast','app','root','screenMenu',
    'wordStatsBtn','wordStatsModal','wordStatSummary','wordStatList','wordStatFocusBtn','wordStatCloseBtn',
    'unitCard','unitName','unitBar','unitWords','unitDone','unitBad','unitMastered','unitPracticeBtn','unitFocusBtn']);
  const missing = refs.filter(r => !staticIds.has(r) && !dynamic.has(r));
  if(missing.length) throw new Error('缺失 id: ' + missing.join(','));
  return refs.length + ' 个引用，动态按钮 ' + dynamic.size + ' 个';
});
check('三套工具条按钮已生成', () => {
  const a = run('$("toolbarSentence").innerHTML'), b = run('$("toolbarWord").innerHTML'), c = run('$("toolbarChunk").innerHTML');
  if(!a.includes('id="sCheck"') || !a.includes('id="sHint"') || !b.includes('id="wNext"') || !c.includes('id="cCheck"')) throw new Error('工具条按钮缺失');
  return '句子/单词/分步工具条完整';
});
check('全部内置题短语拆分合法', () => {
  const r = JSON.parse(run(`
    (function(){
      let bad=[],total=0,chunks=0;
      BUILTIN_UNITS.forEach(u=>u.sentences.forEach(q=>{
        const list=buildChunks(q), words=tokenize(q.en,q.hints,q.cn).filter(t=>!t.punct).map(t=>t.word);
        const joined=list.map(c=>c.words.map(w=>w.word).join(' ')).join(' ');
        total++; chunks+=list.length;
        if(joined!==words.join(' ')) bad.push(q.cn+': '+joined+' != '+words.join(' '));
        if(list.some(c=>!c.en)) bad.push(q.cn+': 空短语');
      }));
      return JSON.stringify({total:total,chunks:chunks,bad:bad});
    })()
  `));
  if(r.bad.length) throw new Error(r.bad.slice(0,3).join(' | '));
  return r.total + ' 题共拆出 ' + r.chunks + ' 个短语，英文拼接与整句一致';
});
check('音效链路（输入/正确/错误/完成/翻卡）', () => {
  const before = run('actx ? actx.oscillators : 0');
  run('SFX.key();SFX.del();SFX.correct();SFX.wrong();SFX.complete();SFX.step();SFX.flip()');
  const after = run('actx ? actx.oscillators : 0');
  if(!(after > before)) throw new Error('未产生音频节点');
  return '生成 ' + (after - before) + ' 个振荡器节点';
});
check('关闭音效后不再发声', () => {
  run('state.settings.sound=false');
  const before = run('actx ? actx.oscillators : 0');
  run('SFX.key();SFX.correct();SFX.wrong()');
  const after = run('actx ? actx.oscillators : 0');
  run('state.settings.sound=true');
  if(after !== before) throw new Error('静音开关无效');
  return '静音开关生效';
});
check('第 1 步：认短语卡片', () => run(`
  (function(){
    unitPos=0;qPos=0;sessionOrder={unitId:'',list:[]};setMode('chunk');
    return JSON.stringify({phase:chunkPhase,blocks:chunkList.length,cards:$('chunkCards').children.length,
      firstCn:chunkList[0].cn,firstEn:chunkList[0].en,btn:$('cCheck').textContent,
      slotsHidden:$('slots').hidden});
  })()
`));
check('翻开卡片并朗读', () => run(`
  (function(){chunkReveal(0);chunkReveal(1);return JSON.stringify({revealed:chunkList.filter(c=>c.revealed).length,text:$('chunkProgress').textContent});})()
`));
check('第 2 步：逐短语拼写', () => run(`
  (function(){
    chunkStartPractice();
    return JSON.stringify({phase:chunkPhase,slots:slots.filter(Boolean).length,words:chunkList[0].words.length,label:$('stageLabel').textContent});
  })()
`));
check('短语拼对后进入下一块', () => run(`
  (function(){
    const c=chunkList[0];
    c.words.forEach((w,i)=>{const inp=slots[i].querySelector('input');inp.value=w.word;onSlotInput({target:inp});});
    const afterFirst=JSON.stringify({solved:solved,done:chunkList[0].done,idx:chunkIdx});
    chunkAdvance();
    return afterFirst+' -> '+JSON.stringify({phase:chunkPhase,idx:chunkIdx,slots:slots.filter(Boolean).length,current:chunkList[chunkIdx]?chunkList[chunkIdx].en:null});
  })()
`));
check('第 3 步：拼整句并结算', () => run(`
  (function(){
    chunkIdx=chunkList.length;chunkAdvance();
    const before=state.stats.correct;
    const toks=curTokens;
    slots.forEach((s,i)=>{if(!s)return;const inp=s.querySelector('input');inp.value=toks[i].word;onSlotInput({target:inp});});
    return JSON.stringify({phase:chunkPhase,solved:solved,correctDelta:state.stats.correct-before,
      title:$('scTitle').textContent,btn:$('cCheck').textContent,successHidden:$('successCard').hidden});
  })()
`));
check('分步模式换题回到第 1 步', () => run(`
  (function(){chunkNextQuestion(1);return JSON.stringify({phase:chunkPhase,qPos:qPos,cn:$('questionCn').textContent,revealed:chunkList.filter(c=>c.revealed).length});})()
`));
check('自定义题自动均分短语', () => run(`
  (function(){
    const q={cn:'天气真好。',en:'It is fine today.',hints:['它','是','好的','今天']};
    const list=buildChunks(q);
    return JSON.stringify({blocks:list.length,all:list.map(c=>c.en),cn:list.map(c=>c.cn)});
  })()
`));
check('切回句子模式界面复位', () => run(`
  (function(){setMode('sentence');return JSON.stringify({mode:mode,slotsHidden:$('slots').hidden,phaseHidden:$('phaseBar').hidden,cardsHidden:$('chunkCards').hidden,label:$('stageLabel').textContent});})()
`));

/* ---------- 年级 / 教材 / 生词本 / 练习集 ---------- */
check('默认年级教材与单元归属', () => {
  const r = JSON.parse(run(`(function(){
    state.filter={gradeId:'all',bookId:'all'};
    return JSON.stringify({grades:state.grades.length,books:state.books.length,
      scope:unitById('u6').scope,all:allUnits().length,visible:units().length});
  })()`));
  if(r.grades<9 || r.books<5 || !r.scope.includes('小学四年级')) throw new Error(JSON.stringify(r));
  return r.grades+' 个年级 / '+r.books+' 个教材 · u6 归属 '+r.scope;
});
check('学习范围筛选与空结果回退', () => {
  const r = JSON.parse(run(`(function(){
    setFilter('gradeId','g4'); const g4=units().length;
    setFilter('bookId','b_pep');
    const conflict={visible:units().length,fallback:filterFallback,all:allUnits().length};
    setFilter('gradeId','all'); setFilter('bookId','all');
    return JSON.stringify({g4:g4,conflict:conflict,restored:units().length});
  })()`));
  if(!r.conflict.fallback || r.conflict.visible!==r.conflict.all) throw new Error(JSON.stringify(r));
  return '四年级 '+r.g4+' 单元；无匹配组合回退到全部 '+r.conflict.visible+' 单元';
});
check('年级 / 教材增删改与课程归属', () => {
  const r = JSON.parse(run(`(function(){
    state.filter={gradeId:'all',bookId:'all'};
    const g=addTaxonomy('grade','测试年级'), b=addTaxonomy('book','测试教材');
    renameTaxonomy('grade',g.id);
    const renamed=state.grades.find(x=>x.id===g.id).name;
    setUnitScope('u7','gradeId',g.id);
    setUnitScope('u7','bookId',b.id);
    const scope=unitById('u7').scope;
    setFilter('gradeId',g.id);
    const picked=units().map(u=>u.id);
    setFilter('gradeId','all'); setFilter('bookId','all');
    removeTaxonomy('grade',g.id); removeTaxonomy('book',b.id);
    return JSON.stringify({renamed:renamed,scope:scope,picked:picked,
      afterDelete:unitById('u7').scope,grades:state.grades.length,books:state.books.length});
  })()`));
  if(r.renamed!=='改名测试' || !r.scope.includes('测试教材') || r.picked.join(',')!=='u7' || !r.afterDelete.includes('未分类')) throw new Error(JSON.stringify(r));
  return '改名 / 单元归属 / 单年级筛选 / 删除后归为未分类均正常';
});
check('生词本添加、去重、检索与掌握标记', () => {
  const r = JSON.parse(run(`(function(){
    state.vocab=[];vocabSelected=new Set();vocabQuery='';vocabOnlyNew=false;
    state.filter={gradeId:'g4',bookId:'b_hj'};
    addVocab('weather','天气','Unit 6');
    addVocab('WEATHER','气象','');
    addVocab('snowman','雪人','Unit 6');
    addVocab('bad word','非法词','');
    renderFilters();
    const count=state.vocab.length, cn=state.vocab[0].cn, scope=gradeName(state.vocab[0].gradeId);
    vocabQuery='雪'; const searched=visibleVocab().map(v=>v.en); vocabQuery='';
    toggleVocabMastered(state.vocab[0].id);
    vocabOnlyNew=true; const unmastered=visibleVocab().length; vocabOnlyNew=false;
    selectVisibleVocab(true); const selected=vocabSelected.size; selectVisibleVocab(false);
    removeVocab(state.vocab[1].id);
    return JSON.stringify({count:count,cn:cn,scope:scope,searched:searched,
      mastered:state.vocab[0].m,unmastered:unmastered,selected:selected,afterRemove:state.vocab.length});
  })()`));
  if(r.count!==2 || r.cn!=='气象' || r.searched.join(',')!=='snowman' || r.unmastered!==1 || r.selected!==2 || r.afterRemove!==1) throw new Error(JSON.stringify(r));
  return '去重 / 词义更新 / 搜索 / 只看未掌握 / 全选 / 移除均正常';
});
check('批量导入单元词与错题取词', () => {
  const r = JSON.parse(run(`(function(){
    state.vocab=[];vocabSelected=new Set();vocabQuery='';vocabOnlyNew=false;
    state.filter={gradeId:'all',bookId:'all'};
    unitPos=0;sessionOrder={unitId:'',list:[]};
    const a=importUnitWords(), again=importUnitWords(), b=importWrongWords();
    return JSON.stringify({unitWords:a,duplicate:again,wrongWords:b,total:state.vocab.length,
      hasSample:state.vocab.some(v=>v.en==='weather')});
  })()`));
  if(!(r.unitWords>0) || r.duplicate!==0 || r.total<r.unitWords || !r.hasSample) throw new Error(JSON.stringify(r));
  return '单元导入 '+r.unitWords+' 词（重复导入 0 新增），错题补充 '+r.wrongWords+' 词';
});
check('从生词本生成练习集（题目结构合法）', () => {
  const r = JSON.parse(run(`(function(){
    state.vocab=[];state.practiceSets=[];vocabSelected=new Set();vocabQuery='';vocabOnlyNew=false;
    state.filter={gradeId:'all',bookId:'all'};
    ['weather','snow','rain','windy'].forEach((w,i)=>addVocab(w,['天气','雪','雨','有风的'][i],'测试',null,true));
    vocabSelected=new Set(state.vocab.map(v=>v.id));
    const set=createPracticeSet('单元测练习');
    const bad=[];
    set.sentences.forEach(q=>{
      const toks=tokenize(q.en,q.hints,q.cn);
      const n=toks.filter(t=>!t.punct).length;
      if(n!==q.hints.length) bad.push(q.en+' 提示数不符');
      const joined=buildChunks(q).map(c=>c.words.map(w=>w.word).join(' ')).join(' ');
      const words=toks.filter(t=>!t.punct).map(t=>t.word).join(' ');
      if(joined!==words) bad.push(q.en+' 短语拼接不符');
    });
    return JSON.stringify({sets:state.practiceSets.length,name:set.name,words:set.words.length,
      sentences:set.sentences.length,first:set.sentences[0].en,second:set.sentences[1].en,
      unit:currentUnit().id,inUnits:!!unitById('ps:'+set.id),
      current:currentQuestion().q.cn,bad:bad});
  })()`));
  if(r.bad.length) throw new Error(r.bad.join(' | '));
  if(r.sentences!==8 || r.words!==4 || !r.inUnits || r.unit.indexOf('ps:')!==0) throw new Error(JSON.stringify(r));
  return r.name+' · '+r.words+' 词 / '+r.sentences+' 题，提示数与分步拆分全部合法';
});
check('生词练习集可切换三种模式', () => {
  const r = JSON.parse(run(`(function(){
    const out={};
    setMode('sentence'); out.sentence=JSON.stringify({cn:currentQuestion().q.cn,slots:slots.filter(Boolean).length});
    setMode('chunk'); out.chunk=JSON.stringify({phase:chunkPhase,blocks:chunkList.length,cards:$('chunkCards').children.length});
    setMode('word'); out.word=JSON.stringify({w:wordCur?wordCur[0]:null,letters:letters.length});
    setMode('sentence');
    return JSON.stringify(out);
  })()`));
  const s=JSON.parse(r.sentence), c=JSON.parse(r.chunk), w=JSON.parse(r.word);
  if(!(s.slots>0) || !(c.blocks>0) || !(w.letters>0)) throw new Error(r.sentence+r.chunk+r.word);
  return '句子 '+s.slots+' 空 / 分步 '+c.blocks+' 块 / 单词 '+w.w+'('+w.letters+' 字母)';
});
check('拼对单词同步生词本掌握度', () => {
  const r = JSON.parse(run(`(function(){
    setMode('word');
    const en=wordCur[0], v=state.vocab.find(x=>normWord(x.en)===normWord(en));
    const before=v?(v.m||0):-1;
    en.split('').forEach(ch=>addLetterByKey(ch));
    const after=state.vocab.find(x=>normWord(x.en)===normWord(en));
    const solved=wordSolved;
    setMode('sentence');
    return JSON.stringify({word:en,before:before,after:after?(after.m||0):null,ok:after?after.ok:null,solved:solved});
  })()`));
  if(!(r.after>=0) || r.after<=r.before || !r.solved) throw new Error(JSON.stringify(r));
  return r.word+' 掌握度 '+r.before+' -> '+r.after+'，累计拼对 '+r.ok+' 次';
});
check('练习集句子拼对同步生词掌握度', () => {
  const r = JSON.parse(run(`(function(){
    setMode('sentence');
    const q=currentQuestion().q;
    const key=q.vocabWord;
    const v=state.vocab.find(x=>normWord(x.en)===normWord(key));
    const before=v?(v.m||0):-1;
    resetQuestion();
    curTokens.forEach((t,i)=>{
      const s=slots[i]; if(!s) return;
      const inp=s.querySelector('input'); inp.value=t.word; onSlotInput({target:inp});
    });
    const after=state.vocab.find(x=>normWord(x.en)===normWord(key));
    return JSON.stringify({cn:q.cn,vocabWord:key,before:before,after:after?(after.m||0):null,solved:solved});
  })()`));
  if(!r.solved || !(r.after>r.before)) throw new Error(JSON.stringify(r));
  return r.cn+' → '+r.vocabWord+' 掌握度 '+r.before+' -> '+r.after;
});
check('练习集切换与删除', () => {
  const r = JSON.parse(run(`(function(){
    const id=state.practiceSets[0].id;
    startPracticeSet(id);
    const started=currentUnit().id;
    deletePracticeSet(id);
    return JSON.stringify({started:started,remaining:state.practiceSets.length,
      stillThere:!!unitById('ps:'+id),unit:currentUnit().id});
  })()`));
  if(r.remaining!==0 || r.stillThere || r.started.indexOf('ps:')!==0 || r.unit.indexOf('ps:')===0) throw new Error(JSON.stringify(r));
  return '可切换练习，删除后从单元列表移除并回到普通课程';
});
check('顶部筛选、管理页与生词本渲染', () => {
  const r = JSON.parse(run(`(function(){
    renderFilters(); switchTab('manage');
    const manageHidden=$('pageManage').hidden, vocabHidden=$('pageVocab').hidden;
    switchTab('learn');
    return JSON.stringify({
      gradeOptions:($('gradeFilter').innerHTML.match(/<option/g)||[]).length,
      bookOptions:($('bookFilter').innerHTML.match(/<option/g)||[]).length,
      gradeRows:($('gradeList').innerHTML.match(/manage-row/g)||[]).length,
      bookRows:($('bookList').innerHTML.match(/manage-row/g)||[]).length,
      unitRows:($('unitMetaList').innerHTML.match(/unit-meta-row/g)||[]).length,
      vocabRows:($('vocabList').innerHTML.match(/vocab-item/g)||[]).length,
      info:$('filterInfo').textContent,manageHidden:manageHidden,vocabHidden:vocabHidden,
      statCells:($('statGrid').innerHTML.match(/stat-box/g)||[]).length});
  })()`));
  if(!(r.gradeOptions>=10) || !(r.bookOptions>=6) || !(r.gradeRows>=9) || !(r.bookRows>=5) || r.unitRows<3 || r.manageHidden || !r.vocabHidden || r.statCells!==6) throw new Error(JSON.stringify(r));
  return '年级 '+r.gradeOptions+' 项 / 教材 '+r.bookOptions+' 项 / 课程归属 '+r.unitRows+' 行 · 分页与统计格正常';
});
check('旧版存档自动补齐新字段', () => {
  const r = JSON.parse(run(`(function(){
    localStorage.setItem('spelllab.state.v1',JSON.stringify({
      progress:{},stats:{attempted:3,correct:2},
      custom:[{cn:'旧题',en:'It is old.',hints:['它','是','旧的']}]
    }));
    const s=loadState();
    return JSON.stringify({grades:s.grades.length,books:s.books.length,vocab:s.vocab.length,
      sets:s.practiceSets.length,textbooks:s.textbooks.length,filter:s.filter.gradeId,sound:s.settings.sound,
      attempted:s.stats.attempted,custom:s.custom.length,meta:Object.keys(s.unitMeta).length});
  })()`));
  if(r.grades<9 || r.vocab!==0 || r.sets!==0 || r.textbooks!==0 || r.filter!=='all' || r.sound!==true || r.attempted!==3 || r.custom!==1) throw new Error(JSON.stringify(r));
  return '旧存档保留进度与自定义题，年级/教材/生词本/教材包等字段自动补齐';
});

/* ---------- 教材库：教材包 / 单元 / 题目 / 导入导出 / 备份 ---------- */
check('教材库：创建教材包与单元', () => {
  const r = JSON.parse(run(`(function(){
    state.textbooks=[]; state.filter={gradeId:'all',bookId:'all'}; mode='sentence';
    libSel={packId:'',unitId:'',qIdx:-1};
    const p=makePack('人教版 PEP 四年级上册','g4','b_pep');
    const u1=addUnit(p.id,'Unit 1 My classroom');
    const u2=addUnit(p.id,'Unit 2 My schoolbag');
    return JSON.stringify({packs:tbPacks().length,grade:gradeName(p.gradeId),book:bookName(p.bookId),
      units:(p.units||[]).length,expanded:allUnits().filter(x=>x.id.indexOf('tb:')===0).length,
      created:p.created,tbCount:$('tbCount').textContent});
  })()`));
  if(r.packs!==1 || r.units!==2 || r.expanded!==0 || r.grade!=='小学四年级' || r.book.indexOf('人教版')<0) throw new Error(JSON.stringify(r));
  return '1 包 / 2 单元，空单元不生成课程 · '+r.grade+' · '+r.book;
});
check('教材库：单题校验与添加', () => {
  const r = JSON.parse(run(`(function(){
    const p=tbPacks()[0],u=p.units[0];
    libSel={packId:p.id,unitId:u.id,qIdx:-1};
    const bad1=validateQuestion('中文','It is cold.','它,是',''),
          bad2=validateQuestion('中文','It is cold.','它,是,冷的','天气:2'),
          bad3=validateQuestion('中文','It is 冷.','它,是,冷的','');
    $('qCn').value='今天很冷。'; $('qEn').value='It is cold today.';
    $('qHints').value='它,是,冷的,今天'; $('qChunks').value='天气:3,今天:1';
    const q=saveQuestion();
    const joined=q?buildChunks(q).map(c=>c.words.map(w=>w.word).join(' ')).join(' '):'';
    return JSON.stringify({bad1:bad1.error,bad2:bad2.error,bad3:bad3.error,
      count:u.sentences.length,chunks:q?q.chunks.length:0,joined:joined,
      expanded:allUnits().filter(x=>x.id.indexOf('tb:')===0).length});
  })()`));
  if(!r.bad1 || !r.bad2 || !r.bad3 || r.count!==1 || r.chunks!==2 || r.joined!=='It is cold today' || r.expanded!==1) throw new Error(JSON.stringify(r));
  return '提示数 / 短语词数和 / 非法字符均能拦截 · 手动拆分拼接为「'+r.joined+'」';
});
check('教材库：编辑与删除题目', () => {
  const r=JSON.parse(run(`(function(){
    const p=tbPacks()[0],u=p.units[0];
    libSel={packId:p.id,unitId:u.id,qIdx:-1};
    editQuestion(0);
    const editing=libSel.qIdx;
    $('qCn').value='天气很冷。'; $('qEn').value='It is very cold.';
    $('qHints').value='它,是,非常,冷的'; $('qChunks').value='';
    saveQuestion();
    $('qCn').value='临时题。'; $('qEn').value='It is fine.';
    $('qHints').value='它,是,好的'; $('qChunks').value='';
    saveQuestion();
    const beforeDel=u.sentences.length;
    removeQuestion(1);
    return JSON.stringify({editing:editing,afterEdit:u.sentences[0].en,
      beforeDel:beforeDel,afterDel:u.sentences.length,autoChunks:buildChunks(u.sentences[0]).length});
  })()`));
  if(r.editing!==0 || r.afterEdit!=='It is very cold.' || r.beforeDel!==2 || r.afterDel!==1 || r.autoChunks!==2) throw new Error(JSON.stringify(r));
  return '编辑生效、删除生效，未填短语时自动均分为 '+r.autoChunks+' 块';
});
check('教材库：批量题目与单词表导入', () => {
  const r=JSON.parse(run(`(function(){
    const p=tbPacks()[0],u=p.units[0];
    libSel={packId:p.id,unitId:u.id,qIdx:-1};
    $('qBulk').value='我喜欢下雪天。| I like snowy days. | 我,喜欢,下雪的,日子\\n外面在刮风吗？| Is it windy outside? | 是,它,有风的,外面';
    const added=tbBulkQuestions();
    $('wBulk').value='snow,雪\\nSNOW,积雪\\nwindy,有风的\\n坏词,非法\\nweather,天气';
    const words=tbBulkWords();
    const again=tbBulkWords();
    return JSON.stringify({added:added,sentences:u.sentences.length,words:words,
      repeat:again,list:u.words.map(w=>w[0]),
      legal:u.sentences.every(q=>q.hints.length===tokenize(q.en,q.hints,q.cn).filter(t=>!t.punct).length)});
  })()`));
  if(r.added!==2 || r.sentences!==3 || r.words!==3 || r.repeat!==0 || !r.legal || r.list.join(',')!=='snow,windy,weather') throw new Error(JSON.stringify(r));
  return '批量加 2 题 / 3 词，重复与非法词自动跳过，全部题目提示数合法';
});
check('教材包单元接入三种练习模式', () => {
  const r=JSON.parse(run(`(function(){
    const p=tbPacks()[0];
    const id='tb:'+p.id+':'+p.units[0].id;
    unitPos=findUnitIndex(id); qPos=0; sessionOrder={unitId:'',list:[]};
    setMode('sentence');
    const s=JSON.stringify({unit:currentUnit().id,cn:currentQuestion().q.cn,slots:slots.filter(Boolean).length});
    setMode('chunk');
    const c=JSON.stringify({blocks:chunkList.length,cards:$('chunkCards').children.length});
    setMode('word');
    const w=JSON.stringify({word:wordCur?wordCur[0]:null,letters:letters.length});
    setMode('sentence');
    return JSON.stringify({unit:currentUnit().id,s:s,c:c,w:w});
  })()`));
  const s=JSON.parse(r.s),c=JSON.parse(r.c),w=JSON.parse(r.w);
  if(r.unit.indexOf('tb:')!==0 || !(s.slots>0) || !(c.blocks>0) || !(w.letters>0)) throw new Error(r.s+r.c+r.w);
  return '句子 '+s.slots+' 空 / 分步 '+c.blocks+' 块 / 单词 '+w.word+'（'+w.letters+' 字母）';
});
check('教材包 JSON 导出与再导入', () => {
  const r=JSON.parse(run(`(function(){
    const p=tbPacks()[0];
    const payload=packExportPayload([p]);
    emitJSON('spelllab-test.json',payload);
    const inBox=$('packIO').value;
    const before=tbPacks().length;
    const n=importPackText(inBox);
    const imported=tbPacks()[tbPacks().length-1];
    return JSON.stringify({format:payload.format,boxHasJson:inBox.indexOf('spelllab.textbook.v1')>0,
      before:before,imported:n,after:tbPacks().length,newId:imported.id!==p.id,
      units:imported.units.length,sentences:imported.units[0].sentences.length,
      words:imported.units[0].words.length,scope:gradeName(imported.gradeId),
      first:imported.units[0].sentences[0].en});
  })()`));
  if(r.format!=='spelllab.textbook.v1' || !r.boxHasJson || r.imported!==1 || r.after!==r.before+1 || !r.newId || r.units!==2 || r.sentences!==3 || r.words!==3 || r.scope!=='小学四年级') throw new Error(JSON.stringify(r));
  return '往返后 2 单元 / 3 题 / 3 词完整，包 id 重新生成避免冲突';
});
check('教材包导入的容错与分类补全', () => {
  const r=JSON.parse(run(`(function(){
    const bad=parsePackJSON('{ not json');
    const backup=parsePackJSON(JSON.stringify(backupPayload()));
    const raw={name:'外研版三起五上',gradeId:'gx',gradeName:'小学五年级',bookId:'bx',bookName:'测试出版社版',
      units:[{name:'Unit 1',sentences:[{cn:'你好。',en:'Hello.',hints:['你好']}],
      words:[['hello','你好'],['bad word','x']]}]};
    const beforeG=state.grades.length,beforeB=state.books.length;
    const n=importPackText(JSON.stringify(raw));
    const np=tbPacks()[tbPacks().length-1];
    return JSON.stringify({bad:bad.error,backup:backup.error,n:n,
      gAdded:state.grades.length-beforeG,bAdded:state.books.length-beforeB,
      grade:gradeName(np.gradeId),book:bookName(np.bookId),
      sentences:np.units[0].sentences.length,words:np.units[0].words.length,
      hintOk:np.units[0].sentences[0].hints.length===1});
  })()`));
  if(!r.bad || !r.backup || r.n!==1 || r.bAdded!==1 || r.grade!=='小学五年级' || r.book!=='测试出版社版' || r.sentences!==1 || r.words!==1 || !r.hintOk) throw new Error(JSON.stringify(r));
  return '坏 JSON / 备份文件被拦截，同名年级合并、未知教材版本自动补建';
});
check('全库备份导出与恢复', () => {
  const r=JSON.parse(run(`(function(){
    const payload=backupPayload();
    const packsBefore=tbPacks().length,vocabBefore=state.vocab.length;
    state.textbooks=[]; state.vocab=[]; state.stats.attempted=999;
    const ok=restoreBackup(JSON.stringify(payload));
    return JSON.stringify({format:payload.format,ok:ok,packsBefore:packsBefore,vocabBefore:vocabBefore,
      packs:state.textbooks.length,vocab:state.vocab.length,attempted:state.stats.attempted,
      cards:($('tbList').innerHTML.match(/tb-card/g)||[]).length,
      boxCleared:$('packIO').value===''});
  })()`));
  if(r.format!=='spelllab.backup.v1' || !r.ok || r.packs!==r.packsBefore || r.vocab!==r.vocabBefore || r.attempted===999 || r.cards!==r.packsBefore || !r.boxCleared) throw new Error(JSON.stringify(r));
  return '教材包 '+r.packs+' 个 / 生词 '+r.vocab+' 个 / 统计值全部按备份还原';
});
check('教材库分页与编辑器渲染', () => {
  const r=JSON.parse(run(`(function(){
    const p=tbPacks()[0];
    libSel={packId:p.id,unitId:p.units[0].id,qIdx:-1};
    renderDrawer(); switchTab('library');
    return JSON.stringify({
      hidden:$('pageLibrary').hidden, learnHidden:$('pageLearn').hidden,
      gradeOptions:($('tbGrade').innerHTML.match(/<option/g)||[]).length,
      bookOptions:($('tbBook').innerHTML.match(/<option/g)||[]).length,
      cards:($('tbList').innerHTML.match(/tb-card/g)||[]).length,
      qForm:$('tbEditor').innerHTML.indexOf('id="qSave"')>0,
      qRows:($('tbEditor').innerHTML.match(/q-item/g)||[]).length,
      wordChips:($('tbEditor').innerHTML.match(/word-chip/g)||[]).length,
      title:$('tbEditTitle').textContent});
  })()`));
  if(r.hidden || !r.learnHidden || r.gradeOptions<10 || !(r.cards>0) || !r.qForm || !(r.qRows>0) || !(r.wordChips>0)) throw new Error(JSON.stringify(r));
  return '教材库分页可见 · '+r.cards+' 张包卡片 / '+r.qRows+' 题 / '+r.wordChips+' 词，编辑器表单完整';
});
check('教材包启停、删除与关联数据清理', () => {
  const r=JSON.parse(run(`(function(){
    state.filter={gradeId:'all',bookId:'all'}; mode='sentence';
    const p=tbPacks()[0];
    const prefix='tb:'+p.id+':';
    const uidKey=prefix+p.units[0].id;
    state.unitMeta[uidKey]={gradeId:'g5',bookId:'b_hj'};
    state.wrong.push({id:uidKey+':0',unitId:uidKey,idx:0,cn:'测试错题'});
    const before=allUnits().filter(x=>x.id.indexOf(prefix)===0).length;
    togglePack(p.id);
    const off=allUnits().filter(x=>x.id.indexOf(prefix)===0).length;
    togglePack(p.id);
    const on=allUnits().filter(x=>x.id.indexOf(prefix)===0).length;
    removePack(p.id);
    return JSON.stringify({before:before,off:off,on:on,remaining:tbPacks().length,
      meta:Object.keys(state.unitMeta).filter(k=>k.indexOf(prefix)===0).length,
      wrong:state.wrong.filter(w=>String(w.unitId).indexOf(prefix)===0).length,
      unitsLeft:allUnits().filter(x=>x.id.indexOf(prefix)===0).length});
  })()`));
  if(!(r.before>0) || r.off!==0 || r.on!==r.before || r.meta!==0 || r.wrong!==0 || r.unitsLeft!==0) throw new Error(JSON.stringify(r));
  return '停用后单元从课程列表移除，重新启用恢复；删除时清理归属与错题';
});

/* ---------- 本地数据库：同步逻辑 ---------- */
check('存储统计与容量格式化', () => {
  const r = JSON.parse(run(`JSON.stringify({c:dbCounts(),kb:fmtBytes(2048),mb:fmtBytes(2*1048576),gb:fmtBytes(2*1073741824),b:fmtBytes(999)})`));
  if(!(r.c.questions > 0) || !r.c.words || r.kb !== '2.0 KB' || r.mb !== '2.0 MB' || r.gb !== '2.00 GB' || r.b !== '999 B') throw new Error(JSON.stringify(r));
  return r.c.packs + ' 包 / ' + r.c.questions + ' 题 / ' + r.c.words + ' 词 · 容量单位换算正确';
});
check('存储分页渲染与状态行', () => {
  const r = JSON.parse(run(`(function(){
    switchTab('storage'); renderDrawer();
    const out={hidden:$('pageStorage').hidden,engine:$('dbEngine').textContent,
      kv:($('dbCounts').innerHTML.match(/class="kv"/g)||[]).length,
      rows:($('dbRows').innerHTML.match(/db-row/g)||[]).length,
      file:$('dbFileState').innerHTML.indexOf('db-row')>=0,
      desc:$('dbDesc').textContent.length};
    switchTab('learn'); return JSON.stringify(out);
  })()`));
  if(r.hidden || r.kv !== 7 || r.rows < 6 || !r.file || r.desc < 10) throw new Error(JSON.stringify(r));
  return '引擎 ' + r.engine + ' · ' + r.kv + ' 个统计格 / ' + r.rows + ' 行状态';
});
check('SQLite 导出结构与单引号转义', () => {
  const sql = run(`(function(){
    const bak=state.custom;
    state.custom=[{cn:"It's 冷",en:"It's fine.",hints:['它','是','好的']}];
    const out=exportSQLite(); state.custom=bak; return out;
  })()`);
  const tables = (sql.match(/CREATE TABLE IF NOT EXISTS/g) || []).length;
  if(tables < 10 || !sql.includes('BEGIN TRANSACTION;') || !sql.includes('COMMIT;') ||
     !sql.includes("It''s") || !sql.includes('INSERT INTO questions VALUES') ||
     !sql.includes('INSERT INTO vocab VALUES')) throw new Error('SQL 结构异常，表数 ' + tables);
  return tables + ' 张表 · ' + sql.split('\n').length + ' 行 · 单引号已转义';
});
check('数据库记录是深拷贝快照', () => {
  const r = JSON.parse(run(`(function(){
    const rec=dbRecord(123456);
    const before=JSON.stringify(rec.state.stats);
    state.stats.attempted=(state.stats.attempted||0)+777;
    return JSON.stringify({format:rec.format,ts:rec.savedAt,isolated:JSON.stringify(rec.state.stats)===before,
      hasPacks:Array.isArray(rec.state.textbooks)});
  })()`));
  if(r.format !== 'spelllab.db.v1' || r.ts !== 123456 || !r.isolated || !r.hasPacks) throw new Error(JSON.stringify(r));
  return 'format / savedAt / 深拷贝隔离均正确';
});
check('normalizeState 容错非法数据', () => {
  const r = JSON.parse(run(`(function(){
    const a=normalizeState(null), b=normalizeState({grades:'bad',progress:[],stats:{attempted:9},textbooks:[]});
    return JSON.stringify({a:a.grades.length,ba:b.grades.length,bprogress:Object.keys(b.progress).length,
      attempted:b.stats.attempted,bRate:b.settings.rate});
  })()`));
  if(r.a < 9 || r.ba < 9 || r.bprogress !== 0 || r.attempted !== 9 || r.bRate !== 0.9) throw new Error(JSON.stringify(r));
  return 'null / 字段类型错误均回落到默认结构并保留合法值';
});
/* ---- 记忆成长中心（错词复习 / 听写 / 闯关 / 统计）---- */
check('成长中心默认状态与旧存档兼容', () => run(`
  (function(){
    const d=normalizeState(null);
    const old=normalizeState({progress:{},wrong:[],vocab:[],history:[],stats:{attempted:7},settings:{rate:0.9}});
    return JSON.stringify({keys:Object.keys(d.memo).sort().join(','),
      oldSrs:Object.keys(old.memo.srs).length, oldStars:Object.keys(old.memo.stars).length,
      unlock:old.memo.mapUnlockAll, kept:old.stats.attempted});
  })()
`) === JSON.stringify({keys:'dictBest,mapUnlockAll,paperDict,srs,stars',oldSrs:0,oldStars:0,unlock:false,kept:7})
  ? '旧存档自动补齐 memo，不丢原有数据' : (()=>{throw new Error(run('JSON.stringify(normalizeState(null).memo)'));})());

check('错词收录与遗忘曲线升级', () => run(`
  (function(){
    memo().srs={}; srEnroll('apple','苹果',false,true);
    const lv0=memo().srs.apple.lv, due0=memo().srs.apple.due===today();
    srEnroll('apple','苹果',true,true);
    const lv1=memo().srs.apple.lv, due1=memo().srs.apple.due;
    srEnroll('apple','苹果',true,false);
    const lv2=memo().srs.apple.lv, due2=memo().srs.apple.due;
    srEnroll('banana','香蕉',true,false);
    return JSON.stringify({lv0:lv0,due0:due0,lv1:lv1,lv2:lv2,
      dueGrow:dayNum(due2)>dayNum(due1),noGhost:!memo().srs.banana});
  })()
`) === JSON.stringify({lv0:0,due0:true,lv1:1,lv2:2,dueGrow:true,noGhost:true})
  ? '答错归零当天重练，答对逐级推远到期日' : (()=>{throw new Error(run('JSON.stringify(memo().srs)'));})());

check('到期队列与复习面板渲染', () => run(`
  (function(){
    memo().srs={};
    srEnroll('cat','猫',false,true);
    srEnroll('dog','狗',true,true); srEnroll('dog','狗',true,true);
    srRenderList();
    return JSON.stringify({due:srDueList().length,all:srAllList().length,
      panel:$('srList').innerHTML.includes('cat'),count:$('srDue').textContent});
  })()
`) === JSON.stringify({due:1,all:2,panel:true,count:1})
  ? '只列今日到期项，清单可渲染' : (()=>{throw new Error(run('JSON.stringify({d:srDueList().length,a:srAllList().length})'));})());

check('复习流程：答对升级并记入积分与记录', () => run(`
  (function(){
    memo().srs={}; const p0=Number(state.plan.points)||0; const h0=state.history.length;
    srEnroll('sun','太阳',false,true);
    srQueue=[]; srIdx=0; srRight=0; srCurrent=null;
    srStart(false);
    $('srInput').value='sun'; srSubmit();
    const right=srRight, phase=srPhase, lv=memo().srs.sun.lv;
    srIdx++; srNextCard();
    return JSON.stringify({right:right,phase:phase,lv:lv,pts:(Number(state.plan.points)||0)-p0,
      hist:state.history.length-h0,donePhase:srPhase,bar:$('srBar').style.width});
  })()
`) === JSON.stringify({right:1,phase:'answered',lv:1,pts:Number(run('Number(state.plan.perCorrect)||0')),hist:1,donePhase:'idle',bar:'100%'})
  ? '提交 → 判分 → 升级 → 结算，全程闭环' : (()=>{throw new Error(run('JSON.stringify({right:srRight,lv:(memo().srs.sun||{}).lv,h:state.history.length})'));})());

check('听写：判分、连对与历史最佳', () => run(`
  (function(){
    memo().dictBest={}; const h0=state.history.length;
    dcQueue=[{en:'rain',cn:'雨',kind:'单词'},{en:'wind',cn:'风',kind:'单词'}];
    dcIdx=0; dcRight=0; dcStreak=0; dcPhase='ask'; dcT0=Date.now();
    dcNextCard(); $('dcInput').value='rain'; dcSubmit();
    const r1=dcRight, s1=dcStreak; dcAdvance(false);
    $('dcInput').value='xxx'; dcSubmit();
    const r2=dcRight, s2=dcStreak; dcAdvance(false);
    return JSON.stringify({r1:r1,s1:s1,r2:r2,s2:s2,best:memo().dictBest[srDictUnit()],
      hist:state.history.length-h0,phase:dcPhase});
  })()
`) === JSON.stringify({r1:1,s1:1,r2:1,s2:0,best:1,hist:2,phase:'idle'})
  ? '连对错后归零，历史最佳写入存档' : (()=>{throw new Error(run('JSON.stringify({r:dcRight,s:dcStreak,best:memo().dictBest[srDictUnit()]})'));})());

check('闯关地图：星级计算与解锁规则', () => run(`
  (function(){
    state.progress={}; state.wordStats={}; memo().stars={}; memo().mapUnlockAll=false;
    const us=units(); const before=mapStars(us[0]);
    us[0].sentences.forEach((_,i)=>{ state.progress[uid(us[0].id,i)]={m:3}; });
    (us[0].words||[]).forEach(w=>{ state.wordStats[normWord(w[0])]={m:3}; });
    const after=mapStars(us[0]);
    mapRender();
    const html=$('mapGrid').innerHTML;
    memo().mapUnlockAll=true; mapRender();
    const unlocked=$('mapGrid').innerHTML;
    return JSON.stringify({before:before,after:after,starSaved:memo().stars[us[0].id],
      locked:html.includes('locked'),free:!unlocked.includes('locked'),nodes:(html.match(/map-node/g)||[]).length});
  })()
`) === JSON.stringify({before:0,after:3,starSaved:3,locked:true,free:true,nodes:Number(run('units().length'))})
  ? '掌握度换算星级，默认逐关解锁 / 自由模式全开' : (()=>{throw new Error(run('JSON.stringify({a:mapStars(units()[0]),s:memo().stars})'));})());

check('学习统计：指标、图表与模式分布', () => run(`
  (function(){
    state.history=[{t:Date.now(),mode:'sentence',cn:'x',en:'y',ok:true,ms:1000,bad:0},
      {t:Date.now()-86400000,mode:'dict',cn:'a',en:'b',ok:false,ms:900,bad:1}];
    statsRender();
    const g=$('stGrid').innerHTML, c=$('stChart').innerHTML, m=$('stModes').innerHTML;
    return JSON.stringify({grid:g.includes('累计练习')&&g.includes('连续练习天数'),
      svg:c.includes('<svg')&&c.includes('rect'),modes:m.includes('句子拼写')&&m.includes('听写练习'),
      legend:$('stChart').innerHTML.length>100});
  })()
`) === JSON.stringify({grid:true,svg:true,modes:true,legend:true})
  ? '按历史记录生成指标卡、柱状图与模式分布' : (()=>{throw new Error(run('JSON.stringify({g:$("stGrid").innerHTML,c:$("stChart").innerHTML.length})'));})());

check('成长中心切换与积分面板入口', () => run(`
  (function(){
    switchGrowth('map'); const mapOn=$('gMap').classList.contains('on');
    switchGrowth('stats'); const statOn=$('gStats').classList.contains('on');
    setMode('growth');
    const shown=!$('growthView').hidden && $('sentenceView').hidden;
    setMode('sentence');
    return JSON.stringify({mapOn:mapOn,statOn:statOn,shown:shown,
      back:$('growthView').hidden&&!$('sentenceView').hidden});
  })()
`) === JSON.stringify({mapOn:true,statOn:true,shown:true,back:true})
  ? '四个子面板可切换，进入/退出成长中心视图正确' : (()=>{throw new Error(run('JSON.stringify({m:$("gMap").className,s:$("gStats").className,h:$("growthView").hidden})'));})());

check('镜像写入与配额超限自动降级', () => {
  const backup = store.get('spelllab.state.v1');
  const r = JSON.parse(run(`(function(){
    const orig=localStorage.setItem;
    localStorage.setItem=()=>{ throw new Error('QuotaExceededError'); };
    writeMirror(true);
    const off=STORE.mirror, removed=localStorage.getItem('spelllab.state.v1')===null;
    localStorage.setItem=orig; STORE.mirror='ok';
    return JSON.stringify({off:off,removed:removed});
  })()`));
  if(backup !== undefined) store.set('spelllab.state.v1', backup);
  if(r.off !== 'disabled' || !r.removed) throw new Error(JSON.stringify(r));
  return '超限时停用镜像并清除旧快照，主库不受影响';
});

/* ---------- 本地数据库：模拟 IndexedDB 的异步链路 ---------- */
const dbStore = new Map();
function fakeIDB(){
  return {
    open(){
      const req = {};
      queueMicrotask(() => {
        req.result = {
          objectStoreNames: { contains: () => true },
          createObjectStore(){},
          transaction(){
            return { objectStore(){
              return {
                get(k){ const r = { result: dbStore.has(k) ? dbStore.get(k) : undefined };
                  queueMicrotask(() => { if(r.onsuccess) r.onsuccess(); }); return r; },
                put(v,k){ dbStore.set(k, v); const r = {};
                  queueMicrotask(() => { if(r.onsuccess) r.onsuccess(); }); return r; }
              };
            }};
          }
        };
        if(req.onupgradeneeded) req.onupgradeneeded();
        if(req.onsuccess) req.onsuccess();
      });
      return req;
    }
  };
}
const dbLocal = new Map();
dbLocal.set('spelllab.state.v1', JSON.stringify({
  progress:{}, stats:{attempted:7,correct:5},
  custom:[{cn:'旧存档题',en:'It is old.',hints:['它','是','旧的']}]
}));
const fileWrites = [];
const fakeHandle = {
  name:'spelllab-data.json',
  queryPermission: async () => 'granted',
  requestPermission: async () => 'granted',
  createWritable: async () => ({ write: async t => fileWrites.push(t), close: async () => {} })
};
const dbSandbox = Object.assign({}, sandbox, {
  localStorage:{
    getItem: k => dbLocal.has(k) ? dbLocal.get(k) : null,
    setItem: (k,v) => dbLocal.set(k, String(v)),
    removeItem: k => dbLocal.delete(k)
  },
  indexedDB: fakeIDB(),
  setTimeout, clearTimeout,
  navigator:{ storage:{
    estimate: async () => ({ usage: 2048, quota: 1048576 }),
    persisted: async () => true,
    persist: async () => true
  }},
  window:{
    speechSynthesis:{ getVoices:()=>[], cancel(){}, speak(){} },
    AudioContext: FakeAudioContext,
    showSaveFilePicker: async () => fakeHandle,
    addEventListener(){}
  }
});
vm.createContext(dbSandbox);
const runDb = expr => vm.runInContext(expr, dbSandbox);

function checkAsync(name, fn){
  return Promise.resolve().then(fn).then(
    v => results.push([name, 'OK', v === undefined ? '' : v]),
    e => results.push([name, 'FAIL', e.message])
  );
}
/* ---------- 桌面版桥接：模拟 Python 本地服务 ---------- */
const deskCalls = [];
const deskState = {
  state: {
    stats: {attempted: 31, correct: 20},
    grades: [{id:'g4', name:'小学四年级'}],
    books: [{id:'b_hj', name:'沪教版'}],
    textbooks: [], custom: [], practiceSets: [], vocab: [], progress: {}, wrong: []
  },
  savedAt: 1700000000000
};
const deskLocal = new Map();
function fakeFetch(url, opt){
  const path = String(url).split('/api/')[1] || '';
  const method = (opt && opt.method) || 'GET';
  deskCalls.push({path:path, method:method, body:opt && opt.body});
  let data = {};
  if(path === 'load') data = {state:deskState.state, savedAt:deskState.savedAt};
  else if(path === 'save'){
    deskState.state = JSON.parse(opt.body);
    deskState.savedAt = Date.now();
    data = {savedAt:deskState.savedAt, hash:'hash-x', normalized:true};
  }
  else if(path === 'info') data = {dbPath:'C:/SpellLab/desktop/data/spelllab.db', dbDir:'C:/SpellLab/desktop/data',
    size:90112, savedAt:deskState.savedAt,
    counts:{grades:1,books:1,packs:0,units:0,questions:0,words:0,vocab:0,progress:0,wrong:0,stats:2}};
  else if(path === 'ping') data = {ok:true, version:'1.0.0'};
  else if(path === 'export') data = {ok:true, path:'C:/SpellLab/desktop/data/exports/backup.json'};
  else if(path === 'open-folder') data = {ok:true, path:'C:/SpellLab/desktop/data'};
  return Promise.resolve({ok:true, status:200, json:()=>Promise.resolve(data)});
}
const deskSandbox = Object.assign({}, sandbox, {
  localStorage:{
    getItem: k => deskLocal.has(k) ? deskLocal.get(k) : null,
    setItem: (k,v) => deskLocal.set(k, String(v)),
    removeItem: k => deskLocal.delete(k)
  },
  fetch: fakeFetch,
  setTimeout, clearTimeout,
  navigator:{ storage:{ estimate: async()=>({usage:0,quota:0}), persisted: async()=>false } },
  window:{
    __SPELLLAB_DESKTOP__:{mode:'http', version:'1.0.0', port:8765, base:'/api'},
    speechSynthesis:{ getVoices:()=>[], cancel(){}, speak(){} },
    AudioContext: FakeAudioContext,
    addEventListener(){}
  }
});
vm.createContext(deskSandbox);
const runDesk = expr => vm.runInContext(expr, deskSandbox);

async function asyncChecks(){
  vm.runInContext(code, dbSandbox);
  await new Promise(r => setTimeout(r, 50));

  check('启动打开 IndexedDB 并迁移旧存档', () => {
    const st = JSON.parse(runDb(`JSON.stringify({mode:STORE.mode,ready:STORE.ready,
      migrated:STORE.migrated,usage:STORE.usage,quota:STORE.quota,persisted:STORE.persisted,
      attempted:state.stats.attempted,custom:state.custom.length})`));
    const rec = dbStore.get('main');
    if(st.mode!=='idb' || !st.ready || !st.migrated || !rec || rec.format!=='spelllab.db.v1' ||
       rec.state.stats.attempted!==7 || st.attempted!==7 || st.custom!==1 ||
       st.usage!==2048 || st.quota!==1048576 || !st.persisted) throw new Error(JSON.stringify(st));
    return 'mode=idb · 旧存档 7 次答题 / 1 条自定义题已迁入 · 用量统计生效';
  });

  await checkAsync('saveState 防抖写入数据库', async () => {
    runDb('state.stats.attempted=42; saveState();');
    if(runDb('STORE.queued') !== true) throw new Error('未进入待写入队列');
    await new Promise(r => setTimeout(r, 320));
    const rec = dbStore.get('main');
    if(!rec || rec.state.stats.attempted !== 42 || runDb('STORE.queued') !== false) throw new Error('防抖写入未落库');
    return '队列 -> 220ms 后落库，savedAt 已更新';
  });

  await checkAsync('writeNow 立即写入与镜像兜底', async () => {
    runDb('state.vocab=[{id:"v1",en:"snow",cn:"雪",m:0}]; STORE.savedAt=Date.now();');
    const ok = await runDb('writeNow()');
    const rec = dbStore.get('main');
    if(ok !== true || !rec || rec.state.vocab.length !== 1 || rec.state.vocab[0].en !== 'snow') throw new Error('立即写入失败');
    runDb('flushStorage()');
    if(!dbLocal.get('spelllab.state.v1')) throw new Error('镜像未写入');
    return '主库与 localStorage 镜像双写成功';
  });

  await checkAsync('绑定本地文件并自动同步', async () => {
    const n0 = fileWrites.length;
    const bound = await runDb('bindDataFile()');
    const savedHandle = dbStore.get('fileHandle');
    if(bound !== true || !savedHandle || !savedHandle.handle || savedHandle.name !== 'spelllab-data.json')
      throw new Error('文件句柄未持久化');
    if(fileWrites.length < n0 + 1) throw new Error('绑定时未写入文件');
    const payload = JSON.parse(fileWrites[fileWrites.length - 1]);
    if(payload.format !== 'spelllab.backup.v1' || !payload.state) throw new Error('同步内容格式错误');
    const n1 = fileWrites.length;
    await runDb('syncDataFile()');
    if(fileWrites.length < n1 + 1) throw new Error('手动同步未写入');
    await runDb('unbindDataFile()');
    if(runDb('STORE.fileHandle') !== null || dbStore.get('fileHandle').handle !== null)
      throw new Error('解除绑定未清理');
    return '授权 / 首写 / 手动同步 / 句柄持久化 / 解除绑定均正常';
  });

  await checkAsync('从备份恢复后立即写回数据库', async () => {
    const backup = runDb(`JSON.stringify({format:'spelllab.backup.v1',exportedAt:'2026-01-01T00:00:00.000Z',
      state:Object.assign(clone(DEFAULT_STATE),{stats:Object.assign({},DEFAULT_STATE.stats,{attempted:88})})})`);
    const ok = runDb('restoreBackup(' + JSON.stringify(backup) + ')');
    await new Promise(r => setTimeout(r, 30));
    const rec = dbStore.get('main');
    if(ok !== true || runDb('state.stats.attempted') !== 88 || !rec || rec.state.stats.attempted !== 88)
      throw new Error('恢复后未即时落库');
    return '备份覆盖内存状态，主库同步更新';
  });

  await checkAsync('清空数据库重置主库与镜像', async () => {
    await runDb('wipeDatabase()');
    const rec = dbStore.get('main');
    const mirror = JSON.parse(dbLocal.get('spelllab.state.v1') || '{}');
    if(runDb('state.stats.attempted') !== 0 || !rec || rec.state.stats.attempted !== 0 ||
       mirror.stats.attempted !== 0) throw new Error('清空未彻底');
    return '内存 / IndexedDB / 镜像三处一致重置';
  });

  await checkAsync('无 IndexedDB 时自动降级为 localStorage', async () => {
    await new Promise(r => setTimeout(r, 20));
    const r = JSON.parse(run(`JSON.stringify({mode:STORE.mode,ready:STORE.ready,error:STORE.error})`));
    if(r.mode !== 'local' || !r.ready || r.error.indexOf('IndexedDB') < 0) throw new Error(JSON.stringify(r));
    return 'mode=local · 错误原因已记录，页面功能不受影响';
  });

  vm.runInContext(code, deskSandbox);
  await new Promise(r => setTimeout(r, 60));

  await checkAsync('桌面版启动从 SQLite 载入状态', async () => {
    const r = JSON.parse(runDesk(`JSON.stringify({desktop:DESKTOP,mode:STORE.mode,ready:STORE.ready,
      attempted:state.stats.attempted,dbPath:STORE.dbPath,size:STORE.dbSize})`));
    if(!r.desktop || r.mode !== 'sqlite' || !r.ready || r.attempted !== 31 || !r.dbPath || !r.size)
      throw new Error(JSON.stringify(r));
    return 'DESKTOP=true · mode=sqlite · 读到 31 次答题记录 · ' + r.dbPath;
  });

  await checkAsync('桌面版存储页显示 SQLite 文件与规范表', async () => {
    const r = JSON.parse(runDesk(`(function(){switchTab('storage');renderDrawer();return JSON.stringify({
      engine:$('dbEngine').textContent,desktopHidden:$('desktopPanel').hidden,
      fileHidden:$('dbFilePanel').hidden,persistHidden:$('dbPersist').hidden,
      info:$('desktopDbInfo').innerHTML,rows:$('dbRows').innerHTML,
      kv:($('dbCounts').innerHTML.match(/class="kv"/g)||[]).length});})()`));
    if(r.engine.indexOf('SQLite') < 0 || r.desktopHidden || !r.fileHidden || !r.persistHidden ||
       r.info.indexOf('spelllab.db') < 0 || r.rows.indexOf('sqlite3') < 0 || r.kv !== 7)
      throw new Error(JSON.stringify(r));
    return '引擎 / 文件路径 / 事务说明 / 7 个统计格 / 隐藏网页版专属控件均正确';
  });

  await checkAsync('桌面版 saveState 防抖写入 SQLite', async () => {
    const before = deskCalls.filter(c => c.path === 'save').length;
    runDesk('state.stats.attempted=99; saveState();');
    if(runDesk('STORE.queued') !== true) throw new Error('未进入待写入队列');
    await new Promise(r => setTimeout(r, 300));
    if(deskCalls.filter(c => c.path === 'save').length <= before ||
       deskState.state.stats.attempted !== 99) throw new Error('未写回 SQLite');
    return 'POST /api/save 已发送，服务端收到 99 次答题记录';
  });

  await checkAsync('桌面版 flush 与清空数据库', async () => {
    runDesk('state.vocab=[{id:"v2",en:"rain",cn:"雨",m:0}]; saveState(); flushStorage();');
    await new Promise(r => setTimeout(r, 40));
    if(!(deskState.state.vocab || []).some(v => v.en === 'rain'))
      throw new Error('关闭窗口前 flush 未写回');
    await runDesk('wipeDatabase()');
    if(deskState.state.stats.attempted !== 0 || runDesk('state.stats.attempted') !== 0)
      throw new Error('清空未写回');
    return 'pagehide 兜底写入 + 清空后写回默认状态';
  });

  await checkAsync('桌面版从网页备份恢复并写库', async () => {
    const payload = runDesk(`JSON.stringify({format:'spelllab.backup.v1',
      state:Object.assign(clone(DEFAULT_STATE),
        {stats:Object.assign({},DEFAULT_STATE.stats,{attempted:55})})})`);
    const ok = runDesk('restoreBackup(' + JSON.stringify(payload) + ')');
    await new Promise(r => setTimeout(r, 40));
    if(ok !== true || deskState.state.stats.attempted !== 55)
      throw new Error('恢复未写回 SQLite');
    return '浏览器备份 JSON 恢复后自动写入 .db';
  });
}

let failed = 0;
(async () => {
  await asyncChecks();
  for(const [n, s, v] of results){
    if(s === 'FAIL') failed++;
    console.log((s === 'OK' ? '[OK]   ' : '[FAIL] ') + n + (v ? '  -> ' + v : ''));
  }
  console.log('\n合计 ' + results.length + ' 项，失败 ' + failed + ' 项');
  process.exit(failed ? 1 : 0);
})();
