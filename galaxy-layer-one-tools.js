(function attachGalaxyLayerOneTools(root, factory) {
  "use strict";

  const api = factory(root || {});
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HHGalaxyLayerOneTools = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createGalaxyLayerOneTools(globalScope) {
  "use strict";

  const VERSION = "1.0.0";
  const LIMITS = Object.freeze({ maxTextBytes: 1024 * 1024, maxRows: 5000, maxColumns: 200, maxCellLength: 16000, maxQrLength: 2048 });

  function toolsError(code, message) {
    const error = new Error(message || code);
    error.name = "GalaxyToolsError";
    error.code = code;
    return error;
  }

  function byteLength(value) {
    const text = String(value == null ? "" : value);
    if (typeof TextEncoder === "function") return new TextEncoder().encode(text).byteLength;
    return unescape(encodeURIComponent(text)).length;
  }

  function boundedText(value, limit) {
    const text = String(value == null ? "" : value);
    if (byteLength(text) > (limit || LIMITS.maxTextBytes)) throw toolsError("INPUT_TOO_LARGE", "Dữ liệu vượt quá giới hạn xử lý cục bộ.");
    return text;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function escape(character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[character];
    });
  }

  function safeLink(value) {
    const url = String(value || "").trim();
    if (!/^(?:https?:\/\/|mailto:)/i.test(url)) return "";
    try {
      const parsed = new URL(url);
      return ["http:", "https:", "mailto:"].includes(parsed.protocol) ? parsed.href : "";
    } catch (_) {
      return "";
    }
  }

  function inlineMarkdown(value) {
    let output = escapeHtml(value);
    output = output.replace(/`([^`\n]{1,500})`/g, "<code>$1</code>");
    output = output.replace(/\*\*([^*\n]{1,1000})\*\*/g, "<strong>$1</strong>");
    output = output.replace(/(^|[^*])\*([^*\n]{1,1000})\*(?!\*)/g, "$1<em>$2</em>");
    output = output.replace(/\[([^\]\n]{1,300})\]\(([^)\s]{1,2048})\)/g, function safeMarkdownLink(_, label, href) {
      const safe = safeLink(href.replace(/&amp;/g, "&"));
      return safe ? "<a href=\"" + escapeHtml(safe) + "\" target=\"_blank\" rel=\"noopener noreferrer\">" + label + "</a>" : label;
    });
    return output;
  }

  function markdownToSafeHtml(value) {
    const text = boundedText(value).replace(/\r\n?/g, "\n");
    const lines = text.split("\n");
    const output = [];
    let listType = "";
    let paragraph = [];

    function flushParagraph() {
      if (!paragraph.length) return;
      output.push("<p>" + paragraph.map(inlineMarkdown).join("<br>") + "</p>");
      paragraph = [];
    }
    function closeList() {
      if (!listType) return;
      output.push("</" + listType + ">");
      listType = "";
    }

    lines.forEach(function renderLine(line) {
      const heading = /^(#{1,6})\s+(.+)$/.exec(line);
      const unordered = /^\s*[-*+]\s+(.+)$/.exec(line);
      const ordered = /^\s*\d+[.)]\s+(.+)$/.exec(line);
      const quote = /^>\s?(.*)$/.exec(line);
      if (!line.trim()) { flushParagraph(); closeList(); return; }
      if (heading) {
        flushParagraph(); closeList();
        const level = heading[1].length;
        output.push("<h" + level + ">" + inlineMarkdown(heading[2]) + "</h" + level + ">");
      } else if (unordered || ordered) {
        flushParagraph();
        const nextType = unordered ? "ul" : "ol";
        if (listType !== nextType) { closeList(); listType = nextType; output.push("<" + listType + ">"); }
        output.push("<li>" + inlineMarkdown((unordered || ordered)[1]) + "</li>");
      } else if (quote) {
        flushParagraph(); closeList();
        output.push("<blockquote>" + inlineMarkdown(quote[1]) + "</blockquote>");
      } else {
        closeList();
        paragraph.push(line);
      }
    });
    flushParagraph(); closeList();
    return output.join("");
  }

  function parseCsv(value, options) {
    const config = options && typeof options === "object" ? options : {};
    const delimiter = String(config.delimiter || ",");
    if (delimiter.length !== 1 || /[\r\n\"]/.test(delimiter)) throw toolsError("DELIMITER_INVALID", "Dấu phân cách CSV không hợp lệ.");
    const text = boundedText(value);
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;
    for (let index = 0; index <= text.length; index += 1) {
      const character = index < text.length ? text[index] : "\n";
      if (quoted) {
        if (character === "\"") {
          if (text[index + 1] === "\"") { cell += "\""; index += 1; }
          else quoted = false;
        } else cell += character;
      } else if (character === "\"" && !cell) quoted = true;
      else if (character === delimiter) {
        if (cell.length > LIMITS.maxCellLength) throw toolsError("CELL_TOO_LARGE", "Một ô CSV vượt quá giới hạn.");
        row.push(cell); cell = "";
        if (row.length > LIMITS.maxColumns) throw toolsError("TOO_MANY_COLUMNS", "CSV có quá nhiều cột.");
      } else if (character === "\n" || character === "\r") {
        if (character === "\r" && text[index + 1] === "\n") index += 1;
        if (cell.length > LIMITS.maxCellLength) throw toolsError("CELL_TOO_LARGE", "Một ô CSV vượt quá giới hạn.");
        row.push(cell); cell = "";
        if (row.length > LIMITS.maxColumns) throw toolsError("TOO_MANY_COLUMNS", "CSV có quá nhiều cột.");
        if (row.some(function nonEmpty(entry) { return entry !== ""; })) rows.push(row);
        row = [];
        if (rows.length > LIMITS.maxRows) throw toolsError("TOO_MANY_ROWS", "CSV có quá nhiều dòng.");
      } else cell += character;
    }
    if (quoted) throw toolsError("CSV_UNCLOSED_QUOTE", "CSV có dấu nháy chưa đóng.");
    return rows;
  }

  function csvToObjects(value, options) {
    const rows = parseCsv(value, options);
    if (!rows.length) return [];
    const headers = rows[0].map(function normalizeHeader(header, index) {
      const trimmed = String(header || "").trim();
      return trimmed || "column_" + (index + 1);
    });
    if (new Set(headers).size !== headers.length) throw toolsError("CSV_DUPLICATE_HEADER", "CSV có tên cột bị trùng.");
    return rows.slice(1).map(function objectRow(row) {
      const record = Object.create(null);
      headers.forEach(function assignCell(header, index) { record[header] = row[index] == null ? "" : row[index]; });
      return record;
    });
  }

  function csvCell(value) {
    const text = String(value == null ? "" : value);
    return /[",\r\n]/.test(text) ? "\"" + text.replace(/\"/g, "\"\"") + "\"" : text;
  }

  function objectsToCsv(value) {
    if (!Array.isArray(value)) throw toolsError("JSON_ARRAY_REQUIRED", "Dữ liệu JSON phải là một mảng object.");
    if (value.length > LIMITS.maxRows) throw toolsError("TOO_MANY_ROWS", "Dữ liệu có quá nhiều dòng.");
    const records = value.filter(function objectOnly(item) { return item && typeof item === "object" && !Array.isArray(item); });
    if (records.length !== value.length) throw toolsError("JSON_OBJECTS_REQUIRED", "Mỗi phần tử JSON phải là object.");
    const headers = [];
    const seen = new Set();
    records.forEach(function collectKeys(record) {
      Object.keys(record).forEach(function collectKey(key) {
        if (!seen.has(key)) { seen.add(key); headers.push(key); }
      });
    });
    if (headers.length > LIMITS.maxColumns) throw toolsError("TOO_MANY_COLUMNS", "Dữ liệu có quá nhiều cột.");
    const rows = [headers.map(csvCell).join(",")];
    records.forEach(function serializeRecord(record) {
      rows.push(headers.map(function serializeValue(header) {
        const value = record[header];
        if (value && typeof value === "object") return csvCell(JSON.stringify(value));
        return csvCell(value);
      }).join(","));
    });
    return rows.join("\n");
  }

  async function sha256Hex(value, cryptoObject) {
    const text = boundedText(value);
    const candidate = cryptoObject || globalScope.crypto;
    if (!candidate || !candidate.subtle || typeof candidate.subtle.digest !== "function" || typeof TextEncoder !== "function") {
      throw toolsError("WEB_CRYPTO_UNAVAILABLE", "Trình duyệt không hỗ trợ Web Crypto SHA-256.");
    }
    const digest = await candidate.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(digest)).map(function hex(byte) { return byte.toString(16).padStart(2, "0"); }).join("");
  }

  function createQrSvg(value, factory) {
    const text = String(value == null ? "" : value).trim();
    if (!text || text.length > LIMITS.maxQrLength) throw toolsError("QR_INPUT_INVALID", "Nội dung QR phải có từ 1 đến 2048 ký tự.");
    const qrFactory = factory || globalScope.qrcode;
    if (typeof qrFactory !== "function") throw toolsError("QR_ENGINE_UNAVAILABLE", "Bộ tạo QR cục bộ chưa được tải.");
    const qr = qrFactory(0, "M");
    qr.addData(text, "Byte");
    qr.make();
    const svg = qr.createSvgTag({ cellSize: 4, margin: 4, scalable: true });
    if (!/^<svg\b/i.test(svg) || /<script\b|\bon\w+\s*=|javascript:/i.test(svg)) throw toolsError("QR_OUTPUT_UNSAFE", "Không thể xác minh đầu ra QR.");
    return svg;
  }

  return Object.freeze({
    VERSION: VERSION,
    LIMITS: LIMITS,
    byteLength: byteLength,
    escapeHtml: escapeHtml,
    markdownToSafeHtml: markdownToSafeHtml,
    parseCsv: parseCsv,
    csvToObjects: csvToObjects,
    objectsToCsv: objectsToCsv,
    sha256Hex: sha256Hex,
    createQrSvg: createQrSvg
  });
});
