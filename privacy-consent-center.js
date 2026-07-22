(() => {
  "use strict";

  const STORE_KEY = "hh-consent-preferences.v1";
  const LEGACY_KEY = "hh-tracking-consent";
  const POLICY_VERSION = "privacy-v1-2026-07";
  const API_BASE = String(window.HH_REALTIME_URL || "").replace(/\/$/, "");
  const defaults = Object.freeze({ necessary: true, analytics: false, personalization: false, marketing: false });

  const read = () => {
    try {
      const value = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      if (value && value.policyVersion === POLICY_VERSION) return { ...defaults, ...value.preferences };
      if (localStorage.getItem(LEGACY_KEY) === "yes") return { ...defaults, analytics: true };
    } catch {}
    return null;
  };
  const normalize = (value = {}) => ({ necessary: true, analytics: value.analytics === true, personalization: value.personalization === true, marketing: false });
  const visitorId = () => {
    try {
      const existing = localStorage.getItem("hh-presence-id");
      if (existing) return existing;
      const next = crypto.randomUUID?.() || `hh-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem("hh-presence-id", next);
      return next;
    } catch { return `hh-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
  };
  const token = () => window.HHAuthSession?.token?.() || "";

  function apply(preferences, { persist = true } = {}) {
    const next = normalize(preferences);
    if (persist) {
      try { localStorage.setItem(STORE_KEY, JSON.stringify({ policyVersion: POLICY_VERSION, preferences: next, updatedAt: new Date().toISOString() })); } catch {}
      try { localStorage.setItem(LEGACY_KEY, next.analytics ? "yes" : "no"); } catch {}
    }
    document.documentElement.dataset.analyticsConsent = next.analytics ? "granted" : "denied";
    document.documentElement.dataset.personalizationConsent = next.personalization ? "granted" : "denied";
    window.dispatchEvent(new CustomEvent("hh:privacy-changed", { detail: next }));
    return next;
  }

  async function sync(preferences, source = "privacy-center") {
    const next = apply(preferences);
    if (!API_BASE) return { ok: true, localOnly: true, preferences: next };
    const response = await fetch(`${API_BASE}/api/privacy/consent`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(token() ? { Authorization: `Bearer ${token()}` } : {}) },
      body: JSON.stringify({ preferences: next, visitorId: visitorId(), source })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Không thể lưu lựa chọn quyền riêng tư.");
    return data;
  }

  function preferenceRows(preferences) {
    const rows = [
      ["necessary", "Thiết yếu", "Đăng nhập, bảo mật, lưu lựa chọn và vận hành cơ bản.", true],
      ["analytics", "Phân tích", "Lượt xem, module, thiết bị ở mức khái quát và thao tác đã làm sạch.", preferences.analytics],
      ["personalization", "Cá nhân hóa", "Nhớ workspace, giao diện và gợi ý theo lựa chọn của bạn.", preferences.personalization],
      ["marketing", "Marketing", "HH hiện không bật cookie quảng cáo hoặc bán dữ liệu.", false]
    ];
    return rows.map(([key, label, detail, checked]) => `<label class="hh-consent-row ${key === "necessary" ? "is-required" : ""}"><span><strong>${label}</strong><small>${detail}</small></span><input type="checkbox" data-privacy-toggle="${key}" ${checked ? "checked" : ""} ${key === "necessary" || key === "marketing" ? "disabled" : ""}><i></i></label>`).join("");
  }

  function inventory() {
    return [["hh_session", "Cookie HttpOnly", "Phiên đăng nhập · Admin không đọc được giá trị"], ["hh-consent-preferences.v1", "Local storage", "Nhớ lựa chọn quyền riêng tư trên thiết bị"], ["hh-tracking-consent", "Local storage", "Bật/tắt telemetry đã làm sạch"]].map(([name, type, purpose]) => `<article><code>${name}</code><span>${type}</span><small>${purpose}</small></article>`).join("");
  }

  function markup(preferences) {
    return `<section class="hh-consent-center" data-privacy-center><header class="hh-consent-hero"><div><small>PRIVACY CENTER · ${POLICY_VERSION}</small><h2>Quyền riêng tư nằm trong tay bạn.</h2><p>Chọn dữ liệu nào HH được phép xử lý. Cookie phiên bảo mật không bao giờ hiển thị cho JavaScript hoặc Admin.</p></div><div class="hh-consent-orb"><i></i><strong>HH</strong></div></header><div class="hh-consent-grid"><section class="hh-consent-panel"><header><div><small>CHOICE LAYER</small><h3>Lựa chọn dữ liệu</h3></div><span data-privacy-status>Chưa thay đổi</span></header><div data-privacy-options>${preferenceRows(preferences)}</div><footer><button type="button" data-privacy-refuse>Từ chối tùy chọn</button><button type="button" data-privacy-save class="primary">Lưu lựa chọn</button></footer></section><aside class="hh-consent-panel hh-consent-inventory"><header><div><small>FIRST-PARTY INVENTORY</small><h3>Website đang lưu gì?</h3></div></header><div>${inventory()}</div><p class="hh-consent-boundary"><strong>Không thu thập</strong><span>Mật khẩu, token, giá trị cookie, phím gõ, nội dung prompt/chat, tin nhắn riêng, IP thô hoặc cookie của website khác.</span></p></aside></div><footer class="hh-consent-footer"><span>Phiên bản chính sách: ${POLICY_VERSION}</span><button type="button" data-privacy-reset>Đặt lại lựa chọn trên thiết bị</button><a href="privacy.html">Đọc quyền riêng tư</a></footer></section>`;
  }

  function render(host, preferences = read() || defaults) {
    if (!host) return;
    host.innerHTML = markup(normalize(preferences));
    const status = host.querySelector("[data-privacy-status]");
    const readForm = () => normalize(Object.fromEntries([...host.querySelectorAll("[data-privacy-toggle]")].map((input) => [input.dataset.privacyToggle, input.checked])));
    host.querySelector("[data-privacy-save]")?.addEventListener("click", async () => {
      const button = host.querySelector("[data-privacy-save]");
      button.disabled = true;
      if (status) status.textContent = "Đang lưu...";
      try { await sync(readForm()); if (status) status.textContent = "Đã lưu quyền riêng tư"; window.HHCommunity?.notice?.("Đã lưu lựa chọn quyền riêng tư.", "success"); }
      catch (error) { if (status) status.textContent = error.message; window.HHCommunity?.notice?.(error.message, "error"); }
      finally { button.disabled = false; }
    });
    host.querySelector("[data-privacy-refuse]")?.addEventListener("click", async () => {
      try { await sync(defaults, "privacy-refuse"); render(host, defaults); window.HHCommunity?.notice?.("Đã tắt dữ liệu phân tích và cá nhân hóa.", "success"); }
      catch (error) { if (status) status.textContent = error.message; }
    });
    host.querySelector("[data-privacy-reset]")?.addEventListener("click", () => {
      try { localStorage.removeItem(STORE_KEY); localStorage.removeItem(LEGACY_KEY); } catch {}
      render(host, defaults);
      window.HHCommunity?.notice?.("Đã đặt lại lựa chọn trên thiết bị.", "success");
    });
  }

  function showBanner() {
    if (read() || document.querySelector("[data-privacy-banner]")) return;
    const banner = document.createElement("aside");
    banner.className = "hh-consent-banner";
    banner.dataset.privacyBanner = "";
    banner.innerHTML = `<div><small>HH PRIVACY</small><strong>Bạn kiểm soát dữ liệu của mình.</strong><p>Cookie thiết yếu giúp website hoạt động. Phân tích và cá nhân hóa chỉ bật khi bạn chọn.</p></div><div><button type="button" data-banner-customize>Tùy chỉnh</button><button type="button" data-banner-refuse>Từ chối tùy chọn</button><button type="button" class="primary" data-banner-accept>Cho phép phân tích</button></div>`;
    document.body.append(banner);
    const close = (preferences, source) => {
      apply(preferences);
      sync(preferences, source)
        .catch(() => window.HHCommunity?.notice?.("Đã lưu lựa chọn trên thiết bị; máy chủ sẽ đồng bộ khi kết nối lại.", "warning"))
        .finally(() => banner.remove());
    };
    const customize = () => {
      banner.classList.add("is-customizing");
      banner.innerHTML = `<div><small>HH PRIVACY · TÙY CHỈNH</small><strong>Chọn dữ liệu tùy chọn.</strong><p>Thiết yếu luôn bật. Marketing hiện không được sử dụng.</p><section class="hh-banner-options">${preferenceRows(read() || defaults)}</section></div><div><button type="button" data-banner-refuse>Từ chối tùy chọn</button><button type="button" class="primary" data-banner-save>Lưu lựa chọn</button></div>`;
      const values = () => normalize(Object.fromEntries([...banner.querySelectorAll("[data-privacy-toggle]")].map((input) => [input.dataset.privacyToggle, input.checked])));
      banner.querySelector("[data-banner-refuse]")?.addEventListener("click", () => close(defaults, "privacy-banner-refuse"));
      banner.querySelector("[data-banner-save]")?.addEventListener("click", () => close(values(), "privacy-banner-custom"));
    };
    banner.querySelector("[data-banner-refuse]")?.addEventListener("click", () => close(defaults, "privacy-banner-refuse"));
    banner.querySelector("[data-banner-accept]")?.addEventListener("click", () => close({ ...defaults, analytics: true }, "privacy-banner-accept"));
    banner.querySelector("[data-banner-customize]")?.addEventListener("click", customize);
  }

  window.HHPrivacyConsent = Object.freeze({ apply, mount: (host) => render(host), preferences: () => read() || defaults, showBanner, sync });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", showBanner, { once: true }); else showBanner();
})();
