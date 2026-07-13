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
        <div class="support-overview__copy"><p class="section-kicker">HH DEVELOPER SUPPORT</p><h2>Cùng duy trì và phát triển HH Platform</h2><p>Mỗi khoản ủng hộ giúp duy trì máy chủ, dịch vụ AI, tên miền và thời gian phát triển các công cụ miễn phí cho cộng đồng.</p><div class="support-trust"><span>✓ Minh bạch giao dịch</span><span>✓ VietQR tự động qua payOS</span><span>✓ Không lưu dữ liệu ngân hàng</span></div></div>
        <div class="support-goal"><header><span>Mục tiêu phát triển</span><strong data-support-progress-label>0%</strong></header><div class="support-goal__amount"><strong data-support-total>0 ₫</strong><span>/ <b data-support-goal>10.000.000 ₫</b></span></div><i><b data-support-progress></b></i><footer><span><b data-support-count>0</b> lượt đã xác nhận</span><span>Tháng này <b data-support-month>0 ₫</b></span></footer></div>
      </section>

      <div class="support-metrics"><article><span>Tổng đã nhận</span><strong data-support-total-card>0 ₫</strong><small>Chỉ tính giao dịch đã đối soát</small></article><article><span>Người ủng hộ</span><strong data-support-count-card>0</strong><small>Cảm ơn cộng đồng HH</small></article><article><span>Ủng hộ trung bình</span><strong data-support-average>0 ₫</strong><small>Mỗi giao dịch đã xác nhận</small></article><article><span>Trạng thái</span><strong class="is-online">Đang hoạt động</strong><small data-support-checked>Cập nhật tự động 30 giây/lần</small></article></div>

      <div class="support-main-grid">
        <main class="support-donate-panel">
          <header><div><span>Bước 1</span><h3>Chọn mức ủng hộ</h3></div><span class="support-secure">Bảo mật phía máy chủ</span></header>
          <form data-support-form>
            <div class="support-methods" aria-label="Phương thức ủng hộ">
              <button type="button" class="active" data-support-method="manual"><span>Chuyển khoản thường</span><small>Quét QR và chủ sở hữu đối soát</small></button>
              <button type="button" data-support-method="payos" disabled><span>VietQR tự động</span><small data-support-payos-availability>Đang chờ cấu hình payOS</small></button>
            </div>
            <div class="support-presets">${presets.map((amount, index) => `<button type="button" class="${index === 2 ? "active" : ""}" data-support-preset="${amount}">${money(amount)}</button>`).join("")}</div>
            <label class="support-amount-field"><span>Số tiền tùy chỉnh</span><div><b>₫</b><input type="number" min="1000" max="1000000000" step="1000" value="100000" data-support-amount required></div><small>Tối thiểu 1.000đ</small></label>
            <div class="support-form-grid"><label><span>Tên hiển thị</span><input data-support-name maxlength="100" value="${escapeHtml(user.name || "")}" placeholder="Tên của bạn" required></label><label><span>Email đối soát (không công khai)</span><input type="email" data-support-email maxlength="160" value="${escapeHtml(user.email || "")}" placeholder="you@gmail.com"></label></div>
            <label><span>Lời nhắn tới nhà phát triển</span><textarea rows="4" maxlength="500" data-support-message placeholder="Cảm ơn bạn đã xây dựng các công cụ hữu ích..."></textarea><small><b data-support-message-count>0</b>/500 ký tự</small></label>
            <label class="support-check"><input type="checkbox" data-support-anonymous><span><b>Ủng hộ ẩn danh</b><small>Tên của bạn sẽ không xuất hiện công khai.</small></span></label>
            <button class="support-primary" type="submit">Tạo thông tin chuyển khoản</button>
            <p class="support-form-status" data-support-form-status>Số tiền chỉ được cộng vào thống kê sau khi chủ sở hữu xác nhận đã nhận.</p>
          </form>
        </main>

        <aside class="support-bank-card" data-support-bank-card>
          <header><div><span>Bước 2</span><h3 data-support-bank-title>Quét QR chuyển khoản</h3></div><strong data-support-bank-badge>Vietcombank</strong></header>
          <div class="support-qr-wrap"><img src="assets/vietcombank-donate-qr.jpg" alt="Mã QR Vietcombank của Nguyễn Huy Hoàng"></div>
          <dl><div><dt>Chủ tài khoản</dt><dd>NGUYEN HUY HOANG</dd></div><div><dt>Số tài khoản</dt><dd><span>1030351658</span><button type="button" data-support-copy="1030351658">Sao chép</button></dd></div><div><dt>Số tiền</dt><dd data-support-bank-amount>100.000 ₫</dd></div><div><dt>Nội dung</dt><dd><span data-support-reference>Chưa tạo mã</span><button type="button" data-support-copy-reference disabled>Sao chép</button></dd></div></dl>
          <p>QR dùng để chọn đúng tài khoản. Hãy nhập chính xác số tiền và nội dung được tạo ở bước 1.</p>
        </aside>
      </div>

      <section class="support-payos-checkout" data-support-payos hidden>
        <div class="support-payos-checkout__mark">VietQR</div>
        <div><span>THANH TOÁN TỰ ĐỘNG</span><h3 data-support-payos-title>Sẵn sàng mở cổng thanh toán</h3><p data-support-payos-status>payOS sẽ tạo mã QR đúng số tiền và tự động xác nhận sau khi ngân hàng báo thành công.</p></div>
        <div class="support-payos-checkout__actions"><a class="support-primary" href="#" target="_blank" rel="noopener" data-support-payos-open>Mở cổng thanh toán</a><button type="button" data-support-payos-check>Kiểm tra trạng thái</button></div>
      </section>

      <section class="support-transfer-confirm" data-support-transfer hidden>
        <div><span>Bước 3</span><h3>Xác nhận bạn đã chuyển khoản</h3><p>Thông báo này không tự xác nhận tiền. Chủ sở hữu sẽ kiểm tra sao kê trước khi công khai khoản ủng hộ.</p></div>
        <label>Thời gian chuyển<input type="datetime-local" data-support-transfer-time></label>
        <button class="support-primary" type="button" data-support-submit-transfer>Tôi đã chuyển khoản</button>
        <button type="button" data-support-download-instructions>Tải hướng dẫn</button>
      </section>

      <div class="support-community-grid">
        <section class="support-wall"><header><div><span>Cộng đồng</span><h3>Lời nhắn gần đây</h3></div><button type="button" data-support-refresh>Làm mới</button></header><div data-support-wall><p class="support-empty">Chưa có giao dịch được xác nhận.</p></div></section>
        <section class="support-leaderboard"><header><div><span>Top supporters</span><h3>Bảng tri ân</h3></div></header><div data-support-leaderboard><p class="support-empty">Danh sách sẽ xuất hiện sau khi đối soát.</p></div></section>
      </div>

      <section class="support-transparency"><div><p class="section-kicker">MINH BẠCH</p><h3>Nguồn lực được sử dụng như thế nào?</h3><p>Mục tiêu là duy trì nền tảng ổn định, bảo vệ dữ liệu người dùng và tiếp tục phát triển công cụ miễn phí.</p></div><div class="support-allocation"><span style="--allocation:40%"><b>40%</b>Hosting & database</span><span style="--allocation:30%"><b>30%</b>AI & API services</span><span style="--allocation:20%"><b>20%</b>Phát triển sản phẩm</span><span style="--allocation:10%"><b>10%</b>Dự phòng vận hành</span></div></section>

      <section class="support-faq"><h3>Câu hỏi thường gặp</h3><details><summary>Khi nào khoản ủng hộ xuất hiện công khai?</summary><p>Với VietQR tự động, khoản ủng hộ xuất hiện sau khi webhook payOS xác minh thanh toán thành công. Chuyển khoản thường vẫn cần chủ sở hữu đối soát sao kê.</p></details><details><summary>Tại sao số tiền chưa được cộng ngay?</summary><p>Hệ thống chỉ cộng giao dịch có chữ ký hợp lệ, đúng mã đơn và đúng số tiền. Điều này ngăn số liệu giả và giao dịch bị tính hai lần.</p></details><details><summary>Thông tin nào được công khai?</summary><p>Chỉ tên hiển thị, số tiền và lời nhắn. Email, tài khoản đăng nhập và thông tin đối soát không bao giờ xuất hiện trên bảng công khai.</p></details><details><summary>Tôi có thể ủng hộ ẩn danh không?</summary><p>Có. Chọn “Ủng hộ ẩn danh” trước khi tạo giao dịch.</p></details></section>

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
    let paymentMethod = "manual";
    let payOSAvailable = false;
    let providerInitialized = false;

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
    const updateAmount = amount => { page.querySelector("[data-support-amount]").value = amount; page.querySelector("[data-support-bank-amount]").textContent = money(amount); page.querySelectorAll("[data-support-preset]").forEach(button => button.classList.toggle("active", Number(button.dataset.supportPreset) === Number(amount))); };
    const pendingKey = "hh-payos-pending";
    const submitButton = page.querySelector("[data-support-form] button[type=submit]");
    const stopPaymentPolling = () => { clearInterval(paymentPollTimer); paymentPollTimer = 0; };
    const rememberPending = donation => {
      try { sessionStorage.setItem(pendingKey, JSON.stringify(donation)); } catch { /* Storage may be unavailable in private mode. */ }
    };
    const forgetPending = () => {
      try { sessionStorage.removeItem(pendingKey); } catch { /* Storage may be unavailable in private mode. */ }
    };
    const setMethod = (method, quiet = false) => {
      if (method === "payos" && !payOSAvailable) return;
      paymentMethod = method === "payos" ? "payos" : "manual";
      page.querySelectorAll("[data-support-method]").forEach(button => {
        const active = button.dataset.supportMethod === paymentMethod;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
      });
      page.querySelector("[data-support-bank-card]").classList.toggle("is-secondary", paymentMethod === "payos");
      page.querySelector("[data-support-bank-title]").textContent = paymentMethod === "payos" ? "Chuyển khoản dự phòng" : "Quét QR chuyển khoản";
      page.querySelector("[data-support-bank-badge]").textContent = paymentMethod === "payos" ? "QR dự phòng" : "Vietcombank";
      submitButton.textContent = paymentMethod === "payos" ? "Tiếp tục với payOS" : "Tạo thông tin chuyển khoản";
      if (!quiet) {
        setFormStatus(paymentMethod === "payos" ? "payOS tạo VietQR đúng số tiền và tự xác nhận khi thanh toán thành công." : "Chuyển khoản thường cần chủ sở hữu đối soát trước khi số tiền xuất hiện công khai.");
      }
    };
    const checkCurrentDonation = async (quiet = false) => {
      if (!currentDonation?.id || !currentDonation?.reference) return;
      const panel = page.querySelector("[data-support-payos]");
      const statusNode = page.querySelector("[data-support-payos-status]");
      const checkButton = page.querySelector("[data-support-payos-check]");
      try {
        const data = await api(`?id=${encodeURIComponent(currentDonation.id)}&reference=${encodeURIComponent(currentDonation.reference)}`);
        currentDonation = { ...currentDonation, ...data.donation };
        if (data.donation.status === "verified") {
          stopPaymentPolling();
          forgetPending();
          panel.hidden = false;
          panel.classList.add("is-paid");
          page.querySelector("[data-support-payos-title]").textContent = "Thanh toán đã được xác nhận";
          statusNode.textContent = `Cảm ơn bạn. Giao dịch ${currentDonation.reference} đã được ghi nhận tự động.`;
          checkButton.disabled = true;
          checkButton.textContent = "Đã thanh toán";
          setFormStatus("Thanh toán thành công và đã được cộng vào bảng ủng hộ.", "success");
          await loadPublic();
          return;
        }
        statusNode.textContent = `Giao dịch ${currentDonation.reference} đang chờ ngân hàng xác nhận.`;
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
          page.querySelector("[data-support-payos-status]").textContent = "Link thanh toán đã hết thời gian chờ. Hãy kiểm tra lần cuối hoặc tạo giao dịch mới.";
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
      const payOSButton = page.querySelector('[data-support-method="payos"]');
      payOSButton.disabled = !payOSAvailable;
      page.querySelector("[data-support-payos-availability]").textContent = payOSAvailable ? "Tự xác nhận qua payOS" : "Đang chờ kích hoạt payOS";
      if (!providerInitialized) {
        providerInitialized = true;
        setMethod(payOSAvailable ? "payos" : "manual");
      } else if (!payOSAvailable && paymentMethod === "payos") {
        setMethod("manual", true);
      }
    };

    const loadPublic = async () => { try { renderPublic(await api()); } catch (error) { setFormStatus(error.message, "error"); } };
    const renderAdmin = filter => {
      const list = filter && filter !== "all" ? adminItems.filter(item => item.status === filter) : adminItems;
      page.querySelector("[data-support-admin-count]").textContent = `${list.length} giao dịch`;
      page.querySelector("[data-support-admin-list]").innerHTML = list.length ? list.map(item => `<article data-donation-id="${escapeHtml(item.id)}"><header><div><strong>${escapeHtml(item.donorName)}</strong><span>${escapeHtml(item.reference)}</span></div><b>${money(item.amount)}</b></header><p>${escapeHtml(item.message || "Không có lời nhắn")}</p><dl><div><dt>Email</dt><dd>${escapeHtml(item.email || "--")}</dd></div><div><dt>Tạo lúc</dt><dd>${dateText(item.createdAt)}</dd></div><div><dt>Đã báo chuyển</dt><dd>${dateText(item.submittedAt)}</dd></div><div><dt>Trạng thái</dt><dd><span class="support-status support-status--${escapeHtml(item.status)}">${({ pending: "Chờ chuyển", submitted: "Đã báo chuyển", verified: "Đã xác nhận", rejected: "Từ chối" })[item.status] || item.status}</span></dd></div></dl><footer><button type="button" data-support-admin-action="verified">Xác nhận đã nhận</button><button type="button" data-support-admin-action="pending">Đưa về chờ</button><button class="danger" type="button" data-support-admin-action="rejected">Từ chối</button></footer></article>`).join("") : '<p class="support-empty">Không có giao dịch ở trạng thái này.</p>';
    };
    const loadAdmin = async () => {
      try { const data = await api("?admin=1"); adminItems = data.donations || []; page.querySelector("[data-support-admin]").hidden = false; renderAdmin(page.querySelector("[data-support-admin-filter]").value); }
      catch { page.querySelector("[data-support-admin]").hidden = true; }
    };

    page.addEventListener("click", async event => {
      const method = event.target.closest("[data-support-method]");
      if (method) { if (!method.disabled) setMethod(method.dataset.supportMethod); return; }
      const preset = event.target.closest("[data-support-preset]"); if (preset) return updateAmount(Number(preset.dataset.supportPreset));
      const copy = event.target.closest("[data-support-copy]"); if (copy) { await navigator.clipboard.writeText(copy.dataset.supportCopy); copy.textContent = "Đã sao chép"; return; }
      if (event.target.closest("[data-support-copy-reference]") && currentDonation) { await navigator.clipboard.writeText(currentDonation.reference); setFormStatus("Đã sao chép nội dung chuyển khoản.", "success"); return; }
      if (event.target.closest("[data-support-payos-check]")) { await checkCurrentDonation(); return; }
      if (event.target.closest("[data-support-refresh]")) return loadPublic();
      if (event.target.closest("[data-support-admin-refresh]")) return loadAdmin();
      if (event.target.closest("[data-support-download-instructions]") && currentDonation) { downloadText(`huong-dan-ung-ho-${currentDonation.reference}.txt`, `ỦNG HỘ HH PLATFORM\n\nNgân hàng: Vietcombank\nChủ tài khoản: NGUYEN HUY HOANG\nSố tài khoản: 1030351658\nSố tiền: ${money(currentDonation.amount)}\nNội dung: ${currentDonation.reference}\n\nKhoản ủng hộ sẽ xuất hiện công khai sau khi được đối soát.`); return; }
      if (event.target.closest("[data-support-submit-transfer]") && currentDonation) {
        const button = event.target.closest("[data-support-submit-transfer]"); button.disabled = true;
        try { const data = await api("", { method: "POST", body: { action: "submit", id: currentDonation.id, reference: currentDonation.reference, transferTime: page.querySelector("[data-support-transfer-time]").value } }); setFormStatus(data.message, "success"); page.querySelector("[data-support-transfer]").classList.add("is-submitted"); button.textContent = "Đã gửi để đối soát"; }
        catch (error) { setFormStatus(error.message, "error"); button.disabled = false; }
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
      event.preventDefault(); const button = event.submitter || submitButton; button.disabled = true; button.textContent = paymentMethod === "payos" ? "Đang kết nối payOS..." : "Đang tạo mã...";
      try {
        const data = await api("", { method: "POST", body: { action: paymentMethod === "payos" ? "payos:create" : "create", amount: selectedAmount(), donorName: page.querySelector("[data-support-name]").value, email: page.querySelector("[data-support-email]").value, message: page.querySelector("[data-support-message]").value, anonymous: page.querySelector("[data-support-anonymous]").checked } });
        currentDonation = data.donation;
        page.querySelector("[data-support-reference]").textContent = currentDonation.reference;
        page.querySelector("[data-support-copy-reference]").disabled = false;
        page.querySelector("[data-support-bank-amount]").textContent = money(currentDonation.amount);
        if (paymentMethod === "payos") {
          const checkoutUrl = String(data.payos?.checkoutUrl || "");
          if (!checkoutUrl.startsWith("https://")) throw new Error("payOS chưa trả về cổng thanh toán hợp lệ.");
          currentDonation = { ...currentDonation, checkoutUrl, pollUntil: Date.now() + (Number(data.payos?.expiresIn) || 1800) * 1000 };
          rememberPending(currentDonation);
          page.querySelector("[data-support-transfer]").hidden = true;
          const panel = page.querySelector("[data-support-payos]");
          panel.hidden = false;
          panel.classList.remove("is-paid");
          page.querySelector("[data-support-payos-title]").textContent = `Giao dịch ${currentDonation.reference}`;
          page.querySelector("[data-support-payos-status]").textContent = "Mở cổng payOS, quét VietQR và hoàn tất trong ứng dụng ngân hàng. Trang này sẽ tự cập nhật sau khi thanh toán.";
          page.querySelector("[data-support-payos-open]").href = checkoutUrl;
          const checkButton = page.querySelector("[data-support-payos-check]");
          checkButton.disabled = false;
          checkButton.textContent = "Kiểm tra trạng thái";
          setFormStatus("Cổng thanh toán đã sẵn sàng. Bấm “Mở cổng thanh toán” để tiếp tục.", "success");
          panel.scrollIntoView({ behavior: "smooth", block: "center" });
          beginPaymentPolling();
        } else {
          stopPaymentPolling();
          forgetPending();
          page.querySelector("[data-support-payos]").hidden = true;
          page.querySelector("[data-support-transfer]").hidden = false;
          page.querySelector("[data-support-transfer-time]").value = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
          setFormStatus(`Đã tạo mã ${currentDonation.reference}. Hãy chuyển đúng nội dung này.`, "success");
          page.querySelector("[data-support-transfer]").scrollIntoView({ behavior: "smooth", block: "center" });
        }
      } catch (error) { setFormStatus(error.message, "error"); }
      finally { button.disabled = false; button.textContent = paymentMethod === "payos" ? "Tiếp tục với payOS" : "Tạo thông tin chuyển khoản"; }
    });

    updateAmount(100000);
    await Promise.all([loadPublic(), loadAdmin()]);
    try {
      const saved = JSON.parse(sessionStorage.getItem(pendingKey) || "null");
      if (saved?.id && saved?.reference && saved?.checkoutUrl) {
        currentDonation = saved;
        if (payOSAvailable) setMethod("payos", true);
        const panel = page.querySelector("[data-support-payos]");
        panel.hidden = false;
        page.querySelector("[data-support-payos-title]").textContent = `Giao dịch ${currentDonation.reference}`;
        page.querySelector("[data-support-payos-status]").textContent = "Đang khôi phục và kiểm tra giao dịch payOS gần nhất.";
        page.querySelector("[data-support-payos-open]").href = currentDonation.checkoutUrl;
        beginPaymentPolling();
      }
    } catch { forgetPending(); }
    refreshTimer = window.setInterval(() => {
      if (!document.contains(page)) return clearInterval(refreshTimer);
      if (!document.hidden) loadPublic();
    }, 30000);
  }

  window.HHSupportPage = { mount };
})();
