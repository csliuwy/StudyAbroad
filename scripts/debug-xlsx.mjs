import ExcelJS from "exceljs";

const path =
  process.argv[2] ||
  "C:\\Users\\21173\\Documents\\xwechat_files\\wxid_2swynsci7a1322_9b49\\msg\\file\\2026-05\\APA  University Country Theme Month Year Program Info Collection - Internal Info Collection.xlsx";

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(path);
console.log("Sheets:", wb.worksheets.map((s) => s.name));
for (const ws of wb.worksheets) {
  console.log("\n===", ws.name, "===");
  console.log("rowCount", ws.rowCount, "colCount", ws.columnCount);
  const merges = ws.model?.merges?.length ?? 0;
  console.log("merges", merges);
  const maxRow = Math.min(ws.rowCount || 0, 25);
  for (let r = 1; r <= maxRow; r++) {
    const row = ws.getRow(r);
    const cells = [];
    for (let c = 1; c <= Math.min(ws.columnCount || 20, 16); c++) {
      const cell = row.getCell(c);
      const v = cell.value;
      const text =
        v == null
          ? ""
          : typeof v === "object" && v !== null && "richText" in v
            ? v.richText?.map((t) => t.text).join("") ?? ""
            : typeof v === "object" && v !== null && "text" in v
              ? String(v.text)
              : String(v);
      const fill = cell.fill;
      let bg = "";
      if (fill && fill.type === "pattern" && fill.fgColor) {
        const argb = fill.fgColor.argb;
        if (argb) bg = `#${String(argb).slice(-6)}`;
      }
      if (text || bg) cells.push(`${c}:${JSON.stringify(text).slice(0, 40)}${bg ? `[${bg}]` : ""}`);
    }
    if (cells.length) console.log(`R${r}`, cells.join(" | "));
  }
}
