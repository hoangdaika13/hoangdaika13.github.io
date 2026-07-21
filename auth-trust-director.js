(() => {
  "use strict";

  const PROFILE_KEYS = Object.freeze([
    "hh.auth.last-profile",
    "hh-auth-user",
    "hh-chat-last-name",
    "hh.auth.last-workspace"
  ]);
  const PERSONALIZATION_KEY = "hh.auth.personalization";
  const DIRECTOR_TO_RUNTIME = Object.freeze({ static: "static", balanced: "balanced", cinematic: "vivid" });
  const RUNTIME_TO_DIRECTOR = Object.freeze({ static: "static", balanced: "balanced", vivid: "cinematic" });
  const MOTION_MODES = Object.freeze(Object.keys(DIRECTOR_TO_RUNTIME));
  const RECOVERY_COPY = Object.freeze({
    network: {
      icon: "NET",
      title: "Kết nối đang gián đoạn",
      body: "Kiểm tra mạng rồi thử lại. Nội dung đã nhập trong form vẫn được giữ nguyên.",
      action: "Kiểm tra lại"
    },
    oauth: {
      icon: "G",
      title: "Google chưa hoàn tất xác thực",
      body: "Mở lại luồng Google bằng nút chính thức. Các phương thức đăng nhập khác vẫn sử dụng được.",
      action: "Thử Google lại"
    },
    email: {
      icon: "@",
      title: "Cần kiểm tra email",
      body: "Kiểm tra định dạng hoặc mã xác minh rồi tiếp tục ngay tại trường tương ứng.",
      action: "Tới trường email"
    },
    passkey: {
      icon: "PK",
      title: "Passkey chưa hoàn tất",
      body: "Hãy bảo đảm thiết bị hỗ trợ khóa truy cập hoặc tiếp tục bằng email.",
      action: "Thử Passkey lại"
    },
    account: {
      icon: "HH",
      title: "Chưa thể hoàn tất đăng nhập",
      body: "Thông tin của bạn vẫn còn trong form. Kiểm tra lại trường được đánh dấu và thử tiếp.",
      action: "Kiểm tra form"
    }
  });

  const unavailableApi = Object.freeze({
    available: false,
    refresh: () => null,
    getPrivacySnapshot: () => null,
    setPersonalization: () => false,
    clearLocalIdentity: () => false,
    reportError: () => false,
    clearError: () => false,
    setMotionMode: () => "static",
    getMotionMode: () => "static",
    destroy: () => undefined
  });

  const init = () => {
    const gate = document.querySelector("#authGate");
    if (!gate) {
      window.HHTrustDirector = unavailableApi;
      return;
    }

    const body = document.body;
    const statusNode = gate.querySelector("#authGateStatus, [data-auth-status]");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const removers = [];
    let destroyed = false;
    let root = null;
    let recovery = null;
    let statusObserver = null;
    let deleteTimer = 0;
    let currentRecoveryType = "";
    let preferredDirectorMode = "balanced";

    const addListener = (target, type, listener, options) => {
      if (!target?.addEventListener) return;
      target.addEventListener(type, listener, options);
      removers.push(() => target.removeEventListener(type, listener, options));
    };

    const getStored = (storage, key) => {
      try { return storage.getItem(key); }
      catch { return null; }
    };

    const setStored = (storage, key, value) => {
      try {
        storage.setItem(key, value);
        return true;
      } catch {
        return false;
      }
    };

    const removeStored = (storage, key) => {
      try {
        storage.removeItem(key);
        return true;
      } catch {
        return false;
      }
    };

    const readObject = (storage, key) => {
      try {
        const value = JSON.parse(getStored(storage, key) || "null");
        return value && typeof value === "object" ? value : null;
      } catch {
        return null;
      }
    };

    const cleanLabel = (value, fallback, maxLength = 80) => {
      const text = String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
      return text ? text.slice(0, maxLength) : fallback;
    };

    const maskEmail = (value) => {
      const email = String(value || "").trim();
      const separator = email.lastIndexOf("@");
      if (separator < 1) return "Chưa lưu";
      const local = email.slice(0, separator);
      const domain = email.slice(separator + 1);
      const visible = local.slice(0, Math.min(2, local.length));
      return `${visible}${"*".repeat(Math.max(3, Math.min(6, local.length - visible.length + 2)))}@${domain}`;
    };

    const getDeviceLabel = () => {
      const platform = navigator.userAgentData?.platform || navigator.platform || "Thiết bị hiện tại";
      const agent = navigator.userAgent || "";
      const browser = /Edg\//.test(agent) ? "Edge" : /Firefox\//.test(agent) ? "Firefox" : /Chrome\//.test(agent) ? "Chrome" : /Safari\//.test(agent) ? "Safari" : "Trình duyệt web";
      return cleanLabel(`${platform} · ${browser}`, "Thiết bị hiện tại", 54);
    };

    const getProfile = () => readObject(localStorage, "hh.auth.last-profile") || readObject(localStorage, "hh-auth-user") || {};

    const personalizationEnabled = () => getStored(localStorage, PERSONALIZATION_KEY) !== "off";

    const getPrivacySnapshot = () => {
      const profile = getProfile();
      return Object.freeze({
        email: maskEmail(profile.email),
        device: getDeviceLabel(),
        workspace: cleanLabel(profile.lastWorkspace || getStored(localStorage, "hh.auth.last-workspace"), "Chưa có workspace gần đây", 64),
        personalization: personalizationEnabled(),
        hasLocalIdentity: PROFILE_KEYS.some((key) => Boolean(getStored(localStorage, key)))
      });
    };

    const injectRoot = () => {
      const host = gate.querySelector("[data-auth-privacy]") || gate.querySelector(".auth-gate-card");
      if (!host) return null;
      const existing = host.querySelector("[data-auth-trust-director]");
      if (existing) return existing;
      const node = document.createElement("section");
      node.className = "auth-trust-director";
      node.dataset.authTrustDirector = "";
      node.setAttribute("aria-label", "Quyền riêng tư và chuyển động");
      node.innerHTML = `
        <header class="auth-trust-director__heading">
          <div><strong>Live Privacy Lens</strong><small>Chỉ hiển thị nhận dạng công khai trên thiết bị này</small></div>
          <span class="auth-trust-director__live">Live</span>
        </header>
        <section class="auth-trust-director__lens" aria-labelledby="authPrivacyLensTitle">
          <div class="auth-trust-director__section-head"><div><strong id="authPrivacyLensTitle">Dữ liệu đang được dùng</strong><small>Cập nhật trực tiếp, không gửi thêm dữ liệu</small></div></div>
          <dl class="auth-trust-director__identity">
            <div><dt>Email</dt><dd data-trust-email>Chưa lưu</dd></div>
            <div><dt>Thiết bị</dt><dd data-trust-device>Thiết bị hiện tại</dd></div>
            <div><dt>Gần đây</dt><dd data-trust-workspace>Chưa có workspace</dd></div>
          </dl>
          <div class="auth-trust-director__identity-actions">
            <label class="auth-trust-director__switch"><input type="checkbox" data-trust-personalization role="switch"><i aria-hidden="true"></i><span>Cá nhân hóa trải nghiệm</span></label>
            <button class="auth-trust-director__delete" type="button" data-trust-clear-identity>Xóa nhận dạng cục bộ</button>
          </div>
          <small class="auth-trust-director__note" data-trust-note aria-live="polite">Bạn kiểm soát dữ liệu nhận dạng được ghi nhớ trên thiết bị.</small>
        </section>
        <section class="auth-trust-director__motion" aria-labelledby="authMotionDirectorTitle">
          <div class="auth-trust-director__section-head"><div><strong id="authMotionDirectorTitle">Motion Director</strong><small>Chọn mức chuyển động phù hợp với thiết bị</small></div></div>
          <div class="auth-trust-director__motion-options" role="group" aria-label="Mức chuyển động">
            <button type="button" data-trust-motion="static" aria-pressed="false"><span>Tĩnh</span><small>Tối giản</small></button>
            <button type="button" data-trust-motion="balanced" aria-pressed="false"><span>Cân bằng</span><small>Mượt nhẹ</small></button>
            <button type="button" data-trust-motion="cinematic" aria-pressed="false"><span>Cinematic</span><small>Đầy đủ</small></button>
          </div>
          <span class="auth-trust-director__motion-status" data-trust-motion-status aria-live="polite">Chuyển động đang hoạt động</span>
        </section>`;
      host.append(node);
      return node;
    };

    const injectRecovery = () => {
      const host = statusNode?.parentElement || gate.querySelector(".auth-gate-card");
      if (!host) return null;
      const existing = host.querySelector("[data-auth-error-recovery]");
      if (existing) return existing;
      const node = document.createElement("section");
      node.className = "auth-error-recovery";
      node.dataset.authErrorRecovery = "";
      node.hidden = true;
      node.setAttribute("role", "status");
      node.setAttribute("aria-live", "polite");
      node.innerHTML = `
        <i class="auth-error-recovery__icon" data-auth-recovery-icon aria-hidden="true">HH</i>
        <div class="auth-error-recovery__copy"><strong data-auth-recovery-title>Khôi phục đăng nhập</strong><span data-auth-recovery-body>Hãy thử lại ngay tại đây.</span></div>
        <div class="auth-error-recovery__actions"><button type="button" data-auth-recovery-action>Thử lại</button><button type="button" data-auth-recovery-dismiss aria-label="Ẩn hướng dẫn khôi phục">Ẩn</button></div>`;
      statusNode?.insertAdjacentElement("afterend", node) || host.prepend(node);
      return node;
    };

    const refresh = () => {
      if (!root) return null;
      const snapshot = getPrivacySnapshot();
      const assign = (selector, value) => {
        const node = root.querySelector(selector);
        if (node) node.textContent = value;
      };
      assign("[data-trust-email]", snapshot.email);
      assign("[data-trust-device]", snapshot.device);
      assign("[data-trust-workspace]", snapshot.workspace);
      const toggle = root.querySelector("[data-trust-personalization]");
      if (toggle) toggle.checked = snapshot.personalization;
      const clearButton = root.querySelector("[data-trust-clear-identity]");
      if (clearButton) clearButton.disabled = !snapshot.hasLocalIdentity;
      return snapshot;
    };

    const setPersonalization = (enabled) => {
      const value = Boolean(enabled);
      setStored(localStorage, PERSONALIZATION_KEY, value ? "on" : "off");
      refresh();
      window.dispatchEvent(new CustomEvent("hh:auth-personalization-change", { detail: { enabled: value } }));
      return value;
    };

    const clearDeleteConfirmation = () => {
      window.clearTimeout(deleteTimer);
      deleteTimer = 0;
      const button = root?.querySelector("[data-trust-clear-identity]");
      if (!button) return;
      button.dataset.confirming = "false";
      button.textContent = "Xóa nhận dạng cục bộ";
    };

    const clearLocalIdentity = () => {
      PROFILE_KEYS.forEach((key) => removeStored(localStorage, key));
      removeStored(sessionStorage, "hh.auth.selected-universe");
      removeStored(sessionStorage, "hh.auth.pending-route");
      const returning = gate.querySelector("[data-returning-user]");
      if (returning) returning.hidden = true;
      gate.querySelectorAll('input[type="email"]').forEach((input) => {
        if (!input.matches(":focus")) input.value = "";
      });
      clearDeleteConfirmation();
      const note = root?.querySelector("[data-trust-note]");
      if (note) note.textContent = "Đã xóa nhận dạng ghi nhớ trên thiết bị. Phiên hiện tại không bị thay đổi.";
      const snapshot = refresh();
      window.dispatchEvent(new CustomEvent("hh:auth-local-identity-cleared", { detail: { keys: PROFILE_KEYS.length } }));
      return Boolean(snapshot);
    };

    const classifyError = (message = "", suggestedType = "") => {
      if (Object.hasOwn(RECOVERY_COPY, suggestedType)) return suggestedType;
      const text = String(message).toLowerCase();
      if (!navigator.onLine || /network|fetch|kết nối|máy chủ|backend|offline|timeout/.test(text)) return "network";
      if (/oauth|google|redirect|provider/.test(text)) return "oauth";
      if (/passkey|webauthn|khóa truy cập|vân tay|khuôn mặt/.test(text)) return "passkey";
      if (/email|otp|mã xác minh|xác minh thư/.test(text)) return "email";
      return "account";
    };

    const reportError = (type = "", message = "") => {
      if (!recovery) return false;
      currentRecoveryType = classifyError(message, type);
      const copy = RECOVERY_COPY[currentRecoveryType];
      recovery.querySelector("[data-auth-recovery-icon]").textContent = copy.icon;
      recovery.querySelector("[data-auth-recovery-title]").textContent = copy.title;
      recovery.querySelector("[data-auth-recovery-body]").textContent = copy.body;
      recovery.querySelector("[data-auth-recovery-action]").textContent = copy.action;
      recovery.hidden = false;
      recovery.dataset.recoveryType = currentRecoveryType;
      return true;
    };

    const clearError = () => {
      currentRecoveryType = "";
      if (recovery) {
        recovery.hidden = true;
        delete recovery.dataset.recoveryType;
      }
      return true;
    };

    const runRecoveryAction = () => {
      if (currentRecoveryType === "network") {
        if (!navigator.onLine) {
          recovery.querySelector("[data-auth-recovery-body]").textContent = "Thiết bị vẫn ngoại tuyến. Form sẽ sẵn sàng ngay khi mạng trở lại.";
          return;
        }
        window.dispatchEvent(new CustomEvent("hh:auth-retry", { detail: { type: "network" } }));
        window.location.reload();
        return;
      }
      if (currentRecoveryType === "oauth") {
        const provider = gate.querySelector('[data-oauth-provider="google"]:not(:disabled)');
        if (provider) provider.click();
        else gate.querySelector('#gateLoginForm input[type="email"]')?.focus({ preventScroll: true });
        return;
      }
      if (currentRecoveryType === "passkey") {
        const passkey = gate.querySelector("[data-passkey-login]:not(:disabled)");
        if (passkey) passkey.click();
        else gate.querySelector('#gateLoginForm input[type="email"]')?.focus({ preventScroll: true });
        return;
      }
      const email = gate.querySelector('[data-auth-panel]:not([hidden]) input[type="email"]') || gate.querySelector('#gateLoginForm input[type="email"]');
      email?.focus({ preventScroll: true });
    };

    const getRuntime = () => window.HHAuthTransitionRuntime || window.HHAuthTransition || null;

    const motionMustPause = () => Boolean(document.hidden || reducedMotion.matches || connection?.saveData);

    const applyPauseState = () => {
      const paused = motionMustPause();
      gate.dataset.authTrustMotionPaused = String(paused);
      body.dataset.authTrustMotionPaused = String(paused);
      if (paused) {
        gate.dataset.authMotionPaused = "true";
        body.dataset.authMotionPaused = "true";
      } else {
        gate.dataset.authMotionPaused = "false";
        body.dataset.authMotionPaused = "false";
      }
      const status = root?.querySelector("[data-trust-motion-status]");
      if (status) {
        status.textContent = document.hidden
          ? "Đã tạm dừng khi tab không hiển thị"
          : reducedMotion.matches
            ? "Đang tôn trọng chế độ giảm chuyển động"
            : connection?.saveData
              ? "Đã tạm dừng để tiết kiệm dữ liệu"
              : "Chuyển động đang hoạt động";
      }
      return paused;
    };

    const syncMotionButtons = () => {
      root?.querySelectorAll("[data-trust-motion]").forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.trustMotion === preferredDirectorMode));
      });
    };

    const getMotionMode = () => preferredDirectorMode;

    const setMotionMode = (mode, { syncRuntime = true } = {}) => {
      const requested = MOTION_MODES.includes(mode) ? mode : "balanced";
      preferredDirectorMode = requested;
      if (syncRuntime) {
        try { getRuntime()?.setMode?.(DIRECTOR_TO_RUNTIME[requested]); } catch {}
      }
      gate.dataset.authTrustMotionMode = requested;
      body.dataset.authTrustMotionMode = requested;
      syncMotionButtons();
      applyPauseState();
      window.dispatchEvent(new CustomEvent("hh:auth-trust-motion-change", {
        detail: { mode: requested, runtimeMode: DIRECTOR_TO_RUNTIME[requested], paused: motionMustPause() }
      }));
      return requested;
    };

    const syncFromRuntime = (event) => {
      const runtimeMode = event?.detail?.preference || event?.detail?.mode || getRuntime()?.getPreference?.() || getRuntime()?.getMode?.() || "balanced";
      setMotionMode(RUNTIME_TO_DIRECTOR[runtimeMode] || "balanced", { syncRuntime: false });
    };

    const inspectStatus = () => {
      if (!statusNode) return;
      const isError = gate.dataset.authStatus === "error" || statusNode.classList.contains("is-error") || statusNode.dataset.state === "error";
      if (isError) reportError("", statusNode.textContent || "");
      else if (gate.dataset.authStatus === "success" || statusNode.classList.contains("is-success") || statusNode.dataset.state === "success") clearError();
    };

    const destroy = () => {
      if (destroyed) return;
      destroyed = true;
      window.clearTimeout(deleteTimer);
      statusObserver?.disconnect();
      removers.splice(0).forEach((remove) => {
        try { remove(); } catch {}
      });
      recovery?.remove();
      root?.remove();
      delete gate.dataset.authTrustMotionPaused;
      delete gate.dataset.authTrustMotionMode;
    };

    root = injectRoot();
    recovery = injectRecovery();
    if (!root) {
      window.HHTrustDirector = unavailableApi;
      return;
    }

    addListener(root, "change", (event) => {
      if (event.target.matches("[data-trust-personalization]")) setPersonalization(event.target.checked);
    });
    addListener(root, "click", (event) => {
      const motion = event.target.closest("[data-trust-motion]");
      if (motion) {
        setMotionMode(motion.dataset.trustMotion);
        return;
      }
      const clearButton = event.target.closest("[data-trust-clear-identity]");
      if (!clearButton || clearButton.disabled) return;
      if (clearButton.dataset.confirming === "true") {
        clearLocalIdentity();
        return;
      }
      clearButton.dataset.confirming = "true";
      clearButton.textContent = "Bấm lần nữa để xóa";
      window.clearTimeout(deleteTimer);
      deleteTimer = window.setTimeout(clearDeleteConfirmation, 5000);
    });
    addListener(recovery, "click", (event) => {
      if (event.target.closest("[data-auth-recovery-action]")) runRecoveryAction();
      if (event.target.closest("[data-auth-recovery-dismiss]")) clearError();
    });
    addListener(window, "online", () => {
      if (currentRecoveryType === "network") clearError();
      applyPauseState();
    });
    addListener(window, "offline", () => reportError("network"));
    addListener(window, "hh:auth-error", (event) => reportError(event.detail?.type, event.detail?.message));
    addListener(window, "hh:auth-change", refresh);
    addListener(window, "hh:auth-transition-ready", syncFromRuntime);
    addListener(window, "hh:auth-motion-mode-change", syncFromRuntime);
    addListener(document, "visibilitychange", applyPauseState);
    addListener(reducedMotion, "change", applyPauseState);
    if (connection?.addEventListener) addListener(connection, "change", applyPauseState);
    addListener(window, "pagehide", destroy, { once: true });

    if (statusNode) {
      statusObserver = new MutationObserver(inspectStatus);
      statusObserver.observe(statusNode, { attributes: true, childList: true, characterData: true, subtree: true });
    }

    refresh();
    syncFromRuntime();
    applyPauseState();
    inspectStatus();

    const api = Object.freeze({
      available: true,
      refresh,
      getPrivacySnapshot,
      setPersonalization,
      clearLocalIdentity,
      reportError,
      clearError,
      setMotionMode,
      getMotionMode,
      isMotionPaused: motionMustPause,
      destroy
    });
    window.HHTrustDirector = api;
    window.dispatchEvent(new CustomEvent("hh:auth-trust-director-ready", { detail: { api } }));
    gate.dispatchEvent(new CustomEvent("hh:auth-trust-director-ready", { detail: { api } }));
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
