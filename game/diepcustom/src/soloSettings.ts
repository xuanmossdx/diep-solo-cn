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
    along with this program.  If not, see <https://www.gnu.org/licenses/>
*/

/**
 * 坦克大乱斗 · 运行时可调设置
 *
 * 由客户端设置菜单（L 键）通过 GET /api/solo-settings?... 修改，
 * 单进程单机场景下直接挂在模块级单例上即可。
 */
export const soloSettings = {
    /** 无人机/工厂兵每管上限倍率（作用于所有 barrel definition.droneCount），1 = 原版 */
    droneMult: 1,
    /** 死灵法师每管无人机上限；0 = 默认（11 + 装填等级） */
    necroMaxPerBarrel: 0,
    /** 死灵法师击杀三角形也转化为无人机 */
    necroClaimTriangle: true,
    /** 死灵法师击杀五边形也转化为无人机（血量/攻击由 fromShape 按方块伤害比例放大） */
    necroClaimPentagon: true,
};

export interface SoloSettingsPatch {
    droneMult?: number;
    necroMaxPerBarrel?: number;
    necroClaimTriangle?: boolean;
    necroClaimPentagon?: boolean;
}

/** 应用一次设置变更，返回中文变更摘要（无有效字段时返回"无改动"） */
export function updateSoloSettings(patch: SoloSettingsPatch): string {
    const msgs: string[] = [];

    if (typeof patch.droneMult === "number" && isFinite(patch.droneMult)) {
        soloSettings.droneMult = Math.min(10, Math.max(0.5, patch.droneMult));
        msgs.push(`无人机上限倍率 x${soloSettings.droneMult}`);
    }

    if (typeof patch.necroMaxPerBarrel === "number" && isFinite(patch.necroMaxPerBarrel)) {
        soloSettings.necroMaxPerBarrel = Math.min(100, Math.max(0, Math.round(patch.necroMaxPerBarrel)));
        msgs.push(`死灵每管上限 ${soloSettings.necroMaxPerBarrel > 0 ? soloSettings.necroMaxPerBarrel : "默认(11+装填)"}`);
    }

    if (typeof patch.necroClaimTriangle === "boolean") {
        soloSettings.necroClaimTriangle = patch.necroClaimTriangle;
        msgs.push(`三角转化 ${patch.necroClaimTriangle ? "开" : "关"}`);
    }

    if (typeof patch.necroClaimPentagon === "boolean") {
        soloSettings.necroClaimPentagon = patch.necroClaimPentagon;
        msgs.push(`五边转化 ${patch.necroClaimPentagon ? "开" : "关"}`);
    }

    return msgs.join("，") || "无改动";
}
