/* ---------------- 状态 ---------------- */
const KEY = 'spelllab.state.v1';
const DEFAULT_STATE = {
  progress:{}, wrong:[], wordStats:{}, history:[], bestTimes:{},
  stats:{attempted:0,correct:0,streak:0,best:0,today:'',todayDone:0,todayRight:0,wordRight:0},
  settings:{showHints:true,speakOnFinish:true,speakDelayMs:120,ignoreCase:true,smart:true,
    rate:0.9,sound:true,volume:0.35,letterBoxes:true,revealLetters:0,wordGap:22,
    timerMode:'count',difficulty:'normal',autoVocab:true,askResume:true,askNextUnit:true,accent:'uk',
    showGrammar:false,wordLetterOrder:'auto',showPhonetic:true},
  custom:[], customMeta:{gradeId:'g4',bookId:'b_hj'},
  grades:DEFAULT_GRADES, books:DEFAULT_BOOKS, unitMeta:{},
  system:'63',
  filter:{stageId:'all',gradeId:'all',bookId:'all',volumeId:'all'},
  vocab:[], practiceSets:[], textbooks:[], seq:1,
  session:null, plan:clone(DEFAULT_PLAN), lottery:clone(DEFAULT_LOTTERY),
  phonics:clone(DEFAULT_PHONICS),
  grammar:{done:{},wrong:[],stats:{answered:0,correct:0},pointsPaid:{}},
  /* 发音练习：逐次成绩与每项最佳，按孩子档案隔离，随全库备份一起保存 */
  pronunciation:{records:[],best:{}},
  parent:clone(DEFAULT_PARENT),
  /* 记忆进阶模块：错词间隔复习 / 关卡星级 / 听写。独立命名空间，
     与旧存档天然兼容（normalizeState 会补齐），备份导出自动带上。 */
  memo:{srs:{}, stars:{}, mapUnlockAll:false, dictBest:{}, paperDict:{}}
};
let state = loadState();
let mode = 'sentence';
let unitPos = 0, qPos = 0;
let sessionOrder = {unitId:'', list:[]};
let draft = [], slots = [], assisted = false, solved = false, curTokens = [];
let boardOnComplete = null;
let chunkPhase = 0, chunkList = [], chunkIdx = 0, chunkTimer = null;
let wordCur = null, letters = [], placed = [], wordSolved = false, wordAssisted = false, lastWord = '';
let toastTimer = null;
let questionStartedAt = Date.now(), questionMistakes = 0;
let questionDeadline = 0, questionTimer = 0;
let unitRoundCount = 0, unitRoundPrompted = false;
let resumeCandidate = (state.session && state.session.unitId) ? clone(state.session) : null;
let sessionSuspended = !!resumeCandidate, resumeOffered = false;

