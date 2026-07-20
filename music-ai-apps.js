(function () {
  "use strict";

  const STORAGE_KEY = "hh.music-ai.apps.v1";
  const TOOLS = [
    { id: "app-center", route: "app-center", icon: "AP", title: "AI App Center", provider: "HH Studio", tone: "cyan", note: "Chọn và chạy từng công cụ độc lập" },
    { id: "concept-lab", route: "concept-lab", icon: "AI", title: "AI Concept Lab", provider: "Gemini", tone: "cyan", note: "Concept, cấu trúc album và prompt pack" },
    { id: "image-lab", route: "image-lab", icon: "IM", title: "Gemini Image Studio", provider: "Nano Banana 2", tone: "pink", note: "Tạo hoặc biến đổi key visual 1K–4K" },
    { id: "music-lab", route: "music-lab", icon: "MU", title: "Eleven Music Studio", provider: "Music v2", tone: "lime", note: "Tạo track instrumental hoặc có giọng hát" },
    { id: "veo-lab", route: "veo-lab", icon: "VE", title: "Veo Motion Studio", provider: "Veo 3.1", tone: "violet", note: "Text/Image to video, ngang hoặc dọc" },
    { id: "render-lab", route: "render-lab", icon: "FF", title: "Long-form Render Lab", provider: "FFmpeg local", tone: "amber", note: "Đóng gói video nhạc 1–5 giờ" },
    { id: "youtube-publisher", route: "youtube-publisher", icon: "YT", title: "YouTube Publisher", provider: "YouTube Data API", tone: "red", note: "Metadata, lịch phát và upload nhiều kênh" }
  ];
  const DEFAULTS = {
    concept: { idea: "Relax piano trong cabin gỗ giữa rừng mưa, ấm áp và sâu lắng", genre: "relax-piano", audience: "Ngủ, học tập và giảm căng thẳng", duration: "3 giờ", output: "" },
    image: { prompt: "Cinematic warm piano beside a rain-covered window in a quiet forest cabin, photorealistic, no people, no text", aspectRatio: "16:9", imageSize: "1K" },
    music: { prompt: "Warm felt piano, slow evolving harmony, soft room ambience, no percussion, peaceful and original", durationSeconds: 60, instrumental: true, outputFormat: "mp3_48000_192" },
    video: { prompt: "Very slow cinematic camera push, rain moving naturally on glass, subtle firelight flicker, seamless calm motion", aspectRatio: "16:9", resolution: "720p", durationSeconds: 8 },
    render: { durationHours: 1, resolution: "1920x1080", fps: 30, crf: 18, preset: "slow", outputName: "hh-music-video" }
  };

  let host = null;
  let options = {};
  let view = "app-center";
  let controller = null;
  let state = loadState();
  let providerStatus = { canRunMedia: false, providers: {} };
  let files = { imageReference: null, videoFrame: null, renderVisual: null, renderAudio: null };
  let urls = {};
  let outputs = { image: null, audio: null, video: null };
  let busy = "";

  const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  const apiBase = () => String(options.apiBase || window.HH_REALTIME_URL || location.origin).replace(/\/$/, "");
  const authHeaders = (json = true) => {
    const token = localStorage.getItem("hh-auth-token") || "";
    return { ...(json ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  };

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") || {};
      return Object.fromEntries(Object.entries(DEFAULTS).map(([key, value]) => [key, { ...value, ...(saved[key] || {}) }]));
    } catch { return structuredClone(DEFAULTS); }
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }

  function toast(message, type = "success") {
    const node = host?.querySelector("[data-ma-app-toast]");
    if (!node) return;
    node.textContent = message;
    node.dataset.type = type;
    node.classList.add("is-visible");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove("is-visible"), 3600);
  }

  async function api(path = "", method = "GET", body) {
    const response = await fetch(`${apiBase()}/api/modules/music-ai/actions${path}`, {
      method,
      headers: authHeaders(Boolean(body)),
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: "no-store"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Music AI HTTP ${response.status}`);
    return data;
  }

  async function refreshProviders() {
    try { providerStatus = await api(); }
    catch (error) { providerStatus = { canRunMedia: false, providers: {}, error: error.message }; }
    render();
  }

  function providerReady(id) {
    const provider = providerStatus.providers?.[id];
    if (id === "renderer") return true;
    return Boolean(provider?.configured && providerStatus.canRunMedia);
  }

  function statusPill(id) {
    const provider = providerStatus.providers?.[id];
    const ready = providerReady(id);
    return `<span class="ma-app-status ${ready ? "is-ready" : "is-missing"}"><i></i>${ready ? "Sẵn sàng" : provider?.configured ? "Cần tài khoản quản trị" : "Chưa cấu hình"}</span>`;
  }

  function downloadBlob(blob, name) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1500);
  }

  function textDownload(text, name, type = "text/plain") {
    downloadBlob(new Blob([text], { type: `${type};charset=utf-8` }), name);
  }

  function copy(text) {
    navigator.clipboard?.writeText(String(text || "")).then(() => toast("Đã sao chép.")).catch(() => toast("Không thể sao chép.", "error"));
  }

  function readDataUrl(file, max = 1_600_000) {
    if (!file || file.size > max) return Promise.reject(new Error(`Tệp phải nhỏ hơn ${(max / 1024 / 1024).toFixed(1)} MB.`));
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Không đọc được tệp."));
      reader.readAsDataURL(file);
    });
  }

  function base64Blob(data, type) {
    const bytes = atob(data);
    const array = new Uint8Array(bytes.length);
    for (let index = 0; index < bytes.length; index += 1) array[index] = bytes.charCodeAt(index);
    return new Blob([array], { type });
  }

  function replaceUrl(key, blob) {
    if (urls[key]) URL.revokeObjectURL(urls[key]);
    urls[key] = URL.createObjectURL(blob);
    outputs[key] = blob;
  }

  function toolNav() {
    return `<nav class="ma-app-dock" aria-label="Ứng dụng làm nhạc AI">${TOOLS.map((tool) => `<button class="tone-${tool.tone} ${view === tool.id ? "is-active" : ""}" type="button" data-app-route="/music-ai/${tool.route}" title="${esc(tool.note)}"><i>${tool.icon}</i><span>${tool.title}</span><b>›</b></button>`).join("")}</nav>`;
  }

  function appShell(content, title, subtitle, badge = "APP ĐỘC LẬP") {
    return `<div class="ma-app-suite"><header class="ma-app-hero"><div><p><i></i>${badge}</p><h2>${title}</h2><span>${subtitle}</span></div><div class="ma-app-hero__meta"><span>${navigator.onLine ? "Online" : "Offline"}</span><button type="button" data-ma-action="refresh-providers">Kiểm tra API</button></div></header><div class="ma-app-layout">${toolNav()}<main class="ma-app-workspace">${content}</main></div><div class="ma-app-toast" data-ma-app-toast role="status" aria-live="polite"></div></div>`;
  }

  function overview() {
    const ids = { "concept-lab": "concept", "image-lab": "image", "music-lab": "music", "veo-lab": "video", "render-lab": "renderer", "youtube-publisher": "youtube" };
    const cards = TOOLS.slice(1).map((tool) => {
      const providerId = ids[tool.id];
      const provider = providerStatus.providers?.[providerId] || {};
      const ready = providerId === "youtube" ? true : providerReady(providerId);
      return `<article class="ma-launch-card tone-${tool.tone}"><header><i>${tool.icon}</i>${providerId === "youtube" ? '<span class="ma-app-status is-ready"><i></i>OAuth</span>' : statusPill(providerId)}</header><h3>${tool.title}</h3><p>${tool.note}</p><div>${(provider.capabilities || []).slice(0, 4).map((item) => `<span>${esc(item)}</span>`).join("")}</div><footer><small>${esc(provider.model || tool.provider)}</small><button type="button" data-app-route="/music-ai/${tool.route}">${ready ? "Mở app" : "Mở & cấu hình"} →</button></footer></article>`;
    }).join("");
    return appShell(`<section class="ma-app-intro"><div><small>MODULAR CREATIVE SYSTEM</small><h3>Mỗi tác vụ là một app riêng</h3><p>Bạn có thể chỉ tạo nhạc, chỉ làm ảnh, chỉ chuyển động hoặc chỉ đăng YouTube. Dữ liệu nháp của từng app được lưu riêng trên thiết bị.</p></div><aside><strong>${Object.keys(providerStatus.providers || {}).filter(providerReady).length}/5</strong><span>engine sẵn sàng</span></aside></section><section class="ma-launch-grid">${cards}</section><section class="ma-config-strip"><div><strong>Bảo mật API</strong><span>API key chỉ tồn tại trên Vercel; trình duyệt chỉ nhận trạng thái và kết quả.</span></div><button type="button" data-ma-action="refresh-providers">Đồng bộ trạng thái</button></section>`, "Music AI App Center", "Chọn đúng một công cụ cho công việc hiện tại, không bắt buộc chạy cả pipeline.", "HH MODULAR STUDIO");
  }

  function field(label, key, value, attrs = "") {
    return `<label class="ma-field"><span>${label}</span><input data-ma-field="${key}" value="${esc(value)}" ${attrs}></label>`;
  }

  function conceptView() {
    const s = state.concept;
    return appShell(`<section class="ma-two-col"><div class="ma-editor-panel"><header><div><small>INPUT</small><h3>Định hướng dự án</h3></div>${statusPill("concept")}</header><label class="ma-field"><span>Ý tưởng chính</span><textarea rows="7" data-ma-field="concept.idea">${esc(s.idea)}</textarea></label><div class="ma-field-grid">${field("Thể loại", "concept.genre", s.genre)}${field("Đối tượng", "concept.audience", s.audience)}${field("Thời lượng mục tiêu", "concept.duration", s.duration)}</div><div class="ma-action-row"><button class="is-primary" type="button" data-ma-action="run-concept" ${busy ? "disabled" : ""}>${busy === "concept" ? "Đang phân tích…" : "Tạo production brief"}</button><button type="button" data-ma-action="concept-from-project">Nạp dự án hiện tại</button></div></div><div class="ma-output-panel"><header><div><small>GEMINI OUTPUT</small><h3>Production brief</h3></div><div><button type="button" data-ma-action="copy-concept">Sao chép</button><button type="button" data-ma-action="download-concept">Tải TXT</button></div></header><pre>${esc(s.output || "Kết quả concept, mood, cấu trúc track, hình ảnh và chiến lược YouTube sẽ xuất hiện tại đây.")}</pre></div></section>`, "AI Concept Lab", "Tạo riêng concept, cấu trúc album, moodboard và chiến lược sản xuất bằng Gemini.");
  }

  function imageView() {
    const s = state.image;
    return appShell(`<section class="ma-two-col"><div class="ma-editor-panel"><header><div><small>IMAGE ENGINE</small><h3>Tạo key visual</h3></div>${statusPill("image")}</header><label class="ma-field"><span>Prompt hình ảnh</span><textarea rows="8" data-ma-field="image.prompt">${esc(s.prompt)}</textarea></label><div class="ma-field-grid"><label class="ma-field"><span>Tỷ lệ</span><select data-ma-field="image.aspectRatio">${["16:9","9:16","1:1","21:9","4:3","3:4"].map((item) => `<option ${s.aspectRatio === item ? "selected" : ""}>${item}</option>`).join("")}</select></label><label class="ma-field"><span>Độ phân giải</span><select data-ma-field="image.imageSize">${["1K","2K","4K"].map((item) => `<option ${s.imageSize === item ? "selected" : ""}>${item}</option>`).join("")}</select></label></div><label class="ma-file-zone"><input type="file" accept="image/jpeg,image/png,image/webp" data-ma-file="image-reference"><i>+</i><span><strong>${files.imageReference ? esc(files.imageReference.name) : "Ảnh tham chiếu (không bắt buộc)"}</strong><small>JPG, PNG, WebP · xử lý tạm thời</small></span></label><div class="ma-action-row"><button class="is-primary" type="button" data-ma-action="run-image" ${busy ? "disabled" : ""}>${busy === "image" ? "Đang tạo ảnh…" : "Tạo ảnh"}</button><button type="button" data-ma-action="image-from-concept">Dùng concept</button></div></div><div class="ma-media-stage">${urls.image ? `<img src="${urls.image}" alt="Ảnh AI vừa tạo"><footer><span>Ảnh được xử lý từ Gemini Images</span><button type="button" data-ma-action="download-image">Tải ảnh</button></footer>` : `<div><i>IM</i><strong>Canvas kết quả</strong><span>Ảnh tạo xong sẽ hiển thị tại đây.</span></div>`}</div></section>`, "Gemini Image Studio", "Tạo ảnh mới hoặc dùng ảnh tham chiếu, tùy chọn tỷ lệ và chất lượng riêng cho từng lần chạy.");
  }

  function musicView() {
    const s = state.music;
    return appShell(`<section class="ma-two-col"><div class="ma-editor-panel"><header><div><small>MUSIC V2</small><h3>Soạn track độc lập</h3></div>${statusPill("music")}</header><label class="ma-field"><span>Prompt âm nhạc</span><textarea rows="9" data-ma-field="music.prompt">${esc(s.prompt)}</textarea></label><div class="ma-field-grid">${field("Thời lượng (3–120 giây)", "music.durationSeconds", s.durationSeconds, 'type="number" min="3" max="120"')}<label class="ma-field"><span>Định dạng</span><select data-ma-field="music.outputFormat"><option value="mp3_48000_192" ${s.outputFormat === "mp3_48000_192" ? "selected" : ""}>MP3 48kHz 192kbps</option><option value="mp3_44100_128" ${s.outputFormat === "mp3_44100_128" ? "selected" : ""}>MP3 44.1kHz 128kbps</option></select></label></div><label class="ma-check"><input type="checkbox" data-ma-field="music.instrumental" ${s.instrumental ? "checked" : ""}><i></i><span><strong>Instrumental</strong><small>Tắt để cho phép giọng hát khi prompt yêu cầu.</small></span></label><div class="ma-action-row"><button class="is-primary" type="button" data-ma-action="run-music" ${busy ? "disabled" : ""}>${busy === "music" ? "Đang sáng tác…" : "Tạo track"}</button><button type="button" data-ma-action="music-from-concept">Dùng concept</button></div></div><div class="ma-audio-stage">${urls.audio ? `<div class="ma-disc"><i></i><span>HH</span></div><h3>Track vừa tạo</h3><audio src="${urls.audio}" controls></audio><button type="button" data-ma-action="download-audio">Tải MP3</button>` : `<i>♪</i><strong>Chưa có track</strong><span>Tạo nhạc và nghe trực tiếp tại đây.</span>`}</div></section>`, "Eleven Music Studio", "Tạo một track riêng bằng prompt, không cần chạy ảnh, video hay YouTube Publisher.");
  }

  function videoView() {
    const s = state.video;
    return appShell(`<section class="ma-two-col"><div class="ma-editor-panel"><header><div><small>VEO 3.1</small><h3>Chuyển động điện ảnh</h3></div>${statusPill("video")}</header><label class="ma-field"><span>Prompt chuyển động</span><textarea rows="8" data-ma-field="video.prompt">${esc(s.prompt)}</textarea></label><div class="ma-field-grid"><label class="ma-field"><span>Tỷ lệ</span><select data-ma-field="video.aspectRatio"><option ${s.aspectRatio === "16:9" ? "selected" : ""}>16:9</option><option ${s.aspectRatio === "9:16" ? "selected" : ""}>9:16</option></select></label><label class="ma-field"><span>Độ phân giải</span><select data-ma-field="video.resolution">${["720p","1080p","4k"].map((item) => `<option ${s.resolution === item ? "selected" : ""}>${item}</option>`).join("")}</select></label><label class="ma-field"><span>Thời lượng</span><select data-ma-field="video.durationSeconds">${[4,6,8].map((item) => `<option value="${item}" ${Number(s.durationSeconds) === item ? "selected" : ""}>${item} giây</option>`).join("")}</select></label></div><label class="ma-file-zone"><input type="file" accept="image/jpeg,image/png,image/webp" data-ma-file="video-frame"><i>+</i><span><strong>${files.videoFrame ? esc(files.videoFrame.name) : "Frame đầu (không bắt buộc)"}</strong><small>Không chọn ảnh để dùng text-to-video.</small></span></label><div class="ma-action-row"><button class="is-primary" type="button" data-ma-action="run-video" ${busy ? "disabled" : ""}>${busy === "video" ? "Veo đang xử lý…" : "Tạo video"}</button><button type="button" data-ma-action="video-from-image" ${outputs.image ? "" : "disabled"}>Dùng ảnh vừa tạo</button></div></div><div class="ma-media-stage ma-media-stage--video">${urls.video ? `<video src="${urls.video}" controls playsinline></video><footer><span>Veo render hoàn tất</span><button type="button" data-ma-action="download-video">Tải MP4</button></footer>` : `<div><i>VE</i><strong>Veo preview</strong><span>Quá trình có thể mất vài phút; trang sẽ tự theo dõi tiến độ.</span></div>`}</div></section>`, "Veo Motion Studio", "Tạo video riêng từ câu lệnh hoặc một frame đầu, hỗ trợ khung ngang và dọc.");
  }

  function renderCommand() {
    const s = state.render;
    const visual = files.renderVisual?.name || "visual.mp4";
    const audio = files.renderAudio?.name || "music.mp3";
    const seconds = Math.max(1, Math.min(5, Number(s.durationHours) || 1)) * 3600;
    const visualInput = files.renderVisual?.type?.startsWith("image/") ? `-loop 1 -i "${visual}"` : `-stream_loop -1 -i "${visual}"`;
    return `ffmpeg -y ${visualInput} -stream_loop -1 -i "${audio}" -t ${seconds} -map 0:v:0 -map 1:a:0 -vf "scale=${s.resolution.replace("x", ":")}:force_original_aspect_ratio=increase,crop=${s.resolution.replace("x", ":")},format=yuv420p" -r ${s.fps} -c:v libx264 -preset ${s.preset} -crf ${s.crf} -c:a aac -b:a 320k -ar 48000 -movflags +faststart -shortest "${s.outputName}.mp4"`;
  }

  function renderView() {
    const s = state.render;
    return appShell(`<section class="ma-render-layout"><div class="ma-editor-panel"><header><div><small>LOCAL RENDER</small><h3>Đóng gói video dài</h3></div>${statusPill("renderer")}</header><div class="ma-render-files"><label class="ma-file-zone"><input type="file" accept="video/*,image/*" data-ma-file="render-visual"><i>V</i><span><strong>${files.renderVisual ? esc(files.renderVisual.name) : "Chọn ảnh hoặc video nền"}</strong><small>File giữ nguyên trên máy.</small></span></label><label class="ma-file-zone"><input type="file" accept="audio/*" data-ma-file="render-audio"><i>A</i><span><strong>${files.renderAudio ? esc(files.renderAudio.name) : "Chọn nhạc"}</strong><small>MP3, WAV, M4A, OGG.</small></span></label></div><div class="ma-field-grid">${field("Thời lượng (giờ)", "render.durationHours", s.durationHours, 'type="number" min="1" max="5"')}<label class="ma-field"><span>Khung hình</span><select data-ma-field="render.resolution"><option ${s.resolution === "1920x1080" ? "selected" : ""}>1920x1080</option><option ${s.resolution === "3840x2160" ? "selected" : ""}>3840x2160</option><option ${s.resolution === "1080x1920" ? "selected" : ""}>1080x1920</option></select></label>${field("FPS", "render.fps", s.fps, 'type="number" min="24" max="60"')}${field("CRF", "render.crf", s.crf, 'type="number" min="14" max="28"')}${field("Tên file", "render.outputName", s.outputName)}</div><div class="ma-action-row"><button class="is-primary" type="button" data-ma-action="download-bat">Tải bộ render Windows</button><button type="button" data-ma-action="copy-render">Sao chép lệnh</button><button type="button" data-ma-action="download-render-project">Xuất JSON</button></div></div><div class="ma-output-panel"><header><div><small>FFMPEG JOB</small><h3>Lệnh render thật</h3></div><span class="ma-app-status is-ready"><i></i>Chạy trên máy</span></header><pre>${esc(renderCommand())}</pre><div class="ma-render-summary"><span><strong>${s.durationHours} giờ</strong><small>Thời lượng</small></span><span><strong>${s.resolution}</strong><small>Độ phân giải</small></span><span><strong>${s.fps} FPS</strong><small>Frame rate</small></span><span><strong>H.264 + AAC</strong><small>Codec</small></span></div><p>Trình duyệt không gửi file dài lên máy chủ. Bộ render tải về dùng trực tiếp FFmpeg và hai file bạn đã chọn.</p></div></section>`, "Long-form Render Lab", "Ghép hình/video với nhạc thành video 1–5 giờ bằng FFmpeg trên chính máy của bạn.");
  }

  function render() {
    if (!host) return;
    const output = ({ "app-center": overview, "concept-lab": conceptView, "image-lab": imageView, "music-lab": musicView, "veo-lab": videoView, "render-lab": renderView }[view] || overview)();
    host.innerHTML = output;
  }

  function setNested(path, value) {
    const [group, key] = path.split(".");
    if (!state[group] || !key) return;
    state[group][key] = value;
    saveState();
  }

  function projectSeed() {
    const project = options.project || {};
    const preset = options.prompts || {};
    state.concept.idea = `${project.name || "Dự án nhạc AI"}. ${project.mood || ""}`.trim();
    state.concept.genre = project.genre || state.concept.genre;
    state.concept.audience = project.purpose || state.concept.audience;
    if (preset.image) state.image.prompt = preset.image;
    if (preset.music) state.music.prompt = preset.music;
    if (preset.motion) state.video.prompt = preset.motion;
    saveState();
  }

  async function runConcept() {
    busy = "concept"; render();
    try {
      const s = state.concept;
      const input = `Hãy lập production brief hoàn chỉnh cho dự án nhạc AI. Ý tưởng: ${s.idea}. Thể loại: ${s.genre}. Đối tượng: ${s.audience}. Thời lượng: ${s.duration}. Trả lời tiếng Việt, gồm concept độc đáo, cấu trúc track, nhạc cụ, BPM, moodboard hình ảnh, prompt ảnh, prompt video, prompt nhạc, title YouTube và checklist quyền sử dụng.`;
      const data = await api("", "POST", { actionType: "music-concept", input, meta: { model: "gemini-3.5-flash", creativity: 78 } });
      state.concept.output = data.action?.output || "Không có kết quả.";
      saveState(); toast(`Đã tạo concept bằng ${data.action?.provider || "AI"}.`);
    } catch (error) { toast(error.message, "error"); }
    finally { busy = ""; render(); }
  }

  async function runImage() {
    busy = "image"; render();
    try {
      const references = files.imageReference ? [{ mimeType: files.imageReference.type, data: await readDataUrl(files.imageReference) }] : [];
      const data = await api("", "POST", { actionType: "music-image", input: state.image.prompt, meta: { aspectRatio: state.image.aspectRatio, imageSize: state.image.imageSize, referenceImages: references } });
      const media = data.media;
      if (!media?.data) throw new Error("Gemini không trả về ảnh.");
      replaceUrl("image", base64Blob(media.data, media.mimeType || "image/jpeg"));
      toast("Ảnh đã được tạo.");
    } catch (error) { toast(error.message, "error"); }
    finally { busy = ""; render(); }
  }

  async function runMusic() {
    busy = "music"; render();
    try {
      const s = state.music;
      const data = await api("", "POST", { actionType: "music-track", input: s.prompt, meta: { durationSeconds: Number(s.durationSeconds), instrumental: Boolean(s.instrumental), outputFormat: s.outputFormat } });
      if (!data.media?.data) throw new Error("Eleven Music không trả về audio.");
      replaceUrl("audio", base64Blob(data.media.data, data.media.mimeType || "audio/mpeg"));
      toast("Track đã được tạo.");
    } catch (error) { toast(error.message, "error"); }
    finally { busy = ""; render(); }
  }

  async function runVideo() {
    busy = "video"; render();
    try {
      const s = state.video;
      let imageData = "";
      let imageMimeType = "image/jpeg";
      if (files.videoFrame) { imageData = await readDataUrl(files.videoFrame); imageMimeType = files.videoFrame.type; }
      else if (outputs.image) { imageData = await new Promise((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsDataURL(outputs.image); }); imageMimeType = outputs.image.type; }
      const started = await api("", "POST", { actionType: "music-video-start", input: s.prompt, meta: { imageData, imageMimeType, aspectRatio: s.aspectRatio, resolution: s.resolution, durationSeconds: Number(s.durationSeconds) } });
      const operationName = started.operation?.name;
      if (!operationName) throw new Error("Veo không tạo mã tiến trình.");
      let operation = started.operation;
      for (let attempt = 0; attempt < 60 && !operation.done; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 6000));
        operation = (await api("", "POST", { actionType: "music-video-status", input: "status", meta: { operationName } })).operation;
      }
      if (!operation.ready || !operation.mediaUri) throw new Error(operation.error || "Veo chưa hoàn tất trong thời gian chờ.");
      const encoded = btoa(operation.mediaUri).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      const response = await fetch(`${apiBase()}/api/modules/music-ai/actions?media=veo&uri=${encodeURIComponent(encoded)}`, { headers: authHeaders(false) });
      if (!response.ok) throw new Error("Không tải được video Veo.");
      replaceUrl("video", await response.blob());
      toast("Video Veo đã hoàn tất.");
    } catch (error) { toast(error.message, "error"); }
    finally { busy = ""; render(); }
  }

  function selectFile(input) {
    const file = input.files?.[0];
    if (!file) return;
    const key = { "image-reference": "imageReference", "video-frame": "videoFrame", "render-visual": "renderVisual", "render-audio": "renderAudio" }[input.dataset.maFile];
    if (!key) return;
    files[key] = file;
    render();
  }

  function downloadRenderPack() {
    if (!files.renderVisual || !files.renderAudio) return toast("Hãy chọn cả hình/video nền và file nhạc.", "error");
    const command = renderCommand();
    const bat = `@echo off\r\nwhere ffmpeg >nul 2>nul || (echo Hay cai FFmpeg va them vao PATH.& pause & exit /b 1)\r\n${command}\r\necho Render hoan tat.\r\npause\r\n`;
    textDownload(bat, `${state.render.outputName}-render.bat`, "application/x-bat");
    textDownload(JSON.stringify({ version: 1, visual: files.renderVisual.name, audio: files.renderAudio.name, settings: state.render, command }, null, 2), `${state.render.outputName}-project.json`, "application/json");
    toast("Đã tải bộ render Windows và project JSON.");
  }

  function handleInput(event) {
    const input = event.target.closest("[data-ma-field]");
    if (!input) return;
    setNested(input.dataset.maField, input.type === "checkbox" ? input.checked : input.value);
  }

  function handleChange(event) {
    if (event.target.matches("[data-ma-file]")) selectFile(event.target);
  }

  function handleClick(event) {
    const button = event.target.closest("[data-ma-action]");
    if (!button) return;
    const action = button.dataset.maAction;
    if (action === "refresh-providers") refreshProviders().then(() => toast("Đã cập nhật trạng thái API."));
    if (action === "concept-from-project") { projectSeed(); render(); toast("Đã nạp dữ liệu dự án."); }
    if (action === "image-from-concept") { state.image.prompt = state.concept.output || state.concept.idea; saveState(); render(); }
    if (action === "music-from-concept") { state.music.prompt = state.concept.output || state.concept.idea; saveState(); render(); }
    if (action === "video-from-image" && outputs.image) { files.videoFrame = new File([outputs.image], "gemini-key-visual.jpg", { type: outputs.image.type || "image/jpeg" }); render(); }
    if (action === "run-concept") runConcept();
    if (action === "run-image") runImage();
    if (action === "run-music") runMusic();
    if (action === "run-video") runVideo();
    if (action === "copy-concept") copy(state.concept.output);
    if (action === "download-concept") textDownload(state.concept.output, "hh-music-concept.txt");
    if (action === "download-image" && outputs.image) downloadBlob(outputs.image, "hh-key-visual.jpg");
    if (action === "download-audio" && outputs.audio) downloadBlob(outputs.audio, "hh-music-track.mp3");
    if (action === "download-video" && outputs.video) downloadBlob(outputs.video, "hh-veo-video.mp4");
    if (action === "copy-render") copy(renderCommand());
    if (action === "download-bat") downloadRenderPack();
    if (action === "download-render-project") textDownload(JSON.stringify({ settings: state.render, command: renderCommand() }, null, 2), `${state.render.outputName}-project.json`, "application/json");
  }

  function mount(nextHost, nextOptions = {}) {
    unmount();
    host = nextHost;
    options = nextOptions;
    view = TOOLS.some((item) => item.id === nextOptions.view) ? nextOptions.view : "app-center";
    state = loadState();
    controller = new AbortController();
    host.addEventListener("input", handleInput, { signal: controller.signal });
    host.addEventListener("change", handleChange, { signal: controller.signal });
    host.addEventListener("click", handleClick, { signal: controller.signal });
    render();
    refreshProviders();
  }

  function unmount() {
    controller?.abort();
    controller = null;
    Object.values(urls).forEach((url) => URL.revokeObjectURL(url));
    urls = {};
    outputs = { image: null, audio: null, video: null };
    files = { imageReference: null, videoFrame: null, renderVisual: null, renderAudio: null };
    host = null;
  }

  window.HHMusicAIApps = { mount, unmount, tools: TOOLS.map((item) => ({ ...item })) };
})();
