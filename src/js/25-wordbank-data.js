/* ---------------- 整体词库（数据由构建脚本内嵌，见 tools/build.py） ----------------
   小学 / 初中 / 高考 / 四级 / 六级 / IT商务 六套各自独立的整体词库。
   每套词库有自己的教材类别 id（数据条目的 bookId），可直接在顶部「教材」里选；
   数据不写入存档：作为虚拟单元在 allUnits() 里按需注入，
   进度按单词记在 state.wordStats，随孩子档案隔离。 */
const WORDBANK_DATA = __SPELLLAB_WORDBANK_DATA__;
/* 旧版把六套合在一个「整体词库」类别下，加载存档时迁移掉 */
const WORDBANK_LEGACY_BOOK_ID = 'b_wordbank';
