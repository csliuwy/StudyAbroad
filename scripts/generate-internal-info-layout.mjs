/**
 * Reads the APA Internal Info Collection workbook and emits a JSON layout
 * for the web app: each worksheet -> one or more sections (split on colored header rows).
 *
 * Usage:
 *   node generate-internal-info-layout.mjs [path-to-xlsx] [output-json]
 */
import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";

const defaultInput =
  "C:\\Users\\21173\\Documents\\xwechat_files\\wxid_2swynsci7a1322_9b49\\msg\\file\\2026-05\\APA  University Country Theme Month Year Program Info Collection - Internal Info Collection.xlsx";

const inputPath = path.resolve(process.argv[2] || defaultInput);
const outputPath = path.resolve(
  process.argv[3] || path.join("..", "frontend", "public", "data", "internal-info-collection-layout.json")
);

function cellText(cell) {
  const v = cell.value;
  if (v == null || v === "") return "";
  if (typeof v === "object" && v !== null) {
    if (Array.isArray(v)) return v.map((x) => String(x)).join(" ");
    if ("richText" in v && Array.isArray(v.richText)) {
      return v.richText.map((t) => t.text).join("");
    }
    if ("text" in v && typeof v.text === "string") return v.text;
    if ("result" in v && v.result != null) return String(v.result);
    if (v instanceof Date) return v.toISOString();
  }
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function cellBgHex(cell) {
  const fill = cell.fill;
  if (!fill || fill.type !== "pattern") return null;
  const argb = fill.fgColor?.argb;
  if (!argb || typeof argb !== "string") return null;
  const hex = `#${argb.slice(-6)}`.toUpperCase();
  if (hex === "#FFFFFF") return null;
  return hex;
}

function rowUsedMaxColumn(row, hardMax = 64) {
  let max = 0;
  row.eachCell({ includeEmpty: false }, (cell, col) => {
    if (col > max) max = col;
  });
  if (max === 0) {
    for (let c = 1; c <= hardMax; c += 1) {
      const t = cellText(row.getCell(c));
      if (t) max = c;
    }
  }
  return Math.min(max || 0, hardMax);
}

function isRowMostlyEmpty(row, maxCol) {
  let nonEmpty = 0;
  for (let c = 1; c <= maxCol; c += 1) {
    if (cellText(row.getCell(c)).trim()) nonEmpty += 1;
  }
  return nonEmpty <= 1;
}

function isHeaderRow(row, maxCol) {
  let textCount = 0;
  let coloredNonWhite = 0;
  for (let c = 1; c <= maxCol; c += 1) {
    const cell = row.getCell(c);
    const t = cellText(cell).trim();
    if (t) textCount += 1;
    if (cellBgHex(cell)) coloredNonWhite += 1;
  }
  if (textCount < 2) return false;
  if (coloredNonWhite >= 2) return true;
  if (coloredNonWhite >= 1 && textCount >= 3) return true;
  return false;
}

function rowToValues(row, fromCol, toCol) {
  const out = [];
  for (let c = fromCol; c <= toCol; c += 1) {
    out.push(cellText(row.getCell(c)).trim());
  }
  return out;
}

function headerColumnRange(headerRow, maxCol) {
  let minC = null;
  let maxC = 0;
  for (let c = 1; c <= maxCol; c += 1) {
    const cell = headerRow.getCell(c);
    const t = cellText(cell).trim();
    const bg = cellBgHex(cell);
    if (t || bg) {
      if (minC == null) minC = c;
      maxC = c;
    }
  }
  if (minC == null) return null;
  return { minCol: minC, maxCol: maxC };
}

function widenColRangeWithPeekRows(worksheet, headerRowNum, minCol, maxCol, lastRow, peek = 8, hardMaxCol = 64) {
  let minC = minCol;
  let maxC = maxCol;
  const end = Math.min(headerRowNum + peek, lastRow);
  for (let r = headerRowNum + 1; r <= end; r += 1) {
    const row = worksheet.getRow(r);
    for (let c = 1; c <= hardMaxCol; c += 1) {
      if (cellText(row.getCell(c)).trim()) {
        if (c < minC) minC = c;
        if (c > maxC) maxC = c;
      }
    }
  }
  return { minCol: minC, maxCol: maxC };
}

function extractSectionsFromSheet(worksheet) {
  const sheetName = worksheet.name;
  const dim = worksheet.dimensions;
  const lastRow = dim ? dim.bottom : worksheet.rowCount || 0;
  const hardMaxCol = Math.min(dim ? dim.right : worksheet.columnCount || 64, 64);

  const sections = [];
  let preambleRows = [];
  let emptyStreak = 0;
  let current = null;

  const flushCurrent = () => {
    if (current && current.columns?.length) {
      sections.push(current);
    }
    current = null;
  };

  for (let r = 1; r <= lastRow; r += 1) {
    const row = worksheet.getRow(r);
    const maxCol = Math.max(rowUsedMaxColumn(row, hardMaxCol), 1);

    if (isRowMostlyEmpty(row, maxCol)) {
      emptyStreak += 1;
      if (emptyStreak >= 2) {
        flushCurrent();
        preambleRows = [];
      }
      continue;
    }
    emptyStreak = 0;

    if (isHeaderRow(row, maxCol)) {
      flushCurrent();
      const range = headerColumnRange(row, maxCol);
      if (!range) {
        continue;
      }
      const widened = widenColRangeWithPeekRows(worksheet, r, range.minCol, range.maxCol, lastRow, 12, hardMaxCol);
      const { minCol, maxCol: maxC } = widened;
      const columns = [];
      for (let c = minCol; c <= maxC; c += 1) {
        const cell = row.getCell(c);
        columns.push({
          text: cellText(cell).trim(),
          backgroundColor: cellBgHex(cell)
        });
      }
      const titleAbove = preambleRows.length ? [...preambleRows] : [];
      preambleRows = [];
      current = {
        id: `${sheetName}__r${r}`,
        sheetName,
        excelHeaderRow: r,
        minCol,
        maxCol: maxC,
        titleAbove,
        columns,
        rows: []
      };
      continue;
    }

    if (current) {
      const maxDataRows = 150;
      if (current.rows.length >= maxDataRows) {
        continue;
      }
      const vals = rowToValues(row, current.minCol, current.maxCol);
      if (vals.some((v) => v.length > 0)) {
        current.rows.push(vals);
      }
    } else {
      const line = rowToValues(row, 1, maxCol)
        .filter(Boolean)
        .join(" · ");
      if (line) {
        preambleRows.push(line);
      }
    }
  }

  flushCurrent();

  if (sections.length === 0 && preambleRows.length) {
    sections.push({
      id: `${sheetName}__notes`,
      sheetName,
      excelHeaderRow: null,
      titleAbove: [],
      columns: [{ text: "Notes", backgroundColor: null }],
      rows: preambleRows.map((t) => [t])
    });
  }

  return sections;
}

const OMIT_SHEETS = new Set(["Ref Iti（Horizontal）"]);

function shouldOmitSheet(sheetName) {
  return OMIT_SHEETS.has(sheetName);
}

function filterSectionsForUi(sheetName, sections) {
  return sections.filter((sec) => {
    const c0 = sec.columns?.[0]?.text ?? "";
    if (sheetName === "Academic" && c0.includes("绿色部分由PM填写")) {
      return false;
    }
    if (sheetName === "Personal Info" && c0.includes("*注意项目学生生日")) {
      return false;
    }
    return true;
  });
}

function firstNonEmptyCell(row) {
  if (!row || !row.length) {
    return "";
  }
  for (const cell of row) {
    if (cell != null && String(cell).trim()) {
      return String(cell).trim();
    }
  }
  return "";
}

/** Split "Hotel line\\nAddress: ..." from Excel row 2 into two editable blocks. */
function splitHotelAddressBlock(block) {
  const s = String(block || "").trim();
  if (!s) {
    return { hotel: "", address: "" };
  }
  const idx = s.search(/\n\s*Address:/i);
  if (idx >= 0) {
    return { hotel: s.slice(0, idx).trim(), address: s.slice(idx + 1).trim() };
  }
  const nl = s.indexOf("\n");
  if (nl >= 0) {
    return { hotel: s.slice(0, nl).trim(), address: s.slice(nl + 1).trim() };
  }
  return { hotel: s, address: "" };
}

function transformRoomingListSheet(sheet) {
  const r1 = sheet.sections.find((s) => s.id === "Rooming List__r1");
  const r4 = sheet.sections.find((s) => s.id === "Rooming List__r4");
  if (!r4) {
    return sheet;
  }
  const title = firstNonEmptyCell(r1?.rows?.[0]);
  const block = firstNonEmptyCell(r1?.rows?.[1]);
  const { hotel, address } = splitHotelAddressBlock(block);
  const bannerTextFields = [];
  if (hotel) {
    bannerTextFields.push({ text: hotel, variant: "tableName" });
  }
  if (address) {
    bannerTextFields.push({ text: address, variant: "tableName" });
  }
  const combined = {
    id: "Rooming List__combined",
    sheetName: "Rooming List",
    excelHeaderRow: r4.excelHeaderRow,
    minCol: r4.minCol,
    maxCol: r4.maxCol,
    titleAbove: [],
    tableName: title || "Hotel list",
    editableTableName: true,
    headerLabelsEditable: true,
    ...(bannerTextFields.length ? { bannerTextFields } : {}),
    columns: r4.columns,
    rows: r4.rows
  };
  const rest = sheet.sections.filter((s) => s.id !== "Rooming List__r1" && s.id !== "Rooming List__r4");
  return { ...sheet, sections: [combined, ...rest] };
}

const ITINERARY_SHEET_LABEL = "Itinerary (template)请修改这个";

function renameItinerarySheet(sheet) {
  if (sheet.name !== ITINERARY_SHEET_LABEL) {
    return sheet;
  }
  return {
    ...sheet,
    name: "Itinerary",
    sections: sheet.sections.map((sec) => ({ ...sec, sheetName: "Itinerary" }))
  };
}

function transformPersonalInfoSheet(sheet) {
  if (sheet.name !== "Personal Info") {
    return sheet;
  }
  return {
    ...sheet,
    sections: sheet.sections.map((sec) => ({
      ...sec,
      headerLabelsEditable: true,
      allowRowInsert: true
    }))
  };
}

const ACCOMMODATION_TABLE_SUBTITLE =
  "Please only reflect group staying dates. For special requests (OG, guest, guide, faculty) reflect in the Rooming List section.";

function transformSummarySheet(sheet) {
  const publicTransportSection = {
    id: "Summary__public_transportation_card",
    sheetName: "Summary",
    excelHeaderRow: null,
    minCol: 1,
    maxCol: 5,
    titleAbove: [],
    tableName: "Public Transportation Card",
    columns: [
      { text: "Country", backgroundColor: "#D9EAD3" },
      { text: "City", backgroundColor: "#D9EAD3" },
      { text: "Budget", backgroundColor: "#D9EAD3" },
      { text: "Local Currency", backgroundColor: "#D9EAD3" },
      {
        text: "Deposit",
        backgroundColor: "#D9EAD3",
        inputType: "select",
        selectOptions: ["Included", "Not included"]
      }
    ],
    rows: [["", "", "", "", ""]]
  };

  const next = [];
  for (const sec of sheet.sections) {
    if (sec.id === "Summary__r29") {
      continue;
    }
    if (sec.id === "Summary__r3") {
      const fiveCols = sec.columns.slice(0, 5);
      next.push({
        ...sec,
        minCol: 1,
        maxCol: 5,
        columns: fiveCols,
        rows: [["", "", "", "", ""]]
      });
      continue;
    }
    if (sec.id === "Summary__r8") {
      next.push({ ...sec, tableName: "City-To-City Transfer" });
      continue;
    }
    if (sec.id === "Summary__r17") {
      next.push({
        ...sec,
        titleAbove: [],
        tableName: "Accommodation",
        tableSubtitle: ACCOMMODATION_TABLE_SUBTITLE
      });
      continue;
    }
    if (sec.id === "Summary__r23") {
      next.push({ ...sec, tableName: "Meeting Room" });
      continue;
    }
    if (sec.id === "Summary__r36") {
      next.push({
        ...sec,
        tableName: "Daily Transportation"
      });
      next.push(publicTransportSection);
      continue;
    }
    if (sec.id === "Summary__r46") {
      next.push({ ...sec, tableName: "Guide" });
      continue;
    }
    if (sec.id === "Summary__r55") {
      next.push({ ...sec, tableName: "Cultural Experiences" });
      continue;
    }
    if (sec.id === "Summary__r65") {
      next.push({ ...sec, tableName: "Meals" });
      continue;
    }
    next.push(sec);
  }
  return { ...sheet, sections: next };
}

function transformAcademicSheet(sheet) {
  return {
    ...sheet,
    sections: sheet.sections.map((sec) => {
      if (sec.id === "Academic__r2") {
        return { ...sec, tableName: "Requests" };
      }
      if (sec.id === "Academic__r9") {
        return { ...sec, tableName: "Outreach Status" };
      }
      return sec;
    })
  };
}

function transformInternationalFlightSheet(sheet) {
  const next = [];
  for (const sec of sheet.sections) {
    if (sec.id === "International Flight__r2") {
      next.push({
        id: "International Flight__pickup_title",
        sheetName: "International Flight",
        excelHeaderRow: null,
        displayMode: "tableNameOnly",
        tableName: "Airport Pickup Information",
        titleAbove: [],
        columns: [],
        rows: []
      });
      continue;
    }
    if (sec.id === "International Flight__r18") {
      next.push({
        id: "International Flight__group_flight_title",
        sheetName: "International Flight",
        excelHeaderRow: null,
        displayMode: "tableNameOnly",
        tableName: "Group flight information",
        titleAbove: [],
        columns: [],
        rows: []
      });
      continue;
    }
    if (sec.id === "International Flight__r12") {
      next.push({ ...sec, tableName: "Airport Drop off Information" });
      continue;
    }
    next.push(sec);
  }
  return { ...sheet, sections: next };
}

function columnIsTrailingBlank(sec, colIndex) {
  const c = sec.columns[colIndex];
  const hasText = c.text != null && String(c.text).trim().length > 0;
  const bg = (c.backgroundColor && String(c.backgroundColor).toUpperCase()) || "";
  const hasNonWhiteFill = !!c.backgroundColor && bg !== "" && bg !== "#FFFFFF";
  if (hasText || hasNonWhiteFill) {
    return false;
  }
  const rows = sec.rows || [];
  return !rows.some((r) => r[colIndex] != null && String(r[colIndex]).trim() !== "");
}

/** Trailing blank columns to the right of this header are removed (Requests: Academic Manager). */
function trimAnchorColumnIndex(sec, cols) {
  const ogIdx = cols.findIndex((c) => (c.text || "").trim() === "OG Feedback");
  if (sec.id === "Academic__r2") {
    const amIdx = cols.findIndex((c) => (c.text || "").trim() === "Academic Manager");
    if (amIdx >= 0) {
      return amIdx;
    }
  }
  return ogIdx;
}

function trimTrailingBlankColumns(sec) {
  if (sec.displayMode === "tableNameOnly" || !sec.columns || sec.columns.length === 0) {
    return sec;
  }
  const cols = [...sec.columns];
  const rows = (sec.rows || []).map((r) => [...r]);
  const anchorIdx = trimAnchorColumnIndex(sec, cols);

  if (anchorIdx >= 0) {
    let end = cols.length - 1;
    while (end > anchorIdx && columnIsTrailingBlank({ ...sec, columns: cols, rows }, end)) {
      cols.pop();
      for (const r of rows) {
        r.pop();
      }
      end -= 1;
    }
    return { ...sec, columns: cols, rows, maxCol: cols.length, minCol: 1 };
  }

  while (cols.length > 0 && columnIsTrailingBlank({ ...sec, columns: cols, rows }, cols.length - 1)) {
    cols.pop();
    for (const r of rows) {
      r.pop();
    }
  }
  return { ...sec, columns: cols, rows, maxCol: cols.length, minCol: 1 };
}

function transformSheetPost(sheet) {
  let out = sheet;
  if (out.name === "Rooming List") {
    out = transformRoomingListSheet(out);
  } else if (out.name === "Summary") {
    out = transformSummarySheet(out);
  } else if (out.name === "Academic") {
    out = transformAcademicSheet(out);
  } else if (out.name === "International Flight") {
    out = transformInternationalFlightSheet(out);
  }
  out = renameItinerarySheet(out);
  out = transformPersonalInfoSheet(out);
  return out;
}

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(inputPath);

const layout = {
  generatedAt: new Date().toISOString(),
  sourceFile: path.basename(inputPath),
  pageTitle: "Internal Information Collection",
  pageSubtitle: "APA program info collection (imported layout)",
  sheets: []
};

for (const ws of wb.worksheets) {
  if (shouldOmitSheet(ws.name)) {
    continue;
  }
  const raw = extractSectionsFromSheet(ws);
  const sections = filterSectionsForUi(ws.name, raw);
  const transformed = transformSheetPost({ name: ws.name, sections });
  layout.sheets.push({
    ...transformed,
    sections: transformed.sections.map(trimTrailingBlankColumns)
  });
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(layout, null, 2), "utf8");
console.log("Wrote", outputPath);
console.log(
  "Sections per sheet:",
  layout.sheets.map((s) => `${s.name}: ${s.sections.length}`).join(", ")
);
