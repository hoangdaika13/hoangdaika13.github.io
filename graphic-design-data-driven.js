(function (globalScope) {
  "use strict";

  const VERSION = 1;
  const FORMAT = "hh-graphic-data-driven";
  const STORAGE_KEY = "hh.graphic-data-driven.dataset.v1";
  const STYLE_ID = "hh-graphic-data-driven-style-v1";
  const MAX_BYTES = 5 * 1024 * 1024;
  const MAX_RECORDS = 500;
  const MAX_COLUMNS = 120;
  const MAX_CELL_LENGTH = 20000;
  const MAX_DEPTH = 12;
  const BINDING_TARGETS = Object.freeze(["text", "color", "image", "state"]);
  const BINDING_DIRECTIONS = Object.freeze(["source", "target", "bidirectional"]);
  const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);
  const mounted = new WeakMap();

  const TEMPLATES = Object.freeze({
    banner: Object.freeze({ id: "banner", label: "Banner", width: 1200, height: 420, title: "Campaign headline", subtitle: "A clear message for every record", labelText: "Explore", accent: "#67E8F9", surface: "#111827", state: "active" }),
    "member-card": Object.freeze({ id: "member-card", label: "Member card", width: 720, height: 420, title: "Member name", subtitle: "Role and team", labelText: "Member", accent: "#F472B6", surface: "#172033", state: "active" }),
    thumbnail: Object.freeze({ id: "thumbnail", label: "Thumbnail", width: 1280, height: 720, title: "Video title", subtitle: "Series or channel", labelText: "Watch", accent: "#BEF264", surface: "#151A22", state: "published" })
  });

  function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function cleanText(value, limit) {
    return String(value == null ? "" : value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").slice(0, limit || MAX_CELL_LENGTH);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function safeKey(value, fallback) {
    const key = cleanText(value, 160).trim() || fallback;
    return DANGEROUS_KEYS.has(key) ? `field_${key.replace(/[^a-z0-9]+/gi, "_")}` : key;
  }

  function safeId(value, fallback) {
    const id = cleanText(value, 100).trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
    return id || fallback;
  }

  function safeColor(value, fallback) {
    const color = String(value || "").trim();
    if (/^#[0-9a-f]{3}$/i.test(color)) return `#${color.slice(1).split("").map((part) => part + part).join("")}`.toUpperCase();
    if (/^#[0-9a-f]{6}$/i.test(color)) return color.toUpperCase();
    return fallback || "#67E8F9";
  }

  function isValidColor(value) {
    return /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(String(value || "").trim());
  }

  function safeImageUrl(value) {
    const source = value && typeof value === "object" ? value.src || value.url || "" : value;
    const url = cleanText(source, MAX_CELL_LENGTH).trim();
    if (!url) return "";
    if (/^data:image\/(?:png|jpe?g|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(url)) return url;
    if (/^(?:https?:|blob:)/i.test(url)) return url;
    if (/^(?:\.{0,2}\/|\/)[^\u0000\s]*$/i.test(url)) return url;
    return "";
  }

  function isFormulaLike(value) {
    return typeof value === "string" && /^[\t\r ]*[=+\-@]/.test(value);
  }

  function detectDelimiter(text) {
    const counts = { ",": 0, ";": 0, "\t": 0 };
    let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      if (char === '"') {
        if (quoted && text[index + 1] === '"') index += 1;
        else quoted = !quoted;
      } else if (!quoted && char === "\n") break;
      else if (!quoted && hasOwn(counts, char)) counts[char] += 1;
    }
    return Object.keys(counts).sort((left, right) => counts[right] - counts[left])[0] || ",";
  }

  function parseCSV(input, options) {
    const settings = options && typeof options === "object" ? options : {};
    let text = String(input == null ? "" : input);
    const errors = [];
    const warnings = [];
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    if (text.length > (settings.maxBytes || MAX_BYTES)) {
      errors.push({ code: "too-large", message: "CSV exceeds the local parser limit." });
      return { format: "csv", delimiter: ",", headers: [], records: [], schema: [], errors, warnings, valid: false };
    }
    if (!text.trim()) {
      errors.push({ code: "empty", message: "CSV is empty." });
      return { format: "csv", delimiter: ",", headers: [], records: [], schema: [], errors, warnings, valid: false };
    }

    const delimiter = [",", ";", "\t"].includes(settings.delimiter) ? settings.delimiter : detectDelimiter(text);
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;
    let rowNumber = 1;
    let endedWithBreak = false;

    const pushCell = () => {
      if (cell.length > MAX_CELL_LENGTH) {
        warnings.push({ code: "cell-truncated", row: rowNumber, message: `Cell on row ${rowNumber} was truncated.` });
        cell = cell.slice(0, MAX_CELL_LENGTH);
      }
      row.push(cleanText(cell, MAX_CELL_LENGTH));
      cell = "";
    };
    const pushRow = () => {
      if (row.length > MAX_COLUMNS) {
        warnings.push({ code: "column-limit", row: rowNumber, message: `Row ${rowNumber} exceeds ${MAX_COLUMNS} columns.` });
        row = row.slice(0, MAX_COLUMNS);
      }
      rows.push(row);
      row = [];
      rowNumber += 1;
    };

    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      endedWithBreak = false;
      if (quoted) {
        if (char === '"' && text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else if (char === '"') quoted = false;
        else cell += char;
        continue;
      }
      if (char === '"' && cell === "") quoted = true;
      else if (char === delimiter) pushCell();
      else if (char === "\n" || char === "\r") {
        if (char === "\r" && text[index + 1] === "\n") index += 1;
        pushCell();
        pushRow();
        endedWithBreak = true;
      } else cell += char;
    }
    if (quoted) errors.push({ code: "unclosed-quote", row: rowNumber, message: `Unclosed quoted field on row ${rowNumber}.` });
    if (!endedWithBreak || cell || row.length) {
      pushCell();
      pushRow();
    }

    const rawHeaders = rows.shift() || [];
    const seenHeaders = new Map();
    const headers = rawHeaders.map((header, index) => {
      const base = safeKey(header, `field_${index + 1}`);
      const count = (seenHeaders.get(base) || 0) + 1;
      seenHeaders.set(base, count);
      return count === 1 ? base : `${base}_${count}`;
    });
    if (!headers.length) errors.push({ code: "missing-header", message: "CSV requires a header row." });

    const records = [];
    let formulaCount = 0;
    const maxRows = Math.min(MAX_RECORDS, Number(settings.maxRecords) || MAX_RECORDS);
    for (const values of rows) {
      if (values.every((value) => value === "")) continue;
      if (records.length >= maxRows) {
        warnings.push({ code: "row-limit", message: `Only the first ${maxRows} records were loaded.` });
        break;
      }
      const record = {};
      headers.forEach((header, index) => {
        const value = values[index] == null ? "" : values[index];
        record[header] = value;
        if (isFormulaLike(value)) formulaCount += 1;
      });
      if (values.length !== headers.length) warnings.push({ code: "column-mismatch", row: records.length + 2, message: `Row ${records.length + 2} has ${values.length} values for ${headers.length} headers.` });
      records.push(record);
    }
    if (formulaCount) warnings.push({ code: "formula-like", count: formulaCount, message: `${formulaCount} formula-like value(s) were kept as literal text; formulas are never executed.` });
    const schema = inferSchema(records);
    return { format: "csv", delimiter, headers, records, schema, errors, warnings, valid: errors.length === 0 };
  }

  function cleanJsonValue(value, depth) {
    if (depth > MAX_DEPTH) throw new Error("JSON nesting exceeds the supported depth.");
    if (value == null || typeof value === "boolean" || typeof value === "number") return value;
    if (typeof value === "string") return cleanText(value, MAX_CELL_LENGTH);
    if (Array.isArray(value)) return value.slice(0, MAX_COLUMNS).map((item) => cleanJsonValue(item, depth + 1));
    if (typeof value === "object") {
      const result = {};
      Object.keys(value).slice(0, MAX_COLUMNS).forEach((key, index) => {
        const normalizedKey = safeKey(key, `field_${index + 1}`);
        result[normalizedKey] = cleanJsonValue(value[key], depth + 1);
      });
      return result;
    }
    return cleanText(value, MAX_CELL_LENGTH);
  }

  function walkFormulaValues(value, path, results) {
    if (isFormulaLike(value)) results.push(path || "$");
    else if (Array.isArray(value)) value.forEach((item, index) => walkFormulaValues(item, `${path}[${index}]`, results));
    else if (value && typeof value === "object") Object.keys(value).forEach((key) => walkFormulaValues(value[key], path ? `${path}.${key}` : key, results));
  }

  function parseJSON(input, options) {
    const settings = options && typeof options === "object" ? options : {};
    const text = String(input == null ? "" : input);
    const errors = [];
    const warnings = [];
    if (text.length > (settings.maxBytes || MAX_BYTES)) {
      errors.push({ code: "too-large", message: "JSON exceeds the local parser limit." });
      return { format: "json", records: [], schema: [], errors, warnings, valid: false };
    }
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      errors.push({ code: "invalid-json", message: cleanText(error.message, 240) });
      return { format: "json", records: [], schema: [], errors, warnings, valid: false };
    }
    let rawRecords = Array.isArray(parsed) ? parsed : Array.isArray(parsed && parsed.records) ? parsed.records : parsed && typeof parsed === "object" ? [parsed] : [];
    if (!rawRecords.length) errors.push({ code: "empty", message: "JSON must contain an object or an array of records." });
    if (rawRecords.length > MAX_RECORDS) warnings.push({ code: "row-limit", message: `Only the first ${MAX_RECORDS} records were loaded.` });
    let records = [];
    try {
      records = rawRecords.slice(0, MAX_RECORDS).map((record) => cleanJsonValue(record && typeof record === "object" && !Array.isArray(record) ? record : { value: record }, 0));
    } catch (error) {
      errors.push({ code: "unsupported-depth", message: cleanText(error.message, 240) });
      records = [];
    }
    const formulaPaths = [];
    records.forEach((record, index) => walkFormulaValues(record, `[${index}]`, formulaPaths));
    if (formulaPaths.length) warnings.push({ code: "formula-like", count: formulaPaths.length, paths: formulaPaths.slice(0, 20), message: `${formulaPaths.length} formula-like value(s) were kept as literal text; formulas are never executed.` });
    const schema = inferSchema(records);
    return { format: "json", records, schema, errors, warnings, valid: errors.length === 0 };
  }

  function parseDataset(input, format, options) {
    const normalizedFormat = String(format || "").toLowerCase();
    if (normalizedFormat === "csv" || normalizedFormat === "text/csv") return parseCSV(input, options);
    if (normalizedFormat === "json" || normalizedFormat === "application/json") return parseJSON(input, options);
    const text = String(input == null ? "" : input).trim();
    return text.startsWith("[") || text.startsWith("{") ? parseJSON(text, options) : parseCSV(text, options);
  }

  function flattenRecord(value, path, fields, seen) {
    if (Array.isArray(value)) {
      fields.set(path || "value", value);
      return;
    }
    if (value && typeof value === "object") {
      const keys = Object.keys(value);
      if (!keys.length && path) fields.set(path, value);
      keys.forEach((key) => {
        if (DANGEROUS_KEYS.has(key)) return;
        flattenRecord(value[key], path ? `${path}.${key}` : key, fields, seen);
      });
      return;
    }
    fields.set(path || "value", value);
  }

  function scalarType(value) {
    if (value == null || value === "") return "null";
    if (Array.isArray(value)) return "list";
    if (typeof value === "object") return "object";
    if (typeof value === "boolean") return "boolean";
    if (typeof value === "number" && Number.isFinite(value)) return "number";
    const text = String(value).trim();
    if (/^(?:true|false)$/i.test(text)) return "boolean";
    if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(text)) return "number";
    if (/^#[0-9a-f]{3,8}$/i.test(text)) return "color";
    if (safeImageUrl(text)) return "image";
    return "string";
  }

  function semanticType(path, type) {
    const name = String(path || "").toLowerCase();
    if (type === "color" || /(?:^|\.)(?:color|accent|background|surface|hex)$/.test(name)) return "color";
    if (type === "image" || /(?:^|\.)(?:image|photo|avatar|logo|thumbnail|cover|src|url)$/.test(name)) return "image";
    if (/(?:^|\.)(?:state|status|stage|variant)$/.test(name)) return "state";
    return "text";
  }

  function inferSchema(recordsInput) {
    const records = Array.isArray(recordsInput) ? recordsInput : [];
    const stats = new Map();
    records.forEach((record) => {
      const flat = new Map();
      flattenRecord(record, "", flat);
      flat.forEach((value, path) => {
        if (!stats.has(path)) stats.set(path, { values: [], present: 0 });
        const field = stats.get(path);
        field.present += 1;
        field.values.push(value);
      });
    });
    return Array.from(stats, ([path, field]) => {
      const populated = field.values.filter((value) => value != null && value !== "");
      const typeSet = new Set(populated.map(scalarType));
      let type = typeSet.size === 0 ? "null" : typeSet.size === 1 ? Array.from(typeSet)[0] : "mixed";
      const strings = populated.filter((value) => typeof value === "string").map((value) => value.trim());
      const unique = Array.from(new Set(strings));
      const enumHint = /(?:^|\.)(?:type|role|category|status|state|variant|tier|team)$/.test(path.toLowerCase());
      if (type === "string" && unique.length > 1 && unique.length <= 20 && (enumHint || unique.length <= Math.max(3, Math.floor(strings.length * 0.5)))) type = "enum";
      const listValues = populated.filter(Array.isArray);
      const itemTypes = type === "list" ? Array.from(new Set(listValues.flat().map(scalarType))) : [];
      return {
        path,
        label: path.split(".").slice(-1)[0] || "value",
        type,
        semantic: semanticType(path, type),
        required: records.length > 0 && field.present === records.length && populated.length === records.length,
        nullable: populated.length !== records.length,
        values: type === "enum" ? unique : [],
        itemTypes
      };
    });
  }

  function pathParts(path) {
    return String(path || "").replace(/\[(\d+)\]/g, ".$1").split(".").map((part) => part.trim()).filter(Boolean);
  }

  function getValueAtPath(record, path, fallback) {
    if (!record || typeof record !== "object") return fallback;
    if (hasOwn(record, path)) return record[path];
    let current = record;
    for (const part of pathParts(path)) {
      if (DANGEROUS_KEYS.has(part) || current == null || (typeof current !== "object" && !Array.isArray(current)) || !hasOwn(current, part)) return fallback;
      current = current[part];
    }
    return current === undefined ? fallback : current;
  }

  function setValueAtPath(recordInput, path, value) {
    const record = cleanJsonValue(recordInput && typeof recordInput === "object" ? recordInput : {}, 0);
    if (hasOwn(record, path)) {
      record[path] = cleanJsonValue(value, 0);
      return record;
    }
    const parts = pathParts(path);
    if (!parts.length || parts.some((part) => DANGEROUS_KEYS.has(part))) return record;
    let current = record;
    parts.forEach((part, index) => {
      if (index === parts.length - 1) current[part] = cleanJsonValue(value, 0);
      else {
        const nextPart = parts[index + 1];
        if (!current[part] || typeof current[part] !== "object") current[part] = /^\d+$/.test(nextPart) ? [] : {};
        current = current[part];
      }
    });
    return record;
  }

  function valueText(value) {
    if (value == null) return "";
    if (Array.isArray(value)) return value.map(valueText).join(", ");
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  }

  function defaultField(schema, target, fallback) {
    const fields = Array.isArray(schema) ? schema : [];
    const semantic = fields.find((field) => field.semantic === target);
    if (semantic) return semantic.path;
    if (target === "text") {
      const preferred = fields.find((field) => /(?:^|\.)(?:name|title|headline)$/.test(field.path.toLowerCase()));
      if (preferred) return preferred.path;
    }
    return fields[0]?.path || fallback || "value";
  }

  function createDefaultBindings(schema) {
    const textPath = defaultField(schema, "text", "name");
    const secondary = (schema || []).find((field) => field.semantic === "text" && field.path !== textPath)?.path || textPath;
    return [
      { id: "binding-title", path: textPath, target: "text", slot: "title", direction: "bidirectional" },
      { id: "binding-subtitle", path: secondary, target: "text", slot: "subtitle", direction: "bidirectional" },
      { id: "binding-color", path: defaultField(schema, "color", "accent"), target: "color", slot: "accent", direction: "bidirectional" },
      { id: "binding-image", path: defaultField(schema, "image", "image"), target: "image", slot: "image", direction: "bidirectional" },
      { id: "binding-state", path: defaultField(schema, "state", "status"), target: "state", slot: "state", direction: "bidirectional" }
    ];
  }

  function normalizeBinding(binding, index, schema) {
    const source = binding && typeof binding === "object" ? binding : {};
    const target = BINDING_TARGETS.includes(source.target) ? source.target : "text";
    const slots = target === "text" ? ["title", "subtitle", "label"] : target === "color" ? ["accent", "surface"] : target === "image" ? ["image"] : ["state"];
    return {
      id: safeId(source.id, `binding-${index + 1}`),
      path: cleanText(source.path || source.field || defaultField(schema, target, "value"), 200),
      target,
      slot: slots.includes(source.slot) ? source.slot : slots[0],
      direction: BINDING_DIRECTIONS.includes(source.direction) ? source.direction : "source"
    };
  }

  function sampleRecords() {
    return [
      { name: "Mai An", role: "Designer", team: "Brand", accent: "#67E8F9", image: "", status: "active", tags: ["identity", "campaign"], profile: { city: "Da Nang", memberSince: 2022 } },
      { name: "Bao Minh", role: "Developer", team: "Product", accent: "#F472B6", image: "", status: "review", tags: ["web", "motion"], profile: { city: "Ha Noi", memberSince: 2021 } },
      { name: "Lan Chi", role: "Designer", team: "Brand", accent: "#BEF264", image: "", status: "published", tags: ["social", "editorial"], profile: { city: "Ho Chi Minh City", memberSince: 2023 } },
      { name: "Quoc Huy", role: "Strategist", team: "Product", accent: "#FBBF24", image: "", status: "active", tags: ["research", "launch"], profile: { city: "Can Tho", memberSince: 2020 } }
    ];
  }

  function createDefaultProject() {
    const records = sampleRecords();
    const schema = inferSchema(records);
    return {
      format: FORMAT,
      version: VERSION,
      id: uid("dataset"),
      name: "Member campaign",
      updatedAt: new Date().toISOString(),
      templateId: "banner",
      records,
      schema,
      bindings: createDefaultBindings(schema)
    };
  }

  function normalizeProject(input) {
    const fallback = createDefaultProject();
    const source = input && typeof input === "object" ? input : {};
    let records;
    try {
      records = (Array.isArray(source.records) ? source.records : fallback.records).slice(0, MAX_RECORDS).map((record) => cleanJsonValue(record && typeof record === "object" && !Array.isArray(record) ? record : { value: record }, 0));
    } catch (_) {
      records = fallback.records;
    }
    const schema = inferSchema(records);
    const rawBindings = Array.isArray(source.bindings) ? source.bindings : createDefaultBindings(schema);
    return {
      format: FORMAT,
      version: VERSION,
      id: safeId(source.id, fallback.id),
      name: cleanText(source.name || fallback.name, 140),
      updatedAt: new Date().toISOString(),
      templateId: hasOwn(TEMPLATES, source.templateId) ? source.templateId : fallback.templateId,
      records,
      schema,
      bindings: rawBindings.slice(0, 24).map((binding, index) => normalizeBinding(binding, index, schema))
    };
  }

  function bindingValue(record, bindingInput, templateInput) {
    const template = typeof templateInput === "string" ? TEMPLATES[templateInput] : templateInput || TEMPLATES.banner;
    const binding = normalizeBinding(bindingInput, 0, []);
    const fallback = binding.target === "text" ? template[binding.slot === "label" ? "labelText" : binding.slot] : template[binding.slot];
    if (binding.direction === "target") return fallback == null ? "" : fallback;
    const raw = getValueAtPath(record, binding.path, fallback);
    if (binding.target === "color") return safeColor(raw, fallback);
    if (binding.target === "image") return safeImageUrl(raw);
    if (binding.target === "state") return safeId(valueText(raw), safeId(fallback, "default"));
    return cleanText(valueText(raw), MAX_CELL_LENGTH);
  }

  function coerceEditedValue(current, value) {
    if (Array.isArray(current)) {
      if (Array.isArray(value)) return value;
      const text = String(value || "").trim();
      if (text.startsWith("[")) {
        try {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) return parsed;
        } catch (_) { /* keep literal list input */ }
      }
      return text ? text.split(",").map((item) => cleanText(item.trim(), 1000)) : [];
    }
    if (typeof current === "number") {
      const number = Number(value);
      return Number.isFinite(number) ? number : current;
    }
    if (typeof current === "boolean") return value === true || String(value).toLowerCase() === "true";
    if (current && typeof current === "object") {
      try {
        const parsed = JSON.parse(String(value));
        return parsed && typeof parsed === "object" ? parsed : current;
      } catch (_) {
        return current;
      }
    }
    return cleanText(value, MAX_CELL_LENGTH);
  }

  function updateRecordFromBinding(record, bindingInput, value) {
    const binding = normalizeBinding(bindingInput, 0, []);
    if (binding.direction === "source") return { updated: false, record: clone(record), errors: [{ code: "read-only-binding", message: "Source bindings do not write back to the dataset." }] };
    let nextValue = coerceEditedValue(getValueAtPath(record, binding.path, ""), value);
    if (binding.target === "color") nextValue = safeColor(nextValue, "#67E8F9");
    if (binding.target === "image") nextValue = safeImageUrl(nextValue);
    if (binding.target === "state") nextValue = safeId(nextValue, "default");
    return { updated: true, record: setValueAtPath(record, binding.path, nextValue), errors: [] };
  }

  function materializeRecord(templateInput, record, bindingsInput, recordIndex) {
    const template = typeof templateInput === "string" ? TEMPLATES[templateInput] || TEMPLATES.banner : templateInput || TEMPLATES.banner;
    const model = {
      id: `${template.id}-${Number(recordIndex) || 0}`,
      templateId: template.id,
      recordIndex: Number(recordIndex) || 0,
      width: template.width,
      height: template.height,
      title: template.title,
      subtitle: template.subtitle,
      label: template.labelText,
      accent: template.accent,
      surface: template.surface,
      image: "",
      state: template.state
    };
    (bindingsInput || []).forEach((bindingInput, index) => {
      const binding = normalizeBinding(bindingInput, index, []);
      const value = bindingValue(record, binding, template);
      if (binding.target === "text") model[binding.slot] = value;
      else model[binding.slot] = value;
    });
    model.title = cleanText(model.title, 240);
    model.subtitle = cleanText(model.subtitle, 400);
    model.label = cleanText(model.label, 100);
    model.accent = safeColor(model.accent, template.accent);
    model.surface = safeColor(model.surface, template.surface);
    model.image = safeImageUrl(model.image);
    model.state = safeId(model.state, "default");
    return model;
  }

  function applyBindings(record, bindingsInput, templateInput, recordIndex) {
    return materializeRecord(templateInput || "banner", record, bindingsInput, recordIndex);
  }

  function writeBinding(record, bindingInput, value) {
    return updateRecordFromBinding(record, bindingInput, value).record;
  }

  function repeatRecords(templateInput, recordsInput, bindingsInput, options) {
    const records = Array.isArray(recordsInput) ? recordsInput : [];
    const limit = Math.min(records.length, Math.max(0, Number(options?.limit) || MAX_RECORDS), MAX_RECORDS);
    return records.slice(0, limit).map((record, index) => materializeRecord(templateInput, record, bindingsInput, index));
  }

  function repeatTemplate(templateInput, recordsInput, bindingsInput, options) {
    return repeatRecords(templateInput, recordsInput, bindingsInput, options);
  }

  function generateBatch(projectInput, options) {
    const project = normalizeProject(projectInput);
    const templateId = hasOwn(TEMPLATES, options?.templateId) ? options.templateId : project.templateId;
    return repeatRecords(TEMPLATES[templateId], project.records, project.bindings, options);
  }

  function validateDataset(recordsInput, schemaInput) {
    const records = Array.isArray(recordsInput) ? recordsInput : [];
    const schema = Array.isArray(schemaInput) && schemaInput.length ? schemaInput : inferSchema(records);
    const errors = [];
    const warnings = [];
    if (!records.length) errors.push({ code: "empty-dataset", message: "Dataset has no records." });
    if (records.length > MAX_RECORDS) errors.push({ code: "record-limit", message: `Dataset exceeds ${MAX_RECORDS} records.` });
    records.forEach((record, recordIndex) => {
      schema.forEach((field) => {
        const value = getValueAtPath(record, field.path, undefined);
        if (field.required && (value == null || value === "")) errors.push({ code: "required", recordIndex, path: field.path, message: `${field.path} is required.` });
        if (value != null && value !== "" && field.semantic === "color" && !isValidColor(value)) errors.push({ code: "invalid-color", recordIndex, path: field.path, message: `${field.path} is not a supported hex color.` });
        if (value != null && value !== "" && field.semantic === "image" && !safeImageUrl(value)) errors.push({ code: "invalid-image", recordIndex, path: field.path, message: `${field.path} is not a safe image URL.` });
      });
      const formulaPaths = [];
      walkFormulaValues(record, "", formulaPaths);
      formulaPaths.forEach((path) => warnings.push({ code: "formula-like", recordIndex, path, message: `${path || "value"} is literal text; formulas are never executed.` }));
    });
    return { valid: errors.length === 0, errors, warnings };
  }

  function validateProject(projectInput) {
    const project = normalizeProject(projectInput);
    const result = validateDataset(project.records, project.schema);
    project.bindings.forEach((binding) => {
      if (!project.schema.some((field) => field.path === binding.path)) result.warnings.push({ code: "missing-binding-field", bindingId: binding.id, path: binding.path, message: `Binding field ${binding.path} is missing.` });
    });
    result.valid = result.errors.length === 0;
    return result;
  }

  function generateManifest(projectInput, options) {
    const project = normalizeProject(projectInput);
    const templateIds = Array.isArray(options?.templateIds) ? options.templateIds.filter((id) => hasOwn(TEMPLATES, id)) : Object.keys(TEMPLATES);
    const items = [];
    templateIds.forEach((templateId) => {
      repeatRecords(TEMPLATES[templateId], project.records, project.bindings, options).forEach((model) => items.push(model));
    });
    return {
      format: FORMAT,
      version: VERSION,
      generatedAt: new Date().toISOString(),
      dataset: { id: project.id, name: project.name, recordCount: project.records.length, schema: project.schema },
      bindings: project.bindings,
      templates: templateIds.map((id) => clone(TEMPLATES[id])),
      items
    };
  }

  function exportManifest(projectInput, options) {
    return JSON.stringify(generateManifest(projectInput, options), null, 2);
  }

  function initials(value) {
    return cleanText(value, 100).trim().split(/\s+/).slice(0, 2).map((word) => word.charAt(0).toUpperCase()).join("") || "HH";
  }

  function previewMarkup(model) {
    const image = model.image ? `<img src="${escapeHtml(model.image)}" alt="${escapeHtml(model.title)}">` : `<span class="gdd-avatar" aria-hidden="true">${escapeHtml(initials(model.title))}</span>`;
    return `<article class="gdd-output gdd-output-${escapeHtml(model.templateId)}" data-state="${escapeHtml(model.state)}" style="--accent:${escapeHtml(model.accent)};--surface:${escapeHtml(model.surface)}"><div class="gdd-media">${image}</div><div class="gdd-copy"><span class="gdd-label">${escapeHtml(model.label)}</span><h2>${escapeHtml(model.title)}</h2><p>${escapeHtml(model.subtitle)}</p></div><span class="gdd-state">${escapeHtml(model.state)}</span></article>`;
  }

  function exportHTML(projectInput, options) {
    const project = normalizeProject(projectInput);
    const templateIds = Array.isArray(options?.templateIds) ? options.templateIds.filter((id) => hasOwn(TEMPLATES, id)) : Object.keys(TEMPLATES);
    const sections = templateIds.map((templateId) => {
      const items = repeatRecords(TEMPLATES[templateId], project.records, project.bindings, options);
      return `<section><h1>${escapeHtml(TEMPLATES[templateId].label)}</h1><div class="gdd-grid">${items.map(previewMarkup).join("")}</div></section>`;
    }).join("");
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(project.name)}</title><style>
*{box-sizing:border-box}body{margin:0;padding:24px;background:#0b0f14;color:#f8fafc;font:500 14px/1.45 system-ui,sans-serif}section{max-width:1280px;margin:0 auto 36px}h1{font-size:18px}.gdd-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:16px}.gdd-output{position:relative;display:grid;overflow:hidden;min-width:0;border:1px solid #334155;border-radius:8px;background:var(--surface);color:#f8fafc}.gdd-output-banner{grid-template-columns:34% 1fr;aspect-ratio:20/7}.gdd-output-member-card{grid-template-columns:38% 1fr;aspect-ratio:12/7}.gdd-output-thumbnail{aspect-ratio:16/9}.gdd-output-thumbnail .gdd-copy{position:absolute;inset:auto 0 0;padding:8%;background:rgba(3,7,18,.82)}.gdd-media{display:grid;place-items:center;min-height:0;background:var(--accent)}.gdd-media img{width:100%;height:100%;object-fit:cover}.gdd-avatar{font-size:clamp(28px,7vw,76px);font-weight:900;color:#071018}.gdd-copy{align-self:center;padding:8%}.gdd-label,.gdd-state{font-size:11px;text-transform:uppercase}.gdd-label{color:var(--accent);font-weight:800}.gdd-copy h2{margin:8px 0 4px;font-size:clamp(17px,3vw,34px);line-height:1.05}.gdd-copy p{margin:0;color:#cbd5e1}.gdd-state{position:absolute;top:10px;right:10px;padding:4px 7px;border:1px solid currentColor;border-radius:4px;background:#0b0f14;color:var(--accent)}@media(max-width:520px){body{padding:12px}.gdd-output-banner,.gdd-output-member-card{grid-template-columns:1fr;aspect-ratio:auto}.gdd-media{min-height:160px}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition-duration:.001ms!important}}
</style></head><body>${sections}</body></html>`;
  }

  function saveDataset(projectInput, storage) {
    const project = normalizeProject(projectInput);
    if (!storage || typeof storage.setItem !== "function") return { ok: false, reason: "unsupported", project };
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(project));
      return { ok: true, reason: "local", project };
    } catch (error) {
      return { ok: false, reason: "unavailable", message: cleanText(error.message, 160), project };
    }
  }

  function loadDataset(storage) {
    if (!storage || typeof storage.getItem !== "function") return null;
    try {
      const value = storage.getItem(STORAGE_KEY);
      if (!value) return null;
      const parsed = JSON.parse(value);
      if (!parsed || (parsed.format && parsed.format !== FORMAT)) return null;
      return normalizeProject(parsed);
    } catch (_) {
      return null;
    }
  }

  function detectCapabilities(scope, storage, doc) {
    const host = scope || {};
    return {
      fileImport: typeof host.FileReader === "function",
      localPersistence: !!storage && typeof storage.getItem === "function" && typeof storage.setItem === "function",
      download: !!doc && typeof host.Blob === "function" && !!host.URL && typeof host.URL.createObjectURL === "function",
      clipboard: !!host.navigator?.clipboard && typeof host.navigator.clipboard.writeText === "function"
    };
  }

  function injectStyles(doc) {
    if (!doc || doc.getElementById(STYLE_ID)) return;
    const style = doc.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      [data-graphic-data-driven]{--gdd-bg:#0b0f14;--gdd-panel:#111821;--gdd-line:#2d3a48;--gdd-text:#eef6ff;--gdd-muted:#91a2b4;--gdd-cyan:#67e8f9;--gdd-pink:#f472b6;--gdd-lime:#bef264;display:block;min-width:0;overflow:hidden;border:1px solid var(--gdd-line);border-radius:8px;background:var(--gdd-bg);color:var(--gdd-text);font:500 13px/1.45 Inter,system-ui,sans-serif}
      [data-graphic-data-driven] *{box-sizing:border-box;min-width:0}[data-graphic-data-driven] button,[data-graphic-data-driven] input,[data-graphic-data-driven] select,[data-graphic-data-driven] textarea{font:inherit}[data-graphic-data-driven] button{min-height:36px;border:1px solid #3a4b5d;border-radius:6px;background:#162231;color:var(--gdd-text);padding:7px 10px;cursor:pointer}[data-graphic-data-driven] button:hover{border-color:var(--gdd-cyan)}[data-graphic-data-driven] button:disabled{cursor:not-allowed;opacity:.45}[data-graphic-data-driven] button:focus-visible,[data-graphic-data-driven] input:focus-visible,[data-graphic-data-driven] select:focus-visible,[data-graphic-data-driven] textarea:focus-visible{outline:2px solid var(--gdd-cyan);outline-offset:2px}
      .gdd-shell{display:grid;grid-template-rows:auto 1fr auto;min-height:720px}.gdd-top{display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid var(--gdd-line);background:#101721}.gdd-brand{display:flex;align-items:center;gap:10px}.gdd-logo{display:grid;place-items:center;width:38px;height:38px;border:1px solid var(--gdd-cyan);border-radius:7px;color:var(--gdd-cyan);font-weight:900}.gdd-brand strong{display:block;font-size:16px}.gdd-brand small,.gdd-muted{color:var(--gdd-muted)}.gdd-actions{display:flex;flex-wrap:wrap;gap:7px;margin-left:auto}.gdd-primary{border-color:var(--gdd-lime)!important;background:var(--gdd-lime)!important;color:#10150b!important;font-weight:800}.gdd-layout{display:grid;grid-template-columns:310px minmax(360px,1fr) 290px;min-height:0}.gdd-panel{overflow:auto;padding:14px;border-right:1px solid var(--gdd-line);background:#0e141c}.gdd-panel:last-child{border-right:0;border-left:1px solid var(--gdd-line)}.gdd-section{padding:0 0 16px;margin:0 0 16px;border-bottom:1px solid var(--gdd-line)}.gdd-section:last-child{border-bottom:0}.gdd-heading{display:flex;align-items:center;gap:8px;margin-bottom:9px}.gdd-heading h2,.gdd-heading h3{margin:0;font-size:12px}.gdd-heading span{margin-left:auto;color:var(--gdd-muted);font-size:11px}.gdd-field{display:grid;gap:5px;margin-bottom:9px;color:var(--gdd-muted);font-size:11px}.gdd-field input,.gdd-field select,.gdd-field textarea{width:100%;min-height:36px;border:1px solid var(--gdd-line);border-radius:6px;background:#080d13;color:var(--gdd-text);padding:7px 8px}.gdd-field textarea{min-height:150px;resize:vertical;font:500 11px/1.5 ui-monospace,monospace}.gdd-row{display:flex;align-items:center;gap:7px}.gdd-row>*{flex:1}.gdd-file{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}
      .gdd-work{display:grid;grid-template-rows:auto auto 1fr;min-width:0;background:#0a1017}.gdd-template-tabs{display:flex;gap:7px;padding:10px 12px;overflow:auto;border-bottom:1px solid var(--gdd-line)}.gdd-template-tabs button[aria-selected=true]{border-color:var(--gdd-pink);background:#321d32;color:#ffd9ef}.gdd-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--gdd-line);border-bottom:1px solid var(--gdd-line)}.gdd-metric{padding:9px 11px;background:#101720}.gdd-metric strong{display:block;color:var(--gdd-cyan);font-size:15px}.gdd-metric span{color:var(--gdd-muted);font-size:10px}.gdd-preview-wrap{overflow:auto;padding:14px}.gdd-preview-grid{display:grid;grid-template-columns:repeat(2,minmax(250px,1fr));align-content:start;gap:12px}.gdd-preview-item{margin:0}.gdd-preview-item figcaption{display:flex;justify-content:space-between;margin:0 0 6px;color:var(--gdd-muted);font-size:10px}.gdd-preview-item .gdd-output{width:100%}.gdd-output{position:relative;display:grid;overflow:hidden;min-width:0;border:1px solid #405064;border-radius:8px;background:var(--surface);color:#f8fafc;container-type:inline-size}.gdd-output-banner{grid-template-columns:34% 1fr;aspect-ratio:20/7}.gdd-output-member-card{grid-template-columns:38% 1fr;aspect-ratio:12/7}.gdd-output-thumbnail{aspect-ratio:16/9}.gdd-output-thumbnail .gdd-copy{position:absolute;inset:auto 0 0;padding:7%;background:rgba(3,7,18,.84)}.gdd-media{display:grid;place-items:center;min-height:0;background:var(--accent)}.gdd-media img{width:100%;height:100%;object-fit:cover}.gdd-avatar{font-size:clamp(22px,10cqw,58px);font-weight:900;color:#071018}.gdd-copy{align-self:center;padding:8%;overflow:hidden}.gdd-label{display:block;color:var(--accent);font-size:9px;font-weight:900;text-transform:uppercase}.gdd-copy h2{overflow-wrap:anywhere;margin:6px 0 3px;font-size:clamp(15px,6cqw,30px);line-height:1.05;letter-spacing:0}.gdd-copy p{overflow-wrap:anywhere;margin:0;color:#cbd5e1;font-size:clamp(10px,3cqw,14px)}.gdd-state{position:absolute;top:7px;right:7px;padding:3px 5px;border:1px solid currentColor;border-radius:4px;background:#0b0f14;color:var(--accent);font-size:8px;text-transform:uppercase}
      .gdd-schema{display:grid;gap:5px;max-height:230px;overflow:auto}.gdd-schema-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:7px;border:1px solid var(--gdd-line);border-radius:6px;background:#101822}.gdd-schema-row strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gdd-schema-row span{color:var(--gdd-cyan);font-size:10px}.gdd-binding{padding:9px 0;border-bottom:1px solid var(--gdd-line)}.gdd-binding:last-child{border-bottom:0}.gdd-binding-head{display:flex;align-items:center;gap:7px;margin-bottom:7px}.gdd-binding-head strong{color:var(--gdd-pink);font-size:11px;text-transform:uppercase}.gdd-binding-head button{min-height:28px;margin-left:auto;padding:3px 7px}.gdd-issues{display:grid;gap:6px;max-height:180px;overflow:auto}.gdd-issue{padding:7px;border-left:3px solid var(--gdd-pink);background:#211620;color:#ffd7eb}.gdd-issue.warning{border-color:#fbbf24;background:#211d13;color:#fde68a}.gdd-empty{padding:12px;border:1px dashed var(--gdd-line);border-radius:6px;color:var(--gdd-muted);text-align:center}.gdd-footer{display:flex;align-items:center;gap:12px;padding:9px 14px;border-top:1px solid var(--gdd-line);color:var(--gdd-muted);font-size:11px}.gdd-footer span:last-child{margin-left:auto}.gdd-sr{position:absolute!important;width:1px!important;height:1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important}
      @media(max-width:1000px){.gdd-layout{grid-template-columns:270px 1fr}.gdd-panel:last-child{grid-column:1/-1;border-top:1px solid var(--gdd-line);border-left:0}.gdd-panel:last-child .gdd-section{display:inline-block;width:49%;vertical-align:top;padding-right:12px}}
      @media(max-width:720px){.gdd-shell{min-height:0}.gdd-top{align-items:flex-start;flex-wrap:wrap}.gdd-actions{width:100%;margin-left:0;overflow:auto;flex-wrap:nowrap}.gdd-layout{display:block}.gdd-panel,.gdd-panel:last-child{max-height:none;border:0;border-bottom:1px solid var(--gdd-line)}.gdd-panel:last-child .gdd-section{display:block;width:auto;padding-right:0}.gdd-preview-grid{grid-template-columns:1fr}.gdd-metrics{grid-template-columns:repeat(2,1fr)}}
      @media(max-width:420px){.gdd-top{padding:11px}.gdd-brand small{display:none}.gdd-panel,.gdd-preview-wrap{padding:10px}.gdd-template-tabs{padding:8px}.gdd-template-tabs button{flex:0 0 auto}.gdd-output-banner,.gdd-output-member-card{grid-template-columns:1fr;aspect-ratio:auto}.gdd-output-banner .gdd-media,.gdd-output-member-card .gdd-media{min-height:130px}.gdd-footer{align-items:flex-start;flex-direction:column}.gdd-footer span:last-child{margin-left:0}}
      @media(prefers-reduced-motion:reduce){[data-graphic-data-driven] *,[data-graphic-data-driven] *::before,[data-graphic-data-driven] *::after{animation-duration:.001ms!important;animation-iteration-count:1!important;scroll-behavior:auto!important;transition-duration:.001ms!important}}
    `;
    doc.head.appendChild(style);
  }

  function downloadText(scope, doc, filename, content, type) {
    if (!doc || typeof scope.Blob !== "function" || !scope.URL?.createObjectURL) return false;
    const blob = new scope.Blob([content], { type });
    const url = scope.URL.createObjectURL(blob);
    const anchor = doc.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    scope.setTimeout(() => scope.URL.revokeObjectURL(url), 0);
    return true;
  }

  function mount(target, options) {
    const doc = target?.ownerDocument || globalScope.document;
    if (!doc) return null;
    const root = typeof target === "string" ? doc.querySelector(target) : target || doc.querySelector("[data-graphic-data-driven]");
    if (!root) return null;
    if (mounted.has(root)) return mounted.get(root).api;
    injectStyles(doc);
    let storage = null;
    if (options && hasOwn(options, "storage")) storage = options.storage;
    else {
      try { storage = globalScope.localStorage; } catch (_) { storage = null; }
    }
    const capabilities = detectCapabilities(globalScope, storage, doc);
    let project = loadDataset(storage) || createDefaultProject();
    let selectedRecord = 0;
    let sourceFormat = "json";
    let sourceText = JSON.stringify(project.records, null, 2);
    let statusText = capabilities.localPersistence ? "Local dataset ready." : "Session only: localStorage unsupported or unavailable.";
    const listeners = [];

    const on = (node, type, handler) => {
      node.addEventListener(type, handler);
      listeners.push(() => node.removeEventListener(type, handler));
    };
    const status = (message) => {
      statusText = message;
      const live = root.querySelector("[data-gdd-live]");
      const visible = root.querySelector("[data-gdd-status]");
      if (live) live.textContent = message;
      if (visible) visible.textContent = message;
    };
    const persist = () => {
      project = normalizeProject(project);
      const result = saveDataset(project, storage);
      status(result.ok ? "Dataset saved locally." : "Session only: local persistence unsupported or unavailable.");
      return result;
    };
    const filename = (extension) => `${safeId(project.name, "data-driven")}.${extension}`;

    function schemaMarkup() {
      return project.schema.map((field) => `<div class="gdd-schema-row" title="${escapeHtml(field.path)}"><strong>${escapeHtml(field.path)}</strong><span>${escapeHtml(field.type)}${field.required ? " *" : ""}</span></div>`).join("") || `<div class="gdd-empty">No inferred fields</div>`;
    }

    function fieldOptions(selected) {
      return project.schema.map((field) => `<option value="${escapeHtml(field.path)}" ${field.path === selected ? "selected" : ""}>${escapeHtml(field.path)} - ${escapeHtml(field.type)}</option>`).join("");
    }

    function bindingMarkup() {
      return project.bindings.map((binding) => `<div class="gdd-binding" data-gdd-binding="${escapeHtml(binding.id)}"><div class="gdd-binding-head"><strong>${escapeHtml(binding.target)} / ${escapeHtml(binding.slot)}</strong><button type="button" data-gdd-remove-binding="${escapeHtml(binding.id)}" aria-label="Remove ${escapeHtml(binding.target)} binding">Remove</button></div><label class="gdd-field">Dataset field<select data-gdd-binding-path="${escapeHtml(binding.id)}">${fieldOptions(binding.path)}</select></label><label class="gdd-field">Direction<select data-gdd-binding-direction="${escapeHtml(binding.id)}">${BINDING_DIRECTIONS.map((direction) => `<option value="${direction}" ${direction === binding.direction ? "selected" : ""}>${direction}</option>`).join("")}</select></label></div>`).join("") || `<div class="gdd-empty">No bindings</div>`;
    }

    function editorMarkup() {
      const record = project.records[selectedRecord] || {};
      return project.bindings.map((binding) => {
        const value = getValueAtPath(record, binding.path, "");
        const disabled = binding.direction === "source" ? "disabled" : "";
        const type = binding.target === "color" ? "color" : "text";
        const inputValue = binding.target === "color" ? safeColor(value, "#67E8F9") : valueText(value);
        return `<label class="gdd-field">${escapeHtml(binding.slot)} <span class="gdd-muted">${escapeHtml(binding.path)}</span><input type="${type}" value="${escapeHtml(inputValue)}" data-gdd-edit="${escapeHtml(binding.id)}" ${disabled}></label>`;
      }).join("") || `<div class="gdd-empty">Add a binding to edit this record.</div>`;
    }

    function issueMarkup(validation) {
      const issues = validation.errors.concat(validation.warnings).slice(0, 40);
      if (!issues.length) return `<div class="gdd-empty">Dataset valid</div>`;
      return issues.map((issue) => `<div class="gdd-issue ${validation.warnings.includes(issue) ? "warning" : ""}">${escapeHtml(issue.message)}</div>`).join("");
    }

    function previewGrid() {
      const models = generateBatch(project, { templateId: project.templateId, limit: 50 });
      if (!models.length) return `<div class="gdd-empty">No records to preview</div>`;
      return models.map((model) => `<figure class="gdd-preview-item"><figcaption><span>Record ${model.recordIndex + 1}</span><span>${model.width} x ${model.height}</span></figcaption>${previewMarkup(model)}</figure>`).join("");
    }

    function render() {
      selectedRecord = Math.max(0, Math.min(selectedRecord, project.records.length - 1));
      const validation = validateProject(project);
      const capabilityText = [capabilities.fileImport ? "File import" : "File import unsupported", capabilities.localPersistence ? "localStorage" : "localStorage unsupported", capabilities.download ? "Download" : "Download unsupported"].join(" | ");
      root.setAttribute("data-graphic-data-driven", "");
      root.innerHTML = `<div class="gdd-shell"><header class="gdd-top"><div class="gdd-brand"><span class="gdd-logo">DD</span><span><strong>Data-driven Design</strong><small>${escapeHtml(capabilityText)}</small></span></div><div class="gdd-actions"><button type="button" data-gdd-action="import" ${capabilities.fileImport ? "" : "disabled"}>Import file</button><button type="button" data-gdd-action="copy-manifest">Copy manifest</button><button type="button" data-gdd-action="export-manifest" ${capabilities.download ? "" : "disabled"}>Manifest</button><button class="gdd-primary" type="button" data-gdd-action="export-html" ${capabilities.download ? "" : "disabled"}>HTML</button></div><input class="gdd-file" type="file" accept=".csv,.json,text/csv,application/json" data-gdd-file ${capabilities.fileImport ? "" : "disabled"}><span class="gdd-sr" aria-live="polite" data-gdd-live></span></header><main class="gdd-layout"><aside class="gdd-panel" aria-label="Dataset"><section class="gdd-section"><div class="gdd-heading"><h2>Dataset</h2><span>${project.records.length} records</span></div><label class="gdd-field">Format<select data-gdd-format><option value="json" ${sourceFormat === "json" ? "selected" : ""}>JSON</option><option value="csv" ${sourceFormat === "csv" ? "selected" : ""}>CSV</option></select></label><label class="gdd-field">Source<textarea spellcheck="false" data-gdd-source>${escapeHtml(sourceText)}</textarea></label><button type="button" data-gdd-action="parse">Parse dataset</button></section><section class="gdd-section"><div class="gdd-heading"><h2>Schema</h2><span>${project.schema.length} fields</span></div><div class="gdd-schema" data-gdd-schema>${schemaMarkup()}</div></section></aside><section class="gdd-work" aria-label="Batch preview"><div class="gdd-template-tabs" role="tablist" aria-label="Preview template">${Object.values(TEMPLATES).map((template) => `<button type="button" role="tab" aria-selected="${template.id === project.templateId}" tabindex="${template.id === project.templateId ? "0" : "-1"}" data-gdd-template="${template.id}">${escapeHtml(template.label)}</button>`).join("")}</div><div class="gdd-metrics"><div class="gdd-metric"><strong>${project.records.length}</strong><span>Records</span></div><div class="gdd-metric"><strong>${project.schema.length}</strong><span>Fields</span></div><div class="gdd-metric"><strong>${project.bindings.length}</strong><span>Bindings</span></div><div class="gdd-metric"><strong>${validation.errors.length}</strong><span>Errors</span></div></div><div class="gdd-preview-wrap"><div class="gdd-preview-grid" data-gdd-preview>${previewGrid()}</div></div></section><aside class="gdd-panel" aria-label="Bindings and validation"><section class="gdd-section"><div class="gdd-heading"><h2>Bindings</h2><button type="button" data-gdd-action="add-binding">Add</button></div><div data-gdd-bindings>${bindingMarkup()}</div></section><section class="gdd-section"><div class="gdd-heading"><h2>Record editor</h2><span>${project.records.length ? `${selectedRecord + 1}/${project.records.length}` : "0/0"}</span></div><label class="gdd-field">Record<select data-gdd-record>${project.records.map((_, index) => `<option value="${index}" ${index === selectedRecord ? "selected" : ""}>Record ${index + 1}</option>`).join("")}</select></label><div data-gdd-editor>${editorMarkup()}</div></section><section class="gdd-section"><div class="gdd-heading"><h2>Validation</h2><span>${validation.valid ? "Valid" : "Needs attention"}</span></div><div class="gdd-issues" data-gdd-issues>${issueMarkup(validation)}</div></section></aside></main><footer class="gdd-footer"><span>Local-first | no formula runtime</span><span>${escapeHtml(FORMAT)} v${VERSION}</span><span role="status" data-gdd-status>${escapeHtml(statusText)}</span></footer></div>`;
    }

    function applyParsed(result) {
      if (!result.valid) {
        status(result.errors[0]?.message || "Dataset could not be parsed.");
        return false;
      }
      project.records = result.records;
      project.schema = result.schema;
      project.bindings = createDefaultBindings(result.schema);
      selectedRecord = 0;
      project = normalizeProject(project);
      persist();
      render();
      status(`Loaded ${project.records.length} records. ${result.warnings.length} warning(s).`);
      return true;
    }

    function addBinding() {
      const target = BINDING_TARGETS[project.bindings.length % BINDING_TARGETS.length];
      const binding = normalizeBinding({ id: uid("binding"), target, path: defaultField(project.schema, target), direction: "bidirectional" }, project.bindings.length, project.schema);
      project.bindings.push(binding);
      persist();
      render();
      root.querySelector(`[data-gdd-binding-path="${binding.id}"]`)?.focus();
    }

    async function copyManifest() {
      if (!capabilities.clipboard) return status("Clipboard unsupported. Manifest export remains available when downloads are supported.");
      try {
        await globalScope.navigator.clipboard.writeText(exportManifest(project));
        status("Manifest copied.");
      } catch (_) {
        status("Clipboard permission was denied.");
      }
    }

    on(root, "click", (event) => {
      const targetNode = event.target.closest("button");
      if (!targetNode || !root.contains(targetNode)) return;
      if (targetNode.dataset.gddTemplate) {
        project.templateId = targetNode.dataset.gddTemplate;
        persist();
        render();
        root.querySelector(`[data-gdd-template="${project.templateId}"]`)?.focus();
        return;
      }
      if (targetNode.dataset.gddRemoveBinding) {
        project.bindings = project.bindings.filter((binding) => binding.id !== targetNode.dataset.gddRemoveBinding);
        persist();
        render();
        return;
      }
      const action = targetNode.dataset.gddAction;
      if (action === "import") root.querySelector("[data-gdd-file]")?.click();
      else if (action === "parse") {
        sourceText = root.querySelector("[data-gdd-source]")?.value || "";
        sourceFormat = root.querySelector("[data-gdd-format]")?.value || "json";
        applyParsed(parseDataset(sourceText, sourceFormat));
      } else if (action === "add-binding") addBinding();
      else if (action === "copy-manifest") copyManifest();
      else if (action === "export-manifest") {
        if (downloadText(globalScope, doc, filename("manifest.json"), exportManifest(project), "application/json")) status("Manifest downloaded.");
        else status("Download unsupported in this browser.");
      } else if (action === "export-html") {
        if (downloadText(globalScope, doc, filename("html"), exportHTML(project), "text/html")) status("Generated HTML downloaded.");
        else status("Download unsupported in this browser.");
      }
    });

    on(root, "change", (event) => {
      const node = event.target;
      if (node.matches("[data-gdd-format]")) {
        sourceFormat = node.value;
        return;
      }
      if (node.matches("[data-gdd-record]")) {
        selectedRecord = Number(node.value) || 0;
        render();
        return;
      }
      if (node.dataset.gddBindingPath || node.dataset.gddBindingDirection) {
        const id = node.dataset.gddBindingPath || node.dataset.gddBindingDirection;
        const binding = project.bindings.find((item) => item.id === id);
        if (binding) {
          if (node.dataset.gddBindingPath) binding.path = node.value;
          else binding.direction = node.value;
          persist();
          render();
        }
        return;
      }
      if (node.dataset.gddEdit) {
        const binding = project.bindings.find((item) => item.id === node.dataset.gddEdit);
        if (binding && project.records[selectedRecord]) {
          const result = updateRecordFromBinding(project.records[selectedRecord], binding, node.value);
          if (!result.updated) return status(result.errors[0].message);
          project.records[selectedRecord] = result.record;
          project.schema = inferSchema(project.records);
          sourceFormat = "json";
          sourceText = JSON.stringify(project.records, null, 2);
          persist();
          render();
        }
        return;
      }
      if (node.matches("[data-gdd-file]")) {
        const file = node.files?.[0];
        if (!file) return;
        if (!capabilities.fileImport) return status("File import unsupported in this browser.");
        const reader = new globalScope.FileReader();
        reader.onload = () => {
          sourceText = String(reader.result || "");
          sourceFormat = /\.csv$/i.test(file.name) || file.type === "text/csv" ? "csv" : "json";
          applyParsed(parseDataset(sourceText, sourceFormat));
        };
        reader.onerror = () => status("The selected file could not be read locally.");
        reader.readAsText(file);
        node.value = "";
      }
    });

    on(root, "input", (event) => {
      if (event.target.matches("[data-gdd-source]")) sourceText = event.target.value;
    });

    on(root, "keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && event.target.matches("[data-gdd-source]")) {
        event.preventDefault();
        sourceText = event.target.value;
        applyParsed(parseDataset(sourceText, sourceFormat));
        return;
      }
      const tab = event.target.closest("[data-gdd-template]");
      if (tab && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        const ids = Object.keys(TEMPLATES);
        const current = ids.indexOf(tab.dataset.gddTemplate);
        const next = event.key === "Home" ? 0 : event.key === "End" ? ids.length - 1 : (current + (event.key === "ArrowRight" ? 1 : -1) + ids.length) % ids.length;
        project.templateId = ids[next];
        persist();
        render();
        root.querySelector(`[data-gdd-template="${project.templateId}"]`)?.focus();
      }
    });

    render();
    const api = {
      getProject: () => clone(project),
      setProject(next) { project = normalizeProject(next); selectedRecord = 0; sourceFormat = "json"; sourceText = JSON.stringify(project.records, null, 2); persist(); render(); return clone(project); },
      parse(text, format) { const result = parseDataset(text, format); if (result.valid) applyParsed(result); return result; },
      validate: () => validateProject(project),
      generate: (templateId) => generateBatch(project, { templateId }),
      exportManifest: (settings) => exportManifest(project, settings),
      exportHTML: (settings) => exportHTML(project, settings)
    };
    mounted.set(root, { api, cleanup: () => listeners.splice(0).forEach((off) => off()) });
    return api;
  }

  function unmount(target) {
    const root = typeof target === "string" ? globalScope.document?.querySelector(target) : target;
    const instance = root && mounted.get(root);
    if (!instance) return false;
    instance.cleanup();
    mounted.delete(root);
    root.removeAttribute("data-graphic-data-driven");
    root.innerHTML = "";
    return true;
  }

  const api = Object.freeze({
    VERSION, FORMAT, STORAGE_KEY, MAX_RECORDS, BINDING_TARGETS, BINDING_DIRECTIONS, TEMPLATES,
    escapeHtml, safeColor, safeImageUrl, parseCSV, parseCsv: parseCSV, parseJSON, parseJson: parseJSON, parseDataset,
    inferSchema, getValueAtPath, setValueAtPath, createDefaultBindings, createDefaultProject, normalizeProject,
    bindingValue, updateRecordFromBinding, writeBinding, materializeRecord, applyBindings, repeatRecords, repeatTemplate, generateBatch, validateDataset, validateProject,
    generateManifest, exportManifest, exportHTML, saveDataset, loadDataset, detectCapabilities, mount, unmount
  });
  globalScope.HHGraphicDataDriven = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
