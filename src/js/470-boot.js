/* ---------------- 启动 ---------------- */
rollDay();
renderToolbars();
bind();
renderFilters();
switchTab('learn');
renderSentence();
renderDrawer();
if('speechSynthesis' in window){ window.speechSynthesis.getVoices(); }
if(DESKTOP) bootDesktop(); else bootStorage();
if(typeof window!=='undefined' && typeof window.addEventListener==='function'){
  window.addEventListener('pagehide',flushStorage);
  window.addEventListener('beforeunload',flushStorage);
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='hidden') flushStorage();
  });
  if(!DESKTOP) window.addEventListener('storage',e=>{
    if(!e || e.key!==KEY || !e.newValue) return;
    try{
      const ts=Number(localStorage.getItem(MIRROR_TS)||0)||0;
      if(ts<=STORE.savedAt) return;   // 只接受比本页更新的写入
      state=normalizeState(JSON.parse(e.newValue));
      STORE.savedAt=ts;
      applyLoadedState();
      toast('已同步其他标签页的更新');
    }catch(err){}
  });
}


