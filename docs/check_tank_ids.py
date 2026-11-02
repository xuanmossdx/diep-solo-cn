# -*- coding: utf-8 -*-
import re, json, io

enums = io.open(r"d:/aaa/diep-solo-cn/game/diepcustom/src/Const/Enums.ts", encoding="utf-8").read()
m = re.search(r"export const enum Tank \{(.*?)\}", enums, re.S)
pairs = re.findall(r"(\w+)\s*=\s*(\d+)", m.group(1))
enum_by_id = {int(v): k for k, v in pairs}

data = json.load(open(r"d:/aaa/diep-solo-cn/game/diepcustom/src/Const/TankDefinitions.json", encoding="utf-8"))
mismatch = 0
for e in data:
    if not e or e.get("id") is None:
        continue
    tid = e["id"]
    ename = enum_by_id.get(tid)
    if ename != e["name"]:
        print("MISMATCH id=", tid, "json=", repr(e["name"]), "enum=", ename)
        mismatch += 1
print("checked", len(data), "entries, mismatches:", mismatch)
