#!/usr/bin/env python3
"""Build spelllab.textbook.v1 packs from the editable source files.

Source layout (textbooks/source/*.json):
    [{ id, name, gradeId, edition, sources, units: [
        { name, words: [[en, cn], ...], sentences: [{cn, en}, ...] }, ... ] }, ...]

The builder adds one Chinese hint per English word token (the app requires the
hint count to match its own tokenize() output), validates every string against
the app's regexes, and writes:
    textbooks/pep-sanqi-2024.json   all 8 packs in one file
    textbooks/packs/pep-3a.json     one file per book for selective import

Run from anywhere:
    .venv/Scripts/python.exe textbooks/build.py
"""

import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SOURCE_DIR = ROOT / "source"
PACK_DIR = ROOT / "packs"
TOTAL_FILE = ROOT / "pep-sanqi-2024.json"

# Must match SpellLab.html validateQuestion()/tokenize().
EN_RE = re.compile(r"^[A-Za-z][A-Za-z\s'.,!?-]*$")
WORD_RE = re.compile(r"^[A-Za-z][A-Za-z'-]*$")
TOKEN_RE = re.compile(r"[A-Za-z][A-Za-z'-]*|[^A-Za-z\s]")

GRADE_NAMES = {
    "g3": "小学三年级",
    "g4": "小学四年级",
    "g5": "小学五年级",
    "g6": "小学六年级",
}
BOOK_ID = "b_pep"
BOOK_NAME = "人教版 PEP（三年级起点）"
SOURCE_FILES = ["pep_3_4.json", "pep_5_6.json"]

# Function words, contractions, inflections and proper names that appear in the
# example sentences but are not entries of any unit word list.
EXTRA = {
    "a": "一；一个", "am": "是", "an": "一个", "are": "是", "be": "是；成为",
    "i": "我", "you": "你；你们", "we": "我们", "they": "他们；它们", "he": "他",
    "she": "她", "it": "它", "my": "我的", "your": "你的；你们的",
    "our": "我们的", "his": "他的", "her": "她的", "their": "他们的",
    "the": "这个；那个", "this": "这个", "that": "那个", "these": "这些",
    "those": "那些", "is": "是", "was": "是（过去）", "were": "是（过去）",
    "do": "做；助动词", "does": "助动词", "did": "助动词（过去）",
    "don't": "不", "doesn't": "不", "didn't": "没有（过去）",
    "can't": "不能", "it's": "它是", "that's": "那是", "there's": "有",
    "he's": "他是", "she's": "她是", "they're": "他们是", "i'm": "我是",
    "i'd": "我想", "i've": "我已经", "let's": "让我们", "what's": "是什么",
    "who's": "是谁", "how's": "怎么样", "here's": "这里是",
    "what": "什么", "how": "怎样；多么", "who": "谁", "where": "哪里",
    "when": "什么时候", "why": "为什么", "which": "哪一个",
    "yes": "是的", "no": "不；没有", "please": "请", "thank": "谢谢",
    "hello": "你好", "hi": "嗨", "too": "也；太", "very": "很；非常",
    "and": "和；与", "or": "或者", "but": "但是", "with": "和；用",
    "for": "为；给", "to": "到；向", "of": "……的", "in": "在……里",
    "on": "在……上", "at": "在", "near": "在附近", "off": "关掉；离开",
    "up": "向上", "from": "从；来自", "about": "关于；大约",
    "here": "这里", "there": "那里", "well": "好；健康",
    "get": "得到；到达", "gets": "得到", "getting": "得到",
    "going": "去（进行时）", "come": "来", "goes": "去", "went": "去（过去）",
    "use": "使用", "look": "看", "looks": "看起来", "looking": "看",
    "try": "尝试", "turns": "轮流", "spend": "花费", "pay": "支付",
    "save": "节约；保存", "forget": "忘记", "touch": "触摸",
    "helps": "帮助", "grows": "生长", "makes": "制作", "making": "制作",
    "hurts": "疼", "telling": "告诉", "running": "跑步",
    "swimming": "游泳", "shopping": "购物", "living": "生活；居住",
    "explore": "探索", "date": "日期", "day": "天；日子", "days": "日子",
    "years": "年；岁", "name": "名字", "birthday": "生日",
    "duty": "职责", "everything": "一切", "others": "其他人",
    "great": "很棒的", "happy": "快乐的", "high": "高的", "long": "长的",
    "many": "许多", "more": "更多", "lot": "许多", "maybe": "也许",
    "often": "经常", "would": "会；愿意", "must": "必须", "should": "应该",
    "yuan": "元", "love": "爱；喜爱", "welcome": "欢迎",
    "sorry": "对不起", "ok": "好的", "sure": "当然",
    # Inflections / plurals appearing in sentences
    "animals": "动物", "apples": "苹果", "books": "书", "rulers": "尺子",
    "gifts": "礼物", "vegetables": "蔬菜", "cats": "猫", "changes": "变化",
    "chickens": "鸡", "chopsticks": "筷子", "chores": "家务",
    "climbed": "爬（过去）", "clouds": "云", "cows": "奶牛",
    "dumplings": "饺子", "ears": "耳朵", "eggs": "鸡蛋", "flowers": "花",
    "friends": "朋友", "friend's": "朋友的", "father's": "爸爸的",
    "mother's": "妈妈的", "games": "游戏", "grandparents": "祖父母",
    "jobs": "工作", "leaves": "叶子", "lights": "灯",
    "mooncakes": "月饼", "pears": "梨", "pictures": "图画", "plants": "植物",
    "rules": "规则", "showers": "淋浴", "sports": "运动", "stories": "故事",
    "teeth": "牙齿", "things": "东西", "tomatoes": "西红柿", "toys": "玩具",
    "words": "单词", "feet": "脚", "shelf": "架子", "bed": "床",
    "careful": "小心的", "clean": "打扫；干净的",
    # Proper names and places
    "mike": "迈克", "wu": "吴", "binbin": "彬彬", "zhang": "张", "li": "丽",
    "chen": "陈", "jie": "杰", "peng": "鹏", "lily": "莉莉",
    "canada": "加拿大", "china": "中国", "mars": "火星", "xi'an": "西安",
    "christmas": "圣诞节", "sydney": "悉尼", "london": "伦敦",
}


def shorten(cn):
    """Keep the first sense only, so hints stay short enough for a word slot."""
    s = str(cn or "").strip()
    s = re.split(r"[；;，,、/]", s)[0].strip()
    s = re.sub(r"^[（(][^）)]*[）)]", "", s).strip()
    return s or str(cn or "").strip()


def load_books():
    books = []
    for filename in SOURCE_FILES:
        path = SOURCE_DIR / filename
        books.extend(json.loads(path.read_text(encoding="utf-8")))
    return books


def build_lexicon(books):
    lex = {}
    for book in books:
        for unit in book["units"]:
            for en, cn in unit["words"]:
                lex.setdefault(str(en).lower(), shorten(cn))
    return lex


def hint_for(token, lex, warnings, where):
    key = token.lower()
    for candidate in (key, key.rstrip("'s"), key.replace("'s", "")):
        if candidate in EXTRA:
            return EXTRA[candidate]
        if candidate in lex:
            return lex[candidate]
    # "n't" / plural / -ed fallbacks.
    for suffix, note in (("n't", "不"), ("'re", "是"), ("'ve", "已经"),
                         ("'ll", "将"), ("'d", "想"), ("'m", "是")):
        if key.endswith(suffix):
            base = key[: -len(suffix)]
            if base in lex or base in EXTRA:
                return (lex.get(base) or EXTRA.get(base)) + note
    for suffix in ("ies", "es", "s", "ed", "ing"):
        if key.endswith(suffix) and len(key) > len(suffix) + 2:
            base = key[: -len(suffix)]
            if suffix == "ies":
                base += "y"
            if suffix == "ing" and len(base) > 2 and base[-1] == base[-2]:
                base = base[:-1]
            if base in lex:
                return lex[base]
            if base in EXTRA:
                return EXTRA[base]
    warnings.append((where, token))
    return token  # always keep the hint count aligned


def validate(book, unit, sentence):
    en = str(sentence.get("en", "")).strip()
    cn = str(sentence.get("cn", "")).strip()
    if not cn or not EN_RE.match(en):
        raise ValueError(f"{book['id']} / {unit['name']}: bad sentence {sentence!r}")
    tokens = [t for t in TOKEN_RE.findall(en) if re.match(r"^[A-Za-z]", t)]
    if not 3 <= len(tokens) <= 12:
        raise ValueError(f"{book['id']} / {unit['name']}: word count {len(tokens)} in {en!r}")
    return en, cn, tokens


def main():
    books = load_books()
    lex = build_lexicon(books)
    warnings = []
    packs = []
    counts = {"packs": 0, "units": 0, "words": 0, "sentences": 0}

    for book in books:
        units = []
        seen_words = set()
        for unit in book["units"]:
            words = []
            for en, cn in unit["words"]:
                en = str(en).strip()
                if not WORD_RE.match(en):
                    raise ValueError(f"{book['id']} / {unit['name']}: bad word {en!r}")
                if en.lower() in seen_words:
                    continue
                seen_words.add(en.lower())
                words.append([en, str(cn).strip()])

            sentences = []
            for raw in unit["sentences"]:
                en, cn, tokens = validate(book, unit, raw)
                where = f"{book['id']} / {unit['name']} / {en}"
                hints = [hint_for(t, lex, warnings, where) for t in tokens]
                if len(hints) != len(tokens):
                    raise AssertionError(where)
                sentences.append({"cn": cn, "en": en, "hints": hints})
            if not words or not sentences:
                raise ValueError(f"{book['id']} / {unit['name']}: empty unit")
            units.append({"name": unit["name"], "sentences": sentences, "words": words})
            counts["words"] += len(words)
            counts["sentences"] += len(sentences)

        packs.append({
            "name": book["name"],
            "gradeId": book["gradeId"],
            "gradeName": GRADE_NAMES[book["gradeId"]],
            "bookId": BOOK_ID,
            "bookName": BOOK_NAME,
            "units": units,
        })
        counts["packs"] += 1
        counts["units"] += len(units)
        print(f"{book['id']:>3}  {len(units)} units  "
              f"{sum(len(u['words']) for u in units):>3} words  "
              f"{sum(len(u['sentences']) for u in units):>3} sentences  {book['name']}")

    stamp = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    total = {"format": "spelllab.textbook.v1", "exportedAt": stamp, "packs": packs}
    TOTAL_FILE.write_text(json.dumps(total, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    PACK_DIR.mkdir(exist_ok=True)
    for book, pack in zip(books, packs):
        one = {"format": "spelllab.textbook.v1", "exportedAt": stamp, "packs": [pack]}
        (PACK_DIR / f"pep-{book['id']}.json").write_text(
            json.dumps(one, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"\nTOTAL {counts['packs']} packs / {counts['units']} units / "
          f"{counts['words']} words / {counts['sentences']} sentences")
    if warnings:
        print(f"WARNING: {len(warnings)} tokens without a Chinese hint (English word used instead):")
        for where, token in warnings[:40]:
            print("  ", token, "|", where)
    else:
        print("All sentence words have Chinese hints.")
    print("Written:", TOTAL_FILE.name, "and", PACK_DIR.name + "/pep-*.json")
    return 1 if warnings else 0


if __name__ == "__main__":
    raise SystemExit(main())
