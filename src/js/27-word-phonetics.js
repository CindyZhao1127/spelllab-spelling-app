/* ---------------- 英美音标词典（数据由构建脚本内嵌，见 tools/build.py） ----------------
   来源：qwerty-learner 开源词库原始 usphone/ukphone，7780 词，不写进孩子档案。
   练习卡片默认显示音标提示，跟随顶栏「朗读口音」选英式 / 美式；只有一套时回退另一套。 */
const WORD_PHONETICS = __SPELLLAB_PHONETICS__;
function wordPhonetic(en){
  const key=String(en||'').trim().toLowerCase();
  if(!key || !Object.prototype.hasOwnProperty.call(WORD_PHONETICS,key)) return '';
  const p=WORD_PHONETICS[key]||{};
  const want=speechAccent()==='us'?'us':'uk';
  let v=String(p[want]||p[want==='us'?'uk':'us']||'').trim();
  v=v.replace(/^\/+|\/+$/g,'').replace(/'/g,'ˈ');
  return v?'/'+v+'/':'';
}
