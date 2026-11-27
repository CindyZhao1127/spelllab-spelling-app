"""生成内置英美音标词典：textbooks/word-phonetics.json。

来源与 build_word_details.py 相同（qwerty-learner，MIT 授权）：原始词库每条带
usphone / ukphone。这里按单词取一份英美音标，优先考试词库，去掉重复变体。
产物由 tools/build.py 内嵌进单文件 HTML，不写进存档，备份体积不变；
练习卡片上默认显示音标提示，跟随「朗读口音」选英式或美式，缺哪套回退另一套。
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "textbooks" / "source" / "wordbank"
OUT = ROOT / "textbooks" / "word-phonetics.json"

# 与详细释义一致：考试词库在前，同词先取到的数据优先。
SOURCES = ["GaoKao_3500.json", "CET4_T.json", "CET6_T.json",
           "BEC_2_T.json", "BEC_3_T.json", "it-words.json"]


def clean(value):
    """取第一个音标变体；原始词里偶尔带 ';' 分隔的美英多个读法。"""
    text = str(value or "").strip()
    return text.split(";")[0].strip()


def main():
    phones = {}
    for name in SOURCES:
        path = SRC / name
        if not path.is_file():
            raise SystemExit("缺少音标源文件：%s" % path)
        for item in json.loads(path.read_text(encoding="utf-8")):
            key = str(item.get("name", "")).strip().lower().strip("(). ")
            if not key:
                continue
            rec = phones.setdefault(key, {})
            for src_key, dst_key in (("usphone", "us"), ("ukphone", "uk")):
                if not rec.get(dst_key):
                    value = clean(item.get(src_key))
                    if value:
                        rec[dst_key] = value

    payload = {"format": "spelllab.phonetics.v1", "count": len(phones),
               "phones": dict(sorted(phones.items()))}
    OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
                   encoding="utf-8")
    has_uk = sum(1 for v in phones.values() if v.get("uk"))
    has_us = sum(1 for v in phones.values() if v.get("us"))
    print("write %s: %d words (uk %d / us %d), %.1f KB" %
          (OUT, len(phones), has_uk, has_us, OUT.stat().st_size / 1024))
    for sample in ["cancel", "beautiful", "apple", "nice"]:
        if sample in phones:
            print("  %s -> %s" % (sample, phones[sample]))


if __name__ == "__main__":
    main()
