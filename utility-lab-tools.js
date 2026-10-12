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
  const STORE_KEY = "hh.utility-tools.v2";
  const SENSITIVE = /password|secret|token|authorization|cookie|api[-_]?key/i;
  const runtime = { controller: null, timer: null, clock: null, cleanup: [], logs: [], scope: null, root: null, editId: null, generation: 0 };
  const sessionDrafts = new Map();
  const privateFormTools = new Set(["api-tester", "password-toolkit", "hash-generator", "clipboard-manager", "clipboard-history", "console-log-viewer"]);
  const accountScope = () => {
    if (global.HHAllToolState?.accountScope) return global.HHAllToolState.accountScope();
    try { const user = global.HHAuthz?.currentUser?.() || JSON.parse(localStorage.getItem("hh-auth-user") || "null"); const identity = user?.id || user?._id || user?.sub; return identity ? `account:${encodeURIComponent(String(identity))}` : "guest"; } catch { return "guest"; }
  };
  const storeKey = () => `${STORE_KEY}.${runtime.scope || accountScope()}`;
  const guardScope = () => { if (runtime.scope && runtime.scope !== accountScope()) throw new Error("Tài khoản đã thay đổi. Mở lại công cụ để dùng dữ liệu của tài khoản hiện tại."); };
  // The old unscoped v1 store is intentionally retained but never attributed to a user.
  const readStore = () => { guardScope(); try { const data = JSON.parse(localStorage.getItem(storeKey()) || "{}"); return data && typeof data === "object" && !Array.isArray(data) ? data : {}; } catch { return {}; } };
  const writeStore = (data) => { guardScope(); try { localStorage.setItem(storeKey(), JSON.stringify(data)); } catch { throw new Error("Không lưu được trên thiết bị. Dữ liệu đang nhập vẫn còn; hãy xuất bản sao hoặc giải phóng dung lượng."); } };
  const rows = (key) => Array.isArray(readStore()[key]) ? readStore()[key] : [];
  const saveRows = (key, value) => { const store = readStore(); store[key] = value.slice(0, 250); writeStore(store); };
  const uid = () => global.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const download = (name, content, type = "text/plain;charset=utf-8") => { const a = document.createElement("a"); a.href = URL.createObjectURL(content instanceof Blob ? content : new Blob([content], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };
  const value = (root, name) => root.querySelector(`[name="${name}"]`)?.value || "";
  const setOutput = (root, content, state = "success") => { const output = root.querySelector("[data-ut-output]"); if (output) output.textContent = String(content ?? ""); const status = root.querySelector("[data-ut-status]"); if (status) { status.textContent = state === "error" ? String(content || "Có lỗi").split("\n")[0].slice(0, 220) : state === "running" ? "Đang chạy" : "Hoàn thành"; status.dataset.state = state; } };
  // Activity stores only action metadata, never generated passwords, source text or API responses.
  const record = (tool, action) => { const current = rows("activity"); saveRows("activity", [{ id: uid(), tool, action, at: new Date().toISOString() }, ...current]); };
  const selected = (a, b) => a === b ? "selected" : "";
  const COLUMNS = Object.freeze({ backlog: "Cần làm", doing: "Đang làm", done: "Hoàn thành" });
  const taskOptions = (column) => Object.entries(COLUMNS).map(([id, label]) => `<option value="${id}" ${selected(column, id)}>${label}</option>`).join("");
  const localHint = "Công cụ độc lập · lưu trên thiết bị theo tài khoản · không đồng bộ với workspace khác.";

  function shell(tool, body, hint = "Dữ liệu được xử lý trên thiết bị khi trình duyệt hỗ trợ.") {
    return `<section class="ut-workspace ut-workspace--${esc(tool.group)}" data-ut-tool="${esc(tool.id)}" data-ut-kind="${esc(tool.id)}">
      <header class="ut-head"><div><small>${esc(tool.group.toUpperCase())} · BROWSER TOOL</small><h3>${esc(tool.name)}</h3><p>${esc(hint)}</p></div><div class="ut-badges"><span>Sẵn sàng</span><span>${tool.offline ? "Offline" : "Cần mạng"}</span></div></header>
      <div class="ut-status" data-ut-status role="status" aria-live="polite">Sẵn sàng.</div>${body}
    </section>`;
  }
  const field = (label, control, help = "") => `<label class="ut-field"><span>${esc(label)}</span>${control}${help ? `<small>${esc(help)}</small>` : ""}</label>`;
  const actions = (...items) => `<div class="ut-actions">${items.map(([id, label, primary]) => `<button type="button" class="ut-button ${primary ? "is-primary" : ""}" data-ut-action="${id}">${esc(label)}</button>`).join("")}</div>`;
  const result = (label = "Kết quả") => `<section class="ut-result"><header><strong>${esc(label)}</strong><button type="button" data-ut-action="copy-output">Sao chép</button></header><pre data-ut-output>Chưa có kết quả.</pre></section>`;
  const two = (main, side) => `<div class="ut-layout"><main>${main}</main><aside>${side}</aside></div>`;

  function editorMarkup(tool) {
    const configs = {
      "markdown-editor": ["Markdown", "# Tiêu đề\n\nViết **nội dung** ở đây...", [["render-markdown", "Xem trước", true], ["export-markdown", "Xuất .md"]]],
      "json-viewer": ["JSON", '{\n  "name": "HH Platform"\n}', [["json-tree", "Cây dữ liệu", true], ["format-json", "Định dạng"], ["validate-json", "Kiểm tra"]]],
      "json-formatter": ["JSON", '{"status":"ready"}', [["format-json", "Định dạng", true], ["minify-json", "Thu gọn"]]],
      "code-viewer": ["Mã nguồn", "function hello() {\n  return 'HH';\n}", [["number-code", "Đánh số dòng", true], ["export-code", "Xuất file"]]],
      "base64-encoder": ["Văn bản / Base64", "HH Platform", [["base64-encode", "Mã hóa", true], ["base64-decode", "Giải mã"]]],
      "dev-utilities": ["Văn bản", "HH Platform Developer Tools", [["text-stats", "Thống kê", true], ["slugify", "Tạo slug"], ["url-encode", "URL encode"], ["url-decode", "URL decode"], ["html-escape", "Escape HTML"]]]
    };
    const [label, placeholder, buttons] = configs[tool.id];
    const extra = tool.id === "base64-encoder" ? '<label class="ut-check"><input name="base64-url" type="checkbox">Base64 URL-safe</label>' : tool.id === "code-viewer" ? field("Tên file xuất", '<input name="filename" value="code.txt" maxlength="120">') : '';
    return shell(tool, two(`<section class="ut-card">${field(label, `<textarea name="source" spellcheck="false">${esc(placeholder)}</textarea>`)}${extra}${actions(...buttons)}</section>`, result(tool.id === "markdown-editor" ? "Xem trước an toàn" : "Kết quả")));
  }

  function developerMarkup(tool) {
    if (["markdown-editor", "json-viewer", "json-formatter", "code-viewer", "base64-encoder", "dev-utilities"].includes(tool.id)) return editorMarkup(tool);
    if (tool.id === "api-tester") return shell(tool, two(`<section class="ut-card"><div class="ut-inline"><select name="method"><option>GET</option><option>POST</option><option>PUT</option><option>PATCH</option><option>DELETE</option></select><input name="url" type="url" placeholder="https://api.example.com/data"></div>${field("Headers JSON", '<textarea name="headers">{}</textarea>')}${field("Body", '<textarea name="body"></textarea>')}${actions(["api-run", "Gửi yêu cầu", true], ["cancel", "Hủy"])}</section>`, result("HTTP response")), "Chỉ gửi yêu cầu khi người dùng bấm chạy; header nhạy cảm không được lưu lịch sử.");
    if (tool.id === "regex-playground") return shell(tool, two(`<section class="ut-card"><div class="ut-inline">${field("Pattern", '<input name="pattern" placeholder="\\b[A-Z][a-z]+\\b" maxlength="1000">')}${field("Flags", '<input name="flags" value="gimu" maxlength="8">')}</div>${field("Văn bản", '<textarea name="source" maxlength="100000">HH Platform\nDeveloper Tools</textarea>')}${field("Thay thế", '<input name="replacement" placeholder="Tùy chọn">')}${actions(["regex-run", "Tìm khớp", true], ["regex-replace", "Thay thế"], ["cancel", "Hủy"])}</section>`, result("Match và vị trí")), "Regex chạy trong worker riêng, giới hạn 1.000 match và tự dừng sau 1 giây để không treo giao diện.");
    if (tool.id === "text-compare") return shell(tool, `<section class="ut-card ut-compare">${field("Bản A", '<textarea name="left"></textarea>')}${field("Bản B", '<textarea name="right"></textarea>')}${actions(["compare", "So sánh theo dòng", true])}</section>${result("Khác biệt")}`);
    if (tool.id === "terminal-simulator") return shell(tool, two(`<section class="ut-card">${field("Lệnh sandbox", '<input name="command" value="help" autocomplete="off">', "Chỉ hỗ trợ help, clear, echo, date, whoami, pwd, ls tools và history.")}${actions(["terminal-run", "Chạy lệnh", true], ["terminal-clear", "Xóa màn hình"])}</section>`, result("HH Local Sandbox")), "Sandbox cục bộ; không truy cập PowerShell, CMD hoặc file hệ điều hành.");
    if (tool.id === "git-cheat-sheet") return shell(tool, two(`<section class="ut-card">${field("Tìm tình huống Git", '<input name="query" placeholder="branch, rebase, undo, stash...">')}${actions(["git-search", "Tìm lệnh", true])}</section>`, result("Lệnh và giải thích")));
    if (tool.id === "github-integration") return shell(tool, two(`<section class="ut-card"><div class="ut-inline"><input name="owner" placeholder="owner" value="hoangdaika13"><input name="repo" placeholder="repository" value="hoangdaika13.github.io"></div>${actions(["github-load", "Đọc repository công khai", true], ["cancel", "Hủy"])}</section>`, result("GitHub repository")), "Chỉ đọc metadata repository công khai từ api.github.com; không lưu token.");
    if (["console-log-viewer", "error-monitor"].includes(tool.id)) return shell(tool, two(`<section class="ut-card"><p>Chỉ đọc sự kiện lỗi khi công cụ này đang mở; không chặn hoặc thay đổi console của website.</p>${tool.id === "console-log-viewer" ? `${field("Log do bạn nhập", '<input name="log-message" maxlength="500" placeholder="Nội dung log thử nghiệm">')}${actions(["runtime-add", "Ghi log cục bộ", true])}` : ""}${actions(["runtime-refresh", "Làm mới", true], ["runtime-clear", "Xóa bản phiên"], ["export-output", "Xuất log"])}</section>`, result(tool.id === "error-monitor" ? "Lỗi bắt được trong phiên công cụ" : "Log phiên công cụ")));
    if (tool.id === "uuid-generator") return shell(tool, two(`<section class="ut-card">${field("Số lượng", '<input name="count" type="number" min="1" max="100" value="5">')}${actions(["uuid-generate", "Tạo UUID", true], ["export-output", "Xuất"] )}</section>`, result("UUID v4")));
    if (tool.id === "hash-generator") return shell(tool, two(`<section class="ut-card"><div class="ut-inline">${field("Thuật toán", '<select name="algorithm"><option>SHA-256</option><option>SHA-384</option><option>SHA-512</option></select>')}${field("Định dạng", '<select name="encoding"><option value="hex">Hex</option><option value="base64">Base64</option><option value="base64url">Base64 URL-safe</option></select>')}</div>${field("Văn bản", '<textarea name="source"></textarea>')}${actions(["hash-run", "Tạo hash", true])}</section>`, result("Digest")), "Hash không phải mã hóa mật khẩu. Văn bản và digest không lưu vào lịch sử.");
    if (tool.id === "timestamp-converter") return shell(tool, two(`<section class="ut-card">${field("Ngày giờ", '<input name="source" placeholder="2026-07-23T10:00:00Z hoặc 1784800800">')}${field("Định dạng đầu vào", '<select name="time-format"><option value="auto">Tự nhận dạng</option><option value="seconds">Unix giây</option><option value="milliseconds">Unix mili giây</option><option value="date">ISO / ngày giờ</option></select>')}${actions(["timestamp-run", "Chuyển đổi", true], ["timestamp-now", "Dùng hiện tại"])}</section>`, result("Các định dạng thời gian")));
    return shell(tool, `<section class="ut-card"><p>Công cụ đã được đăng ký nhưng chưa có renderer.</p></section>`);
  }

  const recordTools = new Set(["notes", "todo", "kanban", "calendar", "reminder", "activity-timeline", "recent-files", "pinned-tools", "bookmark"]);
  function recordMarkup(tool) {
    const presets = {
      notes: ["Tiêu đề ghi chú", "Nội dung"], todo: ["Công việc", "Mô tả"], kanban: ["Thẻ Kanban", "Mô tả"], calendar: ["Sự kiện", "Ghi chú"], reminder: ["Nhắc việc", "Nội dung"],
      "activity-timeline": ["Hoạt động", "Chi tiết"], "recent-files": ["Tên file", "Đường dẫn/ghi chú"], "pinned-tools": ["Tên công cụ", "Route"], bookmark: ["Tên bookmark", "URL"]
    };
    const labels = presets[tool.id];
    if (tool.id === "activity-timeline") return shell(tool, `${actions(["record-refresh", "Làm mới", true], ["activity-clear", "Xóa nhật ký của Tool"], ["record-export", "Xuất JSON"])}<section class="ut-list ut-timeline" data-ut-list></section>`, "Nhật ký thao tác thực trong các công cụ All Tools của tài khoản này. Không ghi nội dung văn bản, mật khẩu, token hoặc response API.");
    if (tool.id === "recent-files") return shell(tool, `<section class="ut-card">${field("Thêm file vào danh sách gần đây", '<input name="recent-file" type="file" multiple>', "Chỉ lưu tên, kích thước và ngày sửa; không tải lên hoặc lưu nội dung file.")}${actions(["files-add", "Ghi nhận file đã chọn", true], ["record-export", "Xuất danh sách"])}</section><section class="ut-list" data-ut-list></section>`, localHint);
    const isNote = tool.id === "notes", isTask = ["todo", "kanban"].includes(tool.id), isDate = ["calendar", "reminder"].includes(tool.id);
    const title = tool.id === "pinned-tools" ? field(labels[0], `<select name="title">${manifests.map((item) => `<option value="${esc(item.name)}">${esc(item.name)}</option>`).join("")}</select>`) : field(labels[0], `<input name="title" maxlength="180" placeholder="${esc(labels[0])}">`);
    const content = tool.id === "pinned-tools" ? "" : field(labels[1], isNote ? '<textarea name="meta" placeholder="Ghi chú của riêng công cụ Notes" maxlength="40000"></textarea>' : `<input name="meta" maxlength="2000" ${tool.id === "bookmark" ? 'type="url" placeholder="https://…"' : `placeholder="${esc(labels[1])}"`}>`);
    const additional = isTask ? field("Trạng thái", `<select name="column">${taskOptions("backlog")}</select>`) : isDate ? field("Thời gian trên thiết bị", '<input name="date" type="datetime-local">') : "";
    return shell(tool, `<section class="ut-card ut-record-editor"><div class="ut-inline">${title}${additional}</div>${content}${actions(["record-add", "Lưu mục", true], ["record-cancel", "Hủy sửa"], ["record-export", "Xuất JSON"], ...(tool.id === "calendar" ? [["calendar-export", "Xuất lịch .ics"]] : []))}<span data-ut-edit-status>Thêm mục mới</span></section>${field("Lọc danh sách", '<input name="record-search" type="search" placeholder="Tìm trong mục này">')}<section class="ut-list ${tool.id === "kanban" ? "ut-kanban" : isNote ? "ut-notes" : isDate ? "ut-schedule" : ""}" data-ut-list></section>`, tool.id === "reminder" ? `${localHint} Nhắc việc chỉ cập nhật khi công cụ đang mở; không có dịch vụ nhắc nền.` : localHint);
  }

  function productivityMarkup(tool) {
    if (recordTools.has(tool.id)) return recordMarkup(tool);
    if (tool.id === "productivity-dashboard") return shell(tool, `<section class="ut-metrics" data-ut-dashboard></section>${actions(["dashboard-refresh", "Làm mới", true], ["record-export-all", "Xuất dữ liệu"])}`);
    if (["pomodoro", "stopwatch", "countdown"].includes(tool.id)) return shell(tool, `<section class="ut-timer"><small data-ut-phase>${esc(tool.name)}</small><strong data-ut-timer>00:00</strong>${tool.id === "stopwatch" ? "" : field("Số phút tập trung", `<input name="minutes" type="number" min="1" max="720" value="${tool.id === "pomodoro" ? 25 : 5}">`)}${tool.id === "pomodoro" ? `${field("Phút nghỉ", '<input name="break-minutes" type="number" min="1" max="180" value="5">')}<div class="ut-presets">${[25, 45, 50, 90].map((minutes) => `<button type="button" data-ut-preset="${minutes}">${minutes}/${minutes === 25 ? 5 : minutes === 45 ? 15 : minutes === 50 ? 10 : 20}</button>`).join("")}</div>${actions(["timer-break", "Chuyển học / nghỉ"] )}` : ""}${actions(["timer-start", "Bắt đầu / tiếp tục", true], ["timer-pause", "Tạm dừng"], ["timer-reset", "Đặt lại"], ...(tool.id === "stopwatch" ? [["timer-lap", "Ghi vòng"]] : []))}<div data-ut-laps></div><p class="ut-muted">Mốc thời gian lưu theo tài khoản; chuyển công cụ và reload không làm chạy sai đồng hồ. Không tự phát âm thanh.</p></section>`, localHint);
    if (tool.id === "calculator") return shell(tool, two(`<section class="ut-card">${field("Biểu thức", '<input name="expression" inputmode="decimal" value="(25 + 5) * 2">', "Hỗ trợ + − × ÷ % và ngoặc; không dùng eval/Function.")}${actions(["calculate", "Tính", true])}</section>`, result("Kết quả")));
    if (tool.id === "unit-converter") { const units = ["m", "km", "cm", "mm", "in", "ft", "mi", "kg", "g", "lb", "oz", "l", "ml", "s", "min", "h", "c", "f", "k", "kmh", "ms", "mph"]; return shell(tool, two(`<section class="ut-card">${field("Giá trị", '<input name="amount" type="number" value="1" step="any">')}<div class="ut-inline">${field("Từ", `<select name="from">${units.map((unit) => `<option value="${unit}" ${selected(unit, "km")}>${unit}</option>`).join("")}</select>`)}${field("Đến", `<select name="to">${units.map((unit) => `<option value="${unit}">${unit}</option>`).join("")}</select>`)}</div>${actions(["convert-unit", "Chuyển đổi", true], ["unit-swap", "Đảo chiều"])}</section>`, result("Độ dài · khối lượng · nhiệt độ · thể tích · thời gian · vận tốc"))); }
    if (tool.id === "lorem-ipsum") return shell(tool, two(`<section class="ut-card">${field("Số đoạn", '<input name="count" type="number" min="1" max="30" value="3">')}${actions(["lorem-generate", "Tạo nội dung", true])}</section>`, result("Lorem Ipsum")));
    if (tool.id === "password-toolkit") return shell(tool, two(`<section class="ut-card">${field("Độ dài", '<input name="length" type="number" min="12" max="128" value="24">')}<div class="ut-checks"><label><input name="symbols" type="checkbox" checked>Ký hiệu</label><label><input name="numbers" type="checkbox" checked>Số</label></div>${actions(["password-generate", "Tạo bằng crypto", true])}</section>`, result("Mật khẩu chỉ hiển thị trong phiên")), "Mật khẩu được tạo bằng crypto.getRandomValues và không được lưu lịch sử.");
    if (["clipboard-manager", "clipboard-history"].includes(tool.id)) return shell(tool, two(`<section class="ut-card">${field("Nội dung", '<textarea name="source"></textarea>')}<label class="ut-check"><input name="clipboard-remember" type="checkbox">Lưu bản sao cục bộ (không nên dùng với mật khẩu/token)</label>${actions(["clipboard-write", "Ghi clipboard", true], ["clipboard-read", "Đọc clipboard"], ["clipboard-clear", "Xóa lịch sử"])}</section>`, `${tool.id === "clipboard-history" ? '<section class="ut-list" data-ut-clipboard-list></section>' : ""}${result("Clipboard theo thao tác chủ động")}`), "Chỉ xin quyền sau thao tác. Lịch sử chỉ lưu khi bạn bật tùy chọn và được tách theo tài khoản.");
    if (tool.id === "floating-quick-actions") return shell(tool, `<section class="ut-card"><p>Thanh thao tác chỉ thuộc công cụ này, không thay đổi sidebar hoặc khung HH Platform.</p>${actions(["quick-toggle", "Bật/tắt thanh nhanh", true])}</section><div class="ut-floating" data-ut-floating hidden><button data-ut-action="quick-copy">Sao chép thời gian</button><button data-ut-action="quick-export">Xuất nhật ký</button><button data-ut-action="quick-toggle">Đóng</button></div>${result("Thao tác nhanh cục bộ")}`);
    if (tool.id === "focus-mode") return shell(tool, `<section class="ut-card"><p>Thu gọn điều khiển của công cụ này, giữ nguyên giao diện và điều hướng website.</p>${field("Số phút", '<input name="minutes" type="number" min="1" max="180" value="25">')}${actions(["focus-toggle", "Bật / tắt Focus Mode", true], ["timer-start", "Chạy / tiếp tục"], ["timer-pause", "Tạm dừng"], ["focus-stop", "Kết thúc"])}</section><section class="ut-timer"><strong data-ut-timer>25:00</strong></section>`, localHint);
    if (tool.id === "user-preferences-center") {
      const prefs = readStore().preferences || {};
      return shell(tool, two(`<section class="ut-card">
        ${field("Chế độ màu", `<select name="pref-theme"><option value="system" ${prefs.theme === "system" ? "selected" : ""}>Theo hệ thống</option><option value="dark" ${prefs.theme === "dark" ? "selected" : ""}>Tối</option><option value="light" ${prefs.theme === "light" ? "selected" : ""}>Sáng</option></select>`)}
        ${field("Mật độ giao diện", `<select name="pref-density"><option value="comfortable" ${prefs.density !== "compact" ? "selected" : ""}>Thoải mái</option><option value="compact" ${prefs.density === "compact" ? "selected" : ""}>Gọn</option></select>`)}
        ${field("Ngôn ngữ", `<select name="pref-language"><option value="vi" ${prefs.language !== "en" ? "selected" : ""}>Tiếng Việt</option><option value="en" ${prefs.language === "en" ? "selected" : ""}>English</option></select>`)}
        <div class="ut-checks"><label><input name="pref-motion" type="checkbox" ${prefs.reducedMotion ? "checked" : ""}>Giảm chuyển động</label><label><input name="pref-contrast" type="checkbox" ${prefs.highContrast ? "checked" : ""}>Tương phản cao</label></div>
        ${actions(["preferences-save", "Lưu tùy chọn", true])}<small>Để về mặc định, chọn “Theo hệ thống” và “Thoải mái”, rồi lưu.</small>
      </section>`, result("Tùy chọn riêng của All Tools")), "Chỉ thay đổi workspace công cụ. Không thay đổi theme, ngôn ngữ hoặc bố cục chính của website.");
    }
    return shell(tool, `<section class="ut-card"><p>Workspace năng suất đang sẵn sàng.</p></section>`);
  }

  function systemMarkup(tool) {
    if (tool.id === "multi-language") return shell(tool, two(`<section class="ut-card">${field("Ngôn ngữ xem trước", '<select name="language"><option value="vi">Tiếng Việt</option><option value="en">English</option></select>')}${field("Mẫu văn bản có bản dịch", '<select name="phrase"><option value="welcome">Chào mừng</option><option value="save">Lưu dữ liệu</option><option value="empty">Chưa có dữ liệu</option><option value="error">Không thể hoàn thành</option><option value="ready">Sẵn sàng</option></select>')}${actions(["language-preview", "Xem bản dịch", true])}</section>`, result("Bộ mẫu giao diện Việt / Anh")), "Bản dịch được biên soạn sẵn cho mẫu giao diện, không phải dịch AI hoặc dịch văn bản tự do.");
    if (tool.id === "language-switcher") return shell(tool, two(`<section class="ut-card">${field("Ngôn ngữ trạng thái công cụ", '<select name="language"><option value="vi">Tiếng Việt</option><option value="en">English</option></select>')}${actions(["language-apply", "Lưu ngôn ngữ", true])}</section>`, result("Ngôn ngữ và định dạng ngày giờ")), "Ngôn ngữ được lưu riêng cho All Tools. Không thay đổi nội dung, route hoặc giao diện chính của website.");
    if (tool.id === "weather-widget") return shell(tool, two(`<section class="ut-card"><div class="ut-inline"><input name="lat" value="21.0285" aria-label="Vĩ độ"><input name="lon" value="105.8542" aria-label="Kinh độ"></div>${actions(["weather-load", "Lấy thời tiết", true], ["cancel", "Hủy"])}</section>`, result("Open-Meteo hiện tại")));
    if (tool.id === "clock") return shell(tool, `<section class="ut-card">${field("Múi giờ", `<select name="timezone">${["Asia/Ho_Chi_Minh", "Asia/Bangkok", "Asia/Tokyo", "Europe/London", "America/New_York", "UTC"].map((zone) => `<option>${zone}</option>`).join("")}</select>`)}</section><section class="ut-clock"><strong data-ut-clock></strong><span data-ut-date></span></section>`);
    if (["system-status", "memory-usage", "storage-usage"].includes(tool.id)) return shell(tool, two(`<section class="ut-card"><p>Đọc khả năng trình duyệt hiện tại; không giả lập RAM/CPU của hệ điều hành.</p>${actions(["system-inspect", "Đo lại", true], ["export-output", "Xuất"] )}</section>`, result("Báo cáo thiết bị")));
    if (tool.id === "network-speed") return shell(tool, two(`<section class="ut-card"><p>Tải một tài nguyên tĩnh của HH để đo thời gian và throughput thực tế trong phiên.</p>${actions(["network-measure", "Bắt đầu đo", true], ["cancel", "Hủy"])}</section>`, result("Kết quả mạng")));
    if (tool.id === "analytics-dashboard") return shell(tool, `<section class="ut-metrics" data-ut-analytics></section><p class="ut-privacy">Chỉ tổng hợp thao tác của tài khoản trong bộ công cụ này; không đọc nội dung biểu mẫu, mật khẩu hoặc token.</p>${actions(["analytics-refresh", "Làm mới", true], ["export-output", "Xuất báo cáo"])}${result("Báo cáo All Tools cục bộ")}`);
    if (tool.id === "notification-center") return shell(tool, `<section class="ut-card">${field("Thông báo mới", '<input name="title" placeholder="Nội dung thông báo">')}${actions(["notification-add", "Thêm", true], ["notification-read", "Đánh dấu đã đọc"], ["notification-clear", "Xóa tất cả"])}</section><section class="ut-list" data-ut-list></section>`);
    if (tool.id === "smart-search") return shell(tool, two(`<section class="ut-card">${field("Tìm trong HH Platform", '<input name="query" type="search" placeholder="Tên module hoặc route">')}${actions(["smart-search", "Tìm", true])}</section>`, result("Kết quả có thể mở")));
    if (tool.id === "context-menu") return shell(tool, `<section class="ut-card"><p>Bật menu chuột phải trong workspace này. Shift+F10 mở menu; Escape đóng. Không thay menu của vùng khác.</p>${actions(["context-toggle", "Bật/tắt menu", true])}</section><div class="ut-context" data-ut-context hidden aria-label="Menu công cụ"><button data-ut-action="copy-output">Sao chép kết quả</button><button data-ut-action="export-output">Xuất kết quả</button><button data-ut-action="system-inspect">Đọc khả năng trình duyệt</button></div>${result("Kết quả thao tác")}`);
    if (tool.id === "floating-toolbar") return shell(tool, `<section class="ut-card"><p>Kéo tay cầm hoặc dùng các phím mũi tên khi tay cầm có focus. Toolbar không vượt ra ngoài workspace.</p>${actions(["toolbar-toggle", "Bật/tắt toolbar", true])}</section><div class="ut-toolbar" data-ut-toolbar hidden><button data-ut-handle aria-label="Kéo toolbar; dùng phím mũi tên để di chuyển">⠿ Kéo</button><button data-ut-action="system-inspect">Thiết bị</button><button data-ut-action="copy-output">Sao chép</button><button data-ut-action="toolbar-toggle" aria-label="Đóng toolbar">×</button></div>${result("Toolbar của riêng công cụ này")}`);
    if (tool.id === "qr-scanner") return shell(tool, two(`<section class="ut-card"><label class="ut-drop">Chọn ảnh QR<input name="qr-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"></label>${actions(["qr-scan", "Quét ảnh", true])}</section>`, result("Nội dung QR")), "Quét ảnh trên thiết bị bằng BarcodeDetector hoặc jsQR cục bộ; không tự bật camera hoặc mở URL trong QR.");
    return shell(tool, `<section class="ut-card"><p>System Tool đã sẵn sàng.</p></section>`);
  }

  function renderList(root, tool) {
    const list = root.querySelector("[data-ut-list]"); if (!list) return;
    const key = recordKey(tool), query = value(root, "record-search").toLocaleLowerCase("vi");
    let data = rows(key).filter((item) => !query || `${item.title || ""} ${item.meta || ""}`.toLocaleLowerCase("vi").includes(query));
    if (["calendar", "reminder"].includes(tool.id)) data = data.slice().sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
    const card = (item) => {
      const id = esc(item.id), activity = tool.id === "activity-timeline", isFile = tool.id === "recent-files";
      const title = activity ? byId.get(item.tool)?.name || item.tool : item.title;
      const route = tool.id === "pinned-tools" ? toolRoute(byName.get(item.title)) : tool.id === "bookmark" ? validPublicURL(item.meta, false) : null;
      const detail = activity ? `Thao tác: ${item.action}` : isFile ? `${item.size || 0} byte · ${item.type || "Không rõ loại"}` : item.meta || "";
      const late = tool.id === "reminder" && !item.done && item.date && new Date(item.date).getTime() <= Date.now();
      return `<article class="${item.done || item.read ? "is-done" : ""} ${late ? "is-due" : ""}" ${tool.id === "kanban" ? `draggable="true" data-ut-drag="${id}"` : ""}><div><strong>${esc(title)}</strong>${detail ? `<p>${esc(detail)}</p>` : ""}<small>${esc(item.date ? new Date(item.date).toLocaleString("vi-VN") : item.at ? new Date(item.at).toLocaleString("vi-VN") : "")}${late ? " · Đến giờ nhắc" : ""}</small>${route ? `<a href="${esc(route)}" ${tool.id === "bookmark" ? 'target="_blank" rel="noopener noreferrer"' : ""}>Mở ${tool.id === "bookmark" ? "liên kết" : "công cụ"} ↗</a>` : ""}${tool.id === "kanban" ? `<label class="ut-field"><span>Chuyển cột</span><select data-ut-record-column="${id}">${taskOptions(item.column)}</select></label>` : ""}</div><div class="ut-record-actions">${!activity && !isFile ? `<button data-ut-record-edit="${id}" aria-label="Sửa ${esc(title)}">Sửa</button>` : ""}${["todo", "reminder", "notification-center"].includes(tool.id) ? `<button data-ut-record-toggle="${id}" aria-label="${item.done || item.read ? "Đánh dấu chưa xong" : "Đánh dấu hoàn thành"}">${item.done || item.read ? "↶" : "✓"}</button>` : ""}${!activity ? `<button data-ut-record-move="${id}" data-ut-direction="up" aria-label="Đưa lên">↑</button><button data-ut-record-move="${id}" data-ut-direction="down" aria-label="Đưa xuống">↓</button>` : ""}<button data-ut-record-delete="${id}" aria-label="Xóa ${esc(title)}">×</button></div></article>`;
    };
    list.innerHTML = tool.id === "kanban" ? Object.entries(COLUMNS).map(([column, label]) => `<section class="ut-board-column" data-ut-drop="${column}"><h4>${label} <span>${data.filter((item) => (item.column || "backlog") === column).length}</span></h4>${data.filter((item) => (item.column || "backlog") === column).map(card).join("") || '<p class="ut-empty">Chưa có thẻ.</p>'}</section>`).join("") : data.length ? data.map(card).join("") : '<p class="ut-empty">Chưa có dữ liệu trong công cụ này.</p>';
  }
  const recordKey = (tool) => tool.id === "notification-center" ? "notifications" : tool.id === "activity-timeline" ? "activity" : tool.id;
  function toolRoute(tool) { if (!tool) return null; const manifest = global.HHToolManifests?.TOOL_MANIFESTS?.find((item) => item.name === tool.name); return `#${manifest?.route || `/tools/${tool.group}/${tool.id}`}`; }
  function validPublicURL(source, strict = true) { try { const url = new URL(source); if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error(); return url.href; } catch { if (strict) throw new Error("Dùng URL HTTP/HTTPS hợp lệ, không chứa thông tin đăng nhập."); return null; } }

  function safeCalculate(expression) {
    const source = String(expression).replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-").trim();
    if (!source || source.length > 4096 || !/^[\d\s.+\-*/()%]+$/.test(source)) throw new Error("Biểu thức trống, quá dài hoặc chứa ký tự không hỗ trợ.");
    const tokens = source.match(/\d+(?:\.\d*)?|\.\d+|[()+\-*/%]|\S/g) || []; let position = 0, depth = 0;
    if (tokens.length > 1024) throw new Error("Biểu thức quá dài.");
    const atom = () => {
      if (++depth > 64) throw new Error("Biểu thức lồng quá sâu.");
      const token = tokens[position++]; let result;
      if (token === "+" || token === "-") result = (token === "-" ? -1 : 1) * atom();
      else if (token === "(") { result = expressionValue(); if (tokens[position++] !== ")") throw new Error("Ngoặc không hợp lệ."); }
      else if (/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token || "")) result = Number(token);
      else throw new Error("Biểu thức không hợp lệ.");
      depth--; return result;
    };
    const product = () => { let result = atom(); while (["*", "/", "%"].includes(tokens[position])) { const op = tokens[position++], next = atom(); if (op !== "*" && next === 0) throw new Error("Không thể chia cho 0."); result = op === "*" ? result * next : op === "/" ? result / next : result % next; } return result; };
    const expressionValue = () => { let result = product(); while (["+", "-"].includes(tokens[position])) { const op = tokens[position++], next = product(); result = op === "+" ? result + next : result - next; } return result; };
    const result = expressionValue(); if (position !== tokens.length || !Number.isFinite(result)) throw new Error("Biểu thức không hợp lệ."); return result;
  }

  const gitCommands = Object.freeze([
    ["branch", "git switch -c ten-nhanh", "Tạo và chuyển sang nhánh mới."], ["rebase", "git rebase main", "Đặt commit hiện tại lên trên main."], ["undo", "git revert <commit>", "Hoàn tác an toàn bằng commit mới."], ["stash", "git stash push -u -m \"wip\"", "Cất cả file tracked và untracked."], ["history", "git log --oneline --graph --decorate -20", "Xem lịch sử rút gọn."], ["diff", "git diff --check", "Kiểm tra whitespace và xung đột định dạng."]
  ]);

  function jsonTree(data, depth = 0, budget = { remaining: 2000 }) {
    if (--budget.remaining < 0 || depth > 12) return '<span class="ut-muted">Nhánh lớn: dùng Định dạng để xem toàn bộ.</span>';
    if (data === null || typeof data !== "object") return `<code>${esc(JSON.stringify(data))}</code>`;
    return `<details ${depth < 2 ? "open" : ""}><summary>${Array.isArray(data) ? "Array" : "Object"} · ${Object.keys(data).length} mục</summary><div class="ut-json-branch">${Object.entries(data).slice(0, 500).map(([key, item]) => `<div><b>${esc(key)}</b>: ${jsonTree(item, depth + 1, budget)}</div>`).join("")}</div></details>`;
  }
  function parseTimestamp(source, format = "auto") {
    const text = String(source).trim(); if (!text) throw new Error("Nhập ngày giờ hoặc timestamp.");
    const numeric = /^[+-]?\d+(?:\.\d+)?$/.test(text);
    if (["seconds", "milliseconds"].includes(format) && !numeric) throw new Error("Timestamp phải là số.");
    const date = numeric && format !== "date" ? new Date(Number(text) * (format === "seconds" || format === "auto" && Math.abs(Number(text)) < 1e11 ? 1000 : 1)) : new Date(text);
    if (!Number.isFinite(date.getTime())) throw new Error("Thời gian không hợp lệ."); return date;
  }
  function compareLines(leftSource, rightSource) {
    const left = String(leftSource).split("\n"), right = String(rightSource).split("\n");
    if (left.length * right.length > 250000 || left.length + right.length > 2000) throw new Error("Bản so sánh quá lớn. Giới hạn 2.000 dòng và 250.000 cặp dòng.");
    const grid = Array.from({ length: left.length + 1 }, () => new Uint16Array(right.length + 1));
    for (let i = left.length - 1; i >= 0; i--) for (let j = right.length - 1; j >= 0; j--) grid[i][j] = left[i] === right[j] ? grid[i + 1][j + 1] + 1 : Math.max(grid[i + 1][j], grid[i][j + 1]);
    const output = []; let i = 0, j = 0;
    while (i < left.length || j < right.length) { if (i < left.length && j < right.length && left[i] === right[j]) { output.push(`  ${left[i++]}`); j++; } else if (j < right.length && (i === left.length || grid[i][j + 1] >= grid[i + 1][j])) output.push(`+ ${right[j++]}`); else output.push(`- ${left[i++]}`); }
    return output.join("\n");
  }
  async function readBoundedResponse(response, limit = 1024 * 1024) {
    const declared = Number(response.headers?.get?.("content-length") || 0); if (declared > limit) throw new Error("Response vượt giới hạn 1 MB.");
    if (!response.body?.getReader) { const body = await response.text(); if (new TextEncoder().encode(body).length > limit) throw new Error("Response vượt giới hạn 1 MB."); return body; }
    const reader = response.body.getReader(), chunks = []; let length = 0;
    try { while (true) { const next = await reader.read(); if (next.done) break; length += next.value.byteLength; if (length > limit) { await reader.cancel(); throw new Error("Response vượt giới hạn 1 MB."); } chunks.push(next.value); } } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; } return new TextDecoder().decode(bytes);
  }
  function evaluateRegex(pattern, flags, source, replacement, replace) {
    if (!global.Worker) return Promise.reject(new Error("Trình duyệt không hỗ trợ Worker an toàn cho Regex."));
    if (pattern.length > 1000 || source.length > 100000 || replacement.length > 1000) return Promise.reject(new Error("Regex/thay thế tối đa 1.000 ký tự; văn bản tối đa 100.000 ký tự."));
    const workerSource = `onmessage = ({data}) => { try { const re = new RegExp(data.pattern, data.flags); if (data.replace) postMessage({output: data.source.replace(re, data.replacement)}); else { const all = re.global ? re : new RegExp(re.source, re.flags + 'g'); const matches = []; for (const match of data.source.matchAll(all)) { matches.push((matches.length + 1) + '. ' + match[0] + ' @ ' + match.index); if (matches.length >= 1000) { matches.push('Đã giới hạn 1.000 match.'); break; } } postMessage({output: matches.join('\\n') || 'Không có match.'}); } } catch (error) { postMessage({error: error.message}); } };`;
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" })); let worker, timeout, ended = false;
      const done = (error, output) => { if (ended) return; ended = true; clearTimeout(timeout); worker?.terminate(); URL.revokeObjectURL(url); runtime.cancelWorker = null; error ? reject(error) : resolve(String(output || "").slice(0, 2000000)); };
      try { worker = new global.Worker(url); } catch { done(new Error("Không tạo được Regex worker. Chính sách trình duyệt có thể đã chặn worker.")); return; }
      runtime.cancelWorker?.(); runtime.cancelWorker = () => done(new Error("Đã hủy Regex."));
      timeout = setTimeout(() => done(new Error("Regex quá chậm và đã tự dừng sau 1 giây.")), 1000);
      worker.onmessage = ({ data }) => done(data.error ? new Error(data.error) : null, data.output); worker.onerror = () => done(new Error("Regex worker không chạy được."));
      worker.postMessage({ pattern, flags, source, replacement, replace });
    });
  }
  function generatePassword(length, numbers, symbols) {
    if (!global.crypto?.getRandomValues) throw new Error("Cần trình duyệt HTTPS hỗ trợ crypto để tạo mật khẩu.");
    const groups = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnopqrstuvwxyz", ...(numbers ? ["23456789"] : []), ...(symbols ? ["!@#$%&*+-_"] : [])];
    const alphabet = groups.join(""); const pick = (chars) => { const maximum = Math.floor(256 / chars.length) * chars.length; let byte; do { byte = crypto.getRandomValues(new Uint8Array(1))[0]; } while (byte >= maximum); return chars[byte % chars.length]; };
    const result = groups.map(pick); while (result.length < length) result.push(pick(alphabet));
    for (let i = result.length - 1; i > 0; i--) { const maximum = Math.floor(65536 / (i + 1)) * (i + 1); let random; do { random = crypto.getRandomValues(new Uint16Array(1))[0]; } while (random >= maximum); const j = random % (i + 1); [result[i], result[j]] = [result[j], result[i]]; }
    return result.join("");
  }
  const PHRASES = { welcome: { vi: "Chào mừng", en: "Welcome" }, save: { vi: "Lưu dữ liệu", en: "Save data" }, empty: { vi: "Chưa có dữ liệu", en: "No data yet" }, error: { vi: "Không thể hoàn thành", en: "Unable to complete" }, ready: { vi: "Sẵn sàng", en: "Ready" } };
  let qrLibrary = null;
  function loadQRDecoder() {
    if (typeof global.jsQR === "function") return Promise.resolve(global.jsQR);
    if (!qrLibrary) qrLibrary = new Promise((resolve, reject) => { const script = document.createElement("script"); script.src = new URL("/vendor/jsqr.js?v=1", location.href).href; script.onload = () => typeof global.jsQR === "function" ? resolve(global.jsQR) : reject(new Error("Thư viện QR không khởi tạo được.")); script.onerror = () => { script.remove(); reject(new Error("Không tải được thư viện QR cục bộ.")); }; document.head.append(script); }).catch((error) => { qrLibrary = null; throw error; });
    return qrLibrary;
  }
  async function scanQR(file) {
    if (!file || file.size > 10 * 1024 * 1024 || !/^image\/(png|jpeg|webp|gif|bmp)$/.test(file.type)) throw new Error("Chọn ảnh PNG/JPEG/WebP/GIF/BMP tối đa 10 MB.");
    if (!global.createImageBitmap) throw new Error("Trình duyệt chưa hỗ trợ đọc ảnh. Hãy dùng Chrome, Edge hoặc Firefox mới.");
    const bitmap = await createImageBitmap(file);
    try {
      if (bitmap.width > 8192 || bitmap.height > 8192 || bitmap.width * bitmap.height > 16000000) throw new Error("Ảnh quá lớn. Giới hạn 16 megapixel và 8.192 pixel mỗi cạnh.");
      if ("BarcodeDetector" in global) { try { const detector = new BarcodeDetector({ formats: ["qr_code"] }), codes = await detector.detect(bitmap); if (codes.length) return codes.map((code) => code.rawValue).join("\n"); } catch {} }
      const decode = await loadQRDecoder(), canvas = document.createElement("canvas"); canvas.width = bitmap.width; canvas.height = bitmap.height;
      try { const context = canvas.getContext("2d", { willReadFrequently: true }); if (!context) throw new Error("Canvas đọc ảnh không khả dụng."); context.drawImage(bitmap, 0, 0); const pixels = context.getImageData(0, 0, canvas.width, canvas.height), code = decode(pixels.data, pixels.width, pixels.height, { inversionAttempts: "attemptBoth" }); return code?.data || "Không phát hiện QR trong ảnh."; } finally { canvas.width = 0; canvas.height = 0; }
    } finally { bitmap.close(); }
  }

  function activeGuard(root, generation) { guardScope(); if (runtime.root !== root || runtime.generation !== generation) throw new Error("Công cụ đã đóng; không lưu kết quả tác vụ cũ."); }

  async function runAction(root, tool, action) {
    guardScope(); const generation = runtime.generation;
    if (action === "copy-output") { if (!navigator.clipboard?.writeText) throw new Error("Clipboard cần HTTPS và hỗ trợ trình duyệt."); const output = root.querySelector("[data-ut-output]"); if (!output || output.textContent === "Chưa có kết quả.") throw new Error("Chưa có kết quả để sao chép."); await navigator.clipboard.writeText(output.textContent || ""); return; }
    if (action === "export-output") { download(`${tool.id}.txt`, root.querySelector("[data-ut-output]")?.textContent || ""); return; }
    if (action === "cancel") { runtime.controller?.abort(); runtime.cancelWorker?.(); setOutput(root, "Đã hủy tác vụ.", "error"); return; }
    if (["format-json", "minify-json", "validate-json", "json-tree"].includes(action)) { const source = value(root, "source"); if (source.length > 2000000) throw new Error("JSON vượt giới hạn 2 triệu ký tự."); const parsed = JSON.parse(source); if (action === "json-tree") { root.querySelector("[data-ut-output]").innerHTML = jsonTree(parsed); } else setOutput(root, action === "minify-json" ? JSON.stringify(parsed) : action === "validate-json" ? `JSON hợp lệ · ${parsed !== null && typeof parsed === "object" ? `${Object.keys(parsed).length} mục cấp đầu` : `giá trị ${parsed === null ? "null" : typeof parsed}`}` : JSON.stringify(parsed, null, 2)); }
    else if (action === "render-markdown") { const source = value(root, "source"); const safe = esc(source).replace(/^### (.+)$/gm, "<h3>$1</h3>").replace(/^## (.+)$/gm, "<h2>$1</h2>").replace(/^# (.+)$/gm, "<h1>$1</h1>").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\n/g, "<br>"); const output = root.querySelector("[data-ut-output]"); output.innerHTML = safe; }
    else if (action === "export-markdown") download("document.md", value(root, "source"), "text/markdown");
    else if (action === "number-code") setOutput(root, value(root, "source").split("\n").map((line, i) => `${String(i + 1).padStart(4)} │ ${line}`).join("\n"));
    else if (action === "export-code") download((value(root, "filename") || "code.txt").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_"), value(root, "source"));
    else if (action === "base64-encode") { const encoded = btoa(unescape(encodeURIComponent(value(root, "source")))); setOutput(root, root.querySelector('[name="base64-url"]')?.checked ? encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : encoded); }
    else if (action === "base64-decode") setOutput(root, decodeURIComponent(escape(atob(value(root, "source").replace(/-/g, "+").replace(/_/g, "/")))));
    else if (action === "text-stats") { const text = value(root, "source"); setOutput(root, `Ký tự: ${text.length}\nTừ: ${text.trim() ? text.trim().split(/\s+/).length : 0}\nDòng: ${text.split("\n").length}`); }
    else if (action === "slugify") setOutput(root, value(root, "source").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
    else if (action === "url-encode") setOutput(root, encodeURIComponent(value(root, "source")));
    else if (action === "url-decode") setOutput(root, decodeURIComponent(value(root, "source")));
    else if (action === "html-escape") setOutput(root, esc(value(root, "source")));
    else if (action === "regex-run" || action === "regex-replace") { const output = await evaluateRegex(value(root, "pattern"), value(root, "flags"), value(root, "source"), value(root, "replacement"), action === "regex-replace"); activeGuard(root, generation); setOutput(root, output); }
    else if (action === "compare") setOutput(root, compareLines(value(root, "left"), value(root, "right")));
    else if (action === "terminal-clear") setOutput(root, "");
    else if (action === "terminal-run") { const command = value(root, "command").trim(), [name, ...args] = command.split(/\s+/); const history = rows("terminal"); if (name === "clear") { setOutput(root, ""); return; } saveRows("terminal", [{ id: uid(), command: name === "echo" ? "echo [nội dung không lưu]" : command.slice(0, 300), at: new Date().toISOString() }, ...history]); const result = name === "help" ? "help · clear · echo · date · whoami · pwd · ls tools · history" : name === "echo" ? args.join(" ") : name === "date" ? new Date().toString() : name === "whoami" ? "HH browser user" : name === "pwd" ? "/hh-platform/local-sandbox" : name === "ls" && args[0] === "tools" ? manifests.map((item) => item.id).join("\n") : name === "history" ? rows("terminal").map((item) => item.command).join("\n") : `Lệnh “${name}” không nằm trong sandbox. Gõ help.`; setOutput(root, `$ ${command}\n${result}`); }
    else if (action === "git-search") { const query = value(root, "query").toLowerCase(); setOutput(root, gitCommands.filter((row) => !query || row.join(" ").toLowerCase().includes(query)).map(([tag, command, description]) => `${tag.toUpperCase()}\n${command}\n${description}`).join("\n\n") || "Không tìm thấy tình huống."); }
    else if (action === "api-run") {
      runtime.controller?.abort(); runtime.controller = new AbortController(); const url = validPublicURL(value(root, "url"));
      const headers = JSON.parse(value(root, "headers") || "{}"); if (!headers || Array.isArray(headers) || typeof headers !== "object" || Object.values(headers).some((entry) => typeof entry !== "string")) throw new Error("Headers phải là object JSON với giá trị chuỗi.");
      if (Object.keys(headers).some((name) => /^(cookie|host|origin|referer|content-length|set-cookie)$/i.test(name))) throw new Error("Header này do trình duyệt quản lý và không thể đặt thủ công.");
      const method = value(root, "method"); if (!["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"].includes(method)) throw new Error("HTTP method không hợp lệ.");
      const started = performance.now(); let response;
      try { response = await fetch(url, { method, headers, credentials: "omit", redirect: "error", body: method === "GET" || method === "HEAD" ? undefined : value(root, "body"), signal: runtime.controller.signal }); } catch (error) { if (error.name === "AbortError") throw error; throw new Error("Không kết nối được: kiểm tra mạng, CORS, HTTPS và redirect. Công cụ không sử dụng proxy để vượt CORS."); }
      const text = await readBoundedResponse(response); activeGuard(root, generation); let content = text; try { content = JSON.stringify(JSON.parse(text), null, 2); } catch {}
      setOutput(root, `HTTP ${response.status} · ${Math.round(performance.now() - started)} ms\n${[...response.headers].map(([k, v]) => `${k}: ${SENSITIVE.test(k) ? "[đã ẩn]" : v}`).join("\n")}\n\n${content}`, response.ok ? "success" : "error");
    }
    else if (action === "github-load") { const owner = value(root, "owner"), repo = value(root, "repo"); if (!/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repo)) throw new Error("Owner/repository không hợp lệ."); runtime.controller?.abort(); runtime.controller = new AbortController(); const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, { signal: runtime.controller.signal, credentials: "omit", headers: { Accept: "application/vnd.github+json" } }); const data = JSON.parse(await readBoundedResponse(response)); activeGuard(root, generation); if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`); setOutput(root, `${data.full_name}\n${data.description || "Không có mô tả"}\nStars: ${data.stargazers_count}\nForks: ${data.forks_count}\nIssues: ${data.open_issues_count}\nLanguage: ${data.language || "N/A"}\nUpdated: ${data.updated_at}\nLicense: ${data.license?.spdx_id || "Chưa xác định"}\nArchived: ${data.archived ? "Có" : "Không"}\n${data.html_url || ""}`); }
    else if (action === "runtime-add") { const message = value(root, "log-message").trim(); if (!message) throw new Error("Nhập nội dung log."); runtime.logs.unshift({ at: new Date().toISOString(), message: message.slice(0, 500), kind: "manual" }); runtime.logs = runtime.logs.slice(0, 100); await runAction(root, tool, "runtime-refresh"); }
    else if (action === "runtime-refresh") { const logs = tool.id === "error-monitor" ? runtime.logs.filter((item) => item.kind !== "manual") : runtime.logs; setOutput(root, logs.length ? logs.map((item) => `${item.at} [${item.kind}] ${item.message}`).join("\n") : "Chưa có log/lỗi trong phiên công cụ này."); }
    else if (action === "runtime-clear") { runtime.logs = []; setOutput(root, "Đã xóa log của phiên công cụ; log website không thay đổi."); }
    else if (action === "uuid-generate") { if (!global.crypto?.randomUUID) throw new Error("UUID cần crypto.randomUUID trên HTTPS."); const count = Math.max(1, Math.min(100, Math.floor(Number(value(root, "count"))) || 1)); setOutput(root, Array.from({ length: count }, () => crypto.randomUUID()).join("\n")); }
    else if (action === "hash-run") { if (!global.crypto?.subtle) throw new Error("Hash cần Web Crypto trên HTTPS."); const digest = new Uint8Array(await crypto.subtle.digest(value(root, "algorithm"), new TextEncoder().encode(value(root, "source")))); activeGuard(root, generation); const encoding = value(root, "encoding"), base64 = btoa(String.fromCharCode(...digest)); setOutput(root, encoding === "base64" ? base64 : encoding === "base64url" ? base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("")); }
    else if (action === "timestamp-now") { root.querySelector('[name="source"]').value = String(Math.floor(Date.now() / 1000)); if (root.querySelector('[name="time-format"]')) root.querySelector('[name="time-format"]').value = "seconds"; await runAction(root, tool, "timestamp-run"); }
    else if (action === "timestamp-run") { const date = parseTimestamp(value(root, "source"), value(root, "time-format") || "auto"); setOutput(root, `ISO: ${date.toISOString()}\nUTC: ${date.toUTCString()}\nUnix seconds: ${Math.floor(date.getTime() / 1000)}\nUnix ms: ${date.getTime()}\nLocal: ${date.toLocaleString("vi-VN")}`); }
    else if (action === "record-add") {
      const title = value(root, "title").trim(); if (!title) throw new Error("Nhập tiêu đề trước khi lưu."); const meta = tool.id === "bookmark" ? validPublicURL(value(root, "meta")) : value(root, "meta"); const date = value(root, "date");
      if (["calendar", "reminder"].includes(tool.id) && (!date || !Number.isFinite(new Date(date).getTime()))) throw new Error("Chọn ngày giờ hợp lệ.");
      const existing = rows(tool.id), previous = existing.find((item) => item.id === runtime.editId);
      const column = value(root, "column") || previous?.column || "backlog"; if (!COLUMNS[column]) throw new Error("Trạng thái không hợp lệ.");
      const item = { ...previous, id: previous?.id || uid(), title: title.slice(0, 180), meta: meta.slice(0, tool.id === "notes" ? 40000 : 2000), date, column, done: column === "done", at: previous?.at || new Date().toISOString(), updatedAt: new Date().toISOString() };
      saveRows(tool.id, previous ? existing.map((entry) => entry.id === previous.id ? item : entry) : [item, ...existing]); resetRecordEditor(root); renderList(root, tool);
    }
    else if (action === "record-cancel") resetRecordEditor(root);
    else if (action === "record-refresh") renderList(root, tool);
    else if (action === "activity-clear") { saveRows("activity", []); renderList(root, tool); return; }
    else if (action === "files-add") { const files = [...(root.querySelector('[name="recent-file"]')?.files || [])]; if (!files.length) throw new Error("Chọn ít nhất một file."); const entries = files.map((file) => ({ id: uid(), title: file.name, size: file.size, type: file.type, lastModified: file.lastModified, at: new Date().toISOString() })); saveRows("recent-files", [...entries, ...rows("recent-files")]); renderList(root, tool); }
    else if (action === "record-export") download(`${tool.id}.json`, JSON.stringify({ version: 2, tool: tool.id, records: rows(recordKey(tool)) }, null, 2), "application/json");
    else if (action === "calendar-export") download("calendar.ics", calendarICS(rows("calendar")), "text/calendar;charset=utf-8");
    else if (action === "record-export-all") download("hh-productivity.json", JSON.stringify(readStore(), null, 2), "application/json");
    else if (action === "dashboard-refresh") renderDashboard(root);
    else if (action.startsWith("timer-") || action.startsWith("focus-")) runTimer(root, tool, action);
    else if (action === "calculate") setOutput(root, safeCalculate(value(root, "expression")));
    else if (action === "convert-unit") { if (!value(root, "amount").trim()) throw new Error("Nhập giá trị cần chuyển đổi."); setOutput(root, convertUnit(Number(value(root, "amount")), value(root, "from"), value(root, "to"))); }
    else if (action === "unit-swap") { const from = root.querySelector('[name="from"]'), to = root.querySelector('[name="to"]'); [from.value, to.value] = [to.value, from.value]; await runAction(root, tool, "convert-unit"); }
    else if (action === "lorem-generate") { const count = Math.max(1, Math.min(30, Number(value(root, "count")) || 3)); setOutput(root, Array(count).fill("Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.").join("\n\n")); }
    else if (action === "password-generate") { const length = Math.max(12, Math.min(128, Math.floor(Number(value(root, "length"))) || 24)); setOutput(root, generatePassword(length, root.querySelector('[name="numbers"]')?.checked, root.querySelector('[name="symbols"]')?.checked)); }
    else if (action === "clipboard-write") { if (!navigator.clipboard?.writeText) throw new Error("Clipboard cần HTTPS và quyền trình duyệt."); const text = value(root, "source"); await navigator.clipboard.writeText(text); activeGuard(root, generation); if (root.querySelector('[name="clipboard-remember"]')?.checked) { saveRows("clipboard", [{ id: uid(), text: text.slice(0, 10000), at: new Date().toISOString() }, ...rows("clipboard")].slice(0, 30)); renderClipboard(root); } setOutput(root, "Đã ghi clipboard. Lịch sử chỉ lưu nếu bạn bật tùy chọn."); }
    else if (action === "clipboard-read") { if (!navigator.clipboard?.readText) throw new Error("Trình duyệt không hỗ trợ đọc clipboard. Bạn có thể dán trực tiếp vào ô nội dung."); const text = await navigator.clipboard.readText(); activeGuard(root, generation); root.querySelector('[name="source"]').value = text; setOutput(root, text || "Clipboard đang trống."); }
    else if (action === "clipboard-clear") { saveRows("clipboard", []); renderClipboard(root); setOutput(root, "Đã xóa lịch sử clipboard của Tool."); }
    else if (action === "quick-toggle") root.querySelector("[data-ut-floating]").hidden = !root.querySelector("[data-ut-floating]").hidden;
    else if (action === "quick-copy") { if (!navigator.clipboard?.writeText) throw new Error("Clipboard chưa khả dụng."); const text = new Date().toISOString(); await navigator.clipboard.writeText(text); activeGuard(root, generation); setOutput(root, text); }
    else if (action === "quick-export") download("all-tools-activity.json", JSON.stringify(rows("activity"), null, 2), "application/json");
    else if (action === "preferences-save") {
      const preferences = { theme: value(root, "pref-theme"), density: value(root, "pref-density"), language: value(root, "pref-language"), reducedMotion: Boolean(root.querySelector('[name="pref-motion"]')?.checked), highContrast: Boolean(root.querySelector('[name="pref-contrast"]')?.checked) };
      const store = readStore(); store.preferences = preferences; writeStore(store);
      applyPreferences(root);
      setOutput(root, `Đã lưu riêng cho công cụ: ${preferences.theme} · ${preferences.density} · ${preferences.language}. Giao diện chính không thay đổi.`);
    }
    else if (action === "language-apply") { const language = value(root, "language"); if (!["vi", "en"].includes(language)) throw new Error("Ngôn ngữ chưa hỗ trợ."); const store = readStore(); store.preferences = { ...store.preferences, language }; writeStore(store); applyPreferences(root); setOutput(root, `${language === "en" ? "Tool language saved" : "Đã lưu ngôn ngữ công cụ"}: ${language}\n${new Date().toLocaleString(language === "en" ? "en-US" : "vi-VN")}`); }
    else if (action === "language-preview") { const text = PHRASES[value(root, "phrase")]?.[value(root, "language")]; if (!text) throw new Error("Mẫu/ngôn ngữ chưa hỗ trợ."); setOutput(root, text); }
    else if (action === "weather-load") { const lat = Number(value(root, "lat")), lon = Number(value(root, "lon")); if (!value(root, "lat").trim() || !value(root, "lon").trim() || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) throw new Error("Vĩ độ −90…90 và kinh độ −180…180."); runtime.controller?.abort(); runtime.controller = new AbortController(); const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code`, { signal: runtime.controller.signal, credentials: "omit" }); const data = JSON.parse(await readBoundedResponse(response)); activeGuard(root, generation); if (!response.ok || !data.current) throw new Error(data.reason || "Không tải được thời tiết."); setOutput(root, `Nhiệt độ: ${data.current.temperature_2m} °C\nĐộ ẩm: ${data.current.relative_humidity_2m}%\nGió: ${data.current.wind_speed_10m} km/h\nWeather code: ${data.current.weather_code}\nCập nhật: ${data.current.time}\nNguồn: Open-Meteo · tọa độ do bạn nhập`); }
    else if (action === "system-inspect") { const output = await systemReport(tool.id); activeGuard(root, generation); setOutput(root, output); }
    else if (action === "network-measure") { runtime.controller?.abort(); runtime.controller = new AbortController(); const start = performance.now(), response = await fetch(`assets/brand/pwa-512.png?v=1&speed=${Date.now()}`, { cache: "no-store", signal: runtime.controller.signal, credentials: "omit" }); if (!response.ok) throw new Error(`Tệp đo không tải được · HTTP ${response.status}`); const blob = await response.blob(); activeGuard(root, generation); if (!blob.size || !/^image\//.test(blob.type)) throw new Error("Response không phải tài nguyên ảnh đo hợp lệ."); const elapsed = Math.max(1, performance.now() - start), mbps = blob.size * 8 / elapsed / 1000; setOutput(root, `Tệp thử: ${(blob.size / 1024).toFixed(1)} KB\nThời gian: ${elapsed.toFixed(0)} ms\nThroughput tải nhỏ: ${mbps.toFixed(2)} Mbps\nKhông phải kết quả speedtest đường truyền tổng thể; cache/proxy có thể ảnh hưởng.\nNetwork Information: ${navigator.connection?.effectiveType || "không hỗ trợ"}`); }
    else if (action === "analytics-refresh") renderAnalytics(root);
    else if (action === "notification-add") { const title = value(root, "title").trim(); if (!title) throw new Error("Nhập nội dung thông báo."); const current = rows("notifications"), previous = current.find((item) => item.id === runtime.editId), item = { ...previous, id: previous?.id || uid(), title: title.slice(0, 500), at: previous?.at || new Date().toISOString(), read: previous?.read || false }; saveRows("notifications", previous ? current.map((entry) => entry.id === item.id ? item : entry) : [item, ...current]); resetRecordEditor(root); renderList(root, tool); }
    else if (action === "notification-read") { saveRows("notifications", rows("notifications").map((item) => ({ ...item, read: true }))); renderList(root, tool); }
    else if (action === "notification-clear") { saveRows("notifications", []); renderList(root, tool); }
    else if (action === "smart-search") { const query = value(root, "query").trim().toLowerCase(); const available = global.HHToolManifests?.TOOL_MANIFESTS || manifests; const found = available.filter((item) => `${item.name} ${item.route || ""}`.toLowerCase().includes(query)).slice(0, 40); const output = root.querySelector("[data-ut-output]"); output.innerHTML = found.length ? `<div class="ut-search-results">${found.map((item) => `<a href="${esc(toolRoute(item))}"><strong>${esc(item.name)}</strong><small>${esc(item.route || `/tools/${item.group}/${item.id}`)}</small></a>`).join("")}</div>` : "Không tìm thấy công cụ."; }
    else if (action === "context-toggle") { const menu = root.querySelector("[data-ut-context]"); root.dataset.contextEnabled = root.dataset.contextEnabled === "true" ? "false" : "true"; menu.hidden = true; setOutput(root, root.dataset.contextEnabled === "true" ? "Menu đã bật: chuột phải hoặc Shift+F10 trong công cụ." : "Menu đã tắt."); }
    else if (action === "toolbar-toggle") { const toolbar = root.querySelector("[data-ut-toolbar]"); toolbar.hidden = !toolbar.hidden; }
    else if (action === "qr-scan") { const file = root.querySelector('[name="qr-file"]')?.files?.[0]; if (!file) throw new Error("Chọn ảnh QR trước."); const output = await scanQR(file); activeGuard(root, generation); setOutput(root, output); }
    activeGuard(root, generation); record(tool.id, action);
  }

  function convertUnit(amount, from, to) {
    if (!Number.isFinite(amount)) throw new Error("Giá trị phải là số hữu hạn.");
    if ([from, to].every((unit) => ["c", "f", "k"].includes(unit))) { const kelvin = from === "k" ? amount : from === "c" ? amount + 273.15 : (amount - 32) * 5 / 9 + 273.15; if (kelvin < -1e-8) throw new Error("Nhiệt độ thấp hơn độ không tuyệt đối."); const result = to === "k" ? kelvin : to === "c" ? kelvin - 273.15 : (kelvin - 273.15) * 9 / 5 + 32; return `${amount} ${from.toUpperCase()} = ${Number(result.toFixed(8))} ${to.toUpperCase()}`; }
    const dimensions = { length: { km: 1000, m: 1, cm: .01, mm: .001, in: .0254, ft: .3048, mi: 1609.344 }, mass: { kg: 1, g: .001, lb: .45359237, oz: .028349523125 }, volume: { l: 1, ml: .001 }, time: { s: 1, min: 60, h: 3600 }, speed: { ms: 1, kmh: 1 / 3.6, mph: .44704 } };
    const dimension = Object.values(dimensions).find((units) => units[from] && units[to]); if (!dimension) throw new Error("Hai đơn vị không cùng loại.");
    return `${amount} ${from} = ${(amount * dimension[from] / dimension[to]).toLocaleString("vi-VN", { maximumFractionDigits: 8 })} ${to}`;
  }

  function resetRecordEditor(root) { runtime.editId = null; for (const name of ["title", "meta", "date"]) { const input = root.querySelector(`[name="${name}"]`); if (input && input.tagName !== "SELECT") input.value = ""; } const column = root.querySelector('[name="column"]'); if (column) column.value = "backlog"; const status = root.querySelector("[data-ut-edit-status]"); if (status) status.textContent = "Thêm mục mới"; }
  function calendarICS(events) {
    const escapeICS = (text) => String(text || "").replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\r/g, "");
    const stamp = (date) => new Date(date).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//HH All Tools//Calendar//VI", "CALSCALE:GREGORIAN"];
    for (const event of events) { if (!event.date || !Number.isFinite(new Date(event.date).getTime())) continue; lines.push("BEGIN:VEVENT", `UID:${escapeICS(event.id)}@hh-all-tools`, `DTSTAMP:${stamp(event.at || Date.now())}`, `DTSTART:${stamp(event.date)}`, `SUMMARY:${escapeICS(event.title)}`, `DESCRIPTION:${escapeICS(event.meta)}`, "END:VEVENT"); }
    lines.push("END:VCALENDAR"); return lines.join("\r\n");
  }
  function renderClipboard(root) { const target = root.querySelector("[data-ut-clipboard-list]"); if (target) target.innerHTML = rows("clipboard").map((item) => `<article><div><strong>${esc(item.at)}</strong><p>${esc(item.text.slice(0, 120))}</p></div><div><button data-ut-clipboard-restore="${esc(item.id)}" aria-label="Mở bản sao trong ô nội dung">Mở</button><button data-ut-clipboard-delete="${esc(item.id)}" aria-label="Xóa bản sao">×</button></div></article>`).join("") || '<p class="ut-empty">Chưa có bản sao đã được bạn cho phép lưu.</p>'; }
  function applyPreferences(root) { const prefs = readStore().preferences || {}; root.lang = prefs.language === "en" ? "en" : "vi"; root.dataset.theme = prefs.theme || "system"; root.dataset.density = prefs.density || "comfortable"; root.classList.toggle("ut-reduce-motion", Boolean(prefs.reducedMotion)); root.classList.toggle("ut-high-contrast", Boolean(prefs.highContrast)); }

  const timerState = (tool) => readStore().timers?.[tool.id] || null;
  const saveTimer = (tool, timer) => { const store = readStore(); store.timers = { ...store.timers, [tool.id]: timer }; writeStore(store); };
  function freshTimer(root, tool, phase = "focus") { const focusMinutes = Math.max(1, Math.min(720, Number(value(root, "minutes")) || 25)), breakMinutes = Math.max(1, Math.min(180, Number(value(root, "break-minutes")) || 5)), durationMs = tool.id === "stopwatch" ? 0 : (phase === "break" ? breakMinutes : focusMinutes) * 60000; return { version: 1, status: "idle", phase, focusMinutes, breakMinutes, durationMs, remainingMs: durationMs, elapsedMs: 0, anchor: null, laps: [] }; }
  function timerSnapshot(timer, isStopwatch, now = Date.now()) { const passed = timer.status === "running" ? Math.max(0, now - timer.anchor) : 0; const elapsedMs = Math.max(0, timer.elapsedMs + passed), remainingMs = Math.max(0, timer.remainingMs - passed); return { ...timer, elapsedMs, remainingMs, anchor: timer.status === "running" ? now : null, status: !isStopwatch && remainingMs === 0 && timer.status === "running" ? "complete" : timer.status }; }
  const formatDuration = (ms) => { const seconds = Math.floor(Math.max(0, ms) / 1000), hours = Math.floor(seconds / 3600), minutes = hours ? Math.floor(seconds / 60) % 60 : Math.floor(seconds / 60); return `${hours ? `${String(hours).padStart(2, "0")}:` : ""}${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`; };
  function paintTimer(root, tool) {
    const display = root.querySelector("[data-ut-timer]"); if (!display) return; const timer = timerState(tool) || freshTimer(root, tool), snapshot = timerSnapshot(timer, tool.id === "stopwatch");
    display.textContent = formatDuration(tool.id === "stopwatch" ? snapshot.elapsedMs : snapshot.remainingMs);
    const phase = root.querySelector("[data-ut-phase]"); if (phase) phase.textContent = `${tool.id === "pomodoro" ? snapshot.phase === "break" ? "Nghỉ ngơi" : "Tập trung" : tool.name} · ${{ idle: "Sẵn sàng", running: "Đang chạy", paused: "Tạm dừng", complete: "Hoàn thành" }[snapshot.status]}`;
    const laps = root.querySelector("[data-ut-laps]"); if (laps) laps.innerHTML = (timer.laps || []).map((ms, index) => `<div>Vòng ${index + 1}: ${formatDuration(ms)}.${String(Math.floor(ms % 1000)).padStart(3, "0")}</div>`).join("");
    if (snapshot.status === "complete") { clearInterval(runtime.timer); runtime.timer = null; }
  }
  function startTimerPaint(root, tool) { clearInterval(runtime.timer); runtime.timer = null; paintTimer(root, tool); const timer = timerState(tool); if (!document.hidden && timer?.status === "running" && (tool.id === "stopwatch" || timerSnapshot(timer, false).remainingMs > 0)) runtime.timer = setInterval(() => { try { guardScope(); paintTimer(root, tool); } catch { clearInterval(runtime.timer); runtime.timer = null; } }, 1000); }
  function runTimer(root, tool, action) {
    if (action === "focus-toggle") { root.classList.toggle("ut-focus-active"); return; }
    let timer = timerSnapshot(timerState(tool) || freshTimer(root, tool), tool.id === "stopwatch");
    if (action === "timer-reset") timer = freshTimer(root, tool, timer.phase);
    else if (action === "timer-pause" || action === "focus-stop") { timer.status = timer.status === "complete" ? "complete" : "paused"; timer.anchor = null; if (action === "focus-stop") root.classList.remove("ut-focus-active"); }
    else if (action === "timer-start") { if (["idle", "complete"].includes(timer.status)) timer = freshTimer(root, tool, timer.phase); timer.status = "running"; timer.anchor = Date.now(); }
    else if (action === "timer-break") timer = freshTimer(root, tool, timer.phase === "break" ? "focus" : "break");
    else if (action === "timer-lap") { if (tool.id !== "stopwatch" || timer.elapsedMs <= 0) throw new Error("Chạy stopwatch trước khi ghi vòng."); timer.laps = [...(timer.laps || []), timer.elapsedMs].slice(-100); }
    saveTimer(tool, timer); startTimerPaint(root, tool);
  }

  function renderDashboard(root) {
    const target = root.querySelector("[data-ut-dashboard]"); if (!target) return;
    const store = readStore(), metrics = [{ label: "Ghi chú", value: (store.notes || []).length }, { label: "Todo chưa xong", value: (store.todo || []).filter((item) => !item.done).length }, { label: "Kanban đang làm", value: (store.kanban || []).filter((item) => item.column === "doing").length }, { label: "Nhắc việc", value: (store.reminder || []).length }, { label: "Bookmark", value: (store.bookmark || []).length }, { label: "Hoạt động", value: (store.activity || []).length }];
    target.innerHTML = metrics.map((item) => `<article><span>${esc(item.label)}</span><strong>${item.value}</strong></article>`).join("");
  }
  function renderAnalytics(root) {
    const target = root.querySelector("[data-ut-analytics]"); if (!target) return;
    const activity = rows("activity"), groups = new Map(); for (const event of activity) groups.set(event.tool, (groups.get(event.tool) || 0) + 1);
    const metrics = [{ label: "Thao tác lưu", value: activity.length }, { label: "Công cụ đã dùng", value: groups.size }, { label: "Nhật ký giữ tối đa", value: 250 }, { label: "Trình duyệt online", value: navigator.onLine ? "Có" : "Không" }];
    target.innerHTML = metrics.map((item) => `<article><span>${esc(item.label)}</span><strong>${esc(item.value)}</strong></article>`).join("");
    setOutput(root, [...metrics.map((item) => `${item.label}: ${item.value}`), ...[...groups].sort((a, b) => b[1] - a[1]).map(([tool, count]) => `${byId.get(tool)?.name || tool}: ${count} thao tác`)].join("\n"));
  }
  async function systemReport(id) {
    const report = [`Online: ${navigator.onLine}`, `CPU logic: ${navigator.hardwareConcurrency || "không hỗ trợ"}`, `Device memory: ${navigator.deviceMemory ? `${navigator.deviceMemory} GB (ước tính)` : "không hỗ trợ"}`, `Viewport: ${innerWidth}×${innerHeight}`, `Language: ${navigator.language}`, `Platform: ${navigator.userAgentData?.platform || navigator.platform || "N/A"}`];
    if (navigator.storage?.estimate) { const estimate = await navigator.storage.estimate(); report.push(`Storage: ${((estimate.usage || 0) / 1048576).toFixed(1)} MB / ${((estimate.quota || 0) / 1073741824).toFixed(1)} GB`); }
    if (id === "memory-usage") report.push(`JS heap: ${performance.memory ? `${(performance.memory.usedJSHeapSize / 1048576).toFixed(1)} MB / ${(performance.memory.jsHeapSizeLimit / 1048576).toFixed(1)} MB giới hạn` : "không được trình duyệt cung cấp"}`);
    if (id === "storage-usage") { const ownBytes = new TextEncoder().encode(JSON.stringify(readStore())).length; report.push(`Dữ liệu JSON All Tools của tài khoản: ${ownBytes} byte (ước lượng UTF-8)`, "Storage estimate là toàn origin, không phải ổ đĩa hoặc dung lượng riêng của tài khoản."); }
    return report.join("\n");
  }

  function captureSessionDraft() { const toolId = runtime.root?.dataset?.utTool; if (!toolId || !runtime.scope || privateFormTools.has(toolId)) return; const fields = {}; for (const field of runtime.root.querySelectorAll("input[name], textarea[name], select[name]")) { if (field.type === "file" || field.type === "password") continue; fields[field.name] = field.type === "checkbox" ? field.checked : field.value.slice(0, 100000); } sessionDrafts.set(`${runtime.scope}:${toolId}`, { fields, editId: runtime.editId }); }
  function restoreSessionDraft(root, tool) { if (privateFormTools.has(tool.id)) return; const saved = sessionDrafts.get(`${runtime.scope}:${tool.id}`); if (!saved) return; for (const [name, value] of Object.entries(saved.fields)) { const field = root.querySelector(`[name="${name}"]`); if (!field) continue; if (field.type === "checkbox") field.checked = value; else field.value = value; } runtime.editId = saved.editId; const status = root.querySelector("[data-ut-edit-status]"); if (status && saved.editId) status.textContent = "Tiếp tục sửa bản nháp trong phiên này"; }
  function cleanup() { captureSessionDraft(); runtime.controller?.abort(); runtime.cancelWorker?.(); clearInterval(runtime.timer); clearInterval(runtime.clock); runtime.cleanup.splice(0).forEach((fn) => fn()); runtime.timer = null; runtime.clock = null; runtime.controller = null; runtime.root = null; runtime.scope = null; runtime.editId = null; runtime.logs = []; runtime.generation++; }
  function mount(host, options = {}) {
    cleanup();
    const tool = byId.get(options.toolId) || byName.get(options.name) || byId.get(slug(options.toolId || options.name));
    if (!host || !tool) return null;
    runtime.scope = accountScope();
    host.innerHTML = tool.group === "developer" ? developerMarkup(tool) : tool.group === "productivity" ? productivityMarkup(tool) : systemMarkup(tool);
    const root = host.firstElementChild;
    runtime.root = root; applyPreferences(root); renderList(root, tool); renderClipboard(root); renderDashboard(root); renderAnalytics(root);
    if (["pomodoro", "stopwatch", "countdown", "focus-mode"].includes(tool.id)) { const timer = timerState(tool); if (timer) { if (root.querySelector('[name="minutes"]')) root.querySelector('[name="minutes"]').value = timer.focusMinutes || 25; if (root.querySelector('[name="break-minutes"]')) root.querySelector('[name="break-minutes"]').value = timer.breakMinutes || 5; } startTimerPaint(root, tool); }
    restoreSessionDraft(root, tool); if (recordTools.has(tool.id)) renderList(root, tool);
    const paintClock = () => { if (tool.id !== "clock") return; const zone = value(root, "timezone") || "Asia/Ho_Chi_Minh"; root.querySelector("[data-ut-clock]").textContent = new Date().toLocaleTimeString(root.lang === "en" ? "en-US" : "vi-VN", { timeZone: zone }); root.querySelector("[data-ut-date]").textContent = `${new Date().toLocaleDateString(root.lang === "en" ? "en-US" : "vi-VN", { dateStyle: "full", timeZone: zone })} · ${zone}`; };
    const tickVisible = () => { clearInterval(runtime.clock); runtime.clock = null; if (tool.id === "clock") { paintClock(); if (!document.hidden) runtime.clock = setInterval(paintClock, 1000); } if (tool.id === "reminder" && !document.hidden) runtime.clock = setInterval(() => renderList(root, tool), 30000); if (["pomodoro", "stopwatch", "countdown", "focus-mode"].includes(tool.id)) startTimerPaint(root, tool); };
    tickVisible();
    const onClick = async (event) => {
      const node = event.target.closest("button"); if (!node) return;
      const action = node.dataset.utAction; const managed = action || node.dataset.utRecordToggle || node.dataset.utRecordDelete || node.dataset.utRecordEdit || node.dataset.utRecordMove || node.dataset.utClipboardRestore || node.dataset.utClipboardDelete || node.dataset.utPreset; if (!managed) return;
      event.preventDefault(); event.stopPropagation(); if (node.disabled) return; const status = root.querySelector("[data-ut-status]"); status.textContent = root.lang === "en" ? "Working…" : "Đang xử lý..."; status.dataset.state = "running"; node.disabled = true;
      try {
        guardScope(); const key = recordKey(tool), current = rows(key), id = node.dataset.utRecordToggle || node.dataset.utRecordDelete || node.dataset.utRecordEdit || node.dataset.utRecordMove;
        if (id) {
          const item = current.find((entry) => entry.id === id); if (!item) throw new Error("Mục không còn tồn tại.");
          if (node.dataset.utRecordEdit) { runtime.editId = id; for (const name of ["title", "meta", "date", "column"]) { const input = root.querySelector(`[name="${name}"]`); if (input) input.value = item[name] || (name === "column" ? "backlog" : ""); } const editStatus = root.querySelector("[data-ut-edit-status]"); if (editStatus) editStatus.textContent = `Đang sửa: ${item.title}`; root.querySelector('[name="title"]')?.focus(); }
          else { let updated = current; if (node.dataset.utRecordDelete) updated = current.filter((entry) => entry.id !== id); else if (node.dataset.utRecordMove) { const index = current.findIndex((entry) => entry.id === id), next = index + (node.dataset.utDirection === "up" ? -1 : 1); if (next >= 0 && next < current.length) { updated = current.slice(); [updated[index], updated[next]] = [updated[next], updated[index]]; } } else updated = current.map((entry) => entry.id === id ? { ...entry, done: !entry.done, read: !entry.read, column: entry.done ? "backlog" : "done" } : entry); saveRows(key, updated); renderList(root, tool); record(tool.id, node.dataset.utRecordDelete ? "delete" : node.dataset.utRecordMove ? "reorder" : "toggle"); }
        } else if (node.dataset.utClipboardRestore) { const item = rows("clipboard").find((entry) => entry.id === node.dataset.utClipboardRestore); if (!item) throw new Error("Bản sao không tồn tại."); root.querySelector('[name="source"]').value = item.text; }
        else if (node.dataset.utClipboardDelete) { saveRows("clipboard", rows("clipboard").filter((entry) => entry.id !== node.dataset.utClipboardDelete)); renderClipboard(root); }
        else if (node.dataset.utPreset) { root.querySelector('[name="minutes"]').value = node.dataset.utPreset; root.querySelector('[name="break-minutes"]').value = { 25: 5, 45: 15, 50: 10, 90: 20 }[node.dataset.utPreset]; runTimer(root, tool, "timer-reset"); }
        else await runAction(root, tool, action);
        if (runtime.root === root && status.dataset.state === "running") { status.textContent = root.lang === "en" ? "Done" : "Hoàn thành"; status.dataset.state = "success"; }
      } catch (error) { if (runtime.root === root) setOutput(root, error?.name === "AbortError" ? "Đã hủy tác vụ." : error?.message || "Không thể hoàn thành.", "error"); } finally { node.disabled = false; }
    };
    const onChange = (event) => { try { guardScope(); if (event.target.name === "record-search") renderList(root, tool); if (event.target.name === "timezone") paintClock(); if (event.target.dataset.utRecordColumn) { const column = event.target.value; if (!COLUMNS[column]) throw new Error("Cột không hợp lệ."); saveRows(tool.id, rows(tool.id).map((item) => item.id === event.target.dataset.utRecordColumn ? { ...item, column, done: column === "done" } : item)); renderList(root, tool); record(tool.id, "move-column"); } } catch (error) { setOutput(root, error.message, "error"); } };
    const onContext = (event) => { if (tool.id !== "context-menu" || root.dataset.contextEnabled !== "true") return; event.preventDefault(); const menu = root.querySelector("[data-ut-context]"), bounds = root.getBoundingClientRect(); menu.hidden = false; menu.style.left = `${Math.max(0, Math.min((event.clientX || bounds.left) - bounds.left, root.clientWidth - 190))}px`; menu.style.top = `${Math.max(0, (event.clientY || bounds.top) - bounds.top)}px`; };
    const onKey = (event) => { if (event.key === "Escape") { for (const selector of ["[data-ut-context]", "[data-ut-toolbar]", "[data-ut-floating]"]) { const element = root.querySelector(selector); if (element) element.hidden = true; } root.classList.remove("ut-focus-active"); } if (event.key === "F10" && event.shiftKey) { onContext(event); root.querySelector("[data-ut-context] button")?.focus(); } const handle = event.target.closest("[data-ut-handle]"); if (handle && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) { event.preventDefault(); const toolbar = root.querySelector("[data-ut-toolbar]"); moveToolbar(toolbar.offsetLeft + (event.key === "ArrowRight" ? 15 : event.key === "ArrowLeft" ? -15 : 0), toolbar.offsetTop + (event.key === "ArrowDown" ? 15 : event.key === "ArrowUp" ? -15 : 0)); } };
    const moveToolbar = (x, y) => { const toolbar = root.querySelector("[data-ut-toolbar]"); if (toolbar) { toolbar.style.right = "auto"; toolbar.style.left = `${Math.max(0, Math.min(x, root.clientWidth - toolbar.offsetWidth))}px`; toolbar.style.top = `${Math.max(0, Math.min(y, root.clientHeight - toolbar.offsetHeight))}px`; } };
    let drag = null;
    const onPointer = (event) => { const handle = event.target.closest("[data-ut-handle]"); if (!handle) return; const toolbar = root.querySelector("[data-ut-toolbar]"); drag = { x: event.clientX - toolbar.offsetLeft, y: event.clientY - toolbar.offsetTop, pointer: event.pointerId }; handle.setPointerCapture?.(event.pointerId); event.preventDefault(); };
    const onMove = (event) => { if (drag && drag.pointer === event.pointerId) moveToolbar(event.clientX - drag.x, event.clientY - drag.y); };
    const onPointerEnd = () => { drag = null; };
    const onDrag = (event) => { const card = event.target.closest("[data-ut-drag]"); if (card) event.dataTransfer?.setData("text/plain", card.dataset.utDrag); };
    const onDragOver = (event) => { if (event.target.closest("[data-ut-drop]")) event.preventDefault(); };
    const onDrop = (event) => { const target = event.target.closest("[data-ut-drop]"); if (!target) return; event.preventDefault(); try { guardScope(); const id = event.dataTransfer.getData("text/plain"), column = target.dataset.utDrop; if (!COLUMNS[column] || !rows(tool.id).some((item) => item.id === id)) return; saveRows(tool.id, rows(tool.id).map((item) => item.id === id ? { ...item, column, done: column === "done" } : item)); renderList(root, tool); record(tool.id, "move-column"); } catch (error) { setOutput(root, error.message, "error"); } };
    const onRuntimeError = (event) => { if (SENSITIVE.test(String(event.message || event.reason?.message || ""))) return; runtime.logs.unshift({ at: new Date().toISOString(), kind: event.type, message: String(event.message || event.reason?.message || "Lỗi không có thông điệp").slice(0, 500) }); runtime.logs = runtime.logs.slice(0, 100); };
    const onAuth = () => { if (runtime.scope !== accountScope()) { cleanup(); root.innerHTML = '<p class="ut-empty">Tài khoản đã thay đổi. Mở lại công cụ để tiếp tục.</p>'; } };
    const bindings = [["click", onClick], ["input", onChange], ["change", onChange], ["contextmenu", onContext], ["keydown", onKey], ["pointerdown", onPointer], ["pointermove", onMove], ["pointerup", onPointerEnd], ["pointercancel", onPointerEnd], ["dragstart", onDrag], ["dragover", onDragOver], ["drop", onDrop]];
    bindings.forEach(([name, fn]) => root.addEventListener(name, fn)); document.addEventListener("visibilitychange", tickVisible); global.addEventListener?.("hh:auth-change", onAuth);
    if (["console-log-viewer", "error-monitor"].includes(tool.id)) { global.addEventListener?.("error", onRuntimeError); global.addEventListener?.("unhandledrejection", onRuntimeError); runtime.cleanup.push(() => global.removeEventListener?.("error", onRuntimeError), () => global.removeEventListener?.("unhandledrejection", onRuntimeError)); }
    runtime.cleanup.push(() => bindings.forEach(([name, fn]) => root.removeEventListener(name, fn)), () => document.removeEventListener("visibilitychange", tickVisible), () => global.removeEventListener?.("hh:auth-change", onAuth));
    return { root, cleanup };
  }

  global.HHUtilityTools = Object.freeze({ manifests: () => manifests.map((item) => ({ ...item })), supports: (value) => byId.has(value) || byName.has(value) || byId.has(slug(value)), mount, cleanup, safeCalculate, convertUnit, parseTimestamp, compareLines, calendarICS, timerSnapshot, formatDuration, accountScope });
})(window);
