(function initHHYouTubeToolbox(global) {
  "use strict";

  const STORAGE_KEY = "hh.youtube-toolbox.v1";
  const MAX_TITLE = 100;
  const MAX_DESCRIPTION = 5000;
  const MAX_TAGS = 500;
  let activeRoot = null;
  let thumbnailUrl = "";
  let videoUrl = "";
  let saveTimer = 0;

  const escapeHtml = (value) => String(value ?? "").replace(/[<>&"']/g, (character) => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", "\"": "&quot;", "'": "&#39;"
  })[character]);

  const defaultState = () => ({
    activeTab: "metadata",
    title: "",
    description: "",
    tags: "",
    keyword: "",
    chapters: "00:00 Mở đầu\n00:30 Nội dung chính\n02:00 Tổng kết",
    youtubeUrl: "",
    startTime: "00:00"
  });

  function readState() {
    try {
      const stored = JSON.parse(global.localStorage?.getItem(STORAGE_KEY) || "{}");
      return { ...defaultState(), ...stored };
    } catch {
      return defaultState();
    }
  }

  function persistState(root = activeRoot) {
    if (!root || !global.localStorage) return;
    const state = {
      activeTab: root.querySelector("[data-yt-tab].is-active")?.dataset.ytTab || "metadata",
      title: root.querySelector("[data-yt-title]")?.value || "",
      description: root.querySelector("[data-yt-description]")?.value || "",
      tags: root.querySelector("[data-yt-tags]")?.value || "",
      keyword: root.querySelector("[data-yt-keyword]")?.value || "",
      chapters: root.querySelector("[data-yt-chapters]")?.value || "",
      youtubeUrl: root.querySelector("[data-yt-url]")?.value || "",
      startTime: root.querySelector("[data-yt-start]")?.value || "00:00"
    };
    global.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    const status = root.querySelector("[data-yt-save-status]");
    if (status) status.textContent = `Đã lưu cục bộ · ${new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;
  }

  function queueSave(root) {
    global.clearTimeout(saveTimer);
    saveTimer = global.setTimeout(() => persistState(root), 220);
  }

  function parseTags(value) {
    const seen = new Set();
    const duplicates = [];
    const tags = String(value || "").split(/[,\n]/).map((tag) => tag.trim().replace(/^#+/, "")).filter(Boolean).filter((tag) => {
      const key = tag.toLocaleLowerCase("vi-VN");
      if (seen.has(key)) {
        duplicates.push(tag);
        return false;
      }
      seen.add(key);
      return true;
    });
    return { tags, duplicates, normalized: tags.join(", ") };
  }

  function analyzeMetadata(input = {}) {
    const title = String(input.title || "").trim();
    const description = String(input.description || "").trim();
    const keyword = String(input.keyword || "").trim().toLocaleLowerCase("vi-VN");
    const parsedTags = parseTags(input.tags);
    const titleLower = title.toLocaleLowerCase("vi-VN");
    const descriptionLower = description.toLocaleLowerCase("vi-VN");
    const titleLength = [...title].length;
    const descriptionLength = [...description].length;
    const tagLength = [...parsedTags.normalized].length;
    const checks = [
      { label: "Có tiêu đề", pass: titleLength > 0 },
      { label: `Tiêu đề không vượt ${MAX_TITLE} ký tự`, pass: titleLength > 0 && titleLength <= MAX_TITLE },
      { label: "Tiêu đề dễ đọc trên mobile (25–70 ký tự)", pass: titleLength >= 25 && titleLength <= 70, advisory: true },
      { label: `Mô tả không vượt ${MAX_DESCRIPTION} ký tự`, pass: descriptionLength <= MAX_DESCRIPTION },
      { label: "Có phần mở đầu mô tả nội dung", pass: descriptionLength >= 80, advisory: true },
      { label: `Tổng tags không vượt ${MAX_TAGS} ký tự`, pass: tagLength <= MAX_TAGS },
      { label: "Không có tag trùng", pass: parsedTags.duplicates.length === 0 },
      { label: "Từ khóa chính xuất hiện tự nhiên", pass: !keyword || titleLower.includes(keyword) || descriptionLower.includes(keyword), advisory: true }
    ];
    return {
      titleLength,
      descriptionLength,
      tagLength,
      wordCount: description ? description.split(/\s+/).filter(Boolean).length : 0,
      parsedTags,
      checks,
      blocking: checks.filter((item) => !item.pass && !item.advisory).length,
      suggestions: checks.filter((item) => !item.pass).map((item) => item.label)
    };
  }

  function timeToSeconds(value) {
    const parts = String(value || "").trim().split(":").map(Number);
    if (!parts.length || parts.some((part) => !Number.isFinite(part) || part < 0)) return null;
    if (parts.length === 2 && parts[1] < 60) return parts[0] * 60 + parts[1];
    if (parts.length === 3 && parts[1] < 60 && parts[2] < 60) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 1) return parts[0];
    return null;
  }

  function formatTime(seconds, forceHours = false) {
    const safe = Math.max(0, Math.floor(Number(seconds) || 0));
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    const remainder = safe % 60;
    return hours || forceHours
      ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
      : `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  }

  function parseChapters(value) {
    const rows = String(value || "").split(/\r?\n/).map((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) return null;
      const match = trimmed.match(/^(\d{1,3}:\d{2}(?::\d{2})?)\s+(.+)$/);
      if (!match) return { line: index + 1, raw: trimmed, valid: false, error: "Cần timestamp và tên chương" };
      const seconds = timeToSeconds(match[1]);
      if (seconds === null) return { line: index + 1, raw: trimmed, valid: false, error: "Timestamp không hợp lệ" };
      return { line: index + 1, raw: trimmed, valid: true, seconds, title: match[2].trim() };
    }).filter(Boolean);
    const validRows = rows.filter((row) => row.valid);
    const errors = rows.filter((row) => !row.valid).map((row) => `Dòng ${row.line}: ${row.error}`);
    if (validRows.length && validRows[0].seconds !== 0) errors.push("Chương đầu tiên nên bắt đầu tại 00:00");
    for (let index = 1; index < validRows.length; index += 1) {
      if (validRows[index].seconds <= validRows[index - 1].seconds) errors.push(`Dòng ${validRows[index].line}: thời gian phải tăng dần`);
    }
    const forceHours = validRows.some((row) => row.seconds >= 3600);
    return {
      rows,
      errors,
      output: validRows.map((row) => `${formatTime(row.seconds, forceHours)} ${row.title}`).join("\n")
    };
  }

  function parseYouTubeId(value) {
    const raw = String(value || "").trim();
    if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return raw;
    try {
      const url = new URL(raw);
      const host = url.hostname.replace(/^www\./, "");
      if (host === "youtu.be") return url.pathname.split("/").filter(Boolean)[0]?.slice(0, 11) || "";
      if (host.endsWith("youtube.com")) {
        if (url.searchParams.get("v")) return url.searchParams.get("v").slice(0, 11);
        const parts = url.pathname.split("/").filter(Boolean);
        if (["shorts", "embed", "live"].includes(parts[0])) return (parts[1] || "").slice(0, 11);
      }
    } catch {
      return "";
    }
    return "";
  }

  function bytes(value) {
    const size = Number(value) || 0;
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
    return `${(size / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  function notify(root, message, tone = "success") {
    const toast = root.querySelector("[data-yt-toast]");
    if (!toast) return;
    toast.textContent = message;
    toast.dataset.tone = tone;
    toast.hidden = false;
    global.clearTimeout(Number(toast.dataset.timer || 0));
    toast.dataset.timer = String(global.setTimeout(() => { toast.hidden = true; }, 2600));
  }

  async function copyText(root, text, label = "Đã sao chép") {
    const value = String(text || "");
    if (!value) return notify(root, "Chưa có nội dung để sao chép", "warning");
    try {
      await global.navigator.clipboard.writeText(value);
    } catch {
      const field = document.createElement("textarea");
      field.value = value;
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      document.execCommand("copy");
      field.remove();
    }
    notify(root, label);
  }

  function updateMetadata(root) {
    const result = analyzeMetadata({
      title: root.querySelector("[data-yt-title]")?.value,
      description: root.querySelector("[data-yt-description]")?.value,
      tags: root.querySelector("[data-yt-tags]")?.value,
      keyword: root.querySelector("[data-yt-keyword]")?.value
    });
    const set = (name, value) => { const node = root.querySelector(`[data-yt-stat="${name}"]`); if (node) node.textContent = value; };
    set("title", `${result.titleLength}/${MAX_TITLE}`);
    set("description", `${result.descriptionLength}/${MAX_DESCRIPTION}`);
    set("words", String(result.wordCount));
    set("tags", `${result.tagLength}/${MAX_TAGS}`);
    const checklist = root.querySelector("[data-yt-checklist]");
    if (checklist) checklist.innerHTML = result.checks.map((item) => `<li class="${item.pass ? "is-pass" : item.advisory ? "is-advice" : "is-error"}"><span>${item.pass ? "✓" : item.advisory ? "!" : "×"}</span><b>${escapeHtml(item.label)}</b></li>`).join("");
    const readiness = root.querySelector("[data-yt-readiness]");
    if (readiness) {
      readiness.textContent = result.blocking ? `${result.blocking} lỗi cần sửa` : result.suggestions.length ? `${result.suggestions.length} gợi ý cải thiện` : "Sẵn sàng";
      readiness.dataset.tone = result.blocking ? "error" : result.suggestions.length ? "warning" : "success";
    }
  }

  function updateChapters(root) {
    const result = parseChapters(root.querySelector("[data-yt-chapters]")?.value || "");
    const output = root.querySelector("[data-yt-chapter-output]");
    if (output) output.value = result.output;
    const status = root.querySelector("[data-yt-chapter-status]");
    if (status) {
      status.innerHTML = result.errors.length
        ? `<strong>${result.errors.length} vấn đề</strong>${result.errors.map((error) => `<span>${escapeHtml(error)}</span>`).join("")}`
        : `<strong>${result.rows.length} chương hợp lệ</strong><span>Timestamp tăng dần và đã được chuẩn hóa.</span>`;
      status.dataset.tone = result.errors.length ? "warning" : "success";
    }
  }

  function updateLinks(root) {
    const id = parseYouTubeId(root.querySelector("[data-yt-url]")?.value || "");
    const seconds = timeToSeconds(root.querySelector("[data-yt-start]")?.value || "0");
    const links = id ? {
      watch: `https://www.youtube.com/watch?v=${id}${seconds ? `&t=${seconds}s` : ""}`,
      short: `https://youtu.be/${id}${seconds ? `?t=${seconds}` : ""}`,
      embed: `https://www.youtube.com/embed/${id}${seconds ? `?start=${seconds}` : ""}`,
      thumbnail: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`
    } : {};
    root.querySelectorAll("[data-yt-link-output]").forEach((field) => { field.value = links[field.dataset.ytLinkOutput] || ""; });
    const status = root.querySelector("[data-yt-link-status]");
    if (status) {
      status.textContent = id ? `Video ID: ${id}` : "Nhập URL YouTube hoặc Video ID hợp lệ";
      status.dataset.tone = id ? "success" : "neutral";
    }
  }

  function showTab(root, tab) {
    root.querySelectorAll("[data-yt-tab]").forEach((button) => {
      const active = button.dataset.ytTab === tab;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
    });
    root.querySelectorAll("[data-yt-panel]").forEach((panel) => { panel.hidden = panel.dataset.ytPanel !== tab; });
  }

  function downloadBlob(filename, value, type = "text/plain;charset=utf-8") {
    const url = URL.createObjectURL(new Blob([value], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    global.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportProject(root) {
    persistState(root);
    const state = readState();
    const metadata = analyzeMetadata(state);
    const chapters = parseChapters(state.chapters);
    downloadBlob(`youtube-utility-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({
      format: "hh-youtube-utility",
      version: 1,
      exportedAt: new Date().toISOString(),
      project: state,
      normalized: { tags: metadata.parsedTags.normalized, chapters: chapters.output }
    }, null, 2), "application/json");
    notify(root, "Đã xuất dự án JSON");
  }

  function render(state) {
    return `<section class="yt-utility" data-youtube-toolbox>
      <header class="yt-utility__hero">
        <div><span class="yt-utility__eyebrow">CÔNG CỤ ĐỘC LẬP · XỬ LÝ CỤC BỘ</span><h2>YouTube Utility Lab</h2><p>Kiểm tra và chuẩn bị nội dung trước khi đăng. Không kết nối tài khoản, không đọc kênh và không gửi dữ liệu lên máy chủ.</p></div>
        <div class="yt-utility__actions"><span data-yt-save-status>Được lưu riêng trên thiết bị</span><button type="button" data-yt-export>Xuất dự án</button><label class="yt-utility__import">Nhập JSON<input type="file" accept="application/json" data-yt-import></label><button type="button" class="is-danger" data-yt-reset>Đặt lại</button></div>
      </header>
      <nav class="yt-utility__tabs" role="tablist" aria-label="Các tiện ích YouTube">
        ${[["metadata", "Metadata", "Tiêu đề, mô tả, tags"], ["chapters", "Chapters", "Chuẩn hóa timestamp"], ["thumbnail", "Thumbnail", "Kiểm tra ảnh bìa"], ["video", "Video", "Preflight cục bộ"], ["links", "Link Builder", "Tạo link chia sẻ"]].map(([id, label, hint]) => `<button type="button" role="tab" data-yt-tab="${id}" class="${state.activeTab === id ? "is-active" : ""}" aria-selected="${state.activeTab === id}"><b>${label}</b><span>${hint}</span></button>`).join("")}
      </nav>
      <main class="yt-utility__content">
        <section data-yt-panel="metadata" ${state.activeTab === "metadata" ? "" : "hidden"}>
          <div class="yt-utility__grid">
            <article class="yt-card yt-card--form"><header><div><span>01</span><h3>Metadata Inspector</h3></div><b data-yt-readiness data-tone="neutral">Đang kiểm tra</b></header>
              <label><span>Tiêu đề <b data-yt-stat="title">0/${MAX_TITLE}</b></span><input type="text" maxlength="120" value="${escapeHtml(state.title)}" placeholder="Nhập tiêu đề video..." data-yt-title></label>
              <label><span>Từ khóa chính</span><input type="text" value="${escapeHtml(state.keyword)}" placeholder="Ví dụ: nhạc piano thư giãn" data-yt-keyword></label>
              <label><span>Mô tả <b data-yt-stat="description">0/${MAX_DESCRIPTION}</b></span><textarea rows="10" maxlength="5200" placeholder="Mô tả nội dung, chapter và liên kết..." data-yt-description>${escapeHtml(state.description)}</textarea></label>
              <label><span>Tags <b data-yt-stat="tags">0/${MAX_TAGS}</b></span><textarea rows="4" placeholder="tag một, tag hai, tag ba" data-yt-tags>${escapeHtml(state.tags)}</textarea></label>
              <div class="yt-inline-actions"><button type="button" data-yt-clean-tags>Làm sạch tags</button><button type="button" data-yt-copy-pack>Sao chép metadata</button></div>
            </article>
            <aside class="yt-card yt-card--report"><header><div><span>QA</span><h3>Kiểm tra minh bạch</h3></div></header><div class="yt-metrics"><span><b data-yt-stat="words">0</b>Từ trong mô tả</span><span><b data-yt-stat="tags">0/${MAX_TAGS}</b>Dung lượng tags</span></div><ul data-yt-checklist></ul><p>Đây là kiểm tra theo quy tắc, không phải điểm SEO hoặc cam kết lượt xem.</p></aside>
          </div>
        </section>
        <section data-yt-panel="chapters" ${state.activeTab === "chapters" ? "" : "hidden"}>
          <div class="yt-utility__grid"><article class="yt-card"><header><div><span>02</span><h3>Chapter Builder</h3></div></header><p class="yt-card__lead">Mỗi dòng gồm timestamp và tên chương. Công cụ sẽ kiểm tra thứ tự rồi chuẩn hóa định dạng.</p><label><span>Danh sách chương</span><textarea rows="15" data-yt-chapters>${escapeHtml(state.chapters)}</textarea></label><div class="yt-inline-actions"><button type="button" data-yt-normalize-chapters>Chuẩn hóa</button><button type="button" data-yt-add-chapter>+ Thêm chương</button></div></article><aside class="yt-card"><header><div><span>OUTPUT</span><h3>Kết quả</h3></div></header><div class="yt-status-box" data-yt-chapter-status></div><label><span>Chapter đã chuẩn hóa</span><textarea rows="12" readonly data-yt-chapter-output></textarea></label><button type="button" class="yt-primary" data-yt-copy-chapters>Sao chép chapters</button></aside></div>
        </section>
        <section data-yt-panel="thumbnail" ${state.activeTab === "thumbnail" ? "" : "hidden"}>
          <article class="yt-card"><header><div><span>03</span><h3>Thumbnail Checker</h3></div><b>Ảnh không được upload</b></header><div class="yt-dropzone"><input type="file" accept="image/jpeg,image/png,image/webp" data-yt-thumbnail><div><strong>Kéo hoặc chọn thumbnail</strong><span>Kiểm tra kích thước, tỷ lệ, định dạng và dung lượng ngay trên trình duyệt.</span></div></div><div class="yt-preview-grid"><figure data-yt-thumbnail-preview><div>Chưa chọn ảnh</div></figure><section class="yt-file-report" data-yt-thumbnail-report><p>Ưu tiên ảnh tỷ lệ 16:9, rõ khi thu nhỏ và dung lượng không vượt giới hạn đã đặt.</p></section></div></article>
        </section>
        <section data-yt-panel="video" ${state.activeTab === "video" ? "" : "hidden"}>
          <article class="yt-card"><header><div><span>04</span><h3>Video Preflight</h3></div><b>Phân tích cục bộ</b></header><div class="yt-dropzone"><input type="file" accept="video/*" data-yt-video><div><strong>Chọn video cần kiểm tra</strong><span>Hiển thị dung lượng, thời lượng, độ phân giải, tỷ lệ và cho phép lấy frame thumbnail.</span></div></div><div class="yt-video-grid"><div class="yt-video-player"><video controls preload="metadata" data-yt-video-preview></video><canvas width="1280" height="720" data-yt-frame-canvas hidden></canvas><div class="yt-inline-actions"><button type="button" data-yt-capture-frame disabled>Lấy frame hiện tại</button><button type="button" data-yt-download-frame disabled>Tải frame PNG</button></div></div><section class="yt-file-report" data-yt-video-report><p>Chưa có video. Codec và bitrate chuyên sâu cần FFmpeg; công cụ này chỉ báo dữ liệu trình duyệt đọc được.</p></section></div></article>
        </section>
        <section data-yt-panel="links" ${state.activeTab === "links" ? "" : "hidden"}>
          <article class="yt-card"><header><div><span>05</span><h3>YouTube Link Builder</h3></div><b data-yt-link-status data-tone="neutral">Chưa có Video ID</b></header><div class="yt-link-inputs"><label><span>URL YouTube hoặc Video ID</span><input type="url" value="${escapeHtml(state.youtubeUrl)}" placeholder="https://youtu.be/..." data-yt-url></label><label><span>Bắt đầu tại</span><input type="text" value="${escapeHtml(state.startTime)}" placeholder="01:30" data-yt-start></label></div><div class="yt-link-list">${[["watch", "Link xem đầy đủ"], ["short", "Link rút gọn"], ["embed", "Link nhúng"], ["thumbnail", "Link thumbnail maxres"]].map(([id, label]) => `<label><span>${label}</span><div><input readonly data-yt-link-output="${id}"><button type="button" data-yt-copy-link="${id}">Sao chép</button></div></label>`).join("")}</div></article>
        </section>
      </main>
      <div class="yt-toast" data-yt-toast hidden role="status" aria-live="polite"></div>
    </section>`;
  }

  function bind(root) {
    root.addEventListener("input", (event) => {
      if (event.target.matches("[data-yt-title],[data-yt-description],[data-yt-tags],[data-yt-keyword]")) updateMetadata(root);
      if (event.target.matches("[data-yt-chapters]")) updateChapters(root);
      if (event.target.matches("[data-yt-url],[data-yt-start]")) updateLinks(root);
      if (event.target.matches("input,textarea")) queueSave(root);
    });

    root.addEventListener("keydown", (event) => {
      const tab = event.target.closest("[data-yt-tab]");
      if (!tab || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const tabs = [...root.querySelectorAll("[data-yt-tab]")];
      const index = tabs.indexOf(tab);
      const next = event.key === "Home" ? tabs[0] : event.key === "End" ? tabs.at(-1) : tabs[(index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
      next.focus();
      next.click();
    });

    root.addEventListener("click", async (event) => {
      const tab = event.target.closest("[data-yt-tab]");
      if (tab) { showTab(root, tab.dataset.ytTab); queueSave(root); return; }
      if (event.target.closest("[data-yt-clean-tags]")) {
        const field = root.querySelector("[data-yt-tags]");
        const parsed = parseTags(field.value);
        field.value = parsed.normalized;
        updateMetadata(root);
        queueSave(root);
        notify(root, parsed.duplicates.length ? `Đã loại ${parsed.duplicates.length} tag trùng` : "Tags đã sạch");
        return;
      }
      if (event.target.closest("[data-yt-copy-pack]")) {
        const title = root.querySelector("[data-yt-title]").value.trim();
        const description = root.querySelector("[data-yt-description]").value.trim();
        const tags = parseTags(root.querySelector("[data-yt-tags]").value).normalized;
        await copyText(root, `TIÊU ĐỀ\n${title}\n\nMÔ TẢ\n${description}\n\nTAGS\n${tags}`, "Đã sao chép metadata");
        return;
      }
      if (event.target.closest("[data-yt-normalize-chapters]")) {
        const field = root.querySelector("[data-yt-chapters]");
        const result = parseChapters(field.value);
        if (result.output) field.value = result.output;
        updateChapters(root);
        queueSave(root);
        notify(root, result.errors.length ? "Đã chuẩn hóa các dòng hợp lệ" : "Chapters đã chuẩn hóa", result.errors.length ? "warning" : "success");
        return;
      }
      if (event.target.closest("[data-yt-add-chapter]")) {
        const field = root.querySelector("[data-yt-chapters]");
        const parsed = parseChapters(field.value);
        const last = parsed.rows.filter((row) => row.valid).at(-1)?.seconds || 0;
        field.value = `${field.value.trim()}\n${formatTime(last + 30)} Chương mới`.trim();
        field.focus();
        field.setSelectionRange(field.value.length, field.value.length);
        updateChapters(root);
        queueSave(root);
        return;
      }
      if (event.target.closest("[data-yt-copy-chapters]")) { await copyText(root, root.querySelector("[data-yt-chapter-output]").value, "Đã sao chép chapters"); return; }
      const copyLink = event.target.closest("[data-yt-copy-link]");
      if (copyLink) { await copyText(root, root.querySelector(`[data-yt-link-output="${copyLink.dataset.ytCopyLink}"]`)?.value, "Đã sao chép link"); return; }
      if (event.target.closest("[data-yt-capture-frame]")) {
        const video = root.querySelector("[data-yt-video-preview]");
        const canvas = root.querySelector("[data-yt-frame-canvas]");
        const context = canvas.getContext("2d");
        if (!video.videoWidth || !context) return notify(root, "Video chưa sẵn sàng", "warning");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.hidden = false;
        root.querySelector("[data-yt-download-frame]").disabled = false;
        notify(root, `Đã lấy frame tại ${formatTime(video.currentTime)}`);
        return;
      }
      if (event.target.closest("[data-yt-download-frame]")) {
        const canvas = root.querySelector("[data-yt-frame-canvas]");
        const link = document.createElement("a");
        link.download = `youtube-frame-${Math.floor(root.querySelector("[data-yt-video-preview]").currentTime)}s.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        return;
      }
      if (event.target.closest("[data-yt-export]")) { exportProject(root); return; }
      if (event.target.closest("[data-yt-reset]")) {
        if (!global.confirm("Đặt lại toàn bộ dữ liệu cục bộ của YouTube Utility Lab?")) return;
        global.localStorage?.removeItem(STORAGE_KEY);
        mount(root.parentElement || root);
      }
    });

    root.addEventListener("change", (event) => {
      if (event.target.matches("[data-yt-thumbnail]")) {
        const file = event.target.files?.[0];
        if (!file) return;
        if (thumbnailUrl) URL.revokeObjectURL(thumbnailUrl);
        thumbnailUrl = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => {
          const ratio = image.naturalWidth / image.naturalHeight;
          const checks = [
            ["Định dạng ảnh", ["image/jpeg", "image/png", "image/webp"].includes(file.type), file.type || "Không xác định"],
            ["Dung lượng ≤ 2 MB", file.size <= 2 * 1024 * 1024, bytes(file.size)],
            ["Tỷ lệ gần 16:9", Math.abs(ratio - 16 / 9) <= 0.03, `${image.naturalWidth} × ${image.naturalHeight}`],
            ["Độ rộng khuyến nghị ≥ 1280 px", image.naturalWidth >= 1280, `${image.naturalWidth}px`]
          ];
          root.querySelector("[data-yt-thumbnail-preview]").innerHTML = `<img src="${thumbnailUrl}" alt="Thumbnail đang kiểm tra"><figcaption>${escapeHtml(file.name)}</figcaption>`;
          root.querySelector("[data-yt-thumbnail-report]").innerHTML = `<h4>Kết quả</h4>${checks.map(([label, pass, detail]) => `<div class="${pass ? "is-pass" : "is-warning"}"><span>${pass ? "✓" : "!"}</span><p><b>${escapeHtml(label)}</b><small>${escapeHtml(detail)}</small></p></div>`).join("")}`;
        };
        image.onerror = () => notify(root, "Không thể đọc tệp ảnh", "error");
        image.src = thumbnailUrl;
      }
      if (event.target.matches("[data-yt-video]")) {
        const file = event.target.files?.[0];
        if (!file) return;
        if (videoUrl) URL.revokeObjectURL(videoUrl);
        videoUrl = URL.createObjectURL(file);
        const video = root.querySelector("[data-yt-video-preview]");
        video.src = videoUrl;
        video.onloadedmetadata = () => {
          const ratio = video.videoWidth / video.videoHeight;
          const orientation = Math.abs(ratio - 9 / 16) < 0.04 ? "Short 9:16" : Math.abs(ratio - 16 / 9) < 0.04 ? "Ngang 16:9" : `${ratio.toFixed(2)}:1`;
          const rows = [
            ["Tên tệp", file.name], ["Định dạng trình duyệt", file.type || "Không xác định"], ["Dung lượng", bytes(file.size)],
            ["Thời lượng", formatTime(video.duration, video.duration >= 3600)], ["Độ phân giải", `${video.videoWidth} × ${video.videoHeight}`], ["Khung hình", orientation]
          ];
          root.querySelector("[data-yt-video-report]").innerHTML = `<h4>Thông tin đọc được</h4>${rows.map(([label, detail]) => `<div class="is-pass"><span>✓</span><p><b>${escapeHtml(label)}</b><small>${escapeHtml(detail)}</small></p></div>`).join("")}<p>Trình duyệt không cung cấp bitrate và FPS chính xác. Hãy dùng FFmpeg nếu cần kiểm định chuyên sâu.</p>`;
          root.querySelector("[data-yt-capture-frame]").disabled = false;
        };
        video.onerror = () => notify(root, "Trình duyệt không đọc được video này", "error");
      }
      if (event.target.matches("[data-yt-import]")) {
        const file = event.target.files?.[0];
        if (!file) return;
        file.text().then((text) => {
          const payload = JSON.parse(text);
          if (payload.format !== "hh-youtube-utility" || !payload.project) throw new Error("Sai định dạng dự án");
          global.localStorage?.setItem(STORAGE_KEY, JSON.stringify({ ...defaultState(), ...payload.project }));
          mount(root.parentElement || root);
        }).catch(() => notify(root, "Không thể nhập tệp JSON này", "error"));
      }
    });
  }

  function mount(host) {
    if (!host) return;
    cleanup();
    const state = readState();
    host.innerHTML = render(state);
    activeRoot = host.querySelector("[data-youtube-toolbox]");
    bind(activeRoot);
    updateMetadata(activeRoot);
    updateChapters(activeRoot);
    updateLinks(activeRoot);
  }

  function cleanup() {
    global.clearTimeout(saveTimer);
    if (thumbnailUrl) URL.revokeObjectURL(thumbnailUrl);
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    thumbnailUrl = "";
    videoUrl = "";
    activeRoot = null;
  }

  global.HHYouTubeToolbox = Object.freeze({
    mount,
    cleanup,
    analyzeMetadata,
    parseChapters,
    parseYouTubeId,
    formatTime,
    storageKey: STORAGE_KEY
  });
  global.dispatchEvent?.(new CustomEvent("hh:youtube-toolbox-ready"));
})(window);
