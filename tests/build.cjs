/* 源码一致性回归：src/ 模块化源码必须能字节级重建 SpellLab.html。
   防止有人只改产物不改源码（下次 build 会丢失），或只改源码不重建（运行的是旧代码）。 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const shellPath = path.join(root, 'src', 'shell.html');
const jsDir = path.join(root, 'src', 'js');
const htmlPath = path.join(root, 'SpellLab.html');
const MARK_JS = '/* __SPELLLAB_JS_MODULES__ */';

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
  const js = mods.map(f => {
    const text = fs.readFileSync(path.join(jsDir, f), 'utf8');
    assert(text.indexOf('</script') < 0, f + ' 含 </script>');
    return text.endsWith('\n') ? text.slice(0, -1) : text;
  }).join('\n');
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

console.log('\n合计 3 项，失败 ' + fail + ' 项');
if(fail) process.exitCode = 1;
