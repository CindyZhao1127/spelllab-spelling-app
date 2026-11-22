/* ---------------- 单元完成后的去向 ---------------- */
function promptNextUnit(){
  if(!state.settings.askNextUnit || units().length<2) return;
  const next=units()[(unitPos+1)%units().length];
  showModal({title:'本单元这一轮练完了',
    text:'当前单元共 '+order().length+' 题，这一轮已全部完成。\n下一单元：'+(next.name||''),
    actions:[
      {label:'继续本单元',onClick:()=>{ unitRoundCount=0; unitRoundPrompted=false; gotoQuestion(1); }},
      {label:'进入下一单元',primary:true,onClick:nextUnit},
      {label:'稍后再说'}
    ]});
}
function nextUnit(){
  const us=units(); if(!us.length) return;
  unitPos=(unitPos+1)%us.length;
  qPos=0; unitRoundCount=0; unitRoundPrompted=false;
  sessionOrder={unitId:'',list:[]}; wordCur=null;
  setMode(mode); renderHeader(); renderDrawer();
  toast('已切换到 '+(currentUnit().name||'下一单元'),'ok');
}

