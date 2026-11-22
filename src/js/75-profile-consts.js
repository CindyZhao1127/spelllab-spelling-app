/* ---------------- 多孩子档案常量（须早于 80-state 的 loadState 初始化） ---------------- */
const PROFILE_FIELDS = [
  'progress','wrong','wordStats','history','bestTimes','stats','settings','filter',
  'vocab','practiceSets','session','phonics','grammar','memo','typingDuck','seq'
];
/* 积分与抽奖：余额 / 记录按孩子，规则（每答对几分、奖项、消耗）全孩子共享。 */
const PROFILE_PLAN_CHILD = ['points','ledger','results','since','lastEval'];
const PROFILE_LOTTERY_CHILD = ['log','daily'];
const PROFILE_PLAN_SHARED = ['enabled','type','target','reward','penalty','perCorrect'];
const PROFILE_LOTTERY_SHARED = ['cost','typingPoints','dailyLimit','prizes','legacyPrizeFix'];
const PROFILE_SHARED_FIELDS = ['parent','textbooks','grades','books','custom','customMeta','system','unitMeta'];
const PROFILE_DEFAULT_NAME = '默认档案';
