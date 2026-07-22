(() => {
  "use strict";

  const boot = () => {
    const gate = document.querySelector("#authGate");
    if (!gate) {
      window.HHAuthFormMotion = Object.freeze({ available: false });
      return;
    }

    if (gate.dataset.authFormMotionReady === "true") return;

    const card = gate.querySelector("[data-auth-card], .auth-gate-card");
    const tabs = [...gate.querySelectorAll(".auth-mode-tabs [role='tab'], [data-auth-tab]")];
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const desktopPointer = window.matchMedia("(min-width: 921px) and (hover: hover) and (pointer: fine)");
    const listeners = [];
    let frame = 0;
    let pendingPointer = null;
    let hotButton = null;
    let oauthOverride = null;
    let destroyed = false;
    let lastView = "";
    let readinessFrame = 0;

    const status = gate.querySelector("#authGateStatus, [data-auth-status]");
    const readinessOutput = document.createElement("span");
    readinessOutput.className = "auth-readiness-output";
    readinessOutput.setAttribute("aria-hidden", "true");
    readinessOutput.innerHTML = '<span data-auth-readiness-label>Sẵn sàng</span><b data-auth-readiness-value>20%</b>';
    status?.append(readinessOutput);

    const on = (target, type, handler, options) => {
      if (!target?.addEventListener) return;
      target.addEventListener(type, handler, options);
      listeners.push(() => target.removeEventListener(type, handler, options));
    };

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

    const hasValue = (control) => String(control?.value ?? "").trim().length > 0;

    const validEmail = (control) => {
      const value = String(control?.value ?? "").trim();
      return Boolean(value && /^\S+@\S+\.\S+$/.test(value));
    };

    const syncReadiness = () => {
      readinessFrame = 0;
      const view = gate.dataset.authView || "login";
      let progress = 18;
      let label = "Bắt đầu";

      if (view === "login") {
        const form = gate.querySelector("#gateLoginForm");
        const emailReady = validEmail(form?.querySelector('[name="email"]'));
        const passwordReady = hasValue(form?.querySelector('[name="password"]'));
        progress = 15 + (emailReady ? 40 : 0) + (passwordReady ? 45 : 0);
        label = progress >= 100 ? "Sẵn sàng" : emailReady ? "Thêm mật khẩu" : "Nhập email";
      } else if (view === "register") {
        const step = clamp(Number(gate.dataset.signupStep || 1), 1, 3);
        const panel = gate.querySelector(`[data-signup-step="${step}"]`);
        const required = [...(panel?.querySelectorAll("input[required], select[required], textarea[required]") || [])]
          .filter((control) => control.type !== "hidden" && !control.disabled);
        const complete = required.filter((control) => {
          if (control.type === "checkbox" || control.type === "radio") return control.checked;
          return hasValue(control) && control.validity.valid;
        }).length;
        const interestChoice = step === 3
          ? Boolean(panel?.querySelector('input[name="interests"]:checked'))
          : true;
        const ratio = required.length
          ? (complete + (step === 3 && interestChoice ? 1 : 0)) / (required.length + (step === 3 ? 1 : 0))
          : 0;
        const floors = [12, 42, 74];
        const spans = [22, 22, 24];
        progress = Math.round(floors[step - 1] + ratio * spans[step - 1]);
        label = `Bước ${step}/3`;
      } else if (view === "recovery") {
        const emailReady = validEmail(gate.querySelector("[data-recovery-email]"));
        const codeReady = String(gate.querySelector("[data-recovery-code]")?.value || "").trim().length === 6;
        const passwordReady = String(gate.querySelector("[data-recovery-password]")?.value || "").length >= 8;
        progress = 12 + (emailReady ? 38 : 0) + (codeReady ? 24 : 0) + (passwordReady ? 26 : 0);
        label = progress >= 100 ? "Sẵn sàng" : "Khôi phục";
      } else if (view === "verify-email") {
        const codeReady = String(gate.querySelector("[data-email-verify-code]")?.value || "").trim().length === 6;
        progress = codeReady ? 100 : 56;
        label = codeReady ? "Sẵn sàng" : "Xác minh";
      } else if (view === "qr") {
        progress = 72;
        label = "Chờ quét QR";
      }

      progress = clamp(Math.round(progress), 0, 100);
      gate.style.setProperty("--auth-readiness", `${progress}%`);
      gate.dataset.authReadiness = progress >= 100 ? "ready" : progress >= 55 ? "progress" : "start";
      const valueNode = readinessOutput.querySelector("[data-auth-readiness-value]");
      const labelNode = readinessOutput.querySelector("[data-auth-readiness-label]");
      if (valueNode.textContent !== `${progress}%`) valueNode.textContent = `${progress}%`;
      if (labelNode.textContent !== label) labelNode.textContent = label;

      if (lastView !== view) {
        lastView = view;
        gate.dataset.authPolishMode = view;
        card?.classList.remove("afm-view-shift");
        if (!reducedMotion.matches) {
          void card?.offsetWidth;
          card?.classList.add("afm-view-shift");
        }
      }
    };

    const scheduleReadiness = () => {
      if (readinessFrame || destroyed) return;
      readinessFrame = requestAnimationFrame(syncReadiness);
    };

    const paintActionRipple = (event) => {
      const button = event.target.closest?.(".auth-submit, .auth-provider, .auth-step-next, .auth-passkey-row button, .auth-guest-row button, [data-recovery-action], [data-email-verify-action]");
      if (!button || !gate.contains(button) || reducedMotion.matches) return;
      const bounds = button.getBoundingClientRect();
      const ripple = document.createElement("span");
      ripple.className = "afm-action-ripple";
      ripple.setAttribute("aria-hidden", "true");
      const x = Number.isFinite(event.clientX) && event.clientX ? event.clientX - bounds.left : bounds.width / 2;
      const y = Number.isFinite(event.clientY) && event.clientY ? event.clientY - bounds.top : bounds.height / 2;
      ripple.style.left = `${x}px`;
      ripple.style.top = `${y}px`;
      button.append(ripple);
      ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
      window.setTimeout(() => ripple.remove(), 900);
    };

    const motionAllowed = () => (
      !destroyed
      && !document.hidden
      && !reducedMotion.matches
      && desktopPointer.matches
    );

    const setCardVariable = (name, value) => card?.style.setProperty(name, value);

    const resetPointer = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      pendingPointer = null;
      setCardVariable("--afm-tilt-x", "0deg");
      setCardVariable("--afm-tilt-y", "0deg");
      setCardVariable("--afm-spot-opacity", "0");
      if (hotButton) {
        hotButton.classList.remove("afm-pointer-hot");
        hotButton = null;
      }
    };

    const syncButtonSpotlight = (event) => {
      const button = event.target.closest?.(".auth-submit, .auth-provider, .auth-step-next");
      if (hotButton && hotButton !== button) hotButton.classList.remove("afm-pointer-hot");
      hotButton = button || null;
      if (!button) return;

      const bounds = button.getBoundingClientRect();
      const x = clamp(((event.clientX - bounds.left) / Math.max(bounds.width, 1)) * 100, 0, 100);
      const y = clamp(((event.clientY - bounds.top) / Math.max(bounds.height, 1)) * 100, 0, 100);
      button.style.setProperty("--afm-button-x", `${x.toFixed(1)}%`);
      button.style.setProperty("--afm-button-y", `${y.toFixed(1)}%`);
      button.classList.add("afm-pointer-hot");
    };

    const paintPointer = () => {
      frame = 0;
      const event = pendingPointer;
      pendingPointer = null;
      if (!event || !card || !motionAllowed()) return;

      const bounds = card.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;

      const relativeX = clamp((event.clientX - bounds.left) / bounds.width, 0, 1);
      const relativeY = clamp((event.clientY - bounds.top) / bounds.height, 0, 1);
      const tiltY = clamp((relativeX * 2 - 1) * 1.5, -1.5, 1.5);
      const tiltX = clamp((1 - relativeY * 2) * 1.5, -1.5, 1.5);

      setCardVariable("--afm-tilt-x", `${tiltX.toFixed(2)}deg`);
      setCardVariable("--afm-tilt-y", `${tiltY.toFixed(2)}deg`);
      setCardVariable("--afm-spot-x", `${(relativeX * 100).toFixed(1)}%`);
      setCardVariable("--afm-spot-y", `${(relativeY * 100).toFixed(1)}%`);
      setCardVariable("--afm-spot-opacity", "1");
      syncButtonSpotlight(event);
    };

    const queuePointer = (event) => {
      if (event.pointerType === "touch" || !motionAllowed()) return;
      pendingPointer = event;
      if (!frame) frame = requestAnimationFrame(paintPointer);
    };

    const fieldControl = (field) => field?.querySelector("input, select, textarea");

    const hasControlValue = (control) => {
      if (!control) return false;
      if (control.type === "file") return Boolean(control.files?.length);
      if (control.type === "checkbox" || control.type === "radio") return control.checked;
      return String(control.value ?? "").trim().length > 0;
    };

    const syncField = (field) => {
      if (!field?.classList) return;
      field.classList.toggle("afm-has-value", hasControlValue(fieldControl(field)));
    };

    const syncFields = () => gate.querySelectorAll(".auth-field").forEach(syncField);

    const clearCaps = (field) => {
      if (!field) return;
      field.classList.remove("afm-caps-active");
      gate.classList.toggle("afm-caps-lock", Boolean(gate.querySelector(".auth-field.afm-caps-active")));
    };

    const syncCaps = (event) => {
      const input = event.target.closest?.('input[type="password"]');
      if (!input || typeof event.getModifierState !== "function") return;
      const field = input.closest(".auth-field");
      const active = event.getModifierState("CapsLock");
      field?.classList.toggle("afm-caps-active", active);
      gate.classList.toggle("afm-caps-lock", Boolean(gate.querySelector(".auth-field.afm-caps-active")));
    };

    const syncTabs = () => {
      const activeIndex = Math.max(0, tabs.findIndex((tab) => tab.getAttribute("aria-selected") === "true" || tab.classList.contains("active")));
      const tabHost = gate.querySelector(".auth-mode-tabs");
      tabHost?.style.setProperty("--afm-tab-count", String(Math.max(tabs.length, 1)));
      tabHost?.style.setProperty("--afm-tab-index", String(activeIndex));
    };

    const syncErrors = () => {
      gate.querySelectorAll("[data-field-error]").forEach((error) => {
        const visible = Boolean(error.textContent.trim());
        error.classList.toggle("afm-visible", visible);
        error.closest(".auth-field")?.classList.toggle("afm-has-inline-error", visible);
      });
    };

    const inferOAuthLoading = () => {
      const skeleton = gate.querySelector("[data-auth-loading], .auth-oauth-skeleton");
      const provider = gate.querySelector("[data-oauth-provider]");
      return Boolean(
        (skeleton && !skeleton.hidden)
        || provider?.getAttribute("aria-busy") === "true"
        || provider?.classList.contains("is-loading")
      );
    };

    const syncOAuth = () => {
      const loading = oauthOverride === null ? inferOAuthLoading() : oauthOverride;
      gate.classList.toggle("afm-oauth-loading", loading);
      gate.querySelector("[data-auth-loading], .auth-oauth-skeleton")?.classList.toggle("afm-visible", loading);
    };

    const setVisualState = (requestedState = "idle") => {
      const state = ["idle", "loading", "success", "error", "offline"].includes(requestedState)
        ? requestedState
        : "idle";
      if (card) card.dataset.afmState = state;
      gate.dataset.afmState = state;
    };

    const syncPlatformState = () => {
      const state = card?.dataset.authState || gate.dataset.authStatus || "idle";
      setVisualState(state === "info" ? "idle" : state);
    };

    const syncVisibility = () => {
      const hidden = document.visibilityState !== "visible";
      gate.classList.toggle("afm-document-hidden", hidden);
      if (hidden) resetPointer();
    };

    let syncFrame = 0;
    const scheduleSync = () => {
      if (syncFrame || destroyed) return;
      syncFrame = requestAnimationFrame(() => {
        syncFrame = 0;
        syncTabs();
        syncErrors();
        syncOAuth();
        syncPlatformState();
        scheduleReadiness();
      });
    };

    const observer = new MutationObserver(scheduleSync);
    observer.observe(gate, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class", "hidden", "aria-selected", "aria-busy", "data-auth-state", "data-auth-status", "data-auth-view", "data-signup-step"]
    });

    on(card, "pointermove", queuePointer, { passive: true });
    on(card, "pointerleave", resetPointer, { passive: true });
    on(gate, "focusin", (event) => {
      const field = event.target.closest?.(".auth-field");
      if (!field) return;
      field.classList.add("afm-is-focused");
      syncField(field);
    });
    on(gate, "focusout", (event) => {
      const field = event.target.closest?.(".auth-field");
      if (!field) return;
      if (!event.relatedTarget || !field.contains(event.relatedTarget)) field.classList.remove("afm-is-focused");
      syncField(field);
      if (event.target.matches?.('input[type="password"]')) clearCaps(field);
    });
    on(gate, "input", (event) => {
      syncField(event.target.closest?.(".auth-field"));
      scheduleReadiness();
    });
    on(gate, "change", (event) => {
      syncField(event.target.closest?.(".auth-field"));
      scheduleReadiness();
    });
    on(gate, "keydown", syncCaps);
    on(gate, "keyup", syncCaps);
    on(gate, "click", (event) => {
      paintActionRipple(event);
      if (event.target.closest?.("[data-auth-tab], .auth-mode-tabs [role='tab']")) requestAnimationFrame(syncTabs);
      scheduleReadiness();
    });

    const handleMotionPreference = () => {
      gate.classList.toggle("afm-reduced-motion", reducedMotion.matches);
      gate.classList.toggle("afm-mobile-motion", !desktopPointer.matches);
      resetPointer();
    };

    const addMediaListener = (query, handler) => {
      if (query.addEventListener) {
        query.addEventListener("change", handler);
        listeners.push(() => query.removeEventListener("change", handler));
      } else if (query.addListener) {
        query.addListener(handler);
        listeners.push(() => query.removeListener(handler));
      }
    };

    addMediaListener(reducedMotion, handleMotionPreference);
    addMediaListener(desktopPointer, handleMotionPreference);
    on(document, "visibilitychange", syncVisibility);

    const onOAuthState = (event) => {
      const detail = event.detail || {};
      if (typeof detail.loading === "boolean") oauthOverride = detail.loading;
      else if (typeof detail.busy === "boolean") oauthOverride = detail.busy;
      else if (detail.state === "idle" || detail.state === "complete") oauthOverride = false;
      else if (detail.state === "loading") oauthOverride = true;
      syncOAuth();
    };

    const onAuthVisualState = (event) => {
      const detail = event.detail || {};
      if (detail.state) setVisualState(detail.state);
    };

    const onAuthChange = (event) => setVisualState(event.detail?.user ? "success" : "idle");
    const onAuthSuccess = () => setVisualState("success");

    on(gate, "hh:auth-oauth-state", onOAuthState);
    on(window, "hh:auth-oauth-state", onOAuthState);
    on(gate, "hh:auth-form-state", onAuthVisualState);
    on(window, "hh:auth-form-state", onAuthVisualState);
    on(gate, "hh:auth-success", onAuthSuccess);
    on(window, "hh:auth-change", onAuthChange);
    on(gate, "hh:auth-signup-step", syncTabs);

    const destroy = () => {
      if (destroyed) return;
      destroyed = true;
      observer.disconnect();
      listeners.splice(0).forEach((remove) => remove());
      if (frame) cancelAnimationFrame(frame);
      if (syncFrame) cancelAnimationFrame(syncFrame);
      if (readinessFrame) cancelAnimationFrame(readinessFrame);
      resetPointer();
      readinessOutput.remove();
      gate.classList.remove(
        "auth-form-motion",
        "auth-form-motion-ready",
        "afm-oauth-loading",
        "afm-caps-lock",
        "afm-document-hidden",
        "afm-reduced-motion",
        "afm-mobile-motion"
      );
      delete gate.dataset.authFormMotionReady;
      delete gate.dataset.afmState;
      delete gate.dataset.authPolishMode;
      delete gate.dataset.authReadiness;
      gate.style.removeProperty("--auth-readiness");
      gate.querySelectorAll(".afm-is-focused, .afm-has-value, .afm-caps-active, .afm-visible, .afm-pointer-hot, .afm-has-inline-error").forEach((node) => {
        node.classList.remove("afm-is-focused", "afm-has-value", "afm-caps-active", "afm-visible", "afm-pointer-hot", "afm-has-inline-error");
      });
    };

    on(window, "pagehide", (event) => {
      if (!event.persisted) destroy();
    });

    gate.classList.add("auth-form-motion", "auth-form-motion-ready");
    gate.dataset.authFormMotionReady = "true";
    syncFields();
    syncTabs();
    syncErrors();
    syncOAuth();
    syncPlatformState();
    syncVisibility();
    handleMotionPreference();
    syncReadiness();
    window.setTimeout(scheduleReadiness, 700);

    window.HHAuthFormMotion = Object.freeze({
      available: true,
      refresh: () => {
        syncFields();
        scheduleSync();
      },
      setState: setVisualState,
      destroy
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
