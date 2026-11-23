/* ---------------- 百度网盘 OAuth 直连（仅桌面版） ----------------
   凭证与令牌都留在 Python 本机服务里，前端只保存非敏感状态展示。 */
const BD = {status:null, filled:false, poll:0};

function bdStamp(ts){
  return ts ? new Date(Number(ts)*1000).toLocaleString('zh-CN') : '尚未备份';
}
function bdShort(s){
  s=String(s||''); return s?s.slice(0,10)+'…':'—';
}
function bdFillForm(s){
  if(BD.filled) return;
  const app=$('bdAppName'), red=$('bdRedirectUri'), auto=$('bdAuto');
  if(app && !app.value) app.value=s.appName||'';
  if(red && !red.value) red.value=s.redirectUri||'http://127.0.0.1:8791/oauth/callback';
  if(auto) auto.checked=!!s.auto;
  const hint=$('bdRedirectHint'); if(hint) hint.textContent=red?red.value:(s.redirectUri||'');
  BD.filled=true;
}
function bdRender(s){
  const panel=$('bdPanel'); if(panel) panel.hidden=!(DESKTOP && STORE.mode==='sqlite');
  BD.status=s;
  bdFillForm(s);
  const el=$('bdState'); if(!el) return;
  const remote=s.remote||{};
  let rows=dbRow('授权状态',s.authorized?'已连接百度网盘 · 可上传/恢复':'未授权 · 请先保存配置并点「授权登录」')+
    dbRow('应用目录',s.appName?('/apps/'+s.appName+'/SpellLab/'):'未配置')+
    dbRow('自动备份',s.auto?'开启（数据变化后约 20 秒合并上传）':'关闭（只手动上传）')+
    dbRow('上次上传',bdStamp(s.lastUpload));
  if(s.remote) rows+=dbRow('云端备份',fmtBytes(remote.size||0)+' · '+bdStamp(remote.mtime)+
    (remote.md5?(' · '+bdShort(remote.md5)):''));
  if(s.conflict) rows+=dbRow('同步冲突','云端文件已被另一台设备更新，请选择用哪份');
  if(s.lastError) rows+=dbRow('最近错误',s.lastError);
  el.innerHTML=rows;
  const cr=$('bdConflictRow'); if(cr) cr.hidden=!s.conflict;
  ['bdUpload','bdDownload'].forEach(id=>{
    const b=$(id); if(b) b.disabled=!s.authorized;
  });
  const au=$('bdAuthorize'); if(au) au.disabled=!s.configured;
}
function bdStatus(silent){
  if(!DESKTOP || STORE.mode!=='sqlite'){
    const panel=$('bdPanel'); if(panel) panel.hidden=true;
    return Promise.resolve(null);
  }
  return DESKTOP_API.req('baidu/status').then(s=>{ bdRender(s); return s; })
    .catch(e=>{ if(!silent) toast('读取网盘状态失败：'+String((e&&e.message)||e),'bad'); return null; });
}
function bdSaveConfig(){
  const payload={
    appId:($('bdAppId').value||'').trim(),
    appKey:($('bdAppKey').value||'').trim(),
    secretKey:($('bdSecretKey').value||'').trim(),
    appName:($('bdAppName').value||'').trim(),
    redirectUri:($('bdRedirectUri').value||'').trim()||'http://127.0.0.1:8791/oauth/callback',
    auto:!!($('bdAuto').checked)
  };
  return DESKTOP_API.req('baidu/config',payload).then(s=>{
    $('bdSecretKey').value='';
    BD.filled=true;
    bdRender(s);
    toast('网盘配置已保存（密钥只存本机）','ok');
    return s;
  }).catch(e=>toast('保存失败：'+String((e&&e.message)||e),'bad'));
}
function bdAuthorize(){
  if(BD.poll){ clearInterval(BD.poll); BD.poll=0; }
  return DESKTOP_API.req('baidu/auth/start',{}).then(r=>{
    toast('已打开百度授权页，完成后会自动回到这里','ok');
    let n=0;
    BD.poll=setInterval(()=>{
      n++;
      DESKTOP_API.req('baidu/auth/status').then(s=>{
        if(s.done){
          clearInterval(BD.poll); BD.poll=0;
          bdStatus(true);
          toast(s.ok?'百度网盘已连接':'授权失败：'+s.error,s.ok?'ok':'bad');
        }else if(n>300){
          clearInterval(BD.poll); BD.poll=0; toast('授权等待超时，请重试','bad');
        }
      }).catch(()=>{});
    },1000);
    return r;
  }).catch(e=>toast('发起授权失败：'+String((e&&e.message)||e),'bad'));
}
function bdUpload(force){
  saveState(true);
  return DESKTOP_API.req('baidu/backup/upload',{
    text:JSON.stringify(backupPayload()),force:force===true
  }).then(r=>{
    bdStatus(true);
    toast('已上传到百度网盘 · '+fmtBytes(r.size||0),'ok');
    return r;
  }).catch(e=>toast('上传失败：'+String((e&&e.message)||e),'bad'));
}
function bdDownload(){
  return DESKTOP_API.req('baidu/backup/download',{}).then(r=>{
    const ok=restoreBackup(r.text,true);
    bdStatus(true);
    if(ok) toast('已从百度网盘恢复本机数据','ok');
    return r;
  }).catch(e=>toast('下载失败：'+String((e&&e.message)||e),'bad'));
}
function bdDisconnect(){
  showModal({
    title:'解除百度网盘绑定',
    text:'只删除本机的授权配置与令牌，不会删除网盘里的备份文件。',
    actions:[{label:'取消'},{label:'确认解除',primary:true,onClick:()=>{
      DESKTOP_API.req('baidu/disconnect',{}).then(()=>{
        BD.filled=false;
        ['bdAppId','bdAppKey','bdSecretKey','bdAppName'].forEach(id=>{ const e=$(id); if(e) e.value=''; });
        const a=$('bdAuto'); if(a) a.checked=false;
        bdStatus(true); toast('已解除绑定','ok');
      }).catch(e=>toast('解除失败：'+String((e&&e.message)||e),'bad'));
    }}]
  });
}
function bdBindEvents(){
  const map={
    bdSaveConfig:bdSaveConfig, bdAuthorize:bdAuthorize, bdRefresh:()=>bdStatus(),
    bdDisconnect:bdDisconnect, bdUpload:()=>bdUpload(false), bdDownload:bdDownload,
    bdUseLocal:()=>bdUpload(true), bdUseRemote:bdDownload
  };
  Object.keys(map).forEach(id=>{
    const el=$(id); if(el && !el.__bdBound){ el.addEventListener('click',map[id]); el.__bdBound=true; }
  });
  const red=$('bdRedirectUri');
  if(red && !red.__bdBound){ red.addEventListener('input',()=>{
    const hint=$('bdRedirectHint'); if(hint) hint.textContent=red.value;
  }); red.__bdBound=true; }
}
bdBindEvents();
