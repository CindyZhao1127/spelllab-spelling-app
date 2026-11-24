"""生成内置「详细释义」词典：textbooks/word-details.json。

默认练习里显示的仍是各词表自带的常用义（短）；点「详细释义」时从这份词典
取多义项 / 词性 / 专业义。来源与 build_wordbank.py 相同（qwerty-learner，MIT），
另外用本项目教材词表的中文给缺义词兜底。产物由 tools/build.py 内嵌进前端，
不写进存档，因而不占用每个孩子档案和备份体积。
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "textbooks" / "source" / "wordbank"
TEXTBOOKS = ROOT / "textbooks"
OUT = TEXTBOOKS / "word-details.json"

# 优先顺序：考试词库在前，IT/BEC 在后；同词合并去重，信息更全。
SOURCES = ["GaoKao_3500.json", "CET4_T.json", "CET6_T.json",
           "BEC_2_T.json", "BEC_3_T.json", "it-words.json"]
MARKS = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫"
MAX_LEN = 400


def clean(text):
    return re.sub(r"\s+", " ", str(text or "")).strip()


def word_key(name):
    return clean(name).lower().strip("(). ")


def fragments(text):
    """拆分一条释义里的义项片段，用于跨来源去掉重复的义项。
    括号补充说明与 n./vt. 等词性标记不参与比较，只保留真正的义项。"""
    s = re.sub(r"\([^)]*\)", "", clean(text).lower())
    s = re.sub(r"\b[a-z]+(?:\s*&\s*[a-z]+)*\.", "", s, flags=re.I)
    return {clean(x) for x in re.split(r"[，,；;、\s]+", s) if clean(x)}


def join_trans(items):
    seen, covered, parts = set(), set(), []
    for raw in items:
        s = clean(raw)
        if not s or s in seen:
            continue
        seen.add(s)
        frags = fragments(s)
        # 新来源若只是把已有义项换个说法，不再重复展示；有新义项才保留整条
        if frags and frags.issubset(covered):
            continue
        covered |= frags
        parts.append(s)
    if not parts:
        return ""
    if len(parts) == 1:
        return parts[0][:MAX_LEN]
    out = []
    for i, part in enumerate(parts[:12]):
        mark = MARKS[i] if i < len(MARKS) else str(i + 1) + "."
        out.append(mark + part)
    return "  ".join(out)[:MAX_LEN]


def main():
    collected = {}
    for name in SOURCES:
        path = SRC / name
        if not path.is_file():
            raise SystemExit("缺少释义源文件：%s" % path)
        for item in json.loads(path.read_text(encoding="utf-8")):
            key = word_key(item.get("name"))
            if not key:
                continue
            collected.setdefault(key, [])
            for trans in item.get("trans") or []:
                s = clean(trans)
                if s and s not in collected[key]:
                    collected[key].append(s)

    details = {}
    for key, parts in collected.items():
        text = join_trans(parts)
        if text:
            details[key] = text

    # 小学 / 初中等教材词在开源词库里可能没有，用教材自带中文兜底（至少能解释词义）
    fallback = 0
    for name in ["pep-sanqi-2024.json", "junior-2024.json"]:
        path = TEXTBOOKS / name
        if not path.is_file():
            continue
        for pack in json.loads(path.read_text(encoding="utf-8")).get("packs") or []:
            for unit in pack.get("units") or []:
                for word in unit.get("words") or []:
                    if not isinstance(word, list) or len(word) < 2:
                        continue
                    key = word_key(word[0])
                    cn = clean(word[1])
                    if key and cn and key not in details:
                        details[key] = cn[:MAX_LEN]
                        fallback += 1

    payload = {"format": "spelllab.worddetails.v1", "count": len(details),
               "details": dict(sorted(details.items()))}
    OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
                   encoding="utf-8")
    print("write %s: %d words (%d from textbook fallback), %.1f KB" %
          (OUT, len(details), fallback, OUT.stat().st_size / 1024))
    for sample in ["cancel", "half", "file", "apple", "nice"]:
        if sample in details:
            print("  %s -> %s" % (sample, details[sample][:80]))


if __name__ == "__main__":
    main()
