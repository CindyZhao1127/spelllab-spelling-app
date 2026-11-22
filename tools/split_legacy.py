#!/usr/bin/env python3
"""一次性迁移工具：把旧的单文件 SpellLab.html 切成 src/ 模块化源码。

切割边界全部是 js 顶层的注释行/函数起始行（见 BOUNDARIES），不会切断函数体。
切完立即用 tools/build.py 的逻辑在内存中重组，必须与原始 HTML 字节一致，
确保「模块化」这一步本身零行为变化。

仅在源码尚未模块化时运行；已有 src/js/*.js 时默认拒绝覆盖。
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "SpellLab.html"
JS_DIR = ROOT / "src" / "js"
SHELL = ROOT / "src" / "shell.html"

MARK_JS = "/* __SPELLLAB_JS_MODULES__ */"

# (模块文件名, 起始行号 1-based，闭区间)。每个起始行都是顶层注释或顶层函数，
# 结束行由下一项的起始行减一决定，最后一项到 script 结束。
BOUNDARIES = [
    ("00-header.js", 2653),
    ("10-icons.js", 2659),
    ("20-builtin-bank.js", 2684),
    ("30-grades.js", 2731),
    ("40-defaults.js", 2871),
    ("50-phonics-course.js", 2886),
    ("60-phonics-rules.js", 2972),
    ("70-parent-crypto.js", 3200),
    ("80-state.js", 3230),
    ("90-db-layer.js", 3266),
    ("100-desktop-api.js", 3280),
    ("110-grammar-bank.js", 3329),
    ("120-state-normalize.js", 3372),
    ("130-storage-write.js", 3544),
    ("140-unit-scope.js", 3822),
    ("150-utils-audio.js", 3923),
    ("160-render-top.js", 4014),
    ("170-spell-board.js", 4131),
    ("180-memory-mode.js", 4446),
    ("190-word-mode.js", 4602),
    ("200-grade-manage.js", 4731),
    ("210-vocab.js", 4810),
    ("220-vocab-practice.js", 4916),
    ("230-textbook-lib.js", 4982),
    ("240-storage-page.js", 5374),
    ("250-speed-best.js", 5629),
    ("260-history.js", 5663),
    ("270-modal.js", 5744),
    ("280-difficulty-timer.js", 5790),
    ("290-vocab-auto.js", 5845),
    ("300-grammar-practice.js", 5869),
    ("310-points-plan.js", 6045),
    ("320-parent-center.js", 6130),
    ("330-wheel-state.js", 6196),
    ("340-lottery.js", 6418),
    ("350-unit-next.js", 6581),
    ("360-session.js", 6602),
    ("370-phonics.js", 6676),
    ("380-phonics-slots.js", 6848),
    ("390-study-panel.js", 7052),
    ("400-custom-bank.js", 7135),
    ("410-events.js", 7166),
    ("420-growth.js", 7801),
    ("430-dictation.js", 7893),
    ("440-paper-dictation.js", 7949),
    ("450-map.js", 8053),
    ("460-stats.js", 8078),
    ("470-boot.js", 8139),
    ("480-typing-duck.js", 8169),
]

SCRIPT_OPEN = 2652
SCRIPT_CLOSE = 9740  # 该行内容 </script>


def main():
    raw = HTML.read_text(encoding="utf-8")
    lines = raw.split("\n")
    if lines[SCRIPT_OPEN - 1].strip() != "<script>":
        raise SystemExit("行号漂移：<script> 不在第 %d 行" % SCRIPT_OPEN)
    if lines[SCRIPT_CLOSE - 1].strip() != "</script>":
        raise SystemExit("行号漂移：</script> 不在第 %d 行" % SCRIPT_CLOSE)
    if list(JS_DIR.glob("*.js")) and "--force" not in sys.argv:
        raise SystemExit("src/js/ 已有模块，默认不覆盖；确认要重建请加 --force")

    first = BOUNDARIES[0][1]
    last_end = SCRIPT_CLOSE - 1  # 脚本最后一行（空行）归入最后一个模块
    shell = "\n".join(lines[:SCRIPT_OPEN - 1] + ["<script>", MARK_JS] + lines[SCRIPT_CLOSE - 1:])
    js_body = "\n".join(lines[first - 1:last_end])

    JS_DIR.mkdir(parents=True, exist_ok=True)
    for old in JS_DIR.glob("*.js"):
        old.unlink()

    total = []
    for idx, (name, start) in enumerate(BOUNDARIES):
        end = BOUNDARIES[idx + 1][1] - 1 if idx + 1 < len(BOUNDARIES) else last_end
        chunk = "\n".join(lines[start - 1:end])
        (JS_DIR / name).write_text(chunk + "\n", encoding="utf-8", newline="\n")
        total.append(chunk)
        print("  %-32s lines %5d-%-5d" % (name, start, end))

    SHELL.write_text(shell, encoding="utf-8", newline="\n")

    # 内存重组校验：必须与原 HTML 完全一致
    rebuilt = shell.replace(MARK_JS, "\n".join(total))
    if rebuilt != raw:
        raise SystemExit("FAIL: 切分后重组与原文件不一致，未提交改动")
    print("OK: 已切出 %d 个模块，重组字节数与原文一致（%d）" % (
        len(BOUNDARIES), len(raw.encode("utf-8"))))


if __name__ == "__main__":
    main()
