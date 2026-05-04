import fs from "fs";
import path from "path";

const MAX_CHARS = 80_000;

/**
 * Best-effort text extraction for proposal intake (PDF/DOCX/txt).
 */
export async function extractProposalText(filePath: string, originalName: string): Promise<string> {
  const ext = path.extname(originalName).toLowerCase();

  if (ext === ".txt" || ext === ".csv" || ext === ".md" || ext === ".json") {
    return fs.readFileSync(filePath, "utf8").slice(0, MAX_CHARS);
  }

  if (ext === ".docx") {
    try {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ path: filePath });
      const text = (result.value || "").trim();
      return text ? text.slice(0, MAX_CHARS) : "(empty docx body)";
    } catch (e) {
      return `docx extract failed: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  if (ext === ".pdf") {
    try {
      const mod = await import("pdf-parse");
      const pdfParse = (mod as { default?: (b: Buffer) => Promise<{ text?: string }> }).default;
      if (typeof pdfParse !== "function") {
        return "pdf-parse module missing default export";
      }
      const buf = fs.readFileSync(filePath);
      const data = await pdfParse(buf);
      const text = (data.text || "").trim();
      return text ? text.slice(0, MAX_CHARS) : "(empty pdf text layer)";
    } catch (e) {
      return `pdf extract failed: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  const buf = fs.readFileSync(filePath);
  const head = buf
    .toString("utf8", 0, Math.min(buf.length, 4000))
    .replace(/[^\x20-\x7E\n\r\t\u4e00-\u9fff]/g, " ");
  return `No dedicated extractor for ${ext || "(no extension)"}. Filename: ${originalName}. UTF-8 preview (may be garbled): ${head}`;
}
