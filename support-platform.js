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
  const GALAXY_PREFERENCES_KEY = "hh.support.galaxy.v1";
  const DONATION_STATUSES = Object.freeze(["pending", "submitted", "verified", "refunded", "rejected", "payment_error"]);
  const SUPPORT_TIERS = Object.freeze([
    { amount: 20000, code: "MS", name: "Moon Spark", impact: "Tiếp năng lượng cho vận hành cơ bản", color: "#7cefff" },
    { amount: 50000, code: "CF", name: "Comet Fuel", impact: "Hỗ trợ băng thông và lưu trữ", color: "#8a7dff" },
    { amount: 100000, code: "NC", name: "Nebula Core", impact: "Duy trì API và dịch vụ AI", color: "#f069d1" },
    { amount: 200000, code: "SE", name: "Stellar Engine", impact: "Tăng tốc phát triển tính năng", color: "#42e8b4" },
    { amount: 500000, code: "GG", name: "Galaxy Guardian", impact: "Bảo trợ một chu kỳ vận hành", color: "#ff9a62" },
    { amount: 1000000, code: "CP", name: "Cosmic Patron", impact: "Đồng hành dài hạn cùng HH Platform", color: "#ffd968" }
  ]);
  const SUPPORT_THEMES = Object.freeze([
    ["nebula", "Nebula Rose"],
    ["aurora", "Aurora Support"],
    ["cyber", "Cyber Patron"],
    ["deep-space", "Deep Space"],
    ["golden", "Golden Guardian"],
    ["cinema", "Cosmic Cinema"]
  ]);
  let refreshTimer = 0;
  let visibilityHandler = null;
  let paymentPollTimer = 0;
  let paymentCountdownTimer = 0;

  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const money = value => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(Number(value) || 0);
  const dateText = value => value ? new Date(value).toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" }) : "--";
  const getUser = () => { try { return JSON.parse(localStorage.getItem("hh-auth-user") || "{}"); } catch { return {}; } };
  const downloadBlob = (name, blob) => { const anchor = document.createElement("a"); anchor.href = URL.createObjectURL(blob); anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(anchor.href), 1200); };
  const downloadText = (name, content) => downloadBlob(name, new Blob([content], { type: "text/plain;charset=utf-8" }));
  const pdfEscape = value => String(value ?? "").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/[^\x20-\x7E]/g, "?");
  const downloadReceiptPdf = (name, lines) => {
    const stream = ["BT", "/F1 18 Tf", "56 780 Td", ...lines.flatMap((line, index) => [`(${pdfEscape(line)}) Tj`, index ? "0 -24 Td" : "0 -34 Td"]), "ET"].join("\n");
    const objects = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
    ];
    let pdf = "%PDF-1.4\n", offset = pdf.length;
    const offsets = [0];
    objects.forEach((object, index) => { offsets[index + 1] = offset; const entry = `${index + 1} 0 obj\n${object}\nendobj\n`; pdf += entry; offset += entry.length; });
    const xref = offset;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(value => `${String(value).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    downloadBlob(name, new Blob([pdf], { type: "application/pdf" }));
  };
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
    return `<section class="support-page" data-support-page>
      <div class="support-galaxy-controls" aria-label="Tùy chỉnh Support Galaxy">
        <div><span>SUPPORT GALAXY</span><strong>Trạm tiếp năng lượng HH</strong></div>
        <label>Chủ đề<select data-support-theme>${SUPPORT_THEMES.map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select></label>
        <div class="support-effects" role="group" aria-label="Mức hiệu ứng">
          <button type="button" data-support-effect="static">Tĩnh</button>
          <button type="button" data-support-effect="balanced" class="active">Cân bằng</button>
          <button type="button" data-support-effect="cinematic">Điện ảnh</button>
        </div>
      </div>

      <section class="support-overview support-galaxy-hero">
        <div class="support-cosmos" aria-hidden="true"><i></i><i></i><i></i><b></b><b></b></div>
        <div class="support-overview__copy">
          <p class="section-kicker">HH DEVELOPER SUPPORT · LIVE ORBIT</p>
          <h2>Tiếp năng lượng cho <em>HH Core Star</em></h2>
          <p>Mỗi khoản ủng hộ đã đối soát giúp duy trì máy chủ, dịch vụ AI, tên miền và thời gian phát triển các công cụ miễn phí cho cộng đồng.</p>
          <div class="support-hero-actions"><button class="support-primary" type="button" data-support-scroll-donate>Tiếp năng lượng cho dự án</button><span><i></i> payOS + Resend đang kết nối</span></div>
          <div class="support-trust"><span>✓ Minh bạch giao dịch</span><span>✓ VietQR tự động qua payOS</span><span data-support-email-trust>✓ Email cảm ơn sau xác minh</span><span>✓ Không lưu dữ liệu ngân hàng</span></div>
        </div>
        <div class="support-core-system" data-support-core-system aria-label="Tiến độ mục tiêu ủng hộ">
          <div class="support-core-orbit support-core-orbit--outer"><i></i><i></i><i></i></div>
          <div class="support-core-orbit support-core-orbit--progress" data-support-progress-ring></div>
          <div class="support-core-star"><span>HH</span><b>CORE STAR</b><small>ONLINE</small></div>
          <div class="support-hero-satellites" data-support-hero-satellites aria-hidden="true"></div>
          <div class="support-goal">
            <header><span>Mục tiêu phát triển</span><strong data-support-progress-label>0%</strong></header>
            <div class="support-goal__amount"><strong data-support-total>0 ₫</strong><span>/ <b data-support-goal>10.000.000 ₫</b></span></div>
            <i aria-hidden="true"><b data-support-progress></b></i>
            <footer><span><b data-support-count>0</b> lượt đã xác nhận</span><span>Tháng này <b data-support-month>0 ₫</b></span></footer>
          </div>
        </div>
      </section>

      <div class="support-metrics"><article><span>Tổng đã nhận</span><strong data-support-total-card>0 ₫</strong><small>Chỉ tính giao dịch đã đối soát</small></article><article><span>Người ủng hộ</span><strong data-support-count-card>0</strong><small>Cảm ơn cộng đồng HH</small></article><article><span>Ủng hộ trung bình</span><strong data-support-average>0 ₫</strong><small>Mỗi giao dịch đã xác nhận</small></article><article><span>Trạng thái</span><strong class="is-online">Đang hoạt động</strong><small data-support-checked>Cập nhật tự động 30 giây/lần</small></article></div>

      <section class="support-automation" data-support-automation>
        <header><div><p class="section-kicker">VIETQR AUTOMATION</p><h3>Ủng hộ trong một luồng liền mạch</h3></div><span data-support-journey-label>Sẵn sàng</span></header>
        <ol><li class="is-current" data-support-step="details"><b>1</b><span><strong>Thông tin</strong><small>Chọn số tiền và email</small></span></li><li data-support-step="payment"><b>2</b><span><strong>VietQR</strong><small>Quét ngay trên HH Platform</small></span></li><li data-support-step="verify"><b>3</b><span><strong>Xác minh</strong><small>Webhook payOS tự đối soát</small></span></li><li data-support-step="email"><b>4</b><span><strong>Hoàn tất</strong><small>Nhận email cảm ơn</small></span></li></ol>
        <p>Mỗi lần chỉ hiển thị đúng bước đang thực hiện. Giao dịch chỉ được ghi nhận sau khi payOS gửi webhook có chữ ký hợp lệ.</p>
      </section>

      <div class="support-payment-flow" data-support-flow>
      <div class="support-main-grid" data-support-stage-panel="details">
        <main class="support-donate-panel">
          <header><div><span>BƯỚC 1 · ENERGY PLANETS</span><h3>Chọn hành tinh năng lượng</h3></div><span class="support-secure">Bảo mật phía máy chủ</span></header>
          <form data-support-form>
            <div class="support-auto-method" data-support-auto-method><div class="support-auto-method__icon">QR</div><div><span>VIETQR TỰ ĐỘNG QUA PAYOS</span><strong>Thanh toán an toàn ngay trong HH Platform</strong><small data-support-payos-availability>Đang kiểm tra kết nối payOS…</small></div><i data-support-provider-state></i></div>
            <div class="support-presets support-planets" aria-label="Các mức ủng hộ">
              ${SUPPORT_TIERS.map((tier, index) => `<button type="button" class="${index === 2 ? "active" : ""}" style="--planet:${tier.color}" data-support-preset="${tier.amount}" aria-pressed="${index === 2 ? "true" : "false"}"><i aria-hidden="true"><b>${tier.code}</b></i><span><strong>${tier.name}</strong><b>${money(tier.amount)}</b><small>${tier.impact}</small></span></button>`).join("")}
            </div>
            <p class="support-tier-impact" data-support-tier-impact><span>Nebula Core</span> · Duy trì API và dịch vụ AI</p>
            <label class="support-amount-field"><span>Số tiền tùy chỉnh</span><div><b>₫</b><input type="number" min="1000" max="1000000000" step="1000" value="100000" data-support-amount required></div><small>Tối thiểu 1.000đ</small></label>
            <div class="support-form-grid"><label><span>Tên hiển thị</span><input data-support-name maxlength="100" value="${escapeHtml(user.name || "")}" placeholder="Tên của bạn" required></label><label><span>Email nhận lời cảm ơn (không công khai)</span><input type="email" data-support-email maxlength="160" value="${escapeHtml(user.email || "")}" placeholder="you@gmail.com" autocomplete="email" required><small>Thư chỉ gửi sau khi thanh toán được xác minh.</small></label></div>
            <label><span>Lời nhắn tới nhà phát triển</span><textarea rows="4" maxlength="500" data-support-message placeholder="Cảm ơn bạn đã xây dựng các công cụ hữu ích..."></textarea><small><b data-support-message-count>0</b>/500 ký tự</small></label>
            <label class="support-check"><input type="checkbox" data-support-anonymous><span><b>Ủng hộ ẩn danh</b><small>Tên của bạn sẽ không xuất hiện công khai.</small></span></label>
            <button class="support-primary support-launch-wormhole" type="submit" disabled><span>Mở cổng VietQR</span><i aria-hidden="true">→</i></button>
            <p class="support-form-status" data-support-form-status>Đang kết nối kênh VietQR tự động…</p>
          </form>
        </main>
      </div>

      <section class="support-payos-stage support-wormhole" data-support-payos data-support-stage-panel="payment" data-payment-state="creating" hidden>
        <header><div><span>BƯỚC 2 · PAYMENT WORMHOLE</span><h3 data-support-payos-title>Đang mở cổng VietQR</h3><p data-support-payos-status>Mã VietQR sẽ xuất hiện ngay tại đây, không mở sang website khác.</p></div><div class="support-live-badge"><i></i> Tự động đối soát</div></header>
        <div class="support-payment-statebar" aria-label="Trạng thái giao dịch"><span class="active" data-payment-state-item="creating"><b>1</b>Khởi tạo</span><span data-payment-state-item="waiting"><b>2</b>Chờ quét</span><span data-payment-state-item="verifying"><b>3</b>Xác minh</span><span data-payment-state-item="paid"><b>4</b>Thành công</span></div>
        <div class="support-payos-workspace">
          <aside class="support-payos-summary" aria-label="Tóm tắt giao dịch">
            <div class="support-payos-summary__eyebrow"><i></i><span>GIAO DỊCH ĐANG CHỜ</span></div>
            <strong class="support-payos-summary__amount" data-support-payos-amount>--</strong>
            <dl><div><dt>Mã giao dịch</dt><dd data-support-payos-reference>--</dd></div><div class="support-countdown-orbit"><dt>Thời gian còn lại</dt><dd data-support-payos-countdown>30:00</dd></div></dl>
            <div class="support-payos-guide"><span>QUÉT VÀ HOÀN TẤT</span><ol><li><b>1</b><p><strong>Mở ứng dụng ngân hàng</strong><small>Chọn chức năng quét mã VietQR.</small></p></li><li><b>2</b><p><strong>Quét mã bên cạnh</strong><small>Số tiền và nội dung được điền tự động.</small></p></li><li><b>3</b><p><strong>Xác nhận thanh toán</strong><small>HH Platform tự chuyển bước sau khi nhận webhook.</small></p></li></ol></div>
            <div class="support-payos-shield"><b>✓</b><p><strong>Bảo vệ bởi payOS</strong><small>HH Platform không lưu thông tin ngân hàng của bạn.</small></p></div>
          </aside>
          <div class="support-payos-frame support-wormhole-gate">
            <div class="support-wormhole-rings" aria-hidden="true"><i></i><i></i><i></i></div>
            <div class="support-payos-frame__top"><span><i></i> VietQR trực tiếp</span><small>Không rời khỏi HH Platform</small></div>
            <div class="support-payos-direct" data-support-payos-direct hidden><div class="support-payos-direct__halo"><img data-support-payos-qr-image alt="Mã VietQR thanh toán tự động qua payOS"></div><div><strong>Quét mã để hoàn tất ủng hộ</strong><span>VietQR tự điền chính xác số tiền và nội dung chuyển khoản.</span></div><small><b>VIETQR</b> · Xử lý an toàn bởi payOS</small></div>
            <div class="support-payos-embed" id="hh-payos-embedded" data-support-payos-embed><div class="support-payos-loading"><i></i><strong>Đang tải VietQR bảo mật</strong><span>Vui lòng giữ trang này mở trong vài giây.</span></div></div>
            <div class="support-payos-frame__note"><span>🔒 Kết nối bảo mật</span><span>⚡ Xác minh tự động</span><span>✉ Email sau thanh toán</span></div>
          </div>
        </div>
        <footer><button type="button" data-support-new-payment>Thay đổi thông tin</button><a href="#" target="_blank" rel="noopener" data-support-payos-fallback hidden>Mở payOS trong tab mới</a></footer>
      </section>

      <section class="support-verify-stage" data-support-stage-panel="verify" hidden>
        <div class="support-verify-stage__pulse"><i></i><b>3</b></div><div><span>BƯỚC 3 · XÁC MINH TỰ ĐỘNG</span><h3 data-support-verify-title>Đang chờ ngân hàng xác nhận</h3><p data-support-verify-status>Webhook payOS đang đối chiếu mã giao dịch và số tiền. Bạn không cần tải lại trang.</p></div><button type="button" data-support-payos-check>Kiểm tra ngay</button>
      </section>

      <section class="support-receipt" data-support-receipt data-support-stage-panel="email" hidden>
        <div class="support-receipt__icon support-hologram-envelope" aria-hidden="true"><i></i><b>✉</b></div>
        <div><span>BƯỚC 4 · COSMIC RECEIPT</span><h3>Cảm ơn bạn đã đồng hành cùng Nhhoang</h3><p data-support-receipt-status>Đang hoàn tất thư cảm ơn.</p><small class="support-receipt__privacy">Email được che một phần · mã giao dịch đầy đủ chỉ nằm trong biên nhận cá nhân</small></div>
        <dl><div><dt>Mã xác nhận</dt><dd data-support-receipt-id>--</dd></div><div><dt>Số tiền</dt><dd data-support-receipt-amount>--</dd></div><div><dt>Email</dt><dd data-support-receipt-email>--</dd></div><div><dt>Xác nhận lúc</dt><dd data-support-receipt-time>--</dd></div></dl>
        <div class="support-receipt-actions"><button type="button" data-support-download-receipt>Tải TXT</button><button type="button" data-support-download-receipt-pdf>Tải PDF</button><button type="button" data-support-download-card>Tải thẻ PNG</button><button type="button" data-support-share-card>Chia sẻ thẻ</button></div>
      </section>
      </div>

      <div class="support-community-grid">
        <section class="support-wall"><header><div><span>Cộng đồng</span><h3>Lời nhắn gần đây</h3></div><button type="button" data-support-refresh>Làm mới</button></header><div data-support-wall><p class="support-empty">Chưa có giao dịch được xác nhận.</p></div></section>
        <section class="support-leaderboard"><header><div><span>Top supporters</span><h3>Bảng tri ân</h3></div></header><div data-support-leaderboard><p class="support-empty">Danh sách sẽ xuất hiện sau khi đối soát.</p></div></section>
      </div>

      <section class="support-supporter-galaxy" data-support-supporter-galaxy>
        <header><div><p class="section-kicker">SUPPORTER GALAXY</p><h3>Những vệ tinh đang đồng hành</h3><p>Chỉ dữ liệu công khai sau khi giao dịch được backend xác minh.</p></div><div class="support-filter-tabs" role="group" aria-label="Bộ lọc supporter"><button type="button" class="active" data-supporter-filter="recent">Mới nhất</button><button type="button" data-supporter-filter="featured">Nổi bật</button><button type="button" data-supporter-filter="anonymous">Ẩn danh</button><button type="button" data-supporter-filter="loyal">Đồng hành lâu dài</button></div></header>
        <div class="supporter-orbit-map"><div class="supporter-orbit-map__core"><span>HH</span><small>CORE</small></div><div class="supporter-orbit-map__rings"><i></i><i></i><i></i></div><div data-support-supporter-satellites><p class="support-empty">Chưa có vệ tinh được xác nhận.</p></div></div>
        <div class="supporter-signal-list" data-support-signal-list><p class="support-empty">Tín hiệu radio sẽ xuất hiện sau giao dịch đầu tiên.</p></div>
      </section>

      <section class="support-impact-constellation">
        <header><div><p class="section-kicker">IMPACT CONSTELLATION</p><h3>Khoản ủng hộ tiếp năng lượng cho đâu?</h3><p>Ánh sáng được tính từ tổng giao dịch đã đối soát theo kế hoạch ngân sách công khai; không hiển thị số liệu tưởng tượng.</p></div><span class="support-impact-total" data-support-impact-total>0 ₫ đã đối soát</span></header>
        <div class="support-constellation-grid" data-support-impact-grid>
          <button type="button" style="--impact-color:#62e9ff;--impact-size:76%" data-impact-key="server"><i>◉</i><strong>Máy chủ</strong><small>Ổn định core và runtime</small><b>35%</b></button>
          <button type="button" style="--impact-color:#f36ad2;--impact-size:58%" data-impact-key="ai"><i>✦</i><strong>Dịch vụ AI</strong><small>API và model credits</small><b>25%</b></button>
          <button type="button" style="--impact-color:#a28bff;--impact-size:46%" data-impact-key="domain"><i>◎</i><strong>Tên miền</strong><small>DNS và chứng chỉ</small><b>10%</b></button>
          <button type="button" style="--impact-color:#54e2b0;--impact-size:42%" data-impact-key="storage"><i>⬡</i><strong>Lưu trữ</strong><small>Media và bản sao an toàn</small><b>10%</b></button>
          <button type="button" style="--impact-color:#ff9b63;--impact-size:64%" data-impact-key="product"><i>✧</i><strong>Phát triển</strong><small>Tính năng và bảo trì</small><b>15%</b></button>
          <button type="button" style="--impact-color:#ffda68;--impact-size:32%" data-impact-key="community"><i>♧</i><strong>Công cụ cộng đồng</strong><small>Không gian miễn phí</small><b>5%</b></button>
        </div>
        <p class="support-impact-detail" data-support-impact-detail>Chọn một chòm sao để xem mô tả phân bổ.</p>
      </section>

      <section class="support-mission-log">
        <header><div><p class="section-kicker">GALAXY MISSION LOG</p><h3>Nhật ký minh bạch</h3><p>Chỉ hiển thị sự kiện có dấu vết backend hoặc mốc mục tiêu được tính từ số liệu thật.</p></div><span class="support-live-badge"><i></i> Live data</span></header>
        <div class="support-mission-timeline" data-support-mission-log><p class="support-empty">Đang chờ dữ liệu vận hành công khai.</p></div>
      </section>

      <section class="support-history" data-support-history>
        <header><div><span>Lịch sử của tôi</span><h3>Giao dịch và hoàn tiền</h3></div><button type="button" data-support-history-refresh>Làm mới</button></header>
        <p>Chỉ tài khoản đang đăng nhập xem được lịch sử của chính mình. Trạng thái hoàn tiền chỉ đổi sau khi adapter phía máy chủ xác nhận.</p>
        <div data-support-history-list><p class="support-empty">Đăng nhập để đồng bộ lịch sử ủng hộ.</p></div>
      </section>

      <section class="support-transparency"><div><p class="section-kicker">MINH BẠCH</p><h3>Nguồn lực được sử dụng như thế nào?</h3><p>Mục tiêu là duy trì nền tảng ổn định, bảo vệ dữ liệu người dùng và tiếp tục phát triển công cụ miễn phí.</p></div><div class="support-allocation"><span style="--allocation:40%"><b>40%</b>Hosting & database</span><span style="--allocation:30%"><b>30%</b>AI & API services</span><span style="--allocation:20%"><b>20%</b>Phát triển sản phẩm</span><span style="--allocation:10%"><b>10%</b>Dự phòng vận hành</span></div></section>

      <section class="support-faq"><h3>Câu hỏi thường gặp</h3><details><summary>Khi nào khoản ủng hộ xuất hiện công khai?</summary><p>Khoản ủng hộ xuất hiện sau khi webhook payOS xác minh chữ ký, mã đơn và số tiền thành công.</p></details><details><summary>Khi nào tôi nhận được email cảm ơn?</summary><p>Ngay sau khi máy chủ xác minh đúng giao dịch. Email có mã xác nhận riêng; webhook gọi lại nhiều lần cũng không gửi trùng.</p></details><details><summary>Tại sao số tiền chưa được cộng ngay?</summary><p>Hệ thống chỉ cộng giao dịch có chữ ký hợp lệ, đúng mã đơn và đúng số tiền. Điều này ngăn số liệu giả và giao dịch bị tính hai lần.</p></details><details><summary>Thông tin nào được công khai?</summary><p>Chỉ tên hiển thị, số tiền và lời nhắn. Email, tài khoản đăng nhập và thông tin đối soát không bao giờ xuất hiện trên bảng công khai.</p></details><details><summary>Tôi có thể ủng hộ ẩn danh không?</summary><p>Có. Chọn “Ủng hộ ẩn danh” trước khi tạo giao dịch.</p></details></section>

      <section class="support-admin" data-support-admin hidden>
        <header><div><p class="section-kicker">OWNER CONTROL</p><h3>Đối soát giao dịch ủng hộ</h3><p>Chỉ email chủ sở hữu được API trả danh sách này.</p></div><button type="button" data-support-admin-refresh>Làm mới</button></header>
        <div class="support-admin-toolbar"><label>Trạng thái<select data-support-admin-filter><option value="all">Tất cả</option><option value="submitted">Đã báo chuyển</option><option value="pending">Chờ chuyển</option><option value="verified">Đã xác nhận</option><option value="refunded">Đã hoàn tiền</option><option value="rejected">Từ chối</option></select></label><span data-support-admin-count>0 giao dịch</span></div>
        <div class="support-admin-list" data-support-admin-list></div>
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
    let payOSAvailable = false;
    let flowStage = "details";
    let supporterFilter = "recent";
    let publicSupportData = { recent: [], leaderboard: [], stats: {}, goal: 10000000 };
    let checkoutController = null;
    const checkoutAdapter = options.checkoutAdapter || createPayOSCheckoutAdapter(window);
    const readGalaxyPreferences = () => {
      try { return { theme: "nebula", effects: "balanced", ...(JSON.parse(localStorage.getItem(GALAXY_PREFERENCES_KEY) || "{}")) }; }
      catch { return { theme: "nebula", effects: "balanced" }; }
    };
    const applyGalaxyPreferences = preferences => {
      const reduced = Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches || Number(navigator.hardwareConcurrency || 8) <= 2 || Number(navigator.deviceMemory || 8) <= 2);
      page.dataset.theme = SUPPORT_THEMES.some(([value]) => value === preferences.theme) ? preferences.theme : "nebula";
      page.dataset.effects = reduced ? "static" : ["static", "balanced", "cinematic"].includes(preferences.effects) ? preferences.effects : "balanced";
      page.classList.toggle("is-reduced-motion", reduced);
      page.querySelectorAll("[data-support-effect]").forEach(button => button.classList.toggle("active", button.dataset.supportEffect === page.dataset.effects));
      const themeSelect = page.querySelector("[data-support-theme]");
      if (themeSelect) themeSelect.value = page.dataset.theme;
    };
    const saveGalaxyPreferences = () => {
      try { localStorage.setItem(GALAXY_PREFERENCES_KEY, JSON.stringify({ theme: page.dataset.theme, effects: page.dataset.effects })); } catch { /* Preferences are optional. */ }
    };
    const setPaymentState = state => {
      const panel = page.querySelector("[data-support-payos]");
      if (!panel) return;
      panel.dataset.paymentState = state;
      page.querySelectorAll("[data-payment-state-item]").forEach(item => {
        const order = ["creating", "waiting", "verifying", "paid"];
        const current = order.indexOf(state), index = order.indexOf(item.dataset.paymentStateItem);
        item.classList.toggle("active", index === current);
        item.classList.toggle("is-done", index < current);
      });
    };
    applyGalaxyPreferences(readGalaxyPreferences());

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
    const selectedAmount = () => Math.round(Number(page.querySelector("[data-support-amount]").value) || 0);
    const updateAmount = amount => {
      page.querySelector("[data-support-amount]").value = amount;
      page.querySelectorAll("[data-support-preset]").forEach(button => {
        const active = Number(button.dataset.supportPreset) === Number(amount);
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
      });
      const tier = SUPPORT_TIERS.find(item => item.amount === Number(amount));
      const impact = page.querySelector("[data-support-tier-impact]");
      if (impact) impact.innerHTML = tier ? `<span>${escapeHtml(tier.name)}</span> · ${escapeHtml(tier.impact)}` : "<span>Custom orbit</span> · Bạn chọn mức năng lượng riêng cho dự án";
    };
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
      setPaymentState({ details: "creating", payment: "waiting", verify: "verifying", email: "paid" }[flowStage] || "creating");
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
    const receiptDetails = () => {
      const receipt = currentDonation?.receipt || {};
      return {
        id: receipt.receiptId || `HH-RCP-${currentDonation?.reference || "PENDING"}`,
        reference: currentDonation?.reference || "--",
        amount: currentDonation?.amount || 0,
        email: receipt.recipient || "Email đã cung cấp",
        verifiedAt: currentDonation?.verifiedAt || Date.now(),
        name: String(page.querySelector("[data-support-name]")?.value || "Người đồng hành").trim().slice(0, 100)
      };
    };
    const createTributeCard = async () => {
      const details = receiptDetails();
      const canvas = document.createElement("canvas");
      canvas.width = 1200; canvas.height = 675;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Thiết bị không hỗ trợ tạo thẻ tri ân.");
      const gradient = context.createLinearGradient(0, 0, 1200, 675);
      gradient.addColorStop(0, "#130f2c"); gradient.addColorStop(.5, "#27153f"); gradient.addColorStop(1, "#071d2a");
      context.fillStyle = gradient; context.fillRect(0, 0, canvas.width, canvas.height);
      context.globalAlpha = .3;
      for (let index = 0; index < 28; index += 1) { context.fillStyle = ["#62e9ff", "#f36ad2", "#ffd968"][index % 3]; context.beginPath(); context.arc((index * 173) % 1200, (index * 79) % 675, index % 3 + 1.5, 0, Math.PI * 2); context.fill(); }
      context.globalAlpha = 1;
      context.strokeStyle = "#62e9ff"; context.lineWidth = 5; context.beginPath(); context.arc(930, 250, 128, 0, Math.PI * 2); context.stroke();
      context.strokeStyle = "#f36ad2"; context.lineWidth = 3; context.beginPath(); context.arc(930, 250, 170, .5, 5.4); context.stroke();
      context.fillStyle = "#f8fdff"; context.font = "800 26px Inter, Arial"; context.fillText("HH PLATFORM · COSMIC RECEIPT", 70, 90);
      context.fillStyle = "#a8c8d4"; context.font = "500 24px Inter, Arial"; context.fillText("Cảm ơn bạn đã tiếp năng lượng cho dự án", 70, 145);
      context.fillStyle = "#ffd968"; context.font = "900 54px Inter, Arial"; context.fillText(money(details.amount), 70, 245);
      context.fillStyle = "#ecf8ff"; context.font = "700 30px Inter, Arial"; context.fillText(details.name || "Người đồng hành", 70, 325);
      context.fillStyle = "#8daab7"; context.font = "500 22px Inter, Arial"; context.fillText(`Receipt: ${details.id.slice(0, 10)}…`, 70, 390);
      context.fillText("Email cảm ơn: Đã gửi sau xác minh", 70, 430);
      context.fillText("Giao dịch đã được payOS xác minh bởi HH Platform", 70, 540);
      context.fillStyle = "#62e9ff"; context.font = "700 20px Inter, Arial"; context.fillText("nhhoang13all.xyz/#/support", 70, 590);
      return await new Promise(resolve => canvas.toBlob(blob => resolve(blob), "image/png"));
    };
    const shareTributeCard = async () => {
      const blob = await createTributeCard();
      if (!blob) throw new Error("Không thể tạo thẻ tri ân.");
      const details = receiptDetails();
      const file = new File([blob], `hh-cosmic-receipt-${details.reference}.png`, { type: "image/png" });
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({ title: "HH Platform · Cosmic Receipt", text: "Tôi vừa tiếp năng lượng cho HH Platform.", files: [file] });
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`Tôi vừa tiếp năng lượng cho HH Platform · ${money(details.amount)} · Receipt ${details.id.slice(0, 10)}…`);
        setFormStatus("Đã sao chép thông điệp chia sẻ. Bạn có thể tải thẻ PNG để đăng lên mạng xã hội.", "success");
      } else setFormStatus("Thiết bị chưa hỗ trợ chia sẻ trực tiếp. Hãy tải thẻ PNG.", "error");
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

    const renderSupporterGalaxy = () => {
      const recent = Array.isArray(publicSupportData.recent) ? publicSupportData.recent : [];
      const loyalNames = new Set((publicSupportData.leaderboard || []).filter(item => Number(item.donations) >= 2).map(item => String(item.name)));
      let items = recent.slice();
      if (supporterFilter === "featured") items.sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0));
      if (supporterFilter === "anonymous") items = items.filter(item => item.anonymous);
      if (supporterFilter === "loyal") items = items.filter(item => loyalNames.has(String(item.name)));
      const satellites = page.querySelector("[data-support-supporter-satellites]");
      const signals = page.querySelector("[data-support-signal-list]");
      if (satellites) satellites.innerHTML = items.length ? items.slice(0, 8).map((item, index) => {
        const initials = escapeHtml(String(item.name || "HH").split(/\s+/).slice(-2).map(part => part[0]).join("").toUpperCase());
        return `<span class="supporter-satellite" style="--orbit-index:${index};--satellite-color:${["#62e9ff", "#f36ad2", "#9c86ff", "#55e2b0", "#ffd968"][index % 5]}" title="${escapeHtml(item.name)} · ${money(item.amount)}">${initials}</span>`;
      }).join("") : '<p class="support-empty">Chưa có vệ tinh phù hợp với bộ lọc này.</p>';
      if (signals) signals.innerHTML = items.length ? items.slice(0, 6).map(item => `<article><span class="support-signal-dot"></span><div><strong>${escapeHtml(item.name)}</strong><small>${dateText(item.verifiedAt || item.createdAt)}${item.receiptSentAt ? " · Email cảm ơn đã gửi" : ""}</small></div><b>${money(item.amount)}</b>${item.message ? `<p>“${escapeHtml(item.message)}”</p>` : ""}</article>`).join("") : '<p class="support-empty">Tín hiệu radio sẽ xuất hiện sau giao dịch đầu tiên.</p>';
    };
    const renderHeroSatellites = () => {
      const host = page.querySelector("[data-support-hero-satellites]");
      const items = (publicSupportData.recent || []).slice(0, 5);
      if (host) host.innerHTML = items.map((item, index) => `<span style="--orbit-index:${index};--satellite-color:${["#62e9ff", "#f36ad2", "#ffd968", "#55e2b0", "#9c86ff"][index]}" title="${escapeHtml(item.name)}"></span>`).join("");
    };
    const renderImpact = () => {
      const total = Number(publicSupportData.stats?.total || 0);
      const node = page.querySelector("[data-support-impact-total]");
      if (node) node.textContent = `${money(total)} đã đối soát`;
      page.querySelectorAll("[data-impact-key]").forEach(card => {
        const percentage = Number(card.querySelector("b")?.textContent?.replace("%", "")) || 0;
        card.style.setProperty("--impact-value", money(total * percentage / 100));
      });
    };
    const renderMissionLog = () => {
      const host = page.querySelector("[data-support-mission-log]");
      if (!host) return;
      const total = Number(publicSupportData.stats?.total || 0);
      const goal = Number(publicSupportData.goal || 10000000);
      const events = [];
      (publicSupportData.recent || []).slice(0, 8).forEach(item => {
        events.push({ at: item.verifiedAt || item.createdAt, tone: "cyan", title: "Giao dịch được xác minh", detail: `${money(item.amount)} · ${escapeHtml(item.name)}` });
        if (item.receiptSentAt) events.push({ at: item.receiptSentAt, tone: "pink", title: "Cosmic Receipt đã gửi", detail: `Email cảm ơn đã hoàn tất cho ${escapeHtml(item.name)}` });
      });
      [10, 25, 50, 75, 100].filter(milestone => total >= goal * milestone / 100).forEach(milestone => events.push({ at: publicSupportData.checkedAt, tone: "gold", title: `Mục tiêu ngân hà đạt ${milestone}%`, detail: `${money(total)} / ${money(goal)}` }));
      host.innerHTML = events.length ? events.sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0)).slice(0, 12).map(event => `<article class="support-mission-event support-mission-event--${event.tone}"><i></i><time>${dateText(event.at)}</time><div><strong>${event.title}</strong><span>${event.detail}</span></div></article>`).join("") : '<p class="support-empty">Chưa có sự kiện vận hành công khai. Hệ thống không tự tạo dữ liệu giả.</p>';
    };

    const renderPublic = data => {
      const stats = data.stats || {}, goal = Number(data.goal) || 10000000, total = Number(stats.total) || 0, percent = Math.min(100, total / goal * 100);
      publicSupportData = { ...data, stats, goal };
      page.querySelector("[data-support-total]").textContent = money(total);
      page.querySelector("[data-support-total-card]").textContent = money(total);
      page.querySelector("[data-support-goal]").textContent = money(goal);
      page.querySelector("[data-support-count]").textContent = stats.count || 0;
      page.querySelector("[data-support-count-card]").textContent = stats.count || 0;
      page.querySelector("[data-support-average]").textContent = money(stats.average || 0);
      page.querySelector("[data-support-month]").textContent = money(stats.monthlyTotal || 0);
      page.querySelector("[data-support-progress]").style.width = `${percent}%`;
      page.querySelector("[data-support-progress-label]").textContent = `${percent.toFixed(percent >= 10 ? 0 : 1)}%`;
      page.querySelector("[data-support-progress-ring]")?.style.setProperty("--support-progress", `${percent * 3.6}deg`);
      page.querySelector("[data-support-checked]").textContent = `Đồng bộ lúc ${dateText(data.checkedAt)}`;
      page.querySelector("[data-support-wall]").innerHTML = data.recent?.length ? data.recent.map(item => `<article><div><span>${escapeHtml(item.name).split(/\s+/).slice(-2).map(part => part[0]).join("").toUpperCase()}</span><div><strong>${escapeHtml(item.name)}</strong><small>${dateText(item.verifiedAt || item.createdAt)}</small></div><b>${money(item.amount)}</b></div>${item.message ? `<p>${escapeHtml(item.message)}</p>` : ""}</article>`).join("") : '<p class="support-empty">Chưa có giao dịch được xác nhận.</p>';
      page.querySelector("[data-support-leaderboard]").innerHTML = data.leaderboard?.length ? data.leaderboard.map((item, index) => `<article><span>${index + 1}</span><div><strong>${escapeHtml(item.name)}</strong><small>${item.donations} lần ủng hộ</small></div><b>${money(item.amount)}</b></article>`).join("") : '<p class="support-empty">Danh sách sẽ xuất hiện sau khi đối soát.</p>';
      renderHeroSatellites();
      renderSupporterGalaxy();
      renderImpact();
      renderMissionLog();
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
    const renderHistory = items => {
      const list = page.querySelector("[data-support-history-list]");
      const labels = { pending: "Chờ thanh toán", submitted: "Chờ đối soát", verified: "Đã xác minh", refunded: "Đã hoàn tiền", rejected: "Từ chối", payment_error: "Lỗi tạo thanh toán" };
      list.innerHTML = items.length ? items.map(item => `<article><div><strong>${escapeHtml(item.reference)}</strong><small>${dateText(item.createdAt)}</small></div><b>${money(item.amount)}</b><span class="support-status support-status--${escapeHtml(item.status)}">${labels[item.status] || escapeHtml(item.status)}</span>${item.refund ? `<small>Hoàn tiền: ${escapeHtml(item.refund.status || "đang chờ provider")}${item.refund.providerReference ? ` · ${escapeHtml(item.refund.providerReference)}` : ""}</small>` : ""}</article>`).join("") : '<p class="support-empty">Tài khoản này chưa có giao dịch ủng hộ.</p>';
    };
    const loadHistory = async () => {
      try { const data = await api("?history=1"); renderHistory(data.donations || []); }
      catch { page.querySelector("[data-support-history-list]").innerHTML = '<p class="support-empty">Đăng nhập để đồng bộ lịch sử ủng hộ của chính bạn.</p>'; }
    };
    const renderAdmin = filter => {
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
    const loadAdmin = async () => {
      try { const data = await api("?admin=1"); adminItems = data.donations || []; page.querySelector("[data-support-admin]").hidden = false; renderAdmin(page.querySelector("[data-support-admin-filter]").value); }
      catch { page.querySelector("[data-support-admin]").hidden = true; }
    };

    page.addEventListener("click", async event => {
      const preset = event.target.closest("[data-support-preset]"); if (preset) return updateAmount(Number(preset.dataset.supportPreset));
      const scrollDonate = event.target.closest("[data-support-scroll-donate]"); if (scrollDonate) {
        const detailsPanel = page.querySelector('[data-support-stage-panel="details"]');
        detailsPanel?.scrollIntoView({ behavior: page.dataset.effects === "cinematic" ? "smooth" : "auto", block: "start" });
        page.querySelector("[data-support-amount]")?.focus({ preventScroll: true });
        return;
      }
      const effectButton = event.target.closest("[data-support-effect]"); if (effectButton) {
        page.dataset.effects = effectButton.dataset.supportEffect;
        page.querySelectorAll("[data-support-effect]").forEach(button => button.classList.toggle("active", button === effectButton));
        saveGalaxyPreferences();
        return;
      }
      const supporterButton = event.target.closest("[data-supporter-filter]"); if (supporterButton) {
        supporterFilter = supporterButton.dataset.supporterFilter;
        page.querySelectorAll("[data-supporter-filter]").forEach(button => button.classList.toggle("active", button === supporterButton));
        renderSupporterGalaxy();
        return;
      }
      const impactCard = event.target.closest("[data-impact-key]"); if (impactCard) {
        const descriptions = {
          server: "Máy chủ · runtime, giám sát và khả năng phục vụ ổn định.",
          ai: "Dịch vụ AI · credits cho model, tạo nội dung và các API cần thiết.",
          domain: "Tên miền · DNS, TLS và các chi phí duy trì địa chỉ nhhoang13all.xyz.",
          storage: "Lưu trữ · media, bản sao an toàn và dữ liệu vận hành tối thiểu.",
          product: "Phát triển · thời gian xây tính năng, sửa lỗi và bảo mật.",
          community: "Công cụ cộng đồng · các module miễn phí phục vụ người dùng."
        };
        page.querySelector("[data-support-impact-detail]").textContent = descriptions[impactCard.dataset.impactKey] || "Khoản phân bổ theo kế hoạch ngân sách công khai.";
        page.querySelectorAll("[data-impact-key]").forEach(card => card.classList.toggle("is-selected", card === impactCard));
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
        const receipt = currentDonation.receipt || {};
        downloadText(`xac-nhan-ung-ho-${currentDonation.reference}.txt`, `XÁC NHẬN ỦNG HỘ HH PLATFORM\n\nMã xác nhận: ${receipt.receiptId || `HH-RCP-${currentDonation.reference}`}\nMã giao dịch: ${currentDonation.reference}\nSố tiền: ${money(currentDonation.amount)}\nXác nhận lúc: ${dateText(currentDonation.verifiedAt)}\nTrạng thái email: ${receipt.status === "sent" ? "Đã gửi" : "Đang xử lý"}\n\nCảm ơn bạn đã đồng hành cùng Nhhoang.\nĐây là xác nhận ủng hộ, không phải hóa đơn tài chính.`);
        return;
      }
      if (event.target.closest("[data-support-download-receipt-pdf]") && currentDonation?.status === "verified") {
        const details = receiptDetails();
        downloadReceiptPdf(`cosmic-receipt-${details.reference}.pdf`, ["HH PLATFORM - COSMIC RECEIPT", "Thank you for supporting HH Platform.", `Amount: ${money(details.amount)}`, `Receipt: ${details.id}`, `Reference: ${details.reference}`, `Email: ${details.email}`, `Verified: ${dateText(details.verifiedAt)}`]);
        return;
      }
      if (event.target.closest("[data-support-download-card]") && currentDonation?.status === "verified") {
        try { const blob = await createTributeCard(); if (blob) downloadBlob(`cosmic-receipt-${currentDonation.reference}.png`, blob); }
        catch (error) { setFormStatus(error.message, "error"); }
        return;
      }
      if (event.target.closest("[data-support-share-card]") && currentDonation?.status === "verified") {
        try { await shareTributeCard(); }
        catch (error) { if (error?.name !== "AbortError") setFormStatus(error.message, "error"); }
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
    page.querySelector("[data-support-admin-filter]").addEventListener("change", event => renderAdmin(event.target.value));
    page.querySelector("[data-support-theme]")?.addEventListener("change", event => { page.dataset.theme = event.target.value; saveGalaxyPreferences(); });
    visibilityHandler = () => page.classList.toggle("is-paused", document.hidden);
    document.addEventListener("visibilitychange", visibilityHandler, { passive: true });
    page.querySelector("[data-support-form]").addEventListener("submit", async event => {
      event.preventDefault(); const button = event.submitter || submitButton; button.disabled = true; button.textContent = "Đang mở cổng…";
      try {
        const data = await api("", { method: "POST", body: { action: "payos:create", amount: selectedAmount(), donorName: page.querySelector("[data-support-name]").value, email: page.querySelector("[data-support-email]").value, message: page.querySelector("[data-support-message]").value, anonymous: page.querySelector("[data-support-anonymous]").checked } });
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
      finally { button.disabled = !payOSAvailable; button.innerHTML = "<span>Mở cổng VietQR</span><i aria-hidden=\"true\">→</i>"; }
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
        updatePaymentSummary();
        page.querySelector("[data-support-payos-title]").textContent = `Giao dịch ${currentDonation.reference}`;
        page.querySelector("[data-support-payos-status]").textContent = "Đang khôi phục VietQR và trạng thái giao dịch gần nhất.";
        const fallback = page.querySelector("[data-support-payos-fallback]");
        fallback.href = currentDonation.checkoutUrl;
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
    if (visibilityHandler) {
      document.removeEventListener("visibilitychange", visibilityHandler);
      visibilityHandler = null;
    }
  }

  return Object.freeze({ VERSION, INTEGRATION_VERSION, STORAGE_KEY, isPayOSCheckoutUrl, normalizePending, donationLifecycle, createPayOSCheckoutAdapter, mount, unmount });
});
