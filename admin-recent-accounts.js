(() => {
  "use strict";
  const FIELDS = { id: "HH ID", name: "Tên", email: "Email", roles: "Vai trò", status: "Trạng thái", provider: "Phương thức", lastLoginAt: "Đăng nhập", lastActivityAt: "Hoạt động", activeSessions: "Phiên mở", failedLogins: "Thất bại", securitySignals: "Tín hiệu bảo mật", workspace: "Workspace", device: "Thiết bị", browser: "Trình duyệt", platform: "Hệ điều hành", region: "Khu vực", ip: "IP đã che", sessionState: "Trạng thái phiên" };
  const STATES = { active: "Còn hiệu lực", expired: "Hết hạn", revoked: "Bị thu hồi", "logged-out": "Đã đăng xuất", blocked: "Tài khoản bị khóa", unknown: "Không còn dữ liệu phiên" };
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const date = v => v && Number.isFinite(new Date(v).getTime()) ? new Date(v).toLocaleString("vi-VN") : "Chưa ghi nhận";
  const blank = message => `<p class="ar-empty">${esc(message)}</p>`;
  function create(ctx) {
    let query = { range: "30", sort: "login", page: 1, limit: 20 }, root, owner = "", revision = 0, debounce = 0, observer;
    const pending = new Set();
    const selected = new Set();
    let alive = true;
    async function request(view, options = {}) {
      const controller = new AbortController(); pending.add(controller);
      const toUTC = q => ({ ...q, ...(q?.range === "custom" ? { from: q.from && new Date(q.from).toISOString(), to: q.to && new Date(q.to).toISOString() } : {}) });
      try { return await ctx.api(view, { ...options, ...(options.query ? { query: toUTC(options.query) } : {}), ...(options.body?.query ? { body: { ...options.body, query: toUTC(options.body.query) } } : {}), signal: controller.signal }); }
      finally { pending.delete(controller); }
    }
    function dispose() { alive = false; revision++; clearTimeout(debounce); observer?.disconnect(); for (const c of pending) c.abort(); pending.clear(); document.querySelector("dialog.ar-detail-dialog")?.remove(); root = null; }
    const key = () => `hh.admin.accounts.filters.v1.${owner}`;
    function makeDialog(title, content, label) { const dialog = ctx.modal(title, content, label); dialog.classList.add("ar-detail-dialog"); return dialog; }
    const select = (name, label, values) => `<label>${label}<select name="${name}">${values.map(([v, t]) => `<option value="${v}" ${String(query[name] || "all") === v ? "selected" : ""}>${t}</option>`).join("")}</select></label>`;
    function status(message, bad = false) { const el = root?.querySelector("[data-ar-status]"); if (el) { el.textContent = message; el.dataset.error = String(bad); } }
    function urlState() {
      const url = new URL(location.href);
      url.searchParams.set("hhAdminView", "users");
      // Only non-identifying preferences in the URL: never email, IP or names.
      for (const k of ["range", "sort", "page", "status", "state", "signal", "from", "to"]) { if (query[k]) url.searchParams.set(`ar_${k}`, String(query[k])); else url.searchParams.delete(`ar_${k}`); }
      history.replaceState(history.state, "", url);
    }
    async function render(next = {}) {
      alive = true;
      const stamp = ++revision;
      for (const c of pending) c.abort(); pending.clear();
      if (!owner) {
        const me = await request("me");
        if (stamp !== revision) return;
        owner = me.user?.id || "";
        const url = new URL(location.href);
        for (const k of ["range", "sort", "page", "status", "state", "signal", "from", "to"]) if (url.searchParams.has(`ar_${k}`)) query[k] = url.searchParams.get(`ar_${k}`);
      }
      query = { ...query, ...next, tz: new Date().getTimezoneOffset() }; selected.clear();
      ctx.panel().innerHTML = ctx.shell(`<section class="ar-console" aria-busy="true"><p role="status">Đang tải tài khoản đăng nhập gần nhất…</p></section>`, "Tài khoản đăng nhập gần nhất");
      root = ctx.panel().querySelector(".ar-console");
      observer?.disconnect(); observer = new MutationObserver(() => { if (root && !root.isConnected) dispose(); });
      observer.observe(document.body, { childList: true, subtree: true });
      try {
        const data = await request("accounts-recent", { query });
        if (!alive || stamp !== revision || !root?.isConnected) return;
        root.removeAttribute("aria-busy");
        const p = data.pagination;
        const input = (name, label, type = "text") => `<label>${label}<input name="${name}" type="${type}" value="${esc(query[name] || "")}" maxlength="120"></label>`;
        const filters = `<form data-ar-filters class="ar-filters">
          ${input("q", "Tìm tên, email hoặc HH ID")}
          ${select("range", "Đăng nhập trong", [["today", "Hôm nay"], ["7", "7 ngày"], ["30", "30 ngày"], ["custom", "Tùy chỉnh"], ["all", "Tất cả"]])}
          ${select("status", "Tài khoản", [["all", "Mọi trạng thái"], ["active", "Hoạt động"], ["locked", "Khóa"], ["suspended", "Đình chỉ"], ["banned", "Cấm"]])}
          ${select("state", "Phiên đăng nhập", [["all", "Mọi phiên"], ...Object.entries(STATES)])}
          ${select("role", "Vai trò", [["all", "Mọi vai trò"], ...["member", "super_admin", "admin", "security_admin", "release_manager", "content_moderator", "moderator", "support", "analyst"].map(v => [v, v])])}
          ${select("signal", "Tín hiệu", [["all", "Mọi tín hiệu"], ["failed", "Có đăng nhập thất bại"], ["security", "Thiết bị mới / nghi vấn"], ["multiple", "Nhiều phiên còn hiệu lực"], ["review", "Cần xem xét"]])}
          ${select("activity", "Hoạt động", [["all", "Tất cả"], ["recent", "Có hoạt động ≤ 5 phút"], ["inactive", "Không ghi nhận ≤ 5 phút"]])}
          ${select("sort", "Sắp xếp", [["login", "Đăng nhập gần nhất"], ["activity", "Hoạt động gần nhất"], ["sessions", "Nhiều phiên nhất"], ["failures", "Thất bại nhiều nhất"]])}
          <details class="ar-more"><summary>Bộ lọc bổ sung / khoảng thời gian</summary><div>${input("provider", "Phương thức (vd: google)")}${input("device", "Thiết bị / trình duyệt / hệ điều hành")}${input("region", "Khu vực đã ghi nhận")}${data.canActivity ? input("workspace", "Workspace gần nhất") : ""}${input("from", "Từ (khi chọn tùy chỉnh)", "datetime-local")}${input("to", "Đến (khi chọn tùy chỉnh)", "datetime-local")}</div></details>
          <div class="ar-actions"><button type="submit">Áp dụng</button><button type="button" data-ar="reset">Xóa bộ lọc</button><button type="button" data-ar="save">Lưu bộ lọc</button><button type="button" data-ar="load">Mở bộ lọc đã lưu</button><button type="button" data-ar="refresh">Làm mới</button>${ctx.has("reports.export") ? '<button type="button" data-ar="export">Xuất CSV / JSON</button>' : ""}</div>
        </form>`;
        const rows = data.users.map(u => `<tr><td data-label="Tài khoản"><label class="ar-pick"><input type="checkbox" data-ar-pick="${esc(u.id)}" aria-label="Chọn ${esc(u.name || u.email)}"><span><strong>${esc(u.name || "Chưa đặt tên")}</strong><span>${esc(u.email)}</span><code>${esc(u.id)}</code><small>${esc(u.roles.join(", ") || "member")} · ${esc(u.status)}${u.review ? " · Cần xem xét" : ""}</small></span></label></td><td data-label="Đăng nhập"><time>${date(u.lastLoginAt)}</time><small>${esc(u.provider)}</small><small>Hoạt động: ${date(u.lastActivityAt)}</small></td><td data-label="Thiết bị"><span>${esc(u.browser || "Chưa ghi nhận")} · ${esc(u.platform)}</span><small>${esc(u.device)}</small><small>${esc(u.region || "Chưa xác định")} · ${esc(u.ip)}</small></td><td data-label="Phiên"><span class="ar-state">${esc(STATES[u.sessionState])}</span><small>${Number(u.activeSessions)} phiên còn hiệu lực</small><small>Hết hạn phiên gần nhất: ${date(u.expiresAt)}</small></td><td data-label="Hoạt động"><strong>${esc(u.workspace || "Chưa ghi nhận workspace")}</strong><small>${Number(u.failedLogins)} thất bại · ${Number(u.securitySignals)} tín hiệu</small></td><td><button type="button" data-ar-open="${esc(u.id)}">Chi tiết</button></td></tr>`).join("");
        root.innerHTML = `<header class="ar-heading"><div><small>IDENTITY OBSERVATORY</small><h2>Tài khoản đăng nhập gần nhất</h2><p>Dữ liệu từ máy chủ · cập nhật ${date(data.generatedAt)}</p></div><button type="button" data-admin-view="audit">Nhật ký quản trị</button></header>
          <div class="ar-metrics">${[["Tài khoản phù hợp", "accounts"], ["Lượt đăng nhập", "logins"], ["Phiên còn hiệu lực", "sessions"], ["Lần thất bại", "failures"], ["Tín hiệu cần kiểm tra", "signals"]].map(([l, k]) => `<article><span>${l}</span><strong>${Number(data.summary[k] || 0).toLocaleString("vi-VN")}</strong></article>`).join("")}</div>
          ${filters}<p data-ar-status role="status" aria-live="polite"></p><p class="ar-disclosure">${esc(data.note)}</p>
          <div class="ar-selection"><span data-ar-selection>Chưa chọn tài khoản</span><button type="button" data-ar="select-page">Chọn trang này</button><button type="button" data-ar="clear-selection">Bỏ chọn</button></div>
          <table class="ar-table"><caption class="ar-sr">Danh sách tài khoản theo bộ lọc hiện tại</caption><thead><tr><th>Tài khoản</th><th>Đăng nhập / hoạt động</th><th>Thiết bị / khu vực</th><th>Phiên</th><th>Workspace / tín hiệu</th><th>Quản lý</th></tr></thead><tbody>${rows || '<tr><td colspan="6">Không tìm thấy tài khoản. Thử mở rộng khoảng thời gian.</td></tr>'}</tbody></table>
          <footer class="ar-pagination"><span>${p.total} tài khoản · trang ${p.page}/${p.pages}</span><button type="button" data-ar-page="${p.page - 1}" ${p.page <= 1 ? "disabled" : ""}>Trước</button><button type="button" data-ar-page="${p.page + 1}" ${p.page >= p.pages ? "disabled" : ""}>Sau</button></footer>`;
        root.addEventListener("click", onClick); root.addEventListener("change", onChange); root.addEventListener("input", onInput); root.addEventListener("submit", onSubmit);
        urlState();
      } catch (e) {
        if (!alive || stamp !== revision || !root?.isConnected) return;
        root.removeAttribute("aria-busy"); root.innerHTML = `<h2>Không tải được dữ liệu quản trị</h2><p role="alert">${esc(e.message)}</p><button type="button" data-ar="refresh">Thử lại</button>`;
        root.addEventListener("click", onClick);
      }
    }
    function readFilters() { return Object.fromEntries(new FormData(root.querySelector("[data-ar-filters]"))); }
    function submitFilters() { clearTimeout(debounce); render({ ...readFilters(), page: 1 }).catch(e => status(e.message, true)); }
    function onSubmit(e) { if (e.target.matches("[data-ar-filters]")) { e.preventDefault(); submitFilters(); } }
    function onInput(e) {
      if (e.target.name !== "q") return;
      clearTimeout(debounce);
      // Debounced feedback, explicit submit preserves keyboard focus and avoids
      // replacing a form while the administrator is still typing.
      debounce = setTimeout(() => status("Bấm Áp dụng hoặc Enter để tìm với bộ lọc hiện tại."), 350);
    }
    function onChange(e) {
      const box = e.target.closest("[data-ar-pick]");
      if (box) { if (box.checked) selected.add(box.dataset.arPick); else selected.delete(box.dataset.arPick); root.querySelector("[data-ar-selection]").textContent = `${selected.size} tài khoản được chọn trên trang này`; }
    }
    async function onClick(e) {
      const b = e.target.closest("button"); if (!b) return;
      try {
        if (b.dataset.arOpen) return await open(b.dataset.arOpen);
        if (b.dataset.arPage) return await render({ page: Number(b.dataset.arPage) });
        if (b.dataset.ar === "refresh") return await render();
        if (b.dataset.ar === "reset") { query = { range: "30", sort: "login", page: 1, limit: 20 }; return await render(); }
        if (b.dataset.ar === "save") { if (!owner) throw Error("Chưa xác định tài khoản Admin."); localStorage.setItem(key(), JSON.stringify(readFilters())); status("Đã lưu bộ lọc cho tài khoản Admin hiện tại trên thiết bị này."); }
        if (b.dataset.ar === "load") { const value = localStorage.getItem(key()); if (!value) throw Error("Chưa có bộ lọc đã lưu."); query = { range: "30", sort: "login" }; return await render({ ...JSON.parse(value), page: 1 }); }
        if (["select-page", "clear-selection"].includes(b.dataset.ar)) { root.querySelectorAll("[data-ar-pick]").forEach(box => { box.checked = b.dataset.ar === "select-page"; onChange({ target: box }); }); }
        if (b.dataset.ar === "export") return exportDialog();
      } catch (err) { status(err.message, true); }
    }
    function bindAction(dialog, callback) {
      const form = dialog.querySelector("form");
      form.addEventListener("submit", async e => {
        e.preventDefault(); if (form.dataset.busy) return;
        form.dataset.busy = "true"; const submit = form.querySelector('[type="submit"]'); submit.disabled = true;
        let message = form.querySelector("[data-ar-error]"); if (!message) { message = document.createElement("p"); message.dataset.arError = ""; message.setAttribute("role", "alert"); form.querySelector("main").append(message); }
        try { await callback(new FormData(form)); }
        catch (err) { message.textContent = err.message; }
        finally { delete form.dataset.busy; submit.disabled = false; }
      });
    }
    function exportDialog() {
      const dialog = makeDialog("Xuất danh sách tài khoản", `<div class="ar-dialog"><p>Xuất tối đa 1.000 tài khoản theo bộ lọc đã áp dụng${selected.size ? `; chỉ lấy ${selected.size} tài khoản đang chọn` : ""}. Máy chủ ghi nhật ký xuất dữ liệu trước khi tải xuống.</p><label>Định dạng<select name="format"><option value="csv">CSV</option><option value="json">JSON</option></select></label><div class="ar-field-grid">${Object.entries(FIELDS).map(([k, l]) => `<label><input type="checkbox" name="fields" value="${k}" ${["id", "name", "email", "lastLoginAt", "activeSessions", "workspace"].includes(k) ? "checked" : ""}>${l}</label>`).join("")}</div></div>`, "Xuất dữ liệu");
      bindAction(dialog, async form => {
        const fields = form.getAll("fields"); if (!fields.length) throw Error("Chọn ít nhất một trường.");
        const data = await request("accounts-export", { method: "POST", body: { query, fields, format: form.get("format"), ids: [...selected] } });
        const url = URL.createObjectURL(new Blob([data.content], { type: form.get("format") === "csv" ? "text/csv;charset=utf-8" : "application/json" }));
        const a = document.createElement("a"); a.href = url; a.download = `hh-accounts-${new Date().toISOString().slice(0, 10)}.${form.get("format")}`; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        dialog.close(); dialog.remove(); status(`Đã xuất ${data.count} tài khoản; nhật ký máy chủ đã ghi nhận.`);
      });
    }
    async function open(id) {
      if (!owner) { const me = await request("me"); owner = me.user?.id || ""; }
      const dialog = makeDialog("Hồ sơ tài khoản", '<div class="ar-dialog" role="status">Đang tải hồ sơ…</div>', "Đóng");
      dialog.classList.add("ar-detail-dialog"); dialog.querySelector("form").addEventListener("submit", e => { e.preventDefault(); dialog.close(); dialog.remove(); });
      let data;
      try { data = await request("accounts-detail", { query: { id } }); }
      catch (e) { if (dialog.isConnected) dialog.querySelector("main").innerHTML = `<p role="alert">${esc(e.message)}</p>`; return; }
      if (!dialog.isConnected) return;
      const u = data.user;
      const management = data.canManage ? [["status", "Đổi trạng thái", "users.moderate"], ["roles", "Phân quyền", "users.roles"], ["features", "Giới hạn workspace", "users.features"], ["revoke", "Thu hồi mọi phiên", "sessions.revoke"]].filter(([, , p]) => ctx.has(p)).map(([mode, label]) => `<button type="button" data-admin-user-action="${mode}" data-user-id="${esc(id)}" data-user-features="${esc(u.restrictedFeatures.join(","))}">${label}</button>`).join("") : blank("Tài khoản này được bảo vệ bởi quy tắc tự quản trị hoặc cấp bậc quyền.");
      const sessionRows = data.sessions.map(s => `<article class="ar-entry"><strong>${esc(s.browser || "Chưa rõ")} · ${esc(s.platform)}${s.current ? " · Phiên Admin hiện tại" : ""}</strong><span>${esc(STATES[s.state])} · ${esc(s.provider)}</span><small>${esc(s.region || "Chưa xác định")} · ${esc(s.ip)}</small><small>Bắt đầu ${date(s.createdAt)} · hoạt động ${date(s.lastSeenAt)}</small><small>Hết hạn ${date(s.expiresAt)} · giới hạn không hoạt động ${date(s.idleExpiresAt)}</small>${s.revokedAt ? `<small>Kết thúc ${date(s.revokedAt)} · ${esc(s.reason)}</small>` : ""}${s.state === "active" && !s.current && ctx.has("sessions.revoke") && (data.canManage || s.current === false && id === owner) ? `<button type="button" data-ar-revoke="${esc(s.id)}">Đăng xuất phiên này</button>` : ""}</article>`).join("") || blank("Không còn phiên trong thời hạn lưu. Phiên hết hạn được MongoDB dọn bằng TTL.");
      const events = data.events.map(v => `<article class="ar-entry"><strong>${esc(v.type)} · ${v.success ? "Thành công" : "Thất bại"}</strong><span>${esc(v.browser)} · ${esc(v.platform)} · ${esc(v.region)} · ${esc(v.ip)}</span><small>${date(v.createdAt)}${v.newDevice ? " · Thiết bị mới" : ""}${v.suspicious ? " · Có tín hiệu cần kiểm tra" : ""} · ${esc(v.reason)}</small></article>`).join("") || blank("Chưa có sự kiện đăng nhập/bảo mật trong dữ liệu lưu giữ.");
      const usage = new Map(); for (const a of data.activity) { const item = usage.get(a.module) || { count: 0, at: a.createdAt }; item.count++; usage.set(a.module, item); }
      const activity = [...usage].map(([module, v]) => `<article class="ar-entry"><strong>${esc(module)}</strong><span>${v.count} sự kiện trong tối đa 100 sự kiện gần nhất · ${date(v.at)}</span></article>`).join("") || blank("Chưa có hoạt động được phép hiển thị. Không thu thập nội dung nhập hoặc dữ liệu workspace riêng tư.");
      const audit = data.audit.map(v => `<article class="ar-entry"><strong>${esc(v.action)}</strong><span>${esc(v.admin)} · ${date(v.createdAt)}</span><p>${esc(v.reason)}</p></article>`).join("") || blank("Chưa có nhật ký tài khoản hoặc bạn chưa có quyền xem audit.");
      const notes = data.notes.map(n => `<article class="ar-entry"><p>${esc(n.text)}</p><small>Admin ${esc(n.authorId)} · ${date(n.createdAt)}</small>${n.authorId === owner && data.canManage && ctx.has("users.moderate") ? `<button type="button" data-ar-delete-note="${esc(n.id)}">Xóa ghi chú của tôi</button>` : ""}</article>`).join("") || blank("Chưa có ghi chú nội bộ. Ghi chú được lưu tối đa 365 ngày.");
      dialog.querySelector("main").innerHTML = `<div class="ar-dialog"><header><h2>${esc(u.name || u.email)}</h2><p>${esc(u.email)} · <code>${esc(u.id)}</code></p><p>${esc(u.roles.join(", ") || "member")} · ${esc(u.status)} · ${data.review ? "Cần xem xét" : "Chưa đánh dấu"}</p></header><div class="ar-actions">${management}${data.canManage && ctx.has("users.moderate") ? '<button type="button" data-ar-note>Thêm ghi chú</button><button type="button" data-ar-review>Đổi đánh dấu xem xét</button>' : ""}</div><p class="ar-disclosure">Không có chức năng giả danh. Đổi mật khẩu: người dùng thực hiện “Quên mật khẩu” ở trang đăng nhập. Các lịch sử bên dưới có giới hạn lưu giữ, không phải toàn bộ thời gian.</p><details open><summary>Phiên đăng nhập (${data.sessions.length}, tối đa 100)</summary>${sessionRows}</details><details><summary>Đăng nhập & bảo mật (${data.events.length}, tối đa 100)</summary>${events}</details><details><summary>Workspace đã sử dụng (${usage.size})</summary>${activity}</details><details><summary>Nhật ký quản trị (tối đa 50)</summary>${audit}</details><details><summary>Ghi chú nội bộ (tối đa 50)</summary>${notes}</details></div>`;
      if (id === owner && ctx.has("sessions.revoke")) dialog.querySelector(".ar-actions").insertAdjacentHTML("beforeend", '<button type="button" data-ar-revoke-others>Đăng xuất các phiên Admin khác</button>');
      if (data.canManage && ctx.has("users.moderate")) dialog.querySelector(".ar-actions").insertAdjacentHTML("beforeend", `<button type="button" data-admin-user-action="verify" data-user-id="${esc(id)}" data-user-verified="${data.verified ? "true" : "false"}">${data.verified ? "Bỏ xác minh" : "Xác minh tài khoản"}</button>`);
      dialog.addEventListener("click", async e => {
        const b = e.target.closest("button"); if (!b) return;
        if (b.dataset.arRevoke) return confirmAction("Đăng xuất một phiên", u, { action: "session:revoke", sessionId: b.dataset.arRevoke }, "action");
        if (b.hasAttribute("data-ar-revoke-others")) return confirmAction("Giữ phiên này, đăng xuất mọi phiên Admin khác", u, { action: "sessions:revoke-others" }, "accounts-manage");
        if (b.hasAttribute("data-ar-note")) return confirmAction("Thêm ghi chú nội bộ", u, { action: "note:add" }, "accounts-manage", true);
        if (b.dataset.arDeleteNote) return confirmAction("Xóa ghi chú do bạn tạo", u, { action: "note:delete", noteId: b.dataset.arDeleteNote }, "accounts-manage");
        if (b.hasAttribute("data-ar-review")) return confirmAction(data.review ? "Bỏ đánh dấu xem xét" : "Đánh dấu cần xem xét", u, { action: "review:set", review: !data.review }, "accounts-manage");
      });
    }
    function confirmAction(title, u, body, view, note = false) {
      const dialog = makeDialog(title, `<div class="ar-dialog"><p>Tài khoản: <strong>${esc(u.email || u.name)}</strong> · <code>${esc(u.id)}</code></p><p>${view === "action" ? "Phiên được chọn sẽ mất quyền truy cập. Phiên Admin hiện tại được bảo vệ." : "Thay đổi nội bộ sẽ được ghi vào nhật ký quản trị."}</p>${note ? '<label>Ghi chú (không ghi mật khẩu hoặc thông tin nhạy cảm)<textarea name="text" required maxlength="1000"></textarea></label>' : ""}<label>Lý do bắt buộc<textarea name="reason" required minlength="5" maxlength="1000"></textarea></label></div>`, "Xác nhận");
      bindAction(dialog, async form => {
        const result = await request(view, { method: "POST", body: { ...body, userId: u.id, reason: form.get("reason"), ...(note ? { text: form.get("text") } : {}) } });
        if (view === "action" && !result.revoked) throw Error("Phiên đã kết thúc hoặc không còn có thể thu hồi. Hãy làm mới hồ sơ.");
        dialog.close(); dialog.remove(); await open(u.id);
      });
    }
    return { render, open, dispose };
  }
  window.HHAdminRecentAccounts = Object.freeze({ create });
})();
