/* ---------------- 内置题库 ---------------- */
/* en: 英文句子；hints: 逐词中文提示；chunks: [短语中文, 包含单词数]，数量之和须等于单词数 */
const BUILTIN_UNITS = [
  {
    id:'u6', name:'Unit 6 · Weather 天气', book:'沪教版三年级起点四年级上册（新课标）', gradeId:'g4', bookId:'b_hj',
    sentences:[
      {cn:'天气变冷了，而且经常下雪！', en:'It gets cold and it often snows!', hints:['它','变得','冷的','并且','它','经常','下雪'], chunks:[['天气变冷了',3],['而且经常下雪',4]]},
      {cn:'今天天气怎么样？', en:'How is the weather today?', hints:['怎么样','是','这','天气','今天'], chunks:[['天气怎么样',4],['今天',1]]},
      {cn:'今天晴朗又暖和。', en:'It is sunny and warm today.', hints:['它','是','晴朗的','并且','暖和的','今天'], chunks:[['天气晴朗',3],['而且暖和',2],['今天',1]]},
      {cn:'外面正在下雨。', en:'It is raining outside.', hints:['它','是','正在下雨','外面'], chunks:[['正在下雨',3],['在外面',1]]},
      {cn:'冬天经常下雪。', en:'It often snows in winter.', hints:['它','经常','下雪','在','冬天'], chunks:[['经常下雪',3],['在冬天',2]]},
      {cn:'我喜欢有风的日子。', en:'I like windy days.', hints:['我','喜欢','有风的','日子'], chunks:[['我喜欢',2],['有风的日子',2]]},
      {cn:'请带上你的雨伞。', en:'Please take your umbrella.', hints:['请','带上','你的','雨伞'], chunks:[['请带上',2],['你的雨伞',2]]},
      {cn:'今天太冷了。', en:'It is too cold today.', hints:['它','是','太','冷的','今天'], chunks:[['天气太冷',4],['今天',1]]},
      {cn:'春天经常下雨。', en:'It often rains in spring.', hints:['它','经常','下雨','在','春天'], chunks:[['经常下雨',3],['在春天',2]]},
      {cn:'我们可以堆雪人。', en:'We can make a snowman.', hints:['我们','可以','堆','一个','雪人'], chunks:[['我们可以堆',3],['一个雪人',2]]}
    ],
    words:[['weather','天气'],['cold','冷的'],['cool','凉爽的'],['warm','暖和的'],['sunny','晴朗的'],['rainy','下雨的'],['windy','有风的'],['snow','雪'],['rain','雨'],['often','经常'],['umbrella','雨伞'],['spring','春天'],['winter','冬天'],['snowman','雪人'],['cloud','云']]
  },
  {
    id:'u5', name:'Unit 5 · My day 我的一天', book:'沪教版三年级起点四年级上册（新课标）', gradeId:'g4', bookId:'b_hj',
    sentences:[
      {cn:'我七点吃早餐。', en:'I have breakfast at seven.', hints:['我','吃','早餐','在','七点'], chunks:[['我吃早餐',3],['在七点',2]]},
      {cn:'我八点去上学。', en:'I go to school at eight.', hints:['我','去','到','学校','在','八点'], chunks:[['我去上学',4],['在八点',2]]},
      {cn:'我晚上读书。', en:'I read books in the evening.', hints:['我','读','书','在','这','晚上'], chunks:[['我读书',3],['在晚上',3]]},
      {cn:'我们一起吃午饭。', en:'We have lunch together.', hints:['我们','吃','午饭','一起'], chunks:[['我们吃午饭',3],['一起',1]]},
      {cn:'我做我的作业。', en:'I do my homework.', hints:['我','做','我的','作业'], chunks:[['我做',2],['我的作业',2]]},
      {cn:'我九点上床睡觉。', en:'I go to bed at nine.', hints:['我','去','到','床','在','九点'], chunks:[['我上床睡觉',4],['在九点',2]]}
    ],
    words:[['morning','早上'],['evening','晚上'],['breakfast','早餐'],['lunch','午餐'],['dinner','晚餐'],['school','学校'],['homework','作业'],['books','书'],['early','早的'],['night','夜晚'],['clock','时钟'],['seven','七'],['eight','八'],['nine','九']]
  },
  {
    id:'u7', name:'Unit 7 · Food 食物', book:'沪教版三年级起点四年级上册（新课标）', gradeId:'g4', bookId:'b_hj',
    sentences:[
      {cn:'我饿了。', en:'I am hungry.', hints:['我','是','饿的'], chunks:[['我',1],['饿了',2]]},
      {cn:'我想要一些面包。', en:'I want some bread.', hints:['我','想要','一些','面包'], chunks:[['我想要',2],['一些面包',2]]},
      {cn:'你最喜欢什么食物？', en:'What is your favourite food?', hints:['什么','是','你的','最喜欢的','食物'], chunks:[['什么是',2],['你最喜欢的食物',3]]},
      {cn:'米饭和面条都很好吃。', en:'Rice and noodles are nice.', hints:['米饭','和','面条','是','好吃的'], chunks:[['米饭和面条',3],['都很好吃',2]]},
      {cn:'请给我一些牛奶。', en:'Please give me some milk.', hints:['请','给','我','一些','牛奶'], chunks:[['请给我',3],['一些牛奶',2]]},
      {cn:'我不喜欢胡萝卜。', en:"I don't like carrots.", hints:['我','不','喜欢','胡萝卜'], chunks:[['我不',2],['喜欢胡萝卜',2]]}
    ],
    words:[['bread','面包'],['milk','牛奶'],['rice','米饭'],['noodles','面条'],['hungry','饥饿的'],['favourite','最喜欢的'],['carrot','胡萝卜'],['apple','苹果'],['juice','果汁'],['water','水'],['egg','鸡蛋'],['fish','鱼'],['food','食物'],['nice','好吃的']]
  }
];

const PUNCT_CN = {'.':'。','?':'？','!':'！',',':'，',';':'；',':':'：'};

