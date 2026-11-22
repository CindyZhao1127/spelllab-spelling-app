/* ---------------- 通用 ---------------- */
function toast(msg,type){
  const el=$('toast'); el.textContent=msg; el.className='toast show'+(type?' '+type:'');
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.className='toast',1900);
}
/* 语音朗读者：英文口音跟随全局 accent（uk=en-GB / us=en-US）；
   纸笔听写可指定中文读音（听中文写英文）。 */
/* 专有名词发音修正：TTS 常把带撇号/缩写的专名拆开乱读（如 Xi'an 读成「xi an」）。
   只在送入语音引擎前替换文本，不影响屏幕显示、拼写判定与教材原文。 */
const SPEECH_PRON_FIX = [
  [/\bXi'?an\b/gi, 'Shee-ahn']
];
function speechText(text){
  let s = text==null ? '' : String(text);
  SPEECH_PRON_FIX.forEach(pair => { s = s.replace(pair[0], pair[1]); });
  return s;
}
function speechAccent(){ return state.settings.accent==='us' ? 'us' : 'uk'; }
function englishLang(){ return speechAccent()==='us' ? 'en-US' : 'en-GB'; }
function speakLang(text, lang, rate){
  if(!('speechSynthesis' in window)){ toast('当前浏览器不支持朗读','bad'); return; }
  try{
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(speechText(text));
    const isZh = /^zh/i.test(lang||'');
    u.lang = lang || englishLang();
    u.rate = typeof rate==='number' ? rate : (isZh ? 1 : (Number(state.settings.rate)||0.9));
    u.pitch = 1;
    const voices = (window.speechSynthesis.getVoices && window.speechSynthesis.getVoices()) || [];
    const want = speechAccent()==='us' ? /en[-_]US/i : /en[-_]GB/i;
    const v = isZh
      ? (voices.find(v=>/zh[-_]CN/i.test(v.lang)) || voices.find(v=>/^zh/i.test(v.lang)))
      : (voices.find(v=>want.test(v.lang)) || voices.find(v=>/^en[-_]/i.test(v.lang)));
    if(v) u.voice=v;
    window.speechSynthesis.speak(u);
  }catch(e){ toast('朗读暂不可用','bad'); }
}
function speak(text){ speakLang(text, englishLang()); }
function tokenize(en,hints,cn){
  const raw = String(en).match(/[A-Za-z][A-Za-z'-]*|[^A-Za-z\s]/g) || [];
  let hi=0;
  return raw.map(w=>{
    if(/^[A-Za-z]/.test(w)) return {word:w,hint:(hints&&hints[hi++])||'',punct:false};
    return {word:w,hint:PUNCT_CN[w]||w,punct:true};
  });
}
function shuffle(arr){
  const a=arr.slice();
  for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}

/* ---------------- 音效：Web Audio 实时合成 ---------------- */
let actx = null;
function ensureAudio(){
  if(!state.settings.sound) return null;
  try{
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return null;
    if(!actx) actx = new AC();
    if(actx.state==='suspended' && actx.resume) actx.resume();
    return actx;
  }catch(e){ return null; }
}
function tone(freq,dur,type,vol,delay,glideTo){
  const c = ensureAudio(); if(!c) return;
  try{
    const t0 = c.currentTime + (delay||0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type||'sine';
    o.frequency.setValueAtTime(freq,t0);
    if(glideTo) o.frequency.exponentialRampToValueAtTime(glideTo,t0+dur);
    const v = state.settings.volume;
    const level = Math.max(0.0002,(vol||0.2)*(typeof v==='number'?v:0.35));
    g.gain.setValueAtTime(0.0001,t0);
    g.gain.exponentialRampToValueAtTime(level,t0+0.012);
    g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
    o.connect(g); g.connect(c.destination);
    o.start(t0); o.stop(t0+dur+0.02);
  }catch(e){}
}
const SFX = {
  key(){ tone(620+Math.random()*120,0.055,'triangle',0.16,0,470); },
  del(){ tone(340,0.06,'triangle',0.12,0,250); },
  correct(){ tone(659,0.11,'sine',0.30); tone(880,0.15,'sine',0.26,0.085); },
  wrong(){ tone(300,0.13,'sine',0.26,0,210); tone(190,0.15,'triangle',0.18,0.09); },
  complete(){ [523,659,784,1047].forEach((f,i)=>tone(f,0.20,'sine',0.26,i*0.085)); },
  step(){ tone(520,0.09,'sine',0.20); tone(780,0.12,'sine',0.18,0.07); },
  flip(){ tone(480,0.07,'triangle',0.14,0,630); }
};

