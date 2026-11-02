# diep.io 单机 AI 版 · 执行计划 v2（无歧义执行版）

> 配套设计稿：`diepio-单机AI版设计稿.md`（v3，流派路线已按真实树修正）
> 日期：2026-11-02（v2.1：项目改为自包含文件夹 `d:/aaa/diep-solo-cn/`，文档代码一体，完成后与文档一起上传 GitHub，由用户手动删除本地文件夹）
> 执行模式：AI 自主开发+测试 → GitHub 私库上传（含文档）→ 用户手动删除本地文件夹。仅 P4 真机验收一处需要用户参与。

---

## 0. 决策记录（用户 2026-11-02 看原型后表示"没问题"，按默认执行；P2 结束前可推翻）

| # | 决策点 | 采用值 |
|---|---|---|
| 1 | bot 数量 | **25**（环境变量 `BOT_COUNT` 可调 0~30） |
| 2 | 无人机流 | **保留**（仅普通/高手档使用，无人机 AI 继承本体难度） |
| 3 | 回合时长 | **10 分钟**（`ROUND_TICKS` 可配） |
| 4 | 图鉴介绍深度 | **每辆坦克 2~3 行**（定位+优劣势+一句打法），全 48 辆 |
| 5 | 图鉴收集点亮 | **做**（死亡结算面板列出本局遭遇过的坦克，自动点亮图鉴） |

## 1. 全局约定（杜绝歧义）

- **项目根目录**：`d:/aaa/diep-solo-cn/`（自包含：文档 + 代码 + 启动脚本，GitHub 仓库根 = 此目录）；
- **代码目录**：`d:/aaa/diep-solo-cn/game/diepcustom`（开发副本已迁入，AGPL-3.0 的 LICENSE 与版权头保留）；
- **文档目录**：`d:/aaa/diep-solo-cn/docs/`（设计稿 + 本计划 + 测试日志）；
- **运行端口**：本地开发 `PORT=8180`；浏览器访问 `http://localhost:8180`；
- **构建**：`npm ci && npm run build`（tsup）；**运行**：根目录一键脚本 `启动游戏.bat`（装依赖→构建→起服→自动开网页）；开发期直接 `node index.js`；
- **改动边界**：只允许修改第 2~6 节文件清单中列出的文件，清单外一律不动；
- **验收门**：每阶段验收项全过才进下一阶段；不过则停下修复，不带病推进；
- **测试证据**：每阶段结束在 `d:/aaa/diep-solo-cn/docs/testlog.md` 追加一节（验收项/方法/结果）；
- **结束清理**：GitHub 推送成功并验证后，**由用户手动删除 `d:/aaa/diep-solo-cn` 整个文件夹**，AI 不执行删除。

## 2. P1 基线 + 一键启动（半天）

**动作**：
1. `cd d:/aaa/diep-solo-cn/game/diepcustom && npm ci && npm run build`
2. `$env:PORT=8180; node index.js` 后台启动
3. 用 playwright-cli 打开 `http://localhost:8180`：完成 移动/开火/升级/死亡重生 一轮，截图存档
4. **一键启动脚本已就位**（`启动游戏.bat` + 根 `README.md`，2026-11-02 已创建）：实测双击后"装依赖→构建→起服→自动开网页"全链路，浏览器自动弹出

**验收门 A**：页面可玩、无控制台报错、服务端 tick 正常、一键脚本从零跑通一次。
**风险预检**：WASM 客户端若在此阶段暴露构建/运行问题，就地解决，不带进 P2。

## 3. P2 服务端：乱斗 + 回合清场（1 天）

**新建文件**：
| 文件 | 内容（无歧义定义） |
|---|---|
| `src/Gamemodes/SoloFFA.ts` | `class SoloFFAArena extends ArenaEntity`；`GAMEMODE_ID="solo"`；构造中 `updateBounds(30000,30000)`；`spawnPlayer` 与 FFA 相同（每 tank 自成小队）；每 tick 执行回合逻辑 |
| `src/Entity/AI/BotManager.ts` | 字段 `bots: TankBody[]`；`tick()`：bot 数 < `BOT_COUNT` 且冷却到期 → `spawnBot()`；bot 死亡后 5~10s 随机延迟重生；重生位置与玩家距离 > 4000 单位；命名取自 `botNames.zh-CN.ts` 且当局不重复 |
| `src/Entity/AI/BotSpawner.ts` | `spawnBot(): TankBody`：新建无 Client 的 TankBody，`cameraData.player=self`，出生等级 15，挂 `BotBrain`，roll 流派+难度，赋名 |
| 回合逻辑（SoloFFA 内） | `roundTicks` 从 `ROUND_TICKS` 倒计时；剩 60s 起每秒广播"清场倒计时 X 秒"；归零 → 复用 Arena `CLOSING` 流程生成 ArenaCloser（数量 = `√width/10`）；全灭或清场完成 → 广播中文结算（排名/击杀/等级/存活/淘汰者及其流派难度）→ `BotManager.reset()` 全刷新、回合重置 |

**修改文件**（仅限）：
- `src/Gamemodes/index.ts`：注册 `"solo"`（照抄 ffa 注册写法）；
- `src/config.ts`：追加 `BOT_COUNT=25`、`ROUND_TICKS=15000`、`ARENA_SIZE=30000`（环境变量可覆盖）；
- `src/Misc/ShapeManager.ts`：刷新量按 `ARENA_SIZE/22300` 比例放大（只改系数常量）。

**验收门 B**：
1. `?mode=solo` 进入，场上恒 25 bot 且互打（观察 1 分钟排行榜分数变化）；
2. bot 阵亡 5~10s 后在远离玩家处重生；
3. 临时改 `ROUND_TICKS=600` 实测：公告 → 清场者合围 → 结算 → 新一局；
4. 运行 30 分钟进程内存 <400MB 且无持续上涨。

## 4. P3 AI 行为层（2 天）

**新建文件**：`src/Entity/AI/BotBrain.ts`、`src/Entity/AI/BotBuilds.ts`

**BotBrain 规则**（写死）：
- 状态机：`wander / engage / retreat / layTraps(铺场专属)`；HP<撤退阈值 → retreat；视野内有敌 → engage（铺场流例外，见流派表）；否则 wander（随机目标点，顺路以 shape 为 `findTarget` 过滤目标）；
- 每 `decisionInterval` tick 决策一次；**所有输出只写 `this.ai.inputs`（mouse/movement/flags），禁止直改位置/血量/冷却**；
- engage 算法：`dist>maxDist` → 朝向移动；`dist<minDist` → 背向移动（仍开火）；区间内 → 垂直绕行，每 120~240 tick 随机翻转方向；瞄准 = 目标位置 + (预判×0.6) + ±jitter 角度抖动；
- retreat：背向最近威胁移动 + 保持还击，持续 8s 或 HP>50% 后重新决策。

**流派表**（进化链严格来自 TankDefinitions.json 真实树）：

| 流派 | 权重 | setTank 进化链 | 射程带 | 特殊行为 |
|---|---|---|---|---|
| 强攻 | 25% | 基础→双管→三重炮→三联炮/五重炮/散射炮；副线 机关枪→毁灭者→湮灭者/混合体 | 0~250 | 不卡距离，直线贴脸 |
| 风筝 | 30% | 基础→狙击→刺客/猎人→游侠/潜行者/掠夺者/水管炮 | 600~900 | 标准卡距离+绕行 |
| 铺场 | 15% | 基础→狙击→陷阱手→三重陷阱/巨型陷阱/自动陷阱/陷阱机枪手 | 800~1200 | layTraps：方块密集区静止布防，敌人入 900 才 engage |
| 无人机 | 20% | 基础→狙击→监督者→霸主/死灵法师/经理/战列舰/工厂 | 500~800 | 保持距离 + 周期性 repel 收放无人机 |
| 撞击 | 10% | 基础→粉碎者→地雷/尖刺/自动粉碎；副线 侧卫→三角艇→加速器/战斗机 | 0~150 | 无视射程全速冲撞 |

**难度表**（与流派独立）：

| 参数 | 菜鸟 35% | 普通 45% | 高手 20% |
|---|---|---|---|
| decisionInterval | 30 tick | 15 tick | 7 tick |
| 瞄准抖动 | ±10° | ±5° | ±2° |
| 弹道预判 | 关 | 关 | 开 ×0.6 |
| 卡距离 | 不执行 | 50% 执行 | 执行 |
| 低血撤退 | 无 | HP<20% | HP<35% |
| 等级上限 | 30 | 40 | 45 |
| 无人机流可用 | 否 | 是 | 是 |

bot 升级：有升级点即按流派加点优先级表分配；达到 `levelRequirement` 按流派链 `setTank()` 进化（分叉随机取本流派分支）。

**验收门 C（红线逐条）**：
1. 静态检查：BotBrain 无任何绕过 Inputs 的直接状态修改；
2. 高手档连打 3 局，命中率明显低于完美预判（击杀统计佐证）；
3. 决策间隔实测均值 = 配置值（debug 日志统计）；
4. 30 秒窗口内同时攻击玩家的 bot 数常态 ≤2（无协同围殴）。

## 5. P4 触屏适配（1.5 天）

**新建** `client/touch.js`（唯一触屏逻辑文件）；**修改** `client/index.html`（引入脚本 + viewport meta）。

**输入映射表**：
| 触摸区 | 事件 | 转换为 |
|---|---|---|
| 左半屏按住 | 出现虚拟摇杆（起点=触点） | — |
| 左摇杆位移 | 每帧归一化 | W/A/S/D `keyDown/keyUp` 组合，死区 15% |
| 左摇杆松开 | | 四键全部 keyUp |
| 右半屏拖动 | 位移方向 | `input.mouse(x*scale, y*scale)` |
| 右半屏按住 | | `keyDown(1)` 开火；松开 `keyUp(1)` |
| 右半屏外拉 >1.4×摇杆半径 | | `keyDown(3)`（右键 repel），回落 `keyUp(3)` |

仅 `'ontouchstart' in window` 为真启用；`devicePixelRatio` 上限 1.5；canvas `touch-action:none`。

**验收门 D**：手机真机移动/开火/repel/升级面板点按可用；平板横屏可玩；桌面端与 P1 基线完全一致（回归）。

## 6. P5 中文化 + 进化树 + 图鉴（2.5 天）

**新建文件**：
| 文件 | 内容 |
|---|---|
| `i18n/zh-CN.ts` | 全部 UI 文案（菜单/按钮/公告/结算） |
| `i18n/tankDescriptions.zh-CN.ts` | 48 辆坦克中文介绍，每辆 2~3 行（定位/优劣势/打法） |
| `i18n/botNames.zh-CN.ts` | 按流派分组的中文名池（每流派 ≥10 个） |
| `tools/genTreeData.ts` | 读 TankDefinitions.json → 生成进化树/图鉴静态数据（复用原型 gen.py 的分层布局算法，翻成 TS；保证树边 = JSON upgrades 边，脚本断言 0 遗漏） |
| `client/overlay/` | menu（主菜单）、upgrade（升级/加点面板，发 `StatUpgrade=0x3`/`TankUpgrade=0x4` 标准消息）、codex（图鉴 + 收集点亮，localStorage 持久化） |

**修改文件**：服务端玩家可见字符串改读 `i18n/zh-CN.ts`；`client/index.html` 挂载 overlay。
**中文字体**：思源黑体子集化（界面字 + 常用 3500 字），目标 <500KB，构建时自动执行。

**验收门 E**：
1. 全流程无英文 UI 残留（逐屏截图核对）；
2. 进化树一致性断言通过（树上每条边 = JSON 每条 upgrades 边）；
3. 手机上进化树/图鉴可滚动可点按（触点 ≥44px）；
4. 图鉴 48 辆全有中文介绍，无占位符。

## 7. P6 集成测试（0.5~1 天）

1. 压测：临时脚本刷 30 个 45 级 bot 混战，测平均/峰值 tick 耗时（目标：峰值 < 40ms）；
2. 回归清单：完整一局（开局→练级→流派进化→bot 互战→清场→结算→重开）×2 次，桌面一次、手机浏览器一次；
3. 设计稿红线终审（4.3 节 6 条逐条打勾）；
4. 浏览器控制台 0 报错；服务端日志 0 异常栈。

## 8. P7 GitHub 私库上传（0.5 小时，命令逐条）

仓库根 = `d:/aaa/diep-solo-cn/`（文档、启动脚本、代码一体上传）：

```powershell
cd d:/aaa/diep-solo-cn
# 根目录新建 .gitignore：node_modules/ dist/ game/diepcustom/dist/ game/diepcustom/node_modules/
git init -b main
git add -A
git -c user.name="xuanmossdx" -c user.email="xuanmossdx@users.noreply.github.com" commit -m "坦克大乱斗：diep.io 单人AI乱斗版（SoloFFA + 流派AI + 回合清场 + 触屏 + 全中文，基于 diepcustom, AGPL-3.0）"
gh repo create diep-solo-cn --private --source=. --remote=origin --push
```

- 推送内容：`docs/`（设计稿+计划+测试日志）+ `game/diepcustom`（含全部改造）+ `启动游戏.bat` + `README.md`；
- 不推送：`node_modules/`、`dist/`、`docs/testlog.md` 之外的临时文件；
- 推送后用 `gh repo view` 确认私库可见、文件数正确、README 渲染正常。

## 9. P8 结束（无 AI 删除动作）

- 推送验证通过后，AI 在对话中明确宣告"上传完成，可以删除"；
- **用户手动删除 `d:/aaa/diep-solo-cn` 整个文件夹**（GitHub 已有全部内容，含文档）；
- AI 不执行任何删除操作。

## 10. 中断与回滚策略

- 任一阶段验收门不过：修复后重跑该阶段验收，最多重试 2 次；仍不过 → 停下写明现场，向用户报告；
- git 提交点：P1/P2/P3/P4/P5/P6 各完成时本地 commit 一次（不推送），保证可回退；
- P7 推送失败（网络/凭据）：重试 1 次后报告，不删除任何本地文件（P8 必须以推送成功为前提）。

## 11. 代码构成（回答"是不是大部分都有"）

| 部分 | 来源 | 占比 |
|---|---|---|
| 协议/物理/坦克/子弹/清场实体/客户端渲染 | diepcustom 现成 | ~60% |
| AI 行为层 + BotManager + 回合制 | 新写（调现成 API） | ~20% |
| 触屏适配 + 中文 UI 覆盖层 | 新写 | ~15% |
| 汉化（文案/名字池/图鉴/字体） | 新写（纯数据） | ~5% |
