#!/usr/bin/env python3
"""从模块化源码重建单文件 SpellLab.html。

源码结构（开发时编辑这里）：
    src/shell.html     HTML 骨架 + <style>（前 1612 行部分），含两个占位标记
    src/js/*.js        按文件名排序拼接的 JS 模块（纯 JS，无 <script> 标签）

产物：项目根目录 SpellLab.html —— 浏览器直接打开 / 桌面端打包都只认这一个文件，
所以构建必须保证字节级可重现：同样源码 → 同样 HTML。

用法：
    python tools/build.py            # 重建 SpellLab.html
    python tools/build.py --check    # 只校验产物与当前源码是否一致，不写文件

注意：修改 SpellLab.html 后必须反向同步到 src/，否则下次 build 会覆盖手工改动。
推荐流程：只改 src/ 下的文件，改完跑 build.py，再跑三套 JS 测试。
"""
from __future__ import annotations

import argparse
import difflib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SHELL = ROOT / "src" / "shell.html"
JS_DIR = ROOT / "src" / "js"
OUTPUT = ROOT / "SpellLab.html"

# 源码中的占位标记，构建时替换；产物里不保留。
MARK_JS = "/* __SPELLLAB_JS_MODULES__ */"
STYLE_MARK = "/* __SPELLLAB_CSS_MODULES__ */"
# 整体词库数据由 textbooks/build_wordbank.py 生成，构建时内嵌为前端常量。
WORDBANK_DIR = ROOT / "textbooks" / "wordbank"
WORDBANK_BANKS = ["primary", "junior", "gaokao", "cet4", "cet6", "itbiz"]


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def build() -> str:
    """按 src/js/*.js 文件名顺序拼接，注入 shell 的两个占位标记。"""
    if not SHELL.is_file():
        raise SystemExit("缺少源码骨架：%s" % SHELL)
    shell = read_text(SHELL)
    def order(path: Path):
        prefix = path.name.split("-", 1)[0]
        try:
            return (0, int(prefix), path.name)
        except ValueError:
            return (1, 0, path.name)

    files = sorted([p for p in JS_DIR.glob("*.js")], key=order)
    if not files:
        raise SystemExit("src/js/ 下没有 JS 模块")

    chunks = []
    for path in files:
        text = read_text(path)
        if "</script" in text.lower():
            raise SystemExit("模块中不能出现 </script>：%s" % path.name)
        # 模块文件写入时末尾补了一个换行，这里只去掉那一个；模块自身结尾的
        # 空行是原文的一部分，必须保留，否则重组后注释块之间的空行会丢失。
        chunks.append(text[:-1] if text.endswith("\n") else text)
    js = "\n".join(chunks)

    # 内嵌整体词库：把 textbooks/wordbank/*.json 压成 WORDBANK_DATA 常量。
    # 数据模块（25-wordbank-data.js）用占位符引用，构建时替换；源码里保持小体积。
    bank_placeholder = "__SPELLLAB_WORDBANK_DATA__"
    if bank_placeholder in js:
        banks = []
        for key in WORDBANK_BANKS:
            path = WORDBANK_DIR / (key + ".json")
            if not path.is_file():
                raise SystemExit("缺少词库数据：%s（先跑 textbooks/build_wordbank.py）" % path)
            obj = json.loads(path.read_text(encoding="utf-8"))
            # 每套词库是独立的教材类别，bookId 供顶部筛选直接选中该套词库
            banks.append({"id": obj["id"], "name": obj["name"], "desc": obj.get("desc", ""),
                          "bookId": "b_wb_" + key, "words": obj["words"]})
        js = js.replace(bank_placeholder,
                        json.dumps(banks, ensure_ascii=False, separators=(",", ":")))

    # 样式目前仍在 shell 内联，CSS 模块目录存在时一并拼接。
    css_files = sorted((ROOT / "src" / "css").glob("*.css")) if (ROOT / "src" / "css").is_dir() else []
    if css_files:
        css = "\n".join(read_text(p).rstrip("\n") for p in css_files)
        shell = shell.replace(STYLE_MARK, css)
    elif STYLE_MARK in shell:
        raise SystemExit("shell 含 CSS 占位但 src/css/ 无模块")

    if MARK_JS not in shell:
        raise SystemExit("shell 缺少 JS 占位标记：" + MARK_JS)
    return shell.replace(MARK_JS, js)


def main():
    ap = argparse.ArgumentParser(description="重建 SpellLab.html 单文件产物")
    ap.add_argument("--check", action="store_true", help="只校验一致性，不写文件")
    args = ap.parse_args()

    result = build()
    if args.check:
        if not OUTPUT.is_file():
            raise SystemExit("产物不存在：" + str(OUTPUT))
        current = read_text(OUTPUT)
        if result == current:
            print("OK: SpellLab.html 与 src/ 源码一致（%d 字节）" % len(result.encode("utf-8")))
            return
        diff = list(difflib.unified_diff(
            current.splitlines(True), result.splitlines(True),
            fromfile="SpellLab.html (current)", tofile="SpellLab.html (from src)"))
        sys.stderr.write("FAIL: 源码重建结果与产物不一致，前 40 行差异：\n")
        sys.stderr.writelines(diff[:40])
        raise SystemExit(1)

    OUTPUT.write_text(result, encoding="utf-8", newline="\n")
    print("Built %s (%d bytes, %d modules)" % (
        OUTPUT, len(result.encode("utf-8")), len(list(JS_DIR.glob("*.js")))))


if __name__ == "__main__":
    main()
