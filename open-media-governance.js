(function initHHOpenMediaGovernance(global) {
  "use strict";

  const VERSION = "1.0.0";
  const DEFAULT_API_ROOT = "/api/open-media";
  const FALLBACK_REGISTRY_URL = "/assets/open-media/rights-registry-v2.json";
  const PUBLIC_EMAIL = "nhhoang130803@gmail.com";
  const VIEWS = new Set(["overview", "rights", "notice", "cases"]);
  let runtime = null;

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);

  function normalizeApiRoot(value) {
    const input = String(value || DEFAULT_API_ROOT).trim();
    if (!/^\/(?:[a-z0-9._~-]+\/)*[a-z0-9._~-]+$/i.test(input)) return DEFAULT_API_ROOT;
    return input.replace(/\/$/, "");
  }

  function safeHttps(value) {
    try {
      const parsed = new global.URL(String(value || ""));
      return parsed.protocol === "https:" && !parsed.username && !parsed.password ? parsed.href : "";
    } catch { return ""; }
  }

  function resolveHost(options) {
    if (options?.host?.nodeType === 1) return options.host;
    const selector = String(options?.selector || "[data-open-media-governance-host]");
    return global.document?.querySelector(selector) || null;
  }

  function emptyState(options = {}) {
    return {
      view: VIEWS.has(options.view) ? options.view : "overview",
      loading: true,
      error: "",
      registry: null,
      query: "",
      filter: "all",
      selectedItemId: String(options.itemId || ""),
      noticeStatus: "",
      submitting: false,
      isAdmin: Boolean(options.isAdmin),
      cases: [],
      casesLoading: false,
      casesError: ""
    };
  }

  function isAdminAccount(user) {
    return Boolean(
      user?.access?.admin
      || user?.access?.owner
      || (Array.isArray(user?.roles) && user.roles.some((role) => ["owner", "super_admin", "admin", "moderator"].includes(String(role).toLowerCase())))
    );
  }

  function statusLabel(status) {
    return ({
      published: "Đã phát hành",
      approved: "Đã duyệt",
      catalogued: "Đã kiểm tra cơ bản",
      review: "Đang kiểm duyệt",
      quarantine: "Đang cách ly",
      suspended: "Tạm ẩn",
      taken_down: "Đã gỡ",
      received: "Mới tiếp nhận",
      triage: "Đang xem xét",
      rejected: "Đã từ chối",
      resolved: "Đã giải quyết"
    })[status] || "Chưa xác định";
  }

  function statusTone(status) {
    if (["published", "approved", "catalogued", "resolved"].includes(status)) return "safe";
    if (["quarantine", "suspended", "taken_down"].includes(status)) return "danger";
    return "warning";
  }

  function tabButton(id, label, icon, state) {
    const active = state.view === id;
    return `<button type="button" class="omg-tab${active ? " is-active" : ""}" data-omg-view="${id}" aria-selected="${active}"><span aria-hidden="true">${icon}</span>${escapeHtml(label)}</button>`;
  }

  function renderLoading() {
    return `<div class="omg-loading" role="status"><span class="omg-spinner" aria-hidden="true"></span><strong>Đang kiểm tra hồ sơ quyền…</strong><small>Không nội dung nào được tự động coi là “không bản quyền”.</small></div>`;
  }

  function renderOverview(state) {
    const data = state.registry || {};
    const counts = data.counts || data.catalogSnapshot || {};
    const policy = data.policy || {};
    const quarantines = data.quarantineItems || [];
    const sources = data.sourceRules || [];
    return `<section class="omg-view omg-overview" aria-label="Tổng quan tuân thủ">
      <div class="omg-metrics">
        <article><span>Nội dung theo dõi</span><strong>${Number(counts.total || 0)}</strong><small>${Number(counts.films || 0)} phim · ${Number(counts.tracks || 0)} nhạc</small></article>
        <article><span>Có thể hiển thị</span><strong>${Number(counts.available || Math.max(0, Number(counts.total || 0) - quarantines.length))}</strong><small>Vẫn có thể phát sinh yêu cầu rà soát</small></article>
        <article class="is-alert"><span>Đang cách ly</span><strong>${Number(counts.quarantine || quarantines.length)}</strong><small>Player bị chặn cho đến khi đủ bằng chứng</small></article>
        <article><span>Kiểm tra định kỳ</span><strong>${Number(policy.revalidationDays?.automaticLicense || 30)} ngày</strong><small>14 ngày với hồ sơ thủ công/lãnh thổ</small></article>
      </div>
      <div class="omg-grid">
        <article class="omg-card">
          <div class="omg-card-head"><div><span class="omg-eyebrow">Cổng giấy phép</span><h3>Chỉ cho phép mã chính xác</h3></div><span class="omg-shield">✓</span></div>
          <div class="omg-chip-row">${(policy.automaticAllowlist || []).map((code) => `<span class="omg-chip is-safe">${escapeHtml(code)}</span>`).join("") || "<span>Chưa tải chính sách.</span>"}</div>
          <p>PDM, NASA, tác phẩm chính phủ, giấy phép riêng và quyền theo lãnh thổ luôn phải qua người kiểm duyệt.</p>
          <div class="omg-chip-row">${(policy.blockedMarkers || []).map((code) => `<span class="omg-chip is-blocked">${escapeHtml(code)}</span>`).join("")}</div>
        </article>
        <article class="omg-card">
          <div class="omg-card-head"><div><span class="omg-eyebrow">Luồng phát hành</span><h3>Deny until cleared</h3></div><span class="omg-lock">⛨</span></div>
          <ol class="omg-flow">${(policy.workflow || []).slice(0, 8).map((step, index) => `<li><b>${index + 1}</b><span>${escapeHtml(String(step).replace(/-/g, " "))}</span></li>`).join("")}</ol>
        </article>
      </div>
      <div class="omg-grid">
        <article class="omg-card">
          <div class="omg-card-head"><div><span class="omg-eyebrow">Hàng chờ khẩn cấp</span><h3>Nội dung đang bị chặn</h3></div><button type="button" data-omg-view="rights">Xem hồ sơ</button></div>
          <div class="omg-quarantine-list">${quarantines.map((item) => `<button type="button" data-omg-item="${escapeHtml(item.id)}"><span>${escapeHtml(item.title)}</span><small>${escapeHtml(item.reason)}</small><b>Đang cách ly</b></button>`).join("") || "<p>Không có hồ sơ cách ly.</p>"}</div>
        </article>
        <article class="omg-card">
          <div class="omg-card-head"><div><span class="omg-eyebrow">Nguồn nội dung</span><h3>Quy tắc nhập liệu</h3></div></div>
          <div class="omg-source-list">${sources.slice(0, 6).map((source) => `<div><span class="omg-risk is-${escapeHtml(source.risk)}"></span><p><strong>${escapeHtml(source.provider)}</strong><small>${escapeHtml(source.note)}</small></p></div>`).join("")}</div>
        </article>
      </div>
    </section>`;
  }

  function normalizedItems(state) {
    const data = state.registry || {};
    const items = Array.isArray(data.items) ? [...data.items] : [];
    const known = new Set(items.map((item) => item.id));
    for (const item of data.quarantineItems || []) {
      if (!known.has(item.id)) items.push({ ...item, reviewStatus: "quarantine", available: false, quarantine: item });
    }
    const query = state.query.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return items.filter((item) => {
      if (state.filter !== "all" && item.reviewStatus !== state.filter) return false;
      if (!query) return true;
      return `${item.title || ""} ${item.creator || ""} ${item.id || ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(query);
    });
  }

  function renderRights(state) {
    const items = normalizedItems(state);
    return `<section class="omg-view omg-rights" aria-label="Hồ sơ quyền">
      <div class="omg-toolbar">
        <label><span class="sr-only">Tìm hồ sơ</span><input type="search" data-omg-search value="${escapeHtml(state.query)}" placeholder="Tìm phim, nhạc, tác giả hoặc ID…"></label>
        <div class="omg-filter" role="group" aria-label="Lọc trạng thái">
          ${[["all", "Tất cả"], ["catalogued", "Đã kiểm tra"], ["review", "Đang duyệt"], ["quarantine", "Cách ly"]].map(([id, label]) => `<button type="button" data-omg-filter="${id}" class="${state.filter === id ? "is-active" : ""}">${label}</button>`).join("")}
        </div>
        <span>${items.length} hồ sơ</span>
      </div>
      <div class="omg-rights-table" role="table">
        <div class="omg-rights-row is-head" role="row"><span>Nội dung</span><span>Nguồn / giấy phép</span><span>Trạng thái</span><span>Thao tác</span></div>
        ${items.map((item) => {
          const status = item.reviewStatus || "review";
          const reason = item.quarantine?.reason || item.reason || "";
          const sourceUrl = safeHttps(item.source?.landingUrl || item.sourceUrl);
          return `<article class="omg-rights-row" role="row" data-status="${escapeHtml(status)}">
            <div><span class="omg-kind">${item.kind === "track" ? "NHẠC" : "PHIM"}</span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.creator || item.id)}</small></div>
            <div><strong>${escapeHtml(item.source?.provider || item.rightsBasis || "Nguồn đang rà soát")}</strong><small>${escapeHtml(item.license?.code || item.licenseCode || "Cần kiểm duyệt thủ công")}</small>${sourceUrl ? `<a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">Mở nguồn ↗</a>` : ""}</div>
            <div><span class="omg-status is-${statusTone(status)}">${statusLabel(status)}</span>${reason ? `<small>${escapeHtml(reason)}</small>` : ""}</div>
            <div><button type="button" data-omg-report="${escapeHtml(item.id)}">Báo vấn đề</button></div>
          </article>`;
        }).join("") || `<div class="omg-empty"><strong>Không có hồ sơ phù hợp</strong><span>Hãy đổi từ khóa hoặc bộ lọc.</span></div>`}
      </div>
    </section>`;
  }

  function noticeForm(state) {
    const selected = state.selectedItemId;
    const contact = state.registry?.publicContact || state.registry?.complaints?.publicEmail || PUBLIC_EMAIL;
    return `<section class="omg-view omg-notice" aria-label="Gửi thông báo quyền">
      <div class="omg-notice-intro"><span class="omg-shield">!</span><div><span class="omg-eyebrow">Copyright & rights notice</span><h3>Báo nội dung có vấn đề về quyền</h3><p>Hồ sơ hợp lệ được lưu vào hệ thống trước khi gửi email. Nếu máy chủ email tạm lỗi, dữ liệu vẫn còn trong MongoDB và có mã vụ việc.</p></div></div>
      <form data-omg-notice-form novalidate>
        <input class="omg-honeypot" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
        <div class="omg-form-grid">
          <label><span>Loại thông báo *</span><select name="noticeType" required><option value="copyright">Bản quyền</option><option value="privacy-publicity">Quyền riêng tư / hình ảnh</option><option value="trademark">Nhãn hiệu</option><option value="license-metadata">Sai thông tin giấy phép</option><option value="other">Khác</option></select></label>
          <label><span>ID nội dung trên HH</span><input name="reportedItemId" value="${escapeHtml(selected)}" maxlength="160" placeholder="Ví dụ: big-buck-bunny"></label>
          <label><span>Họ tên người gửi *</span><input name="claimantName" required minlength="2" maxlength="160" autocomplete="name"></label>
          <label><span>Email liên hệ *</span><input name="email" type="email" required maxlength="254" autocomplete="email"></label>
          <label><span>Tổ chức</span><input name="organization" maxlength="200" autocomplete="organization"></label>
          <label><span>Quốc gia / lãnh thổ</span><input name="country" maxlength="80" autocomplete="country-name"></label>
        </div>
        <label><span>URL nội dung trên hoang8.com</span><input name="reportedUrl" type="url" maxlength="1600" value="${escapeHtml(global.location?.href || "")}"></label>
        <label><span>Tác phẩm hoặc quyền hợp pháp của bạn *</span><textarea name="originalWork" required minlength="10" maxlength="3000" rows="3" placeholder="Mô tả tác phẩm gốc, chủ sở hữu và URL bằng chứng…"></textarea></label>
        <label><span>Căn cứ quyền / quan hệ với chủ sở hữu *</span><textarea name="rightsBasis" required minlength="10" maxlength="3000" rows="3" placeholder="Bạn là chủ sở hữu, đại diện được ủy quyền hoặc người bị ảnh hưởng như thế nào?"></textarea></label>
        <label><span>Mô tả chi tiết nội dung bị ảnh hưởng *</span><textarea name="description" required minlength="30" maxlength="6000" rows="4"></textarea></label>
        <label><span>Biện pháp đề nghị</span><input name="requestedAction" maxlength="1000" placeholder="Tạm ẩn, sửa ghi công, gỡ file…"></label>
        <label><span>Chữ ký điện tử (gõ đầy đủ họ tên) *</span><input name="electronicSignature" required minlength="2" maxlength="160"></label>
        <div class="omg-checks">
          <label><input type="checkbox" name="goodFaith" required><span>Tôi tin một cách thiện chí rằng việc sử dụng được báo cáo chưa được chủ sở hữu, đại diện hoặc pháp luật cho phép.</span></label>
          <label><input type="checkbox" name="accuracyConfirmed" required><span>Tôi xác nhận thông tin trong thông báo là chính xác.</span></label>
          <label><input type="checkbox" name="authorityConfirmed" required><span>Tôi có quyền gửi thông báo này hoặc được chủ sở hữu ủy quyền.</span></label>
        </div>
        <p class="omg-privacy">Thông tin liên hệ chỉ được dùng để xử lý hồ sơ quyền, chống lạm dụng và liên lạc về vụ việc. Hồ sơ được bảo vệ theo quyền truy cập quản trị và không hiển thị công khai.</p>
        <div class="omg-submit-row"><button class="omg-primary" type="submit" ${state.submitting ? "disabled" : ""}>${state.submitting ? "Đang lưu hồ sơ…" : "Gửi thông báo an toàn"}</button><a href="mailto:${escapeHtml(contact)}">Hoặc gửi email: ${escapeHtml(contact)}</a></div>
        <div class="omg-form-status${state.noticeStatus ? " is-visible" : ""}" data-omg-form-status role="status" aria-live="polite">${escapeHtml(state.noticeStatus)}</div>
      </form>
    </section>`;
  }

  function caseActions(row) {
    const transitions = {
      received: [["triage", "Bắt đầu xem"], ["suspended", "Tạm ẩn nội dung"], ["rejected", "Từ chối"]],
      triage: [["suspended", "Tạm ẩn nội dung"], ["resolved", "Đã giải quyết"], ["rejected", "Từ chối"]],
      suspended: [["triage", "Xem lại"], ["resolved", "Đã giải quyết"], ["rejected", "Từ chối"]],
      rejected: [["triage", "Mở lại"]],
      resolved: [["triage", "Mở lại"]]
    };
    return (transitions[row.status] || []).map(([status, label]) => `<button type="button" data-omg-case-status="${status}" data-omg-case-id="${escapeHtml(row._id)}"${status === "suspended" && !row.reportedItemId ? " disabled title=\"Cần có ID nội dung để tạm ẩn ngay\"" : ""}>${label}</button>`).join("");
  }

  function renderCases(state) {
    if (!state.isAdmin) return `<section class="omg-view"><div class="omg-fatal"><strong>Không có quyền truy cập</strong><p>Hồ sơ khiếu nại chỉ dành cho quản trị viên đã xác thực.</p></div></section>`;
    return `<section class="omg-view omg-cases" aria-label="Hồ sơ khiếu nại">
      <div class="omg-toolbar"><div><strong>Hộp thư khiếu nại</strong><small>Thay đổi sang “Tạm ẩn” sẽ khóa phát nội dung qua backend ngay lập tức.</small></div><button type="button" data-omg-cases-reload>Làm mới</button></div>
      ${state.casesLoading ? `<div class="omg-loading" role="status"><span class="omg-spinner" aria-hidden="true"></span><strong>Đang tải hồ sơ…</strong></div>` : state.casesError ? `<div class="omg-fatal"><strong>Không tải được hồ sơ</strong><p>${escapeHtml(state.casesError)}</p><button type="button" data-omg-cases-reload>Thử lại</button></div>` : `<div class="omg-case-list">${state.cases.map((row) => `<article class="omg-case-card">
        <header><div><span class="omg-status is-${statusTone(row.status)}">${statusLabel(row.status)}</span><strong>${escapeHtml(row.caseId || row._id)}</strong></div><time>${escapeHtml(String(row.createdAt || "").slice(0, 10))}</time></header>
        <div class="omg-case-grid"><p><small>Người gửi</small><strong>${escapeHtml(row.claimantName)}</strong><a href="mailto:${escapeHtml(row.email)}">${escapeHtml(row.email)}</a></p><p><small>Nội dung báo cáo</small><strong>${escapeHtml(row.reportedItemId || "Chưa có ID")}</strong><span>${escapeHtml(row.reportedUrl || "")}</span></p></div>
        <details><summary>Xem mô tả và căn cứ</summary><p><b>Tác phẩm:</b> ${escapeHtml(row.originalWork)}</p><p><b>Căn cứ:</b> ${escapeHtml(row.rightsBasis)}</p><p><b>Mô tả:</b> ${escapeHtml(row.description)}</p></details>
        <footer>${caseActions(row)}</footer>
      </article>`).join("") || `<div class="omg-empty"><strong>Chưa có khiếu nại</strong><span>Các hồ sơ hợp lệ sẽ xuất hiện tại đây.</span></div>`}</div>`}
    </section>`;
  }

  function render(runtimeRef) {
    const { state, root } = runtimeRef;
    root.innerHTML = `<section class="open-media-governance" data-omg-root>
      <header class="omg-header"><div class="omg-brand"><span class="omg-brand-icon">H</span><div><span class="omg-eyebrow">HH OPEN MEDIA · RIGHTS CENTER</span><h2>Quyền, giấy phép & khiếu nại</h2></div></div><div class="omg-trust"><span></span><div><strong>Deny until cleared</strong><small>Không tự động coi nội dung là “không bản quyền”</small></div></div></header>
      <nav class="omg-tabs" role="tablist">${tabButton("overview", "Tổng quan", "◉", state)}${tabButton("rights", "Hồ sơ quyền", "▤", state)}${tabButton("notice", "Báo vi phạm", "⚑", state)}${state.isAdmin ? tabButton("cases", "Quản lý khiếu nại", "⌁", state) : ""}</nav>
      <main class="omg-main">${state.loading ? renderLoading() : state.error && !state.registry ? `<div class="omg-fatal"><strong>Không tải được Trung tâm quyền</strong><p>${escapeHtml(state.error)}</p><button type="button" data-omg-retry>Thử lại</button><a href="mailto:${PUBLIC_EMAIL}">Liên hệ ${PUBLIC_EMAIL}</a></div>` : state.view === "rights" ? renderRights(state) : state.view === "notice" ? noticeForm(state) : state.view === "cases" ? renderCases(state) : renderOverview(state)}</main>
      <footer class="omg-footer"><span>${escapeHtml(state.registry?.legalNotice || "Công cụ giảm rủi ro; không thay thế tư vấn pháp lý.")}</span><a href="mailto:${escapeHtml(state.registry?.publicContact || PUBLIC_EMAIL)}">${escapeHtml(state.registry?.publicContact || PUBLIC_EMAIL)}</a></footer>
    </section>`;
  }

  async function fetchJson(url, options = {}) {
    const response = await runtime.fetch(url, options);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
    return payload;
  }

  async function loadRegistry() {
    const current = runtime;
    current.state.loading = true;
    current.state.error = "";
    render(current);
    try {
      current.state.registry = await fetchJson(`${current.apiRoot}/rights`, { signal: current.controller.signal, credentials: "same-origin", cache: "no-store" });
    } catch (apiError) {
      try {
        const fallback = await fetchJson(current.registryUrl, { signal: current.controller.signal, credentials: "same-origin", cache: "no-cache" });
        current.state.registry = fallback;
        current.state.error = `Backend quyền tạm gián đoạn (${apiError.message}). Đang hiển thị bản registry chỉ đọc.`;
      } catch (fallbackError) {
        current.state.error = `Không thể tải backend (${apiError.message}) hoặc registry dự phòng (${fallbackError.message}).`;
      }
    }
    if (runtime !== current || current.controller.signal.aborted) return;
    current.state.loading = false;
    render(current);
  }

  function formPayload(form) {
    const data = new global.FormData(form);
    return {
      website: data.get("website"),
      noticeType: data.get("noticeType"),
      reportedItemId: data.get("reportedItemId"),
      reportedUrl: data.get("reportedUrl"),
      claimantName: data.get("claimantName"),
      email: data.get("email"),
      organization: data.get("organization"),
      country: data.get("country"),
      originalWork: data.get("originalWork"),
      rightsBasis: data.get("rightsBasis"),
      description: data.get("description"),
      requestedAction: data.get("requestedAction"),
      electronicSignature: data.get("electronicSignature"),
      goodFaith: data.get("goodFaith") === "on",
      accuracyConfirmed: data.get("accuracyConfirmed") === "on",
      authorityConfirmed: data.get("authorityConfirmed") === "on"
    };
  }

  async function submitNotice(form) {
    if (!form.reportValidity()) return;
    const current = runtime;
    current.state.submitting = true;
    current.state.noticeStatus = "Đang lưu hồ sơ vào hệ thống…";
    render(current);
    try {
      const payload = await fetchJson(`${current.apiRoot}/notices`, {
        method: "POST",
        credentials: "same-origin",
        signal: current.controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formPayload(form))
      });
      const delivery = payload.notificationStatus === "sent"
        ? `Email đã được gửi tự động tới bộ phận bản quyền và thư xác nhận đã gửi tới email của bạn.`
        : payload.notificationStatus === "admin-sent"
          ? `Email đã được gửi tự động tới bộ phận bản quyền; thư xác nhận cho người gửi đang được hệ thống thử lại.`
          : `Hồ sơ đã được lưu an toàn. Hệ thống email đang tự động thử gửi lại; bạn không cần bấm gửi Gmail thủ công.`;
      current.state.noticeStatus = `Đã tiếp nhận. Mã hồ sơ: ${payload.caseId || "đang tạo"}. ${delivery} ${payload.message || ""}`;
      current.state.selectedItemId = "";
    } catch (error) {
      current.state.noticeStatus = `Chưa thể gửi qua backend: ${error.message}. Hồ sơ chưa được xác nhận; vui lòng gửi email tới ${current.state.registry?.publicContact || PUBLIC_EMAIL}.`;
    } finally {
      if (runtime === current) {
        current.state.submitting = false;
        render(current);
      }
    }
  }

  async function loadCases() {
    const current = runtime;
    if (!current?.state.isAdmin) return;
    current.state.casesLoading = true;
    current.state.casesError = "";
    render(current);
    try {
      const payload = await fetchJson(`${current.apiRoot}/notices`, {
        credentials: "same-origin",
        signal: current.controller.signal,
        cache: "no-store"
      });
      if (runtime !== current) return;
      current.state.cases = Array.isArray(payload.notices) ? payload.notices : [];
    } catch (error) {
      if (runtime !== current || error?.name === "AbortError") return;
      current.state.casesError = error.message || "Backend không phản hồi.";
    } finally {
      if (runtime === current) {
        current.state.casesLoading = false;
        render(current);
      }
    }
  }

  async function updateCaseStatus(caseObjectId, status) {
    const current = runtime;
    if (!current?.state.isAdmin || !caseObjectId) return;
    try {
      await fetchJson(`${current.apiRoot}/notices?id=${encodeURIComponent(caseObjectId)}`, {
        method: "PATCH",
        credentials: "same-origin",
        signal: current.controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note: "Cập nhật từ HH Open Media Rights Center." })
      });
      await loadCases();
    } catch (error) {
      if (runtime !== current || error?.name === "AbortError") return;
      current.state.casesError = error.message || "Không thể cập nhật hồ sơ.";
      render(current);
    }
  }

  function onClick(event) {
    const viewButton = event.target.closest("[data-omg-view]");
    if (viewButton) {
      const view = viewButton.dataset.omgView;
      if (VIEWS.has(view) && (view !== "cases" || runtime.state.isAdmin)) {
        runtime.state.view = view;
        render(runtime);
        if (view === "cases") loadCases();
      }
      return;
    }
    if (event.target.closest("[data-omg-cases-reload]")) { loadCases(); return; }
    const caseAction = event.target.closest("[data-omg-case-status]");
    if (caseAction && !caseAction.disabled) {
      updateCaseStatus(caseAction.dataset.omgCaseId, caseAction.dataset.omgCaseStatus);
      return;
    }
    const filter = event.target.closest("[data-omg-filter]");
    if (filter) { runtime.state.filter = filter.dataset.omgFilter || "all"; render(runtime); return; }
    const report = event.target.closest("[data-omg-report]");
    if (report) { openComplaint(report.dataset.omgReport); return; }
    const item = event.target.closest("[data-omg-item]");
    if (item) { runtime.state.query = item.dataset.omgItem || ""; runtime.state.filter = "quarantine"; runtime.state.view = "rights"; render(runtime); return; }
    if (event.target.closest("[data-omg-retry]")) loadRegistry();
  }

  function onInput(event) {
    if (!event.target.matches("[data-omg-search]")) return;
    runtime.state.query = event.target.value;
    const selection = [event.target.selectionStart, event.target.selectionEnd];
    render(runtime);
    const next = runtime.root.querySelector("[data-omg-search]");
    next?.focus();
    try { next?.setSelectionRange(...selection); } catch {}
  }

  function onSubmit(event) {
    const form = event.target.closest("[data-omg-notice-form]");
    if (!form) return;
    event.preventDefault();
    submitNotice(form);
  }

  function mount(target, options = {}) {
    unmount();
    if (!target?.nodeType) {
      options = target && typeof target === "object" ? target : options;
    } else {
      options = { ...options, host: target };
    }
    const host = resolveHost(options);
    if (!host) return null;
    const root = global.document.createElement("div");
    root.className = "open-media-governance-host";
    host.replaceChildren(root);
    const isAdmin = isAdminAccount(options.currentUser);
    const state = emptyState({ ...options, isAdmin });
    if (state.view === "cases" && !isAdmin) state.view = "overview";
    runtime = {
      host,
      root,
      apiRoot: normalizeApiRoot(options.apiRoot),
      registryUrl: safeHttps(options.registryUrl) || (String(options.registryUrl || "").startsWith("/") ? options.registryUrl : FALLBACK_REGISTRY_URL),
      fetch: options.fetch || global.fetch.bind(global),
      controller: new AbortController(),
      state,
      listeners: []
    };
    for (const [type, handler] of [["click", onClick], ["input", onInput], ["submit", onSubmit]]) {
      root.addEventListener(type, handler);
      runtime.listeners.push([type, handler]);
    }
    render(runtime);
    loadRegistry();
    return root;
  }

  function unmount() {
    if (!runtime) return;
    runtime.controller.abort();
    for (const [type, handler] of runtime.listeners) runtime.root.removeEventListener(type, handler);
    runtime.root.remove();
    runtime = null;
  }

  function openComplaint(itemId = "") {
    if (!runtime) return false;
    runtime.state.selectedItemId = String(itemId || "");
    runtime.state.view = "notice";
    runtime.state.noticeStatus = "";
    render(runtime);
    runtime.root.querySelector('[name="claimantName"]')?.focus();
    return true;
  }

  function inspect() {
    return {
      version: VERSION,
      mounted: Boolean(runtime),
      view: runtime?.state.view || "",
      loading: Boolean(runtime?.state.loading),
      total: Number(runtime?.state.registry?.counts?.total || runtime?.state.registry?.catalogSnapshot?.total || 0),
      quarantine: Number(runtime?.state.registry?.counts?.quarantine || runtime?.state.registry?.quarantineItems?.length || 0),
      isAdmin: Boolean(runtime?.state.isAdmin),
      caseCount: Number(runtime?.state.cases?.length || 0),
      apiRoot: runtime?.apiRoot || DEFAULT_API_ROOT
    };
  }

  const api = Object.freeze({ VERSION, mount, unmount, openComplaint, inspect });
  global.HHOpenMediaGovernance = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
