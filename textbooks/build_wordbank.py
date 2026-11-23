#!/usr/bin/env python3
"""生成「整体词库」数据：小学 / 初中 / 高考 / 四级 / 六级 / IT商务。

数据来源：
- 小学 / 初中：本项目已有教材包（pep-sanqi-2024.json / junior-2024.json）里的 words，
  按英文去重汇总，就是教材覆盖的全部单词。
- 高考 / 四级 / 六级 / IT / 商务：qwerty-learner 开源词库（MIT），
  https://github.com/2778354388/qwerty-learner ，经 jsDelivr CDN 下载原始 JSON，
  清洗为 [英文, 中文] 二元组。原始文件放在 source/wordbank/ 下便于复现。

输出：textbooks/wordbank/*.json —— spelllab.wordbank.v1 格式，被 tools/build.py
内嵌进前端常量 WORDBANK_DATA，用户无需手动导入。

清洗规则：
- 名称只保留 /^[A-Za-z][A-Za-z'-]*$/ 且长度 >= 2 的单个单词（去掉词组、缩写、带括号条目）。
- 中文取首个义项，去掉 "n./v./adj." 等词性前缀与括号音标，截断到 22 字以内。
- 按小写英文去重，保留首次出现的释义。
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WB = ROOT / "textbooks" / "wordbank"
SRC = ROOT / "textbooks" / "source" / "wordbank"
TMP = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(
    "C:/Users/zhaoj/AppData/Local/Temp"
)

NAME_RE = re.compile(r"^[A-Za-z][A-Za-z'-]*$")
POS_RE = re.compile(r"^\s*(?:n|v|vt|vi|adj|adv|art|prep|conj|pron|num|int|a|ad)\s*[.．、:：]\s*", re.I)
POS_MID_RE = re.compile(r"\s*(?:n|v|vt|vi|adj|adv|art|prep|conj|pron|num|int|a|ad)\s*[.．]\s*$", re.I)
BRACKET_RE = re.compile(r"[（(][^）)]*[）)]")


def clean_cn(raw) -> str:
    if isinstance(raw, (list, tuple)):
        raw = "；".join(str(x) for x in raw if x)
    s = str(raw or "").strip()
    s = BRACKET_RE.sub("", s)
    s = re.sub(r"\s+", " ", s)
    # 优先按分号切，取首个义项；it-words 用逗号分隔且义项冗长，
    # 这种在后面按逗号再截一次，只留前两个短义项。
    parts = [p.strip() for p in re.split(r"[；;]", s) if p.strip()]
    s = parts[0] if parts else s
    s = POS_RE.sub("", s)
    if len(s) > 16 and s.count(",") >= 2:
        frag = [p.strip() for p in s.split(",") if p.strip()]
        kept, total = [], 0
        for p in frag:
            if total + len(p) > 18:
                break
            kept.append(p)
            total += len(p)
        s = "，".join(kept)
    s = re.sub(r"\s*(?:vt|vi|v|n|adj|adv|a|ad)\s*[.．]$", "", s)
    s = s.strip(" ：:；;，,。. ")
    if s and not re.search(r"[\u4e00-\u9fff]", s):
        return ""
    return s[:22]


def clean_word(raw) -> str:
    w = str(raw or "").strip()
    return w if len(w) >= 2 and NAME_RE.match(w) else ""


def dedupe(pairs) -> list[list[str]]:
    seen: set[str] = set()
    out: list[list[str]] = []
    for w, cn in pairs:
        key = w.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append([w, cn])
    return out


def from_third_party(filename: str) -> list[list[str]]:
    path = TMP / filename
    if not path.is_file():
        path = SRC / filename
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, dict):
        data = data.get("words") or next(iter(data.values()))
    out = []
    for item in data:
        w = clean_word(item.get("name"))
        cn = clean_cn(item.get("trans"))
        if w and cn:
            out.append([w, cn])
    return out


def from_textbooks(filename: str) -> list[list[str]]:
    data = json.loads((ROOT / "textbooks" / filename).read_text(encoding="utf-8"))
    out = []
    for pack in data.get("packs", []):
        for unit in pack.get("units", []):
            for w in unit.get("words", []):
                if isinstance(w, (list, tuple)) and len(w) >= 2:
                    en = clean_word(w[0])
                    cn = clean_cn(w[1])
                    if en and cn:
                        out.append([en, cn])
    return out


def main():
    WB.mkdir(parents=True, exist_ok=True)
    groups = [
        ("primary", "小学词汇大全", "小学教材全部单词的汇总，不分册按掌握度循环练习",
         lambda: from_textbooks("pep-sanqi-2024.json")),
        ("junior", "初中词汇大全", "初中教材全部单词的汇总，覆盖七上到九下",
         lambda: from_textbooks("junior-2024.json")),
        ("gaokao", "高考3500词", "高考核心词汇，覆盖高中阶段（qwerty-learner 开源词库）",
         lambda: from_third_party("GaoKao_3500.json")),
        ("cet4", "大学英语四级", "CET-4 大纲词汇（qwerty-learner 开源词库）",
         lambda: from_third_party("CET4_T.json")),
        ("cet6", "大学英语六级", "CET-6 大纲词汇（qwerty-learner 开源词库）",
         lambda: from_third_party("CET6_T.json")),
        ("itbiz", "IT与商务英语", "IT 技术词 + BEC 剑桥商务英语，适合外企与IT公司职场沟通",
         lambda: (from_third_party("it-words.json")
                  + from_third_party("BEC_2_T.json")
                  + from_third_party("BEC_3_T.json"))),
    ]
    manifest = []
    for key, name, desc, loader in groups:
        pairs = dedupe(loader())
        obj = {
            "id": "wb_" + key,
            "name": name,
            "desc": desc,
            "count": len(pairs),
            "words": pairs,
        }
        path = WB / (key + ".json")
        path.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")),
                        encoding="utf-8", newline="\n")
        manifest.append({"id": obj["id"], "name": name, "file": "wordbank/" + key + ".json",
                         "count": len(pairs)})
        print("%-10s %5d words  %s" % (key, len(pairs), path.name))
    (WB / "manifest.json").write_text(
        json.dumps({"format": "spelllab.wordbank.v1", "source": "qwerty-learner (MIT) + SpellLab textbooks",
                    "banks": manifest}, ensure_ascii=False, indent=2),
        encoding="utf-8", newline="\n")
    print("manifest ->", WB / "manifest.json")


if __name__ == "__main__":
    main()
