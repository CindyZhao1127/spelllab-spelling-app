#!/usr/bin/env python3
"""Build spelllab.textbook.v1 packs for the 2024 PEP junior-high textbooks.

Source: textbooks/source/pep_junior.json (same layout as the primary-school
sources). Reuses build.py's hint / validation logic so the packs import into
SpellLab exactly like the existing primary-school ones.

Writes:
    textbooks/junior-2024.json      all 6 books in one file
    textbooks/packs/pep-7a.json     one file per book (7a..9b)

Run from anywhere:
    .venv/Scripts/python.exe textbooks/build_junior.py
"""

import json
from datetime import datetime, timezone
from pathlib import Path

# Reuse the validated helpers, regexes and function-word dictionary of build.py.
from build import (EXTRA, TOKEN_RE, WORD_RE, build_lexicon, hint_for,
                   shorten, validate)

ROOT = Path(__file__).resolve().parent
SOURCE_DIR = ROOT / "source"
PACK_DIR = ROOT / "packs"
TOTAL_FILE = ROOT / "junior-2024.json"
SOURCE_FILE = "pep_junior.json"

GRADE_NAMES = {
    "g7": "初中七年级",
    "g8": "初中八年级",
    "g9": "初中九年级",
}
BOOK_ID = "b_pep_junior"
BOOK_NAME = "人教版初中英语（2024修订版）"

# Function words, inflections, contractions and proper names used by the junior
# sentences but not present in any unit word list. Keep hints short (1st sense).
JUNIOR_EXTRA = {
    "actions": "行动", "after": "在……之后", "ago": "以前", "ask": "问；请求",
    "because": "因为", "before": "在……以前", "beijing": "北京",
    "better": "更好的", "built": "建造（过去式）", "by": "通过；被；在……旁",
    "can": "能；可以", "cannot": "不能", "changed": "改变",
    "children": "孩子们", "classroom": "教室", "colourful": "多彩的",
    "doing": "做（进行时）", "donating": "捐赠（进行时）", "during": "在……期间",
    "easier": "更容易的", "eat": "吃", "eats": "吃（第三人称单数）",
    "eight": "八", "emma": "艾玛", "english": "英语", "every": "每个；每一",
    "everywhere": "到处", "far": "远的；远", "fast": "快地；快的",
    "favourite": "最喜欢的", "forms": "形式", "graduating": "毕业（进行时）",
    "had": "有（过去式）", "happily": "开心地", "has": "有", "have": "有",
    "having": "有；吃（进行时）", "hours": "小时", "into": "进入；到……里",
    "junk": "垃圾（食品）", "last": "上一个的；最后的", "learners": "学习者",
    "like": "喜欢；像", "lisa": "莉萨", "lived": "居住（过去式）",
    "longer": "更长的", "me": "我（宾格）", "money": "钱", "myself": "我自己",
    "night": "夜晚", "not": "不", "notes": "笔记", "nothing": "没有什么",
    "o'clock": "……点钟", "out": "出去；外出", "part": "部分",
    "play": "玩；打（球）；演奏", "plays": "玩；演奏", "pop": "流行的",
    "powerful": "强大的", "rubbish": "垃圾", "run": "跑",
    "saving": "节约；拯救（进行时）", "send": "发送；邮寄",
    "sister": "姐；妹", "sit": "坐", "small": "小的", "some": "一些",
    "spring": "春天", "subject": "学科；科目", "summer": "夏天",
    "taken": "拿；带（过去分词）", "taking": "拿；拍（进行时）",
    "tall": "高的", "teamwork": "团队合作", "telephone": "电话",
    "ten": "十", "than": "比", "took": "拿；拍（过去式）",
    "uniform": "校服；制服", "us": "我们（宾格）", "want": "想要",
    "watching": "观看", "ways": "方式；方法", "wear": "穿；戴",
    "week": "星期；周", "wider": "更宽的", "will": "将；会",
    "won": "赢（过去式）", "writes": "写（第三人称单数）",
    # Common words that may appear when the source is edited later.
    "action": "行动", "note": "笔记", "learner": "学习者",
    "form": "形式", "part": "部分", "poor": "贫穷的",
}
EXTRA.update(JUNIOR_EXTRA)


def load_books():
    path = SOURCE_DIR / SOURCE_FILE
    return json.loads(path.read_text(encoding="utf-8"))


def main():
    books = load_books()
    lex = build_lexicon(books)
    # The practice sentences are hand-written, so some of their words are no
    # longer in the (now authentic) unit word lists. Keep their Chinese hints
    # from the previous lists without overriding the new textbook senses.
    hints_path = SOURCE_DIR / "junior_hints.json"
    if hints_path.exists():
        for key, sense in json.loads(hints_path.read_text(encoding="utf-8")).items():
            if key not in lex:
                EXTRA.setdefault(key, sense)
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
    print("Written:", TOTAL_FILE.name, "and", PACK_DIR.name + "/pep-{7a..9b}.json")
    return 1 if warnings else 0


if __name__ == "__main__":
    raise SystemExit(main())
