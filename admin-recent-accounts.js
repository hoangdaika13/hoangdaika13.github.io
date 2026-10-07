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
    const dialogs = new Set();
    const selected = new Set();
    let alive = true;
    async function request(view, options = {}) {
      const controller = new AbortController(); pending.add(controller);
      const cancel = () => controller.abort();
      options.signal?.addEventListener("abort", cancel, { once: true });
      if (options.signal?.aborted) controller.abort();
      const toUTC = q => ({ ...q, ...(q?.range === "custom" ? { from: q.from && new Date(q.from).toISOString(), to: q.to && new Date(q.to).toISOString() } : {}) });
      try { return await ctx.api(view, { ...options, ...(options.query ? { query: toUTC(options.query) } : {}), ...(options.body?.query ? { body: { ...options.body, query: toUTC(options.body.query) } } : {}), signal: controller.signal }); }
      finally { pending.delete(controller); options.signal?.removeEventListener("abort", cancel); }
    }
    function dispose() { alive = false; revision++; clearTimeout(debounce); observer?.disconnect(); for (const c of pending) c.abort(); pending.clear(); for (const d of dialogs) { d.close(); d.remove(); } dialogs.clear(); root = null; }
    const key = () => `hh.admin.accounts.filters.v1.${owner}`;
    function makeDialog(title, content, label) {
      const restore = document.activeElement;
      const dialog = ctx.modal(title, content, label); dialog.classList.add("ar-detail-dialog"); dialogs.add(dialog);
      let done = false;
      const cleanup = () => { if (done) return; done = true; watch.disconnect(); dialogs.delete(dialog); dialog.dispatchEvent(new Event("ar-disposed")); if (!document.querySelector("dialog[open]")) { const target = restore?.isConnected && restore !== document.body ? restore : root?.querySelector(`[data-ar-open="${dialog.dataset.arProfileId || ""}"]`); target?.focus(); } };
      const watch = new MutationObserver(() => { if (!dialog.isConnected) cleanup(); }); watch.observe(document.body, { childList: true });
      dialog.addEventListener("close", cleanup, { once: true }); dialog.addEventListener("cancel", cleanup, { once: true });
      dialog.querySelector('[data-admin-modal-close]')?.setAttribute("aria-label", "Đóng hồ sơ");
      return dialog;
    }
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
    function profilePane(section, data) {
      const u = data.user, rows = list => list.join("") || blank("Chưa có dữ liệu trong thời hạn lưu giữ.");
      const consent = value => value == null ? "Chưa ghi nhận" : value ? "Đã cho phép" : "Đã tắt";
      const entry = (title, meta, detail = "") => `<article class="ar-entry"><strong>${esc(title)}</strong><span>${esc(meta)}</span><p>${esc(detail)}</p></article>`;
      if (section === "overview") return `<div class="ar-profile-grid">${[
        ["Trạng thái",u.status,u.suspendedUntil ? "Đình chỉ đến "+date(u.suspendedUntil) : "Không có thời hạn đình chỉ",u.moderationReason],
        ["Xác minh",data.verified ? "Đã xác minh email" : "Chưa xác minh email",u.provider,"Tạo "+date(u.createdAt)+" · cập nhật "+date(u.updatedAt)],
        ["Phiên & hoạt động",u.activeSessions+" phiên còn hiệu lực","Đăng nhập "+date(u.lastLoginAt),"Hoạt động "+date(u.lastActivityAt)+" · workspace "+(u.workspace || "Chưa ghi nhận")],
        ["Bảo mật",u.failedLogins+" thất bại · "+u.securitySignals+" tín hiệu cần kiểm tra","Đổi mật khẩu "+date(u.passwordChangedAt),"Đổi provider "+date(u.providerChangedAt)]
      ].map(([label,value,meta,note])=>`<article><small>${esc(label)}</small><strong>${esc(value)}</strong><span>${esc(meta)}</span><p>${esc(note || "Chưa ghi nhận")}</p></article>`).join("")}</div><p class="ar-disclosure">Số liệu hồ sơ tính trong tối đa 100 phiên và 100 sự kiện gần nhất còn lưu. Phiên còn hiệu lực không đồng nghĩa đang online.</p>`;
      if(section==="security") return `<div class="ar-inline-filters"><label>Kết quả<select data-ar-event-result><option value="all">Tất cả</option><option value="success">Thành công</option><option value="failed">Thất bại</option></select></label><label>Tín hiệu<select data-ar-event-risk><option value="all">Tất cả</option><option value="new">Thiết bị mới</option><option value="risk">Cần kiểm tra</option></select></label><label>Provider / trình duyệt / thiết bị<input type="search" data-ar-event-search maxlength="100"></label><label>Từ ngày<input type="date" data-ar-event-from></label><label>Đến ngày<input type="date" data-ar-event-to></label></div><p data-ar-event-count role="status"></p>${rows((data.events||[]).map(v=>`<article class="ar-entry" data-ar-event data-at="${esc(v.createdAt)}" data-result="${v.success?"success":"failed"}" data-new="${!!v.newDevice}" data-risk="${!!v.suspicious}" data-search="${esc([v.provider,v.type,v.browser,v.platform,v.device].join(" ").toLowerCase())}"><strong>${esc(v.type)} · ${v.success?"Thành công":"Thất bại"}</strong><span>${esc(v.browser)} · ${esc(v.platform)} · ${esc(v.device)}</span><small>${date(v.createdAt)} · ${esc(v.region || "Chưa xác định")} · ${esc(v.ip)}</small><p>${esc(v.reason)}${v.newDevice?" · Thiết bị mới":""}${v.suspicious?" · Cần kiểm tra":""}</p></article>`))}<p class="ar-disclosure">Tối đa 100 sự kiện. Tín hiệu cần kiểm tra không phải kết luận vi phạm.</p>`;
      if(section==="sessions") return `<label>Trạng thái phiên<select data-ar-session-filter><option value="all">Tất cả</option>${Object.entries(STATES).map(([key,label])=>`<option value="${key}">${label}</option>`).join("")}</select></label><p data-ar-session-count role="status"></p>${rows((data.sessions||[]).map(s=>`<article class="ar-entry" data-ar-session="${esc(s.state)}"><strong>${esc(s.browser || "Chưa rõ")} · ${esc(s.platform)}${s.current?" · Phiên Admin hiện tại":""}</strong><code>Phiên ${esc(String(s.id).slice(0,8))}…</code><span>${esc(STATES[s.state] || s.state)} · ${esc(s.provider)} · ${esc(s.device)}</span><small>${esc(s.region || "Chưa xác định")} · ${esc(s.ip)}</small><small>Bắt đầu ${date(s.createdAt)} · hoạt động ${date(s.lastSeenAt)}</small><small>Hết hạn ${date(s.expiresAt)} · idle ${date(s.idleExpiresAt)}</small>${s.revokedAt?`<small>Kết thúc ${date(s.revokedAt)} · ${esc(s.reason)} · người thu hồi ${esc(s.revokedBy || "Chưa ghi nhận")}</small>`:""}${s.state==="active" && !s.current && ctx.has("sessions.revoke") && (data.canManage || u.id===owner)?`<button type="button" class="ar-danger" data-ar-revoke="${esc(s.id)}">Đăng xuất phiên này</button>`:""}</article>`))}<p class="ar-disclosure">Sắp xếp theo hoạt động gần nhất, tối đa 100 phiên. Backend dọn phiên hết hạn bằng TTL.</p>`;
      if(section==="workspace"){
        if(!data.canActivity)return blank(data.activityReason || "Không có quyền hoặc người dùng chưa cho phép hiển thị hoạt động chi tiết.");
        const usage=new Map();for(const a of data.activity||[]){const v=usage.get(a.module)||{count:0,at:a.createdAt};v.count++;usage.set(a.module,v);}
        return rows([...usage].map(([module,v])=>entry(module,v.count+" sự kiện · "+date(v.at))))+blank("Tổng hợp tối đa 100 sự kiện đã được cho phép; không có nội dung chat, prompt hoặc file riêng tư.");
      }
      if(section==="access"){
        if(!data.canRoles)return blank("Không có quyền xem quyền và vai trò.");
        const accessRows=(items,role)=>rows((items||[]).map(a=>entry(role?a.roleId+" · phiên bản "+a.roleVersion:a.permission,a.status+" · scope "+a.scope?.type+" · cấp bởi "+(a.grantedBy||"Chưa ghi nhận"),Object.entries(a.scope||{}).filter(([k,v])=>k!=="type"&&Array.isArray(v)&&v.length).map(([k,v])=>k+": "+v.join(", ")).join(" · ")+"\nCấp "+date(a.grantedAt)+" · hết hạn "+date(a.expiresAt)+"\n"+a.reason).replace("</article>", role && a.status==="active" && data.canManage && ctx.has("users.roles") ? `<button type="button" class="ar-danger" data-ar-assignment-revoke="${esc(a.id)}">Thu hồi assignment</button></article>` : "</article>")));
        return `${ctx.has("permissions.simulate")?'<button type="button" data-admin-permission-simulate>Mô phỏng quyền (không thay đổi tài khoản)</button>':""}<p>Vai trò hệ thống: <strong>${esc((u.roles||[]).join(", ")||"member")}</strong></p><details open><summary>Quyền toàn hệ thống có hiệu lực</summary><div class="ar-permission-list">${(data.effectivePermissions||[]).map(p=>`<code>${esc(p)}</code>`).join("")||"Chưa có quyền quản trị toàn hệ thống."}</div></details><details open><summary>Role assignment (tối đa 100)</summary>${accessRows(data.roleAssignments,true)}</details><details><summary>Permission grant (tối đa 100)</summary>${accessRows(data.accessGrants,false)}</details>${blank("Quyền theo scope chỉ áp dụng với tài nguyên và điều kiện tương ứng. Policy backend kiểm tra mọi thay đổi vai trò.")}`;
      }
      if(section==="support")return data.canSupport?rows((data.support||[]).map(t=>entry(t.source+" · "+t.status,"Mã "+t.id+" · ưu tiên "+(t.priority||"Chưa ghi nhận"),"Tạo "+date(t.createdAt)+" · cập nhật "+date(t.updatedAt))))+blank("Metadata hỗ trợ, tối đa 60 bản ghi. Nội dung trao đổi riêng tư không được tải trong hồ sơ."):blank("Không có quyền xem hoạt động hỗ trợ.");
      if(section==="audit")return data.canAudit?rows((data.audit||[]).map(v=>entry(v.action+" · "+(v.outcome||"Chưa ghi nhận kết quả"),(v.admin||"Chưa ghi nhận")+" · "+date(v.createdAt),v.reason)))+blank("Tối đa 50 bản ghi audit liên quan trực tiếp đến tài khoản."):blank("Không có quyền xem nhật ký quản trị.");
      if(section==="notes"){
        if(!data.canNotes)return blank("Không có quyền xem ghi chú và trạng thái xem xét.");
        const v=data.reviewDetail||{};
        return `<section class="ar-review-card"><strong>${data.review?"Đang cần xem xét":"Chưa đánh dấu xem xét"}</strong><span>Ưu tiên ${esc(v.priority||"normal")} · phụ trách ${esc(v.assigneeId||"Chưa gán")}</span><p>${esc(v.reason||"Chưa ghi nhận lý do")}</p><small>Xem lại ${date(v.reviewAt)} · cập nhật ${date(v.updatedAt)}</small></section>${data.canManage?'<div class="ar-actions"><button type="button" data-ar-note>Thêm ghi chú</button><button type="button" data-ar-review>Sửa trạng thái xem xét</button></div>':""}${rows((data.notes||[]).map(n=>`<article class="ar-entry"><p>${esc(n.text)}</p><small>Tác giả ${esc(n.authorId)} · tạo ${date(n.createdAt)} · sửa ${date(n.updatedAt)} · hết hạn ${date(n.expiresAt)}</small>${data.canManage&&n.authorId===owner?`<div class="ar-actions"><button type="button" data-ar-edit-note="${esc(n.id)}">Sửa ghi chú</button><button type="button" class="ar-danger" data-ar-delete-note="${esc(n.id)}">Xóa ghi chú của tôi</button></div>`:""}</article>`))}`;
      }
      return `<div class="ar-profile-grid"><article><small>Phân tích</small><strong>${consent(data.privacy?.analyticsConsent)}</strong></article><article><small>Cá nhân hóa</small><strong>${consent(data.privacy?.personalizationConsent)}</strong></article></div><p>Cập nhật consent: ${date(data.privacy?.updatedAt)}</p>${blank("Dữ liệu dùng để quản lý tài khoản, xử lý hỗ trợ và kiểm tra an toàn. IP được che; hồ sơ không trả về mật khẩu, OTP, token, cookie, API key hoặc nội dung riêng tư.")}`;
    }
    async function open(id, initial = "overview") {
      if(!owner){const me=await request("me");owner=me.user?.id||"";}
      if(!alive)return;
      const dialog=makeDialog("Hồ sơ tài khoản",'<div class="ar-dialog" role="status">Đang tải hồ sơ…</div>',"Đóng");
      dialog.dataset.arProfileId=id;
      const controller=new AbortController();let stamp=0,current=initial,base,tabRequest;const cache=new Map();
      dialog.addEventListener("ar-disposed",()=>{controller.abort();tabRequest?.abort();},{once:true});
      dialog.querySelector("form").addEventListener("submit",e=>{e.preventDefault();dialog.close();dialog.remove();});
      const tabs=[["overview","Tổng quan"],["security","Đăng nhập & bảo mật"],["sessions","Phiên & thiết bị"],["workspace","Workspace"],["access","Quyền & vai trò"],["support","Hỗ trợ"],["audit","Audit Admin"],["notes","Ghi chú & xem xét"],["privacy","Quyền riêng tư"]];
      async function load(section,refresh=false){
        tabRequest?.abort();tabRequest=new AbortController();
        current=section;const seq=++stamp,pane=dialog.querySelector("[data-ar-profile-pane]");
        if(pane){pane.innerHTML='<p role="status">Đang tải mục hồ sơ…</p>';pane.setAttribute("aria-busy","true");}
        dialog.querySelectorAll("[data-ar-tab]").forEach(tab=>{const selected=tab.dataset.arTab===section;tab.setAttribute("aria-selected",String(selected));tab.tabIndex=selected?0:-1;});
        try{
          const data=!refresh&&cache.has(section)?cache.get(section):await request("accounts-detail",{query:{id,section},signal:tabRequest.signal});
          if(controller.signal.aborted||!dialog.isConnected||seq!==stamp)return;
          cache.set(section,data);base=base||data;
          if(!pane){
            const u=data.user;
            const management=data.canManage?[["status","Đổi trạng thái","users.moderate"],["roles","Phân quyền","users.roles"],["features","Giới hạn workspace","users.features"],["revoke","Thu hồi mọi phiên","sessions.revoke"]].filter(([, ,p])=>ctx.has(p)).map(([mode,label])=>`<button type="button" ${["revoke","status"].includes(mode)?'class="ar-danger"':""} data-admin-user-action="${mode}" data-user-id="${esc(id)}" data-user-features="${esc((u.restrictedFeatures||[]).join(","))}">${label}</button>`).join(""):blank("Tài khoản được bảo vệ bởi chính sách tự quản trị hoặc cấp bậc quyền.");
            dialog.querySelector("main").innerHTML=`<div class="ar-dialog"><header class="ar-profile-header"><small>HH IDENTITY · HỒ SƠ 360°</small><h2>${esc(u.name||u.email)}</h2><p>${esc(u.email)} · <code>${esc(u.id)}</code></p><p>${esc((u.roles||[]).join(", ")||"member")} · ${esc(u.status)}</p><div class="ar-actions"><button type="button" data-ar-profile-refresh>Làm mới mục này</button><button type="button" data-ar-copy>Sao chép HH ID</button>${ctx.has("reports.export")?'<button type="button" data-ar-profile-export>Xuất hồ sơ JSON</button>':""}</div><div class="ar-actions">${management}</div>${data.canManage&&ctx.has("users.moderate")?`<button type="button" data-admin-user-action="verify" data-user-id="${esc(id)}" data-user-verified="${!!data.verified}">${data.verified?"Bỏ xác minh":"Xác minh tài khoản"}</button>`:""}${id===owner&&ctx.has("sessions.revoke")?'<button type="button" class="ar-danger" data-ar-revoke-others>Đăng xuất các phiên Admin khác</button>':""}</header><nav class="ar-tabs" role="tablist" aria-label="Các phần hồ sơ">${tabs.map(([key,label])=>`<button type="button" id="ar-tab-${key}" role="tab" aria-controls="ar-profile-pane" aria-selected="${section===key}" tabindex="${section===key?0:-1}" data-ar-tab="${key}">${label}</button>`).join("")}</nav><div id="ar-profile-pane" data-ar-profile-pane role="tabpanel" aria-labelledby="ar-tab-${section}">${profilePane(section,data)}</div><p data-ar-profile-status role="status" aria-live="polite"></p></div>`;
          }else{pane.removeAttribute("aria-busy");pane.setAttribute("aria-labelledby","ar-tab-"+section);pane.innerHTML=profilePane(section,data);}
          applyFilters();
        }catch(err){if(controller.signal.aborted||!dialog.isConnected||seq!==stamp)return;const target=pane||dialog.querySelector("main");target.removeAttribute("aria-busy");target.innerHTML=`<p role="alert">${esc(err.message)}</p><button type="button" data-ar-profile-refresh>Thử lại</button>`;}
      }
      function feedback(message){const el=dialog.querySelector("[data-ar-profile-status]");if(el)el.textContent=message;}
      function applyFilters(){
        const search=dialog.querySelector("[data-ar-event-search]")?.value.toLowerCase()||"",result=dialog.querySelector("[data-ar-event-result]")?.value||"all",risk=dialog.querySelector("[data-ar-event-risk]")?.value||"all";let count=0;
        const from=dialog.querySelector("[data-ar-event-from]")?.value,to=dialog.querySelector("[data-ar-event-to]")?.value;
        dialog.querySelectorAll("[data-ar-event]").forEach(row=>{const time=new Date(row.dataset.at).getTime();row.hidden=!(result==="all"||row.dataset.result===result)||!(risk==="all"||row.dataset[risk==="new"?"new":"risk"]==="true")||!row.dataset.search.includes(search)||(from&&!(time>=new Date(from+"T00:00:00").getTime()))||(to&&!(time<=new Date(to+"T23:59:59.999").getTime()));if(!row.hidden)count++;});
        const e=dialog.querySelector("[data-ar-event-count]");if(e)e.textContent=count+" sự kiện phù hợp trong dữ liệu đã tải";
        const state=dialog.querySelector("[data-ar-session-filter]")?.value||"all";count=0;
        dialog.querySelectorAll("[data-ar-session]").forEach(row=>{row.hidden=state!=="all"&&row.dataset.arSession!==state;if(!row.hidden)count++;});const s=dialog.querySelector("[data-ar-session-count]");if(s)s.textContent=count+" phiên phù hợp trong dữ liệu đã tải";
      }
      dialog.addEventListener("input",applyFilters);dialog.addEventListener("change",applyFilters);
      dialog.addEventListener("keydown",e=>{const tab=e.target.closest("[data-ar-tab]");if(!tab||!["ArrowLeft","ArrowRight","Home","End"].includes(e.key))return;e.preventDefault();const list=[...dialog.querySelectorAll("[data-ar-tab]")],index=list.indexOf(tab),next=e.key==="Home"?0:e.key==="End"?list.length-1:(index+(e.key==="ArrowLeft"?-1:1)+list.length)%list.length;list[next].focus();load(list[next].dataset.arTab);});
      dialog.addEventListener("click",async e=>{
        const b=e.target.closest("button");if(!b)return;
        try{
          if(b.dataset.arTab)return await load(b.dataset.arTab);
          if(b.hasAttribute("data-ar-profile-refresh")){cache.clear();return await load(current,true);}
          if(b.hasAttribute("data-ar-copy")){await navigator.clipboard.writeText(id);feedback("Đã sao chép HH ID.");}
          if(b.hasAttribute("data-ar-profile-export")){b.disabled=true;const data=await request("accounts-profile-export",{method:"POST",body:{userId:id},signal:controller.signal});if(controller.signal.aborted)return;const url=URL.createObjectURL(new Blob([data.content],{type:"application/json"})),a=document.createElement("a");a.href=url;a.download="hh-account-profile.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);feedback("Đã xuất hồ sơ; nhật ký quản trị đã ghi nhận.");b.disabled=false;}
          const u=base?.user;if(!u)return;
          if(b.dataset.arRevoke)return confirmAction("Đăng xuất một phiên",u,{action:"session:revoke",sessionId:b.dataset.arRevoke},"action",false,"","sessions");
          if(b.hasAttribute("data-ar-revoke-others"))return confirmAction("Giữ phiên này, đăng xuất các phiên Admin khác",u,{action:"sessions:revoke-others"},"accounts-manage",false,"","sessions");
          if(b.hasAttribute("data-ar-note"))return confirmAction("Thêm ghi chú nội bộ",u,{action:"note:add"},"accounts-manage",true);
          const notes=cache.get("notes");
          if(b.dataset.arEditNote){const n=notes?.notes.find(v=>v.id===b.dataset.arEditNote);if(n)return confirmAction("Sửa ghi chú nội bộ",u,{action:"note:edit",noteId:n.id},"accounts-manage",true,n.text);}
          if(b.dataset.arDeleteNote)return confirmAction("Xóa ghi chú của bạn",u,{action:"note:delete",noteId:b.dataset.arDeleteNote},"accounts-manage");
          if(b.dataset.arAssignmentRevoke)return confirmAction("Thu hồi role assignment",u,{action:"assignment:revoke",assignmentId:b.dataset.arAssignmentRevoke},"action",false,"","access");
          if(b.hasAttribute("data-ar-review"))return confirmAction("Cập nhật xem xét tài khoản",u,{action:"review:set",...notes?.reviewDetail},"accounts-manage");
        }catch(err){b.disabled=false;feedback(err.message);}
      });
      await load(initial);
    }
    function confirmAction(title,u,body,view,note=false,initialText="",returnTab="notes"){
      const localDate=value=>value?new Date(new Date(value).getTime()-new Date(value).getTimezoneOffset()*60000).toISOString().slice(0,16):"";
      const review=body.action==="review:set"?`<label><input name="review" type="checkbox" ${body.review?"checked":""}>Cần xem xét</label><label>Mức ưu tiên<select name="priority">${[["low","Thấp"],["normal","Bình thường"],["high","Cao"],["urgent","Khẩn"]].map(([v,l])=>`<option value="${v}" ${body.priority===v?"selected":""}>${l}</option>`).join("")}</select></label><label>HH ID người phụ trách (tùy chọn)<input name="assigneeId" value="${esc(body.assigneeId)}" maxlength="24"></label><label>Thời điểm xem lại (tùy chọn)<input name="reviewAt" type="datetime-local" value="${esc(localDate(body.reviewAt))}"></label>`:"";
      const dialog=makeDialog(title,`<div class="ar-dialog"><p>Tài khoản <strong>${esc(u.email||u.name)}</strong> · <code>${esc(u.id)}</code></p>${view==="action"?'<p class="ar-disclosure">Phiên được chọn sẽ mất quyền truy cập. Phiên Admin hiện tại được bảo vệ.</p>':""}${review}${note?`<label>Ghi chú (không ghi thông tin bí mật)<textarea name="text" required maxlength="1000">${esc(initialText)}</textarea></label>`:""}<label>Lý do bắt buộc<textarea name="reason" required minlength="5" maxlength="1000"></textarea></label></div>`,"Xác nhận");
      const controller=new AbortController();dialog.addEventListener("ar-disposed",()=>controller.abort(),{once:true});
      bindAction(dialog,async form=>{
        const result=await request(view,{method:"POST",signal:controller.signal,body:{...body,userId:u.id,reason:form.get("reason"),...(note?{text:form.get("text")}:{}),...(body.action==="review:set"?{review:form.has("review"),priority:form.get("priority"),assigneeId:form.get("assigneeId"),reviewAt:form.get("reviewAt")?new Date(form.get("reviewAt")).toISOString():null}:{})}});
        if(controller.signal.aborted||!dialog.isConnected)return;
        if(body.action==="session:revoke"&&!result.revoked)throw Error("Phiên đã kết thúc hoặc không còn có thể thu hồi. Hãy làm mới hồ sơ.");
        dialog.close();dialog.remove();await open(u.id,returnTab);
      });
    }
    return { render, open, dispose };
  }
  window.HHAdminRecentAccounts = Object.freeze({ create });
})();
