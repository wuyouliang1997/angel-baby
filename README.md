# 天使宝宝 · 宝宝成长记录小程序

基于 **微信小程序 + 微信云开发** 的宝宝成长记录工具，帮助家长记录宝宝的喂养、生长、日常开支与礼金，并支持**家庭共享**，让多个家人共同参与记录。

## 功能特性

- 👶 **宝宝档案**：支持多个宝宝，录入昵称、性别、生日、头像（圆形裁剪）
- 🍼 **奶量记录与统计**：按天记录喂养奶量与次数，7 天趋势折线图
- 📏 **身高体重与生长分析**：记录身高体重，绘制成长趋势图
- 💰 **日常开支记账**：分类记账，支持按分类 / 时间段统计汇总
- 🧧 **礼金记录**：记录礼金来源，支持按时间段统计汇总
- 👨‍👩‍👧 **家庭共享**：创建者生成 6 位共享码，家人输入后即可共同查看与记录

## 技术栈

- 微信小程序（原生开发，无第三方 UI 框架）
- 微信云开发：云函数、云数据库、云存储
- 图表使用原生 Canvas 2D 绘制（无图表库）

## 目录结构

```
.
├── miniprogram/                 # 小程序前端
│   ├── app.js / app.json        # 全局配置、云初始化、页面注册
│   ├── pages/                   # 各页面（每屏一个目录）
│   └── components/baby-header/  # 宝宝信息头部组件
├── cloudfunctions/
│   └── quickstartFunctions/     # 唯一的云函数（后端全部逻辑）
├── project.config.json          # 小程序项目配置
├── uploadCloudFunction.sh       # 云函数部署脚本模板
├── CLAUDE.md                    # 面向 Claude Code 的架构说明
└── LICENSE                      # MIT 许可证
```

## 快速开始

### 1. 准备

- 安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
- 注册小程序并开通云开发，获取你的 AppID 与云环境 ID

### 2. 导入项目

用微信开发者工具打开项目根目录，并确认以下配置：

- `project.config.json` 中的 `appid` 换成你自己的 AppID（当前为 `wxf4f88e3bcf53a773`）
- `miniprogram/app.js` 中的云环境 ID 换成你自己的环境 ID（当前为 `cloud1-d9g4vd6odac1d447b`）

### 3. 部署云函数

在开发者工具中右键 `cloudfunctions/quickstartFunctions` →「上传并部署：云端安装依赖」。

> 后端只有一个云函数 `quickstartFunctions`，通过 `event.type` 分发到各处理函数。

### 4. 初始化数据库集合

首次使用时系统会自动创建所需集合；也可在云开发控制台手动创建以下集合：

| 集合 | 说明 |
| --- | --- |
| `babies` | 宝宝档案 |
| `milk_records` | 奶量记录 |
| `growth_records` | 身高体重记录 |
| `expense_records` | 日常开支记录 |
| `gift_records` | 礼金记录 |
| `family_shares` | 家庭共享关系 |

## 家庭共享

- 宝宝创建者在「家庭共享」页生成 6 位共享码
- 家人输入共享码即可加入，之后可共同查看与记录该宝宝的数据
- 仅宝宝创建者可编辑宝宝档案、管理共享成员；成员只能增删改自己创建的记录

## License

[MIT](./LICENSE)
