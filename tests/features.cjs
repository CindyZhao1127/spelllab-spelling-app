/* 专项回归：完成后自动朗读、逐次练习记录、关窗前的可靠保存 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'SpellLab.html'), 'utf8');
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];

class ClassList {
  constructor(){ this.s = new Set(); }
  add(...c){ c.forEach(x => { if(x) this.s.add(x); }); }
  remove(...c){ c.forEach(x => this.s.delete(x)); }
  toggle(c, f){ if(f === undefined) f = !this.s.has(c); f ? this.s.add(c) : this.s.delete(c); return f; }
  contains(c){ return this.s.has(c); }
}
class El {
  constructor(id, tag){
    this.id = id || ''; this.tagName = (tag || 'div').toUpperCase();
    this.classList = new ClassList(); this.style = {}; this.dataset = {};
    this.children = []; this._html = ''; this._sub = {}; this._input = null;
    this.textContent = ''; this.value = ''; this.readOnly = false;
    this.disabled = false; this.selectionStart = 0; this.offsetWidth = 1;
    this.listeners = {}; this.hidden = false;
  }
  set innerHTML(v){
    this._html = String(v); this.children = []; this._input = null;
    if(/<input\b/.test(this._html)) this._input = new El('', 'input');
  }
  get innerHTML(){ return this._html; }
  addEventListener(t, fn){ (this.listeners[t] = this.listeners[t] || []).push(fn); }
  appendChild(c){ this.children.push(c); return c; }
  querySelector(sel){
    const key = String(sel);
    if(key === 'input'){
      if(this._input) return this._input;
      return (this._input = new El('', 'input'));
    }
    if(!this._sub[key]) this._sub[key] = new El('', 'div');
    return this._sub[key];
  }
  querySelectorAll(){ return []; }
  focus(){ doc.activeElement = this; }
  blur(){} click(){} remove(){} closest(){ return null; }
}
const doc = {
  activeElement: null, _map: new Map(),
  getElementById(id){
    if(!this._map.has(id)) this._map.set(id, new El(id));
    return this._map.get(id);
  },
  createElement(tag){ return new El('', tag); },
  body: { appendChild(){}, removeChild(){} },
  querySelectorAll(){ return []; },
  addEventListener(){}
};
class FakeAudioContext {
  constructor(){ this.currentTime = 0; this.state = 'running'; this.destination = {}; }
  createOscillator(){
    return { type:'', frequency:{ setValueAtTime(){}, exponentialRampToValueAtTime(){} },
             connect(){}, start(){}, stop(){} };
  }
  createGain(){
    return { gain:{ setValueAtTime(){}, exponentialRampToValueAtTime(){} }, connect(){} };
  }
  resume(){ this.state = 'running'; }
}
const local = new Map(), scheduled = [], spoken = [], fetchCalls = [], beacons = [], downloads = [];
function fakeFetch(url, opt){
  const p = String(url).split('/api/')[1] || '';
  fetchCalls.push({path:p, body:opt && opt.body, keepalive:!!(opt && opt.keepalive)});
  let data = {};
  if(p === 'load') data = {state:null, savedAt:0};
  else if(p === 'save') data = {savedAt:Date.now(), hash:'x', normalized:true};
  else if(p === 'info') data = {dbPath:'C:/SpellLab/desktop/dist/data/spelllab.db', size:4096,
    savedAt:Date.now(), counts:{history:0}};
  else if(p === 'ping') data = {ok:true};
  return Promise.resolve({ok:true, status:200, json:() => Promise.resolve(data)});
}
const sandbox = {
  document: doc, console,
  localStorage: {
    getItem: k => local.has(k) ? local.get(k) : null,
    setItem: (k, v) => local.set(k, String(v)),
    removeItem: k => local.delete(k)
  },
  SpeechSynthesisUtterance: class { constructor(t){ this.text = t; } },
  setTimeout: (fn, ms) => { scheduled.push({fn, ms}); return scheduled.length; },
  clearTimeout: () => {},
  confirm: () => true, prompt: () => '',
  fetch: fakeFetch,
  navigator: {
    sendBeacon: (url, body) => { beacons.push({url, body}); return true; },
    storage: { estimate: async () => ({usage:0, quota:0}), persisted: async () => false }
  },
  Blob: class { constructor(parts, opts){ this.parts = parts; this.type = opts && opts.type; } },
  URL: {
    createObjectURL: b => { downloads.push(b); return 'blob:' + downloads.length; },
    revokeObjectURL(){}
  },
  Date, Math, JSON, Object, Array, String, Number, Set, Map, RegExp, Error, Promise
};
sandbox.window = {
  __SPELLLAB_DESKTOP__: {mode:'http', version:'1.0.0', port:8790, base:'/api'},
  speechSynthesis: { getVoices: () => [], cancel(){}, speak(u){ spoken.push(u.text); } },
  AudioContext: FakeAudioContext,
  addEventListener(){}
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const run = expr => vm.runInContext(expr, sandbox);
const results = [];
function assert(cond, msg){ if(!cond) throw new Error(msg); }
function check(name, fn){
  try { const v = fn(); results.push([name, 'OK', v === undefined ? '' : v]); }
  catch(e){ results.push([name, 'FAIL', e.message]); }
}
function fireScheduled(){
  const list = scheduled.splice(0, scheduled.length);
  list.forEach(x => { try { x.fn(); } catch(_){} });
}

(async () => {
  await new Promise(r => setImmediate(r));   // 等 bootDesktop() 的异步加载结束

  check('桌面模式启动成功且数据路径可读', () => {
    const o = JSON.parse(run('JSON.stringify({d:DESKTOP,m:STORE.mode,ready:STORE.ready,p:STORE.dbPath})'));
    assert(o.d && o.m === 'sqlite' && o.ready, JSON.stringify(o));
    assert(o.p.indexOf('spelllab.db') >= 0, '未读到数据库路径');
    return o.p;
  });

  check('默认开启「拼完句子后自动朗读整句」', () => {
    assert(run('state.settings.speakOnFinish') === true, '默认未开启');
    assert(/id="swSpeakOnFinish"/.test(html), '设置面板缺新开关');
    assert(/拼完句子后自动朗读整句/.test(html), '缺说明文案');
    return 'speakOnFinish=true';
  });

  check('旧存档平滑升级：不受 autoSpeak:false 影响', () => {
    const o = JSON.parse(run(`JSON.stringify((function(){
      const s=normalizeState({settings:{autoSpeak:false,showHints:false},stats:{attempted:12}});
      return {speak:s.settings.speakOnFinish,hints:s.settings.showHints,
        hist:Array.isArray(s.history)?s.history.length:-1,attempted:s.stats.attempted};})())`));
    assert(o.speak === true && o.hints === false && o.hist === 0 && o.attempted === 12, JSON.stringify(o));
    return '旧开关失效、新默认生效、history 补齐、统计保留';
  });

  check('练习记录最多保留 500 条', () => {
    const n = run(`(function(){
      const a=[]; for(let i=0;i<620;i++) a.push({t:i,mode:'sentence',en:'w'+i});
      return normalizeState({history:a}).history.length;})()`);
    assert(n === 500, '限长结果 ' + n);
    const m = run(`(function(){state.history=[];for(let i=0;i<620;i++) addHistory({mode:'word',en:'w'+i});
      return state.history.length;})()`);
    assert(m === 500, 'addHistory 限长结果 ' + m);
    run('state.history=[]');
    return 'normalizeState / addHistory 均截断到 500';
  });

  check('完成一道题立即写盘并记录一条练习', () => {
    run('state.history=[]; spokenDummy=0; renderSentence();');
    const before = fetchCalls.filter(c => c.path === 'save').length;
    run(`(function(){
      const toks=tokenize(currentQuestion().q.en,currentQuestion().q.hints,currentQuestion().q.cn);
      slots.forEach((s,i)=>{ if(!s) return; const inp=s.querySelector('input');
        inp.value=toks[i].word; onSlotInput({target:inp}); });
    })()`);
    const o = JSON.parse(run(`JSON.stringify({solved:solved,n:state.history.length,
      h:state.history[0],saves:${JSON.stringify(fetchCalls.filter(c => c.path === 'save').length)},
      dirty:STORE.dirty})`));
    assert(o.solved === true, '题目未完成');
    assert(o.n === 1, '练习记录条数 ' + o.n);
    assert(o.h.mode === 'sentence' && o.h.ok === true && o.h.en === run('currentQuestion().q.en'), JSON.stringify(o.h));
    assert(typeof o.h.ms === 'number' && o.h.ms >= 0, '缺用时');
    assert(o.saves > before, '关键节点没有立刻发 /api/save（还在等防抖）');
    return '记录 1 条 + 立即 POST /api/save';
  });

  check('完成后自动朗读整句（延迟可配置，默认 120ms）', () => {
    const en = run('currentQuestion().q.en');
    const delay = run('Number(state.settings.speakDelayMs)');
    assert(delay === 120, '默认延迟应为 120ms，实际 ' + delay);
    const item = scheduled.filter(x => x.ms === delay);
    assert(item.length >= 1, '未按设置安排延迟朗读');
    spoken.length = 0;
    item.forEach(x => x.fn());
    assert(spoken.indexOf(en) >= 0, '未朗读整句：' + JSON.stringify(spoken));

    scheduled.length = 0;
    run('state.settings.speakDelayMs=300; state.history=[]; renderSentence();');
    run(`(function(){
      const toks=tokenize(currentQuestion().q.en,currentQuestion().q.hints,currentQuestion().q.cn);
      slots.forEach((s,i)=>{ if(!s) return; const inp=s.querySelector('input');
        inp.value=toks[i].word; onSlotInput({target:inp}); });
    })()`);
    assert(scheduled.some(x => x.ms === 300), '自定义延迟未生效');
    run('state.settings.speakDelayMs=120');
    assert(/speakDelayRange/.test(html) && /朗读延迟/.test(html), '设置面板缺延迟控件');
    return en + '（默认 120ms，可配 0-600ms）';
  });

  check('关闭自动朗读开关后不再朗读', () => {
    run('state.settings.speakOnFinish=false; state.history=[]; renderSentence();');
    fireScheduled();
    spoken.length = 0;
    scheduled.length = 0;
    run(`(function(){
      const toks=tokenize(currentQuestion().q.en,currentQuestion().q.hints,currentQuestion().q.cn);
      slots.forEach((s,i)=>{ if(!s) return; const inp=s.querySelector('input');
        inp.value=toks[i].word; onSlotInput({target:inp}); });
    })()`);
    fireScheduled();
    assert(spoken.length === 0, '开关关闭仍朗读了：' + JSON.stringify(spoken));
    run('state.settings.speakOnFinish=true');
    return '尊重开关设置';
  });

  check('借助提示 / 答错会如实记录', () => {
    run('state.history=[]; renderSentence(); markMistake(); assisted=true; finishQuestion();');
    const h = JSON.parse(run('JSON.stringify(state.history[0])'));
    assert(h.ok === false && h.assisted === true && h.bad >= 1, JSON.stringify(h));
    return 'ok=false · assisted=true · bad=' + h.bad;
  });

  check('记录面板渲染统计与按天分组列表', () => {
    run(`(function(){
      state.history=[
        {t:Date.now()-86400000,mode:'word',unit:'Unit 1',cn:'雪',en:'snow',ok:true,ms:4000,bad:0},
        {t:Date.now(),mode:'sentence',unit:'Unit 2',cn:'今天很冷。',en:'It is cold today.',ok:false,assisted:true,ms:9000,bad:2}
      ];
      switchTab('history'); renderHistory();})()`);
    const grid = run("$('histGrid').innerHTML"), list = run("$('histList').innerHTML");
    assert((grid.match(/class="stat-box"/g) || []).length === 4, '统计格数量不对');
    assert(list.indexOf('It is cold today.') >= 0 && list.indexOf('snow') >= 0, '缺记录条目');
    assert(list.indexOf('借助提示') >= 0 && list.indexOf('一次过') >= 0, '缺结果徽标');
    assert(list.indexOf('hist-day') >= 0, '缺按天分组');
    return '4 个统计格 / 2 条记录 / 日期分组';
  });

  check('导出 CSV：BOM + 表头 + 全部记录', () => {
    run('exportHistoryCSV()');
    assert(downloads.length >= 1, '未触发下载');
    const text = downloads[downloads.length - 1].parts.join('');
    assert(text.charCodeAt(0) === 0xFEFF, '缺 UTF-8 BOM，Excel 会乱码');
    assert(text.indexOf('"时间","模式","单元"') >= 0, '缺表头');
    assert(text.indexOf('It is cold today.') >= 0, '缺记录内容');
    return (text.split('\r\n').length - 1) + ' 行';
  });

  check('清空记录按钮有二次确认且不影响统计', () => {
    run('state.stats.attempted=17;');
    const fn = doc.getElementById('clearHistory').listeners.click[0];
    assert(typeof fn === 'function', '未绑定清空按钮');
    fn();
    assert(run('state.history.length') === 0, '记录未清空');
    assert(run('state.stats.attempted') === 17, '误伤了学习统计');
    return '记录清空 · 统计保留';
  });

  check('侧栏显示数据位置与保存状态', () => {
    run('renderSaveBadge()');
    const t = run("$('saveBadge').textContent");
    assert(t.indexOf('SQLite') >= 0 && t.indexOf('spelllab.db') >= 0, t);
    run('STORE.dirty=true; renderSaveBadge()');
    assert(run("$('saveBadge').textContent").indexOf('正在写入') >= 0, '缺写入中提示');
    run('STORE.dirty=false; STORE.lastFlush=Date.now(); renderSaveBadge()');
    assert(run("$('saveBadge').textContent").indexOf('已保存') >= 0, '缺已保存提示');
    return '路径 / 写入中 / 已保存 三态';
  });

  check('关窗时 dirty 状态用 sendBeacon 补写', () => {
    const before = beacons.length;
    run('STORE.dirty=true; state.stats.attempted=88; flushStorage();');
    assert(beacons.length === before + 1, '未调用 sendBeacon');
    assert(beacons[before].url === '/api/save', 'beacon 地址不对');
    const body = beacons[before].body.parts.join('');
    assert(JSON.parse(body).stats.attempted === 88, '补写的不是最新状态');
    assert(run('STORE.dirty') === false, '补写后未清除 dirty');
    return '一次 beacon · 内容是最新状态';
  });

  check('已落盘时关窗不重复发送 beacon', () => {
    const before = beacons.length;
    run('flushStorage()');
    assert(beacons.length === before, '重复发送');
    return '幂等';
  });

  check('sendBeacon 不可用时回退到 keepalive fetch', () => {
    const before = fetchCalls.filter(c => c.keepalive).length;
    run(`(function(){const f=navigator.sendBeacon;navigator.sendBeacon=undefined;
      DESKTOP_API.beacon({stats:{attempted:1}});navigator.sendBeacon=f;})()`);
    const after = fetchCalls.filter(c => c.keepalive).length;
    assert(after === before + 1, '未回退到 fetch keepalive');
    return 'fetch({keepalive:true}) 兜底';
  });

  check('存储页明确提示浏览器版与桌面版数据不互通', () => {
    const s = run(`(function(){switchTab('storage');renderStorage();return $('dbDesc').textContent;})()`);
    assert(s.indexOf('不互通') >= 0, s);
    return s.slice(0, 46) + '…';
  });

  check('导出的 SQLite 快照含 history 表与记录', () => {
    run(`(function(){state.history=[{t:123,mode:'sentence',unit:'U1',cn:'雪',en:'snow',
      ok:true,assisted:false,ms:3000,bad:0}];})()`);
    const sql = run('exportSQLite()');
    assert(sql.indexOf('CREATE TABLE IF NOT EXISTS history') >= 0, '缺建表');
    assert(sql.indexOf('DELETE FROM history;') >= 0, '缺清表');
    assert(sql.indexOf('INSERT INTO history VALUES') >= 0, '缺记录');
    return 'CREATE / DELETE / INSERT 齐全';
  });

  check('升级前的旧练习在空记录页有说明', () => {
    run('state.history=[]; state.stats.attempted=23; renderHistory();');
    const t = run("$('histList').innerHTML");
    assert(t.indexOf('23') >= 0 && t.indexOf('升级前') >= 0, t);
    return '不会让用户误以为数据又丢了';
  });

  check('run.bat 与 exe 共用同一个数据库文件', () => {
    const bat = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'run.bat'), 'utf8');
    assert(/SPELLLAB_DB/.test(bat), 'run.bat 未设置 SPELLLAB_DB');
    assert(/dist\\data\\spelllab\.db/.test(bat), '未指向 exe 同目录的 data');
    const b = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'run.bat'));
    assert(b.every(x => x < 128), '批处理含非 ASCII 字节');
    assert(!b.toString('latin1').replace(/\r\n/g, '').includes('\n'), '批处理不是纯 CRLF');
    return 'SPELLLAB_DB -> dist\\data\\spelllab.db · 纯 ASCII + CRLF';
  });

  check('HTML 中已无旧 autoSpeak 判定', () => {
    assert(code.indexOf('state.settings.autoSpeak') < 0, '仍在读取旧开关');
    assert(code.indexOf('saveState(true)') >= 0, '缺关键节点立即保存');
    return '旧开关已下线';
  });

  /* ---------------- 新增：间距 / 难度计时 / 生词 / 现场 / 计划 / 抽奖 ---------------- */
  check('词间距可配置，长中文提示改为词下方换行', () => {
    assert(/column-gap:var\(--word-gap,22px\)/.test(html), '缺可配置列间距');
    assert(/\.slot \.hint\{[\s\S]*?white-space:normal/.test(html), '提示未改为自动换行');
    assert(/slot-core/.test(html), '缺 slot-core 包裹，横线会被提示撑长');
    const markup = run('(function(){renderSentence();return slots.find(s=>s).innerHTML;})()');
    assert(markup.indexOf('slot-core') >= 0 && markup.indexOf('class="hint"') >= 0, markup);
    assert(markup.indexOf('</div><div class="hint">') >= 0, '提示不在词槽下方');
    assert(run('Number(state.settings.wordGap)') === 22, '默认间距应为 22px');
    assert(/id="gapRange"/.test(html) && /id="gapVal"/.test(html), '设置面板缺间距控件');
    return '22px 可配 · 提示参与布局 · 横线不被撑长';
  });

  check('难度档位、露出字母与计时/倒计时', () => {
    const d = JSON.parse(run('JSON.stringify(DIFFICULTY)'));
    assert(d.easy.seconds === 120 && d.normal.seconds === 60 && d.hard.seconds === 35, JSON.stringify(d));
    assert(d.easy.hints === 2 && d.hard.hints === 1, '提示级数不对');
    run("state.settings.difficulty='easy'; state.settings.revealLetters=0; renderSentence();");
    assert(run('revealCount("weather")') === 1, '简单难度未多露 1 个字母');
    run("state.settings.difficulty='hard'; state.settings.timerMode='countdown'; renderSentence();");
    assert(run("$('diffChip').textContent").indexOf('困难') >= 0, '难度标签未更新');
    assert(run("$('timerChip').textContent").indexOf('剩余') >= 0, '未显示倒计时');
    run('hintCurrent();');
    assert(run('assisted') === false, '困难模式不应给出二级提示');
    run("state.settings.timerMode='count'; state.settings.difficulty='normal'; renderSentence();");
    assert(run("$('timerChip').textContent").indexOf('用时') >= 0, '未显示用时');
    return '三档倒计时 / 提示级数 / 露出字母 / 计时显示';
  });

  check('倒计时到点自动显示答案并记为借助提示', () => {
    run(`(function(){state.settings.timerMode='countdown'; state.history=[]; renderSentence();
      questionDeadline=Date.now()-1; timeUp();})()`);
    const o = JSON.parse(run('JSON.stringify({solved:solved,assisted:assisted,h:state.history.length})'));
    assert(o.solved && o.assisted && o.h === 1, JSON.stringify(o));
    run("state.settings.timerMode='count'; state.history=[]; renderSentence();");
    return 'timeUp -> revealWholeBoard -> finishQuestion(assisted)';
  });

  check('拼错自动加入生词本且不会重复收录', () => {
    run(`(function(){state.vocab=[]; state.settings.autoVocab=true; state.settings.difficulty='normal';
      state.history=[]; renderSentence();
      const i=slots.findIndex(s=>s), inp=slots[i].querySelector('input');
      inp.value='zzz'; commitSlot(i);})()`);
    const w = JSON.parse(run('JSON.stringify(state.vocab.map(v=>({en:v.en,source:v.source})))'));
    const word = run('curTokens[slots.findIndex(s=>s)].word');
    assert(w.some(x => x.en === word), JSON.stringify(w));
    assert(w[0].source.indexOf('拼错') >= 0, JSON.stringify(w));
    const n = run('state.vocab.length');
    run(`(function(){const i=slots.findIndex(s=>s), inp=slots[i].querySelector('input');
      inp.value='qqq'; commitSlot(i);})()`);
    assert(run('state.vocab.length') === n, '重复收藏未去重');
    run(`(function(){state.settings.autoVocab=false; state.vocab=[];
      const i=slots.findIndex(s=>s), inp=slots[i].querySelector('input');
      inp.value='zzz'; commitSlot(i);})()`);
    assert(run('state.vocab.length') === 0, '关闭开关后仍在自动收藏');
    run('state.settings.autoVocab=true');
    return '拼错自动收藏 · 去重 · 开关生效';
  });

  check('手动把本题单词加入生词本', () => {
    run('state.vocab=[]; starQuestionWords();');
    const n = run('state.vocab.length');
    assert(n > 0, '未加入');
    run('starQuestionWords();');
    assert(run('state.vocab.length') === n, '重复加入');
    return n + ' 个词 · 去重';
  });

  check('退出前保存练习现场，下次可继续或重开', () => {
    run(`(function(){sessionSuspended=false; unitPos=1; qPos=2; renderSentence();
      draft[slots.findIndex(s=>s)]='ab'; snapshotSession(false);})()`);
    const s = JSON.parse(run('JSON.stringify(state.session)'));
    assert(s.unitId && s.qPos === 2 && s.mode === 'sentence' && s.savedAt > 0, JSON.stringify(s));
    assert(s.draft.some(x => x === 'ab'), '未保存未填完的字母');
    run(`(function(){resumeCandidate=clone(state.session); sessionSuspended=true;
      unitPos=0; qPos=0; resumePractice('continue');})()`);
    assert(run('qPos') === 2, '未恢复题序');
    assert(run('sessionSuspended') === false, '恢复后仍在挂起');
    run(`(function(){resumeCandidate=clone(state.session); sessionSuspended=true;
      resumePractice('restart');})()`);
    assert(run('qPos') === 0 && run('unitPos') === 0, '重新开始未复位');
    return '快照含单元/题序/草稿 · 继续与重开两条路径';
  });

  check('关窗 beacon 里含可恢复的练习现场', () => {
    run('sessionSuspended=false; snapshotSession(false); STORE.dirty=true; flushStorage();');
    const body = JSON.parse(beacons[beacons.length - 1].body.parts.join(''));
    assert(body.session && body.session.unitId, 'beacon 缺 session');
    return 'session 随 state 一起补写';
  });

  check('只输入了字母没换题，关窗也会补写草稿', () => {
    run(`(function(){sessionSuspended=false; state.history=[]; renderSentence();
      snapshotSession(false); STORE.dirty=false; STORE.lastFlush=Date.now();
      draft[slots.findIndex(s=>s)]='zz';})()`);
    const before = beacons.length;
    run('flushStorage();');
    assert(beacons.length === before + 1, '草稿变化未触发补写');
    const body = JSON.parse(beacons[before].body.parts.join(''));
    assert(body.session.draft.some(x => x === 'zz'), 'session 里没有最新草稿');
    return 'draft 变化即触发 beacon';
  });

  check('单元一轮练完弹出「下一单元 / 继续本单元」', () => {
    run(`(function(){state.settings.askNextUnit=true; unitRoundCount=0; unitRoundPrompted=false;
      const total=order().length; unitRoundCount=total-1; state.history=[];
      renderSentence(); finishQuestion();})()`);
    assert(run('unitRoundPrompted') === true, '未标记已询问');
    scheduled.length = 0;
    run('promptNextUnit()');
    const title = run("$('modalTitle').textContent");
    assert(title.indexOf('本单元') >= 0, title);
    assert(run("$('modalActions').children.length") === 3, '按钮数不对');
    const before = run('unitPos');
    run('nextUnit()');
    assert(run('unitPos') !== before && run('qPos') === 0, '未切到下一单元');
    return '弹框 3 个选项 · nextUnit 复位题序';
  });

  check('积分：答对加分、扣分不会为负、顶部同步', () => {
    run(`(function(){state.plan.points=0; state.plan.ledger=[];
      addPoints(5,'测试加分'); addPoints(-100,'测试扣分');})()`);
    const o = JSON.parse(run('JSON.stringify({p:state.plan.points,n:state.plan.ledger.length})'));
    assert(o.p === 0 && o.n === 2, JSON.stringify(o));
    assert(String(run("$('statPoints').textContent")) === '0', '顶部积分未刷新');
    return '流水 2 条 · 下限 0';
  });

  check('学习计划：按单元/时长统计与每日结算', () => {
    run(`(function(){
      const t=Date.now();
      state.history=[
        {t:t,mode:'sentence',unit:'U1',cn:'a',en:'a b',ok:true,ms:60000,bad:0},
        {t:t,mode:'sentence',unit:'U1',cn:'b',en:'c d',ok:true,ms:60000,bad:0},
        {t:t,mode:'sentence',unit:'U2',cn:'c',en:'e f',ok:true,ms:60000,bad:0}
      ];
      state.plan={enabled:true,type:'units',target:2,reward:20,penalty:10,perCorrect:1,
        points:0,ledger:[],results:{},since:today(),lastEval:dateShift(today(),-1)};
      settlePlan();
    })()`);
    const o = JSON.parse(run('JSON.stringify({p:state.plan.points,e:state.plan.lastEval,r:state.plan.results[dateShift(today(),-1)]})'));
    assert(o.r && o.r.actual === 0 && o.r.ok === false, '昨日无练习却算达标: ' + JSON.stringify(o));
    assert(o.e === run('today()'), '结算后未推进 lastEval');
    run("state.plan.type='minutes'; state.plan.target=3; renderPlan();");
    assert(run("$('planTodayGrid').innerHTML").indexOf('今日已完成') >= 0, '今日进度未渲染');
    return '按单元 2 / 按时长 3 分钟 · 昨日未达标扣分';
  });

  check('抽奖：扣分、概率边界与奖项随时可改', () => {
    run(`(function(){state.plan.points=100; state.lottery={cost:10,
      prizes:[{id:'p1',name:'一等奖',prob:100}],log:[]};})()`);
    const before = run('state.plan.points');
    run('drawLottery()');
    const o = JSON.parse(run('JSON.stringify({p:state.plan.points,n:state.lottery.log.length,prize:state.lottery.log[0].prize})'));
    assert(o.p === before - 10 && o.n === 1 && o.prize === '一等奖', JSON.stringify(o));
    run(`(function(){updatePrizeField('p1','name','换一个奖');updatePrizeField('p1','prob',25);
      addPrize();delPrize(state.lottery.prizes[1].id);})()`);
    assert(run("state.lottery.prizes[0].name") === '换一个奖', '名称未更新');
    assert(run('Number(state.lottery.prizes[0].prob)') === 25, '概率未更新');
    assert(run('state.lottery.prizes.length') === 1, '增删奖项不对');
    run('resetPrizes()');
    assert(run('state.lottery.prizes.length') === 5, '恢复默认失败');
    run(`(function(){state.lottery.prizes[0].prob=150;const b=state.plan.points;drawLottery();
      if(state.plan.points!==b) throw new Error('概率超 100% 仍然扣分');})()`);
    return '必中奖 / 实时改名称与概率 / 超 100% 拦截';
  });

  check('SQLite 快照含计划 / 奖项 / 现场数据', () => {
    const sql = run('exportSQLite()');
    ['plan_ledger','prizes','lottery_log','app_meta'].forEach(t => {
      assert(sql.indexOf('CREATE TABLE IF NOT EXISTS ' + t) >= 0, '缺表 ' + t);
    });
    assert(sql.indexOf('INSERT OR REPLACE INTO app_meta VALUES') >= 0, '缺 app_meta 数据');
    return '4 张新表 + app_meta 三份 JSON';
  });

  check('旧存档平滑升级：补齐全部新字段且保留旧统计', () => {
    const o = JSON.parse(run(`JSON.stringify((function(){
      const s=normalizeState({stats:{attempted:7},history:[],vocab:[]});
      return {gap:s.settings.wordGap,delay:s.settings.speakDelayMs,diff:s.settings.difficulty,
        timer:s.settings.timerMode,auto:s.settings.autoVocab,ask:s.settings.askResume,
        points:s.plan.points,prizes:s.lottery.prizes.length,session:s.session,
        attempted:s.stats.attempted};
    })())`));
    assert(o.gap === 22 && o.delay === 120 && o.diff === 'normal' && o.timer === 'count', JSON.stringify(o));
    assert(o.auto === true && o.ask === true && o.points === 0 && o.prizes === 5 && o.session === null, JSON.stringify(o));
    assert(o.attempted === 7, '旧统计丢失');
    return '设置/计划/抽奖/现场全补默认值';
  });

  check('通用弹窗可显示与关闭', () => {
    run(`showModal({title:'测试',text:'内容',actions:[{label:'好'}]})`);
    assert(run("$('modalTitle').textContent") === '测试', '标题未设置');
    assert(run("$('modalMask').hidden") === false, '未显示');
    run('hideModal()');
    assert(run("$('modalMask').hidden") === true, '未关闭');
    return 'showModal / hideModal';
  });

  /* ---------------- 家长用户 / 转盘 / 长词折行 ---------------- */
  check('顶部抽奖入口与家长中心控件齐全', () => {
    ['btnWheel','btnParent','wheelMask','wheelDisc','btnSpin',
     'parentMask','parentPwd','btnParentUnlock','btnParentChange','btnParentLock',
     'prizeUnlock','prizeLocked','prizeEditor'].forEach(id => {
      assert(new RegExp('id="' + id + '"').test(html), '缺控件 ' + id);
    });
    assert(!/id="lotteryDraw"/.test(html), '侧栏旧的「抽一次」按钮未移除');
    assert(!/id="lotteryOpenWheel"/.test(html), '侧栏仍留有抽奖按钮，未真正挪到顶部');
    assert(/class="wheel-hub"/.test(html) && /class="wheel-pointer"/.test(html),
      '转盘指针 / 中心圆缺失');
    return '顶部入口 + 家长中心 + 转盘弹层';
  });

  check('家长密码只存哈希，初始密码 1234 可用', () => {
    const o = JSON.parse(run(`JSON.stringify({
      h:state.parent.hash, s:state.parent.salt, c:state.parent.changed,
      ok:parentHashOk('1234'), bad:parentHashOk('9999'),
      old:normalizeState({stats:{attempted:3}}).parent.hash
    })`));
    assert(/^[0-9a-f]{32}$/.test(o.h), '密码哈希格式不对: ' + o.h);
    assert(/^[0-9a-f]{32}$/.test(o.old), '旧存档未补默认密码哈希');
    assert(JSON.stringify(o).indexOf('1234') < 0, 'state 里出现明文密码');
    assert(o.ok === true && o.bad === false, '初始密码校验不对');
    assert(run('typeof hashPassword') === 'function', '缺哈希函数');
    return 'salt + 32 位哈希，明文不落盘';
  });

  check('修改管理密码：旧密码失效、新密码生效且立即写盘', () => {
    const before = fetchCalls.filter(c => c.path === 'save').length;
    const o = JSON.parse(run(`JSON.stringify((function(){
      parentUnlocked=true;
      $('parentOld').value='1234'; $('parentNew').value='abcd'; $('parentNew2').value='abcd';
      changeParentPassword();
      const out={changed:state.parent.changed,old:parentHashOk('1234'),
        fresh:parentHashOk('abcd'),salt:state.parent.salt!=='spelllab-parent-v1'};
      state.parent.salt='spelllab-parent-v1';
      state.parent.hash=hashPassword('1234',state.parent.salt);
      state.parent.changed=false; parentUnlocked=false;
      return out;})())`));
    assert(o.changed && !o.old && o.fresh && o.salt, JSON.stringify(o));
    assert(fetchCalls.filter(c => c.path === 'save').length > before, '改密码未立即写盘');
    return '旧密码失效 / 新 salt / 立即落盘';
  });

  check('guardParent 可扩展：未解锁先弹家长中心，解锁后执行待办', () => {
    const o = JSON.parse(run(`JSON.stringify((function(){
      parentUnlocked=false; parentPending=null;
      let done=0;
      const r1=guardParent('lottery',()=>{done++;});
      const opened=!$('parentMask').hidden;
      $('parentPwd').value='1234'; unlockParent();
      const out={r1:r1,opened:opened,done:done,unlocked:parentUnlocked,
        closed:$('parentMask').hidden,scopes:Object.keys(PARENT_SCOPES)};
      parentUnlocked=false; parentPending=null;
      return out;})())`));
    assert(o.r1 === false && o.opened === true, '未解锁未打开家长中心');
    assert(o.done === 1 && o.unlocked === true, '解锁后未执行待办操作');
    assert(o.closed === true, '解锁后弹层未关闭');
    assert(o.scopes.indexOf('lottery') >= 0, 'PARENT_SCOPES 缺 lottery 域');
    assert(run("PARENT_SCOPES.lottery.label.indexOf('抽奖')>=0") === true,
      '保护域缺少中文说明');
    return 'PARENT_SCOPES 注册 + 待办重放';
  });

  check('抽奖设置：未解锁只读、解锁后才出现编辑器', () => {
    const a = JSON.parse(run(`JSON.stringify((function(){
      parentUnlocked=false; renderLottery();
      return {lockedHidden:$('prizeLocked').hidden,editorHidden:$('prizeEditor').hidden,
        badge:$('prizeLockBadge').textContent,
        list:$('prizeLockedList').innerHTML.indexOf('%')>=0};})())`));
    assert(a.lockedHidden === false && a.editorHidden === true, JSON.stringify(a));
    assert(a.list === true, '未展示只读奖项列表');
    const b = JSON.parse(run(`JSON.stringify((function(){
      parentUnlocked=true; renderLottery();
      const out={lockedHidden:$('prizeLocked').hidden,editorHidden:$('prizeEditor').hidden};
      parentUnlocked=false; renderLottery(); return out;})())`));
    assert(b.lockedHidden === true && b.editorHidden === false, JSON.stringify(b));
    return '锁定只读 / 解锁可编辑';
  });

  check('转盘扇区按概率分配并补齐「谢谢参与」', () => {
    const o = JSON.parse(run(`JSON.stringify((function(){
      state.lottery.prizes=[{id:'a',name:'贴纸',prob:25},{id:'b',name:'绘本',prob:15}];
      const segs=wheelSegments(); renderWheel();
      const out={n:segs.length,last:segs[segs.length-1].name,
        remain:segs[segs.length-1].prob,sum:segs.reduce((a,s)=>a+s.prob,0),
        bg:$('wheelDisc').style.background,
        labels:$('wheelDisc').innerHTML.split('wheel-label').length-1,
        rows:$('wheelList').innerHTML.split('ledger-item').length-1};
      state.lottery.prizes=clone(DEFAULT_PRIZES);
      return out;})())`));
    assert(o.n === 3 && o.last === '谢谢参与' && o.remain === 60, JSON.stringify(o));
    assert(o.sum === 100, '概率总和不为 100');
    assert(String(o.bg).indexOf('conic-gradient') === 0, '未生成扇形渐变');
    assert(o.labels === 3 && o.rows === 3, '扇区标签 / 列表数量不对');
    return '25% / 15% / 60% 谢谢参与';
  });

  check('转盘 spinWheel 同步产生结果并转到对应扇区', () => {
    const o = JSON.parse(run(`JSON.stringify((function(){
      state.lottery.prizes=[{id:'a',name:'一等奖',prob:100}];
      state.lottery.cost=10; state.plan.points=50; state.lottery.log=[];
      openWheel();
      const res=spinWheel();
      const out={points:state.plan.points,log:state.lottery.log.length,
        prize:res&&res.prize,index:res&&res.index,
        transform:$('wheelDisc').style.transform,spinning:wheelSpinning,
        during:$('wheelResult').textContent};
      finishSpin(res);
      out.after=wheelSpinning; out.final=$('wheelResult').textContent;
      closeWheel();
      state.lottery.prizes=clone(DEFAULT_PRIZES);
      return out;})())`));
    assert(o.points === 40 && o.log === 1, '扣分或记录不对: ' + JSON.stringify(o));
    assert(o.prize === '一等奖' && o.index === 0, '抽奖结果不对');
    assert(String(o.transform).indexOf('rotate(') === 0, '转盘未旋转');
    assert(o.spinning === true && o.after === false, '旋转状态未复位');
    assert(o.during === '转动中…' && o.final.indexOf('一等奖') >= 0, '结果文案不对');
    return '扣 10 分 / 记录 1 条 / 转到一等奖';
  });

  check('连抽两次，指针仍停在第二次结果对应的扇区', () => {
    const o = JSON.parse(run(`JSON.stringify((function(){
      state.lottery.prizes=[{id:'a',name:'A',prob:20},{id:'b',name:'B',prob:20}];
      state.lottery.cost=1; state.plan.points=100;
      wheelRotation=0; wheelSpinning=false;
      openWheel();
      const r1=spinWheel(); finishSpin(r1);
      const r2=spinWheel(); finishSpin(r2);
      const seg=wheelSegs.find(s=>s.index===r2.index)||wheelSegs[wheelSegs.length-1];
      const pointing=(((-wheelRotation)%360)+360)%360;
      const out={idx:r2.index,start:seg.start,end:seg.end,pointing:pointing};
      closeWheel(); state.lottery.prizes=clone(DEFAULT_PRIZES);
      return out;})())`));
    assert(o.pointing >= o.start - 0.01 && o.pointing <= o.end + 0.01,
      '指针没落在结果扇区: ' + JSON.stringify(o));
    return '第 2 次仍准确停在 ' + o.idx + ' 号扇区';
  });

  check('全库导出含家长密码哈希、不含明文', () => {
    const sql = run('exportSQLite()');
    assert(sql.indexOf("VALUES('parent'") >= 0, 'app_meta 缺 parent');
    assert(sql.indexOf('hash') >= 0, '导出缺哈希字段');
    assert(sql.indexOf('1234') < 0, '导出里出现明文密码');
    return 'app_meta 四份 JSON，密码只以哈希出现';
  });

  const failed = results.filter(r => r[1] === 'FAIL');
  results.forEach(r => console.log('[' + r[1] + ']   ' + r[0] + (r[2] ? '  -> ' + r[2] : '')));
  console.log('\n合计 ' + results.length + ' 项，失败 ' + failed.length + ' 项');
  if(failed.length) process.exitCode = 1;
})();
