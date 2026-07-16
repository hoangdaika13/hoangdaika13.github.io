(() => {
  "use strict";

  const gate = document.querySelector("#authGate");
  if (!gate) return;

  const panels = [...gate.querySelectorAll(".auth-spectrum i")];
  const card = gate.querySelector(".auth-gate-card");
  const previewShell = gate.querySelector(".auth-product-preview");
  const preview = gate.querySelector("[data-auth-preview]");
  const demoButtons = [...gate.querySelectorAll("[data-auth-demo]")];
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let frame = 0;
  let demoTimer = 0;
  let demoIndex = 0;

  const demos = {
    ai: {
      tag: "AI WORKFLOW", title: "Biến ý tưởng thành quy trình AI hoàn chỉnh",
      description: "Chat đa mô hình, tối ưu prompt và chạy workflow trong cùng một không gian.",
      metric: "12", metricLabel: "Tác vụ AI", status: "98%", output: "6.4s",
      stages: ["Nhận yêu cầu", "AI xử lý", "Xuất kết quả"], foot: ["72%", "48%", "96%"], bars: [31, 68, 45, 88, 58, 76, 96]
    },
    script: {
      tag: "AI SCRIPT STUDIO", title: "Từ một brief thành cả series nội dung",
      description: "Viết dài tập, phân tích retention, dịch, batch và lưu hồ sơ huấn luyện riêng.",
      metric: "24", metricLabel: "Cảnh đã viết", status: "94%", output: "8 tập",
      stages: ["Phân tích brief", "Xây cấu trúc", "Tạo series"], foot: ["84%", "67%", "91%"], bars: [54, 83, 68, 94, 71, 88, 79]
    },
    media: {
      tag: "MEDIA PRODUCTION", title: "Biên tập và xuất bản media ngay trên web",
      description: "Photo Editor, Video Editor, thư viện media và quy trình xuất đa nền tảng.",
      metric: "20", metricLabel: "Creative engines", status: "4K", output: "12 định dạng",
      stages: ["Nhập tài nguyên", "Biên tập thông minh", "Xuất bản"], foot: ["63%", "86%", "93%"], bars: [82, 61, 92, 74, 88, 69, 97]
    },
    dev: {
      tag: "DEVELOPER TOOLKIT", title: "22 công cụ DEV trong một command center",
      description: "API tester, JSON, SQL, mã hóa, network và tiện ích lập trình dùng trực tiếp.",
      metric: "22", metricLabel: "Công cụ DEV", status: "200", output: "0 lỗi",
      stages: ["Nhập dữ liệu", "Chạy kiểm tra", "Nhận kết quả"], foot: ["91%", "74%", "99%"], bars: [66, 91, 58, 86, 95, 73, 89]
    },
    community: {
      tag: "REALTIME COMMUNITY", title: "Kết nối cộng đồng theo thời gian thực",
      description: "Chat, cuộc gọi, phòng nhóm, thông báo và trung tâm quản trị quyền riêng tư.",
      metric: "128", metricLabel: "Phiên kết nối", status: "LIVE", output: "32ms",
      stages: ["Tạo kết nối", "Đồng bộ realtime", "Tương tác"], foot: ["78%", "92%", "97%"], bars: [47, 77, 93, 68, 84, 96, 72]
    }
  };

  const setText = (selector, value) => {
    const node = gate.querySelector(selector);
    if (node) node.textContent = value;
  };

  const renderDemo = (id, shouldRestart = false) => {
    const data = demos[id];
    if (!data) return;
    demoIndex = Math.max(0, demoButtons.findIndex((button) => button.dataset.authDemo === id));
    demoButtons.forEach((button) => {
      const active = button.dataset.authDemo === id;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
    gate.querySelectorAll("[data-auth-preview-nav]").forEach((item) => item.classList.toggle("active", item.dataset.authPreviewNav === id));
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
    preview?.querySelectorAll(".auth-preview-chart>i").forEach((bar, index) => bar.style.setProperty("--bar", `${data.bars[index] || 50}%`));
    if (preview) {
      preview.classList.remove("is-demo-switching");
      void preview.offsetWidth;
      preview.classList.add("is-demo-switching");
    }
    if (shouldRestart) scheduleDemo();
  };

  const scheduleDemo = () => {
    clearInterval(demoTimer);
    if (reducedMotion.matches || demoButtons.length < 2) return;
    demoTimer = setInterval(() => {
      const next = (demoIndex + 1) % demoButtons.length;
      renderDemo(demoButtons[next].dataset.authDemo);
    }, 4200);
  };

  const setParallax = (x, y) => {
    panels.forEach((panel, index) => {
      const depth = (index + 1) * 0.9;
      panel.style.setProperty("--auth-px", `${(x * depth).toFixed(1)}px`);
      panel.style.setProperty("--auth-py", `${(y * depth).toFixed(1)}px`);
    });
  };

  gate.addEventListener("pointermove", event => {
    if (reducedMotion.matches) return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const x = (event.clientX / innerWidth - 0.5) * 7;
      const y = (event.clientY / innerHeight - 0.5) * 7;
      setParallax(x, y);
      gate.style.setProperty("--auth-cursor-x", `${event.clientX}px`);
      gate.style.setProperty("--auth-cursor-y", `${event.clientY}px`);
      if (card && innerWidth > 920) {
        card.style.setProperty("--auth-tilt-x", `${(x * 0.34).toFixed(2)}deg`);
        card.style.setProperty("--auth-tilt-y", `${(-y * 0.28).toFixed(2)}deg`);
      }
      if (previewShell && innerWidth > 920) {
        previewShell.style.setProperty("--auth-preview-x", `${(x * 0.28).toFixed(2)}deg`);
        previewShell.style.setProperty("--auth-preview-y", `${(-y * 0.2).toFixed(2)}deg`);
      }
    });
  }, { passive: true });

  gate.addEventListener("pointerleave", () => {
    setParallax(0, 0);
    card?.style.setProperty("--auth-tilt-x", "0deg");
    card?.style.setProperty("--auth-tilt-y", "0deg");
    previewShell?.style.setProperty("--auth-preview-x", "0deg");
    previewShell?.style.setProperty("--auth-preview-y", "0deg");
  });
  demoButtons.forEach((button) => button.addEventListener("click", () => renderDemo(button.dataset.authDemo, true)));
  gate.querySelector(".auth-feature-showcase")?.addEventListener("pointerenter", () => clearInterval(demoTimer));
  gate.querySelector(".auth-feature-showcase")?.addEventListener("pointerleave", scheduleDemo);
  gate.addEventListener("focusin", event => {
    if (event.target.closest(".auth-feature-showcase")) clearInterval(demoTimer);
  });
  gate.addEventListener("focusout", event => {
    if (event.target.closest(".auth-feature-showcase") && !event.relatedTarget?.closest?.(".auth-feature-showcase")) scheduleDemo();
  });
  document.addEventListener("visibilitychange", () => document.hidden ? clearInterval(demoTimer) : scheduleDemo());
  reducedMotion.addEventListener?.("change", scheduleDemo);
  renderDemo(demoButtons[0]?.dataset.authDemo || "ai");
  scheduleDemo();
  gate.addEventListener("focusin", event => {
    const field = event.target.closest(".auth-field");
    gate.dataset.authFocus = field?.querySelector("input")?.name || "";
  });
  gate.addEventListener("focusout", event => {
    if (!event.relatedTarget?.closest?.("#authGate")) delete gate.dataset.authFocus;
  });
})();
