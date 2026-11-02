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

import { InputFlags, PhysicsFlags } from "../../Const/Enums";
import { Entity } from "../../Native/Entity";
import { AI } from "../AI";
import ObjectEntity from "../Object";
import TankBody from "../Tank/TankBody";

import { DiffDef, FlowDef } from "./BotBuilds";

const enum BrainState {
    wander = 0,
    engage = 1,
    retreat = 2,
    layTraps = 3
}

/** 子弹速度估算（单位/tick），用于弹道预判 */
const BULLET_SPEED_ESTIMATE = 15;
/** 撤退持续时间（tick） */
const RETREAT_TICKS = 200;
/** 撤退结束所需的 HP 比例 */
const RETREAT_EXIT_HP = 0.5;
/** 铺场流的接战半径 */
const TRAP_ENGAGE_RANGE = 900;

/**
 * 坦克大乱斗 · Bot 行为层
 *
 * 继承 AI（复用其视野/目标检索基础设施），覆写 tick 实现状态机：
 *   wander（游荡觅食）⇄ engage（按流派交战）⇄ retreat（撤退回血），trap 流额外有 layTraps。
 *
 * 红线约束（不可违反）：
 * - 所有动作只写 this.inputs（mouse / movement / flags），不直改位置/血量/冷却；
 * - 弹道预判量打 6 折；决策间隔低于玩家反应帧率；
 * - 无全图视野（viewRange 与真人屏幕一致），无协同。
 */
export class BotBrain extends AI {
    public flow: FlowDef;
    public diff: DiffDef;

    private brainState: BrainState = BrainState.wander;
    private nextDecisionTick = 0;

    /** 当前交战/瞄准目标 */
    private currentTarget: ObjectEntity | null = null;
    /** 撤退截止 tick */
    private retreatUntilTick = 0;

    /** 移动指令（每 tick 写入 inputs.movement） */
    private moveDir = { x: 0, y: 0 };
    /** 本决策周期的开火意图 */
    private wantFire = false;
    /** 无人机流的收拢意图（右键） */
    private wantRepel = false;

    /** 绕行方向与翻转计时 */
    private strafeDir = Math.random() < 0.5 ? 1 : -1;
    private nextStrafeFlipTick = 0;

    /** 游荡目标点 */
    private wanderX = 0;
    private wanderY = 0;
    private wanderUntilTick = 0;

    /** 进化链进度 */
    private chainIndex = 0;
    /** 本决策周期的瞄准抖动偏移 */
    private aimJitter = 0;

    public constructor(owner: ObjectEntity, flow: FlowDef, diff: DiffDef) {
        super(owner);

        this.flow = flow;
        this.diff = diff;
        this.viewRange = 1700; // 与真人屏幕视野一致
    }

    public tick(tick: number) {
        if (tick >= this.nextDecisionTick) {
            this.decide(tick);
            this.nextDecisionTick = tick + this.diff.decisionInterval;
        }

        // —— 每 tick 应用指令（inputs.movement 会被 TankBody.tick 消费后清零）——
        this.inputs.movement.set({ x: this.moveDir.x, y: this.moveDir.y });
        this.inputs.flags = (this.wantFire ? InputFlags.leftclick : 0) | (this.wantRepel ? InputFlags.rightclick : 0);

        // 平滑瞄准：每 tick 重新计算，但抖动量按决策周期固定
        if (Entity.exists(this.currentTarget)) this.aimAt(this.currentTarget);
    }

    /** 低频决策：状态机 + 目标选择 + 进化/加点（每 decisionInterval tick 一次） */
    private decide(tick: number) {
        const pos = this.owner.positionData.values;

        // —— 进化与加点 ——
        this.tryUpgrade();
        this.tryAllocateStats();

        // —— HP 与撤退状态 ——
        const health = this.owner.healthData ? this.owner.healthData.values : null;
        const hpRatio = health ? health.health / health.maxHealth : 1;

        if (this.brainState !== BrainState.retreat && this.diff.retreatHP > 0 && hpRatio < this.diff.retreatHP) {
            this.brainState = BrainState.retreat;
            this.retreatUntilTick = tick + RETREAT_TICKS;
        } else if (this.brainState === BrainState.retreat && (hpRatio >= RETREAT_EXIT_HP || tick >= this.retreatUntilTick)) {
            this.brainState = BrainState.wander;
        }

        // —— 目标检索 ——
        const enemy = this.searchNearest(this.viewRange, e => TankBody.isTank(e));
        const shape = this.searchNearest(1200, e => !TankBody.isTank(e));

        // —— 状态机 ——
        let moveX = 0, moveY = 0;

        if (this.brainState === BrainState.retreat) {
            // 远离最近威胁 + 保持还击
            const threat = enemy || this.currentTarget;
            this.currentTarget = enemy || shape;
            if (Entity.exists(threat)) {
                const t = threat.positionData.values;
                const dx = pos.x - t.x, dy = pos.y - t.y;
                const len = Math.max(1, Math.hypot(dx, dy));
                moveX = dx / len; moveY = dy / len;
            } else {
                moveX = Math.cos(tick * 0.05); moveY = Math.sin(tick * 0.05);
            }
            this.wantFire = !!this.currentTarget && this.flow.special !== "ram";
            this.wantRepel = false;
        } else if (enemy) {
            const ePos = enemy.positionData.values;
            const dx = ePos.x - pos.x, dy = ePos.y - pos.y;
            const dist = Math.hypot(dx, dy);

            if (this.flow.special === "trap" && dist > TRAP_ENGAGE_RANGE) {
                // 守株待兔：原地布防，顺路打方块
                this.brainState = BrainState.layTraps;
                this.currentTarget = shape;
                moveX = 0; moveY = 0;
                this.wantFire = !!shape;
                this.wantRepel = false;
            } else {
                this.brainState = BrainState.engage;
                this.currentTarget = enemy;
                const band = this.moveForRange(tick, dx, dy, dist);
                moveX = band.x; moveY = band.y;
                this.wantFire = true; // 撞击流 Smasher 系无炮管，开火标志无副作用
                this.wantRepel = this.flow.special === "drone" && dist < 300;
            }
        } else if (shape && this.flow.special !== "ram") {
            // 游荡觅食
            this.brainState = BrainState.wander;
            this.currentTarget = shape;
            const sPos = shape.positionData.values;
            const dx = sPos.x - pos.x, dy = sPos.y - pos.y;
            const dist = Math.max(1, Math.hypot(dx, dy));
            moveX = dx / dist; moveY = dy / dist;
            this.wantFire = dist < 900;
            this.wantRepel = false;
        } else {
            // 无目标：随机游走
            this.brainState = BrainState.wander;
            this.currentTarget = null;
            this.wantFire = false;
            this.wantRepel = false;

            if (tick >= this.wanderUntilTick || Math.hypot(this.wanderX - pos.x, this.wanderY - pos.y) < 300) {
                this.wanderX = pos.x + (Math.random() * 2 - 1) * 2400;
                this.wanderY = pos.y + (Math.random() * 2 - 1) * 2400;
                this.wanderUntilTick = tick + 25 * 6;
            }
            const dx = this.wanderX - pos.x, dy = this.wanderY - pos.y;
            const len = Math.max(1, Math.hypot(dx, dy));
            moveX = dx / len; moveY = dy / len;
        }

        this.moveDir = { x: moveX, y: moveY };

        // —— 本决策周期的瞄准抖动 ——
        this.aimJitter = (Math.random() * 2 - 1) * this.diff.jitterRad;
    }

    /**
     * 交战移动：远战流派（风筝/铺场/无人机）执行卡距离；
     * 近战流派（强攻/撞击）无条件主动逼近贴脸，绝不放风筝。
     */
    private moveForRange(tick: number, dx: number, dy: number, dist: number): { x: number; y: number } {
        const len = Math.max(1, dist);
        const ux = dx / len, uy = dy / len;

        // 近战流派：冲！
        if (this.flow.special === "ram" || this.flow.key === "assault") {
            return { x: ux, y: uy };
        }
        // 菜鸟档不执行卡距离，也追着打
        if (!this.diff.keepDistance) {
            return { x: ux, y: uy };
        }

        if (dist > this.flow.maxDist) return { x: ux, y: uy };
        if (dist < this.flow.minDist) return { x: -ux, y: -uy };

        // 射程带内：切向绕行，定期换向
        if (tick >= this.nextStrafeFlipTick) {
            this.strafeDir = -this.strafeDir;
            this.nextStrafeFlipTick = tick + 120 + Math.floor(Math.random() * 120);
        }
        return { x: -uy * this.strafeDir, y: ux * this.strafeDir };
    }

    /** 每 tick 平滑瞄准：预判（打 6 折）+ 决策周期内固定的抖动 */
    private aimAt(target: ObjectEntity) {
        const pos = this.owner.positionData.values;
        let tx = target.positionData.values.x;
        let ty = target.positionData.values.y;

        if (this.diff.aimPrediction) {
            const dx = tx - pos.x, dy = ty - pos.y;
            const dist = Math.max(1, Math.hypot(dx, dy));
            const flightTicks = dist / BULLET_SPEED_ESTIMATE;
            // 红线：预判量打 6 折，绝不做完美提前量
            tx += target.velocity.x * flightTicks * 0.6;
            ty += target.velocity.y * flightTicks * 0.6;
        }

        const angle = Math.atan2(ty - pos.y, tx - pos.x) + this.aimJitter;
        this.inputs.mouse.set({
            x: pos.x + Math.cos(angle) * 600,
            y: pos.y + Math.sin(angle) * 600
        });
    }

    /** 按流派进化链升级（等级受难度档上限约束） */
    private tryUpgrade() {
        const tank = this.owner;
        if (!TankBody.isTank(tank)) return;

        const level = tank.cameraEntity.cameraData.values.level;
        if (level > this.diff.maxLevel) return;
        if (this.chainIndex >= this.flow.chain.length) return;

        const node = this.flow.chain[this.chainIndex];
        if (level < node.level) return;

        const next = node.tanks[Math.floor(Math.random() * node.tanks.length)];
        tank.setTank(next);
        this.chainIndex++;
    }

    /** 按流派优先级分配加点（复刻客户端 StatUpgrade 的约束检查） */
    private tryAllocateStats() {
        const tank = this.owner;
        if (!TankBody.isTank(tank)) return;

        const camera = tank.cameraEntity;

        while (camera.cameraData.values.statsAvailable > 0) {
            let allocated = false;
            for (const stat of this.flow.statPriority) {
                const current = camera.cameraData.values.statLevels.values[stat];
                const limit = camera.cameraData.values.statLimits.values[stat];
                if (current < limit) {
                    camera.addStat(stat, 1);
                    camera.cameraData.statsAvailable -= 1;
                    allocated = true;
                    break;
                }
            }
            if (!allocated) break; // 全部加满
        }
    }

    /**
     * 视野内最近目标检索（复用 AI.findTarget 的空间网格遍历方式）。
     * predicate 用于区分"敌坦克"与"方块"。
     */
    private searchNearest(range: number, predicate: (entity: ObjectEntity) => boolean): ObjectEntity | null {
        const root = this.owner.rootParent;
        const pos = root.positionData.values;
        const team = this.owner.relationsData.values.team;

        const entities = this.game.entities.collisionManager.retrieve(pos.x, pos.y, range, range);

        let best: ObjectEntity | null = null;
        let bestDistSq = range * range;

        for (let i = 0; i < entities.data.length; ++i) {
            let chunk = entities.data[i];
            while (chunk) {
                const bitValue = chunk & -chunk;
                const bitIdx = 31 - Math.clz32(bitValue);
                chunk ^= bitValue;
                const id = 32 * i + bitIdx;

                const entity = this.game.entities.inner[id];
                if (!entity || entity.hash === 0) continue;
                if (!ObjectEntity.isObject(entity) || !entity.isPhysical) continue;
                if (!entity.healthData || entity.healthData.values.health <= 0) continue;
                if (entity.physicsData.values.sides === 0) continue;
                if (entity.physicsData.values.flags & PhysicsFlags.isBase) continue;
                // 跳过有主实体（子弹/无人机/炮塔）
                if (entity.relationsData.values.owner !== null && entity.relationsData.values.owner.positionData) continue;
                if (entity.relationsData.values.team === team) continue;
                if (!predicate(entity)) continue;

                const dx = entity.positionData.values.x - pos.x;
                const dy = entity.positionData.values.y - pos.y;
                const distSq = dx * dx + dy * dy;

                if (distSq < bestDistSq) {
                    best = entity;
                    bestDistSq = distSq;
                }
            }
        }

        return best;
    }
}
