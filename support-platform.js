(() => {
  "use strict";

  let refreshTimer = 0;
  let paymentPollTimer = 0;

  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const money = value => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(Number(value) || 0);
  const dateText = value => value ? new Date(value).toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" }) : "--";
  const getUser = () => { try { return JSON.parse(localStorage.getItem("hh-auth-user") || "{}"); } catch { return {}; } };
  const downloadText = (name, content) => { const anchor = document.createElement("a"); anchor.href = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" })); anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(anchor.href), 1200); };

  function markup(user) {
    const presets = [20000, 50000, 100000, 200000, 500000, 1000000];
    return `<section class="support-page" data-support-page>
      <section class="support-overview">
        <div class="support-overview__copy"><p class="section-kicker">HH DEVELOPER SUPPORT</p><h2>Cùng duy trì và phát triển HH Platform</h2><p>Mỗi khoản ủng hộ giúp duy trì máy chủ, dịch vụ AI, tên miền và thời gian phát triển các công cụ miễn phí cho cộng đồng.</p><div class="support-trust"><span>✓ Minh bạch giao dịch</span><span>✓ VietQR tự động qua payOS</span><span data-support-email-trust>✓ Email cảm ơn sau xác minh</span><span>✓ Không lưu dữ liệu ngân hàng</span></div></div>
        <div class="support-goal"><header><span>Mục tiêu phát triển</span><strong data-support-progress-label>0%</strong></header><div class="support-goal__amount"><strong data-support-total>0 ₫</strong><span>/ <b data-support-goal>10.000.000 ₫</b></span></div><i><b data-support-progress></b></i><footer><span><b data-support-count>0</b> lượt đã xác nhận</span><span>Tháng này <b data-support-month>0 ₫</b></span></footer></div>
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
          <header><div><span>Bước 1</span><h3>Chọn mức ủng hộ</h3></div><span class="support-secure">Bảo mật phía máy chủ</span></header>
          <form data-support-form>
            <div class="support-auto-method" data-support-auto-method><div class="support-auto-method__icon">QR</div><div><span>VIETQR TỰ ĐỘNG QUA PAYOS</span><strong>Thanh toán an toàn ngay trong HH Platform</strong><small data-support-payos-availability>Đang kiểm tra kết nối payOS…</small></div><i data-support-provider-state></i></div>
            <div class="support-presets">${presets.map((amount, index) => `<button type="button" class="${index === 2 ? "active" : ""}" data-support-preset="${amount}">${money(amount)}</button>`).join("")}</div>
            <label class="support-amount-field"><span>Số tiền tùy chỉnh</span><div><b>₫</b><input type="number" min="1000" max="1000000000" step="1000" value="100000" data-support-amount required></div><small>Tối thiểu 1.000đ</small></label>
            <div class="support-form-grid"><label><span>Tên hiển thị</span><input data-support-name maxlength="100" value="${escapeHtml(user.name || "")}" placeholder="Tên của bạn" required></label><label><span>Email nhận lời cảm ơn (không công khai)</span><input type="email" data-support-email maxlength="160" value="${escapeHtml(user.email || "")}" placeholder="you@gmail.com" autocomplete="email" required><small>Thư chỉ gửi sau khi thanh toán được xác minh.</small></label></div>
            <label><span>Lời nhắn tới nhà phát triển</span><textarea rows="4" maxlength="500" data-support-message placeholder="Cảm ơn bạn đã xây dựng các công cụ hữu ích..."></textarea><small><b data-support-message-count>0</b>/500 ký tự</small></label>
            <label class="support-check"><input type="checkbox" data-support-anonymous><span><b>Ủng hộ ẩn danh</b><small>Tên của bạn sẽ không xuất hiện công khai.</small></span></label>
            <button class="support-primary" type="submit" disabled>Tiếp tục tới VietQR</button>
            <p class="support-form-status" data-support-form-status>Đang kết nối kênh VietQR tự động…</p>
          </form>
        </main>
      </div>

      <section class="support-payos-stage" data-support-payos data-support-stage-panel="payment" hidden>
        <header><div><span>BƯỚC 2 · VIETQR PAYOS</span><h3 data-support-payos-title>Đang tạo giao diện thanh toán</h3><p data-support-payos-status>Mã VietQR sẽ xuất hiện ngay tại đây, không mở sang website khác.</p></div><div class="support-live-badge"><i></i> Tự động đối soát</div></header>
        <div class="support-payos-embed" id="hh-payos-embedded" data-support-payos-embed><div class="support-payos-loading"><i></i><strong>Đang tải VietQR bảo mật</strong><span>Vui lòng giữ trang này mở trong vài giây.</span></div></div>
        <footer><button type="button" data-support-new-payment>Thay đổi thông tin</button><a href="#" target="_blank" rel="noopener" data-support-payos-fallback hidden>Mở payOS trong tab mới</a></footer>
      </section>

      <section class="support-verify-stage" data-support-stage-panel="verify" hidden>
        <div class="support-verify-stage__pulse"><i></i><b>3</b></div><div><span>BƯỚC 3 · XÁC MINH TỰ ĐỘNG</span><h3 data-support-verify-title>Đang chờ ngân hàng xác nhận</h3><p data-support-verify-status>Webhook payOS đang đối chiếu mã giao dịch và số tiền. Bạn không cần tải lại trang.</p></div><button type="button" data-support-payos-check>Kiểm tra ngay</button>
      </section>

      <section class="support-receipt" data-support-receipt data-support-stage-panel="email" hidden>
        <div class="support-receipt__icon">✓</div>
        <div><span>XÁC NHẬN ỦNG HỘ</span><h3>Cảm ơn bạn đã đồng hành cùng Nhhoang</h3><p data-support-receipt-status>Đang hoàn tất thư cảm ơn.</p></div>
        <dl><div><dt>Mã xác nhận</dt><dd data-support-receipt-id>--</dd></div><div><dt>Số tiền</dt><dd data-support-receipt-amount>--</dd></div><div><dt>Email</dt><dd data-support-receipt-email>--</dd></div><div><dt>Xác nhận lúc</dt><dd data-support-receipt-time>--</dd></div></dl>
        <button type="button" data-support-download-receipt>Tải xác nhận</button>
      </section>
      </div>

      <div class="support-community-grid">
        <section class="support-wall"><header><div><span>Cộng đồng</span><h3>Lời nhắn gần đây</h3></div><button type="button" data-support-refresh>Làm mới</button></header><div data-support-wall><p class="support-empty">Chưa có giao dịch được xác nhận.</p></div></section>
        <section class="support-leaderboard"><header><div><span>Top supporters</span><h3>Bảng tri ân</h3></div></header><div data-support-leaderboard><p class="support-empty">Danh sách sẽ xuất hiện sau khi đối soát.</p></div></section>
      </div>

      <section class="support-transparency"><div><p class="section-kicker">MINH BẠCH</p><h3>Nguồn lực được sử dụng như thế nào?</h3><p>Mục tiêu là duy trì nền tảng ổn định, bảo vệ dữ liệu người dùng và tiếp tục phát triển công cụ miễn phí.</p></div><div class="support-allocation"><span style="--allocation:40%"><b>40%</b>Hosting & database</span><span style="--allocation:30%"><b>30%</b>AI & API services</span><span style="--allocation:20%"><b>20%</b>Phát triển sản phẩm</span><span style="--allocation:10%"><b>10%</b>Dự phòng vận hành</span></div></section>

      <section class="support-faq"><h3>Câu hỏi thường gặp</h3><details><summary>Khi nào khoản ủng hộ xuất hiện công khai?</summary><p>Khoản ủng hộ xuất hiện sau khi webhook payOS xác minh chữ ký, mã đơn và số tiền thành công.</p></details><details><summary>Khi nào tôi nhận được email cảm ơn?</summary><p>Ngay sau khi máy chủ xác minh đúng giao dịch. Email có mã xác nhận riêng; webhook gọi lại nhiều lần cũng không gửi trùng.</p></details><details><summary>Tại sao số tiền chưa được cộng ngay?</summary><p>Hệ thống chỉ cộng giao dịch có chữ ký hợp lệ, đúng mã đơn và đúng số tiền. Điều này ngăn số liệu giả và giao dịch bị tính hai lần.</p></details><details><summary>Thông tin nào được công khai?</summary><p>Chỉ tên hiển thị, số tiền và lời nhắn. Email, tài khoản đăng nhập và thông tin đối soát không bao giờ xuất hiện trên bảng công khai.</p></details><details><summary>Tôi có thể ủng hộ ẩn danh không?</summary><p>Có. Chọn “Ủng hộ ẩn danh” trước khi tạo giao dịch.</p></details></section>

      <section class="support-admin" data-support-admin hidden>
        <header><div><p class="section-kicker">OWNER CONTROL</p><h3>Đối soát giao dịch ủng hộ</h3><p>Chỉ email chủ sở hữu được API trả danh sách này.</p></div><button type="button" data-support-admin-refresh>Làm mới</button></header>
        <div class="support-admin-toolbar"><label>Trạng thái<select data-support-admin-filter><option value="all">Tất cả</option><option value="submitted">Đã báo chuyển</option><option value="pending">Chờ chuyển</option><option value="verified">Đã xác nhận</option><option value="rejected">Từ chối</option></select></label><span data-support-admin-count>0 giao dịch</span></div>
        <div class="support-admin-list" data-support-admin-list></div>
      </section>
    </section>`;
  }

  async function mount(container, options = {}) {
    clearInterval(refreshTimer);
    clearInterval(paymentPollTimer);
    const apiBase = String(options.apiBase || "").replace(/\/$/, "");
    const user = getUser();
    container.innerHTML = markup(user);
    const page = container.querySelector("[data-support-page]");
    let currentDonation = null;
    let adminItems = [];
    let payOSAvailable = false;
    let flowStage = "details";
    let checkoutController = null;

    const api = async (path = "", request = {}) => {
      if (!apiBase) throw new Error("Backend donate chưa được cấu hình.");
      const token = localStorage.getItem("hh-auth-token") || "";
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
    const updateAmount = amount => { page.querySelector("[data-support-amount]").value = amount; page.querySelectorAll("[data-support-preset]").forEach(button => button.classList.toggle("active", Number(button.dataset.supportPreset) === Number(amount))); };
    const pendingKey = "hh-payos-pending";
    const submitButton = page.querySelector("[data-support-form] button[type=submit]");
    const stopPaymentPolling = () => { clearInterval(paymentPollTimer); paymentPollTimer = 0; };
    const closeEmbeddedCheckout = () => {
      try { checkoutController?.exit?.(); } catch { /* payOS may already have closed the embedded frame. */ }
      checkoutController = null;
      const embed = page.querySelector("[data-support-payos-embed]");
      if (embed) embed.innerHTML = '<div class="support-payos-loading"><i></i><strong>Đang tải VietQR bảo mật</strong><span>Vui lòng giữ trang này mở trong vài giây.</span></div>';
    };
    const rememberPending = donation => {
      try { sessionStorage.setItem(pendingKey, JSON.stringify(donation)); } catch { /* Storage may be unavailable in private mode. */ }
    };
    const forgetPending = () => {
      try { sessionStorage.removeItem(pendingKey); } catch { /* Storage may be unavailable in private mode. */ }
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
        if (scroll) activePanel.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };
    const waitForPayOS = async () => {
      const deadline = Date.now() + 8000;
      while (!window.PayOSCheckout?.usePayOS && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
      if (!window.PayOSCheckout?.usePayOS) throw new Error("Không tải được giao diện payOS. Hãy kiểm tra kết nối mạng rồi thử lại.");
      return window.PayOSCheckout;
    };
    const openEmbeddedCheckout = async checkoutUrl => {
      const sdk = await waitForPayOS();
      closeEmbeddedCheckout();
      const returnUrl = new URL(window.location.pathname || "/", window.location.origin).href;
      checkoutController = sdk.usePayOS({
        RETURN_URL: returnUrl,
        ELEMENT_ID: "hh-payos-embedded",
        CHECKOUT_URL: checkoutUrl,
        embedded: true,
        onSuccess: async () => {
          showStage("verify");
          page.querySelector("[data-support-verify-title]").textContent = "Ngân hàng đã ghi nhận thanh toán";
          page.querySelector("[data-support-verify-status]").textContent = "Đang xác minh chữ ký webhook và hoàn tất email cảm ơn…";
          await checkCurrentDonation(true);
          beginPaymentPolling();
        },
        onCancel: () => {
          stopPaymentPolling();
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
      checkoutController.open();
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
      checkCurrentDonation(true);
      paymentPollTimer = window.setInterval(() => {
        if (!document.contains(page)) return stopPaymentPolling();
        if (currentDonation?.pollUntil && Date.now() > Number(currentDonation.pollUntil)) {
          stopPaymentPolling();
          if (flowStage === "payment") page.querySelector("[data-support-payos-status]").textContent = "VietQR đã hết thời gian chờ. Hãy quay lại và tạo giao dịch mới.";
          page.querySelector("[data-support-verify-status]").textContent = "Giao dịch đã hết thời gian chờ. Hãy tạo VietQR mới nếu chưa thanh toán.";
          return;
        }
        if (!document.hidden) checkCurrentDonation(true);
      }, 5000);
    };

    const renderPublic = data => {
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
    const renderAdmin = filter => {
      const list = filter && filter !== "all" ? adminItems.filter(item => item.status === filter) : adminItems;
      page.querySelector("[data-support-admin-count]").textContent = `${list.length} giao dịch`;
      const receiptLabels = { sent: "Đã gửi", sending: "Đang gửi", failed: "Gửi lỗi", not_configured: "Chưa cấu hình", missing_email: "Thiếu email", pending: "Đang chờ", waiting_payment: "Chờ thanh toán" };
      page.querySelector("[data-support-admin-list]").innerHTML = list.length ? list.map(item => {
        const receipt = item.receipt || {};
        const canRetry = item.status === "verified" && receipt.status !== "sent";
        return `<article data-donation-id="${escapeHtml(item.id)}"><header><div><strong>${escapeHtml(item.donorName)}</strong><span>${escapeHtml(item.reference)}</span></div><b>${money(item.amount)}</b></header><p>${escapeHtml(item.message || "Không có lời nhắn")}</p><dl><div><dt>Email</dt><dd>${escapeHtml(item.email || "--")}</dd></div><div><dt>Tạo lúc</dt><dd>${dateText(item.createdAt)}</dd></div><div><dt>Đã báo chuyển</dt><dd>${dateText(item.submittedAt)}</dd></div><div><dt>Trạng thái</dt><dd><span class="support-status support-status--${escapeHtml(item.status)}">${({ pending: "Chờ chuyển", submitted: "Đã báo chuyển", verified: "Đã xác nhận", rejected: "Từ chối" })[item.status] || item.status}</span></dd></div><div><dt>Thư cảm ơn</dt><dd><span class="support-status support-status--receipt-${escapeHtml(receipt.status)}">${receiptLabels[receipt.status] || receipt.status || "Đang chờ"}</span></dd></div><div><dt>Gửi lúc</dt><dd>${dateText(receipt.sentAt)}</dd></div></dl>${receipt.lastError ? `<p class="support-admin-error">${escapeHtml(receipt.lastError)}</p>` : ""}<footer><button type="button" data-support-admin-action="verified">Xác nhận đã nhận</button>${canRetry ? '<button type="button" data-support-receipt-retry>Gửi lại email</button>' : ""}<button type="button" data-support-admin-action="pending">Đưa về chờ</button><button class="danger" type="button" data-support-admin-action="rejected">Từ chối</button></footer></article>`;
      }).join("") : '<p class="support-empty">Không có giao dịch ở trạng thái này.</p>';
    };
    const loadAdmin = async () => {
      try { const data = await api("?admin=1"); adminItems = data.donations || []; page.querySelector("[data-support-admin]").hidden = false; renderAdmin(page.querySelector("[data-support-admin-filter]").value); }
      catch { page.querySelector("[data-support-admin]").hidden = true; }
    };

    page.addEventListener("click", async event => {
      const preset = event.target.closest("[data-support-preset]"); if (preset) return updateAmount(Number(preset.dataset.supportPreset));
      if (event.target.closest("[data-support-payos-check]")) { await checkCurrentDonation(); return; }
      if (event.target.closest("[data-support-new-payment]")) {
        stopPaymentPolling();
        closeEmbeddedCheckout();
        forgetPending();
        currentDonation = null;
        showStage("details");
        setFormStatus("Có thể thay đổi thông tin và tạo một VietQR mới.");
        return;
      }
      if (event.target.closest("[data-support-refresh]")) return loadPublic();
      if (event.target.closest("[data-support-admin-refresh]")) return loadAdmin();
      if (event.target.closest("[data-support-download-receipt]") && currentDonation?.status === "verified") {
        const receipt = currentDonation.receipt || {};
        downloadText(`xac-nhan-ung-ho-${currentDonation.reference}.txt`, `XÁC NHẬN ỦNG HỘ HH PLATFORM\n\nMã xác nhận: ${receipt.receiptId || `HH-RCP-${currentDonation.reference}`}\nMã giao dịch: ${currentDonation.reference}\nSố tiền: ${money(currentDonation.amount)}\nXác nhận lúc: ${dateText(currentDonation.verifiedAt)}\nTrạng thái email: ${receipt.status === "sent" ? "Đã gửi" : "Đang xử lý"}\n\nCảm ơn bạn đã đồng hành cùng Nhhoang.\nĐây là xác nhận ủng hộ, không phải hóa đơn tài chính.`);
        return;
      }
      const receiptRetry = event.target.closest("[data-support-receipt-retry]"); if (receiptRetry) {
        const row = receiptRetry.closest("[data-donation-id]"); receiptRetry.disabled = true;
        try { const data = await api("", { method: "POST", body: { action: "receipt:retry", id: row.dataset.donationId } }); setFormStatus(data.receipt?.status === "sent" ? "Email cảm ơn đã được gửi thành công." : "Yêu cầu gửi email đã được xử lý.", data.receipt?.status === "sent" ? "success" : ""); await loadAdmin(); }
        catch (error) { setFormStatus(error.message, "error"); receiptRetry.disabled = false; }
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
    page.querySelector("[data-support-form]").addEventListener("submit", async event => {
      event.preventDefault(); const button = event.submitter || submitButton; button.disabled = true; button.textContent = "Đang tạo VietQR…";
      try {
        const data = await api("", { method: "POST", body: { action: "payos:create", amount: selectedAmount(), donorName: page.querySelector("[data-support-name]").value, email: page.querySelector("[data-support-email]").value, message: page.querySelector("[data-support-message]").value, anonymous: page.querySelector("[data-support-anonymous]").checked } });
        const checkoutUrl = String(data.payos?.checkoutUrl || "");
        if (!checkoutUrl.startsWith("https://")) throw new Error("payOS chưa trả về giao diện VietQR hợp lệ.");
        currentDonation = { ...data.donation, checkoutUrl, pollUntil: Date.now() + (Number(data.payos?.expiresIn) || 1800) * 1000 };
        rememberPending(currentDonation);
        page.querySelector("[data-support-payos-title]").textContent = `Giao dịch ${currentDonation.reference}`;
        page.querySelector("[data-support-payos-status]").textContent = "Quét VietQR bên dưới bằng ứng dụng ngân hàng. Website sẽ tự chuyển bước sau khi thanh toán.";
        const fallback = page.querySelector("[data-support-payos-fallback]");
        fallback.href = checkoutUrl;
        fallback.hidden = true;
        showStage("payment");
        try { await openEmbeddedCheckout(checkoutUrl); }
        catch (embedError) {
          fallback.hidden = false;
          page.querySelector("[data-support-payos-status]").textContent = `${embedError.message} Bạn vẫn có thể mở VietQR payOS bằng nút dự phòng bên dưới.`;
        }
        beginPaymentPolling();
      } catch (error) { showStage("details", false); setFormStatus(error.message, "error"); }
      finally { button.disabled = !payOSAvailable; button.textContent = "Tiếp tục tới VietQR"; }
    });

    updateAmount(100000);
    showStage("details", false);
    await Promise.all([loadPublic(), loadAdmin()]);
    try {
      const saved = JSON.parse(sessionStorage.getItem(pendingKey) || "null");
      if (saved?.id && saved?.reference && saved?.checkoutUrl && payOSAvailable) {
        currentDonation = saved;
        page.querySelector("[data-support-payos-title]").textContent = `Giao dịch ${currentDonation.reference}`;
        page.querySelector("[data-support-payos-status]").textContent = "Đang khôi phục VietQR và trạng thái giao dịch gần nhất.";
        const fallback = page.querySelector("[data-support-payos-fallback]");
        fallback.href = currentDonation.checkoutUrl;
        showStage("payment", false);
        try { await openEmbeddedCheckout(currentDonation.checkoutUrl); }
        catch { fallback.hidden = false; }
        beginPaymentPolling();
      } else if (saved) forgetPending();
    } catch { forgetPending(); }
    refreshTimer = window.setInterval(() => {
      if (!document.contains(page)) return clearInterval(refreshTimer);
      if (!document.hidden) loadPublic();
    }, 30000);
  }

  window.HHSupportPage = { mount };
})();
