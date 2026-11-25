#!/usr/bin/env python3
"""Build the SpellLab pack for 北师大版(2024) 七年级上册.

Source: textbooks/source/bsd_7a.json — word lists from the public 2024 BNU
vocabulary transcriptions, example sentences written for SpellLab practice.
Reuses build.py's hint / validation logic so the pack imports exactly like
the existing primary and PEP junior packs.

Writes:
    textbooks/bsd-7a.json          all-in-one import file
    textbooks/packs/bsd-7a.json    same pack, per-book import file

Run from anywhere:
    .venv/Scripts/python.exe textbooks/build_bsd7a.py
"""

import json
from datetime import datetime, timezone
from pathlib import Path

from build import EXTRA, TOKEN_RE, WORD_RE, build_lexicon, hint_for, shorten, validate

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "source" / "bsd_7a.json"
TOTAL = ROOT / "bsd-7a.json"
PACK = ROOT / "packs" / "bsd-7a.json"

BOOK_ID = "b_bsd"
BOOK_NAME = "北师大版初中英语（2024新版）"
GRADE_NAME = "初中七年级"

# Function words used by the practice sentences but not in the unit word lists.
BSD_EXTRA = {
    "a": "一个", "about": "关于", "after": "在……之后", "all": "全部", "am": "是",
    "and": "和；并且", "are": "是", "as": "作为；像", "at": "在", "be": "是；成为",
    "behind": "在……后面", "before": "在……以前", "between": "在……之间",
    "both": "两者都", "but": "但是", "can": "能；会", "come": "来", "day": "天；日子", "do": "做",
    "does": "做（第三人称单数）", "doing": "做", "each": "每个", "English": "英语",
    "every": "每个", "favourite": "最喜欢的", "for": "为了；给", "from": "从；来自",
    "girls": "女孩们",
    "go": "去", "hard": "努力地", "has": "有", "have": "有", "he": "他",
    "help": "帮助", "helps": "帮助（第三人称单数）", "her": "她的", "here": "这里",
    "him": "他（宾格）", "his": "他的", "homework": "家庭作业", "how": "怎样",
    "I": "我", "if": "如果", "important": "重要的", "in": "在……里", "is": "是",
    "it": "它", "its": "它的", "left": "左边；向左", "like": "喜欢；像",
    "look": "看；看起来", "make": "制作；使", "makes": "使；制作", "me": "我（宾格）",
    "meet": "遇见", "music": "音乐", "my": "我的", "near": "在……附近",
    "need": "需要", "next": "旁边；下一个", "nice": "好的；令人愉快的", "not": "不",
    "now": "现在", "of": "……的", "often": "经常", "on": "在……上", "one": "一",
    "or": "或者",
    "our": "我们的", "others": "其他人", "out": "出去", "outside": "在外面",
    "over": "超过；在上方", "own": "自己的", "play": "玩；打；演奏", "playing": "玩；演奏",
    "pleased": "高兴的", "right": "右边；向右",     "school": "学校", "science": "科学", "see": "看见", "she": "她",
    "so": "所以", "some": "一些", "spend": "花费；度过", "study": "学习",
    "subject": "科目", "such": "这样的", "swim": "游泳", "take": "拿；带",
    "than": "比", "that": "那个",
    "the": "这（那）个", "their": "他们的", "them": "他们（宾格）", "then": "然后",
    "there": "在那里；there be 有", "these": "这些", "they": "他们",
    "this": "这个", "time": "时间", "to": "到；向", "too": "也；太",
    "try": "尝试", "trying": "尝试", "turn": "转；转动", "two": "二", "under": "在……下面",
    "up": "向上", "us": "我们（宾格）", "use": "使用", "very": "非常",
    "want": "想要", "wants": "想要（第三人称单数）", "was": "是（过去式）",
    "we": "我们", "well": "好地", "were": "是（过去式）", "what": "什么",
    "when": "什么时候", "where": "在哪里", "which": "哪一个", "who": "谁",
    "why": "为什么", "will": "将；会", "with": "和；带有", "work": "工作；奏效",
    "would": "将；会（委婉）", "you": "你；你们", "your": "你的；你们的",
    "Canada": "加拿大", "China": "中国",
}
# hint_for() lowercases tokens; keep both cases available.
for key, value in list(BSD_EXTRA.items()):
    BSD_EXTRA.setdefault(key.lower(), value)
EXTRA.update(BSD_EXTRA)


def main():
    books = json.loads(SOURCE.read_text(encoding="utf-8"))
    book = books[0] if isinstance(books, list) else books
    lex = build_lexicon([book])
    warnings = []
    units = []
    seen = set()
    total_words = total_sentences = 0

    for unit in book["units"]:
        words = []
        for en, cn in unit["words"]:
            en = str(en).strip()
            if not WORD_RE.match(en):
                raise ValueError(f"{unit['name']}: bad word {en!r}")
            if en.lower() in seen:
                continue
            seen.add(en.lower())
            words.append([en, shorten(str(cn).strip())])

        sentences = []
        for raw in unit["sentences"]:
            en, cn, tokens = validate(book, unit, raw)
            hints = [hint_for(t, lex, warnings, f"{unit['name']} / {en}") for t in tokens]
            if len(hints) != len(tokens):
                raise AssertionError(en)
            sentences.append({"cn": cn, "en": en, "hints": hints})

        if not words or not sentences:
            raise ValueError(f"{unit['name']}: empty unit")
        units.append({"name": unit["name"], "sentences": sentences, "words": words})
        total_words += len(words)
        total_sentences += len(sentences)
        print(f"{unit['name']:<32} {len(words):>3} words  {len(sentences):>2} sentences")

    if warnings:
        print("Missing hints (fallback to the token itself):")
        for where, token in warnings[:30]:
            print("  " + where + " -> " + token)

    stamp = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    pack = {
        "name": book["name"],
        "gradeId": book["gradeId"],
        "gradeName": GRADE_NAME,
        "bookId": BOOK_ID,
        "bookName": BOOK_NAME,
        "units": units,
    }
    data = {"format": "spelllab.textbook.v1", "exportedAt": stamp, "packs": [pack]}
    text = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    TOTAL.write_text(text, encoding="utf-8")
    PACK.write_text(text, encoding="utf-8")
    print(f"{len(units)} units / {total_words} words / {total_sentences} sentences -> {TOTAL.name}")


if __name__ == "__main__":
    main()
