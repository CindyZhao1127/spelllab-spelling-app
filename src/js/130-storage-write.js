function loadState(){
  /* 空存档也要走 normalizeState：默认管理密码的哈希在这里生成，
     否则全新安装时 state.parent.hash 为空，初始密码永远校验不过。 */
  try{
    const raw=localStorage.getItem(KEY);
    return normalizeState(raw?JSON.parse(raw):clone(DEFAULT_STATE));
  }catch(e){ return normalizeState(clone(DEFAULT_STATE)); }
}
function mirrorTimestamp(){
  try{ return Number(localStorage.getItem(MIRROR_TS)||0)||0; }catch(e){ return 0; }
}
function writeMirror(force){
  const now=Date.now();
  if(STORE.mirror==='disabled' && !force) return false;
  if(!force && STORE.mirrorBytes>600000 && now-STORE.lastMirror<800) return false;
  let text;
  try{ text=JSON.stringify(state); }catch(e){ return false; }
  try{
    localStorage.setItem(KEY,text);
    localStorage.setItem(MIRROR_TS,String(STORE.savedAt||now));
    STORE.mirrorBytes=text.length; STORE.lastMirror=now; STORE.mirror='ok';
    return true;
  }catch(e){
    STORE.mirror='disabled';
    try{ localStorage.removeItem(KEY); localStorage.removeItem(MIRROR_TS); }catch(_){}
    return false;
  }
}
/* immediate=true 用于「答对 / 答错 / 完成单词」等关键节点：立刻写盘，
   不等防抖；否则用户刚做完就关窗口，最后几条练习会留在内存里丢失。 */
function saveState(immediate){
  STORE.savedAt=Date.now();
  STORE.dirty=true;
  if(DESKTOP){
    if(STORE.mode==='sqlite'){
      if(immediate) flushDesktopNow(); else scheduleDesktopSave();
    }
  }else{
    writeMirror(false);
    if(STORE.mode==='idb' && STORE.db){
      if(immediate){
        writeNow().then(ok=>{
          if(ok){ STORE.dirty=false; STORE.lastFlush=Date.now(); renderSaveBadge(); }
        });
      }else scheduleDBWrite();
    }
  }
  renderSaveBadge();
}
function idbOpen(){
  return new Promise((resolve,reject)=>{
    if(typeof indexedDB==='undefined' || !indexedDB){ reject(new Error('IndexedDB 不可用')); return; }
    let req;
    try{ req=indexedDB.open(DB_NAME,DB_VER); }catch(e){ reject(e); return; }
    req.onupgradeneeded=()=>{
      try{
        const db=req.result;
        if(db.objectStoreNames && !db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
      }catch(e){}
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error('打开数据库失败'));
    req.onblocked=()=>reject(new Error('数据库被其他标签页占用'));
  });
}
function idbCall(key,value,write){
  return new Promise((resolve,reject)=>{
    if(!STORE.db){ reject(new Error('数据库未就绪')); return; }
    let req;
    try{
      const tx=STORE.db.transaction(DB_STORE,write?'readwrite':'readonly');
      const os=tx.objectStore(DB_STORE);
      req=write?os.put(value,key):os.get(key);
    }catch(e){ reject(e); return; }
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error('数据库读写失败'));
  });
}
function dbRecord(ts){
  return {format:'spelllab.db.v1',savedAt:ts||Date.now(),state:clone(state)};
}
function writeNow(){
  if(STORE.mode!=='idb' || !STORE.db) return Promise.resolve(false);
  return idbCall(DB_KEY_MAIN,dbRecord(STORE.savedAt),true).then(()=>{
    STORE.error=''; scheduleFileSync(); return true;
  }).catch(e=>{
    STORE.error=String((e&&e.message)||e); return false;
  });
}
function scheduleDBWrite(){
  STORE.queued=true;
  if(STORE.timer) return;
  STORE.timer=setTimeout(()=>{
    STORE.timer=0;
    if(!STORE.queued) return;
    STORE.queued=false;
    writeNow().then(ok=>{
      if(ok){ STORE.dirty=false; STORE.lastFlush=Date.now(); renderSaveBadge(); }
      if(drawerTab==='storage') renderStorage();
    });
  },60);
}
/* 页面卸载 / 切后台时的最后一道保险。桌面版必须用 sendBeacon：
   普通 fetch 在 beforeunload 里会被浏览器取消，服务端又随窗口一起退出。 */
function flushStorage(){
  /* 关窗前把题目指针、模式与未填完的字母一起写进 state，供下次启动恢复 */
  try{ snapshotSession(false); }catch(e){}
  if(DESKTOP){
    if(STORE.desktopTimer){ try{ clearTimeout(STORE.desktopTimer); }catch(e){} STORE.desktopTimer=0; }
    STORE.queued=false;
    if(STORE.dirty && STORE.mode==='sqlite'){
      STORE.dirty=false;
      DESKTOP_API.beacon(clone(state));
    }
    return;
  }
  writeMirror(true);                 // localStorage 是同步写，关页也来得及
  STORE.dirty=false;
  if(STORE.timer){ try{ clearTimeout(STORE.timer); }catch(e){} STORE.timer=0; }
  if(STORE.mode==='idb'){ STORE.queued=false; writeNow(); }
}
function flushDesktopNow(){
  if(STORE.desktopTimer){ try{ clearTimeout(STORE.desktopTimer); }catch(e){} STORE.desktopTimer=0; }
  STORE.queued=false;
  DESKTOP_API.save(clone(state)).then(r=>{
    STORE.savedAt=r.savedAt||STORE.savedAt;
    STORE.dirty=false; STORE.lastFlush=Date.now(); STORE.error='';
    renderSaveBadge();
    if(drawerTab==='storage') renderStorage();
  }).catch(e=>{
    STORE.error='SQLite 写入失败：'+String((e&&e.message)||e);
    renderSaveBadge();
  });
}
function renderSaveBadge(){
  const el=typeof document!=='undefined' ? $('saveBadge') : null;
  if(!el) return;
  const where = DESKTOP
    ? 'SQLite · '+(STORE.dbPath||'桌面数据库')
    : (STORE.mode==='idb' ? '浏览器 IndexedDB（与桌面版数据互相独立）'
                          : '浏览器 localStorage（与桌面版数据互相独立）');
  const t=STORE.lastFlush?new Date(STORE.lastFlush).toLocaleTimeString('zh-CN'):'';
  el.textContent=where+(STORE.error?' · 写入异常':(STORE.dirty?' · 正在写入…':(t?' · 已保存 '+t:'')));
  el.style.color=STORE.error?'#ffb3ba':'';
}
function applyLoadedState(){
  unitPos=0; qPos=0; wordCur=null;
  sessionOrder={unitId:'',list:[]};
  libSel={packId:'',unitId:'',qIdx:-1};
  vocabSelected=new Set(); vocabQuery=''; vocabOnlyNew=false;
  /* 先取出存档里的现场并挂起快照，否则下面的 setMode 会立刻覆盖它 */
  resumeCandidate=(state.session && state.session.unitId)?clone(state.session):null;
  sessionSuspended=!!resumeCandidate;
  rollDay(); renderFilters(); renderHeader(); renderDrawer(); setMode(mode);
  /* 主存档已就位，让打字模块从 state.typingDuck 重新读取存档并刷新界面 */
  if(typeof window!=='undefined' && window.TypingDuck && typeof window.TypingDuck.reloadSave==='function'){
    try{ window.TypingDuck.reloadSave(); }catch(e){}
  }
  /* 打卡必须等主存档加载完再记：启动瞬间只写了临时 profile 的 localStorage */
  if(typeof window!=='undefined' && window.TypingDuck && typeof window.TypingDuck.checkinAfterLoad==='function'){
    try{ window.TypingDuck.checkinAfterLoad(); }catch(e){}
  }
  offerResume();
}
async function bootStorage(){
  const mirrorTs=mirrorTimestamp();
  let legacy=false;
  try{ legacy=!!localStorage.getItem(KEY); }catch(e){}
  try{
    STORE.db=await idbOpen();
    STORE.mode='idb';
    const rec=await idbCall(DB_KEY_MAIN,null,false);
    if(rec && rec.state){
      if((rec.savedAt||0)>=mirrorTs){
        const needFix=!(rec.state.lottery && rec.state.lottery.legacyPrizeFix) ||
        (rec.state.textbooks||[]).some(p=>p && /六年级上册/.test(String(p.name||'')) && !p.sixaPatched);
        state=normalizeState(rec.state);
        STORE.savedAt=rec.savedAt||0;
        applyLoadedState();
        if(needFix && state.lottery.legacyPrizeFix)
          await idbCall(DB_KEY_MAIN,dbRecord(STORE.savedAt),true);
      }else{
        STORE.savedAt=mirrorTs;
        await idbCall(DB_KEY_MAIN,dbRecord(mirrorTs),true);
      }
    }else{
      STORE.savedAt=mirrorTs||Date.now();
      await idbCall(DB_KEY_MAIN,dbRecord(STORE.savedAt),true);
      STORE.migrated=legacy;
    }
    try{
      const fh=await idbCall(DB_KEY_FILE,null,false);
      if(fh && fh.handle){
        STORE.fileHandle=fh.handle; STORE.fileName=fh.name||'spelllab-data.json'; STORE.fileState='prompt';
      }
    }catch(e){}
  }catch(e){
    STORE.mode='local'; STORE.error=String((e&&e.message)||e);
  }
  STORE.ready=true;
  await refreshStorageInfo();
  renderSaveBadge();
  if(drawerTab==='storage') renderStorage();
  if(STORE.migrated) toast('已将旧存档迁移到本地数据库','ok');
  offerResume();
}
function scheduleDesktopSave(){
  STORE.queued=true;
  if(STORE.desktopTimer) return;
  STORE.desktopTimer=setTimeout(()=>{
    STORE.desktopTimer=0;
    if(!STORE.queued) return;
    STORE.queued=false;
    DESKTOP_API.save(clone(state)).then(r=>{
      STORE.savedAt=r.savedAt||STORE.savedAt;
      STORE.dirty=false; STORE.lastFlush=Date.now(); STORE.error='';
      renderSaveBadge();
      if(drawerTab==='storage') renderStorage();
    }).catch(e=>{
      STORE.error='SQLite 写入失败：'+String((e&&e.message)||e);
      renderSaveBadge();
    });
  },60);
}
async function bootDesktop(){
  STORE.mode='sqlite';
  try{
    const rec=await DESKTOP_API.load();
    if(rec && rec.state){
      const needFix=!(rec.state.lottery && rec.state.lottery.legacyPrizeFix) ||
        (rec.state.textbooks||[]).some(p=>p && /六年级上册/.test(String(p.name||'')) && !p.sixaPatched);
      state=normalizeState(rec.state);
      STORE.savedAt=rec.savedAt||0;
      applyLoadedState();
      if(needFix && state.lottery.legacyPrizeFix){
        const saved=await DESKTOP_API.save(clone(state));
        STORE.savedAt=saved.savedAt||STORE.savedAt;
      }
    }else{
      STORE.savedAt=Date.now();
      await DESKTOP_API.save(clone(state));
    }
    const info=await DESKTOP_API.info();
    STORE.dbPath=info.dbPath||'';
    STORE.dbSize=info.size||0;
    STORE.dbCounts=info.counts||null;
    STORE.savedAt=info.savedAt||STORE.savedAt;
    STORE.dirty=false;
  }catch(e){
    STORE.mode='local';
    STORE.error='本地服务不可用：'+String((e&&e.message)||e);
  }
  STORE.ready=true;
  renderSaveBadge();
  if(drawerTab==='storage') renderStorage();
  offerResume();
}
async function refreshStorageInfo(){
  try{
    const nav=(typeof navigator!=='undefined')?navigator:null;
    if(nav && nav.storage && nav.storage.estimate){
      const est=await nav.storage.estimate();
      STORE.usage=Number(est.usage||0); STORE.quota=Number(est.quota||0);
    }
    if(nav && nav.storage && nav.storage.persisted) STORE.persisted=await nav.storage.persisted();
  }catch(e){}
}
async function requestPersist(){
  try{
    if(typeof navigator==='undefined'||!navigator.storage||!navigator.storage.persist){
      toast('当前浏览器不支持持久化存储授权','bad'); return false;
    }
    STORE.persisted=await navigator.storage.persist();
    renderStorage();
    toast(STORE.persisted?'已获持久化授权，浏览器不会自动清理数据':'未获得持久化授权，建议定期导出备份',STORE.persisted?'ok':'bad');
    return STORE.persisted;
  }catch(e){ toast('申请失败','bad'); return false; }
}
