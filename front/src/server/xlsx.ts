import { unzipSync, strFromU8 } from "fflate";
import { XMLParser } from "fast-xml-parser";
import { WorkflowError } from "../workflows/domain";
const array = <T>(value: T | T[] | undefined): T[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];
const decode = (value: unknown): string =>
  String(value ?? "").replace(/&(?:amp|lt|gt|quot|apos);|&#(?:x[0-9a-f]+|[0-9]+);/gi, (token) => {
    const fixed: Record<string, string> = {
      "&amp;": "&",
      "&lt;": "<",
      "&gt;": ">",
      "&quot;": '"',
      "&apos;": "'",
    };
    if (fixed[token]) return fixed[token];
    const n = parseInt(token.slice(token[2] === "x" ? 3 : 2, -1), token[2] === "x" ? 16 : 10);
    return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
  });
type Cell = { "@_r"?: string; "@_t"?: string; v?: string; is?: TextValue };
type TextValue = { t?: string | { "#text": string }; r?: { t: string }[] };
const text = (v: TextValue | undefined): string =>
  v
    ? decode(
        typeof v.t === "object"
          ? v.t["#text"]
          : (v.t ??
              array(v.r)
                .map((x) => x.t)
                .join("")),
      )
    : "";
export function xlsxRows(bytes: Uint8Array): string[][] {
  try {
    let total = 0;
    const zip = unzipSync(bytes, {
      filter: (file) => {
        const selected =
          file.name === "xl/sharedStrings.xml" || /^xl\/worksheets\/sheet\d+\.xml$/.test(file.name);
        if (!selected) return false;
        total += file.originalSize;
        if (file.originalSize > 4_000_000 || total > 8_000_000)
          throw new WorkflowError("Le classeur décompressé est trop volumineux.");
        return true;
      },
    });
    const sheetName = Object.keys(zip)
      .filter((x) => x.startsWith("xl/worksheets/"))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))[0];
    if (!sheetName) throw new Error("sheet");
    const parser = new XMLParser({
      ignoreAttributes: false,
      parseTagValue: false,
      processEntities: false,
      removeNSPrefix: true,
    });
    const parse = (file: Uint8Array) => {
      const xml = strFromU8(file);
      if (/<!DOCTYPE|<!ENTITY/i.test(xml))
        throw new WorkflowError("Ce classeur contient des déclarations XML non autorisées.");
      return parser.parse(xml);
    };
    const shared = zip["xl/sharedStrings.xml"]
      ? array<TextValue>(parse(zip["xl/sharedStrings.xml"]).sst?.si).map(text)
      : [];
    const rows = array<{ c?: Cell | Cell[] }>(parse(zip[sheetName]).worksheet?.sheetData?.row);
    if (rows.length > 1001) throw new WorkflowError("Maximum 1 000 lignes par import.");
    return rows.map((row) => {
      const values: string[] = [];
      for (const cell of array(row.c)) {
        const letters = cell["@_r"]?.match(/^[A-Z]+/)?.[0];
        if (!letters) continue;
        const index = [...letters].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
        if (index >= 64) throw new WorkflowError("Maximum 64 colonnes par import.");
        values[index] =
          cell["@_t"] === "s"
            ? shared[Number(cell.v)] || ""
            : cell["@_t"] === "inlineStr"
              ? text(cell.is)
              : decode(cell.v);
      }
      return Array.from({ length: values.length }, (_, i) => values[i] || "");
    });
  } catch (error) {
    if (error instanceof WorkflowError) throw error;
    throw new WorkflowError(
      "Classeur Excel illisible. Utilisez un fichier XLSX contenant les colonnes Prénom et Nom.",
    );
  }
}
