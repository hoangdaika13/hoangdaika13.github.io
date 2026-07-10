(function initHHModuleLoader(global) {
  "use strict";

  const bus = global.HHEventBus;
  const store = global.HHStore;
  const registry = new Map();

  const fallbackModules = [
    ["01", "Identity Core", "Ho so, dang nhap va phan quyen nguoi dung.", "core", true, ["Profile", "Session", "Consent", "Role"], "#00e5ff"],
    ["02", "Realtime Presence", "Dem nguoi online va trang thai truy cap hien tai.", "core", true, ["Socket", "Presence", "Heartbeat", "Status"], "#39ff14"],
    ["03", "Vote Sync", "Dong bo like va danh gia giua local va cloud.", "core", true, ["Like", "Rating", "Sync", "Cache"], "#ff3bd4"],
    ["04", "Project Registry", "Quan ly danh sach du an va metadata hien thi.", "core", false, ["Cards", "Tags", "Links", "Sort"], "#ffd166"],
    ["05", "Contact Inbox", "Thu gom lien he tu form va hien thi trang thai gui.", "core", true, ["Form", "Validation", "Inbox", "Notify"], "#06d6a0"],
    ["06", "Analytics Pulse", "Ghi nhan page view va hanh vi khi nguoi dung dong y.", "core", true, ["Events", "Consent", "Funnel", "Report"], "#ff7a00"],
    ["07", "Theme Engine", "Luu va ap dung theme cho giao dien neon.", "core", false, ["Theme", "Contrast", "Motion", "Persist"], "#7c5cff"],
    ["08", "Audio Mood", "Dieu khien am thanh nen va trang thai mood.", "core", false, ["Synth", "Volume", "Mood", "Autoplay"], "#00b4d8"],
    ["09", "Module Filters", "Loc module theo nhom, trang thai va backend.", "core", false, ["Filter", "Count", "Render", "State"], "#ef476f"],
    ["10", "Notification Hub", "Hang doi thong bao cho thao tac thanh cong hoac loi.", "core", false, ["Toast", "Queue", "A11y", "Timeout"], "#f72585"],
    ["11", "OAuth Gateway", "Ket noi Google/Facebook thong qua backend xac thuc.", "extension", true, ["Google", "Facebook", "JWT", "Callback"], "#4361ee"],
    ["12", "Admin Console", "Bang dieu khien noi dung va cau hinh website.", "extension", true, ["Dashboard", "Roles", "Audit", "Actions"], "#4cc9f0"],
    ["13", "Content CMS", "Quan ly bio, skill, project va section dong.", "extension", true, ["Content", "Draft", "Publish", "History"], "#b5179e"],
    ["14", "Media Library", "Luu anh, icon va tai san du an co metadata.", "extension", true, ["Upload", "Crop", "CDN", "Alt"], "#4895ef"],
    ["15", "Guestbook", "So luu niem cho khach ghe tham website.", "extension", true, ["Message", "Moderate", "Emoji", "Pin"], "#ffbe0b"],
    ["16", "Comment Threads", "Binh luan theo du an voi chong spam co ban.", "extension", true, ["Thread", "Reply", "Moderate", "Spam"], "#fb5607"],
    ["17", "Newsletter", "Dang ky nhan update ve du an moi.", "extension", true, ["Subscribe", "Double opt-in", "List", "Export"], "#3a86ff"],
    ["18", "Search Index", "Tim nhanh project, skill va noi dung trang.", "extension", false, ["Index", "Query", "Highlight", "Keyboard"], "#8338ec"],
    ["19", "Command Palette", "Mo nhanh section va action bang ban phim.", "extension", false, ["Shortcut", "Actions", "Search", "Focus"], "#ff006e"],
    ["20", "Timeline", "Dong thoi gian cap nhat project va changelog.", "extension", false, ["Milestone", "Release", "Date", "Pin"], "#2ec4b6"],
    ["21", "Skill Matrix", "Ban do ky nang voi cap do va minh chung.", "extension", false, ["Skills", "Level", "Evidence", "Tags"], "#e71d36"],
    ["22", "Resume Export", "Xuat profile thanh CV PDF/print-friendly.", "extension", false, ["Print", "PDF", "Template", "Contact"], "#ff9f1c"],
    ["23", "API Status", "Kiem tra tinh trang API va backend phu tro.", "extension", true, ["Health", "Latency", "Uptime", "Alert"], "#00f5d4"],
    ["24", "Error Logger", "Ghi loi frontend de debug sau khi deploy.", "extension", true, ["Capture", "Stack", "Context", "Report"], "#f15bb5"],
    ["25", "Feature Flags", "Bat tat tinh nang moi theo moi truong.", "extension", true, ["Flags", "Rollout", "Env", "Target"], "#fee440"],
    ["26", "Data Export", "Tai ve du lieu cong khai dang JSON/CSV.", "extension", true, ["JSON", "CSV", "Privacy", "Backup"], "#00bbf9"],
    ["27", "Webhook Bridge", "Nhan su kien tu GitHub, form hoac automation.", "extension", true, ["Webhook", "Verify", "Queue", "Retry"], "#9b5de5"],
    ["28", "AI Assistant Slot", "Khu vuc tich hop chatbot ho tro khach tham quan.", "extension", true, ["Chat", "Context", "Guard", "Handoff"], "#00f5a0"],
    ["29", "Project Voting", "Binh chon du an yeu thich theo tung card.", "extension", true, ["Vote", "Rank", "Limit", "Sync"], "#ff4d6d"],
    ["30", "Achievement Badges", "Huy hieu cho milestone va ky nang noi bat.", "extension", false, ["Badge", "Unlock", "Display", "Share"], "#8ac926"],
    ["31", "Localization", "Chuyen doi ngon ngu va chuoi giao dien.", "extension", false, ["Locale", "Strings", "Fallback", "Date"], "#1982c4"],
    ["32", "Accessibility Audit", "Tu kiem tra contrast, labels va keyboard flow.", "extension", false, ["Contrast", "ARIA", "Focus", "Report"], "#6a4c93"],
    ["33", "Performance Meter", "Do FPS, load time va Core Web Vitals co ban.", "extension", false, ["Vitals", "FPS", "Timing", "Budget"], "#ffca3a"],
    ["34", "Offline Cache", "Cache tai san de trang mo nhanh lan sau.", "extension", false, ["Service worker", "Cache", "Fallback", "Version"], "#52b788"],
    ["35", "Sitemap Builder", "Sinh sitemap tu danh sach trang va project.", "extension", false, ["Routes", "SEO", "Robots", "Submit"], "#118ab2"],
    ["36", "Structured Data", "Them JSON-LD cho profile va project.", "extension", false, ["Schema", "Person", "Project", "SEO"], "#073b4c"],
    ["37", "Security Headers", "Goi y CSP va header bao ve khi deploy.", "extension", true, ["CSP", "Headers", "Policy", "Report"], "#ef233c"],
    ["38", "Backup Runner", "Sao luu du lieu backend theo lich.", "extension", true, ["Schedule", "Snapshot", "Restore", "Log"], "#2b9348"],
    ["39", "Moderation Queue", "Duyet guestbook, comment va noi dung user tao.", "extension", true, ["Queue", "Review", "Block", "Appeal"], "#7209b7"],
    ["40", "Release Notes", "Tong hop thay doi moi va hien thi tren trang.", "extension", false, ["Changelog", "Version", "Date", "Link"], "#00a896"]
  ].map(([id, title, description, group, requiresBackend, features, accent]) => ({
    id,
    title,
    description,
    group,
    requiresBackend,
    features,
    accent,
    status: requiresBackend ? "needs backend" : "ready"
  }));

  function normalizeModule(module, index) {
    return {
      id: module.id || String(index + 1).padStart(2, "0"),
      title: module.title || "Untitled module",
      description: module.description || "",
      group: module.group === "core" ? "core" : "extension",
      requiresBackend: Boolean(module.requiresBackend),
      features: Array.isArray(module.features) ? module.features : [],
      status: module.status || (module.requiresBackend ? "needs backend" : "ready"),
      accent: module.accent || "#ff3bd4"
    };
  }

  function commit(source) {
    const modules = Array.from(registry.values());
    global.HH_PLATFORM_MODULES = modules;
    if (store) store.patch({ modules }, { source: source || "moduleLoader" });
    if (bus) bus.emit("modules:ready", { modules, source: source || "moduleLoader" });
    return modules;
  }

  const api = {
    register(module) {
      const normalized = normalizeModule(module || {}, registry.size);
      registry.set(String(normalized.id), normalized);
      commit("moduleLoader:register");
      return normalized;
    },

    registerMany(modules, options) {
      (Array.isArray(modules) ? modules : []).forEach((module, index) => {
        const normalized = normalizeModule(module, index);
        registry.set(String(normalized.id), normalized);
      });
      return commit(options?.source || "moduleLoader:registerMany");
    },

    getAll() {
      return Array.from(registry.values());
    },

    filter(predicate) {
      if (typeof predicate !== "function") return api.getAll();
      return api.getAll().filter(predicate);
    },

    async loadFromUrl(url) {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error("Module registry unavailable.");
      const data = await response.json();
      return api.registerMany(Array.isArray(data) ? data : data.modules, { source: "moduleLoader:remote" });
    },

    hydrate(modules) {
      const incoming = Array.isArray(modules) && modules.length ? modules : fallbackModules;
      return api.registerMany(incoming, { source: modules?.length ? "moduleLoader:hydrate" : "moduleLoader:fallback" });
    }
  };

  // Backend note: modules marked requiresBackend need real APIs before their actions can mutate shared data.
  global.HHModuleLoader = global.HHModuleLoader || api;
  api.hydrate(global.HH_PLATFORM_MODULES);
})(window);
