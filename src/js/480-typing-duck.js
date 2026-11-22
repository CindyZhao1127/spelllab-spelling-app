/* ==================== 打字小鸭模块（集成）==================== */
/* ================= 打字小鸭 · 游戏逻辑 ================= */
(function () {
  'use strict';

  /* ---------- 键盘与手指数据 ---------- */
  const KB_ROWS = [
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
    [' ']
  ];

  const FINGERS = {
    lp: { name: '左手小指', cls: 'fp-lp', color: '#ff8fa3' },
    lr: { name: '左手无名指', cls: 'fp-lr', color: '#b197fc' },
    lm: { name: '左手中指', cls: 'fp-lm', color: '#74c0fc' },
    li: { name: '左手食指', cls: 'fp-li', color: '#38d9a9' },
    ri: { name: '右手食指', cls: 'fp-ri', color: '#ffa94d' },
    rm: { name: '右手中指', cls: 'fp-rm', color: '#ffd43b' },
    rr: { name: '右手无名指', cls: 'fp-rr', color: '#ff922b' },
    rp: { name: '右手小指', cls: 'fp-rp', color: '#ff6b6b' },
    th: { name: '大拇指', cls: 'fp-th', color: '#adb5bd' }
  };

  const KEY_FINGER = {
    '1': 'lp', '2': 'lr', '3': 'lm', '4': 'li', '5': 'li',
    '6': 'ri', '7': 'ri', '8': 'rm', '9': 'rr', '0': 'rp',
    q: 'lp', w: 'lr', e: 'lm', r: 'li', t: 'li',
    y: 'ri', u: 'ri', i: 'rm', o: 'rr', p: 'rp',
    a: 'lp', s: 'lr', d: 'lm', f: 'li', g: 'li',
    h: 'ri', j: 'ri', k: 'rm', l: 'rr',
    z: 'lp', x: 'lr', c: 'lm', v: 'li', b: 'li',
    n: 'ri', m: 'ri', ' ': 'th'
  };

  /* ---------- 词库 ---------- */
  const WORDS = [
    { w: 'apple', emoji: '🍎', cn: '苹果' },
    { w: 'cat', emoji: '🐱', cn: '小猫' },
    { w: 'dog', emoji: '🐶', cn: '小狗' },
    { w: 'sun', emoji: '☀️', cn: '太阳' },
    { w: 'fish', emoji: '🐟', cn: '小鱼' },
    { w: 'book', emoji: '📖', cn: '书本' },
    { w: 'star', emoji: '⭐', cn: '星星' },
    { w: 'milk', emoji: '🥛', cn: '牛奶' },
    { w: 'egg', emoji: '🥚', cn: '鸡蛋' },
    { w: 'bird', emoji: '🐦', cn: '小鸟' },
    { w: 'tree', emoji: '🌳', cn: '大树' },
    { w: 'car', emoji: '🚗', cn: '汽车' },
    { w: 'cake', emoji: '🍰', cn: '蛋糕' },
    { w: 'moon', emoji: '🌙', cn: '月亮' },
    { w: 'hat', emoji: '🎩', cn: '帽子' },
    { w: 'pen', emoji: '🖊️', cn: '钢笔' },
    { w: 'duck', emoji: '🦆', cn: '鸭子' },
    { w: 'ball', emoji: '⚽', cn: '皮球' },
    { w: 'rain', emoji: '🌧️', cn: '下雨' },
    { w: 'flower', emoji: '🌸', cn: '花朵' }
  ];

  const PINYIN = [
    { p: 'mama', emoji: '👩', cn: '妈妈' },
    { p: 'baba', emoji: '👨', cn: '爸爸' },
    { p: 'nihao', emoji: '👋', cn: '你好' },
    { p: 'xiexie', emoji: '🙏', cn: '谢谢' },
    { p: 'wo', emoji: '🙋', cn: '我' },
    { p: 'ai', emoji: '❤️', cn: '爱' },
    { p: 'shu', emoji: '📖', cn: '书' },
    { p: 'xue', emoji: '📚', cn: '学' },
    { p: 'laoshi', emoji: '👩‍🏫', cn: '老师' },
    { p: 'pengyou', emoji: '🤝', cn: '朋友' },
    { p: 'tian', emoji: '🌤️', cn: '天空' },
    { p: 'shui', emoji: '💧', cn: '水' },
    { p: 'huo', emoji: '🔥', cn: '火' },
    { p: 'gou', emoji: '🐶', cn: '狗' },
    { p: 'mao', emoji: '🐱', cn: '猫' },
    { p: 'hua', emoji: '🌸', cn: '花' }
  ];

  /* 外部词源：集成到 SpellLab 时由宿主注入，返回 [{text,cn,emoji}, ...]；
     独立版不注入，取词回退到内置 WORDS/PINYIN，行为完全不变。 */
  let externalWordsProvider = null;
  function setWordProvider(fn) { externalWordsProvider = typeof fn === 'function' ? fn : null; }
  /* 当前教材单元信息由宿主注入：{name, words:[{text,cn}]}，用来展示本单元进度 */
  let externalUnitProvider = null;
  function setUnitProvider(fn) { externalUnitProvider = typeof fn === 'function' ? fn : null; }
  function currentUnitInfo() {
    if (!externalUnitProvider) return null;
    try {
      const u = externalUnitProvider();
      if (!u || typeof u !== 'object') return null;
      return { name: String(u.name || ''), words: Array.isArray(u.words) ? u.words : [] };
    } catch (e) { return null; }
  }
  function wordsFromProvider(kind, count) {
    if (!externalWordsProvider) return null;
    try {
      const list = externalWordsProvider(kind);
      if (!Array.isArray(list) || !list.length) return null;
      return sample(list, count).map(function (o) {
        return { text: o.text, emoji: o.emoji || '', cn: o.cn || '' };
      });
    } catch (e) { return null; }
  }

  const MODE_TITLES = {
    learn: '认识字母', abc: '字母连打', word: '单词练习',
    pinyin: '拼音练习', whack: '打地鼠', weak: '错键专项',
    listen: '听音打字', pk: '亲子 PK', weakword: '错词重点练'
  };

  /* ---------- 勋章定义 ---------- */
  const BADGES = [
    { id: 'first3', ico: '🌟', name: '初次闪耀', desc: '第一次拿到三颗星' },
    { id: 'combo10', ico: '🔥', name: '连击达人', desc: '连击达到 10 次' },
    { id: 'week7', ico: '📅', name: '坚持一周', desc: '连续打卡 7 天' },
    { id: 'duck5', ico: '🦆', name: '小鸭长大', desc: '把小鸭养到 5 级' },
    { id: 'weak10', ico: '💪', name: '攻克弱项', desc: '做对 10 个错键专项' },
    { id: 'pkwin', ico: '🏆', name: 'PK 冠军', desc: '赢一次亲子对战' },
    { id: 'perfect', ico: '🎯', name: '零失误', desc: '一局全程零错误' },
    { id: 'star100', ico: '💯', name: '星星大户', desc: '累计攒够 100 颗星' }
  ];

  /* ---------- 闯关关卡定义 ---------- */
  const LEVELS = [
    { id: 1, name: '第一关 · 基准键', desc: '左手 ASDF，右手 JKL', keys: 'asdfjkl' },
    { id: 2, name: '第二关 · 上排键', desc: '打出上排 QWERTYUIOP', keys: 'qwertyuiop' },
    { id: 3, name: '第三关 · 下排键', desc: '打出下排 ZXCVBNM', keys: 'zxcvbnm' },
    { id: 4, name: '第四关 · 全键盘', desc: '26 个字母大挑战', keys: 'abcdefghijklmnopqrstuvwxyz' }
  ];

  /* ---------- DOM ---------- */
  const $ = (id) => document.getElementById('td-' + id);
  const dom = {
    screenMenu: $('screenMenu'), screenGame: $('screenGame'),
    starTotal: $('starTotal'), soundBtn: $('soundBtn'),
    gameTitle: $('gameTitle'), scoreVal: $('scoreVal'),
    comboVal: $('comboVal'), accVal: $('accVal'),
    stage: $('stage'), instruction: $('stageInstruction'),
    target: $('targetDisplay'), feedback: $('feedback'),
    progress: $('progressBar'), progressText: $('progressText'), keyboard: $('keyboard'),
    handHint: $('handHint'), handHintDot: $('handHintDot'), handHintText: $('handHintText'),
    resultModal: $('resultModal'), resultEmoji: $('resultEmoji'),
    resultTitle: $('resultTitle'), resultStars: $('resultStars'), resultDetail: $('resultDetail'),
    helpModal: $('helpModal'),
    // 新增功能 DOM
    skinBtn: $('skinBtn'), blindBtn: $('blindBtn'),
    heroDuck: $('heroDuck'), streakVal: $('streakVal'), checkinTip: $('checkinTip'),
    duckStage: $('duckStage'), duckCount: $('duckCount'), duckInfo: $('duckInfo'), feedBtn: $('feedBtn'),
    calPrev: $('calPrev'), calNext: $('calNext'), calTitle: $('calTitle'), calGrid: $('calGrid'),
    badgeBtn: $('badgeBtn'), badgeCount: $('badgeCount'), levelBtn: $('levelBtn'),
    badgeModal: $('badgeModal'), badgeGrid: $('badgeGrid'), badgeCloseBtn: $('badgeCloseBtn'),
    levelModal: $('levelModal'), levelList: $('levelList'), levelCloseBtn: $('levelCloseBtn'),
    wordStatBtn: $('wordStatsBtn'), wordStatModal: $('wordStatsModal'),
    wordStatSummary: $('wordStatSummary'), wordStatList: $('wordStatList'),
    wordStatFocusBtn: $('wordStatFocusBtn'), wordStatCloseBtn: $('wordStatCloseBtn'),
    unitCard: $('unitCard'), unitName: $('unitName'), unitBar: $('unitBar'),
    unitWords: $('unitWords'), unitDone: $('unitDone'), unitBad: $('unitBad'),
    unitMastered: $('unitMastered'), unitPracticeBtn: $('unitPracticeBtn'), unitFocusBtn: $('unitFocusBtn'),
    toast: $('toast')
  };
  const keyEls = {};

  /* ---------- 存档 ---------- */
  const SAVE_KEY = 'typingDuck.save.v2';
  const DEFAULT_SAVE = {
    stars: 0, best: {}, sound: true,
    wrongKeys: {},        // 错键统计：{ a: 3, b: 5 }
    wordStats: {},        // 单词练习统计：{ apple: {n:练过几次, bad:打错几次, ok:全对几次, cn:词义} }
    checkin: { last: '', streak: 0, total: 0, days: [] }, // days: 打卡日期 'YYYY-MM-DD' 数组，供日历显示
    duck: { exp: 0, no: 1 }, // exp: 当前鸭成长值（每 3 点升 1 级，上限 5）；no: 第几只鸭 / 共养数量
    badges: [],           // 已解锁勋章 id
    weakCorrect: 0,       // 错键专项累计答对数
    pkWin: 0,             // PK 胜场
    skin: 0,              // 当前皮肤索引
    blind: false          // 盲打开关
  };
  let save = JSON.parse(JSON.stringify(DEFAULT_SAVE));
  /* 外部存档钩子：桌面版由宿主注入，把打字存档并入主 SQLite（state.typingDuck），
     否则独立 localStorage 会随每次启动的新浏览器 profile 一起被删掉，导致
     「关闭程序再打开，打字游戏的星星/勋章/养成全没了」。独立版不注入，仍用 localStorage。 */
  const saveIO = { load:null, commit:null };
  /* 旧存档没有 duck.no / checkin.days，读取后统一补齐，避免 undefined 参与运算。 */
  function normalizeSave() {
    if (!save.duck || typeof save.duck !== 'object') save.duck = { exp: 0, no: 1 };
    if (typeof save.duck.exp !== 'number') save.duck.exp = 0;
    if (typeof save.duck.no !== 'number' || save.duck.no < 1) save.duck.no = 1;
    if (!save.checkin || typeof save.checkin !== 'object') save.checkin = { last: '', streak: 0, total: 0, days: [] };
    if (!Array.isArray(save.checkin.days)) save.checkin.days = [];
  }
  function loadSave() {
    try {
      if (typeof saveIO.load === 'function') {
        const ext = saveIO.load();
        if (ext && typeof ext === 'object') {
          save = Object.assign(JSON.parse(JSON.stringify(DEFAULT_SAVE)), ext);
          normalizeSave();
          return;
        }
      }
    } catch (e) { /* 外部存档读取失败，回退 localStorage */ }
    try {
      // 迁移旧版 v1
      let raw = localStorage.getItem(SAVE_KEY);
      if (!raw) {
        const old = localStorage.getItem('typingDuck.save.v1');
        if (old) { const o = JSON.parse(old); save.stars = o.stars || 0; save.best = o.best || {}; save.sound = o.sound !== false; }
      } else {
        save = Object.assign(JSON.parse(JSON.stringify(DEFAULT_SAVE)), JSON.parse(raw));
      }
    } catch (e) { /* 忽略 */ }
    normalizeSave();
  }
  function persist() {
    if (typeof saveIO.commit === 'function') {
      try { saveIO.commit(clone(save)); return; } catch (e) { /* 落盘失败仍写本地镜像 */ }
    }
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {}
  }
  function refreshStarTotal() { dom.starTotal.textContent = save.stars; }

  /* ---------- 通用工具 ---------- */
  function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function daysBetween(a, b) {
    const pa = a.split('-').map(Number), pb = b.split('-').map(Number);
    const da = Date.UTC(pa[0], pa[1] - 1, pa[2]), db = Date.UTC(pb[0], pb[1] - 1, pb[2]);
    return Math.round((db - da) / 86400000);
  }
  let toastTimer = null;
  function toast(msg) {
    if (!dom.toast) return;
    dom.toast.textContent = msg;
    dom.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => dom.toast.classList.remove('show'), 2200);
  }

  /* ---------- 打卡 ----------
     打卡日 = 打字模块显式记录的日期 ∪ 主程序实际练习过的日期（state.history）。
     旧逻辑只在打字模块 init / 单局结束时写 checkin.days；桌面版每次启动都用
     全新 browser profile，init 那次写在临时 localStorage 里，随后被主存档
     state.typingDuck 覆盖，而只做拼写练习的日子根本不会写打卡 → 日历缺一天。 */
  function checkinDates() {
    const c = save.checkin;
    const set = new Set(Array.isArray(c.days) ? c.days : []);
    const today = todayStr();
    try {
      const hist = (typeof state !== 'undefined' && Array.isArray(state.history)) ? state.history : [];
      hist.forEach(function (rec) {
        if (!rec || !rec.t) return;
        const d = new Date(rec.t);
        if (isNaN(d.getTime())) return;
        const ds = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
          '-' + String(d.getDate()).padStart(2, '0');
        if (ds >= '2000-01-01' && ds <= today) set.add(ds);
      });
    } catch (e) {}
    return set;
  }
  /* total / streak 始终由日期集合重算，旧存档里漂移的计数会自愈 */
  function refreshCheckinStats() {
    const c = save.checkin;
    c.days = Array.from(checkinDates()).sort();
    c.total = c.days.length;
    const set = new Set(c.days), today = todayStr();
    let cursor = set.has(today) ? today : dateShift(today, -1), streak = 0;
    while (cursor && set.has(cursor)) { streak++; cursor = dateShift(cursor, -1); }
    c.streak = streak;
    if (!c.last && c.days.length) c.last = c.days[c.days.length - 1];
  }
  /* 打开程序 / 练完一局：把今天打卡，并补齐过去只练过拼写的日子 */
  function doCheckin() {
    const c = save.checkin, day = todayStr();
    const fresh = !checkinDates().has(day) && c.last !== day;
    c.days = Array.from(checkinDates().add(day)).sort();
    c.last = day;
    refreshCheckinStats();
    persist();
    return fresh;
  }
  /* 主程序每次写入练习记录时同步一次日历，不把今天强行算成打卡 */
  function syncPracticeCheckin() {
    const before = checkinDates().size;
    refreshCheckinStats();
    if (save.checkin.days.length !== before) persist();
  }

  /* ---------- 打卡日历 ---------- */
  let calCursor = null; // {y, m} 当前查看的年月，null 表示尚未初始化
  function renderCalendar() {
    if (!dom.calGrid) return;
    const now = new Date();
    if (!calCursor) calCursor = { y: now.getFullYear(), m: now.getMonth() };
    const y = calCursor.y, m = calCursor.m;
    if (dom.calTitle) dom.calTitle.textContent = `${y}年 ${m + 1}月`;
    const days = new Set((save.checkin.days || []).slice());
    const today = todayStr();
    const firstDow = new Date(y, m, 1).getDay();          // 0=周日
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    let html = '';
    for (let i = 0; i < firstDow; i++) html += '<span class="cal-cell empty"></span>';
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const cls = ['cal-cell'];
      if (days.has(ds)) cls.push('checked');
      if (ds === today) cls.push('today');
      if (ds > today) cls.push('future');
      html += `<span class="${cls.join(' ')}" title="${ds}">${d}</span>`;
    }
    dom.calGrid.innerHTML = html;
  }
  function shiftCalendar(delta) {
    if (!calCursor) { const n = new Date(); calCursor = { y: n.getFullYear(), m: n.getMonth() }; }
    const d = new Date(calCursor.y, calCursor.m + delta, 1);
    calCursor = { y: d.getFullYear(), m: d.getMonth() };
    renderCalendar();
  }

  /* ---------- 小鸭成长（鸭群）----------
     每只鸭 3 点成长值升 1 级，Lv.5 满级；满级后继续喂食会孵化下一只小鸭，
     因此喂食永远有去处，鸭群数量随投入持续增长。 */
  function duckLevel() { return Math.min(5, 1 + Math.floor((save.duck.exp || 0) / 3)); }
  const DUCK_STAGES = ['🥚', '🐣', '🐤', '🦕', '🦆'];
  const DUCK_NAMES = ['鸭蛋', '破壳', '小鸭', '幼鸭', '神气鸭'];
  const DUCK_COST = 3;
  function duckCount() { return save.duck.no || 1; }
  function renderDuck() {
    if (!dom.duckStage) return;
    const lv = duckLevel();
    const no = duckCount();
    const emoji = DUCK_STAGES[lv - 1];
    dom.duckStage.textContent = emoji;
    if (dom.heroDuck) dom.heroDuck.textContent = emoji;
    if (dom.duckCount) dom.duckCount.textContent = `第 ${no} 只 · 共养 ${no} 只 🦆`;
    dom.duckInfo.textContent = lv >= 5
      ? `Lv.${lv} ${DUCK_NAMES[lv-1]} · 喂 ${DUCK_COST}⭐ 孵下一只`
      : `Lv.${lv} ${DUCK_NAMES[lv-1]} · 喂 ${DUCK_COST}⭐ 长大`;
    if (dom.feedBtn) {
      dom.feedBtn.disabled = save.stars < DUCK_COST;
      dom.feedBtn.textContent = lv >= 5 ? `孵新鸭 ${DUCK_COST}⭐` : `喂食 ${DUCK_COST}⭐`;
    }
  }
  function feedDuck() {
    if (save.stars < DUCK_COST) { toast('星星不够，再玩几局攒星星吧 ⭐'); return; }
    const lv = duckLevel();
    const beforeNo = duckCount();
    save.stars -= DUCK_COST;
    let hatched = false;
    if (lv >= 5) {
      // 满级 → 孵化新的小鸭，成长值归零重新养
      save.duck.no = beforeNo + 1;
      save.duck.exp = 0;
      hatched = true;
    } else {
      save.duck.exp = (save.duck.exp || 0) + 1;
    }
    persist();
    refreshStarTotal();
    renderDuck();
    SFX.good();
    const nl = duckLevel();
    if (hatched) { toast(`第 ${save.duck.no} 只小鸭孵化啦！🦆`); SFX.star(); }
    else if (nl > lv) { toast(`小鸭升级到 Lv.${nl} ${DUCK_NAMES[nl-1]}！`); SFX.star(); checkBadge('duck5'); }
    else toast('小鸭吃得好开心！🥚');
  }

  /* ---------- 勋章 ---------- */
  function checkBadge(id) {
    if (save.badges.indexOf(id) >= 0) return;
    const b = BADGES.find((x) => x.id === id);
    if (!b) return;
    save.badges.push(id);
    persist();
    renderBadges();
    toast(`解锁勋章 ${b.ico} ${b.name}！`);
    SFX.star();
  }
  function renderBadges() {
    if (!dom.badgeGrid) return;
    dom.badgeGrid.innerHTML = '';
    BADGES.forEach((b) => {
      const got = save.badges.indexOf(b.id) >= 0;
      const item = document.createElement('div');
      item.className = 'badge-item' + (got ? ' unlocked' : '');
      item.innerHTML =
        `<div class="badge-ico">${b.ico}</div>` +
        `<div class="badge-name">${got ? b.name : '???'}</div>` +
        `<div class="badge-desc">${b.desc}</div>`;
      dom.badgeGrid.appendChild(item);
    });
    if (dom.badgeCount) dom.badgeCount.textContent = save.badges.length;
  }

  /* ---------- 闯关地图 ---------- */
  function maxUnlockedLevel() {
    // 通关第 N 关后解锁 N+1，初始只解锁第 1 关
    let cleared = 0;
    LEVELS.forEach((lv) => { if (save.best['level' + lv.id]) cleared = lv.id; });
    return Math.min(LEVELS.length, cleared + 1);
  }
  function renderLevels() {
    if (!dom.levelList) return;
    dom.levelList.innerHTML = '';
    const unlocked = maxUnlockedLevel();
    LEVELS.forEach((lv) => {
      const cleared = !!save.best['level' + lv.id];
      const locked = lv.id > unlocked;
      const item = document.createElement('div');
      item.className = 'level-item' + (locked ? ' locked' : (cleared ? ' cleared' : ' unlocked'));
      item.innerHTML =
        `<div class="level-ico">${cleared ? '⭐' : (locked ? '🔒' : '👉')}</div>` +
        `<div class="level-info"><div class="level-name">${lv.name}</div>` +
        `<div class="level-desc">${lv.desc}</div></div>` +
        `<div class="level-state">${cleared ? '已通关' : (locked ? '未解锁' : '可挑战')}</div>`;
      if (!locked) {
        item.addEventListener('click', () => {
          dom.levelModal.classList.remove('show');
          startMode('learn');
          G.levelId = lv.id;
          setupSequenceFromKeys(lv.keys, 10);
        });
      }
      dom.levelList.appendChild(item);
    });
  }

  /* ---------- 单词统计 ---------- */
  function renderWordStats() {
    if (!dom.wordStatList) return;
    const all = Object.keys(save.wordStats || {}).map(w => {
      const s = save.wordStats[w] || {};
      return { w, n: s.n || 0, bad: s.bad || 0, ok: s.ok || 0, cn: s.cn || '' };
    }).filter(x => x.n > 0).sort((a, b) =>
      (b.bad - a.bad) || (a.n - b.n) || a.w.localeCompare(b.w));
    const totalN = all.reduce((s, x) => s + x.n, 0);
    const totalBad = all.reduce((s, x) => s + x.bad, 0);
    if (dom.wordStatSummary) {
      dom.wordStatSummary.innerHTML =
        `<span class="ws-pill">练过 ${all.length} 个单词</span>` +
        `<span class="ws-pill">累计 ${totalN} 次</span>` +
        `<span class="ws-pill">打错 ${totalBad} 次</span>`;
    }
    if (!all.length) {
      dom.wordStatList.innerHTML = '<div class="empty">还没有单词记录，先玩几局「单词练习」或「听音打字」吧！</div>';
      return;
    }
    dom.wordStatList.innerHTML = all.slice(0, 60).map(x =>
      `<div class="ws-row${x.bad >= 2 ? ' hot' : ''}">` +
      `<span class="ws-word">${escHtml(x.w)}</span>` +
      `<span class="ws-cn">${escHtml(x.cn)}</span>` +
      `<span class="ws-num">练 ${x.n} 次</span>` +
      `<span class="ws-num bad">错 ${x.bad} 次</span>` +
      `<span class="ws-num">全对 ${x.ok}</span></div>`
    ).join('');
  }

  /* ---------- 当前单元进度（与 SpellLab 教材词表联动） ---------- */
  function unitWordList() {
    const info = currentUnitInfo();
    const seen = Object.create(null), list = [];
    (((info && info.words) || [])).forEach(function (w) {
      const text = String((w && w.text) || '').trim().toLowerCase();
      if (!/^[a-z][a-z'-]*$/.test(text) || seen[text]) return;
      seen[text] = 1;
      list.push({ text: text, cn: String((w && w.cn) || '') });
    });
    return { info: info, list: list };
  }
  function renderUnitProgress() {
    if (!dom.unitCard) return;
    const data = unitWordList(), list = data.list;
    dom.unitCard.style.display = data.info ? '' : 'none';
    if (dom.unitName) dom.unitName.textContent = data.info && data.info.name
      ? data.info.name + ' · 共 ' + list.length + ' 词' : '未选择教材单元';
    let done = 0, bad = 0, mastered = 0;
    list.forEach(function (w) {
      const s = save.wordStats[w.text] || {};
      if ((s.n || 0) > 0) done++;
      if ((s.bad || 0) > 0) bad++;
      if ((s.ok || 0) >= 2 || ((s.n || 0) >= 2 && (s.bad || 0) === 0)) mastered++;
    });
    if (dom.unitWords) dom.unitWords.textContent = list.length;
    if (dom.unitDone) dom.unitDone.textContent = done;
    if (dom.unitBad) dom.unitBad.textContent = bad;
    if (dom.unitMastered) dom.unitMastered.textContent = mastered;
    if (dom.unitBar) dom.unitBar.style.width = (list.length ? Math.round(done / list.length * 100) : 0) + '%';
    if (dom.unitPracticeBtn) dom.unitPracticeBtn.disabled = !list.length;
    if (dom.unitFocusBtn) dom.unitFocusBtn.disabled = !bad;
  }
  function startUnitPractice(onlyWeak) {
    const list = unitWordList().list;
    let use = list.slice();
    if (onlyWeak) {
      use = use.filter(function (w) { return (save.wordStats[w.text] || {}).bad > 0; })
        .sort(function (a, b) {
          return ((save.wordStats[b.text] || {}).bad || 0) - ((save.wordStats[a.text] || {}).bad || 0);
        });
    }
    if (!use.length) {
      toast(onlyWeak ? '本单元还没有打错的单词，先练几局吧！' : '当前单元还没有可练习的单词');
      return;
    }
    clearTimers(); clearKeyStates();
    G = freshGame('word');
    dom.gameTitle.textContent = onlyWeak ? '本单元错词重点练' : '本单元单词练习';
    dom.target.innerHTML = '';
    dom.feedback.className = 'feedback';
    dom.instruction.textContent = '';
    setProgress(0); updateStats(); showGameScreen();
    G.seq = shuffle(use).slice(0, 16);
    dom.instruction.textContent = onlyWeak
      ? '这些是本单元你打错过的单词，重点练一练：'
      : '照着当前教材单元的单词，一个字母一个字母打：';
    presentQuestion();
  }
  function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* ---------- 皮肤 ---------- */
  const SKINS = ['', 'skin-forest', 'skin-night', 'skin-sunset'];
  const SKIN_NAMES = ['默认', '森林', '夜空', '晚霞'];
  function applySkin() {
    // 独立版是 #app；集成版根容器是 #td-root（其 class 承载皮肤）
    const app = $('app') || $('root') || document.querySelector('.td-app');
    if (!app) return;
    SKINS.forEach((s) => { if (s) app.classList.remove(s); });
    if (SKINS[save.skin]) app.classList.add(SKINS[save.skin]);
    if (dom.skinBtn) dom.skinBtn.title = '主题：' + (SKIN_NAMES[save.skin] || '默认') + '（点击切换）';
  }
  function cycleSkin() {
    save.skin = (save.skin + 1) % SKINS.length;
    persist();
    applySkin();
    toast('主题已切换：' + (SKIN_NAMES[save.skin] || '默认'));
  }

  /* ---------- 音效 ---------- */
  let actx = null;
  function ensureAudio() {
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
    } catch (e) { actx = null; }
  }
  function tone(freq, dur, type, vol, delay) {
    if (!save.sound || !actx) return;
    const t0 = actx.currentTime + (delay || 0);
    const osc = actx.createOscillator();
    const g = actx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.16, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(actx.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.03);
  }
  const SFX = {
    good() { tone(659, 0.14, 'sine', 0.16, 0); tone(880, 0.16, 'sine', 0.14, 0.08); },
    bad() { tone(180, 0.18, 'square', 0.09, 0); },
    star() { tone(523, .1, 'sine', .12, 0); tone(659, .1, 'sine', .12, .08); tone(784, .1, 'sine', .12, .16); tone(1046, .18, 'sine', .14, .24); },
    finish() { [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, .18, 'triangle', .13, i * .11)); }
  };

  /* ---------- 定时器管理 ---------- */
  let timers = [];
  function later(fn, ms) { const id = setTimeout(fn, ms); timers.push(id); return id; }
  function every(fn, ms) { const id = setInterval(fn, ms); timers.push(id); return id; }
  function clearTimers() { timers.forEach((id) => { clearTimeout(id); clearInterval(id); }); timers = []; }

  /* ---------- 游戏状态 ---------- */
  let G = null;
  function freshGame(mode) {
    return {
      mode, active: true, startedAt: Date.now(), score: 0, combo: 0, maxCombo: 0,
      correct: 0, wrong: 0, totalAnswered: 0,
      seq: [], qIndex: 0, charIndex: 0,
      targetKey: null, timeLeft: 0, holes: [], spawnDelay: 0, aliveMs: 0,
      levelId: null, pkPlayer: 1, pkScores: [0, 0], pkRound: 1, masked: false
    };
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function sample(arr, n) { return shuffle(arr).slice(0, n); }

  /* ---------- 构建虚拟键盘 ---------- */
  function buildKeyboard() {
    dom.keyboard.innerHTML = '';
    KB_ROWS.forEach((row) => {
      const rowEl = document.createElement('div');
      rowEl.className = 'kb-row';
      row.forEach((ch) => {
        const key = document.createElement('button');
        key.className = 'key ' + FINGERS[KEY_FINGER[ch]].cls + (ch === ' ' ? ' space' : '');
        key.textContent = ch === ' ' ? '空格' : ch.toUpperCase();
        key.dataset.key = ch;
        key.type = 'button';
        key.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          ensureAudio();
          if (G && G.active) handleKey(ch);
        });
        rowEl.appendChild(key);
        keyEls[ch] = key;
      });
      dom.keyboard.appendChild(rowEl);
    });
  }

  function clearKeyStates() {
    Object.keys(keyEls).forEach((k) => {
      keyEls[k].classList.remove('target', 'correct', 'wrong', 'pressed');
    });
  }

  function applyBlindVisual() {
    if (!dom.keyboard) return;
    dom.keyboard.classList.toggle('blind', !!save.blind);
  }

  function pressVisual(key) {
    const el = keyEls[key];
    if (!el) return;
    el.classList.add('pressed');
    later(() => el.classList.remove('pressed'), 130);
  }

  function setTargetKey(key) {
    G.targetKey = key;
    Object.keys(keyEls).forEach((k) => keyEls[k].classList.remove('target'));
    if (key && keyEls[key]) {
      keyEls[key].classList.add('target');
      const fg = FINGERS[KEY_FINGER[key]];
      dom.handHintDot.style.background = fg.color;
      dom.handHintText.textContent = `用「${fg.name}」按 ${key === ' ' ? '空格' : key.toUpperCase()} 键`;
      dom.handHint.classList.add('active');
    } else {
      dom.handHintDot.style.background = '#dee2e6';
      dom.handHintText.textContent = '看发光的小按键';
      dom.handHint.classList.remove('active');
    }
  }

  function showFeedback(good) {
    dom.feedback.textContent = good ? '✔' : '✘';
    dom.feedback.className = 'feedback ' + (good ? 'show-good' : 'show-bad');
    later(() => { dom.feedback.className = 'feedback'; }, 620);
  }

  function markKeyResult(key, good) {
    const el = keyEls[key];
    if (!el) return;
    el.classList.remove('target');
    el.classList.add(good ? 'correct' : 'wrong');
    later(() => el.classList.remove(good ? 'correct' : 'wrong'), good ? 260 : 380);
  }

  function updateStats() {
    dom.scoreVal.textContent = G.score;
    dom.comboVal.textContent = '🔥' + G.combo;
    const answered = G.correct + G.wrong;
    const acc = answered ? Math.round((G.correct / answered) * 100) : 100;
    dom.accVal.textContent = acc + '%';
  }

  function setProgress(ratio) {
    const pct = Math.max(0, Math.min(100, ratio * 100));
    dom.progress.style.width = pct + '%';
    if (dom.progressText) dom.progressText.textContent = Math.round(pct) + '%';
  }

  /* ---------- 屏幕切换 ---------- */
  function showGameScreen() {
    dom.screenMenu.classList.remove('active');
    dom.screenGame.classList.add('active');
    // 游戏中收起底部图例，把高度让给游戏舞台，避免地鼠被裁
    $('legend').style.display = 'none';
  }
  function showMenuScreen() {
    dom.screenGame.classList.remove('active');
    dom.screenMenu.classList.add('active');
    $('legend').style.display = 'flex';
    renderCalendar();
  }

  /* ---------- 启动模式 ---------- */
  function startMode(mode) {
    clearTimers();
    clearKeyStates();
    G = freshGame(mode);
    dom.gameTitle.textContent = MODE_TITLES[mode];
    dom.target.innerHTML = '';
    dom.feedback.className = 'feedback';
    dom.instruction.textContent = '';
    setProgress(0);
    updateStats();
    showGameScreen();

    switch (mode) {
      case 'learn': setupSequence('letters', 20); break;
      case 'abc': setupTimedABC(); break;
      case 'word': setupSequence('words', 8); break;
      case 'weakword': setupWeakWord(); break;
      case 'pinyin': setupSequence('pinyin', 8); break;
      case 'whack': setupWhack(); break;
      case 'weak': setupWeak(); break;
      case 'listen': setupListen(); break;
      case 'pk': setupPK(); break;
    }
  }

  /* 用指定键集生成序列（闯关地图用） */
  function setupSequenceFromKeys(keys, count) {
    G.seq = sample(keys.split(''), count).map((c) => ({ text: c }));
    G.qIndex = 0; G.charIndex = 0;
    dom.target.innerHTML = '';
    setProgress(0);
    updateStats();
    presentQuestion();
  }

  /* ---------- 模式 A：序列练习（字母 / 单词 / 拼音） ---------- */
  function setupSequence(kind, count) {
    if (kind === 'letters') G.seq = sample('abcdefghijklmnopqrstuvwxyz'.split(''), count).map((c) => ({ text: c }));
    if (kind === 'words') {
      G.seq = wordsFromProvider('word', count) ||
        sample(WORDS, count).map((o) => ({ text: o.w, emoji: o.emoji, cn: o.cn }));
    }
    if (kind === 'pinyin') {
      G.seq = wordsFromProvider('pinyin', count) ||
        sample(PINYIN, count).map((o) => ({ text: o.p, emoji: o.emoji, cn: o.cn }));
    }
    dom.instruction.textContent = kind === 'letters' ? '按下发光的这个字母：' : '照着拼音/单词，一个字母一个字母打：';
    presentQuestion();
  }

  function presentQuestion() {
    const item = G.seq[G.qIndex];
    if (!item) { finishGame(); return; }
    G.charIndex = 0;
    const text = item.text;
    dom.target.innerHTML = '';
    if (text.length > 1) noteWordStart();

    if (G.mode === 'learn') {
      const box = document.createElement('div');
      box.className = 'big-letter';
      box.textContent = text.toUpperCase();
      dom.target.appendChild(box);
      dom.instruction.textContent = '按下发光的这个字母：';
    } else {
      if (item.emoji) {
        const em = document.createElement('div');
        em.className = 'word-emoji'; em.textContent = item.emoji;
        dom.target.appendChild(em);
      }
      const line = document.createElement('div');
      line.className = 'word-letters';
      text.split('').forEach((ch, i) => {
        const s = document.createElement('span');
        s.className = i === 0 ? 'wl current' : 'wl'; s.textContent = ch; s.dataset.i = i;
        line.appendChild(s);
      });
      dom.target.appendChild(line);
      if (item.cn) {
        const cn = document.createElement('div');
        cn.className = 'word-meaning'; cn.textContent = item.cn;
        dom.target.appendChild(cn);
      }
      dom.instruction.textContent = '一个字母一个字母，慢慢打：';
    }
    setTargetKey(text[0]);
    setProgress(G.qIndex / G.seq.length);
  }

  function handleSequenceKey(key) {
    const item = G.seq[G.qIndex];
    if (!item) return;
    const expected = item.text[G.charIndex];
    if (key === expected) {
      G.correct++; G.totalAnswered++; G.score += 10 + G.combo * 2;
      G.combo++; G.maxCombo = Math.max(G.maxCombo, G.combo);
      // 错键专项答对时递减该键的错键计数
      if (G.mode === 'weak' && save.wrongKeys[key]) {
        save.wrongKeys[key] = Math.max(0, save.wrongKeys[key] - 1);
        persist();
      }
      markKeyResult(key, true);
      SFX.good();
      const spans = dom.target.querySelectorAll('.wl');
      if (spans[G.charIndex]) {
        spans[G.charIndex].classList.remove('current');
        spans[G.charIndex].classList.add('done');
      }
      G.charIndex++;
      if (G.charIndex >= item.text.length) {
        if (item.text.length > 1) noteWordDone();
        dom.feedback.textContent = '⭐';
        dom.feedback.className = 'feedback show-good';
        later(() => { dom.feedback.className = 'feedback'; }, 620);
        G.score += 20;
        G.qIndex++;
        setProgress(G.qIndex / G.seq.length);
        if (G.qIndex >= G.seq.length) { SFX.star(); later(finishGame, 450); }
        else later(presentQuestion, 380);
      } else {
        const spans2 = dom.target.querySelectorAll('.wl');
        if (spans2[G.charIndex]) spans2[G.charIndex].classList.add('current');
        setTargetKey(item.text[G.charIndex]);
      }
    } else {
      G.wrong++; G.totalAnswered++; G.combo = 0;
      if (item.text.length > 1) noteWordWrong();
      recordWrong(key);
      markKeyResult(key, false);
      showFeedback(false);
      SFX.bad();
    }
    updateStats();
  }

  /* ---------- 模式 B：字母连打（计时 45 秒） ---------- */
  function setupTimedABC() {
    G.seq = [];
    G.timeLeft = 45;
    dom.instruction.textContent = '时间到之前，打出越多字母越好！';
    nextABCLetter();
    every(() => {
      G.timeLeft--;
      setProgress((45 - G.timeLeft) / 45);
      if (G.timeLeft <= 0) { clearTimers(); SFX.star(); finishGame(); }
    }, 1000);
  }
  function nextABCLetter() {
    const c = 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
    const box = document.createElement('div');
    box.className = 'big-letter';
    box.textContent = c.toUpperCase();
    dom.target.innerHTML = '';
    dom.target.appendChild(box);
    setTargetKey(c);
  }
  function handleABCKey(key) {
    if (key === G.targetKey) {
      G.correct++; G.totalAnswered++; G.score += 10 + G.combo * 2;
      G.combo++; G.maxCombo = Math.max(G.maxCombo, G.combo);
      markKeyResult(key, true); SFX.good();
      nextABCLetter();
    } else {
      G.wrong++; G.totalAnswered++; G.combo = 0;
      recordWrong(key);
      markKeyResult(key, false); showFeedback(false); SFX.bad();
    }
    updateStats();
  }

  /* ---------- 模式 C：打地鼠（计时 45 秒） ---------- */
  function setupWhack() {
    G.timeLeft = 45;
    G.spawnDelay = 1150;
    G.aliveMs = 1900;
    dom.instruction.textContent = '字母冒出来了！快按对应的键打掉它！';
    dom.target.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'whack-grid';
    for (let i = 0; i < 10; i++) {
      const hole = document.createElement('div');
      hole.className = 'hole';
      const mole = document.createElement('div');
      mole.className = 'mole';
      hole.appendChild(mole);
      grid.appendChild(hole);
      G.holes.push({ el: hole, mole: mole, up: false, letter: null, retractId: null });
    }
    dom.target.appendChild(grid);
    setTargetKey(null);
    spawnMole();
    every(() => {
      G.timeLeft--;
      setProgress((45 - G.timeLeft) / 45);
      // 难度递增
      if (G.timeLeft < 20) { G.spawnDelay = 780; G.aliveMs = 1450; }
      else if (G.timeLeft < 32) { G.spawnDelay = 980; G.aliveMs = 1700; }
      if (G.timeLeft <= 0) { clearTimers(); SFX.star(); finishGame(); }
    }, 1000);
  }
  function spawnMole() {
    if (!G.active) return;
    const free = G.holes.filter((h) => !h.up);
    if (free.length) {
      const h = free[Math.floor(Math.random() * free.length)];
      h.letter = 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
      h.mole.textContent = h.letter.toUpperCase();
      h.mole.style.background = '';
      h.el.classList.remove('hit', 'miss');
      h.el.classList.add('up');
      h.up = true;
      h.retractId = later(() => {
        if (h.up) {
          h.up = false;
          h.el.classList.remove('up');
          G.combo = 0; updateStats();
        }
      }, G.aliveMs);
    }
    later(spawnMole, G.spawnDelay);
  }
  function handleWhackKey(key) {
    const hit = G.holes.find((h) => h.up && h.letter === key);
    if (hit) {
      G.correct++; G.totalAnswered++; G.score += 12 + G.combo * 2;
      G.combo++; G.maxCombo = Math.max(G.maxCombo, G.combo);
      clearTimeout(hit.retractId);
      hit.up = false;
      hit.el.classList.add('hit');
      later(() => hit.el.classList.remove('up', 'hit'), 260);
      pressVisual(key); SFX.good();
    } else {
      G.wrong++; G.totalAnswered++; G.combo = 0;
      recordWrong(key);
      showFeedback(false); SFX.bad();
    }
    updateStats();
  }

  /* ---------- 模式 D：错键专项 ---------- */
  function setupWeak() {
    const entries = Object.keys(save.wrongKeys)
      .filter((k) => /^[a-z ]$/.test(k) && save.wrongKeys[k] > 0)
      .sort((a, b) => save.wrongKeys[b] - save.wrongKeys[a])
      .slice(0, 8);
    if (!entries.length) {
      toast('还没有错键记录，先玩几局就会统计啦！');
      G.active = false;
      later(goMenu, 300);
      return;
    }
    G.seq = shuffle(entries).map((c) => ({ text: c }));
    dom.instruction.textContent = '这些是你常按错的键，把它们练熟：';
    presentQuestion();
  }

  /* ---------- 模式 D2：错词重点练 ---------- */
  function setupWeakWord() {
    const list = weakWords(8);
    if (!list.length) {
      toast('还没有错词记录，先玩几局单词练习吧！');
      G.active = false;
      later(goMenu, 300);
      return;
    }
    G.seq = shuffle(list);
    dom.instruction.textContent = '这些单词你打错得最多，重点练一练：';
    presentQuestion();
  }

  /* ---------- 模式 E：听音打字 ---------- */
  function speakWord(text) {
    try {
      if (!window.speechSynthesis) { toast('当前浏览器不支持朗读'); return; }
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(speechText(text));
      u.lang = (typeof englishLang==='function') ? englishLang() : 'en-US';
      u.rate = 0.75;
      window.speechSynthesis.speak(u);
    } catch (e) { toast('朗读失败，请看屏幕提示'); }
  }
  function setupListen() {
    G.seq = wordsFromProvider('listen', 6) ||
      sample(WORDS, 6).map((o) => ({ text: o.w, emoji: o.emoji, cn: o.cn }));
    presentListenQuestion();
  }
  function presentListenQuestion() {
    const item = G.seq[G.qIndex];
    if (!item) { finishGame(); return; }
    G.charIndex = 0;
    G.masked = true;
    noteWordStart();
    dom.target.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'listen-wrap';
    const btn = document.createElement('button');
    btn.className = 'listen-play';
    btn.textContent = '🔊';
    btn.title = '再听一次';
    btn.addEventListener('click', () => speakWord(item.text));
    wrap.appendChild(btn);
    const line = document.createElement('div');
    line.className = 'word-letters listen-mask';
    item.text.split('').forEach((ch, i) => {
      const s = document.createElement('span');
      s.className = i === 0 ? 'wl masked current' : 'wl masked';
      s.textContent = '_';
      s.dataset.i = i;
      line.appendChild(s);
    });
    wrap.appendChild(line);
    wrap.appendChild(document.createElement('br'));
    const cn = document.createElement('span');
    cn.className = 'word-meaning';
    cn.textContent = item.cn + '（听发音，打出英文）';
    wrap.appendChild(cn);
    dom.target.appendChild(wrap);
    dom.instruction.textContent = '点喇叭听读音，把听到的单词打出来：';
    setTargetKey(null);
    setProgress(G.qIndex / G.seq.length);
    later(() => speakWord(item.text), 350);
  }
  function handleListenKey(key) {
    const item = G.seq[G.qIndex];
    if (!item) return;
    const expected = item.text[G.charIndex];
    if (key === expected) {
      G.correct++; G.totalAnswered++; G.score += 12 + G.combo * 2;
      G.combo++; G.maxCombo = Math.max(G.maxCombo, G.combo);
      pressVisual(key); SFX.good();
      save.wrongKeys[key] = Math.max(0, (save.wrongKeys[key] || 0) - 1);
      const spans = dom.target.querySelectorAll('.wl');
      if (spans[G.charIndex]) {
        spans[G.charIndex].classList.remove('masked', 'current');
        spans[G.charIndex].classList.add('done');
        spans[G.charIndex].textContent = expected; // 正常大小写，不强制全大写
      }
      G.charIndex++;
      if (G.charIndex < item.text.length && spans[G.charIndex]) spans[G.charIndex].classList.add('current');
      if (G.charIndex >= item.text.length) {
        noteWordDone();
        G.qIndex++;
        setProgress(G.qIndex / G.seq.length);
        if (G.qIndex >= G.seq.length) { SFX.star(); later(finishGame, 450); }
        else later(presentListenQuestion, 550);
      }
    } else {
      G.wrong++; G.totalAnswered++; G.combo = 0;
      noteWordWrong();
      recordWrong(key);
      markKeyResult(key, false); showFeedback(false); SFX.bad();
    }
    updateStats();
  }

  /* ---------- 模式 F：亲子 PK（轮流各打 20 秒） ---------- */
  function setupPK() {
    G.pkScores = [0, 0];
    G.pkPlayer = 1;
    G.pkRound = 1;
    G.timeLeft = 20;
    dom.target.innerHTML = '';
    nextABCLetter();
    dom.instruction.innerHTML = '<span class="pk-banner" id="pkBanner">🔴 玩家 1 先来！</span> 打出发光字母，20 秒后换人';
    every(() => {
      G.timeLeft--;
      setProgress((20 - G.timeLeft) / 20);
      if (G.timeLeft <= 0) {
        if (G.pkPlayer === 1) {
          // 玩家 1 结束，换玩家 2
          G.pkScores[0] = G.score;
          G.pkPlayer = 2;
          G.pkRound = 2;
          G.score = 0;
          G.combo = 0;
          G.timeLeft = 20;
          G.maxCombo = 0;
          G.correct = 0; G.wrong = 0; G.totalAnswered = 0;
          const b = $('pkBanner');
          if (b) { b.textContent = '🔵 玩家 2 上场！'; b.classList.add('p2'); }
          dom.instruction.innerHTML = '<span class="pk-banner p2" id="pkBanner">🔵 玩家 2 上场！</span> 打出发光字母，20 秒后换人';
          nextABCLetter();
          updateStats();
          setProgress(0);
          SFX.good();
        } else {
          G.pkScores[1] = G.score;
          clearTimers();
          SFX.star();
          finishGame();
        }
      }
    }, 1000);
  }
  function handlePKKey(key) {
    if (key === G.targetKey) {
      G.correct++; G.totalAnswered++; G.score += 10 + G.combo * 2;
      G.combo++; G.maxCombo = Math.max(G.maxCombo, G.combo);
      markKeyResult(key, true); SFX.good();
      nextABCLetter();
    } else {
      G.wrong++; G.totalAnswered++; G.combo = 0;
      recordWrong(key);
      markKeyResult(key, false); showFeedback(false); SFX.bad();
    }
    updateStats();
  }

  /* ---------- 单词练习统计 ---------- */
  function wordKey(){ return G && G.seq && G.seq[G.qIndex] ? String(G.seq[G.qIndex].text||'').toLowerCase() : ''; }
  function wordStat(w){
    if(!save.wordStats || typeof save.wordStats!=='object' || Array.isArray(save.wordStats)) save.wordStats={};
    if(!save.wordStats[w]) save.wordStats[w]={n:0,bad:0,ok:0,cn:''};
    return save.wordStats[w];
  }
  /* 一个单词开始练习：记录次数 + 词义，并重置本题的错误计数 */
  function noteWordStart(){
    if(!G || !G.seq || !G.seq[G.qIndex]) return;
    const item=G.seq[G.qIndex];
    const w=String(item.text||'').toLowerCase();
    G.wordMisses=0;
    if(!w) return;
    const st=wordStat(w);
    st.n=(st.n||0)+1;
    if(item.cn && !st.cn) st.cn=item.cn;
    persist();
  }
  /* 单词过程中按错一次 */
  function noteWordWrong(){
    const w=wordKey();
    if(!w) return;
    G.wordMisses=(G.wordMisses||0)+1;
    const st=wordStat(w); st.bad=(st.bad||0)+1; persist();
  }
  /* 单词完整打完：本题零失误则 ok+1 */
  function noteWordDone(){
    const w=wordKey();
    if(!w) return;
    const st=wordStat(w);
    if(!(G.wordMisses||0)) st.ok=(st.ok||0)+1;
    persist();
  }
  /* 错词重点练习：按错误次数优先、其次练得少优先，取前 N 个 */
  function weakWords(limit){
    return Object.keys(save.wordStats||{})
      .filter(w=>/^[a-z'-]+$/.test(w) && (save.wordStats[w].bad||0)>0)
      .sort((a,b)=> (save.wordStats[b].bad-save.wordStats[a].bad) ||
                     ((save.wordStats[a].n||0)-(save.wordStats[b].n||0)))
      .slice(0,limit||8)
      .map(w=>({text:w, cn:(save.wordStats[w].cn||''), emoji:''}));
  }

  /* ---------- 错键统计 ---------- */
  function recordWrong(key) {
    save.wrongKeys[key] = (save.wrongKeys[key] || 0) + 1;
    persist();
  }

  /* ---------- 统一按键分发 ---------- */
  function handleKey(key) {
    if (!G || !G.active) return;
    pressVisual(key);
    switch (G.mode) {
      case 'learn': case 'word': case 'pinyin': case 'weak': case 'weakword': handleSequenceKey(key); break;
      case 'abc': handleABCKey(key); break;
      case 'whack': handleWhackKey(key); break;
      case 'listen': handleListenKey(key); break;
      case 'pk': handlePKKey(key); break;
    }
  }

  /* ---------- 结算 ---------- */
  function calcStars() {
    const acc = G.totalAnswered ? G.correct / G.totalAnswered : 0;
    if (G.mode === 'abc' || G.mode === 'whack' || G.mode === 'pk') {
      const t = G.mode === 'abc' ? 40 : (G.mode === 'whack' ? 28 : 45);
      const sc = G.mode === 'pk' ? Math.max(G.pkScores[0], G.pkScores[1]) : G.score;
      if (sc >= t) return 3;
      if (sc >= t * 0.55) return 2;
      return 1;
    }
    if (acc >= 0.9) return 3;
    if (acc >= 0.7) return 2;
    return 1;
  }
  function finishGame() {
    if (!G || !G.active) return;
    G.active = false;
    clearTimers();
    clearKeyStates();
    if (window.speechSynthesis) { try { window.speechSynthesis.cancel(); } catch (e) {} }

    const stars = calcStars();
    save.stars += stars;
    save.best[G.mode] = Math.max(save.best[G.mode] || 0, G.score);
    renderUnitProgress();

    // 闯关通关记录
    if (G.mode === 'learn' && G.levelId) {
      const key = 'level' + G.levelId;
      if (!save.best[key]) save.best[key] = 1;
    }
    // 错键专项计数
    if (G.mode === 'weak') save.weakCorrect = (save.weakCorrect || 0) + G.correct;
    // PK 胜场
    let pkResult = '';
    if (G.mode === 'pk') {
      const a = G.pkScores[0], b = G.pkScores[1];
      if (a > b) { save.pkWin = (save.pkWin || 0) + 1; pkResult = '🏆 玩家 1 获胜！'; }
      else if (b > a) { pkResult = '🏆 玩家 2 获胜！'; }
      else pkResult = '🤝 平局，都很棒！';
    }

    // 打卡
    const checkedIn = doCheckin();
    persist();
    refreshStarTotal();
    renderDuck();
    renderCalendar();
    if (dom.streakVal) dom.streakVal.textContent = save.checkin.streak;
    if (dom.checkinTip) dom.checkinTip.textContent = checkedIn
      ? '打卡成功！连续 ' + save.checkin.streak + ' 天 🎉'
      : '今天已打卡，明天见！';

    // 勋章判定
    if (stars === 3) checkBadge('first3');
    if (G.maxCombo >= 10) checkBadge('combo10');
    if (G.totalAnswered > 0 && G.wrong === 0) checkBadge('perfect');
    if (save.checkin.streak >= 7) checkBadge('week7');
    if (duckLevel() >= 5) checkBadge('duck5');
    if ((save.weakCorrect || 0) >= 10) checkBadge('weak10');
    if ((save.pkWin || 0) >= 1) checkBadge('pkwin');
    if (save.stars >= 100) checkBadge('star100');

    const acc = G.totalAnswered ? Math.round((G.correct / G.totalAnswered) * 100) : 100;
    dom.resultEmoji.textContent = stars === 3 ? '🎉' : (stars === 2 ? '👏' : '💪');
    dom.resultTitle.textContent = stars === 3 ? '太棒啦！' : (stars === 2 ? '很好哦！' : '继续加油！');
    dom.resultStars.textContent = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
    if (G.mode === 'pk') {
      dom.resultDetail.innerHTML =
        `<div class="pk-done">${pkResult}</div><br>` +
        `玩家 1：<b>${G.pkScores[0]}</b> 分　玩家 2：<b>${G.pkScores[1]}</b> 分<br>` +
        `获得星星：<b>+${stars}⭐</b>`;
    } else {
      dom.resultDetail.innerHTML =
        `本次得分：<b>${G.score}</b>　最高连击：<b>🔥${G.maxCombo}</b><br>` +
        `正确率：<b>${acc}%</b>　获得星星：<b>+${stars}⭐</b>` +
        (checkedIn ? `<br>📅 今日打卡成功，连续 ${save.checkin.streak} 天！` : '');
    }
    if (typeof window.TypingDuck !== 'undefined' && typeof window.TypingDuck.onFinish === 'function') {
      try { window.TypingDuck.onFinish({ mode: G.mode, score: G.score, stars: stars,
        id: G.startedAt, correct: G.correct, total: G.totalAnswered,
        ms: Date.now() - (G.startedAt || Date.now()) }); } catch (e) {}
    }
    dom.resultModal.classList.add('show');
    SFX.finish();
  }

  /* ---------- 返回 / 重玩 ---------- */
  function goMenu() {
    G = null;
    clearTimers();
    clearKeyStates();
    // 回主菜单时关闭所有弹框，避免勋章墙/帮助/闯关弹框的遮罩残留盖住画面
    if (dom.resultModal) dom.resultModal.classList.remove('show');
    if (dom.helpModal) dom.helpModal.classList.remove('show');
    if (dom.badgeModal) dom.badgeModal.classList.remove('show');
    if (dom.levelModal) dom.levelModal.classList.remove('show');
    if (dom.wordStatModal) dom.wordStatModal.classList.remove('show');
    renderUnitProgress();
    showMenuScreen();
  }
  function replay() {
    const mode = G ? G.mode : 'learn';
    dom.resultModal.classList.remove('show');
    startMode(mode);
  }

  /* ---------- 事件绑定 ---------- */
  function bindEvents() {
    $('modeGrid').addEventListener('click', (e) => {
      const card = e.target.closest('.mode-card');
      if (card) { ensureAudio(); startMode(card.dataset.mode); }
    });
    $('backBtn').addEventListener('click', goMenu);
    $('brandHome').addEventListener('click', goMenu);
    $('againBtn').addEventListener('click', replay);
    $('menuBtn').addEventListener('click', goMenu);
    $('helpBtn').addEventListener('click', () => dom.helpModal.classList.add('show'));
    $('helpCloseBtn').addEventListener('click', () => dom.helpModal.classList.remove('show'));
    dom.helpModal.addEventListener('click', (e) => {
      if (e.target === dom.helpModal) dom.helpModal.classList.remove('show');
    });

    dom.soundBtn.addEventListener('click', () => {
      save.sound = !save.sound;
      persist();
      dom.soundBtn.textContent = save.sound ? '🔊' : '🔇';
      dom.soundBtn.classList.toggle('off', !save.sound);
      if (save.sound) { ensureAudio(); SFX.good(); }
    });

    // 皮肤切换
    if (dom.skinBtn) dom.skinBtn.addEventListener('click', cycleSkin);

    // 盲打开关
    if (dom.blindBtn) {
      dom.blindBtn.addEventListener('click', () => {
        save.blind = !save.blind;
        persist();
        applyBlindVisual();
        dom.blindBtn.classList.toggle('on', save.blind);
        dom.blindBtn.textContent = save.blind ? '👀' : '🙈';
        toast(save.blind ? '盲打挑战开启：按键字母已藏起来！' : '盲打挑战关闭');
      });
    }

    // 喂小鸭
    if (dom.feedBtn) dom.feedBtn.addEventListener('click', feedDuck);

    // 打卡日历翻页
    if (dom.calPrev) dom.calPrev.addEventListener('click', () => shiftCalendar(-1));
    if (dom.calNext) dom.calNext.addEventListener('click', () => shiftCalendar(1));

    // 勋章墙
    if (dom.badgeBtn) dom.badgeBtn.addEventListener('click', () => {
      renderBadges();
      dom.badgeModal.classList.add('show');
    });
    if (dom.badgeCloseBtn) dom.badgeCloseBtn.addEventListener('click', () => dom.badgeModal.classList.remove('show'));
    if (dom.badgeModal) dom.badgeModal.addEventListener('click', (e) => {
      if (e.target === dom.badgeModal) dom.badgeModal.classList.remove('show');
    });

    // 闯关地图
    if (dom.levelBtn) dom.levelBtn.addEventListener('click', () => {
      renderLevels();
      dom.levelModal.classList.add('show');
    });
    if (dom.levelCloseBtn) dom.levelCloseBtn.addEventListener('click', () => dom.levelModal.classList.remove('show'));
    if (dom.levelModal) dom.levelModal.addEventListener('click', (e) => {
      if (e.target === dom.levelModal) dom.levelModal.classList.remove('show');
    });

    // 单词统计
    if (dom.wordStatBtn) dom.wordStatBtn.addEventListener('click', () => {
      renderWordStats();
      dom.wordStatModal.classList.add('show');
    });
    if (dom.wordStatCloseBtn) dom.wordStatCloseBtn.addEventListener('click', () => dom.wordStatModal.classList.remove('show'));
    if (dom.wordStatModal) dom.wordStatModal.addEventListener('click', (e) => {
      if (e.target === dom.wordStatModal) dom.wordStatModal.classList.remove('show');
    });
    if (dom.wordStatFocusBtn) dom.wordStatFocusBtn.addEventListener('click', () => {
      dom.wordStatModal.classList.remove('show');
      startMode('weakword');
    });
    if (dom.unitPracticeBtn) dom.unitPracticeBtn.addEventListener('click', () => startUnitPractice(false));
    if (dom.unitFocusBtn) dom.unitFocusBtn.addEventListener('click', () => startUnitPractice(true));

    document.addEventListener('keydown', (e) => {
      if (typeof window.TypingDuck !== 'undefined' && typeof window.TypingDuck.isActive === 'function' && !window.TypingDuck.isActive()) return;
      if (e.repeat) return;
      if (dom.helpModal.classList.contains('show')) {
        if (e.key === 'Escape') dom.helpModal.classList.remove('show');
        return;
      }
      if (dom.badgeModal && dom.badgeModal.classList.contains('show')) {
        if (e.key === 'Escape') dom.badgeModal.classList.remove('show');
        return;
      }
      if (dom.levelModal && dom.levelModal.classList.contains('show')) {
        if (e.key === 'Escape') dom.levelModal.classList.remove('show');
        return;
      }
      if (dom.wordStatModal && dom.wordStatModal.classList.contains('show')) {
        if (e.key === 'Escape') dom.wordStatModal.classList.remove('show');
        return;
      }
      if (!G || !G.active) return;
      let k = e.key;
      if (k === ' ' || k === 'Spacebar') k = ' ';
      if (k.length !== 1) return;
      k = k.toLowerCase();
      if (!/^[a-z ]$/.test(k)) return;
      e.preventDefault();
      ensureAudio();
      handleKey(k);
    });
  }

  /* ---------- 初始化 ---------- */
  function init() {
    loadSave();
    refreshStarTotal();
    dom.soundBtn.textContent = save.sound ? '🔊' : '🔇';
    dom.soundBtn.classList.toggle('off', !save.sound);
    buildKeyboard();
    applySkin();
    applyBlindVisual();
    if (dom.blindBtn) {
      dom.blindBtn.classList.toggle('on', !!save.blind);
      dom.blindBtn.textContent = save.blind ? '👀' : '🙈';
    }
    // 打卡
    const checkedIn = doCheckin();
    if (dom.streakVal) dom.streakVal.textContent = save.checkin.streak;
    if (dom.checkinTip) dom.checkinTip.textContent = checkedIn
      ? '打卡成功！连续 ' + save.checkin.streak + ' 天 🎉'
      : '今天已打卡，明天见！';
    renderDuck();
    renderCalendar();
    renderBadges();
    bindEvents();
  }

  window.TypingDuck = {
    // 进入打字模式先回主菜单，让孩子看到小鸭和游戏卡片再选，
    // 而不是直接落到一块空白的游戏舞台上
    enter: function(){ goMenu(); },
    leave: function(){ goMenu(); },
    isTypingMode: function () { return !!(G && G.active); },
    setWordProvider: setWordProvider,
    setUnitProvider: setUnitProvider,
    /* 注入外部存档：load() 返回存档对象；commit(obj) 由宿主落盘。
       必须在 init() 之前调用才生效（init 会 loadSave）。 */
    setSaveIO: function(loadFn,commitFn){
      saveIO.load = typeof loadFn === 'function' ? loadFn : null;
      saveIO.commit = typeof commitFn === 'function' ? commitFn : null;
      if (saveIO.load) loadSave();
    },
    /* 宿主把主存档（SQLite/IndexedDB）加载完成后调用，重新读取打字存档并刷新界面 */
    reloadSave: function(){
      loadSave();
      refreshStarTotal();
      if (dom.soundBtn) {
        dom.soundBtn.textContent = save.sound ? '🔊' : '🔇';
        dom.soundBtn.classList.toggle('off', !save.sound);
      }
      if (dom.blindBtn) {
        dom.blindBtn.classList.toggle('on', !!save.blind);
        dom.blindBtn.textContent = save.blind ? '👀' : '🙈';
      }
      syncPracticeCheckin();
      applySkin(); applyBlindVisual(); renderDuck(); renderCalendar(); renderBadges();
      renderUnitProgress();
    },
    /* 主存档从 SQLite / IndexedDB 加载完成后再打卡一次：
       模块 init 时主存档尚未就位，那次只能写临时 localStorage。 */
    checkinAfterLoad: function(){
      const fresh = doCheckin();
      renderCalendar();
      if (dom.streakVal) dom.streakVal.textContent = save.checkin.streak;
      if (dom.checkinTip) dom.checkinTip.textContent = fresh
        ? '打卡成功！连续 ' + save.checkin.streak + ' 天 🎉'
        : '今天已打卡，明天见！';
    },
    /* 拼写练习写入 history 后调用，补上那天的日历标记 */
    syncPracticeCheckin: function(){
      syncPracticeCheckin();
      renderCalendar();
      if (dom.streakVal) dom.streakVal.textContent = save.checkin.streak;
    }
  };
  init();
})();



/* 打字小鸭 → SpellLab 集成接线 */
(function(){
  var MODE_CN = { whack:'打地鼠', abc:'字母连打', word:'单词练习', pinyin:'拼音练习', weak:'错键专项', weakword:'错词重点练', listen:'听音打字', pk:'亲子PK', learn:'认识字母' };
  window.TypingDuck.onFinish = function(r){
    /* 防刷：只认打字模块真实结算的一局——必须带局 id 且时长至少 3 秒，
       同一局 id 只结算一次。家长/孩子在界面上正常玩不受影响。 */
    var ms = Number(r && r.ms) || 0, id = r && r.id ? String(r.id) : '';
    if (!id || ms < 3000) return;
    var seen = window.__typingPayoutIds || (window.__typingPayoutIds = {});
    if (seen[id]) return;
    var keys = Object.keys(seen);
    if (keys.length >= 200) delete seen[keys[0]];
    seen[id] = 1;
    /* 每局积分由家长在「抽奖」设置中配置（state.lottery.typingPoints，默认 1），
       与星星数脱钩；设为 0 表示打字练习不计积分。 */
    var pts = Math.max(0, Math.min(99, Number(state.lottery.typingPoints) || 0));
    if (pts > 0) addPoints(pts, '打字练习·' + (MODE_CN[r.mode] || '认识字母'));
    /* 打字局是固定时长，改用「平均每次答对用时」纳入个人最快榜，才有突破意义 */
    var label = MODE_CN[r.mode] || '打字练习';
    var avgMs = Number(r.ms) > 0 ? Math.round(Number(r.ms) / Math.max(1, Number(r.correct) || 0)) : 0;
    if (avgMs >= 300 && avgMs <= 1800000) {
      try { addHistory({ mode: 'typing', unit: '打字练习', cn: label, en: label,
        ok: true, assisted: false, ms: avgMs, bad: 0 }); } catch (e) {}
    }
    var el = document.getElementById('td-resultDetail');
    if (el) { el.innerHTML += (pts > 0
      ? '<br>✨ 积分 <b>+' + pts + '</b> 已存入 SpellLab'
      : '<br>✨ 本局不计积分（家长已设为 0）'); }
  };
  window.TypingDuck.isActive = function(){
    return (typeof mode !== 'undefined' && mode === 'typing');
  };

  /* 打字存档并入 SpellLab 主存档（SQLite/IndexedDB）。
     浏览器 profile 每次启动都是全新的、关闭即删，若打字模块只写自己的
     localStorage，星星/勋章/小鸭养成会在关程序后全部丢失。 */
  if (typeof window.TypingDuck.setSaveIO === 'function') {
    window.TypingDuck.setSaveIO(
      function(){ return (typeof state !== 'undefined' && state.typingDuck) || null; },
      function(obj){
        if (typeof state === 'undefined') return;
        state.typingDuck = obj;
        if (typeof saveState === 'function') saveState();
      }
    );
  }

  /* 让打字练习的单词/听写使用 SpellLab 当前选中教材的词表。
     - word / listen 模式：取当前单元的 words（[英文, 中文]），仅保留纯英文字母词；
     - pinyin 模式：教材多为英文，没有拼音词表，返回 null 让打字模块回退内置拼音表。
     单元没有 words 时，再从 sentences 的英文句子里抽单词兜底。 */
  function textbookWordsFor(kind) {
    try {
      if (typeof currentUnit !== 'function') return null;
      var u = currentUnit();
      if (!u) return null;
      var raw = [];
      if (kind === 'pinyin') return null; // 教材无拼音词表，回退内置
      var seen = Object.create(null);
      (u.words || []).forEach(function (w) {
        if (!Array.isArray(w)) return;
        var en = String(w[0] || '').trim();
        if (/^[a-zA-Z][a-zA-Z'-]*$/.test(en)) {
          var key = en.toLowerCase();
          if (seen[key]) return; // 教材词表可能有重复词，去重
          seen[key] = 1;
          raw.push({ text: key, cn: String(w[1] || ''), emoji: '' });
        }
      });
      // 词表为空时从句子英文里兜底抽词
      if (!raw.length) {
        (u.sentences || []).forEach(function (q) {
          String((q && q.en) || '').split(/[^a-zA-Z]+/).forEach(function (tok) {
            if (tok.length >= 2 && /^[a-zA-Z]+$/.test(tok) && !raw.some(function (x) { return x.text === tok.toLowerCase(); })) {
              raw.push({ text: tok.toLowerCase(), cn: '', emoji: '' });
            }
          });
        });
      }
      return raw.length ? raw : null;
    } catch (e) { return null; }
  }
  if (typeof window.TypingDuck.setWordProvider === 'function') {
    window.TypingDuck.setWordProvider(textbookWordsFor);
  }
  /* 当前教材单元信息 → 打字主菜单的「本单元进度」卡片。
     setUnitProvider 会替换 provider，随后 reloadSave 触发一次进度渲染。 */
  if (typeof window.TypingDuck.setUnitProvider === 'function') {
    window.TypingDuck.setUnitProvider(function () {
      try {
        if (typeof currentUnit !== 'function') return null;
        var u = currentUnit();
        if (!u) return null;
        var words = textbookWordsFor('word') || [];
        return {
          name: String(u.name || ''),
          words: words.map(function (w) { return { text: w.text, cn: w.cn || '' }; })
        };
      } catch (e) { return null; }
    });
    if (typeof window.TypingDuck.reloadSave === 'function') window.TypingDuck.reloadSave();
  }
})();

