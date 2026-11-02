/*
    坦克大乱斗 · 冒烟测试（node test-smoke.mjs [baseUrl]）

    覆盖：
    1. HTTP /api/servers —— 模式列表存在、坦克大乱斗排第一、模式名全中文
    2. HTTP /api/tanks   —— 坦克名/属性名无英文残留
    3. /api/solo-settings —— 修改生效、越界钳制、写入持久化文件
    4. /api/solo-round   —— 清场倒计时在走、时长与设置一致
    5. WebSocket 握手（Init→Accept）、出生（Spawn）、收到实体数据流（Update）
    6. 挂机测试：70 秒不发任何心跳，连接不被踢（旧版 60 秒即踢）
*/
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.argv[2] || "http://localhost:8180";
const BUILD_HASH = "6f59094d60f98fafc14371671d3ff31ef4d75d9e";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SETTINGS_FILE = path.join(HERE, "solo-settings.json");

// 测试前记住用户原设置，结束后原样恢复；本局开始时的清场时长（改时长只在下一局生效）
const userSettings = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
const roundMinutesAtBoot = userSettings.roundMinutes;

const results = [];
function check(name, ok, extra = "") {
    results.push(ok);
    console.log((ok ? "PASS" : "FAIL") + "  " + name + (extra ? "   [" + extra + "]" : ""));
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
function stringNT(s) { const b = Buffer.from(s, "utf8"); return Buffer.concat([b, Buffer.from([0])]); }

// ---------- 1. 模式列表 ----------
{
    const r = await fetch(BASE + "/api/servers");
    const servers = await r.json();
    check("HTTP /api/servers 200", r.status === 200);
    check("模式列表第一个是坦克大乱斗", servers[0]?.gamemode === "solo", servers.map(s => s.gamemode).join(","));
    check("模式名全部中文", servers.every(s => /^[\u4e00-\u9fa5]/.test(s.name || "")), servers.map(s => s.name).join(","));
}

// ---------- 2. 坦克定义 ----------
{
    const r = await fetch(BASE + "/api/tanks");
    const tanks = await r.json();
    check("HTTP /api/tanks 200", r.status === 200 && Array.isArray(tanks) && tanks.length > 40, tanks.length + " 辆");
    const engStats = new Set();
    const engNames = [];
    for (const t of tanks) {
        if (!t) continue; // id 空洞为 null 占位
        if (/^[A-Za-z]/.test(t.name || "")) engNames.push(t.name);
        for (const st of t.stats || []) if (/^[A-Za-z]/.test(st.name || "")) engStats.add(st.name);
    }
    check("坦克名无英文残留", engNames.length === 0, engNames.slice(0, 5).join(","));
    check("属性名无英文残留（含无人机系）", engStats.size === 0, [...engStats].join(","));
}

// ---------- 3. 设置接口 + 持久化 ----------
let settings;
{
    const s0 = await (await fetch(BASE + "/api/solo-settings")).json();
    const keys = ["droneMult", "necroMaxPerBarrel", "necroClaimTriangle", "necroClaimPentagon", "shapeMult", "roundMinutes"];
    check("设置接口包含全部字段", keys.every(k => k in s0), JSON.stringify(s0));

    await fetch(BASE + "/api/solo-settings?droneMult=5&sm=10&rm=30&tri=1&pent=1");
    const s1 = await (await fetch(BASE + "/api/solo-settings")).json();
    check("设置修改后读回一致", s1.droneMult === 5 && s1.shapeMult === 10, JSON.stringify(s1));

    await fetch(BASE + "/api/solo-settings?droneMult=999&rm=999");
    settings = await (await fetch(BASE + "/api/solo-settings")).json();
    check("越界值被钳制(droneMult≤10, rm≤60)", settings.droneMult === 10 && settings.roundMinutes === 60, JSON.stringify(settings));

    const persisted = JSON.parse(fs.readFileSync(path.join(HERE, "solo-settings.json"), "utf8"));
    check("设置已写入持久化文件", persisted.droneMult === 10 && persisted.roundMinutes === 60, JSON.stringify(persisted));
}

// ---------- 5+6. WebSocket：握手/出生/数据流/挂机不踢 ----------
{
    const ws = new WebSocket(BASE.replace(/^http/, "ws") + "/solo");
    ws.binaryType = "arraybuffer";

    const seen = new Map(); // header -> count
    let closed = false;
    let closeCode = "";
    ws.onmessage = ev => {
        const u8 = new Uint8Array(ev.data);
        if (u8.length) seen.set(u8[0], (seen.get(u8[0]) || 0) + 1);
    };
    ws.onclose = ev => { closed = true; closeCode = ev.code + "/" + ev.reason; };
    ws.onerror = () => { closed = true; closeCode = "error"; };

    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; setTimeout(() => rej(new Error("open timeout")), 5000); }).catch(() => {});

    // Init 握手
    ws.send(Buffer.concat([Buffer.from([0x00]), stringNT(BUILD_HASH), stringNT("")]));
    await sleep(1500);
    check("WS 握手收到 Accept(0x07)", (seen.get(0x07) || 0) > 0 && !closed, "closed=" + closed);

    // 出生
    ws.send(Buffer.concat([Buffer.from([0x02]), stringNT("冒烟测试")]));
    await sleep(3000);
    check("WS 出生后收到实体数据流 Update(0x00)", (seen.get(0x00) || 0) > 3, (seen.get(0x00) || 0) + " 个更新包");

    // 挂机：70 秒不发任何包（旧版 60 秒即被踢）
    const updatesBefore = seen.get(0x00) || 0;
    await sleep(70000);
    check("挂机 70 秒无心跳未被踢（保活优先）", !closed, closed ? "closed: " + closeCode : "still open");

    // 心跳恢复
    ws.send(Buffer.from([0x05])); // ServerBound.Ping
    await sleep(1500);
    check("恢复心跳收到 Pong(0x05)", (seen.get(0x05) || 0) > 0, "");
    check("挂机期间服务器持续推送更新", (seen.get(0x00) || 0) > updatesBefore + 100, (seen.get(0x00) || 0) + " 个更新包");

    // 清场倒计时（保持 WS 在线：无人连接时服务器 tick 暂停属预期行为）
    const rd1 = await (await fetch(BASE + "/api/solo-round")).json();
    await sleep(1100);
    const rd2 = await (await fetch(BASE + "/api/solo-round")).json();
    check("在线时清场倒计时在走", typeof rd1?.secondsLeft === "number" && rd2.secondsLeft < rd1.secondsLeft, rd1.secondsLeft + " -> " + rd2.secondsLeft);
    check("本局时长为开局时的设置值(改时长下一局生效)", rd1.roundSeconds === roundMinutesAtBoot * 60, rd1.roundSeconds + "s vs 开局值 " + roundMinutesAtBoot * 60 + "s");

    try { ws.close(); } catch {}
}

// ---------- 恢复用户原设置 ----------
{
    const u = userSettings;
    await fetch(BASE + "/api/solo-settings?droneMult=" + u.droneMult
        + "&necroMax=" + u.necroMaxPerBarrel
        + "&tri=" + (u.necroClaimTriangle ? 1 : 0)
        + "&pent=" + (u.necroClaimPentagon ? 1 : 0)
        + "&sm=" + u.shapeMult
        + "&rm=" + u.roundMinutes);
    const restored = await (await fetch(BASE + "/api/solo-settings")).json();
    check("测试后用户原设置已恢复", restored.droneMult === u.droneMult && restored.shapeMult === u.shapeMult
        && restored.necroMaxPerBarrel === u.necroMaxPerBarrel && restored.roundMinutes === u.roundMinutes, JSON.stringify(restored));
}

// ---------- 汇总 ----------
const pass = results.filter(Boolean).length;
console.log("\n===== 冒烟测试汇总: " + pass + "/" + results.length + " 通过 =====");
process.exit(pass === results.length ? 0 : 1);
