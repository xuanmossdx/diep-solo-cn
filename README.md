# 坦克大乱斗（diep-solo-cn）

单人乱斗版 diep.io：1 名真人 + 25 名各流派 AI 坦克手互相厮杀，保留原版清场机制，全中文界面（含进化树与图鉴），支持手机/平板触屏。

基于开源项目 [diepcustom](https://github.com/abcxff/diepcustom)（AGPL-3.0）二次开发。

## 一键启动（Windows）

双击根目录 **`启动游戏.bat`**：

1. 首次运行自动安装依赖并构建（约 1~2 分钟）；
2. 自动启动本地服务器（端口 8180）；
3. 自动打开浏览器进入游戏。

停止：任务栏关闭 `diep-server` 窗口。

## 目录结构

```
diep-solo-cn/
├── 启动游戏.bat          # 一键启动
├── docs/                 # 设计稿与执行计划
│   ├── diepio-单机AI版设计稿.md
│   └── diepio-执行计划.md
└── game/diepcustom/      # 游戏服务端 + 客户端（含我们的全部改造）
```

## 文档

- 设计稿：`docs/diepio-单机AI版设计稿.md`
- 执行计划：`docs/diepio-执行计划.md`

## 许可

本项目基于 AGPL-3.0 授权的 diepcustom，相应义务见 `game/diepcustom/LICENSE`。
