/* 源码一致性回归：src/ 模块化源码必须能字节级重建 SpellLab.html。
   防止有人只改产物不改源码（下次 build 会丢失），或只改源码不重建（运行的是旧代码）。 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const shellPath = path.join(root, 'src', 'shell.html');
const jsDir = path.join(root, 'src', 'js');
const htmlPath = path.join(root, 'SpellLab.html');
const MARK_JS = '/* __SPELLLAB_JS_MODULES__ */';
const MARK_BANK = '__SPELLLAB_WORDBANK_DATA__';
const MARK_DETAIL = '__SPELLLAB_WORD_DETAILS__';
const MARK_PHON = '__SPELLLAB_PHONETICS__';
const bankDir = path.join(root, 'textbooks', 'wordbank');
const bankKeys = ['primary', 'junior', 'gaokao', 'cet4', 'cet6', 'itbiz'];
function wordDetailsLiteral(){
  const obj = JSON.parse(fs.readFileSync(path.join(root, 'textbooks', 'word-details.json'), 'utf8'));
  return JSON.stringify(obj.details);
}
function phoneticsLiteral(){
  const obj = JSON.parse(fs.readFileSync(path.join(root, 'textbooks', 'word-phonetics.json'), 'utf8'));
  return JSON.stringify(obj.phones);
}
// 与 tools/build.py 一致：把词库 JSON 压成数组字面量注入数据模块
function wordbankLiteral(){
  const banks = bankKeys.map(k => {
    const obj = JSON.parse(fs.readFileSync(path.join(bankDir, k + '.json'), 'utf8'));
    return {id: obj.id, name: obj.name, desc: obj.desc || '',
      bookId: 'b_wb_' + k, words: obj.words};
  });
  return JSON.stringify(banks);
}

let fail = 0;
function check(name, fn){
  try {
    const detail = fn();
    console.log('[OK]   ' + name + (detail ? '  -> ' + detail : ''));
  } catch (e) {
    fail++;
    console.log('[FAIL] ' + name + '  -> ' + e.message);
  }
}
function assert(cond, msg){ if(!cond) throw new Error(msg); }

function numericPrefix(name){
  const m = name.match(/^(\d+)-/);
  return m ? Number(m[1]) : Infinity;
}

check('源码骨架与 JS 模块齐全', () => {
  assert(fs.existsSync(shellPath), '缺少 src/shell.html');
  assert(fs.existsSync(jsDir) && fs.statSync(jsDir).isDirectory(), '缺少 src/js/');
  const mods = fs.readdirSync(jsDir).filter(f => f.endsWith('.js'));
  assert(mods.length >= 20, '模块数量异常：' + mods.length);
  return mods.length + ' 个 JS 模块';
});

check('src/ 重建结果与 SpellLab.html 字节一致', () => {
  const shell = fs.readFileSync(shellPath, 'utf8');
  assert(shell.indexOf(MARK_JS) >= 0, 'shell 缺少 JS 占位标记');
  const mods = fs.readdirSync(jsDir).filter(f => f.endsWith('.js'))
    .sort((a, b) => numericPrefix(a) - numericPrefix(b) || a.localeCompare(b));
  let js = mods.map(f => {
    const text = fs.readFileSync(path.join(jsDir, f), 'utf8');
    assert(text.indexOf('</script') < 0, f + ' 含 </script>');
    return text.endsWith('\n') ? text.slice(0, -1) : text;
  }).join('\n');
  assert(js.indexOf(MARK_BANK) >= 0, '数据模块缺少词库占位标记');
  assert(js.indexOf(MARK_DETAIL) >= 0, '数据模块缺少释义占位标记');
  assert(js.indexOf(MARK_PHON) >= 0, '数据模块缺少音标占位标记');
  js = js.replace(MARK_BANK, wordbankLiteral());
  js = js.replace(MARK_DETAIL, wordDetailsLiteral());
  js = js.replace(MARK_PHON, phoneticsLiteral());
  const rebuilt = shell.replace(MARK_JS, js);
  const current = fs.readFileSync(htmlPath, 'utf8');
  // Windows 下 git checkout 会把产物转成 CRLF，源码模块是 LF；按行尾归一化后比较内容。
  const norm = s => s.replace(/\r\n/g, '\n');
  assert(norm(rebuilt) === norm(current),
    '产物与源码不一致：产物 ' + current.length + ' 字符，重建 ' + rebuilt.length + ' 字符。' +
    '请运行 python tools/build.py 重新构建，或把 HTML 改动同步回 src/。');
  return current.length + ' 字符内容一致（行尾归一化）';
});

check('产物仍是单文件结构（script/style 各一处）', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');
  assert((html.match(/<script>/g) || []).length === 1, '应只有一个 <script>');
  assert((html.match(/<style>/g) || []).length === 1, '应只有一个 <style>');
  assert(html.indexOf(MARK_JS) < 0, '产物中残留了构建占位标记');
  return '单 <script> + 单 <style>，无占位残留';
});

check('整体词库数据齐全且已内嵌进产物', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');
  assert(html.indexOf(MARK_BANK) < 0, '产物中残留词库占位标记');
  const start = html.indexOf('const WORDBANK_DATA');
  assert(start >= 0, '产物缺少 WORDBANK_DATA 常量');
  const eq = html.indexOf('=', start);
  const bracket = html.indexOf('[', eq);
  // 从数组起点用 JSON 逐字符扫描到匹配的右括号（跳过字符串内的括号）
  let depth = 0, inStr = false, esc = false, end = -1;
  for (let i = bracket; i < html.length; i++) {
    const c = html[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  assert(end > bracket, 'WORDBANK_DATA 数组边界解析失败');
  const banks = JSON.parse(html.slice(bracket, end));
  assert(banks.length === bankKeys.length, '词库数量不对：' + banks.length);
  let total = 0;
  banks.forEach(b => {
    assert(Array.isArray(b.words) && b.words.length > 500, b.name + ' 词数异常');
    assert(/^b_wb_[a-z0-9]+$/.test(b.bookId || ''), b.name + ' 缺少独立教材类别 id');
    assert(b.words.every(w => Array.isArray(w) && w.length === 2 &&
      /^[A-Za-z][A-Za-z'-]*$/.test(w[0]) && w[1]), b.name + ' 含非法词条');
    total += b.words.length;
  });
  assert(new Set(banks.map(b => b.bookId)).size === banks.length, '词库类别 id 有重复');
  return banks.length + ' 套独立词库 / 共 ' + total + ' 词已内嵌';
});

function jsonEnd(html, open){
  let depth = 0, inStr = false, esc = false;
  for (let i = open; i < html.length; i++) {
    const c = html[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') { depth--; if (depth === 0) return i + 1; }
  }
  return -1;
}

check('详细释义词典已内嵌且常用词有多义项', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');
  assert(html.indexOf(MARK_DETAIL) < 0, '产物中残留释义占位标记');
  const start = html.indexOf('const WORD_DETAILS');
  assert(start >= 0, '产物缺少 WORD_DETAILS 常量');
  const eq = html.indexOf('=', start), open = html.indexOf('{', eq);
  const end = jsonEnd(html, open);
  assert(end > open, 'WORD_DETAILS 对象边界解析失败');
  const details = JSON.parse(html.slice(open, end));
  const count = Object.keys(details).length;
  assert(count > 7000, '释义词条数不足：' + count);
  assert(/取消/.test(details.cancel || ''), 'cancel 缺详细释义');
  assert(details.apple && details.nice, '常用词释义缺失');
  return count + ' 条释义已内嵌（默认常用义，按钮展开多义项）';
});

check('英美音标词典已内嵌且覆盖常用词', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');
  assert(html.indexOf(MARK_PHON) < 0, '产物中残留音标占位标记');
  const start = html.indexOf('const WORD_PHONETICS');
  assert(start >= 0, '产物缺少 WORD_PHONETICS 常量');
  const eq = html.indexOf('=', start), open = html.indexOf('{', eq);
  const end = jsonEnd(html, open);
  assert(end > open, 'WORD_PHONETICS 对象边界解析失败');
  const phones = JSON.parse(html.slice(open, end));
  const count = Object.keys(phones).length;
  assert(count > 7000, '音标词条数不足：' + count);
  assert(phones.cancel && (phones.cancel.uk || phones.cancel.us), 'cancel 缺音标');
  assert(phones.apple && phones.nice, '常用词音标缺失');
  const both = Object.values(phones).filter(p => p.uk && p.us).length;
  return count + ' 条音标已内嵌（英美双音标 ' + both + ' 条，跟随口音设置）';
});

console.log('\n合计 6 项，失败 ' + fail + ' 项');
if(fail) process.exitCode = 1;
