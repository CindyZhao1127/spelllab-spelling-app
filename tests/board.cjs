/* 字母格专项回归：按字母数的小空格、露出前 N 个字母、输入/判定/提示、整词模式回退 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'SpellLab.html'), 'utf8');
const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
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
    this.children = []; this._html = ''; this._sub = {}; this._boxes = []; this._input = null;
    this.textContent = ''; this.value = ''; this.readOnly = false;
    this.disabled = false; this.selectionStart = 0; this.offsetWidth = 1;
    this.listeners = {}; this.hidden = false;
  }
  set innerHTML(v){
    this._html = String(v); this.children = []; this._boxes = []; this._input = null;
    const re = /<span class="([^"]*)"[^>]*>([^<]*)<\/span>/g;
    let m;
    while((m = re.exec(this._html))){
      const e = new El('', 'span');
      m[1].split(/\s+/).filter(Boolean).forEach(c => e.classList.add(c));
      e.textContent = m[2];
      this._boxes.push(e);
    }
    if(/<input\b/.test(this._html)) this._input = new El('', 'input');
  }
  get innerHTML(){ return this._html; }
  addEventListener(t, fn){ (this.listeners[t] = this.listeners[t] || []).push(fn); }
  appendChild(c){ this.children.push(c); return c; }
  querySelector(sel){
    const key = String(sel);
    if(key === 'input'){
      if(this._input) return this._input;
      for(const c of this.children){ const r = c.querySelector('input'); if(r) return r; }
      return (this._input = new El('', 'input'));
    }
    if(!this._sub[key]) this._sub[key] = new El('', 'div');
    return this._sub[key];
  }
  querySelectorAll(sel){
    const key = String(sel);
    if(key === '.lbox') return this._boxes;
    if(key === '.answer') return [this.querySelector('.answer')];
    return [];
  }
  focus(){ doc.activeElement = this; }
  blur(){}
  click(){}
  remove(){}
  closest(){ return null; }
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
const store = new Map();
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
const sandbox = {
  document: doc, console,
  localStorage: {
    getItem: k => store.has(k) ? store.get(k) : null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k)
  },
  SpeechSynthesisUtterance: class { constructor(t){ this.text = t; } },
  setTimeout: () => 0,
  clearTimeout: () => {},
  confirm: () => true,
  prompt: () => '',
  Blob: class { constructor(parts, opts){ this.parts = parts; this.type = opts && opts.type; } },
  URL: { createObjectURL: b => 'blob:' + b.parts.length, revokeObjectURL(){} },
  Date, Math, JSON, Object, Array, String, Number, Set, Map, RegExp, Error
};
sandbox.window = {
  speechSynthesis: { getVoices: () => [], cancel(){}, speak(){} },
  AudioContext: FakeAudioContext
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
const SAMPLE = "renderBoard(tokenize('The weather is sunny.',['这','天气','是','晴朗的'],'天气晴朗。'),'天气晴朗。','标签','提示',null)";

check('CSS：整句横向排列并自动换行', () => {
  assert(/\.slots\{[^}]*flex-wrap:wrap/.test(css), '.slots 未设置 flex-wrap:wrap');
  assert(/\.slot\.boxed\{flex:0 0 auto\}/.test(css), '字母格词槽未禁止压缩，换行会被挤坏');
  assert(/\.slot\.boxed \.boxes\{[^}]*flex-wrap:nowrap/.test(css), '单词内部不应被拆到两行');
  assert(/@media\(max-width:640px\)[\s\S]*?\.lbox\{/.test(css), '缺窄屏格子尺寸适配');
  return 'wrap / flex:0 0 auto / nowrap / 窄屏适配';
});

check('默认开启字母格、露出 0 个字母', () => {
  const o = JSON.parse(run('JSON.stringify({b:state.settings.letterBoxes,r:state.settings.revealLetters})'));
  assert(o.b === true && o.r === 0, JSON.stringify(o));
  return JSON.stringify(o);
});

check('旧存档自动补齐新设置', () => {
  const o = JSON.parse(run('JSON.stringify(normalizeState({settings:{showHints:false}}).settings)'));
  assert(o.letterBoxes === true && o.revealLetters === 0 && o.showHints === false, JSON.stringify(o));
  return 'letterBoxes=true, revealLetters=0, 原有设置保留';
});

check('设置面板含新控件且开关同步', () => {
  assert(/id="swLetterBoxes"/.test(html) && /id="revealRange"/.test(html), '缺设置控件');
  run('renderDrawer()');
  const o = JSON.parse(run("JSON.stringify({on:document.getElementById('swLetterBoxes').classList.contains('on'),val:document.getElementById('revealRange').value})"));
  assert(o.on === true, '开关未同步');
  return 'swLetterBoxes=on, revealRange=' + o.val;
});

check('每个单词按字母数渲染小空格', () => {
  run('state.settings.letterBoxes=true; state.settings.revealLetters=0; ' + SAMPLE);
  const arr = JSON.parse(run(`JSON.stringify(curTokens.map((t,i)=>({
    w:t.word, p:t.punct,
    n:slots[i]?slots[i].querySelectorAll('.lbox').length:0,
    boxed:slots[i]?slots[i].classList.contains('boxed'):false
  })))`));
  arr.forEach(d => {
    if(d.p) return;
    assert(d.boxed, '未标记 boxed: ' + d.w);
    assert(d.n === d.w.length, d.w + ' 需要 ' + d.w.length + ' 格，实际 ' + d.n);
  });
  return arr.filter(d => !d.p).map(d => d.w + ':' + d.n).join(' ');
});

check('初始格子为空且高亮首个待输入格', () => {
  const o = JSON.parse(run(`(function(){
    const i=slots.findIndex(s=>s), bs=slots[i].querySelectorAll('.lbox');
    return JSON.stringify({text:bs.map(b=>b.textContent).join(''),n:bs.length,
      cur:bs.findIndex(b=>b.classList.contains('current'))});
  })()`));
  assert(o.text === '', '初始不应显示字母: ' + o.text);
  assert(o.cur === 0, '首个格应高亮，实际 ' + o.cur);
  return o.n + ' 格全空，current=0';
});

check('逐字母输入后自动判定并填满格子', () => {
  run(SAMPLE);
  const o = JSON.parse(run(`(function(){
    const i=slots.findIndex(s=>s), inp=slots[i].querySelector('input'), w=curTokens[i].word;
    inp.value=w; onSlotInput({target:inp});
    const bs=slots[i].querySelectorAll('.lbox');
    return JSON.stringify({w:w,shown:bs.map(b=>b.textContent).join(''),
      correct:slots[i].classList.contains('correct'),readOnly:inp.readOnly,
      cur:bs.filter(b=>b.classList.contains('current')).length});
  })()`));
  assert(o.shown === o.w, '格子未填满: ' + o.shown);
  assert(o.correct && o.readOnly, '未正确判定并锁定');
  assert(o.cur === 0, '正确后不应再高亮当前格');
  return o.w + ' -> ' + o.shown;
});

check('revealCount 边界：短词不会露出全部', () => {
  run('state.settings.revealLetters=2');
  const o = JSON.parse(run(`JSON.stringify({
    a:revealCount('I'), b:revealCount('is'), c:revealCount('sunny'),
    off:(function(){ state.settings.letterBoxes=false; const v=revealCount('sunny'); state.settings.letterBoxes=true; return v; })()
  })`));
  assert(o.a === 0 && o.b === 1 && o.c === 2 && o.off === 0, JSON.stringify(o));
  return JSON.stringify(o);
});

check('配置露出前 2 个字母，只需补剩余字母', () => {
  run('state.settings.revealLetters=2; ' + SAMPLE);
  const o = JSON.parse(run(`(function(){
    const i=curTokens.findIndex(t=>!t.punct && t.word==='weather');
    const s=slots[i], bs=s.querySelectorAll('.lbox'), g=Number(s.dataset.given)||0;
    return JSON.stringify({g:g,n:bs.length,prefix:bs.slice(0,g).map(b=>b.textContent).join(''),
      given:bs.filter(b=>b.classList.contains('given')).length,
      cur:bs.findIndex(b=>b.classList.contains('current'))});
  })()`));
  assert(o.g === 2 && o.n === 7, JSON.stringify(o));
  assert(o.prefix === 'we', '前缀显示错误: ' + o.prefix);
  assert(o.given === 2 && o.cur === 2, '给定/当前格位置错误');
  const done = JSON.parse(run(`(function(){
    const i=curTokens.findIndex(t=>!t.punct && t.word==='weather');
    const inp=slots[i].querySelector('input');
    inp.value='ather'; onSlotInput({target:inp});
    const bs=slots[i].querySelectorAll('.lbox');
    return JSON.stringify({shown:bs.map(b=>b.textContent).join(''),correct:slots[i].classList.contains('correct')});
  })()`));
  assert(done.shown === 'weather' && done.correct, JSON.stringify(done));
  return 'we + ather -> weather，' + o.n + ' 格';
});

check('检查答案按「前缀＋输入」判定整句', () => {
  run('state.settings.revealLetters=1; ' + SAMPLE);
  const o = JSON.parse(run(`(function(){
    slots.forEach((s,i)=>{
      if(!s) return;
      const inp=s.querySelector('input'), g=Number(s.dataset.given)||0;
      inp.value=curTokens[i].word.slice(g);
      onSlotInput({target:inp});
    });
    return JSON.stringify({all:allCorrect(),solved:solved});
  })()`));
  assert(o.all, '仍有未完成的词: ' + JSON.stringify(o));
  return JSON.stringify(o);
});

check('提示按钮在字母格模式下正常', () => {
  run('state.settings.revealLetters=0; ' + SAMPLE);
  run(`(function(){ const i=slots.findIndex(s=>s); document.activeElement=slots[i].querySelector('input'); })()`);
  const first = JSON.parse(run(`(function(){
    hintCurrent(); const i=slots.findIndex(s=>s);
    return JSON.stringify({txt:slots[i].querySelector('.hint').textContent});
  })()`));
  assert(/下一个字母/.test(first.txt), '第一级提示不对: ' + first.txt);
  const second = JSON.parse(run(`(function(){
    hintCurrent(); const i=slots.findIndex(s=>s), bs=slots[i].querySelectorAll('.lbox');
    return JSON.stringify({assisted:assisted,correct:slots[i].classList.contains('correct'),
      shown:bs.map(b=>b.textContent).join(''),w:curTokens[i].word});
  })()`));
  assert(second.assisted && second.correct && second.shown === second.w, JSON.stringify(second));
  return first.txt + ' / 二级填满 ' + second.shown;
});

check('含撇号单词也按字符生成格子', () => {
  run('state.settings.revealLetters=2');
  const o = JSON.parse(run(`JSON.stringify({n:(boxesMarkup("don't",0).match(/class="lbox/g)||[]).length,g:revealCount("don't")})`));
  assert(o.n === 5 && o.g === 2, JSON.stringify(o));
  return "don't -> " + o.n + ' 格';
});

check('关闭字母格后回到整词输入框', () => {
  run('state.settings.letterBoxes=false; state.settings.revealLetters=0; ' + SAMPLE);
  const o = JSON.parse(run(`(function(){
    const i=slots.findIndex(s=>s);
    return JSON.stringify({boxed:slots[i].classList.contains('boxed'),
      n:slots[i].querySelectorAll('.lbox').length,given:slots[i].dataset.given,
      minWidth:slots[i].style.minWidth});
  })()`));
  assert(!o.boxed && o.n === 0 && o.given === '0', JSON.stringify(o));
  assert(!!o.minWidth, '整词模式应保留宽度计算');
  const ok = run(`(function(){
    const i=slots.findIndex(s=>s), inp=slots[i].querySelector('input');
    inp.value=curTokens[i].word; onSlotInput({target:inp});
    return slots[i].classList.contains('correct');
  })()`);
  assert(ok === true, '整词模式判定失败');
  run('state.settings.letterBoxes=true');
  return '整词输入判定正常';
});

check('切换设置后重做当前题', () => {
  run('state.settings.letterBoxes=true; state.settings.revealLetters=0; ' + SAMPLE);
  run(`(function(){
    const i=slots.findIndex(s=>s), inp=slots[i].querySelector('input');
    inp.value='x'; onSlotInput({target:inp});
  })()`);
  const dirty = run('draft[slots.findIndex(s=>s)]');
  run("setSetting('letterBoxes',false)");
  const o = JSON.parse(run(`JSON.stringify({boxed:slots.find(s=>s).classList.contains('boxed'),draft:draft[slots.findIndex(s=>s)]})`));
  assert(dirty === 'x' && o.boxed === false && o.draft === '', JSON.stringify(o));
  run("setSetting('letterBoxes',true)");
  return 'dirty=' + dirty + ' -> ' + JSON.stringify(o);
});

let failed = 0;
results.forEach(([name, status, info]) => {
  if(status === 'FAIL') failed++;
  console.log('[' + status + ']   ' + name + (info ? '  -> ' + info : ''));
});
console.log('\n合计 ' + results.length + ' 项，失败 ' + failed + ' 项');
if(failed) process.exit(1);
