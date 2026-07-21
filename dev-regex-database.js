(function (globalScope) {
  "use strict";

  const VERSION = 1;
  const FORMAT = "hh-dev-regex-database";
  const STORAGE_KEY = "hh.dev.regex-database.v1";
  const MAX_INPUT = 1_000_000;
  const MAX_MATCHES = 5_000;
  const instances = new WeakMap();
  const TOOLS = Object.freeze([
    { id: "regex-studio", name: "Regex Studio", group: "Văn bản", description: "Highlight, capture group, replace, test case và kiểm tra rủi ro regex." },
    { id: "database-playground", name: "Database Playground", group: "Dữ liệu", description: "SQL, SQLite WASM, schema, import CSV/JSON và Mongo query builder." }
  ]);

  const REGEX_LIBRARY = Object.freeze([
    { id: "email", name: "Email", pattern: "[\\w.+-]+@[\\w.-]+\\.[A-Za-z]{2,}", flags: "gi", sample: "hello@hh.vn" },
    { id: "phone-vn", name: "Số điện thoại Việt Nam", pattern: "(?:\\+84|0)(?:3|5|7|8|9)\\d{8}", flags: "g", sample: "0923459496" },
    { id: "citizen-vn", name: "CCCD 12 số", pattern: "\\b\\d{12}\\b", flags: "g", sample: "001203001234" },
    { id: "url", name: "URL HTTP(S)", pattern: "https?:\\/\\/[^\\s<]+", flags: "gi", sample: "https://hh.vn/docs" },
    { id: "ipv4", name: "Địa chỉ IPv4", pattern: "\\b(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)(?:\\.(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)){3}\\b", flags: "g", sample: "192.168.1.1" },
    { id: "slug", name: "Slug", pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$", flags: "i", sample: "hh-platform-dev" },
    { id: "hex", name: "Màu HEX", pattern: "#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})\\b", flags: "gi", sample: "#62d7e7" },
    { id: "postal-vn", name: "Mã bưu chính Việt Nam", pattern: "\\b\\d{5,6}\\b", flags: "g", sample: "100000" }
  ]);

  const SQL_KEYWORDS = new Set(("SELECT FROM WHERE AND OR INSERT INTO VALUES UPDATE SET DELETE CREATE TABLE ALTER DROP JOIN LEFT RIGHT INNER OUTER FULL CROSS ON AS DISTINCT GROUP BY ORDER HAVING LIMIT OFFSET UNION ALL CASE WHEN THEN ELSE END NULL IS NOT LIKE IN EXISTS BETWEEN ASC DESC PRIMARY KEY FOREIGN REFERENCES DEFAULT CHECK UNIQUE INDEX VIEW WITH RECURSIVE EXPLAIN PRAGMA DATABASE USE RETURNING CONFLICT DO NOTHING".split(" ")));
  const SQL_BREAK_BEFORE = new Set(["SELECT", "FROM", "WHERE", "GROUP BY", "ORDER BY", "HAVING", "LIMIT", "OFFSET", "VALUES", "SET", "RETURNING", "UNION", "UNION ALL", "LEFT JOIN", "RIGHT JOIN", "INNER JOIN", "OUTER JOIN", "FULL JOIN", "CROSS JOIN", "JOIN", "ON"]);
  const DESTRUCTIVE_SQL = /\b(?:DROP|TRUNCATE|DELETE|UPDATE|ALTER)\b/i;
  const SECRET_KEYS = /^(?:password|passwd|pwd|secret|token|api[_-]?key|authorization|connection(?:string)?|uri)$/i;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function safeText(value, maxLength) {
    return String(value == null ? "" : value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").slice(0, maxLength || MAX_INPUT);
  }

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function runtimeRegexFlags() {
    const supported = [];
    for (const flag of ["d", "g", "i", "m", "s", "u", "v", "y"]) {
      try { new RegExp("", flag); supported.push(flag); } catch (_) { /* Runtime does not support this flag. */ }
    }
    return supported;
  }

  function normalizeFlags(flags) {
    const supported = runtimeRegexFlags();
    const normalized = [];
    for (const flag of String(flags || "")) {
      if (!supported.includes(flag)) throw new Error(`Flag '${flag}' không được JavaScript runtime này hỗ trợ.`);
      if (!normalized.includes(flag)) normalized.push(flag);
    }
    if (normalized.includes("u") && normalized.includes("v")) throw new Error("Không thể dùng đồng thời flags u và v.");
    return normalized.join("");
  }

  function regexRisk(pattern) {
    const source = String(pattern || "");
    const findings = [];
    if (source.length > 1000) findings.push({ level: "high", code: "long-pattern", message: "Pattern rất dài; nên chia nhỏ trước khi chạy." });
    if (/\((?:[^()]|\\.)*[+*](?:[^()]|\\.)*\)[+*{]/.test(source)) findings.push({ level: "high", code: "nested-quantifier", message: "Có quantifier lồng nhau, dễ gây catastrophic backtracking." });
    if (/\((?:[^()]|\\.)*\|(?:[^()]|\\.)*\)[+*{]/.test(source)) findings.push({ level: "medium", code: "ambiguous-alternation", message: "Alternation lặp có thể tạo nhiều nhánh quay lui." });
    if (/\.\*[+*{]|\.\+[+*{]/.test(source)) findings.push({ level: "high", code: "wildcard-repeat", message: "Wildcard lặp chồng nhau có rủi ro hiệu năng cao." });
    if (/\\[1-9].*(?:[+*]|\{\d*,?\d*\})/.test(source)) findings.push({ level: "medium", code: "backreference-repeat", message: "Backreference kết hợp lặp có thể chậm trên đầu vào lớn." });
    if (!findings.length) findings.push({ level: "low", code: "no-obvious-risk", message: "Không phát hiện mẫu backtracking nguy hiểm phổ biến." });
    return { level: findings.some((item) => item.level === "high") ? "high" : findings.some((item) => item.level === "medium") ? "medium" : "low", findings };
  }

  function explainRegex(pattern) {
    const source = String(pattern || "");
    const tokens = [];
    let index = 0;
    const push = (raw, type, explanation) => tokens.push({ raw, type, explanation });
    while (index < source.length && tokens.length < 500) {
      const rest = source.slice(index);
      let match;
      if ((match = rest.match(/^\\[dDsSwWbB]/))) {
        const descriptions = { "\\d": "một chữ số", "\\D": "ký tự không phải số", "\\s": "khoảng trắng", "\\S": "ký tự không phải khoảng trắng", "\\w": "chữ, số hoặc gạch dưới", "\\W": "ký tự không thuộc nhóm chữ/số", "\\b": "ranh giới từ", "\\B": "vị trí không phải ranh giới từ" };
        push(match[0], "class", descriptions[match[0]]); index += match[0].length; continue;
      }
      if ((match = rest.match(/^\\[pP]\{[^}]+\}/))) { push(match[0], "unicode", "nhóm ký tự Unicode; cần flag u hoặc v"); index += match[0].length; continue; }
      if ((match = rest.match(/^\\./))) { push(match[0], "escape", `ký tự escape ${match[0].slice(1)}`); index += match[0].length; continue; }
      if ((match = rest.match(/^\(\?<([A-Za-z][A-Za-z0-9_]*)>/))) { push(match[0], "group", `bắt đầu capture group có tên '${match[1]}'`); index += match[0].length; continue; }
      if (rest.startsWith("(?:")) { push("(?:", "group", "bắt đầu nhóm không capture"); index += 3; continue; }
      if (rest.startsWith("(?=")) { push("(?=", "lookaround", "positive lookahead"); index += 3; continue; }
      if (rest.startsWith("(?!")) { push("(?!", "lookaround", "negative lookahead"); index += 3; continue; }
      if (rest.startsWith("(?<=")) { push("(?<=", "lookaround", "positive lookbehind; không được RE2 hỗ trợ"); index += 4; continue; }
      if (rest.startsWith("(?<!")) { push("(?<!", "lookaround", "negative lookbehind; không được RE2 hỗ trợ"); index += 4; continue; }
      if ((match = rest.match(/^\[(?:\\.|[^\]])*\]/))) { push(match[0], "class", "một ký tự thuộc lớp ký tự này"); index += match[0].length; continue; }
      if ((match = rest.match(/^\{(\d+)(?:,(\d*))?\}(\?)?/))) {
        const max = match[2] === undefined ? match[1] : match[2] || "không giới hạn";
        push(match[0], "quantifier", `lặp từ ${match[1]} đến ${max} lần${match[3] ? ", ưu tiên ít" : ""}`); index += match[0].length; continue;
      }
      const map = {
        "^": ["anchor", "đầu chuỗi hoặc đầu dòng khi có flag m"], "$": ["anchor", "cuối chuỗi hoặc cuối dòng khi có flag m"],
        ".": ["wildcard", "một ký tự bất kỳ"], "*": ["quantifier", "lặp 0 hoặc nhiều lần"], "+": ["quantifier", "lặp 1 hoặc nhiều lần"],
        "?": ["quantifier", "tùy chọn hoặc biến quantifier thành lazy"], "|": ["alternation", "hoặc"], "(": ["group", "bắt đầu capture group"], ")": ["group", "kết thúc group"]
      };
      if (map[source[index]]) push(source[index], map[source[index]][0], map[source[index]][1]);
      else push(source[index], "literal", `khớp ký tự '${source[index]}'`);
      index += 1;
    }
    return tokens;
  }

  function regexCompatibility(pattern, engine) {
    const source = String(pattern || "");
    const selected = ["javascript", "pcre", "re2"].includes(engine) ? engine : "javascript";
    const warnings = [];
    if (selected === "pcre") {
      warnings.push("PCRE chưa được nhúng trong trình duyệt. Workspace chỉ kiểm tra tương thích và không chạy pattern này.");
      if (/\\K|\(\?R\)|\(\?\(/.test(source)) warnings.push("Pattern dùng cú pháp PCRE riêng, không tương thích JavaScript.");
    }
    if (selected === "re2") {
      warnings.push("RE2 chưa được nhúng trong trình duyệt. Workspace chỉ kiểm tra tương thích và không chạy pattern này.");
      if (/\(\?<([=!])|\\[1-9]|\\k</.test(source)) warnings.push("RE2 không hỗ trợ lookbehind hoặc backreference trong pattern này.");
    }
    return { engine: selected, executable: selected === "javascript", warnings };
  }

  function compileRegex(pattern, flags, forceGlobal) {
    const source = safeText(pattern, 10_000);
    if (!source) throw new Error("Pattern đang trống.");
    const normalized = normalizeFlags(flags);
    const effectiveFlags = forceGlobal && !normalized.includes("g") && !normalized.includes("y") ? `${normalized}g` : normalized;
    return new RegExp(source, effectiveFlags);
  }

  function runRegex(options) {
    const config = options && typeof options === "object" ? options : {};
    const input = safeText(config.input, MAX_INPUT);
    const compatibility = regexCompatibility(config.pattern, config.engine);
    const risk = regexRisk(config.pattern);
    if (!compatibility.executable) return { executed: false, compatibility, risk, matches: [], segments: [], replacementPreview: input, elapsedMs: 0, truncated: false };
    if (risk.level === "high" && config.allowRisky !== true) {
      return { executed: false, blocked: true, compatibility, risk, matches: [], segments: [{ text: input, match: false }], replacementPreview: input, elapsedMs: 0, truncated: false, error: "Đã chặn tự động vì pattern có rủi ro catastrophic backtracking. Chỉ chạy trong Worker có timeout hoặc sửa pattern trước." };
    }
    const maxMatches = Math.max(1, Math.min(MAX_MATCHES, Number(config.maxMatches) || 1000));
    const regex = compileRegex(config.pattern, config.flags, true);
    const started = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
    const matches = [];
    let current;
    while ((current = regex.exec(input)) && matches.length < maxMatches) {
      matches.push({ index: current.index, end: current.index + current[0].length, text: current[0], groups: current.slice(1), namedGroups: current.groups ? { ...current.groups } : {} });
      if (current[0] === "") regex.lastIndex += 1;
      if (!regex.global && !regex.sticky) break;
    }
    const elapsedMs = (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now()) - started;
    const segments = [];
    let cursor = 0;
    for (const match of matches) {
      if (match.index > cursor) segments.push({ text: input.slice(cursor, match.index), match: false });
      segments.push({ text: match.text || "∅", rawText: match.text, match: true, index: match.index, groups: clone(match.groups) });
      cursor = Math.max(cursor, match.end);
    }
    if (cursor < input.length) segments.push({ text: input.slice(cursor), match: false });
    const replaceRegex = compileRegex(config.pattern, config.flags, false);
    const replacementPreview = input.replace(replaceRegex, String(config.replacement == null ? "" : config.replacement));
    return { executed: true, compatibility, risk, matches, segments, replacementPreview, elapsedMs, truncated: matches.length >= maxMatches };
  }

  function runRegexCases(options) {
    const config = options && typeof options === "object" ? options : {};
    const cases = Array.isArray(config.cases) ? config.cases.slice(0, 200) : [];
    return cases.map((item, index) => {
      const input = safeText(item && item.input, 100_000);
      let passed = false; let actual = null; let error = "";
      try {
        const regex = compileRegex(config.pattern, config.flags, false);
        if (item.mode === "replace") { actual = input.replace(regex, String(item.replacement == null ? config.replacement || "" : item.replacement)); passed = actual === String(item.expected == null ? "" : item.expected); }
        else { actual = regex.test(input); passed = actual === Boolean(item.expected); }
      } catch (cause) { error = cause.message; }
      return { id: safeText(item && item.id || `case-${index + 1}`, 80), input, expected: item && item.expected, actual, passed, error };
    });
  }

  function tokenizeSQL(sql) {
    const source = safeText(sql, MAX_INPUT);
    const tokens = [];
    const re = /(--[^\n]*|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'|"(?:""|[^"])*"|`(?:``|[^`])*`|\[(?:\]\]|[^\]])*\]|\b\d+(?:\.\d+)?\b|<>|!=|<=|>=|::|[-+*/%=<>,.;()]|\b[A-Za-z_][A-Za-z0-9_$]*\b|\s+|.)/g;
    let match;
    while ((match = re.exec(source))) tokens.push(match[0]);
    return tokens;
  }

  function formatSQL(sql, options) {
    const config = options || {};
    const tokens = tokenizeSQL(sql);
    const words = [];
    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index];
      if (/^\s+$/.test(token)) continue;
      let combined = token;
      const upper = token.toUpperCase();
      const next = (tokens.slice(index + 1).find((entry) => !/^\s+$/.test(entry)) || "").toUpperCase();
      if (["GROUP", "ORDER", "PRIMARY", "FOREIGN", "LEFT", "RIGHT", "INNER", "OUTER", "FULL", "CROSS", "UNION"].includes(upper) && ["BY", "KEY", "JOIN", "ALL"].includes(next)) {
        let cursor = index + 1;
        while (cursor < tokens.length && /^\s+$/.test(tokens[cursor])) cursor += 1;
        combined = `${token} ${tokens[cursor]}`; index = cursor;
      }
      const keyword = combined.toUpperCase();
      words.push(SQL_KEYWORDS.has(keyword) || SQL_BREAK_BEFORE.has(keyword) ? (config.keywordCase === "lower" ? keyword.toLowerCase() : keyword) : combined);
    }
    let output = ""; let indent = 0; let lineStart = true;
    const newline = () => { output = output.trimEnd(); if (output) output += "\n"; lineStart = true; };
    const write = (value) => { if (lineStart) { output += "  ".repeat(Math.max(0, indent)); lineStart = false; } else if (output && !/[\s.(]$/.test(output) && !/^[,.;)]/.test(value)) output += " "; output += value; };
    for (const word of words) {
      const upper = word.toUpperCase();
      if (word === ")") { indent = Math.max(0, indent - 1); write(word); continue; }
      if (SQL_BREAK_BEFORE.has(upper)) { newline(); write(word); continue; }
      if (upper === "AND" || upper === "OR") { newline(); write(word); continue; }
      if (word === "(") { write(word); indent += 1; continue; }
      if (word === ",") { write(word); if (output.split("\n").at(-1).length > 96) newline(); continue; }
      if (word === ";") { write(word); newline(); continue; }
      write(word);
    }
    return output.trim();
  }

  function analyzeSQL(sql) {
    const source = String(sql || "");
    const upper = source.toUpperCase();
    const warnings = [];
    if (DESTRUCTIVE_SQL.test(source)) warnings.push({ level: "danger", code: "destructive", message: "Câu lệnh có thể sửa hoặc xóa dữ liệu. Hãy dùng transaction và backup." });
    if (/\b(?:UPDATE|DELETE)\b/i.test(source) && !/\bWHERE\b/i.test(source)) warnings.push({ level: "danger", code: "missing-where", message: "UPDATE/DELETE không có WHERE sẽ tác động toàn bộ bảng." });
    if (/\bSELECT\s+\*/i.test(source)) warnings.push({ level: "warning", code: "select-star", message: "SELECT * có thể đọc dữ liệu thừa; nên liệt kê cột cần thiết." });
    if (/\bLIKE\s+'%/i.test(source)) warnings.push({ level: "warning", code: "leading-wildcard", message: "LIKE bắt đầu bằng % thường không tận dụng được index." });
    if (/\bJOIN\b/i.test(source) && !/\bON\b/i.test(source)) warnings.push({ level: "danger", code: "join-without-on", message: "JOIN không có ON có thể tạo tích Descartes." });
    if (/\bWHERE\b/i.test(source) && /\bOR\b/i.test(source)) warnings.push({ level: "info", code: "or-plan", message: "Kiểm tra EXPLAIN; nhiều điều kiện OR đôi khi cần index riêng hoặc UNION." });
    const statement = (upper.match(/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH|EXPLAIN)/) || [null, "UNKNOWN"])[1];
    const advisory = [
      "EXPLAIN trong workspace là phân tích tĩnh, không phải execution plan của máy chủ.",
      /\bWHERE\b/i.test(source) ? "Kiểm tra index cho các cột xuất hiện trong WHERE." : "Không có WHERE để đánh giá index lọc.",
      /\bORDER BY\b/i.test(source) ? "Đối chiếu ORDER BY với index ghép và thứ tự cột." : "Không có bước sắp xếp rõ ràng."
    ];
    return { statement, destructive: DESTRUCTIVE_SQL.test(source), warnings, advisory, tables: [...source.matchAll(/\b(?:FROM|JOIN|INTO|UPDATE|TABLE)\s+([A-Za-z_][\w$]*)/gi)].map((match) => match[1]) };
  }

  function assertIdentifier(value, label) {
    const text = String(value || "").trim();
    if (!/^[A-Za-z_][A-Za-z0-9_$]*$/.test(text)) throw new Error(`${label || "Identifier"} không hợp lệ.`);
    return text;
  }

  function buildSelectQuery(input) {
    const config = input && typeof input === "object" ? input : {};
    const table = assertIdentifier(config.table, "Tên bảng");
    const columns = Array.isArray(config.columns) && config.columns.length ? config.columns.map((item) => assertIdentifier(item, "Tên cột")) : ["*"];
    const params = [];
    const filters = (Array.isArray(config.filters) ? config.filters : []).slice(0, 50).map((filter) => {
      const column = assertIdentifier(filter.column, "Cột lọc");
      const operator = ["=", "!=", ">", ">=", "<", "<=", "LIKE", "IN", "IS NULL", "IS NOT NULL"].includes(String(filter.operator || "=").toUpperCase()) ? String(filter.operator || "=").toUpperCase() : "=";
      if (operator === "IS NULL" || operator === "IS NOT NULL") return `${column} ${operator}`;
      if (operator === "IN") {
        const values = Array.isArray(filter.value) ? filter.value.slice(0, 100) : String(filter.value || "").split(",").map((item) => item.trim());
        params.push(...values); return `${column} IN (${values.map(() => "?").join(", ") || "NULL"})`;
      }
      params.push(filter.value); return `${column} ${operator} ?`;
    });
    let sql = `SELECT ${columns.join(", ")} FROM ${table}`;
    if (filters.length) sql += ` WHERE ${filters.join(config.match === "any" ? " OR " : " AND ")}`;
    if (config.orderBy && config.orderBy.column) sql += ` ORDER BY ${assertIdentifier(config.orderBy.column, "Cột sắp xếp")} ${String(config.orderBy.direction).toUpperCase() === "DESC" ? "DESC" : "ASC"}`;
    if (config.limit != null && config.limit !== "") sql += ` LIMIT ${Math.max(1, Math.min(10000, Number(config.limit) || 100))}`;
    return { sql: `${sql};`, params };
  }

  function parseCSV(text, delimiter) {
    const source = safeText(text, MAX_INPUT);
    const separator = delimiter || ",";
    const rows = []; let row = []; let cell = ""; let quoted = false;
    for (let index = 0; index < source.length; index += 1) {
      const char = source[index];
      if (quoted) {
        if (char === '"' && source[index + 1] === '"') { cell += '"'; index += 1; }
        else if (char === '"') quoted = false;
        else cell += char;
      } else if (char === '"') quoted = true;
      else if (char === separator) { row.push(cell); cell = ""; }
      else if (char === "\n") { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
      else cell += char;
    }
    row.push(cell.replace(/\r$/, "")); if (row.some((value) => value !== "") || !rows.length) rows.push(row);
    const headers = (rows.shift() || []).map((header, index) => safeText(header.trim() || `column_${index + 1}`, 80));
    return rows.filter((values) => values.some((value) => value !== "")).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] == null ? "" : values[index]])));
  }

  function importTabular(text, type) {
    if (type === "json") {
      const parsed = JSON.parse(safeText(text, MAX_INPUT));
      const rows = Array.isArray(parsed) ? parsed : parsed && typeof parsed === "object" ? [parsed] : [];
      return rows.slice(0, 10000).map((row) => row && typeof row === "object" && !Array.isArray(row) ? { ...row } : { value: row });
    }
    return parseCSV(text, type === "tsv" ? "\t" : ",").slice(0, 10000);
  }

  function inferSchema(name, rows) {
    const table = assertIdentifier(name || "imported_data", "Tên bảng");
    const list = Array.isArray(rows) ? rows : [];
    const columns = [...new Set(list.flatMap((row) => Object.keys(row || {})))].slice(0, 200).map((key) => {
      const values = list.map((row) => row[key]).filter((value) => value !== "" && value != null).slice(0, 100);
      const type = values.length && values.every((value) => typeof value === "number" || /^-?\d+(?:\.\d+)?$/.test(String(value))) ? "REAL" : values.length && values.every((value) => /^(?:true|false|0|1)$/i.test(String(value))) ? "INTEGER" : "TEXT";
      return { name: assertIdentifier(String(key).replace(/[^A-Za-z0-9_$]/g, "_").replace(/^\d/, "_$&") || "column", "Tên cột"), type, nullable: values.length < list.length, primaryKey: false };
    });
    return { name: table, columns };
  }

  function normalizeSchema(input) {
    const source = input && typeof input === "object" ? input : {};
    const tables = (Array.isArray(source.tables) ? source.tables : []).slice(0, 100).map((table, tableIndex) => ({
      id: safeText(table.id || `table-${tableIndex + 1}`, 80),
      name: assertIdentifier(table.name || `table_${tableIndex + 1}`, "Tên bảng"),
      x: Number.isFinite(Number(table.x)) ? Number(table.x) : 40 + tableIndex * 40,
      y: Number.isFinite(Number(table.y)) ? Number(table.y) : 40 + tableIndex * 32,
      columns: (Array.isArray(table.columns) ? table.columns : []).slice(0, 200).map((column, columnIndex) => ({
        id: safeText(column.id || `column-${columnIndex + 1}`, 80), name: assertIdentifier(column.name || `column_${columnIndex + 1}`, "Tên cột"),
        type: ["INTEGER", "REAL", "TEXT", "BLOB", "BOOLEAN", "DATE", "DATETIME", "JSON"].includes(String(column.type || "TEXT").toUpperCase()) ? String(column.type || "TEXT").toUpperCase() : "TEXT",
        nullable: column.nullable !== false, primaryKey: Boolean(column.primaryKey), unique: Boolean(column.unique)
      }))
    }));
    return { tables, relations: (Array.isArray(source.relations) ? source.relations : []).slice(0, 200).map((relation) => ({ from: safeText(relation.from, 160), to: safeText(relation.to, 160), type: ["1:1", "1:n", "n:n"].includes(relation.type) ? relation.type : "1:n" })) };
  }

  function schemaToSQL(schema) {
    const normalized = normalizeSchema(schema);
    return normalized.tables.map((table) => `CREATE TABLE ${table.name} (\n${table.columns.map((column) => `  ${column.name} ${column.type}${column.primaryKey ? " PRIMARY KEY" : ""}${column.unique ? " UNIQUE" : ""}${column.nullable ? "" : " NOT NULL"}`).join(",\n")}\n);`).join("\n\n");
  }

  function sanitizeMongoValue(value, depth) {
    const level = Number(depth) || 0;
    if (level > 8) throw new Error("Mongo query vượt quá độ sâu cho phép.");
    if (value == null || typeof value === "boolean" || typeof value === "number") return value;
    if (typeof value === "string") return safeText(value, 20_000);
    if (Array.isArray(value)) return value.slice(0, 500).map((item) => sanitizeMongoValue(item, level + 1));
    if (typeof value !== "object") throw new Error("Giá trị Mongo không hợp lệ.");
    const output = {};
    for (const [key, item] of Object.entries(value).slice(0, 300)) {
      if (SECRET_KEYS.test(key)) throw new Error(`Không nhận bí mật kết nối trong trường '${key}'.`);
      if (key.includes("\0")) throw new Error("Tên trường Mongo chứa ký tự không hợp lệ.");
      output[key] = sanitizeMongoValue(item, level + 1);
    }
    return output;
  }

  function buildMongoQuery(input) {
    const config = input && typeof input === "object" ? input : {};
    const collection = assertIdentifier(config.collection || "items", "Collection");
    const operation = ["find", "findOne", "countDocuments", "aggregate"].includes(config.operation) ? config.operation : "find";
    const filter = sanitizeMongoValue(config.filter || {});
    const projection = sanitizeMongoValue(config.projection || {});
    const sort = sanitizeMongoValue(config.sort || {});
    const limit = Math.max(1, Math.min(1000, Number(config.limit) || 50));
    let expression;
    if (operation === "aggregate") {
      const pipeline = Array.isArray(config.pipeline) ? sanitizeMongoValue(config.pipeline) : [{ $match: filter }];
      expression = `db.${collection}.aggregate(${JSON.stringify(pipeline, null, 2)})`;
    } else if (operation === "countDocuments") expression = `db.${collection}.countDocuments(${JSON.stringify(filter, null, 2)})`;
    else expression = `db.${collection}.${operation}(${JSON.stringify(filter, null, 2)}, ${JSON.stringify({ projection }, null, 2)})${operation === "find" ? `.sort(${JSON.stringify(sort)}).limit(${limit})` : ""}`;
    return { operation, collection, filter, projection, sort, limit, expression, executable: false, notice: "Chỉ sinh truy vấn. Workspace không nhận URI, mật khẩu hay kết nối MongoDB trực tiếp." };
  }

  function compareValues(left, operator, right) {
    if (operator === "=") return String(left) === String(right);
    if (operator === "!=") return String(left) !== String(right);
    if (operator === ">") return Number(left) > Number(right);
    if (operator === ">=") return Number(left) >= Number(right);
    if (operator === "<") return Number(left) < Number(right);
    if (operator === "<=") return Number(left) <= Number(right);
    if (operator === "LIKE") { const escaped = String(right).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, "."); return new RegExp(`^${escaped}$`, "i").test(String(left)); }
    return false;
  }

  class InMemoryDatabase {
    constructor(initialTables) {
      this.tables = new Map();
      if (initialTables && typeof initialTables === "object") Object.entries(initialTables).forEach(([name, rows]) => this.import(name, rows));
    }
    import(name, rows) {
      const table = assertIdentifier(name, "Tên bảng");
      const safeRows = (Array.isArray(rows) ? rows : []).slice(0, 10000).map((row) => row && typeof row === "object" && !Array.isArray(row) ? clone(row) : { value: row });
      this.tables.set(table, safeRows); return { table, rows: safeRows.length, columns: [...new Set(safeRows.flatMap((row) => Object.keys(row)))] };
    }
    list() { return [...this.tables.entries()].map(([name, rows]) => ({ name, rows: rows.length, columns: [...new Set(rows.flatMap((row) => Object.keys(row)))] })); }
    execute(sql, params) {
      const source = String(sql || "").trim().replace(/;$/, "");
      const bindings = Array.isArray(params) ? params : [];
      let bindingIndex = 0;
      if (!/^SELECT\b/i.test(source)) throw new Error("Fallback in-memory chỉ chạy SELECT đơn giản. Dùng SQLite WASM cho SQL đầy đủ.");
      const match = source.match(/^SELECT\s+(.+?)\s+FROM\s+([A-Za-z_]\w*)(?:\s+WHERE\s+(.+?))?(?:\s+ORDER\s+BY\s+([A-Za-z_]\w*)(?:\s+(ASC|DESC))?)?(?:\s+LIMIT\s+(\d+))?$/i);
      if (!match) throw new Error("Fallback hỗ trợ SELECT columns FROM table [WHERE điều_kiện AND ...] [ORDER BY] [LIMIT].");
      const [, rawColumns, table, rawWhere, orderColumn, direction, rawLimit] = match;
      if (!this.tables.has(table)) throw new Error(`Không tìm thấy bảng '${table}'.`);
      let rows = this.tables.get(table).map((row) => clone(row));
      if (rawWhere) {
        const filters = rawWhere.split(/\s+AND\s+/i).map((part) => {
          const filter = part.match(/^([A-Za-z_]\w*)\s*(=|!=|>=|<=|>|<|LIKE)\s*(?:'((?:''|[^'])*)'|"((?:""|[^"])*)"|(-?\d+(?:\.\d+)?)|(true|false|null)|(\?))$/i);
          if (!filter) throw new Error(`Điều kiện fallback chưa hỗ trợ: ${part}`);
          if (filter[7] && bindingIndex >= bindings.length) throw new Error("Thiếu giá trị cho placeholder ?.");
          const value = filter[3] != null ? filter[3].replace(/''/g, "'") : filter[4] != null ? filter[4].replace(/""/g, '"') : filter[5] != null ? Number(filter[5]) : filter[7] ? bindings[bindingIndex++] : /^true$/i.test(filter[6]) ? true : /^false$/i.test(filter[6]) ? false : null;
          return { column: filter[1], operator: filter[2].toUpperCase(), value };
        });
        rows = rows.filter((row) => filters.every((filter) => compareValues(row[filter.column], filter.operator, filter.value)));
      }
      if (orderColumn) rows.sort((left, right) => String(left[orderColumn] == null ? "" : left[orderColumn]).localeCompare(String(right[orderColumn] == null ? "" : right[orderColumn]), "vi", { numeric: true }) * (String(direction).toUpperCase() === "DESC" ? -1 : 1));
      rows = rows.slice(0, Math.max(1, Math.min(10000, Number(rawLimit) || 500)));
      const columns = rawColumns.trim() === "*" ? [...new Set(rows.flatMap((row) => Object.keys(row)))] : rawColumns.split(",").map((column) => assertIdentifier(column.trim(), "Tên cột"));
      return { engine: "in-memory-subset", columns, rows: rows.map((row) => Object.fromEntries(columns.map((column) => [column, row[column]]))), rowCount: rows.length, notice: "Kết quả từ fallback in-memory, không phải SQLite execution plan." };
    }
  }

  function detectSQLiteRuntime(runtime) {
    const candidate = runtime || globalScope.sqlite3 || globalScope.SQL;
    if (candidate && candidate.oo1 && typeof candidate.oo1.DB === "function") return { available: true, kind: "sqlite3-oo1", runtime: candidate };
    if (candidate && typeof candidate.Database === "function") return { available: true, kind: "sqljs", runtime: candidate };
    return { available: false, kind: "none", runtime: null, reason: "Chưa nạp SQLite WASM. Đang dùng bảng in-memory với SELECT giới hạn." };
  }

  function createSQLiteAdapter(runtime) {
    const detected = detectSQLiteRuntime(runtime);
    if (!detected.available) return { available: false, kind: "none", reason: detected.reason, execute() { throw new Error(detected.reason); }, close() {} };
    if (detected.kind === "sqlite3-oo1") {
      const db = new detected.runtime.oo1.DB(":memory:", "c");
      return { available: true, kind: detected.kind, execute(sql, params) { const rows = []; const columns = []; db.exec({ sql, bind: Array.isArray(params) ? params : [], rowMode: "object", callback(row) { rows.push({ ...row }); } }); rows.forEach((row) => Object.keys(row).forEach((key) => { if (!columns.includes(key)) columns.push(key); })); return { engine: "sqlite-wasm", columns, rows, rowCount: rows.length }; }, close() { db.close(); } };
    }
    const db = new detected.runtime.Database();
    return { available: true, kind: detected.kind, execute(sql, params) { const result = db.exec(sql, { bind: Array.isArray(params) ? params : [] }); const first = result[0] || { columns: [], values: [] }; return { engine: "sqlite-wasm", columns: first.columns, rows: first.values.map((values) => Object.fromEntries(first.columns.map((column, index) => [column, values[index]]))), rowCount: first.values.length }; }, close() { db.close(); } };
  }

  function createDefaultState() {
    return {
      format: FORMAT, version: VERSION, activeTool: "regex-studio",
      regex: { pattern: "(?:\\+84|0)(?:3|5|7|8|9)\\d{8}", flags: "g", engine: "javascript", replacement: "[SĐT]", input: "Liên hệ 0923459496 hoặc email hello@hh.vn", pinned: [], history: [] },
      database: { tab: "sql", sql: "SELECT id, name, score FROM students WHERE score >= 8 ORDER BY score DESC LIMIT 20;", tableName: "students", importType: "json", importText: '[{"id":1,"name":"An","score":9},{"id":2,"name":"Bình","score":7.5}]', schema: { tables: [], relations: [] }, mongo: { collection: "projects", operation: "find", filter: { status: "active" }, projection: { name: 1, status: 1 }, sort: { updatedAt: -1 }, limit: 50 } }
    };
  }

  function normalizeState(input) {
    const fallback = createDefaultState(); const source = input && typeof input === "object" ? input : {};
    const regex = source.regex && typeof source.regex === "object" ? source.regex : {};
    const database = source.database && typeof source.database === "object" ? source.database : {};
    return {
      format: FORMAT, version: VERSION,
      activeTool: ["regex-studio", "database-playground"].includes(source.activeTool) ? source.activeTool : fallback.activeTool,
      regex: {
        pattern: safeText(regex.pattern == null ? fallback.regex.pattern : regex.pattern, 10_000), flags: safeText(regex.flags == null ? fallback.regex.flags : regex.flags, 10),
        engine: ["javascript", "pcre", "re2"].includes(regex.engine) ? regex.engine : "javascript", replacement: safeText(regex.replacement == null ? fallback.regex.replacement : regex.replacement, 100_000),
        input: safeText(regex.input == null ? fallback.regex.input : regex.input, MAX_INPUT), pinned: (Array.isArray(regex.pinned) ? regex.pinned : []).slice(0, 30), history: (Array.isArray(regex.history) ? regex.history : []).slice(0, 30)
      },
      database: {
        tab: ["sql", "import", "schema", "mongo"].includes(database.tab) ? database.tab : "sql", sql: safeText(database.sql == null ? fallback.database.sql : database.sql, MAX_INPUT),
        tableName: safeText(database.tableName || fallback.database.tableName, 80), importType: ["json", "csv", "tsv"].includes(database.importType) ? database.importType : "json",
        importText: safeText(database.importText == null ? fallback.database.importText : database.importText, MAX_INPUT), schema: normalizeSchema(database.schema || fallback.database.schema),
        mongo: { ...fallback.database.mongo, ...(database.mongo && typeof database.mongo === "object" ? sanitizeMongoValue(database.mongo) : {}) }
      }
    };
  }

  function readStorage(storage) {
    try { return normalizeState(JSON.parse(storage && storage.getItem(STORAGE_KEY) || "null")); } catch (_) { return createDefaultState(); }
  }

  function writeStorage(storage, state) {
    try { if (storage) storage.setItem(STORAGE_KEY, JSON.stringify(normalizeState(state))); return true; } catch (_) { return false; }
  }

  function renderSegments(doc, container, segments) {
    container.replaceChildren();
    for (const segment of segments) {
      const node = doc.createElement(segment.match ? "mark" : "span");
      node.textContent = segment.text;
      if (segment.match) node.title = `Khớp tại vị trí ${segment.index}`;
      container.appendChild(node);
    }
    if (!segments.length) container.textContent = "Không có kết quả.";
  }

  function tableMarkup(result) {
    const columns = result && Array.isArray(result.columns) ? result.columns : [];
    const rows = result && Array.isArray(result.rows) ? result.rows : [];
    if (!columns.length) return '<p class="drd-empty">Không có hàng dữ liệu để hiển thị.</p>';
    return `<div class="drd-table-wrap"><table><thead><tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr></thead><tbody>${rows.slice(0, 500).map((row) => `<tr>${columns.map((column) => `<td>${escapeHtml(row[column] == null ? "" : typeof row[column] === "object" ? JSON.stringify(row[column]) : row[column])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }

  function mount(root, options) {
    if (!root || typeof root.replaceChildren !== "function") throw new Error("Cần phần tử root hợp lệ để mở Regex/Database workspace.");
    if (instances.has(root)) instances.get(root).destroy();
    const doc = root.ownerDocument || globalScope.document;
    let storage = options && options.storage;
    if (!storage) { try { storage = globalScope.localStorage; } catch (_) { storage = null; } }
    let state = readStorage(storage);
    if (options && ["regex-studio", "database-playground"].includes(options.toolId)) state.activeTool = options.toolId;
    const memory = new InMemoryDatabase();
    const sqlite = createSQLiteAdapter(options && options.sqliteRuntime);
    let queryParams = [];
    let destroyed = false;

    function persist() { writeStorage(storage, state); }
    function status(message, tone) { const node = root.querySelector("[data-drd-status]"); if (node) { node.textContent = message; node.dataset.tone = tone || "info"; } }

    function shellMarkup() {
      return `<section class="drd" data-drd-root>
        <header class="drd-hero"><div><span>HH DEVELOPER LAB</span><h2>Regex & Database Studio</h2><p>Kiểm thử pattern, thiết kế dữ liệu và chạy truy vấn cục bộ với giới hạn được công khai rõ ràng.</p></div><div class="drd-engine"><i></i><strong>${sqlite.available ? "SQLite WASM" : "Local fallback"}</strong><small>${sqlite.available ? "Runtime đã xác nhận" : "SELECT subset"}</small></div></header>
        <nav class="drd-tool-tabs" aria-label="Công cụ Regex và Database"><button type="button" data-drd-tool="regex-studio">.* <span>Regex Studio</span></button><button type="button" data-drd-tool="database-playground">DB <span>Database Playground</span></button></nav>
        <main data-drd-workspace></main><footer class="drd-status"><span data-drd-status role="status" aria-live="polite">Sẵn sàng xử lý trên thiết bị.</span><b>${escapeHtml(STORAGE_KEY)}</b></footer>
      </section>`;
    }

    function regexMarkup() {
      const current = state.regex;
      return `<section class="drd-workspace drd-regex">
        <div class="drd-titlebar"><div><small>REGEX-01 · LOCAL</small><h3>Regex Studio Pro</h3><p>JavaScript chạy thật. PCRE và RE2 chỉ kiểm tra tương thích.</p></div><button type="button" data-drd-pin>Ghim pattern</button></div>
        <div class="drd-regex-command">
          <label class="drd-pattern"><span>/</span><input data-drd-regex="pattern" value="${escapeHtml(current.pattern)}" aria-label="Regex pattern" spellcheck="false"><span>/</span><input data-drd-regex="flags" value="${escapeHtml(current.flags)}" aria-label="Regex flags" maxlength="8"></label>
          <label><span>Engine</span><select data-drd-regex="engine"><option value="javascript"${current.engine === "javascript" ? " selected" : ""}>JavaScript · chạy thật</option><option value="pcre"${current.engine === "pcre" ? " selected" : ""}>PCRE · compatibility</option><option value="re2"${current.engine === "re2" ? " selected" : ""}>RE2 · compatibility</option></select></label>
          <label><span>Thay thế</span><input data-drd-regex="replacement" value="${escapeHtml(current.replacement)}" placeholder="$1 hoặc nội dung"></label>
          <button class="drd-primary" type="button" data-drd-run-regex>Chạy kiểm thử</button>
        </div>
        <div class="drd-regex-grid">
          <section class="drd-panel drd-input-panel"><header><strong>Chuỗi kiểm thử</strong><small data-drd-input-count>0 ký tự</small></header><textarea data-drd-regex="input" spellcheck="false">${escapeHtml(current.input)}</textarea><div class="drd-library">${REGEX_LIBRARY.map((item) => `<button type="button" data-drd-pattern-id="${item.id}">${escapeHtml(item.name)}</button>`).join("")}</div></section>
          <section class="drd-panel"><header><strong>Highlight an toàn</strong><small data-drd-match-count>Chưa chạy</small></header><pre class="drd-highlight" data-drd-highlight></pre><div class="drd-metrics" data-drd-regex-metrics></div></section>
          <section class="drd-panel"><header><strong>Capture groups</strong><small>Index · value</small></header><div class="drd-scroll" data-drd-groups><p class="drd-empty">Chưa có capture group.</p></div></section>
          <section class="drd-panel"><header><strong>Giải thích tiếng Việt</strong><small>Token parser</small></header><div class="drd-scroll drd-token-list" data-drd-explain></div></section>
          <section class="drd-panel"><header><strong>Replace preview</strong><small>Không sửa dữ liệu gốc</small></header><pre data-drd-replace></pre></section>
          <section class="drd-panel"><header><strong>Test cases</strong><small>Mỗi dòng: input => true/false</small></header><textarea data-drd-cases spellcheck="false">0923459496 => true\n0123456789 => false</textarea><button type="button" data-drd-run-cases>Chạy test cases</button><div data-drd-case-results></div></section>
        </div>
      </section>`;
    }

    function databaseMarkup() {
      const db = state.database;
      return `<section class="drd-workspace drd-database">
        <div class="drd-titlebar"><div><small>DATABASE-02 · ${sqlite.available ? "SQLITE WASM" : "IN-MEMORY"}</small><h3>Database Playground</h3><p>Thiết kế schema, nhập dữ liệu và sinh truy vấn mà không nhận bí mật kết nối.</p></div><div class="drd-db-summary"><strong data-drd-table-total>${memory.list().length}</strong><span>Bảng cục bộ</span></div></div>
        <nav class="drd-subtabs" aria-label="Chế độ Database"><button type="button" data-drd-db-tab="sql">SQL Lab</button><button type="button" data-drd-db-tab="import">Import Data</button><button type="button" data-drd-db-tab="schema">Schema Designer</button><button type="button" data-drd-db-tab="mongo">Mongo Builder</button></nav>
        <div data-drd-db-pane></div>
      </section>`;
    }

    function databasePaneMarkup() {
      const db = state.database;
      if (db.tab === "import") return `<div class="drd-db-grid"><section class="drd-panel"><header><strong>Nhập CSV / JSON</strong><small>Tối đa 10.000 hàng</small></header><div class="drd-form-row"><label>Tên bảng<input data-drd-db="tableName" value="${escapeHtml(db.tableName)}"></label><label>Định dạng<select data-drd-db="importType"><option value="json"${db.importType === "json" ? " selected" : ""}>JSON</option><option value="csv"${db.importType === "csv" ? " selected" : ""}>CSV</option><option value="tsv"${db.importType === "tsv" ? " selected" : ""}>TSV</option></select></label></div><textarea data-drd-db="importText" spellcheck="false">${escapeHtml(db.importText)}</textarea><div class="drd-actions"><label class="drd-file">Chọn tệp<input type="file" accept=".json,.csv,.tsv,text/csv,application/json" data-drd-import-file></label><button class="drd-primary" type="button" data-drd-import>Nhập vào workspace</button></div></section><section class="drd-panel"><header><strong>Media tables</strong><small>Chỉ tồn tại trong phiên</small></header><div data-drd-table-list>${tableListMarkup()}</div></section></div>`;
      if (db.tab === "schema") return `<div class="drd-schema-layout"><section class="drd-panel"><header><strong>Schema JSON</strong><small>Table · column · relation</small></header><textarea data-drd-schema spellcheck="false">${escapeHtml(JSON.stringify(db.schema, null, 2))}</textarea><div class="drd-actions"><button class="drd-primary" type="button" data-drd-schema-apply>Áp dụng schema</button><button type="button" data-drd-schema-sql>Sinh DDL</button></div></section><section class="drd-panel"><header><strong>Sơ đồ dữ liệu</strong><small data-drd-schema-count>${db.schema.tables.length} bảng</small></header><div class="drd-schema-canvas" data-drd-schema-view>${schemaCardsMarkup()}</div><pre data-drd-schema-output></pre></section></div>`;
      if (db.tab === "mongo") return `<div class="drd-db-grid"><section class="drd-panel"><header><strong>Mongo Query Builder</strong><small>Không kết nối database</small></header><div class="drd-form-row"><label>Collection<input data-drd-mongo="collection" value="${escapeHtml(db.mongo.collection)}"></label><label>Operation<select data-drd-mongo="operation">${["find", "findOne", "countDocuments", "aggregate"].map((operation) => `<option value="${operation}"${db.mongo.operation === operation ? " selected" : ""}>${operation}</option>`).join("")}</select></label></div><label>Filter JSON<textarea data-drd-mongo="filter">${escapeHtml(JSON.stringify(db.mongo.filter, null, 2))}</textarea></label><label>Projection JSON<textarea data-drd-mongo="projection">${escapeHtml(JSON.stringify(db.mongo.projection, null, 2))}</textarea></label><button class="drd-primary" type="button" data-drd-mongo-build>Sinh truy vấn</button></section><section class="drd-panel"><header><strong>Mongo expression</strong><small>Copy vào backend đã bảo vệ</small></header><pre data-drd-mongo-output></pre><div class="drd-notice">Workspace từ chối URI, password, token và API key. Truy vấn không được gửi đi.</div></section></div>`;
      return `<div class="drd-sql-layout"><section class="drd-panel drd-sql-editor"><header><strong>SQL Editor</strong><small>${sqlite.available ? "SQLite WASM" : "Fallback SELECT subset"}</small></header><textarea data-drd-db="sql" spellcheck="false">${escapeHtml(db.sql)}</textarea><div class="drd-actions"><button type="button" data-drd-format-sql>Format SQL</button><button type="button" data-drd-explain-sql>Phân tích EXPLAIN</button><button class="drd-primary" type="button" data-drd-run-sql>Chạy cục bộ</button></div></section><aside class="drd-panel"><header><strong>Query Builder</strong><small data-drd-db-engine>${sqlite.available ? "WASM" : "MEMORY"}</small></header><div class="drd-query-builder"><label>Bảng<input data-drd-query="table" value="${escapeHtml(db.tableName)}"></label><label>Cột<input data-drd-query="columns" value="*" placeholder="id, name"></label><label>WHERE column<input data-drd-query="filterColumn" placeholder="status"></label><div class="drd-form-row"><label>Toán tử<select data-drd-query="operator"><option>=</option><option>!=</option><option>&gt;</option><option>&gt;=</option><option>&lt;</option><option>&lt;=</option><option>LIKE</option></select></label><label>Giá trị<input data-drd-query="filterValue" placeholder="active"></label></div><button type="button" data-drd-build-select>Sinh SELECT an toàn</button></div><header><strong>Object Explorer</strong><small>${memory.list().length} bảng</small></header><div data-drd-table-list>${tableListMarkup()}</div><div class="drd-notice">${escapeHtml(sqlite.available ? "SQL được thực thi bởi SQLite WASM trong trình duyệt." : sqlite.reason)}</div></aside><section class="drd-panel drd-sql-output"><header><strong>Results</strong><small data-drd-row-count>0 hàng</small></header><div data-drd-sql-warning></div><div data-drd-sql-result><p class="drd-empty">Nhập dữ liệu hoặc chạy truy vấn để bắt đầu.</p></div></section></div>`;
    }

    function tableListMarkup() {
      const tables = memory.list();
      return tables.length ? tables.map((table) => `<article class="drd-table-item"><div><strong>${escapeHtml(table.name)}</strong><span>${table.rows} hàng · ${table.columns.length} cột</span></div><button type="button" data-drd-use-table="${escapeHtml(table.name)}">SELECT</button></article>`).join("") : '<p class="drd-empty">Chưa có bảng. Mở Import Data để thêm JSON hoặc CSV.</p>';
    }

    function schemaCardsMarkup() {
      return state.database.schema.tables.length ? state.database.schema.tables.map((table) => `<article class="drd-schema-card"><header>${escapeHtml(table.name)}</header>${table.columns.map((column) => `<p><b>${column.primaryKey ? "PK" : column.unique ? "UQ" : "·"}</b><span>${escapeHtml(column.name)}</span><small>${column.type}</small></p>`).join("")}</article>`).join("") : '<p class="drd-empty">Áp dụng schema JSON hoặc nhập dữ liệu để tạo sơ đồ.</p>';
    }

    function render(message) {
      if (destroyed) return;
      if (!root.querySelector("[data-drd-root]")) root.innerHTML = shellMarkup();
      root.querySelectorAll("[data-drd-tool]").forEach((button) => button.classList.toggle("is-active", button.dataset.drdTool === state.activeTool));
      const workspace = root.querySelector("[data-drd-workspace]");
      workspace.innerHTML = state.activeTool === "regex-studio" ? regexMarkup() : databaseMarkup();
      if (state.activeTool === "regex-studio") updateRegex(false);
      else { root.querySelectorAll("[data-drd-db-tab]").forEach((button) => button.classList.toggle("is-active", button.dataset.drdDbTab === state.database.tab)); root.querySelector("[data-drd-db-pane]").innerHTML = databasePaneMarkup(); }
      if (message) status(message);
    }

    function updateRegex(recordHistory) {
      const current = state.regex;
      const inputCount = root.querySelector("[data-drd-input-count]"); if (inputCount) inputCount.textContent = `${current.input.length.toLocaleString("vi-VN")} ký tự`;
      const result = runRegex(current);
      const count = root.querySelector("[data-drd-match-count]");
      const highlight = root.querySelector("[data-drd-highlight]");
      const groups = root.querySelector("[data-drd-groups]");
      const explain = root.querySelector("[data-drd-explain]");
      const replacement = root.querySelector("[data-drd-replace]");
      const metrics = root.querySelector("[data-drd-regex-metrics]");
      if (!highlight) return result;
      renderSegments(doc, highlight, result.segments);
      count.textContent = result.executed ? `${result.matches.length} kết quả` : "Không thực thi";
      groups.innerHTML = result.matches.length ? result.matches.slice(0, 100).map((match, index) => `<article><b>#${index + 1}</b><span>${escapeHtml(match.text || "∅")}</span><small>index ${match.index}${match.groups.length ? ` · ${match.groups.length} group` : ""}</small>${match.groups.map((value, groupIndex) => `<code>$${groupIndex + 1} = ${escapeHtml(value == null ? "undefined" : value)}</code>`).join("")}</article>`).join("") : '<p class="drd-empty">Chưa có capture group.</p>';
      explain.innerHTML = explainRegex(current.pattern).map((token) => `<article><code>${escapeHtml(token.raw)}</code><span>${escapeHtml(token.explanation)}</span></article>`).join("");
      replacement.textContent = result.replacementPreview;
      const notices = [...result.compatibility.warnings, ...result.risk.findings.map((item) => item.message), ...(result.error ? [result.error] : [])];
      metrics.innerHTML = `<span class="is-${result.risk.level}">Rủi ro ${result.risk.level}</span><span>${result.elapsedMs.toFixed(3)} ms</span><span>${result.truncated ? "Đã giới hạn kết quả" : "Không cắt kết quả"}</span>${notices.map((notice) => `<small>${escapeHtml(notice)}</small>`).join("")}`;
      if (recordHistory) { current.history.unshift({ id: uid("regex"), pattern: current.pattern, flags: current.flags, matches: result.matches.length, at: new Date().toISOString() }); current.history = current.history.slice(0, 30); persist(); }
      return result;
    }

    function parseCaseLines() {
      return String(root.querySelector("[data-drd-cases]")?.value || "").split(/\r?\n/).filter(Boolean).slice(0, 200).map((line, index) => { const split = line.lastIndexOf("=>"); return { id: `case-${index + 1}`, input: split < 0 ? line.trim() : line.slice(0, split).trim(), expected: split < 0 ? true : line.slice(split + 2).trim().toLowerCase() === "true" }; });
    }

    function renderDatabasePane(message) {
      const pane = root.querySelector("[data-drd-db-pane]"); if (pane) pane.innerHTML = databasePaneMarkup();
      root.querySelectorAll("[data-drd-db-tab]").forEach((button) => button.classList.toggle("is-active", button.dataset.drdDbTab === state.database.tab));
      if (message) status(message);
    }

    async function onClick(event) {
      const target = event.target.closest("button,[data-drd-import-file]"); if (!target || !root.contains(target)) return;
      if (target.dataset.drdTool) { state.activeTool = target.dataset.drdTool; persist(); return render(`Đã mở ${target.textContent.trim()}.`); }
      if (target.dataset.drdPatternId) { const pattern = REGEX_LIBRARY.find((item) => item.id === target.dataset.drdPatternId); if (pattern) { Object.assign(state.regex, { pattern: pattern.pattern, flags: pattern.flags, input: pattern.sample }); persist(); render("Đã nạp pattern mẫu Việt Nam."); } return; }
      if (target.hasAttribute("data-drd-run-regex")) { updateRegex(true); return status("Đã chạy Regex bằng JavaScript trên thiết bị.", "success"); }
      if (target.hasAttribute("data-drd-pin")) { state.regex.pinned.unshift({ pattern: state.regex.pattern, flags: state.regex.flags }); state.regex.pinned = state.regex.pinned.slice(0, 30); persist(); return status("Đã ghim pattern vào workspace.", "success"); }
      if (target.hasAttribute("data-drd-run-cases")) { const results = runRegexCases({ ...state.regex, cases: parseCaseLines() }); const node = root.querySelector("[data-drd-case-results]"); node.innerHTML = results.map((item) => `<p class="${item.passed ? "is-pass" : "is-fail"}"><b>${item.passed ? "PASS" : "FAIL"}</b><span>${escapeHtml(item.input)}</span><small>actual: ${escapeHtml(String(item.actual))}</small></p>`).join(""); return status(`${results.filter((item) => item.passed).length}/${results.length} test case đạt.`); }
      if (target.dataset.drdDbTab) { state.database.tab = target.dataset.drdDbTab; persist(); return renderDatabasePane(); }
      if (target.dataset.drdUseTable) { state.database.tab = "sql"; state.database.sql = `SELECT * FROM ${target.dataset.drdUseTable} LIMIT 100;`; persist(); return renderDatabasePane("Đã tạo SELECT cho bảng cục bộ."); }
      if (target.hasAttribute("data-drd-format-sql")) { state.database.sql = formatSQL(state.database.sql); persist(); const area = root.querySelector('[data-drd-db="sql"]'); if (area) area.value = state.database.sql; return status("Đã định dạng SQL, giữ nguyên string và comment.", "success"); }
      if (target.hasAttribute("data-drd-build-select")) {
        try {
          const value = (name) => root.querySelector(`[data-drd-query="${name}"]`)?.value.trim() || "";
          const columns = value("columns") === "*" ? [] : value("columns").split(",").map((item) => item.trim()).filter(Boolean);
          const filters = value("filterColumn") ? [{ column: value("filterColumn"), operator: value("operator"), value: value("filterValue") }] : [];
          const built = buildSelectQuery({ table: value("table"), columns, filters, limit: 100 });
          state.database.sql = built.sql; queryParams = built.params;
          persist(); const area = root.querySelector('[data-drd-db="sql"]'); if (area) area.value = state.database.sql;
          return status("Đã sinh SELECT với identifier đã kiểm tra và value parameter hóa.", "success");
        } catch (cause) { return status(cause.message, "danger"); }
      }
      if (target.hasAttribute("data-drd-explain-sql")) { const report = analyzeSQL(state.database.sql); const node = root.querySelector("[data-drd-sql-warning]"); node.innerHTML = `<div class="drd-advisory"><strong>${escapeHtml(report.statement)} · Static EXPLAIN advisory</strong>${report.warnings.map((item) => `<p class="is-${item.level}">${escapeHtml(item.message)}</p>`).join("")}${report.advisory.map((item) => `<p>${escapeHtml(item)}</p>`).join("")}</div>`; return status("Đã phân tích tĩnh. Đây không phải query plan của server."); }
      if (target.hasAttribute("data-drd-run-sql")) {
        const report = analyzeSQL(state.database.sql); const warning = root.querySelector("[data-drd-sql-warning]");
        if (report.destructive && !sqlite.available) { warning.innerHTML = '<p class="drd-danger">Fallback không chạy câu lệnh thay đổi dữ liệu.</p>'; return status("Đã chặn câu lệnh phá hủy trong fallback.", "danger"); }
        try { const result = sqlite.available ? sqlite.execute(state.database.sql, queryParams) : memory.execute(state.database.sql, queryParams); root.querySelector("[data-drd-sql-result]").innerHTML = tableMarkup(result); root.querySelector("[data-drd-row-count]").textContent = `${result.rowCount} hàng · ${result.engine}`; status("Truy vấn cục bộ hoàn tất.", "success"); } catch (cause) { warning.innerHTML = `<p class="drd-danger">${escapeHtml(cause.message)}</p>`; status(cause.message, "danger"); }
        return;
      }
      if (target.hasAttribute("data-drd-import")) {
        try { const rows = importTabular(state.database.importText, state.database.importType); const result = memory.import(state.database.tableName, rows); if (!state.database.schema.tables.some((table) => table.name === result.table)) state.database.schema.tables.push({ ...inferSchema(result.table, rows), id: uid("table"), x: 40, y: 40 }); persist(); renderDatabasePane(`Đã nhập ${result.rows} hàng vào ${result.table}.`); } catch (cause) { status(cause.message, "danger"); }
        return;
      }
      if (target.hasAttribute("data-drd-schema-apply")) { try { state.database.schema = normalizeSchema(JSON.parse(root.querySelector("[data-drd-schema]").value)); persist(); renderDatabasePane("Đã áp dụng schema cục bộ."); } catch (cause) { status(`Schema không hợp lệ: ${cause.message}`, "danger"); } return; }
      if (target.hasAttribute("data-drd-schema-sql")) { try { root.querySelector("[data-drd-schema-output]").textContent = schemaToSQL(JSON.parse(root.querySelector("[data-drd-schema]").value)); status("Đã sinh DDL từ schema."); } catch (cause) { status(cause.message, "danger"); } return; }
      if (target.hasAttribute("data-drd-mongo-build")) { try { const mongo = state.database.mongo; mongo.filter = JSON.parse(root.querySelector('[data-drd-mongo="filter"]').value || "{}"); mongo.projection = JSON.parse(root.querySelector('[data-drd-mongo="projection"]').value || "{}"); const result = buildMongoQuery(mongo); root.querySelector("[data-drd-mongo-output]").textContent = `${result.expression}\n\n${result.notice}`; persist(); status("Đã sinh truy vấn Mongo, không có kết nối nào được mở.", "success"); } catch (cause) { status(cause.message, "danger"); }
      }
    }

    function onInput(event) {
      const regexKey = event.target.dataset.drdRegex;
      if (regexKey) { state.regex[regexKey] = safeText(event.target.value, regexKey === "input" ? MAX_INPUT : 100_000); persist(); updateRegex(false); return; }
      const dbKey = event.target.dataset.drdDb;
      if (dbKey) { state.database[dbKey] = safeText(event.target.value, dbKey === "sql" || dbKey === "importText" ? MAX_INPUT : 80); if (dbKey === "sql") queryParams = []; persist(); return; }
      const mongoKey = event.target.dataset.drdMongo;
      if (mongoKey && !["filter", "projection"].includes(mongoKey)) { state.database.mongo[mongoKey] = safeText(event.target.value, 80); persist(); }
    }

    function onChange(event) {
      if (event.target.matches("[data-drd-import-file]") && event.target.files && event.target.files[0]) {
        const file = event.target.files[0]; if (file.size > MAX_INPUT) return status("Tệp vượt giới hạn 1 MB của workspace này.", "danger");
        const reader = new FileReader(); reader.onload = () => { state.database.importText = safeText(reader.result, MAX_INPUT); state.database.tableName = String(file.name).replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9_$]/g, "_").replace(/^\d/, "_$&") || "imported_data"; state.database.importType = /\.tsv$/i.test(file.name) ? "tsv" : /\.csv$/i.test(file.name) ? "csv" : "json"; persist(); renderDatabasePane("Đã đọc tệp trên thiết bị. Nhấn Nhập để xác nhận."); }; reader.readAsText(file);
      }
    }

    root.innerHTML = shellMarkup(); root.addEventListener("click", onClick); root.addEventListener("input", onInput); root.addEventListener("change", onChange); render(); persist();
    const controller = {
      getState: () => clone(state), getMemoryTables: () => memory.list(), runRegex: (config) => runRegex(config),
      destroy() { if (destroyed) return; destroyed = true; root.removeEventListener("click", onClick); root.removeEventListener("input", onInput); root.removeEventListener("change", onChange); sqlite.close(); root.replaceChildren(); instances.delete(root); }
    };
    instances.set(root, controller); return controller;
  }

  function unmount(root) { const controller = instances.get(root); if (!controller) return false; controller.destroy(); return true; }

  const api = Object.freeze({
    VERSION, FORMAT, STORAGE_KEY, MAX_INPUT, MAX_MATCHES, TOOLS, REGEX_LIBRARY,
    runtimeRegexFlags, normalizeFlags, regexRisk, explainRegex, regexCompatibility, compileRegex, runRegex, runRegexCases,
    tokenizeSQL, formatSQL, analyzeSQL, buildSelectQuery, parseCSV, importTabular, inferSchema, normalizeSchema, schemaToSQL,
    sanitizeMongoValue, buildMongoQuery, InMemoryDatabase, detectSQLiteRuntime, createSQLiteAdapter,
    createDefaultState, normalizeState, readStorage, writeStorage, tools: () => TOOLS.map((tool) => ({ ...tool })), mount, unmount
  });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  globalScope.HHDevRegexDatabase = api;
}(typeof globalThis !== "undefined" ? globalThis : this));
