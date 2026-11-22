/* ---------- 教材单词的音节分块与自动归类 ----------
   phonicsChunks() 先查 PH_SYLLABLE_DICT：以 Merriam-Webster 词头点分音节
   （拼写记忆用）为准，Cambridge IPA 点分只作发音交叉校订；批量候选来自
   LibreOffice/Pyphen 连字符词典，数据文件在
   textbooks/phonics-syllables.json。未收录的词再按「一个元音核心 = 一个音节」
   和 VCV / VCCV / C+le / V/V / 词缀边界规则兜底。
   phonicsGroup() 仍按 sh / ee / a_e / 短元音 等规律给课本单词分组。
   音素取最常见读音，仅作学习提示，不追求词典级精确。 */
const PH_LETTER_SOUND={a:'æ',b:'b',c:'k',d:'d',e:'e',f:'f',g:'g',h:'h',i:'ɪ',j:'dʒ',k:'k',
  l:'l',m:'m',n:'n',o:'ɒ',p:'p',q:'kw',r:'r',s:'s',t:'t',u:'ʌ',v:'v',w:'w',x:'ks',y:'j',z:'z'};
const PH_PATTERNS=[
  ['eau','juː'],
  ['tion','ʃn'],['ture','tʃə'],['dge','dʒ'],
  ['sh','ʃ'],['ch','tʃ'],['th','θ'],['ph','f'],['wh','w'],['ck','k'],['ng','ŋ'],['qu','kw'],
  ['ee','iː'],['ea','iː'],['ai','eɪ'],['ay','eɪ'],['oa','əʊ'],['oo','uː'],['ou','aʊ'],['ow','əʊ'],
  ['oi','ɔɪ'],['oy','ɔɪ'],['au','ɔː'],['aw','ɔː'],['ew','juː'],['ue','uː'],
  ['ar','ɑː'],['er','ɜː'],['ir','ɜː'],['or','ɔː'],['ur','ɜː'],
  ['bl','bl'],['br','br'],['cl','kl'],['cr','kr'],['dr','dr'],['fl','fl'],['fr','fr'],['gl','gl'],
  ['gr','gr'],['pl','pl'],['pr','pr'],['sl','sl'],['sm','sm'],['sn','sn'],['sp','sp'],['st','st'],
  ['tr','tr'],['tw','tw']
];
const PH_MAGIC={a:'eɪ',e:'iː',i:'aɪ',o:'əʊ',u:'juː'};
function phMagicE(w){
  /* a_e / i_e …：末尾 e + 前面一个辅音 + 元音，即「神奇的 e」 */
  if(w.length<4||w[w.length-1]!=='e') return null;
  const v=w[w.length-3],c=w[w.length-2];
  if(!PH_MAGIC[v]||!/[b-df-hj-np-tv-z]/.test(c)) return null;
  return {v:v,c:c,s:PH_MAGIC[v]};
}
/* 先把单词切成最小读音单元：{t:字母/字母组合, s:音素, v:是否元音核心}。
   元音组合（ee/ea/ai…）与辅音组合（sh/ch/bl…）都优先整体识别；
   神奇 e 里的末尾 e 记为静音，与前面的元音同属一个音节。 */
const PH_VOWEL_TEAMS=['ee','ea','ai','ay','oa','oo','ou','ow','oi','oy','au','aw','ie','ue','ew','eau',
  'ar','er','ir','or','ur'];
function phVowelTeam(t){ return PH_VOWEL_TEAMS.indexOf(t)>=0 || /^[aeiou]$/.test(t); }
function phUnits(word){
  const src=String(word||'').toLowerCase(),out=[];
  const me=phMagicE(src),end=me?src.length-1:src.length;
  let i=0;
  while(i<end){
    if(me&&i===src.length-3){ out.push({t:src[i],s:me.s,v:true}); i++; continue; }
    let hit=null;
    for(let k=0;k<PH_PATTERNS.length;k++){
      const p=PH_PATTERNS[k];
      if(src.substr(i,p[0].length)===p[0]){ hit=p; break; }
    }
    if(hit&&i+hit[0].length<=end){
      const t=hit[0]; out.push({t:t,s:hit[1],v:phVowelTeam(t)}); i+=t.length; continue;
    }
    const ch=src[i];
    out.push({t:ch,s:PH_LETTER_SOUND[ch]||'',v:phVowelTeam(ch)}); i++;
  }
  if(me) out.push({t:'e',s:'不发音',v:false,silent:true});
  /* 连字符、撇号原样保留，不参与音节拆分 */
  for(;i<src.length;i++) if(!/[a-z]/.test(src[i])) out.push({t:src[i],s:'',v:false});
  return out;
}
/* 音节切分规则（主流 Structured Literacy / 音节六分法）：
   1) VC/CV：两元音间 2 个辅音从中间切；digraph（sh/ch/th/ck… 一音二字母）不拆，
      但 st/bl/tr 这类辅音连缀要拆（res·tau·rant）；词尾 C+le（ta·ble）除外
   2) V/CV 先试前切（元音读长音）：1 个辅音归后一节（ba-na / ti-ger / ro-bot）
      —— 主流策略是「先试前切，读起来不像学过的词再改后切」，本程序按先试前切处理
   3) VC/V 后切（元音读短音）：词首若为常见短元音闭音节词（cab-in / sev-en / nev-er），
      改把辅音归前一节；这些是教学里约定俗成读短音的高频词
   4) C+le：词尾「辅音+le」自成末音节（ta-ble / pur-ple / lit-tle），le 的 e 不发音
   5) V/V：两个元音各自成音节、不组成元音组合时中间切（li-on / di-et / ra-di-o）
   6) 前后缀：常见前缀（re/un/dis/pre…）、后缀（ing/ed/er/ful/ly…）在词缀边界切
   （re-play / jump-ing / hope-ful / quick-ly），剩余词根再按上面规则切。
   所有切分都以「一个元音核心 = 一个音节」为底线，保留神奇 e 与元音同节。 */
const PH_VCV_LATE={cabin:1,seven:1,never:1,lemon:1,melon:1,wagon:1,robin:1,camel:1,
  habit:1,rabbit:1,basket:1,pocket:1,rocket:1,banana:0,robot:0,tiger:0}; /* 0=强制前切（长音） */
const PH_PREFIXES=['under','super','inter','over','dis','mis','pre','sub','un','re','in','im','non','out','up','en'];
/* 后缀不含 er/or：它们是 r 控元音（ar/er/ir/or/ur），主流按元音组合整体归节，
   如 tea-cher / com-pu-ter / ti-ger，切在辅音前而不是当独立词缀剥走。 */
const PH_SUFFIXES=['ness','ment','less','ful','ous','ive','able','ible','tion','sion','ing','est','ed','ly','ist','age'];
function phAffixSound(t){
  return phUnits(t).filter(u=>!u.silent).map(u=>u.s).filter(Boolean).join(' ');
}
/* 词典校订表（与 textbooks/phonics-syllables.json 的 curated 字段同步）。
   Pyphen 的断行结果只作参考：gingerbread→gin-ger-bread 可用，
   但 restaurant→restau-rant / tiger 不断行，不能直接当教学音节用。 */
const PH_SYLLABLE_DICT={
  ability:'a|bil|i|ty', activity:'ac|tiv|i|ty', apple:'ap|ple', autumn:'au|tumn',
  banana:'ba|na|na', basket:'bas|ket', beautiful:'beau|ti|ful', because:'be|cause',
  blue:'blue', bread:'bread', breakfast:'break|fast', cabin:'cab|in',
  centimeter:'cen|ti|me|ter', centimetre:'cen|ti|me|tre', children:'chil|dren',
  computer:'com|pu|ter', dictionary:'dic|tion|ary', diet:'di|et', family:'fam|i|ly',
  gingerbread:'gin|ger|bread', happy:'hap|py', hopeful:'hope|ful', information:'in|for|ma|tion',
  instruct:'in|struct', jumping:'jump|ing', kilometer:'ki|lo|me|ter',
  /* 英美音节不同的词：值写成 {uk,us}，数据来自 soundwhy.com 对齐结果。
     marathon 英式 ma/ra/thon（r 归后一节），美式 mar/a/thon（ar 读 /er/ 成节）。 */
  marathon:{uk:'ma|ra|thon',us:'mar|a|thon'},
  kilometre:'ki|lo|me|tre', lion:'li|on', little:'lit|tle', meter:'me|ter', metre:'me|tre',
  millimeter:'mil|li|me|ter', millimetre:'mil|li|me|tre', never:'nev|er',
  purple:'pur|ple', quickly:'quick|ly', rabbit:'rab|bit', readable:'read|able',
  reading:'read|ing', ready:'read|y', real:'real', really:'re|al|ly', recent:'re|cent',
  replay:'re|play', respect:'re|spect', rest:'rest', result:'re|sult',
  restaurant:'res|tau|rant', sauce:'sauce', seven:'sev|en', table:'ta|ble',
  teacher:'tea|cher', tiger:'ti|ger', true:'true', window:'win|dow'
};
/* 少量发音例外：字母组合与常见音不一致时，避免拆分正确但提示音误导。 */
const PH_SOUND_FIX={
  bread:'b r e d', 'breakfast|0':'b r e k', 'gingerbread|2':'b r e d',
  'centimeter|2':'m iː', 'centimetre|2':'m iː', 'kilometer|2':'m iː',
  'kilometre|2':'m iː', 'kilometer|0':'k i', 'kilometre|0':'k i',
  'meter|0':'m iː', 'metre|0':'m iː',
  'millimeter|2':'m iː', 'millimetre|2':'m iː',
  'ready|0':'r e d', 'ready|1':'ɪ', 'readable|0':'r iː d',
  'reading|0':'r iː d', 'tiger|0':'t aɪ',
  /* soundwhy.com 英美对齐：marathon 三节的音素随口音不同 */
  'marathon|0':{uk:'m æ',us:'m er'}, 'marathon|1':{uk:'r ə',us:'ə'},
  'marathon|2':{uk:'θ ə n',us:'θ ɑː n'}
};
/* 校订值可能是 {uk,us}（英美不同）或字符串（通用），按当前口音取。 */
function phPick(v){ return (v && typeof v==='object' && !Array.isArray(v))
  ? (v[speechAccent()]||v.uk||v.us||'') : v; }
function phChunkSound(word,part,i){
  const fixed=PH_SOUND_FIX[word+'|'+i]||PH_SOUND_FIX[part];
  const picked=phPick(fixed);
  if(picked) return picked;
  return phUnits(part).filter(u=>!u.silent).map(u=>u.s).filter(Boolean).join(' ');
}
function phonicsChunks(word){
  const src=String(word||'').toLowerCase();
  if(!src) return [];
  const dict=phPick(PH_SYLLABLE_DICT[src]);
  if(dict) return dict.split('|').map((part,i)=>[part,phChunkSound(src,part,i)]);
  /* 先剥词缀：前缀、后缀整体成节，词根再按音节规则切 */
  let pre='', suf='', root=src;
  for(const p of PH_PREFIXES){
    /* re 是高频前缀，但 ready/real/restaurant 等 re 属于词根，不能剥；
       这些词靠 VCV 规则照样切对（re·cent / res·tau·rant）。 */
    if(p==='re' && /^(restaurant|ready|really|real|reason|recent|result|rest|respect)/.test(src)) continue;
    if(src.length-p.length>=3 && src.indexOf(p)===0){
      pre=p; root=src.slice(p.length); break;
    }
  }
  for(const s of PH_SUFFIXES){
    if(root.length-s.length>=3 && root.slice(-s.length)===s &&
       /[aeiou]/.test(root.slice(0,-s.length))){
      suf=s; root=root.slice(0,-s.length); break;
    }
  }
  /* 切分单元：辅音连缀（bl/st/tr…）主流要拆到两音节里（res·tau·rant），
     只有词尾 C+le（ta·ble / ap·ple）的 l 连缀整体留末节；digraph（sh/ch/th）不拆。 */
  const rawU=phUnits(root), units=[];
  rawU.forEach((u,ix)=>{
    if(/^(bl|br|cl|cr|dr|fl|fr|gl|gr|pl|pr|sl|sm|sn|sp|st|tr|tw)$/.test(u.t)){
      const cle=/l$/.test(u.t)&&ix===rawU.length-2&&rawU[ix+1]&&rawU[ix+1].t==='e';
      if(!cle){ units.push({t:u.t[0],s:u.t[0],v:false},{t:u.t[1],s:u.t[1],v:false}); return; }
    }
    units.push(u);
  });
  const out=[];
  if(pre) out.push([pre,phAffixSound(pre)]);
  if(!units.length){ if(suf) out.push([suf,phAffixSound(suf)]); return out; }
  const vowelIdx=[];
  units.forEach((u,i)=>{ if(u.v) vowelIdx.push(i); });
  if(!vowelIdx.length){
    out.push([units.map(u=>u.t).join(''),'']);
    if(suf) out.push([suf,phAffixSound(suf)]);
    return out;
  }
  /* 判断首音节是否按短音后切：VCV 且首音节元音是短元音字母（非元音组合） */
  const lateVcv = vowelIdx.length>=2 && vowelIdx[1]-vowelIdx[0]===2 &&
    PH_VCV_LATE[src]===1 && /^[aeiou]$/.test(units[vowelIdx[0]].t);
  const groups=[];
  let start=0;
  for(let k=0;k<vowelIdx.length;k++){
    const v=vowelIdx[k], next=vowelIdx[k+1];
    let end=units.length;
    if(next!==undefined){
      const gap=next-v-1;
      if(gap<=0) end=next;                 /* V/V：两元音各自成节 */
      else if(gap===1) end=(k===0&&lateVcv)?next:next-1; /* V/CV 前切；短音词后切 */
      else if(gap===2){
        const pair=units[next-2].t+units[next-1].t;
        /* 只有 digraph（sh/ch/th/ph/wh/ck/ng/qu 等一音二字母）不可拆；
           st/bl/tr 这类辅音连缀已在上面展开，VCCV 从中间切开。 */
        const cluster=/^(tion|ture|dge|sh|ch|th|ph|wh|ck|ng|qu)$/.test(pair);
        end=cluster?next-2:next-1;          /* 二合辅音不拆 */
      } else end=next-2;                    /* 三辅音以上：首辅音归前 */
    }
    if(end<=start) end=start+1;
    groups.push(units.slice(start,end));
    start=end;
  }
  /* C+le：末两个音节若形如「辅音 + le（静音 e）」，把辅音从上一节挪到 le 节 */
  if(groups.length>=2){
    const last=groups[groups.length-1], prev=groups[groups.length-2];
    const lastLetters=last.map(u=>u.t).join('');
    if(/^[^aeiou]?le$/.test(lastLetters) && last.some(u=>u.silent) && prev.length>1){
      const moved=prev.pop();
      last.unshift(moved);
    }
  }
  groups.filter(g=>g.length).forEach(g=>{
    const letters=g.map(u=>u.t).join('');
    const sound=g.filter(u=>!u.silent).map(u=>u.s).filter(Boolean).join(' ');
    out.push([letters,sound]);
  });
  if(suf) out.push([suf,phAffixSound(suf)]);
  return out;
}
function phonicsGroup(word){
  const w=String(word||'').toLowerCase().replace(/[^a-z]/g,'');
  if(!w) return null;
  const me=phMagicE(w);
  if(me) return {id:me.v+'_e',name:me.v+'_e /'+me.s+'/',sound:me.s};
  for(let k=0;k<PH_PATTERNS.length;k++){
    const p=PH_PATTERNS[k];
    if(w.indexOf(p[0])>=0) return {id:p[0],name:p[0]+' /'+p[1]+'/',sound:p[1]};
  }
  const v=w.match(/[aeiou]/);
  if(v) return {id:'short-'+v[0],name:'短元音 '+v[0]+' /'+PH_LETTER_SOUND[v[0]]+'/',sound:PH_LETTER_SOUND[v[0]]};
  return {id:'other',name:'其他字母组合',sound:''};
}
const DEFAULT_PHONICS = {done:{},textbookDone:{},correct:0,attempted:0};
const DEFAULT_PLAN = {enabled:false,type:'units',target:3,reward:20,penalty:10,perCorrect:1,
  points:0,ledger:[],results:{},since:'',lastEval:''};
/* lottery.typingPoints：打字练习每局兑换的积分；lottery.dailyLimit：每天最多抽奖次数；
   lottery.daily：按天滚动的抽奖记录（draws 当天已抽次数、won 当天是否已中奖、
   afterWin 中奖后又抽了几次，用来按 2 的幂递增消耗）。 */
const DEFAULT_LOTTERY = {cost:10,typingPoints:1,dailyLimit:3,
  prizes:clone(DEFAULT_PRIZES),log:[],daily:{date:'',draws:0,won:false,afterWin:0}};
const LOTTERY_COST_CAP = 99999;   // 翻倍消耗的硬上限，避免 2^n 溢出
const LEDGER_LIMIT = 200, LOTTERY_LOG_LIMIT = 100, SESSION_MAX_AGE = 7*24*3600*1000;

