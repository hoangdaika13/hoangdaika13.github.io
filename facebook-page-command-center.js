(function facebookPageCommandCenter(global) {
  "use strict";

  const STORAGE_KEY = "hh.facebook-page-command-center.v1";
  const TABS = [
    ["dashboard", "Tổng quan"], ["pages", "Pages"], ["composer", "Soạn bài"],
    ["calendar", "Lịch"], ["comments", "Bình luận"], ["insights", "Insights"],
    ["setups", "Tạo hàng loạt"], ["settings", "Thiết lập"]
  ];
  let host = null;
  let state = loadState();
  let statusData = null;
  let dashboard = null;
  let comments = [];
  let insights = [];
  let busy = "";
  let toastTimer = 0;
  let setupEdit = null;

  const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  const apiBase = () => String(global.HH_API_ORIGIN || location.origin).replace(/\/$/, "");
  const authHeaders = () => {
    const token = global.HHAuthSession?.token?.() || "";
    return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  };
  function loadState() {
    try { return { tab: "dashboard", activePageId: "", selectedPageIds: [], search: "", postId: "", ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") }; }
    catch { return { tab: "dashboard", activePageId: "", selectedPageIds: [], search: "", postId: "" }; }
  }
  function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  function formatNumber(value) { return Number(value || 0).toLocaleString("vi-VN"); }
  function formatDate(value) { const date = new Date(value); return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date) : "—"; }
  function activePage() { return statusData?.pages?.find((page) => page.id === state.activePageId) || statusData?.pages?.[0] || null; }
  function selectedIds() { return [...new Set(state.selectedPageIds.filter((id) => statusData?.pages?.some((page) => page.id === id)))]; }

  async function api(path, method = "GET", body = null, query = {}) {
    const url = new URL(`${apiBase()}/api/facebook/${path}`);
    Object.entries(query).forEach(([key, value]) => value !== undefined && value !== "" && url.searchParams.set(key, value));
    const response = await fetch(url, { method, headers: authHeaders(), credentials: "include", cache: "no-store", ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok && response.status !== 207) {
      const error = new Error(data.error || `Facebook API HTTP ${response.status}`);
      error.code = data.code || "FACEBOOK_API_ERROR";
      throw error;
    }
    return data;
  }

  function notify(message, kind = "success") {
    if (!host) return;
    host.querySelector(".fpc-toast")?.remove();
    const item = document.createElement("div");
    item.className = "fpc-toast";
    item.textContent = message;
    if (kind === "error") item.style.borderColor = "rgba(255,105,128,.5)";
    host.querySelector(".fpc-shell")?.append(item);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => item.remove(), 4200);
  }

  function handleOauthResult() {
    const params = new URLSearchParams(location.search);
    const ok = params.get("facebookConnected");
    const error = params.get("facebookError");
    if (!ok && !error) return;
    params.delete("facebookConnected"); params.delete("facebookError");
    history.replaceState({}, "", `${location.pathname}${params.toString() ? `?${params}` : ""}${location.hash}`);
    setTimeout(() => notify(error || "Đã kết nối Facebook Pages.", error ? "error" : "success"), 50);
  }

  async function refresh(loadDashboard = true) {
    busy = "refresh"; render();
    let failure = null;
    try {
      statusData = await api("status");
      if (!statusData.pages.some((page) => page.id === state.activePageId)) state.activePageId = statusData.pages[0]?.id || "";
      if (!state.selectedPageIds.length && state.activePageId) state.selectedPageIds = [state.activePageId];
      saveState();
      if (loadDashboard && state.activePageId) await loadPageDashboard(false);
    } catch (error) { failure = error; }
    finally { busy = ""; render(); if (failure) notify(failure.message, "error"); }
  }

  async function loadPageDashboard(shouldRender = true) {
    if (!state.activePageId) { dashboard = null; return; }
    busy = "dashboard"; if (shouldRender) render();
    let failure = null;
    try { dashboard = await api("page/dashboard", "GET", null, { pageId: state.activePageId }); }
    catch (error) { dashboard = null; failure = error; }
    finally { busy = ""; if (shouldRender) render(); if (failure) notify(failure.message, "error"); }
  }

  function topbar() {
    return `<header class="fpc-topbar">
      <div class="fpc-brand"><span class="fpc-brand__mark">f</span><div><strong>Facebook Page Command Center</strong><small>Quản lý đa Page qua Meta Graph API</small></div></div>
      <nav class="fpc-tabs" aria-label="Khu vực Facebook">${TABS.map(([id, label]) => `<button type="button" class="${state.tab === id ? "is-active" : ""}" data-fpc-tab="${id}">${label}</button>`).join("")}</nav>
      <div class="fpc-topbar__actions"><span class="fpc-status ${statusData?.configured ? "is-on" : ""}">${statusData?.configured ? "Meta sẵn sàng" : "Chưa cấu hình Meta"}</span><button class="fpc-btn" type="button" data-fpc-refresh>${busy ? "Đang tải…" : "Làm mới"}</button><button class="fpc-btn fpc-btn--primary" type="button" data-fpc-connect>Kết nối Page</button></div>
    </header>`;
  }

  function sidebar() {
    const search = state.search.toLocaleLowerCase("vi");
    const pages = (statusData?.pages || []).filter((page) => !search || `${page.name} ${page.category}`.toLocaleLowerCase("vi").includes(search));
    return `<aside class="fpc-sidebar"><div class="fpc-section-title"><strong>Page Fleet</strong><small>${pages.length}/${statusData?.pages?.length || 0}</small></div>
      <input class="fpc-page-search" type="search" value="${esc(state.search)}" placeholder="Tìm Page…" data-fpc-page-search>
      <div class="fpc-actions"><button class="fpc-btn" type="button" data-fpc-select-all>Chọn tất cả</button><button class="fpc-btn" type="button" data-fpc-select-none>Bỏ chọn</button></div>
      <div class="fpc-page-list">${pages.length ? pages.map((page) => `<label class="fpc-page-item ${page.id === state.activePageId ? "is-active" : ""}">
        <input type="checkbox" value="${esc(page.id)}" data-fpc-page-check ${selectedIds().includes(page.id) ? "checked" : ""}>
        ${page.picture ? `<img src="${esc(page.picture)}" alt="">` : `<span class="fpc-avatar"></span>`}
        <span data-fpc-page-open="${esc(page.id)}"><strong>${esc(page.name)}</strong><small>${esc(page.category || page.id)}</small></span>
      </label>`).join("") : `<div class="fpc-empty"><strong>Chưa có Page</strong><p>Kết nối Facebook để nạp các Page bạn có quyền quản lý.</p></div>`}</div>
    </aside>`;
  }

  function taskbar() {
    const jobs = statusData?.jobs || [];
    const audits = statusData?.audits || [];
    return `<aside class="fpc-taskbar"><div class="fpc-section-title"><strong>Task Center</strong><small>${jobs.length} tác vụ</small></div>
      <div class="fpc-list">${jobs.slice(0, 8).map((job) => `<div class="fpc-list-item"><i class="fpc-task-dot ${job.status === "failed" ? "is-error" : ""}"></i><div><strong>${job.kind === "schedule" ? "Lên lịch" : "Đăng bài"} · ${job.status}</strong><span>${job.completed || 0}/${job.total || 0} Page · ${formatDate(job.createdAt)}</span></div></div>`).join("") || `<div class="fpc-empty"><p>Chưa có tác vụ đăng bài.</p></div>`}</div>
      <div class="fpc-section-title" style="margin-top:16px"><strong>Nhật ký</strong><small>30 gần nhất</small></div>
      <div class="fpc-list">${audits.slice(0, 10).map((item) => `<div class="fpc-list-item"><i class="fpc-task-dot ${item.status === "failed" ? "is-error" : ""}"></i><div><strong>${esc(item.action)}</strong><span>${esc(item.detail || item.pageId || "Hoàn tất")}</span><small>${formatDate(item.createdAt)}</small></div></div>`).join("") || `<div class="fpc-empty"><p>Nhật ký sẽ xuất hiện tại đây.</p></div>`}</div></aside>`;
  }

  function heading(title, description, action = "") { return `<div class="fpc-heading"><div><h2>${title}</h2><p>${description}</p></div>${action}</div>`; }
  function emptyConnection() { return `${heading("Kết nối Facebook Pages", "Đăng nhập Meta và cấp đúng quyền cho các Page bạn sở hữu hoặc quản trị.")}<div class="fpc-empty"><strong>Chưa có Facebook Page được kết nối</strong><p>Token chỉ được lưu mã hóa trên máy chủ, tách biệt theo tài khoản HH. App Secret không bao giờ xuất hiện trong trình duyệt.</p><button class="fpc-btn fpc-btn--primary" type="button" data-fpc-connect>Kết nối Meta</button></div>`; }

  function dashboardView() {
    if (!activePage()) return emptyConnection();
    const page = dashboard?.page || activePage();
    const posts = dashboard?.posts || [];
    if (busy === "dashboard" && !dashboard) return `<div class="fpc-empty"><div class="fpc-loader" style="margin:auto"></div><p>Đang đồng bộ Page…</p></div>`;
    const reactions = posts.reduce((sum, post) => sum + Number(post.reactions?.summary?.total_count || 0), 0);
    const commentCount = posts.reduce((sum, post) => sum + Number(post.comments?.summary?.total_count || 0), 0);
    return `${heading(esc(page.name || "Facebook Page"), "Dữ liệu được lấy trực tiếp từ Meta Graph API; không dùng số liệu mẫu.", `<button class="fpc-btn fpc-btn--primary" type="button" data-fpc-tab="composer">Soạn bài mới</button>`)}
      <div class="fpc-grid">
        <article class="fpc-card fpc-metric"><small>Người theo dõi</small><strong>${formatNumber(page.followers_count || page.fan_count)}</strong><small>${esc(page.category || "Facebook Page")}</small></article>
        <article class="fpc-card fpc-metric"><small>Bài gần nhất</small><strong>${formatNumber(posts.length)}</strong><small>Đã đồng bộ tối đa 25 bài</small></article>
        <article class="fpc-card fpc-metric"><small>Tương tác gần đây</small><strong>${formatNumber(reactions + commentCount)}</strong><small>${formatNumber(reactions)} reaction · ${formatNumber(commentCount)} bình luận</small></article>
        <article class="fpc-card fpc-card--wide"><h3>Nội dung gần đây</h3><div class="fpc-list">${posts.slice(0, 8).map((post) => `<div class="fpc-list-item">${post.full_picture ? `<img class="fpc-avatar" src="${esc(post.full_picture)}" alt="">` : ""}<div><strong>${esc(post.message || "Bài đăng không có văn bản")}</strong><span>${formatDate(post.created_time)} · ${post.is_published === false ? "Đã lên lịch" : "Đã đăng"}</span></div>${post.permalink_url ? `<a class="fpc-btn" href="${esc(post.permalink_url)}" target="_blank" rel="noopener">Mở</a>` : ""}</div>`).join("") || `<div class="fpc-empty"><p>Page chưa có bài đăng hoặc quyền đọc chưa được Meta duyệt.</p></div>`}</div></article>
        <article class="fpc-card"><h3>Thông tin Page</h3><div class="fpc-list"><div class="fpc-list-item"><div><strong>Giới thiệu</strong><span>${esc(page.about || page.description || "Chưa có")}</span></div></div><div class="fpc-list-item"><div><strong>Xác minh</strong><span>${esc(page.verification_status || "not_verified")}</span></div></div><div class="fpc-list-item"><div><strong>Graph version</strong><span>${esc(statusData.graphVersion || "")}</span></div></div></div></article>
      </div>`;
  }

  function pagesView() {
    const pages = statusData?.pages || [];
    return `${heading("Quản lý Page Fleet", "Chọn Page làm việc, đăng đa Page và ngắt kết nối khỏi HH mà không xóa Page trên Facebook.", `<button class="fpc-btn fpc-btn--primary" type="button" data-fpc-connect>Thêm Page</button>`)}
      <div class="fpc-table-wrap"><table class="fpc-table"><thead><tr><th>Page</th><th>Danh mục</th><th>Quyền Meta</th><th>Kết nối</th><th>Thao tác</th></tr></thead><tbody>${pages.map((page) => `<tr><td><div class="fpc-list-item">${page.picture ? `<img class="fpc-avatar" src="${esc(page.picture)}" alt="">` : ""}<div><strong>${esc(page.name)}</strong><span>${esc(page.id)}</span></div></div></td><td>${esc(page.category || "—")}</td><td>${page.tasks.slice(0, 3).map((task) => `<span class="fpc-badge">${esc(task)}</span>`).join(" ") || "Theo token"}</td><td>${formatDate(page.connectedAt)}</td><td><button class="fpc-btn" type="button" data-fpc-page-open="${esc(page.id)}">Chọn</button> <button class="fpc-btn fpc-btn--danger" type="button" data-fpc-disconnect="${esc(page.id)}">Ngắt</button></td></tr>`).join("") || `<tr><td colspan="5">${emptyConnection()}</td></tr>`}</tbody></table></div>`;
  }

  function composerView() {
    const pages = statusData?.pages || [];
    return `${heading("Composer đa Page", "Đăng ngay hoặc lên lịch nội dung. Có thể chỉnh riêng nội dung bằng cách gửi từng lượt cho mỗi nhóm Page.")}
      <form class="fpc-card fpc-card--full" data-fpc-compose-form>
        <div class="fpc-form-grid"><label class="fpc-field fpc-field--full"><span>Page nhận bài (${selectedIds().length} đã chọn)</span><div class="fpc-check-grid">${pages.map((page) => `<label class="fpc-check"><input type="checkbox" name="pageId" value="${esc(page.id)}" ${selectedIds().includes(page.id) ? "checked" : ""}>${esc(page.name)}</label>`).join("")}</div></label>
          <label class="fpc-field fpc-field--full"><span>Nội dung bài đăng</span><textarea name="message" maxlength="63206" placeholder="Viết nội dung thật sẽ đăng lên Facebook…" required></textarea></label>
          <label class="fpc-field"><span>Loại nội dung</span><select name="mediaType"><option value="text">Văn bản / liên kết</option><option value="photo">Ảnh từ URL</option><option value="video">Video từ URL</option></select></label>
          <label class="fpc-field"><span>Link đính kèm</span><input name="link" type="url" placeholder="https://…"></label>
          <label class="fpc-field"><span>URL ảnh hoặc video</span><input name="mediaUrl" type="url" placeholder="https://…"></label>
          <label class="fpc-field"><span>Lịch đăng (để trống = đăng ngay)</span><input name="scheduledAt" type="datetime-local"></label>
        </div><div class="fpc-notice" style="margin-top:10px">Meta yêu cầu quyền <b>pages_manage_posts</b>. Lịch đăng phải cách hiện tại ít nhất 10 phút; lỗi từng Page sẽ được giữ riêng trong Task Center để không làm mất toàn bộ batch.</div>
        <div class="fpc-actions"><button class="fpc-btn fpc-btn--primary" type="submit" ${pages.length ? "" : "disabled"}>Đăng / lên lịch</button><button class="fpc-btn" type="reset">Xóa nội dung</button></div>
      </form>`;
  }

  function calendarView() {
    const posts = dashboard?.posts || [];
    const scheduled = posts.filter((post) => post.is_published === false);
    const jobs = statusData?.jobs || [];
    return `${heading("Lịch nội dung", "Theo dõi bài đã lên lịch và lịch sử batch trên Page đang chọn.", `<button class="fpc-btn fpc-btn--primary" type="button" data-fpc-tab="composer">Lên lịch bài</button>`)}
      <div class="fpc-grid"><article class="fpc-card fpc-card--wide"><h3>Bài chờ đăng</h3><div class="fpc-list">${scheduled.map((post) => `<div class="fpc-list-item"><div><strong>${esc(post.message || "Bài đã lên lịch")}</strong><span>${formatDate(post.created_time)}</span></div></div>`).join("") || `<div class="fpc-empty"><p>Không có bài chờ đăng trong dữ liệu Page vừa đồng bộ.</p></div>`}</div></article>
      <article class="fpc-card"><h3>Batch gần đây</h3><div class="fpc-list">${jobs.map((job) => `<div class="fpc-list-item"><div><strong>${esc(job.kind)} · ${esc(job.status)}</strong><span>${job.completed || 0}/${job.total || 0} Page</span><small>${formatDate(job.createdAt)}</small></div></div>`).join("") || `<div class="fpc-empty"><p>Chưa có batch.</p></div>`}</div></article></div>`;
  }

  function commentsView() {
    const posts = dashboard?.posts || [];
    return `${heading("Bình luận & kiểm duyệt", "Đọc, trả lời và ẩn bình luận trên nội dung Page khi App đã được Meta duyệt quyền.")}
      <div class="fpc-card fpc-card--full"><div class="fpc-form-grid"><label class="fpc-field fpc-field--full"><span>Chọn bài đăng</span><select data-fpc-comment-post><option value="">Chọn một bài…</option>${posts.map((post) => `<option value="${esc(post.id)}" ${state.postId === post.id ? "selected" : ""}>${esc((post.message || post.id).slice(0, 90))}</option>`).join("")}</select></label></div>
      <div class="fpc-actions"><button class="fpc-btn fpc-btn--primary" type="button" data-fpc-load-comments>Tải bình luận</button></div></div>
      <div class="fpc-list" style="margin-top:11px">${comments.map((comment) => `<article class="fpc-list-item"><div><strong>${esc(comment.from?.name || "Người dùng Facebook")}</strong><span>${esc(comment.message || "")}</span><small>${formatDate(comment.created_time)} · ${formatNumber(comment.like_count)} lượt thích ${comment.is_hidden ? "· đang ẩn" : ""}</small><form class="fpc-actions" data-fpc-reply-form="${esc(comment.id)}"><input class="fpc-page-search" style="flex:1" name="message" placeholder="Trả lời bình luận…" required><button class="fpc-btn" type="submit">Trả lời</button>${comment.can_hide ? `<button class="fpc-btn" type="button" data-fpc-hide-comment="${esc(comment.id)}" data-hidden="${comment.is_hidden ? "false" : "true"}">${comment.is_hidden ? "Hiện lại" : "Ẩn"}</button>` : ""}</form></div></article>`).join("") || `<div class="fpc-empty"><p>Chọn bài và tải bình luận để bắt đầu.</p></div>`}</div>`;
  }

  function insightsView() {
    return `${heading("Page Insights", "Biểu đồ dùng dữ liệu 28 ngày trực tiếp từ Meta. Tên metric có thể thay đổi theo phiên bản Graph API.", `<button class="fpc-btn fpc-btn--primary" type="button" data-fpc-load-insights>Tải Insights</button>`)}
      <div class="fpc-grid">${insights.map((metric) => { const values = metric.values || []; const total = values.reduce((sum, row) => sum + Number(typeof row.value === "number" ? row.value : 0), 0); return `<article class="fpc-card fpc-metric"><small>${esc(metric.title || metric.name)}</small><strong>${formatNumber(total)}</strong><small>${esc(metric.description || metric.period || "28 ngày")}</small></article>`; }).join("") || `<article class="fpc-card fpc-card--full"><div class="fpc-empty"><strong>Chưa tải Insights</strong><p>Bấm “Tải Insights”. Nếu Meta trả lỗi metric đã thay đổi, hệ thống sẽ hiển thị nguyên nhân thật để bạn cập nhật App.</p></div></article>`}</div>`;
  }

  function setupsView() {
    const setups = statusData?.setups || [];
    const item = setupEdit || {};
    return `${heading("Batch Page Setup", "Chuẩn bị hàng trăm bộ thông tin Page, phát hiện trùng, theo dõi từ bản nháp đến đã kết nối.", `<button class="fpc-btn" type="button" data-fpc-export-setups>Xuất CSV</button>`)}
      <div class="fpc-notice fpc-notice--warn">Meta không cung cấp endpoint tạo Facebook Page mới. Công cụ này chuẩn bị dữ liệu hàng loạt và mở trang tạo chính thức; mỗi Page vẫn cần bạn xác nhận trong Facebook. Không vượt CAPTCHA hoặc giới hạn của Meta.</div>
      <div class="fpc-grid" style="margin-top:11px"><form class="fpc-card fpc-card--wide" data-fpc-setup-form><h3>${item.id ? "Sửa Page Setup" : "Thêm Page Setup"}</h3><input type="hidden" name="id" value="${esc(item.id || "")}"><div class="fpc-form-grid">
        <label class="fpc-field"><span>Tên Page *</span><input name="name" value="${esc(item.name || "")}" required></label><label class="fpc-field"><span>Danh mục</span><input name="category" value="${esc(item.category || "")}" placeholder="Digital creator"></label>
        <label class="fpc-field fpc-field--full"><span>Bio</span><textarea name="bio">${esc(item.bio || "")}</textarea></label><label class="fpc-field"><span>Username dự kiến</span><input name="username" value="${esc(item.username || "")}"></label><label class="fpc-field"><span>Website</span><input name="website" type="url" value="${esc(item.website || "")}"></label>
        <label class="fpc-field"><span>Email</span><input name="email" type="email" value="${esc(item.email || "")}"></label><label class="fpc-field"><span>Điện thoại</span><input name="phone" value="${esc(item.phone || "")}"></label>
        <label class="fpc-field"><span>Ảnh đại diện URL</span><input name="profileImage" type="url" value="${esc(item.profileImage || "")}"></label><label class="fpc-field"><span>Ảnh bìa URL</span><input name="coverImage" type="url" value="${esc(item.coverImage || "")}"></label>
        <label class="fpc-field"><span>CTA</span><input name="cta" value="${esc(item.cta || "")}" placeholder="Learn More"></label><label class="fpc-field"><span>Trạng thái</span><select name="status">${["draft", "ready", "created", "connected", "configured"].map((status) => `<option value="${status}" ${item.status === status ? "selected" : ""}>${status}</option>`).join("")}</select></label>
      </div><div class="fpc-actions"><button class="fpc-btn fpc-btn--primary" type="submit">${item.id ? "Lưu thay đổi" : "Thêm vào danh sách"}</button>${item.id ? `<button class="fpc-btn" type="button" data-fpc-cancel-edit>Hủy sửa</button>` : ""}</div></form>
      <article class="fpc-card"><h3>Nhập hàng loạt</h3><p style="color:#8093ab;font-size:10px;line-height:1.5">CSV hoặc JSON tối đa 500 dòng. Cột: name, category, bio, username, website, email, phone, profileImage, coverImage, cta.</p><label class="fpc-field"><span>Tệp dữ liệu</span><input type="file" accept=".csv,.json,text/csv,application/json" data-fpc-setup-file></label><div class="fpc-actions"><button class="fpc-btn" type="button" data-fpc-import-template>Tải CSV mẫu</button><a class="fpc-btn" href="https://www.facebook.com/pages/creation/" target="_blank" rel="noopener">Mở trang tạo Page</a></div></article></div>
      <div class="fpc-table-wrap" style="margin-top:11px"><table class="fpc-table"><thead><tr><th>Tên</th><th>Username</th><th>Danh mục</th><th>Trạng thái</th><th>Cập nhật</th><th>Thao tác</th></tr></thead><tbody>${setups.map((setup) => `<tr><td><strong>${esc(setup.name)}</strong></td><td>${esc(setup.username || "—")}</td><td>${esc(setup.category || "—")}</td><td><span class="fpc-badge">${esc(setup.status)}</span></td><td>${formatDate(setup.updatedAt)}</td><td><button class="fpc-btn" type="button" data-fpc-edit-setup="${esc(setup.id)}">Sửa</button> <button class="fpc-btn fpc-btn--danger" type="button" data-fpc-delete-setup="${esc(setup.id)}">Xóa</button></td></tr>`).join("") || `<tr><td colspan="6">Chưa có Page Setup.</td></tr>`}</tbody></table></div>`;
  }

  function settingsView() {
    return `${heading("Thiết lập Meta App", "Các giá trị bí mật chỉ cấu hình trong Vercel Environment Variables, tuyệt đối không nhập vào trình duyệt.")}
      <div class="fpc-grid"><article class="fpc-card fpc-card--wide"><h3>Trạng thái kết nối</h3><div class="fpc-list"><div class="fpc-list-item"><div><strong>OAuth backend</strong><span>${statusData?.configured ? "Đã cấu hình" : "Thiếu META_APP_ID hoặc META_APP_SECRET"}</span></div></div><div class="fpc-list-item"><div><strong>Callback URL</strong><span>${esc(statusData?.callbackUrl || "https://hoang8.com/api/facebook/oauth/callback")}</span></div><button class="fpc-btn" type="button" data-fpc-copy="${esc(statusData?.callbackUrl || "https://hoang8.com/api/facebook/oauth/callback")}">Sao chép</button></div><div class="fpc-list-item"><div><strong>Graph API</strong><span>${esc(statusData?.graphVersion || "")}</span></div></div></div></article>
      <article class="fpc-card"><h3>Quyền yêu cầu</h3><div class="fpc-list">${(statusData?.permissions || []).map((permission) => `<div class="fpc-list-item"><div><strong>${esc(permission)}</strong></div></div>`).join("")}</div></article>
      <article class="fpc-card fpc-card--full"><h3>Cấu hình Vercel</h3><div class="fpc-notice">META_APP_ID · META_APP_SECRET · META_CALLBACK_URL · META_TOKEN_ENCRYPTION_KEY · META_GRAPH_VERSION. Sau đó thêm callback URL vào Meta App, khai báo domain hoang8.com và gửi App Review cho các quyền quản lý Page mở rộng.</div></article></div>`;
  }

  function workspace() {
    if (busy === "refresh" && !statusData) return `<main class="fpc-workspace"><div class="fpc-empty"><div class="fpc-loader" style="margin:auto"></div><p>Đang mở Facebook Command Center…</p></div></main>`;
    const views = { dashboard: dashboardView, pages: pagesView, composer: composerView, calendar: calendarView, comments: commentsView, insights: insightsView, setups: setupsView, settings: settingsView };
    return `<main class="fpc-workspace">${(views[state.tab] || dashboardView)()}</main>`;
  }

  function render() {
    if (!host) return;
    host.innerHTML = `<section class="fpc-shell">${topbar()}<div class="fpc-main">${sidebar()}${workspace()}${taskbar()}</div></section>`;
  }

  function parseCsv(text) {
    const rows = []; let row = []; let cell = ""; let quoted = false;
    for (let index = 0; index <= text.length; index += 1) {
      const char = text[index] || "\n";
      if (char === '"' && quoted && text[index + 1] === '"') { cell += '"'; index += 1; }
      else if (char === '"') quoted = !quoted;
      else if (char === "," && !quoted) { row.push(cell); cell = ""; }
      else if ((char === "\n" || char === "\r") && !quoted) { if (char === "\r" && text[index + 1] === "\n") index += 1; row.push(cell); if (row.some((value) => value.trim())) rows.push(row); row = []; cell = ""; }
      else cell += char;
    }
    const headers = (rows.shift() || []).map((item) => item.trim());
    return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() || ""])));
  }
  function download(name, content, type = "text/csv;charset=utf-8") { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([content], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
  function csvCell(value) { return `"${String(value ?? "").replace(/"/g, '""')}"`; }

  async function connectMeta() {
    busy = "connect"; render();
    try { const data = await api("oauth/start", "POST", { returnTo: location.origin, returnHash: "#/davinci-resolve/facebook" }); location.href = data.authorizeUrl; }
    catch (error) { busy = ""; render(); notify(error.message, "error"); }
  }

  async function onClick(event) {
    const tab = event.target.closest("[data-fpc-tab]")?.dataset.fpcTab;
    if (tab) { state.tab = tab; saveState(); render(); return; }
    if (event.target.closest("[data-fpc-connect]")) return connectMeta();
    if (event.target.closest("[data-fpc-refresh]")) return refresh();
    if (event.target.closest("[data-fpc-select-all]")) { state.selectedPageIds = (statusData?.pages || []).map((page) => page.id); saveState(); render(); return; }
    if (event.target.closest("[data-fpc-select-none]")) { state.selectedPageIds = []; saveState(); render(); return; }
    const open = event.target.closest("[data-fpc-page-open]")?.dataset.fpcPageOpen;
    if (open) { state.activePageId = open; if (!state.selectedPageIds.includes(open)) state.selectedPageIds.push(open); saveState(); await api("page/select", "POST", { pageId: open }).catch(() => {}); await loadPageDashboard(); return; }
    const disconnect = event.target.closest("[data-fpc-disconnect]")?.dataset.fpcDisconnect;
    if (disconnect && confirm("Ngắt Page này khỏi HH? Facebook Page thật sẽ không bị xóa.")) { await api("disconnect", "DELETE", { pageIds: [disconnect] }).then(() => refresh()).catch((error) => notify(error.message, "error")); return; }
    if (event.target.closest("[data-fpc-load-comments]")) { if (!state.postId) return notify("Hãy chọn bài đăng.", "error"); busy = "comments"; render(); let failure = null; try { const data = await api("comments", "GET", null, { pageId: state.activePageId, postId: state.postId }); comments = data.comments || []; } catch (error) { failure = error; } busy = ""; render(); if (failure) notify(failure.message, "error"); return; }
    const hide = event.target.closest("[data-fpc-hide-comment]");
    if (hide) { try { await api("comments/hide", "POST", { pageId: state.activePageId, commentId: hide.dataset.fpcHideComment, hidden: hide.dataset.hidden === "true" }); notify("Đã cập nhật trạng thái bình luận."); event.target.closest("[data-fpc-load-comments]")?.click?.(); } catch (error) { notify(error.message, "error"); } return; }
    if (event.target.closest("[data-fpc-load-insights]")) { busy = "insights"; render(); let failure = null; try { const data = await api("insights", "GET", null, { pageId: state.activePageId }); insights = data.insights || []; } catch (error) { failure = error; } busy = ""; render(); if (failure) notify(failure.message, "error"); return; }
    const editId = event.target.closest("[data-fpc-edit-setup]")?.dataset.fpcEditSetup;
    if (editId) { setupEdit = statusData.setups.find((item) => item.id === editId) || null; render(); return; }
    if (event.target.closest("[data-fpc-cancel-edit]")) { setupEdit = null; render(); return; }
    const deleteId = event.target.closest("[data-fpc-delete-setup]")?.dataset.fpcDeleteSetup;
    if (deleteId && confirm("Xóa Page Setup này?")) { try { await api("setups/delete", "DELETE", { id: deleteId }); await refresh(false); notify("Đã xóa Page Setup."); } catch (error) { notify(error.message, "error"); } return; }
    if (event.target.closest("[data-fpc-import-template]")) { download("facebook-page-setup-template.csv", "name,category,bio,username,website,email,phone,profileImage,coverImage,cta,status\nHH Studio,Digital creator,Trang chính thức,hhstudio,https://hoang8.com,hello@hoang8.com,,,,Learn More,ready"); return; }
    if (event.target.closest("[data-fpc-export-setups]")) { const headers = ["name", "category", "bio", "username", "website", "email", "phone", "profileImage", "coverImage", "cta", "status"]; const csv = [headers.join(","), ...(statusData?.setups || []).map((item) => headers.map((key) => csvCell(item[key])).join(","))].join("\n"); download("facebook-page-setups.csv", csv); return; }
    const copy = event.target.closest("[data-fpc-copy]")?.dataset.fpcCopy;
    if (copy) { await navigator.clipboard.writeText(copy); notify("Đã sao chép callback URL."); }
  }

  async function onSubmit(event) {
    const compose = event.target.closest("[data-fpc-compose-form]");
    if (compose) {
      event.preventDefault(); const data = new FormData(compose); const pageIds = data.getAll("pageId");
      try { busy = "publish"; render(); const result = await api("publish", "POST", { pageIds, message: data.get("message"), mediaType: data.get("mediaType"), mediaUrl: data.get("mediaUrl"), link: data.get("link"), scheduledAt: data.get("scheduledAt") ? new Date(data.get("scheduledAt")).toISOString() : "" }); await refresh(); notify(result.job?.failed ? `Hoàn tất một phần: ${result.job.completed}/${result.job.total} Page.` : "Đã gửi nội dung tới Meta.", result.job?.failed ? "error" : "success"); } catch (error) { busy = ""; render(); notify(error.message, "error"); } return;
    }
    const setup = event.target.closest("[data-fpc-setup-form]");
    if (setup) { event.preventDefault(); const payload = Object.fromEntries(new FormData(setup)); try { await api(payload.id ? "setups/update" : "setups", payload.id ? "PATCH" : "POST", payload); setupEdit = null; await refresh(false); notify("Đã lưu Page Setup."); } catch (error) { notify(error.message, "error"); } return; }
    const reply = event.target.closest("[data-fpc-reply-form]");
    if (reply) { event.preventDefault(); const message = new FormData(reply).get("message"); try { await api("comments/reply", "POST", { pageId: state.activePageId, commentId: reply.dataset.fpcReplyForm, message }); reply.reset(); notify("Đã trả lời bình luận qua Meta."); } catch (error) { notify(error.message, "error"); } }
  }

  async function onChange(event) {
    if (event.target.matches("[data-fpc-page-check]")) { const id = event.target.value; state.selectedPageIds = event.target.checked ? [...new Set([...state.selectedPageIds, id])] : state.selectedPageIds.filter((item) => item !== id); saveState(); return; }
    if (event.target.matches("[data-fpc-comment-post]")) { state.postId = event.target.value; saveState(); return; }
    if (event.target.matches("[data-fpc-setup-file]")) {
      const file = event.target.files?.[0]; if (!file) return;
      try { const text = await file.text(); const items = file.name.toLowerCase().endsWith(".json") ? JSON.parse(text) : parseCsv(text); const result = await api("setups/import", "POST", { items: Array.isArray(items) ? items : items.items }); await refresh(false); notify(`Đã nhập ${result.imported || 0}, từ chối ${result.rejected || 0}.`, result.rejected ? "error" : "success"); }
      catch (error) { notify(error.message, "error"); }
      event.target.value = "";
    }
  }

  function onInput(event) { if (event.target.matches("[data-fpc-page-search]")) { state.search = event.target.value; saveState(); const list = host.querySelector(".fpc-page-list"); if (list) { const search = state.search.toLocaleLowerCase("vi"); list.querySelectorAll(".fpc-page-item").forEach((item) => { item.hidden = Boolean(search) && !item.textContent.toLocaleLowerCase("vi").includes(search); }); } } }

  function mount(target) {
    if (!target) return;
    if (host && host !== target) unmount();
    host = target;
    host.addEventListener("click", onClick);
    host.addEventListener("submit", onSubmit);
    host.addEventListener("change", onChange);
    host.addEventListener("input", onInput);
    handleOauthResult();
    render();
    refresh();
  }
  function unmount() { if (!host) return; host.removeEventListener("click", onClick); host.removeEventListener("submit", onSubmit); host.removeEventListener("change", onChange); host.removeEventListener("input", onInput); host.innerHTML = ""; host = null; }

  global.HHFacebookPageCommandCenter = Object.freeze({ mount, unmount });
  global.dispatchEvent(new CustomEvent("hh:facebook-page-command-center-ready"));
})(window);
