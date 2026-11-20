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
  setInterval: (fn, ms) => { scheduled.push({fn, ms, interval:true}); return scheduled.length; },
  clearTimeout: () => {},
  clearInterval: () => {},
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
/* 抽奖有「每日次数 / 每日一次中奖」限制，跨测试需要模拟新的一天，避免相互污染 */
function newLotteryDay(){ run("state.lottery.daily={date:today(),draws:0,won:false,afterWin:0}"); }

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
    newLotteryDay();
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
    newLotteryDay();
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
      state.lottery.daily={date:today(),draws:0,won:false,afterWin:0};
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
    assert(o.during === '正在开盒…' && o.final.indexOf('一等奖') >= 0, '结果文案不对');
    return '扣 10 分 / 记录 1 条 / 转到一等奖';
  });

  check('连抽两次，指针仍停在第二次结果对应的扇区', () => {
    const o = JSON.parse(run(`JSON.stringify((function(){
      state.lottery.prizes=[{id:'a',name:'A',prob:20},{id:'b',name:'B',prob:20}];
      state.lottery.cost=1; state.plan.points=100; state.lottery.dailyLimit=10;
      state.lottery.daily={date:today(),draws:0,won:false,afterWin:0};
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

  check('惊喜盲盒视觉结构与开盒状态机齐全', () => {
    ['boxScene','boxRays','boxBurst','mysteryBox','box-lid','box-body','box-bow',
     'box-ribbon','box-shadow','box-stars','legacy-wheel'].forEach(k => {
      assert(html.indexOf(k) >= 0, '缺盲盒元素 ' + k);
    });
    assert(html.indexOf('@keyframes boxShake') >= 0, '缺晃动动画');
    assert(html.indexOf('@keyframes burstFly') >= 0, '缺彩带迸发动画');
    assert(html.indexOf('@keyframes boxFloat') >= 0, '缺漂浮动画');
    assert(html.indexOf(".box-scene.reveal .box-lid") >= 0, '缺掀盖状态');
    assert(html.indexOf("$('mysteryBox').addEventListener('click',spinWheel)") >= 0,
      '点盒子未接抽奖');
    // 开盒状态机：openWheel 复位 → spinWheel 进入 opening → finishSpin 进入 reveal
    const o = JSON.parse(run(`JSON.stringify((function(){
      state.lottery.prizes=[{id:'a',name:'奖',prob:100}]; state.plan.points=50;
      state.lottery.daily={date:today(),draws:0,won:false,afterWin:0};
      openWheel(); const a=$('boxScene').className;
      const r=spinWheel(); const b=$('boxScene').className;
      finishSpin(r); const c=$('boxScene').className;
      closeWheel(); state.lottery.prizes=clone(DEFAULT_PRIZES);
      return {a:a,b:b,c:c};})())`));
    assert(o.a === 'box-scene' && o.b === 'box-scene opening' && o.c === 'box-scene reveal',
      '开盒状态机不对: ' + JSON.stringify(o));
    return '漂浮 + 晃动 + 掀盖 + 彩带 + 状态机复位/开盒/揭晓';
  });

  /* ---------------- 转盘重做：视觉结构 + 改奖项后的显示一致性 ---------------- */
  check('新转盘视觉结构齐全', () => {
    ['wheel-lights','wheel-frame','wheel-hub','wheel-pointer','wheel-prize','wheel-warn',
     'wheelHub','wheelPrizeName','wheelPrizeTag','wheelResult'].forEach(k => {
      assert(html.indexOf(k) >= 0, '缺视觉元素 ' + k);
    });
    assert(html.indexOf('@keyframes wheelTwinkle') >= 0, '缺灯环闪烁动画');
    assert(html.indexOf('repeating-conic-gradient') >= 0, '缺金色灯环');
    assert(html.indexOf('.wheel-list .ledger-item i') >= 0, '缺彩色图例圆点');
    assert(html.indexOf('resetWheelAngle') >= 0 && html.indexOf('lotteryChanged') >= 0,
      '缺角度复位 / 改动同步');
    return '灯环 + 外框 + 图例 + 结果卡片 + 警告条';
  });

  check('改奖项后转盘扇区、图例立即刷新且角度复位', () => {
    const o = JSON.parse(run(`JSON.stringify((function(){
      parentUnlocked=true; wheelSpinning=false;
      state.lottery.prizes=[{id:'a',name:'贴纸',prob:25},{id:'b',name:'绘本',prob:15}];
      openWheel();
      wheelRotation=1234; $('wheelDisc').style.transform='rotate(1234deg)';
      updatePrizeField('a','name','超级大奖');
      const out={rot:wheelRotation,tr:$('wheelDisc').style.transform,
        segs:wheelSegs.map(s=>s.name),list:$('wheelList').innerHTML,
        labels:$('wheelDisc').innerHTML,result:$('wheelResult').textContent};
      closeWheel(); parentUnlocked=false;
      state.lottery.prizes=clone(DEFAULT_PRIZES);
      return out;})())`));
    assert(o.rot === 0 && o.tr === 'rotate(0deg)', '圆盘角度未复位: ' + JSON.stringify([o.rot,o.tr]));
    assert(o.segs.indexOf('超级大奖') >= 0, '扇区名称未刷新');
    assert(o.list.indexOf('超级大奖') >= 0 && o.labels.indexOf('超级大奖') >= 0,
      '图例 / 盘面标签未刷新');
    assert(o.result.indexOf('已重置') >= 0, '未提示转盘已重置');
    return '角度归零 + 扇区/图例/提示同步';
  });

  check('编辑与新增奖项时概率自动收敛到 100% 以内', () => {
    const o = JSON.parse(run(`JSON.stringify((function(){
      parentUnlocked=true; wheelSpinning=false; $('wheelMask').hidden=true;
      state.lottery.prizes=[{id:'a',name:'A',prob:80},{id:'b',name:'B',prob:20}];
      addPrize();
      const afterAdd=prizeTotal();
      updatePrizeField('a','prob','200');
      const out={afterAdd:afterAdd,total:prizeTotal(),a:state.lottery.prizes[0].prob,
        newP:state.lottery.prizes[2].prob,sumText:$('prizeSum').textContent,
        warn:$('prizeSum').classList.contains('warn')};
      parentUnlocked=false; state.lottery.prizes=clone(DEFAULT_PRIZES);
      return out;})())`));
    assert(o.afterAdd === 100 && o.total === 100, '总概率溢出: ' + JSON.stringify(o));
    assert(o.a === 80 && o.newP === 0, '单项概率不对: ' + JSON.stringify(o));
    assert(o.warn === false && o.sumText.indexOf('100%') >= 0, '汇总显示不对: ' + o.sumText);
    return '新增自动 0% + 输入 200% 截到 80%';
  });

  check('旧存档 / 备份中超过 100% 的概率加载时自动收敛', () => {
    const o = JSON.parse(run(`JSON.stringify((function(){
      const s=normalizeState({lottery:{cost:10,prizes:[
        {id:'a',name:'A',prob:90},{id:'b',name:'B',prob:90}],log:[]}});
      return {a:s.lottery.prizes[0].prob,b:s.lottery.prizes[1].prob,
        total:s.lottery.prizes.reduce((x,p)=>x+p.prob,0)};})())`));
    assert(o.total === 100 && o.a === 90 && o.b === 10, JSON.stringify(o));
    return '90% + 90% → 90% + 10%';
  });

  check('0% 奖项保留在禁用图例里，不占扇区', () => {
    const o = JSON.parse(run(`JSON.stringify((function(){
      state.lottery.prizes=[{id:'a',name:'停用的奖',prob:0},{id:'b',name:'贴纸',prob:30}];
      renderWheel();
      const out={segs:wheelSegs.length,names:wheelSegs.map(s=>s.name),
        rows:$('wheelList').innerHTML.split('ledger-item').length-1,
        off:$('wheelList').innerHTML.indexOf('停用的奖')>=0,
        zero:$('wheelList').innerHTML.indexOf('0%')>=0};
      state.lottery.prizes=clone(DEFAULT_PRIZES); return out;})())`));
    assert(o.segs === 2 && o.names[1] === '谢谢参与', JSON.stringify(o));
    assert(o.rows === 3 && o.off && o.zero, '0% 奖项未保留: ' + JSON.stringify(o));
    return '2 个扇区 + 3 行图例（含 0% 项）';
  });

  check('长奖项名生成短标签，窄扇区隐藏盘面文字', () => {
    const o = JSON.parse(run(`JSON.stringify((function(){
      state.lottery.prizes=[
        {id:'a',name:'一张超级无敌大奖券',prob:5},
        {id:'b',name:'internationalization',prob:5},
        {id:'c',name:'谢谢惠顾再来一次哦',prob:5}];
      renderWheel();
      const h=$('wheelDisc').innerHTML;
      const out={short:shortWheelName('一张超级无敌大奖券'),
        en:shortWheelName('internationalization'),
        tight:(h.match(/wheel-label tight/g)||[]).length,
        full:h.indexOf('internationalization')>=0};
      state.lottery.prizes=clone(DEFAULT_PRIZES); return out;})())`));
    assert(o.short.length <= 6 && o.en.length <= 10, JSON.stringify(o));
    assert(o.tight === 3 && o.full === false, '窄扇区仍显示长名称: ' + JSON.stringify(o));
    return '短名 + tight 隐藏 + 完整名留在图例';
  });

  check('概率非法时转盘显示警告并禁用抽奖', () => {
    const o = JSON.parse(run(`JSON.stringify((function(){
      state.lottery.prizes=[{id:'a',name:'A',prob:80},{id:'b',name:'B',prob:40}];
      state.plan.points=100;
      renderWheel(); syncWheelButtons();
      const out={invalid:wheelInvalid,total:wheelTotal,
        warn:$('wheelWarn').classList.contains('show'),
        text:$('wheelWarn').textContent,
        disabled:$('btnSpin').disabled,hub:$('wheelHub').classList.contains('off')};
      state.lottery.prizes=clone(DEFAULT_PRIZES); wheelInvalid=false;
      return out;})())`));
    assert(o.invalid === true && o.total === 120, JSON.stringify(o));
    assert(o.warn && o.text.indexOf('120%') >= 0 && o.disabled && o.hub,
      '未提示或未禁用: ' + JSON.stringify(o));
    return '120% → 警告条 + 按钮与中心圆禁用';
  });

  /* ---------------- 扇区 / 标签 / 指针 / 结果的角度基准必须一致 ---------------- */
  check('盘面扇区起点为 12 点，与标签和指针同一角度基准', () => {
    assert(html.indexOf('conic-gradient(from 0deg,') >= 0,
      '扇区渐变未使用 from 0deg');
    assert(!/conic-gradient\(from -90deg/.test(html),
      '盘面扇区仍被逆时针旋转 90°，会与标签和指针错开一个象限');
    const o = JSON.parse(run(`JSON.stringify((function(){
      state.lottery.prizes=[{id:'a',name:'A',prob:25},{id:'b',name:'B',prob:15}];
      renderWheel();
      return {bg:$('wheelDisc').style.background,
        first:wheelSegs[0].start,mids:wheelSegs.map(s=>s.mid),
        labels:$('wheelDisc').innerHTML};})())`));
    assert(String(o.bg).indexOf('conic-gradient(from 0deg,') === 0,
      '运行时渐变起点不对: ' + String(o.bg).slice(0, 60));
    assert(o.first === 0, '第一个扇区不是从 0°(12 点) 开始');
    // 每个标签的 transform 是 rotate(mid) ... rotate(-mid) 的负值不参与匹配
    const angles = (o.labels.match(/rotate\(([\d.]+)deg\)/g) || [])
      .map(x => Number(x.match(/([\d.]+)deg/)[1]));
    assert(angles.length === o.mids.length,
      '标签角度数量与扇区不符: ' + JSON.stringify([angles, o.mids]));
    o.mids.forEach((m, i) => {
      assert(Math.abs(angles[i] - m) < 0.02,
        '第 ' + i + ' 个标签角度 ' + angles[i] + ' 与扇区中点 ' + m + ' 不一致');
    });
    return 'from 0deg + 首扇区 0° + 标签角度 == 扇区中点';
  });

  check('结果名称 / 下标 / 颜色与指针所停扇区完全一致（连抽 5 次）', () => {
    const o = JSON.parse(run(`JSON.stringify((function(){
      state.lottery.prizes=[{id:'a',name:'一等奖',prob:20},
        {id:'b',name:'二等奖',prob:20},{id:'c',name:'三等奖',prob:10}];
      state.lottery.cost=1; state.plan.points=200;
      wheelRotation=0; wheelSpinning=false; openWheel();
      const out=[];
      for(let i=0;i<5;i++){
        /* 本用例只验证落点与扇区一致，每抽前复位当天状态以绕过「每天一次中奖」 */
        state.lottery.daily={date:today(),draws:0,won:false,afterWin:0};
        const r=spinWheel(); finishSpin(r);
        const pointing=(((-wheelRotation)%360)+360)%360;
        const seg=wheelSegs.find(s=>s.index===r.index);
        out.push({prize:r.prize,index:r.index,color:r.color,
          segName:seg&&seg.name,segColor:seg&&seg.color,
          start:seg&&seg.start,end:seg&&seg.end,pointing:pointing});
      }
      closeWheel(); state.lottery.prizes=clone(DEFAULT_PRIZES);
      return out;})())`));
    o.forEach((x, i) => {
      assert(x.segName, '第 ' + (i + 1) + ' 次结果找不到对应扇区');
      assert(x.prize === x.segName,
        '第 ' + (i + 1) + ' 次结果名与扇区名不符: ' + JSON.stringify(x));
      assert(x.color === x.segColor,
        '第 ' + (i + 1) + ' 次结果颜色与扇区颜色不符: ' + JSON.stringify(x));
      assert(x.pointing >= x.start - 0.02 && x.pointing <= x.end + 0.02,
        '第 ' + (i + 1) + ' 次指针没停在结果扇区: ' + JSON.stringify(x));
    });
    return '5 次连抽：名称 / 颜色 / 落点全部对齐';
  });

  check('结果卡片色点与图例高亮指向同一扇区', () => {
    const o = JSON.parse(run(`JSON.stringify((function(){
      state.lottery.prizes=[{id:'a',name:'特等奖',prob:100}];
      state.lottery.cost=1; state.plan.points=50;
      state.lottery.daily={date:today(),draws:0,won:false,afterWin:0};
      wheelRotation=0; wheelSpinning=false; openWheel();
      const r=spinWheel(); finishSpin(r);
      const out={prize:r.prize,color:r.color,
        dot:$('wheelPrizeDot').style.background,
        name:$('wheelPrizeName').textContent,
        list:$('wheelList').innerHTML,
        hits:($('wheelList').innerHTML.match(/ledger-item hit/g)||[]).length};
      closeWheel(); state.lottery.prizes=clone(DEFAULT_PRIZES);
      return out;})())`));
    assert(o.prize === '特等奖' && o.name === '特等奖', '结果名称不对');
    assert(o.dot === o.color, '结果色点不是命中扇区颜色: ' + JSON.stringify(o));
    assert(o.hits === 1 && o.list.indexOf('data-seg="0"') >= 0,
      '图例未高亮命中扇区: ' + JSON.stringify(o));
    return '色点 = 扇区色 + 图例恰好高亮 1 行';
  });

  check('「谢谢参与」也落在自己的灰色扇区，不串到别的奖', () => {
    const o = JSON.parse(run(`JSON.stringify((function(){
      state.lottery.prizes=[{id:'a',name:'唯一奖',prob:0}];
      state.lottery.cost=1; state.plan.points=50;
      state.lottery.daily={date:today(),draws:0,won:false,afterWin:0};
      wheelRotation=0; wheelSpinning=false; openWheel();
      const r=spinWheel(); finishSpin(r);
      const seg=wheelSegs.find(s=>s.index===r.index);
      const out={prize:r.prize,index:r.index,segName:seg&&seg.name,
        color:r.color,segColor:seg&&seg.color,
        pointing:(((-wheelRotation)%360)+360)%360,
        start:seg&&seg.start,end:seg&&seg.end};
      closeWheel(); state.lottery.prizes=clone(DEFAULT_PRIZES);
      return out;})())`));
    assert(o.prize === '谢谢参与' && o.index === -1, JSON.stringify(o));
    assert(o.segName === '谢谢参与' && o.color === o.segColor,
      '谢谢参与没有对应到灰色扇区: ' + JSON.stringify(o));
    assert(o.pointing >= o.start - 0.02 && o.pointing <= o.end + 0.02,
      '指针没停在谢谢参与扇区: ' + JSON.stringify(o));
    return '0% 奖项时指针停在整圈灰色扇区';
  });

  check('盲盒揭晓后隐藏未拆盒子、中央直接显示奖品文字', () => {
    assert(html.indexOf('boxPrizeReveal') >= 0, '缺奖品文字节点');
    assert(html.indexOf('.box-scene.reveal .mystery-box{animation:none;opacity:0') >= 0,
      'reveal 态未隐去盒子本体');
    assert(html.indexOf('.box-scene.reveal .box-prize-reveal{opacity:1') >= 0,
      'reveal 态未显示奖品文字');
    const o = JSON.parse(run(`JSON.stringify((function(){
      state.lottery.prizes=[{id:'a',name:'免写一次作业',prob:100}];
      state.lottery.cost=1; state.plan.points=50;
      state.lottery.daily={date:today(),draws:0,won:false,afterWin:0};
      openWheel();
      const before=$('boxPrizeName').textContent;
      const r=spinWheel();
      const during=$('boxPrizeName').textContent;
      finishSpin(r);
      const out={before:before,during:during,after:$('boxPrizeName').textContent,
        tag:$('boxPrizeTag').textContent,note:$('boxPrizeNote').textContent,
        scene:$('boxScene').className};
      openWheel(); out.reset=$('boxPrizeName').textContent;
      closeWheel(); state.lottery.prizes=clone(DEFAULT_PRIZES);
      return out;})())`));
    assert(o.before === '' && o.during === '免写一次作业' && o.after === '免写一次作业',
      '奖品文字未在开盒时写入: ' + JSON.stringify(o));
    assert(o.scene === 'box-scene reveal' && o.tag.indexOf('恭喜抽中') >= 0,
      '揭晓态/标签不对: ' + JSON.stringify(o));
    assert(o.reset === '', '再次打开未清空上次奖品');
    return '开盒即写入奖品 · 揭晓只留文字 · 重开清空';
  });

  check('打字得分可配置（默认每局 1 分、可改可归零，与星级无关）', () => {
    assert(html.indexOf('typingPointsInput') >= 0, '缺打字积分配置项');
    assert(html.indexOf('state.lottery.typingPoints') >= 0, '未读取打字积分配置');
    const o = JSON.parse(run(`JSON.stringify((function(){
      state.lottery.typingPoints=1;
      const p0=Number(state.plan.points)||0, n0=state.plan.ledger.length;
      window.TypingDuck.onFinish({mode:'word',stars:3,score:999});
      const p1=Number(state.plan.points)||0;
      window.TypingDuck.onFinish({mode:'abc',stars:1,score:10});
      const d1=p1-p0, d2=(Number(state.plan.points)||0)-p1;
      state.lottery.typingPoints=5;
      const p2=Number(state.plan.points)||0;
      window.TypingDuck.onFinish({mode:'word',stars:1,score:1});
      const d3=(Number(state.plan.points)||0)-p2;
      state.lottery.typingPoints=0;
      const p3=Number(state.plan.points)||0;
      window.TypingDuck.onFinish({mode:'word',stars:5,score:500});
      const d4=(Number(state.plan.points)||0)-p3;
      state.lottery.typingPoints=1;
      return {d1:d1,d2:d2,d3:d3,d4:d4,n:state.plan.ledger.length-n0};})())`));
    assert(o.d1 === 1 && o.d2 === 1, '默认每局应 +1: ' + JSON.stringify(o));
    assert(o.d3 === 5, '改为 5 分后未生效: ' + JSON.stringify(o));
    assert(o.d4 === 0, '设为 0 仍加了分: ' + JSON.stringify(o));
    return '默认 +1 / 改 5 分 +5 / 设 0 不计分 · 与星级无关';
  });

  check('复习回车：提交后再回车直接下一题，听写同理', () => {
    assert(html.indexOf("else if(srPhase==='answered'){ srIdx++; srNextCard(); }") >= 0,
      '复习未接 answered 回车');
    assert(html.indexOf("else if(dcPhase==='answered') dcAdvance(false);") >= 0,
      '听写未接 answered 回车');
    assert(html.indexOf("if($('growthView').hidden) return;") >= 0,
      '文档级兜底缺可见性守卫');
    const o = JSON.parse(run(`JSON.stringify((function(){
      memo().srs={};
      srQueue=[{en:'cat',cn:'猫'},{en:'dog',cn:'狗'}]; srIdx=0; srRight=0;
      srCurrent=srQueue[0]; srPhase='ask';
      srNextCard(); $('srInput').value='cat';
      const ev1={key:'Enter',preventDefault(){},stopPropagation(){}};
      $('srInput').listeners.keydown[0](ev1);
      const after1={phase:srPhase,idx:srIdx,disabled:$('srInput').disabled};
      const ev2={key:'Enter',preventDefault(){},stopPropagation(){}};
      $('srInput').listeners.keydown[0](ev2);
      const after2={phase:srPhase,idx:srIdx,en:srCurrent.en,
        empty:$('srInput').value==='',enabled:!$('srInput').disabled};
      return {after1:after1,after2:after2};})())`));
    assert(o.after1.phase === 'answered' && o.after1.idx === 0 && o.after1.disabled,
      '第一次回车未提交: ' + JSON.stringify(o));
    assert(o.after2.idx === 1 && o.after2.phase === 'ask' && o.after2.en === 'dog' &&
      o.after2.empty && o.after2.enabled, '第二次回车未进入下一题: ' + JSON.stringify(o));
    return '第 1 次提交锁定 · 第 2 次切到 dog';
  });

  check('教材按上册/下册分册管理并可筛选', () => {
    assert(html.indexOf('id="volumeFilter"') >= 0, '缺册别筛选下拉');
    assert(html.indexOf('id="tbVolume"') >= 0, '缺新建教材包册别选择');
    const o = JSON.parse(run(`JSON.stringify((function(){
      const before={v:(state.filter.volumeId||'all'),n:state.textbooks.length};
      const p1=makePack('测试教材 四年级上册','g4','b_pep','upper');
      const p2=makePack('测试教材 四年级下册','g4','b_pep','lower');
      const p3=makePack('测试教材 不分册','g4','b_pep','');
      const volumes={p1:packVolume(p1),p2:packVolume(p2),p3:packVolume(p3)};
      state.filter={gradeId:'g4',bookId:'b_pep',volumeId:'upper'};
      renderFilters();
      const upperUnits=unitsInScope().filter(u=>u.packId===p1.id||u.packId===p2.id||u.packId===p3.id);
      state.filter.volumeId='lower'; renderFilters();
      const lowerUnits=unitsInScope().filter(u=>u.packId===p1.id||u.packId===p2.id||u.packId===p3.id);
      state.filter.volumeId='all'; renderFilters();
      const allVol=unitsInScope().filter(u=>u.packId===p1.id||u.packId===p2.id||u.packId===p3.id);
      const payload=packExportPayload([p1]);
      state.textbooks=state.textbooks.filter(p=>p.id!==p1.id&&p.id!==p2.id&&p.id!==p3.id);
      saveState(); renderFilters();
      return {before:before,volumes:volumes,
        upper:upperUnits.length,lower:lowerUnits.length,all:allVol.length,
        exported:payload.packs[0].volume};})())`));
    assert(o.before.v === 'all', '默认册别筛选不是全部: ' + JSON.stringify(o));
    assert(o.volumes.p1 === 'upper' && o.volumes.p2 === 'lower' && o.volumes.p3 === '',
      '册别未被正确保存/推断: ' + JSON.stringify(o));
    assert(o.exported === 'upper', '导出的教材包 JSON 未带册别');
    return '上册/下册/未分册 · 导出带册别 · 筛选可区分';
  });

  check('打字单词统计：练习次数、错误次数、错词重点练', () => {
    ['wordStats','noteWordStart','noteWordWrong','noteWordDone','weakWords','setupWeakWord',
     'wordStatsBtn','wordStatList','card-indigo','data-mode="weakword"'].forEach(k =>
      assert(html.indexOf(k) >= 0, '缺单词统计元素 ' + k));
    const o = JSON.parse(run(`JSON.stringify((function(){
      var captured=null;
      window.TypingDuck.setSaveIO(function(){return null;},function(obj){captured=obj;});
      var grid=document.getElementById('td-modeGrid');
      grid.listeners.click[0]({target:{closest:function(s){return s==='.mode-card'?{dataset:{mode:'word'}}:null;}}});
      var target=document.getElementById('td-targetDisplay');
      var line=target.children.filter(function(c){return c.className==='word-letters';})[0];
      if(!line) return {err:'no word line'};
      var word=line.children.map(function(s){return s.textContent;}).join('');
      var kb=document.getElementById('td-keyboard');
      function press(ch){
        for(var i=0;i<kb.children.length;i++){
          var row=kb.children[i];
          for(var j=0;j<row.children.length;j++){
            var k=row.children[j];
            if(k.dataset.key===ch && k.listeners.pointerdown){
              k.listeners.pointerdown[0]({preventDefault:function(){}}); return true;
            }
          }
        } return false;
      }
      var first=word.charAt(0), wrongKey=first==='z'?'x':'z';
      press(wrongKey);
      for(var i=0;i<word.length;i++) press(word.charAt(i));
      var st=(captured&&captured.wordStats&&captured.wordStats[word.toLowerCase()])||{};
      var statBtn=document.getElementById('td-wordStatsBtn');
      statBtn.listeners.click[0]({});
      var listHtml=document.getElementById('td-wordStatList').innerHTML;
      grid.listeners.click[0]({target:{closest:function(s){return s==='.mode-card'?{dataset:{mode:'weakword'}}:null;}}});
      var focusLine=document.getElementById('td-targetDisplay').children
        .filter(function(c){return c.className==='word-letters';})[0];
      var focusWord=focusLine?focusLine.children.map(function(s){return s.textContent;}).join(''):'';
      return {word:word,stat:st,listHas:listHtml.indexOf(word.toLowerCase())>=0,focusWord:focusWord};
    })())`));
    if (o.err) throw new Error(o.err);
    assert(o.stat.n >= 1, '练习次数未记录: ' + JSON.stringify(o));
    assert(o.stat.bad >= 1, '错误次数未记录: ' + JSON.stringify(o));
    assert(o.listHas, '统计弹窗未列出该单词: ' + JSON.stringify(o));
    assert(o.focusWord === o.word, '重点练词未取到错词: ' + JSON.stringify(o));
    return o.word + ' 练 ' + o.stat.n + ' 次 / 错 ' + o.stat.bad + ' 次 · 重点练取回该词';
  });

  check('待输入字母高亮：首个字母高亮、打过的字母不再高亮', () => {
    assert(html.indexOf("s.className = i === 0 ? 'wl current' : 'wl'") >= 0,
      '首个字母未加 current 高亮');
    assert(html.indexOf("spans[G.charIndex].classList.remove('current')") >= 0,
      '打过的字母未移除 current');
    assert(html.indexOf('.word-letters .wl.current::after') >= 0,
      '缺高亮指示箭头');
    return '首字高亮 + 打过变绿去高亮 + 闪烁光标';
  });

  check('打字游戏展示当前教材单元学习进度', () => {
    ['setUnitProvider','td-unitCard','td-unitName','td-unitBar','td-unitWords','td-unitDone',
     'td-unitBad','td-unitMastered','td-unitPracticeBtn','td-unitFocusBtn','renderUnitProgress',
     'startUnitPractice'].forEach(k => assert(html.indexOf(k) >= 0, '缺单元进度元素 ' + k));
    const o = JSON.parse(run(`JSON.stringify((function(){
      const before=JSON.stringify(state.typingDuck||{});
      const info=window.TypingDuck._testUnitInfo ? window.TypingDuck._testUnitInfo() : null;
      const u=currentUnit();
      const words=(u.words||[]).map(w=>String(w[0]||'').trim().toLowerCase())
        .filter(w=>/^[a-z][a-z'-]*$/.test(w));
      const word=words[0]||'apple';
      const td=state.typingDuck||(state.typingDuck={});
      td.wordStats=td.wordStats||{};
      td.wordStats[word]={n:3,bad:2,ok:1,cn:'测试'};
      window.TypingDuck.setSaveIO(function(){return state.typingDuck;},function(obj){state.typingDuck=obj;});
      window.TypingDuck.reloadSave();
      const done=document.getElementById('td-unitDone').textContent;
      const bad=document.getElementById('td-unitBad').textContent;
      const width=document.getElementById('td-unitBar').style.width;
      const name=document.getElementById('td-unitName').textContent;
      const badBtn=document.getElementById('td-unitFocusBtn');
      return {word:word,done:done,bad:bad,width:width,name:name,
        enabled:!badBtn.disabled,unit:u.name||''};})())`));
    assert(Number(o.done) >= 1, '已练词数未随单元词表更新: ' + JSON.stringify(o));
    assert(Number(o.bad) >= 1, '错过词数未统计: ' + JSON.stringify(o));
    assert(o.width && o.width !== '0%', '进度条未更新: ' + JSON.stringify(o));
    assert(o.enabled === true, '错词重点练按钮未启用: ' + JSON.stringify(o));
    return o.name + ' · 已练 ' + o.done + ' / 错 ' + o.bad + ' · 进度 ' + o.width;
  });

  check('纸笔听写：中文/英文读音、写在纸上、家长解锁后批阅并计分', () => {
    ['gPaper','data-g="paper"','ppStart','ppLang','ppKind','ppList','ppSave','ppShowGrade',
     "paperdict:{label:'纸笔听写批改'",'speakLang','ppRenderGrade'].forEach(k =>
      assert(html.indexOf(k) >= 0, '缺纸笔听写元素 ' + k));
    const o = JSON.parse(run(`JSON.stringify((function(){
      const u=currentUnit();
      const words=(u.words||[]).filter(w=>w&&w[0]);
      const sentences=(u.sentences||[]).filter(q=>q&&q.en);
      const pool=words.concat(sentences);
      if(!pool.length) return {err:'no content'};
      const beforePoints=Number(state.plan.points)||0;
      const beforeHistory=(state.history||[]).length;
      const beforeSrs=Object.keys(memo().srs||{}).length;
      $('ppKind').value='mix'; $('ppLang').value='cn'; $('ppCount').value='5';
      ppStart();
      const total=ppQueue.length;
      const prompts=[];
      while(ppPhase==='ask'){ prompts.push($('ppPrompt').innerHTML); ppNext(); }
      const speakBtn=$('ppSpeak'); // 再听一遍按钮存在（听写只出声、不显示答案）
      ppShowGrade();                // 未解锁 → 走 guardParent 弹层
      const gate=$('parentMask').hidden;
      parentUnlocked=true;
      ppReveal();
      const htmlList=$('ppList').innerHTML;
      const revealed=htmlList.indexOf(esc(ppQueue[0].en))>=0;
      ppMarks=ppQueue.map((_,i)=> i===0);
      ppSave();
      const afterPoints=Number(state.plan.points)||0;
      const afterHistory=(state.history||[]).length;
      const afterSrs=Object.keys(memo().srs||{}).length;
      const last=memo().paperDict.last;
      const types=(state.history||[]).slice(beforeHistory).map(x=>x.mode);
      parentUnlocked=false;
      return {total:total,prompts:prompts.length,gate:gate,revealed:revealed,
        points:afterPoints-beforePoints,history:afterHistory-beforeHistory,
        srs:afterSrs-beforeSrs,types:types,lastRight:last&&last.right,
        hasSpeak:!!speakBtn};})())`));
    if (o.err) throw new Error(o.err);
    assert(o.total >= 1 && o.prompts === o.total, '听写题数不对: ' + JSON.stringify(o));
    assert(o.gate === false, '批阅未受家长密码保护: ' + JSON.stringify(o));
    assert(o.revealed === true, '家长解锁后未显示答案: ' + JSON.stringify(o));
    assert(o.history === o.total && o.types.every(t => t === 'paperdict'),
      '批阅结果未写入历史: ' + JSON.stringify(o));
    assert(o.srs >= 1 && o.lastRight === 1, '错题未进入复习计划/统计不对: ' + JSON.stringify(o));
    assert(o.points >= 0, '积分未结算: ' + JSON.stringify(o));
    return o.total + ' 题 · 家长锁生效 · 判对 1 题记入历史/复习';
  });

  check('抽奖每日次数上限：当天抽满后不再扣分也不出结果', () => {
    const o = JSON.parse(run(`JSON.stringify((function(){
      state.lottery.prizes=[{id:'a',name:'奖',prob:100}];
      state.lottery.cost=1; state.plan.points=100; state.lottery.log=[];
      state.lottery.dailyLimit=3;
      state.lottery.daily={date:today(),draws:0,won:false,afterWin:0};
      const p0=state.plan.points, rs=[];
      for(let i=0;i<4;i++){ const r=drawLottery(); rs.push(r?r.prize:null); }
      return {spent:p0-state.plan.points,draws:state.lottery.daily.draws,
        rs:rs,log:state.lottery.log.length,left:lotteryLeft(),
        over:drawLottery()};})())`));
    /* 基础 1 分，中奖后再抽翻倍为 2、4，共扣 7；第 4 次超限被拦截 */
    assert(o.spent === 7 && o.draws === 3 && o.log === 3,
      '每日上限未生效: ' + JSON.stringify(o));
    assert(o.rs[3] === null && o.over === null, '超限仍能抽奖: ' + JSON.stringify(o));
    newLotteryDay(); run('state.plan.points=100');
    return '每天 3 次 · 第 4 次返回 null 且不扣分';
  });

  check('抽奖每天只中奖一次，中奖后必为「谢谢参与」', () => {
    const o = JSON.parse(run(`JSON.stringify((function(){
      state.lottery.prizes=[{id:'a',name:'免写一次',prob:100}];
      state.lottery.cost=1; state.plan.points=100; state.lottery.dailyLimit=5;
      state.lottery.daily={date:today(),draws:0,won:false,afterWin:0};
      const r1=drawLottery();
      const won1=state.lottery.daily.won;
      const r2=drawLottery();
      const r3=drawLottery();
      return {p1:r1.prize,i1:r1.index,won1:won1,
        p2:r2.prize,i2:r2.index,p3:r3.prize,i3:r3.index};})())`));
    assert(o.p1 === '免写一次' && o.i1 === 0 && o.won1 === true,
      '首次未中奖: ' + JSON.stringify(o));
    assert(o.p2 === '谢谢参与' && o.i2 === -1 && o.p3 === '谢谢参与' && o.i3 === -1,
      '中奖后仍能中奖: ' + JSON.stringify(o));
    newLotteryDay(); run('state.plan.points=100');
    return '首抽中奖 · 之后固定「谢谢参与」';
  });

  check('中奖后再抽消耗逐次翻倍，且可配置上限与得分转换', () => {
    const o = JSON.parse(run(`JSON.stringify((function(){
      state.lottery.prizes=[{id:'a',name:'奖',prob:100}];
      state.lottery.cost=2; state.plan.points=1000; state.lottery.dailyLimit=6;
      state.lottery.daily={date:today(),draws:0,won:false,afterWin:0};
      const c0=lotteryCostNow();
      const r1=drawLottery(); const c1=lotteryCostNow();
      const p1=state.plan.points; const r2=drawLottery(); const spent2=p1-state.plan.points;
      const c2=lotteryCostNow();
      const p2=state.plan.points; const r3=drawLottery(); const spent3=p2-state.plan.points;
      /* 配置读写 */
      const cfg=normalizeState({lottery:{cost:10,dailyLimit:99,typingPoints:50,
        daily:{date:today(),draws:-5,won:true,afterWin:99}}});
      return {c0:c0,c1:c1,c2:c2,spent2:spent2,spent3:spent3,
        limit:cfg.lottery.dailyLimit,tp:cfg.lottery.typingPoints,
        draws:cfg.lottery.daily.draws,after:cfg.lottery.daily.afterWin};})())`));
    assert(o.c0 === 2, '基础消耗不对: ' + JSON.stringify(o));
    assert(o.c1 === 4 && o.spent2 === 4, '中奖后首次未翻倍为 4: ' + JSON.stringify(o));
    assert(o.c2 === 8 && o.spent3 === 8, '第 3 次未翻倍为 8: ' + JSON.stringify(o));
    assert(o.limit === 10 && o.tp === 50, '配置未生效或钳制失败: ' + JSON.stringify(o));
    assert(o.draws === 0 && o.after === 99, '计数钳制不对: ' + JSON.stringify(o));
    newLotteryDay(); run('state.plan.points=100');
    return '2→4→8 翻倍 · 上限钳制 10 / 打字分 50';
  });

  check('全库导出含家长密码哈希、不含明文', () => {
    const sql = run('exportSQLite()');
    assert(sql.indexOf("VALUES('parent'") >= 0, 'app_meta 缺 parent');
    assert(sql.indexOf('hash') >= 0, '导出缺哈希字段');
    assert(sql.indexOf('1234') < 0, '导出里出现明文密码');
    return 'app_meta 四份 JSON，密码只以哈希出现';
  });

  check('鸭群养成：满级后继续喂食孵化新鸭，不再卡在 Lv.5', () => {
    ['duckCount','cal-box','calGrid','calPrev','calNext','孵新鸭'].forEach(k =>
      assert(html.indexOf(k) >= 0, '缺鸭群/日历元素 ' + k));
    const o = JSON.parse(run(`JSON.stringify((function(){
      var captured=null;
      // 造一只已到 Lv.5（exp=12）的鸭，星星充足
      var seed={stars:100,duck:{exp:12,no:1},checkin:{last:'',streak:0,total:0,days:[]}};
      window.TypingDuck.setSaveIO(function(){return JSON.parse(JSON.stringify(seed));},
        function(obj){captured=obj;});
      window.TypingDuck.reloadSave();
      var stageBefore=document.getElementById('td-duckStage').textContent;
      var btnBefore=document.getElementById('td-feedBtn').textContent;
      var disabledBefore=document.getElementById('td-feedBtn').disabled;
      // 点击喂食 → 应孵化第 2 只
      document.getElementById('td-feedBtn').listeners.click[0]({});
      var after=captured||{};
      var countText=document.getElementById('td-duckCount').textContent;
      var btnAfter=document.getElementById('td-feedBtn').textContent;
      // 再喂 4 次，让新鸭从 Lv1 升到 Lv2（exp 0→4，第 3 点升级）
      for(var i=0;i<4;i++) document.getElementById('td-feedBtn').listeners.click[0]({});
      var after2=captured||{};
      return {no1:seed.duck.no,no2:after.duck&&after.duck.no,exp2:after.duck&&after.duck.exp,
        stars2:after.stars,countText:countText,btnBefore:btnBefore,btnAfter:btnAfter,
        disabledBefore:disabledBefore,no3:after2.duck&&after2.duck.no,exp3:after2.duck&&after2.duck.exp,
        stageBefore:stageBefore};
    })())`));
    assert(o.no2 === 2, '满级后未孵化新鸭: ' + JSON.stringify(o));
    assert(o.exp2 === 0, '孵化后成长值未归零: ' + JSON.stringify(o));
    assert(o.stars2 === 97, '孵化未扣 3 星: ' + JSON.stringify(o));
    assert(o.disabledBefore === false, '满级时喂食按钮仍被禁用: ' + JSON.stringify(o));
    assert(o.countText.indexOf('第 2 只') >= 0, '鸭群计数未更新: ' + JSON.stringify(o));
    assert(o.btnBefore.indexOf('孵新鸭') >= 0, '满级按钮文案未变: ' + JSON.stringify(o));
    assert(o.no3 === 2 && o.exp3 === 4, '新鸭继续喂食成长异常: ' + JSON.stringify(o));
    return 'Lv.5 再喂孵出第 2 只 · 新鸭 exp 归零继续长大 · 按钮不再禁用';
  });

  check('打卡日历：记录打卡日期并在当月高亮，可翻月', () => {
    const o = JSON.parse(run(`JSON.stringify((function(){
      var d=new Date(); var y=d.getFullYear(), m=d.getMonth();
      var pad=function(n){return String(n).padStart(2,'0');};
      var today=y+'-'+pad(m+1)+'-'+pad(d.getDate());
      var yesterday=new Date(y,m,d.getDate()-1);
      var yd=yesterday.getFullYear()+'-'+pad(yesterday.getMonth()+1)+'-'+pad(yesterday.getDate());
      var seed={stars:0,duck:{exp:0,no:1},
        checkin:{last:today,streak:2,total:2,days:[yd,today]}};
      window.TypingDuck.setSaveIO(function(){return JSON.parse(JSON.stringify(seed));},
        function(obj){});
      window.TypingDuck.reloadSave();
      var grid=document.getElementById('td-calGrid');
      var title=document.getElementById('td-calTitle').textContent;
      var checked=(grid.innerHTML.match(/cal-cell checked/g)||[]).length;
      var todayMarked=/<span class="cal-cell[^"]*checked[^"]*today/.test(grid.innerHTML)
        || /<span class="cal-cell[^"]*today[^"]*checked/.test(grid.innerHTML);
      // 翻到上个月再翻回来
      document.getElementById('td-calPrev').listeners.click[0]({});
      var prevTitle=document.getElementById('td-calTitle').textContent;
      document.getElementById('td-calNext').listeners.click[0]({});
      var backTitle=document.getElementById('td-calTitle').textContent;
      return {today:today,yd:yd,title:title,checked:checked,todayMarked:todayMarked,
        prevTitle:prevTitle,backTitle:backTitle};
    })())`));
    assert(o.checked >= 2, '当月打卡日期未高亮: ' + JSON.stringify(o));
    assert(o.title.indexOf((o.today).slice(0,4)) >= 0 && o.title.indexOf('月') >= 0,
      '日历标题未显示当前年月: ' + JSON.stringify(o));
    assert(o.todayMarked, '今天未同时标记打卡: ' + JSON.stringify(o));
    assert(o.prevTitle !== o.title && o.backTitle === o.title,
      '日历翻月/翻回异常: ' + JSON.stringify(o));
    return o.title + ' · 高亮 ' + o.checked + ' 天 · 今天已打卡 · 翻月正常';
  });

  check('打卡日历：主程序练习过的日子自动补进打卡日并重算连续天数', () => {
    const o = JSON.parse(run(`JSON.stringify((function(){
      var d=new Date(), y=d.getFullYear(), m=d.getMonth();
      var pad=function(n){return String(n).padStart(2,'0');};
      var today=y+'-'+pad(m+1)+'-'+pad(d.getDate());
      var ydate=new Date(y,m,d.getDate()-1,12,0,0);
      var yd=ydate.getFullYear()+'-'+pad(ydate.getMonth()+1)+'-'+pad(ydate.getDate());
      var captured=null;
      var seed={stars:0,duck:{exp:0,no:1},checkin:{last:'',streak:0,total:0,days:[]}};
      var old=(state.history||[]).slice();
      // 昨天只做了拼写练习，没有进打字游戏
      state.history=[{t:ydate.getTime(),mode:'word',ok:true,en:'test'}];
      window.TypingDuck.setSaveIO(function(){return JSON.parse(JSON.stringify(seed));},
        function(obj){captured=obj;});
      window.TypingDuck.reloadSave();
      window.TypingDuck.checkinAfterLoad();
      state.history=old;
      var grid=document.getElementById('td-calGrid');
      return {yd:yd,today:today,
        days:(captured&&captured.checkin&&captured.checkin.days)||[],
        streak:(captured&&captured.checkin&&captured.checkin.streak)||0,
        checked:(grid.innerHTML.match(/cal-cell checked/g)||[]).length};
    })())`));
    assert(o.days.indexOf(o.yd) >= 0, '昨天只做拼写练习却没补进打卡日: ' + JSON.stringify(o));
    assert(o.days.indexOf(o.today) >= 0, '今天未打卡: ' + JSON.stringify(o));
    assert(o.streak === 2, '连续天数未按真实打卡日重算: ' + JSON.stringify(o));
    assert(o.checked >= 2, '日历未高亮补进来的日期: ' + JSON.stringify(o));
    return o.yd + ' + ' + o.today + ' · 连续 ' + o.streak + ' 天';
  });

  check('主菜单三块卡片共用同一左右基准线', () => {
    ['.home-row', '.mode-grid', '.unit-progress-card'].forEach(function(sel){
      const re = new RegExp('#td-root\\s+' + sel.replace('.', '\\.') + '\\s*\\{([\\s\\S]*?)\\}');
      const m = html.match(re);
      assert(m, '缺样式 ' + sel);
      assert(/width:\s*min\(1040px,\s*100%\)/.test(m[1]), sel + ' 宽度不一致');
      assert(/margin:\s*0 auto/.test(m[1]), sel + ' 左右边距不一致');
    });
    assert(/function addHistory\([\s\S]{0,800}syncPracticeCheckin/.test(html),
      'addHistory 未挂钩打卡日历同步');
    return 'home-row / mode-grid / unit-progress-card 同宽同边距';
  });

  check('教材库按小学/初中 → 教材类别 → 年级(上/下) 分层显示', () => {
    const o = JSON.parse(run(`(function(){
      var old=state.textbooks.slice(), oldGrades=state.grades.slice(), oldBooks=state.books.slice();
      // 真实导入时 ensureCat 会给初中重建分类 id，名称才是一致的依据
      state.grades=oldGrades.concat([{id:'g7x',name:'初中七年级'}]);
      state.books=oldBooks.concat([{id:'bpepj',name:'人教版初中英语（2024修订版）'}]);
      state.textbooks=[
        {id:'tree1',name:'人教版 PEP 三年级上册',gradeId:'g3',bookId:'b_pep',volume:'upper',units:[]},
        {id:'tree2',name:'人教版 PEP 三年级下册',gradeId:'g3',bookId:'b_pep',volume:'lower',units:[]},
        {id:'tree3',name:'人教版初中英语 七年级上册',gradeId:'g7x',bookId:'bpepj',volume:'upper',units:[]}
      ];
      renderLibrary();
      var h=document.getElementById('tbList').innerHTML;
      function texts(re){ return (h.match(re)||[]).map(function(s){return s.replace(/.*>/,'');}); }
      var res={stages:texts(/class="tb-stage"[^>]*>[^<]*/g),
        bookNames:texts(/class="tb-bookname">[^<]*/g),
        labels:texts(/class="tb-title"[^>]*>[^<]*/g),
        cards:(h.match(/tb-card/g)||[]).length,
        gradeGroups:(document.getElementById('gradeFilter').innerHTML.match(/<optgroup label="(小学|初中)">/g)||[]).length};
      state.textbooks=old; state.grades=oldGrades; state.books=oldBooks; renderLibrary();
      return JSON.stringify(res);
    })()`));
    assert(o.stages[0].trim() === '小学' && o.stages[1].trim() === '初中', '学段分组顺序错误: ' + JSON.stringify(o));
    assert(o.bookNames.length === 2 && o.bookNames[1].indexOf('初中') >= 0, '教材类别未分组: ' + JSON.stringify(o));
    assert(o.labels.join('|') === '三年级(上)|三年级(下)|七年级(上)', '册显示名未按年级(上/下): ' + JSON.stringify(o));
    assert(o.cards === 3 && o.gradeGroups === 2, '卡片数或学段下拉分组异常: ' + JSON.stringify(o));
    return o.stages.join(' / ') + ' · ' + o.labels.join('、');
  });

  check('学段级联：选小学只看小学教材，选初中只看初中教材', () => {
    const o = JSON.parse(run(`(function(){
      var oldTexts=state.textbooks.slice(), oldBooks=state.books.slice(), oldFilter=JSON.parse(JSON.stringify(state.filter||{}));
      state.books=oldBooks.concat([{id:'bjtest',name:'人教版初中英语（2024修订版）'}]);
      state.textbooks=[
        {id:'c1',name:'人教版 PEP 一年级上册',gradeId:'g1',bookId:'b_pep',volume:'upper',units:[]},
        {id:'c2',name:'人教版 PEP 一年级下册',gradeId:'g1',bookId:'b_pep',volume:'lower',units:[]},
        {id:'c3',name:'人教版 PEP 六年级上册',gradeId:'g6',bookId:'b_pep',volume:'upper',units:[]},
        {id:'c4',name:'人教版初中英语 七年级上册',gradeId:'g7',bookId:'bjtest',volume:'upper',units:[]}
      ];
      function snap(){
        renderLibrary(); renderFilters();
        return {html:document.getElementById('tbList').innerHTML,
          grades:document.getElementById('gradeFilter').innerHTML,
          count:document.getElementById('tbCount').textContent};
      }
      state.filter.stageId='all'; setFilter('stageId','primary'); var primary=snap();
      setFilter('stageId','junior'); var junior=snap();
      state.textbooks=oldTexts; state.books=oldBooks; state.filter=oldFilter;
      renderLibrary(); renderFilters();
      return JSON.stringify({primary:primary,junior:junior});
    })()`));
    assert(o.primary.html.indexOf('一年级(上)')>=0 && o.primary.html.indexOf('一年级(下)')>=0,
      '小学未显示一年级上下册: '+JSON.stringify(o.primary));
    assert(o.primary.html.indexOf('七年级(上)')<0 && o.primary.grades.indexOf('<optgroup label="初中">')<0,
      '小学视图混入初中册或年级');
    assert(o.primary.count === '3 / 4', '小学计数未显示当前/总数: '+o.primary.count);
    assert(o.junior.html.indexOf('七年级(上)')>=0 && o.junior.html.indexOf('一年级')<0,
      '初中视图未只显示初中教材: '+JSON.stringify(o.junior));
    assert(o.junior.grades.indexOf('<optgroup label="小学">')<0, '初中视图混入小学年级');
    assert(o.junior.count === '1 / 4', '初中计数未显示当前/总数: '+o.junior.count);
    return '小学 3/4 · 初中 1/4 · 年级下拉同步收窄';
  });

  check('五四制：小学 1–5 年级、初中 6–9 年级，旧六上归其他', () => {
    const o = JSON.parse(run(`(function(){
      var oldSystem=state.system, oldGrades=state.grades.slice(), oldTexts=state.textbooks.slice(),
        oldFilter=JSON.parse(JSON.stringify(state.filter||{}));
      setSystem('54');
      var opts=gradeOptions('54'), stages=opts.map(function(x){return stageOfGrade(x.id);});
      var res={system:state.system, labels:opts.map(function(x){return x.name;}),
        primary:stages.filter(function(s){return s==='primary';}).length,
        junior:stages.filter(function(s){return s==='junior';}).length,
        g6:stageOfGrade('g6'), j6:stageOfGrade('j6'), j6Label:packLabel({gradeId:'j6',volume:'upper'})};
      state.textbooks=[
        {id:'p5',name:'人教版 PEP 五年级下册',gradeId:'g5',bookId:'b_pep',volume:'lower',units:[]},
        {id:'old6',name:'人教版 PEP 六年级上册',gradeId:'g6',bookId:'b_pep',volume:'upper',units:[]},
        {id:'j6a',name:'五四制人教版 六年级上册',gradeId:'j6',bookId:'b_pep',volume:'upper',units:[]}
      ];
      state.filter.stageId='junior'; renderLibrary(); renderFilters();
      res.juniorHtml=document.getElementById('tbList').innerHTML;
      state.filter.stageId='primary'; renderLibrary();
      res.primaryHtml=document.getElementById('tbList').innerHTML;
      state.system=oldSystem; state.grades=oldGrades; state.textbooks=oldTexts; state.filter=oldFilter;
      renderLibrary(); renderFilters();
      return JSON.stringify(res);
    })()`));
    assert(o.system === '54' && o.primary === 5 && o.junior === 4,
      '五四制年级范围错误: '+JSON.stringify(o));
    assert(o.labels[5] === '六年级' && o.labels[8] === '九年级', '六年级/九年级显示名错误: '+JSON.stringify(o.labels));
    assert(o.g6 === 'other' && o.j6 === 'junior' && o.j6Label === '六年级(上)',
      '五四制六年级归类或册名错误: '+JSON.stringify(o));
    assert(o.juniorHtml.indexOf('六年级(上)')>=0 && o.juniorHtml.indexOf('五年级(下)')<0,
      '初中视图未显示六年级册: '+o.juniorHtml.slice(0,300));
    assert(o.primaryHtml.indexOf('五年级(下)')>=0 && o.primaryHtml.indexOf('六年级(上)')<0,
      '小学视图混入六年级: '+o.primaryHtml.slice(0,300));
    return '小学 5 年级 / 初中 6–9 四年级 · 旧六上归其他';
  });

  /* ---------------- 自然拼读 / 奖品兑换 ---------------- */
  check('自然拼读：内置课程五组齐全，字数与状态归一化', () => {
    const o = JSON.parse(run(`JSON.stringify((function(){
      const c=phonicsCount(), ids=PHONICS_GROUPS.map(g=>g.id);
      const n=normalizeState({phonics:{done:{'lt-a':{best:9,right:'2'}},correct:'7',attempted:'10'}});
      return {groups:ids,lessons:c.lessons,words:c.words,done:n.phonics.done['lt-a'],
        correct:n.phonics.correct,attempted:n.phonics.attempted,
        hasTab:/id="tabPhonics"/.test(document.getElementById('drawerTabs').innerHTML||'')};})())`));
    assert(o.groups.join(',') === 'letter,short,long,blend,family', '课程分组不对: '+o.groups);
    assert(o.lessons >= 50 && o.words >= 200, '课程/词条数偏少: '+JSON.stringify(o));
    assert(o.done && o.done.best === 3 && o.done.right === 2, '进度归一化失败');
    assert(o.correct === 7 && o.attempted === 10, '计数归一化失败');
    assert(/id="tabPhonics"/.test(html) && /id="pagePhonics"/.test(html), '缺拼读标签/页面');
    return o.groups.join('/')+' · '+o.lessons+' 课 '+o.words+' 词';
  });

  check('自然拼读：两种练法、答对计分、答错看答案，进度落盘', () => {
    run(`(function(){
      state.phonics=normalizeState({phonics:{done:{},correct:0,attempted:0}}).phonics;
      phStart('fm-at');
      $('phMode').value='listen';
    })()`);
    const first = run('phLast && phLast[0]');
    assert(first, '未进入第一课');
    /* 听音拼词：答对 */
    run(`(function(){ $('phInput').value=phLast[0].toUpperCase(); phCheck(); })()`);
    const ok = JSON.parse(run(`JSON.stringify({fb:$('phFeedback').textContent,cls:$('phFeedback').className,
      right:state.phonics.correct,att:state.phonics.attempted,hist:state.history.length,
      done:$('phInput').disabled})`));
    assert(ok.right === 1 && ok.att === 1 && ok.cls.indexOf('ok') >= 0, '答对未计分: '+JSON.stringify(ok));
    assert(ok.hist >= 1 && ok.done, '答题未记历史或未锁定输入');
    /* 看词拼读：答错后显示答案 */
    run(`(function(){ phAdvance(); $('phMode').value='read'; phShow();
      $('phInput').value='zzzzwrong'; phCheck(); })()`);
    const bad = JSON.parse(run(`JSON.stringify({fb:$('phFeedback').textContent,
      cls:$('phFeedback').className,hint:$('phHint').textContent})`));
    assert(bad.cls.indexOf('bad') >= 0 && bad.fb.indexOf('正确答案') >= 0, '答错未显示答案: '+JSON.stringify(bad));
    assert(bad.hint.indexOf('音素') >= 0, '看词拼读缺音素提示');
    run('phBack()');
    return '听音拼词对 1 题 / 看词拼读错 1 题 · 历史与进度已记录';
  });

  check('奖品自动兑换：抽到不扣分、即时已兑换；普通奖待家长兑换', () => {
    /* 自动兑换奖：必中且返还消耗 */
    run(`(function(){ state.plan.points=100;
      state.lottery={cost:10,typingPoints:1,dailyLimit:10,
        prizes:[{id:'auto',name:'再抽一次',prob:100,autoRedeem:true}],log:[]};
    })()`);
    newLotteryDay();
    const autoRes = run('JSON.stringify(drawLottery())');
    const auto = JSON.parse(autoRes);
    const ao = JSON.parse(run(`JSON.stringify({p:state.plan.points,log:state.lottery.log[0]})`));
    ao.cost = auto.cost; ao.status = auto.status;
    assert(ao.p === 100 && ao.cost === 0 && ao.status === 'auto', '自动兑换仍扣分: '+JSON.stringify(ao));
    assert(ao.log.autoRedeem === true && ao.log.redeemed === true && ao.log.prizeId === 'auto',
      '自动兑换日志缺状态: '+JSON.stringify(ao.log));
    /* 普通奖：扣分 + 待兑换 */
    run(`(function(){ state.plan.points=100;
      state.lottery.prizes=[{id:'gift',name:'一张小贴纸',prob:100,autoRedeem:false}];
      state.lottery.log=[]; })()`);
    newLotteryDay();
    run('drawLottery()');
    const go = JSON.parse(run(`JSON.stringify({p:state.plan.points,log:state.lottery.log[0]})`));
    assert(go.p === 90 && go.log.autoRedeem === false && go.log.redeemed === false && go.log.cost === 10,
      '普通奖状态不对: '+JSON.stringify(go));
    /* 家长确认兑换：未解锁触发家长中心，解锁后可标记 */
    const t = go.log.t;
    const before = run(`(function(){ parentUnlocked=false; redeemPrize(${t}); return state.lottery.log[0].redeemed; })()`);
    assert(before === false, '未解锁就被兑换了');
    const after = run(`(function(){ parentUnlocked=true; const r=redeemPrize(${t});
      parentUnlocked=false; return {r:r, redeemed:state.lottery.log[0].redeemed}; })()`);
    assert(after.r === true && after.redeemed === true, '家长兑换失败: '+JSON.stringify(after));
    /* 获得奖品列表显示待兑换 / 已兑换 / 自动兑换 */
    run(`(function(){ state.lottery.log=[state.lottery.log[0],
      {t:Date.now()+1,cost:10,prize:'再抽一次',prizeId:'a2',autoRedeem:true,redeemed:true}];
      renderLottery(); })()`);
    const list = run("$('prizeWonList').innerHTML");
    assert(list.indexOf('已兑换') >= 0 && list.indexOf('自动兑换') >= 0, '奖品列表缺兑换状态: '+list.slice(0,300));
    assert(run("$('prizePending').textContent").indexOf('0 待兑换') >= 0, '待兑换计数不对');
    run('state.lottery=clone(DEFAULT_LOTTERY); state.plan.points=0;');
    return '自动兑换净扣 0 / 普通奖扣 10 且待兑换 / 家长解锁后确认';
  });

  check('新增奖项默认关闭自动兑换，家长解锁后才可勾选', () => {
    const o = JSON.parse(run(`JSON.stringify((function(){
      parentUnlocked=true; state.lottery.prizes=clone(DEFAULT_PRIZES);
      addPrize(); const fresh=state.lottery.prizes[state.lottery.prizes.length-1];
      const wasDefault=fresh.autoRedeem;
      updatePrizeField(fresh.id,'autoRedeem',true);
      const on=state.lottery.prizes.find(p=>p.id===fresh.id).autoRedeem;
      renderLottery(); const html=$('prizeList').innerHTML;
      parentUnlocked=false;
      return {fresh:wasDefault===false, on:on,
        checkbox:/data-prize-auto=/.test(html), label:html.indexOf('自动兑换')>=0};})())`));
    assert(o.fresh === true && o.on === true && o.checkbox && o.label, '自动兑换开关缺失: '+JSON.stringify(o));
    assert(run("DEFAULT_PRIZES.find(p=>p.id==='p5').autoRedeem") === true, '默认「再抽一次」未设自动兑换');
    return '新奖默认关闭 · 可勾选 · 默认再抽一次自动兑换';
  });

  check('教材单词音素分块与拼读归类', () => {
    const o = JSON.parse(run(`JSON.stringify({
      ship:phonicsChunks('ship'), cake:phonicsChunks('cake'), teacher:phonicsChunks('teacher'),
      sheep:phonicsGroup('sheep').name, cakeGroup:phonicsGroup('cake').name,
      catGroup:phonicsGroup('cat').name})`));
    assert(JSON.stringify(o.ship) === JSON.stringify([['sh','ʃ'],['i','ɪ'],['p','p']]), 'sh 分块错误: '+JSON.stringify(o));
    assert(JSON.stringify(o.cake) === JSON.stringify([['c','k'],['a','eɪ'],['k','k'],['e','不发音']]), '神奇 e 分块错误: '+JSON.stringify(o));
    assert(JSON.stringify(o.teacher) === JSON.stringify([['t','t'],['ea','iː'],['ch','tʃ'],['er','ɜː']]), 'ea/ch/er 分块错误: '+JSON.stringify(o));
    assert(o.sheep === 'sh /ʃ/' && o.cakeGroup === 'a_e /eɪ/' && o.catGroup === '短元音 a /æ/', '归类错误: '+JSON.stringify(o));
    return 'sh/ea/ch/a_e/短元音 均正确识别';
  });

  check('教材单词按单元与拼读规律归类并随学段级联', () => {
    const o = JSON.parse(run(`(function(){
      var oldBooks=state.books.slice(), oldTbs=state.textbooks.slice(), oldPh=JSON.parse(JSON.stringify(PH_TB));
      state.books=[{id:'bpep',name:'人教版 PEP（三年级起点）'},{id:'bjun',name:'人教版初中英语'}];
      state.textbooks=[
        {id:'pk3',name:'PEP三上',gradeId:'g3',bookId:'bpep',volume:'upper',units:[
          {id:'u1',name:'Unit 1 Hello',words:[['cat','猫'],['ship','轮船'],['cake','蛋糕'],["can't",'不能']],sentences:[['x']]}]},
        {id:'pk7',name:'初中七上',gradeId:'g7',bookId:'bjun',volume:'upper',units:[
          {id:'u2',name:'Starter Unit 1',words:[['sheep','羊'],['teacher','老师']],sentences:[['x']]}]}];
      PH_TB.stage='all'; PH_TB.book='all'; PH_TB.pack='all'; PH_TB.groupBy='unit'; PH_TB.unit='all';
      phRenderTextbook();
      var units=phTbUnitRows().map(function(r){return r.name;});
      var allHtml=$('phUnitList').innerHTML;
      PH_TB.stage='primary'; phRenderTextbook(); var primary=phTbUnitRows().length;
      PH_TB.stage='junior'; phRenderTextbook(); var junior=phTbUnitRows().length;
      PH_TB.stage='all'; PH_TB.groupBy='pattern'; phRenderTextbook();
      var groups=phTbRows().map(function(r){return r.name+':'+r.words.length;});
      var patHtml=$('phUnitList').innerHTML;
      state.books=oldBooks; state.textbooks=oldTbs;
      Object.keys(oldPh).forEach(function(k){PH_TB[k]=oldPh[k];});
      phRenderTextbook();
      return JSON.stringify({units:units,primary:primary,junior:junior,groups:groups,
        unitRow:/data-phunit=/.test(allHtml),patRow:/data-phunit=/.test(patHtml)});})()`));
    assert(o.units.length === 2 && o.primary === 1 && o.junior === 1, '教材单元级联错误: '+JSON.stringify(o));
    assert(o.unitRow && o.patRow, '单元/拼读组列表未渲染: '+JSON.stringify(o));
    assert(o.groups.some(g => g.indexOf('sh /ʃ/:2') === 0) && o.groups.some(g => g.indexOf('a_e /eɪ/:1') === 0),
      '拼读规律未跨单元合并: '+JSON.stringify(o));
    return '小学/初中各 1 单元 · sh 组合 2 词 · a_e 1 词';
  });

  check('真实课本包可直接按拼读规律分组', () => {
    const real = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'textbooks', 'packs', 'pep-3a.json'), 'utf8')).packs[0];
    const payload = JSON.stringify({
      id:real.id, name:real.name, gradeId:real.gradeId, bookId:real.bookId,
      volume:real.volume, enabled:true,
      units:real.units.map(u => ({id:u.id, name:u.name, words:u.words, sentences:[]}))
    });
    const o = JSON.parse(run(`(function(){
      var old=state.textbooks.slice(), oldPh=JSON.parse(JSON.stringify(PH_TB));
      state.textbooks=[${payload}];
      PH_TB.stage='all'; PH_TB.book='all'; PH_TB.pack='all'; PH_TB.groupBy='unit'; PH_TB.unit='all';
      var units=phTbUnitRows(), unitWords=units.reduce(function(n,r){return n+r.words.length;},0);
      PH_TB.groupBy='pattern'; var groups=phTbRows(), groupWords=groups.reduce(function(n,r){return n+r.words.length;},0);
      var names=groups.map(function(r){return r.name;});
      state.textbooks=old; Object.keys(oldPh).forEach(function(k){PH_TB[k]=oldPh[k];}); phRenderTextbook();
      return JSON.stringify({units:units.length,unitWords:unitWords,groups:groups.length,
        groupWords:groupWords,names:names});})()`));
    assert(o.units === 6 && o.unitWords > 90 && o.groups >= 8 && o.groupWords === o.unitWords,
      '真实教材包分组异常: '+JSON.stringify(o));
    assert(o.names.some(n => n.indexOf('sh /') === 0) || o.names.some(n => n.indexOf('短元音') === 0),
      '未识别常见拼读组: '+JSON.stringify(o));
    return o.units+' 单元 / '+o.unitWords+' 词 → '+o.groups+' 个拼读组';
  });

  check('教材单词拼读练习：分块提示、答题、星级进度与打卡', () => {
    const o = JSON.parse(run(`(function(){
      var oldTbs=state.textbooks.slice(), oldTd=JSON.parse(JSON.stringify(state.phonics.textbookDone));
      var oldHist=state.history.slice(), oldAtt=state.phonics.attempted, oldCor=state.phonics.correct, oldPh=JSON.parse(JSON.stringify(PH_TB));
      state.textbooks=[{id:'pkx',name:'test',gradeId:'g3',bookId:'b_pep',volume:'upper',units:[
        {id:'u',name:'U1',words:[['ship','轮船'],['cake','蛋糕'],['teacher','老师']],sentences:[['x']]}]}];
      PH_TB.stage='all'; PH_TB.book='all'; PH_TB.pack='pkx'; PH_TB.groupBy='unit'; PH_TB.unit='tb:pkx:u';
      $('phMode').value='listen';
      phRenderTextbook(); phStartTextbook('tb:pkx:u');
      var title=$('phLessonTitle').textContent, listen=$('phChunks').innerHTML;
      $('phChunkBtn').listeners.click[0](); var hint=$('phChunks').innerHTML;
      $('phInput').value=phLast[0]; phCheck(); var ok=$('phFeedback').textContent;
      phAdvance(); $('phInput').value='wrong'; phCheck(); var bad=$('phFeedback').textContent;
      phAdvance(); $('phInput').value=phLast[0]; phCheck(); phAdvance();
      var done=state.phonics.textbookDone['tb:pkx:u'];
      var hist=state.history.filter(function(x){return x.mode==='phonics'&&x.unit==='tb:pkx:u';}).length;
      var attended=state.phonics.attempted-oldAtt;
      phBack();
      state.textbooks=oldTbs; state.phonics.textbookDone=oldTd; state.history=oldHist;
      state.phonics.attempted=oldAtt; state.phonics.correct=oldCor;
      Object.keys(oldPh).forEach(function(k){PH_TB[k]=oldPh[k];});
      return JSON.stringify({title:title,listen:/ph-blank/.test(listen),hint:/ph-chunk/.test(hint),
        ok:ok,bad:bad,done:done,hist:hist,attended:attended});})()`));
    assert(o.title === '教材单词 · U1' && o.listen && o.hint, '分块提示未切换: '+JSON.stringify(o));
    assert(o.ok.indexOf('拼对了') >= 0 && o.bad.indexOf('正确答案') >= 0, '答题判定错误: '+JSON.stringify(o));
    assert(o.done && o.done.best === 2 && o.done.right === 1, '星级/轮数进度错误: '+JSON.stringify(o));
    assert(o.hist === 3 && o.attended === 3, '练习记录或统计未写入: '+JSON.stringify(o));
    return '2/3 正确得 2 星 · 3 条记录 · 提示可切换';
  });

  check('旧存档自动补齐教材拼读进度命名空间', () => {
    const o = JSON.parse(run(`JSON.stringify((function(){
      var s=normalizeState({phonics:{done:{},correct:1,attempted:2}});
      return {td:s.phonics.textbookDone,correct:s.phonics.correct,attempted:s.phonics.attempted};})())`));
    assert(o.td && typeof o.td === 'object' && !Array.isArray(o.td) && o.correct === 1 && o.attempted === 2,
      '旧存档归一化失败: '+JSON.stringify(o));
    return 'textbookDone 补齐且原统计保留';
  });

  const failed = results.filter(r => r[1] === 'FAIL');
  results.forEach(r => console.log('[' + r[1] + ']   ' + r[0] + (r[2] ? '  -> ' + r[2] : '')));
  console.log('\n合计 ' + results.length + ' 项，失败 ' + failed.length + ' 项');
  if(failed.length) process.exitCode = 1;
})();
