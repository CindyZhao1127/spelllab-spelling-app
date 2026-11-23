/* ---------------- 句子语法成分标注（轻量规则，仅作学习参考） ----------------
   零依赖、不联网：按小学/初中常见句型做近似判断，不追求语言学完备。
   练习中只显示中文提示，答对后才显示英文，避免提前把答案摆出来。 */
const GR_ROLE_NAME = {
  subject:'主语', predicate:'谓语', object:'宾语', predicative:'表语',
  attribute:'定语', adverbial:'状语', complement:'补语', conjunction:'连词', lead:'引导词'
};
const GR_ROLE_STYLE = {
  subject:'gr-sub', predicate:'gr-pred', object:'gr-obj', predicative:'gr-predc',
  attribute:'gr-attr', adverbial:'gr-adv', complement:'gr-comp',
  conjunction:'gr-conj', lead:'gr-lead'
};
const GR_BE = new Set(['am','is','are','was','were','be','been','being',"'m","'re","'s",'s']);
const GR_AUX = new Set(['do','does','did','have','has','had','will','would','can','could',
  'shall','should','may','might','must']);
const GR_DET = new Set(['a','an','the','this','that','these','those','my','your','his','her',
  'our','their','its','some','any','each','every','no','all','many','much','few','other','which','what']);
const GR_PRON = new Set(['i','you','he','she','it','we','they','me','him','us','them',
  'myself','yourself','himself','herself','itself','ourselves','themselves']);
const GR_PREP = new Set(['in','on','at','to','with','for','from','of','by','about','under',
  'over','near','behind','between','into','onto','through','during','before','after','above','below']);
const GR_CONJ = new Set(['and','but','or','so','because','when','while','if','although','as']);
const GR_ADV = new Set(['not','now','then','here','there','today','yesterday','tomorrow',
  'very','too','often','always','usually','sometimes','never','again','well','fast','really',
  'just','still','also','only','home','out','up','down','away','back','together','everywhere',
  'both','ago','please','no','hello','hi','hey','wow','oh','quickly','slowly','carefully','beautifully','clearly','loudly',
  'quietly','exactly','finally','certainly','eagerly','politely','safely']);
/* 常见形容词（小学词汇为主）：用于区分「a red pen」里的定语和宾语 */
const GR_ADJ = new Set(['red','blue','green','yellow','black','white','brown','orange',
  'big','small','tall','short','long','new','old','young','good','bad','happy','sad',
  'nice','kind','fine','great','little','busy','easy','hard','hot','cold','warm','cool',
  'clean','dirty','pretty','beautiful','favourite','favorite','strong','weak','fat','thin',
  'right','wrong','heavy','light','high','low','wide','close','open','slow','quick','tidy',
  'delicious','healthy','expensive','sunny','cloudy','rainy','windy','snowy','tall','young',
  'funny','sorry','glad','tired','hungry','thirsty','ready','sure','free']);
const GR_TIME = new Set(['day','week','month','year','morning','afternoon','evening','night']);
/* 常见缩写：一个词槽同时承载两个成分（It's = 主语 it + 谓语 is） */
const GR_CONTRACT = {
  "i'm":['i','am'], "it's":['it','is'], "he's":['he','is'], "she's":['she','is'],
  "what's":['what','is'], "who's":['who','is'], "that's":['that','is'],
  "there's":['there','is'], "where's":['where','is'], "how's":['how','is'],
  "you're":['you','are'], "we're":['we','are'], "they're":['they','are'],
  "i've":['i','have'], "we've":['we','have'], "you've":['you','have'], "they've":['they','have'],
  "i'll":['i','will'], "we'll":['we','will'], "you'll":['you','will'], "they'll":['they','will'],
  "he'll":['he','will'], "she'll":['she','will'],
  "i'd":['i','would'], "we'd":['we','would'], "you'd":['you','would'], "they'd":['they','would'],
  "don't":['do'], "doesn't":['does'], "didn't":['did'], "isn't":['is'], "aren't":['are'],
  "wasn't":['was'], "weren't":['were'], "can't":['can'], "cannot":['can'], "won't":['will'],
  "couldn't":['could'], "wouldn't":['would'], "shouldn't":['should'], "mustn't":['must'],
  "hasn't":['has'], "haven't":['have'], "hadn't":['had'], "let's":['let']
};
function grIsAdv(w){
  /* -ily/-ally 结尾多半是形容词或人名（Lily / family / friendly），别当副词 */
  return GR_ADV.has(w) || (/ly$/.test(w) && !/(ily|ally)$/.test(w));
}
function grIsAdj(w){
  /* 只用显式词表：后缀规则会把 English(-ish)、table(-able) 误判成形容词 */
  return GR_ADJ.has(w);
}
const GR_VERB = new Set(['like','likes','love','loves','want','wants','need','needs','go','goes',
  'come','comes','eat','eats','drink','drinks','play','plays','watch','watches','read','reads',
  'write','writes','sing','sings','dance','dances','run','runs','jump','jumps','swim','swims',
  'sleep','sleeps','sit','sits','stand','stands','open','opens','close','closes','buy','buys',
  'take','takes','give','gives','get','gets','make','makes','see','sees','look','looks','find',
  'finds','know','knows','think','thinks','say','says','tell','tells','ask','asks','answer',
  'answers','help','helps','work','works','study','studies','learn','learns','teach','teaches',
  'ride','rides','drive','drives','fly','flies','live','lives','stop','stops','start','starts',
  'begin','begins','finish','finishes','try','tries','use','uses','show','shows','send','sends',
  'wear','wears','put','puts','cut','cuts','wash','washes','clean','cleans','draw','draws',
  'color','colors','count','counts','spell','spells','meet','meets','greet','greets','enjoy',
  'enjoys','speak','speaks','talk','talks','walk','walks','listen','listens','feel','feels',
  'bring','brings','leave','leaves','arrive','arrives','stay','stays','grow','grows','plant',
  'plants','water','waters','have','has','had',
  /* 教材高频补充：含不规则过去式、祈使句动词 */
  'spend','spends','spent','brush','brushes','brushed','sweep','sweeps','swept',
  'believe','believes','believed','remember','remembers','remembered',
  'travel','travels','travelled','support','supports','supported',
  'win','won','build','built','pay','pays','paid','agree','agrees','agreed',
  'went','ate','eaten','saw','seen','did','done','got','made','took','came','said','told',
  'gave','found','thought','knew','bought','brought','felt','left','met','wrote','ran',
  'swam','sang','sat','stood','slept','spoke','taught','drove','rode','flew','began',
  'drew','drank','grew','wore','caught','broke','held','heard','understood','became',
  'chose','forgot','lost','fell','led',
  'discuss','discusses','discussed','forget','forgets','waste','wastes','wasted',
  'throw','throws','threw','add','adds','added','reply','replies','replied',
  'communicate','communicates','communicated','keep','keeps','kept',
  'welcome','welcomes','welcomed','colour','colours','coloured','let','thank','thanks',
  'climb','climbs','paint','paints','cook','cooks','bake','bakes','mix','mixes','taste',
  'tastes','smell','smells','touch','touches','pick','picks','carry','carries','push',
  'pushes','pull','pulls','hide','hid','solve','solves','explain','explains','describe',
  'introduce','introduces','protect','protects','recycle','recycles','save','saves',
  'pollute','reduces','reduce','reuse','repair','repairs','return','returns','refuse',
  'accept','accepts','decide','decides','plan','plans','prefer','imagine','guess','guesses',
  'hope','hopes','wish','wishes','mind','minds','care','cares','worry','worries',
  'follow','follows','serve','serves','practice','practices','train','trains','exercise',
  'relax','relaxes','rest','rests','share','shares','improve','improves','raise','raises']);

function grLooksVerb(w){
  if(String(w).length < 4) return false;
  if(/ing$/.test(w)) return true;
  if(/ed$/.test(w)) return true;
  if(/es$/.test(w) && !/ses$/.test(w)) return true;
  if(/s$/.test(w) && !/(ss|us|is|as)$/.test(w)) return true;
  return false;
}
/* 返回与 tokens 等长的角色数组：'', subject, predicate, object ...
   缩写词的两个成分用 '|' 连接（subject|predicate），显示时拆成「主语+谓语」。 */
function grammarRoles(tokens){
  const roles=new Array(tokens.length).fill('');
  const ws=[];
  tokens.forEach((t,i)=>{
    if(t.punct || !t.word) return;
    const w=String(t.word).toLowerCase();
    const exp=GR_CONTRACT[w];
    if(exp){
      ws.push({k:i,w:exp[0]});
      if(exp[1]) ws.push({k:i,w:exp[1],dual:true});
    }else ws.push({k:i,w});
  });
  if(ws.length<2) return roles;
  const words=ws.map(x=>x.w);
  const put=(k,r)=>{
    if(k<0||k>=ws.length) return;
    const ti=ws[k].k, cur=roles[ti];
    if(!cur){ roles[ti]=r; return; }
    if(cur===r || cur.split('|').indexOf(r)>=0) return;
    if(ws[k].dual && cur.indexOf('|')<0) roles[ti]=cur+'|'+r;
  };

  /* 找动词 / 系动词 / 助动词，显式词表优先 */
  let v=-1;
  for(let k=0;k<words.length;k++){
    if(GR_BE.has(words[k]) || GR_AUX.has(words[k]) || GR_VERB.has(words[k])){ v=k; break; }
  }
  if(v<0) for(let k=1;k<words.length;k++){ if(grLooksVerb(words[k])){ v=k; break; } }
  if(v<0){
    /* 无动词句（感叹 / 名词短语）：尽量标出修饰关系，不再显示「无法判断」 */
    let noVerbInPrep=false;
    for(let k=0;k<words.length;k++){
      const w=words[k];
      if(GR_CONJ.has(w)){ put(k,'conjunction'); noVerbInPrep=false; continue; }
      if(GR_PREP.has(w)){ put(k,'adverbial'); noVerbInPrep=true; continue; }
      if(noVerbInPrep){ put(k,'adverbial'); continue; }
      if(grIsAdv(w)){ put(k,'adverbial'); continue; }
      if(GR_DET.has(w) || grIsAdj(w)){ put(k,'attribute'); continue; }
      put(k,'subject');
    }
    return roles;
  }

  const first=words[0];
  let subject=-1, isThereBe=false;
  const preds=[];
  const auxStart = GR_AUX.has(first) || GR_BE.has(first);
  const imperative = !auxStart && GR_VERB.has(first);
  const negImperative = (first==='do'||first==='does'||first==='did') &&
    words[1] && GR_VERB.has(words[1]);
  if(negImperative){
    /* Don't + 动词原形：祈使否定，主语省略 */
    subject=-1; preds.push(0); preds.push(1);
  }else if(imperative){
    /* 动词原形开头：祈使句，主语省略 */
    subject=-1; preds.push(0);
  }else if(v===0){
    /* 疑问句：Do / Is / Can 开头，主语在助动词后面 */
    subject=1; preds.push(0);
    for(let k=2;k<words.length;k++){
      if(GR_VERB.has(words[k]) || grLooksVerb(words[k])){ preds.push(k); break; }
    }
  }else{
    for(let k=v-1;k>=0;k--){
      const w=words[k];
      if(GR_PRON.has(w) || (!GR_DET.has(w) && !GR_ADV.has(w) &&
         !GR_PREP.has(w) && !GR_CONJ.has(w))){ subject=k; break; }
    }
    if(subject<0) subject=0;
    let pv=v;
    while(pv>subject+1 && GR_AUX.has(words[pv-1])) pv--;
    preds.push(pv);
  }
  if(first==='please'){ subject=-1; put(0,'adverbial'); }
  if(words[0]==='there' && GR_BE.has(words[1])){
    /* There be 句型：there 是引导词，真正的主语在 be 之后 */
    isThereBe=true; put(0,'lead'); preds.length=0; preds.push(1); subject=-1;
    for(let k=2;k<words.length;k++){
      if(!GR_DET.has(words[k]) && !GR_ADV.has(words[k])){ subject=k; break; }
    }
  }
  if(subject>=0) put(subject,'subject');

  const start=Math.min.apply(null,preds), end=Math.max.apply(null,preds);
  for(let k=start;k<=end;k++) put(k,'predicate');
  let predEnd=end;
  for(let k=end+1;k<words.length;k++){
    if(GR_AUX.has(words[k]) || /ing$/.test(words[k]) || GR_VERB.has(words[k])){
      put(k,'predicate'); predEnd=k;
    } else break;
  }
  const beLink = GR_BE.has(words[end]) && predEnd===end &&
    !words.slice(end+1).some(w=>GR_VERB.has(w) || /ing$/.test(w));

  /* 主语前后的修饰语 */
  for(let k=0;k<start;k++){
    const w=words[k];
    put(k, grIsAdv(w) ? 'adverbial' : 'attribute');
  }
  for(let k=Math.max(0,subject+1);k<start;k++){
    const w=words[k];
    put(k, grIsAdv(w) ? 'adverbial' : 'attribute');
  }

  /* 谓语之后：宾语 / 表语 / 状语 / 补语 */
  let inPrep=false, objectTaken=false, prevAdv=false;
  for(let k=predEnd+1;k<words.length;k++){
    const w=words[k];
    if(GR_CONJ.has(w)){ put(k,'conjunction'); inPrep=false; prevAdv=false; continue; }
    if(GR_PREP.has(w)){ put(k,'adverbial'); inPrep=true; prevAdv=true; continue; }
    if(inPrep){ put(k,'adverbial'); continue; }
    /* every day / every week / long ago 这类时间短语整体作状语 */
    if(w==='every' && GR_TIME.has(words[k+1])){
      put(k,'adverbial'); prevAdv=true; continue;
    }
    if(w==='long' && words[k+1]==='ago'){ put(k,'adverbial'); prevAdv=true; continue; }
    if(prevAdv && (w==='much'||w==='many')){ put(k,'adverbial'); prevAdv=true; continue; }
    if(GR_DET.has(w)){ put(k,'attribute'); prevAdv=false; continue; }
    const adv = grIsAdv(w) || (prevAdv && GR_TIME.has(w));
    if(adv){ put(k,'adverbial'); prevAdv=true; continue; }
    prevAdv=false;
    /* 系动词后统一作表语；实义动词后第一个名词性成分是宾语，
       其前的形容词是定语，再往后的名词才作补语（如 call him Tom）。 */
    if(beLink){ put(k,'predicative'); continue; }
    if(!objectTaken && grIsAdj(w)){ put(k,'attribute'); continue; }
    if(!objectTaken){ put(k,'object'); objectTaken=true; continue; }
    put(k,'complement');
  }
  return roles;
}

function syncGrammarToggle(){
  const b=$('btnGrammar'); if(!b) return;
  const on=!!state.settings.showGrammar;
  b.classList.toggle('on',on);
  b.textContent='语法标注：'+(on?'开':'关');
  b.setAttribute('aria-pressed',on?'true':'false');
}
function toggleGrammar(){
  state.settings.showGrammar=!state.settings.showGrammar;
  saveState(true);
  syncGrammarToggle();
  renderGrammarBar();
}
function renderGrammarBar(){
  const bar=$('grammarBar'); if(!bar) return;
  const visible=!!state.settings.showGrammar && mode!=='word' &&
    curTokens && curTokens.length>1;
  bar.hidden=!visible;
  if(!visible){ bar.innerHTML=''; return; }
  const roles=grammarRoles(curTokens);
  const chunks=[];
  roles.forEach((r,i)=>{
    if(!r) return;
    let txt = solved ? (curTokens[i].word||'')
                     : (state.settings.showHints !== false ? (curTokens[i].hint||'·') : '·');
    const last=chunks[chunks.length-1];
    if(last && last.role===r) last.parts.push(txt);
    else chunks.push({role:r,parts:[txt]});
  });
  if(!chunks.length){ bar.innerHTML='<span class="grammar-note">这句话暂无法自动判断成分</span>'; return; }
  bar.innerHTML='<span class="grammar-note">语法成分 · 规则自动标注，仅供参考</span>'+
    chunks.map(c=>{
      const parts=c.role.split('|');
      const name=parts.map(x=>GR_ROLE_NAME[x]||x).join('+');
      return '<span class="grammar-chip '+(GR_ROLE_STYLE[parts[0]]||'')+'"><b>'+
        esc(name)+'</b>'+esc(c.parts.join(' '))+'</span>';
    }).join('');
}
