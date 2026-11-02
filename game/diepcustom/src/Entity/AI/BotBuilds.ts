/*
    DiepCustom - custom tank game server that shares diep.io's WebSocket protocol
    Copyright (C) 2022 ABCxFF (github.com/ABCxFF)

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published
    by the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program. If not, see <https://www.gnu.org/licenses/>
*/

import { Stat, Tank } from "../../Const/Enums";

/** 进化链节点：达到 level 后可进化为 tanks 之一（随机取，全部来自 TankDefinitions.json 真实树） */
export interface BuildChainNode {
    level: number;
    tanks: Tank[];
}

/** 流派定义：决定 bot 的进化路线、加点倾向与行为参数 */
export interface FlowDef {
    key: "assault" | "kite" | "trap" | "drone" | "ram";
    label: string;
    weight: number;
    chain: BuildChainNode[];
    /** 加点优先级（从前往后） */
    statPriority: Stat[];
    /** 理想射程带（卡距离） */
    minDist: number;
    maxDist: number;
    special: "none" | "trap" | "drone" | "ram";
}

/** 难度档定义：与流派独立抽取 */
export interface DiffDef {
    key: "easy" | "normal" | "hard";
    label: string;
    weight: number;
    /** 每 N tick 决策一次 */
    decisionInterval: number;
    /** 瞄准抖动（弧度） */
    jitterRad: number;
    /** 弹道预判（高手档，预判量打 6 折） */
    aimPrediction: boolean;
    /** 是否执行卡距离 */
    keepDistance: boolean;
    /** 低血撤退阈值（0 = 永不撤退） */
    retreatHP: number;
    /** 等级上限 */
    maxLevel: number;
    /** 是否允许使用无人机流 */
    allowDrone: boolean;
}

const DEG = Math.PI / 180;

export const FLOWS: Record<string, FlowDef> = {
    assault: {
        key: "assault", label: "强攻", weight: 25,
        chain: [
            { level: 15, tanks: [Tank.Twin] },
            { level: 30, tanks: [Tank.TripleShot] },
            { level: 45, tanks: [Tank.Triplet, Tank.PentaShot, Tank.SpreadShot] }
        ],
        statPriority: [Stat.BodyDamage, Stat.MaxHealth, Stat.BulletDamage, Stat.BulletSpeed, Stat.Reload, Stat.BulletPenetration],
        minDist: 0, maxDist: 250, special: "none"
    },
    kite: {
        key: "kite", label: "风筝", weight: 30,
        chain: [
            { level: 15, tanks: [Tank.Sniper] },
            { level: 30, tanks: [Tank.Assassin, Tank.Hunter] },
            { level: 45, tanks: [Tank.Ranger, Tank.Stalker, Tank.Predator, Tank.Streamliner] }
        ],
        statPriority: [Stat.BulletDamage, Stat.BulletPenetration, Stat.BulletSpeed, Stat.Reload, Stat.MaxHealth, Stat.HealthRegen],
        minDist: 600, maxDist: 900, special: "none"
    },
    trap: {
        key: "trap", label: "铺场", weight: 15,
        chain: [
            { level: 15, tanks: [Tank.Sniper] },
            { level: 30, tanks: [Tank.Trapper] },
            { level: 45, tanks: [Tank.TriTrapper, Tank.MegaTrapper, Tank.AutoTrapper, Tank.GunnerTrapper] }
        ],
        statPriority: [Stat.Reload, Stat.BulletPenetration, Stat.MaxHealth, Stat.BulletSpeed, Stat.BulletDamage],
        minDist: 800, maxDist: 1200, special: "trap"
    },
    drone: {
        key: "drone", label: "无人机", weight: 20,
        chain: [
            { level: 15, tanks: [Tank.Sniper] },
            { level: 30, tanks: [Tank.Overseer] },
            { level: 45, tanks: [Tank.Overlord, Tank.Necromancer, Tank.Manager, Tank.Battleship, Tank.Factory] }
        ],
        statPriority: [Stat.BulletDamage, Stat.BulletPenetration, Stat.Reload, Stat.MaxHealth, Stat.HealthRegen],
        minDist: 500, maxDist: 800, special: "drone"
    },
    ram: {
        key: "ram", label: "撞击", weight: 10,
        // 注意：Landmine 的枚举 id(37) 与 TankDefinitions.json(38) 不一致，刻意避开
        chain: [
            { level: 30, tanks: [Tank.Smasher] },
            { level: 45, tanks: [Tank.Spike, Tank.AutoSmasher] }
        ],
        statPriority: [Stat.MaxHealth, Stat.BodyDamage, Stat.HealthRegen, Stat.MovementSpeed],
        minDist: 0, maxDist: 150, special: "ram"
    }
};

export const DIFFS: Record<string, DiffDef> = {
    easy: {
        key: "easy", label: "菜鸟", weight: 35,
        decisionInterval: 30, jitterRad: 10 * DEG,
        aimPrediction: false, keepDistance: false,
        retreatHP: 0, maxLevel: 30, allowDrone: false
    },
    normal: {
        key: "normal", label: "普通", weight: 45,
        decisionInterval: 15, jitterRad: 5 * DEG,
        aimPrediction: false, keepDistance: true,
        retreatHP: 0.2, maxLevel: 40, allowDrone: true
    },
    hard: {
        key: "hard", label: "高手", weight: 20,
        decisionInterval: 7, jitterRad: 2 * DEG,
        aimPrediction: true, keepDistance: true,
        retreatHP: 0.35, maxLevel: 45, allowDrone: true
    }
};

/** 按权重抽取难度档 */
export function pickDifficulty(): DiffDef {
    const list = Object.values(DIFFS);
    return weightedPick(list, d => d.weight);
}

/** 按权重抽取流派；低难度档禁用无人机流时替换为风筝流 */
export function pickFlow(diff: DiffDef): FlowDef {
    let flow = weightedPick(Object.values(FLOWS), f => f.weight);
    if (flow.key === "drone" && !diff.allowDrone) flow = FLOWS.kite;
    return flow;
}

/**
 * 每局开局的流派配额：按权重做多项式抽取，各流派数量每局随机。
 * 返回打乱的 FlowDef 数组，BotManager 逐个出栈分配给 bot。
 */
export function rollFlowBag(count: number): FlowDef[] {
    const flows = Object.values(FLOWS);
    const total = flows.reduce((sum, f) => sum + f.weight, 0);
    const counts = new Map<string, number>();
    for (let i = 0; i < count; ++i) {
        let roll = Math.random() * total;
        for (const f of flows) {
            roll -= f.weight;
            if (roll <= 0) {
                counts.set(f.key, (counts.get(f.key) || 0) + 1);
                break;
            }
        }
    }
    const bag: FlowDef[] = [];
    for (const [key, n] of counts) {
        for (let i = 0; i < n; ++i) bag.push(FLOWS[key]);
    }
    // 洗牌
    for (let i = bag.length - 1; i > 0; --i) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    return bag;
}

function weightedPick<T extends { weight: number }>(list: T[], weight: (item: T) => number): T {
    const total = list.reduce((sum, item) => sum + weight(item), 0);
    let roll = Math.random() * total;
    for (const item of list) {
        roll -= weight(item);
        if (roll <= 0) return item;
    }
    return list[list.length - 1];
}
