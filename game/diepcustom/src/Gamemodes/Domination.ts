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

import Client from "../Client";
import { Color, ColorsHexCode, ArenaFlags, ValidScoreboardIndex, ClientBound } from "../Const/Enums";
import Dominator from "../Entity/Misc/Dominator";
import TeamBase from "../Entity/Misc/TeamBase";
import { TeamEntity } from "../Entity/Misc/TeamEntity";
import TankBody from "../Entity/Tank/TankBody";
import GameServer from "../Game";
import ArenaEntity, { ArenaState } from "../Native/Arena";
import { Entity } from "../Native/Entity";
import { randomFrom, getRandomPosition } from "../util";

import { BotManager } from "../Entity/AI/BotManager";

const arenaSize = 11150;
const baseSize = arenaSize / (3 + 1/3); // 3345, must scale with arena size
const domBaseSize = baseSize / 2;

const enableScoreboard = false;

const TEAM_COLORS = [Color.TeamBlue, Color.TeamRed]; // Only supports up to 4 teams

/**
 * Domination Gamemode Arena
 */
export default class DominationArena extends ArenaEntity {
    static override GAMEMODE_ID: string = "dom";

    /** All dominators in game */
    public dominators: Dominator[] = [];
    
    /** All team entities in game */
    public teams: TeamEntity[] = [];

    /** Maps clients to their teams */
    public playerTeamMap: WeakMap<Client, TeamEntity> = new WeakMap();

    public constructor(game: GameServer) {
        super(game);
        this.shapeScoreRewardMultiplier = 2.0;
        this.updateBounds(arenaSize * 2, arenaSize * 2);
        this.arenaData.values.flags |= ArenaFlags.hiddenScores;
        let flipLeft = Math.random() > 0.5 ? 1 : -1;
        let flipRight = Math.random() > 0.5 ? -1 : 1;
        for (let i = 0; i < TEAM_COLORS.length; i++) {
            const teamColor = TEAM_COLORS[i];
            const team = new TeamEntity(this.game, teamColor);
            const side = i % 2 !== 0 ? 1 : -1; // 1 = left, -1 = right

            const x = side * arenaSize - side * baseSize / 2;
            const y = side * (side === 1 ? flipLeft : flipRight) * (arenaSize - baseSize / 2);

            flipLeft *= side
            flipRight *= -side

            const teamBase = new TeamBase(game, team, x, y, baseSize, baseSize);
            this.teams.push(team);
        }
        const SE = new Dominator(this, new TeamBase(game, this, arenaSize / 2.5, arenaSize / 2.5, domBaseSize, domBaseSize, false));
        SE.prefix = "SE ";
        const SW = new Dominator(this, new TeamBase(game, this, arenaSize / -2.5, arenaSize / 2.5, domBaseSize, domBaseSize, false));
        SW.prefix = "SW ";
        const NW = new Dominator(this, new TeamBase(game, this, arenaSize / -2.5, arenaSize / -2.5, domBaseSize, domBaseSize, false));
        NW.prefix = "NW ";
        const NE = new Dominator(this, new TeamBase(game, this, arenaSize / 2.5, arenaSize / -2.5, domBaseSize, domBaseSize, false));
        NE.prefix = "NE ";
        this.dominators.push(SE, SW, NW, NE);

        this.botManager = new BotManager(this);
    }

    /** Bot 出生时随机分队（且 bot 独占占领点时不触发游戏结束，见 updateArenaState） */
    public override assignBotTeam(tank: TankBody): void {
        TeamEntity.setTeam(randomFrom(this.teams), tank);
    }

    /** 占点倾向：bot 无近期目标时前往最近的敌方占领塔 */
    public override getBotObjective(tank: TankBody): { x: number; y: number } | null {
        let best: { x: number; y: number } | null = null;
        let bestDistSq = Infinity;
        for (const dom of this.dominators) {
            if (!Entity.exists(dom) || dom.relationsData.values.team === tank.relationsData.values.team) continue;
            const dx = dom.positionData.values.x - tank.positionData.values.x;
            const dy = dom.positionData.values.y - tank.positionData.values.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < bestDistSq) {
                bestDistSq = d2;
                best = { x: dom.positionData.values.x, y: dom.positionData.values.y };
            }
        }
        return best;
    }

    public decideTeam(client: Client): TeamEntity {
        const team =  this.playerTeamMap.get(client) || randomFrom(this.teams);
        this.playerTeamMap.set(client, team);

        return team;
    }

    public spawnPlayer(tank: TankBody, client: Client) {
        const team = this.decideTeam(client);
        TeamEntity.setTeam(team, tank);
        
        const success = this.attemptFactorySpawn(tank);
        if (success) return;

        const teamBase = team.base;
        if (!teamBase) return super.spawnPlayer(tank, client);

        const pos = getRandomPosition(teamBase);
        tank.positionData.values.x = pos.x;
        tank.positionData.values.y = pos.y;
    }
    
    public getTeamDominatorCount(team: TeamEntity): number {
        let doms: number = 0;
        for (const dominator of this.dominators) {
            if (dominator.relationsData.values.team === team) doms++;
        }
        return doms;
    }
    
    public updateScoreboard() {
        this.dominators.sort((d1, d2) => d2.healthData.values.health - d1.healthData.values.health);

        const length = Math.min(10, this.dominators.length);
        for (let i = 0; i < length; ++i) {
            const dom = this.dominators[i];
            const team = dom.relationsData.values.team;
            const isTeamATeam = team instanceof TeamEntity;
            if (dom.styleData.values.color === Color.Tank) this.arenaData.values.scoreboardColors[i as ValidScoreboardIndex] = Color.ScoreboardBar;
            else this.arenaData.values.scoreboardColors[i as ValidScoreboardIndex] = dom.styleData.values.color;
            this.arenaData.values.scoreboardNames[i as ValidScoreboardIndex] = dom.prefix || dom.nameData.values.name;
            // TODO: Change id
            // this.arenaData.values.scoreboardTanks[i as ValidScoreboardIndex] = dom['_currentTank'];
            this.arenaData.values.scoreboardTanks[i as ValidScoreboardIndex] = -1
            this.arenaData.values.scoreboardScores[i as ValidScoreboardIndex] = dom.healthData.values.health;
            this.arenaData.values.scoreboardSuffixes[i as ValidScoreboardIndex] = " HP";
        }
       
        this.arenaData.scoreboardAmount = length;
    }
    
    public updateArenaState() {
        if (enableScoreboard) this.updateScoreboard();

        const dominatorCount = this.dominators.length; // Only count alive players for win condition
        for (const team of this.teams) {
            // 只有真人所在队伍独占全部占领点时才结束游戏（bot 之间打完自动开新局没意义，反而会把真人踢出）
            if (this.getTeamDominatorCount(team) === dominatorCount && this.getTeamPlayers(team).length > 0) {
                if (this.state === ArenaState.OPEN) {
                    this.game.broadcast()
                        .u8(ClientBound.Notification)
                        .stringNT(`${team.teamName} HAS WON THE GAME!`)
                        .u32(ColorsHexCode[team.teamData.values.teamColor])
                        .float(-1)
                        .stringNT("").send();
                            
                    this.state = ArenaState.OVER;
                    setTimeout(() => {
                        this.close();
                    }, 5000);
                }
            }
        }

        for (let i = this.dominators.length; i --> 0;) {
            const dom = this.dominators[i];
            if (!Entity.exists(dom)) {
                const pop = this.dominators.pop();
                if (pop && i < this.dominators.length) this.dominators[i] = pop;
            }
        }

        if (this.state === ArenaState.CLOSING && this.getAlivePlayers().length === 0) {
            this.state = ArenaState.CLOSED;

            // This is a one-time, end of life event, so we just use setTimeout
            setTimeout(() => {
                this.game.end();
            }, 10000);
            return;
        }
    }
}
