/* ---------------- 内置自然拼读课程 ----------------
   五组循序渐进：字母音 → 短元音 → 长元音 → 辅音组合 → 常见词族。
   每课提供音素（sound）与若干代表词；练习只做「听音拼词 / 看词拼读」，
   例句与发音来自浏览器朗读，不依赖外部数据或网络。 */
const PHONICS_GROUPS = [
  {id:'letter', name:'字母音', desc:'26 个字母最常见读音，先建立音—形对应',
   lessons:[
    {id:'lt-a',t:'Aa /æ/',s:'æ',w:[['apple','苹果'],['ant','蚂蚁'],['cat','猫'],['map','地图']]},
    {id:'lt-b',t:'Bb /b/',s:'b',w:[['bag','书包'],['bed','床'],['bus','公交车'],['rabbit','兔子']]},
    {id:'lt-c',t:'Cc /k/',s:'k',w:[['cat','猫'],['cup','杯子'],['car','小汽车'],['cake','蛋糕']]},
    {id:'lt-d',t:'Dd /d/',s:'d',w:[['dog','狗'],['duck','鸭子'],['desk','书桌'],['red','红色']]},
    {id:'lt-e',t:'Ee /e/',s:'e',w:[['egg','鸡蛋'],['pen','钢笔'],['ten','十'],['bed','床']]},
    {id:'lt-f',t:'Ff /f/',s:'f',w:[['fish','鱼'],['fan','扇子'],['five','五'],['leaf','叶子']]},
    {id:'lt-g',t:'Gg /g/',s:'g',w:[['go','去'],['bag','书包'],['big','大的'],['girl','女孩']]},
    {id:'lt-h',t:'Hh /h/',s:'h',w:[['hat','帽子'],['hand','手'],['hen','母鸡'],['house','房子']]},
    {id:'lt-i',t:'Ii /ɪ/',s:'ɪ',w:[['pig','猪'],['sit','坐'],['big','大的'],['milk','牛奶']]},
    {id:'lt-j',t:'Jj /dʒ/',s:'dʒ',w:[['jump','跳'],['juice','果汁'],['jam','果酱'],['jeep','吉普车']]},
    {id:'lt-k',t:'Kk /k/',s:'k',w:[['kite','风筝'],['key','钥匙'],['milk','牛奶'],['book','书']]},
    {id:'lt-l',t:'Ll /l/',s:'l',w:[['leg','腿'],['lion','狮子'],['ball','球'],['yellow','黄色']]},
    {id:'lt-m',t:'Mm /m/',s:'m',w:[['map','地图'],['moon','月亮'],['milk','牛奶'],['name','名字']]},
    {id:'lt-n',t:'Nn /n/',s:'n',w:[['nose','鼻子'],['net','网'],['ten','十'],['pen','钢笔']]},
    {id:'lt-o',t:'Oo /ɒ/',s:'ɒ',w:[['dog','狗'],['box','盒子'],['hot','热的'],['orange','橙子']]},
    {id:'lt-p',t:'Pp /p/',s:'p',w:[['pen','钢笔'],['pig','猪'],['apple','苹果'],['map','地图']]},
    {id:'lt-q',t:'Qq /kw/',s:'kw',w:[['queen','女王'],['quick','快的'],['quilt','被子'],['question','问题']]},
    {id:'lt-r',t:'Rr /r/',s:'r',w:[['red','红色'],['rabbit','兔子'],['car','小汽车'],['run','跑']]},
    {id:'lt-s',t:'Ss /s/',s:'s',w:[['sun','太阳'],['sit','坐'],['bus','公交车'],['fish','鱼']]},
    {id:'lt-t',t:'Tt /t/',s:'t',w:[['ten','十'],['tiger','老虎'],['cat','猫'],['hat','帽子']]},
    {id:'lt-u',t:'Uu /ʌ/',s:'ʌ',w:[['cup','杯子'],['bus','公交车'],['sun','太阳'],['duck','鸭子']]},
    {id:'lt-v',t:'Vv /v/',s:'v',w:[['van','货车'],['five','五'],['very','非常'],['love','爱']]},
    {id:'lt-w',t:'Ww /w/',s:'w',w:[['water','水'],['we','我们'],['window','窗户'],['yellow','黄色']]},
    {id:'lt-x',t:'Xx /ks/',s:'ks',w:[['box','盒子'],['six','六'],['fox','狐狸'],['text','课文']]},
    {id:'lt-y',t:'Yy /j/',s:'j',w:[['yes','是的'],['yellow','黄色'],['you','你'],['yo-yo','溜溜球']]},
    {id:'lt-z',t:'Zz /z/',s:'z',w:[['zoo','动物园'],['zebra','斑马'],['puzzle','拼图'],['size','尺寸']]}
   ]},
  {id:'short',name:'短元音',desc:'a/e/i/o/u 的短音，闭音节里最常见',
   lessons:[
    {id:'sv-a',t:'短元音 a /æ/',s:'æ',w:[['cat','猫'],['bag','书包'],['map','地图'],['hat','帽子'],['sad','难过']]},
    {id:'sv-e',t:'短元音 e /e/',s:'e',w:[['bed','床'],['pen','钢笔'],['ten','十'],['egg','鸡蛋'],['red','红色']]},
    {id:'sv-i',t:'短元音 i /ɪ/',s:'ɪ',w:[['pig','猪'],['sit','坐'],['big','大的'],['fish','鱼'],['milk','牛奶']]},
    {id:'sv-o',t:'短元音 o /ɒ/',s:'ɒ',w:[['dog','狗'],['box','盒子'],['hot','热的'],['top','顶部'],['mop','拖把']]},
    {id:'sv-u',t:'短元音 u /ʌ/',s:'ʌ',w:[['cup','杯子'],['bus','公交车'],['sun','太阳'],['duck','鸭子'],['run','跑']]}
   ]},
  {id:'long',name:'长元音',desc:'元音发本身的字母音，含「神奇的 e」与元音组合',
   lessons:[
    {id:'lv-ae',t:'a_e /eɪ/',s:'eɪ',w:[['cake','蛋糕'],['name','名字'],['face','脸'],['game','游戏']]},
    {id:'lv-ee',t:'e_e /iː/',s:'iː',w:[['these','这些'],['Pete','皮特'],['theme','主题'],['eve','前夕']]},
    {id:'lv-ie',t:'i_e /aɪ/',s:'aɪ',w:[['bike','自行车'],['time','时间'],['five','五'],['kite','风筝']]},
    {id:'lv-oe',t:'o_e /əʊ/',s:'əʊ',w:[['note','便条'],['home','家'],['rose','玫瑰'],['nose','鼻子']]},
    {id:'lv-ue',t:'u_e /juː/',s:'juː',w:[['cute','可爱的'],['use','使用'],['tube','管子'],['June','六月']]},
    {id:'lv-ee2',t:'ee /iː/',s:'iː',w:[['see','看见'],['tree','树'],['week','星期'],['green','绿色']]},
    {id:'lv-ea',t:'ea /iː/',s:'iː',w:[['sea','大海'],['tea','茶'],['eat','吃'],['read','读']]},
    {id:'lv-ai',t:'ai /eɪ/',s:'eɪ',w:[['rain','雨'],['train','火车'],['wait','等待'],['paint','涂色']]},
    {id:'lv-oa',t:'oa /əʊ/',s:'əʊ',w:[['boat','船'],['coat','外套'],['goat','山羊'],['road','路']]}
   ]},
  {id:'blend',name:'辅音组合',desc:'两个辅音合在一起，各读各的快连读',
   lessons:[
    {id:'bl-sh',t:'sh /ʃ/',s:'ʃ',w:[['ship','轮船'],['fish','鱼'],['she','她'],['shop','商店']]},
    {id:'bl-ch',t:'ch /tʃ/',s:'tʃ',w:[['chair','椅子'],['chess','国际象棋'],['much','许多'],['chip','薯片']]},
    {id:'bl-th',t:'th /θ/ /ð/',s:'θ',w:[['think','想'],['three','三'],['this','这个'],['mother','妈妈']]},
    {id:'bl-ph',t:'ph /f/',s:'f',w:[['photo','照片'],['phone','电话'],['elephant','大象'],['graph','图表']]},
    {id:'bl-wh',t:'wh /w/',s:'w',w:[['what','什么'],['white','白色'],['where','哪里'],['when','什么时候']]},
    {id:'bl-bl',t:'bl /bl/',s:'bl',w:[['black','黑色'],['blue','蓝色'],['block','积木'],['blow','吹']]},
    {id:'bl-st',t:'st /st/',s:'st',w:[['star','星星'],['stop','停止'],['story','故事'],['list','清单']]},
    {id:'bl-tr',t:'tr /tr/',s:'tr',w:[['tree','树'],['train','火车'],['try','尝试'],['country','国家']]}
   ]},
  {id:'family',name:'常见词族',desc:'同一韵脚换开头，一次记住一串词',
   lessons:[
    {id:'fm-at',t:'-at 家族',s:'æt',w:[['cat','猫'],['hat','帽子'],['bat','球棒'],['mat','垫子'],['sat','坐（过去式）']]},
    {id:'fm-an',t:'-an 家族',s:'æn',w:[['can','能'],['man','男人'],['fan','扇子'],['van','货车']]},
    {id:'fm-en',t:'-en 家族',s:'en',w:[['pen','钢笔'],['ten','十'],['hen','母鸡'],['men','男人们']]},
    {id:'fm-ig',t:'-ig 家族',s:'ɪg',w:[['pig','猪'],['big','大的'],['dig','挖'],['wig','假发']]},
    {id:'fm-op',t:'-op 家族',s:'ɒp',w:[['top','顶部'],['mop','拖把'],['hop','单脚跳'],['pop','流行']]},
    {id:'fm-ug',t:'-ug 家族',s:'ʌg',w:[['bug','虫子'],['rug','地毯'],['hug','拥抱'],['mug','马克杯']]},
    {id:'fm-ake',t:'-ake 家族',s:'eɪk',w:[['cake','蛋糕'],['make','制作'],['lake','湖'],['take','拿']]},
    {id:'fm-ine',t:'-ine 家族',s:'aɪn',w:[['bike','自行车'],['time','时间'],['nine','九'],['line','线']]}
   ]}
];
function phonicsLesson(id){
  for(const g of PHONICS_GROUPS){ const l=g.lessons.find(x=>x.id===id); if(l) return {g:g,l:l}; }
  return null;
}
function phonicsCount(){
  let lessons=0,words=0;
  PHONICS_GROUPS.forEach(g=>g.lessons.forEach(l=>{lessons++;words+=l.w.length;}));
  return {lessons:lessons,words:words};
}
