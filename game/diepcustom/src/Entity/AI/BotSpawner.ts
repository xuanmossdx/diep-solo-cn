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

import GameServer from "../../Game";
import ArenaEntity from "../../Native/Arena";
import { CameraEntity } from "../../Native/Camera";
import { Inputs } from "../AI";
import TankBody from "../Tank/TankBody";
import * as config from "../../config";
import { Tank } from "../../Const/Enums";

import { BotBrain } from "./BotBrain";
import { FLOWS, FlowDef, pickDifficulty } from "./BotBuilds";

/**
 * 坦克大乱斗 · AI 坦克生成器
 *
 * P2 阶段：生成基础 AI 坦克（自带索敌/瞄准），出生等级 15，无流派。
 * P3 阶段：BotBrain（流派 + 难度行为层）将包装在此处创建的 AI 实例上。
 */
export class BotSpawner {
    /**
     * 生成一台 AI 坦克。
     * @param arena 所属竞技场（取其 game 与出生点）
     * @param name 显示昵称（中文）
     * @param flow 指定流派（来自 BotManager 的本局配额袋）
     * @returns 创建的坦克与其行为层实例
     */
    public static spawnBot(arena: ArenaEntity, name: string, flow: FlowDef): { tank: TankBody; ai: BotBrain } {
        const game = arena.game;
        const camera = new CameraEntity(game);
        const tank = new TankBody(game, camera, new Inputs());

        camera.cameraData.values.player = tank;
        tank.setTank(Tank.Basic);
        camera.setLevel(config.soloBotStartLevel);
        tank.nameData.values.name = name;

        // 出生点：地图内随机，且远离存活的人类玩家（≥ 4000 单位）
        const pos = BotSpawner.findSpawnPosition(arena);
        tank.positionData.values.x = pos.x;
        tank.positionData.values.y = pos.y;

        // 行为层：随机难度档 + 指定流派（无人机流按难度档准入，不准入时降级为风筝流）
        const diff = pickDifficulty();
        if (flow.key === "drone" && !diff.allowDrone) flow = FLOWS.kite;
        const ai = new BotBrain(tank, flow, diff);
        tank.inputs = ai.inputs;

        return { tank, ai };
    }

    /** 地图内随机出生点，避免出现在人类玩家 4000 单位范围内（最多尝试 24 次） */
    private static findSpawnPosition(arena: ArenaEntity): { x: number; y: number } {
        let pos = arena.findSpawnLocation(config.soloArenaSize, config.soloArenaSize);
        const human = BotSpawner.findHuman(arena);
        if (!human) return pos;

        for (let i = 0; i < 24; ++i) {
            const dX = pos.x - human.positionData.values.x;
            const dY = pos.y - human.positionData.values.y;
            if (dX * dX + dY * dY >= 4000 * 4000) break;
            pos = arena.findSpawnLocation(config.soloArenaSize, config.soloArenaSize);
        }
        return pos;
    }

    /** 找到任意一个存活的人类玩家坦克 */
    private static findHuman(arena: ArenaEntity): TankBody | null {
        for (const client of arena.game.clients) {
            const entity = client.camera?.cameraData.values.player;
            if (entity && TankBody.isTank(entity)) return entity;
        }
        return null;
    }
}
