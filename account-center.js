(function accountCenterRuntime(global) {
  "use strict";

  const TABS = Object.freeze([
    ["overview", "Tổng quan", "⌂"],
    ["profile", "Hồ sơ công khai", "◎"],
    ["privacy", "Quyền riêng tư", "◉"],
    ["security", "Đăng nhập & bảo mật", "◆"],
    ["sessions", "Phiên & thiết bị", "▣"],
    ["passkeys", "Passkey & khôi phục", "⌘"],
    ["notifications", "Thông báo", "◌"],
    ["data", "Dữ liệu & tài khoản", "⇩"]
  ]);
  const roots = new Set();

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[character]);
  const apiBase = () => String(global.HH_API_BASE || global.HH_REALTIME_URL || global.location.origin).replace(/\/$/, "");
  const token = () => global.HHAuthSession?.token?.() || "";
  const formatDate = (value, fallback = "Chưa có") => {
    if (!value) return fallback;
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toLocaleString("vi-VN") : fallback;
  };
  const splitList = (value, limit = 20) => String(value || "").split(/[,\n]/).map((item) => item.trim()).filter(Boolean).slice(0, limit);

  class AccountApiError extends Error {
    constructor(message, code = "", status = 0) {
      super(message);
      this.code = code;
      this.status = status;
    }
  }

  async function request(path, options = {}) {
    const response = await fetch(`${apiBase()}${path}`, {
      ...options,
      credentials: "include",
      cache: "no-store",
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
        ...(options.headers || {})
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new AccountApiError(data.error || "Không thể kết nối Trung tâm tài khoản.", data.code || "", response.status);
    return data;
  }

  const accountAction = (action, payload = {}) => request("/api/account-center", { method: "POST", body: JSON.stringify({ action, ...payload }) });
  const socialAction = (action, payload = {}) => request("/api/social", { method: "POST", body: JSON.stringify({ action, ...payload }) });

  function initials(name) {
    return String(name || "HH").split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join("").toUpperCase() || "HH";
  }

  function statusLabel(status) {
    return ({ safe: "An toàn", attention: "Cần chú ý", unknown: "Chưa kiểm tra", unavailable: "Không khả dụng", not_applicable: "Không áp dụng" })[status] || "Chưa kiểm tra";
  }

  function skeletonMarkup() {
    return `<section class="ac-shell ac-is-loading" aria-busy="true">
      <div class="ac-skeleton ac-skeleton--hero"></div>
      <div class="ac-layout"><div class="ac-skeleton ac-skeleton--nav"></div><div class="ac-skeleton ac-skeleton--content"></div></div>
    </section>`;
  }

  function scoreMarkup(score) {
    if (!score || score.state !== "available" || !Number.isFinite(score.value)) {
      return `<section class="ac-score-card is-unavailable"><div class="ac-score-ring"><strong>—</strong></div><div><span>Điểm bảo mật</span><h3>Không thể kiểm tra</h3><p>Máy chủ chưa cung cấp đủ bằng chứng. Không có điểm 0 giả.</p></div></section>`;
    }
    const tone = score.value >= 80 ? "safe" : score.value >= 55 ? "attention" : "risk";
    return `<section class="ac-score-card is-${tone}">
      <div class="ac-score-ring" style="--ac-score:${score.value * 3.6}deg"><strong>${score.value}</strong><small>/100</small></div>
      <div><span>Điểm bảo mật có bằng chứng</span><h3>${score.value >= 80 ? "Đang được bảo vệ tốt" : score.value >= 55 ? "Còn bước cần hoàn thiện" : "Nên xử lý ngay"}</h3><p>Cập nhật ${formatDate(score.checkedAt)} · Bấm từng tiêu chí để xem lý do.</p></div>
    </section>`;
  }

  function checksMarkup(score) {
    return `<div class="ac-check-list">${(score?.checks || []).map((check) => `<details class="ac-check is-${escapeHtml(check.status)}">
      <summary><span class="ac-status-dot"></span><div><strong>${escapeHtml(check.label)}</strong><small>${statusLabel(check.status)}</small></div><b>${check.status === "safe" ? `+${check.earned}` : `0/${check.weight}`}</b></summary>
      <p>${escapeHtml(check.reason)}</p>${check.action ? `<button type="button" data-ac-jump="${escapeHtml(check.action)}">Mở bước xử lý</button>` : ""}
    </details>`).join("")}</div>`;
  }

  function overviewPanel(state) {
    const { summary } = state;
    const next = (summary.securityScore?.checks || []).filter((item) => ["attention", "unknown"].includes(item.status)).slice(0, 3);
    return `<section class="ac-panel is-active" data-ac-panel="overview">
      <div class="ac-overview-grid">
        ${scoreMarkup(summary.securityScore)}
        <section class="ac-card ac-next-actions"><header><span>Ưu tiên tiếp theo</span><h3>Ba bước nên làm</h3></header>
          ${next.length ? next.map((item, index) => `<button type="button" data-ac-jump="${escapeHtml(item.action || "security")}"><b>0${index + 1}</b><span><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.reason)}</small></span><i>›</i></button>`).join("") : `<div class="ac-success-state"><b>✓</b><strong>Không có cảnh báo ưu tiên</strong><span>Hãy kiểm tra hoạt động định kỳ.</span></div>`}
        </section>
      </div>
      <section class="ac-card"><header class="ac-card-head"><div><span>Security score</span><h3>Vì sao được hoặc mất điểm?</h3><p>Mỗi điểm đều gắn với trạng thái do máy chủ kiểm tra.</p></div><button type="button" data-ac-refresh>Kiểm tra lại</button></header>${checksMarkup(summary.securityScore)}</section>
      <div class="ac-metric-grid">
        <article><span>Hoàn thiện hồ sơ</span><strong>${summary.profileCompletion}%</strong><i style="--progress:${summary.profileCompletion}%"></i><small>Đồng bộ bằng `/api/social`</small></article>
        <article><span>Phiên hoạt động</span><strong>${summary.sessions.length}</strong><small>${summary.sessions.filter((item) => item.suspicious).length ? "Có phiên cần chú ý" : "Không phát hiện phiên lạ"}</small></article>
        <article><span>Passkey</span><strong>${summary.passkeys.length}</strong><small>${summary.passkeys.length >= 2 ? "Đã có trên nhiều thiết bị" : "Nên tạo trên thiết bị thứ hai"}</small></article>
        <article><span>Mã khôi phục</span><strong>${summary.recovery.remaining}</strong><small>Mỗi mã chỉ dùng một lần</small></article>
      </div>
      <section class="ac-card ac-local-note"><b>Riêng tư theo thiết kế</b><p>Hồ sơ, quyền riêng tư, phiên và Passkey nằm trên máy chủ. Chỉ bản nháp biểu mẫu chưa gửi được giữ tạm trong bộ nhớ của trang và biến mất khi đóng màn hình.</p></section>
    </section>`;
  }

  function imageValue(value, name, kind) {
    return value ? `<img src="${escapeHtml(value)}" alt="${escapeHtml(kind === "avatar" ? `Avatar ${name}` : "Ảnh bìa")}">` : `<span>${escapeHtml(initials(name))}</span>`;
  }

  function profilePanel(state) {
    const profile = state.profile;
    const user = state.summary.user;
    const socialLinks = (profile.socialLinks || []).map((item) => `${item.platform}: ${item.url}`).join("\n");
    return `<section class="ac-panel" data-ac-panel="profile">
      <div class="ac-profile-visual">
        <div class="ac-cover" data-ac-cover>${imageValue(profile.cover, user.name, "cover")}<label>Đổi ảnh bìa<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" data-ac-image="cover"></label></div>
        <div class="ac-avatar" data-ac-avatar>${imageValue(user.avatar || profile.avatar, user.name, "avatar")}<label aria-label="Đổi avatar">＋<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" data-ac-image="avatar"></label></div>
        <div><span>Hồ sơ công khai</span><h2>${escapeHtml(user.name)}</h2><p>hoang8.com/u/${escapeHtml(profile.username || "member")}</p></div>
        <button type="button" data-ac-preview>Người khác nhìn thấy gì?</button>
      </div>
      <form class="ac-card ac-form" data-ac-profile-form>
        <header class="ac-card-head"><div><span>Dữ liệu máy chủ</span><h3>Thông tin cá nhân</h3><p>Không tạo hồ sơ local thứ hai; thay đổi được đồng bộ giữa thiết bị.</p></div>${state.summary.undoProfile ? `<button type="button" data-ac-profile-undo="${escapeHtml(state.summary.undoProfile.id)}">Hoàn tác lần lưu gần nhất</button>` : ""}</header>
        <div class="ac-field-grid">
          <label><span>Tên hiển thị</span><input name="displayName" maxlength="100" value="${escapeHtml(profile.name || user.name)}" required></label>
          <label><span>Username duy nhất</span><div class="ac-input-prefix"><i>@</i><input name="username" maxlength="30" value="${escapeHtml(profile.username)}" pattern="[a-z0-9][a-z0-9._-]{2,29}" required></div></label>
          <label class="ac-span-2"><span>Giới thiệu</span><textarea name="bio" rows="4" maxlength="1000" placeholder="Bạn muốn mọi người biết điều gì?">${escapeHtml(profile.bio)}</textarea><small data-ac-count-for="bio">${String(profile.bio || "").length}/1000</small></label>
          <label><span>Thành phố</span><input name="city" maxlength="120" value="${escapeHtml(profile.city)}"></label>
          <label><span>Quê quán</span><input name="hometown" maxlength="120" value="${escapeHtml(profile.hometown)}"></label>
          <label><span>Nghề nghiệp / Nơi làm việc</span><input name="workplace" maxlength="180" value="${escapeHtml(profile.workplace)}"></label>
          <label><span>Trường học</span><input name="school" maxlength="180" value="${escapeHtml(profile.school)}"></label>
          <label><span>Ngày sinh</span><input name="birthday" type="date" value="${escapeHtml(profile.birthday)}"></label>
          <label><span>Đại từ xưng hô</span><input name="pronouns" maxlength="80" value="${escapeHtml(profile.pronouns)}"></label>
          <label><span>Giới tính (tùy chọn)</span><input name="gender" maxlength="60" value="${escapeHtml(profile.gender)}"></label>
          <label><span>Tình trạng mối quan hệ (tùy chọn)</span><input name="relationship" maxlength="80" value="${escapeHtml(profile.relationship)}"></label>
          <label><span>Website</span><input name="website" type="url" value="${escapeHtml(profile.website)}" placeholder="https://..."></label>
          <label><span>Ngôn ngữ</span><input name="languages" value="${escapeHtml((profile.languages || []).join(", "))}" placeholder="Tiếng Việt, English"></label>
          <label class="ac-span-2"><span>Sở thích</span><input name="interests" value="${escapeHtml((profile.interests || []).join(", "))}" placeholder="Âm nhạc, công nghệ, thiết kế"></label>
          <label class="ac-span-2"><span>Liên kết mạng xã hội</span><textarea name="socialLinks" rows="3" placeholder="github: https://github.com/...&#10;youtube: https://youtube.com/...">${escapeHtml(socialLinks)}</textarea><small>URL được máy chủ xác minh định dạng HTTPS trước khi lưu.</small></label>
        </div>
        <footer><span data-ac-profile-status>Chưa có thay đổi.</span><button type="submit">Lưu và đồng bộ hồ sơ</button></footer>
      </form>
    </section>`;
  }

  const privacyOptions = (value) => [["public", "Công khai"], ["friends", "Bạn bè"], ["private", "Chỉ mình tôi"]].map(([id, label]) => `<option value="${id}" ${value === id ? "selected" : ""}>${label}</option>`).join("");
  function privacyPanel(state) {
    const privacy = state.profile.privacy || {};
    const selects = [
      ["profileVisibility", "Toàn bộ hồ sơ", "Ai có thể mở trang hồ sơ của bạn."],
      ["birthdayVisibility", "Ngày sinh", "Không ảnh hưởng email hoặc thông tin đăng nhập."],
      ["bioVisibility", "Giới thiệu", "Kiểm soát riêng phần giới thiệu."],
      ["genderVisibility", "Giới tính", "Kiểm soát riêng trường giới tính tự khai báo."],
      ["pronounsVisibility", "Đại từ xưng hô", "Kiểm soát riêng trường đại từ."],
      ["cityVisibility", "Thành phố", "Kiểm soát riêng thành phố hiện tại."],
      ["hometownVisibility", "Quê quán", "Kiểm soát riêng quê quán."],
      ["workplaceVisibility", "Nghề nghiệp / nơi làm việc", "Kiểm soát riêng thông tin công việc."],
      ["schoolVisibility", "Trường học", "Kiểm soát riêng thông tin học tập."],
      ["relationshipVisibility", "Tình trạng mối quan hệ", "Kiểm soát riêng trường tùy chọn này."],
      ["websiteVisibility", "Website", "Kiểm soát riêng liên kết website."],
      ["socialLinksVisibility", "Liên kết mạng xã hội", "Kiểm soát riêng các liên kết xã hội."],
      ["interestsVisibility", "Sở thích", "Kiểm soát riêng danh sách sở thích."],
      ["languagesVisibility", "Ngôn ngữ", "Kiểm soát riêng danh sách ngôn ngữ."],
      ["friendsVisibility", "Danh sách bạn bè", "Ai được xem kết nối của bạn."],
      ["activityVisibility", "Hoạt động cộng đồng", "Không bao gồm lịch sử đăng nhập bảo mật."]
    ];
    const toggles = [
      ["discoverable", "Cho phép tìm thấy hồ sơ", "Lưu trên máy chủ; tắt để ẩn khỏi gợi ý kết nối."],
      ["searchIndexing", "Cho phép công cụ tìm kiếm lập chỉ mục", "Lưu trên máy chủ; có thể mất thời gian để máy tìm kiếm cập nhật."],
      ["activeStatus", "Hiển thị trạng thái hoạt động", "Lưu trên máy chủ; tắt để ẩn trạng thái online."],
      ["readReceipts", "Gửi trạng thái đã đọc", "Lưu trên máy chủ; tắt để không gửi xác nhận đọc."],
      ["locationAccess", "Cho phép dữ liệu vị trí", "Mặc định tắt. Xóa bằng cách tắt công tắc này."],
      ["tagReview", "Duyệt thẻ gắn tên trước khi hiện", "Lưu trên máy chủ và áp dụng cho bài đăng mới."]
    ];
    return `<section class="ac-panel" data-ac-panel="privacy">
      <section class="ac-card"><header class="ac-card-head"><div><span>Quyền riêng tư theo từng trường</span><h3>Bạn quyết định ai nhìn thấy gì</h3><p>Thiết lập được lưu trong hồ sơ server và đồng bộ trên mọi thiết bị.</p></div></header>
        <form data-ac-privacy-form><div class="ac-setting-list">${selects.map(([key, label, description]) => `<label class="ac-select-setting"><span><strong>${label}</strong><small>${description}</small></span><select name="${key}">${privacyOptions(privacy[key])}</select></label>`).join("")}
        ${toggles.map(([key, label, description]) => `<label class="ac-toggle-setting"><span><strong>${label}</strong><small>${description}</small></span><input type="checkbox" name="${key}" ${privacy[key] ? "checked" : ""}><i></i></label>`).join("")}</div>
        <footer><span data-ac-privacy-status>Thay đổi chỉ có hiệu lực sau khi lưu.</span><button type="submit">Lưu quyền riêng tư</button></footer></form>
      </section>
    </section>`;
  }

  function securityPanel(state) {
    const user = state.summary.user;
    const localPassword = user.provider === "local";
    return `<section class="ac-panel" data-ac-panel="security">
      <div class="ac-security-grid">${scoreMarkup(state.summary.securityScore)}<section class="ac-card"><header><span>Xác thực lại</span><h3>${state.summary.stepUp.valid ? "Phiên nhạy cảm đang mở" : "Bảo vệ thao tác quan trọng"}</h3></header><p>${state.summary.stepUp.valid ? `Còn khoảng ${Math.ceil(state.summary.stepUp.expiresInSeconds / 60)} phút trước khi cần xác thực lại.` : "Đổi email, mật khẩu, xuất hoặc xóa tài khoản sẽ yêu cầu Passkey hay đăng nhập lại."}</p><button type="button" data-ac-step-up>${localPassword ? "Xác thực bằng mật khẩu" : "Đăng nhập lại an toàn"}</button></section></div>
      <section class="ac-card"><header class="ac-card-head"><div><span>Thông tin đăng nhập</span><h3>Email và mật khẩu</h3><p>Mọi thay đổi đều được ghi audit và gửi cảnh báo bảo mật.</p></div></header>
        <div class="ac-credential-row"><span><strong>${escapeHtml(user.email)}</strong><small>${user.emailVerifiedAt ? `Đã xác minh ${formatDate(user.emailVerifiedAt)}` : "Chưa xác minh"}</small></span><b class="is-${user.emailVerifiedAt ? "safe" : "attention"}">${user.emailVerifiedAt ? "Đã xác minh" : "Cần xác minh"}</b>${user.emailVerifiedAt ? "" : `<button type="button" data-ac-verify-email>Gửi mã</button>`}</div>
        ${user.emailVerifiedAt ? "" : `<form class="ac-inline-form" data-ac-current-email-verify><input name="code" inputmode="numeric" maxlength="6" placeholder="Mã xác minh email hiện tại" required><button type="submit">Xác minh email</button></form>`}
        <form class="ac-inline-form" data-ac-email-form><input name="email" type="email" placeholder="Email đăng nhập mới" required><button type="submit">Gửi mã xác minh email mới</button></form>
        <form class="ac-inline-form" data-ac-email-confirm hidden><input name="email" type="email" readonly><input name="code" inputmode="numeric" maxlength="6" placeholder="Mã 6 số" required><button type="submit">Xác nhận đổi email</button></form>
        ${localPassword ? `<div class="ac-credential-row"><span><strong>Mật khẩu HH</strong><small>Chỉ gửi qua kết nối mã hóa để xác thực; không ghi log.</small></span><button type="button" data-ac-password-check>Kiểm tra rò rỉ</button></div>
        <form class="ac-inline-form" data-ac-password-form><input name="newPassword" type="password" minlength="12" maxlength="64" autocomplete="new-password" placeholder="Mật khẩu mới (12–64 ký tự)" required><button type="submit">Đổi mật khẩu</button></form>` : `<div class="ac-provider-note"><b>Đăng nhập ${escapeHtml(user.provider)}</b><p>Tài khoản không lưu mật khẩu HH. Việc xác thực lại dùng nhà cung cấp hoặc Passkey đã đăng ký.</p></div>`}
      </section>
      <section class="ac-card"><header class="ac-card-head"><div><span>Chi tiết điểm</span><h3>Kiểm tra có thể giải thích</h3></div><button type="button" data-ac-refresh>Kiểm tra lại</button></header>${checksMarkup(state.summary.securityScore)}</section>
    </section>`;
  }

  function sessionCard(session) {
    return `<article class="ac-device ${session.current ? "is-current" : ""} ${session.suspicious ? "is-suspicious" : ""}">
      <span class="ac-device-icon">${session.device.kind.includes("Điện thoại") ? "▯" : "▣"}</span><div><div><strong>${escapeHtml(session.device.label)}</strong>${session.current ? "<b>Thiết bị này</b>" : ""}${session.trusted ? "<b>Tin cậy</b>" : ""}${session.suspicious ? "<b class=is-risk>Đáng ngờ</b>" : ""}</div><small>${escapeHtml(session.device.kind)} · ${escapeHtml(session.device.region)} · IP ${escapeHtml(session.device.ipMasked)}</small><small>Tạo ${formatDate(session.createdAt)} · Hoạt động ${formatDate(session.lastSeenAt)} · Hết hạn ${formatDate(session.expiresAt)}</small></div>
      <div class="ac-device-actions"><button type="button" data-ac-session-trust="${escapeHtml(session.id)}" data-ac-trusted="${session.trusted}">${session.trusted ? "Bỏ tin cậy" : "Tin cậy"}</button>${session.current ? "" : `<button type="button" data-ac-session-revoke="${escapeHtml(session.id)}">Thu hồi</button><button type="button" class="danger" data-ac-session-not-me="${escapeHtml(session.id)}">Không phải tôi</button>`}</div>
    </article>`;
  }

  function sessionsPanel(state) {
    return `<section class="ac-panel" data-ac-panel="sessions">
      <section class="ac-card"><header class="ac-card-head"><div><span>Phiên phía máy chủ</span><h3>Thiết bị đang đăng nhập</h3><p>Thu hồi làm token mất hiệu lực trên server, không chỉ xóa ở trình duyệt.</p></div><button type="button" class="danger" data-ac-revoke-others>Thu hồi mọi phiên khác</button></header><div class="ac-device-list">${state.summary.sessions.map(sessionCard).join("") || "<p>Không có phiên hoạt động.</p>"}</div></section>
      <section class="ac-card"><header class="ac-card-head"><div><span>40 sự kiện gần nhất</span><h3>Lịch sử đăng nhập</h3><p>Phân biệt phương thức, thành công/thất bại, thiết bị và tín hiệu bất thường.</p></div><button type="button" data-ac-activity-reviewed>Đánh dấu đã kiểm tra</button></header>
        <div class="ac-login-list">${state.summary.loginHistory.map((item) => `<article class="is-${item.success ? "success" : "failed"}"><i></i><div><strong>${escapeHtml(item.type)}</strong><small>${escapeHtml(item.method)} · ${escapeHtml(item.device)} · IP ${escapeHtml(item.ipMasked)}</small></div><span>${formatDate(item.createdAt)}${item.suspicious ? " · Cần kiểm tra" : ""}</span></article>`).join("") || "<p>Chưa có lịch sử đăng nhập.</p>"}</div>
      </section>
    </section>`;
  }

  function passkeysPanel(state) {
    return `<section class="ac-panel" data-ac-panel="passkeys">
      <section class="ac-card"><header class="ac-card-head"><div><span>WebAuthn · chống phishing</span><h3>Passkey trên thiết bị của bạn</h3><p>Nên tạo hai Passkey trên hai thiết bị. Sinh trắc học không được gửi lên HH.</p></div><button type="button" data-ac-passkey-add>＋ Tạo Passkey</button></header>
        <div class="ac-passkey-list">${state.summary.passkeys.map((item) => `<article><span>◆</span><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.deviceType)} · ${escapeHtml(item.transports.join(", ") || "Nền tảng")}</small><small>Tạo ${formatDate(item.createdAt)} · Dùng gần nhất ${formatDate(item.lastUsedAt)}</small></div><button type="button" data-ac-passkey-rename="${escapeHtml(item.id)}" data-ac-passkey-name="${escapeHtml(item.name)}">Đổi tên</button><button type="button" class="danger" data-ac-passkey-revoke="${escapeHtml(item.id)}">Xóa</button></article>`).join("") || `<div class="ac-empty"><b>◆</b><strong>Chưa có Passkey</strong><p>Tạo Passkey để đăng nhập bằng vân tay, khuôn mặt hoặc PIN thiết bị.</p></div>`}</div>
      </section>
      <section class="ac-card ac-recovery"><header class="ac-card-head"><div><span>Dùng một lần</span><h3>Mã khôi phục</h3><p>Máy chủ chỉ lưu hash. Mã đầy đủ chỉ hiện đúng một lần sau khi tạo.</p></div><button type="button" data-ac-recovery-generate>${state.summary.recovery.remaining ? "Tạo lại bộ mã" : "Tạo mã khôi phục"}</button></header>
        <div class="ac-recovery-status"><strong>${state.summary.recovery.remaining}</strong><span>mã chưa dùng</span><small>${state.summary.recovery.generatedAt ? `Tạo ${formatDate(state.summary.recovery.generatedAt)}` : "Chưa từng tạo"}</small></div><div data-ac-recovery-output></div>
      </section>
    </section>`;
  }

  function notificationsPanel(state) {
    const settings = [
      ["securityEmail", "Cảnh báo bảo mật", "Email", "Lưu trên server; xóa thiết lập bằng cách tắt công tắc."],
      ["newDeviceEmail", "Thiết bị mới đăng nhập", "Email", "Gửi khi máy chủ phát hiện trình duyệt hoặc hệ điều hành mới."],
      ["productEmail", "Tin sản phẩm HH", "Email", "Mặc định tắt; chỉ bật khi bạn chủ động đồng ý."],
      ["learningReminders", "Nhắc lịch học", "Trong ứng dụng", "Lưu trên server; nội dung học chi tiết không được gửi kèm."],
      ["inAppUpdates", "Cập nhật chức năng", "Trong ứng dụng", "Hiện trong trung tâm thông báo của tài khoản."]
    ];
    return `<section class="ac-panel" data-ac-panel="notifications"><section class="ac-card"><header class="ac-card-head"><div><span>Tùy chọn theo tài khoản</span><h3>Thông báo bạn muốn nhận</h3><p>Cảnh báo bảo mật quan trọng có thể vẫn được gửi khi cần bảo vệ tài khoản.</p></div></header><form data-ac-notification-form><div class="ac-setting-list">${settings.map(([key, label, channel, description]) => `<label class="ac-toggle-setting"><span><strong>${label}<b>${channel}</b></strong><small>${description}</small></span><input type="checkbox" name="${key}" ${state.summary.notifications[key] ? "checked" : ""}><i></i></label>`).join("")}</div><footer><span data-ac-notification-status>Thiết lập được đồng bộ giữa thiết bị.</span><button type="submit">Lưu thông báo</button></footer></form></section></section>`;
  }

  function dataPanel(state) {
    const deletion = state.summary.user.deletionScheduledAt;
    return `<section class="ac-panel" data-ac-panel="data">
      <section class="ac-card"><header class="ac-card-head"><div><span>Portable data</span><h3>Xuất toàn bộ dữ liệu tài khoản</h3><p>Bản JSON gồm hồ sơ, quyền riêng tư, phiên đã làm sạch, lịch sử, audit và dữ liệu cộng đồng; không bao gồm hash mật khẩu hoặc khóa bí mật.</p></div><button type="button" data-ac-export>Xuất JSON</button></header><div class="ac-data-note"><b>Yêu cầu xác thực lại</b><p>Thao tác này không tự chạy nền và không gửi dữ liệu sang bên thứ ba.</p></div></section>
      <section class="ac-card"><header class="ac-card-head"><div><span>Nhật ký tài khoản</span><h3>Thay đổi gần đây</h3><p>Chỉ hiển thị hành động của tài khoản hiện tại.</p></div></header><div class="ac-audit-list">${state.summary.audit.map((item) => `<article><i></i><div><strong>${escapeHtml(item.action)}</strong><small>${escapeHtml(item.label || "Hành động tài khoản")}</small></div><span>${formatDate(item.createdAt)}</span></article>`).join("") || "<p>Chưa có audit log.</p>"}</div></section>
      <section class="ac-card ac-danger-zone"><header><span>Vùng nguy hiểm</span><h3>${deletion ? "Tài khoản đang chờ xóa" : "Xóa tài khoản"}</h3><p>${deletion ? `Dữ liệu được lên lịch xóa vào ${formatDate(deletion)}. Bạn có thể hủy trước thời điểm này.` : "Yêu cầu xóa có thời gian chờ 14 ngày. Mọi phiên sẽ bị thu hồi ngay sau khi xác nhận."}</p></header>${deletion ? `<button type="button" data-ac-cancel-delete>Hủy yêu cầu xóa</button>` : `<form data-ac-delete-form><label>Nhập <b>DELETE</b> để xác nhận<input name="confirm" autocomplete="off" required></label><button type="submit">Lên lịch xóa tài khoản</button></form>`}</section>
    </section>`;
  }

  function previewDialog(state) {
    const profile = state.profile;
    return `<dialog class="ac-dialog ac-profile-preview" data-ac-preview-dialog><button type="button" data-ac-dialog-close aria-label="Đóng">×</button><div class="ac-preview-cover">${imageValue(profile.cover, profile.name, "cover")}</div><div class="ac-preview-avatar">${imageValue(profile.avatar, profile.name, "avatar")}</div><h2>${escapeHtml(profile.name)}</h2><p>@${escapeHtml(profile.username)}</p><blockquote>${escapeHtml(profile.bio || "Chưa có giới thiệu.")}</blockquote><div><span>${escapeHtml(profile.city || "Chưa công khai thành phố")}</span><span>${escapeHtml(profile.workplace || "Chưa công khai nghề nghiệp")}</span></div><small>Đây là bản xem thử dựa trên quyền riêng tư hiện tại.</small></dialog>`;
  }

  function dialogsMarkup(state) {
    return `${previewDialog(state)}
      <dialog class="ac-dialog" data-ac-step-up-dialog><button type="button" data-ac-dialog-close aria-label="Đóng">×</button><span class="ac-dialog-icon">◆</span><h2>Xác thực lại</h2><p>Thao tác nhạy cảm chỉ tiếp tục sau khi danh tính được kiểm tra.</p>${state.summary.user.provider === "local" ? `<form data-ac-step-up-form><label>Mật khẩu hiện tại<input name="password" type="password" autocomplete="current-password" required></label><small data-ac-step-up-status></small><button type="submit">Xác thực và tiếp tục</button></form>` : `<button type="button" data-ac-relogin>Đăng nhập lại bằng ${escapeHtml(state.summary.user.provider)}</button>`}</dialog>
      <dialog class="ac-dialog ac-image-dialog" data-ac-image-dialog><button type="button" data-ac-dialog-close aria-label="Đóng">×</button><h2>Cắt và tối ưu ảnh</h2><div class="ac-image-stage"><img data-ac-image-preview alt="Xem trước ảnh sẽ tải"></div><label>Thu phóng<input type="range" min="1" max="3" step="0.05" value="1" data-ac-image-zoom></label><p>Ảnh được cắt ở giữa và nén WebP trước khi gửi lên kho hồ sơ.</p><button type="button" data-ac-image-confirm>Dùng ảnh này</button></dialog>
      <div class="ac-toast" role="status" aria-live="polite" data-ac-toast></div>`;
  }

  function appMarkup(state) {
    const user = state.summary.user;
    return `<section class="ac-shell" data-account-center data-ac-tab="${escapeHtml(state.activeTab)}">
      <header class="ac-hero">
        <div class="ac-hero-avatar">${imageValue(user.avatar || state.profile.avatar, user.name, "avatar")}</div>
        <div><span>ACCOUNT CENTER</span><h1>${escapeHtml(user.name)}</h1><p>${escapeHtml(user.email)} · ${user.emailVerifiedAt ? "Email đã xác minh" : "Email cần xác minh"}</p></div>
        <div class="ac-completion"><strong>${state.summary.profileCompletion}%</strong><span>Hồ sơ hoàn thiện</span><i style="--progress:${state.summary.profileCompletion}%"></i></div>
        <button type="button" data-ac-refresh>Đồng bộ lại</button>
      </header>
      <div class="ac-layout">
        <aside class="ac-nav" aria-label="Trung tâm tài khoản">${TABS.map(([id, label, icon]) => `<button type="button" data-ac-tab="${id}" class="${state.activeTab === id ? "is-active" : ""}" ${state.activeTab === id ? "aria-current=page" : ""}><span>${icon}</span><b>${label}</b><i>›</i></button>`).join("")}</aside>
        <main class="ac-content">${overviewPanel(state)}${profilePanel(state)}${privacyPanel(state)}${securityPanel(state)}${sessionsPanel(state)}${passkeysPanel(state)}${notificationsPanel(state)}${dataPanel(state)}</main>
      </div>${dialogsMarkup(state)}
    </section>`;
  }

  function showToast(root, message, tone = "success") {
    const toast = root.querySelector("[data-ac-toast]");
    if (!toast) return;
    toast.textContent = message;
    toast.dataset.tone = tone;
    toast.classList.add("is-visible");
    clearTimeout(root.__acToastTimer);
    root.__acToastTimer = setTimeout(() => toast.classList.remove("is-visible"), 4500);
  }

  function activateTab(root, tab) {
    const normalized = TABS.some(([id]) => id === tab) ? tab : "overview";
    root.dataset.acTab = normalized;
    root.querySelectorAll("[data-ac-tab]").forEach((button) => {
      if (button === root) return;
      const active = button.dataset.acTab === normalized;
      button.classList.toggle("is-active", active);
      button.toggleAttribute("aria-current", active);
    });
    root.querySelectorAll("[data-ac-panel]").forEach((panel) => panel.classList.toggle("is-active", panel.dataset.acPanel === normalized));
    root.__acState.activeTab = normalized;
    root.closest(".app-main")?.scrollTo({ top: 0, behavior: "smooth" });
  }

  function actionTab(action) {
    return ({ "verify-email": "security", passkeys: "passkeys", recovery: "passkeys", history: "sessions", sessions: "sessions", "password-check": "security" })[action] || action || "security";
  }

  async function loadState(activeTab) {
    const [summary, social] = await Promise.all([
      request("/api/account-center"),
      request("/api/social?view=profile")
    ]);
    if (!social.profile?.owned) throw new AccountApiError("Máy chủ không trả về hồ sơ thuộc tài khoản hiện tại.", "PROFILE_OWNERSHIP_REQUIRED");
    return { summary, profile: social.profile, activeTab };
  }

  async function refresh(root, options = {}) {
    const host = root.closest("[data-account-center-host]") || root.parentElement;
    const activeTab = options.activeTab || root.__acState?.activeTab || root.dataset.acTab || "overview";
    if (!options.silent) host.innerHTML = skeletonMarkup();
    try {
      const state = await loadState(activeTab);
      host.innerHTML = appMarkup(state);
      const next = host.querySelector("[data-account-center]");
      next.__acState = state;
      roots.delete(root);
      roots.add(next);
      bind(next);
      activateTab(next, activeTab);
      return next;
    } catch (error) {
      host.innerHTML = `<section class="ac-error"><span>!</span><h2>Không thể mở Account Center</h2><p>${escapeHtml(error.message)}</p><button type="button" data-ac-retry>Thử lại</button></section>`;
      host.querySelector("[data-ac-retry]")?.addEventListener("click", () => mount(host, { activeTab }));
      throw error;
    }
  }

  function formObject(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  function profilePayload(form) {
    const value = formObject(form);
    const socialLinks = String(value.socialLinks || "").split(/\n/).map((line) => {
      const match = line.match(/^\s*([^:]+):\s*(https:\/\/.+)$/i);
      return match ? { platform: match[1].trim().toLowerCase(), label: match[1].trim(), url: match[2].trim() } : null;
    }).filter(Boolean);
    return {
      displayName: value.displayName,
      username: String(value.username || "").toLowerCase(),
      bio: value.bio,
      city: value.city,
      hometown: value.hometown,
      workplace: value.workplace,
      school: value.school,
      birthday: value.birthday,
      pronouns: value.pronouns,
      gender: value.gender,
      relationship: value.relationship,
      website: value.website,
      languages: splitList(value.languages, 16),
      interests: splitList(value.interests, 24),
      socialLinks
    };
  }

  function openStepUp(root, task) {
    root.__acPendingTask = task || null;
    const dialog = root.querySelector("[data-ac-step-up-dialog]");
    if (dialog?.showModal) dialog.showModal();
  }

  async function withStepUp(root, task) {
    try { return await task(); }
    catch (error) {
      if (["STEP_UP_REQUIRED", "RELOGIN_REQUIRED"].includes(error.code)) {
        openStepUp(root, task);
        return null;
      }
      throw error;
    }
  }

  function base64UrlToBytes(value) {
    const padding = "=".repeat((4 - String(value).length % 4) % 4);
    const raw = atob(String(value).replace(/-/g, "+").replace(/_/g, "/") + padding);
    return Uint8Array.from(raw, (character) => character.charCodeAt(0));
  }

  function credentialToJson(value) {
    if (value instanceof ArrayBuffer) return btoa(String.fromCharCode(...new Uint8Array(value))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    if (Array.isArray(value)) return value.map(credentialToJson);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, credentialToJson(item)]));
    return value;
  }

  function publicKeyCredentialJson(credential) {
    if (global.HHAuthPlatform?.credentialJSON) return global.HHAuthPlatform.credentialJSON(credential);
    return {
      id: credential.id,
      rawId: credentialToJson(credential.rawId),
      type: credential.type,
      authenticatorAttachment: credential.authenticatorAttachment || null,
      clientExtensionResults: credential.getClientExtensionResults?.() || {},
      response: {
        clientDataJSON: credentialToJson(credential.response.clientDataJSON),
        attestationObject: credentialToJson(credential.response.attestationObject),
        transports: credential.response.getTransports?.() || []
      }
    };
  }

  async function addPasskey(root) {
    if (!global.PublicKeyCredential || !navigator.credentials?.create) throw new AccountApiError("Trình duyệt hoặc ngữ cảnh hiện tại không hỗ trợ Passkey.", "PASSKEY_UNSUPPORTED");
    const setup = await request("/api/auth/passkey-register-options", { method: "POST", body: JSON.stringify({}) });
    const publicKey = global.HHAuthPlatform?.publicKeyOptions
      ? global.HHAuthPlatform.publicKeyOptions(setup.options)
      : { ...setup.options, challenge: base64UrlToBytes(setup.options.challenge), user: { ...setup.options.user, id: base64UrlToBytes(setup.options.user.id) }, excludeCredentials: (setup.options.excludeCredentials || []).map((item) => ({ ...item, id: base64UrlToBytes(item.id) })) };
    const credential = await navigator.credentials.create({ publicKey });
    const response = publicKeyCredentialJson(credential);
    const result = await request("/api/auth/passkey-register-verify", { method: "POST", body: JSON.stringify({ requestId: setup.requestId, response, name: `Passkey · ${navigator.platform || "Thiết bị"}`, deviceType: credential.authenticatorAttachment || "WebAuthn" }) });
    showToast(root, `Đã tạo ${result.credential?.name || "Passkey"}.`);
    await refresh(root, { activeTab: "passkeys" });
  }

  async function imageToWebp(file, kind, zoom = 1) {
    if (!file || file.size > 8 * 1024 * 1024) throw new AccountApiError("Ảnh gốc cần nhỏ hơn 8 MB.", "IMAGE_TOO_LARGE");
    const bitmap = await createImageBitmap(file);
    const target = kind === "cover" ? { width: 1600, height: 600 } : { width: 640, height: 640 };
    const sourceRatio = bitmap.width / bitmap.height;
    const targetRatio = target.width / target.height;
    let cropWidth = sourceRatio > targetRatio ? bitmap.height * targetRatio : bitmap.width;
    let cropHeight = sourceRatio > targetRatio ? bitmap.height : bitmap.width / targetRatio;
    cropWidth /= zoom;
    cropHeight /= zoom;
    const sx = (bitmap.width - cropWidth) / 2;
    const sy = (bitmap.height - cropHeight) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = target.width;
    canvas.height = target.height;
    const context = canvas.getContext("2d", { alpha: false });
    context.drawImage(bitmap, sx, sy, cropWidth, cropHeight, 0, 0, target.width, target.height);
    bitmap.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.84));
    if (!blob) throw new AccountApiError("Không thể tối ưu ảnh trên thiết bị này.", "IMAGE_CONVERSION_FAILED");
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    return { data, mimeType: "image/webp" };
  }

  function downloadJson(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function handleClick(event, root) {
    const button = event.target.closest("button,[data-ac-tab]");
    if (!button || !root.contains(button)) return;
    if (button.matches("[data-ac-tab]") && button !== root) return activateTab(root, button.dataset.acTab);
    if (button.matches("[data-ac-jump]")) return activateTab(root, actionTab(button.dataset.acJump));
    if (button.matches("[data-ac-dialog-close]")) return button.closest("dialog")?.close();
    if (button.matches("[data-ac-refresh]")) return refresh(root, { activeTab: root.__acState.activeTab }).catch((error) => showToast(root, error.message, "error"));
    if (button.matches("[data-ac-preview]")) return root.querySelector("[data-ac-preview-dialog]")?.showModal?.();
    if (button.matches("[data-ac-step-up]")) return openStepUp(root, null);
    if (button.matches("[data-ac-relogin]")) {
      await request("/api/auth/logout", { method: "POST", body: JSON.stringify({}) }).catch(() => {});
      global.HHAuthSession?.setToken?.("");
      localStorage.removeItem("hh-auth-user");
      global.location.reload();
      return;
    }
    if (button.matches("[data-ac-passkey-add]")) return withStepUp(root, () => addPasskey(root)).catch((error) => showToast(root, error.name === "NotAllowedError" ? "Bạn đã hủy tạo Passkey." : error.message, "error"));
    if (button.matches("[data-ac-passkey-rename]")) {
      const name = global.prompt("Tên mới cho Passkey", button.dataset.acPasskeyName || "Passkey");
      if (!name) return;
      await accountAction("passkey:rename", { credentialId: button.dataset.acPasskeyRename, name });
      showToast(root, "Đã đổi tên Passkey.");
      return refresh(root, { activeTab: "passkeys" });
    }
    if (button.matches("[data-ac-passkey-revoke]")) {
      if (!global.confirm("Xóa Passkey này khỏi tài khoản?")) return;
      return withStepUp(root, async () => {
        await accountAction("passkey:revoke", { credentialId: button.dataset.acPasskeyRevoke });
        showToast(root, "Đã xóa Passkey và gửi cảnh báo email.");
        await refresh(root, { activeTab: "passkeys" });
      }).catch((error) => showToast(root, error.message, "error"));
    }
    if (button.matches("[data-ac-recovery-generate]")) return withStepUp(root, async () => {
      const data = await accountAction("recovery:generate");
      const output = root.querySelector("[data-ac-recovery-output]");
      output.innerHTML = `<div class="ac-recovery-codes"><header><strong>Lưu ngay — sẽ không hiện lại</strong><button type="button" data-ac-recovery-download>Tải TXT</button></header>${data.codes.map((code) => `<code>${escapeHtml(code)}</code>`).join("")}</div>`;
      output.__codes = data.codes;
      showToast(root, "Đã tạo bộ mã khôi phục mới.");
    }).catch((error) => showToast(root, error.message, "error"));
    if (button.matches("[data-ac-recovery-download]")) {
      const codes = button.closest("[data-ac-recovery-output]")?.__codes || [];
      const blob = new Blob([`HH Recovery Codes\nCreated: ${new Date().toISOString()}\n\n${codes.join("\n")}\n`], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "HH-RECOVERY-CODES.txt"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      return;
    }
    if (button.matches("[data-ac-session-revoke],[data-ac-session-not-me]")) {
      const notMe = button.hasAttribute("data-ac-session-not-me");
      const sessionId = button.dataset.acSessionRevoke || button.dataset.acSessionNotMe;
      if (notMe && !global.confirm("Báo phiên này không phải bạn và thu hồi ngay?")) return;
      await accountAction("session:revoke", { sessionId, notMe });
      showToast(root, notMe ? "Đã khóa phiên lạ và ghi sự kiện bảo mật." : "Đã thu hồi phiên.");
      return refresh(root, { activeTab: "sessions" });
    }
    if (button.matches("[data-ac-session-trust]")) return withStepUp(root, async () => {
      const trusted = button.dataset.acTrusted !== "true";
      await accountAction("session:trust", { sessionId: button.dataset.acSessionTrust, trusted });
      showToast(root, trusted ? "Đã đánh dấu thiết bị tin cậy." : "Đã bỏ trạng thái tin cậy.");
      await refresh(root, { activeTab: "sessions" });
    }).catch((error) => showToast(root, error.message, "error"));
    if (button.matches("[data-ac-revoke-others]")) return withStepUp(root, async () => {
      const data = await accountAction("sessions:revoke-others");
      showToast(root, `Đã thu hồi ${data.revoked} phiên khác.`);
      await refresh(root, { activeTab: "sessions" });
    }).catch((error) => showToast(root, error.message, "error"));
    if (button.matches("[data-ac-activity-reviewed]")) {
      await accountAction("activity:reviewed");
      showToast(root, "Đã ghi nhận bạn đã kiểm tra hoạt động.");
      return refresh(root, { activeTab: "sessions" });
    }
    if (button.matches("[data-ac-password-check]")) return openStepUp(root, async () => {
      const password = root.querySelector("[data-ac-step-up-form] [name=password]")?.value || "";
      const data = await accountAction("password:safety-check", { password });
      showToast(root, data.status === "safe" ? "Không tìm thấy mật khẩu trong tập dữ liệu rò rỉ tại thời điểm kiểm tra." : data.status === "compromised" ? `Mật khẩu đã xuất hiện ${data.count} lần. Hãy đổi ngay.` : "Dịch vụ kiểm tra đang không khả dụng.", data.status === "safe" ? "success" : "error");
      await refresh(root, { activeTab: "security" });
    });
    if (button.matches("[data-ac-verify-email]")) {
      const data = await request("/api/auth/email-verification-request", { method: "POST", body: JSON.stringify({}) });
      showToast(root, data.delivery === "sent" ? "Mã xác minh đã được gửi qua email." : "Dịch vụ email chưa gửi được mã.", data.delivery === "sent" ? "success" : "error");
      return;
    }
    if (button.matches("[data-ac-profile-undo]")) {
      await socialAction("profile:undo", { historyId: button.dataset.acProfileUndo });
      showToast(root, "Đã hoàn tác lần lưu hồ sơ gần nhất.");
      return refresh(root, { activeTab: "profile" });
    }
    if (button.matches("[data-ac-export]")) return withStepUp(root, async () => {
      const data = await accountAction("account:export");
      downloadJson(`hh-account-export-${new Date().toISOString().slice(0, 10)}.json`, data);
      showToast(root, "Đã tạo bản xuất dữ liệu đầy đủ.");
    }).catch((error) => showToast(root, error.message, "error"));
    if (button.matches("[data-ac-cancel-delete]")) {
      await accountAction("account:cancel-delete");
      showToast(root, "Đã hủy yêu cầu xóa tài khoản.");
      return refresh(root, { activeTab: "data" });
    }
    if (button.matches("[data-ac-image-confirm]")) {
      const file = root.__acImageFile;
      if (!file) return;
      button.disabled = true;
      try {
        const zoom = Number(root.querySelector("[data-ac-image-zoom]")?.value || 1);
        const prepared = await imageToWebp(file, root.__acImageKind, zoom);
        const result = await accountAction("profile:image", { ...prepared, kind: root.__acImageKind });
        showToast(root, "Ảnh đã được tối ưu và đồng bộ lên máy chủ.");
        root.querySelector("[data-ac-image-dialog]")?.close();
        await refresh(root, { activeTab: "profile" });
      } catch (error) { showToast(root, error.message, "error"); }
      finally { button.disabled = false; }
    }
  }

  async function handleSubmit(event, root) {
    const form = event.target;
    if (!form.matches("form")) return;
    event.preventDefault();
    const submit = form.querySelector("button[type=submit]");
    if (submit) submit.disabled = true;
    try {
      if (form.matches("[data-ac-profile-form]")) {
        const data = await socialAction("profile:update", { profile: profilePayload(form) });
        root.__acState.profile = data.profile;
        showToast(root, "Hồ sơ đã được lưu trên máy chủ.");
        return refresh(root, { activeTab: "profile" });
      }
      if (form.matches("[data-ac-privacy-form]")) {
        const privacy = {};
        form.querySelectorAll("select").forEach((input) => { privacy[input.name] = input.value; });
        form.querySelectorAll('input[type="checkbox"]').forEach((input) => { privacy[input.name] = input.checked; });
        await socialAction("privacy:update", { privacy });
        showToast(root, "Quyền riêng tư đã được đồng bộ.");
        return refresh(root, { activeTab: "privacy" });
      }
      if (form.matches("[data-ac-notification-form]")) {
        const notifications = Object.fromEntries(Array.from(form.querySelectorAll('input[type="checkbox"]')).map((input) => [input.name, input.checked]));
        await accountAction("notifications:update", { notifications });
        showToast(root, "Đã lưu tùy chọn thông báo.");
      }
      if (form.matches("[data-ac-current-email-verify]")) {
        await request("/api/auth/email-verification-verify", { method: "POST", body: JSON.stringify(formObject(form)) });
        showToast(root, "Email đã được xác minh thành công.");
        return refresh(root, { activeTab: "security" });
      }
      if (form.matches("[data-ac-step-up-form]")) {
        const data = formObject(form);
        await accountAction("step-up:password", { password: data.password });
        root.querySelector("[data-ac-step-up-dialog]")?.close();
        showToast(root, "Xác thực thành công. Thao tác nhạy cảm đã được mở tạm thời.");
        const task = root.__acPendingTask;
        root.__acPendingTask = null;
        if (task) await task();
      }
      if (form.matches("[data-ac-password-form]")) return withStepUp(root, async () => {
        await accountAction("password:update", formObject(form));
        showToast(root, "Đã đổi mật khẩu và thu hồi các phiên khác.");
        form.reset();
      });
      if (form.matches("[data-ac-email-form]")) return withStepUp(root, async () => {
        const values = formObject(form);
        await accountAction("email:request", values);
        const confirm = root.querySelector("[data-ac-email-confirm]");
        confirm.hidden = false;
        confirm.elements.email.value = values.email;
        showToast(root, "Mã xác minh đã gửi đến email mới.");
      });
      if (form.matches("[data-ac-email-confirm]")) {
        const result = await withStepUp(root, () => accountAction("email:confirm", formObject(form)));
        if (result?.signedOut) {
          global.HHAuthSession?.setToken?.("");
          localStorage.removeItem("hh-auth-user");
          global.location.reload();
        }
      }
      if (form.matches("[data-ac-delete-form]")) return withStepUp(root, async () => {
        const result = await accountAction("account:delete", formObject(form));
        showToast(root, `Đã lên lịch xóa vào ${formatDate(result.deletionScheduledAt)}.`);
        global.HHAuthSession?.setToken?.("");
        localStorage.removeItem("hh-auth-user");
        setTimeout(() => global.location.reload(), 1000);
      });
    } catch (error) {
      showToast(root, error.message, "error");
    } finally {
      if (submit) submit.disabled = false;
    }
  }

  function handleChange(event, root) {
    const input = event.target.closest("[data-ac-image]");
    if (!input) return;
    const file = input.files?.[0];
    if (!file) return;
    root.__acImageFile = file;
    root.__acImageKind = input.dataset.acImage;
    const dialog = root.querySelector("[data-ac-image-dialog]");
    const preview = dialog?.querySelector("[data-ac-image-preview]");
    if (preview) {
      if (root.__acImageUrl) URL.revokeObjectURL(root.__acImageUrl);
      root.__acImageUrl = URL.createObjectURL(file);
      preview.src = root.__acImageUrl;
      preview.style.transform = "scale(1)";
    }
    const zoom = dialog?.querySelector("[data-ac-image-zoom]");
    if (zoom) zoom.value = "1";
    dialog?.classList.toggle("is-cover", input.dataset.acImage === "cover");
    dialog?.showModal?.();
  }

  function bind(root) {
    root.addEventListener("click", (event) => handleClick(event, root).catch((error) => showToast(root, error.message, "error")));
    root.addEventListener("submit", (event) => handleSubmit(event, root));
    root.addEventListener("change", (event) => handleChange(event, root));
    root.addEventListener("input", (event) => {
      if (event.target.matches("[data-ac-image-zoom]")) root.querySelector("[data-ac-image-preview]").style.transform = `scale(${event.target.value})`;
      if (event.target.name === "bio") {
        const counter = root.querySelector('[data-ac-count-for="bio"]');
        if (counter) counter.textContent = `${event.target.value.length}/1000`;
      }
    });
  }

  async function mount(host, options = {}) {
    if (!host) return null;
    host.dataset.accountCenterHost = "";
    host.innerHTML = skeletonMarkup();
    const initial = options.activeTab || "overview";
    try {
      const state = await loadState(initial);
      host.innerHTML = appMarkup(state);
      const root = host.querySelector("[data-account-center]");
      root.__acState = state;
      roots.add(root);
      bind(root);
      activateTab(root, initial);
      return root;
    } catch (error) {
      host.innerHTML = `<section class="ac-error"><span>!</span><h2>Không thể mở Account Center</h2><p>${escapeHtml(error.message)}</p><button type="button" data-ac-retry>Thử lại</button></section>`;
      host.querySelector("[data-ac-retry]")?.addEventListener("click", () => mount(host, options));
      return null;
    }
  }

  function unmount() {
    roots.forEach((root) => {
      if (root.__acImageUrl) URL.revokeObjectURL(root.__acImageUrl);
      clearTimeout(root.__acToastTimer);
    });
    roots.clear();
  }

  global.HHAccountCenter = Object.freeze({ mount, unmount, refresh: (root) => refresh(root || [...roots][0] || null) });
})(window);
