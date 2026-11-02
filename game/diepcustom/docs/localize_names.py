# -*- coding: utf-8 -*-
"""
坦克大乱斗 · 坦克名/升级提示/成就 汉化脚本
把 TankDefinitions.json 的 name/upgradeMessage 与 Achievements.json 的 name/desc
替换为中文（与 client/overlay/overlay.js 图鉴 ZH 映射保持一致）。
运行：python docs/localize_names.py
"""
import json
import io
import os

ROOT = os.path.join(os.path.dirname(__file__), "..", "src", "Const")

# id -> 中文名（与 overlay.js ZH 一致）
TANK_ZH = {
    0: "基础坦克", 1: "双管炮", 2: "三联炮", 3: "三重炮", 4: "四联坦克", 5: "八爪坦克",
    6: "狙击炮", 7: "机关枪", 8: "侧卫", 9: "三角艇", 10: "毁灭者", 11: "监督者",
    12: "霸主", 13: "双侧卫", 14: "五重炮", 15: "刺客", 16: "清场者", 17: "死灵法师",
    18: "三重双子", 19: "猎人", 20: "机枪手", 21: "潜行者", 22: "游侠", 23: "加速器",
    24: "战斗机", 25: "混合体", 26: "经理", 27: "母舰", 28: "掠夺者", 29: "喷射器",
    31: "陷阱手", 32: "陷阱机枪手", 33: "陷阱霸主", 34: "巨型陷阱手", 35: "三重陷阱手",
    36: "粉碎者", 38: "地雷", 39: "自动机枪手", 40: "自动五型", 41: "自动三型",
    42: "散射炮", 43: "水管炮", 44: "自动陷阱手", 45: "统治者", 46: "统治者", 47: "统治者",
    48: "战列舰", 49: "湮灭者", 50: "自动粉碎者", 51: "尖刺", 52: "工厂", 54: "跳弹炮", 55: "火箭兵",
}

UPGRADE_MSG_ZH = {
    "Use your left mouse button to control the drones": "用鼠标左键（或右半屏）操控你的无人机",
    "Use your right mouse button to look further in the direction you're facing":
        "用鼠标右键朝准星方向拉远视野",
}

# 成就汉化（按索引）
ACH_ZH = [
    ("值得珍藏的一刻", "击毁你的第一辆坦克"),
    ("练练吧", "击毁 10 辆坦克"),
    ("越练越强", "击毁 100 辆坦克"),
    ("真的变强了", "击毁 1000 辆坦克"),
    ("初出茅庐", "击毁任意东西"),
    ("渐入佳境", "击毁 500 个目标"),
    ("清空全场", "击毁 10000 个目标"),
    ("总得有个开始", "击毁 10 个方块"),
    ("方块讨厌者", "击毁 500 个方块"),
    ("方块必须消失", "击毁 10000 个方块"),
    ("碰一下好痛", "撞击任意东西"),
    ("谁还需要子弹", "撞击 100 个目标"),
    ("妈你看，不用炮管！", "撞击 3000 个目标"),
    ("它不算真坦克", "击毁 100 架工厂无人机"),
    ("飞毛腿", "把移动速度升到满级"),
    ("哒哒哒哒哒哒", "把装填升到满级"),
    ("看着弱其实很强", "把子弹伤害升到满级"),
    ("势不可挡！", "把子弹穿透升到满级"),
    ("四倍音速", "把子弹速度升到满级"),
    ("别碰我", "把身体伤害升到满级"),
    ("坚不可摧", "把生命上限升到满级"),
    ("自我修复", "把生命恢复升到满级"),
    ("火力压制", "升级为双管炮"),
    ("吃我一梭子弹", "升级为机关枪"),
    ("一击必杀", "升级为狙击炮"),
    ("没人能偷袭我", "升级为侧卫"),
    ("三箭齐发", "升级为三重炮"),
    ("我赶时间", "升级为三角艇"),
    ("轰，你死了", "升级为毁灭者"),
    ("无人机之爱", "升级为监督者"),
    ("C + E", "升级为四联坦克"),
    ("这下真没人能偷袭我了", "升级为双侧卫"),
    ("随便填个成就名吧", "升级为刺客"),
    ("狩猎时间", "升级为猎人"),
    ("吃我一串弹丸！", "升级为机枪手"),
    ("修一堵墙", "升级为陷阱手"),
    ("单手也能玩？", "升级为自动三型"),
    ("我的炮管去哪了？", "升级为粉碎者"),
    ("换别的坦克也试试", "升级为狙击炮 100 次"),
    ("无人机即人生", "升级为监督者 100 次"),
    ("这可不容易", "击杀一名 Boss"),
    ("Boss 猎人", "击杀 10 名 Boss"),
    ("还行，你在努力", "达到 1000 分"),
    ("开始上道了", "达到 10000 分"),
    ("你没那么菜", "达到 100000 分"),
    ("你还挺厉害的", "达到 1000000 分"),
    ("头奖！", "单次击杀获得 20000 分"),
    ("卡卡卡卡卡", "在延迟超过 1000ms 的状态下进行游戏"),
    ("闪闪发光！", "???"),
    ("居然还有别的坦克？", "用基础坦克升到 45 级"),
]


def localize_tanks():
    path = os.path.join(ROOT, "TankDefinitions.json")
    with io.open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    changed = 0
    for tank in data:
        if not tank:
            continue
        tid = tank.get("id")
        zh = TANK_ZH.get(tid)
        if zh and tank.get("name") != zh:
            tank["name"] = zh
            changed += 1
        msg = tank.get("upgradeMessage")
        if msg and msg in UPGRADE_MSG_ZH:
            tank["upgradeMessage"] = UPGRADE_MSG_ZH[msg]
            changed += 1
    with io.open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    print(f"[tanks] {changed} fields localized -> {path}")


def localize_achievements():
    path = os.path.join(ROOT, "Achievements.json")
    with io.open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    assert len(data) == len(ACH_ZH), f"achievement count mismatch: {len(data)} vs {len(ACH_ZH)}"
    for i, (name, desc) in enumerate(ACH_ZH):
        data[i]["name"] = name
        data[i]["desc"] = desc
    with io.open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    print(f"[achievements] {len(data)} entries localized -> {path}")


if __name__ == "__main__":
    localize_tanks()
    localize_achievements()
