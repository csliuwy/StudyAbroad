# StudyTour Web 版本记录（Ops + Internal Information Collection）

> 用途：追踪每次改动的功能与涉及文件，便于回顾与手工恢复。完整代码以仓库为准；恢复某版本请优先使用 **Git** 检出对应提交。

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

## 1.3 — IIC 本机保存、页头精简、列宽与单元格内边距（当前）

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

## 版本号约定（建议）

- **1.x**：用户可见功能或默认数据/布局变更。
- 文档仅记 **摘要 + 文件列表**；大块 diff 以版本控制工具为准。
