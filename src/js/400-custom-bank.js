/* ---------------- 自定义题库 ---------------- */
function parseCustom(text){
  const out=[], errors=[];
  text.split(/\r?\n/).forEach((line,n)=>{
    const s=line.trim(); if(!s||s.startsWith('#')) return;
    const parts=s.split('|').map(x=>x.trim());
    if(parts.length<3){ errors.push('第 '+(n+1)+' 行：缺少竖线分隔'); return; }
    const [cn,en,hintsRaw]=parts;
    const hints=hintsRaw.split(/[,，、]/).map(x=>x.trim()).filter(Boolean);
    const wordCount=tokenize(en,[],cn).filter(t=>!t.punct).length;
    if(hints.length!==wordCount){ errors.push('第 '+(n+1)+' 行：英文有 '+wordCount+' 个单词，但提示有 '+hints.length+' 个'); return; }
    if(!/^[A-Za-z][A-Za-z\s'.,!?-]*$/.test(en)){ errors.push('第 '+(n+1)+' 行：英文句子含不支持的字符'); return; }
    out.push({cn:cn,en:en,hints:hints});
  });
  return {out:out,errors:errors};
}
function doImport(){
  const text=$('importText').value.trim();
  if(!text){ toast('请先粘贴题目','bad'); return; }
  const r=parseCustom(text);
  if(r.errors.length){ toast(r.errors[0],'bad'); return; }
  if(!r.out.length){ toast('没有解析到题目','bad'); return; }
  if(!state.custom.length) state.customMeta=activeScopeIds();
  state.custom=state.custom.concat(r.out); saveState();
  unitPos=findUnitIndex('custom'); qPos=0; wordCur=null;
  sessionOrder={unitId:'',list:[]};
  $('importText').value='';
  toast('成功导入 '+r.out.length+' 道题','ok');
  renderFilters(); renderDrawer(); setMode(mode);
}

