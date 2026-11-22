/* ---------------- 难度 / 计划 / 抽奖默认配置 ---------------- */
const DIFFICULTY = {
  easy:  {label:'简单', seconds:120, hints:2, bonusReveal:1},
  normal:{label:'正常', seconds:60,  hints:2, bonusReveal:0},
  hard:  {label:'困难', seconds:35,  hints:1, bonusReveal:0}
};
/* 奖项 autoRedeem：true = 抽到即自动兑现、不扣本次积分（如「再抽一次」）；
   false = 抽到后记为「待兑换」，线下发放后在获得奖品列表里点「标记已兑换」。 */
const DEFAULT_PRIZES = [
  {id:'p1',name:'免写一次抄写',prob:5,autoRedeem:false},
  {id:'p2',name:'一张小贴纸',prob:10,autoRedeem:false},
  {id:'p3',name:'多玩十分钟',prob:8,autoRedeem:false},
  {id:'p4',name:'挑一本睡前绘本',prob:5,autoRedeem:false},
  {id:'p5',name:'再抽一次',prob:12,autoRedeem:true}
];
