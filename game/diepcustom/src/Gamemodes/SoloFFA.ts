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

import * as config from "../config";
import { scoreboardUpdateInterval } from "../config";
import { ArenaFlags, StatCount } from "../Const/Enums";
import GameServer from "../Game";
import Client from "../Client";

import ArenaEntity, { ArenaState } from "../Native/Arena";
import { Entity } from "../Native/Entity";
import ShapeManager from "../Misc/ShapeManager";
import TankBody from "../Entity/Tank/TankBody";
import ArenaCloser from "../Entity/Misc/ArenaCloser";

import { BotManager } from "../Entity/AI/BotManager";

/** 地图加大后按比例增补方块密度（默认 1000 / 30000² 地图 → 1400） */
class SoloShapeManager extends ShapeManager {
    protected override get wantedShapes() {
        return 1400;
    }
}

/**
 * 坦克大乱斗 · 单人乱斗 FFA
 *
 * - 1 名真人 + config.soloBotCount 台 AI 坦克，各自为战（FFA 队伍机制天然互打）；
 * - 回合制：config.soloRoundTicks 后触发原版清场（ArenaCloser 合围），
 *   合围 config.soloClosingTicks 后自动重置进入新一局，游戏实例永不结束；
 * - 排行榜合并真人 + bot。
 */
export default class SoloFFAArena extends ArenaEntity {
    static override GAMEMODE_ID: string = "solo";

    /** 出生名携带此标记 = 玩家选择"重新开始"（等级与加点清零），标记本身会被剥除 */
    private static RESTART_MARKER = "(重新开始)";

    public botManager: BotManager;

    /** 本局剩余 tick */
    private roundTicks: number = config.soloRoundTicks;
    /** 是否处于清场合围阶段 */
    private closing: boolean = false;
    /** 合围阶段剩余 tick，归零后开新局 */
    private closingTicks: number = 0;
    /** 上一次广播的倒计时秒数（去重用） */
    private lastAnnouncedSecond: number = -1;

    public constructor(game: GameServer) {
        super(game);

        this.updateBounds(config.soloArenaSize, config.soloArenaSize);
        this.shapes = new SoloShapeManager(this);
        this.botManager = new BotManager(this);
    }

    public tick(tick: number) {
        super.tick(tick);
        this.botManager.tick(tick);

        if (this.closing) {
            if (--this.closingTicks <= 0) this.resetRound();
            return;
        }

        if (this.state !== ArenaState.OPEN) return; // 倒计时阶段不计时

        if (--this.roundTicks <= 0) {
            this.beginClosing();
            return;
        }

        // 最后 60 秒：每秒广播一次中文倒计时
        if (this.roundTicks <= 25 * 60) {
            const seconds = Math.ceil(this.roundTicks / config.tps);
            if (seconds !== this.lastAnnouncedSecond) {
                this.lastAnnouncedSecond = seconds;
                this.game.broadcastMessage(`清场倒计时 ${seconds} 秒——清场者即将合围！`, 0xFF5A50, 1000, "closeCountdown");
            }
        }
    }

    /** 触发清场：复用原版 ArenaCloser 合围逻辑，但不永久关闭 */
    private beginClosing() {
        this.closing = true;
        this.closingTicks = config.soloClosingTicks;

        this.state = ArenaState.CLOSING;
        this.arenaData.flags |= ArenaFlags.noJoining;

        // 与 Arena.close() 相同的清场者生成公式
        const acCount = Math.floor(Math.sqrt(this.width) / 10);
        const radius = this.width * Math.SQRT1_2 + 5000;
        const PI2 = Math.PI * 2;
        for (let i = 0; i < acCount; ++i) {
            const ac = new ArenaCloser(this.game);
            const angle = (i / acCount) * PI2;
            ac.positionData.values.x = Math.cos(angle) * radius;
            ac.positionData.values.y = Math.sin(angle) * radius;
            ac.positionData.values.angle = angle + Math.PI;
        }

        this.game.broadcastMessage("清场开始！活下来，或者死也拉个垫背的！", 0xFF5A50, 5000, "closeStart");
        this.lastAnnouncedSecond = -1;
    }

    /** 新一局：解除关闭状态、重置回合计时、刷新全部 bot；所有玩家的"复活保留等级"一并清零（清场 = 全员从零开始） */
    private resetRound() {
        this.closing = false;
        this.state = ArenaState.OPEN;
        this.arenaData.flags &= ~ArenaFlags.noJoining;

        this.botManager.reset();
        this.roundTicks = config.soloRoundTicks;
        this.lastAnnouncedSecond = -1;

        // 清场清零所有人等级：玩家下一次复活从 1 级开始（bot 已由 BotManager.reset 全部从零生成）
        for (const client of this.game.clients) {
            const camera = client.camera;
            if (!camera || !Entity.exists(camera)) continue;
            camera.cameraData.respawnLevel = 1;
        }

        this.game.broadcastMessage("新的一局开始！所有人的等级已清零，从零开始吧。", 0x37F554, 6000, "newRound");
    }

    /**
     * 覆写：处理"重新开始"标记后按 FFA 方式落位。
     * 死亡复活的两种模式（服务端支持，P5 出 UI 按钮）：
     * - 保留等级复活（默认）：TankBody.destroy 中 solo 分支 respawnLevel = 完整等级；
     * - 重新开始：出生名带 "(重新开始)" 标记 → 等级/加点清零。
     */
    public spawnPlayer(tank: TankBody, client: Client) {
        const name = tank.nameData.values.name;
        if (name.includes(SoloFFAArena.RESTART_MARKER)) {
            tank.nameData.values.name = name.split(SoloFFAArena.RESTART_MARKER)[0].trim() || "无名坦克手";

            const cam = tank.cameraEntity.cameraData;
            for (let i = 0; i < StatCount; ++i) cam.values.statLevels.values[i] = 0;
            cam.values.statsAvailable = 0;
            tank.cameraEntity.setLevel(1);

            client.notify("已重新开始：等级与加点已重置。", 0x37F554, 5000, "restart");
        }

        super.spawnPlayer(tank, client);
    }

    /**
     * 覆写：排行榜包含 bot，且绝不触发 game.end()（单人模式永久运行）。
     */
    protected updateArenaState() {
        if ((this.game.tick % scoreboardUpdateInterval) !== 0) return;

        const players: TankBody[] = this.getAlivePlayers().concat(this.botManager.aliveBots());
        this.updateScoreboard(players);
    }
}
