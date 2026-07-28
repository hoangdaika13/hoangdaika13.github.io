(function initHHSupportPlatform(globalScope, factory) {
  "use strict";
  const api = factory(globalScope || {});
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (globalScope) globalScope.HHSupportPage = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function supportPlatformFactory(globalScope) {
  "use strict";

  const window = globalScope;
  const VERSION = 2;
  const INTEGRATION_VERSION = "support-platform.v14";
  const STORAGE_KEY = "hh.support.pending.v2";
  const LEGACY_STORAGE_KEY = "hh-payos-pending";
  const DONATION_STATUSES = Object.freeze(["pending", "submitted", "verified", "refunded", "rejected", "payment_error"]);
  const MISSION_DEFINITIONS = Object.freeze([
    { id: "infrastructure", label: "Máy chủ & Database", shortLabel: "Hạ tầng", color: "#65ebff", icon: "◈", route: "#/system" },
    { id: "domain-services", label: "Domain & Dịch vụ", shortLabel: "Domain", color: "#8f8cff", icon: "⌁", route: "#/system" },
    { id: "astral-realms", label: "HH Astral Realms", shortLabel: "Astral Realms", color: "#ff68c8", icon: "✦", route: "#/entertainment/astral-realms" },
    { id: "ai-provider", label: "AI Provider", shortLabel: "AI", color: "#ffb65c", icon: "✧", route: "#/creative/ai-center" },
    { id: "hh-english", label: "HH English", shortLabel: "English", color: "#68f1be", icon: "◇", route: "#/english" },
    { id: "graphic-design", label: "Thiết kế đồ họa", shortLabel: "Design", color: "#b77aff", icon: "⬡", route: "#/graphic-design" },
    { id: "reserve", label: "Quỹ dự phòng", shortLabel: "Dự phòng", color: "#f3dc6b", icon: "◌", route: "#/support" }
  ]);
  const SUPPORT_TIERS = Object.freeze([
    { amount: 20000, code: "MS", name: "Moon Spark", color: "#7cefff" },
    { amount: 50000, code: "CF", name: "Comet Fuel", color: "#8a7dff" },
    { amount: 100000, code: "NC", name: "Nebula Core", color: "#f069d1" },
    { amount: 200000, code: "SE", name: "Stellar Engine", color: "#42e8b4" },
    { amount: 500000, code: "GG", name: "Galaxy Guardian", color: "#ff9a62" },
    { amount: 1000000, code: "CP", name: "Cosmic Patron", color: "#ffd968" }
  ]);
  const SUPPORT_THEMES = Object.freeze([
    ["nebula", "Nebula Rose"], ["aurora", "Aurora Support"], ["cyber", "Cyber Patron"],
    ["deep-space", "Deep Space"], ["golden", "Golden Guardian"], ["cinema", "Cosmic Cinema"]
  ]);
  const CONTRIBUTION_TYPES = Object.freeze([
    ["asset", "Asset / tài nguyên"], ["translation", "Bản dịch"], ["bug", "Báo lỗi"], ["code", "Mã nguồn"], ["tester", "Tester"], ["feedback", "Ý tưởng / phản hồi"]
  ]);
  let refreshTimer = 0;
  let paymentPollTimer = 0;
  let paymentCountdownTimer = 0;

  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const money = value => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(Number(value) || 0);
  const dateText = value => value ? new Date(value).toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" }) : "--";
  const getUser = () => { try { return JSON.parse(localStorage.getItem("hh-auth-user") || "{}"); } catch { return {}; } };
  const downloadBlob = (name, blob) => { const anchor = document.createElement("a"); const url = URL.createObjectURL(blob); anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1200); };
  const downloadText = (name, content, mime = "text/plain;charset=utf-8") => downloadBlob(name, new Blob([content], { type: mime }));
  const csvEscape = value => `"${String(value ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
  const downloadCsv = (name, rows) => {
    const csv = rows.map(row => row.map(csvEscape).join(",")).join("\r\n");
    downloadText(name, `\uFEFF${csv}`, "text/csv;charset=utf-8");
  };
  const missionById = id => MISSION_DEFINITIONS.find(mission => mission.id === id) || MISSION_DEFINITIONS[MISSION_DEFINITIONS.length - 1];
  const pdfText = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/[^\x20-\x7E]/g, "");
  const loadScriptOnce = (src, ready) => new Promise((resolve, reject) => {
    if (ready?.()) return resolve();
    const existing = document.querySelector(`script[data-support-library="${src}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Không tải được thư viện xuất PDF.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.dataset.supportLibrary = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Không tải được thư viện xuất PDF."));
    document.head.appendChild(script);
  });
  const isPayOSCheckoutUrl = value => {
    try { const url = new URL(String(value || "")); return url.protocol === "https:" && (url.hostname === "payos.vn" || url.hostname.endsWith(".payos.vn")); }
    catch { return false; }
  };

  function donationLifecycle(input = {}) {
    const status = DONATION_STATUSES.includes(input.status) ? input.status : "pending";
    const receiptStatus = String(input.receipt?.status || "waiting_payment").slice(0, 40);
    const refundStatus = String(input.refund?.status || "not_requested").slice(0, 40);
    const paymentConfirmed = status === "verified" || status === "refunded";
    const refundConfirmed = status === "refunded" && refundStatus === "confirmed" && Boolean(String(input.refund?.providerReference || "").trim());
    return {
      status,
      paymentConfirmed,
      refundConfirmed,
      terminal: ["refunded", "rejected", "payment_error"].includes(status),
      steps: [
        { id: "intent", state: "done" },
        { id: "payment", state: ["rejected", "payment_error"].includes(status) ? "failed" : paymentConfirmed || status === "submitted" ? "done" : "current" },
        { id: "verification", state: paymentConfirmed ? "done" : ["rejected", "payment_error"].includes(status) ? "blocked" : "waiting" },
        { id: "receipt", state: receiptStatus === "sent" ? "done" : paymentConfirmed ? ["failed", "not_configured", "missing_email"].includes(receiptStatus) ? "attention" : "current" : "waiting" },
        { id: "refund", state: refundConfirmed ? "done" : input.refund ? "waiting-provider" : "not-requested" }
      ],
      source: "backend-status-only"
    };
  }

  function normalizePending(input) {
    if (!input || typeof input !== "object") return null;
    const id = String(input.id || "").slice(0, 120);
    const reference = String(input.reference || "").slice(0, 40);
    const checkoutUrl = String(input.checkoutUrl || "").slice(0, 1200);
    if (!id || !reference || !isPayOSCheckoutUrl(checkoutUrl)) return null;
    return {
      version: VERSION,
      id,
      reference,
      amount: Math.max(0, Math.min(1000000000, Math.round(Number(input.amount) || 0))),
      status: ["pending", "submitted"].includes(input.status) ? input.status : "pending",
      missionId: missionById(input.missionId).id,
      visibility: ["public", "alias", "anonymous"].includes(input.visibility) ? input.visibility : input.anonymous ? "anonymous" : "public",
      donorAlias: String(input.donorAlias || "").slice(0, 60),
      checkoutUrl,
      qrImage: String(input.qrImage || "").startsWith("data:image/") ? String(input.qrImage).slice(0, 1500000) : "",
      pollUntil: Math.max(0, Number(input.pollUntil) || 0)
    };
  }

  function createPayOSCheckoutAdapter(scope = globalScope, timeoutMs = 8000) {
    const waitUntilReady = async () => {
      const deadline = Date.now() + timeoutMs;
      while (!scope.PayOSCheckout?.usePayOS && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
      if (!scope.PayOSCheckout?.usePayOS) throw new Error("Không tải được giao diện payOS. Hãy kiểm tra kết nối mạng rồi thử lại.");
      return scope.PayOSCheckout;
    };
    return {
      async open({ checkoutUrl, onProviderAccepted, onCancel, onExit }) {
        if (!isPayOSCheckoutUrl(checkoutUrl)) throw new Error("payOS chưa trả về checkout URL hợp lệ.");
        const sdk = await waitUntilReady();
        const returnUrl = new URL(scope.location?.pathname || "/", scope.location?.origin || "https://localhost").href;
        const controller = sdk.usePayOS({
          RETURN_URL: returnUrl,
          ELEMENT_ID: "hh-payos-embedded",
          CHECKOUT_URL: checkoutUrl,
          embedded: true,
          onSuccess: () => onProviderAccepted?.(),
          onCancel: () => onCancel?.(),
          onExit: () => onExit?.()
        });
        if (!controller?.open) throw new Error("SDK payOS chưa tạo được checkout controller.");
        controller.open();
        return controller;
      }
    };
  }

  function markup(user) {
    const presets = [20000, 50000, 100000, 200000, 500000, 1000000];
    return `<section class="support-page" data-support-page>
      <section class="support-overview">
        <div class="support-overview__copy"><p class="section-kicker">DEVELOPER CORE · H GALAXY</p><h2>Cùng duy trì và phát triển HH Platform</h2><p>Mỗi tia năng lượng trong lõi H chỉ xuất hiện từ một khoản ủng hộ đã được backend xác minh. Bạn chọn đúng nhiệm vụ muốn tiếp sức, còn dữ liệu công khai luôn được ẩn danh theo lựa chọn.</p><div class="support-trust"><span>✓ Minh bạch giao dịch</span><span>✓ VietQR tự động qua payOS</span><span data-support-email-trust>✓ Email cảm ơn sau xác minh</span><span>✓ Không lưu dữ liệu ngân hàng</span></div></div>
        <div class="support-core support-core-star" data-support-core tabindex="0" aria-label="Developer Core">
          <div class="support-core__orbit support-core__orbit--outer"><i data-support-core-rays></i></div>
          <button class="support-core__sun" type="button" data-support-core-sun aria-describedby="support-core-details"><span>H</span><small>DEVELOPER CORE</small></button>
          <div class="support-core__details" id="support-core-details" role="status"><strong data-support-core-month>0 ₫</strong><span><b data-support-core-supporters>0</b> người ủng hộ tháng này</span><small data-support-core-synced>Đang đồng bộ backend…</small></div>
          <div class="support-core__signals"><span data-support-core-signal="pending">◌ <b>0</b> chờ xác minh</span><span data-support-core-signal="verified">✦ <b>0</b> đã xác minh</span><span data-support-core-signal="failed">! <b>0</b> lỗi / từ chối</span></div>
        </div>
        <div class="support-goal"><header><span>Mục tiêu phát triển</span><strong data-support-progress-label>0%</strong></header><div class="support-goal__amount"><strong data-support-total>0 ₫</strong><span>/ <b data-support-goal>10.000.000 ₫</b></span></div><i><b data-support-progress data-support-progress-ring></b></i><footer><span><b data-support-count>0</b> lượt đã xác nhận</span><span>Tháng này <b data-support-month>0 ₫</b></span></footer></div>
        <div class="support-galaxy-controls" aria-label="Tùy chỉnh thiên hà ủng hộ"><label>Chủ đề<select data-support-theme>${SUPPORT_THEMES.map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select></label><div class="support-effects" role="group" aria-label="Mức chuyển động"><button type="button" data-support-effect="static">Tĩnh</button><button type="button" data-support-effect="balanced" class="active">Cân bằng</button><button type="button" data-support-effect="cinematic">Điện ảnh</button></div></div>
      </section>

      <div class="support-metrics"><article><span>Tổng đã nhận</span><strong data-support-total-card>0 ₫</strong><small>Chỉ tính giao dịch đã đối soát</small></article><article><span>Người ủng hộ</span><strong data-support-count-card>0</strong><small>Cảm ơn cộng đồng HH</small></article><article><span>Ủng hộ trung bình</span><strong data-support-average>0 ₫</strong><small>Mỗi giao dịch đã xác nhận</small></article><article><span>Trạng thái</span><strong class="is-online">Đang hoạt động</strong><small data-support-checked>Cập nhật tự động 30 giây/lần</small></article></div>

      <section class="support-mission-map" data-support-mission-map><header><div><p class="section-kicker">FUNDING MISSION MAP</p><h3>Bảy hành tinh đang cần năng lượng</h3><p>Chọn một nhiệm vụ để khoản ủng hộ được gắn trực tiếp vào mục tiêu đó.</p></div><span data-support-mission-sync>Chưa có hoạt động</span></header><div class="support-mission-grid" data-support-mission-list><p class="support-empty">Đang tải nhiệm vụ từ backend…</p></div></section>

      <section class="support-automation" data-support-automation data-support-scroll-donate>
        <header><div><p class="section-kicker">VIETQR AUTOMATION</p><h3>Ủng hộ trong một luồng liền mạch</h3></div><span data-support-journey-label>Sẵn sàng</span></header>
        <ol><li class="is-current" data-support-step="details" data-payment-state-item="creating"><b>1</b><span><strong>Thông tin</strong><small>Chọn số tiền và email</small></span></li><li data-support-step="payment" data-payment-state-item="waiting"><b>2</b><span><strong>VietQR</strong><small>Quét ngay trên HH Platform</small></span></li><li data-support-step="verify" data-payment-state-item="verifying"><b>3</b><span><strong>Xác minh</strong><small>Webhook payOS tự đối soát</small></span></li><li data-support-step="email" data-payment-state-item="paid"><b>4</b><span><strong>Hoàn tất</strong><small>Nhận email cảm ơn</small></span></li></ol>
        <p>Mỗi lần chỉ hiển thị đúng bước đang thực hiện. Giao dịch chỉ được ghi nhận sau khi payOS gửi webhook có chữ ký hợp lệ.</p>
      </section>

      <div class="support-payment-flow" data-support-flow>
      <div class="support-main-grid" data-support-stage-panel="details">
        <main class="support-donate-panel">
          <header><div><span>Bước 1</span><h3>Chọn mức ủng hộ</h3></div><span class="support-secure">Bảo mật phía máy chủ</span></header>
          <form data-support-form>
            <div class="support-auto-method" data-support-auto-method><div class="support-auto-method__icon">QR</div><div><span>VIETQR TỰ ĐỘNG QUA PAYOS</span><strong>Thanh toán an toàn ngay trong HH Platform</strong><small data-support-payos-availability>Đang kiểm tra kết nối payOS…</small></div><i data-support-provider-state></i></div>
            <div class="support-form-block"><span class="support-field-label">Nhiệm vụ muốn tiếp sức</span><div class="support-mission-picker" data-support-mission-picker><input type="hidden" data-support-mission value="infrastructure">${MISSION_DEFINITIONS.map((mission, index) => `<button type="button" class="${index === 0 ? "is-selected" : ""}" data-support-mission-choice="${mission.id}" style="--mission-color:${mission.color}"><i>${mission.icon}</i><span>${mission.shortLabel}</span></button>`).join("")}</div><small class="support-field-hint" data-support-mission-note>Máy chủ & Database · Chưa có hoạt động</small></div>
            <div class="support-presets">${presets.map((amount, index) => `<button type="button" class="${index === 2 ? "active" : ""}" data-support-preset="${amount}">${money(amount)}</button>`).join("")}</div>
            <label class="support-amount-field"><span>Số tiền tùy chỉnh</span><div><b>₫</b><input type="number" min="1000" max="1000000000" step="1000" value="100000" data-support-amount required></div><small>Tối thiểu 1.000đ</small></label>
            <div class="support-form-grid"><label><span>Tên hiển thị</span><input data-support-name maxlength="100" value="${escapeHtml(user.name || "")}" placeholder="Tên của bạn" required></label><label><span>Email nhận lời cảm ơn (không công khai)</span><input type="email" data-support-email maxlength="160" value="${escapeHtml(user.email || "")}" placeholder="you@gmail.com" autocomplete="email" required><small>Thư chỉ gửi sau khi thanh toán được xác minh.</small></label></div>
            <label><span>Lời nhắn tới nhà phát triển</span><textarea rows="4" maxlength="500" data-support-message placeholder="Cảm ơn bạn đã xây dựng các công cụ hữu ích..."></textarea><small><b data-support-message-count>0</b>/500 ký tự</small></label>
            <div class="support-form-grid support-visibility-grid"><label><span>Quyền hiển thị</span><select data-support-visibility><option value="public">Công khai tên hiển thị</option><option value="alias">Chỉ hiện biệt danh</option><option value="anonymous">Ẩn danh hoàn toàn</option></select></label><label data-support-alias-wrap hidden><span>Biệt danh công khai</span><input data-support-alias maxlength="60" placeholder="Supporter HH"></label></div>
            <p class="support-privacy-note">Email chỉ dùng để gửi lời cảm ơn và mã xác nhận; không xuất hiện trên tường cộng đồng.</p>
            <button class="support-primary" type="submit" disabled>Tiếp tục tới VietQR</button>
            <p class="support-form-status" data-support-form-status>Đang kết nối kênh VietQR tự động…</p>
          </form>
        </main>
      </div>

      <section class="support-payos-stage support-wormhole" data-support-payos data-support-stage-panel="payment" hidden>
        <header><div><span>BƯỚC 2 · VIETQR PAYOS</span><h3 data-support-payos-title>Đang tạo giao diện thanh toán</h3><p data-support-payos-status>Mã VietQR sẽ xuất hiện ngay tại đây, không mở sang website khác.</p></div><div class="support-live-badge"><i></i> Tự động đối soát</div></header>
        <div class="support-payos-workspace">
          <aside class="support-payos-summary" aria-label="Tóm tắt giao dịch">
            <div class="support-payos-summary__eyebrow"><i></i><span>GIAO DỊCH ĐANG CHỜ</span></div>
            <strong class="support-payos-summary__amount" data-support-payos-amount>--</strong>
            <dl><div><dt>Mã giao dịch</dt><dd data-support-payos-reference>--</dd></div><div><dt>Thời gian còn lại</dt><dd data-support-payos-countdown>30:00</dd></div></dl>
            <div class="support-payos-guide"><span>QUÉT VÀ HOÀN TẤT</span><ol><li><b>1</b><p><strong>Mở ứng dụng ngân hàng</strong><small>Chọn chức năng quét mã VietQR.</small></p></li><li><b>2</b><p><strong>Quét mã bên cạnh</strong><small>Số tiền và nội dung được điền tự động.</small></p></li><li><b>3</b><p><strong>Xác nhận thanh toán</strong><small>HH Platform tự chuyển bước sau khi nhận webhook.</small></p></li></ol></div>
            <div class="support-payos-shield"><b>✓</b><p><strong>Bảo vệ bởi payOS</strong><small>HH Platform không lưu thông tin ngân hàng của bạn.</small></p></div>
          </aside>
          <div class="support-payos-frame">
            <div class="support-payos-frame__top"><span><i></i> VietQR trực tiếp</span><small>Không rời khỏi HH Platform</small></div>
            <div class="support-payos-direct" data-support-payos-direct hidden><div class="support-payos-direct__halo"><img data-support-payos-qr-image alt="Mã VietQR thanh toán tự động qua payOS"></div><div><strong>Quét mã để hoàn tất ủng hộ</strong><span>VietQR tự điền chính xác số tiền và nội dung chuyển khoản.</span></div><small><b>VIETQR</b> · Xử lý an toàn bởi payOS</small></div>
            <div class="support-payos-embed" id="hh-payos-embedded" data-support-payos-embed><div class="support-payos-loading"><i></i><strong>Đang tải VietQR bảo mật</strong><span>Vui lòng giữ trang này mở trong vài giây.</span></div></div>
            <div class="support-payos-frame__note"><span>🔒 Kết nối bảo mật</span><span>⚡ Xác minh tự động</span><span>✉ Email sau thanh toán</span></div>
          </div>
        </div>
        <footer><button type="button" data-support-new-payment>Thay đổi thông tin</button><a href="#" target="_blank" rel="noopener" data-support-payos-fallback hidden>Mở payOS trong tab mới</a><a href="#" target="_blank" rel="noopener" data-support-bank-deeplink hidden>Mở payOS / ứng dụng ngân hàng</a></footer>
      </section>

      <section class="support-verify-stage" data-support-stage-panel="verify" hidden>
        <div class="support-verify-stage__pulse"><i></i><b>3</b></div><div><span>BƯỚC 3 · XÁC MINH TỰ ĐỘNG</span><h3 data-support-verify-title>Đang chờ ngân hàng xác nhận</h3><p data-support-verify-status>Webhook payOS đang đối chiếu mã giao dịch và số tiền. Bạn không cần tải lại trang.</p></div><button type="button" data-support-payos-check>Kiểm tra ngay</button>
      </section>

      <section class="support-receipt" data-support-receipt data-support-stage-panel="email" hidden>
        <div class="support-receipt__icon support-hologram-envelope">✓</div>
        <div><span>XÁC NHẬN ỦNG HỘ</span><h3>Cảm ơn bạn đã đồng hành cùng Nhhoang</h3><p data-support-receipt-status>Đang hoàn tất thư cảm ơn.</p></div>
        <dl><div><dt>Mã xác nhận</dt><dd data-support-receipt-id>--</dd></div><div><dt>Số tiền</dt><dd data-support-receipt-amount>--</dd></div><div><dt>Email</dt><dd data-support-receipt-email>--</dd></div><div><dt>Xác nhận lúc</dt><dd data-support-receipt-time>--</dd></div></dl><small class="support-receipt__privacy">Email được che một phần trên giao diện công khai và chỉ dùng để gửi biên nhận.</small>
        <div class="support-receipt__actions"><button type="button" data-support-download-receipt data-support-download-receipt-pdf data-format="pdf">Tải PDF</button><button type="button" data-support-download-receipt data-format="txt">Tải TXT</button><button type="button" data-support-download-card hidden>Thẻ PNG</button><button type="button" data-support-share-card hidden>Chia sẻ</button></div>
      </section>
      </div>

      <div class="support-community-grid">
        <section class="support-wall"><header><div><span>Cộng đồng</span><h3>Lời nhắn gần đây</h3></div><button type="button" data-support-refresh>Làm mới</button></header><div data-support-wall><p class="support-empty">Chưa có giao dịch được xác nhận.</p></div></section>
        <section class="support-leaderboard"><header><div><span>Top supporters</span><h3>Bảng tri ân</h3></div></header><div data-support-leaderboard><p class="support-empty">Danh sách sẽ xuất hiện sau khi đối soát.</p></div></section>
      </div>

      <section class="support-constellation support-supporter-galaxy support-impact-constellation" data-support-constellation><header><div><p class="section-kicker">SUPPORTER CONSTELLATION</p><h3>Chòm sao người đồng hành</h3><p>Chỉ các khoản đã được xác minh mới tạo thành một ngôi sao. Màu sao theo nhiệm vụ, không theo giá trị khoản ủng hộ.</p></div><div><button type="button" data-supporter-filter="recent">Mới nhất</button><span data-support-constellation-state>Chưa có hoạt động</span></div></header><div class="support-constellation__sky" data-support-constellation-sky><p class="support-empty">Chưa có giao dịch xác minh để tạo chòm sao.</p></div></section>

      <section class="support-impact support-mission-log" data-support-impact><header><div><p class="section-kicker">IMPACT TIMELINE</p><h3>Tiền ủng hộ đã tạo ra điều gì?</h3><p>Mỗi mốc phải liên kết với một phiên bản, workspace hoặc hoạt động đã công bố; không hiển thị kết quả mẫu.</p></div><span data-support-impact-state>Chưa có hoạt động</span></header><div class="support-impact__timeline" data-support-impact-list><p class="support-empty">Chưa có mốc phát triển được công bố. Hệ thống không tự tạo dữ liệu giả.</p></div></section>

      <section class="support-channels" data-support-channels><header><div><p class="section-kicker">WAYS TO HELP</p><h3>Nhiều cách đồng hành</h3><p>Chỉ hiển thị “Sẵn sàng” khi kênh có adapter thật; kênh chưa cấu hình sẽ không tạo giao dịch giả.</p></div></header><div class="support-channels__grid" data-support-channels-list></div><form class="support-contribution-form" data-support-contribution-form hidden><span class="support-field-label">Gửi đóng góp cộng đồng</span><div class="support-form-grid"><label><span>Loại</span><select data-contribution-type>${CONTRIBUTION_TYPES.map(([id, label]) => `<option value="${id}">${label}</option>`).join("")}</select></label><label><span>Tiêu đề</span><input data-contribution-title maxlength="160" placeholder="Ví dụ: Bản dịch HH English"></label></div><label><span>Mô tả</span><textarea data-contribution-details rows="3" maxlength="1200" placeholder="Bạn muốn đóng góp điều gì?"></textarea></label><label><span>Liên kết (không bắt buộc)</span><input data-contribution-link type="url" maxlength="1200" placeholder="https://..."></label><button class="support-primary" type="submit">Gửi đóng góp</button><p class="support-form-status" data-contribution-status>Đăng nhập để gửi đóng góp bền vững.</p></form></section>

      <section class="support-history" data-support-history>
        <header><div><span>Lịch sử của tôi</span><h3>Giao dịch và hoàn tiền</h3></div><button type="button" data-support-history-refresh>Làm mới</button></header>
        <p>Chỉ tài khoản đang đăng nhập xem được lịch sử của chính mình. Trạng thái hoàn tiền chỉ đổi sau khi adapter phía máy chủ xác nhận.</p>
        <div data-support-wallet-summary></div><div data-support-history-list><p class="support-empty">Đăng nhập để đồng bộ lịch sử ủng hộ.</p></div><div class="support-wallet-actions"><button type="button" data-wallet-export>Xuất dữ liệu của tôi</button><button type="button" data-wallet-preferences>Quyền lợi Supporter</button><button type="button" data-wallet-support>Gửi yêu cầu hỗ trợ</button></div><div class="support-wallet-preferences" data-wallet-preferences-panel hidden></div>
      </section>

      <section class="support-transparency" data-support-transparency><div><p class="section-kicker">TRANSPARENCY OBSERVATORY</p><h3>Nguồn lực được sử dụng như thế nào?</h3><p>Tổng thu chỉ tính giao dịch verified. Chi phí chỉ tính các impact đã được Owner công bố. Nếu provider chưa trả phí, hệ thống ghi “Chưa có dữ liệu phí”.</p><div class="support-transparency__actions"><button type="button" data-transparency-csv>Xuất CSV</button><button type="button" data-transparency-pdf>Xuất báo cáo PDF</button></div></div><div class="support-transparency__real" data-support-transparency-real><p class="support-empty">Đang tải số liệu backend…</p></div></section>

      <section class="support-faq"><h3>Câu hỏi thường gặp</h3><details><summary>Khi nào khoản ủng hộ xuất hiện công khai?</summary><p>Khoản ủng hộ xuất hiện sau khi webhook payOS xác minh chữ ký, mã đơn và số tiền thành công.</p></details><details><summary>Khi nào tôi nhận được email cảm ơn?</summary><p>Ngay sau khi máy chủ xác minh đúng giao dịch. Email có mã xác nhận riêng; webhook gọi lại nhiều lần cũng không gửi trùng.</p></details><details><summary>Tại sao số tiền chưa được cộng ngay?</summary><p>Hệ thống chỉ cộng giao dịch có chữ ký hợp lệ, đúng mã đơn và đúng số tiền. Điều này ngăn số liệu giả và giao dịch bị tính hai lần.</p></details><details><summary>Thông tin nào được công khai?</summary><p>Chỉ tên hiển thị, số tiền và lời nhắn. Email, tài khoản đăng nhập và thông tin đối soát không bao giờ xuất hiện trên bảng công khai.</p></details><details><summary>Tôi có thể ủng hộ ẩn danh không?</summary><p>Có. Chọn “Ủng hộ ẩn danh” trước khi tạo giao dịch.</p></details></section>

      <section class="support-admin" data-support-admin hidden>
        <header><div><p class="section-kicker">DONATION MISSION CONTROL</p><h3>Trung tâm đối soát và tác động</h3><p data-support-admin-role>Đang kiểm tra quyền quản trị phía máy chủ.</p></div><div class="support-admin-actions"><button type="button" data-support-admin-refresh>Làm mới</button><button type="button" data-admin-export-csv>Xuất CSV</button></div></header>
        <div class="support-admin-toolbar"><label>Trạng thái<select data-support-admin-filter><option value="all">Tất cả</option><option value="submitted">Đã báo chuyển</option><option value="pending">Chờ chuyển</option><option value="verified">Đã xác nhận</option><option value="refunded">Đã hoàn tiền</option><option value="rejected">Từ chối</option><option value="payment_error">Lỗi thanh toán</option></select></label><label>Provider<select data-support-admin-provider-filter><option value="all">Tất cả provider</option><option value="payos_vietqr">payOS / VietQR</option></select></label><span data-support-admin-count>0 giao dịch</span></div>
        <div class="support-admin-list" data-support-admin-list></div>
        <div class="support-admin-subgrid"><section><header><div><span>FUNDING MISSION</span><h4>Cấu hình mục tiêu và trạng thái</h4></div></header><div data-support-admin-missions><p class="support-empty">Chỉ Owner được thay đổi.</p></div></section><section><header><div><span>IMPACT PUBLISHER</span><h4>Công bố mốc sử dụng thật</h4></div></header><form data-support-impact-form><div class="support-form-grid"><label>Nhiệm vụ<select data-impact-mission>${MISSION_DEFINITIONS.map(mission => `<option value="${mission.id}">${mission.label}</option>`).join("")}</select></label><label>Loại<select data-impact-type><option value="release">Phát hành</option><option value="infrastructure">Hạ tầng</option><option value="fix">Sửa lỗi</option><option value="lesson">Bài học</option><option value="feature">Tính năng</option></select></label></div><label>Tiêu đề<input data-impact-title maxlength="160" required></label><label>Mô tả<textarea data-impact-description maxlength="500" rows="2" required></textarea></label><div class="support-form-grid"><label>Số tiền đã dùng<input type="number" min="0" step="1000" data-impact-amount-used value="0"></label><label>Liên kết release/workspace<input type="url" data-impact-link maxlength="1200"></label></div><button class="support-primary" type="submit">Công bố impact</button><p class="support-form-status" data-impact-status>Chỉ dữ liệu đã công bố mới được tính vào minh bạch.</p></form></section></div>
        <section class="support-admin-contributions"><header><div><span>COMMUNITY CONTRIBUTIONS</span><h4>Asset, bản dịch, bug và mã nguồn</h4></div></header><div data-support-contribution-admin-list><p class="support-empty">Chưa có đóng góp.</p></div></section>
        <section class="support-admin-audit"><header><div><span>IMMUTABLE AUDIT</span><h4>Chuỗi đối soát bất biến</h4></div></header><div data-support-audit-list><p class="support-empty">Chưa có hành động quản trị.</p></div></section>
      </section>
    </section>`;
  }

  async function mount(container, options = {}) {
    clearInterval(refreshTimer);
    clearInterval(paymentPollTimer);
    clearInterval(paymentCountdownTimer);
    const apiBase = String(options.apiBase || "").replace(/\/$/, "");
    const user = getUser();
    container.innerHTML = markup(user);
    const page = container.querySelector("[data-support-page]");
    let currentDonation = null;
    let adminItems = [];
    let publicData = null;
    let walletData = null;
    let adminData = null;
    let selectedMissionId = "infrastructure";
    let payOSAvailable = false;
    let flowStage = "details";
    let checkoutController = null;
    const checkoutAdapter = options.checkoutAdapter || createPayOSCheckoutAdapter(window);

    const api = async (path = "", request = {}) => {
      if (!apiBase) throw new Error("Backend donate chưa được cấu hình.");
      const token = window.HHAuthSession?.token?.() || "";
      const response = await fetch(`${apiBase}/api/donations${path}`, {
        method: request.method || "GET", cache: "no-store",
        headers: { ...(request.body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: request.body ? JSON.stringify(request.body) : undefined
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Không thể kết nối hệ thống ủng hộ.");
      return data;
    };
    const setFormStatus = (message, type = "") => { const node = page.querySelector("[data-support-form-status]"); node.textContent = message; node.dataset.state = type; };
    const downloadReceiptPdf = async donation => {
      if (!donation?.reference || donation.status !== "verified") return;
      await loadScriptOnce("vendor/pdf-lib.min.js?v=1.17.1", () => Boolean(window.PDFLib));
      if (!window.PDFLib?.PDFDocument) throw new Error("Thiết bị chưa tải được bộ xuất PDF.");
      const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
      const pdf = await PDFDocument.create();
      const pagePdf = pdf.addPage([595.28, 841.89]);
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const mission = missionById(donation.missionId);
      const lines = [
        "HH PLATFORM · XAC NHAN UNG HO",
        "",
        `Ma xac nhan: ${pdfText(donation.receipt?.receiptId || `HH-RCP-${donation.reference}`)}`,
        `Ma giao dich: ${pdfText(donation.reference)}`,
        `So tien: ${pdfText(money(donation.amount))}`,
        `Nhiem vu: ${pdfText(mission.label)}`,
        `Xac nhan luc: ${pdfText(dateText(donation.verifiedAt))}`,
        "",
        "Cam on ban da dong hanh cung HH Platform.",
        "Xac nhan nay khong phai hoa don tai chinh.",
        "",
        "Giao dich chi duoc ghi nhan sau khi backend xac minh webhook provider."
      ];
      lines.forEach((line, index) => pagePdf.drawText(line, { x: 54, y: 780 - index * 28, size: index === 0 ? 17 : 11, font, color: index === 0 ? rgb(0.1, 0.55, 0.63) : rgb(0.12, 0.16, 0.2) }));
      downloadBlob(`xac-nhan-ung-ho-${donation.reference}.pdf`, new Blob([await pdf.save()], { type: "application/pdf" }));
    };
    const downloadTransparencyPdf = async () => {
      if (!publicData?.transparency) return;
      await loadScriptOnce("vendor/pdf-lib.min.js?v=1.17.1", () => Boolean(window.PDFLib));
      const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
      const pdf = await PDFDocument.create();
      const pdfPage = pdf.addPage([595.28, 841.89]);
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const month = publicData.transparency.month || {};
      const lines = [
        "HH PLATFORM · TRANSPARENCY OBSERVATORY",
        "",
        `Thu thang nay: ${pdfText(money(month.income))}`,
        `Da su dung: ${pdfText(money(month.spent))}`,
        `Phi provider: ${month.feesTracked ? pdfText(money(month.fees)) : "Chua co du lieu"}`,
        `Chuyen ky sau: ${pdfText(money(month.carry))}`,
        "",
        "Cac moc impact duoc cong bo:",
        ...(publicData.transparency.impacts || []).slice(0, 18).map(item => `- ${pdfText(item.title)} · ${pdfText(missionById(item.missionId).shortLabel)}`),
        "",
        "Bao cao nay chi su dung giao dich verified va impact published.",
        "Khong phai bao cao tai chinh kiem toan."
      ];
      lines.forEach((line, index) => pdfPage.drawText(line, { x: 46, y: 790 - index * 25, size: index === 0 ? 15 : 10, font, color: index === 0 ? rgb(0.1, 0.55, 0.63) : rgb(0.12, 0.16, 0.2) }));
      downloadBlob(`hh-transparency-${month.month || "report"}.pdf`, new Blob([await pdf.save()], { type: "application/pdf" }));
    };
    const createSupportCard = async donation => {
      if (!donation?.reference || donation.status !== "verified") return null;
      if (!window.document?.createElement) return null;
      const canvas = document.createElement("canvas");
      canvas.width = 1200; canvas.height = 630;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, "#07131f"); gradient.addColorStop(.52, "#1b1238"); gradient.addColorStop(1, "#35112e");
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "#65ebff"; ctx.lineWidth = 4; ctx.strokeRect(26, 26, canvas.width - 52, canvas.height - 52);
      ctx.fillStyle = "#fff"; ctx.font = "900 48px Segoe UI"; ctx.fillText("HH SUPPORTER CONSTELLATION", 72, 130);
      ctx.fillStyle = "#65ebff"; ctx.font = "700 28px Segoe UI"; ctx.fillText("Cảm ơn bạn đã tiếp năng lượng cho", 72, 190);
      ctx.fillStyle = "#ffb5e9"; ctx.font = "900 44px Segoe UI"; ctx.fillText("HH Platform", 72, 245);
      ctx.fillStyle = "#e6faff"; ctx.font = "600 28px Segoe UI"; ctx.fillText(`Nhiệm vụ: ${missionById(donation.missionId).label}`, 72, 330);
      ctx.fillText(`Mã xác nhận: ${donation.receipt?.receiptId || donation.reference}`, 72, 380);
      ctx.fillStyle = "#91a9bb"; ctx.font = "500 22px Segoe UI"; ctx.fillText("Xác nhận ủng hộ · không phải hóa đơn tài chính", 72, 520);
      return new Promise(resolve => canvas.toBlob(resolve, "image/png"));
    };
    const shareSupportCard = async donation => {
      const blob = await createSupportCard(donation);
      if (!blob) return;
      if (navigator.share && typeof File === "function") {
        const file = new File([blob], `hh-supporter-${donation.reference}.png`, { type: "image/png" });
        if (!navigator.canShare || navigator.canShare({ files: [file] })) {
          await navigator.share({ title: "HH Supporter", text: "Mình vừa tiếp năng lượng cho HH Platform.", files: [file] });
          return;
        }
      }
      downloadBlob(`hh-supporter-${donation.reference}.png`, blob);
    };
    const selectedAmount = () => Math.round(Number(page.querySelector("[data-support-amount]").value) || 0);
    const updateAmount = amount => { page.querySelector("[data-support-amount]").value = amount; page.querySelectorAll("[data-support-preset]").forEach(button => button.classList.toggle("active", Number(button.dataset.supportPreset) === Number(amount))); };
    const pendingKey = STORAGE_KEY;
    const submitButton = page.querySelector("[data-support-form] button[type=submit]");
    const stopPaymentPolling = () => { clearInterval(paymentPollTimer); paymentPollTimer = 0; };
    const stopPaymentCountdown = () => { clearInterval(paymentCountdownTimer); paymentCountdownTimer = 0; };
    const updatePaymentSummary = () => {
      const amount = page.querySelector("[data-support-payos-amount]");
      const reference = page.querySelector("[data-support-payos-reference]");
      const countdown = page.querySelector("[data-support-payos-countdown]");
      if (amount) amount.textContent = currentDonation?.amount ? money(currentDonation.amount) : "--";
      if (reference) reference.textContent = currentDonation?.reference || "--";
      if (!countdown) return;
      const remaining = Math.max(0, Number(currentDonation?.pollUntil || 0) - Date.now());
      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor(remaining % 60000 / 1000);
      countdown.textContent = currentDonation?.pollUntil ? `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}` : "30:00";
      countdown.classList.toggle("is-expired", Boolean(currentDonation?.pollUntil) && remaining <= 0);
    };
    const startPaymentCountdown = () => {
      stopPaymentCountdown();
      updatePaymentSummary();
      paymentCountdownTimer = window.setInterval(() => {
        if (!document.contains(page) || flowStage !== "payment") return stopPaymentCountdown();
        updatePaymentSummary();
      }, 1000);
    };
    const closeEmbeddedCheckout = () => {
      try { checkoutController?.exit?.(); } catch { /* payOS may already have closed the embedded frame. */ }
      checkoutController = null;
      const embed = page.querySelector("[data-support-payos-embed]");
      if (embed) {
        embed.hidden = false;
        embed.classList.remove("is-loaded");
        embed.innerHTML = '<div class="support-payos-loading"><i></i><strong>Đang tải VietQR bảo mật</strong><span>Vui lòng giữ trang này mở trong vài giây.</span></div>';
      }
      const direct = page.querySelector("[data-support-payos-direct]");
      const image = page.querySelector("[data-support-payos-qr-image]");
      if (direct) direct.hidden = true;
      if (image) image.removeAttribute("src");
    };
    const showDirectQr = qrImage => {
      closeEmbeddedCheckout();
      const direct = page.querySelector("[data-support-payos-direct]");
      const embed = page.querySelector("[data-support-payos-embed]");
      const image = page.querySelector("[data-support-payos-qr-image]");
      if (!direct || !embed || !image || !String(qrImage || "").startsWith("data:image/")) return false;
      image.src = qrImage;
      direct.hidden = false;
      embed.hidden = true;
      return true;
    };
    const rememberPending = donation => {
      const safe = normalizePending(donation);
      try { if (safe) sessionStorage.setItem(pendingKey, JSON.stringify(safe)); } catch { /* Storage may be unavailable in private mode. */ }
    };
    const forgetPending = () => {
      try { sessionStorage.removeItem(pendingKey); sessionStorage.removeItem(LEGACY_STORAGE_KEY); } catch { /* Storage may be unavailable in private mode. */ }
    };
    const setJourney = (stage = "details", receiptStatus = "") => {
      const stages = ["details", "payment", "verify", "email"];
      const activeIndex = Math.max(0, stages.indexOf(stage));
      page.querySelectorAll("[data-support-step]").forEach(node => {
        const index = stages.indexOf(node.dataset.supportStep);
        node.classList.toggle("is-done", index < activeIndex || (stage === "email" && receiptStatus === "sent" && index === activeIndex));
        node.classList.toggle("is-current", index === activeIndex && !(stage === "email" && receiptStatus === "sent"));
      });
      const labels = { details: "Sẵn sàng", payment: "Chờ thanh toán", verify: "Đang xác minh", email: receiptStatus === "sent" ? "Đã gửi email" : "Đang gửi email" };
      page.querySelector("[data-support-journey-label]").textContent = labels[stage] || labels.details;
    };
    const showStage = (stage = "details", scroll = true) => {
      flowStage = ["details", "payment", "verify", "email"].includes(stage) ? stage : "details";
      page.querySelectorAll("[data-support-stage-panel]").forEach(panel => { panel.hidden = panel.dataset.supportStagePanel !== flowStage; });
      setJourney(flowStage);
      const activePanel = page.querySelector(`[data-support-stage-panel="${flowStage}"]`);
      if (activePanel) {
        activePanel.classList.remove("is-entering");
        requestAnimationFrame(() => activePanel.classList.add("is-entering"));
        if (scroll) {
          activePanel.scrollIntoView({ behavior: "auto", block: "start" });
          const scrollRoot = activePanel.closest(".app-main");
          if (scrollRoot) scrollRoot.scrollTop = Math.max(0, scrollRoot.scrollTop - 128);
        }
      }
    };
    const openEmbeddedCheckout = async checkoutUrl => {
      closeEmbeddedCheckout();
      checkoutController = await checkoutAdapter.open({
        checkoutUrl,
        onProviderAccepted: async () => {
          showStage("verify");
          page.querySelector("[data-support-verify-title]").textContent = "payOS đã chuyển về bước xác minh";
          page.querySelector("[data-support-verify-status]").textContent = "Chưa báo thành công: đang chờ backend nhận webhook có chữ ký hợp lệ và đối chiếu số tiền…";
          await checkCurrentDonation(true);
          beginPaymentPolling();
        },
        onCancel: () => {
          stopPaymentPolling();
          stopPaymentCountdown();
          forgetPending();
          currentDonation = null;
          closeEmbeddedCheckout();
          showStage("details");
          setFormStatus("Bạn đã hủy giao dịch. Có thể chỉnh thông tin và tạo VietQR mới.", "error");
        },
        onExit: () => {
          if (currentDonation?.status !== "verified") setFormStatus("Giao diện VietQR đã đóng. Bấm tiếp tục để tạo lại nếu cần.");
        }
      });
      const embed = page.querySelector("[data-support-payos-embed]");
      const markCheckoutReady = () => {
        if (!embed?.querySelector("iframe")) return false;
        embed.classList.add("is-loaded");
        return true;
      };
      const observer = new MutationObserver(() => { if (markCheckoutReady()) observer.disconnect(); });
      observer.observe(embed, { childList: true, subtree: true });
      if (!markCheckoutReady()) setTimeout(() => { markCheckoutReady(); observer.disconnect(); }, 8000);
    };
    const renderReceipt = donation => {
      const receipt = donation?.receipt || {};
      const panel = page.querySelector("[data-support-receipt]");
      if (donation?.status !== "verified") { panel.hidden = true; return; }
      showStage("email");
      const status = receipt.status || "pending";
      panel.dataset.state = status;
      page.querySelector("[data-support-receipt-id]").textContent = receipt.receiptId || `HH-RCP-${donation.reference}`;
      page.querySelector("[data-support-receipt-amount]").textContent = money(donation.amount);
      page.querySelector("[data-support-receipt-email]").textContent = receipt.recipient || "Email đã cung cấp";
      page.querySelector("[data-support-receipt-time]").textContent = dateText(donation.verifiedAt);
      const messages = {
        sent: `Email cảm ơn đã được gửi tới ${receipt.recipient || "địa chỉ bạn cung cấp"}.`,
        sending: "Giao dịch đã xác minh. Máy chủ đang gửi email cảm ơn.",
        failed: "Giao dịch đã xác minh nhưng email chưa gửi thành công. Quản trị viên có thể thử lại.",
        not_configured: "Giao dịch đã xác minh. Kênh email đang chờ quản trị viên kích hoạt.",
        missing_email: "Giao dịch đã xác minh nhưng chưa có email hợp lệ để gửi lời cảm ơn.",
        pending: "Giao dịch đã xác minh. Email cảm ơn đang được xếp hàng."
      };
      page.querySelector("[data-support-receipt-status]").textContent = messages[status] || messages.pending;
      setJourney("email", status);
    };
    const checkCurrentDonation = async (quiet = false) => {
      if (!currentDonation?.id || !currentDonation?.reference) return;
      const verifyStatus = page.querySelector("[data-support-verify-status]");
      const checkButton = page.querySelector("[data-support-payos-check]");
      try {
        const data = await api(`?id=${encodeURIComponent(currentDonation.id)}&reference=${encodeURIComponent(currentDonation.reference)}`);
        currentDonation = { ...currentDonation, ...data.donation };
        if (data.donation.status === "verified") {
          stopPaymentCountdown();
          closeEmbeddedCheckout();
          checkButton.disabled = true;
          checkButton.textContent = "Đã thanh toán";
          renderReceipt(currentDonation);
          const receiptSent = currentDonation.receipt?.status === "sent";
          if (["sent", "failed", "not_configured", "missing_email"].includes(currentDonation.receipt?.status)) {
            stopPaymentPolling();
            forgetPending();
          }
          setFormStatus(receiptSent ? "Thanh toán thành công. Email cảm ơn và mã xác nhận đã được gửi." : "Thanh toán thành công. Hệ thống đang hoàn tất email cảm ơn.", "success");
          await loadPublic();
          return;
        }
        setJourney(flowStage === "verify" ? "verify" : "payment");
        verifyStatus.textContent = `Giao dịch ${currentDonation.reference} đang chờ ngân hàng xác nhận. Trang sẽ tự kiểm tra sau mỗi 5 giây.`;
        if (!quiet) setFormStatus("Chưa nhận được xác nhận thanh toán. Hệ thống sẽ tiếp tục kiểm tra tự động.");
      } catch (error) {
        if (!quiet) setFormStatus(error.message, "error");
      }
    };
    const beginPaymentPolling = () => {
      stopPaymentPolling();
      startPaymentCountdown();
      checkCurrentDonation(true);
      paymentPollTimer = window.setInterval(() => {
        if (!document.contains(page)) return stopPaymentPolling();
        if (currentDonation?.pollUntil && Date.now() > Number(currentDonation.pollUntil)) {
          stopPaymentPolling();
          stopPaymentCountdown();
          if (flowStage === "payment") page.querySelector("[data-support-payos-status]").textContent = "VietQR đã hết thời gian chờ. Hãy quay lại và tạo giao dịch mới.";
          page.querySelector("[data-support-verify-status]").textContent = "Giao dịch đã hết thời gian chờ. Hãy tạo VietQR mới nếu chưa thanh toán.";
          return;
        }
        if (!document.hidden) checkCurrentDonation(true);
      }, 5000);
    };

    const renderMissionMap = data => {
      const missions = Array.isArray(data?.missions) ? data.missions : [];
      const list = page.querySelector("[data-support-mission-list]");
      const sync = page.querySelector("[data-support-mission-sync]");
      if (sync) sync.textContent = missions.some(item => Number(item.verified) > 0) ? `Đồng bộ lúc ${dateText(data.checkedAt)}` : "Chưa có hoạt động";
      if (!missions.length) {
        list.innerHTML = '<p class="support-empty">Backend chưa cung cấp Funding Mission.</p>';
        return;
      }
      list.innerHTML = missions.map((mission) => {
        const statusLabel = mission.status === "completed" ? "Đã hoàn thành" : mission.status === "paused" ? "Tạm dừng" : mission.verified || mission.used ? "Đang thực hiện" : "Chưa có hoạt động";
        const result = mission.result || "Chưa có kết quả được công bố.";
        return `<article class="support-mission-card ${mission.id === selectedMissionId ? "is-selected" : ""}" data-support-mission-card="${escapeHtml(mission.id)}" style="--mission-color:${escapeHtml(mission.color)}"><button type="button" data-support-mission-map-choice="${escapeHtml(mission.id)}" aria-label="Chọn ${escapeHtml(mission.label)}"><i>${escapeHtml(mission.icon)}</i></button><div><header><strong>${escapeHtml(mission.label)}</strong><span>${escapeHtml(statusLabel)}</span></header><p>${escapeHtml(result)}</p><div class="support-mission-card__meter"><b style="width:${Math.min(100, Number(mission.percent) || 0)}%"></b></div><footer><small>${money(mission.verified)} đã xác minh / ${money(mission.goal)}</small><small>${Number(mission.supporters || 0)} người · đã dùng ${money(mission.used)}</small></footer></div></article>`;
      }).join("");
    };

    const renderCore = data => {
      const stats = data?.stats || {};
      const signals = data?.signals || {};
      const monthGoal = Number(data?.goal) || 10000000;
      const monthTotal = Number(stats.monthlyTotal) || 0;
      const rays = (data?.recent || []).slice(0, 12);
      const rayRoot = page.querySelector("[data-support-core-rays]");
      if (rayRoot) rayRoot.innerHTML = rays.length ? rays.map((item, index) => {
        const angle = Math.round(index / Math.max(1, rays.length) * 360);
        const mission = missionById(item.missionId);
        return `<b class="support-core-ray" title="${escapeHtml(mission.label)} · ${escapeHtml(money(item.amount))}" style="--ray-angle:${angle}deg;--ray-color:${mission.color}"></b>`;
      }).join("") : "";
      const month = page.querySelector("[data-support-core-month]");
      if (month) month.textContent = `${money(monthTotal)} / ${money(monthGoal)}`;
      const supporters = page.querySelector("[data-support-core-supporters]");
      if (supporters) supporters.textContent = Number(stats.monthlyCount || 0);
      const synced = page.querySelector("[data-support-core-synced]");
      if (synced) synced.textContent = `Backend sync · ${dateText(data.checkedAt)}`;
      ["pending", "verified", "failed"].forEach((key) => {
        const node = page.querySelector(`[data-support-core-signal="${key}"] b`);
        if (node) node.textContent = Number(signals[key] || 0);
      });
      const sun = page.querySelector("[data-support-core-sun]");
      if (sun) sun.setAttribute("aria-label", `Developer Core: ${money(monthTotal)} trong tháng, ${Number(stats.monthlyCount || 0)} người ủng hộ`);
    };

    const renderConstellation = data => {
      const sky = page.querySelector("[data-support-constellation-sky]");
      const items = Array.isArray(data?.recent) ? data.recent : [];
      const state = page.querySelector("[data-support-constellation-state]");
      if (state) state.textContent = items.length ? `${items.length} sao từ giao dịch đã xác minh` : "Chưa có hoạt động";
      if (!items.length) {
        sky.innerHTML = '<p class="support-empty">Chưa có giao dịch xác minh để tạo chòm sao.</p>';
        return;
      }
      sky.innerHTML = items.map((item, index) => {
        const seed = [...String(item.reference || index)].reduce((total, char) => total + char.charCodeAt(0), 0);
        const left = 7 + (seed * 17) % 86;
        const top = 12 + (seed * 31) % 72;
        const size = 9 + (seed % 12);
        const mission = missionById(item.missionId);
        return `<button type="button" class="support-star" data-support-star="${escapeHtml(item.id)}" title="${escapeHtml(item.name)} · ${escapeHtml(dateText(item.verifiedAt))}" style="--star-left:${left}%;--star-top:${top}%;--star-size:${size}px;--star-color:${mission.color}" aria-label="${escapeHtml(item.name)} · ${escapeHtml(mission.label)}"><i></i><span>${escapeHtml(item.name)} · ${escapeHtml(mission.shortLabel)} · ${escapeHtml(dateText(item.verifiedAt))}</span></button>`;
      }).join("");
    };

    const renderImpact = data => {
      const list = page.querySelector("[data-support-impact-list]");
      const items = Array.isArray(data?.transparency?.impacts) ? data.transparency.impacts : [];
      const state = page.querySelector("[data-support-impact-state]");
      if (state) state.textContent = items.length ? `${items.length} mốc đã công bố` : "Chưa có hoạt động";
      list.innerHTML = items.length ? items.slice(0, 12).map((item) => {
        const mission = missionById(item.missionId);
        const link = item.link ? `<a href="${escapeHtml(item.link)}" data-support-impact-open> Mở liên kết →</a>` : "";
        return `<article style="--impact-color:${mission.color}"><i></i><div><header><span>${escapeHtml(mission.shortLabel)} · ${escapeHtml(item.type)}</span><time>${escapeHtml(dateText(item.occurredAt))}</time></header><h4>${escapeHtml(item.title)}</h4><p>${escapeHtml(item.description)}</p><small>${Number(item.amountUsed || 0) ? `Đã ghi nhận sử dụng ${escapeHtml(money(item.amountUsed))}` : "Mốc hoạt động, chưa có chi phí công bố."}${link}</small></div></article>`;
      }).join("") : '<p class="support-empty">Chưa có mốc phát triển được công bố.</p>';
    };

    const renderTransparency = data => {
      const root = page.querySelector("[data-support-transparency-real]");
      const month = data?.transparency?.month || {};
      const series = data?.transparency?.series || [];
      root.innerHTML = `<div class="support-transparency__metrics"><article><span>Thu tháng này</span><strong>${escapeHtml(money(month.income))}</strong><small>${Number(month.count || 0)} giao dịch verified</small></article><article><span>Đã sử dụng</span><strong>${escapeHtml(money(month.spent))}</strong><small>Impact đã công bố</small></article><article><span>Phí provider</span><strong>${month.feesTracked ? escapeHtml(money(month.fees)) : "Chưa có dữ liệu"}</strong><small>${month.feesTracked ? "Lấy từ provider" : "Provider chưa cung cấp phí"}</small></article><article><span>Chuyển kỳ sau</span><strong>${escapeHtml(money(month.carry))}</strong><small>Thu − dùng − phí</small></article></div><div class="support-transparency__chart" aria-label="Biểu đồ thu chi sáu tháng">${series.map(item => { const max = Math.max(1, ...series.map(row => Math.max(Number(row.income || 0), Number(row.spent || 0)))); return `<div><i style="--income:${Math.round(Number(item.income || 0) / max * 100)}%;--spent:${Math.round(Number(item.spent || 0) / max * 100)}%"><b></b><em></em></i><small>${escapeHtml(item.month)}</small></div>`; }).join("")}</div>`;
    };

    const renderChannels = data => {
      const providers = data?.paymentProviders || {};
      const loggedIn = Boolean(getUser().email);
      const channels = [
        { id: "one-time", label: "Ủng hộ một lần", description: providers.payos ? "VietQR payOS và webhook xác minh thật." : "payOS chưa cấu hình.", state: providers.payos ? "Sẵn sàng" : "Chưa cấu hình", tone: providers.payos ? "ready" : "pending" },
        { id: "recurring", label: "Hỗ trợ hàng tháng", description: providers.recurring ? "Provider trả về checkout định kỳ thật." : "Chưa có provider định kỳ được cấu hình.", state: providers.recurring ? "Sẵn sàng" : "Chưa khả dụng", tone: providers.recurring ? "ready" : "pending", url: providers.recurringCheckoutUrl },
        { id: "feature", label: "Tài trợ tính năng", description: "Chọn Funding Mission ở bước thanh toán.", state: providers.payos ? "Sẵn sàng" : "Chưa cấu hình", tone: providers.payos ? "ready" : "pending" },
        { id: "community", label: "Đóng góp asset / code", description: loggedIn ? "Gửi asset, bản dịch, bug, mã nguồn hoặc ý tưởng." : "Đăng nhập để lưu đóng góp bền vững.", state: loggedIn ? "Sẵn sàng" : "Cần đăng nhập", tone: loggedIn ? "ready" : "pending" }
      ];
      page.querySelector("[data-support-channels-list]").innerHTML = channels.map(channel => `<button type="button" class="support-channel-card ${channel.tone}" data-support-channel="${channel.id}" ${channel.url ? `data-support-channel-url="${escapeHtml(channel.url)}"` : ""}><i>${channel.id === "one-time" ? "₫" : channel.id === "recurring" ? "↻" : channel.id === "feature" ? "✦" : "＋"}</i><span><strong>${escapeHtml(channel.label)}</strong><small>${escapeHtml(channel.description)}</small></span><b>${escapeHtml(channel.state)}</b></button>`).join("");
      page.querySelector("[data-support-contribution-form]").hidden = !loggedIn;
    };
    const chooseMission = missionId => {
      selectedMissionId = missionById(missionId).id;
      const hidden = page.querySelector("[data-support-mission]");
      if (hidden) hidden.value = selectedMissionId;
      page.querySelectorAll("[data-support-mission-choice], [data-support-mission-card]").forEach((node) => {
        const id = node.dataset.supportMissionChoice || node.dataset.supportMissionCard;
        node.classList.toggle("is-selected", id === selectedMissionId);
      });
      const mission = (publicData?.missions || []).find(item => item.id === selectedMissionId) || missionById(selectedMissionId);
      const note = page.querySelector("[data-support-mission-note]");
      if (note) note.textContent = `${mission.label} · ${mission.verified ? `${money(mission.verified)} đã xác minh` : "Chưa có hoạt động"}`;
    };

    const renderPublic = data => {
      publicData = data;
      const stats = data.stats || {}, goal = Number(data.goal) || 10000000, total = Number(stats.total) || 0, percent = Math.min(100, total / goal * 100);
      page.querySelector("[data-support-total]").textContent = money(total);
      page.querySelector("[data-support-total-card]").textContent = money(total);
      page.querySelector("[data-support-goal]").textContent = money(goal);
      page.querySelector("[data-support-count]").textContent = stats.count || 0;
      page.querySelector("[data-support-count-card]").textContent = stats.count || 0;
      page.querySelector("[data-support-average]").textContent = money(stats.average || 0);
      page.querySelector("[data-support-month]").textContent = money(stats.monthlyTotal || 0);
      page.querySelector("[data-support-progress]").style.width = `${percent}%`;
      page.querySelector("[data-support-progress-label]").textContent = `${percent.toFixed(percent >= 10 ? 0 : 1)}%`;
      page.querySelector("[data-support-checked]").textContent = `Đồng bộ lúc ${dateText(data.checkedAt)}`;
      page.querySelector("[data-support-wall]").innerHTML = data.recent?.length ? data.recent.map(item => `<article><div><span>${escapeHtml(item.name).split(/\s+/).slice(-2).map(part => part[0]).join("").toUpperCase()}</span><div><strong>${escapeHtml(item.name)}</strong><small>${dateText(item.verifiedAt || item.createdAt)}</small></div><b>${money(item.amount)}</b></div>${item.message ? `<p>${escapeHtml(item.message)}</p>` : ""}</article>`).join("") : '<p class="support-empty">Chưa có giao dịch được xác nhận.</p>';
      page.querySelector("[data-support-leaderboard]").innerHTML = data.leaderboard?.length ? data.leaderboard.map((item, index) => `<article><span>${index + 1}</span><div><strong>${escapeHtml(item.name)}</strong><small>${item.donations} lần ủng hộ</small></div><b>${money(item.amount)}</b></article>`).join("") : '<p class="support-empty">Danh sách sẽ xuất hiện sau khi đối soát.</p>';
      renderCore(data);
      renderMissionMap(data);
      renderConstellation(data);
      renderImpact(data);
      renderTransparency(data);
      renderChannels(data);
      chooseMission(selectedMissionId);
      payOSAvailable = Boolean(data.paymentProviders?.payos);
      const receiptEmailAvailable = Boolean(data.paymentProviders?.receiptEmail);
      page.querySelector("[data-support-payos-availability]").textContent = payOSAvailable ? "Sẵn sàng · Tự xác nhận qua webhook" : "Kênh payOS tạm thời chưa sẵn sàng";
      page.querySelector("[data-support-provider-state]").classList.toggle("is-online", payOSAvailable);
      submitButton.disabled = !payOSAvailable;
      const emailTrust = page.querySelector("[data-support-email-trust]");
      emailTrust.textContent = receiptEmailAvailable ? "✓ Email cảm ơn tự động đang bật" : "○ Email cảm ơn chờ cấu hình";
      emailTrust.classList.toggle("is-pending", !receiptEmailAvailable);
      setFormStatus(payOSAvailable ? "Sẵn sàng. Bấm tiếp tục để mở VietQR ngay trong website." : "Không thể tạo VietQR lúc này. Vui lòng thử lại sau.", payOSAvailable ? "success" : "error");
    };

    const loadPublic = async () => { try { renderPublic(await api()); } catch (error) { setFormStatus(error.message, "error"); } };
    const renderWallet = data => {
      walletData = data || null;
      const wallet = data?.wallet || {};
      const summary = page.querySelector("[data-support-wallet-summary]");
      if (summary) summary.innerHTML = `<div class="support-wallet-summary"><div><span>SUPPORTER WALLET</span><strong>${wallet.verifiedSupporter ? "Đã kích hoạt" : "Chưa có giao dịch verified"}</strong><small>${wallet.verifiedSupporter ? `${money(wallet.total)} · ${Number(wallet.count || 0)} giao dịch` : "Quyền lợi chỉ mở sau khi backend xác minh thanh toán."}</small></div><i>${wallet.verifiedSupporter ? "✦" : "○"}</i></div>`;
      const panel = page.querySelector("[data-wallet-preferences-panel]");
      if (panel && data) {
        const preferences = wallet.preferences || {};
        panel.innerHTML = `<h4>Quyền lợi tự chọn</h4><label><input type="checkbox" data-wallet-pref="displayBadge" ${preferences.displayBadge ? "checked" : ""}> Hiện huy hiệu Supporter</label><label><input type="checkbox" data-wallet-pref="creditsOptIn" ${preferences.creditsOptIn ? "checked" : ""}> Cho phép ghi tên trong Credits</label><label><input type="checkbox" data-wallet-pref="supporterTheme" ${preferences.supporterTheme ? "checked" : ""}> Mở theme vũ trụ Supporter</label><label><input type="checkbox" data-wallet-pref="roadmapVoting" ${preferences.roadmapVoting !== false ? "checked" : ""}> Bình chọn roadmap</label><label><input type="checkbox" data-wallet-pref="earlyAccess" ${preferences.earlyAccess ? "checked" : ""}> Nhận quyền xem bản thử nghiệm</label><label><input type="checkbox" data-wallet-pref="developmentReports" ${preferences.developmentReports !== false ? "checked" : ""}> Nhận báo cáo phát triển</label><p>Quyền lợi game chỉ là vật phẩm trang trí, không tăng sát thương, tiền hoặc lợi thế chiến đấu.</p><button class="support-primary" type="button" data-wallet-pref-save>Lưu tùy chọn</button>`;
      }
      return data?.donations || [];
    };
    const renderHistory = data => {
      const items = Array.isArray(data) ? data : renderWallet(data);
      const list = page.querySelector("[data-support-history-list]");
      const labels = { pending: "Chờ thanh toán", submitted: "Chờ đối soát", verified: "Đã xác minh", refunded: "Đã hoàn tiền", rejected: "Từ chối", payment_error: "Lỗi tạo thanh toán" };
      if (items.length) {
        list.innerHTML = items.map(item => {
          const mission = missionById(item.missionId);
          const refundRequested = item.refund?.status === "requested_by_supporter";
          const nextVisibility = item.visibility === "anonymous" ? "public" : "anonymous";
          return `<article data-wallet-donation-id="${escapeHtml(item.id)}"><div><strong>${escapeHtml(item.reference)}</strong><small>${escapeHtml(mission.shortLabel)} · ${dateText(item.createdAt)}</small></div><b>${money(item.amount)}</b><span class="support-status support-status--${escapeHtml(item.status)}">${labels[item.status] || escapeHtml(item.status)}</span><small>Hiển thị: ${item.visibility === "anonymous" ? "Ẩn danh" : item.visibility === "alias" ? `Biệt danh ${escapeHtml(item.donorAlias || "")}` : "Công khai"}</small>${item.refund ? `<small>Hoàn tiền: ${escapeHtml(item.refund.status || "đang chờ provider")}${item.refund.providerReference ? ` · ${escapeHtml(item.refund.providerReference)}` : ""}</small>` : ""}<footer><button type="button" data-wallet-visibility="${nextVisibility}">${nextVisibility === "anonymous" ? "Đặt ẩn danh" : "Đặt công khai"}</button>${item.status === "verified" && !refundRequested && !item.refund ? '<button type="button" data-wallet-refund>Yêu cầu hoàn tiền</button>' : ""}${item.message ? '<button type="button" data-wallet-message-delete>Ẩn lời nhắn</button>' : ""}</footer></article>`;
        }).join("");
        return;
      }
      list.innerHTML = items.length ? items.map(item => `<article><div><strong>${escapeHtml(item.reference)}</strong><small>${dateText(item.createdAt)}</small></div><b>${money(item.amount)}</b><span class="support-status support-status--${escapeHtml(item.status)}">${labels[item.status] || escapeHtml(item.status)}</span>${item.refund ? `<small>Hoàn tiền: ${escapeHtml(item.refund.status || "đang chờ provider")}${item.refund.providerReference ? ` · ${escapeHtml(item.refund.providerReference)}` : ""}</small>` : ""}</article>`).join("") : '<p class="support-empty">Tài khoản này chưa có giao dịch ủng hộ.</p>';
    };
    const loadHistory = async () => {
      try { const data = await api("?history=1"); renderHistory(data); }
      catch { page.querySelector("[data-support-history-list]").innerHTML = '<p class="support-empty">Đăng nhập để đồng bộ lịch sử ủng hộ của chính bạn.</p>'; }
    };
    const renderAdminLegacy = filter => {
      const list = filter && filter !== "all" ? adminItems.filter(item => item.status === filter) : adminItems;
      page.querySelector("[data-support-admin-count]").textContent = `${list.length} giao dịch`;
      const receiptLabels = { sent: "Đã gửi", sending: "Đang gửi", failed: "Gửi lỗi", not_configured: "Chưa cấu hình", missing_email: "Thiếu email", pending: "Đang chờ", waiting_payment: "Chờ thanh toán" };
      page.querySelector("[data-support-admin-list]").innerHTML = list.length ? list.map(item => {
        const receipt = item.receipt || {};
        const lifecycle = donationLifecycle(item);
        const canRetry = item.status === "verified" && receipt.status !== "sent";
        const refundPending = item.status === "verified" && item.refund?.status && item.refund.status !== "confirmed";
        return `<article data-donation-id="${escapeHtml(item.id)}"><header><div><strong>${escapeHtml(item.donorName)}</strong><span>${escapeHtml(item.reference)}</span></div><b>${money(item.amount)}</b></header><p>${escapeHtml(item.message || "Không có lời nhắn")}</p><dl><div><dt>Email</dt><dd>${escapeHtml(item.email || "--")}</dd></div><div><dt>Tạo lúc</dt><dd>${dateText(item.createdAt)}</dd></div><div><dt>Trạng thái</dt><dd><span class="support-status support-status--${escapeHtml(item.status)}">${({ pending: "Chờ chuyển", submitted: "Đã báo chuyển", verified: "Đã xác minh từ backend", refunded: "Đã hoàn tiền", rejected: "Từ chối" })[item.status] || item.status}</span></dd></div><div><dt>Thư cảm ơn</dt><dd><span class="support-status support-status--receipt-${escapeHtml(receipt.status)}">${receiptLabels[receipt.status] || receipt.status || "Đang chờ"}</span></dd></div><div><dt>Hoàn tiền</dt><dd>${escapeHtml(item.refund?.status || "Chưa yêu cầu")}</dd></div></dl><small data-support-reconciliation="${escapeHtml(lifecycle.source)}">Đối soát: ${lifecycle.steps.map((step) => `${step.id}:${step.state}`).join(" · ")}</small>${receipt.lastError ? `<p class="support-admin-error">${escapeHtml(receipt.lastError)}</p>` : ""}<footer>${canRetry ? '<button type="button" data-support-receipt-retry>Gửi lại email</button>' : ""}${item.status === "verified" && !item.refund ? '<button type="button" data-support-refund-request>Yêu cầu đối soát hoàn tiền</button>' : ""}${refundPending ? '<button type="button" data-support-refund-reconcile>Kiểm tra provider</button>' : ""}${["pending","submitted"].includes(item.status) ? '<button type="button" data-support-admin-action="pending">Đưa về chờ</button><button class="danger" type="button" data-support-admin-action="rejected">Từ chối</button>' : ""}</footer></article>`;
      }).join("") : '<p class="support-empty">Không có giao dịch ở trạng thái này.</p>';
    };
    const renderAdmin = (filter, providerFilter = "all") => {
      const list = adminItems.filter(item => (filter && filter !== "all" ? item.status === filter : true)).filter(item => providerFilter && providerFilter !== "all" ? item.paymentMethod === providerFilter : true);
      const capabilities = adminData?.capabilities || {};
      page.querySelector("[data-support-admin-count]").textContent = `${list.length} giao dịch · role ${adminData?.adminRole || "--"}`;
      page.querySelector("[data-support-admin-role]").textContent = `Quyền: ${adminData?.adminRole || "không có"} · ${capabilities.financial ? "được phép đối soát provider" : "chỉ thao tác được cấp phép"}.`;
      page.querySelector("[data-support-admin-list]").innerHTML = list.length ? list.map(item => {
        const receipt = item.receipt || {};
        const mission = missionById(item.missionId);
        const risk = item.risk || {};
        const canRetry = capabilities.operate && item.status === "verified" && receipt.status !== "sent";
        const refundPending = capabilities.financial && item.status === "verified" && item.refund?.status && item.refund.status !== "confirmed";
        const updateAllowed = capabilities.operate && ["pending", "submitted"].includes(item.status);
        return `<article data-donation-id="${escapeHtml(item.id)}"><header><div><strong>${escapeHtml(item.donorName || item.donorAlias || "Supporter")}</strong><span>${escapeHtml(item.reference)} · ${escapeHtml(mission.shortLabel)}</span></div><b>${money(item.amount)}</b></header><p>${escapeHtml(item.message || "Không có lời nhắn")}</p><dl><div><dt>Email</dt><dd>${escapeHtml(item.email || "--")}</dd></div><div><dt>Webhook</dt><dd><span class="support-status support-status--${escapeHtml(risk.webhookState || "waiting")}">${risk.webhookState === "confirmed" ? "Đã xác minh" : risk.webhookState === "delayed" ? "Chậm đối soát" : risk.webhookState === "failed" ? "Lỗi" : "Đang chờ"}</span></dd></div><div><dt>Trạng thái</dt><dd><span class="support-status support-status--${escapeHtml(item.status)}">${({ pending: "Chờ chuyển", submitted: "Đã báo chuyển", verified: "Đã xác minh backend", refunded: "Đã hoàn tiền", rejected: "Từ chối", payment_error: "Lỗi tạo thanh toán" })[item.status] || escapeHtml(item.status)}</span></dd></div><div><dt>Rủi ro</dt><dd>${risk.duplicateCandidate ? '<span class="support-status support-status--risk">Có giao dịch gần giống</span>' : "Không phát hiện"}</dd></div><div><dt>Thư cảm ơn</dt><dd>${escapeHtml(receipt.status || "Đang chờ")}</dd></div><div><dt>Hoàn tiền</dt><dd>${escapeHtml(item.refund?.status || "Chưa yêu cầu")}</dd></div></dl><small>Đối soát: backend-status-only · ${dateText(item.createdAt)}</small><footer>${canRetry ? '<button type="button" data-support-receipt-retry>Gửi lại email</button>' : ""}${capabilities.financial && item.status === "verified" && !item.refund ? '<button type="button" data-support-refund-request>Yêu cầu đối soát hoàn tiền</button>' : ""}${refundPending ? '<button type="button" data-support-refund-reconcile>Kiểm tra provider</button>' : ""}${updateAllowed ? '<button type="button" data-support-admin-action="pending">Đưa về chờ</button><button class="danger" type="button" data-support-admin-action="rejected">Từ chối</button>' : ""}</footer></article>`;
      }).join("") : '<p class="support-empty">Không có giao dịch ở trạng thái này.</p>';
      const missionRoot = page.querySelector("[data-support-admin-missions]");
      if (missionRoot) missionRoot.innerHTML = (publicData?.missions || []).map(mission => `<article class="support-admin-mission-row"><div><strong>${escapeHtml(mission.label)}</strong><small>${money(mission.verified)} / ${money(mission.goal)} · ${escapeHtml(mission.status)}</small></div><button type="button" data-admin-mission-edit="${escapeHtml(mission.id)}">Cập nhật</button></article>`).join("") || '<p class="support-empty">Chưa có Funding Mission.</p>';
      const contributionRoot = page.querySelector("[data-support-contribution-admin-list]");
      if (contributionRoot) contributionRoot.innerHTML = (adminData?.contributions || []).length ? adminData.contributions.map(item => `<article><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.type)} · ${escapeHtml(item.status)} · ${dateText(item.createdAt)}</small></div><p>${escapeHtml(item.details)}</p><footer>${capabilities.operate ? ["received", "in_review", "accepted", "rejected", "completed"].map(status => `<button type="button" data-contribution-admin-status="${status}" data-contribution-id="${escapeHtml(item.id)}">${status}</button>`).join("") : ""}</footer></article>`).join("") : '<p class="support-empty">Chưa có đóng góp.</p>';
      const auditRoot = page.querySelector("[data-support-audit-list]");
      if (auditRoot) auditRoot.innerHTML = (adminData?.audit || []).length ? adminData.audit.slice(0, 30).map(item => `<article><span>${escapeHtml(item.action)}</span><small>${escapeHtml(item.role)} · ${dateText(item.createdAt)}</small><code>${escapeHtml(item.hash.slice(0, 16))}…</code></article>`).join("") : '<p class="support-empty">Chưa có hành động quản trị.</p>';
    };
    const loadAdmin = async () => {
      try {
        const data = await api("?admin=1");
        adminData = data;
        adminItems = data.donations || [];
        page.querySelector("[data-support-admin]").hidden = false;
        const impactForm = page.querySelector("[data-support-impact-form]");
        if (impactForm) impactForm.hidden = data.capabilities?.configure !== true;
        renderAdmin(page.querySelector("[data-support-admin-filter]").value, page.querySelector("[data-support-admin-provider-filter]").value);
      }
      catch { page.querySelector("[data-support-admin]").hidden = true; }
    };

    page.addEventListener("click", async event => {
      const preset = event.target.closest("[data-support-preset]"); if (preset) return updateAmount(Number(preset.dataset.supportPreset));
      if (event.target.closest("[data-support-scroll-donate]")) { page.querySelector("[data-support-flow]")?.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
      const effectButton = event.target.closest("[data-support-effect]");
      if (effectButton) { page.dataset.effects = effectButton.dataset.supportEffect; page.querySelectorAll("[data-support-effect]").forEach(button => button.classList.toggle("active", button === effectButton)); return; }
      const missionChoice = event.target.closest("[data-support-mission-choice], [data-support-mission-map-choice]"); if (missionChoice) { chooseMission(missionChoice.dataset.supportMissionChoice || missionChoice.dataset.supportMissionMapChoice); return; }
      const channel = event.target.closest("[data-support-channel]"); if (channel) {
        if (channel.dataset.supportChannel === "recurring" && channel.dataset.supportChannelUrl) { window.open(channel.dataset.supportChannelUrl, "_blank", "noopener"); return; }
        if (channel.dataset.supportChannel === "community") { page.querySelector("[data-support-contribution-form]").hidden = false; page.querySelector("[data-support-contribution-form]")?.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
        page.querySelector("[data-support-flow]")?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      const star = event.target.closest("[data-support-star]"); if (star) {
        const item = (publicData?.recent || []).find(entry => entry.id === star.dataset.supportStar);
        if (item) window.location.hash = missionById(item.missionId).route;
        return;
      }
      if (event.target.closest("[data-support-payos-check]")) { await checkCurrentDonation(); return; }
      if (event.target.closest("[data-support-new-payment]")) {
        stopPaymentPolling();
        stopPaymentCountdown();
        closeEmbeddedCheckout();
        forgetPending();
        currentDonation = null;
        showStage("details");
        setFormStatus("Có thể thay đổi thông tin và tạo một VietQR mới.");
        return;
      }
      if (event.target.closest("[data-support-refresh]")) return loadPublic();
      if (event.target.closest("[data-support-history-refresh]")) return loadHistory();
      if (event.target.closest("[data-support-admin-refresh]")) return loadAdmin();
      if (event.target.closest("[data-support-download-receipt]") && currentDonation?.status === "verified") {
        if (event.target.closest("[data-support-download-receipt]").dataset.format === "pdf") {
          try { await downloadReceiptPdf(currentDonation); setFormStatus("Đã tạo biên nhận PDF.", "success"); } catch (error) { setFormStatus(error.message, "error"); }
          return;
        }
        const receipt = currentDonation.receipt || {};
        downloadText(`xac-nhan-ung-ho-${currentDonation.reference}.txt`, `XÁC NHẬN ỦNG HỘ HH PLATFORM\n\nMã xác nhận: ${receipt.receiptId || `HH-RCP-${currentDonation.reference}`}\nMã giao dịch: ${currentDonation.reference}\nSố tiền: ${money(currentDonation.amount)}\nXác nhận lúc: ${dateText(currentDonation.verifiedAt)}\nTrạng thái email: ${receipt.status === "sent" ? "Đã gửi" : "Đang xử lý"}\n\nCảm ơn bạn đã đồng hành cùng Nhhoang.\nĐây là xác nhận ủng hộ, không phải hóa đơn tài chính.`);
        return;
      }
      if (event.target.closest("[data-support-download-receipt-pdf]") && currentDonation?.status === "verified") {
        try { await downloadReceiptPdf(currentDonation); setFormStatus("Đã tạo biên nhận PDF.", "success"); } catch (error) { setFormStatus(error.message, "error"); }
        return;
      }
      if (event.target.closest("[data-support-download-card]") && currentDonation?.status === "verified") {
        try { const blob = await createSupportCard(currentDonation); if (blob) downloadBlob(`hh-supporter-${currentDonation.reference}.png`, blob); } catch (error) { setFormStatus(error.message, "error"); }
        return;
      }
      if (event.target.closest("[data-support-share-card]") && currentDonation?.status === "verified") {
        try { await shareSupportCard(currentDonation); } catch (error) { setFormStatus(error.message, "error"); }
        return;
      }
      if (event.target.closest("[data-transparency-csv]") && publicData?.transparency) {
        const rows = [["Tháng", "Thu verified", "Đã sử dụng"], ...(publicData.transparency.series || []).map(item => [item.month, item.income, item.spent])];
        downloadCsv("hh-transparency.csv", rows);
        return;
      }
      if (event.target.closest("[data-transparency-pdf]")) {
        try { await downloadTransparencyPdf(); setFormStatus("Đã tạo báo cáo minh bạch PDF.", "success"); } catch (error) { setFormStatus(error.message, "error"); }
        return;
      }
      if (event.target.closest("[data-wallet-export]")) {
        if (!walletData) return setFormStatus("Đăng nhập để xuất Supporter Wallet.", "error");
        downloadText("hh-supporter-wallet.json", JSON.stringify({ exportedAt: new Date().toISOString(), wallet: walletData.wallet, donations: walletData.donations, requests: walletData.requests }, null, 2), "application/json;charset=utf-8");
        return;
      }
      if (event.target.closest("[data-wallet-preferences]")) {
        const panel = page.querySelector("[data-wallet-preferences-panel]");
        if (panel) panel.hidden = !panel.hidden;
        return;
      }
      if (event.target.closest("[data-wallet-support]")) {
        const subject = String(window.prompt?.("Tiêu đề yêu cầu hỗ trợ:", "Hỗ trợ giao dịch ủng hộ") || "").trim();
        const details = String(window.prompt?.("Nội dung cần hỗ trợ:", "") || "").trim();
        if (!subject || !details) return;
        try { await api("", { method: "POST", body: { action: "wallet:support:create", subject, details } }); setFormStatus("Đã ghi nhận yêu cầu hỗ trợ.", "success"); await loadHistory(); } catch (error) { setFormStatus(error.message, "error"); }
        return;
      }
      if (event.target.closest("[data-wallet-pref-save]")) {
        const preferences = Object.fromEntries([...page.querySelectorAll("[data-wallet-pref]")].map(input => [input.dataset.walletPref, input.checked]));
        try { await api("", { method: "POST", body: { action: "wallet:preferences", preferences } }); setFormStatus("Đã lưu quyền lợi Supporter.", "success"); await loadHistory(); } catch (error) { setFormStatus(error.message, "error"); }
        return;
      }
      const walletRow = event.target.closest("[data-wallet-donation-id]");
      if (walletRow && event.target.closest("[data-wallet-message-delete]")) {
        try { await api("", { method: "POST", body: { action: "wallet:message:delete", id: walletRow.dataset.walletDonationId } }); setFormStatus("Đã ẩn lời nhắn công khai.", "success"); await loadHistory(); await loadPublic(); } catch (error) { setFormStatus(error.message, "error"); }
        return;
      }
      if (walletRow && event.target.closest("[data-wallet-visibility]")) {
        const visibility = event.target.closest("[data-wallet-visibility]").dataset.walletVisibility;
        try { await api("", { method: "POST", body: { action: "wallet:visibility:update", id: walletRow.dataset.walletDonationId, visibility } }); setFormStatus("Đã cập nhật quyền hiển thị.", "success"); await loadHistory(); await loadPublic(); } catch (error) { setFormStatus(error.message, "error"); }
        return;
      }
      if (walletRow && event.target.closest("[data-wallet-refund]")) {
        const reason = String(window.prompt?.("Lý do yêu cầu hoàn tiền:", "Yêu cầu từ Supporter Wallet") || "").trim();
        if (!reason) return;
        try { await api("", { method: "POST", body: { action: "wallet:refund:request", id: walletRow.dataset.walletDonationId, reason } }); setFormStatus("Đã gửi yêu cầu. Chưa coi là hoàn tiền cho tới khi provider xác nhận.", "success"); await loadHistory(); } catch (error) { setFormStatus(error.message, "error"); }
        return;
      }
      if (event.target.closest("[data-admin-export-csv]")) {
        if (!adminItems.length) return;
        downloadCsv("hh-donation-mission-control.csv", [["Reference", "Amount", "Status", "Mission", "Visibility", "Provider", "Webhook", "Created"], ...adminItems.map(item => [item.reference, item.amount, item.status, missionById(item.missionId).label, item.visibility, item.paymentMethod, item.risk?.webhookState, item.createdAt])]);
        return;
      }
      const missionEdit = event.target.closest("[data-admin-mission-edit]");
      if (missionEdit) {
        const mission = (publicData?.missions || []).find(item => item.id === missionEdit.dataset.adminMissionEdit);
        if (!mission) return;
        const goal = Number(window.prompt?.(`Mục tiêu ${mission.label}:`, String(mission.goal)) || mission.goal);
        const status = String(window.prompt?.("Trạng thái active/completed/paused:", mission.status) || mission.status).trim();
        try { await api("", { method: "POST", body: { action: "mission:update", missionId: mission.id, goal, status, result: mission.result || "", resultUrl: mission.resultUrl || "" } }); setFormStatus("Đã cập nhật Funding Mission.", "success"); await Promise.all([loadPublic(), loadAdmin()]); } catch (error) { setFormStatus(error.message, "error"); }
        return;
      }
      const contributionStatus = event.target.closest("[data-contribution-admin-status]");
      if (contributionStatus) {
        try { await api("", { method: "POST", body: { action: "contribution:update", id: contributionStatus.dataset.contributionId, status: contributionStatus.dataset.contributionAdminStatus } }); setFormStatus("Đã cập nhật đóng góp cộng đồng.", "success"); await loadAdmin(); } catch (error) { setFormStatus(error.message, "error"); }
        return;
      }
      const receiptRetry = event.target.closest("[data-support-receipt-retry]"); if (receiptRetry) {
        const row = receiptRetry.closest("[data-donation-id]"); receiptRetry.disabled = true;
        try { const data = await api("", { method: "POST", body: { action: "receipt:retry", id: row.dataset.donationId } }); setFormStatus(data.receipt?.status === "sent" ? "Email cảm ơn đã được gửi thành công." : "Yêu cầu gửi email đã được xử lý.", data.receipt?.status === "sent" ? "success" : ""); await loadAdmin(); }
        catch (error) { setFormStatus(error.message, "error"); receiptRetry.disabled = false; }
        return;
      }
      const refundRequest = event.target.closest("[data-support-refund-request]"); if (refundRequest) {
        const row = refundRequest.closest("[data-donation-id]");
        const reason = String(window.prompt?.("Lý do hoàn tiền (bắt buộc):", "Yêu cầu hoàn tiền từ người ủng hộ") || "").trim();
        if (!reason) return;
        refundRequest.disabled = true;
        try { await api("", { method: "POST", body: { action: "refund:request", id: row.dataset.donationId, reason } }); setFormStatus("Đã ghi nhận yêu cầu. Chưa báo hoàn tiền cho tới khi adapter server xác nhận."); await loadAdmin(); }
        catch (error) { setFormStatus(error.message, "error"); refundRequest.disabled = false; }
        return;
      }
      const refundReconcile = event.target.closest("[data-support-refund-reconcile]"); if (refundReconcile) {
        const row = refundReconcile.closest("[data-donation-id]"); refundReconcile.disabled = true;
        try { const data = await api("", { method: "POST", body: { action: "refund:reconcile", id: row.dataset.donationId } }); if (data.confirmed !== true) throw new Error("Provider chưa xác nhận hoàn tiền."); setFormStatus("Backend và provider đã xác nhận hoàn tiền.", "success"); await Promise.all([loadAdmin(), loadPublic(), loadHistory()]); }
        catch (error) { setFormStatus(error.message, "error"); refundReconcile.disabled = false; }
        return;
      }
      const adminAction = event.target.closest("[data-support-admin-action]"); if (adminAction) {
        const row = adminAction.closest("[data-donation-id]"); adminAction.disabled = true;
        try { await api("", { method: "POST", body: { action: "admin:update", id: row.dataset.donationId, status: adminAction.dataset.supportAdminAction } }); await Promise.all([loadAdmin(), loadPublic()]); }
        catch (error) { setFormStatus(error.message, "error"); adminAction.disabled = false; }
      }
    });

    page.querySelector("[data-support-amount]").addEventListener("input", event => updateAmount(event.target.value));
    page.querySelector("[data-support-message]").addEventListener("input", event => { page.querySelector("[data-support-message-count]").textContent = event.target.value.length; });
    page.querySelector("[data-support-visibility]").addEventListener("change", event => {
      const aliasWrap = page.querySelector("[data-support-alias-wrap]");
      if (aliasWrap) aliasWrap.hidden = event.target.value !== "alias";
    });
    page.querySelector("[data-support-theme]")?.addEventListener("change", event => { page.dataset.theme = event.target.value; });
    page.querySelector("[data-support-admin-filter]").addEventListener("change", event => renderAdmin(event.target.value, page.querySelector("[data-support-admin-provider-filter]").value));
    page.querySelector("[data-support-admin-provider-filter]").addEventListener("change", event => renderAdmin(page.querySelector("[data-support-admin-filter]").value, event.target.value));
    page.querySelector("[data-support-impact-form]").addEventListener("submit", async event => {
      event.preventDefault();
      const status = page.querySelector("[data-impact-status]");
      try {
        await api("", { method: "POST", body: { action: "impact:create", missionId: page.querySelector("[data-impact-mission]").value, type: page.querySelector("[data-impact-type]").value, title: page.querySelector("[data-impact-title]").value, description: page.querySelector("[data-impact-description]").value, amountUsed: page.querySelector("[data-impact-amount-used]").value, link: page.querySelector("[data-impact-link]").value } });
        status.textContent = "Đã công bố impact và cập nhật minh bạch.";
        status.dataset.state = "success";
        event.target.reset();
        await Promise.all([loadPublic(), loadAdmin()]);
      } catch (error) { status.textContent = error.message; status.dataset.state = "error"; }
    });
    page.querySelector("[data-support-contribution-form]").addEventListener("submit", async event => {
      event.preventDefault();
      const status = page.querySelector("[data-contribution-status]");
      try {
        await api("", { method: "POST", body: { action: "contribution:create", type: page.querySelector("[data-contribution-type]").value, title: page.querySelector("[data-contribution-title]").value, details: page.querySelector("[data-contribution-details]").value, link: page.querySelector("[data-contribution-link]").value } });
        status.textContent = "Đã gửi đóng góp. Owner sẽ cập nhật trạng thái trong Mission Control.";
        status.dataset.state = "success";
        event.target.reset();
        await loadAdmin();
      } catch (error) { status.textContent = error.message; status.dataset.state = "error"; }
    });
    page.querySelector("[data-support-form]").addEventListener("submit", async event => {
      event.preventDefault(); const button = event.submitter || submitButton; button.disabled = true; button.textContent = "Đang tạo VietQR…";
      try {
        const visibility = page.querySelector("[data-support-visibility]").value;
        const data = await api("", { method: "POST", body: { action: "payos:create", amount: selectedAmount(), donorName: page.querySelector("[data-support-name]").value, donorAlias: page.querySelector("[data-support-alias]").value, email: page.querySelector("[data-support-email]").value, message: page.querySelector("[data-support-message]").value, missionId: selectedMissionId, visibility, anonymous: visibility === "anonymous" } });
        const checkoutUrl = String(data.payos?.checkoutUrl || "");
        if (!isPayOSCheckoutUrl(checkoutUrl)) throw new Error("payOS chưa trả về giao diện VietQR hợp lệ.");
        currentDonation = { ...data.donation, checkoutUrl, qrImage: String(data.payos?.qrImage || ""), pollUntil: Date.now() + (Number(data.payos?.expiresIn) || 1800) * 1000 };
        rememberPending(currentDonation);
        updatePaymentSummary();
        page.querySelector("[data-support-payos-title]").textContent = `Giao dịch ${currentDonation.reference}`;
        page.querySelector("[data-support-payos-status]").textContent = "Quét VietQR bên dưới bằng ứng dụng ngân hàng. Website sẽ tự chuyển bước sau khi thanh toán.";
        const fallback = page.querySelector("[data-support-payos-fallback]");
        fallback.href = checkoutUrl;
        fallback.hidden = true;
        const deepLink = page.querySelector("[data-support-bank-deeplink]");
        if (deepLink) { deepLink.href = checkoutUrl; deepLink.hidden = false; }
        showStage("payment");
        if (!showDirectQr(currentDonation.qrImage)) {
          try { await openEmbeddedCheckout(checkoutUrl); }
          catch (embedError) {
            fallback.hidden = false;
            page.querySelector("[data-support-payos-status]").textContent = `${embedError.message} Bạn vẫn có thể mở VietQR payOS bằng nút dự phòng bên dưới.`;
          }
        }
        beginPaymentPolling();
      } catch (error) { showStage("details", false); setFormStatus(error.message, "error"); }
      finally { button.disabled = !payOSAvailable; button.textContent = "Tiếp tục tới VietQR"; }
    });

    updateAmount(100000);
    showStage("details", false);
    await Promise.all([loadPublic(), loadAdmin(), loadHistory()]);
    try {
      const current = JSON.parse(sessionStorage.getItem(pendingKey) || "null");
      const legacy = JSON.parse(sessionStorage.getItem(LEGACY_STORAGE_KEY) || "null");
      const saved = normalizePending(current || legacy);
      if (legacy && saved) rememberPending(saved);
      if (saved?.id && saved?.reference && saved?.checkoutUrl && payOSAvailable) {
        currentDonation = saved;
        chooseMission(saved.missionId);
        if (page.querySelector("[data-support-visibility]")) page.querySelector("[data-support-visibility]").value = saved.visibility || "public";
        updatePaymentSummary();
        page.querySelector("[data-support-payos-title]").textContent = `Giao dịch ${currentDonation.reference}`;
        page.querySelector("[data-support-payos-status]").textContent = "Đang khôi phục VietQR và trạng thái giao dịch gần nhất.";
        const fallback = page.querySelector("[data-support-payos-fallback]");
        fallback.href = currentDonation.checkoutUrl;
        const deepLink = page.querySelector("[data-support-bank-deeplink]");
        if (deepLink) { deepLink.href = currentDonation.checkoutUrl; deepLink.hidden = false; }
        showStage("payment", false);
        if (!showDirectQr(currentDonation.qrImage)) {
          try { await openEmbeddedCheckout(currentDonation.checkoutUrl); }
          catch { fallback.hidden = false; }
        }
        beginPaymentPolling();
      } else if (saved) forgetPending();
    } catch { forgetPending(); }
    refreshTimer = window.setInterval(() => {
      if (!document.contains(page)) return clearInterval(refreshTimer);
      if (!document.hidden) loadPublic();
    }, 30000);
  }

  function unmount() {
    clearInterval(refreshTimer);
    clearInterval(paymentPollTimer);
    clearInterval(paymentCountdownTimer);
  }

  return Object.freeze({ VERSION, INTEGRATION_VERSION, STORAGE_KEY, isPayOSCheckoutUrl, normalizePending, donationLifecycle, createPayOSCheckoutAdapter, mount, unmount });
});
