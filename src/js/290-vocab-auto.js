/* ---------------- 生词自动收藏 ---------------- */
function questionScope(){
  const u=currentUnit()||{};
  return {gradeId:u.gradeId||'g4',bookId:u.bookId||'b_hj'};
}
function autoStarToken(i,reason){
  if(!state.settings.autoVocab) return;
  const t=curTokens[i]; if(!t||t.punct) return;
  const v=addVocab(t.word,t.hint||'',reason||'练习中自动收藏',questionScope(),true);
  if(v) toast('已自动加入生词本：'+t.word,'ok');
}
function starQuestionWords(){
  const cq=currentQuestion(), scope=questionScope();
  const toks=tokenize(cq.q.en,cq.q.hints,cq.q.cn).filter(t=>!t.punct);
  let added=0;
  toks.forEach(t=>{
    const before=state.vocab.length;
    addVocab(t.word,t.hint||'','练习手动收藏',scope,true);
    if(state.vocab.length>before) added++;
  });
  saveState(); renderDrawer();
  toast(added?'已加入 '+added+' 个生词':'这些词都已在生词本里',added?'ok':'');
}

