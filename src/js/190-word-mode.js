/* ---------------- 单词速记模式 ---------------- */
function pickWord(){
  const list=currentUnit().words||[];
  if(!list.length){ $('wordCn').textContent='这个单元暂时没有单词卡'; return; }
  const scored=list.map((w,i)=>({w,i,m:(state.wordStats[w[0]]||{}).m||0}));
  scored.sort((a,b)=>a.m-b.m || Math.random()-0.5);
  const pool=scored.filter(x=>x.w[0]!==lastWord).slice(0,Math.min(5,scored.length));
  const pick=(pool.length?pool:scored)[Math.floor(Math.random()*(pool.length?pool.length:scored.length))];
  lastWord=pick.w[0];
  wordCur=pick.w;
  questionStartedAt=Date.now(); questionMistakes=0;
  renderWord();
  startQuestionTimer(); snapshotSession();
}
function renderWord(){
  if(!wordCur){ pickWord(); return; }
  const en=wordCur[0];
  wordSolved=false; wordAssisted=false; placed=[];
  letters=shuffle(en.split('').map((ch,i)=>({id:i,ch:ch,used:false})));
  if(letters.length>2 && letters.map(l=>l.ch).join('')===en) letters=shuffle(letters);
  $('wordCn').textContent=wordCur[1]||'拼出这个单词';
  $('wordMeta').textContent=en.length+' 个字母 · '+(currentUnit().name||'');
  $('wordFeedback').textContent=''; $('wordFeedback').className='feedback';
  const done=Object.values(state.wordStats).filter(x=>(x.m||0)>=2).length;
  $('wordProgress').textContent='已熟练掌握 '+done+' 个单词 · 本单元共 '+(currentUnit().words||[]).length+' 个';
  drawWordSlots(); drawLetterBank(); renderHeader();
}
function drawWordSlots(){
  const box=$('wordSlots'); box.innerHTML='';
  const en=wordCur[0];
  for(let i=0;i<en.length;i++){
    const d=document.createElement('button');
    d.className='letter-slot'+(placed[i]!=null?' filled':'')+(wordSolved?' ok':'');
    d.textContent=placed[i]!=null?letters[placed[i]].ch:'';
    d.title=placed[i]!=null?'点击撤回这个字母':'';
    d.addEventListener('click',()=>{ if(wordSolved) return; undoAt(i); });
    box.appendChild(d);
  }
}
function drawLetterBank(){
  const bank=$('letterBank'); bank.innerHTML='';
  letters.forEach((l,i)=>{
    const b=document.createElement('button');
    b.className='letter-btn'; b.textContent=l.ch; b.disabled=l.used;
    b.addEventListener('click',()=>addLetter(i));
    bank.appendChild(b);
  });
}
function addLetter(letterId){
  if(wordSolved || letters[letterId].used) return;
  if(placed.length>=wordCur[0].length) return;
  letters[letterId].used=true; placed.push(letterId);
  SFX.key();
  drawLetterBank(); drawWordSlots();
  if(placed.length===wordCur[0].length) judgeWord();
}
function addLetterByKey(ch){
  const i=letters.findIndex(l=>!l.used && l.ch.toLowerCase()===ch.toLowerCase());
  if(i>=0) addLetter(i);
}
function undoAt(i){
  if(wordSolved || placed.length===0) return;
  const id=placed[i];
  if(id==null) return;
  letters[id].used=false;
  placed.splice(i,1);
  SFX.del();
  drawLetterBank(); drawWordSlots();
}
function judgeWord(){
  const en=wordCur[0];
  const typed=placed.map(id=>letters[id].ch).join('');
  const v=state.vocab.find(x=>normWord(x.en)===normWord(en));
  if(typed.toLowerCase()===en.toLowerCase()){
    wordSolved=true;
    SFX.correct();
    const st=state.wordStats[en]||{m:0,ok:0,bad:0};
    if(!wordAssisted){ st.ok++; st.m=Math.min(3,(st.m||0)+1); state.stats.wordRight++; }
    if(v){ v.ok=(v.ok||0)+1; if(!wordAssisted) v.m=Math.min(3,(v.m||0)+1); }
    state.wordStats[en]=st;
    try{ srEnroll(en,wordCur[1]||'',true,false); }catch(e){}
    stopQuestionTimer();
    if(!wordAssisted && Number(state.plan.perCorrect||0)>0)
      addPoints(Number(state.plan.perCorrect),'单词一次拼对');
    addHistory({mode:'word',unit:(currentUnit()&&currentUnit().name)||'',cn:wordCur[1]||'',en:en,
      ok:!wordAssisted,assisted:!!wordAssisted,ms:Date.now()-questionStartedAt,bad:questionMistakes});
    saveState(true);
    $('wordFeedback').textContent='拼对了！ '+en+'  '+(wordCur[1]||''); $('wordFeedback').className='feedback ok';
    document.querySelectorAll('.letter-slot').forEach(x=>x.classList.add('ok'));
    speak(en); renderHeader(); renderDrawer();
    $('wNext').textContent='下一个单词';
  }else{
    SFX.wrong();
    if(v){ v.bad=(v.bad||0)+1; v.m=Math.max(0,(v.m||0)-1); }
    try{ srEnroll(en,wordCur[1]||'',false,true); }catch(e){}
    if(state.settings.autoVocab){
      const before=state.vocab.length;
      addVocab(en,wordCur[1]||'','单词拼错自动收藏',questionScope(),true);
      if(state.vocab.length>before) toast('已自动加入生词本：'+en,'ok');
    }
    questionMistakes++; saveState(true);
    $('wordFeedback').textContent='顺序不对，再试一次'; $('wordFeedback').className='feedback bad';
    document.querySelectorAll('.letter-slot').forEach(x=>{x.classList.add('bad');});
    setTimeout(()=>{
      if(wordSolved) return;
      letters.forEach(l=>l.used=false); placed=[];
      drawLetterBank(); drawWordSlots();
    },520);
  }
}
function showWordAnswer(){
  if(!wordCur || wordSolved) return;
  wordAssisted=true;
  letters.forEach(l=>l.used=true);
  placed=wordCur[0].split('').map(ch=>{
    const i=letters.findIndex(l=>l.ch.toLowerCase()===ch.toLowerCase() && !l.__taken);
    if(i>=0){ letters[i].__taken=true; return i; }
    return 0;
  });
  letters.forEach(l=>delete l.__taken);
  wordSolved=true;
  SFX.flip();
  $('wordFeedback').textContent='答案：'+wordCur[0]+'（'+wordCur[1]+'）· 记住它，下次自己拼';
  $('wordFeedback').className='feedback ok';
  drawLetterBank(); drawWordSlots();
  speak(wordCur[0]);
  $('wNext').textContent='下一个单词';
}

