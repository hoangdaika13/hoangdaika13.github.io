(() => {
  "use strict";

  const STATES = new Set(["idle", "hover", "focus", "loading", "success", "error"]);
  const normalizeState = (value) => {
    const state = String(value || "").trim().toLowerCase();
    return STATES.has(state) ? state : "idle";
  };

  const start = () => {
    if (window.HHAuthLogoMotion?.available) return window.HHAuthLogoMotion;

    const gate = document.querySelector("#authGate");
    if (!gate) {
      window.HHAuthLogoMotion = Object.freeze({
        available: false,
        setState: () => false,
        getState: () => "idle",
        destroy: () => false
      });
      return window.HHAuthLogoMotion;
    }

    const controller = new AbortController();
    const { signal } = controller;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)") || {
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {}
    };
    const status = gate.querySelector("#authGateStatus");
    const authCard = gate.querySelector("[data-auth-card], .auth-gate-card");
    const forms = [...gate.querySelectorAll("form")];
    const logoHosts = [
      gate.querySelector(".auth-brand-lockup .brand-mark"),
      gate.querySelector(".auth-card-heading > span")
    ].filter((host) => host?.querySelector("img"));

    let currentState = "idle";
    let hoveredLogo = null;
    let focusedField = null;
    let pendingSubmit = false;
    let transientError = false;
    let destroyed = false;
    let pointerFrame = 0;
    let focusFrame = 0;
    let errorTimer = 0;
    let statusSyncQueued = false;
    const observers = [];

    const addEffects = (host) => {
      host.classList.add("hh-auth-logo-motion");
      if (host.querySelector(":scope > .hh-auth-logo-fx")) return;

      const effects = document.createElement("span");
      effects.className = "hh-auth-logo-fx";
      effects.setAttribute("aria-hidden", "true");

      const glow = document.createElement("span");
      glow.className = "hh-auth-logo-glow";
      const ring = document.createElement("span");
      ring.className = "hh-auth-logo-ring";
      effects.append(glow, ring);

      for (let index = 0; index < 8; index += 1) {
        const ray = document.createElement("i");
        ray.className = "hh-auth-logo-ray";
        ray.style.setProperty("--hh-ray-index", String(index));
        effects.append(ray);
      }

      host.append(effects);
    };

    logoHosts.forEach(addEffects);

    const setPausedState = () => {
      gate.dataset.logoPaused = String(document.visibilityState !== "visible");
      gate.dataset.logoMotion = reducedMotion.matches ? "reduced" : "full";
    };

    const clearErrorPulse = () => {
      window.clearTimeout(errorTimer);
      errorTimer = 0;
      logoHosts.forEach((host) => host.classList.remove("is-logo-error-pulse"));
    };

    const applyState = (requestedState) => {
      if (destroyed) return false;
      const nextState = normalizeState(requestedState);
      currentState = nextState;
      gate.dataset.logoState = nextState;

      if (nextState === "error") {
        logoHosts.forEach((host) => {
          host.classList.remove("is-logo-error-pulse");
          void host.offsetWidth;
          host.classList.add("is-logo-error-pulse");
        });
      } else {
        clearErrorPulse();
      }
      return true;
    };

    const statusText = () => String(status?.textContent || "").trim().toLowerCase();
    const statusState = () => {
      const declared = String(
        status?.dataset.state
        || gate.dataset.authStatus
        || authCard?.dataset.authState
        || ""
      ).toLowerCase();
      const text = statusText();

      if (
        declared === "success"
        || status?.classList.contains("is-success")
        || gate.classList.contains("auth-success")
        || gate.classList.contains("is-auth-success")
      ) return "success";

      if (
        declared === "error"
        || status?.classList.contains("is-error")
        || /\b(error|failed|failure)\b|loi|lỗi|khong the|không thể|that bai|thất bại/.test(text)
      ) return "error";

      if (
        declared === "loading"
        || status?.classList.contains("is-loading")
        || /\b(loading|checking|processing)\b|dang |đang |xac thuc|xác thực|kiem tra phien|kiểm tra phiên/.test(text)
      ) return "loading";

      return "idle";
    };

    const isFormBusy = () => forms.some((form) => (
      form.classList.contains("auth-authenticating")
      || Boolean(form.querySelector('[aria-busy="true"]'))
    ));

    const applyFocusVector = () => {
      window.cancelAnimationFrame(focusFrame);
      if (!focusedField || reducedMotion.matches || document.visibilityState !== "visible") return;

      focusFrame = window.requestAnimationFrame(() => {
        const targetRect = focusedField?.getBoundingClientRect();
        if (!targetRect) return;
        const targetX = targetRect.left + targetRect.width / 2;
        const targetY = targetRect.top + targetRect.height / 2;

        logoHosts.forEach((host) => {
          const rect = host.getBoundingClientRect();
          const deltaX = Math.max(-4, Math.min(4, (targetX - (rect.left + rect.width / 2)) / 90));
          const deltaY = Math.max(-3, Math.min(3, (targetY - (rect.top + rect.height / 2)) / 120));
          host.style.setProperty("--hh-logo-focus-x", `${deltaX.toFixed(2)}px`);
          host.style.setProperty("--hh-logo-focus-y", `${deltaY.toFixed(2)}px`);
        });
      });
    };

    const fallbackState = () => {
      if (focusedField?.isConnected && gate.contains(focusedField)) return "focus";
      if (hoveredLogo?.isConnected) return "hover";
      return "idle";
    };

    const syncFromDom = ({ statusChanged = false } = {}) => {
      if (destroyed) return;
      const operationalState = statusState();

      if (operationalState === "success") {
        pendingSubmit = false;
        transientError = false;
        applyState("success");
        return;
      }

      if (operationalState === "error" && statusChanged) {
        pendingSubmit = false;
        transientError = true;
        applyState("error");
        window.clearTimeout(errorTimer);
        errorTimer = window.setTimeout(() => {
          transientError = false;
          logoHosts.forEach((host) => host.classList.remove("is-logo-error-pulse"));
          applyState(fallbackState());
        }, reducedMotion.matches ? 120 : 720);
        return;
      }

      if (transientError) return;
      if (operationalState === "loading" || pendingSubmit || isFormBusy()) {
        applyState("loading");
        return;
      }

      pendingSubmit = false;
      applyState(fallbackState());
    };

    const queueStatusSync = () => {
      if (statusSyncQueued || destroyed) return;
      statusSyncQueued = true;
      queueMicrotask(() => {
        statusSyncQueued = false;
        syncFromDom({ statusChanged: true });
      });
    };

    const updatePointerTilt = (event, host) => {
      if (reducedMotion.matches || document.visibilityState !== "visible") return;
      window.cancelAnimationFrame(pointerFrame);
      pointerFrame = window.requestAnimationFrame(() => {
        const rect = host.getBoundingClientRect();
        const ratioX = Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(rect.width, 1)));
        const ratioY = Math.max(0, Math.min(1, (event.clientY - rect.top) / Math.max(rect.height, 1)));
        host.style.setProperty("--hh-logo-tilt-x", `${((.5 - ratioY) * 8).toFixed(2)}deg`);
        host.style.setProperty("--hh-logo-tilt-y", `${((ratioX - .5) * 10).toFixed(2)}deg`);
      });
    };

    logoHosts.forEach((host) => {
      host.addEventListener("pointerenter", () => {
        hoveredLogo = host;
        host.classList.add("is-logo-hovered");
        syncFromDom();
      }, { signal, passive: true });

      host.addEventListener("pointermove", (event) => updatePointerTilt(event, host), { signal, passive: true });

      host.addEventListener("pointerleave", () => {
        if (hoveredLogo === host) hoveredLogo = null;
        host.classList.remove("is-logo-hovered");
        host.style.setProperty("--hh-logo-tilt-x", "0deg");
        host.style.setProperty("--hh-logo-tilt-y", "0deg");
        syncFromDom();
      }, { signal, passive: true });
    });

    gate.addEventListener("focusin", (event) => {
      const field = event.target.closest?.("form input, form select, form textarea");
      if (!field) return;
      focusedField = field;
      applyFocusVector();
      syncFromDom();
    }, { signal });

    gate.addEventListener("focusout", () => {
      queueMicrotask(() => {
        const active = document.activeElement;
        focusedField = active?.matches?.("#authGate form input, #authGate form select, #authGate form textarea") ? active : null;
        applyFocusVector();
        syncFromDom();
      });
    }, { signal });

    gate.addEventListener("submit", () => {
      pendingSubmit = true;
      applyState("loading");
      queueMicrotask(() => {
        if (!isFormBusy() && statusState() !== "loading") pendingSubmit = false;
        syncFromDom();
      });
    }, { capture: true, signal });

    gate.addEventListener("invalid", () => {
      transientError = true;
      applyState("error");
      window.clearTimeout(errorTimer);
      errorTimer = window.setTimeout(() => {
        transientError = false;
        applyState(fallbackState());
      }, reducedMotion.matches ? 120 : 620);
    }, { capture: true, signal });

    gate.addEventListener("hh:auth-success", () => {
      pendingSubmit = false;
      transientError = false;
      applyState("success");
    }, { signal });

    ["hh:auth-error", "auth:error"].forEach((eventName) => {
      gate.addEventListener(eventName, () => syncFromDom({ statusChanged: true }), { signal });
    });

    const statusObserver = status && new MutationObserver(queueStatusSync);
    statusObserver?.observe(status, {
      attributes: true,
      attributeFilter: ["class", "data-state", "hidden"],
      childList: true,
      characterData: true,
      subtree: true
    });
    if (statusObserver) observers.push(statusObserver);

    const gateObserver = new MutationObserver(queueStatusSync);
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

    forms.forEach((form) => {
      const formObserver = new MutationObserver(() => syncFromDom());
      formObserver.observe(form, {
        attributes: true,
        attributeFilter: ["class", "aria-busy", "aria-invalid"],
        subtree: true
      });
      observers.push(formObserver);
    });

    const onVisibilityChange = () => {
      setPausedState();
      if (document.visibilityState === "visible") {
        applyFocusVector();
        syncFromDom();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange, { signal });

    const onMotionPreferenceChange = () => {
      setPausedState();
      applyFocusVector();
      syncFromDom();
    };
    reducedMotion.addEventListener?.("change", onMotionPreferenceChange, { signal });

    window.addEventListener("resize", applyFocusVector, { signal, passive: true });

    const destroy = () => {
      if (destroyed) return false;
      destroyed = true;
      controller.abort();
      observers.forEach((observer) => observer.disconnect());
      window.clearTimeout(errorTimer);
      window.cancelAnimationFrame(pointerFrame);
      window.cancelAnimationFrame(focusFrame);
      logoHosts.forEach((host) => {
        host.classList.remove("hh-auth-logo-motion", "is-logo-hovered", "is-logo-error-pulse");
        host.style.removeProperty("--hh-logo-tilt-x");
        host.style.removeProperty("--hh-logo-tilt-y");
        host.style.removeProperty("--hh-logo-focus-x");
        host.style.removeProperty("--hh-logo-focus-y");
        host.querySelector(":scope > .hh-auth-logo-fx")?.remove();
      });
      delete gate.dataset.logoState;
      delete gate.dataset.logoPaused;
      delete gate.dataset.logoMotion;
      return true;
    };

    window.addEventListener("pagehide", (event) => {
      if (!event.persisted) destroy();
    }, { signal });

    const publicApi = Object.freeze({
      get available() { return !destroyed; },
      setState: (state) => {
        const nextState = normalizeState(state);
        pendingSubmit = nextState === "loading";
        transientError = nextState === "error";
        return applyState(nextState);
      },
      getState: () => currentState,
      destroy
    });

    window.HHAuthLogoMotion = publicApi;
    setPausedState();
    syncFromDom({ statusChanged: true });
    return publicApi;
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
