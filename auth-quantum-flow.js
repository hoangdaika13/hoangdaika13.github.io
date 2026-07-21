(() => {
  "use strict";

  const STEP_ORDER = ["device", "identity", "session", "workspace"];
  const STEP_CONTENT = {
    device: { number: "01", title: "Thiết bị", pending: "Chờ kiểm tra", active: "Đang kiểm tra", complete: "Thiết bị sẵn sàng", error: "Lỗi thiết bị" },
    identity: { number: "02", title: "Danh tính", pending: "Chờ xác minh", active: "Đang xác minh", complete: "Đã xác minh", error: "Lỗi danh tính" },
    session: { number: "03", title: "Phiên bảo mật", pending: "Chờ thiết lập", active: "Đang thiết lập", complete: "Phiên đã bảo vệ", error: "Lỗi phiên" },
    workspace: { number: "04", title: "Workspace", pending: "Chờ mở", active: "Đang mở", complete: "Đã sẵn sàng", error: "Lỗi workspace" }
  };

  const boot = () => {
    if (window.HHQuantumAuth?.available) return window.HHQuantumAuth;

    const gate = document.querySelector("#authGate");
    if (!gate) {
      window.HHQuantumAuth = Object.freeze({
        available: false,
        refresh: () => false,
        getState: () => null,
        destroy: () => false
      });
      return window.HHQuantumAuth;
    }

    const statusNode = gate.querySelector("#authGateStatus");
    const authCard = gate.querySelector("[data-auth-card], .auth-gate-card");
    const appShell = document.querySelector("#appShell");
    const passkeyButton = gate.querySelector("[data-passkey-login]");
    const forms = [...gate.querySelectorAll("form")];
    const abortController = new AbortController();
    const { signal } = abortController;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)") || {
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {}
    };
    const observers = [];

    let destroyed = false;
    let currentStep = "device";
    let errorStep = null;
    let lastAction = "bootstrap";
    let authenticated = false;
    let statusSyncQueued = false;
    const completedSteps = new Set();

    const flow = document.createElement("section");
    flow.className = "hh-quantum-flow";
    flow.setAttribute("aria-label", "Tiến trình xác thực");
    flow.innerHTML = `
      <header class="hh-quantum-flow__header">
        <span>Quantum Authentication</span>
        <output data-quantum-summary>Đang đọc trạng thái xác thực</output>
      </header>
      <ol class="hh-quantum-flow__steps">
        ${STEP_ORDER.map((id) => {
          const step = STEP_CONTENT[id];
          return `<li class="hh-quantum-step" data-quantum-step="${id}" data-state="pending"><i class="hh-quantum-step__node" aria-hidden="true">${step.number}</i><span class="hh-quantum-step__copy"><strong>${step.title}</strong><small data-quantum-step-status>${step.pending}</small></span></li>`;
        }).join("")}
      </ol>`;

    if (statusNode?.parentNode) statusNode.insertAdjacentElement("afterend", flow);
    else authCard?.prepend(flow);

    let passkeyPortal = null;
    if (passkeyButton?.parentNode) {
      passkeyPortal = document.createElement("div");
      passkeyPortal.className = "hh-passkey-portal";
      passkeyPortal.dataset.portalState = "ready";
      passkeyPortal.dataset.passkeySupported = String(Boolean(window.PublicKeyCredential && navigator.credentials));
      passkeyPortal.innerHTML = '<span class="hh-passkey-portal__field" aria-hidden="true"></span><span class="hh-passkey-portal__orbit" aria-hidden="true"></span>';
      passkeyButton.parentNode.insertBefore(passkeyPortal, passkeyButton);
      passkeyPortal.append(passkeyButton);
    }

    const stepNodes = new Map(STEP_ORDER.map((id) => [id, flow.querySelector(`[data-quantum-step="${id}"]`)]));
    const summaryNode = flow.querySelector("[data-quantum-summary]");

    const normalizedText = (value) => String(value || "").trim().toLowerCase();
    const statusText = () => normalizedText(statusNode?.textContent);
    const statusKind = () => {
      const declared = normalizedText(
        statusNode?.dataset.state
        || gate.dataset.authStatus
        || authCard?.dataset.authState
      );
      const text = statusText();

      if (declared === "error" || statusNode?.classList.contains("is-error")) return "error";
      if (declared === "success" || statusNode?.classList.contains("is-success")) return "success";
      if (
        declared === "loading"
        || statusNode?.classList.contains("is-loading")
        || /\b(loading|checking|processing)\b|đang |dang |xác thực|xac thuc|kiểm tra phiên|kiem tra phien/.test(text)
      ) return "loading";
      return "info";
    };

    const isAuthenticationSuccess = (text = statusText()) => (
      /đăng nhập thành công|dang nhap thanh cong|tạo tài khoản thành công|tao tai khoan thanh cong|đăng nhập bằng passkey thành công|email đã xác minh|email da xac minh|đăng nhập google thành công|đăng nhập từ thiết bị khác thành công|đã mở workspace local|da mo workspace local/.test(text)
    );

    const workspaceIsOpen = () => (
      authenticated
      || document.body.classList.contains("auth-unlocked")
      || document.body.classList.contains("auth-authenticated")
      || gate.getAttribute("aria-hidden") === "true"
      || Boolean(appShell && !appShell.hidden)
    );

    const invalidIdentityFieldExists = () => forms.some((form) => (
      Boolean(form.querySelector('[aria-invalid="true"]'))
    ));

    const inferErrorStep = (text = statusText()) => {
      if (invalidIdentityFieldExists()) return "identity";
      if (lastAction === "device") return "device";
      if (/workspace|trang chủ|trang chu|route|dự án|du an/.test(text)) return "workspace";
      if (/captcha|turnstile|phiên|phien|token|bảo mật|bao mat|backend|máy chủ|may chu|server|mạng|network|kết nối|ket noi/.test(text)) return "session";
      if (
        lastAction === "passkey"
        && /không hỗ trợ|khong ho tro|trình duyệt|trinh duyet|đã hủy|da huy|notallowed|thiết bị|thiet bi/.test(text)
      ) return "device";
      if (/email|mật khẩu|mat khau|tài khoản|tai khoan|google|oauth|passkey|danh tính|danh tinh|xác minh|xac minh|hồ sơ|ho so/.test(text)) return "identity";
      if (lastAction === "bootstrap") return "session";
      if (lastAction === "workspace") return "workspace";
      return "identity";
    };

    const detailFor = (id, state) => {
      if (id === "device" && state !== "error") {
        if (!navigator.onLine) return "Thiết bị đang ngoại tuyến";
        if (state === "active") return passkeyPortal?.dataset.passkeySupported === "true" ? "Passkey khả dụng" : "Email và Google khả dụng";
      }
      return STEP_CONTENT[id][state] || STEP_CONTENT[id].pending;
    };

    const render = () => {
      if (destroyed) return false;
      const allComplete = STEP_ORDER.every((id) => completedSteps.has(id));

      STEP_ORDER.forEach((id) => {
        const node = stepNodes.get(id);
        if (!node) return;
        let state = "pending";
        if (completedSteps.has(id)) state = "complete";
        if (!allComplete && id === currentStep) state = "active";
        if (id === errorStep) state = "error";
        node.dataset.state = state;
        if (state === "active" || state === "error") node.setAttribute("aria-current", "step");
        else node.removeAttribute("aria-current");
        const detail = node.querySelector("[data-quantum-step-status]");
        if (detail) detail.textContent = detailFor(id, state);
      });

      const state = errorStep ? "error" : allComplete ? "complete" : "active";
      gate.dataset.quantumStep = errorStep || currentStep;
      gate.dataset.quantumState = state;
      if (summaryNode) {
        summaryNode.textContent = errorStep
          ? `Cần kiểm tra: ${STEP_CONTENT[errorStep].title}`
          : allComplete
            ? "Workspace đã mở an toàn"
            : `${STEP_CONTENT[currentStep].title}: ${detailFor(currentStep, "active")}`;
      }
      return true;
    };

    const setPortalState = (state) => {
      if (!passkeyPortal) return;
      passkeyPortal.dataset.portalState = state;
    };

    const markWorkspaceReady = () => {
      authenticated = true;
      errorStep = null;
      currentStep = "workspace";
      STEP_ORDER.forEach((id) => completedSteps.add(id));
      if (lastAction === "passkey") setPortalState("success");
      render();
    };

    const syncFromDom = ({ statusChanged = false } = {}) => {
      if (destroyed) return false;
      if (workspaceIsOpen()) {
        markWorkspaceReady();
        return true;
      }

      const kind = statusKind();
      const text = statusText();

      if (kind === "error" && statusChanged) {
        errorStep = inferErrorStep(text);
        currentStep = errorStep;
        if (lastAction === "passkey") setPortalState("error");
        render();
        return true;
      }

      if (kind !== "error") errorStep = null;

      if (kind === "success" && isAuthenticationSuccess(text)) {
        completedSteps.add("device");
        completedSteps.add("identity");
        currentStep = "session";
        if (lastAction === "passkey") setPortalState("success");
        render();
        return true;
      }

      if (/kiểm tra phiên|kiem tra phien|checking session/.test(text) && lastAction === "bootstrap") {
        completedSteps.add("device");
        currentStep = "session";
        render();
        return true;
      }

      if (lastAction === "submit" || lastAction === "oauth" || lastAction === "passkey" || lastAction === "verify") {
        completedSteps.add("device");
        currentStep = "identity";
      } else {
        completedSteps.add("device");
        currentStep = "identity";
      }
      render();
      return true;
    };

    const queueStatusSync = () => {
      if (destroyed || statusSyncQueued) return;
      statusSyncQueued = true;
      queueMicrotask(() => {
        statusSyncQueued = false;
        syncFromDom({ statusChanged: true });
      });
    };

    gate.addEventListener("focusin", (event) => {
      if (!event.target.closest?.("form, [data-oauth-provider], [data-passkey-login], [data-device-login]")) return;
      lastAction = lastAction === "bootstrap" ? "identity" : lastAction;
      errorStep = null;
      completedSteps.add("device");
      currentStep = "identity";
      render();
    }, { signal });

    gate.addEventListener("input", (event) => {
      if (!event.target.closest?.("form")) return;
      lastAction = "identity";
      errorStep = null;
      setPortalState("ready");
      completedSteps.add("device");
      currentStep = "identity";
      render();
    }, { signal });

    gate.addEventListener("submit", () => {
      lastAction = "submit";
      errorStep = null;
      setPortalState("ready");
      completedSteps.add("device");
      currentStep = "identity";
      render();
    }, { capture: true, signal });

    gate.addEventListener("click", (event) => {
      const passkey = event.target.closest?.("[data-passkey-login]");
      const oauth = event.target.closest?.("[data-oauth-provider]");
      const guest = event.target.closest?.("[data-guest-login]");
      const verify = event.target.closest?.("[data-email-verify-action]");
      const device = event.target.closest?.("[data-device-login]");

      if (passkey) {
        lastAction = "passkey";
        errorStep = null;
        completedSteps.add("device");
        currentStep = "identity";
        setPortalState("requesting");
        render();
        return;
      }
      if (oauth) lastAction = "oauth";
      else if (guest) lastAction = "submit";
      else if (verify) lastAction = "verify";
      else if (device) {
        lastAction = "device";
        errorStep = null;
        completedSteps.delete("device");
        currentStep = "device";
        setPortalState("ready");
        render();
        return;
      }
      else return;

      errorStep = null;
      completedSteps.add("device");
      currentStep = "identity";
      if (lastAction !== "passkey") setPortalState("ready");
      render();
    }, { capture: true, signal });

    gate.addEventListener("hh:auth-success", () => {
      errorStep = null;
      completedSteps.add("device");
      completedSteps.add("identity");
      completedSteps.add("session");
      currentStep = "workspace";
      if (lastAction === "passkey") setPortalState("success");
      render();
    }, { signal });

    gate.addEventListener("hh:auth-signup-step", () => {
      lastAction = "identity";
      errorStep = null;
      completedSteps.add("device");
      currentStep = "identity";
      render();
    }, { signal });

    gate.addEventListener("invalid", () => {
      lastAction = "identity";
      errorStep = "identity";
      currentStep = "identity";
      completedSteps.add("device");
      setPortalState("ready");
      render();
    }, { capture: true, signal });

    ["hh:auth-error", "auth:error"].forEach((eventName) => {
      gate.addEventListener(eventName, (event) => {
        const requestedStep = String(event.detail?.step || "").toLowerCase();
        errorStep = STEP_ORDER.includes(requestedStep) ? requestedStep : inferErrorStep(event.detail?.message || statusText());
        currentStep = errorStep;
        if (lastAction === "passkey") setPortalState("error");
        render();
      }, { signal });
    });

    window.addEventListener("hh:auth-change", (event) => {
      if (event.detail?.user) markWorkspaceReady();
      else {
        authenticated = false;
        completedSteps.clear();
        errorStep = null;
        lastAction = "bootstrap";
        setPortalState("ready");
        queueMicrotask(() => syncFromDom());
      }
    }, { signal });

    window.addEventListener("online", () => syncFromDom(), { signal });
    window.addEventListener("offline", () => syncFromDom(), { signal });

    const updateMotionState = () => {
      gate.dataset.quantumPaused = String(document.visibilityState !== "visible");
      gate.dataset.quantumMotion = reducedMotion.matches ? "reduced" : "full";
    };
    document.addEventListener("visibilitychange", updateMotionState, { signal });
    reducedMotion.addEventListener?.("change", updateMotionState, { signal });

    if (statusNode) {
      const statusObserver = new MutationObserver(queueStatusSync);
      statusObserver.observe(statusNode, {
        attributes: true,
        attributeFilter: ["class", "data-state", "hidden"],
        childList: true,
        characterData: true,
        subtree: true
      });
      observers.push(statusObserver);
    }

    const gateObserver = new MutationObserver(() => syncFromDom());
    gateObserver.observe(gate, {
      attributes: true,
      attributeFilter: ["class", "data-auth-status", "aria-hidden"]
    });
    observers.push(gateObserver);

    if (authCard) {
      const cardObserver = new MutationObserver(queueStatusSync);
      cardObserver.observe(authCard, {
        attributes: true,
        attributeFilter: ["class", "data-auth-state"]
      });
      observers.push(cardObserver);
    }

    if (appShell) {
      const shellObserver = new MutationObserver(() => syncFromDom());
      shellObserver.observe(appShell, { attributes: true, attributeFilter: ["class", "hidden"] });
      observers.push(shellObserver);
    }

    forms.forEach((form) => {
      const formObserver = new MutationObserver(() => {
        if (invalidIdentityFieldExists()) {
          errorStep = "identity";
          currentStep = "identity";
          completedSteps.add("device");
          render();
        } else syncFromDom();
      });
      formObserver.observe(form, {
        attributes: true,
        attributeFilter: ["class", "aria-busy", "aria-invalid", "hidden"],
        subtree: true
      });
      observers.push(formObserver);
    });

    const destroy = () => {
      if (destroyed) return false;
      destroyed = true;
      abortController.abort();
      observers.forEach((observer) => observer.disconnect());
      if (passkeyPortal && passkeyButton && passkeyPortal.parentNode) {
        passkeyPortal.parentNode.insertBefore(passkeyButton, passkeyPortal);
        passkeyPortal.remove();
      }
      flow.remove();
      delete gate.dataset.quantumStep;
      delete gate.dataset.quantumState;
      delete gate.dataset.quantumPaused;
      delete gate.dataset.quantumMotion;
      return true;
    };

    window.addEventListener("pagehide", (event) => {
      if (!event.persisted) destroy();
    }, { signal });

    const api = Object.freeze({
      get available() { return !destroyed; },
      refresh: () => syncFromDom({ statusChanged: true }),
      getState: () => ({
        currentStep,
        errorStep,
        completedSteps: STEP_ORDER.filter((id) => completedSteps.has(id)),
        authenticated: workspaceIsOpen(),
        passkeySupported: Boolean(window.PublicKeyCredential && navigator.credentials),
        passkeyState: passkeyPortal?.dataset.portalState || "unavailable"
      }),
      destroy
    });

    window.HHQuantumAuth = api;
    updateMotionState();
    syncFromDom({ statusChanged: true });
    return api;
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
