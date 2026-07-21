(function (globalScope) {
  "use strict";

  const STORAGE_KEY = "hh.dev.data-security.v1";
  const VERSION = 1;
  const LARGE_INPUT_BYTES = 512 * 1024;
  const textEncoder = new TextEncoder();
  const textDecoder = new TextDecoder();

  const TOOL_IDS = Object.freeze(["json-data-lab", "security-encoding"]);
  const TOOL_META = Object.freeze([
    { id: "json-data-lab", name: "JSON & Data Lab", group: "Dữ liệu", icon: "braces" },
    { id: "security-encoding", name: "Security & Encoding", group: "Bảo mật", icon: "shield-check" }
  ]);
  const SENSITIVE_FIELDS = new Set(["password", "privateKey", "secret", "plaintext", "ciphertext", "jwt"]);

  const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
  const formatBytes = (bytes) => {
    const value = Number(bytes) || 0;
    if (value < 1024) return `${value} B`;
    if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / 1024 ** 2).toFixed(2)} MB`;
  };
  const randomId = () => globalScope.crypto?.randomUUID?.() || `hh-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  function storageRead(storage = globalScope.localStorage) {
    if (!storage) return { version: VERSION, preferences: {}, history: [], pins: [] };
    try {
      const value = JSON.parse(storage.getItem(STORAGE_KEY) || "{}");
      return {
        version: VERSION,
        preferences: value.preferences && typeof value.preferences === "object" ? value.preferences : {},
        history: Array.isArray(value.history) ? value.history.slice(0, 40) : [],
        pins: Array.isArray(value.pins) ? value.pins.slice(0, 20) : []
      };
    } catch {
      return { version: VERSION, preferences: {}, history: [], pins: [] };
    }
  }

  function sanitizePersistentValue(value, depth = 0) {
    if (depth > 8) return "[depth-limited]";
    if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitizePersistentValue(item, depth + 1));
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value)
        .filter(([key]) => !SENSITIVE_FIELDS.has(key) && !/(token|api[-_]?key|authorization)/i.test(key))
        .map(([key, child]) => [key, sanitizePersistentValue(child, depth + 1)]));
    }
    return typeof value === "string" ? value.slice(0, 500) : value;
  }

  function storageWrite(patch, storage = globalScope.localStorage) {
    const previous = storageRead(storage);
    const safePatch = sanitizePersistentValue(patch);
    const next = {
      version: VERSION,
      preferences: { ...previous.preferences, ...(safePatch.preferences || {}) },
      history: Array.isArray(safePatch.history) ? safePatch.history.slice(0, 40) : previous.history,
      pins: Array.isArray(safePatch.pins) ? safePatch.pins.slice(0, 20) : previous.pins
    };
    storage?.setItem?.(STORAGE_KEY, JSON.stringify(next));
    return next;
  }

  function parseScalar(raw) {
    const value = String(raw ?? "").trim();
    if (!value.length) return "";
    if (/^(null|~)$/i.test(value)) return null;
    if (/^(true|false)$/i.test(value)) return value.toLowerCase() === "true";
    if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(value)) return Number(value);
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      if (value.startsWith('"')) {
        try { return JSON.parse(value); } catch { return value.slice(1, -1); }
      }
      return value.slice(1, -1).replace(/''/g, "'");
    }
    if ((value.startsWith("[") && value.endsWith("]")) || (value.startsWith("{") && value.endsWith("}"))) {
      try { return JSON.parse(value.replace(/'/g, '"')); } catch { return value; }
    }
    return value;
  }

  function parseCsv(source, delimiter) {
    const input = String(source ?? "");
    const separator = delimiter || (input.split("\n", 1)[0].includes("\t") ? "\t" : ",");
    const rows = [];
    let row = [], cell = "", quoted = false;
    for (let index = 0; index < input.length; index += 1) {
      const character = input[index];
      if (quoted) {
        if (character === '"' && input[index + 1] === '"') { cell += '"'; index += 1; }
        else if (character === '"') quoted = false;
        else cell += character;
      } else if (character === '"') quoted = true;
      else if (character === separator) { row.push(cell); cell = ""; }
      else if (character === "\n") { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
      else cell += character;
    }
    if (quoted) throw new Error("CSV có dấu ngoặc kép chưa đóng.");
    if (cell.length || row.length) { row.push(cell.replace(/\r$/, "")); rows.push(row); }
    if (!rows.length) return [];
    const headers = rows.shift().map((header, index) => String(header || `column_${index + 1}`).trim());
    return rows.filter((cells) => cells.some((value) => value !== "")).map((cells) => Object.fromEntries(headers.map((header, index) => [header, parseScalar(cells[index] ?? "")])));
  }

  function parseYaml(source) {
    const significant = String(source ?? "").split(/\r?\n/)
      .map((line, lineIndex) => ({ indent: line.match(/^\s*/)[0].replace(/\t/g, "  ").length, text: line.trim(), line: lineIndex + 1 }))
      .filter((row) => row.text && !row.text.startsWith("#") && row.text !== "---" && row.text !== "...");
    if (!significant.length) return {};
    const parseBlock = (start, indent) => {
      const isArray = significant[start]?.indent === indent && significant[start]?.text.startsWith("- ");
      const output = isArray ? [] : {};
      let index = start;
      while (index < significant.length && significant[index].indent === indent) {
        const row = significant[index];
        if (isArray) {
          if (!row.text.startsWith("- ")) break;
          const itemText = row.text.slice(2).trim();
          if (!itemText) {
            if (significant[index + 1]?.indent > indent) {
              const nested = parseBlock(index + 1, significant[index + 1].indent); output.push(nested.value); index = nested.next;
            } else { output.push(null); index += 1; }
          } else if (/^[^:]+:\s*/.test(itemText)) {
            const match = itemText.match(/^([^:]+):\s*(.*)$/); const object = {}; object[match[1].trim()] = parseScalar(match[2]);
            index += 1;
            if (significant[index]?.indent > indent) {
              const nested = parseBlock(index, significant[index].indent);
              if (nested.value && !Array.isArray(nested.value)) Object.assign(object, nested.value);
              index = nested.next;
            }
            output.push(object);
          } else { output.push(parseScalar(itemText)); index += 1; }
        } else {
          const match = row.text.match(/^([^:]+):(?:\s*(.*))?$/);
          if (!match) throw new Error(`YAML dòng ${row.line}: cần cặp key: value.`);
          const key = match[1].trim(); const raw = match[2] ?? "";
          if (!raw && significant[index + 1]?.indent > indent) {
            const nested = parseBlock(index + 1, significant[index + 1].indent); output[key] = nested.value; index = nested.next;
          } else { output[key] = parseScalar(raw); index += 1; }
        }
      }
      return { value: output, next: index };
    };
    return parseBlock(0, significant[0].indent).value;
  }

  function parseToml(source) {
    const root = {};
    let current = root;
    String(source ?? "").split(/\r?\n/).forEach((line, lineIndex) => {
      const text = line.replace(/\s+#.*$/, "").trim();
      if (!text) return;
      const table = text.match(/^\[([^\]]+)\]$/);
      if (table) {
        current = root;
        table[1].split(".").map((part) => part.trim()).forEach((part) => { current[part] ||= {}; current = current[part]; });
        return;
      }
      const pair = text.match(/^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/);
      if (!pair) throw new Error(`TOML dòng ${lineIndex + 1}: cú pháp chưa được hỗ trợ.`);
      const path = pair[1].split("."); let target = current;
      path.slice(0, -1).forEach((part) => { target[part] ||= {}; target = target[part]; });
      target[path.at(-1)] = parseScalar(pair[2]);
    });
    return root;
  }

  function simpleXmlFallback(source) {
    const clean = String(source).replace(/<\?xml[^>]*>/gi, "").trim();
    const decodeXmlText = (text) => String(text).replace(/&(?:#x([0-9a-f]+)|#(\d+)|(amp|lt|gt|quot|apos));/gi, (match, hexValue, decimalValue, named) => {
      if (hexValue) return String.fromCodePoint(Number.parseInt(hexValue, 16));
      if (decimalValue) return String.fromCodePoint(Number(decimalValue));
      return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" })[named.toLowerCase()] || match;
    });
    const tokenPattern = /<(?!\/)([^!?\s/>]+)(?:\s[^>]*)?(\/?)>|<\/([^>]+)>|([^<]+)/g;
    const stack = [{ name: "$root", value: {} }];
    let match;
    while ((match = tokenPattern.exec(clean))) {
      if (match[1]) {
        stack.push({ name: match[1], value: {}, text: "" });
        if (match[2]) {
          const node = stack.pop(), parent = stack.at(-1).value;
          if (Object.hasOwn(parent, node.name)) parent[node.name] = Array.isArray(parent[node.name]) ? [...parent[node.name], ""] : [parent[node.name], ""];
          else parent[node.name] = "";
        }
      } else if (match[3]) {
        const node = stack.pop();
        if (!node || node.name !== match[3].trim()) throw new Error("XML không cân bằng thẻ.");
        const hasChildren = Object.keys(node.value).length > 0;
        const value = hasChildren ? node.value : parseScalar(decodeXmlText(node.text.trim()));
        const parent = stack.at(-1).value;
        if (Object.hasOwn(parent, node.name)) parent[node.name] = Array.isArray(parent[node.name]) ? [...parent[node.name], value] : [parent[node.name], value];
        else parent[node.name] = value;
      } else if (match[4] && stack.length > 1) stack.at(-1).text += match[4];
    }
    if (stack.length !== 1) throw new Error("XML có thẻ chưa đóng.");
    return stack[0].value;
  }

  function parseXml(source) {
    const input = String(source ?? "");
    if (/<!DOCTYPE|<!ENTITY/i.test(input)) throw new Error("DOCTYPE và ENTITY bị chặn để tránh xử lý thực thể ngoài.");
    if (typeof globalScope.DOMParser === "undefined") return simpleXmlFallback(input);
    const documentNode = new globalScope.DOMParser().parseFromString(input, "application/xml");
    const parserError = documentNode.querySelector("parsererror");
    if (parserError) throw new Error("XML không hợp lệ.");
    const walk = (node) => {
      const children = [...node.children];
      if (!children.length) return parseScalar(node.textContent);
      const object = {};
      if (node.attributes?.length) object.$attributes = Object.fromEntries([...node.attributes].map((attribute) => [attribute.name, attribute.value]));
      children.forEach((child) => {
        const value = walk(child);
        if (Object.hasOwn(object, child.nodeName)) object[child.nodeName] = Array.isArray(object[child.nodeName]) ? [...object[child.nodeName], value] : [object[child.nodeName], value];
        else object[child.nodeName] = value;
      });
      return object;
    };
    return { [documentNode.documentElement.nodeName]: walk(documentNode.documentElement) };
  }

  function detectFormat(source) {
    const input = String(source ?? "").trim();
    if (!input) return "json";
    if (/^<\?xml|^<[A-Za-z_][\w:.-]*(?:\s|>)/.test(input)) return "xml";
    if (/^\[[A-Za-z0-9_.-]+\]\s*$/m.test(input) || /^[A-Za-z0-9_.-]+\s*=\s*.+$/m.test(input)) return "toml";
    try { JSON.parse(input); return "json"; } catch {}
    const firstLine = input.split(/\r?\n/, 1)[0];
    if ((firstLine.match(/,/g) || []).length >= 1 && input.includes("\n")) return "csv";
    if (/^(?:\s*-\s+|\s*[\w.-]+:\s*)/m.test(input)) return "yaml";
    return "text";
  }

  function parseData(source, format = "auto") {
    const resolved = format === "auto" ? detectFormat(source) : String(format).toLowerCase();
    if (resolved === "json") return JSON.parse(String(source));
    if (resolved === "csv") return parseCsv(source);
    if (resolved === "yaml" || resolved === "yml") return parseYaml(source);
    if (resolved === "toml") return parseToml(source);
    if (resolved === "xml") return parseXml(source);
    if (resolved === "text") return String(source);
    throw new Error(`Định dạng ${resolved} chưa được hỗ trợ.`);
  }

  const csvCell = (value) => {
    const raw = value === null || value === undefined ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
    return /[",\r\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
  };
  function toCsv(value) {
    const rows = Array.isArray(value) ? value : [value];
    if (!rows.length) return "";
    const records = rows.map((row) => row && typeof row === "object" && !Array.isArray(row) ? row : { value: row });
    const headers = [...new Set(records.flatMap((row) => Object.keys(row)))];
    return [headers.map(csvCell).join(","), ...records.map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\n");
  }

  function toYaml(value, indent = 0) {
    const pad = " ".repeat(indent);
    if (Array.isArray(value)) return value.map((item) => item && typeof item === "object" ? `${pad}-\n${toYaml(item, indent + 2)}` : `${pad}- ${yamlScalar(item)}`).join("\n");
    if (value && typeof value === "object") return Object.entries(value).map(([key, child]) => child && typeof child === "object" ? `${pad}${key}:\n${toYaml(child, indent + 2)}` : `${pad}${key}: ${yamlScalar(child)}`).join("\n");
    return `${pad}${yamlScalar(value)}`;
  }
  function yamlScalar(value) {
    if (value === null) return "null";
    if (typeof value === "boolean" || typeof value === "number") return String(value);
    const text = String(value ?? "");
    return !text || /[:#\[\]{},&*!|>'"%@`\n]|^(?:true|false|null|[-+]?\d)/i.test(text) ? JSON.stringify(text) : text;
  }

  function toToml(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return `value = ${tomlScalar(value)}`;
    const lines = [];
    const walk = (object, path = []) => {
      const scalars = Object.entries(object).filter(([, child]) => !child || typeof child !== "object" || Array.isArray(child));
      if (path.length) lines.push(`[${path.join(".")}]`);
      scalars.forEach(([key, child]) => lines.push(`${key} = ${tomlScalar(child)}`));
      Object.entries(object).filter(([, child]) => child && typeof child === "object" && !Array.isArray(child)).forEach(([key, child]) => {
        if (lines.length && lines.at(-1) !== "") lines.push("");
        walk(child, [...path, key]);
      });
    };
    walk(value);
    return lines.join("\n").trim();
  }
  function tomlScalar(value) {
    if (Array.isArray(value)) return `[${value.map(tomlScalar).join(", ")}]`;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (value === null) return '""';
    return JSON.stringify(String(value));
  }

  function toXml(value, rootName = "root") {
    const xmlEscape = (text) => String(text).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]);
    const validName = (name) => /^[A-Za-z_][\w.-]*$/.test(name) ? name : "item";
    const render = (name, child) => {
      const tag = validName(name);
      if (Array.isArray(child)) return child.map((item) => render(tag, item)).join("");
      if (child && typeof child === "object") return `<${tag}>${Object.entries(child).filter(([key]) => key !== "$attributes").map(([key, nested]) => render(key, nested)).join("")}</${tag}>`;
      return `<${tag}>${xmlEscape(child ?? "")}</${tag}>`;
    };
    const entries = value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 1 ? Object.entries(value)[0] : [rootName, value];
    return `<?xml version="1.0" encoding="UTF-8"?>\n${render(entries[0], entries[1])}`;
  }

  function stringifyData(value, format = "json") {
    const resolved = String(format).toLowerCase();
    if (resolved === "json") return JSON.stringify(value, null, 2);
    if (resolved === "csv") return toCsv(value);
    if (resolved === "yaml" || resolved === "yml") return toYaml(value);
    if (resolved === "toml") return toToml(value);
    if (resolved === "xml") return toXml(value);
    throw new Error(`Không thể xuất ${resolved}.`);
  }

  function convertData(source, from = "auto", to = "json") {
    return stringifyData(parseData(source, from), to);
  }

  function tokenizeJsonPath(expression) {
    const path = String(expression || "$" ).trim();
    if (!path.startsWith("$")) throw new Error("JSONPath phải bắt đầu bằng $.");
    const tokens = [];
    const pattern = /\.\.([A-Za-z_$][\w$]*)|\.([A-Za-z_$][\w$]*)|\[(\d+|\*|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")\]/g;
    let cursor = 1, match;
    while ((match = pattern.exec(path))) {
      if (match.index !== cursor) throw new Error(`JSONPath chưa hỗ trợ tại vị trí ${cursor}.`);
      if (match[1]) tokens.push({ type: "recursive", key: match[1] });
      else if (match[2]) tokens.push({ type: "property", key: match[2] });
      else if (match[3] === "*") tokens.push({ type: "wildcard" });
      else if (/^\d+$/.test(match[3])) tokens.push({ type: "index", index: Number(match[3]) });
      else tokens.push({ type: "property", key: match[3].slice(1, -1).replace(/\\(['"])/g, "$1") });
      cursor = pattern.lastIndex;
    }
    if (cursor !== path.length) throw new Error(`JSONPath chưa hỗ trợ tại vị trí ${cursor}.`);
    return tokens;
  }

  function jsonPathQuery(value, expression = "$") {
    let current = [value];
    const recursiveCollect = (node, key, output) => {
      if (!node || typeof node !== "object") return;
      if (Object.hasOwn(node, key)) output.push(node[key]);
      Object.values(node).forEach((child) => recursiveCollect(child, key, output));
    };
    tokenizeJsonPath(expression).forEach((token) => {
      const next = [];
      current.forEach((node) => {
        if (token.type === "property" && node != null && typeof node === "object" && Object.hasOwn(node, token.key)) next.push(node[token.key]);
        else if (token.type === "index" && Array.isArray(node) && token.index < node.length) next.push(node[token.index]);
        else if (token.type === "wildcard" && node != null && typeof node === "object") next.push(...Object.values(node));
        else if (token.type === "recursive") recursiveCollect(node, token.key, next);
      });
      current = next;
    });
    return current.length === 1 ? current[0] : current;
  }

  function jmesPathLite(value, expression = "@") {
    const source = String(expression || "@").trim();
    if (source === "@" || !source) return value;
    if (/[?(){}|&]/.test(source)) throw new Error("JMESPath-lite chỉ hỗ trợ property, index, projection [] và flatten [].");
    const normalized = source.replace(/\[\]/g, "[*]");
    return jsonPathQuery(value, normalized.startsWith("$") ? normalized : `$.${normalized}`);
  }

  function flattenRows(value, options = {}) {
    const maxRows = Math.max(1, Math.min(5000, Number(options.maxRows) || 1000));
    const rows = Array.isArray(value) ? value : [value];
    const flatten = (input, prefix = "", output = {}) => {
      if (input && typeof input === "object" && !Array.isArray(input)) Object.entries(input).forEach(([key, child]) => flatten(child, prefix ? `${prefix}.${key}` : key, output));
      else if (Array.isArray(input)) input.forEach((child, index) => flatten(child, `${prefix}[${index}]`, output));
      else output[prefix || "value"] = input;
      return output;
    };
    return rows.slice(0, maxRows).map((row) => flatten(row));
  }

  function treeRows(value, options = {}) {
    const output = [], maxNodes = Math.max(1, Math.min(10000, Number(options.maxNodes) || 3000));
    const visit = (node, key, path, depth) => {
      if (output.length >= maxNodes) return;
      const type = Array.isArray(node) ? "array" : node === null ? "null" : typeof node;
      output.push({ key, path, depth, type, value: node && typeof node === "object" ? (Array.isArray(node) ? `${node.length} items` : `${Object.keys(node).length} keys`) : node });
      if (node && typeof node === "object") Object.entries(node).forEach(([childKey, child]) => visit(child, childKey, `${path}${Array.isArray(node) ? `[${childKey}]` : `.${childKey}`}`, depth + 1));
    };
    visit(value, "$", "$", 0);
    return output;
  }

  function diffValues(left, right, path = "$") {
    if (Object.is(left, right)) return [];
    const leftObject = left && typeof left === "object", rightObject = right && typeof right === "object";
    if (!leftObject || !rightObject || Array.isArray(left) !== Array.isArray(right)) return [{ type: "changed", path, before: clone(left), after: clone(right) }];
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    return [...keys].flatMap((key) => {
      const childPath = Array.isArray(left) ? `${path}[${key}]` : `${path}.${key}`;
      if (!Object.hasOwn(left, key)) return [{ type: "added", path: childPath, after: clone(right[key]) }];
      if (!Object.hasOwn(right, key)) return [{ type: "removed", path: childPath, before: clone(left[key]) }];
      return diffValues(left[key], right[key], childPath);
    });
  }

  function mergeTypes(schemas) {
    const unique = [...new Set(schemas.map((schema) => schema.type))];
    return unique.length === 1 ? schemas[0] : { anyOf: unique.map((type) => ({ type })) };
  }
  function inferSchema(value, options = {}) {
    if (value === null) return { type: "null" };
    if (Array.isArray(value)) {
      const samples = value.slice(0, Math.max(1, Number(options.sampleSize) || 50));
      return { type: "array", items: samples.length ? mergeTypes(samples.map((item) => inferSchema(item, options))) : {} };
    }
    if (typeof value === "object") {
      const properties = Object.fromEntries(Object.entries(value).map(([key, child]) => [key, inferSchema(child, options)]));
      return { type: "object", properties, required: Object.keys(properties), additionalProperties: true };
    }
    if (typeof value === "number") return { type: Number.isInteger(value) ? "integer" : "number" };
    return { type: typeof value };
  }

  function validateSchema(value, schema, path = "$") {
    const errors = [];
    if (!schema || typeof schema !== "object") return { valid: true, errors };
    if (Array.isArray(schema.anyOf)) {
      const branches = schema.anyOf.map((branch) => validateSchema(value, branch, path));
      if (!branches.some((branch) => branch.valid)) errors.push({ path, keyword: "anyOf", message: "Không khớp bất kỳ schema nào." });
      return { valid: !errors.length, errors };
    }
    const actualType = value === null ? "null" : Array.isArray(value) ? "array" : Number.isInteger(value) ? "integer" : typeof value;
    const accepted = schema.type === "number" && actualType === "integer" ? true : !schema.type || actualType === schema.type;
    if (!accepted) errors.push({ path, keyword: "type", message: `Cần ${schema.type}, nhận ${actualType}.` });
    if (Array.isArray(schema.enum) && !schema.enum.some((item) => Object.is(item, value))) errors.push({ path, keyword: "enum", message: "Giá trị không nằm trong enum." });
    if (typeof value === "string") {
      if (Number.isFinite(schema.minLength) && value.length < schema.minLength) errors.push({ path, keyword: "minLength", message: `Tối thiểu ${schema.minLength} ký tự.` });
      if (schema.pattern) { try { if (!new RegExp(schema.pattern).test(value)) errors.push({ path, keyword: "pattern", message: "Không khớp pattern." }); } catch { errors.push({ path, keyword: "pattern", message: "Pattern schema không hợp lệ." }); } }
    }
    if (typeof value === "number") {
      if (Number.isFinite(schema.minimum) && value < schema.minimum) errors.push({ path, keyword: "minimum", message: `Phải >= ${schema.minimum}.` });
      if (Number.isFinite(schema.maximum) && value > schema.maximum) errors.push({ path, keyword: "maximum", message: `Phải <= ${schema.maximum}.` });
    }
    if (Array.isArray(value) && schema.items) value.forEach((item, index) => errors.push(...validateSchema(item, schema.items, `${path}[${index}]`).errors));
    if (value && typeof value === "object" && !Array.isArray(value)) {
      (schema.required || []).forEach((key) => { if (!Object.hasOwn(value, key)) errors.push({ path: `${path}.${key}`, keyword: "required", message: "Thiếu trường bắt buộc." }); });
      Object.entries(schema.properties || {}).forEach(([key, childSchema]) => { if (Object.hasOwn(value, key)) errors.push(...validateSchema(value[key], childSchema, `${path}.${key}`).errors); });
    }
    return { valid: !errors.length, errors };
  }

  function sampleFromSchema(schema, depth = 0) {
    if (depth > 12) return null;
    if (schema?.default !== undefined) return clone(schema.default);
    if (Array.isArray(schema?.enum) && schema.enum.length) return clone(schema.enum[0]);
    if (schema?.anyOf?.length) return sampleFromSchema(schema.anyOf[0], depth + 1);
    if (schema?.type === "object" || schema?.properties) return Object.fromEntries(Object.entries(schema.properties || {}).map(([key, child]) => [key, sampleFromSchema(child, depth + 1)]));
    if (schema?.type === "array") return [sampleFromSchema(schema.items || { type: "string" }, depth + 1)];
    if (schema?.type === "integer" || schema?.type === "number") return Number.isFinite(schema.minimum) ? schema.minimum : 0;
    if (schema?.type === "boolean") return true;
    if (schema?.type === "null") return null;
    if (schema?.format === "date-time") return "2026-01-01T00:00:00.000Z";
    return schema?.examples?.[0] ?? "string";
  }

  function processLargeJson(source, operation = "parse", options = {}) {
    const input = String(source ?? "");
    const fallback = () => Promise.resolve(operation === "format" ? JSON.stringify(JSON.parse(input), null, Number(options.space) || 2) : JSON.parse(input));
    if (input.length < (Number(options.threshold) || LARGE_INPUT_BYTES) || typeof globalScope.Worker === "undefined" || typeof globalScope.Blob === "undefined" || !globalScope.URL?.createObjectURL) return fallback().then((result) => ({ result, worker: false }));
    const workerSource = `self.onmessage=function(event){try{var value=JSON.parse(event.data.input);self.postMessage({ok:true,result:event.data.operation==='format'?JSON.stringify(value,null,event.data.space||2):value});}catch(error){self.postMessage({ok:false,error:error.message});}}`;
    const url = globalScope.URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" }));
    return new Promise((resolve, reject) => {
      const worker = new Worker(url);
      const finish = () => { worker.terminate(); globalScope.URL.revokeObjectURL(url); };
      worker.onmessage = (event) => { finish(); event.data.ok ? resolve({ result: event.data.result, worker: true }) : reject(new Error(event.data.error)); };
      worker.onerror = () => { finish(); fallback().then((result) => resolve({ result, worker: false }), reject); };
      worker.postMessage({ input, operation, space: Number(options.space) || 2 });
    });
  }

  const bytesToBase64 = (bytes) => {
    const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (typeof globalScope.btoa === "function") {
      let binary = ""; for (let index = 0; index < data.length; index += 0x8000) binary += String.fromCharCode(...data.subarray(index, index + 0x8000));
      return globalScope.btoa(binary);
    }
    if (typeof Buffer !== "undefined") return Buffer.from(data).toString("base64");
    throw new Error("Môi trường không hỗ trợ Base64.");
  };
  const base64ToBytes = (value) => {
    const normalized = String(value).replace(/-/g, "+").replace(/_/g, "/").replace(/\s/g, "");
    const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
    if (typeof globalScope.atob === "function") return Uint8Array.from(globalScope.atob(padded), (character) => character.charCodeAt(0));
    if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(padded, "base64"));
    throw new Error("Môi trường không hỗ trợ Base64.");
  };
  const bytesToHex = (buffer) => [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const subtleCrypto = () => {
    const subtle = globalScope.crypto?.subtle;
    if (!subtle) throw new Error("Web Crypto không khả dụng trong trình duyệt này hoặc trang chưa chạy qua HTTPS.");
    return subtle;
  };

  function inspectJwt(token, nowSeconds = Math.floor(Date.now() / 1000)) {
    const parts = String(token || "").trim().split(".");
    if (parts.length !== 3) throw new Error("JWT cần đúng 3 phần header.payload.signature.");
    const decode = (part) => JSON.parse(textDecoder.decode(base64ToBytes(part)));
    const header = decode(parts[0]), payload = decode(parts[1]);
    const expiresAt = Number.isFinite(payload.exp) ? new Date(payload.exp * 1000).toISOString() : null;
    const notBefore = Number.isFinite(payload.nbf) ? new Date(payload.nbf * 1000).toISOString() : null;
    return {
      header,
      payload,
      signature: { present: Boolean(parts[2]), verified: false },
      timing: {
        expiresAt,
        notBefore,
        expired: Number.isFinite(payload.exp) ? payload.exp <= nowSeconds : null,
        active: Number.isFinite(payload.nbf) ? payload.nbf <= nowSeconds : true
      },
      warning: "Chỉ giải mã cấu trúc. Chữ ký chưa được xác minh nếu không có khóa tin cậy."
    };
  }

  async function digestBytes(input, algorithm = "SHA-256") {
    const bytes = typeof input === "string" ? textEncoder.encode(input) : input instanceof ArrayBuffer ? new Uint8Array(input) : new Uint8Array(input.buffer, input.byteOffset || 0, input.byteLength);
    return bytesToHex(await subtleCrypto().digest(algorithm, bytes));
  }
  async function hashFiles(files, algorithms = ["SHA-256"]) {
    const selected = [...new Set(algorithms)].filter((algorithm) => ["SHA-1", "SHA-256", "SHA-384", "SHA-512"].includes(algorithm));
    if (!selected.length) throw new Error("Chưa chọn thuật toán checksum.");
    const output = [];
    for (const file of [...files]) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const hashes = {};
      for (const algorithm of selected) hashes[algorithm] = await digestBytes(bytes, algorithm);
      output.push({ name: file.name || "blob", size: file.size ?? bytes.byteLength, type: file.type || "application/octet-stream", hashes });
    }
    return output;
  }

  async function deriveAesKey(password, salt, iterations, usages) {
    const subtle = subtleCrypto();
    const material = await subtle.importKey("raw", textEncoder.encode(password), "PBKDF2", false, ["deriveKey"]);
    return subtle.deriveKey({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, false, usages);
  }
  async function aesEncrypt(plaintext, password, options = {}) {
    if (!password) throw new Error("Mật khẩu không được để trống.");
    const iterations = Math.max(100000, Math.min(1000000, Number(options.iterations) || 310000));
    const salt = globalScope.crypto.getRandomValues(new Uint8Array(16));
    const iv = globalScope.crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveAesKey(password, salt, iterations, ["encrypt"]);
    const ciphertext = await subtleCrypto().encrypt({ name: "AES-GCM", iv }, key, textEncoder.encode(String(plaintext)));
    return { version: 1, algorithm: "AES-256-GCM", kdf: "PBKDF2-SHA-256", iterations, salt: bytesToBase64(salt), iv: bytesToBase64(iv), data: bytesToBase64(new Uint8Array(ciphertext)) };
  }
  async function aesDecrypt(packageValue, password) {
    if (!password) throw new Error("Mật khẩu không được để trống.");
    const payload = typeof packageValue === "string" ? JSON.parse(packageValue) : packageValue;
    if (payload?.algorithm !== "AES-256-GCM" || !payload.salt || !payload.iv || !payload.data) throw new Error("Gói AES-GCM không hợp lệ.");
    const key = await deriveAesKey(password, base64ToBytes(payload.salt), Number(payload.iterations), ["decrypt"]);
    try {
      const plaintext = await subtleCrypto().decrypt({ name: "AES-GCM", iv: base64ToBytes(payload.iv) }, key, base64ToBytes(payload.data));
      return textDecoder.decode(plaintext);
    } catch { throw new Error("Không thể giải mã: mật khẩu sai hoặc dữ liệu đã bị thay đổi."); }
  }

  function pemWrap(label, bytes) {
    const body = bytesToBase64(bytes).match(/.{1,64}/g)?.join("\n") || "";
    return `-----BEGIN ${label}-----\n${body}\n-----END ${label}-----`;
  }
  function pemUnwrap(pem, expectedLabels = []) {
    const match = String(pem || "").trim().match(/^-----BEGIN ([A-Z0-9 ]+)-----([\s\S]+)-----END \1-----$/);
    if (!match) throw new Error("PEM không hợp lệ hoặc nhãn BEGIN/END không khớp.");
    if (expectedLabels.length && !expectedLabels.includes(match[1])) throw new Error(`Cần PEM loại ${expectedLabels.join(" hoặc ")}.`);
    return { label: match[1], bytes: base64ToBytes(match[2]) };
  }
  async function rsaGenerateKeyPair(options = {}) {
    const modulusLength = [2048, 3072, 4096].includes(Number(options.modulusLength)) ? Number(options.modulusLength) : 2048;
    const pair = await subtleCrypto().generateKey({ name: "RSA-OAEP", modulusLength, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["encrypt", "decrypt"]);
    const [publicBytes, privateBytes] = await Promise.all([subtleCrypto().exportKey("spki", pair.publicKey), subtleCrypto().exportKey("pkcs8", pair.privateKey)]);
    return { publicKey: pemWrap("PUBLIC KEY", new Uint8Array(publicBytes)), privateKey: pemWrap("PRIVATE KEY", new Uint8Array(privateBytes)), modulusLength, warning: "Khóa riêng chỉ nằm trong phiên hiện tại trừ khi bạn tự tải xuống." };
  }
  async function rsaImportPublicKey(pem) {
    const { bytes } = pemUnwrap(pem, ["PUBLIC KEY"]);
    return subtleCrypto().importKey("spki", bytes, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]);
  }
  async function rsaImportPrivateKey(pem) {
    const { bytes } = pemUnwrap(pem, ["PRIVATE KEY"]);
    return subtleCrypto().importKey("pkcs8", bytes, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["decrypt"]);
  }
  async function rsaEncrypt(plaintext, publicKeyPem) {
    const key = await rsaImportPublicKey(publicKeyPem);
    return bytesToBase64(new Uint8Array(await subtleCrypto().encrypt({ name: "RSA-OAEP" }, key, textEncoder.encode(String(plaintext)))));
  }
  async function rsaDecrypt(ciphertext, privateKeyPem) {
    const key = await rsaImportPrivateKey(privateKeyPem);
    try { return textDecoder.decode(await subtleCrypto().decrypt({ name: "RSA-OAEP" }, key, base64ToBytes(ciphertext))); }
    catch { throw new Error("Không thể giải mã RSA: khóa hoặc ciphertext không hợp lệ."); }
  }

  function readDerLength(bytes, offset) {
    const first = bytes[offset];
    if (first < 128) return { length: first, bytesRead: 1 };
    const count = first & 0x7f;
    if (!count || count > 4 || offset + count >= bytes.length) throw new Error("Độ dài DER không hợp lệ.");
    let length = 0; for (let index = 1; index <= count; index += 1) length = (length << 8) | bytes[offset + index];
    return { length, bytesRead: count + 1 };
  }

  function decodeDerOid(bytes) {
    if (!bytes.length) return "";
    const parts = [Math.floor(bytes[0] / 40), bytes[0] % 40];
    let value = 0;
    for (let index = 1; index < bytes.length; index += 1) {
      value = (value << 7) | (bytes[index] & 0x7f);
      if (!(bytes[index] & 0x80)) { parts.push(value); value = 0; }
    }
    return parts.join(".");
  }

  function inspectDerTree(input, options = {}) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    const maxNodes = Math.max(1, Math.min(1000, Number(options.maxNodes) || 240));
    const maxDepth = Math.max(1, Math.min(20, Number(options.maxDepth) || 10));
    let nodeCount = 0;
    const names = { 1: "BOOLEAN", 2: "INTEGER", 3: "BIT STRING", 4: "OCTET STRING", 5: "NULL", 6: "OBJECT IDENTIFIER", 12: "UTF8String", 16: "SEQUENCE", 17: "SET", 19: "PrintableString", 22: "IA5String", 23: "UTCTime", 24: "GeneralizedTime" };
    const parseRange = (start, end, depth) => {
      const nodes = [];
      let offset = start;
      while (offset < end && nodeCount < maxNodes) {
        const nodeOffset = offset, tagByte = bytes[offset++];
        if (tagByte === undefined) break;
        const tagNumber = tagByte & 0x1f, constructed = Boolean(tagByte & 0x20), tagClass = tagByte >> 6;
        if (tagNumber === 0x1f) { nodes.push({ offset: nodeOffset, error: "High-tag-number chưa được mở rộng." }); break; }
        let lengthInfo;
        try { lengthInfo = readDerLength(bytes, offset); } catch (error) { nodes.push({ offset: nodeOffset, error: error.message }); break; }
        offset += lengthInfo.bytesRead;
        const contentStart = offset, contentEnd = contentStart + lengthInfo.length;
        if (contentEnd > end || contentEnd > bytes.length) { nodes.push({ offset: nodeOffset, error: "Node DER vượt quá phạm vi khai báo." }); break; }
        const node = { offset: nodeOffset, tag: tagNumber, tagClass, name: tagClass === 0 ? (names[tagNumber] || `UNIVERSAL ${tagNumber}`) : `CLASS ${tagClass}:${tagNumber}`, length: lengthInfo.length, constructed };
        nodeCount += 1;
        if (constructed && depth < maxDepth) node.children = parseRange(contentStart, contentEnd, depth + 1);
        else if (tagClass === 0 && tagNumber === 6) node.value = decodeDerOid(bytes.subarray(contentStart, contentEnd));
        else if (tagClass === 0 && [12, 19, 22, 23, 24].includes(tagNumber)) node.value = textDecoder.decode(bytes.subarray(contentStart, contentEnd)).slice(0, 300);
        else if (tagClass === 0 && tagNumber === 2) node.value = `0x${bytesToHex(bytes.subarray(contentStart, Math.min(contentEnd, contentStart + 24)))}${lengthInfo.length > 24 ? "…" : ""}`;
        nodes.push(node);
        offset = contentEnd;
      }
      return nodes;
    };
    const nodes = parseRange(0, bytes.length, 0);
    return { nodes, nodeCount, truncated: nodeCount >= maxNodes };
  }

  function inspectPem(pem) {
    const { label, bytes } = pemUnwrap(pem);
    const warnings = [];
    if (!["CERTIFICATE", "PUBLIC KEY", "PRIVATE KEY", "RSA PRIVATE KEY", "CERTIFICATE REQUEST"].includes(label)) warnings.push("Nhãn PEM chưa được nhận diện đầy đủ.");
    let der = null;
    try {
      const lengthInfo = readDerLength(bytes, 1);
      der = { tag: `0x${bytes[0].toString(16).padStart(2, "0")}`, sequence: bytes[0] === 0x30, declaredLength: lengthInfo.length, headerBytes: lengthInfo.bytesRead + 1, totalBytes: bytes.length, lengthMatches: lengthInfo.length + lengthInfo.bytesRead + 1 === bytes.length };
      if (!der.sequence) warnings.push("Cấu trúc ngoài cùng không phải ASN.1 SEQUENCE.");
      if (!der.lengthMatches) warnings.push("Độ dài DER khai báo không khớp dung lượng.");
    } catch (error) { warnings.push(error.message); }
    const structure = inspectDerTree(bytes);
    return { label, bytes: bytes.length, der, structure, warnings, verified: false, note: "Trình xem chỉ phân tích cấu trúc PEM/DER; không xác minh chuỗi tin cậy X.509." };
  }

  const SECRET_PATTERNS = Object.freeze([
    { type: "private-key", severity: "critical", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
    { type: "aws-access-key", severity: "high", pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g },
    { type: "github-token", severity: "high", pattern: /\bgh[oprsu]_[A-Za-z0-9_]{30,255}\b/g },
    { type: "google-api-key", severity: "high", pattern: /\bAIza[A-Za-z0-9_-]{30,}\b/g },
    { type: "slack-token", severity: "high", pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
    { type: "jwt", severity: "medium", pattern: /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*\b/g },
    { type: "connection-string", severity: "high", pattern: /\b(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql):\/\/[^\s"']+/gi },
    { type: "assigned-secret", severity: "medium", pattern: /\b(?:api[_-]?key|client[_-]?secret|access[_-]?token|password)\s*[:=]\s*["']?[^\s,"']{8,}/gi }
  ]);
  function scanSecrets(source) {
    const input = String(source ?? "");
    const findings = [];
    SECRET_PATTERNS.forEach(({ type, severity, pattern }) => {
      const regex = new RegExp(pattern.source, pattern.flags);
      let match;
      while ((match = regex.exec(input))) {
        findings.push({ id: `${type}-${match.index}`, type, severity, index: match.index, length: match[0].length, preview: `${match[0].slice(0, 4)}…${match[0].slice(-4)}` });
        if (!match[0].length) regex.lastIndex += 1;
      }
    });
    return findings.sort((a, b) => a.index - b.index);
  }
  function redactSecrets(source) {
    let output = String(source ?? "");
    SECRET_PATTERNS.forEach(({ type, pattern }) => { output = output.replace(new RegExp(pattern.source, pattern.flags), `[REDACTED:${type}]`); });
    return output;
  }

  function buildCsp(config = {}) {
    const defaults = { "default-src": ["'self'"], "base-uri": ["'self'"], "object-src": ["'none'"], "frame-ancestors": ["'none'"] };
    const directives = { ...defaults, ...(config.directives || config) };
    const normalized = Object.entries(directives).filter(([, values]) => values !== false && values != null).map(([name, values]) => [name, [...new Set((Array.isArray(values) ? values : String(values).split(/\s+/)).filter(Boolean))]]);
    const header = normalized.map(([name, values]) => `${name} ${values.join(" ")}`.trim()).join("; ");
    const warnings = [];
    normalized.forEach(([name, values]) => {
      if (values.includes("*") || values.includes("data:") && ["script-src", "object-src"].includes(name)) warnings.push(`${name}: nguồn quá rộng.`);
      if (values.includes("'unsafe-inline'")) warnings.push(`${name}: unsafe-inline làm giảm khả năng bảo vệ XSS.`);
      if (values.includes("'unsafe-eval'")) warnings.push(`${name}: unsafe-eval cho phép thực thi chuỗi mã.`);
    });
    return { header, meta: `<meta http-equiv="Content-Security-Policy" content="${escapeHtml(header)}">`, warnings };
  }

  function downloadText(content, filename, type = "text/plain;charset=utf-8") {
    if (!globalScope.document) return { content, filename, type };
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const url = globalScope.URL.createObjectURL(blob);
    const anchor = globalScope.document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click();
    setTimeout(() => globalScope.URL.revokeObjectURL(url), 1500);
    return true;
  }

  const instances = new WeakMap();
  function icon(name) { return `<i data-lucide="${name}" aria-hidden="true"></i>`; }
  function optionMarkup(values, selected) { return values.map(([value, label]) => `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(label)}</option>`).join(""); }
  function shellMarkup(toolId) {
    return `<section class="hh-ds" data-ds-root data-tool="${toolId}">
      <header class="hh-ds__hero">
        <div class="hh-ds__brand"><span class="hh-ds__logo">DS</span><div><small>HH DEVELOPER WORKSPACE</small><h2>Data & Security Lab</h2><p>Phân tích dữ liệu và mật mã cục bộ, minh bạch giới hạn trình duyệt.</p></div></div>
        <div class="hh-ds__trust"><span>${icon("shield-check")} Không tải dữ liệu lên server</span><span>${icon("cpu")} Web Worker / Web Crypto</span></div>
      </header>
      <nav class="hh-ds__tabs" aria-label="Data và Security">
        <button type="button" data-ds-tool="json-data-lab" aria-pressed="${toolId === "json-data-lab"}">${icon("braces")}<span>JSON & Data Lab</span></button>
        <button type="button" data-ds-tool="security-encoding" aria-pressed="${toolId === "security-encoding"}">${icon("shield-check")}<span>Security & Encoding</span></button>
      </nav>
      <div class="hh-ds__workspace" data-ds-workspace></div>
      <div class="hh-ds__toast" role="status" aria-live="polite" hidden data-ds-toast></div>
    </section>`;
  }

  function dataLabMarkup(preferences) {
    const view = preferences.dataView || "source";
    return `<div class="hh-ds-data">
      <aside class="hh-ds__rail" aria-label="Công cụ Data Lab">
        <button class="is-active" type="button" data-ds-data-action="format">${icon("wand-sparkles")}<span>Định dạng</span></button>
        <button type="button" data-ds-data-action="query">${icon("search-code")}<span>Truy vấn</span></button>
        <button type="button" data-ds-data-action="diff">${icon("git-compare-arrows")}<span>So sánh</span></button>
        <button type="button" data-ds-data-action="schema">${icon("file-json-2")}<span>Schema</span></button>
      </aside>
      <main class="hh-ds__main">
        <section class="hh-ds__toolbar" aria-label="Điều khiển dữ liệu">
          <label><span>Đầu vào</span><select data-ds-from>${optionMarkup([["auto", "Tự nhận diện"], ["json", "JSON"], ["csv", "CSV"], ["yaml", "YAML"], ["toml", "TOML"], ["xml", "XML"]], "auto")}</select></label>
          <label><span>Đầu ra</span><select data-ds-to>${optionMarkup([["json", "JSON"], ["csv", "CSV"], ["yaml", "YAML"], ["toml", "TOML"], ["xml", "XML"]], "json")}</select></label>
          <div class="hh-ds__toolbar-actions"><button type="button" data-ds-clipboard>${icon("clipboard")} Đọc clipboard</button><button type="button" data-ds-import>${icon("folder-open")} Nhập tệp</button><button class="is-primary" type="button" data-ds-run>${icon("play")} Chạy <kbd>Ctrl Enter</kbd></button></div>
          <input type="file" accept=".json,.csv,.yaml,.yml,.toml,.xml,.txt,text/*" hidden data-ds-file>
        </section>
        <section class="hh-ds__data-grid">
          <article class="hh-ds__editor" data-ds-dropzone>
            <header><strong>Nguồn dữ liệu</strong><span data-ds-detected>Chưa nhận diện</span></header>
            <textarea spellcheck="false" data-ds-input aria-label="Nguồn dữ liệu" placeholder='Dán JSON, CSV, YAML, TOML hoặc XML…'>{"users":[{"id":1,"name":"Hoàng","active":true},{"id":2,"name":"An","active":false}]}</textarea>
            <footer><span data-ds-input-meta>0 B</span><button type="button" data-ds-pin>${icon("pin")} Ghim cấu hình</button></footer>
          </article>
          <article class="hh-ds__result">
            <header><strong>Kết quả</strong><div class="hh-ds__view-switch" role="group" aria-label="Chế độ xem"><button type="button" data-ds-view="source" aria-pressed="${view === "source"}">Source</button><button type="button" data-ds-view="tree" aria-pressed="${view === "tree"}">Tree</button><button type="button" data-ds-view="table" aria-pressed="${view === "table"}">Table</button></div></header>
            <div class="hh-ds__output" data-ds-output tabindex="0"><div class="hh-ds__empty">Nhấn Chạy để xử lý dữ liệu.</div></div>
            <footer><span data-ds-output-meta>0 B</span><button type="button" data-ds-copy>${icon("copy")} Sao chép</button><button type="button" data-ds-export>${icon("download")} Xuất tệp</button></footer>
          </article>
        </section>
        <section class="hh-ds__options" data-ds-options>
          <label><span>JSONPath / JMESPath-lite</span><input data-ds-query value="$.users[*].name" aria-label="Biểu thức truy vấn"></label>
          <label><span>Engine</span><select data-ds-query-engine><option value="jsonpath">JSONPath subset</option><option value="jmespath">JMESPath-lite</option></select></label>
          <label class="hh-ds__wide"><span>Dữ liệu so sánh / JSON Schema</span><textarea data-ds-secondary spellcheck="false" placeholder="Dán dữ liệu thứ hai khi Diff hoặc schema khi Validate"></textarea></label>
          <div class="hh-ds__option-buttons"><button type="button" data-ds-mode="query">Truy vấn</button><button type="button" data-ds-mode="diff">Diff</button><button type="button" data-ds-mode="infer">Sinh schema</button><button type="button" data-ds-mode="validate">Validate</button><button type="button" data-ds-mode="sample">Tạo dữ liệu mẫu</button></div>
        </section>
      </main>
    </div>`;
  }

  function securityMarkup() {
    return `<div class="hh-ds-security">
      <aside class="hh-ds__security-nav" aria-label="Công cụ bảo mật">
        ${[["jwt", "badge-check", "JWT Inspector"], ["hash", "hash", "Checksum tệp"], ["aes", "lock-keyhole", "AES-GCM"], ["rsa", "key-round", "RSA-OAEP"], ["pem", "file-key-2", "PEM / X.509"], ["csp", "shield", "CSP Builder"], ["secrets", "scan-search", "Secret Scanner"]].map(([id, iconName, label], index) => `<button type="button" data-ds-security-tab="${id}" aria-pressed="${index === 0}">${icon(iconName)}<span>${label}</span></button>`).join("")}
      </aside>
      <main class="hh-ds__security-main">
        <header class="hh-ds__security-heading"><div><small>LOCAL SECURITY WORKBENCH</small><h3 data-ds-security-title>JWT Inspector</h3></div><span class="hh-ds__truth">Kết quả chưa thay thế kiểm toán bảo mật chuyên nghiệp</span></header>
        <div data-ds-security-panel>${securityPanelMarkup("jwt")}</div>
      </main>
    </div>`;
  }

  function securityPanelMarkup(tab) {
    const actions = (primary) => `<div class="hh-ds__secure-actions"><button class="is-primary" type="button" data-ds-secure-run>${icon("play")} ${primary}</button><button type="button" data-ds-secure-clear>${icon("trash-2")} Xóa khỏi phiên</button></div>`;
    if (tab === "jwt") return `<section class="hh-ds__secure-grid"><label class="hh-ds__secure-editor"><span>JWT</span><textarea data-ds-secure-input spellcheck="false" placeholder="eyJhbGciOi…"></textarea></label><article class="hh-ds__secure-output"><header><strong>Header, payload và thời hạn</strong><span>Không tự xác minh chữ ký</span></header><pre data-ds-secure-output>Chưa có token.</pre></article>${actions("Phân tích JWT")}</section>`;
    if (tab === "hash") return `<section class="hh-ds__secure-grid"><label class="hh-ds__file-drop"><input type="file" multiple data-ds-hash-files><span>${icon("files")} Chọn hoặc kéo nhiều tệp</span><small>SHA chạy hoàn toàn trên thiết bị</small></label><fieldset class="hh-ds__checks"><legend>Thuật toán</legend>${["SHA-1", "SHA-256", "SHA-384", "SHA-512"].map((algorithm) => `<label><input type="checkbox" value="${algorithm}" data-ds-hash-algorithm${algorithm === "SHA-256" ? " checked" : ""}> ${algorithm}</label>`).join("")}</fieldset><article class="hh-ds__secure-output"><pre data-ds-secure-output>Chưa chọn tệp.</pre></article>${actions("Tính checksum")}</section>`;
    if (tab === "aes") return `<section class="hh-ds__secure-grid"><div class="hh-ds__segmented"><button type="button" data-ds-aes-mode="encrypt" aria-pressed="true">Mã hóa</button><button type="button" data-ds-aes-mode="decrypt" aria-pressed="false">Giải mã</button></div><label class="hh-ds__secure-editor"><span>Nội dung hoặc gói AES JSON</span><textarea data-ds-secure-input spellcheck="false"></textarea></label><label class="hh-ds__secure-field"><span>Mật khẩu phiên</span><input type="password" autocomplete="new-password" data-ds-password><small>Không lưu vào localStorage</small></label><article class="hh-ds__secure-output"><pre data-ds-secure-output>PBKDF2-SHA-256 310.000 vòng · AES-256-GCM</pre></article>${actions("Mã hóa AES")}</section>`;
    if (tab === "rsa") return `<section class="hh-ds__secure-grid"><div class="hh-ds__segmented"><button type="button" data-ds-rsa-mode="generate" aria-pressed="true">Sinh khóa</button><button type="button" data-ds-rsa-mode="encrypt">Mã hóa</button><button type="button" data-ds-rsa-mode="decrypt">Giải mã</button></div><label class="hh-ds__secure-editor"><span>Nội dung / ciphertext</span><textarea data-ds-secure-input spellcheck="false"></textarea></label><label class="hh-ds__secure-editor"><span>Khóa PEM dùng cho tác vụ</span><textarea data-ds-key-input spellcheck="false" placeholder="-----BEGIN PUBLIC KEY-----"></textarea></label><article class="hh-ds__secure-output"><pre data-ds-secure-output>RSA-OAEP SHA-256 · hỗ trợ tùy Web Crypto của trình duyệt.</pre></article>${actions("Sinh cặp khóa")}</section>`;
    if (tab === "pem") return `<section class="hh-ds__secure-grid"><label class="hh-ds__secure-editor"><span>PEM certificate / key</span><textarea data-ds-secure-input spellcheck="false" placeholder="-----BEGIN CERTIFICATE-----"></textarea></label><article class="hh-ds__secure-output"><header><strong>Thông tin cấu trúc</strong><span>Không xác minh trust chain</span></header><pre data-ds-secure-output>Chưa có PEM.</pre></article>${actions("Phân tích PEM")}</section>`;
    if (tab === "csp") return `<section class="hh-ds__secure-grid"><div class="hh-ds__csp-fields">${[["default-src", "'self'"], ["script-src", "'self'"], ["style-src", "'self'"], ["img-src", "'self' data: https:"], ["connect-src", "'self'"], ["frame-src", "'none'"]].map(([name, value]) => `<label><span>${name}</span><input data-ds-csp="${name}" value="${escapeHtml(value)}"></label>`).join("")}</div><article class="hh-ds__secure-output"><pre data-ds-secure-output>Chưa sinh Content-Security-Policy.</pre></article>${actions("Sinh CSP")}</section>`;
    return `<section class="hh-ds__secure-grid"><label class="hh-ds__secure-editor"><span>Văn bản, cấu hình hoặc diff</span><textarea data-ds-secure-input spellcheck="false" placeholder="Dán nội dung cần kiểm tra trước khi chia sẻ…"></textarea></label><article class="hh-ds__secure-output"><header><strong>Phát hiện bí mật</strong><button type="button" data-ds-redact>Che dữ liệu nhạy cảm</button></header><pre data-ds-secure-output>Chưa quét dữ liệu.</pre></article>${actions("Quét bí mật")}</section>`;
  }

  function renderDataResult(instance, value) {
    const output = instance.root.querySelector("[data-ds-output]");
    const view = instance.view;
    if (view === "tree") {
      const rows = treeRows(value);
      output.innerHTML = `<div class="hh-ds__tree" role="tree">${rows.map((row) => `<div role="treeitem" aria-level="${row.depth + 1}" style="--depth:${row.depth}"><span>${escapeHtml(row.key)}</span><em>${escapeHtml(row.type)}</em><code>${escapeHtml(typeof row.value === "string" ? row.value : JSON.stringify(row.value))}</code></div>`).join("")}</div>`;
    } else if (view === "table") {
      const rows = flattenRows(value), headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
      output.innerHTML = rows.length ? `<div class="hh-ds__table-wrap"><table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${headers.map((header) => `<td>${escapeHtml(row[header] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>` : '<div class="hh-ds__empty">Không có hàng dữ liệu.</div>';
    } else output.innerHTML = `<pre>${escapeHtml(instance.outputText)}</pre>`;
    instance.root.querySelector("[data-ds-output-meta]").textContent = `${formatBytes(new Blob([instance.outputText]).size)} · ${view}`;
  }

  function recordHistory(instance, action, summary) {
    const store = storageRead();
    storageWrite({ history: [{ id: randomId(), tool: instance.toolId, action, summary: String(summary).slice(0, 120), at: new Date().toISOString() }, ...store.history].slice(0, 40) });
  }

  async function runData(instance, forcedMode) {
    const root = instance.root, source = root.querySelector("[data-ds-input]").value, from = root.querySelector("[data-ds-from]").value;
    const mode = forcedMode || instance.dataMode || "format";
    let value, text;
    if (mode === "format") {
      const resolved = from === "auto" ? detectFormat(source) : from;
      if (resolved === "json") {
        const processed = await processLargeJson(source, "parse"); value = processed.result;
        root.querySelector("[data-ds-detected]").textContent = processed.worker ? "JSON · Web Worker" : "JSON · local";
      } else { value = parseData(source, resolved); root.querySelector("[data-ds-detected]").textContent = `${resolved.toUpperCase()} · local`; }
      text = stringifyData(value, root.querySelector("[data-ds-to]").value);
    } else {
      value = parseData(source, from);
      if (mode === "query") {
        const expression = root.querySelector("[data-ds-query]").value;
        value = root.querySelector("[data-ds-query-engine]").value === "jmespath" ? jmesPathLite(value, expression) : jsonPathQuery(value, expression);
        text = JSON.stringify(value, null, 2);
      } else if (mode === "diff") {
        const right = parseData(root.querySelector("[data-ds-secondary]").value, "auto"); value = diffValues(value, right); text = JSON.stringify(value, null, 2);
      } else if (mode === "infer") { value = inferSchema(value); text = JSON.stringify(value, null, 2); }
      else if (mode === "validate") {
        const schema = JSON.parse(root.querySelector("[data-ds-secondary]").value); value = validateSchema(value, schema); text = JSON.stringify(value, null, 2);
      } else if (mode === "sample") {
        const schemaSource = root.querySelector("[data-ds-secondary]").value || source; const schema = JSON.parse(schemaSource); value = sampleFromSchema(schema); text = JSON.stringify(value, null, 2);
      }
    }
    instance.outputValue = value; instance.outputText = text; renderDataResult(instance, value);
    recordHistory(instance, mode, `${mode} · ${formatBytes(new Blob([source]).size)}`);
    notify(instance, "Đã xử lý hoàn toàn trên thiết bị.", "success");
  }

  function notify(instance, message, kind = "info") {
    const toast = instance.root.querySelector("[data-ds-toast]");
    if (!toast) return;
    toast.textContent = message; toast.dataset.kind = kind; toast.hidden = false;
    clearTimeout(instance.toastTimer); instance.toastTimer = setTimeout(() => { toast.hidden = true; }, 2800);
  }

  async function runSecurity(instance) {
    const root = instance.root, panel = root.querySelector("[data-ds-security-panel]"), input = panel.querySelector("[data-ds-secure-input]")?.value || "";
    const output = panel.querySelector("[data-ds-secure-output]"); let value;
    if (instance.securityTab === "jwt") value = inspectJwt(input);
    else if (instance.securityTab === "hash") {
      const algorithms = [...panel.querySelectorAll("[data-ds-hash-algorithm]:checked")].map((node) => node.value);
      value = await hashFiles(panel.querySelector("[data-ds-hash-files]").files, algorithms);
    } else if (instance.securityTab === "aes") {
      const password = panel.querySelector("[data-ds-password]").value;
      value = instance.aesMode === "decrypt" ? await aesDecrypt(input, password) : await aesEncrypt(input, password);
    } else if (instance.securityTab === "rsa") {
      const key = panel.querySelector("[data-ds-key-input]").value;
      if (instance.rsaMode === "generate") value = await rsaGenerateKeyPair();
      else if (instance.rsaMode === "encrypt") value = await rsaEncrypt(input, key);
      else value = await rsaDecrypt(input, key);
    } else if (instance.securityTab === "pem") value = inspectPem(input);
    else if (instance.securityTab === "csp") {
      const directives = Object.fromEntries([...panel.querySelectorAll("[data-ds-csp]")].map((node) => [node.dataset.dsCsp, node.value.split(/\s+/).filter(Boolean)]));
      value = buildCsp(directives);
    } else value = { findings: scanSecrets(input), redactedPreview: redactSecrets(input) };
    instance.secureOutput = typeof value === "string" ? value : JSON.stringify(value, null, 2);
    output.textContent = instance.secureOutput;
    recordHistory(instance, instance.securityTab, `${instance.securityTab} · local`);
    notify(instance, "Tác vụ bảo mật đã hoàn tất trong phiên cục bộ.", "success");
  }

  function bindData(instance) {
    const root = instance.root, input = root.querySelector("[data-ds-input]");
    const updateMeta = () => {
      const value = input.value; root.querySelector("[data-ds-input-meta]").textContent = `${formatBytes(new Blob([value]).size)} · ${value.split(/\r?\n/).length} dòng`;
      root.querySelector("[data-ds-detected]").textContent = `${detectFormat(value).toUpperCase()} · nhận diện`;
    };
    updateMeta(); input.addEventListener("input", updateMeta);
    root.querySelector("[data-ds-run]").addEventListener("click", () => runData(instance).catch((error) => notify(instance, error.message, "error")));
    root.querySelectorAll("[data-ds-mode],[data-ds-data-action]").forEach((button) => button.addEventListener("click", () => {
      instance.dataMode = button.dataset.dsMode || button.dataset.dsDataAction;
      root.querySelectorAll("[data-ds-data-action]").forEach((node) => node.classList.toggle("is-active", node.dataset.dsDataAction === instance.dataMode));
      runData(instance, instance.dataMode).catch((error) => notify(instance, error.message, "error"));
    }));
    root.querySelectorAll("[data-ds-view]").forEach((button) => button.addEventListener("click", () => {
      instance.view = button.dataset.dsView; root.querySelectorAll("[data-ds-view]").forEach((node) => node.setAttribute("aria-pressed", String(node === button)));
      storageWrite({ preferences: { dataView: instance.view } }); if (instance.outputValue !== undefined) renderDataResult(instance, instance.outputValue);
    }));
    const fileInput = root.querySelector("[data-ds-file]");
    root.querySelector("[data-ds-import]").addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", async () => { const file = fileInput.files[0]; if (!file) return; input.value = await file.text(); updateMeta(); notify(instance, `Đã đọc ${file.name} (${formatBytes(file.size)}).`, "success"); });
    const dropzone = root.querySelector("[data-ds-dropzone]");
    ["dragenter", "dragover"].forEach((name) => dropzone.addEventListener(name, (event) => { event.preventDefault(); dropzone.classList.add("is-dragging"); }));
    ["dragleave", "drop"].forEach((name) => dropzone.addEventListener(name, (event) => { event.preventDefault(); dropzone.classList.remove("is-dragging"); }));
    dropzone.addEventListener("drop", async (event) => { const file = event.dataTransfer.files[0]; if (!file) return; input.value = await file.text(); updateMeta(); });
    root.querySelector("[data-ds-clipboard]").addEventListener("click", async () => { try { input.value = await navigator.clipboard.readText(); updateMeta(); notify(instance, "Đã đọc clipboard sau khi bạn cấp quyền.", "success"); } catch { notify(instance, "Trình duyệt từ chối clipboard. Hãy dán thủ công.", "error"); } });
    root.querySelector("[data-ds-copy]").addEventListener("click", async () => { if (!instance.outputText) return notify(instance, "Chưa có kết quả để sao chép.", "error"); await navigator.clipboard.writeText(instance.outputText); notify(instance, "Đã sao chép kết quả.", "success"); });
    root.querySelector("[data-ds-export]").addEventListener("click", () => { if (!instance.outputText) return notify(instance, "Chưa có kết quả để xuất.", "error"); const extension = root.querySelector("[data-ds-to]").value; downloadText(instance.outputText, `hh-data-${Date.now()}.${extension}`); });
    root.querySelector("[data-ds-pin]").addEventListener("click", () => { const store = storageRead(); storageWrite({ pins: [{ id: randomId(), from: root.querySelector("[data-ds-from]").value, to: root.querySelector("[data-ds-to]").value, query: root.querySelector("[data-ds-query]").value, at: new Date().toISOString() }, ...store.pins].slice(0, 20) }); notify(instance, "Đã ghim cấu hình, không lưu nội dung dữ liệu.", "success"); });
  }

  function bindSecurity(instance) {
    const root = instance.root;
    root.querySelectorAll("[data-ds-security-tab]").forEach((button) => button.addEventListener("click", () => {
      instance.securityTab = button.dataset.dsSecurityTab;
      root.querySelectorAll("[data-ds-security-tab]").forEach((node) => node.setAttribute("aria-pressed", String(node === button)));
      const labels = { jwt: "JWT Inspector", hash: "Checksum tệp", aes: "AES-GCM + PBKDF2", rsa: "RSA-OAEP", pem: "PEM / X.509 Viewer", csp: "Content Security Policy", secrets: "Secret Scanner" };
      root.querySelector("[data-ds-security-title]").textContent = labels[instance.securityTab];
      root.querySelector("[data-ds-security-panel]").innerHTML = securityPanelMarkup(instance.securityTab);
      bindSecurityPanel(instance);
    }));
    bindSecurityPanel(instance);
  }

  function bindSecurityPanel(instance) {
    const panel = instance.root.querySelector("[data-ds-security-panel]");
    panel.querySelector("[data-ds-secure-run]")?.addEventListener("click", () => runSecurity(instance).catch((error) => notify(instance, error.message, "error")));
    panel.querySelector("[data-ds-secure-clear]")?.addEventListener("click", () => {
      panel.querySelectorAll("textarea,input[type='password']").forEach((node) => { node.value = ""; });
      const output = panel.querySelector("[data-ds-secure-output]"); if (output) output.textContent = "Dữ liệu nhạy cảm đã được xóa khỏi phiên giao diện.";
      instance.secureOutput = "";
    });
    panel.querySelectorAll("[data-ds-aes-mode]").forEach((button) => button.addEventListener("click", () => {
      instance.aesMode = button.dataset.dsAesMode; panel.querySelectorAll("[data-ds-aes-mode]").forEach((node) => node.setAttribute("aria-pressed", String(node === button)));
      panel.querySelector("[data-ds-secure-run]").lastChild.textContent = instance.aesMode === "decrypt" ? " Giải mã AES" : " Mã hóa AES";
    }));
    panel.querySelectorAll("[data-ds-rsa-mode]").forEach((button) => button.addEventListener("click", () => {
      instance.rsaMode = button.dataset.dsRsaMode; panel.querySelectorAll("[data-ds-rsa-mode]").forEach((node) => node.setAttribute("aria-pressed", String(node === button)));
      panel.querySelector("[data-ds-secure-run]").lastChild.textContent = instance.rsaMode === "generate" ? " Sinh cặp khóa" : instance.rsaMode === "encrypt" ? " Mã hóa RSA" : " Giải mã RSA";
    }));
    panel.querySelector("[data-ds-redact]")?.addEventListener("click", () => { const input = panel.querySelector("[data-ds-secure-input]"); input.value = redactSecrets(input.value); panel.querySelector("[data-ds-secure-output]").textContent = "Đã che dữ liệu nhận diện được. Hãy tự rà soát trước khi chia sẻ."; });
    const hashDrop = panel.querySelector("[data-ds-hash-files]")?.closest("label");
    if (hashDrop) {
      ["dragenter", "dragover"].forEach((name) => hashDrop.addEventListener(name, (event) => { event.preventDefault(); hashDrop.classList.add("is-dragging"); }));
      ["dragleave", "drop"].forEach((name) => hashDrop.addEventListener(name, (event) => { event.preventDefault(); hashDrop.classList.remove("is-dragging"); }));
      hashDrop.addEventListener("drop", (event) => { const input = panel.querySelector("[data-ds-hash-files]"); try { input.files = event.dataTransfer.files; } catch {} panel.querySelector("[data-ds-secure-output]").textContent = `${event.dataTransfer.files.length} tệp sẵn sàng.`; });
    }
  }

  function activateTool(instance, toolId) {
    const resolved = TOOL_IDS.includes(toolId) ? toolId : "json-data-lab";
    instance.toolId = resolved;
    instance.root.dataset.tool = resolved;
    instance.root.querySelectorAll("[data-ds-tool]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.dsTool === resolved)));
    const workspace = instance.root.querySelector("[data-ds-workspace]");
    if (resolved === "json-data-lab") { workspace.innerHTML = dataLabMarkup(storageRead().preferences); bindData(instance); }
    else { workspace.innerHTML = securityMarkup(); bindSecurity(instance); }
    storageWrite({ preferences: { activeTool: resolved } });
    globalScope.lucide?.createIcons?.({ attrs: { width: 17, height: 17, "stroke-width": 1.8 } });
  }

  function mount(target, options = {}) {
    if (!target || typeof target.querySelector !== "function") throw new Error("HHDevDataSecurity.mount cần một phần tử DOM hợp lệ.");
    unmount(target);
    const stored = storageRead();
    const requested = options.toolId || options.tool || stored.preferences.activeTool || "json-data-lab";
    const toolId = TOOL_IDS.includes(requested) ? requested : "json-data-lab";
    target.innerHTML = shellMarkup(toolId);
    const root = target.querySelector("[data-ds-root]");
    const instance = { target, root, toolId, view: stored.preferences.dataView || "source", dataMode: "format", securityTab: "jwt", aesMode: "encrypt", rsaMode: "generate", outputValue: undefined, outputText: "", secureOutput: "", toastTimer: 0 };
    instances.set(target, instance);
    root.querySelectorAll("[data-ds-tool]").forEach((button) => button.addEventListener("click", () => activateTool(instance, button.dataset.dsTool)));
    instance.keydown = (event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && root.isConnected) { event.preventDefault(); (instance.toolId === "json-data-lab" ? runData(instance) : runSecurity(instance)).catch((error) => notify(instance, error.message, "error")); } };
    root.addEventListener("keydown", instance.keydown);
    activateTool(instance, toolId);
    return { toolId, root, unmount: () => unmount(target), setTool: (next) => activateTool(instance, next) };
  }

  function unmount(target) {
    const instance = instances.get(target);
    if (!instance) return false;
    clearTimeout(instance.toastTimer);
    instance.root?.removeEventListener("keydown", instance.keydown);
    instances.delete(target);
    return true;
  }

  const api = Object.freeze({
    VERSION, STORAGE_KEY, TOOL_IDS,
    tools: () => TOOL_META.map((tool) => ({ ...tool })),
    supports: (toolId) => TOOL_IDS.includes(toolId),
    mount, unmount,
    detectFormat, parseData, stringifyData, convertData, parseCsv, parseYaml, parseToml, parseXml,
    jsonPathQuery, jmesPathLite, flattenRows, treeRows, diffValues,
    inferSchema, validateSchema, sampleFromSchema, processLargeJson,
    inspectJwt, digestBytes, hashFiles, aesEncrypt, aesDecrypt,
    rsaGenerateKeyPair, rsaImportPublicKey, rsaImportPrivateKey, rsaEncrypt, rsaDecrypt,
    inspectDerTree, inspectPem, buildCsp, scanSecrets, redactSecrets,
    sanitizePersistentValue, storageRead, storageWrite
  });

  globalScope.HHDevDataSecurity = api;
  if (typeof globalScope.CustomEvent === "function") globalScope.dispatchEvent?.(new globalScope.CustomEvent("hh:dev-data-security-ready", { detail: { tools: TOOL_IDS } }));
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
