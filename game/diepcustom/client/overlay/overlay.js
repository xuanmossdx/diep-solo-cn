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

/**
 * 坦克大乱斗 · 中文覆盖层
 * - 图鉴：全部坦克中文名 + 介绍 + 进化链（数据源 /api/tanks 真实定义）
 * - 进化树：五系分支中文视图
 * - 复活助手：死亡界面"保留等级复活 / 从零重新开始"两个按钮（重新开始 = 出生名带标记，服务端识别）
 * 不修改 WASM；所有面板为 HTML 覆盖层，触屏可操作（触点 ≥44px）。
 */
(function () {
    "use strict";

    // ---------- 中文数据（id 与 /api/tanks 的 TankDefinitions.json 一致） ----------
    var ZH = {
        0: "基础坦克", 1: "双管炮", 2: "三联炮", 3: "三重炮", 4: "四联坦克", 5: "八爪坦克",
        6: "狙击炮", 7: "机关枪", 8: "侧卫", 9: "三角艇", 10: "毁灭者", 11: "监督者",
        12: "霸主", 13: "双侧卫", 14: "五重炮", 15: "刺客", 16: "清场者", 17: "死灵法师",
        18: "三重双子", 19: "猎人", 20: "机枪手", 21: "潜行者", 22: "游侠", 23: "加速器",
        24: "战斗机", 25: "混合体", 26: "经理", 27: "母舰", 28: "掠夺者", 29: "喷射器",
        31: "陷阱手", 32: "陷阱机枪手", 33: "陷阱霸主", 34: "巨型陷阱手", 35: "三重陷阱手",
        36: "粉碎者", 38: "地雷", 39: "自动机枪手", 40: "自动五型", 41: "自动三型",
        42: "散射炮", 43: "水管炮", 44: "自动陷阱手", 45: "统治者", 46: "统治者", 47: "统治者",
        48: "战列舰", 49: "湮灭者", 50: "自动粉碎者", 51: "尖刺", 52: "工厂", 54: "跳弹炮", 55: "火箭兵"
    };

    var DESC = {
        0: "一切之始，属性均衡，15 级时进化选择最多。",
        1: "双管交替开火，火力稳定，强攻系起点。",
        2: "三根平行炮管同时射击，正面火力极强。",
        3: "扇形三连发，覆盖面大，强攻系中期主力。",
        4: "四向炮管全面覆盖，不怕偷袭。",
        5: "八个方向同时开火，移动的火力刺猬。",
        6: "射程与视野俱佳，风筝/陷阱/无人机三系之源。",
        7: "弹幕密集压制近身敌人，精度较低。",
        8: "前后双炮管攻守兼备，多面手路线起点。",
        9: "尾部双炮推进，机动性出色。",
        10: "巨型炮弹一击重创，后坐力还能用来位移。",
        11: "指挥 8 架无人机，本体脆弱但操作上限极高。",
        12: "无人机系的巅峰，8 架无人机压场。",
        13: "前后各两根炮管，火力对称。",
        14: "五连扇形弹幕，近身毁灭性的火力。",
        15: "极致射程与视野，风筝流后期核心。",
        16: "回合结束时合围全图的清场者，无人能挡。",
        17: "把被消灭的方块变成自己的无人机军团。",
        18: "三组双管炮覆盖大半圆，火力网密不透风。",
        19: "双重炮管连环射击，兼具射程与命中率。",
        20: "四根小炮管持续输出，稳定压制。",
        21: "静止时隐身，暗杀型狙击坦克。",
        22: "全游戏最远的射程与视野。",
        23: "尾炮后坐疯狂加速，全游戏最快。",
        24: "多炮管加尾推，攻守机动的全能型。",
        25: "巨炮与无人机双持的重装单位。",
        26: "无人机可脱离指挥自动作战。",
        27: "模式特殊单位。",
        28: "三重变焦视野，超远距精确猎杀。",
        29: "持续喷射的高射速弹幕，近战火力之王。",
        31: "布设陷阱封锁走位，区域控制专家。",
        32: "陷阱与机枪双持，可攻可守。",
        33: "陷阱与无人机双修的异色流派。",
        34: "布设超大陷阱，一次封锁一条路。",
        35: "三组陷阱发生器，把要道变成死亡走廊。",
        36: "无炮管近战坦克，靠撞击杀敌，30 级由基础坦克直接进化。",
        38: "静止时完全隐形的陷阱型坦克。",
        39: "附带自动索敌炮塔的机枪手。",
        40: "五个自动炮塔全向警戒。",
        41: "三座自动炮塔围绕旋转。",
        42: "一次倾泻大范围散射弹幕。",
        43: "五管一线超高射速，持续输出之王。",
        44: "自动布设陷阱的守场专家。",
        45: "占点模式的要塞单位。", 46: "占点模式的要塞单位。", 47: "占点模式的要塞单位。",
        48: "四组双联无人机发射器，无人机海量。",
        49: "比毁灭者更大的终极炮弹。",
        50: "附带自动炮塔的粉碎者。",
        51: "撞击伤害极高的近战坦克。",
        52: "生产自律小坦克作战的终极单位。",
        54: "发射可在地面跳飞的炮弹。",
        55: "发射可控火箭弹的重炮单位。"
    };

    var FAMILIES = [
        { name: "双管系（强攻）", root: 1 },
        { name: "狙击系（风筝/铺场/无人机）", root: 6 },
        { name: "机关枪系（压制/重炮）", root: 7 },
        { name: "侧卫系（机动/自动）", root: 8 },
        { name: "粉碎系（撞击近战）", root: 36 }
    ];

    /** 加点属性：名称与 TankDefinitions.json 汉化后的 stats[].name 一致，statId = 服务端 Stat 枚举序号 */
    var STATS_GUIDE = [
        { id: 0, name: "移动速度", desc: "坦克跑得更快。追杀、逃跑、躲弹幕全靠它；粉碎者/加速器流派的核心属性。" },
        { id: 1, name: "装填", desc: "炮管再装填更快，单位时间打出的子弹更多，直接提升输出。" },
        { id: 2, name: "子弹伤害", desc: "每发子弹伤害更高；无人机/发射物的攻击力也随之提升。" },
        { id: 3, name: "穿透", desc: "子弹更\"耐撞\"：能连续穿过更多敌人和方块后才消失。" },
        { id: 4, name: "子弹速度", desc: "子弹飞得更快更远，打移动目标和远距离目标更容易命中。" },
        { id: 5, name: "身体伤害", desc: "用身体撞击敌人时造成的伤害；近战撞击流的核心属性。" },
        { id: 6, name: "生命上限", desc: "血条更长，更能扛伤害。所有流派都值得点一些。" },
        { id: 7, name: "生命恢复", desc: "脱战后回血更快；配合生命上限提升续航。" }
    ];
    var statXor = 0;
    var xorsLoaded = false;

    var SPECIAL_IDS = [0, 16, 27, 45, 46, 47]; // 基础坦克 + 地图特殊单位
    var treeData = null; // {id: {def, children: []}}
    var parentOf = {};

    // ---------- 工具 ----------
    function el(tag, cls, text) {
        var node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text != null) node.textContent = text;
        return node;
    }

    function zhName(def) {
        return ZH[def.id] || def.name || "未知坦克";
    }

    function chainOf(id) {
        var path = [id];
        var cur = id;
        while (parentOf[cur] != null) {
            cur = parentOf[cur];
            path.unshift(cur);
        }
        return path.map(function (tid) { return (treeData[tid] && zhName(treeData[tid].def)) || "?"; }).join(" → ");
    }

    // ---------- 面板构建 ----------
    function buildPanel(title, bodyBuilder) {
        var panel = el("div", "tldc-panel");
        var head = el("div", "tldc-head");
        var h2 = el("h2", null, title);
        var close = el("button", null, "关闭");
        close.addEventListener("click", function () { panel.classList.remove("on"); });
        head.appendChild(h2);
        head.appendChild(close);
        var body = el("div", "tldc-body");
        bodyBuilder(body);
        panel.appendChild(head);
        panel.appendChild(body);
        document.body.appendChild(panel);
        return panel;
    }

    function buildCodex(tanks) {
        return buildPanel("坦克图鉴（共 " + tanks.length + " 辆）", function (body) {
            var tabs = el("div", "tldc-tabs");
            var grid = el("div", "tldc-grid");
            var cats = ["全部"].concat(FAMILIES.map(function (f) { return f.name.split("（")[0]; })).concat(["特殊单位"]);
            cats.forEach(function (cat, i) {
                var tab = el("span", i === 0 ? "on" : null, cat);
                tab.addEventListener("click", function () {
                    tabs.querySelectorAll("span").forEach(function (s) { s.classList.remove("on"); });
                    tab.classList.add("on");
                    renderGrid(grid, tanks, cat);
                });
                tabs.appendChild(tab);
            });
            body.appendChild(tabs);
            body.appendChild(grid);
            renderGrid(grid, tanks, "全部");
        });
    }

    function familyOf(id) {
        for (var i = 0; i < FAMILIES.length; ++i) {
            if (inFamily(FAMILIES[i].root, id)) return FAMILIES[i].name.split("（")[0];
        }
        return "特殊单位";
    }

    function inFamily(root, id) {
        if (root === id) return true;
        var node = treeData[id];
        while (node && parentOf[node.def.id] != null) {
            if (parentOf[node.def.id] === root) return true;
            node = treeData[parentOf[node.def.id]];
        }
        return false;
    }

    function renderGrid(grid, tanks, cat) {
        grid.innerHTML = "";
        tanks.forEach(function (def) {
            var fam = familyOf(def.id);
            if (cat !== "全部" && fam !== cat) return;
            var card = el("div", "tldc-card");
            var h4 = el("h4", null, zhName(def));
            h4.appendChild(el("em", null, "Lv." + def.levelRequirement + " 解锁"));
            card.appendChild(h4);
            card.appendChild(el("p", null, DESC[def.id] || ""));
            card.appendChild(el("div", "chain", chainOf(def.id)));
            grid.appendChild(card);
        });
    }

    function buildTree() {
        return buildPanel("进化树（按流派查看）", function (body) {
            FAMILIES.forEach(function (fam) {
                var box = el("div", "tldc-family");
                box.appendChild(el("h3", null, fam.name));
                var list = el("ul", "tldc-branch");
                renderBranch(list, fam.root, 0);
                box.appendChild(list);
                body.appendChild(box);
            });
            var note = el("p", null, "说明：绿色等级即进化所需等级；进化时游戏画面会出现可选按钮，也可以对照本树查看中文名。");
            note.style.cssText = "color:#9d9dc8;font-size:12px";
            body.appendChild(note);
        });
    }

    function renderBranch(list, id, depth) {
        var node = treeData[id];
        if (!node) return;
        var li = el("li");
        li.appendChild(el("b", null, zhName(node.def)));
        li.appendChild(el("small", null, "Lv." + node.def.levelRequirement + " · " + (DESC[id] || "")));
        list.appendChild(li);
        node.children.forEach(function (childId) {
            var sub = el("ul", "tldc-branch");
            renderBranch(sub, childId, depth + 1);
            li.appendChild(sub);
        });
    }

    // ---------- 复活助手（死亡界面专用） ----------
    function pressEnter() {
        if (!window.input) return;
        window.input.keyDown(13);
        window.input.keyUp(13);
    }

    function spawnWithName(name) {
        var box = document.getElementById("textInput");
        if (box) box.value = name;
        pressEnter();
    }

    // ---------- 一键加点（标准 StatUpgrade 包，服务端校验合法性） ----------
    function findSocket() {
        try {
            var socks = window.Module && window.Module.cp5 && window.Module.cp5.sockets;
            if (!socks) return null;
            for (var i = 0; i < socks.length; ++i) {
                if (socks[i] && socks[i].readyState === 1) return socks[i];
            }
        } catch (e) {}
        return null;
    }

    function sendStatUpgrade(statId) {
        if (!xorsLoaded) return;
        var sock = findSocket();
        if (!sock) return;
        // ServerBound.StatUpgrade = 0x3，载荷 vi(statId ^ statXor)，小整数单字节即可
        sock.send(new Uint8Array([0x03, (statId ^ statXor) & 0x7f]));
    }

    function buildStatsGuide() {
        return buildPanel("加点说明（升级获得点数，点\"+\"分配）", function (body) {
            var note = el("p", null, "每升 1 级获得 1 点；每项最多 10 点（部分坦克个别项为 0 点不可加）。下方\"+\"与游戏内加号等效，需有可用点数。");
            note.style.cssText = "color:#9d9dc8;font-size:12px;margin-bottom:10px";
            body.appendChild(note);

            STATS_GUIDE.forEach(function (stat) {
                var row = el("div", "tldc-card");
                row.style.cssText = "display:flex;align-items:center;gap:10px;margin-bottom:8px";
                var plus = el("button", null, "+");
                plus.style.cssText = "min-width:44px;min-height:44px;font-size:22px;font-weight:bold;background:#8ac255;color:#222;border:0;border-radius:10px;cursor:pointer";
                plus.addEventListener("click", function () { sendStatUpgrade(stat.id); });
                var text = el("div");
                var title = el("h4", null, stat.name);
                title.style.margin = "0 0 4px";
                text.appendChild(title);
                text.appendChild(el("p", null, stat.desc));
                text.style.flex = "1";
                row.appendChild(plus);
                row.appendChild(text);
                body.appendChild(row);
            });
        });
    }

    // ---------- 设置面板（L 键）：无人机上限 / 死灵法师 ----------
    // 面板事件屏蔽层：游戏 WASM 在 document 级监听键盘/鼠标，会吞掉面板输入框的按键。
    // 在 window 捕获阶段（最早）把发生在面板内的事件拦下，游戏不再响应，同时保留浏览器默认输入行为。
    (function installPanelShield() {
        function inPanel(target) {
            var p = target;
            while (p) {
                if (p.classList && p.classList.contains("tldc-panel")) return true;
                p = p.parentElement;
            }
            return false;
        }
        function shield(e) {
            if (inPanel(e.target)) e.stopPropagation();
        }
        ["keydown", "keyup", "keypress", "pointerdown", "mousedown", "mouseup", "click", "wheel"].forEach(function (t) {
            window.addEventListener(t, shield, true);
        });
    })();

    function buildSettings() {
        var status;

        function mkInput(type, minv, maxv, stepv) {
            var i = el("input");
            i.type = type; i.min = minv; i.max = maxv; i.step = stepv;
            i.style.cssText = "width:90px;min-height:36px;background:#14142a;color:#fff;border:2px solid #44448a;border-radius:8px;padding:2px 6px;font-size:14px";
            return i;
        }

        var multInput = mkInput("number", 0.5, 10, 0.5);
        var necroInput = mkInput("number", 0, 100, 1);
        var shapeInput = mkInput("number", 0.5, 3, 0.5);
        var roundInput = mkInput("number", 5, 60, 5);
        var triInput = mkInput("checkbox");
        triInput.style.cssText = "width:22px;height:22px";
        var pentInput = mkInput("checkbox");
        pentInput.style.cssText = "width:22px;height:22px";

        function fill() {
            fetch("/api/solo-settings").then(function (r) { return r.json(); }).then(function (s) {
                multInput.value = s.droneMult;
                necroInput.value = s.necroMaxPerBarrel;
                shapeInput.value = s.shapeMult;
                roundInput.value = s.roundMinutes;
                triInput.checked = !!s.necroClaimTriangle;
                pentInput.checked = !!s.necroClaimPentagon;
            }).catch(function () {});
        }

        var panel = buildPanel("单机设置（无人机 / 死灵法师）", function (body) {
            function row(labelText, ctrl) {
                var r = el("div", "tldc-card");
                r.style.cssText = "display:flex;align-items:center;gap:10px;margin-bottom:10px";
                var lab = el("span", null, labelText);
                lab.style.cssText = "flex:1;font-size:14px";
                r.appendChild(lab);
                r.appendChild(ctrl);
                body.appendChild(r);
            }

            // 数字框 ± 步进器：点按钮或直接输入都可以
            function stepper(input, stepv) {
                var wrap = el("div");
                wrap.style.cssText = "display:flex;align-items:center;gap:6px";
                function mkBtn(text) {
                    var b = el("button", null, text);
                    b.style.cssText = "min-width:36px;min-height:36px;background:#14142a;color:#ffde43;"
                        + "border:2px solid #44448a;border-radius:8px;font-size:16px;font-weight:bold;cursor:pointer;padding:0";
                    return b;
                }
                function clamp(v) {
                    var lo = parseFloat(input.min), hi = parseFloat(input.max);
                    v = Math.min(hi, Math.max(lo, v));
                    return Math.round(v * 100) / 100;
                }
                var minus = mkBtn("−"), plus = mkBtn("+");
                minus.addEventListener("click", function () { input.value = clamp((parseFloat(input.value) || 0) - stepv); });
                plus.addEventListener("click", function () { input.value = clamp((parseFloat(input.value) || 0) + stepv); });
                wrap.appendChild(minus);
                wrap.appendChild(input);
                wrap.appendChild(plus);
                return wrap;
            }

            row("无人机数量上限倍率（0.5~10，仅对真人自己生效，AI 不受影响）", stepper(multInput, 0.5));
            row("死灵法师每管无人机上限（0 = 默认 11+装填，仅对真人自己生效）", stepper(necroInput, 1));
            row("死灵法师击杀三角形也转化（血量/攻击约 x6，默认开，AI 不受影响）", triInput);
            row("死灵法师击杀五边形也转化（血量/攻击约 x9，默认开，AI 不受影响）", pentInput);
            row("资源（方块）数量倍率（0.5~3，全场生效，即时生效）", stepper(shapeInput, 0.5));
            row("清场回合时长·分钟（5~60，坦克大乱斗专用，下一局生效）", stepper(roundInput, 5));

            var apply = el("button", "primary", "应用");
            apply.style.cssText = "min-height:44px;padding:8px 24px;background:#8ac255;color:#222;border:0;border-radius:10px;font-size:15px;font-weight:bold;cursor:pointer";
            status = el("div");
            status.style.cssText = "color:#9ade9f;font-size:13px;margin-top:8px;min-height:18px";
            apply.addEventListener("click", function () {
                var url = "/api/solo-settings?droneMult=" + encodeURIComponent(multInput.value || "1")
                    + "&necroMax=" + encodeURIComponent(necroInput.value || "0")
                    + "&tri=" + (triInput.checked ? "1" : "0")
                    + "&pent=" + (pentInput.checked ? "1" : "0")
                    + "&sm=" + encodeURIComponent(shapeInput.value || "2")
                    + "&rm=" + encodeURIComponent(roundInput.value || "30");
                fetch(url).then(function (r) { return r.json(); }).then(function (res) {
                    status.textContent = res.msg || "已应用";
                }).catch(function () { status.textContent = "应用失败"; });
            });
            body.appendChild(apply);
            body.appendChild(status);
        });

        // 每次打开面板时刷新当前值
        new MutationObserver(function () {
            if (panel.classList.contains("on")) fill();
        }).observe(panel, { attributes: true, attributeFilter: ["class"] });

        return panel;
    }

    // ---------- 启动 ----------
    function start() {
        var bar = el("div");
        bar.id = "tldc-bar";

        var codexBtn = el("button", null, "图鉴");
        var treeBtn = el("button", null, "进化树");
        var statsBtn = el("button", null, "加点");
        var settingsBtn = el("button", null, "设置");
        bar.appendChild(codexBtn);
        bar.appendChild(treeBtn);
        bar.appendChild(statsBtn);
        bar.appendChild(settingsBtn);
        document.body.appendChild(bar);

        // 设置面板 + L 键开关
        var settingsPanel = buildSettings();
        function toggleSettings() {
            settingsPanel.classList.toggle("on");
        }
        settingsBtn.addEventListener("click", toggleSettings);
        document.addEventListener("keydown", function (ev) {
            if (ev.key !== "l" && ev.key !== "L") return;
            var ae = document.activeElement;
            if (ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA")) return; // 正在输入名字时不触发
            toggleSettings();
        });

        // 底部清场倒计时条（仅坦克大乱斗有回合，其他模式自动隐藏）
        var roundBar = el("div");
        roundBar.style.cssText = "position:fixed;left:50%;bottom:10px;transform:translateX(-50%);z-index:35;"
            + "padding:6px 18px;border-radius:20px;font-size:14px;font-weight:bold;"
            + "font-family:'Microsoft YaHei',sans-serif;background:rgba(20,20,42,.85);color:#ffde43;"
            + "border:2px solid #44448a;display:none;pointer-events:none";
        document.body.appendChild(roundBar);
        setInterval(function () {
            fetch("/api/solo-round").then(function (r) { return r.json(); }).then(function (info) {
                if (!info) { roundBar.style.display = "none"; return; }
                var m = Math.floor(info.secondsLeft / 60);
                var s = info.secondsLeft % 60;
                var t = (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
                if (info.closing) {
                    roundBar.textContent = "清场者合围中！还剩 " + t;
                    roundBar.style.color = "#ff5a50";
                    roundBar.style.borderColor = "#a03030";
                } else {
                    roundBar.textContent = "距清场 " + t;
                    roundBar.style.color = info.secondsLeft <= 60 ? "#ff5a50" : "#ffde43";
                    roundBar.style.borderColor = info.secondsLeft <= 60 ? "#a03030" : "#44448a";
                }
                roundBar.style.display = "block";
            }).catch(function () {});
        }, 1000);

        // 拉取协议 XOR 掩码（一键加点用）
        fetch("/api/xors").then(function (r) { return r.json(); }).then(function (cfg) {
            statXor = cfg.statXor;
            xorsLoaded = true;
        }).catch(function () {});

        var respawn = el("div");
        respawn.id = "tldc-respawn";
        var keepBtn = el("button", "primary", "复活（保留等级）");
        var restartBtn = el("button", null, "重新开始（清零等级）");
        keepBtn.addEventListener("click", function () { spawnWithName(lastName); });
        restartBtn.addEventListener("click", function () { spawnWithName(lastName + "(重新开始)"); });
        respawn.appendChild(keepBtn);
        respawn.appendChild(restartBtn);
        respawn.style.display = "none";
        document.body.appendChild(respawn);

        // 活着（游戏中）时隐藏，回到菜单/死亡界面（textInputContainer 显示）时弹出
        setInterval(function () {
            var container = document.getElementById("textInputContainer");
            var menuVisible = !!(container && container.style.display !== "none");
            respawn.style.display = menuVisible ? "flex" : "none";
        }, 500);

        // 记住玩家名：从输入框实时读取
        var lastName = "";
        setInterval(function () {
            var box = document.getElementById("textInput");
            var v = box && box.value ? box.value : "";
            if (v && v.indexOf("(重新开始)") === -1) lastName = v;
        }, 1000);

        fetch("/api/tanks").then(function (r) { return r.json(); }).then(function (defs) {
            treeData = {};
            defs.forEach(function (def) {
                if (def && def.id != null) treeData[def.id] = { def: def, children: [] };
            });
            defs.forEach(function (def) {
                if (!def || def.id == null) return;
                (def.upgrades || []).forEach(function (cid) {
                    if (treeData[cid]) {
                        treeData[def.id].children.push(cid);
                        if (parentOf[cid] == null) parentOf[cid] = def.id;
                    }
                });
            });
            var playable = defs.filter(function (d) { return d && d.id != null && SPECIAL_IDS.indexOf(d.id) === -1; });
            var codex = buildCodex(playable);
            var tree = buildTree();
            var stats = buildStatsGuide();
            codexBtn.addEventListener("click", function () { codex.classList.add("on"); });
            treeBtn.addEventListener("click", function () { tree.classList.add("on"); });
            statsBtn.addEventListener("click", function () { stats.classList.add("on"); });
        });
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
    else start();
})();
