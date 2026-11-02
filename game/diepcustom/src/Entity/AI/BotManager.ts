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

import ArenaEntity from "../../Native/Arena";
import { Entity } from "../../Native/Entity";
import TankBody from "../Tank/TankBody";
import * as config from "../../config";
import * as util from "../../util";
import { FlowDef, pickDifficulty, rollFlowBag } from "./BotBuilds";

import { BotSpawner } from "./BotSpawner";

/** 当前活跃 bot 记录 */
interface BotRecord {
    tank: TankBody;
    /** 名字（重生时换新名） */
    name: string;
    /** 若 ≥0，表示该 tick 之后才允许重生 */
    respawnAtTick: number;
}

/** P5 阶段迁往 i18n/botNames.zh-CN.ts 的中文名池 */
const BOT_NAMES: string[] = [
    "穿山甲", "铁憨憨", "独角仙", "夜猫子", "大闸蟹", "变色龙", "电鳗", "河豚",
    "猫头鹰", "土拨鼠", "蜈蚣", "螳螂", "臭鼬", "犀牛", "水獭", "小狐狸",
    "刺猬", "蟒蛇", "鳄鱼", "章鱼", "蝙蝠侠", "豪猪", "秃鹫", "狼獾", "斗鱼",
    "北极熊", "鸭嘴兽", "穿云箭", "打瞌睡", "大魔王", "二哈", "方头狮", "咕咕鸟"
];

/**
 * 坦克大乱斗 · Bot 生命周期管理
 *
 * - 维持场上 bot 数量 = config.soloBotCount；
 * - bot 死亡后 5~10 秒随机延迟重生（新名字、新位置）；
 * - reset() 供回合重置调用：清空全部 bot 并重新生成。
 */
export class BotManager {
    private arena: ArenaEntity;
    private bots: BotRecord[] = [];
    private nameCursor = Math.floor(Math.random() * BOT_NAMES.length);
    /** 本局流派配额袋：各流派数量每局随机（rollFlowBag 多项式抽取） */
    private flowBag: FlowDef[] = [];

    public constructor(arena: ArenaEntity) {
        this.arena = arena;
        this.flowBag = rollFlowBag(config.soloBotCount);
    }

    /** 每 tick 调用：补足数量、处理重生 */
    public tick(tick: number) {
        if (tick % (25 * 5) === 0) util.log(`[BotDebug] tick=${tick} bots=${this.bots.length} alive=${this.aliveBots().length}`);
        // 清理已消亡的 bot 实体，安排重生
        for (const record of this.bots) {
            if (Entity.exists(record.tank) && record.tank.hash !== 0) continue;
            if (record.respawnAtTick >= 0) continue; // 已在等待重生
            record.respawnAtTick = tick + config.soloBotRespawnMinTicks
                + Math.floor(Math.random() * (config.soloBotRespawnMaxTicks - config.soloBotRespawnMinTicks));
        }

        // 补足 / 重生（从本局配额袋取流派，取空后按权重随机兜底）
        while (this.bots.length < config.soloBotCount) {
            this.bots.push(this.createBot(tick));
        }
        for (const record of this.bots) {
            if (record.respawnAtTick >= 0 && tick >= record.respawnAtTick) {
                const fresh = BotSpawner.spawnBot(this.arena, this.nextName(), this.takeFlow());
                record.tank = fresh.tank;
                record.respawnAtTick = -1;
            }
        }
    }

    /** 场上存活的 bot 坦克（供排行榜合并） */
    public aliveBots(): TankBody[] {
        const alive: TankBody[] = [];
        for (const record of this.bots) {
            if (record.respawnAtTick < 0 && Entity.exists(record.tank) && record.tank.hash !== 0) {
                alive.push(record.tank);
            }
        }
        return alive;
    }

    /** 回合重置：删除全部 bot，重抽流派配额，下一 tick 自动补齐 */
    public reset() {
        for (const record of this.bots) {
            if (Entity.exists(record.tank) && record.tank.hash !== 0) record.tank.delete();
        }
        this.bots = [];
        this.flowBag = rollFlowBag(config.soloBotCount);
    }

    private createBot(tick: number): BotRecord {
        const fresh = BotSpawner.spawnBot(this.arena, this.nextName(), this.takeFlow());
        return { tank: fresh.tank, name: "", respawnAtTick: -1 };
    }

    /** 从本局配额袋取一个流派；袋空则按权重随机兜底 */
    private takeFlow(): FlowDef {
        const flow = this.flowBag.pop();
        return flow ?? rollFlowBag(1)[0];
    }

    /** 不重复取名：池子顺序轮转 */
    private nextName(): string {
        const name = BOT_NAMES[this.nameCursor % BOT_NAMES.length];
        this.nameCursor = (this.nameCursor + 1 + Math.floor(Math.random() * 3)) % BOT_NAMES.length;
        return name;
    }
}
