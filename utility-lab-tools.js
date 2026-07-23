(function initHHUtilityLabTools(global) {
  "use strict";

  const GROUPS = Object.freeze({
    developer: ["Markdown Editor", "JSON Viewer", "API Tester", "Regex Playground", "Code Viewer", "Terminal Simulator", "Git Cheat Sheet", "GitHub Integration", "Console Log Viewer", "Error Monitor", "Dev Utilities", "Text Compare", "JSON Formatter", "UUID Generator", "Hash Generator", "Base64 Encoder", "Timestamp Converter"],
    productivity: ["Productivity Dashboard", "Notes", "Todo", "Kanban", "Pomodoro", "Stopwatch", "Countdown", "Calendar", "Reminder", "Calculator", "Unit Converter", "Lorem Ipsum", "Password Toolkit", "Clipboard Manager", "Clipboard History", "Activity Timeline", "Recent Files", "Pinned Tools", "Bookmark", "Floating Quick Actions", "Focus Mode", "User Preferences Center"],
    system: ["Multi-language", "Language Switcher", "Weather Widget", "Clock", "System Status", "Network Speed", "Memory Usage", "Storage Usage", "Analytics Dashboard", "Notification Center", "Smart Search", "Context Menu", "Floating Toolbar", "QR Scanner"]
  });
  const slug = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const manifests = Object.entries(GROUPS).flatMap(([group, names]) => names.map((name) => Object.freeze({ id: slug(name), name, group, runtime: "browser", offline: !["API Tester", "GitHub Integration", "Weather Widget"].includes(name) })));
  const byId = new Map(manifests.map((item) => [item.id, item]));
  const byName = new Map(manifests.map((item) => [item.name, item]));
  const STORE_KEY = "hh.utility-tools.v1";
  const SENSITIVE = /password|secret|token|authorization|cookie|api[-_]?key/i;
  const runtime = { controller: null, timer: null, clock: null, cleanup: [], logs: [] };

  const readStore = () => { try { return JSON.parse(localStorage.getItem(STORE_KEY) || "{}"); } catch { return {}; } };
  const writeStore = (value) => localStorage.setItem(STORE_KEY, JSON.stringify(value));
  const rows = (key) => Array.isArray(readStore()[key]) ? readStore()[key] : [];
  const saveRows = (key, value) => { const store = readStore(); store[key] = value.slice(0, 250); writeStore(store); };
  const uid = () => global.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const download = (name, content, type = "text/plain;charset=utf-8") => { const a = document.createElement("a"); a.href = URL.createObjectURL(content instanceof Blob ? content : new Blob([content], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };
  const value = (root, name) => root.querySelector(`[name="${name}"]`)?.value || "";
  const setOutput = (root, content, state = "success") => { const output = root.querySelector("[data-ut-output]"); if (output) output.textContent = String(content ?? ""); const status = root.querySelector("[data-ut-status]"); if (status) { status.textContent = state === "error" ? "Có lỗi" : state === "running" ? "Đang chạy" : "Hoàn thành"; status.dataset.state = state; } };
  const record = (tool, action, summary) => { const current = rows("activity"); saveRows("activity", [{ id: uid(), tool, action, summary: String(summary || "").slice(0, 240), at: new Date().toISOString() }, ...current]); };

  function shell(tool, body, hint = "Dữ liệu được xử lý trên thiết bị khi trình duyệt hỗ trợ.") {
    return `<section class="ut-workspace" data-ut-tool="${esc(tool.id)}">
      <header class="ut-head"><div><small>${esc(tool.group.toUpperCase())} · BROWSER TOOL</small><h3>${esc(tool.name)}</h3><p>${esc(hint)}</p></div><div class="ut-badges"><span>Sẵn sàng</span><span>${tool.offline ? "Offline" : "Cần mạng"}</span></div></header>
      <div class="ut-status" data-ut-status>Sẵn sàng.</div>${body}
    </section>`;
  }
  const field = (label, control, help = "") => `<label class="ut-field"><span>${esc(label)}</span>${control}${help ? `<small>${esc(help)}</small>` : ""}</label>`;
  const actions = (...items) => `<div class="ut-actions">${items.map(([id, label, primary]) => `<button type="button" class="ut-button ${primary ? "is-primary" : ""}" data-ut-action="${id}">${esc(label)}</button>`).join("")}</div>`;
  const result = (label = "Kết quả") => `<section class="ut-result"><header><strong>${esc(label)}</strong><button type="button" data-ut-action="copy-output">Sao chép</button></header><pre data-ut-output>Chưa có kết quả.</pre></section>`;
  const two = (main, side) => `<div class="ut-layout"><main>${main}</main><aside>${side}</aside></div>`;

  function editorMarkup(tool) {
    const configs = {
      "markdown-editor": ["Markdown", "# Tiêu đề\n\nViết **nội dung** ở đây...", [["render-markdown", "Xem trước", true], ["export-markdown", "Xuất .md"]]],
      "json-viewer": ["JSON", '{\n  "name": "HH Platform"\n}', [["format-json", "Định dạng", true], ["minify-json", "Thu gọn"], ["validate-json", "Kiểm tra"]]],
      "json-formatter": ["JSON", '{"status":"ready"}', [["format-json", "Định dạng", true], ["minify-json", "Thu gọn"]]],
      "code-viewer": ["Mã nguồn", "function hello() {\n  return 'HH';\n}", [["number-code", "Đánh số dòng", true], ["export-code", "Xuất file"]]],
      "base64-encoder": ["Văn bản / Base64", "HH Platform", [["base64-encode", "Mã hóa", true], ["base64-decode", "Giải mã"]]],
      "dev-utilities": ["Văn bản", "HH Platform Developer Tools", [["text-stats", "Thống kê", true], ["slugify", "Tạo slug"], ["url-encode", "URL encode"], ["html-escape", "Escape HTML"]]]
    };
    const [label, placeholder, buttons] = configs[tool.id];
    return shell(tool, two(`<section class="ut-card">${field(label, `<textarea name="source" spellcheck="false">${esc(placeholder)}</textarea>`)}${actions(...buttons)}</section>`, result(tool.id === "markdown-editor" ? "Xem trước an toàn" : "Kết quả")));
  }

  function developerMarkup(tool) {
    if (["markdown-editor", "json-viewer", "json-formatter", "code-viewer", "base64-encoder", "dev-utilities"].includes(tool.id)) return editorMarkup(tool);
    if (tool.id === "api-tester") return shell(tool, two(`<section class="ut-card"><div class="ut-inline"><select name="method"><option>GET</option><option>POST</option><option>PUT</option><option>PATCH</option><option>DELETE</option></select><input name="url" type="url" placeholder="https://api.example.com/data"></div>${field("Headers JSON", '<textarea name="headers">{}</textarea>')}${field("Body", '<textarea name="body"></textarea>')}${actions(["api-run", "Gửi yêu cầu", true], ["cancel", "Hủy"])}</section>`, result("HTTP response")), "Chỉ gửi yêu cầu khi người dùng bấm chạy; header nhạy cảm không được lưu lịch sử.");
    if (tool.id === "regex-playground") return shell(tool, two(`<section class="ut-card"><div class="ut-inline"><input name="pattern" placeholder="\\b[A-Z][a-z]+\\b"><input name="flags" value="gimu" maxlength="6"></div>${field("Văn bản", '<textarea name="source">HH Platform\nDeveloper Tools</textarea>')}${field("Thay thế", '<input name="replacement" placeholder="Tùy chọn">')}${actions(["regex-run", "Tìm khớp", true], ["regex-replace", "Thay thế"])}</section>`, result("Match và vị trí")));
    if (tool.id === "text-compare") return shell(tool, `<section class="ut-card ut-compare">${field("Bản A", '<textarea name="left"></textarea>')}${field("Bản B", '<textarea name="right"></textarea>')}${actions(["compare", "So sánh theo dòng", true])}</section>${result("Khác biệt")}`);
    if (tool.id === "terminal-simulator") return shell(tool, two(`<section class="ut-card">${field("Lệnh sandbox", '<input name="command" value="help" autocomplete="off">', "Chỉ hỗ trợ help, clear, echo, date, whoami, pwd, ls tools và history.")}${actions(["terminal-run", "Chạy lệnh", true], ["terminal-clear", "Xóa màn hình"])}</section>`, result("HH Local Sandbox")), "Sandbox cục bộ; không truy cập PowerShell, CMD hoặc file hệ điều hành.");
    if (tool.id === "git-cheat-sheet") return shell(tool, two(`<section class="ut-card">${field("Tìm tình huống Git", '<input name="query" placeholder="branch, rebase, undo, stash...">')}${actions(["git-search", "Tìm lệnh", true])}</section>`, result("Lệnh và giải thích")));
    if (tool.id === "github-integration") return shell(tool, two(`<section class="ut-card"><div class="ut-inline"><input name="owner" placeholder="owner" value="hoangdaika13"><input name="repo" placeholder="repository" value="hoangdaika13.github.io"></div>${actions(["github-load", "Đọc repository công khai", true], ["cancel", "Hủy"])}</section>`, result("GitHub repository")), "Chỉ đọc metadata repository công khai từ api.github.com; không lưu token.");
    if (["console-log-viewer", "error-monitor"].includes(tool.id)) return shell(tool, two(`<section class="ut-card"><p>Hiển thị lỗi và log do HH Platform công bố trong phiên này.</p>${actions(["runtime-refresh", "Làm mới", true], ["runtime-clear", "Xóa bản cục bộ"], ["export-output", "Xuất log"])}</section>`, result(tool.id === "error-monitor" ? "Runtime issues" : "Console session")));
    if (tool.id === "uuid-generator") return shell(tool, two(`<section class="ut-card">${field("Số lượng", '<input name="count" type="number" min="1" max="100" value="5">')}${actions(["uuid-generate", "Tạo UUID", true], ["export-output", "Xuất"] )}</section>`, result("UUID v4")));
    if (tool.id === "hash-generator") return shell(tool, two(`<section class="ut-card">${field("Thuật toán", '<select name="algorithm"><option>SHA-256</option><option>SHA-384</option><option>SHA-512</option></select>')}${field("Văn bản", '<textarea name="source"></textarea>')}${actions(["hash-run", "Tạo hash", true])}</section>`, result("Digest hexadecimal")));
    if (tool.id === "timestamp-converter") return shell(tool, two(`<section class="ut-card">${field("ISO, ngày giờ hoặc Unix", '<input name="source" placeholder="2026-07-23T10:00:00Z hoặc 1784800800">')}${actions(["timestamp-run", "Chuyển đổi", true], ["timestamp-now", "Dùng hiện tại"])}</section>`, result("Các định dạng thời gian")));
    return shell(tool, `<section class="ut-card"><p>Công cụ đã được đăng ký nhưng chưa có renderer.</p></section>`);
  }

  const recordTools = new Set(["notes", "todo", "kanban", "calendar", "reminder", "activity-timeline", "recent-files", "pinned-tools", "bookmark"]);
  function recordMarkup(tool) {
    const presets = {
      notes: ["Tiêu đề ghi chú", "Nội dung"], todo: ["Công việc", "Mô tả"], kanban: ["Thẻ Kanban", "Mô tả"], calendar: ["Sự kiện", "Ghi chú"], reminder: ["Nhắc việc", "Nội dung"],
      "activity-timeline": ["Hoạt động", "Chi tiết"], "recent-files": ["Tên file", "Đường dẫn/ghi chú"], "pinned-tools": ["Tên công cụ", "Route"], bookmark: ["Tên bookmark", "URL"]
    };
    const labels = presets[tool.id];
    return shell(tool, `<section class="ut-card"><div class="ut-inline"><input name="title" placeholder="${esc(labels[0])}"><input name="meta" placeholder="${esc(labels[1])}"></div><div class="ut-inline"><input name="date" type="datetime-local"><select name="column"><option value="backlog">Backlog</option><option value="doing">Đang làm</option><option value="done">Hoàn thành</option></select></div>${actions(["record-add", "Thêm mục", true], ["record-export", "Xuất JSON"])}</section><section class="ut-list" data-ut-list></section>`);
  }

  function productivityMarkup(tool) {
    if (recordTools.has(tool.id)) return recordMarkup(tool);
    if (tool.id === "productivity-dashboard") return shell(tool, `<section class="ut-metrics" data-ut-dashboard></section>${actions(["dashboard-refresh", "Làm mới", true], ["record-export-all", "Xuất dữ liệu"])}`);
    if (["pomodoro", "stopwatch", "countdown"].includes(tool.id)) return shell(tool, `<section class="ut-timer"><small>${esc(tool.name)}</small><strong data-ut-timer>00:00</strong>${field("Số phút", `<input name="minutes" type="number" min="1" max="720" value="${tool.id === "pomodoro" ? 25 : 5}">`)}${actions(["timer-start", "Bắt đầu", true], ["timer-pause", "Tạm dừng"], ["timer-reset", "Đặt lại"])}</section>`);
    if (tool.id === "calculator") return shell(tool, two(`<section class="ut-card">${field("Biểu thức", '<input name="expression" inputmode="decimal" value="(25 + 5) * 2">', "Hỗ trợ + − × ÷ % và ngoặc; không dùng eval/Function.")}${actions(["calculate", "Tính", true])}</section>`, result("Kết quả")));
    if (tool.id === "unit-converter") return shell(tool, two(`<section class="ut-card"><div class="ut-inline"><input name="amount" type="number" value="1"><select name="from"><option value="km">km</option><option value="m">m</option><option value="cm">cm</option><option value="kg">kg</option><option value="g">g</option><option value="c">°C</option><option value="f">°F</option></select><select name="to"><option value="m">m</option><option value="km">km</option><option value="cm">cm</option><option value="g">g</option><option value="kg">kg</option><option value="f">°F</option><option value="c">°C</option></select></div>${actions(["convert-unit", "Chuyển đổi", true])}</section>`, result("Kết quả")));
    if (tool.id === "lorem-ipsum") return shell(tool, two(`<section class="ut-card">${field("Số đoạn", '<input name="count" type="number" min="1" max="30" value="3">')}${actions(["lorem-generate", "Tạo nội dung", true])}</section>`, result("Lorem Ipsum")));
    if (tool.id === "password-toolkit") return shell(tool, two(`<section class="ut-card">${field("Độ dài", '<input name="length" type="number" min="12" max="128" value="24">')}<div class="ut-checks"><label><input name="symbols" type="checkbox" checked>Ký hiệu</label><label><input name="numbers" type="checkbox" checked>Số</label></div>${actions(["password-generate", "Tạo bằng crypto", true])}</section>`, result("Mật khẩu chỉ hiển thị trong phiên")), "Mật khẩu được tạo bằng crypto.getRandomValues và không được lưu lịch sử.");
    if (["clipboard-manager", "clipboard-history"].includes(tool.id)) return shell(tool, two(`<section class="ut-card">${field("Nội dung", '<textarea name="source"></textarea>')}${actions(["clipboard-write", "Ghi clipboard", true], ["clipboard-read", "Đọc clipboard"], ["clipboard-clear", "Xóa lịch sử"])}</section>`, result("Lịch sử clipboard theo thao tác chủ động")), "Trình duyệt chỉ xin quyền clipboard sau thao tác của người dùng.");
    if (tool.id === "floating-quick-actions") return shell(tool, `<section class="ut-card"><p>Bật thanh thao tác nổi cho Trang chủ, Tìm kiếm, Tool và Focus Mode.</p>${actions(["quick-toggle", "Bật/tắt thanh nhanh", true])}</section><div class="ut-floating" data-ut-floating hidden><button data-app-route="/home">Trang chủ</button><button data-app-route="/tools/global-search">Tìm kiếm</button><button data-ut-action="focus-toggle">Focus</button></div>`);
    if (tool.id === "focus-mode") return shell(tool, `<section class="ut-card"><p>Ẩn nhiễu trong workspace hiện tại và theo dõi thời gian tập trung.</p>${field("Số phút", '<input name="minutes" type="number" min="1" max="180" value="25">')}${actions(["focus-toggle", "Bật Focus Mode", true], ["focus-stop", "Kết thúc"])}</section><section class="ut-timer"><strong data-ut-timer>25:00</strong></section>`);
    if (tool.id === "user-preferences-center") {
      const prefs = readStore().preferences || {};
      return shell(tool, two(`<section class="ut-card">
        ${field("Chế độ màu", `<select name="pref-theme"><option value="system" ${prefs.theme === "system" ? "selected" : ""}>Theo hệ thống</option><option value="dark" ${prefs.theme === "dark" ? "selected" : ""}>Tối</option><option value="light" ${prefs.theme === "light" ? "selected" : ""}>Sáng</option></select>`)}
        ${field("Mật độ giao diện", `<select name="pref-density"><option value="comfortable" ${prefs.density !== "compact" ? "selected" : ""}>Thoải mái</option><option value="compact" ${prefs.density === "compact" ? "selected" : ""}>Gọn</option></select>`)}
        ${field("Ngôn ngữ", `<select name="pref-language"><option value="vi" ${prefs.language !== "en" ? "selected" : ""}>Tiếng Việt</option><option value="en" ${prefs.language === "en" ? "selected" : ""}>English</option></select>`)}
        <div class="ut-checks"><label><input name="pref-motion" type="checkbox" ${prefs.reducedMotion ? "checked" : ""}>Giảm chuyển động</label><label><input name="pref-contrast" type="checkbox" ${prefs.highContrast ? "checked" : ""}>Tương phản cao</label></div>
        ${actions(["preferences-save", "Lưu tùy chọn", true])}<small>Để về mặc định, chọn “Theo hệ thống” và “Thoải mái”, rồi lưu.</small>
      </section>`, result("Trạng thái đồng bộ")), "Tùy chọn được lưu cục bộ cho thiết bị này và áp dụng ngay, không lưu dữ liệu nhạy cảm.");
    }
    return shell(tool, `<section class="ut-card"><p>Workspace năng suất đang sẵn sàng.</p></section>`);
  }

  function systemMarkup(tool) {
    if (["multi-language", "language-switcher"].includes(tool.id)) return shell(tool, two(`<section class="ut-card">${field("Ngôn ngữ", '<select name="language"><option value="vi">Tiếng Việt</option><option value="en">English</option></select>')}${actions(["language-apply", "Áp dụng", true])}</section>`, result("Trạng thái")));
    if (tool.id === "weather-widget") return shell(tool, two(`<section class="ut-card"><div class="ut-inline"><input name="lat" value="21.0285" aria-label="Vĩ độ"><input name="lon" value="105.8542" aria-label="Kinh độ"></div>${actions(["weather-load", "Lấy thời tiết", true], ["cancel", "Hủy"])}</section>`, result("Open-Meteo hiện tại")));
    if (tool.id === "clock") return shell(tool, `<section class="ut-clock"><strong data-ut-clock></strong><span data-ut-date></span></section>`);
    if (["system-status", "memory-usage", "storage-usage"].includes(tool.id)) return shell(tool, two(`<section class="ut-card"><p>Đọc khả năng trình duyệt hiện tại; không giả lập RAM/CPU của hệ điều hành.</p>${actions(["system-inspect", "Đo lại", true], ["export-output", "Xuất"] )}</section>`, result("Báo cáo thiết bị")));
    if (tool.id === "network-speed") return shell(tool, two(`<section class="ut-card"><p>Tải một tài nguyên tĩnh của HH để đo thời gian và throughput thực tế trong phiên.</p>${actions(["network-measure", "Bắt đầu đo", true], ["cancel", "Hủy"])}</section>`, result("Kết quả mạng")));
    if (tool.id === "analytics-dashboard") return shell(tool, `<section class="ut-metrics" data-ut-analytics></section><p class="ut-privacy">Chỉ tổng hợp event đã công bố và dữ liệu cục bộ; không đọc nội dung biểu mẫu, mật khẩu hoặc token.</p>${actions(["analytics-refresh", "Làm mới", true], ["export-output", "Xuất báo cáo"])}`);
    if (tool.id === "notification-center") return shell(tool, `<section class="ut-card">${field("Thông báo mới", '<input name="title" placeholder="Nội dung thông báo">')}${actions(["notification-add", "Thêm", true], ["notification-read", "Đánh dấu đã đọc"], ["notification-clear", "Xóa tất cả"])}</section><section class="ut-list" data-ut-list></section>`);
    if (tool.id === "smart-search") return shell(tool, two(`<section class="ut-card">${field("Tìm trong HH Platform", '<input name="query" type="search" placeholder="Tên module hoặc route">')}${actions(["smart-search", "Tìm", true])}</section>`, result("Kết quả có thể mở")));
    if (tool.id === "context-menu") return shell(tool, `<section class="ut-card"><p>Bật menu chuột phải riêng trong workspace Tool với các lệnh Sao chép, Trang chủ và Làm mới.</p>${actions(["context-toggle", "Bật/tắt menu", true])}</section><div class="ut-context" data-ut-context hidden><button data-ut-action="copy-output">Sao chép kết quả</button><button data-app-route="/home">Trang chủ</button><button data-ut-action="system-inspect">Làm mới</button></div>`);
    if (tool.id === "floating-toolbar") return shell(tool, `<section class="ut-card"><p>Thanh công cụ nổi có thể kéo theo vùng nhìn và chỉ tồn tại trong phiên.</p>${actions(["toolbar-toggle", "Bật/tắt toolbar", true])}</section><div class="ut-toolbar" data-ut-toolbar hidden><button data-app-route="/home">⌂</button><button data-app-route="/tools/global-search">⌕</button><button data-ut-action="toolbar-toggle">×</button></div>`);
    if (tool.id === "qr-scanner") return shell(tool, two(`<section class="ut-card"><label class="ut-drop">Chọn ảnh QR<input name="qr-file" type="file" accept="image/*"></label>${actions(["qr-scan", "Quét ảnh", true])}</section>`, result("Nội dung QR")), "Dùng BarcodeDetector khi trình duyệt hỗ trợ; không tự bật camera.");
    return shell(tool, `<section class="ut-card"><p>System Tool đã sẵn sàng.</p></section>`);
  }

  function renderList(root, tool) {
    const list = root.querySelector("[data-ut-list]"); if (!list) return;
    const data = tool.id === "notification-center" ? rows("notifications") : rows(tool.id);
    list.innerHTML = data.length ? data.map((item) => `<article class="${item.done || item.read ? "is-done" : ""}"><div><strong>${esc(item.title)}</strong><p>${esc(item.meta || item.column || "")}</p><small>${esc(item.date || item.at || "")}</small></div><div><button data-ut-record-toggle="${item.id}">${item.done || item.read ? "↶" : "✓"}</button><button data-ut-record-delete="${item.id}">×</button></div></article>`).join("") : '<p class="ut-empty">Chưa có dữ liệu.</p>';
  }

  function safeCalculate(expression) {
    const source = String(expression).replace(/×/g, "*").replace(/÷/g, "/");
    if (!/^[\d\s.+\-*/()%]+$/.test(source)) throw new Error("Biểu thức chứa ký tự không được hỗ trợ.");
    const tokens = source.match(/\d*\.\d+|\d+|[()+\-*/%]/g) || [];
    const output = [], ops = [], precedence = { "+": 1, "-": 1, "*": 2, "/": 2, "%": 2 };
    let previous = "operator";
    for (const token of tokens) {
      if (/^\d/.test(token)) { output.push(Number(token)); previous = "number"; continue; }
      if (token === "(") { ops.push(token); previous = "operator"; continue; }
      if (token === ")") { while (ops.length && ops.at(-1) !== "(") output.push(ops.pop()); if (ops.pop() !== "(") throw new Error("Ngoặc không hợp lệ."); previous = "number"; continue; }
      if (token === "-" && previous === "operator") output.push(0);
      while (ops.length && precedence[ops.at(-1)] >= precedence[token]) output.push(ops.pop());
      ops.push(token); previous = "operator";
    }
    while (ops.length) { const op = ops.pop(); if (op === "(") throw new Error("Ngoặc không hợp lệ."); output.push(op); }
    const stack = [];
    for (const token of output) { if (typeof token === "number") stack.push(token); else { const b = stack.pop(), a = stack.pop(); if (!Number.isFinite(a) || !Number.isFinite(b)) throw new Error("Biểu thức không hợp lệ."); if ((token === "/" || token === "%") && b === 0) throw new Error("Không thể chia cho 0."); stack.push(token === "+" ? a + b : token === "-" ? a - b : token === "*" ? a * b : token === "/" ? a / b : a % b); } }
    if (stack.length !== 1 || !Number.isFinite(stack[0])) throw new Error("Biểu thức không hợp lệ.");
    return stack[0];
  }

  const gitCommands = Object.freeze([
    ["branch", "git switch -c ten-nhanh", "Tạo và chuyển sang nhánh mới."], ["rebase", "git rebase main", "Đặt commit hiện tại lên trên main."], ["undo", "git revert <commit>", "Hoàn tác an toàn bằng commit mới."], ["stash", "git stash push -u -m \"wip\"", "Cất cả file tracked và untracked."], ["history", "git log --oneline --graph --decorate -20", "Xem lịch sử rút gọn."], ["diff", "git diff --check", "Kiểm tra whitespace và xung đột định dạng."]
  ]);

  async function runAction(root, tool, action) {
    if (action === "copy-output") { await navigator.clipboard.writeText(root.querySelector("[data-ut-output]")?.textContent || ""); return; }
    if (action === "export-output") { download(`${tool.id}.txt`, root.querySelector("[data-ut-output]")?.textContent || ""); return; }
    if (action === "cancel") { runtime.controller?.abort(); setOutput(root, "Đã hủy tác vụ.", "error"); return; }
    if (["format-json", "minify-json", "validate-json"].includes(action)) { const parsed = JSON.parse(value(root, "source")); setOutput(root, action === "minify-json" ? JSON.stringify(parsed) : action === "validate-json" ? `JSON hợp lệ · ${Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length} mục cấp đầu` : JSON.stringify(parsed, null, 2)); }
    else if (action === "render-markdown") { const source = value(root, "source"); const safe = esc(source).replace(/^### (.+)$/gm, "<h3>$1</h3>").replace(/^## (.+)$/gm, "<h2>$1</h2>").replace(/^# (.+)$/gm, "<h1>$1</h1>").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\n/g, "<br>"); const output = root.querySelector("[data-ut-output]"); output.innerHTML = safe; }
    else if (action === "export-markdown") download("document.md", value(root, "source"), "text/markdown");
    else if (action === "number-code") setOutput(root, value(root, "source").split("\n").map((line, i) => `${String(i + 1).padStart(4)} │ ${line}`).join("\n"));
    else if (action === "export-code") download("code.txt", value(root, "source"));
    else if (action === "base64-encode") setOutput(root, btoa(unescape(encodeURIComponent(value(root, "source")))));
    else if (action === "base64-decode") setOutput(root, decodeURIComponent(escape(atob(value(root, "source").replace(/-/g, "+").replace(/_/g, "/")))));
    else if (action === "text-stats") { const text = value(root, "source"); setOutput(root, `Ký tự: ${text.length}\nTừ: ${text.trim() ? text.trim().split(/\s+/).length : 0}\nDòng: ${text.split("\n").length}`); }
    else if (action === "slugify") setOutput(root, value(root, "source").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
    else if (action === "url-encode") setOutput(root, encodeURIComponent(value(root, "source")));
    else if (action === "html-escape") setOutput(root, esc(value(root, "source")));
    else if (action === "regex-run" || action === "regex-replace") { const re = new RegExp(value(root, "pattern"), value(root, "flags")); const source = value(root, "source"); if (action === "regex-replace") setOutput(root, source.replace(re, value(root, "replacement"))); else { const matches = [...source.matchAll(re.global ? re : new RegExp(re.source, `${re.flags}g`))]; setOutput(root, matches.map((match, i) => `${i + 1}. ${match[0]} @ ${match.index}`).join("\n") || "Không có match."); } }
    else if (action === "compare") { const left = value(root, "left").split("\n"), right = value(root, "right").split("\n"), max = Math.max(left.length, right.length); setOutput(root, Array.from({ length: max }, (_, i) => left[i] === right[i] ? `  ${left[i] || ""}` : `- ${left[i] || ""}\n+ ${right[i] || ""}`).join("\n")); }
    else if (action === "terminal-clear") setOutput(root, "");
    else if (action === "terminal-run") { const command = value(root, "command").trim(), [name, ...args] = command.split(/\s+/); const history = rows("terminal"); saveRows("terminal", [{ id: uid(), command, at: new Date().toISOString() }, ...history]); const result = name === "help" ? "help · clear · echo · date · whoami · pwd · ls tools · history" : name === "echo" ? args.join(" ") : name === "date" ? new Date().toString() : name === "whoami" ? "HH browser user" : name === "pwd" ? "/hh-platform/local-sandbox" : name === "ls" && args[0] === "tools" ? manifests.map((item) => item.id).join("\n") : name === "history" ? rows("terminal").map((item) => item.command).join("\n") : `Lệnh “${name}” không nằm trong sandbox. Gõ help.`; setOutput(root, `$ ${command}\n${result}`); }
    else if (action === "git-search") { const query = value(root, "query").toLowerCase(); setOutput(root, gitCommands.filter((row) => !query || row.join(" ").toLowerCase().includes(query)).map(([tag, command, description]) => `${tag.toUpperCase()}\n${command}\n${description}`).join("\n\n") || "Không tìm thấy tình huống."); }
    else if (action === "api-run") { runtime.controller?.abort(); runtime.controller = new AbortController(); const url = new URL(value(root, "url")); if (!/^https?:$/.test(url.protocol)) throw new Error("Chỉ hỗ trợ HTTP/HTTPS."); const headers = JSON.parse(value(root, "headers") || "{}"); const safeHeaders = Object.fromEntries(Object.entries(headers).filter(([key]) => !SENSITIVE.test(key))); const method = value(root, "method"); const started = performance.now(); const response = await fetch(url, { method, headers: safeHeaders, body: method === "GET" || method === "HEAD" ? undefined : value(root, "body"), signal: runtime.controller.signal }); const text = await response.text(); setOutput(root, `HTTP ${response.status} · ${Math.round(performance.now() - started)} ms\n${[...response.headers].map(([k, v]) => `${k}: ${v}`).join("\n")}\n\n${text.slice(0, 200000)}`); }
    else if (action === "github-load") { const owner = value(root, "owner"), repo = value(root, "repo"); if (!/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repo)) throw new Error("Owner/repository không hợp lệ."); runtime.controller = new AbortController(); const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, { signal: runtime.controller.signal, headers: { Accept: "application/vnd.github+json" } }); const data = await response.json(); if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`); setOutput(root, `${data.full_name}\n${data.description || "Không có mô tả"}\nStars: ${data.stargazers_count}\nForks: ${data.forks_count}\nIssues: ${data.open_issues_count}\nLanguage: ${data.language || "N/A"}\nUpdated: ${data.updated_at}`); }
    else if (action === "runtime-refresh") { const issues = (() => { try { return JSON.parse(localStorage.getItem("hh.runtime.issues.v1") || "[]"); } catch { return []; } })(); setOutput(root, issues.length ? issues.map((item) => `${item.at || ""} [${item.context || "runtime"}] ${item.message || item}`).join("\n") : "Chưa có lỗi runtime được công bố."); }
    else if (action === "runtime-clear") { localStorage.removeItem("hh.runtime.issues.v1"); setOutput(root, "Đã xóa log runtime cục bộ."); }
    else if (action === "uuid-generate") { const count = Math.max(1, Math.min(100, Number(value(root, "count")) || 1)); setOutput(root, Array.from({ length: count }, () => crypto.randomUUID()).join("\n")); }
    else if (action === "hash-run") { const bytes = await crypto.subtle.digest(value(root, "algorithm"), new TextEncoder().encode(value(root, "source"))); setOutput(root, [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("")); }
    else if (action === "timestamp-now") { root.querySelector('[name="source"]').value = String(Math.floor(Date.now() / 1000)); await runAction(root, tool, "timestamp-run"); }
    else if (action === "timestamp-run") { const source = value(root, "source").trim(), date = /^\d+$/.test(source) ? new Date(Number(source) * (source.length <= 10 ? 1000 : 1)) : new Date(source || Date.now()); if (Number.isNaN(date.getTime())) throw new Error("Thời gian không hợp lệ."); setOutput(root, `ISO: ${date.toISOString()}\nUnix seconds: ${Math.floor(date.getTime() / 1000)}\nUnix ms: ${date.getTime()}\nLocal: ${date.toLocaleString("vi-VN")}`); }
    else if (action === "record-add") { const title = value(root, "title").trim(); if (!title) throw new Error("Nhập tiêu đề trước khi thêm."); const item = { id: uid(), title, meta: value(root, "meta"), date: value(root, "date"), column: value(root, "column"), done: false, at: new Date().toISOString() }; saveRows(tool.id, [item, ...rows(tool.id)]); renderList(root, tool); }
    else if (action === "record-export") download(`${tool.id}.json`, JSON.stringify(rows(tool.id), null, 2), "application/json");
    else if (action === "record-export-all") download("hh-productivity.json", JSON.stringify(readStore(), null, 2), "application/json");
    else if (action === "dashboard-refresh") renderDashboard(root);
    else if (action.startsWith("timer-") || action.startsWith("focus-")) runTimer(root, tool, action);
    else if (action === "calculate") setOutput(root, safeCalculate(value(root, "expression")));
    else if (action === "convert-unit") setOutput(root, convertUnit(Number(value(root, "amount")), value(root, "from"), value(root, "to")));
    else if (action === "lorem-generate") { const count = Math.max(1, Math.min(30, Number(value(root, "count")) || 3)); setOutput(root, Array(count).fill("Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.").join("\n\n")); }
    else if (action === "password-generate") { const length = Math.max(12, Math.min(128, Number(value(root, "length")) || 24)), chars = `ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz${root.querySelector('[name="numbers"]')?.checked ? "23456789" : ""}${root.querySelector('[name="symbols"]')?.checked ? "!@#$%&*+-_" : ""}`, random = crypto.getRandomValues(new Uint32Array(length)); setOutput(root, [...random].map((number) => chars[number % chars.length]).join("")); }
    else if (action === "clipboard-write") { await navigator.clipboard.writeText(value(root, "source")); const history = rows("clipboard"); saveRows("clipboard", [{ id: uid(), text: value(root, "source"), at: new Date().toISOString() }, ...history].slice(0, 30)); setOutput(root, "Đã ghi clipboard theo thao tác của bạn."); }
    else if (action === "clipboard-read") { const text = await navigator.clipboard.readText(); root.querySelector('[name="source"]').value = text; setOutput(root, rows("clipboard").map((item) => `${item.at}\n${item.text}`).join("\n---\n") || text); }
    else if (action === "clipboard-clear") { saveRows("clipboard", []); setOutput(root, "Đã xóa lịch sử clipboard của Tool."); }
    else if (action === "quick-toggle") root.querySelector("[data-ut-floating]").hidden = !root.querySelector("[data-ut-floating]").hidden;
    else if (action === "preferences-save") {
      const preferences = { theme: value(root, "pref-theme"), density: value(root, "pref-density"), language: value(root, "pref-language"), reducedMotion: Boolean(root.querySelector('[name="pref-motion"]')?.checked), highContrast: Boolean(root.querySelector('[name="pref-contrast"]')?.checked) };
      const store = readStore(); store.preferences = preferences; writeStore(store);
      document.documentElement.lang = preferences.language;
      document.documentElement.dataset.theme = preferences.theme;
      document.documentElement.dataset.density = preferences.density;
      document.documentElement.classList.toggle("reduce-motion", preferences.reducedMotion);
      document.documentElement.classList.toggle("high-contrast", preferences.highContrast);
      setOutput(root, `Đã áp dụng: ${preferences.theme} · ${preferences.density} · ${preferences.language}`);
    }
    else if (action === "language-apply") { document.documentElement.lang = value(root, "language"); localStorage.setItem("hh-language", value(root, "language")); setOutput(root, `Đã áp dụng ngôn ngữ ${value(root, "language")}.`); }
    else if (action === "weather-load") { runtime.controller = new AbortController(); const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(value(root, "lat"))}&longitude=${encodeURIComponent(value(root, "lon"))}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code`, { signal: runtime.controller.signal }); const data = await response.json(); if (!response.ok || !data.current) throw new Error(data.reason || "Không tải được thời tiết."); setOutput(root, `Nhiệt độ: ${data.current.temperature_2m} °C\nĐộ ẩm: ${data.current.relative_humidity_2m}%\nGió: ${data.current.wind_speed_10m} km/h\nWeather code: ${data.current.weather_code}\nCập nhật: ${data.current.time}`); }
    else if (action === "system-inspect") setOutput(root, await systemReport(tool.id));
    else if (action === "network-measure") { runtime.controller = new AbortController(); const start = performance.now(), response = await fetch(`assets/hh-neon-logo-v2.png?v=3&speed=${Date.now()}`, { cache: "no-store", signal: runtime.controller.signal }); const blob = await response.blob(), elapsed = Math.max(1, performance.now() - start), mbps = blob.size * 8 / elapsed / 1000; setOutput(root, `Tệp thử: ${(blob.size / 1024).toFixed(1)} KB\nThời gian: ${elapsed.toFixed(0)} ms\nThroughput phiên: ${mbps.toFixed(2)} Mbps\nNetwork Information: ${navigator.connection?.effectiveType || "không hỗ trợ"}`); }
    else if (action === "analytics-refresh") renderAnalytics(root);
    else if (action === "notification-add") { const title = value(root, "title").trim(); if (!title) throw new Error("Nhập nội dung thông báo."); saveRows("notifications", [{ id: uid(), title, at: new Date().toISOString(), read: false }, ...rows("notifications")]); renderList(root, tool); }
    else if (action === "notification-read") { saveRows("notifications", rows("notifications").map((item) => ({ ...item, read: true }))); renderList(root, tool); }
    else if (action === "notification-clear") { saveRows("notifications", []); renderList(root, tool); }
    else if (action === "smart-search") { const query = value(root, "query").toLowerCase(); const found = [...document.querySelectorAll("[data-app-route]")].map((node) => ({ route: node.dataset.appRoute, text: node.textContent.trim().replace(/\s+/g, " ") })).filter((item, index, all) => item.route && item.text.toLowerCase().includes(query) && all.findIndex((other) => other.route === item.route) === index).slice(0, 40); setOutput(root, found.map((item) => `${item.text}\n${item.route}`).join("\n\n") || "Không tìm thấy."); }
    else if (action === "context-toggle") { const menu = root.querySelector("[data-ut-context]"); menu.hidden = !menu.hidden; }
    else if (action === "toolbar-toggle") { const toolbar = root.querySelector("[data-ut-toolbar]"); toolbar.hidden = !toolbar.hidden; }
    else if (action === "qr-scan") { const file = root.querySelector('[name="qr-file"]')?.files?.[0]; if (!file) throw new Error("Chọn ảnh QR trước."); if (!("BarcodeDetector" in global)) throw new Error("Trình duyệt chưa hỗ trợ BarcodeDetector. Hãy dùng Chrome/Edge mới hoặc QR Toolkit."); const detector = new BarcodeDetector({ formats: ["qr_code"] }); const codes = await detector.detect(await createImageBitmap(file)); setOutput(root, codes.map((code) => code.rawValue).join("\n") || "Không phát hiện QR trong ảnh."); }
    record(tool.id, action, root.querySelector("[data-ut-output]")?.textContent || "Hoàn thành");
  }

  function convertUnit(amount, from, to) {
    if ([from, to].every((unit) => ["c", "f"].includes(unit))) { const result = from === to ? amount : from === "c" ? amount * 9 / 5 + 32 : (amount - 32) * 5 / 9; return `${amount} °${from.toUpperCase()} = ${result.toFixed(2)} °${to.toUpperCase()}`; }
    const factor = { km: 1000, m: 1, cm: .01, kg: 1, g: .001 };
    const kind = (unit) => ["km", "m", "cm"].includes(unit) ? "length" : ["kg", "g"].includes(unit) ? "mass" : "other";
    if (!factor[from] || !factor[to] || kind(from) !== kind(to)) throw new Error("Hai đơn vị không cùng loại.");
    return `${amount} ${from} = ${(amount * factor[from] / factor[to]).toLocaleString("vi-VN", { maximumFractionDigits: 8 })} ${to}`;
  }

  function runTimer(root, tool, action) {
    const display = root.querySelector("[data-ut-timer]");
    if (action === "timer-pause" || action === "focus-stop") { clearInterval(runtime.timer); runtime.timer = null; document.body.classList.remove("ut-focus-active"); return; }
    if (action === "timer-reset") { clearInterval(runtime.timer); runtime.timer = null; display.textContent = "00:00"; return; }
    if (action === "focus-toggle") document.body.classList.toggle("ut-focus-active");
    clearInterval(runtime.timer);
    let seconds = tool.id === "stopwatch" ? 0 : Math.max(1, Number(value(root, "minutes")) || 1) * 60;
    const paint = () => { display.textContent = `${String(Math.floor(Math.abs(seconds) / 60)).padStart(2, "0")}:${String(Math.abs(seconds) % 60).padStart(2, "0")}`; };
    paint(); runtime.timer = setInterval(() => { seconds += tool.id === "stopwatch" ? 1 : -1; paint(); if (seconds <= 0 && tool.id !== "stopwatch") { clearInterval(runtime.timer); runtime.timer = null; display.textContent = "Hoàn thành"; } }, 1000);
  }

  function renderDashboard(root) {
    const target = root.querySelector("[data-ut-dashboard]"); if (!target) return;
    const store = readStore(), metrics = [{ label: "Ghi chú", value: (store.notes || []).length }, { label: "Todo chưa xong", value: (store.todo || []).filter((item) => !item.done).length }, { label: "Kanban đang làm", value: (store.kanban || []).filter((item) => item.column === "doing").length }, { label: "Nhắc việc", value: (store.reminder || []).length }, { label: "Bookmark", value: (store.bookmark || []).length }, { label: "Hoạt động", value: (store.activity || []).length }];
    target.innerHTML = metrics.map((item) => `<article><span>${esc(item.label)}</span><strong>${item.value}</strong></article>`).join("");
  }
  function renderAnalytics(root) {
    const target = root.querySelector("[data-ut-analytics]"); if (!target) return;
    const issues = (() => { try { return JSON.parse(localStorage.getItem("hh.runtime.issues.v1") || "[]"); } catch { return []; } })();
    const activity = rows("activity"), routes = activity.filter((item) => item.action?.includes("route")).length;
    target.innerHTML = [{ label: "Event công bố", value: activity.length }, { label: "Route mở", value: routes }, { label: "Lỗi runtime", value: issues.length }, { label: "Online", value: navigator.onLine ? "Có" : "Không" }].map((item) => `<article><span>${esc(item.label)}</span><strong>${esc(item.value)}</strong></article>`).join("");
  }
  async function systemReport(id) {
    const report = [`Online: ${navigator.onLine}`, `CPU logic: ${navigator.hardwareConcurrency || "không hỗ trợ"}`, `Device memory: ${navigator.deviceMemory ? `${navigator.deviceMemory} GB (ước tính)` : "không hỗ trợ"}`, `Viewport: ${innerWidth}×${innerHeight}`, `Language: ${navigator.language}`, `Platform: ${navigator.userAgentData?.platform || navigator.platform || "N/A"}`];
    if (navigator.storage?.estimate) { const estimate = await navigator.storage.estimate(); report.push(`Storage: ${((estimate.usage || 0) / 1048576).toFixed(1)} MB / ${((estimate.quota || 0) / 1073741824).toFixed(1)} GB`); }
    if (id === "memory-usage") report.push(`JS heap: ${performance.memory ? `${(performance.memory.usedJSHeapSize / 1048576).toFixed(1)} / ${(performance.memory.jsHeapSizeLimit / 1073741824).toFixed(1)} GB` : "không được trình duyệt cung cấp"}`);
    return report.join("\n");
  }

  function cleanup() { runtime.controller?.abort(); clearInterval(runtime.timer); clearInterval(runtime.clock); runtime.cleanup.splice(0).forEach((fn) => fn()); document.body.classList.remove("ut-focus-active"); }
  function mount(host, options = {}) {
    cleanup();
    const tool = byId.get(options.toolId) || byName.get(options.name) || byId.get(slug(options.toolId || options.name));
    if (!host || !tool) return null;
    host.innerHTML = tool.group === "developer" ? developerMarkup(tool) : tool.group === "productivity" ? productivityMarkup(tool) : systemMarkup(tool);
    const root = host.firstElementChild;
    renderList(root, tool); renderDashboard(root); renderAnalytics(root);
    if (tool.id === "clock") { const paint = () => { root.querySelector("[data-ut-clock]").textContent = new Date().toLocaleTimeString("vi-VN"); root.querySelector("[data-ut-date]").textContent = new Date().toLocaleDateString("vi-VN", { dateStyle: "full" }); }; paint(); runtime.clock = setInterval(paint, 1000); }
    const onClick = async (event) => {
      const toggle = event.target.closest("[data-ut-record-toggle]");
      const remove = event.target.closest("[data-ut-record-delete]");
      if (toggle || remove) { const key = tool.id === "notification-center" ? "notifications" : tool.id, id = (toggle || remove).dataset.utRecordToggle || (toggle || remove).dataset.utRecordDelete, data = rows(key); saveRows(key, remove ? data.filter((item) => item.id !== id) : data.map((item) => item.id === id ? { ...item, done: !item.done, read: !item.read, column: item.column === "done" ? "backlog" : "done" } : item)); renderList(root, tool); return; }
      const action = event.target.closest("[data-ut-action]")?.dataset.utAction; if (!action) return;
      event.preventDefault(); event.stopPropagation(); const status = root.querySelector("[data-ut-status]"); status.textContent = "Đang xử lý..."; status.dataset.state = "running";
      try { await runAction(root, tool, action); if (status.dataset.state === "running") { status.textContent = "Hoàn thành"; status.dataset.state = "success"; } }
      catch (error) { setOutput(root, error?.name === "AbortError" ? "Đã hủy tác vụ." : error?.message || "Không thể hoàn thành.", "error"); }
    };
    const onContext = (event) => { if (tool.id !== "context-menu") return; event.preventDefault(); const menu = root.querySelector("[data-ut-context]"); menu.hidden = false; menu.style.left = `${Math.min(event.offsetX, root.clientWidth - 190)}px`; menu.style.top = `${event.offsetY}px`; };
    root.addEventListener("click", onClick); root.addEventListener("contextmenu", onContext);
    runtime.cleanup.push(() => root.removeEventListener("click", onClick), () => root.removeEventListener("contextmenu", onContext));
    return { root, cleanup };
  }

  global.HHUtilityTools = Object.freeze({ manifests: () => manifests.map((item) => ({ ...item })), supports: (value) => byId.has(value) || byName.has(value) || byId.has(slug(value)), mount, cleanup, safeCalculate });
})(window);
