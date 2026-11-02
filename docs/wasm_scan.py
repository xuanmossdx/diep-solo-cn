# -*- coding: utf-8 -*-
"""扫描 WASM 二进制中的可见英文 UI 字符串，确认可替换性（替换长度必须 <= 原长度）"""
import re

data = open(r"d:/aaa/diep-solo-cn/game/diepcustom/client/build_patched.wasm", "rb").read()

# 候选：可见 UI 短语（ASCII 连续 4+ 可打印字符、且出现在数据段）
targets = [
    b"Score:", b"Lv.", b"players", b"diep.io", b"You were killed by",
    b"Game mode", b"Scoreboard", b"killed by", b"This is the tale of",
    b"What is your name", b"Achievement", b"Level", b"Suicide?", b"Fullscreen",
    b"Quality", b"Graph", b"Physics", b"Auto", b"press ENTER",
    b"Press ENTER", b"ENTER", b"Continue", b"Respawn", b"Level Up",
]

for t in targets:
    idxs = [m.start() for m in re.finditer(re.escape(t), data)]
    if idxs:
        # 显示上下文
        ctx = data[idxs[0]-8:idxs[0]+len(t)+24]
        printable = "".join(chr(c) if 32 <= c < 127 else "." for c in ctx)
        print(f"{t.decode():28s} x{len(idxs):2d}  ctx: {printable}")
    else:
        print(f"{t.decode():28s}  NOT FOUND")
