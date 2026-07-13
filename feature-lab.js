(() => {
  "use strict";

  const groups = {
    "Platform": ["Global Search", "Command Palette++", "Dark Light Auto Mode", "Theme Color Switcher", "Realtime Notification", "Loading Skeleton", "Page Progress Bar", "AI Chat Assistant", "Voice Search", "Speech To Text", "Text To Speech", "History Manager", "Favorite Manager", "Export Data", "Import Data", "PWA", "Offline Mode", "Install App", "Keyboard Shortcut System", "Settings Center"],
    "AI & Workspace": ["AI Prompt Library", "AI Prompt Optimizer", "Workspace Tabs", "Drag Drop Dashboard", "Widget Marketplace", "Plugin System", "User Preferences Center", "Auto Save", "Version History", "File Explorer", "Monaco Code Editor", "AI Image Prompt Generator", "OCR"],
    "Developer": ["Markdown Editor", "JSON Viewer", "API Tester", "Regex Playground", "Code Viewer", "Terminal Simulator", "Git Cheat Sheet", "GitHub Integration", "Console Log Viewer", "Error Monitor", "Dev Utilities", "Text Compare", "JSON Formatter", "UUID Generator", "Hash Generator", "Base64 Encoder", "Timestamp Converter"],
    "Media & Design": ["Image Compressor", "Image Converter", "Image Toolkit", "PDF Toolkit", "QR Toolkit", "Color Studio", "Typography Studio", "Icon Browser", "SVG Editor", "Gradient Generator", "Color Picker"],
    "Productivity": ["Productivity Dashboard", "Notes", "Todo", "Kanban", "Pomodoro", "Stopwatch", "Countdown", "Calendar", "Reminder", "Calculator", "Unit Converter", "Lorem Ipsum", "Password Toolkit", "Clipboard Manager", "Clipboard History", "Activity Timeline", "Recent Files", "Pinned Tools", "Bookmark", "Floating Quick Actions", "Focus Mode"],
    "System & UX": ["Multi-language", "Language Switcher", "Weather Widget", "Clock", "System Status", "Network Speed", "FPS Monitor", "Memory Usage", "Storage Usage", "Analytics Dashboard", "Notification Center", "Smart Search", "Context Menu", "Floating Toolbar", "QR Scanner"]
  };

  const all = Object.values(groups).flat();
  const key = "hh-feature-lab";
  let active = all[0];
  const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const read = () => { try { return JSON.parse(localStorage.getItem(key) || "{}"); } catch { return {}; } };
  const write = value => localStorage.setItem(key, JSON.stringify(value));
  const slug = value => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  document.body.insertAdjacentHTML("beforeend", `
    <button class="feature-lab-open" type="button" title="Mở toàn bộ công cụ">ALL TOOLS</button>
    <section class="feature-lab" hidden aria-label="Full Feature Lab">
      <div class="feature-lab__panel">
        <header class="feature-lab__head">
          <div><small>HH PROFESSIONAL TOOLKIT</small><h2>${all.length} công cụ thực tế</h2></div>
          <label class="feature-lab__search"><span>⌕</span><input data-lab-search placeholder="Tìm công cụ..."></label>
          <button type="button" data-lab-close aria-label="Đóng">Đóng</button>
        </header>
        <div class="feature-lab__body">
          <main class="feature-lab__catalog">
            ${Object.entries(groups).map(([group, items]) => `<section class="feature-lab__group" data-lab-group="${escapeHtml(group)}"><h3>${escapeHtml(group)}</h3><div class="feature-lab__grid">${items.map(name => `<button class="feature-lab__item" type="button" data-lab-feature="${escapeHtml(name)}"><b>${escapeHtml(name)}</b><span>${group === "Media & Design" ? "Công cụ xử lý trực tiếp" : "Mở workspace"}</span></button>`).join("")}</div></section>`).join("")}
          </main>
          <aside class="feature-lab__work" data-lab-work></aside>
        </div>
      </div>
    </section>`);

  const root = document.querySelector(".feature-lab");
  const work = root.querySelector("[data-lab-work]");

  const genericMarkup = name => {
    const saved = read()[name] || {};
    return `<div class="feature-generic-workspace"><small>FEATURE WORKSPACE</small><h3 data-lab-title>${escapeHtml(name)}</h3><p>Nhập dữ liệu phù hợp rồi chạy engine của công cụ.</p><textarea data-lab-input placeholder="Nhập dữ liệu, URL, mã hoặc nội dung...">${escapeHtml(saved.input || "")}</textarea><div class="feature-lab__actions"><button type="button" data-lab-run>Chạy</button><button type="button" data-lab-copy>Sao chép</button><button type="button" data-lab-save>Lưu</button><button type="button" data-lab-export>Xuất</button></div><pre data-lab-output>${escapeHtml(saved.output || "Sẵn sàng.")}</pre></div>`;
  };

  const select = name => {
    active = name;
    root.querySelectorAll("[data-lab-feature]").forEach(item => item.classList.toggle("active", item.dataset.labFeature === name));
    if (window.HHMediaDesign?.supports(name)) window.HHMediaDesign.render(work, name);
    else work.innerHTML = genericMarkup(name);
    root.querySelector(`[data-lab-feature="${CSS.escape(name)}"]`)?.scrollIntoView({ block: "nearest" });
  };

  const open = name => {
    root.hidden = false;
    document.body.classList.add("feature-lab-active");
    select(name || active);
  };
  const close = () => {
    root.hidden = true;
    document.body.classList.remove("feature-lab-active");
    window.HHMediaDesign?.cleanup?.();
  };

  document.querySelector(".feature-lab-open").addEventListener("click", () => open(active));
  root.addEventListener("click", event => {
    const feature = event.target.closest("[data-lab-feature]");
    if (feature) return select(feature.dataset.labFeature);
    if (event.target.closest("[data-lab-close]")) return close();
    if (window.HHMediaDesign?.handleClick?.(event, work, active)) return;

    const input = work.querySelector("[data-lab-input]");
    const output = work.querySelector("[data-lab-output]");
    if (event.target.closest("[data-lab-copy]")) navigator.clipboard.writeText(output?.textContent || "");
    if (event.target.closest("[data-lab-save]")) {
      const state = read();
      state[active] = { input: input?.value || "", output: output?.textContent || "", at: new Date().toISOString() };
      write(state);
      if (output) output.textContent = `${output.textContent}\n\nĐã lưu lúc ${new Date().toLocaleTimeString("vi-VN")}`;
    }
    if (event.target.closest("[data-lab-export]")) {
      const blob = new Blob([output?.textContent || ""], { type: "text/plain;charset=utf-8" });
      const anchor = document.createElement("a");
      anchor.href = URL.createObjectURL(blob);
      anchor.download = `${slug(active)}.txt`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(anchor.href), 1000);
    }
  });

  root.addEventListener("input", event => window.HHMediaDesign?.handleInput?.(event, work, active));
  root.addEventListener("change", event => window.HHMediaDesign?.handleChange?.(event, work, active));
  root.querySelector("[data-lab-search]").addEventListener("input", event => {
    const query = event.target.value.trim().toLowerCase();
    root.querySelectorAll("[data-lab-feature]").forEach(item => { item.hidden = !item.textContent.toLowerCase().includes(query); });
    root.querySelectorAll("[data-lab-group]").forEach(group => { group.hidden = !group.querySelector("[data-lab-feature]:not([hidden])"); });
  });
  addEventListener("keydown", event => {
    if (event.key === "Escape" && !root.hidden) close();
    if (event.ctrlKey && event.altKey && event.key.toLowerCase() === "k") { event.preventDefault(); open(active); root.querySelector("[data-lab-search]").focus(); }
  });

  window.HHFeatureLab = { open, close, select, root };
})();
