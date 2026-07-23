(() => {
  "use strict";

  const instances = new Map();
  const DEFAULT_ROOT = "#authGate";
  const MODULES = Object.freeze({
    home: "home",
    ai: "ai",
    script: "script",
    creative: "creative",
    music: "music",
    media: "media",
    design: "design",
    dev: "dev",
    learning: "learning",
    game: "game",
    entertainment: "game",
    community: "community"
  });
  const SCORE_LABELS = Object.freeze([
    "Ch\u01b0a \u0111o",
    "R\u1ea5t y\u1ebfu",
    "Y\u1ebfu",
    "Trung b\u00ecnh",
    "M\u1ea1nh",
    "R\u1ea5t m\u1ea1nh"
  ]);

  const resolveRoot = (target) => {
    if (target instanceof Element) return target;
    return document.querySelector(typeof target === "string" ? target : DEFAULT_ROOT);
  };

  const normalizeMountArgs = (target, options) => {
    if (target && typeof target === "object" && !(target instanceof Element)) {
      return { target: target.root || DEFAULT_ROOT, options: target };
    }
    return { target: target || DEFAULT_ROOT, options: options || {} };
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const messageFor = (control) => {
    const validity = control?.validity;
    if (!validity) return "";
    if (validity.valueMissing) return "Vui l\u00f2ng ho\u00e0n th\u00e0nh tr\u01b0\u1eddng n\u00e0y.";
    if (validity.typeMismatch && control.type === "email") return "Email ch\u01b0a \u0111\u00fang \u0111\u1ecbnh d\u1ea1ng.";
    if (validity.tooShort) return `C\u1ea7n \u00edt nh\u1ea5t ${control.minLength} k\u00fd t\u1ef1.`;
    if (validity.tooLong) return `T\u1ed1i \u0111a ${control.maxLength} k\u00fd t\u1ef1.`;
    if (validity.patternMismatch) return "N\u1ed9i dung ch\u01b0a \u0111\u00fang \u0111\u1ecbnh d\u1ea1ng y\u00eau c\u1ea7u.";
    if (validity.rangeUnderflow) return `Gi\u00e1 tr\u1ecb t\u1ed1i thi\u1ec3u l\u00e0 ${control.min}.`;
    if (validity.rangeOverflow) return `Gi\u00e1 tr\u1ecb t\u1ed1i \u0111a l\u00e0 ${control.max}.`;
    if (validity.stepMismatch || validity.badInput) return "Vui l\u00f2ng ki\u1ec3m tra l\u1ea1i gi\u00e1 tr\u1ecb.";
    if (validity.customError) return control.validationMessage || "Vui l\u00f2ng ki\u1ec3m tra l\u1ea1i.";
    return "";
  };

  const findErrorOutput = (field, control) => {
    const escapedName = window.CSS?.escape
      ? window.CSS.escape(control.name || "")
      : String(control.name || "").replace(/[^a-zA-Z0-9_-]/g, "");
    let output = escapedName
      ? field.querySelector(`[data-field-error="${escapedName}"]`)
      : null;
    output ||= field.querySelector("[data-field-error], .auth-inline-error, .hcp-inline-error");
    if (output) return output;

    output = document.createElement("small");
    output.className = "hcp-inline-error";
    output.dataset.hcpCreated = "true";
    output.setAttribute("aria-live", "polite");
    field.append(output);
    return output;
  };

  const createInstance = (root, options) => {
    const card = root.querySelector("[data-auth-card], .auth-gate-card");
    if (!card) return null;

    const disposers = [];
    const frames = new Set();
    let destroyed = false;
    let pointerFrame = 0;
    let pendingPointer = null;
    let lastStrength = "";

    const on = (target, type, handler, eventOptions) => {
      if (!target?.addEventListener) return;
      target.addEventListener(type, handler, eventOptions);
      disposers.push(() => target.removeEventListener(type, handler, eventOptions));
    };

    const schedule = (callback) => {
      const id = requestAnimationFrame(() => {
        frames.delete(id);
        if (!destroyed) callback();
      });
      frames.add(id);
      return id;
    };

    const addMediaListener = (query, handler) => {
      if (query.addEventListener) {
        query.addEventListener("change", handler);
        disposers.push(() => query.removeEventListener("change", handler));
      } else if (query.addListener) {
        query.addListener(handler);
        disposers.push(() => query.removeListener(handler));
      }
    };

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobileLayout = window.matchMedia("(max-width: 920px), (hover: none), (pointer: coarse)");

    const syncEnvironment = () => {
      root.classList.toggle("hcp-reduced-motion", reducedMotion.matches);
      root.classList.toggle("hcp-mobile", mobileLayout.matches);
      root.classList.toggle("hcp-offline", navigator.onLine === false);
      if (reducedMotion.matches || mobileLayout.matches) resetPointer();
    };

    const syncTabs = () => {
      const host = root.querySelector(".auth-mode-tabs");
      if (!host) return;
      const tabs = [...host.querySelectorAll("[data-auth-tab], [role='tab']")];
      const active = Math.max(0, tabs.findIndex((tab) => (
        tab.getAttribute("aria-selected") === "true" || tab.classList.contains("active")
      )));
      root.style.setProperty("--hcp-tab-count", String(Math.max(1, tabs.length)));
      root.style.setProperty("--hcp-tab-index", String(active));
    };

    const fieldHasValue = (control) => {
      if (!control) return false;
      if (control.type === "checkbox" || control.type === "radio") return control.checked;
      if (control.type === "file") return Boolean(control.files?.length);
      try {
        return !control.matches(":placeholder-shown");
      } catch {
        return control.validity?.valueMissing === false;
      }
    };

    const syncField = (field) => {
      const control = field?.querySelector("input, select, textarea");
      if (!control) return;
      field.classList.toggle("hcp-has-value", fieldHasValue(control));
    };

    const validateControl = (control, force = false) => {
      if (!control?.matches?.("input, select, textarea")) return true;
      if (control.disabled || control.type === "hidden" || control.type === "file") return true;
      const field = control.closest(".auth-field");
      if (!field) return control.validity?.valid !== false;

      syncField(field);
      const invalid = control.validity?.valid === false;
      const touched = force || field.dataset.hcpTouched === "true";
      field.classList.toggle("hcp-invalid", invalid && touched);
      if (!touched) return !invalid;

      const output = findErrorOutput(field, control);
      if (invalid) {
        const message = messageFor(control);
        if (!output.textContent.trim() || output.dataset.hcpOwned === "true") {
          output.textContent = message;
          output.dataset.hcpOwned = "true";
        }
        output.classList.toggle("hcp-visible", Boolean(output.textContent.trim()));
        if (control.getAttribute("aria-invalid") !== "true") {
          control.setAttribute("aria-invalid", "true");
          control.dataset.hcpAriaInvalidOwned = "true";
        }
      } else if (output.dataset.hcpOwned === "true") {
        output.textContent = "";
        output.classList.remove("hcp-visible");
        delete output.dataset.hcpOwned;
        if (control.dataset.hcpAriaInvalidOwned === "true") {
          control.removeAttribute("aria-invalid");
          delete control.dataset.hcpAriaInvalidOwned;
        }
      }
      return !invalid;
    };

    const syncCaps = (event) => {
      const control = event.target?.closest?.('input[type="password"], input[data-register-password]');
      if (!control || typeof event.getModifierState !== "function") return;
      const field = control.closest(".auth-field");
      if (!field) return;
      const active = event.getModifierState("CapsLock");
      const warning = field.querySelector("[data-caps-warning], .auth-caps-warning");
      field.classList.toggle("hcp-caps-active", active);
      if (warning) warning.hidden = !active;
    };

    const clearCaps = (control) => {
      const field = control?.closest?.(".auth-field");
      if (!field) return;
      field.classList.remove("hcp-caps-active");
      const warning = field.querySelector("[data-caps-warning], .auth-caps-warning");
      if (warning) warning.hidden = true;
    };

    const strengthDetail = () => {
      const meter = root.querySelector("[data-password-strength]");
      if (!meter) return null;
      const score = clamp(Number.parseInt(meter.dataset.score || "0", 10) || 0, 0, 5);
      return Object.freeze({
        score,
        label: SCORE_LABELS[score],
        source: "meter",
        measured: score > 0
      });
    };

    const publishStrength = () => {
      const detail = strengthDetail();
      if (!detail) return;
      const signature = `${detail.score}:${detail.label}`;
      if (signature === lastStrength) return;
      lastStrength = signature;
      const event = new CustomEvent("hh:auth-password-strength", { bubbles: true, detail });
      root.dispatchEvent(event);
    };

    const moduleName = (raw) => MODULES[String(raw || "").trim().toLowerCase()] || "home";

    const setModule = (raw) => {
      const module = moduleName(raw);
      root.dataset.hcpModule = module;
      root.dispatchEvent(new CustomEvent("hh:cosmic-prism-module", {
        bubbles: true,
        detail: Object.freeze({ module })
      }));
    };

    const paintPointer = () => {
      pointerFrame = 0;
      if (!pendingPointer || reducedMotion.matches || mobileLayout.matches || document.hidden) return;
      const bounds = card.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const x = clamp(((pendingPointer.clientX - bounds.left) / bounds.width) * 100, 0, 100);
      const y = clamp(((pendingPointer.clientY - bounds.top) / bounds.height) * 100, 0, 100);
      root.style.setProperty("--hcp-pointer-x", `${x.toFixed(1)}%`);
      root.style.setProperty("--hcp-pointer-y", `${y.toFixed(1)}%`);
      root.classList.add("hcp-pointer-active");
      pendingPointer = null;
    };

    const queuePointer = (event) => {
      if (event.pointerType === "touch" || reducedMotion.matches || mobileLayout.matches) return;
      pendingPointer = event;
      if (!pointerFrame) pointerFrame = schedule(paintPointer);
    };

    function resetPointer() {
      if (pointerFrame) cancelAnimationFrame(pointerFrame);
      frames.delete(pointerFrame);
      pointerFrame = 0;
      pendingPointer = null;
      root.classList.remove("hcp-pointer-active");
      root.style.setProperty("--hcp-pointer-x", "50%");
      root.style.setProperty("--hcp-pointer-y", "18%");
    }

    let syncFrame = 0;
    const syncAll = () => {
      syncFrame = 0;
      syncTabs();
      root.querySelectorAll(".auth-field").forEach(syncField);
      root.querySelectorAll("[data-field-error], .auth-inline-error").forEach((output) => {
        output.classList.toggle("hcp-visible", Boolean(output.textContent.trim()));
        output.closest(".auth-field")?.classList.toggle("hcp-invalid", Boolean(output.textContent.trim()));
      });
      publishStrength();
      syncEnvironment();
    };

    const scheduleSync = () => {
      if (!syncFrame) syncFrame = schedule(syncAll);
    };

    const observer = new MutationObserver((records) => {
      if (records.some((record) => (
        record.type === "childList"
        || record.type === "characterData"
        || ["class", "hidden", "aria-selected", "aria-invalid", "data-score", "data-auth-view"].includes(record.attributeName)
      ))) scheduleSync();
    });
    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class", "hidden", "aria-selected", "aria-invalid", "data-score", "data-auth-view"]
    });

    on(card, "pointermove", queuePointer, { passive: true });
    on(card, "pointerleave", resetPointer, { passive: true });
    on(root, "focusin", (event) => syncField(event.target.closest?.(".auth-field")));
    on(root, "focusout", (event) => {
      const control = event.target;
      if (!control?.matches?.("input, select, textarea")) return;
      const field = control.closest(".auth-field");
      if (field) field.dataset.hcpTouched = "true";
      validateControl(control, true);
      if (control.matches('input[type="password"]')) clearCaps(control);
    });
    on(root, "input", (event) => {
      const control = event.target;
      syncField(control.closest?.(".auth-field"));
      if (control.closest?.(".auth-field")?.dataset.hcpTouched === "true") validateControl(control);
      scheduleSync();
    });
    on(root, "change", (event) => validateControl(event.target, true));
    on(root, "invalid", (event) => {
      event.preventDefault();
      const control = event.target;
      const field = control.closest?.(".auth-field");
      if (field) field.dataset.hcpTouched = "true";
      validateControl(control, true);
    }, true);
    on(root, "keydown", syncCaps);
    on(root, "keyup", syncCaps);
    on(root, "click", (event) => {
      const moduleControl = event.target.closest?.("[data-auth-demo], [data-universe-id]");
      if (moduleControl) setModule(moduleControl.dataset.authDemo || moduleControl.dataset.universeId);
      if (event.target.closest?.("[data-auth-tab], [role='tab']")) scheduleSync();
    });
    on(root, "hh:auth-demo-change", (event) => setModule(event.detail?.id));
    on(window, "hh:auth-universe-select", (event) => setModule(event.detail?.id));
    on(window, "online", syncEnvironment);
    on(window, "offline", syncEnvironment);
    on(document, "visibilitychange", () => {
      root.classList.toggle("hcp-document-hidden", document.hidden);
      if (document.hidden) resetPointer();
    });
    addMediaListener(reducedMotion, syncEnvironment);
    addMediaListener(mobileLayout, syncEnvironment);

    root.classList.add("hcp-form");
    card.classList.add("hcp-card");
    root.dataset.hcpFormReady = "true";
    setModule(options.module || root.dataset.hcpModule || "home");
    syncAll();

    const destroy = () => {
      if (destroyed) return;
      destroyed = true;
      observer.disconnect();
      disposers.splice(0).forEach((dispose) => dispose());
      frames.forEach((id) => cancelAnimationFrame(id));
      frames.clear();
      root.querySelectorAll('[data-hcp-created="true"]').forEach((node) => node.remove());
      root.querySelectorAll('[data-hcp-owned="true"]').forEach((node) => {
        node.textContent = "";
        delete node.dataset.hcpOwned;
      });
      root.querySelectorAll('[data-hcp-aria-invalid-owned="true"]').forEach((node) => {
        node.removeAttribute("aria-invalid");
        delete node.dataset.hcpAriaInvalidOwned;
      });
      root.querySelectorAll(".hcp-has-value, .hcp-invalid, .hcp-caps-active, .hcp-visible").forEach((node) => {
        node.classList.remove("hcp-has-value", "hcp-invalid", "hcp-caps-active", "hcp-visible");
      });
      root.querySelectorAll("[data-hcp-touched]").forEach((node) => delete node.dataset.hcpTouched);
      root.classList.remove(
        "hcp-form",
        "hcp-pointer-active",
        "hcp-reduced-motion",
        "hcp-mobile",
        "hcp-offline",
        "hcp-document-hidden"
      );
      card.classList.remove("hcp-card");
      ["--hcp-pointer-x", "--hcp-pointer-y", "--hcp-tab-count", "--hcp-tab-index"].forEach((name) => root.style.removeProperty(name));
      delete root.dataset.hcpFormReady;
      delete root.dataset.hcpModule;
      instances.delete(root);
    };

    return Object.freeze({ root, card, setModule, sync: syncAll, destroy });
  };

  const mount = (target = DEFAULT_ROOT, options = {}) => {
    const normalized = normalizeMountArgs(target, options);
    const root = resolveRoot(normalized.target);
    if (!root) return Object.freeze({ available: false, reason: "auth-root-missing" });
    if (instances.has(root)) return instances.get(root);
    const instance = createInstance(root, normalized.options);
    if (!instance) return Object.freeze({ available: false, reason: "auth-card-missing" });
    instances.set(root, instance);
    return instance;
  };

  const unmount = (target = DEFAULT_ROOT) => {
    const root = resolveRoot(target);
    const instance = root ? instances.get(root) : null;
    if (!instance) return false;
    instance.destroy();
    return true;
  };

  window.HHCosmicPrismForm = Object.freeze({ mount, unmount });

  const boot = () => mount();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
