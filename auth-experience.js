(() => {
  "use strict";

  const gate = document.querySelector("#authGate");
  if (!gate) {
    window.HHAuthExperience = { available: false };
    return;
  }

  const panels = [...gate.querySelectorAll(".auth-spectrum i")];
  const card = gate.querySelector(".auth-gate-card");
  const previewShell = gate.querySelector(".auth-product-preview");
  const preview = gate.querySelector("[data-auth-preview]");
  const demoButtons = [...gate.querySelectorAll("[data-auth-demo]")];
  const previewPauseZones = [gate.querySelector(".auth-feature-showcase"), previewShell].filter(Boolean);
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const desktopPointer = matchMedia("(min-width: 921px) and (pointer: fine)");
  const rotationDelay = 4200;
  let pointerFrame = 0;
  let pointerEvent = null;
  let demoTimer = 0;
  let demoIndex = 0;
  let signupStep = 0;
  let rotationPaused = false;

  const demos = {
    ai: {
      tag: "AI WORKFLOW",
      title: "Biến ý tưởng thành quy trình AI hoàn chỉnh",
      description: "Chat đa mô hình, tối ưu prompt và chạy workflow trong cùng một không gian.",
      metric: "12",
      metricLabel: "Tác vụ AI",
      status: "98%",
      output: "6.4s",
      stages: ["Nhận yêu cầu", "AI xử lý", "Xuất kết quả"],
      foot: ["72%", "48%", "96%"],
      bars: [31, 68, 45, 88, 58, 76, 96]
    },
    script: {
      tag: "AI SCRIPT STUDIO",
      title: "Từ một brief thành cả series nội dung",
      description: "Viết dài tập, phân tích retention, dịch, xử lý hàng loạt và lưu hồ sơ huấn luyện riêng.",
      metric: "24",
      metricLabel: "Cảnh đã viết",
      status: "94%",
      output: "8 tập",
      stages: ["Phân tích brief", "Xây cấu trúc", "Tạo series"],
      foot: ["84%", "67%", "91%"],
      bars: [54, 83, 68, 94, 71, 88, 79]
    },
    media: {
      tag: "MEDIA PRODUCTION",
      title: "Biên tập và xuất bản media ngay trên web",
      description: "Photo Editor, Video Editor, thư viện media và quy trình xuất đa nền tảng.",
      metric: "20",
      metricLabel: "Creative engines",
      status: "4K",
      output: "12 định dạng",
      stages: ["Nhập tài nguyên", "Biên tập thông minh", "Xuất bản"],
      foot: ["63%", "86%", "93%"],
      bars: [82, 61, 92, 74, 88, 69, 97]
    },
    dev: {
      tag: "DEVELOPER TOOLKIT",
      title: "22 công cụ DEV trong một command center",
      description: "API tester, JSON, SQL, mã hóa, network và tiện ích lập trình dùng trực tiếp.",
      metric: "22",
      metricLabel: "Công cụ DEV",
      status: "200",
      output: "0 lỗi",
      stages: ["Nhập dữ liệu", "Chạy kiểm tra", "Nhận kết quả"],
      foot: ["91%", "74%", "99%"],
      bars: [66, 91, 58, 86, 95, 73, 89]
    },
    community: {
      tag: "REALTIME COMMUNITY",
      title: "Kết nối cộng đồng theo thời gian thực",
      description: "Chat, cuộc gọi, phòng nhóm, thông báo và trung tâm quản trị quyền riêng tư.",
      metric: "128",
      metricLabel: "Phiên kết nối",
      status: "LIVE",
      output: "32ms",
      stages: ["Tạo kết nối", "Đồng bộ realtime", "Tương tác"],
      foot: ["78%", "92%", "97%"],
      bars: [47, 77, 93, 68, 84, 96, 72]
    }
  };

  const setText = (selector, value) => {
    const node = gate.querySelector(selector);
    if (node) node.textContent = value;
  };

  const stopDemoRotation = () => {
    clearTimeout(demoTimer);
    demoTimer = 0;
  };

  const canRotate = () => (
    !rotationPaused
    && !document.hidden
    && !reducedMotion.matches
    && demoButtons.length > 1
  );

  const scheduleDemo = () => {
    stopDemoRotation();
    if (!canRotate()) return;
    demoTimer = window.setTimeout(() => {
      const next = (demoIndex + 1) % demoButtons.length;
      renderDemo(demoButtons[next].dataset.authDemo);
      scheduleDemo();
    }, rotationDelay);
  };

  const renderDemo = (id, shouldRestart = false) => {
    const data = demos[id];
    if (!data) return false;
    const selectedIndex = demoButtons.findIndex((button) => button.dataset.authDemo === id);
    if (selectedIndex >= 0) demoIndex = selectedIndex;
    demoButtons.forEach((button) => {
      const active = button.dataset.authDemo === id;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
    });
    gate.querySelectorAll("[data-auth-preview-nav]").forEach((item) => {
      item.classList.toggle("active", item.dataset.authPreviewNav === id);
    });
    setText("[data-auth-demo-counter]", `${String(demoIndex + 1).padStart(2, "0")} / ${String(demoButtons.length).padStart(2, "0")}`);
    setText("[data-auth-preview-tag]", data.tag);
    setText("[data-auth-preview-title]", data.title);
    setText("[data-auth-preview-description]", data.description);
    setText("[data-auth-preview-metric]", data.metric);
    setText("[data-auth-preview-metric-label]", data.metricLabel);
    setText("[data-auth-preview-status]", data.status);
    setText("[data-auth-preview-output]", data.output);
    ["one", "two", "three"].forEach((key, index) => setText(`[data-auth-stage-${key}]`, data.stages[index]));
    ["one", "two", "three"].forEach((key, index) => setText(`[data-auth-preview-foot-${key}]`, data.foot[index]));
    preview?.querySelectorAll(".auth-preview-chart > i").forEach((bar, index) => {
      bar.style.setProperty("--bar", `${data.bars[index] || 50}%`);
    });
    if (preview && !reducedMotion.matches) {
      preview.classList.remove("is-demo-switching");
      void preview.offsetWidth;
      preview.classList.add("is-demo-switching");
    }
    if (shouldRestart) scheduleDemo();
    gate.dispatchEvent(new CustomEvent("hh:auth-demo-change", { detail: { id, index: demoIndex } }));
    return true;
  };

  const setParallax = (x, y) => {
    panels.forEach((panel, index) => {
      const depth = (index + 1) * 0.9;
      panel.style.setProperty("--auth-px", `${(x * depth).toFixed(1)}px`);
      panel.style.setProperty("--auth-py", `${(y * depth).toFixed(1)}px`);
    });
  };

  const resetPointerEffects = () => {
    if (pointerFrame) cancelAnimationFrame(pointerFrame);
    pointerFrame = 0;
    pointerEvent = null;
    setParallax(0, 0);
    card?.style.setProperty("--auth-tilt-x", "0deg");
    card?.style.setProperty("--auth-tilt-y", "0deg");
    previewShell?.style.setProperty("--auth-preview-x", "0deg");
    previewShell?.style.setProperty("--auth-preview-y", "0deg");
  };

  const paintPointerEffects = () => {
    pointerFrame = 0;
    const event = pointerEvent;
    if (!event || reducedMotion.matches || !desktopPointer.matches) return;
    const x = (event.clientX / innerWidth - 0.5) * 7;
    const y = (event.clientY / innerHeight - 0.5) * 7;
    setParallax(x, y);
    gate.style.setProperty("--auth-cursor-x", `${event.clientX}px`);
    gate.style.setProperty("--auth-cursor-y", `${event.clientY}px`);
    card?.style.setProperty("--auth-tilt-x", `${(x * 0.34).toFixed(2)}deg`);
    card?.style.setProperty("--auth-tilt-y", `${(-y * 0.28).toFixed(2)}deg`);
    previewShell?.style.setProperty("--auth-preview-x", `${(x * 0.28).toFixed(2)}deg`);
    previewShell?.style.setProperty("--auth-preview-y", `${(-y * 0.2).toFixed(2)}deg`);
  };

  const queuePointerEffects = (event) => {
    if (reducedMotion.matches || !desktopPointer.matches) return;
    pointerEvent = event;
    if (!pointerFrame) pointerFrame = requestAnimationFrame(paintPointerEffects);
  };

  const getFieldMessage = (input) => {
    if (input.validity.valueMissing) return "Vui lòng điền thông tin này.";
    if (input.validity.typeMismatch) return "Định dạng thông tin chưa đúng.";
    if (input.validity.tooShort) return `Cần ít nhất ${input.minLength} ký tự.`;
    if (input.validity.tooLong) return `Tối đa ${input.maxLength} ký tự.`;
    if (input.validity.patternMismatch) return "Thông tin chưa đúng định dạng yêu cầu.";
    return input.validationMessage || "Vui lòng kiểm tra lại thông tin.";
  };

  const syncFieldState = (input, touched = false) => {
    const field = input.closest(".auth-field");
    if (!field) return;
    const hasValue = Boolean(input.value.trim());
    // Reading validity avoids recursively firing the `invalid` listener.
    const valid = input.validity.valid;
    const shouldShowInvalid = touched && !valid;
    field.classList.toggle("has-value", hasValue);
    field.classList.toggle("is-valid", hasValue && valid);
    field.classList.toggle("is-invalid", shouldShowInvalid);
    input.setAttribute("aria-invalid", String(shouldShowInvalid));
    const error = field.querySelector("[data-field-error]");
    if (error) {
      error.textContent = shouldShowInvalid ? getFieldMessage(input) : "";
      error.hidden = !shouldShowInvalid;
    }
  };

  const scorePassword = (value) => [
    value.length >= 8,
    /[a-zà-ỹ]/.test(value),
    /[A-ZÀ-Ỹ]/.test(value),
    /\d/.test(value),
    /[^A-Za-zÀ-ỹ\d]/.test(value)
  ].filter(Boolean).length;

  const updatePasswordStrength = (input) => {
    const meter = gate.querySelector("[data-password-strength]");
    if (!meter) return;
    const value = input.value;
    const score = value ? scorePassword(value) : 0;
    const labels = ["Độ mạnh mật khẩu", "Rất yếu", "Yếu", "Trung bình", "Mạnh", "Rất mạnh"];
    meter.dataset.score = String(score);
    meter.setAttribute("aria-label", `${labels[score]}: ${score} trên 5 điều kiện`);
    const label = meter.querySelector("span");
    if (label) label.textContent = labels[score];
    gate.querySelectorAll("[data-password-preview]").forEach((node) => {
      node.dataset.score = String(score);
      node.textContent = labels[score];
    });
    const checks = {
      length: value.length >= 8,
      lower: /[a-zà-ỹ]/.test(value),
      upper: /[A-ZÀ-Ỹ]/.test(value),
      number: /\d/.test(value),
      symbol: /[^A-Za-zÀ-ỹ\d]/.test(value)
    };
    gate.querySelectorAll("[data-password-requirement]").forEach((node) => {
      const passed = Boolean(checks[node.dataset.passwordRequirement]);
      node.classList.toggle("is-met", passed);
      node.setAttribute("aria-checked", String(passed));
    });
  };

  const syncPasswordConfirmation = (input, touched = false) => {
    const password = gate.querySelector("[data-register-password]");
    if (!password || !input) return;
    input.setCustomValidity(input.value && input.value !== password.value ? "Mật khẩu xác nhận chưa khớp." : "");
    syncFieldState(input, touched);
  };

  const signupSteps = [...gate.querySelectorAll("[data-signup-step]")];
  const setSignupStep = (requestedStep, focus = true) => {
    if (!signupSteps.length) {
      signupStep = Math.max(0, Number(requestedStep) || 0);
      return signupStep;
    }
    signupStep = Math.min(signupSteps.length - 1, Math.max(0, Number(requestedStep) || 0));
    signupSteps.forEach((step, index) => {
      const active = index === signupStep;
      step.hidden = !active;
      step.classList.toggle("is-active", active);
      step.setAttribute("aria-hidden", String(!active));
    });
    gate.querySelectorAll("[data-signup-step-indicator]").forEach((indicator, index) => {
      indicator.classList.toggle("is-active", index === signupStep);
      indicator.classList.toggle("is-complete", index < signupStep);
      indicator.setAttribute("aria-current", index === signupStep ? "step" : "false");
    });
    gate.dataset.signupStep = String(signupStep + 1);
    if (focus) signupSteps[signupStep]?.querySelector("input, select, textarea, button")?.focus({ preventScroll: true });
    gate.dispatchEvent(new CustomEvent("hh:auth-signup-step", { detail: { step: signupStep, displayStep: signupStep + 1 } }));
    return signupStep;
  };

  const validateSignupStep = () => {
    const activeStep = signupSteps[signupStep];
    if (!activeStep) return true;
    const fields = [...activeStep.querySelectorAll("input, select, textarea")].filter((input) => !input.disabled);
    fields.forEach((input) => syncFieldState(input, true));
    const invalid = fields.find((input) => !input.checkValidity());
    if (invalid) {
      invalid.focus();
      return false;
    }
    return true;
  };

  const setStatus = (message = "", state = "info") => {
    const status = gate.querySelector("#authGateStatus, [data-auth-status]");
    if (!status) return false;
    const text = status.querySelector("span") || status;
    text.textContent = String(message || "");
    status.dataset.state = state;
    status.classList.toggle("is-success", state === "success");
    status.classList.toggle("is-error", state === "error");
    status.classList.toggle("is-loading", state === "loading");
    status.hidden = !message;
    status.setAttribute("role", state === "error" ? "alert" : "status");
    status.setAttribute("aria-live", state === "error" ? "assertive" : "polite");
    return true;
  };

  const setSuccess = (message = "Đăng nhập thành công.") => {
    gate.classList.add("is-auth-success");
    setStatus(message, "success");
    gate.dispatchEvent(new CustomEvent("hh:auth-success", { detail: { message } }));
  };

  const clearSuccess = () => gate.classList.remove("is-auth-success");

  const setRotationPaused = (paused) => {
    rotationPaused = Boolean(paused);
    if (rotationPaused) stopDemoRotation();
    else scheduleDemo();
  };

  gate.addEventListener("pointermove", queuePointerEffects, { passive: true });
  gate.addEventListener("pointerleave", resetPointerEffects);
  desktopPointer.addEventListener?.("change", resetPointerEffects);

  demoButtons.forEach((button) => {
    button.addEventListener("click", () => renderDemo(button.dataset.authDemo, true));
    button.addEventListener("keydown", (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      let next = demoIndex;
      if (event.key === "ArrowLeft") next = (demoIndex - 1 + demoButtons.length) % demoButtons.length;
      if (event.key === "ArrowRight") next = (demoIndex + 1) % demoButtons.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = demoButtons.length - 1;
      renderDemo(demoButtons[next].dataset.authDemo, true);
      demoButtons[next].focus();
    });
  });

  previewPauseZones.forEach((zone) => {
    zone.addEventListener("pointerenter", () => setRotationPaused(true));
    zone.addEventListener("pointerleave", () => setRotationPaused(false));
    zone.addEventListener("focusin", () => setRotationPaused(true));
    zone.addEventListener("focusout", (event) => {
      if (!event.relatedTarget || !zone.contains(event.relatedTarget)) setRotationPaused(false);
    });
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopDemoRotation();
    else scheduleDemo();
  });
  reducedMotion.addEventListener?.("change", () => {
    resetPointerEffects();
    scheduleDemo();
  });

  const inputs = [...gate.querySelectorAll("input, select, textarea")];
  inputs.forEach((input) => {
    syncFieldState(input);
    input.addEventListener("focus", () => input.closest(".auth-field")?.classList.add("is-focused"));
    input.addEventListener("blur", () => {
      input.closest(".auth-field")?.classList.remove("is-focused");
      syncFieldState(input, true);
    });
    input.addEventListener("input", () => syncFieldState(input));
    input.addEventListener("change", () => syncFieldState(input, true));
    input.addEventListener("invalid", () => syncFieldState(input, true));
  });

  gate.addEventListener("focusin", (event) => {
    const field = event.target.closest?.(".auth-field");
    gate.dataset.authFocus = field?.querySelector("input, select, textarea")?.name || "";
  });
  gate.addEventListener("focusout", (event) => {
    if (!event.relatedTarget?.closest?.("#authGate")) delete gate.dataset.authFocus;
  });

  gate.querySelectorAll('input[type="password"]').forEach((input) => {
    const warning = gate.querySelector("[data-caps-warning]");
    const updateCapsLock = (event) => {
      if (!warning || typeof event.getModifierState !== "function") return;
      const active = event.getModifierState("CapsLock");
      warning.hidden = !active;
      warning.classList.toggle("is-visible", active);
      warning.setAttribute("aria-hidden", String(!active));
    };
    input.addEventListener("keydown", updateCapsLock);
    input.addEventListener("keyup", updateCapsLock);
    input.addEventListener("blur", () => {
      if (!warning) return;
      warning.hidden = true;
      warning.classList.remove("is-visible");
      warning.setAttribute("aria-hidden", "true");
    });
  });

  const registerPassword = gate.querySelector("[data-register-password]");
  const confirmPassword = gate.querySelector('#gateRegisterForm input[name="confirmPassword"]');
  registerPassword?.addEventListener("input", () => {
    updatePasswordStrength(registerPassword);
    syncPasswordConfirmation(confirmPassword);
  });
  confirmPassword?.addEventListener("input", () => syncPasswordConfirmation(confirmPassword));
  confirmPassword?.addEventListener("blur", () => syncPasswordConfirmation(confirmPassword, true));
  if (registerPassword) updatePasswordStrength(registerPassword);

  gate.querySelectorAll("[data-auth-next-step]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      if (validateSignupStep()) setSignupStep(signupStep + 1);
    });
  });
  gate.querySelectorAll("[data-auth-prev-step]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      setSignupStep(signupStep - 1);
    });
  });

  const logos = [...gate.querySelectorAll('img[src*="hh-neon-logo"]')];
  const markLogoLoaded = (image) => {
    image.classList.add("is-loaded");
    image.closest(".brand-mark, .auth-card-heading > span")?.classList.add("is-loaded");
    if (logos.every((logo) => logo.complete)) gate.classList.add("auth-logo-loaded");
  };
  logos.forEach((image) => {
    if (image.complete) markLogoLoaded(image);
    else image.addEventListener("load", () => markLogoLoaded(image), { once: true });
  });

  renderDemo(demoButtons[0]?.dataset.authDemo || "ai");
  setSignupStep(0, false);
  scheduleDemo();

  window.HHAuthExperience = Object.freeze({
    available: true,
    setStatus,
    status: setStatus,
    setSuccess,
    success: setSuccess,
    clearSuccess,
    setStep: setSignupStep,
    getStep: () => signupStep,
    setDemo: (id) => renderDemo(id, true),
    startPreview: () => setRotationPaused(false),
    pausePreview: () => setRotationPaused(true),
    refreshValidation: () => inputs.forEach((input) => syncFieldState(input))
  });
})();
