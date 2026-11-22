/* ---------------- 家长中心 / 可扩展的密码保护 ---------------- */
function parentHashOk(pwd){
  return hashPassword(pwd,state.parent.salt)===state.parent.hash;
}
function parentIsInitial(){ return !state.parent.changed; }
function guardParent(scope,fn){
  /* 新增保护域时这里不用改：在 PARENT_SCOPES 注册 + 调用处包一层即可 */
  if(!PARENT_SCOPES[scope] || parentUnlocked){ if(typeof fn==='function') fn(); return true; }
  openParentCenter(fn);
  return false;
}
function openParentCenter(onUnlocked){
  parentPending=(typeof onUnlocked==='function')?onUnlocked:null;
  renderParentCenter();
  $('parentMask').hidden=false;
  if(!parentUnlocked){ $('parentPwd').value=''; try{ $('parentPwd').focus(); }catch(e){} }
}
function hideParentCenter(){ $('parentMask').hidden=true; parentPending=null; }
function renderParentCenter(){
  $('parentLogin').hidden=parentUnlocked;
  $('parentPanel').hidden=!parentUnlocked;
  $('parentInitialHint').hidden=!parentIsInitial();
  $('parentStatus').textContent=(parentUnlocked?'家长模式已解锁':'家长模式未解锁')+
    ' · 当前保护：'+Object.keys(PARENT_SCOPES).map(function(k){return PARENT_SCOPES[k].label;}).join('、');
  renderParentChip();
}
function renderParentChip(){
  const b=$('btnParent'); if(!b) return;
  b.textContent=parentUnlocked?'家长 · 已解锁':'家长';
  b.classList.toggle('unlocked',parentUnlocked);
}
function unlockParent(){
  if(!parentHashOk($('parentPwd').value)){
    toast('管理密码不对，请重试','bad'); $('parentPwd').value=''; return;
  }
  parentUnlocked=true;
  $('parentPwd').value='';
  renderParentCenter(); renderDrawer(); renderLottery();
  toast('家长模式已解锁','ok');
  const pending=parentPending; parentPending=null;
  if(typeof pending==='function'){ try{ pending(); }catch(e){} }
  /* 从「改奖项」等操作触发的解锁，完成后直接回到界面；
     主动打开家长中心的则留在弹层里，方便立刻把初始密码改掉。 */
  if(pending) hideParentCenter(); else renderParentCenter();
}
function lockParent(){
  parentUnlocked=false; parentPending=null;
  ['parentOld','parentNew','parentNew2'].forEach(id=>{ $(id).value=''; });
  renderParentCenter(); renderDrawer(); renderLottery();
  hideParentCenter(); toast('已退出家长模式');
}
function changeParentPassword(){
  if(!parentUnlocked){ toast('请先解锁家长模式','bad'); return; }
  if(!parentHashOk($('parentOld').value)){ toast('原密码不正确','bad'); return; }
  const n1=String($('parentNew').value||''), n2=String($('parentNew2').value||'');
  if(n1.length<4 || n1.length>32){ toast('新密码需 4–32 位','bad'); return; }
  if(n1!==n2){ toast('两次输入的新密码不一致','bad'); return; }
  state.parent.salt='s'+Date.now().toString(36)+Math.random().toString(36).slice(2,10);
  state.parent.hash=hashPassword(n1,state.parent.salt);
  state.parent.changed=true;
  saveState(true);
  ['parentOld','parentNew','parentNew2'].forEach(id=>{ $(id).value=''; });
  renderParentCenter(); renderLottery();
  toast('管理密码已更新','ok');
}

