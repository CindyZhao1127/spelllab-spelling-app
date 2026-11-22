/* ---------------- 本地数据库：IndexedDB 主库 + localStorage 镜像 ---------------- */
const DB_NAME='spelllab.db', DB_VER=1, DB_STORE='kv';
const DB_KEY_MAIN='main', DB_KEY_FILE='fileHandle';
const MIRROR_TS='spelllab.savedAt.v2';
const STORE = {
  mode:'local', db:null, ready:false, migrated:false, error:'',
  mirror:'ok', mirrorBytes:0, lastMirror:0, savedAt:0,
  timer:0, queued:false, writing:false,
  fileHandle:null, fileName:'', fileState:'', fileLast:0, fileTimer:0,
  usage:0, quota:0, persisted:false,
  dbPath:'', dbSize:0, dbCounts:null, desktopTimer:0,
  dirty:false, lastFlush:0
};

