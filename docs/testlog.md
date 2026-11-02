# 测试日志（diep-solo-cn）

## P1 基线（2026-11-02）

| 验收项 | 方法 | 结果 |
|---|---|---|
| 依赖安装与构建 | `npm ci` + `npm run build`（tsc --noEmit + tsup） | ✅ 通过，产物 `lib/index.js`（457KB） |
| 服务器启动 | `PORT=8180 node index.js` 后台 | ✅ HTTP 200 |
| 客户端加载 | playwright 打开，五阶段（PREPARE/FETCH/INSTANTIATE/INITIALIZE/START） | ✅ 全部完成，控制台 0 错误 |
| 中文昵称 | 输入"钢铁蜗牛"出生 | ✅ 画布正确渲染中文 |
| 移动 | keydown W | ✅ 坦克位移、世界滚动 |
| 开火 | 鼠标按下 | ✅ 子弹正常生成 |
| 升级 | 出生后击杀方块自动升到 Lv.2 | ✅ 经验条正常 |

**发现问题与修复**：
1. 启动脚本原判断 `dist\index.js`，实际构建产物是 `lib\index.js` → 已修正 `启动游戏.bat`；
2. 页面 DOM 中 "Loading..." 文本在游戏启动后仍残留（上游原样行为，不影响游玩），记录备查。

**一键启动脚本**：命令链路（npm ci / npm run build / node index.js / start http://localhost:8180）已逐段验证；完整双击测试留待 P6 回归。

## P2 服务端（2026-11-02 完成）

**交付**：`SoloFFA.ts`（地图 30000²、回合制、覆写排行榜合并 bot、永不 game.end）、`BotManager.ts`（25 bot 生命周期/重生/中文名池）、`BotSpawner.ts`（远离玩家出生）、`config.ts`（BOT_COUNT/ROUND_TICKS/ARENA_SIZE 环境变量）、`index.ts`（注册全部 10 个模式：FFA/Sandbox/Solo Brawl/2 Teams/4 Teams/Domination/Tag/Maze/Survival/Mothership）

| 验收项 | 方法 | 结果 |
|---|---|---|
| 构建 | tsc + tsup | ✅ 通过 |
| 10 模式注册 | `/api/servers` + 客户端按钮渲染截图 | ✅ 全部显示 |
| bot 生成与互战 | 连入 solo，BotDebug 日志 | ✅ 25 只生成，15s 内 25→22（互杀），排行榜中文 bot 名分数上涨 |
| 重生维持 | 长观察 bots=25 恒定 | ✅ |
| 清场倒计时公告 | ROUND_TICKS=600 实测 | ✅ 顶部红色横幅"清场倒计时 29 秒——清场者即将合围！"每秒更新 |
| 清场→新一局 | 同上 | ✅ 清场者合围收割 bot（alive 16→9→8），24s 后新一局自动开始，bot 刷新 |
| 服务端稳定 | 两轮压测日志 | ✅ 0 异常；30 分钟内存长测挪至 P6 |

**排查记录**：① 构建产物是 `lib/` 不是 `dist/`，启动脚本已修正；② 客户端 URL hash 会污染 API 地址（`location.href+"api/"`），模式选择必须点按钮不能用 hash；③ 页面点击坐标需按视口缩放换算（截图 1080 vs 视口 1280）。

**bot 互战机制确认**：FFA 下每台 Camera 自成小队（`Camera.ts:237`），`AI.findTarget` 只跳过同队 → 25 bot 天然互打，零代码成本（与设计稿预判一致）。

## P3 AI 行为层（2026-11-02 主体完成）

**交付**：`BotBuilds.ts`（五流派表 + 三难度表 + 每局流派配额袋）、`BotBrain.ts`（wander/engage/retreat/layTraps 状态机，继承 AI 只写 inputs）、`BotSpawner`（接流派参数）、`BotManager`（配额袋分配）、`config`（回合默认 30 分钟）、`TankBody`（solo 死亡保留完整等级）、`SoloFFA.spawnPlayer`（"(重新开始)"名字标记 → 等级加点清零）

| 验收项 | 方法 | 结果 |
|---|---|---|
| 构建 | tsc + tsup | ✅ |
| bot 按流派行动 | 连入 solo 观察 | ✅ bot 主动猎杀玩家（被"鳄鱼"击杀）、互战分数上涨、进化链生效（等级 15+ 自动进化） |
| 近战冲锋 | 代码审查 + 实战被击杀 | ✅ 强攻/撞击流派 moveForRange 无条件逼近，不风筝 |
| 卡距离 | 代码审查 | ✅ 风筝/铺场/无人机档按 [minDist,maxDist] 带 + 切向绕行 |
| 保留等级复活 | 死亡→重生流程实测（Lv1 情形） | ✅ 流程通；高等级情形待 P4 真机验收复核 |
| 重新开始 | 带"(重新开始)"名字出生 | ✅ 标记剥除、等级重置 |
| 红线静态审查 | grep 确认 BotBrain 无直改位置/血量/冷却 | ✅ 只写 inputs |

**本轮新增需求落实**：①流派每局随机数量（rollFlowBag 多项式抽取+洗牌，回合重置时重抽）；②近战流派主动接近；③死亡两种模式（保留等级=默认 / 重新开始=名字标记，P5 出按钮）；④服务端启动即 30 分钟一局自动循环。

**发现待修**：bot 中文名可能重复（水獭×2、三哈×2）——nextName 游标逻辑可重入，P5 中文化时一并去重。

**遗留**：P3 验收门 C 的"决策间隔实测/命中率观感/无围殴统计"待连续观测（P4 真机验收时一并做）。

## P4 触屏适配（进行中）
