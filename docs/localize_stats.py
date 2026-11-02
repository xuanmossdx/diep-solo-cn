# -*- coding: utf-8 -*-
"""TankDefinitions.json 加点名汉化（stats[].name），走协议同步到客户端，安全。"""
import json, io

PATH = r"d:/aaa/diep-solo-cn/game/diepcustom/src/Const/TankDefinitions.json"
STAT_ZH = {
    "Movement Speed": "移动速度",
    "Reload": "装填",
    "Bullet Damage": "子弹伤害",
    "Bullet Penetration": "穿透",
    "Bullet Speed": "子弹速度",
    "Body Damage": "身体伤害",
    "Max Health": "生命上限",
    "Health Regen": "生命恢复",
}

data = json.load(open(PATH, encoding="utf-8"))
count = 0
for entry in data:
    if not entry or "stats" not in entry:
        continue
    for stat in entry["stats"]:
        if stat["name"] in STAT_ZH:
            stat["name"] = STAT_ZH[stat["name"]]
            count += 1

io.open(PATH, "w", encoding="utf-8").write(json.dumps(data, ensure_ascii=False, separators=(",", ":")))
print("renamed stats:", count)
