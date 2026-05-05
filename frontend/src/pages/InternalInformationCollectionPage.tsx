import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type MouseEvent as ReactMouseEvent
} from "react";
import { Link, useParams } from "react-router-dom";
import { resolveApiBase } from "../apiBase";
import { publicUrl } from "../publicUrl";
import type { InternalInfoColumn, InternalInfoLayout, InternalInfoSection } from "./internalInfoLayout";

const layoutUrl = publicUrl("data/internal-info-collection-layout.json");

const IIC_STORAGE_PREFIX = "studytour:iic:v1:";
/** Match `.iic-th` / header font for single-line width estimate */
const IIC_HEADER_MEASURE_FONT = "600 13px ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif";

/** Duration 列单元格下拉（选项分隔：Early AM；AM；…） */
const IIC_DURATION_SELECT_OPTIONS = [
  "Early AM",
  "AM",
  "Late AM",
  "Early PM",
  "PM",
  "Late PM",
  "EVE",
  "Full Day"
] as const;

function isDurationColumnHeader(headerText: string | undefined | null): boolean {
  return /\bDuration\b/i.test(String(headerText ?? "").trim());
}

type IicSectionPersist = {
  colWidthsPx?: number[];
  tableName?: string;
  headers?: string[];
  rows?: string[][];
  bannerTextFields?: string[];
};

type IicPersistDoc = {
  v: 1;
  savedAt: string;
  sections: Record<string, IicSectionPersist>;
};

function measureHeaderTextWidthPx(headerText: string): number {
  const lines = String(headerText ?? "")
    .replace(/\r/g, "")
    .split("\n");
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return 120;
  }
  ctx.font = IIC_HEADER_MEASURE_FONT;
  let max = 0;
  for (const line of lines) {
    const t = line.trim() || " ";
    max = Math.max(max, ctx.measureText(t).width);
  }
  return Math.ceil(max + 28);
}

function mergeRowsFromOverlay(base: string[][], overlay: string[][] | undefined, colCount: number): string[][] {
  if (!overlay || overlay.length === 0) {
    return base.map((r) => padRow([...r], colCount));
  }
  const maxR = Math.max(base.length, overlay.length);
  const out: string[][] = [];
  for (let i = 0; i < maxR; i++) {
    const pick = overlay[i] !== undefined ? overlay[i]! : base[i] ?? [];
    out.push(padRow([...pick], colCount));
  }
  return out;
}

function mergeSection(base: InternalInfoSection, o: IicSectionPersist): InternalInfoSection {
  const headers = o.headers;
  const columns =
    headers && headers.length === base.columns.length
      ? base.columns.map((c, i) => ({ ...c, text: headers[i] ?? c.text }))
      : base.columns;
  const rows = mergeRowsFromOverlay(base.rows, o.rows, base.columns.length);
  const bannerTextFields =
    base.bannerTextFields && o.bannerTextFields?.length
      ? base.bannerTextFields.map((bf, i) => ({
          ...bf,
          text: o.bannerTextFields![i] ?? bf.text
        }))
      : base.bannerTextFields;
  return {
    ...base,
    tableName: o.tableName ?? base.tableName,
    columns,
    rows,
    ...(bannerTextFields ? { bannerTextFields } : {})
  };
}

function applyOverlay(base: InternalInfoLayout, overlay: IicPersistDoc | null): InternalInfoLayout {
  if (!overlay?.sections || Object.keys(overlay.sections).length === 0) {
    return base;
  }
  return {
    ...base,
    sheets: base.sheets.map((sh) => ({
      ...sh,
      sections: sh.sections.map((sec) => {
        const o = overlay.sections[sec.id];
        return o ? mergeSection(sec, o) : sec;
      })
    }))
  };
}

function collectPersistFromPage(root: HTMLElement): IicPersistDoc {
  const sections: Record<string, IicSectionPersist> = {};
  for (const art of root.querySelectorAll("[data-iic-section]")) {
    const sid = art.getAttribute("data-iic-section");
    if (!sid) {
      continue;
    }
    const persist: IicSectionPersist = {};
    const tn = art.querySelector<HTMLTextAreaElement>('[data-iic-field="tableName"]');
    if (tn) {
      persist.tableName = tn.value;
    }
    const bfs = [...art.querySelectorAll<HTMLTextAreaElement>('[data-iic-field="bannerField"]')];
    if (bfs.length) {
      persist.bannerTextFields = bfs.map((b) => b.value);
    }
    const table = art.querySelector("table.iic-data-table");
    if (table) {
      const colEls = [...table.querySelectorAll("colgroup col")];
      const widths = colEls
        .map((c) => {
          const m = c.getAttribute("style")?.match(/width:\s*([\d.]+)px/);
          return m ? Math.round(parseFloat(m[1])) : 0;
        })
        .filter((n) => n > 0);
      if (widths.length) {
        persist.colWidthsPx = widths;
      }
      const headerTas = [...table.querySelectorAll<HTMLTextAreaElement>('thead th textarea[data-iic-field="header"]')];
      if (headerTas.length) {
        persist.headers = headerTas.map((t) => t.value);
      }
      const rows: string[][] = [];
      for (const tr of table.querySelectorAll("tbody tr")) {
        const row: string[] = [];
        for (const td of tr.querySelectorAll("td")) {
          const cb = td.querySelector<HTMLInputElement>('input[type="checkbox"]');
          if (cb) {
            row.push(cb.checked ? "true" : "false");
          } else {
            const sel = td.querySelector<HTMLSelectElement>('select[data-iic-field="cell"]');
            if (sel) {
              row.push(sel.value);
            } else {
              const ta = td.querySelector("textarea");
              row.push(ta?.value ?? "");
            }
          }
        }
        if (row.length) {
          rows.push(row);
        }
      }
      if (rows.length) {
        persist.rows = rows;
      }
    }
    if (Object.keys(persist).length) {
      sections[sid] = persist;
    }
  }
  return { v: 1, savedAt: new Date().toISOString(), sections };
}

function sectionUsesFitHeaderWidths(sec: InternalInfoSection): boolean {
  return sec.sheetName === "Personal Info" || sec.sheetName === "Rooming List";
}

/** Excel template “green / PM” columns (light fills) — widen for 1–2 line labels */
function isGreenColumn(backgroundColor: string | null | undefined): boolean {
  if (!backgroundColor) return false;
  const u = backgroundColor.toUpperCase();
  return u === "#D9EAD3" || u === "#EAF1DD" || u === "#B6D7A8";
}

function padRow(row: string[], columnCount: number): string[] {
  const next = [...row];
  while (next.length < columnCount) {
    next.push("");
  }
  return next.slice(0, columnCount);
}

function isFalseToken(cell: string): boolean {
  return String(cell).trim().toLowerCase() === "false";
}

function checkboxDefaultChecked(cell: string): boolean {
  const s = String(cell).trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes";
}

const IIC_MIN_COL_PX = 48;

function fitTextareaToContent(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  const minPx = parseFloat(getComputedStyle(el).minHeight);
  const floor = Number.isFinite(minPx) ? minPx : 40;
  el.style.height = `${Math.max(floor, el.scrollHeight)}px`;
}

/** Uncontrolled textarea: grows with content; remeasure when column layout changes. */
function IicGrowTextarea({
  remeasureKey = "",
  className,
  onInput,
  ...rest
}: ComponentProps<"textarea"> & { remeasureKey?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fit = () => {
    const el = ref.current;
    if (el) {
      fitTextareaToContent(el);
    }
  };

  useLayoutEffect(() => {
    fit();
  }, [remeasureKey]);

  useEffect(() => {
    const onWin = () => fit();
    window.addEventListener("resize", onWin);
    return () => window.removeEventListener("resize", onWin);
  }, []);

  return (
    <textarea
      ref={ref}
      className={className}
      {...rest}
      onInput={(e) => {
        fit();
        onInput?.(e);
      }}
    />
  );
}

type SectionTableProps = {
  section: InternalInfoSection;
  savedColWidths?: number[] | null;
  fitHeaderInitialWidths?: boolean;
};

function SectionTable({ section, savedColWidths, fitHeaderInitialWidths }: SectionTableProps) {
  const colCount = section.columns.length;
  const bannerTextFields = section.bannerTextFields;
  const hasTextBannerFields = Boolean(bannerTextFields?.length);
  const hasLegacyBanner = Boolean(section.bannerRows?.length);
  const hasBanner = hasTextBannerFields || hasLegacyBanner;
  const headerEditable = Boolean(section.headerLabelsEditable);
  const isChecklist = section.sheetName === "Checklist";
  const tableRef = useRef<HTMLTableElement | null>(null);
  const [bodyRows, setBodyRows] = useState<string[][]>(() =>
    section.rows.map((r) => padRow([...r], section.columns.length))
  );

  useEffect(() => {
    setBodyRows(section.rows.map((r) => padRow([...r], section.columns.length)));
  }, [section.id, section.columns.length, section.rows]);

  const dragRef = useRef<{
    boundaryIdx: number;
    startX: number;
    startWidths: number[];
  } | null>(null);
  const [colWidthsPx, setColWidthsPx] = useState<number[] | null>(null);

  const savedKey = savedColWidths?.join(",") ?? "";
  const colTextsKey = section.columns.map((c) => c.text ?? "").join("\x1f");

  useLayoutEffect(() => {
    if (savedColWidths && savedColWidths.length === colCount) {
      setColWidthsPx([...savedColWidths]);
      return;
    }
    if (fitHeaderInitialWidths && colCount > 0) {
      setColWidthsPx(
        section.columns.map((c) => Math.max(IIC_MIN_COL_PX, measureHeaderTextWidthPx(c.text ?? "")))
      );
      return;
    }
    const table = tableRef.current;
    if (!table || colCount <= 0) {
      return;
    }
    const ths = table.querySelectorAll("thead tr th");
    if (ths.length !== colCount) {
      return;
    }
    const measured = Array.from(ths).map((th) =>
      Math.max(IIC_MIN_COL_PX, Math.round(th.getBoundingClientRect().width))
    );
    setColWidthsPx(measured);
  }, [section.id, colCount, savedKey, fitHeaderInitialWidths, colTextsKey]);

  const layoutReady = colWidthsPx !== null && colWidthsPx.length === colCount;
  const colRemeasureKey = layoutReady && colWidthsPx ? colWidthsPx.join(",") : "";

  const onResizeMouseDown = (e: ReactMouseEvent, boundaryIdx: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!layoutReady || !colWidthsPx || boundaryIdx < 0 || boundaryIdx >= colCount - 1) {
      return;
    }
    dragRef.current = {
      boundaryIdx,
      startX: e.clientX,
      startWidths: [...colWidthsPx]
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (ev: globalThis.MouseEvent) => {
      const d = dragRef.current;
      if (!d) {
        return;
      }
      const deltaPx = ev.clientX - d.startX;
      const i = d.boundaryIdx;
      const next = [...d.startWidths];
      next[i] = Math.max(IIC_MIN_COL_PX, d.startWidths[i] + deltaPx);
      setColWidthsPx(next);
    };

    const onUp = () => {
      dragRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      requestAnimationFrame(() => {
        const t = tableRef.current;
        if (!t) {
          return;
        }
        t.querySelectorAll("textarea").forEach((node) => {
          if (node instanceof HTMLTextAreaElement) {
            fitTextareaToContent(node);
          }
        });
      });
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const tableRows = bodyRows;

  return (
    <div className={hasBanner ? "iic-stacked-tables" : undefined}>
      {hasTextBannerFields ? (
        <div className="iic-banner-text-stack">
          {bannerTextFields!.map((bf, i) => (
            <IicGrowTextarea
              key={i}
              className={
                bf.variant === "subtitle"
                  ? "iic-table-subtitle iic-banner-field-textarea"
                  : "iic-table-name-input iic-table-name-textarea"
              }
              defaultValue={bf.text}
              rows={1}
              data-iic-field="bannerField"
              data-iic-banner-index={String(i)}
              aria-label={`Banner field ${i + 1}`}
            />
          ))}
        </div>
      ) : null}
      {hasLegacyBanner ? (
        <table className="iic-banner-table" aria-label="Section banners">
          <tbody>
            {section.bannerRows!.map((br, i) => (
              <tr key={i}>
                <td
                  colSpan={colCount}
                  className={`iic-banner-td iic-banner-${br.variant ?? "default"}`}
                  style={br.backgroundColor ? { backgroundColor: br.backgroundColor } : undefined}
                >
                  {br.text}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      <div className={`table-scroll iic-table-wrap${headerEditable ? " iic-table-wrap-header-editable" : ""}`}>
        <table
          ref={tableRef}
          className={`data-table iic-data-table${layoutReady ? " iic-data-table-resizable" : ""}${
            hasBanner ? " iic-data-table-below-banner" : ""
          }${headerEditable ? " iic-header-editable" : ""}`}
        >
          {layoutReady && colWidthsPx ? (
            <colgroup>
              {colWidthsPx.map((w, idx) => (
                <col key={idx} style={{ width: `${w}px` }} />
              ))}
            </colgroup>
          ) : null}
          <thead>
            <tr>
              {section.columns.map((col, idx) => {
                const green = isGreenColumn(col.backgroundColor);
                return (
                  <th
                    key={idx}
                    className={`iic-th${green ? " iic-col-green" : ""}`}
                    style={{
                      backgroundColor: col.backgroundColor ?? "#f8fafc"
                    }}
                  >
                    {headerEditable ? (
                      <IicGrowTextarea
                        className="iic-header-input iic-header-textarea"
                        defaultValue={col.text}
                        rows={1}
                        remeasureKey={colRemeasureKey}
                        data-iic-field="header"
                        data-iic-ci={String(idx)}
                        aria-label={`Header column ${idx + 1}`}
                      />
                    ) : col.text ? (
                      col.text
                    ) : (
                      "\u00a0"
                    )}
                    {layoutReady && idx < colCount - 1 ? (
                      <span
                        className="iic-col-resize-handle"
                        onMouseDown={(e) => onResizeMouseDown(e, idx)}
                        role="separator"
                        aria-orientation="vertical"
                        aria-label={`Adjust width of column ${idx + 1} (table total width changes)`}
                      />
                    ) : null}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {tableRows.map((rawRow, ri) => {
              const row = padRow(rawRow, colCount);
              return (
                <tr key={ri}>
                  {row.map((cell, ci) => {
                    const col = section.columns[ci] as InternalInfoColumn | undefined;
                    const bg = col?.backgroundColor;
                    const green = isGreenColumn(bg);
                    if (isChecklist && isFalseToken(cell)) {
                      return (
                        <td key={ci} className="iic-checkbox-cell">
                          <input
                            type="checkbox"
                            className="iic-cell-checkbox"
                            defaultChecked={checkboxDefaultChecked(cell)}
                            aria-label={`R${ri + 1}C${ci + 1}`}
                          />
                        </td>
                      );
                    }
                    const optionsHint =
                      col?.inputType === "select" && col.selectOptions?.length
                        ? `常用填写（可自由输入）：${col.selectOptions.join(" · ")}`
                        : undefined;
                    const useDurationSelect = isDurationColumnHeader(col?.text);
                    if (useDurationSelect) {
                      const v = String(cell ?? "").trim();
                      const presets = IIC_DURATION_SELECT_OPTIONS as readonly string[];
                      const extraOption = v && !presets.includes(v) ? v : null;
                      return (
                        <td key={ci} className={green ? "iic-col-green" : undefined}>
                          <select
                            className={`iic-cell-select${green ? " iic-cell-input-green" : ""}`}
                            defaultValue={v}
                            data-iic-field="cell"
                            data-iic-ri={String(ri)}
                            data-iic-ci={String(ci)}
                            aria-label={`R${ri + 1}C${ci + 1}（Duration）`}
                          >
                            <option value="">（空）</option>
                            {extraOption ? (
                              <option value={extraOption}>{extraOption}（当前值，不在预设中）</option>
                            ) : null}
                            {IIC_DURATION_SELECT_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </td>
                      );
                    }
                    return (
                      <td key={ci} className={green ? "iic-col-green" : undefined}>
                        <IicGrowTextarea
                          className={`iic-cell-input iic-cell-textarea${green ? " iic-cell-input-green" : ""}`}
                          defaultValue={cell}
                          rows={1}
                          remeasureKey={colRemeasureKey}
                          title={optionsHint}
                          data-iic-field="cell"
                          data-iic-ri={String(ri)}
                          data-iic-ci={String(ci)}
                          aria-label={`R${ri + 1}C${ci + 1}`}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        {section.allowRowInsert ? (
          <div className="iic-row-insert-toolbar">
            <button
              type="button"
              className="iic-row-insert-btn"
              onClick={() =>
                setBodyRows((rows) => [...rows, Array.from({ length: colCount }, () => "")])
              }
            >
              插入行
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Per-project internal information collection. Layout is shared (from Excel-derived JSON)
 * and applies to every project route.
 */
export function InternalInformationCollectionPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [projectName, setProjectName] = useState<string | null>(null);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [baseLayout, setBaseLayout] = useState<InternalInfoLayout | null>(null);
  const [layoutError, setLayoutError] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<IicPersistDoc | null>(null);
  const [mergedLayout, setMergedLayout] = useState<InternalInfoLayout | null>(null);
  const [saveTick, setSaveTick] = useState(0);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const pageRootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!projectId) {
      return;
    }
    try {
      const raw = localStorage.getItem(`${IIC_STORAGE_PREFIX}${projectId}`);
      setOverlay(raw ? (JSON.parse(raw) as IicPersistDoc) : null);
    } catch {
      setOverlay(null);
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) {
      setProjectError("Missing project id in URL.");
      return;
    }
    let cancelled = false;
    fetch(`${resolveApiBase()}/projects/${encodeURIComponent(projectId)}`)
      .then(async (r) => {
        if (!r.ok) {
          throw new Error(r.status === 404 ? "Project not found." : `HTTP ${r.status}`);
        }
        return r.json() as Promise<{ project?: { name: string } }>;
      })
      .then((data) => {
        if (!cancelled) {
          setProjectName(data.project?.name ?? projectId);
          setProjectError(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setProjectName(null);
          setProjectError(e instanceof Error ? e.message : "Failed to load project.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    fetch(layoutUrl)
      .then(async (r) => {
        if (!r.ok) {
          throw new Error(`Layout HTTP ${r.status}`);
        }
        return r.json() as Promise<InternalInfoLayout>;
      })
      .then((data) => {
        if (!cancelled) {
          setBaseLayout(data);
          setLayoutError(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setBaseLayout(null);
          setLayoutError(e instanceof Error ? e.message : "Failed to load layout JSON.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const overlayKey = useMemo(() => (overlay ? JSON.stringify(overlay) : ""), [overlay]);

  useEffect(() => {
    if (!baseLayout) {
      setMergedLayout(null);
      return;
    }
    setMergedLayout(applyOverlay(baseLayout, overlay));
  }, [baseLayout, overlayKey]);

  function handleSave() {
    if (!projectId || !pageRootRef.current) {
      return;
    }
    try {
      const doc = collectPersistFromPage(pageRootRef.current);
      localStorage.setItem(`${IIC_STORAGE_PREFIX}${projectId}`, JSON.stringify(doc));
      setOverlay(doc);
      setSaveTick((t) => t + 1);
      setSaveMessage(`已保存到本机浏览器（${new Date().toLocaleString()}）`);
    } catch (e) {
      setSaveMessage(e instanceof Error ? e.message : "保存失败");
    }
  }

  return (
    <div className="iic-page" ref={pageRootRef}>
      <div className="page-toolbar iic-page-toolbar">
        <Link to="/" className="link-back">
          Back to Ops Console
        </Link>
        <div className="iic-save-actions">
          <button type="button" className="iic-save-btn" onClick={handleSave}>
            保存
          </button>
          {saveMessage ? <span className="muted iic-save-hint">{saveMessage}</span> : null}
        </div>
      </div>

      <header className="iic-page-header card">
        <h1 className="iic-page-title">{mergedLayout?.pageTitle ?? "Internal Information Collection"}</h1>
        {projectId && (
          <p className="project-scope-banner">
            Project: <code>{projectId}</code>
            {projectName ? ` · ${projectName}` : null}
          </p>
        )}
        {projectError && <p className="error-banner">{projectError}</p>}
        {layoutError && <p className="error-banner">{layoutError}</p>}
      </header>

      {mergedLayout?.sheets.map((sheet) => (
        <section key={sheet.name} className="card iic-sheet-card">
          <h2 className="iic-sheet-heading">{sheet.name}</h2>
          {sheet.sections.map((sec) => (
            <article key={sec.id} className="iic-section" data-iic-section={sec.id}>
              {sec.editableTableName ? (
                <IicGrowTextarea
                  className="iic-table-name-input iic-table-name-textarea"
                  defaultValue={sec.tableName ?? ""}
                  rows={1}
                  remeasureKey={`${sec.id}-${saveTick}`}
                  data-iic-field="tableName"
                  aria-label="Table name"
                />
              ) : (
                sec.tableName && <div className="iic-table-name">{sec.tableName}</div>
              )}
              {sec.tableSubtitle && <div className="iic-table-subtitle">{sec.tableSubtitle}</div>}
              {sec.titleAbove.length > 0 && (
                <div className="iic-section-preamble">
                  {sec.titleAbove.map((line, i) => (
                    <p key={i} className="muted">
                      {line}
                    </p>
                  ))}
                </div>
              )}
              {sec.displayMode !== "tableNameOnly" && sec.columns.length > 0 ? (
                <SectionTable
                  key={`${sec.id}-${saveTick}`}
                  section={sec}
                  savedColWidths={overlay?.sections[sec.id]?.colWidthsPx ?? null}
                  fitHeaderInitialWidths={sectionUsesFitHeaderWidths(sec)}
                />
              ) : null}
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}
