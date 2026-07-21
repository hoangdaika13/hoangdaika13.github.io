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

    const on = (target, type, handler, options) => {
      if (!target?.addEventListener) return;
      target.addEventListener(type, handler, options);
      listeners.push(() => target.removeEventListener(type, handler, options));
    };

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

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
      });
    };

    const observer = new MutationObserver(scheduleSync);
    observer.observe(gate, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class", "hidden", "aria-selected", "aria-busy", "data-auth-state", "data-auth-status"]
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
    on(gate, "input", (event) => syncField(event.target.closest?.(".auth-field")));
    on(gate, "change", (event) => syncField(event.target.closest?.(".auth-field")));
    on(gate, "keydown", syncCaps);
    on(gate, "keyup", syncCaps);
    on(gate, "click", (event) => {
      if (event.target.closest?.("[data-auth-tab], .auth-mode-tabs [role='tab']")) requestAnimationFrame(syncTabs);
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
      resetPointer();
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
