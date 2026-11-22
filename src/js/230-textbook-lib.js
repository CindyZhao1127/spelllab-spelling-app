/* ---------------- 教材库：教材包 / 单元 / 题目 ---------------- */
let libSel={packId:'',unitId:'',qIdx:-1};
function tbPacks(){ return Array.isArray(state.textbooks)?state.textbooks:(state.textbooks=[]); }
function tbPack(id){ return tbPacks().find(p=>p.id===id)||null; }
function tbUnit(pack,id){ return pack?(pack.units||[]).find(u=>u.id===id)||null:null; }
function tbActiveUnit(){ return tbUnit(tbPack(libSel.packId),libSel.unitId); }
function tbCounts(pack){
  let sentences=0,words=0;
  (pack.units||[]).forEach(u=>{ sentences+=(u.sentences||[]).length; words+=(u.words||[]).length; });
  return {units:(pack.units||[]).length,sentences:sentences,words:words};
}
function refreshLibrary(){
  sessionOrder={unitId:'',list:[]};
  qPos=0; wordCur=null;
  unitPos=Math.min(unitPos,Math.max(0,units().length-1));
  renderFilters(); renderDrawer(); renderHeader(); setMode(mode);
}
function makePack(name,gradeId,bookId,volume){
  const n=String(name||'').trim();
  if(!n){ toast('请填写教材包名称','bad'); return null; }
  const v=volume===undefined?inferVolume(n):volume;
  const p={id:nextId('tb'),name:n,gradeId:gradeId||'g4',bookId:bookId||'b_hj',volume:v,
           enabled:true,created:today(),units:[]};
  tbPacks().push(p); saveState();
  libSel={packId:p.id,unitId:'',qIdx:-1};
  refreshLibrary(); toast('已创建教材包「'+n+'」','ok');
  return p;
}
function removePack(id){
  const p=tbPack(id); if(!p) return;
  const c=tbCounts(p);
  if(!confirm('删除教材包「'+p.name+'」？含 '+c.units+' 单元 / '+c.sentences+' 题，不可恢复（建议先导出）。')) return;
  const prefix='tb:'+id+':';
  Object.keys(state.unitMeta||{}).forEach(k=>{ if(k.indexOf(prefix)===0) delete state.unitMeta[k]; });
  state.wrong=(state.wrong||[]).filter(w=>String(w.unitId||'').indexOf(prefix)!==0);
  state.textbooks=tbPacks().filter(x=>x.id!==id);
  if(libSel.packId===id) libSel={packId:'',unitId:'',qIdx:-1};
  saveState(); refreshLibrary(); toast('教材包已删除');
}
function setPackVolume(id){
  const p=tbPack(id); if(!p) return;
  const cur=packVolume(p);
  const opts=VOLUMES.map(v=>v.id).concat(['']);
  const next=opts[(opts.indexOf(cur)+1)%opts.length];
  p.volume=next;
  saveState(); refreshLibrary();
  toast('「'+p.name+'」册别已改为 '+volumeName(next));
}
function togglePack(id){
  const p=tbPack(id); if(!p) return;
  p.enabled=p.enabled===false;
  saveState(); refreshLibrary();
  toast(p.enabled?'已启用「'+p.name+'」':'已停用「'+p.name+'」');
}
function addUnit(packId,name){
  const p=tbPack(packId); if(!p) return null;
  let n=String(name||'').trim();
  if(!n){
    const v=prompt('新单元名称','Unit '+((p.units||[]).length+1));
    if(v==null) return null;
    n=String(v).trim()||('Unit '+((p.units||[]).length+1));
  }
  if(!Array.isArray(p.units)) p.units=[];
  const u={id:nextId('tu'),name:n,sentences:[],words:[]};
  p.units.push(u); saveState();
  libSel={packId:packId,unitId:u.id,qIdx:-1};
  refreshLibrary(); toast('已添加单元「'+n+'」','ok');
  return u;
}
function renameUnit(packId,unitId,name){
  const u=tbUnit(tbPack(packId),unitId); if(!u) return;
  let n=name;
  if(n==null){ n=prompt('修改单元名称',u.name); if(n==null) return; }
  n=String(n).trim(); if(!n) return;
  u.name=n; saveState(); refreshLibrary(); toast('单元已改名','ok');
}
function removeUnit(packId,unitId){
  const p=tbPack(packId), u=tbUnit(p,unitId); if(!p||!u) return;
  if(!confirm('删除单元「'+u.name+'」？含 '+(u.sentences||[]).length+' 题 / '+(u.words||[]).length+' 词。')) return;
  p.units=(p.units||[]).filter(x=>x.id!==unitId);
  delete state.unitMeta['tb:'+packId+':'+unitId];
  if(libSel.unitId===unitId) libSel={packId:packId,unitId:'',qIdx:-1};
  saveState(); refreshLibrary(); toast('单元已删除');
}
/* 题目格式与「自定义题库」一致；chunks 可留空，留空时由 buildChunks 自动均分 */
function validateQuestion(cn,en,hintsRaw,chunksRaw){
  cn=String(cn||'').trim(); en=String(en||'').trim();
  const hints=String(hintsRaw||'').split(/[,，、]/).map(x=>x.trim()).filter(Boolean);
  if(!cn||!en) return {error:'中文和英文都要填写'};
  if(!/^[A-Za-z][A-Za-z\s'.,!?-]*$/.test(en)) return {error:'英文句子含不支持的字符'};
  const wordCount=tokenize(en,[],cn).filter(t=>!t.punct).length;
  if(hints.length!==wordCount) return {error:'英文有 '+wordCount+' 个单词，但提示有 '+hints.length+' 个'};
  const q={cn:cn,en:en,hints:hints};
  const cr=String(chunksRaw||'').trim();
  if(cr){
    const chunks=cr.split(/[,，]/).map(part=>{
      const m=String(part).trim().match(/^(.*?)[:：](\d+)$/);
      return m?[m[1].trim(),Number(m[2])]:null;
    });
    if(chunks.some(c=>!c||!c[0]||!(c[1]>0))) return {error:'短语拆分格式应为「短语中文:词数」'};
    const sum=chunks.reduce((a,c)=>a+c[1],0);
    if(sum!==wordCount) return {error:'短语词数之和 '+sum+' 与单词数 '+wordCount+' 不一致'};
    q.chunks=chunks;
  }
  return {q:q};
}
function saveQuestion(){
  const u=tbActiveUnit();
  if(!u){ toast('请先选择一个单元','bad'); return null; }
  const v=validateQuestion($('qCn').value,$('qEn').value,$('qHints').value,$('qChunks').value);
  if(v.error){ toast(v.error,'bad'); return null; }
  if(!Array.isArray(u.sentences)) u.sentences=[];
  if(libSel.qIdx>=0 && u.sentences[libSel.qIdx]) u.sentences[libSel.qIdx]=v.q;
  else u.sentences.push(v.q);
  libSel.qIdx=-1;
  saveState(); refreshLibrary(); toast('题目已保存','ok');
  return v.q;
}
function editQuestion(i){
  const u=tbActiveUnit(); if(!u||!u.sentences[i]) return;
  libSel.qIdx=i; renderTbEditor();
}
function removeQuestion(i){
  const u=tbActiveUnit(); if(!u||!u.sentences[i]) return;
  u.sentences.splice(i,1);
  if(libSel.qIdx===i) libSel.qIdx=-1;
  saveState(); refreshLibrary(); toast('题目已删除');
}
function tbBulkQuestions(){
  const u=tbActiveUnit(); if(!u){ toast('请先选择一个单元','bad'); return 0; }
  const r=parseCustom($('qBulk').value);
  if(r.errors.length){ toast(r.errors[0],'bad'); return 0; }
  if(!r.out.length){ toast('没有解析到题目','bad'); return 0; }
  if(!Array.isArray(u.sentences)) u.sentences=[];
  u.sentences=u.sentences.concat(r.out.map(q=>clone(q)));
  saveState(); $('qBulk').value='';
  refreshLibrary(); toast('已添加 '+r.out.length+' 道题','ok');
  return r.out.length;
}
function parseWordList(text){
  const out=[],seen=new Set();
  String(text||'').split(/\r?\n/).forEach(line=>{
    const s=line.trim(); if(!s||s.startsWith('#')) return;
    const parts=s.split(/[,，|:\t]/).map(x=>x.trim()).filter(Boolean);
    if(parts.length<2) return;
    const en=parts[0],cn=parts.slice(1).join(' ');
    if(!/^[A-Za-z][A-Za-z'-]*$/.test(en)) return;
    const k=en.toLowerCase();
    if(seen.has(k)) return;
    seen.add(k); out.push([en,cn]);
  });
  return out;
}
function tbBulkWords(){
  const u=tbActiveUnit(); if(!u){ toast('请先选择一个单元','bad'); return 0; }
  const list=parseWordList($('wBulk').value);
  if(!list.length){ toast('没有解析到单词，格式应为每行「英文,中文」','bad'); return 0; }
  if(!Array.isArray(u.words)) u.words=[];
  const seen=new Set(u.words.map(w=>String(w[0]).toLowerCase()));
  let added=0;
  list.forEach(w=>{ if(!seen.has(w[0].toLowerCase())){ u.words.push(w); seen.add(w[0].toLowerCase()); added++; } });
  saveState(); $('wBulk').value='';
  refreshLibrary(); toast('新增 '+added+' 个单词','ok');
  return added;
}
function removeWord(i){
  const u=tbActiveUnit(); if(!u||!u.words[i]) return;
  u.words.splice(i,1); saveState(); refreshLibrary(); toast('单词已移除');
}
/* 教材包 JSON：可提交到 Git 做版本管理，也可发给别人导入 */
function packExportPayload(packs){
  return {
    format:'spelllab.textbook.v1', exportedAt:new Date().toISOString(),
    packs:packs.map(p=>({
      name:p.name, gradeId:p.gradeId, bookId:p.bookId, volume:packVolume(p),
      gradeName:gradeName(p.gradeId), bookName:bookName(p.bookId),
      units:(p.units||[]).map(u=>({
        name:u.name,
        sentences:(u.sentences||[]).map(q=>clone(q)),
        words:(u.words||[]).map(w=>w.slice())
      }))
    }))
  };
}
function normalizeImportedPack(raw){
  if(!raw||typeof raw!=='object') return null;
  const name=String(raw.name||'').trim();
  if(!name||!Array.isArray(raw.units)) return null;
  const ensureCat=(kind,id,label)=>{
    const list=kind==='grade'?state.grades:state.books;
    if(!id||id==='none') return 'none';
    if(list.some(x=>x.id===id)) return id;
    const n=String(label||'').trim();
    if(!n||n==='未分类') return 'none';
    const same=list.find(x=>x.name===n);
    if(same) return same.id;
    const item={id:nextId(kind==='grade'?'g':'b'),name:n};
    list.push(item); return item.id;
  };
  const units=(raw.units||[]).map(ru=>{
    if(!ru||typeof ru!=='object') return null;
    const sentences=[];
    (Array.isArray(ru.sentences)?ru.sentences:[]).forEach(q=>{
      const chunksRaw=q&&Array.isArray(q.chunks)?q.chunks.map(c=>c[0]+':'+c[1]).join(','):'';
      const v=validateQuestion(q&&q.cn,q&&q.en,q&&Array.isArray(q.hints)?q.hints.join(','):'',chunksRaw);
      if(v.q) sentences.push(v.q);
    });
    const words=[],seen=new Set();
    (Array.isArray(ru.words)?ru.words:[]).forEach(w=>{
      const en=Array.isArray(w)?String(w[0]||'').trim():String(w&&w.en||'').trim();
      const cn=Array.isArray(w)?String(w[1]||''):String(w&&w.cn||'');
      if(/^[A-Za-z][A-Za-z'-]*$/.test(en)&&!seen.has(en.toLowerCase())){
        seen.add(en.toLowerCase()); words.push([en,cn]);
      }
    });
    return {id:nextId('tu'),name:String(ru.name||'').trim()||'未命名单元',sentences:sentences,words:words};
  }).filter(Boolean);
  const vol=(raw.volume!=null && (VOLUMES.some(v=>v.id===raw.volume)||raw.volume===''))
    ? raw.volume : (inferVolume(name)||'');
  return {
    id:nextId('tb'), name:name,
    gradeId:ensureCat('grade',raw.gradeId,raw.gradeName),
    bookId:ensureCat('book',raw.bookId,raw.bookName),
    volume:vol,
    enabled:true, created:today(), units:units
  };
}
function parsePackJSON(text){
  let data;
  try{ data=JSON.parse(String(text||'').trim()); }
  catch(e){ return {packs:[],error:'JSON 解析失败：'+e.message}; }
  if(data&&data.format==='spelllab.backup.v1') return {packs:[],error:'这是全库备份，请点「从备份恢复」'};
  const raws=Array.isArray(data)?data
    :(data&&Array.isArray(data.packs)?data.packs
    :(data&&Array.isArray(data.units)?[data]:[]));
  if(!raws.length) return {packs:[],error:'没找到教材包（需要 packs 数组或含 units 的包对象）'};
  const packs=raws.map(normalizeImportedPack).filter(Boolean);
  return packs.length?{packs:packs,error:''}:{packs:[],error:'教材包内容为空或格式不符合要求'};
}
function importPackText(text){
  const r=parsePackJSON(text);
  if(r.error){ toast(r.error,'bad'); return 0; }
  state.textbooks=tbPacks().concat(r.packs);
  saveState();
  libSel={packId:r.packs[0].id,unitId:(r.packs[0].units[0]||{}).id||'',qIdx:-1};
  $('packIO').value='';
  refreshLibrary(); toast('已导入 '+r.packs.length+' 个教材包','ok');
  return r.packs.length;
}
function backupPayload(){
  return {format:'spelllab.backup.v1',exportedAt:new Date().toISOString(),state:clone(state)};
}
function restoreBackup(text){
  let data;
  try{ data=JSON.parse(String(text||'').trim()); }
  catch(e){ toast('备份 JSON 解析失败','bad'); return false; }
  const s=data&&data.state;
  if(!data||data.format!=='spelllab.backup.v1'||!s||typeof s!=='object'){
    toast('不是有效的全库备份文件','bad'); return false;
  }
  if(!confirm('从备份恢复会覆盖当前全部学习数据、教材包和设置，确定继续？')) return false;
  try{
    localStorage.setItem(KEY,JSON.stringify(s));
    localStorage.setItem(MIRROR_TS,String(Date.now()));
  }catch(e){}
  state=loadState();
  STORE.savedAt=Date.now();
  if(DESKTOP) DESKTOP_API.save(clone(state)).catch(e=>{
    STORE.error='备份写入 SQLite 失败：'+String((e&&e.message)||e);
  });
  else if(STORE.mode==='idb') writeNow(); else writeMirror(true);
  libSel={packId:'',unitId:'',qIdx:-1};
  unitPos=0; qPos=0; wordCur=null; sessionOrder={unitId:'',list:[]};
  vocabSelected=new Set(); vocabQuery=''; vocabOnlyNew=false;
  $('packIO').value='';
  renderFilters(); renderDrawer(); setMode(mode);
  toast('已从备份恢复全部数据','ok');
  return true;
}
function downloadText(filename,text,mime){
  try{
    if(typeof Blob==='undefined'||typeof URL==='undefined'||!URL.createObjectURL) throw new Error('unsupported');
    const blob=new Blob([text],{type:mime||'application/json;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url; a.download=filename;
    if(document.body&&document.body.appendChild) document.body.appendChild(a);
    if(a.click) a.click();
    setTimeout(()=>{ try{ URL.revokeObjectURL(url); }catch(e){} if(a.remove) a.remove(); },0);
    return true;
  }catch(e){ return false; }
}
function emitJSON(filename,obj){
  const text=JSON.stringify(obj,null,2);
  $('packIO').value=text;
  if(downloadText(filename,text,'application/json;charset=utf-8')) toast('已导出 '+filename+'（内容也已填入文本框）','ok');
  else toast('浏览器未开放直接下载，JSON 已填入文本框，请复制保存','bad');
  return text;
}
function renderLibrary(){
  const bs=state.books||[],sc=activeScopeIds();
  const stage=(state.filter&&state.filter.stageId)||'all';
  const gs=gradeOptions(systemId());
  renderStageControls();
  $('tbGrade').innerHTML=optionGroups(gs,x=>stageOfGrade(x.id),
    canonicalGradeId(sc.gradeId,systemId()),'未分类','none',x=>x.name,stage);
  $('tbBook').innerHTML=optionGroups(bs,stageOfBook,sc.bookId,'未分类','none',null,stage);
  $('tbGrade').value=gs.some(x=>x.id===canonicalGradeId(sc.gradeId,systemId()))?
    canonicalGradeId(sc.gradeId,systemId()):'none';
  $('tbBook').value=bs.some(x=>x.id===sc.bookId)?sc.bookId:'none';
  const prevVolume=$('tbVolume').value;
  const inferred=inferVolume($('tbName').value);
  $('tbVolume').innerHTML='<option value="">未分册</option>'+
    VOLUMES.map(v=>'<option value="'+esc(v.id)+'">'+esc(v.name)+'</option>').join('');
  $('tbVolume').value=prevVolume||sc.volumeId||inferred||'';
  const packs=tbPacks(), groups=groupPacks(packs,stage);
  const shown=groups.reduce((n,g)=>n+g.books.reduce((m,b)=>m+b.packs.length,0),0);
  $('tbCount').textContent=shown+(shown!==packs.length?' / '+packs.length:'');
  const packCard=function(p){
    const c=tbCounts(p);
    const rows=(p.units||[]).map(u=>
      '<div class="tb-unit'+(libSel.packId===p.id&&libSel.unitId===u.id?' sel':'')+'">'+
        '<span class="u-name" data-tb-open="'+esc(p.id)+'" data-tb-unit="'+esc(u.id)+'">'+esc(u.name)+'</span>'+
        '<span class="u-count">'+(u.sentences||[]).length+'题 / '+(u.words||[]).length+'词</span>'+
        '<button class="mini-icon" data-tb-rename="'+esc(p.id)+'" data-tb-unit="'+esc(u.id)+'" title="改名">'+icon('edit')+'</button>'+
        '<button class="mini-icon danger" data-tb-delunit="'+esc(p.id)+'" data-tb-unit="'+esc(u.id)+'" title="删除">'+icon('trash')+'</button>'+
      '</div>'
    ).join('')||'<div class="empty">还没有单元，点「加单元」开始</div>';
    return '<div class="tb-card'+(p.enabled===false?' off':'')+'">'+
      '<div class="tb-head"><span class="tb-title" title="'+esc(p.name)+'">'+esc(packLabel(p))+'</span>'+
        '<span class="count-pill">'+(p.enabled===false?'已停用':'使用中')+'</span></div>'+
      '<div class="tb-meta">'+esc(p.name)+
        ' · '+c.units+' 单元 / '+c.sentences+' 题 / '+c.words+' 词 · 创建于 '+esc(p.created||'-')+'</div>'+
      '<div class="btn-row tight" style="margin-top:8px">'+
        '<button class="mini-btn sm" data-tb-addunit="'+esc(p.id)+'">加单元</button>'+
        '<button class="mini-btn sm" data-tb-volume="'+esc(p.id)+'">改册别</button>'+
        '<button class="mini-btn sm" data-tb-toggle="'+esc(p.id)+'">'+(p.enabled===false?'启用':'停用')+'</button>'+
        '<button class="mini-btn sm" data-tb-export="'+esc(p.id)+'">导出此包</button>'+
        '<button class="mini-btn sm danger" data-tb-delpack="'+esc(p.id)+'">删除包</button>'+
      '</div><div class="tb-units">'+rows+'</div></div>';
  };
  /* 学段 → 教材类别 → 册（三年级(上) / 三年级(下)）→ 单元 */
  $('tbList').innerHTML=shown?groups.map(g=>
    '<div class="tb-group"><div class="tb-stage">'+esc(stageName(g.stage))+
      ' <span class="count-pill">'+g.books.reduce((n,b)=>n+b.packs.length,0)+' 册</span></div>'+
      g.books.map(b=>'<div class="tb-bookgroup"><div class="tb-bookname">'+esc(b.name)+'</div>'+
        b.packs.map(packCard).join('')+'</div>').join('')+'</div>'
  ).join(''):'<div class="empty">'+(packs.length
    ?'当前学段下没有教材包，切到「全部学段」可查看其他册。'
    :'还没有教材包。上方可以新建，下方可以粘贴 JSON 导入。')+'</div>';
  renderTbEditor();
}
function renderTbEditor(){
  const p=tbPack(libSel.packId),u=tbUnit(p,libSel.unitId);
  if(!p||!u){
    $('tbEditTitle').textContent='未选择';
    $('tbEditor').innerHTML='<div class="empty">在上方教材包里点单元名称，即可编辑它的句子和单词表。</div>';
    return;
  }
  $('tbEditTitle').textContent=p.name+' / '+u.name;
  const editing=libSel.qIdx>=0?(u.sentences||[])[libSel.qIdx]:null;
  const qHtml=(u.sentences||[]).map((q,i)=>
    '<div class="q-item"><div class="q-main"><div class="q-cn">'+esc(q.cn)+'</div>'+
      '<div class="q-en">'+esc(q.en)+'</div><div class="subtle">'+(q.hints||[]).length+' 个提示 · '+
      (q.chunks?'手动拆成 '+(q.chunks||[]).length+' 个短语':'自动分短语')+'</div></div>'+
      '<button class="mini-icon" data-tb-editq="'+i+'" title="编辑">'+icon('edit')+'</button>'+
      '<button class="mini-icon danger" data-tb-delq="'+i+'" title="删除">'+icon('trash')+'</button></div>'
  ).join('')||'<div class="empty">还没有题目，用下面的表单添加</div>';
  const wordsHtml=(u.words||[]).map((w,i)=>
    '<span class="word-chip">'+esc(w[0])+' · '+esc(w[1]||'')+' <button data-tb-delword="'+i+'" title="移除">×</button></span>'
  ).join('')||'<div class="empty">还没有单词</div>';
  $('tbEditor').innerHTML=
    '<h4>'+esc(u.name)+' · '+(u.sentences||[]).length+' 题 / '+(u.words||[]).length+' 词</h4>'+
    '<div class="editor-row"><input class="field" id="tbUnitName" value="'+esc(u.name)+'">'+
      '<button class="mini-btn sm" id="tbRenameUnit">改名</button></div>'+
    '<div class="subtle" style="margin-bottom:8px">提示数量必须等于英文单词数。短语拆分可留空，留空时自动均分；格式「短语中文:词数」用逗号隔开。</div>'+
    qHtml+'<div class="hr"></div>'+
    '<div class="editor-row"><input class="field" id="qCn" placeholder="中文句子" value="'+esc(editing?editing.cn:'')+'"></div>'+
    '<div class="editor-row"><input class="field" id="qEn" placeholder="English sentence" value="'+esc(editing?editing.en:'')+'"></div>'+
    '<div class="editor-row"><input class="field" id="qHints" placeholder="逐词中文提示，用逗号分隔" value="'+esc(editing?(editing.hints||[]).join(','):'')+'"></div>'+
    '<div class="editor-row"><input class="field" id="qChunks" placeholder="短语拆分（可留空）" value="'+esc(editing&&editing.chunks?editing.chunks.map(c=>c[0]+':'+c[1]).join(','):'')+'"></div>'+
    '<div class="btn-row tight"><button class="mini-btn primary sm" id="qSave">'+(editing?'保存修改':'添加题目')+'</button>'+
      (editing?'<button class="mini-btn sm" id="qCancel">取消编辑</button>':'')+'</div>'+
    '<div class="hr"></div><div class="subtle" style="margin-bottom:6px">批量粘贴题目（每行：中文 | 英文 | 提示1,提示2,...）</div>'+
    '<textarea class="field" id="qBulk" placeholder="今天很冷。| It is cold today. | 它,是,冷的,今天"></textarea>'+
    '<div class="btn-row tight" style="margin-top:7px"><button class="mini-btn sm" id="qBulkAdd">批量添加题目</button></div>'+
    '<div class="hr"></div><div class="subtle" style="margin-bottom:6px">单词表（每行：英文,中文，重复词自动跳过）</div>'+
    '<textarea class="field" id="wBulk" placeholder="weather,天气"></textarea>'+
    '<div class="btn-row tight" style="margin-top:7px"><button class="mini-btn sm" id="wBulkAdd">导入单词表</button></div>'+
    '<div style="margin-top:8px">'+wordsHtml+'</div>';
}

