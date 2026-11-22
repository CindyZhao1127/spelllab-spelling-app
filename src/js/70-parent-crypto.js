/* ---------------- 家长密码 ----------------
   初始管理密码是公开的默认值，用于防止孩子随手改设置；state 里只存
   salt + 哈希，绝不保存明文。刷新或重启程序后家长模式自动重新锁定。 */
const INITIAL_PARENT_PASSWORD = '1234';
const DEFAULT_PARENT = {salt:'spelllab-parent-v1',hash:'',changed:false};
function hashPassword(pwd,salt){
  let a=0x811c9dc5,b=0x9e3779b9,c=0x85ebca6b,d=0xc2b2ae35;
  const s=String(pwd==null?'':pwd)+'|'+String(salt||'');
  for(let r=0;r<3;r++){
    for(let i=0;i<s.length;i++){
      const k=s.charCodeAt(i)+r*31;
      a=Math.imul(a^k,16777619)>>>0;
      b=Math.imul(b^((k<<5)&255),2246822519)>>>0;
      c=(c+Math.imul(k+i,3266489917))>>>0;
      d=(d^((d>>>13)+Math.imul(k,668265263)))>>>0;
      a=(a^(a>>>16))>>>0; b=(b^(b>>>12))>>>0;
      c=(c^(c>>>15))>>>0; d=(d^(d>>>11))>>>0;
    }
  }
  return [a,b,c,d].map(x=>('00000000'+x.toString(16)).slice(-8)).join('');
}
/* 受家长密码保护的功能域。以后要保护别的配置，只需在这里加一项，
   再把对应控件的事件处理包一层 guardParent('域名', fn) 即可。 */
const PARENT_SCOPES = {
  lottery:{label:'抽奖与奖项设置',hint:'奖项内容、中奖概率、每次消耗积分'},
  paperdict:{label:'纸笔听写批改',hint:'显示正确答案、给孩子听写打分'},
  profiles:{label:'孩子档案管理',hint:'新增、改名与删除孩子档案'}
};
let parentUnlocked = false;   // 只在内存里，刷新 / 重启即重新锁定
let parentPending = null;

