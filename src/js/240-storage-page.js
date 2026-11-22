/* ---------------- 本地数据库：状态页 / 文件同步 / SQLite 导出 ---------------- */
function fmtBytes(n){
  n=Number(n)||0;
  if(n<1024) return n+' B';
  if(n<1048576) return (n/1024).toFixed(1)+' KB';
  if(n<1073741824) return (n/1048576).toFixed(1)+' MB';
  return (n/1073741824).toFixed(2)+' GB';
}
function dbCounts(){
  let questions=0,words=0;
  BUILTIN_UNITS.forEach(u=>{ questions+=(u.sentences||[]).length; words+=(u.words||[]).length; });
  questions+=(state.custom||[]).length;
  (state.textbooks||[]).forEach(p=>(p.units||[]).forEach(u=>{
    questions+=(u.sentences||[]).length; words+=(u.words||[]).length;
  }));
  (state.practiceSets||[]).forEach(s=>{
    questions+=(s.sentences||[]).length; words+=(s.words||[]).length;
  });
  let bytes=0; try{ bytes=JSON.stringify(state).length*2; }catch(e){}
  return {packs:(state.textbooks||[]).length,questions:questions,words:words,
    vocab:(state.vocab||[]).length,wrong:(state.wrong||[]).length,
    history:(state.history||[]).length,
    progress:Object.keys(state.progress||{}).length,bytes:bytes};
}
function kvBox(v,label){ return '<div class="kv"><b>'+esc(v)+'</b><span>'+esc(label)+'</span></div>'; }
function dbRow(k,v){ return '<div class="db-row"><span class="lbl">'+esc(k)+'</span><span class="val">'+esc(v)+'</span></div>'; }
function fsSupported(){
  return typeof window!=='undefined' && typeof window.showSaveFilePicker==='function';
}
function renderDbFile(){
  const el=$('dbFileState');
  if(!fsSupported()){
    el.innerHTML=dbRow('文件自动同步','此浏览器不支持（请用导出备份手动保存）');
    return;
  }
  if(!STORE.fileHandle){ el.innerHTML=dbRow('状态','未绑定本地文件'); return; }
  el.innerHTML=
    dbRow('绑定文件',STORE.fileName||'spelllab-data.json')+
    dbRow('授权状态',STORE.fileState==='granted'?'已授权 · 自动写回':'需点「立即同步」重新授权')+
    dbRow('上次同步',STORE.fileLast?new Date(STORE.fileLast).toLocaleString('zh-CN'):'尚未同步');
}
function renderDesktopInfo(){
  const counts=STORE.dbCounts||{};
  const total=Object.keys(counts).reduce((n,k)=>n+(Number(counts[k])||0),0);
  const meta=(typeof window!=='undefined' && window.__SPELLLAB_DESKTOP__)||{};
  $('desktopDbInfo').innerHTML=
    dbRow('SQLite 文件',STORE.dbPath||'读取中…')+
    dbRow('文件大小',fmtBytes(STORE.dbSize))+
    dbRow('规范化表记录',total+' 行 / '+Object.keys(counts).length+' 张表')+
    dbRow('桌面服务',(meta.version||'')+' · 端口 '+(meta.port||'—'));
}
function renderStorage(){
  const c=dbCounts(), idb=STORE.mode==='idb', sqlite=DESKTOP && STORE.mode==='sqlite';
  $('desktopPanel').hidden=!DESKTOP;
  $('dbFilePanel').hidden=!!DESKTOP;
  $('dbPersist').hidden=!!DESKTOP;
  $('dbDot').className='dot'+((idb||sqlite)?'':' warn');
  $('dbEngine').textContent=sqlite?'SQLite · 本地数据库文件'
    :(idb?'IndexedDB · 本地事务型数据库':'localStorage · 兼容模式');
  $('dbDesc').textContent=sqlite
    ? '桌面版写进下方显示的 .db 文件（run.bat 与 exe 共用同一份）：答对 / 答错立即写盘，关窗前再补写一次。浏览器直接打开 SpellLab.html 用的是另一套存储，两边数据不互通，需要同步请用「导出全库备份 / 从备份恢复」。'
    :(idb
      ? '学习数据以事务写入浏览器本地数据库，容量按磁盘剩余空间分配；关闭页面、重启浏览器都不会丢。注意：这是浏览器版独立数据，与桌面版 SQLite 不互通，需要同步请用「导出全库备份 / 从备份恢复」。'
      : '当前环境无法使用 IndexedDB（隐私模式或旧浏览器），已回退到 localStorage，容量约 5 MB，请定期导出备份；这也是浏览器版独立数据，与桌面版不互通。');
  if(sqlite){
    $('dbUsageBar').style.width=Math.min(100,Math.max(3,STORE.dbSize/(10*1048576)*100)).toFixed(2)+'%';
    $('dbUsageText').textContent='数据库文件 '+fmtBytes(STORE.dbSize)+
      (STORE.dbPath?(' · '+STORE.dbPath):'');
  }else{
    const pct=STORE.quota?Math.min(100,STORE.usage/STORE.quota*100):0;
    $('dbUsageBar').style.width=(STORE.usage&&pct<1?1:pct).toFixed(2)+'%';
    $('dbUsageText').textContent=STORE.quota
      ? '站点已用 '+fmtBytes(STORE.usage)+' / 可用约 '+fmtBytes(STORE.quota)
      : '本机数据约 '+fmtBytes(c.bytes)+'（浏览器未开放用量统计）';
  }
  $('dbCounts').innerHTML=
    kvBox(c.packs,'教材包')+kvBox(c.questions,'题目')+kvBox(c.words,'单词')+
    kvBox(c.vocab,'生词')+kvBox(c.wrong,'错题')+kvBox(c.progress,'进度记录')+
    kvBox(c.history,'练习记录');
  let rows=
    dbRow('写入状态',STORE.error?('异常：'+STORE.error):(STORE.queued?'待写入':'已同步'))+
    dbRow('最近保存',STORE.savedAt?new Date(STORE.savedAt).toLocaleString('zh-CN'):'尚未保存');
  if(sqlite){
    rows+=dbRow('数据库文件',STORE.dbPath||'读取中…')+
      dbRow('存储引擎','Python 标准库 sqlite3 · WAL 事务')+
      dbRow('数据体积',fmtBytes(c.bytes)+'（JSON 估算）');
    renderDesktopInfo();
  }else{
    rows+=dbRow('持久化授权',STORE.persisted?'已授予':'未申请 / 未授予')+
      dbRow('旧存档迁移',STORE.migrated?'已完成':(idb?'无需迁移':'—'))+
      dbRow('localStorage 镜像',STORE.mirror==='disabled'?'已停用（数据超过 5 MB）':'启用 · 双保险')+
      dbRow('数据体积',fmtBytes(c.bytes)+'（JSON 估算）');
  }
  $('dbRows').innerHTML=rows;
  renderDbFile();
}
async function ensureFilePermission(silent){
  const h=STORE.fileHandle; if(!h) return false;
  try{
    const opt={mode:'readwrite'};
    const q=h.queryPermission?await h.queryPermission(opt):'granted';
    if(q==='granted'){ STORE.fileState='granted'; return true; }
    if(silent){ STORE.fileState='prompt'; return false; }
    const r=h.requestPermission?await h.requestPermission(opt):'granted';
    STORE.fileState=(r==='granted')?'granted':'prompt';
    return r==='granted';
  }catch(e){ STORE.fileState='prompt'; return false; }
}
async function writeDataFile(){
  if(!(await ensureFilePermission(false))) return false;
  try{
    const w=await STORE.fileHandle.createWritable();
    await w.write(JSON.stringify(backupPayload(),null,2));
    await w.close();
    STORE.fileLast=Date.now(); STORE.fileState='granted'; STORE.error='';
    return true;
  }catch(e){ STORE.error='文件写入失败：'+String((e&&e.message)||e); return false; }
}
function scheduleFileSync(){
  if(!STORE.fileHandle || STORE.fileState!=='granted' || STORE.fileTimer) return;
  STORE.fileTimer=setTimeout(()=>{
    STORE.fileTimer=0;
    writeDataFile().then(()=>{ if(drawerTab==='storage') renderStorage(); });
  },900);
}
async function bindDataFile(){
  if(!fsSupported()){ toast('当前浏览器不支持自动写本地文件，请用「导出全库备份」手动备份','bad'); return false; }
  try{
    const h=await window.showSaveFilePicker({
      suggestedName:'spelllab-data.json',
      types:[{description:'SpellLab 数据文件',accept:{'application/json':['.json']}}]
    });
    STORE.fileHandle=h; STORE.fileName=h.name||'spelllab-data.json'; STORE.fileState='granted';
    try{ await idbCall(DB_KEY_FILE,{handle:h,name:STORE.fileName},true); }catch(e){}
    const ok=await writeDataFile();
    renderStorage();
    toast(ok?('已绑定并写入 '+STORE.fileName):'已选文件，但写入失败','ok');
    return ok;
  }catch(e){
    if(!e || e.name!=='AbortError') toast('绑定失败：'+String((e&&e.message)||e),'bad');
    return false;
  }
}
async function syncDataFile(){
  if(!STORE.fileHandle){ toast('请先绑定一个本地文件','bad'); return false; }
  const ok=await writeDataFile();
  renderStorage(); toast(ok?('已同步到 '+STORE.fileName):'同步失败','ok');
  return ok;
}
async function unbindDataFile(){
  STORE.fileHandle=null; STORE.fileName=''; STORE.fileState=''; STORE.fileLast=0;
  try{ await idbCall(DB_KEY_FILE,{handle:null,name:''},true); }catch(e){}
  renderStorage(); toast('已解除文件绑定');
}
function readRestoreFile(e){
  const f=e.target.files&&e.target.files[0]; if(!f) return;
  const read=txt=>{ if(restoreBackup(String(txt||''))) $('packIO').value=''; };
  if(f.text&&typeof f.text==='function') f.text().then(read).catch(()=>toast('文件读取失败','bad'));
  else if(typeof FileReader!=='undefined'){
    const fr=new FileReader();
    fr.onload=()=>read(String(fr.result||''));
    fr.onerror=()=>toast('文件读取失败','bad');
    fr.readAsText(f,'utf-8');
  }else toast('当前浏览器不支持读取本地文件，请粘贴 JSON 文本','bad');
  e.target.value='';
}
async function wipeDatabase(){
  if(!confirm('确定清空本地数据库里的全部学习数据？此操作不可恢复（建议先导出全库备份）。')) return;
  state=clone(DEFAULT_STATE);
  STORE.savedAt=Date.now(); STORE.mirror='ok'; STORE.mirrorBytes=0; STORE.queued=false;
  if(DESKTOP){
    try{
      const r=await DESKTOP_API.save(clone(state));
      STORE.savedAt=r.savedAt||STORE.savedAt; STORE.error='';
    }catch(e){ STORE.error='清空失败：'+String((e&&e.message)||e); }
  }else{
    writeMirror(true);   // 用默认状态覆盖旧镜像，避免下次启动读到残留数据
    try{ if(STORE.db) await idbCall(DB_KEY_MAIN,dbRecord(STORE.savedAt),true); }catch(e){}
  }
  applyLoadedState(); renderStorage(); toast('本地数据库已清空','ok');
}
function sqlEsc(v){ return "'"+String(v==null?'':v).replace(/'/g,"''")+"'"; }
function sqlVals(arr){ return '('+arr.map(sqlEsc).join(',')+');'; }
function exportSQLite(){
  const L=[];
  const add=s=>L.push(s);
  add('-- SpellLab 本地数据导出 · '+new Date().toISOString());
  add('-- 生成数据库文件：sqlite3 spelllab.db < spelllab-'+today()+'.sql');
  add('BEGIN TRANSACTION;');
  add('CREATE TABLE IF NOT EXISTS grades(id TEXT PRIMARY KEY,name TEXT);');
  add('CREATE TABLE IF NOT EXISTS books(id TEXT PRIMARY KEY,name TEXT);');
  add('CREATE TABLE IF NOT EXISTS packs(id TEXT PRIMARY KEY,name TEXT,grade_id TEXT,book_id TEXT,volume TEXT,enabled INTEGER,created TEXT);');
  add('CREATE TABLE IF NOT EXISTS units(id TEXT PRIMARY KEY,pack_id TEXT,name TEXT);');
  add('CREATE TABLE IF NOT EXISTS questions(unit_id TEXT,seq INTEGER,cn TEXT,en TEXT,hints TEXT,chunks TEXT);');
  add('CREATE TABLE IF NOT EXISTS words(unit_id TEXT,en TEXT,cn TEXT);');
  add('CREATE TABLE IF NOT EXISTS vocab(id TEXT PRIMARY KEY,en TEXT,cn TEXT,source TEXT,grade_id TEXT,book_id TEXT,mastery INTEGER,ok INTEGER,bad INTEGER);');
  add('CREATE TABLE IF NOT EXISTS progress(id TEXT PRIMARY KEY,mastery INTEGER,ok INTEGER,bad INTEGER);');
  add('CREATE TABLE IF NOT EXISTS wrong(id TEXT PRIMARY KEY,unit_id TEXT,idx INTEGER,cn TEXT);');
  add('CREATE TABLE IF NOT EXISTS stats(k TEXT PRIMARY KEY,v TEXT);');
  add('CREATE TABLE IF NOT EXISTS history(t INTEGER,mode TEXT,unit TEXT,cn TEXT,en TEXT,ok INTEGER,assisted INTEGER,ms INTEGER,bad INTEGER);');
  add('CREATE TABLE IF NOT EXISTS plan_ledger(t INTEGER,delta INTEGER,reason TEXT);');
  add('CREATE TABLE IF NOT EXISTS prizes(id TEXT,name TEXT,prob INTEGER);');
  add('CREATE TABLE IF NOT EXISTS lottery_log(t INTEGER,cost INTEGER,prize TEXT);');
  add('CREATE TABLE IF NOT EXISTS app_meta(k TEXT PRIMARY KEY,v TEXT);');
  ['questions','words','vocab','progress','wrong','stats','units','packs','books','grades',
   'history','plan_ledger','prizes','lottery_log','app_meta']
    .forEach(t=>add('DELETE FROM '+t+';'));
  (state.grades||[]).forEach(g=>add('INSERT INTO grades VALUES'+sqlVals([g.id,g.name])));
  (state.books||[]).forEach(b=>add('INSERT INTO books VALUES'+sqlVals([b.id,b.name])));
  (state.textbooks||[]).forEach(p=>add('INSERT INTO packs VALUES'+
    sqlVals([p.id,p.name,p.gradeId||'',p.bookId||'',packVolume(p),p.enabled===false?0:1,p.created||''])));
  const units=[],questions=[],words=[];
  const pushUnit=(id,packId,name,sentences,wordList)=>{
    units.push([id,packId,name]);
    (sentences||[]).forEach((q,i)=>questions.push([id,i,q.cn||'',q.en||'',
      JSON.stringify(q.hints||[]),JSON.stringify(q.chunks||[])]));
    (wordList||[]).forEach(w=>{
      const en=Array.isArray(w)?w[0]:(w&&w.en), cn=Array.isArray(w)?w[1]:(w&&w.cn);
      words.push([id,en||'',cn||'']);
    });
  };
  BUILTIN_UNITS.forEach(u=>pushUnit(u.id,'builtin',u.name,u.sentences,u.words));
  if((state.custom||[]).length) pushUnit('custom','custom','我的题库 · 自定义',state.custom,collectCustomWords());
  (state.textbooks||[]).forEach(p=>(p.units||[]).forEach(u=>
    pushUnit('tb:'+p.id+':'+u.id,p.id,u.name,u.sentences,u.words)));
  (state.practiceSets||[]).forEach(s=>
    pushUnit('ps:'+s.id,'practice-sets','生词练习 · '+(s.name||''),s.sentences,s.words));
  units.forEach(r=>add('INSERT INTO units VALUES'+sqlVals(r)));
  questions.forEach(r=>add('INSERT INTO questions VALUES'+sqlVals(r)));
  words.forEach(r=>add('INSERT INTO words VALUES'+sqlVals(r)));
  (state.vocab||[]).forEach(v=>add('INSERT INTO vocab VALUES'+
    sqlVals([v.id,v.en,v.cn,v.source||'',v.gradeId||'',v.bookId||'',v.m||0,v.ok||0,v.bad||0])));
  Object.keys(state.progress||{}).forEach(k=>{
    const p=state.progress[k]||{};
    add('INSERT INTO progress VALUES'+sqlVals([k,p.m||0,p.ok||0,p.bad||0]));
  });
  (state.wrong||[]).forEach(w=>add('INSERT OR REPLACE INTO wrong VALUES'+
    sqlVals([w.id,w.unitId||'',w.idx==null?0:w.idx,w.cn||''])));
  Object.keys(state.stats||{}).forEach(k=>add('INSERT INTO stats VALUES'+sqlVals([k,state.stats[k]])));
  (state.history||[]).forEach(h=>add('INSERT INTO history VALUES'+sqlVals([
    h.t||0,h.mode||'',h.unit||'',h.cn||'',h.en||'',h.ok?1:0,h.assisted?1:0,h.ms||0,h.bad||0])));
  const plan=state.plan||{}, lot=state.lottery||{};
  (plan.ledger||[]).forEach(x=>add('INSERT INTO plan_ledger VALUES'+sqlVals([
    x.t||0,x.delta||0,x.reason||''])));
  (lot.prizes||[]).forEach(p=>add('INSERT INTO prizes VALUES'+sqlVals([
    p.id||'',p.name||'',p.prob||0])));
  (lot.log||[]).forEach(x=>add('INSERT INTO lottery_log VALUES'+sqlVals([
    x.t||0,x.cost||0,x.prize||''])));
  [['plan',plan],['lottery',lot],['session',state.session||{}],
   ['parent',state.parent||{}]].forEach(([k,v])=>
    add('INSERT OR REPLACE INTO app_meta VALUES'+sqlVals([k,JSON.stringify(v)])));
  add('COMMIT;');
  return L.join('\n')+'\n';
}

