export type InternalInfoColumn = {
  text: string;
  backgroundColor: string | null;
  inputType?: "text" | "select";
  selectOptions?: string[];
};

/** Full-width rows above the main grid (e.g. Rooming List title + hotel address) */
export type InternalInfoBannerRow = {
  text: string;
  backgroundColor?: string | null;
  /** title | subtitle — affects default styling */
  variant?: "title" | "subtitle" | "default";
};

/** Editable lines above the grid (Rooming: hotel + address), same typography options as table name */
export type InternalInfoBannerTextField = {
  text: string;
  /** `tableName` uses `.iic-table-name-input` styling; `subtitle` uses muted helper style */
  variant?: "tableName" | "subtitle";
};

export type InternalInfoSectionDisplayMode = "table" | "tableNameOnly";

export type InternalInfoSection = {
  id: string;
  sheetName: string;
  excelHeaderRow: number | null;
  /** When `tableNameOnly`, only `tableName` is shown (no grid). */
  displayMode?: InternalInfoSectionDisplayMode;
  minCol?: number;
  maxCol?: number;
  /** Shown above the table; smaller than sheet (section) title, black */
  tableName?: string;
  /** When true, `tableName` is shown as an editable field (separate from the grid) */
  editableTableName?: boolean;
  /** When true, column headers render as full-width inputs inside `<th>` */
  headerLabelsEditable?: boolean;
  /** Gray helper line under tableName */
  tableSubtitle?: string;
  titleAbove: string[];
  /** Merged across all columns of the main table below */
  bannerRows?: InternalInfoBannerRow[];
  /** When set, rendered as separate editable fields above the grid (replaces banner table for those lines). */
  bannerTextFields?: InternalInfoBannerTextField[];
  /** Show “插入行” to append blank rows (client-side only). */
  allowRowInsert?: boolean;
  columns: InternalInfoColumn[];
  rows: string[][];
};

export type InternalInfoSheet = {
  name: string;
  sections: InternalInfoSection[];
};

export type InternalInfoLayout = {
  generatedAt: string;
  sourceFile: string;
  pageTitle: string;
  pageSubtitle: string;
  sheets: InternalInfoSheet[];
};
