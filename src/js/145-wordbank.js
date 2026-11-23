/* ---------------- 整体词库：每套词库是独立教材类别 + 一个完整练习单元 ----------------
   六套词库各自出现在顶部「教材」下拉里，选中哪套就只练哪套；
   词库没有句子，只在「单词速记」模式使用； sentences 保留空数组，
   避免 order()/renderHeader() 读到 undefined。数据不进存档，多档案各自
   用 wordStats 记录进度，天然隔离。 */
function wordBankBooks(){
  const banks=Array.isArray(WORDBANK_DATA)?WORDBANK_DATA:[];
  return banks.filter(b=>b&&b.bookId).map(b=>({id:b.bookId,name:b.name,bankId:b.id}));
}
function isWordBankBookId(id){ return typeof id==='string' && id.indexOf('b_wb_')===0; }
function wordBankUnits(){
  const banks=Array.isArray(WORDBANK_DATA)?WORDBANK_DATA:[];
  return banks.filter(b=>b&&b.bookId).map(b=>({
    id:'wb:'+b.id, name:b.name, book:'内置整体词库 · '+(b.desc||b.name),
    gradeId:'wb', bookId:b.bookId, volume:'whole',
    sentences:[], words:(b.words||[]).map(w=>[String(w[0]),String(w[1]||'')]),
    wordBank:true, bankId:b.id, bankBookId:b.bookId, bankDesc:b.desc||''
  }));
}
function isWordBankUnit(u){ return !!(u && u.wordBank); }
