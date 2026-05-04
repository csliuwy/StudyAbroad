# Frontend

Vite + React web console for the study-tour business workflow.

## Routes

- `/` — Ops console
- `/projects/:projectId/modules/internal-information-collection` — Internal information collection for that project (table placeholder)

Legacy `/modules/internal-information-collection` redirects to `/`.

## Internal Information Collection layout (Excel)

The workbook is converted to `public/data/internal-info-collection-layout.json` (committed) so every project’s IIC page uses the same columns and header colors.

Regenerate after editing the Excel file (default path matches the author’s machine; pass your own path as argv):

```bash
node ../scripts/generate-internal-info-layout.mjs "C:\\path\\to\\file.xlsx"
```

Post-processing in `scripts/generate-internal-info-layout.mjs` (edit there if rules change):

- Sheet `Ref Iti（Horizontal）` is omitted entirely.
- Academic: sections whose first header cell contains `绿色部分由PM填写` are dropped (instruction banner row).
- Personal Info: sections whose first header cell contains `*注意项目学生生日` are dropped (orange instruction row).

- **Rooming List**: merges `Rooming List__r1` + `Rooming List__r4` into `Rooming List__combined` — drops the orange instruction header row; adds `bannerRows` (hotel list title + address, full width) above the unchanged green column header table.

- **Summary**: section `Summary__r3` is trimmed to five columns (`Students`, `Faculty`, `Guide`, `APA Onsite`, `Guest`) and one blank info data row under those headers.

- **Summary (labels / structure)**: `Summary__r8` gets table name `City-To-City Transfer`; `Summary__r17` gets `Accommodation` plus a gray subtitle (replaces old `titleAbove`); `Summary__r23` gets `Meeting Room`; `Summary__r29` is removed; `Summary__r36` gets `Daily Transportation` and a synthetic **Public Transportation Card** table (Deposit column = Included / Not included select). `Summary__r46` / `r55` / `r65` get table names **Guide**, **Cultural Experiences**, **Meals**.

- **Academic**: `Academic__r2` → table name **Requests**; `Academic__r9` → **Outreach Status**.

- **Rooming List** (`Rooming List__combined`): hotel list title is `editableTableName` + `tableName` default; address stays in `bannerRows`; `headerLabelsEditable` enables per-column header inputs (`table-layout: fixed`, full width).

- **Checklist**: body cells whose value is the string `false` render as checkboxes (checked when value is true/1/yes).

## Included views

- Collaboration chat input and proposal upload
- Research jobs status
- Budget/logistics/runbook quick actions
- Publish actions for Travefy/Wetu/file
- Partner and traveler audience views

## Run

```bash
npm install
npm run dev
```

Set backend URL in `src/App.tsx` if needed.
