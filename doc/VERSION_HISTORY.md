# StudyTour Web 版本记录（Ops + Internal Information Collection）

> 用途：追踪每次改动的功能与涉及文件，便于回顾与手工恢复。完整代码以仓库为准；恢复某版本请优先使用 **Git** 检出对应提交。

**协作约定（给后续对话 / 助手）**：实现功能或回答问题前，应**经常重新阅读本文件**，核对版本摘要与用户曾下达的指令、术语，避免遗忘。每完成一轮**用户可见**或**默认数据/布局**相关改动，按下方「版本号约定」**追加新版本小节**（命名清晰、可回溯）。

---

## 1.0 — 基线（本文件建立前的能力摘要）

**范围**：StudyTour Ops 控制台（`/`）、按项目的 Internal Information Collection（`/projects/:id/modules/internal-information-collection`）、本地 API（`http://localhost:8080/api`）。

**前端（代表性）**

- `frontend/src/App.tsx` — 路由：`/`、`/projects/:projectId/modules/internal-information-collection`。
- `frontend/src/pages/OpsHomePage.tsx` — 项目列表（单选）、创建项目、模块入口、协作/预算等演示区。
- `frontend/src/pages/InternalInformationCollectionPage.tsx` — Excel 导出的 JSON 布局渲染；`SectionTable`、列宽拖拽、`IicGrowTextarea` 等。
- `frontend/src/pages/internalInfoLayout.ts` — `InternalInfoSection` 类型（含 `displayMode: tableNameOnly` 等）。
- `frontend/vite.config.ts` — 开发端口 **5180**、`strictPort: true`（避免与其它本地 Vite 抢 5173）。
- `frontend/public/data/internal-info-collection-layout.json` — 由 `scripts/generate-internal-info-layout.mjs` 生成（**仓库根目录**：`node scripts/generate-internal-info-layout.mjs`；**已在 `scripts` 目录**：`node generate-internal-info-layout.mjs` 或 `npm run generate-layout`）。

**后端（代表性）**

- `backend/src/routes/projects.ts` — `GET/POST /projects`、`GET /projects/:id` 及 chat、proposal、budget 等子路由。
- `backend/src/services/store.ts` — 内存 `db`、创建项目等。

---

## 1.1 — 项目操作菜单 + 表格更紧凑 + API 补全

**日期**：2026-05-03（文档写入日）

### 功能

1. **Ops「Project」每一行**
   - 右侧 **竖三点** 按钮打开下拉菜单（主流「更多」样式）。
   - 菜单项：**编辑**（展开行内重命名栏：输入框 + 保存 / 取消）、**删除**（确认后删除项目）。
   - 点击菜单外关闭；选择项目仍通过左侧 **radio + 项目名称**。
2. **表格单元格更紧凑**
   - 全站 `.data-table th/td` 及 IIC 相关（表头输入、单元格输入、banner 单元、项目行卡片等）**padding 约减 30%**（例如 `10px 12px` → `7px 8px`），表框更贴近文字。
3. **后端**
   - `PATCH /api/projects/:projectId` — body 支持 `name`、`destination`（至少一项）。
   - `DELETE /api/projects/:projectId` — 删除项目并 **级联** 清理 itinerary、thread、researchJobs、publishes、proposals、researchFindings。
4. **前端项目列表与删除后状态**
   - `loadProjects`：若当前选中 id 已不在列表中，自动改选剩余第一项或清空。
   - `projectId` 为空时清空 `detail` / `jobs` / `publishes`，避免幽灵数据。

### 涉及文件（代码）

| 路径 | 说明 |
|------|------|
| `frontend/src/pages/OpsHomePage.tsx` | `renameProject` / `deleteProjectById`；`OpsProjectRowMenu`；`projectActionMenuId` / `renameTargetId`；项目行结构 |
| `frontend/src/styles.css` | `.ops-project-*` 菜单与重命名栏；表格与 IIC padding 收紧 |
| `backend/src/routes/projects.ts` | `patchProjectSchema`、`PATCH`、`DELETE` 路由 |
| `backend/src/services/store.ts` | `deleteProjectCascade` |
| `doc/VERSION_HISTORY.md` | 本版本记录 |

### 恢复提示

- 若使用 Git：`git log --oneline -- doc/VERSION_HISTORY.md frontend/src/pages/OpsHomePage.tsx` 找到 1.1 提交后 `git checkout <commit> -- <paths>`。
- 无 Git 时：以本文件「涉及文件」为清单，从备份或 IDE 本地历史逐文件恢复。

---

## 1.2 — IIC 表格统一 padding、行程表重命名、Personal 可编辑表头+插行、Rooming 布局

**日期**：2026-05-03

### 功能

1. **Internal Information Collection 页内所有表格单元格**  
   在 `.iic-page` 下对 `.data-table` 与 `.iic-banner-table` 的 `th`/`td` 统一 **`padding: 7px 8px`**（与此前「约减 30%」目标一致）。
2. **工作表标题**  
   Excel 工作表 `Itinerary (template)请修改这个` 在生成 JSON 中显示为 **`Itinerary`**（`layout.sheets[].name` 与各 section 的 `sheetName`）。
3. **Personal Info**  
   该 sheet 下所有 section：`headerLabelsEditable: true`、`allowRowInsert: true`；前端表格下显示 **「插入行」**（仅前端追加空行）。
4. **Rooming List**  
   - 酒店名行与地址行从原合并 banner 拆成 **`bannerTextFields`**，各自为与 **表名** 相同样式的可编辑 `textarea`（`iic-table-name-input`）。  
   - **section 卡片** `overflow-x: auto`、`stacked` 使用 `width:100%` + `min-width:0`，宽表横向滚动收在卡片内，不再挤出 section。
5. **布局类型**（`internalInfoLayout.ts`）  
   新增 `bannerTextFields`、`allowRowInsert` 可选字段。

### 涉及文件

| 路径 | 说明 |
|------|------|
| `scripts/generate-internal-info-layout.mjs` | `splitHotelAddressBlock`、`bannerTextFields`；`renameItinerarySheet`、`transformPersonalInfoSheet`；`transformSheetPost` 串联 |
| `frontend/public/data/internal-info-collection-layout.json` | 重新生成 |
| `frontend/src/pages/internalInfoLayout.ts` | 类型 `InternalInfoBannerTextField`、`bannerTextFields`、`allowRowInsert` |
| `frontend/src/pages/InternalInformationCollectionPage.tsx` | `bannerTextFields` 渲染；`bodyRows` + 插入行 |
| `frontend/src/styles.css` | `.iic-sheet-card` 溢出；`.iic-stacked-tables` / `.iic-table-wrap`；`.iic-banner-text-stack`；`.iic-page` 表格 cell padding |
| `doc/VERSION_HISTORY.md` | 1.2 记录 |

### 恢复提示

同 1.1：优先 Git；无 Git 时按上表逐文件恢复。

---

## 1.3 — IIC 本机保存、页头精简、列宽与单元格内边距

**日期**：2026-05-03

### 功能

1. **页头**  
   去掉副标题、布局来源/生成时间说明、以及 Excel 表头色与 `generate-internal-info-layout` 的长段操作提示（仍可在本文件与 `scripts/package.json` 的 `generate-layout` 脚本中查阅命令）。
2. **保存（按项目）**  
   工具栏 **「保存」**：把当前页 DOM 中的表名、banner 行、表头、单元格、列宽等写入 **`localStorage`**，键 `studytour:iic:v1:${projectId}`；进入页面时自动合并到布局 JSON。说明文案提示数据保存在本机浏览器。
3. **表格视觉**  
   表头/单元格内 `textarea` 内边距与外层 `th`/`td` 的 `7px 8px` 对齐（内层 `padding: 0`），整体更紧。
4. **Personal Info、Rooming List 初始列宽**  
   在未保存过列宽时，按表头文案单行宽度估算列宽（canvas 测量 + 余量）；保存后的列宽以持久化数据为准。表头仍可编辑。

### 涉及文件

| 路径 | 说明 |
|------|------|
| `frontend/src/pages/InternalInformationCollectionPage.tsx` | `applyOverlay` / `collectPersistFromPage`；`data-iic-section` / `data-iic-field`；保存按钮与 `localStorage`；`measureHeaderTextWidthPx`；`SectionTable` 初始列宽逻辑 |
| `frontend/src/styles.css` | `.iic-page-toolbar`、`.iic-save-*`；`.iic-cell-input` 内边距 |
| `doc/VERSION_HISTORY.md` | 本版本记录 |

### 恢复提示

同 1.1。

---

## 1.4 — 对话术语约定 + 版本文档维护指令（当前）

**日期**：2026-05-04

### 功能 / 范围

1. **用户与助手对话中的统一称呼（术语表，本地开发默认）**  
   - **`http://localhost:5180`**（StudyTour Ops 根路由 `/`）：简称 **「系统」**、**「系统主页」**、**「主页」** 或 **「home page」**。  
   - **`http://localhost:5180/projects/:projectId/modules/internal-information-collection`**（示例：`…/projects/project_spq16sv4/modules/…`）：简称 **「IIC页」** 或 **「IIC」**（即 Internal Information Collection 模块页）。
2. **版本记录**  
   以后每改一个版本，均在本文件按 **1.1、1.2…** 同样结构**追加一节**：版本命名清晰、便于 Git/手工回溯；总结功能与涉及文件。
3. **防遗忘**  
   助手在持续迭代中应**经常重读**本文件，对照历史小节与用户指令，避免遗漏约定（含上表术语）。

### 涉及文件

| 路径 | 说明 |
|------|------|
| `doc/VERSION_HISTORY.md` | 本版本：术语表 + 协作维护说明 |

### 恢复提示

同 1.1。

---

## 1.5 — 域名访问（studyabroad.martxdata.com）与 API 基址

**日期**：2026-05-05

### 功能 / 范围

1. **问题**：前端写死 `http://localhost:8080/api` 时，通过域名打开页面后，浏览器仍请求用户本机的 localhost，列表与接口失败。  
2. **解决**：`frontend/src/apiBase.ts` 的 **`resolveApiBase()`** — 优先 **`VITE_API_BASE_URL`**；开发模式用**当前页面的 hostname + 8080**；生产构建默认同源 **`/api`**（需 Nginx 等把 `/api` 反代到后端）。  
3. **Vite**：`server.host: true`，便于通过指向本机 IP 的域名访问开发服务（如 `http://studyabroad.martxdata.com:5180`）。  
4. **访问示例**（DNS 已指向本机时）  
   - 开发：前端 `http://studyabroad.martxdata.com:5180`，API 自动为 `http://studyabroad.martxdata.com:8080/api`（后端需在本机 8080 监听，防火墙放行）。  
   - 生产：静态资源 + `/api` 反代到同一域名时，使用 `npm run build` 后的默认 `/api` 即可；若 API 路径不同，设置 **`VITE_API_BASE_URL`**。  
5. **术语补充（与 1.4 并列）**：经域名访问时，**「系统」** 亦可指 **`http(s)://studyabroad.martxdata.com[:5180]/`**（以实际部署端口为准）。

### 涉及文件

| 路径 | 说明 |
|------|------|
| `frontend/src/apiBase.ts` | `resolveApiBase()` |
| `frontend/src/pages/OpsHomePage.tsx` | 使用 `resolveApiBase()`；错误提示 |
| `frontend/src/pages/InternalInformationCollectionPage.tsx` | 使用 `resolveApiBase()` |
| `frontend/vite.config.ts` | `server.host: true` |
| `frontend/.env.example` | `VITE_API_BASE_URL` 说明 |
| `frontend/src/vite-env.d.ts` | `ImportMetaEnv.VITE_API_BASE_URL` |
| `doc/VERSION_HISTORY.md` | 本版本记录 |

### 恢复提示

同 1.1。

---

## 1.6 — 域名默认 80 端口（无 :5180）与 Nginx 示例

**日期**：2026-05-05

### 功能 / 范围

1. **目标**：浏览器访问 **`http://studyabroad.martxdata.com/`**（不显式端口）与生产构建的前端一致；`/api` 反代到本机 **8080** 后端。  
2. **配置**：`deploy/studyabroad.martxdata.com.conf.example` — **`root` 使用 `/var/www/studyabroad`**（由 `frontend/dist` 拷贝而来，`nginx` 用户可读；勿指向 `/root/...` 否则会 500）。含 **`/api/`**、**`/uploads/`** 反代；注释内另有「经 80 反代到 Vite 5180」可选块。  
3. **开发模式经 Nginx 走 80**：`resolveApiBase()` 在页面为 **80/443** 时使用同源 **`/api`**，避免仍请求 **`:8080`**。  
4. **Vite**：`server.allowedHosts: true`，便于 `Host: studyabroad.martxdata.com` 反代到 `npm run dev`。

### 涉及文件

| 路径 | 说明 |
|------|------|
| `deploy/studyabroad.martxdata.com.conf.example` | Nginx 示例 |
| `frontend/src/apiBase.ts` | 80/443 下 dev 使用 `/api` |
| `frontend/vite.config.ts` | `allowedHosts` |
| `doc/VERSION_HISTORY.md` | 本版本记录 |

### 恢复提示

同 1.1。

---

## 1.7 — 仓库路径改为 `~/code/StudyAbroad` 与静态发布脚本

**日期**：2026-05-05

### 功能 / 范围

1. **本机/服务器**：仓库目录由 **`…/studyabroad/StudyAbroad`** 迁至 **`…/code/StudyAbroad`**，避免与仓库根同名混淆；**不影响** `http://studyabroad.martxdata.com/`（域名与磁盘路径无关）。  
2. **发布**：新增 **`scripts/deploy-static-to-www.sh`**（`frontend` 下 `npm run build` → 拷贝至 **`/var/www/studyabroad`** → `chown` → `nginx -t` → `reload`）；根目录 **`npm run deploy:www`** 调用之（需 sudo）。  
3. **文档**：`doc/README.md` 补充「总结只放 `StudyAbroad/doc`」与「克隆路径 / 域名 / Nginx `root` 对照」说明。

### 涉及文件

| 路径 | 说明 |
|------|------|
| `scripts/deploy-static-to-www.sh` | 构建 + 同步 `/var/www/studyabroad` + reload nginx |
| `package.json` | `deploy:www` |
| `README.md` | 建议路径与 `deploy:www` |
| `doc/README.md` | 路径与域名约定 |
| `doc/VERSION_HISTORY.md` | 本版本记录 |

### 恢复提示

同 1.1。

---

## 1.8 — 品牌标识、地址栏图标与页脚备案

**日期**：2026-05-05

### 功能 / 范围

1. **Logo（使命：游学规划与协作执行）**：矢量标 **`public/brand/studytour-mark.svg`**（512 主标）、**`studytour-mark-sm.svg`**（32 简标）、**`public/favicon.svg`**（标签页）；**`public/apple-touch-icon.png`**（约 192×192，iOS / 主屏）。  
2. **页眉**：顶栏品牌链使用 **40×40** 标 + 文案。  
3. **页脚（全站）**：版权与技术支持邮箱 **support@denglu.net.cn**；**京ICP备15013491号-1** 链至 **beian.miit.gov.cn**（曾含 **-13** 条目，已于 **1.10** 删除）。  
4. **`index.html`**：`lang="zh-CN"`、**theme-color**、**description**、**favicon** / **apple-touch-icon**。

### 涉及文件

| 路径 | 说明 |
|------|------|
| `frontend/public/brand/studytour-mark.svg` | 主标 |
| `frontend/public/brand/studytour-mark-sm.svg` | 简标 |
| `frontend/public/favicon.svg` | 浏览器图标 |
| `frontend/public/apple-touch-icon.png` | 触控图标 |
| `frontend/src/components/SiteFooter.tsx` | 页脚 |
| `frontend/src/App.tsx` | 顶栏 Logo、包裹 `site-main-wrap` |
| `frontend/src/styles.css` | 顶栏标、页脚、整页 flex 布局 |
| `frontend/index.html` | meta / link |
| `doc/VERSION_HISTORY.md` | 本版本记录 |

### 恢复提示

同 1.1。

---

## 1.9 — 静态资源根路径与部署后 502 说明

**日期**：2026-05-05

### 功能 / 范围

1. **`publicUrl()`**（`frontend/src/publicUrl.ts`）：`public/` 下资源在任意前端路由下均以**站点根路径**解析（如 `/brand/…`、`/data/…`），避免相对路径在 `/projects/…` 下错请求 `/projects/brand/…`。  
2. **`vite.config.ts`**：显式 **`base: '/'`**。  
3. **`deploy-static-to-www.sh`**：部署后 **`curl 127.0.0.1:8080/health`**，不可达时提示 **Nginx `/api` 502**（后端未起）。  
4. **`deploy/studytour-backend.service.example`**：可选 systemd，开机自启 **8080**。

### 涉及文件

| 路径 | 说明 |
|------|------|
| `frontend/src/publicUrl.ts` | 新增 |
| `frontend/src/App.tsx` | Logo 使用 `publicUrl` |
| `frontend/src/pages/InternalInformationCollectionPage.tsx` | layout JSON 使用 `publicUrl` |
| `frontend/vite.config.ts` | `base: '/'` |
| `scripts/deploy-static-to-www.sh` | 健康检查提示 |
| `deploy/studytour-backend.service.example` | 可选 systemd |
| `doc/VERSION_HISTORY.md` | 本版本记录 |

### 恢复提示

同 1.1。

---

## 1.10 — Logo 顶栏裁切、多格式 favicon、备案文案

**日期**：2026-05-05

### 功能 / 范围

1. **Logo**：修正 **`studytour-mark.svg` / `studytour-mark-sm.svg` / `favicon.svg`** 中损坏的 XML 注释（控制字符会导致部分渲染器失败）；**扩大 viewBox 上边距**（`preserveAspectRatio="xMidYMid meet"`），避免弧线与三角在顶栏小尺寸下被裁切。  
2. **顶栏样式**：**`.site-brand-with-mark`** 设 **`line-height: 0`**，**`.site-logo`** 设 **`object-fit` / `object-position`**，减少内联替换元素与行高导致的上下裁切。  
3. **地址栏图标**：新增 **`favicon.ico`**（多尺寸）、**`favicon-32x32.png`**；**`index.html`** 优先声明 ICO/PNG，再声明 SVG，以兼容仅支持位图标签页的浏览器；补全 **`apple-touch-icon.png`**（192×192）。  
4. **页脚备案**：删除文案 **「京ICP备15013491号-13」** 及其链接，保留 **「京ICP备15013491号-1」** 及版权、技术支持邮箱等其余内容。  
5. **部署脚本**：若存在并已配置的 **`studytour-backend`** systemd 单元，则在静态部署后 **`systemctl restart`**；否则打印说明，提醒手动重启后端。

### 涉及文件

| 路径 | 说明 |
|------|------|
| `frontend/public/brand/studytour-mark.svg` | viewBox / 注释修复 |
| `frontend/public/brand/studytour-mark-sm.svg` | 同上 |
| `frontend/public/favicon.svg` | 同上 |
| `frontend/public/favicon.ico` | 新增 |
| `frontend/public/favicon-32x32.png` | 新增 |
| `frontend/public/apple-touch-icon.png` | 新增（生成） |
| `frontend/index.html` | 多 `link rel="icon"` |
| `frontend/src/styles.css` | 顶栏 Logo / 品牌文案行高 |
| `frontend/src/components/SiteFooter.tsx` | 移除 -13 备案 |
| `scripts/deploy-static-to-www.sh` | 可选后端 restart |
| `doc/2026-05-05_主页与品牌与备案修正结论.md` | 当日结论摘要 |
| `doc/VERSION_HISTORY.md` | 本版本记录 |

### 恢复提示

同 1.1。

---

## 2.0 — 安全加固（HTTP 头、CORS、限流、上传与 projectId）

**日期**：2026-05-05

### 功能 / 范围

1. **Helmet**（关闭 CSP/COEP 以免干扰纯 JSON API）、**可配置 CORS**（`CORS_ORIGIN`；生产默认 `origin: false` 利于同源反代）、**全局限流**（`/health` 跳过）与 **提案上传限流**。  
2. **`TRUST_PROXY`**：反代后正确识别客户端 IP（限流）。  
3. **`projectId`**：全路由 **`router.param`** 校验 `project_` + base36，防路径段滥用。  
4. **Multer**：**类型**（pdf/doc/docx）、**大小**（`PROPOSAL_MAX_BYTES`，默认 12MB 上限 20MB）、单文件；处理完后 **删除临时文件**；`storagePath` 不再持久化真实磁盘路径。  
5. **输入**：聊天正文、runbook 标题 **最大长度**；生产可通过 **`EXPOSE_API_ROOT=false`** 收缩 `GET /` 信息。  
6. **`/uploads` 静态**：**禁止点文件**、无目录索引。  
7. **前端**：`referrer` meta **strict-origin-when-cross-origin**。  
8. **构建**：`pdf-parse` 补充 **`src/types/pdf-parse.d.ts`**，`tsconfig` 包含 `*.d.ts`。

### 涉及文件

| 路径 | 说明 |
|------|------|
| `backend/src/middleware/httpSecurity.ts` | CORS、限流、projectId 校验 |
| `backend/src/server.ts` | Helmet、trust proxy、错误处理、静态选项 |
| `backend/src/routes/projects.ts` | Multer、param、unlink、文案文件名净化 |
| `backend/src/types/pdf-parse.d.ts` | 类型声明 |
| `backend/tsconfig.json` | include `*.d.ts` |
| `backend/.env.example` | 安全相关变量 |
| `backend/package.json` / 根 lock | `helmet`、`express-rate-limit` |
| `frontend/index.html` | referrer |
| `README.md` | 安全说明 |
| `doc/VERSION_HISTORY.md` | 本版本记录 |

### 恢复提示

同 1.1。生产若跨域调 API，必须配置 **`CORS_ORIGIN`**。

---

## 版本号约定（建议）

- **1.x**：用户可见功能或默认数据/布局变更。
- 文档仅记 **摘要 + 文件列表**；大块 diff 以版本控制工具为准。
