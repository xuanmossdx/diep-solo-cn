# -*- coding: utf-8 -*-
"""测量 WASM 内嵌成就 JSON 位置与中文替换可行性（v2：括号平衡找结尾）"""
import json
import io
import os

WASM = os.path.join(os.path.dirname(__file__), "..", "client", "build_patched.wasm")
ACH = os.path.join(os.path.dirname(__file__), "..", "src", "Const", "Achievements.json")

data = open(WASM, "rb").read()
start_marker = b'[{"name":"A moment to cherish forever"'
i = data.find(start_marker)

# 括号平衡扫描（考虑字符串与转义）
depth = 0
in_str = False
esc = False
end = -1
for k in range(i, min(i + 20000, len(data))):
    c = data[k]
    if in_str:
        if esc:
            esc = False
        elif c == 0x5C:
            esc = True
        elif c == 0x22:
            in_str = False
        continue
    if c == 0x22:
        in_str = True
    elif c == 0x5B:
        depth += 1
    elif c == 0x5D:
        depth -= 1
        if depth == 0:
            end = k + 1
            break

print("start:", i, "end:", end, "en_bytes:", end - i)
blob = data[i:end]
print("tail:", blob[-60:])
print("after:", data[end:end + 24])

with io.open(ACH, "r", encoding="utf-8") as f:
    zh = json.load(f)
zj = json.dumps(zh, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
print("zh_bytes:", len(zj), "fits:", len(zj) <= end - i)
