# 个人工作台

一个在本机运行的个人工作台，用来管理待办事项、查看完成统计、整理常用链接。采用原生 HTML、CSS 和 JavaScript，数据通过 HTTP API 保存到 SQLite，无第三方运行时依赖。

## 本地运行

需要 Node.js 22.13 或以上。克隆或下载此仓库后，在项目根目录打开终端。可先用 `node --version` 检查版本，无需执行 `npm install`。

```powershell
npm run build
npm start
```

打开 [个人工作台](http://127.0.0.1:4173)。终端出现 `Local:` 表示服务已启动，按 `Ctrl+C` 停止。日常启动可直接运行 `npm start`；修改源码后先重新构建，再启动。

## 数据与隐私

- 首次启动会自动建立空数据库并运行迁移。数据默认保存在 `data/workbench.sqlite`（SQLite WAL 模式）。备份或恢复前先停止服务，再复制或还原整个 `data/` 目录。
- 可用 `PORT` 和 `DATA_DIR` 环境变量更改端口及数据目录。例如 PowerShell 中运行 `$env:PORT = '4174'` 后再执行 `npm start`。自定义数据目录建议放在仓库之外。
- 服务仅监听 `127.0.0.1`，应用本身没有登录认证。若要通过反向代理提供远程访问，应先在代理层配置身份验证。
- 提交代码或报告问题时请使用虚构示例，避免夹带数据库、真实待办和链接、账号凭据或部署标识。

## 架构与目录

- frontend/：HTML、CSS、JavaScript、SVG 网站图标，前端通过 /api 调用后端。
- worker/api.js：后端接口、校验、参数化 SQL；数据不使用浏览器 localStorage。
- drizzle/：数据库 SQL 迁移与迁移日志；已应用的迁移保持不变，后续变更追加迁移。
- scripts/build.mjs：将独立前端资源与 API 打包为可部署的 Worker。
- scripts/dev.mjs：本地 HTTP 服务与 Node SQLite 适配器；启动时自动应用待执行迁移。
- tests/api.test.mjs：真实 SQLite 集成测试，包含关闭并重启服务的持久化验证。
- .openai/hosting.json：可选的私有 Sites 部署配置，由部署者在本机维护。

前端与 API 在同一地址提供服务。可选的 Sites 部署使用 Cloudflare Worker 和 D1，须由部署者启用访问控制。D1 与本地 SQLite 相互独立，不自动同步。

## 功能

- 事项：标题、备注、优先级、截止日期；添加、编辑、删除、完成及恢复；筛选与搜索；逾期提示。
- 完成情况：总完成率环形图、最近七天完成柱状图、完成记录。按香港时区统计；恢复待办会移除其当前完成时间，再次完成时重新记时。
- 工具：名称、HTTP/HTTPS 地址、简介；添加、编辑、删除；在新标签页打开。
- 适配桌面与手机、明显的当前导航状态、胶囊按钮、自定义 SVG favicon、空状态及错误重试。

## API

| 方法 | 地址 | 行为 |
| --- | --- | --- |
| GET | /api/tasks、/api/tools | 列出记录 |
| POST | /api/tasks、/api/tools | 新建记录 |
| PATCH | /api/tasks/:id | 编辑事项，或仅传 {"completed": true/false} 更新状态 |
| PATCH | /api/tools/:id | 编辑工具 |
| DELETE | /api/tasks/:id、/api/tools/:id | 删除记录 |

事项字段为 title、notes、priority（high/medium/low）、due_date（YYYY-MM-DD 或空串）。工具字段为 name、url、description。返回错误形如 {"error":"说明"}。

## 开发与验证

```powershell
npm run check
```

该命令依次构建、执行 API 集成测试并验证 Worker 入口。测试使用独立的临时数据库，包括服务重启后的数据持久化检查。新增数据库变更时，请追加迁移并更新迁移日志。

如果你已有 Sites 项目，将 .openai/hosting.json 保存在本机，配置 `DB` 绑定，然后执行 `npm run build:sites` 和 `npm run validate -- --sites`。部署归档及数据库均应保存在公开仓库之外。更新已有部署时，请沿用现有项目和数据库绑定。

欢迎提交 Issue 或 Pull Request。报告故障时，请附上 Node.js 版本、复现步骤和脱敏后的错误信息。

## 许可证

本项目采用 [MIT 许可证](LICENSE)。

不包含多用户账号体系、协作共享、附件或通知，保持个人应用简单易维护。
