# Notion Week Planner Widget

一个给 Notion 嵌入用的最小周课表组件。

这版专门服务于下面这个目标：

- 数据还存在 Notion 数据库里
- 页面按 `周一到周日 x 06:00-23:00` 渲染时间块
- 不同任务类型显示不同颜色
- 你改完数据库后，重新打开页面或点一下刷新，就会重新排版

## 技术路线

- GitHub：放代码
- Cloudflare Pages：托管前端页面
- Cloudflare Pages Functions：提供轻量 API
- Notion：作为数据后台和嵌入容器

## 当前结构

```text
public/
  index.html      # 前端页面
  styles.css      # 样式
  app.js          # 前端逻辑
  mock-week.json  # 本地无 token 时的演示数据

functions/
  api/week.js         # Cloudflare Pages Function API
  _shared/notion.js   # Notion 数据查询 + 转换
  _shared/time.js     # 周视图时间计算

scripts/
  dev-server.mjs      # 本地开发服务器
```

## 本地预览

这个仓库先不依赖额外 npm 包，方便最低成本起步。

### 1. 启动本地预览

用你本机可用的 Node 运行：

```powershell
C:\Users\25398\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe .\scripts\dev-server.mjs
```

打开：

[http://localhost:4173](http://localhost:4173)

如果你还没填 Notion token，页面会自动使用 `public/mock-week.json` 演示数据。

### 2. 主题

当前默认是深色主题，更适合直接嵌进 Notion 暗色模式。

- 页面右上角可以切换 `深色 / 浅色`
- 主题会保存在浏览器本地
- 也支持通过 URL 强制指定：
  - `?theme=dark`
  - `?theme=light`

## 接入真实 Notion 数据

### 1. 创建 Notion integration

在 Notion 开发者后台创建 integration，并拿到 API key。

### 2. 把数据库共享给 integration

至少共享这两个数据源对应的数据库：

- `周时间轴 / 全部计划`
- `课程表 / 固定安排`

### 3. 配环境变量

参考 `.dev.vars.example`：

```env
NOTION_API_KEY=secret_xxx
NOTION_MAIN_DATA_SOURCE_ID=4cb161d2-f20e-4d46-b25a-4050b2d4d699
NOTION_FIXED_DATA_SOURCE_ID=4dd44e91-2ba2-47df-88ef-e15a2b4aae0d
TIMEZONE=Asia/Shanghai
```

本地开发时把它们放进系统环境变量，或者手动创建 `.dev.vars` 后自行加载。

## Cloudflare Pages 部署

### 最低部署法

1. 把这个仓库推到 GitHub
2. Cloudflare Pages 连接这个 GitHub repo
3. 构建输出目录设为 `public`
4. 保留 `functions/` 目录，Pages 会把它当作 Functions
5. 在 Cloudflare Pages 项目里配置环境变量：
   - `NOTION_API_KEY`
   - `NOTION_MAIN_DATA_SOURCE_ID`
   - `NOTION_FIXED_DATA_SOURCE_ID`
   - `TIMEZONE`

部署后会得到一个公网地址，比如：

`https://your-project.pages.dev`

然后在 Notion 里用 `/embed` 嵌进去。

## 当前假设

这版是“最低可用”版，所以做了几个保守假设：

- 主库里的临时安排优先从 `日期` 这种 date 属性里读开始/结束时间
- 固定课表优先读：
  - `是否启用`
  - `星期`
  - `开始时间`
  - `结束时间`
  - `本次日期`（可选，用于单次覆盖）
- 如果你的字段名后面变了，需要同步改 `functions/_shared/notion.js`

## 下一步建议

第一轮先别追求“可编辑”。先把这三件事跑稳：

1. 主库数据读通
2. 前端样式嵌进 Notion 后好看
3. 固定课表和临时安排在同一周视图里正确叠出来

等这版稳定后，再补：

- 点击事件打开 Notion 原页面
- 冲突重叠时自动分栏
- 只看学习 / 只看项目的筛选
- 手机版紧凑布局
