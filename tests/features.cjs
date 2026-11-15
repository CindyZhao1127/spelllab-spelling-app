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

  check('完成后自动朗读整句（避开完成音效再播）', () => {
    const en = run('currentQuestion().q.en');
    const item = scheduled.filter(x => x.ms === 650);
    assert(item.length >= 1, '未安排延迟朗读');
    assert(item[0].ms >= 500, '延迟太短会盖住完成音效');
    spoken.length = 0;
    item.forEach(x => x.fn());
    assert(spoken.indexOf(en) >= 0, '未朗读整句：' + JSON.stringify(spoken));
    return en + '（延迟 650ms）';
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

  const failed = results.filter(r => r[1] === 'FAIL');
  results.forEach(r => console.log('[' + r[1] + ']   ' + r[0] + (r[2] ? '  -> ' + r[2] : '')));
  console.log('\n合计 ' + results.length + ' 项，失败 ' + failed.length + ' 项');
  if(failed.length) process.exitCode = 1;
})();
