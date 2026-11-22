/* ---------------- 桌面版桥接（Python 本地服务） ----------------
   桌面版由服务端注入 __SPELLLAB_DESKTOP__，此时改用 SQLite 读写；
   浏览器直接打开时该标记不存在，完全走上面的 IndexedDB 逻辑。 */
const DESKTOP = typeof window!=='undefined' &&
  (!!window.__SPELLLAB_DESKTOP__ || !!(window.pywebview && window.pywebview.api));
const DESKTOP_API = {
  /* 防抖保存与关窗 beacon 可能并发，迟到的旧快照不能覆盖新状态。
     附上单调客户端时间戳，服务端据此丢弃 stale 写入。 */
  stamp(s){
    const ts=(typeof STORE!=='undefined' && STORE.savedAt)
      ? Math.max(STORE.savedAt,Date.now()) : Date.now();
    return Object.assign({},s,{__clientSavedAt:ts});
  },
  req(path,body){
    if(typeof fetch!=='function') return Promise.reject(new Error('fetch 不可用'));
    const opt = body===undefined ? {} : {
      method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)
    };
    return fetch('/api/'+path,opt).then(r=>{
      if(!r.ok) throw new Error('HTTP '+r.status);
      return r.json();
    });
  },
  load(){ return this.req('load'); },
  save(s){ return this.req('save',this.stamp(s)); },
  /* 关窗 / 切后台时用 sendBeacon：普通 fetch 在页面卸载时会被浏览器直接取消，
     这正是「答对后立刻关程序，最后几条练习没了」的根因。 */
  beacon(s){
    try{
      if(typeof navigator!=='undefined' && typeof navigator.sendBeacon==='function'){
        const body=new Blob([JSON.stringify(this.stamp(s))],{type:'application/json'});
        if(navigator.sendBeacon('/api/save',body)) return true;
      }
    }catch(e){}
    try{
      if(typeof fetch==='function'){
        fetch('/api/save',{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify(this.stamp(s)),keepalive:true}).catch(()=>{});
        return true;
      }
    }catch(e){}
    return false;
  },
  info(){ return this.req('info'); },
  exportFile(text,filename){ return this.req('export',{text:text,filename:filename}); },
  openFolder(){ return this.req('open-folder'); },
  ping(){ return this.req('ping'); }
};

