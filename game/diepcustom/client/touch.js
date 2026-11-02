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
 * 坦克大乱斗 · 触屏适配层（手机/平板）
 *
 * 输入映射（与执行计划 §5 表格一一对应）：
 * - 左半屏按住 = 移动摇杆（起点为触点），位移向量 → W/A/S/D keyDown/keyUp，死区 15%；
 * - 左摇杆松开 = 四键全部 keyUp；
 * - 右半屏拖动 = 瞄准（input.mouse）；
 * - 右半屏按住 = 左键开火（keyDown(1)），松开停火；
 * - 右半屏向外拉超过 1.4 × 摇杆半径 = 右键（keyDown(3)，无人机 repel），回落松开。
 *
 * 仅在触屏设备启用；DPR > 1.5 时降渲染分辨率（no_retina）。
 * 不触碰 WASM 渲染核心，只做"触摸 → 现有 JS 输入接口"的翻译。
 */
(function () {
    if (!("ontouchstart" in window)) return;

    // 中端设备降渲染分辨率（input.js 在 setupInput 时读取 no_retina）
    if ((window.devicePixelRatio || 1) > 1.5 && !window.localStorage.getItem("no_retina")) {
        window.localStorage.setItem("no_retina", "1");
    }

    const KEY_CODES = { up: 87, down: 83, left: 65, right: 68 }; // W/S/A/D
    const JOY_RADIUS = 70;      // 摇杆可视半径（px）
    const DEAD_ZONE = 0.15;     // 死区比例
    const DIR_THRESHOLD = 0.38; // 方向判定阈值（约 22°）
    const REPEL_FACTOR = 1.4;   // 右半屏外拉倍数 → 右键 repel

    let moveTouchId = null;
    let aimTouchId = null;
    let moveBase = { x: 0, y: 0 };
    let aimStart = null;
    let activeKeys = { up: false, down: false, left: false, right: false };
    let firing = false;
    let repelling = false;

    let joyEl = null;
    let joyKnobEl = null;

    const scale = () => (window.localStorage.getItem("no_retina") ? 1 : (window.devicePixelRatio || 1));

    // ---------- 摇杆 UI ----------
    function showJoy(x, y) {
        if (!joyEl) {
            joyEl = document.createElement("div");
            joyKnobEl = document.createElement("div");
            const s = document.createElement("style");
            s.textContent = [
                "#touchJoy{position:fixed;width:" + JOY_RADIUS * 2 + "px;height:" + JOY_RADIUS * 2 + "px;",
                "border:2px solid rgba(255,255,255,.35);background:rgba(40,40,80,.35);border-radius:50%;",
                "z-index:30;pointer-events:none;}",
                "#touchJoyKnob{position:absolute;width:52px;height:52px;border-radius:50%;",
                "background:rgba(255,255,255,.5);left:50%;top:50%;margin:-26px 0 0 -26px;}"
            ].join("");
            document.head.appendChild(s);
            joyEl.id = "touchJoy";
            joyKnobEl.id = "touchJoyKnob";
            joyEl.appendChild(joyKnobEl);
            document.body.appendChild(joyEl);
        }
        joyEl.style.display = "block";
        joyEl.style.left = (x - JOY_RADIUS) + "px";
        joyEl.style.top = (y - JOY_RADIUS) + "px";
        moveKnob(0, 0);
    }

    function moveKnob(dx, dy) {
        if (!joyKnobEl) return;
        joyKnobEl.style.transform = "translate(" + dx + "px," + dy + "px)";
    }

    function hideJoy() {
        if (joyEl) joyEl.style.display = "none";
    }

    // ---------- 移动：向量 → WASD ----------
    function setDirection(dir) {
        for (const key of ["up", "down", "left", "right"]) {
            if (dir[key] && !activeKeys[key]) {
                window.input.keyDown(KEY_CODES[key]);
                activeKeys[key] = true;
            } else if (!dir[key] && activeKeys[key]) {
                window.input.keyUp(KEY_CODES[key]);
                activeKeys[key] = false;
            }
        }
    }

    function updateMovement(dx, dy) {
        const len = Math.hypot(dx, dy);
        moveKnob(Math.max(-JOY_RADIUS + 26, Math.min(JOY_RADIUS - 26, dx)),
                 Math.max(-JOY_RADIUS + 26, Math.min(JOY_RADIUS - 26, dy)));
        if (len < JOY_RADIUS * DEAD_ZONE) return setDirection({});
        const ux = dx / len, uy = dy / len;
        setDirection({
            up: uy < -DIR_THRESHOLD,
            down: uy > DIR_THRESHOLD,
            left: ux < -DIR_THRESHOLD,
            right: ux > DIR_THRESHOLD
        });
    }

    function stopMovement() {
        setDirection({});
    }

    // ---------- 开火 / repel ----------
    function setFiring(on) {
        if (on === firing) return;
        firing = on;
        if (on) window.input.keyDown(1);
        else window.input.keyUp(1);
    }

    function setRepelling(on) {
        if (on === repelling) return;
        repelling = on;
        if (on) window.input.keyDown(3);
        else window.input.keyUp(3);
    }

    // ---------- 事件分发 ----------
    function isUITouch(e) {
        // 不拦截名字输入框等 DOM 控件
        return e.target && e.target !== document.getElementById("canvas");
    }

    function onTouchStart(e) {
        if (isUITouch(e)) return;
        e.preventDefault();

        for (const touch of e.changedTouches) {
            if (touch.clientX < window.innerWidth / 2 && moveTouchId === null) {
                // 左半屏：移动摇杆
                moveTouchId = touch.identifier;
                moveBase = { x: touch.clientX, y: touch.clientY };
                showJoy(touch.clientX, touch.clientY);
            } else if (aimTouchId === null) {
                // 右半屏：瞄准 + 开火
                aimTouchId = touch.identifier;
                aimStart = { x: touch.clientX, y: touch.clientY };
                setFiring(true);
                aimAt(touch.clientX, touch.clientY);
            }
        }
    }

    function aimAt(x, y) {
        const s = scale();
        window.input.mouse(x * s, y * s);
    }

    function onTouchMove(e) {
        if (isUITouch(e)) return;
        e.preventDefault();

        for (const touch of e.changedTouches) {
            if (touch.identifier === moveTouchId) {
                updateMovement(touch.clientX - moveBase.x, touch.clientY - moveBase.y);
            } else if (touch.identifier === aimTouchId) {
                aimAt(touch.clientX, touch.clientY);
                if (aimStart) {
                    const pull = Math.hypot(touch.clientX - aimStart.x, touch.clientY - aimStart.y);
                    setRepelling(pull > JOY_RADIUS * REPEL_FACTOR);
                }
            }
        }
    }

    function onTouchEnd(e) {
        if (isUITouch(e)) return;
        e.preventDefault();

        for (const touch of e.changedTouches) {
            if (touch.identifier === moveTouchId) {
                moveTouchId = null;
                stopMovement();
                hideJoy();
            } else if (touch.identifier === aimTouchId) {
                aimTouchId = null;
                aimStart = null;
                setFiring(false);
                setRepelling(false);
            }
        }
    }

    // ---------- 装载（等 window.input 就绪）----------
    function install() {
        const opts = { passive: false };
        document.addEventListener("touchstart", onTouchStart, opts);
        document.addEventListener("touchmove", onTouchMove, opts);
        document.addEventListener("touchend", onTouchEnd, opts);
        document.addEventListener("touchcancel", onTouchEnd, opts);
        document.documentElement.style.touchAction = "none";
    }

    // input.js 在 setupInput() 中初始化 window.input（由 loader 在 WASM 就绪后调用）
    // 这里包一层：setupInput 执行完立即安装触摸层
    const origSetupInput = window.setupInput;
    window.setupInput = function () {
        const result = origSetupInput ? origSetupInput.apply(this, arguments) : undefined;
        try { install(); } catch (err) { console.warn("touch setup failed", err); }
        return result;
    };
})();
