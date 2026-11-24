/* ---------------- 详细释义词典（数据由构建脚本内嵌，见 tools/build.py） ----------------
   练习默认仍显示词表自带的常用义；点「详细释义」时用这份词典展示多义项 / 词性 / 专业义。
   词典不写进存档：随程序内嵌，各孩子档案和备份都不会变大。查不到时回退到常用义。 */
const WORD_DETAILS = __SPELLLAB_WORD_DETAILS__;
function wordDetail(en, fallback){
  const key=String(en||'').trim().toLowerCase();
  const text=key&&Object.prototype.hasOwnProperty.call(WORD_DETAILS,key)?WORD_DETAILS[key]:'';
  return text?String(text):String(fallback||'');
}
