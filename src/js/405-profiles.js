/* ---------------- 多孩子档案：切换 / 新增 / 重命名 / 删除 ----------------
   顶层 state 永远是「当前档案」，档案名册与其余档案快照存在 state.profiles。
   所有写盘路径都序列化整个 state，所以新档案无需改存储层。 */
const PROFILE_COLORS = ['#8b7bff','#4cc9f0','#ff8fa3','#ffd166','#5dcaa5','#f0997b'];
function profileColor(p){
  return PROFILE_COLORS[(Number(p&&p.color)||0)%PROFILE_COLORS.length];
}
function profileInitial(name){
  const s=String(name||'').trim();
  return s?s.slice(0,2):'娃';
}
function renderProfileChip(){
  const b=$('btnProfile'); if(!b) return;
  const p=profileActive();
  $('profileName').textContent=p?p.name:PROFILE_DEFAULT_NAME;
  const av=$('profileAvatar');
  av.textContent=profileInitial(p?p.name:'默认');
  av.style.background=profileColor(p);
}
/* 档案摘要：已练题数 + 积分，展示在切换菜单里，方便家长一眼分清 */
function profileSummary(id){
  const snap=(state.profiles.data[id]||{});
  const hist=Array.isArray(snap.history)?snap.history:[];
  const st=snap.stats||{};
  const pts=Number(snap.plan&&snap.plan.points)||0;
  return (Number(st.correct)||0)+' 题对 · '+pts+' 分'+(hist.length?' · '+hist.length+' 次':'');
}
function openProfileMenu(){
  const active=profileActive();
  const rows=profileList().map(function(p){
    const isMe=p.id===state.profiles.activeId;
    return '<div class="profile-row'+(isMe?' active':'')+'" data-profile-id="'+esc(p.id)+'">'+
      '<span class="avatar" style="background:'+profileColor(p)+'">'+esc(profileInitial(p.name))+'</span>'+
      '<span class="pname">'+esc(p.name)+(isMe?' · 当前':'')+'</span>'+
      '<span class="pstat">'+esc(profileSummary(p.id))+'</span>'+
      (profileList().length>1?'<button class="pdel" data-profile-del="'+esc(p.id)+'" title="删除档案">×</button>':'')+
      '</div>';
  }).join('');
  const html='<div class="profile-menu">'+rows+
    '<div class="profile-actions">'+
      '<button class="mini-btn sm primary" data-profile-act="add">+ 新增孩子</button>'+
      '<button class="mini-btn sm" data-profile-act="rename">改名 / 换色</button>'+
    '</div></div>';
  showModal({title:'孩子档案',text:'点姓名即可切换，进度与积分各自独立；教材包和奖励规则全孩子共用。',
    result:html,dismissible:true,actions:[{label:'关闭'}]});
  bindProfileMenu();
}
function bindProfileMenu(){
  const host=$('modalResult'); if(!host) return;
  host.querySelectorAll('[data-profile-id]').forEach(function(row){
    row.addEventListener('click',function(e){
      if(e.target && e.target.closest('[data-profile-del]')) return;
      switchProfile(row.getAttribute('data-profile-id'));
    });
  });
  host.querySelectorAll('[data-profile-del]').forEach(function(btn){
    btn.addEventListener('click',function(e){
      e.stopPropagation();
      const id=btn.getAttribute('data-profile-del');
      guardParent('profiles',function(){ deleteProfile(id); });
    });
  });
  const acts=host.querySelectorAll('[data-profile-act]');
  acts.forEach(function(b){
    b.addEventListener('click',function(){
      const act=b.getAttribute('data-profile-act');
      if(act==='add') guardParent('profiles',addProfileDialog);
      else guardParent('profiles',renameProfileDialog);
    });
  });
}
function closeProfileMenuAnd(fn){
  hideModal();
  if(typeof fn==='function') fn();
}
function switchProfile(id){
  if(id===state.profiles.activeId){ hideModal(); return; }
  if(!profileApply(id)){ toast('没找到这个档案','bad'); return; }
  saveState(true);
  applyLoadedState();
  renderProfileChip();
  renderHeader();
  hideModal();
  toast('已切换到「'+(profileActive()?profileActive().name:'孩子')+'」','ok');
}
function addProfileDialog(){
  const menuOpen=!$('modalMask').hidden;
  if(menuOpen) hideModal();
  showModal({title:'新增孩子档案',text:'新档案从空白进度开始；教材包与奖励规则会沿用当前设置。',
    result:'<div class="field"><label>孩子称呼</label><input id="profileNewName" maxlength="16" placeholder="例如：大宝 / 二宝"></div>',
    actions:[{label:'取消',onClick:function(){ if(menuOpen) openProfileMenu(); }},
      {label:'创建',primary:true,onClick:function(){
        const name=String(($('profileNewName')||{}).value||'').trim();
        if(!name){ toast('请填写孩子称呼','bad'); if(menuOpen) openProfileMenu(); return; }
        addProfile(name);
      }}]});
  const inp=$('profileNewName');
  if(inp){
    inp.focus();
    inp.addEventListener('keydown',function(e){ if(e.key==='Enter'){ const b=$('modalActions').querySelector('.primary'); if(b) b.click(); } });
  }
}
function addProfile(name){
  profileStoreCurrent();
  const p=profileBlank(profileId(),name);
  p.color=profileList().length%PROFILE_COLORS.length;
  state.profiles.list.push(p);
  state.profiles.data[p.id]=profilePickChild(clone(DEFAULT_STATE));
  state.profiles.activeId=p.id;
  const next=normalizeState(clone(DEFAULT_STATE));
  PROFILE_SHARED_FIELDS.forEach(function(k){ next[k]=clone(state[k]); });
  PROFILE_PLAN_SHARED.forEach(function(k){ next.plan[k]=clone(state.plan[k]); });
  PROFILE_LOTTERY_SHARED.forEach(function(k){ next.lottery[k]=clone(state.lottery[k]); });
  next.profiles=state.profiles;
  Object.keys(state).forEach(function(k){ delete state[k]; });
  Object.keys(next).forEach(function(k){ state[k]=next[k]; });
  saveState(true); applyLoadedState(); renderProfileChip(); renderHeader();
  toast('已为「'+name+'」建立独立档案','ok');
}
function renameProfileDialog(){
  const p=profileActive(); if(!p) return;
  const menuOpen=!$('modalMask').hidden;
  if(menuOpen) hideModal();
  showModal({title:'修改档案',text:'只改称呼和头像颜色，不会影响学习进度。',
    result:'<div class="field"><label>孩子称呼</label><input id="profileRename" maxlength="16" value="'+esc(p.name)+'"></div>'+
      '<div class="profile-colors">'+PROFILE_COLORS.map(function(c,i){
        return '<button data-profile-color="'+i+'" style="background:'+c+'" class="'+(i===Number(p.color)?'active':'')+'"></button>';
      }).join('')+'</div>',
    actions:[{label:'取消',onClick:function(){ if(menuOpen) openProfileMenu(); }},
      {label:'保存',primary:true,onClick:function(){
        const name=String(($('profileRename')||{}).value||'').trim();
        if(!name){ toast('请填写孩子称呼','bad'); if(menuOpen) openProfileMenu(); return; }
        p.name=name;
        const sel=document.querySelector('.profile-colors button.active');
        if(sel) p.color=Number(sel.getAttribute('data-profile-color'))||0;
        p.updatedAt=Date.now();
        saveState(true); renderProfileChip();
        toast('档案已更新','ok');
        if(menuOpen) openProfileMenu();
      }}]});
  const inp=$('profileRename'); if(inp){ inp.focus(); inp.select(); }
  document.querySelectorAll('[data-profile-color]').forEach(function(b){
    b.addEventListener('click',function(){
      document.querySelectorAll('[data-profile-color]').forEach(function(x){ x.classList.remove('active'); });
      b.classList.add('active');
    });
  });
}
function deleteProfile(id){
  const ps=(typeof state!=='undefined' && state.profiles)?state.profiles:null;
  if(!ps || ps.list.length<2){ toast('至少保留一个档案','bad'); return; }
  const p=ps.list.find(function(x){ return x.id===id; });
  if(!p) return;
  showModal({title:'删除档案「'+p.name+'」？',text:'这个孩子的全部进度、积分、生词和打卡记录会被永久删除，无法恢复。建议先导出全库备份。',
    actions:[{label:'取消'},{label:'确认删除',primary:true,onClick:function(){ reallyDeleteProfile(id); }}]});
}
function reallyDeleteProfile(id){
  const ps=state.profiles;
  if(ps.list.length<2) return;
  ps.list=ps.list.filter(function(p){ return p.id!==id; });
  delete ps.data[id];
  if(ps.activeId===id){
    const nextId=ps.list[0].id;
    profileApply(nextId);
  }else{
    /* 删的是别的档案，当前档案快照保持不动 */
    profileStoreCurrent();
  }
  saveState(true); applyLoadedState(); renderProfileChip(); renderHeader();
  toast('档案已删除','ok');
}
