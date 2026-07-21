(function (globalScope) {
  "use strict";

  const VERSION = 1;
  const STORAGE_KEY = "hh.dev.diagnostics-ai.v1";
  const MAX_HISTORY = 40;
  const MAX_TIMELINE = 80;
  const MAX_ASSETS = 30;
  const instances = new WeakMap();

  const TOOLS = Object.freeze([
    { id: "web-diagnostics", label: "Web Diagnostics", description: "Kiểm tra hiệu năng, bảo mật, asset và lỗi ngay trên thiết bị." },
    { id: "ai-developer", label: "AI Developer Assistant", description: "Giải thích, sinh bản nháp và review code theo quy trình không ghi đè." }
  ]);

  const AI_MODES = Object.freeze([
    { id: "explain", label: "Giải thích", hint: "Lỗi, regex, SQL hoặc stack trace" },
    { id: "test", label: "Sinh unit test", hint: "Tạo bộ test khởi đầu" },
    { id: "mock", label: "Sinh mock data", hint: "Tạo dữ liệu mẫu từ JSON hoặc mô tả" },
    { id: "docs", label: "Viết tài liệu API", hint: "Tạo tài liệu endpoint có cấu trúc" },
    { id: "review", label: "Review diff/code", hint: "Phát hiện rủi ro và đề xuất bản vá" }
  ]);

  const SECRET_KEY_RE = /(?:api[_-]?key|secret|token|password|passwd|authorization|private[_-]?key|client[_-]?secret|connection[_-]?string)/i;
  const SECRET_TEXT_RULES = Object.freeze([
    [/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, "Bearer [REDACTED]"],
    [/\b(?:sk|pk|rk)-[A-Za-z0-9_-]{12,}\b/g, "[REDACTED_KEY]"],
    [/\bAIza[0-9A-Za-z_-]{20,}\b/g, "[REDACTED_GOOGLE_KEY]"],
    [/\bAQ\.[0-9A-Za-z_-]{12,}\b/g, "[REDACTED_TOKEN]"],
    [/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[REDACTED_JWT]"],
    [/((?:api[_-]?key|secret|token|password|passwd|authorization|client[_-]?secret)\s*[:=]\s*)[^\s,;]+/gi, "$1[REDACTED]"],
    [/(mongodb(?:\+srv)?:\/\/[^:\s/@]+:)[^@\s/]+@/gi, "$1[REDACTED]@"],
    [/(https?:\/\/[^:\s/@]+:)[^@\s/]+@/gi, "$1[REDACTED]@"]
  ]);

  function clone(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
  }

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function clamp(value, min, max, fallback) {
    const number = Number(value);
    return Math.min(max, Math.max(min, Number.isFinite(number) ? number : fallback));
  }

  function safeText(value, maxLength) {
    return String(value == null ? "" : value)
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
      .slice(0, maxLength || 12000);
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function redactText(value) {
    let output = safeText(value, 30000);
    SECRET_TEXT_RULES.forEach(([pattern, replacement]) => {
      output = output.replace(pattern, replacement);
    });
    return output;
  }

  function sanitizePayload(value, depth, seen) {
    const level = Number(depth) || 0;
    if (level > 7) return "[TRUNCATED]";
    if (value == null || typeof value === "number" || typeof value === "boolean") return value;
    if (typeof value === "string") return redactText(value);
    if (typeof value === "function" || typeof value === "symbol") return undefined;
    const references = seen || new WeakSet();
    if (typeof value === "object") {
      if (references.has(value)) return "[CIRCULAR]";
      references.add(value);
    }
    if (Array.isArray(value)) {
      return value.slice(0, 200).map((item) => sanitizePayload(item, level + 1, references));
    }
    const result = {};
    Object.keys(value).slice(0, 160).forEach((key) => {
      if (SECRET_KEY_RE.test(key)) {
        result[safeText(key, 80)] = "[REDACTED]";
        return;
      }
      const sanitized = sanitizePayload(value[key], level + 1, references);
      if (sanitized !== undefined) result[safeText(key, 80)] = sanitized;
    });
    return result;
  }

  function formatBytes(value) {
    const bytes = Math.max(0, Number(value) || 0);
    if (bytes < 1024) return `${bytes} B`;
    const units = ["KB", "MB", "GB"];
    let size = bytes / 1024;
    let unit = units[0];
    for (let index = 1; index < units.length && size >= 1024; index += 1) {
      size /= 1024;
      unit = units[index];
    }
    return `${size >= 100 ? size.toFixed(0) : size.toFixed(1)} ${unit}`;
  }

  function normalizeToolId(value) {
    return TOOLS.some((tool) => tool.id === value) ? value : "web-diagnostics";
  }

  function normalizeUrl(value, baseUrl) {
    const raw = safeText(value, 2048).trim();
    if (!raw) return { valid: false, input: raw, error: "Hãy nhập một URL." };
    try {
      const url = new URL(raw, baseUrl || "https://example.invalid/");
      if (!/^https?:$/.test(url.protocol)) throw new Error("Chỉ hỗ trợ HTTP hoặc HTTPS.");
      const base = baseUrl ? new URL(baseUrl) : null;
      return {
        valid: true,
        input: raw,
        href: url.href,
        origin: url.origin,
        host: url.host,
        protocol: url.protocol,
        pathname: url.pathname,
        secure: url.protocol === "https:",
        sameOrigin: Boolean(base && base.origin === url.origin),
        local: /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(url.host)
      };
    } catch (error) {
      return { valid: false, input: raw, error: safeText(error.message || "URL không hợp lệ.", 200) };
    }
  }

  function headersToObject(headersInput) {
    if (!headersInput) return null;
    const result = {};
    if (typeof headersInput.forEach === "function") {
      headersInput.forEach((value, key) => { result[String(key).toLowerCase()] = safeText(value, 4000); });
      return result;
    }
    Object.entries(headersInput).forEach(([key, value]) => {
      result[String(key).toLowerCase()] = safeText(Array.isArray(value) ? value.join(", ") : value, 4000);
    });
    return result;
  }

  function parseCsp(value) {
    const text = safeText(value, 12000).trim();
    const directives = {};
    if (text) {
      text.split(";").map((item) => item.trim()).filter(Boolean).forEach((item) => {
        const [name, ...tokens] = item.split(/\s+/);
        directives[name.toLowerCase()] = tokens;
      });
    }
    const warnings = [];
    if (!text) warnings.push("Không đọc thấy Content-Security-Policy trong tập header đang truy cập được.");
    if (text && !directives["default-src"]) warnings.push("Thiếu default-src.");
    if (text && !directives["object-src"]) warnings.push("Nên đặt object-src 'none'.");
    if (text && !directives["base-uri"]) warnings.push("Nên giới hạn base-uri.");
    const script = directives["script-src"] || directives["default-src"] || [];
    if (script.includes("'unsafe-eval'")) warnings.push("script-src cho phép unsafe-eval.");
    if (script.includes("*")) warnings.push("script-src đang dùng wildcard.");
    return { raw: text, directives, warnings, available: Boolean(text) };
  }

  function inspectCookieString(cookieString) {
    const text = safeText(cookieString, 12000).trim();
    const visible = text ? text.split(/;\s*/).filter(Boolean).map((item) => {
      const separator = item.indexOf("=");
      return { name: separator >= 0 ? item.slice(0, separator) : item, valueLength: separator >= 0 ? item.slice(separator + 1).length : 0 };
    }) : [];
    return {
      visible,
      count: visible.length,
      scope: "document-cookie-only",
      complete: false,
      note: "Trình duyệt không cho JavaScript đọc cookie HttpOnly; thuộc tính Secure, SameSite và thời hạn cũng không có trong document.cookie."
    };
  }

  function inspectHeaders(headersInput, contextInput) {
    const headers = headersToObject(headersInput);
    const context = contextInput || {};
    const visibility = headers ? "accessible-response-headers" : "unavailable";
    const checks = [
      ["content-security-policy", "Content Security Policy"],
      ["strict-transport-security", "HSTS"],
      ["x-content-type-options", "MIME sniffing protection"],
      ["referrer-policy", "Referrer Policy"],
      ["permissions-policy", "Permissions Policy"],
      ["cross-origin-opener-policy", "Cross-Origin Opener Policy"]
    ].map(([name, label]) => ({ name, label, present: Boolean(headers && headers[name]), value: headers && headers[name] || "" }));
    const cors = headers ? {
      readable: true,
      allowOrigin: headers["access-control-allow-origin"] || "",
      allowCredentials: headers["access-control-allow-credentials"] || "",
      note: context.crossOrigin
        ? "Chỉ các header được máy chủ cho phép qua CORS mới xuất hiện ở đây."
        : "Kết quả dựa trên các header mà fetch cung cấp cho trang hiện tại."
    } : {
      readable: false,
      allowOrigin: "",
      allowCredentials: "",
      note: context.fetchError
        ? "Không thể đọc response. Nguyên nhân có thể là CORS, mạng, chứng chỉ hoặc máy chủ từ chối HEAD; trình duyệt không tiết lộ thêm chi tiết."
        : "Chưa có response header để phân tích."
    };
    return {
      visibility,
      complete: false,
      headers: headers || {},
      checks,
      csp: parseCsp(headers && headers["content-security-policy"]),
      cors,
      note: "Đây không phải bản chụp toàn bộ header phía máy chủ; JavaScript chỉ thấy tập header được trình duyệt cho phép."
    };
  }

  function scoreChecklist(items) {
    const scored = items.filter((item) => item.status !== "info");
    if (!scored.length) return 0;
    const points = scored.reduce((sum, item) => sum + (item.status === "pass" ? 1 : item.status === "warn" ? 0.45 : 0), 0);
    return Math.round(points / scored.length * 100);
  }

  function runLocalChecklist(factsInput) {
    const facts = factsInput || {};
    const url = normalizeUrl(facts.url || "https://example.invalid", facts.baseUrl);
    const item = (id, category, label, status, detail) => ({ id, category, label, status, detail });
    const items = [
      item("https", "Security", "Kết nối HTTPS", url.valid && url.secure ? "pass" : "fail", url.valid ? url.protocol : url.error),
      item("title", "SEO", "Tiêu đề trang", facts.title && facts.title.length <= 65 ? "pass" : facts.title ? "warn" : "fail", facts.title ? `${facts.title.length} ký tự` : "Chưa có title"),
      item("description", "SEO", "Meta description", facts.description && facts.description.length >= 50 && facts.description.length <= 170 ? "pass" : "warn", facts.description ? `${facts.description.length} ký tự` : "Chưa có description"),
      item("language", "Accessibility", "Ngôn ngữ tài liệu", facts.lang ? "pass" : "warn", facts.lang || "Thiếu thuộc tính lang"),
      item("viewport", "Responsive", "Viewport mobile", facts.viewportMeta ? "pass" : "fail", facts.viewportMeta ? "Đã khai báo" : "Thiếu meta viewport"),
      item("headings", "Accessibility", "Một H1 chính", Number(facts.h1Count) === 1 ? "pass" : "warn", `${Number(facts.h1Count) || 0} thẻ H1`),
      item("images", "Accessibility", "Văn bản thay thế ảnh", Number(facts.imageAltMissing) === 0 ? "pass" : "warn", `${Number(facts.imageAltMissing) || 0}/${Number(facts.imageCount) || 0} ảnh thiếu alt`),
      item("labels", "Accessibility", "Tên điều khiển biểu mẫu", Number(facts.labelMissing) === 0 ? "pass" : "warn", `${Number(facts.labelMissing) || 0} điều khiển thiếu tên`),
      item("canonical", "SEO", "Canonical URL", facts.canonical ? "pass" : "info", facts.canonical || "Không bắt buộc cho mọi trang"),
      item("manifest", "PWA", "Web App Manifest", facts.manifest ? "pass" : "info", facts.manifest ? "Đã liên kết" : "Chưa phát hiện"),
      item("service-worker", "PWA", "Service Worker", facts.serviceWorker ? "pass" : "info", facts.serviceWorker ? "Đã đăng ký" : "Chưa xác nhận"),
      item("dom-size", "Performance", "Quy mô DOM", Number(facts.domNodes) <= 1500 ? "pass" : Number(facts.domNodes) <= 3000 ? "warn" : "fail", `${Number(facts.domNodes) || 0} node`)
    ];
    return { score: scoreChecklist(items), items, measuredAt: new Date().toISOString(), source: "local-lighthouse-style", lighthouse: false };
  }

  function collectDocumentFacts(doc, scope) {
    if (!doc || typeof doc.querySelectorAll !== "function") return {};
    const root = scope && typeof scope.querySelectorAll === "function" ? scope : doc;
    const controls = Array.from(root.querySelectorAll("input,select,textarea,button"));
    const labelMissing = controls.filter((control) => {
      if (control.type === "hidden") return false;
      return !control.getAttribute("aria-label") && !control.getAttribute("aria-labelledby") && !(control.id && doc.querySelector(`label[for="${String(control.id).replace(/"/g, "\\\"")}"]`)) && !control.closest("label") && !safeText(control.textContent, 200).trim();
    }).length;
    const images = Array.from(root.querySelectorAll("img"));
    return {
      url: doc.location && doc.location.href || "",
      title: doc.title || "",
      description: doc.querySelector('meta[name="description"]')?.content || "",
      lang: doc.documentElement && doc.documentElement.lang || "",
      viewportMeta: Boolean(doc.querySelector('meta[name="viewport"]')),
      h1Count: root.querySelectorAll("h1").length,
      imageCount: images.length,
      imageAltMissing: images.filter((image) => !image.hasAttribute("alt")).length,
      labelMissing,
      canonical: doc.querySelector('link[rel="canonical"]')?.href || "",
      manifest: Boolean(doc.querySelector('link[rel="manifest"]')),
      serviceWorker: Boolean(globalScope.navigator && globalScope.navigator.serviceWorker && globalScope.navigator.serviceWorker.controller),
      domNodes: root.querySelectorAll("*").length
    };
  }

  function detectAssetKind(nameInput, typeInput) {
    const name = safeText(nameInput, 300).toLowerCase();
    const type = safeText(typeInput, 120).toLowerCase();
    if (type.startsWith("image/") || /\.(png|jpe?g|gif|webp|avif|svg)$/.test(name)) return "image";
    if (/\.json$/.test(name) || type.includes("json")) return "json";
    if (/\.css$/.test(name) || type.includes("css")) return "css";
    if (/\.(?:m?js|cjs|ts|tsx|jsx)$/.test(name) || /javascript|typescript/.test(type)) return "script";
    if (/\.html?$/.test(name) || type.includes("html")) return "html";
    return "file";
  }

  function analyzeTextAsset(textInput, metaInput) {
    const text = safeText(textInput, 5_000_000);
    const meta = metaInput || {};
    const lines = text.split(/\r?\n/);
    const imports = Array.from(text.matchAll(/(?:from\s+|require\s*\(|import\s*\()["']([^"']+)/g)).map((match) => match[1]);
    const urls = Array.from(text.matchAll(/https?:\/\/[^\s"'<>]+/g)).map((match) => match[0]).slice(0, 50);
    const warnings = [];
    if (/\beval\s*\(|\bnew\s+Function\s*\(/.test(text)) warnings.push("Phát hiện thực thi mã động; cần review CSP và nguồn dữ liệu.");
    if (/\bdocument\.write\s*\(/.test(text)) warnings.push("document.write có thể chặn render và tạo rủi ro injection.");
    if (/\b(?:TODO|FIXME|HACK)\b/.test(text)) warnings.push("Tệp còn TODO/FIXME/HACK.");
    if (SECRET_TEXT_RULES.some(([pattern]) => { pattern.lastIndex = 0; return pattern.test(text); })) warnings.push("Có chuỗi giống secret; không chia sẻ tệp trước khi kiểm tra.");
    const nonEmpty = lines.filter((line) => line.trim());
    const minified = lines.length <= 5 && text.length > 5000 || nonEmpty.some((line) => line.length > 1500);
    return {
      name: safeText(meta.name || "untitled", 300),
      kind: detectAssetKind(meta.name, meta.type),
      size: Number(meta.size) || new TextEncoder().encode(text).length,
      lines: lines.length,
      characters: text.length,
      imports: Array.from(new Set(imports)).slice(0, 100),
      externalUrls: Array.from(new Set(urls)),
      minified,
      sourceMapHint: /sourceMappingURL=/.test(text),
      consoleCalls: (text.match(/\bconsole\.(?:log|warn|error|debug)\s*\(/g) || []).length,
      warnings,
      estimateOnly: true,
      compressionNote: "Kích thước nén không được đo nếu chưa chạy encoder; số liệu hiện tại là byte tệp đầu vào."
    };
  }

  function analyzeAsset(assetInput) {
    const asset = assetInput || {};
    const kind = detectAssetKind(asset.name, asset.type);
    if (typeof asset.text === "string" && kind !== "image") return analyzeTextAsset(asset.text, asset);
    const size = Number(asset.size) || 0;
    const warnings = [];
    if (kind === "image" && size > 500 * 1024) warnings.push("Ảnh lớn hơn 500 KB; cân nhắc WebP/AVIF và responsive srcset.");
    if (kind === "image" && asset.width && asset.height && asset.displayWidth && asset.width > asset.displayWidth * 2.5) warnings.push("Kích thước pixel lớn hơn đáng kể vùng hiển thị.");
    return {
      name: safeText(asset.name || "untitled", 300), kind, size,
      width: Number(asset.width) || 0, height: Number(asset.height) || 0,
      warnings, estimateOnly: false
    };
  }

  function analyzePackageJson(input) {
    let pkg;
    try { pkg = typeof input === "string" ? JSON.parse(input) : clone(input); } catch (error) {
      return { valid: false, error: `package.json không hợp lệ: ${safeText(error.message, 180)}`, dependencies: [], warnings: [] };
    }
    if (!pkg || typeof pkg !== "object" || Array.isArray(pkg)) return { valid: false, error: "package.json phải là object.", dependencies: [], warnings: [] };
    const production = pkg.dependencies && typeof pkg.dependencies === "object" ? pkg.dependencies : {};
    const development = pkg.devDependencies && typeof pkg.devDependencies === "object" ? pkg.devDependencies : {};
    const optional = pkg.optionalDependencies && typeof pkg.optionalDependencies === "object" ? pkg.optionalDependencies : {};
    const names = new Set([...Object.keys(production), ...Object.keys(development), ...Object.keys(optional)]);
    const dependencies = Array.from(names).sort().map((name) => ({
      name,
      version: safeText(production[name] || development[name] || optional[name], 120),
      scope: production[name] ? "production" : development[name] ? "development" : "optional",
      duplicated: Boolean(production[name] && development[name])
    }));
    const warnings = [];
    dependencies.filter((entry) => entry.duplicated).forEach((entry) => warnings.push(`${entry.name} xuất hiện ở cả dependencies và devDependencies.`));
    const scripts = pkg.scripts && typeof pkg.scripts === "object" ? pkg.scripts : {};
    ["preinstall", "install", "postinstall"].forEach((name) => { if (scripts[name]) warnings.push(`Có lifecycle script ${name}; hãy review trước khi cài dependency không tin cậy.`); });
    if (!pkg.engines) warnings.push("Chưa khóa phiên bản runtime trong engines.");
    return {
      valid: true,
      name: safeText(pkg.name || "unnamed-package", 200),
      packageManager: safeText(pkg.packageManager || "", 120),
      dependencies,
      totals: {
        all: dependencies.length,
        production: Object.keys(production).length,
        development: Object.keys(development).length,
        optional: Object.keys(optional).length
      },
      warnings,
      registryChecked: false,
      note: "Không truy vấn registry nên không tuyên bố dependency đã mới nhất hoặc không có lỗ hổng."
    };
  }

  function performanceRating(name, value) {
    const thresholds = {
      LCP: [2500, 4000], CLS: [0.1, 0.25], INP: [200, 500], FCP: [1800, 3000], TTFB: [800, 1800]
    };
    const pair = thresholds[name];
    if (!pair || !Number.isFinite(Number(value))) return "unknown";
    return value <= pair[0] ? "good" : value <= pair[1] ? "needs-improvement" : "poor";
  }

  function normalizeMetric(name, value, source) {
    const rounded = name === "CLS" ? Math.round(Number(value) * 1000) / 1000 : Math.round(Number(value));
    return { name, value: rounded, rating: performanceRating(name, rounded), source: source || "PerformanceObserver", at: new Date().toISOString() };
  }

  function createPerformanceMonitor(optionsInput) {
    const options = optionsInput || {};
    const scope = options.scope || globalScope;
    const metrics = {};
    const observers = [];
    const emit = (name, value, source) => {
      const metric = normalizeMetric(name, value, source);
      metrics[name] = metric;
      if (typeof options.onMetric === "function") options.onMetric(clone(metric));
    };
    const PerformanceObserverCtor = scope.PerformanceObserver;
    const supported = PerformanceObserverCtor && Array.isArray(PerformanceObserverCtor.supportedEntryTypes)
      ? PerformanceObserverCtor.supportedEntryTypes : [];
    function observe(type, callback, buffered) {
      if (!PerformanceObserverCtor || !supported.includes(type)) return false;
      try {
        const observer = new PerformanceObserverCtor((list) => callback(list.getEntries()));
        observer.observe({ type, buffered: buffered !== false });
        observers.push(observer);
        return true;
      } catch (_) { return false; }
    }
    let cls = 0;
    observe("largest-contentful-paint", (entries) => { const last = entries[entries.length - 1]; if (last) emit("LCP", last.startTime, "largest-contentful-paint"); });
    observe("layout-shift", (entries) => { entries.forEach((entry) => { if (!entry.hadRecentInput) cls += entry.value; }); emit("CLS", cls, "layout-shift"); });
    observe("event", (entries) => { const values = entries.map((entry) => entry.duration).filter(Number.isFinite); if (values.length) emit("INP", Math.max(...values), "event-timing"); });
    observe("paint", (entries) => { const fcp = entries.find((entry) => entry.name === "first-contentful-paint"); if (fcp) emit("FCP", fcp.startTime, "paint"); });
    const navigation = scope.performance && typeof scope.performance.getEntriesByType === "function" ? scope.performance.getEntriesByType("navigation")[0] : null;
    if (navigation) emit("TTFB", navigation.responseStart, "navigation-timing");
    return {
      supported: { observer: Boolean(PerformanceObserverCtor), entryTypes: supported.slice(), webVitals: supported.some((type) => ["largest-contentful-paint", "layout-shift", "event", "paint"].includes(type)) },
      getMetrics: () => clone(metrics),
      stop() { observers.forEach((observer) => observer.disconnect()); observers.length = 0; }
    };
  }

  function timelineEntry(type, label, detail, status, duration) {
    return {
      id: uid("event"),
      at: new Date().toISOString(),
      type: safeText(type || "info", 40),
      label: redactText(label || "Sự kiện"),
      detail: redactText(detail || ""),
      status: safeText(status || "info", 30),
      duration: Number.isFinite(Number(duration)) ? Math.max(0, Math.round(Number(duration))) : null
    };
  }

  function detectDeveloperInput(input) {
    const text = safeText(input, 30000).trim();
    if (!text) return "empty";
    if (/^\/.*\/[dgimsuvy]*$/s.test(text)) return "regex";
    if (/^(?:SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH)\b/i.test(text)) return "sql";
    if (/\bat\s+[\w$.<>]+\s*\([^\n]+:\d+:\d+\)|^[A-Za-z]*Error:/m.test(text)) return "stack";
    try { JSON.parse(text); return "json"; } catch (_) { /* Continue detection. */ }
    if (/\b(?:TypeError|ReferenceError|SyntaxError|Error|exception|failed|undefined|null)\b/i.test(text)) return "error";
    return "code";
  }

  function explainRegex(input) {
    const text = safeText(input, 8000).trim();
    const literal = text.match(/^\/(.*)\/([dgimsuvy]*)$/s);
    const pattern = literal ? literal[1] : text;
    const flags = literal ? literal[2] : "";
    const notes = [];
    if (/\^/.test(pattern)) notes.push("^ neo kết quả ở đầu chuỗi hoặc đầu dòng khi dùng cờ m.");
    if (/\$/.test(pattern)) notes.push("$ neo kết quả ở cuối chuỗi hoặc cuối dòng khi dùng cờ m.");
    if (/\\[dws]/i.test(pattern)) notes.push("Có lớp ký tự rút gọn như chữ số, khoảng trắng hoặc ký tự từ.");
    if (/\[[^\]]+\]/.test(pattern)) notes.push("Có lớp ký tự tùy chỉnh trong dấu [].");
    if (/\([^?][^)]*\)/.test(pattern)) notes.push("Có nhóm bắt; kết quả có thể được dùng khi replace.");
    if (/\(\?[=!<]/.test(pattern)) notes.push("Có lookaround; hãy kiểm tra engine đích có hỗ trợ.");
    if (/[+*?]|\{\d+(?:,\d*)?\}/.test(pattern)) notes.push("Có lượng từ điều khiển số lần lặp.");
    return { kind: "regex", summary: `Regex dài ${pattern.length} ký tự${flags ? `, cờ ${flags}` : ""}.`, notes: notes.length ? notes : ["Biểu thức dùng các ký tự literal đơn giản."], warning: "Giải thích dựa trên cú pháp JavaScript; PCRE và RE2 có thể khác." };
  }

  function explainSql(input) {
    const text = safeText(input, 20000).trim();
    const command = (text.match(/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH)/i) || ["", "UNKNOWN"])[1].toUpperCase();
    const tables = Array.from(text.matchAll(/\b(?:FROM|JOIN|INTO|UPDATE|TABLE)\s+([`"\[]?[\w.-]+[`"\]]?)/gi)).map((match) => match[1]);
    const warnings = [];
    if (/\b(?:UPDATE|DELETE)\b/i.test(command) && !/\bWHERE\b/i.test(text)) warnings.push("Câu lệnh thay đổi dữ liệu không có WHERE.");
    if (/\bDROP\b|\bTRUNCATE\b/i.test(text)) warnings.push("Có thao tác phá hủy schema hoặc dữ liệu.");
    if (/SELECT\s+\*/i.test(text)) warnings.push("SELECT * có thể đọc nhiều cột hơn cần thiết.");
    return { kind: "sql", summary: `Lệnh ${command}; ${new Set(tables).size} bảng được nhận diện.`, notes: [`Bảng: ${Array.from(new Set(tables)).join(", ") || "chưa nhận diện"}.`], warning: warnings.join(" ") || "Hãy chạy EXPLAIN trên database thật trước khi tối ưu." };
  }

  function explainStack(input) {
    const text = redactText(input);
    const lines = text.split(/\r?\n/).filter(Boolean);
    const frames = lines.filter((line) => /\bat\s+|:\d+:\d+/.test(line)).slice(0, 12);
    const headline = lines.find((line) => /(?:Error|Exception|failed)/i.test(line)) || lines[0] || "Lỗi chưa xác định";
    return { kind: "stack", summary: headline, notes: frames.length ? [`${frames.length} frame được nhận diện.`, `Frame gần nhất: ${frames[0].trim()}`] : ["Chưa nhận diện frame có file và dòng."], warning: "Đường dẫn, token và credential giống secret đã được che trước khi lưu." };
  }

  function reviewCode(input) {
    const text = safeText(input, 50000);
    const lines = text.split(/\r?\n/);
    const rules = [
      ["dynamic-code", /\beval\s*\(|\bnew\s+Function\s*\(/, "high", "Tránh thực thi chuỗi như mã."],
      ["unsafe-html", /\.innerHTML\s*=|insertAdjacentHTML\s*\(/, "medium", "Escape dữ liệu người dùng hoặc dùng DOM API an toàn."],
      ["document-write", /document\.write\s*\(/, "medium", "document.write có thể chặn render."],
      ["debug-log", /console\.(?:log|debug)\s*\(/, "low", "Xem lại log debug trước khi phát hành."],
      ["todo", /\b(?:TODO|FIXME|HACK)\b/, "low", "Còn ghi chú kỹ thuật cần xử lý."],
      ["secret", /(?:AIza|AQ\.|\bsk-)[A-Za-z0-9_-]{10,}/, "high", "Có chuỗi giống API key hoặc token."],
      ["empty-catch", /catch\s*\([^)]*\)\s*\{\s*\}/, "medium", "Catch rỗng làm mất thông tin lỗi."]
    ];
    const findings = [];
    lines.forEach((line, index) => rules.forEach(([code, pattern, severity, message]) => {
      pattern.lastIndex = 0;
      if (pattern.test(line)) findings.push({ code, severity, line: index + 1, message, excerpt: redactText(line.trim()).slice(0, 180) });
    }));
    return findings.slice(0, 80);
  }

  function mockFromValue(value, depth) {
    if ((depth || 0) > 5) return null;
    if (Array.isArray(value)) return value.slice(0, 3).map((item) => mockFromValue(item, (depth || 0) + 1));
    if (value && typeof value === "object") {
      const result = {};
      Object.keys(value).slice(0, 30).forEach((key) => { result[key] = mockFromValue(value[key], (depth || 0) + 1); });
      return result;
    }
    if (typeof value === "number") return value || 42;
    if (typeof value === "boolean") return true;
    if (value == null) return null;
    const text = String(value);
    if (/email/i.test(text)) return "developer@example.com";
    if (/date|time/i.test(text)) return "2026-01-15T09:30:00.000Z";
    return text || "Dữ liệu mẫu HH";
  }

  function buildLinePreview(beforeInput, afterInput) {
    const before = safeText(beforeInput, 50000).split(/\r?\n/);
    const after = safeText(afterInput, 50000).split(/\r?\n/);
    const max = Math.max(before.length, after.length);
    const lines = [];
    for (let index = 0; index < max && lines.length < 300; index += 1) {
      if (before[index] === after[index]) {
        if (before[index] !== undefined) lines.push({ type: "context", line: before[index] });
      } else {
        if (before[index] !== undefined) lines.push({ type: "remove", line: before[index] });
        if (after[index] !== undefined) lines.push({ type: "add", line: after[index] });
      }
    }
    return lines;
  }

  function createLocalAIDraft(modeInput, inputValue, contextInput) {
    const mode = AI_MODES.some((item) => item.id === modeInput) ? modeInput : "explain";
    const input = redactText(inputValue);
    const context = sanitizePayload(contextInput || {});
    const kind = detectDeveloperInput(input);
    let title = "Phân tích cục bộ";
    let summary = "Bản nháp được tạo bằng quy tắc tất định trên thiết bị.";
    let sections = [];
    let replacement = "";
    if (mode === "explain") {
      const report = kind === "regex" ? explainRegex(input) : kind === "sql" ? explainSql(input) : explainStack(input);
      title = kind === "regex" ? "Giải thích Regex" : kind === "sql" ? "Giải thích SQL" : "Giải thích lỗi và stack";
      summary = report.summary;
      sections = [{ heading: "Nhận định", items: report.notes }, { heading: "Lưu ý", items: [report.warning] }];
    }
    if (mode === "test") {
      const functionName = (input.match(/(?:function\s+|const\s+|let\s+|var\s+)([A-Za-z_$][\w$]*)/) || ["", "subject"])[1];
      replacement = `const test = require("node:test");\nconst assert = require("node:assert/strict");\n\ntest("${functionName} handles the expected case", () => {\n  // Arrange\n  const input = {};\n\n  // Act\n  const result = ${functionName}(input);\n\n  // Assert\n  assert.ok(result);\n});\n`;
      title = "Bản nháp unit test";
      summary = `Khung test Node cho ${functionName}; cần bổ sung dữ liệu biên theo contract thật.`;
      sections = [{ heading: "Checklist", items: ["Happy path", "Dữ liệu rỗng", "Giới hạn đầu vào", "Nhánh lỗi"] }];
    }
    if (mode === "mock") {
      let source;
      try { source = JSON.parse(input); } catch (_) { source = { id: 1, name: input || "HH Developer", active: true }; }
      replacement = JSON.stringify(mockFromValue(source, 0), null, 2);
      title = "Mock data cục bộ";
      summary = "Dữ liệu mẫu giữ cấu trúc đầu vào và không gọi dịch vụ bên ngoài.";
      sections = [{ heading: "Giới hạn", items: ["Không suy luận schema nghiệp vụ", "Cần thay dữ liệu mẫu trước production"] }];
    }
    if (mode === "docs") {
      const endpoint = (input.match(/(?:GET|POST|PUT|PATCH|DELETE)\s+(\/[^\s]+)/i) || ["", "/api/resource"])[1];
      replacement = `# API: ${endpoint}\n\n## Mục đích\nMô tả chức năng endpoint.\n\n## Xác thực\nBearer token phía server. Không đặt secret trong client.\n\n## Request\n\`\`\`json\n{}\n\`\`\`\n\n## Response 200\n\`\`\`json\n{ "ok": true }\n\`\`\`\n\n## Lỗi\n- 400: Dữ liệu không hợp lệ\n- 401: Chưa xác thực\n- 429: Vượt giới hạn\n- 500: Lỗi máy chủ\n`;
      title = "Bản nháp tài liệu API";
      summary = `Tài liệu khởi đầu cho ${endpoint}.`;
      sections = [{ heading: "Cần xác nhận", items: ["Schema thật", "Quyền truy cập", "Rate limit", "Ví dụ lỗi"] }];
    }
    if (mode === "review") {
      const findings = reviewCode(input);
      title = "Code review cục bộ";
      summary = findings.length ? `Phát hiện ${findings.length} điểm cần xem xét.` : "Không phát hiện mẫu rủi ro trong bộ quy tắc cục bộ.";
      sections = [{ heading: "Findings", items: findings.length ? findings.map((finding) => `[${finding.severity}] Dòng ${finding.line}: ${finding.message}`) : ["Không có finding tĩnh; vẫn cần chạy test và review theo ngữ cảnh."] }];
    }
    return {
      id: uid("draft"),
      mode, kind, title, summary, sections,
      replacement,
      preview: replacement ? buildLinePreview(input, replacement) : [],
      source: "local-deterministic",
      sourceLabel: "Phân tích cục bộ tất định",
      status: "draft",
      overwrite: false,
      applied: false,
      inputExcerpt: input.slice(0, 1000),
      context,
      createdAt: new Date().toISOString()
    };
  }

  function normalizeServerDraft(value, request) {
    const safe = sanitizePayload(value && typeof value === "object" ? value : { summary: safeText(value, 12000) });
    return {
      id: uid("draft"),
      mode: request.mode,
      kind: detectDeveloperInput(request.input),
      title: safeText(safe.title || "Bản nháp từ AI server", 240),
      summary: safeText(safe.summary || safe.text || "Máy chủ đã trả về một bản nháp.", 12000),
      sections: Array.isArray(safe.sections) ? safe.sections.slice(0, 20) : [],
      replacement: safeText(safe.replacement || safe.code || "", 50000),
      preview: buildLinePreview(request.input, safe.replacement || safe.code || ""),
      source: "server-adapter",
      sourceLabel: "AI qua backend /api/ai/dev",
      status: "draft",
      overwrite: false,
      applied: false,
      inputExcerpt: redactText(request.input).slice(0, 1000),
      createdAt: new Date().toISOString()
    };
  }

  async function requestServerDraft(requestInput, optionsInput) {
    const options = optionsInput || {};
    const request = sanitizePayload({
      mode: AI_MODES.some((item) => item.id === requestInput.mode) ? requestInput.mode : "explain",
      input: redactText(requestInput.input),
      context: sanitizePayload(requestInput.context || {}),
      policy: { overwrite: false, returnDraftOnly: true }
    });
    let responseValue;
    if (typeof options.adapter === "function") {
      responseValue = await options.adapter(clone(request));
    } else {
      const fetchImpl = options.fetch || globalScope.fetch;
      if (typeof fetchImpl !== "function") throw new Error("Trình duyệt không hỗ trợ fetch và chưa có adapter.");
      const endpoint = safeText(options.endpoint || "/api/ai/dev", 500);
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(request)
      });
      if (!response.ok) throw new Error(`AI backend trả về HTTP ${response.status}.`);
      responseValue = await response.json();
    }
    return normalizeServerDraft(responseValue, request);
  }

  function applyDraft(draftInput, optionsInput) {
    const draft = clone(draftInput);
    const options = optionsInput || {};
    if (!options.explicit) throw new Error("Cần hành động Apply rõ ràng từ người dùng.");
    if (!draft || draft.status !== "draft") throw new Error("Bản nháp không hợp lệ.");
    if (typeof options.onApply === "function") options.onApply(clone(draft));
    draft.applied = true;
    draft.appliedAt = new Date().toISOString();
    return draft;
  }

  function defaultState(toolId) {
    return {
      version: VERSION,
      activeTool: normalizeToolId(toolId),
      diagnostics: {
        activeTab: "overview", url: "", report: null, headers: null,
        assets: [], packageReport: null, metrics: {}, timeline: []
      },
      ai: { mode: "explain", input: "", drafts: [], history: [], useServer: false },
      updatedAt: new Date().toISOString()
    };
  }

  function normalizeState(input, toolId) {
    const fallback = defaultState(toolId);
    const source = input && typeof input === "object" ? sanitizePayload(input) : {};
    const diagnostics = source.diagnostics && typeof source.diagnostics === "object" ? source.diagnostics : {};
    const ai = source.ai && typeof source.ai === "object" ? source.ai : {};
    return {
      version: VERSION,
      activeTool: normalizeToolId(toolId || source.activeTool),
      diagnostics: {
        activeTab: ["overview", "security", "assets", "performance", "timeline"].includes(diagnostics.activeTab) ? diagnostics.activeTab : "overview",
        url: safeText(diagnostics.url || "", 2048),
        report: diagnostics.report || null,
        headers: diagnostics.headers || null,
        assets: Array.isArray(diagnostics.assets) ? diagnostics.assets.slice(0, MAX_ASSETS) : [],
        packageReport: diagnostics.packageReport || null,
        metrics: diagnostics.metrics && typeof diagnostics.metrics === "object" ? diagnostics.metrics : {},
        timeline: Array.isArray(diagnostics.timeline) ? diagnostics.timeline.slice(0, MAX_TIMELINE) : []
      },
      ai: {
        mode: AI_MODES.some((item) => item.id === ai.mode) ? ai.mode : "explain",
        input: redactText(ai.input || ""),
        drafts: Array.isArray(ai.drafts) ? ai.drafts.slice(0, MAX_HISTORY).map((item) => sanitizePayload(item)) : [],
        history: Array.isArray(ai.history) ? ai.history.slice(0, MAX_HISTORY).map((item) => sanitizePayload(item)) : [],
        useServer: Boolean(ai.useServer)
      },
      updatedAt: safeText(source.updatedAt || fallback.updatedAt, 60)
    };
  }

  function serializeState(stateInput) {
    const state = normalizeState(stateInput, stateInput && stateInput.activeTool);
    state.updatedAt = new Date().toISOString();
    return JSON.stringify(sanitizePayload(state));
  }

  function statusLabel(status) {
    return status === "pass" ? "Đạt" : status === "warn" ? "Cần xem" : status === "fail" ? "Lỗi" : "Thông tin";
  }

  function metricCard(metric) {
    const unit = metric.name === "CLS" ? "" : " ms";
    return `<article class="hddiag-metric is-${escapeHtml(metric.rating)}"><span>${escapeHtml(metric.name)}</span><strong>${escapeHtml(metric.value)}${unit}</strong><small>${escapeHtml(metric.rating)}</small></article>`;
  }

  function diagnosticTemplate(state) {
    const diagnostic = state.diagnostics;
    const tabs = [
      ["overview", "Tổng quan"], ["security", "Network & Security"], ["assets", "Assets"],
      ["performance", "Performance"], ["timeline", "Timeline"]
    ].map(([id, label]) => `<button type="button" role="tab" aria-selected="${diagnostic.activeTab === id}" class="${diagnostic.activeTab === id ? "is-active" : ""}" data-hddiag-tab="${id}">${label}</button>`).join("");
    let body = "";
    if (diagnostic.activeTab === "overview") {
      const report = diagnostic.report;
      body = `<div class="hddiag-grid hddiag-grid-overview"><section class="hddiag-card hddiag-score-card"><div class="hddiag-score-ring" style="--score:${report ? report.score : 0}"><strong>${report ? report.score : "--"}</strong><span>/100</span></div><div><span class="hddiag-eyebrow">LOCAL CHECKLIST</span><h3>Kiểm tra trang hiện tại</h3><p>Checklist lấy dữ liệu DOM đang mở. Đây không phải điểm Lighthouse chính thức.</p><button type="button" class="is-primary" data-hddiag-action="scan-current">Quét trang hiện tại</button></div></section><section class="hddiag-card"><span class="hddiag-eyebrow">QUICK INSPECT</span><h3>URL và response</h3><div class="hddiag-input-row"><input type="url" data-hddiag-url value="${escapeHtml(diagnostic.url)}" placeholder="https://example.com" aria-label="URL cần kiểm tra"><button type="button" data-hddiag-action="inspect-url">Kiểm tra</button></div><p class="hddiag-note">Cross-origin chỉ hiển thị header được CORS cho phép. Lỗi fetch không đồng nghĩa website bị sập.</p></section></div>${report ? `<section class="hddiag-checklist">${report.items.map((item) => `<article class="hddiag-check is-${item.status}"><span aria-hidden="true"></span><div><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.category)} · ${escapeHtml(item.detail)}</small></div><em>${statusLabel(item.status)}</em></article>`).join("")}</section>` : `<div class="hddiag-empty"><strong>Chưa có báo cáo</strong><span>Quét trang hiện tại để bắt đầu.</span></div>`}`;
    }
    if (diagnostic.activeTab === "security") {
      const headers = diagnostic.headers;
      body = `<div class="hddiag-grid"><section class="hddiag-card"><span class="hddiag-eyebrow">CORS-AWARE INSPECTOR</span><h3>Header trình duyệt cho phép đọc</h3>${headers ? `<p class="hddiag-truth ${headers.cors.readable ? "is-ok" : "is-warn"}">${escapeHtml(headers.cors.note)}</p><div class="hddiag-security-list">${headers.checks.map((check) => `<div><span>${escapeHtml(check.label)}</span><strong class="${check.present ? "is-good" : "is-muted"}">${check.present ? "Có" : "Chưa đọc thấy"}</strong></div>`).join("")}</div>` : `<div class="hddiag-empty"><strong>Chưa có header</strong><span>Nhập URL ở tab Tổng quan.</span></div>`}</section><section class="hddiag-card"><span class="hddiag-eyebrow">CONTENT SECURITY POLICY</span><h3>CSP Builder Review</h3>${headers ? `<div class="hddiag-code-list">${Object.entries(headers.csp.directives).map(([name, values]) => `<div><code>${escapeHtml(name)}</code><span>${escapeHtml(values.join(" ") || "(rỗng)")}</span></div>`).join("") || "<p>Không đọc thấy CSP.</p>"}</div>${headers.csp.warnings.map((warning) => `<p class="hddiag-warning">${escapeHtml(warning)}</p>`).join("")}` : "<p class=\"hddiag-note\">CSP sẽ xuất hiện khi response header có thể đọc được.</p>"}</section></div>`;
    }
    if (diagnostic.activeTab === "assets") {
      body = `<section class="hddiag-dropzone" data-hddiag-drop tabindex="0"><div class="hddiag-drop-icon" aria-hidden="true">+</div><strong>Thả asset hoặc package.json</strong><span>JS, CSS, HTML, JSON và ảnh. Phân tích diễn ra trên thiết bị.</span><button type="button" data-hddiag-action="pick-files">Chọn tệp</button></section><input hidden multiple type="file" data-hddiag-files accept=".js,.mjs,.cjs,.ts,.tsx,.jsx,.css,.html,.json,image/*"><div class="hddiag-grid">${diagnostic.packageReport ? `<section class="hddiag-card"><span class="hddiag-eyebrow">DEPENDENCY SCAN</span><h3>${escapeHtml(diagnostic.packageReport.name || "package.json")}</h3><div class="hddiag-stat-row"><div><strong>${diagnostic.packageReport.totals.all}</strong><span>Tổng gói</span></div><div><strong>${diagnostic.packageReport.totals.production}</strong><span>Production</span></div><div><strong>${diagnostic.packageReport.totals.development}</strong><span>Dev</span></div></div><p class="hddiag-note">${escapeHtml(diagnostic.packageReport.note)}</p>${diagnostic.packageReport.warnings.map((warning) => `<p class="hddiag-warning">${escapeHtml(warning)}</p>`).join("")}</section>` : ""}<section class="hddiag-card"><span class="hddiag-eyebrow">ASSET ANALYZER</span><h3>${diagnostic.assets.length} tệp gần nhất</h3><div class="hddiag-asset-list">${diagnostic.assets.map((asset) => `<article><div class="hddiag-file-type">${escapeHtml(asset.kind.slice(0, 3).toUpperCase())}</div><div><strong>${escapeHtml(asset.name)}</strong><small>${formatBytes(asset.size)}${asset.lines ? ` · ${asset.lines} dòng` : ""}</small></div><span>${asset.warnings.length ? `${asset.warnings.length} cảnh báo` : "Ổn"}</span></article>`).join("") || "<p class=\"hddiag-note\">Chưa có asset.</p>"}</div></section></div>`;
    }
    if (diagnostic.activeTab === "performance") {
      const metrics = Object.values(diagnostic.metrics);
      body = `<section class="hddiag-card hddiag-performance-head"><div><span class="hddiag-eyebrow">CORE WEB VITALS</span><h3>Đo phiên đang mở</h3><p>PerformanceObserver chỉ cung cấp metric mà trình duyệt hỗ trợ. Kết quả thay đổi theo thiết bị và tương tác.</p></div><button type="button" class="is-primary" data-hddiag-action="start-performance">Bắt đầu đo</button></section><div class="hddiag-metrics">${metrics.length ? metrics.map(metricCard).join("") : `<div class="hddiag-empty"><strong>Chưa có metric</strong><span>Bấm Bắt đầu đo rồi sử dụng trang bình thường.</span></div>`}</div>`;
    }
    if (diagnostic.activeTab === "timeline") {
      body = `<section class="hddiag-card"><div class="hddiag-section-head"><div><span class="hddiag-eyebrow">REQUEST & ERROR TIMELINE</span><h3>Dòng sự kiện phiên làm việc</h3></div><button type="button" data-hddiag-action="clear-timeline">Dọn timeline</button></div><div class="hddiag-timeline">${diagnostic.timeline.map((event) => `<article class="is-${escapeHtml(event.status)}"><span class="hddiag-timeline-dot"></span><div><strong>${escapeHtml(event.label)}</strong><p>${escapeHtml(event.detail)}</p><small>${new Date(event.at).toLocaleTimeString("vi-VN")}${event.duration != null ? ` · ${event.duration} ms` : ""}</small></div></article>`).join("") || `<div class="hddiag-empty"><strong>Timeline đang trống</strong><span>Lỗi JavaScript và request từ inspector sẽ xuất hiện tại đây.</span></div>`}</div></section>`;
    }
    return `<div class="hddiag-workspace"><nav class="hddiag-tabs" role="tablist" aria-label="Khu vực Web Diagnostics">${tabs}</nav><main class="hddiag-panel">${body}</main></div>`;
  }

  function draftTemplate(draft) {
    if (!draft) return `<div class="hddiag-empty hddiag-ai-empty"><strong>Chưa có bản nháp</strong><span>Chọn chế độ, nhập dữ liệu và chạy phân tích.</span></div>`;
    const sections = Array.isArray(draft.sections) ? draft.sections.map((section) => `<section><h4>${escapeHtml(section.heading)}</h4><ul>${(section.items || []).map((item) => `<li>${escapeHtml(typeof item === "string" ? item : JSON.stringify(item))}</li>`).join("")}</ul></section>`).join("") : "";
    const preview = draft.preview && draft.preview.length ? `<div class="hddiag-diff" aria-label="Bản xem trước thay đổi">${draft.preview.map((line) => `<div class="is-${line.type}"><span>${line.type === "add" ? "+" : line.type === "remove" ? "−" : " "}</span><code>${escapeHtml(line.line)}</code></div>`).join("")}</div>` : "";
    return `<article class="hddiag-ai-draft"><header><div><span class="hddiag-source is-${draft.source}">${escapeHtml(draft.sourceLabel)}</span><h3>${escapeHtml(draft.title)}</h3></div><time>${new Date(draft.createdAt).toLocaleTimeString("vi-VN")}</time></header><p>${escapeHtml(draft.summary)}</p>${sections}${preview}<footer><button type="button" data-hddiag-action="copy-draft">Sao chép</button>${draft.replacement ? `<button type="button" class="is-primary" data-hddiag-action="apply-draft">Apply vào ô nhập</button>` : ""}</footer><small class="hddiag-truth">Không tự ghi đè. Apply chỉ chạy sau thao tác bấm rõ ràng.</small></article>`;
  }

  function aiTemplate(state) {
    const ai = state.ai;
    const activeDraft = ai.drafts[0];
    return `<div class="hddiag-ai-layout"><aside class="hddiag-ai-modes" aria-label="Chế độ trợ lý">${AI_MODES.map((mode) => `<button type="button" class="${ai.mode === mode.id ? "is-active" : ""}" data-hddiag-ai-mode="${mode.id}"><strong>${mode.label}</strong><span>${mode.hint}</span></button>`).join("")}</aside><main class="hddiag-ai-main"><section class="hddiag-card hddiag-ai-input"><div class="hddiag-section-head"><div><span class="hddiag-eyebrow">DRAFT-FIRST ASSISTANT</span><h3>${escapeHtml(AI_MODES.find((mode) => mode.id === ai.mode).label)}</h3></div><label class="hddiag-switch"><input type="checkbox" data-hddiag-server ${ai.useServer ? "checked" : ""}><span>Dùng backend AI</span></label></div><textarea data-hddiag-ai-input spellcheck="false" placeholder="Dán lỗi, regex, SQL, stack trace hoặc code...">${escapeHtml(ai.input)}</textarea><div class="hddiag-ai-actions"><button type="button" class="is-primary" data-hddiag-action="run-ai">${ai.useServer ? "Tạo draft qua server" : "Phân tích cục bộ"}</button><button type="button" data-hddiag-action="clear-ai">Xóa input</button><span>Secret được che trước khi lưu hoặc gửi backend.</span></div></section><section class="hddiag-ai-output">${draftTemplate(activeDraft)}</section></main><aside class="hddiag-ai-history"><span class="hddiag-eyebrow">HISTORY</span><h3>${ai.history.length} phiên gần đây</h3>${ai.history.map((entry) => `<button type="button" data-hddiag-history="${escapeHtml(entry.id)}"><strong>${escapeHtml(entry.title)}</strong><span>${escapeHtml(entry.sourceLabel)}</span><time>${new Date(entry.createdAt).toLocaleDateString("vi-VN")}</time></button>`).join("") || `<p class="hddiag-note">Lịch sử đã che token và giới hạn ${MAX_HISTORY} mục.</p>`}</aside></div>`;
  }

  function shellTemplate(state) {
    const current = TOOLS.find((tool) => tool.id === state.activeTool);
    return `<section class="hddiag-shell" data-tool="${state.activeTool}"><header class="hddiag-header"><div class="hddiag-brand" aria-hidden="true">${state.activeTool === "web-diagnostics" ? "DX" : "AI"}</div><div><span class="hddiag-eyebrow">HH DEVELOPER WORKSPACE</span><h2>${escapeHtml(current.label)}</h2><p>${escapeHtml(current.description)}</p></div><nav aria-label="Chuyển công cụ"><button type="button" data-hddiag-tool="web-diagnostics" class="${state.activeTool === "web-diagnostics" ? "is-active" : ""}">Diagnostics</button><button type="button" data-hddiag-tool="ai-developer" class="${state.activeTool === "ai-developer" ? "is-active" : ""}">AI Developer</button></nav></header>${state.activeTool === "web-diagnostics" ? diagnosticTemplate(state) : aiTemplate(state)}<footer class="hddiag-status" role="status" aria-live="polite" data-hddiag-status>Sẵn sàng · dữ liệu nhạy cảm không được lưu nguyên bản.</footer></section>`;
  }

  async function copyText(doc, value) {
    const text = safeText(value, 100000);
    if (globalScope.navigator && globalScope.navigator.clipboard && typeof globalScope.navigator.clipboard.writeText === "function") {
      await globalScope.navigator.clipboard.writeText(text);
      return true;
    }
    const area = doc.createElement("textarea");
    area.value = text; area.style.position = "fixed"; area.style.opacity = "0";
    doc.body.appendChild(area); area.select();
    const copied = doc.execCommand && doc.execCommand("copy");
    area.remove(); return Boolean(copied);
  }

  async function inspectRemoteUrl(value, optionsInput) {
    const options = optionsInput || {};
    const baseUrl = options.baseUrl || (globalScope.location && globalScope.location.href);
    const parsed = normalizeUrl(value, baseUrl);
    if (!parsed.valid) return { ok: false, url: parsed, error: parsed.error, headers: inspectHeaders(null, {}) };
    const fetchImpl = options.fetch || globalScope.fetch;
    if (typeof fetchImpl !== "function") return { ok: false, url: parsed, error: "Trình duyệt không hỗ trợ fetch.", headers: inspectHeaders(null, {}) };
    const startedAt = Date.now();
    try {
      const response = await fetchImpl(parsed.href, { method: "HEAD", mode: "cors", credentials: "omit", redirect: "follow", cache: "no-store" });
      return {
        ok: response.ok,
        status: response.status,
        statusText: safeText(response.statusText, 160),
        url: parsed,
        duration: Date.now() - startedAt,
        headers: inspectHeaders(response.headers, { crossOrigin: !parsed.sameOrigin })
      };
    } catch (error) {
      return {
        ok: false, url: parsed, duration: Date.now() - startedAt,
        error: safeText(error.message || "Fetch thất bại", 240),
        headers: inspectHeaders(null, { crossOrigin: !parsed.sameOrigin, fetchError: true })
      };
    }
  }

  function mount(root, optionsInput) {
    if (!root || typeof root.querySelector !== "function") return null;
    if (instances.has(root)) return instances.get(root);
    const options = optionsInput || {};
    const doc = root.ownerDocument || globalScope.document;
    let state;
    try {
      const stored = globalScope.localStorage && globalScope.localStorage.getItem(STORAGE_KEY);
      state = normalizeState(options.state || (stored ? JSON.parse(stored) : null), options.toolId);
    } catch (_) { state = defaultState(options.toolId); }
    let destroyed = false;
    let monitor = null;

    function persist() {
      state.updatedAt = new Date().toISOString();
      try { if (globalScope.localStorage) globalScope.localStorage.setItem(STORAGE_KEY, serializeState(state)); } catch (_) { /* Private mode can reject storage. */ }
    }

    function status(message) {
      const node = root.querySelector("[data-hddiag-status]");
      if (node) node.textContent = safeText(message, 400);
    }

    function render(message) {
      if (destroyed) return;
      root.innerHTML = shellTemplate(state);
      if (message) status(message);
    }

    function saveRender(message) { persist(); render(message); }

    function addTimeline(type, label, detail, eventStatus, duration) {
      state.diagnostics.timeline.unshift(timelineEntry(type, label, detail, eventStatus, duration));
      state.diagnostics.timeline = state.diagnostics.timeline.slice(0, MAX_TIMELINE);
      persist();
    }

    async function processFiles(files) {
      for (const file of Array.from(files || []).slice(0, 12)) {
        try {
          const kind = detectAssetKind(file.name, file.type);
          let report;
          if (kind === "image") {
            report = analyzeAsset(file);
            if (typeof globalScope.createImageBitmap === "function") {
              const bitmap = await globalScope.createImageBitmap(file);
              report = analyzeAsset({ name: file.name, type: file.type, size: file.size, width: bitmap.width, height: bitmap.height });
              if (bitmap.close) bitmap.close();
            }
          } else {
            const text = file.size <= 5_000_000 && typeof file.text === "function" ? await file.text() : "";
            report = text ? analyzeTextAsset(text, file) : analyzeAsset(file);
            if (/^package\.json$/i.test(file.name) && text) state.diagnostics.packageReport = analyzePackageJson(text);
          }
          state.diagnostics.assets.unshift(report);
          state.diagnostics.assets = state.diagnostics.assets.slice(0, MAX_ASSETS);
          addTimeline("asset", `Đã phân tích ${file.name}`, `${formatBytes(file.size)} · ${report.warnings.length} cảnh báo`, report.warnings.length ? "warn" : "success");
        } catch (error) {
          addTimeline("asset", `Không đọc được ${file.name}`, error.message, "error");
        }
      }
      saveRender("Đã phân tích asset trên thiết bị.");
    }

    async function runAi() {
      const input = redactText(state.ai.input);
      if (!input.trim()) return status("Hãy nhập dữ liệu cần phân tích.");
      status(state.ai.useServer ? "Đang yêu cầu backend tạo bản nháp..." : "Đang phân tích cục bộ...");
      try {
        const draft = state.ai.useServer
          ? await requestServerDraft({ mode: state.ai.mode, input, context: { locale: "vi-VN" } }, { adapter: options.aiAdapter, fetch: options.fetch, endpoint: options.aiEndpoint })
          : createLocalAIDraft(state.ai.mode, input, { locale: "vi-VN" });
        state.ai.drafts.unshift(draft);
        state.ai.drafts = state.ai.drafts.slice(0, MAX_HISTORY);
        state.ai.history.unshift({ id: draft.id, title: draft.title, sourceLabel: draft.sourceLabel, createdAt: draft.createdAt });
        state.ai.history = state.ai.history.slice(0, MAX_HISTORY);
        saveRender("Đã tạo bản nháp. Dữ liệu gốc chưa thay đổi.");
      } catch (error) {
        const message = redactText(error.message || "AI backend chưa sẵn sàng.");
        const fallback = createLocalAIDraft(state.ai.mode, input, { serverError: message });
        fallback.summary = `${fallback.summary} Backend không khả dụng nên đã chuyển sang fallback cục bộ.`;
        state.ai.drafts.unshift(fallback);
        state.ai.history.unshift({ id: fallback.id, title: fallback.title, sourceLabel: fallback.sourceLabel, createdAt: fallback.createdAt });
        state.ai.history = state.ai.history.slice(0, MAX_HISTORY);
        saveRender(`Backend không khả dụng: ${message}. Đã dùng fallback cục bộ.`);
      }
    }

    async function onClick(event) {
      const target = event.target.closest("button,[data-hddiag-drop]");
      if (!target || !root.contains(target)) return;
      if (target.dataset.hddiagTool) { state.activeTool = normalizeToolId(target.dataset.hddiagTool); return saveRender(); }
      if (target.dataset.hddiagTab) { state.diagnostics.activeTab = target.dataset.hddiagTab; return saveRender(); }
      if (target.dataset.hddiagAiMode) { state.ai.mode = target.dataset.hddiagAiMode; return saveRender(); }
      if (target.dataset.hddiagHistory) {
        const draft = state.ai.drafts.find((item) => item.id === target.dataset.hddiagHistory);
        if (draft) { state.ai.drafts = [draft, ...state.ai.drafts.filter((item) => item.id !== draft.id)]; return render("Đã mở bản nháp lịch sử."); }
      }
      const action = target.dataset.hddiagAction;
      if (action === "scan-current") {
        state.diagnostics.report = runLocalChecklist(collectDocumentFacts(doc, doc));
        addTimeline("audit", "Đã quét DOM hiện tại", `Điểm checklist ${state.diagnostics.report.score}/100`, "success");
        return saveRender("Đã hoàn tất checklist local. Đây không phải Lighthouse chính thức.");
      }
      if (action === "inspect-url") {
        const input = root.querySelector("[data-hddiag-url]");
        state.diagnostics.url = input ? input.value : state.diagnostics.url;
        status("Đang yêu cầu response header...");
        const result = await inspectRemoteUrl(state.diagnostics.url, { fetch: options.fetch });
        state.diagnostics.headers = result.headers;
        addTimeline("request", `${result.ok ? "HEAD" : "Không đọc được"} ${result.url.href || state.diagnostics.url}`, result.ok ? `HTTP ${result.status}` : result.error, result.ok ? "success" : "warn", result.duration);
        state.diagnostics.activeTab = "security";
        return saveRender(result.ok ? "Đã đọc tập header được CORS cho phép." : "Không đọc được response; xem giải thích CORS trong báo cáo.");
      }
      if (action === "pick-files") return root.querySelector("[data-hddiag-files]").click();
      if (action === "start-performance") {
        if (monitor) monitor.stop();
        monitor = createPerformanceMonitor({ scope: globalScope, onMetric(metric) { state.diagnostics.metrics[metric.name] = metric; persist(); if (state.diagnostics.activeTab === "performance") render("Đang cập nhật metric từ PerformanceObserver."); } });
        return status(monitor.supported.webVitals ? "Đang đo metric được trình duyệt hỗ trợ." : "PerformanceObserver không hỗ trợ Core Web Vitals đầy đủ trên trình duyệt này.");
      }
      if (action === "clear-timeline") { state.diagnostics.timeline = []; return saveRender("Đã dọn timeline cục bộ."); }
      if (action === "run-ai") return runAi();
      if (action === "clear-ai") { state.ai.input = ""; return saveRender("Đã xóa ô nhập."); }
      if (action === "copy-draft") {
        const draft = state.ai.drafts[0];
        if (draft) await copyText(doc, draft.replacement || draft.summary);
        return status("Đã sao chép bản nháp.");
      }
      if (action === "apply-draft") {
        const current = state.ai.drafts[0];
        if (!current || !current.replacement) return status("Bản nháp này không có nội dung để áp dụng.");
        const applied = applyDraft(current, { explicit: true, onApply: options.onApplyDraft });
        state.ai.drafts[0] = applied;
        state.ai.input = applied.replacement;
        return saveRender("Đã Apply theo yêu cầu rõ ràng của người dùng.");
      }
    }

    function onInput(event) {
      if (event.target.matches("[data-hddiag-url]")) { state.diagnostics.url = safeText(event.target.value, 2048); persist(); }
      if (event.target.matches("[data-hddiag-ai-input]")) { state.ai.input = redactText(event.target.value); persist(); }
    }

    function onChange(event) {
      if (event.target.matches("[data-hddiag-server]")) { state.ai.useServer = event.target.checked; return saveRender(state.ai.useServer ? "Backend AI sẽ dùng /api/ai/dev; không gửi API key từ frontend." : "Đã chuyển sang engine cục bộ tất định."); }
      if (event.target.matches("[data-hddiag-files]")) processFiles(event.target.files);
    }

    function onDragOver(event) {
      const drop = event.target.closest("[data-hddiag-drop]");
      if (!drop) return;
      event.preventDefault(); drop.classList.add("is-dragging");
    }

    function onDragLeave(event) {
      const drop = event.target.closest("[data-hddiag-drop]");
      if (drop) drop.classList.remove("is-dragging");
    }

    function onDrop(event) {
      const drop = event.target.closest("[data-hddiag-drop]");
      if (!drop) return;
      event.preventDefault(); drop.classList.remove("is-dragging"); processFiles(event.dataTransfer && event.dataTransfer.files);
    }

    function onWindowError(event) {
      addTimeline("error", event.message || "JavaScript error", `${event.filename || ""}:${event.lineno || 0}:${event.colno || 0}`, "error");
      if (state.activeTool === "web-diagnostics" && state.diagnostics.activeTab === "timeline") render("Đã ghi nhận lỗi JavaScript.");
    }

    function onUnhandled(event) {
      const reason = event.reason && (event.reason.stack || event.reason.message) || event.reason || "Unhandled rejection";
      addTimeline("promise", "Unhandled promise rejection", reason, "error");
    }

    root.classList.add("hddiag");
    root.addEventListener("click", onClick);
    root.addEventListener("input", onInput);
    root.addEventListener("change", onChange);
    root.addEventListener("dragover", onDragOver);
    root.addEventListener("dragleave", onDragLeave);
    root.addEventListener("drop", onDrop);
    if (globalScope.addEventListener) {
      globalScope.addEventListener("error", onWindowError);
      globalScope.addEventListener("unhandledrejection", onUnhandled);
    }
    render(); persist();

    const controller = {
      getState: () => clone(state),
      setTool(toolId) { state.activeTool = normalizeToolId(toolId); saveRender(); },
      addTimeline(type, label, detail, entryStatus, duration) { addTimeline(type, label, detail, entryStatus, duration); render(); },
      createLocalDraft(mode, input, context) {
        const draft = createLocalAIDraft(mode, input, context);
        state.ai.drafts.unshift(draft); state.ai.drafts = state.ai.drafts.slice(0, MAX_HISTORY);
        state.ai.history.unshift({ id: draft.id, title: draft.title, sourceLabel: draft.sourceLabel, createdAt: draft.createdAt });
        persist(); render(); return clone(draft);
      },
      destroy() {
        if (destroyed) return;
        destroyed = true;
        if (monitor) monitor.stop();
        root.removeEventListener("click", onClick);
        root.removeEventListener("input", onInput);
        root.removeEventListener("change", onChange);
        root.removeEventListener("dragover", onDragOver);
        root.removeEventListener("dragleave", onDragLeave);
        root.removeEventListener("drop", onDrop);
        if (globalScope.removeEventListener) {
          globalScope.removeEventListener("error", onWindowError);
          globalScope.removeEventListener("unhandledrejection", onUnhandled);
        }
        root.replaceChildren(); root.classList.remove("hddiag"); instances.delete(root);
      }
    };
    instances.set(root, controller);
    return controller;
  }

  function unmount(root) {
    const controller = instances.get(root);
    if (!controller) return false;
    controller.destroy();
    return true;
  }

  const api = Object.freeze({
    VERSION, STORAGE_KEY, TOOLS, AI_MODES,
    safeText, escapeHtml, redactText, sanitizePayload, formatBytes,
    normalizeToolId, normalizeUrl, headersToObject, parseCsp, inspectCookieString, inspectHeaders,
    runLocalChecklist, collectDocumentFacts, detectAssetKind, analyzeTextAsset, analyzeAsset, analyzePackageJson,
    performanceRating, normalizeMetric, createPerformanceMonitor, timelineEntry,
    detectDeveloperInput, explainRegex, explainSql, explainStack, reviewCode, buildLinePreview,
    createLocalAIDraft, requestServerDraft, applyDraft,
    defaultState, normalizeState, serializeState, inspectRemoteUrl, mount, unmount
  });

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  globalScope.HHDevDiagnosticsAI = api;
}(typeof globalThis !== "undefined" ? globalThis : this));
