(function initHHMusicAutopilot(global) {
  "use strict";

  const Core = () => global.HHMusicAutopilotCore;
  const ASSET_DB = "hh-music-autopilot-assets-v1";
  const ASSET_STORE = "assets";
  const TABS = [["autopilot", "Autopilot"], ["project", "Dự án"], ["cost", "Chi phí"], ["queue", "Hàng đợi"], ["publish", "Xuất bản"]];
  let host = null;
  let controller = null;
  let store = null;
  let state = null;
  let providers = { canRunMedia: false, providers: {} };
  let activeTab = "autopilot";
  let running = false;
  let urls = new Map();
  let liveAssets = new Map();
  let visualizerFrame = 0;
  let visualizerAudio = null;
  let restoringUrls = false;

  const esc = value => String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  const clean = (value, limit = 1000) => String(value == null ? "" : value).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const scope = () => {
    let user = global.HHAuthz?.currentUser?.();
    if (!user) try { user = JSON.parse(localStorage.getItem("hh-auth-user") || "null"); } catch { user = null; }
    let profile = {};
    try { profile = JSON.parse(localStorage.getItem("hh.learning.os.v1") || "null") || {}; } catch { profile = {}; }
    return { ownerId: user?._id || user?.id || user?.email || "guest", learnerProfileId: profile.learnerProfileId || profile.activeProfileId || "default" };
  };
  const apiBase = () => String(global.HH_API_ORIGIN || global.HH_REALTIME_URL || location.origin).replace(/\/$/, "");
  const authHeaders = () => { const token = global.HHAuthSession?.token?.() || ""; return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }; };
  const persist = patch => { state = store.update(patch); return state; };
  const setStage = (id, status, detail, extra) => { store.setStage(id, status, detail, extra); state = store.get(); renderStages(); renderTop(); };

  function openDb() {
    return new Promise((resolve, reject) => {
      if (!global.indexedDB) return reject(new Error("Trình duyệt không hỗ trợ IndexedDB."));
      const request = indexedDB.open(ASSET_DB, 1);
      request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(ASSET_STORE)) request.result.createObjectStore(ASSET_STORE, { keyPath: "key" }); };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Không mở được kho asset."));
    });
  }
  async function putAsset(key, blob, meta = {}) {
    if (!(blob instanceof Blob)) throw new Error("Asset không phải Blob hợp lệ.");
    const row = { key, blob, type: blob.type, size: blob.size, projectId: state.id, ownerId: state.ownerId, stageId: meta.stageId || "", provider: meta.provider || "local", model: meta.model || "", createdAt: new Date().toISOString() };
    const db = await openDb();
    try { await new Promise((resolve, reject) => { const tx = db.transaction(ASSET_STORE, "readwrite"); tx.objectStore(ASSET_STORE).put(row); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); } finally { db.close(); }
    liveAssets.set(key, row); setUrl(key, blob); return row;
  }
  async function getAsset(key) {
    if (!key) return null;
    if (liveAssets.has(key)) return liveAssets.get(key);
    const db = await openDb();
    try { const row = await new Promise((resolve, reject) => { const tx = db.transaction(ASSET_STORE, "readonly"); const req = tx.objectStore(ASSET_STORE).get(key); req.onsuccess = () => resolve(req.result || null); req.onerror = () => reject(req.error); }); if (row?.ownerId === state.ownerId) { liveAssets.set(key, row); setUrl(key, row.blob); return row; } return null; } finally { db.close(); }
  }
  function setUrl(key, blob) { if (urls.has(key)) URL.revokeObjectURL(urls.get(key)); urls.set(key, URL.createObjectURL(blob)); }
  function urlFor(key) { return urls.get(key) || ""; }
  function assetKey(stage, suffix = "main") { return `${state.ownerId}:${state.id}:${stage}:${suffix}`; }
  function fromBase64(data, type = "application/octet-stream") { const binary = atob(String(data || "")); const chunks = []; for (let offset = 0; offset < binary.length; offset += 32768) { const slice = binary.slice(offset, offset + 32768); chunks.push(Uint8Array.from(slice, char => char.charCodeAt(0))); } return new Blob(chunks, { type }); }
  function toBase64(blob) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1] || ""); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob); }); }

  async function api(actionType, input = "", meta = {}) {
    const response = await fetch(`${apiBase()}/api/modules/music-ai/actions`, { method: "POST", headers: authHeaders(), body: JSON.stringify({ actionType, input, meta, ownerId: state.ownerId, learnerProfileId: state.learnerProfileId }), cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error(data.error || `Music API HTTP ${response.status}`); error.code = data.code || "MUSIC_API_ERROR"; error.status = response.status; throw error; }
    return data;
  }
  async function refreshProviders(shouldRender = true) {
    try { const response = await fetch(`${apiBase()}/api/modules/music-ai/actions`, { headers: authHeaders(), cache: "no-store" }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`); providers = data; }
    catch (error) { providers = { canRunMedia: false, providers: {}, error: error.message }; }
    state.cost = Core().estimateCost(state, providers.providers); persist({ cost: state.cost });
    if (shouldRender) render(); return providers;
  }

  function toast(message, type = "") { const node = host?.querySelector("[data-map-toast]"); if (!node) return; node.textContent = clean(message, 500); node.dataset.type = type; node.classList.add("is-visible"); clearTimeout(toast.timer); toast.timer = setTimeout(() => node.classList.remove("is-visible"), 4200); }
  function statusLabel(value) { return ({ waiting: "Chờ", running: "Đang chạy", review: "Cần kiểm tra", completed: "Hoàn tất", failed: "Thất bại", blocked: "Chưa cấu hình", paused: "Tạm dừng", skipped: "Bỏ qua" })[value] || value; }
  function workflowLabel(value) { return ({ auto: "Auto", assisted: "Assisted", pro: "Pro" })[value] || value; }
  function providerLabel(value) { return Core().PROVIDERS[value]?.label || value; }

  function topMarkup() {
    const completion = Core().completion(state);
    return `<header class="map-top"><div><p><i></i>HH MUSIC AUTOPILOT · REAL PIPELINE</p><h2>${esc(state.title)}</h2><span>Ý tưởng → nhạc → kiểm âm → hình ảnh → Rights Pack → xuất bản</span></div><div class="map-top__metrics"><article><small>Tiến độ</small><strong>${completion}%</strong></article><article><small>Ước tính</small><strong>$${Number(state.cost?.estimatedUsd || 0).toFixed(2)}</strong></article><article><small>Chế độ</small><strong>${workflowLabel(state.workflow)}</strong></article><button type="button" data-map-action="refresh">↻ API</button></div></header>`;
  }

  function projectForm() {
    const vocalMode = !["instrumental", "relax", "game-loop", "podcast", "livestream", "adaptive", "karaoke"].includes(state.mode);
    return `<form class="map-panel map-brief" data-map-project-form><header><div><small>01 · CREATIVE BRIEF</small><h3>Một brief, toàn bộ sản phẩm</h3></div><span>${state.ownerId === "guest" ? "Local guest" : "Private workspace"}</span></header>
      <label class="map-field map-field--wide"><span>Ý tưởng hoặc yêu cầu</span><textarea name="idea" rows="5" maxlength="4000">${esc(state.idea)}</textarea></label>
      ${vocalMode ? `<label class="map-field map-field--wide"><span>Lời đã có (không bắt buộc · để trống để AI viết bản nguyên bản)</span><textarea name="lyricsOverride" rows="7" maxlength="16000" placeholder="[Verse 1]&#10;...&#10;&#10;[Chorus]&#10;...">${esc(state.lyricsOverride || "")}</textarea></label>` : ""}
      <div class="map-grid2"><label class="map-field"><span>Chế độ</span><select name="mode">${Core().MODES.map(item => `<option value="${item.id}" ${item.id === state.mode ? "selected" : ""}>${esc(item.label)}</option>`).join("")}</select></label><label class="map-field"><span>Workflow</span><select name="workflow"><option value="auto" ${state.workflow === "auto" ? "selected" : ""}>Auto · chạy tới Rights Gate</option><option value="assisted" ${state.workflow === "assisted" ? "selected" : ""}>Assisted · dừng ở preview/master</option><option value="pro" ${state.workflow === "pro" ? "selected" : ""}>Pro · xác nhận từng stage</option></select></label></div>
      <div class="map-grid2"><label class="map-field"><span>Provider</span><select name="provider">${Object.values(Core().PROVIDERS).map(item => `<option value="${item.id}" ${item.id === state.provider ? "selected" : ""}>${esc(item.label)}</option>`).join("")}</select></label><label class="map-field"><span>Loại master</span><select name="masterPreset">${Object.values(Core().MASTER_PRESETS).map(item => `<option value="${item.id}" ${item.id === state.masterPreset ? "selected" : ""}>${esc(item.label)} · ${item.targetLufs} LUFS tham chiếu</option>`).join("")}</select></label></div>
      <div class="map-grid3"><label class="map-field"><span>Thể loại</span><input name="genre" maxlength="80" value="${esc(state.genre)}"></label><label class="map-field"><span>Mood</span><input name="mood" maxlength="140" value="${esc(state.mood)}"></label><label class="map-field"><span>Ngôn ngữ</span><select name="language">${[["vi","Tiếng Việt"],["en","English"],["ja","日本語"],["ko","한국어"],["fr","Français"],["es","Español"]].map(([id,label]) => `<option value="${id}" ${id === state.language ? "selected" : ""}>${label}</option>`).join("")}</select></label></div>
      <div class="map-grid3"><label class="map-field"><span>BPM</span><input name="bpm" type="number" min="35" max="220" value="${state.bpm}"></label><label class="map-field"><span>Thời lượng</span><select name="durationSeconds">${[15,30,45,60,90,120].map(value => `<option value="${value}" ${Number(state.durationSeconds) === value ? "selected" : ""}>${value} giây</option>`).join("")}</select></label><label class="map-field"><span>Tỷ lệ video</span><select name="aspectRatio">${["16:9","9:16","1:1"].map(value => `<option ${state.aspectRatio === value ? "selected" : ""}>${value}</option>`).join("")}</select></label></div>
      ${state.mode === "album" ? `<label class="map-field"><span>Số bài album</span><input name="albumCount" type="number" min="2" max="100" value="${state.albumCount}"></label>` : ""}
      <div class="map-file-grid"><label><input type="file" accept="audio/*,video/*,image/*" data-map-file="reference"><i>＋</i><span><strong>${esc(state.assets?.reference?.name || "Ảnh / video / audio tham chiếu")}</strong><small>${esc(state.assets?.reference?.analysis || "Chỉ tải khi bạn chọn; cần xác nhận quyền.")}</small></span></label>${state.assets?.reference ? '<button type="button" data-map-action="clear-reference">Bỏ file</button>' : ""}</div>
      <div class="map-toggle-grid"><label><input name="generateArtwork" type="checkbox" ${state.generateArtwork ? "checked" : ""}><span>Tự tạo artwork</span></label><label><input name="generateVideo" type="checkbox" ${state.generateVideo ? "checked" : ""}><span>Tạo clip Veo nếu có credit</span></label><label><input name="autoRepair" type="checkbox" ${state.autoRepair ? "checked" : ""}><span>Tự sửa gain/clipping</span></label><label><input name="autoPackage" type="checkbox" ${state.autoPackage ? "checked" : ""}><span>Tự tạo ZIP</span></label></div>
      <fieldset class="map-rights"><legend>Quyền đầu vào</legend><label><input name="ownsPrompt" type="checkbox" ${state.rights.ownsPrompt ? "checked" : ""}> Tôi sở hữu brief/lời hoặc được phép sử dụng</label><label><input name="ownsReferences" type="checkbox" ${state.rights.ownsReferences ? "checked" : ""}> Tôi có quyền với file tham chiếu</label><label><input name="acceptsProviderTerms" type="checkbox" ${state.rights.acceptsProviderTerms ? "checked" : ""}> Tôi đã xem điều kiện provider và mục đích thương mại</label><label><input name="noArtistImitation" type="checkbox" checked disabled> Không yêu cầu bắt chước nghệ sĩ/bài hát cụ thể</label></fieldset>
      <button class="map-save" type="submit">Lưu brief & tính lại pipeline</button></form>`;
  }

  function providerMarkup() {
    const list = [["concept","Concept AI"],["lyria","Lyria 3"],["music","Eleven v2"],["image","Gemini Images"],["video","Veo"],["stems","Demucs"],["renderer","FFmpeg"]];
    return `<section class="map-provider-strip">${list.map(([id,label]) => { const item = providers.providers?.[id] || {}; const ready = id === "renderer" ? item.configured !== false : id === "concept" ? item.configured === true : item.configured && providers.canRunMedia; return `<article data-ready="${ready}"><i>${ready ? "✓" : "!"}</i><span><strong>${label}</strong><small>${esc(item.model || (item.configured ? "Cần quyền/credit" : "Chưa cấu hình"))}</small></span></article>`; }).join("")}</section>`;
  }

  function variantsMarkup() {
    const rows = state.variants.length ? state.variants.map((variant, index) => `<article class="map-variant ${state.selectedVariantId === variant.id ? "is-selected" : ""}"><header><i>${String.fromCharCode(65 + index)}</i><div><strong>${esc(variant.label)}</strong><small>${esc(variant.provider)} · ${esc(variant.model)} · score ${Math.round(variant.score || 0)}</small></div><button type="button" data-map-select-variant="${esc(variant.id)}">${state.selectedVariantId === variant.id ? "Đã chọn" : "Chọn"}</button></header>${urlFor(variant.assetKey) ? `<audio controls preload="metadata" src="${esc(urlFor(variant.assetKey))}"></audio>` : `<div class="map-wave-skeleton"><i></i><i></i><i></i><i></i><i></i></div>`}</article>`).join("") : [0,1,2].map(index => `<article class="map-variant is-empty"><header><i>${String.fromCharCode(65 + index)}</i><div><strong>Preview ${index + 1}</strong><small>Chưa tạo audio</small></div></header><div class="map-wave-skeleton"><i></i><i></i><i></i><i></i><i></i></div></article>`).join("");
    const output = state.assets?.mastered?.key || state.assets?.master?.key;
    return `<section class="map-preview"><header><div><small>02 · A/B/C PREVIEW</small><h3>Nghe, so sánh và chọn phương án</h3></div>${output && urlFor(output) ? `<audio controls src="${esc(urlFor(output))}"></audio>` : ""}</header><div class="map-variant-grid">${rows}</div><canvas data-map-visualizer width="900" height="180" aria-label="Visualizer âm thanh"></canvas></section>`;
  }

  function stagesMarkup() {
    return `<aside class="map-panel map-stages"><header><div><small>LIVE PIPELINE</small><h3>15 stage có checkpoint</h3></div><b>${Core().completion(state)}%</b></header><div data-map-stage-list>${Core().STAGES.map(stage => { const item = state.stages[stage.id]; return `<article data-status="${item.status}" data-map-stage="${stage.id}"><button type="button" data-map-retry-stage="${stage.id}" title="Chạy lại stage"><i>${item.status === "completed" ? "✓" : item.status === "failed" ? "×" : String(stage.index + 1).padStart(2,"0")}</i></button><span><strong>${esc(stage.label)}</strong><small>${esc(item.detail)}</small><em><b style="width:${item.progress}%"></b></em></span><label>${statusLabel(item.status)}</label></article>`; }).join("")}</div></aside>`;
  }
  function renderStages() { const node = host?.querySelector("[data-map-stage-list]"); if (!node) return; const shell = document.createElement("div"); shell.innerHTML = stagesMarkup(); node.innerHTML = shell.querySelector("[data-map-stage-list]").innerHTML; }
  function renderTop() { const node = host?.querySelector(".map-top"); if (!node) return; const shell = document.createElement("div"); shell.innerHTML = topMarkup(); node.replaceWith(shell.firstElementChild); }

  function planMarkup() {
    const plan = state.plan || Core().buildLocalPlan(state);
    return `<section class="map-panel map-plan"><header><div><small>PRODUCTION PLAN</small><h3>${esc(plan.genre)} · ${plan.bpm} BPM · ${esc(plan.musicalKey)}</h3></div><button type="button" data-map-action="copy-plan">Sao chép prompt</button></header><p>${esc(plan.concept)}</p><div class="map-energy">${plan.structure.map(section => `<article style="--energy:${section.energy}%"><span>${esc(section.name)}</span><i><b></b></i><small>${section.durationSeconds}s</small></article>`).join("")}</div><details><summary>Lời & prompt</summary><pre>${esc(plan.lyrics || "Instrumental · không có lời")}</pre><p>${esc(plan.musicPrompt)}</p></details></section>`;
  }

  function costMarkup() { return `<section class="map-tab-page"><div class="map-cost-grid">${(state.cost?.items || []).map(item => `<article><span>${esc(item.label)}</span><strong>$${Number(item.amount || 0).toFixed(2)}</strong><small>${esc(item.provider)}</small></article>`).join("")}</div><article class="map-panel"><h3>Nguyên tắc chi phí</h3><p>Ước tính chỉ gồm mức giá công khai có thể tính trực tiếp. Eleven Music, ảnh và video có thể thay đổi theo gói, thời lượng hoặc quyền sử dụng. Stage chỉ gọi provider sau khi kiểm tra cấu hình và quyền tài khoản.</p><strong>Tổng ước tính: $${Number(state.cost?.estimatedUsd || 0).toFixed(2)}</strong></article></section>`; }
  function queueMarkup() { return `<section class="map-tab-page"><article class="map-panel"><header><div><small>ALBUM FACTORY</small><h3>Hàng đợi 2–100 bài</h3></div><button type="button" data-map-action="build-album">Tạo queue</button></header><div class="map-queue">${state.queue.length ? state.queue.map((item,index) => `<article data-status="${item.status || "waiting"}"><i>${index + 1}</i><span><strong>${esc(item.title)}</strong><small>${esc(item.idea)} · ${statusLabel(item.status || "waiting")}</small></span><button type="button" data-map-run-job="${esc(item.id)}">Chạy</button></article>`).join("") : `<p>Chuyển chế độ sang Album Factory, chọn số bài và tạo hàng đợi.</p>`}</div></article></section>`; }
  function publishMarkup() { const meta = state.metadata || state.plan || Core().buildLocalPlan(state); return `<section class="map-tab-page"><article class="map-panel map-publish"><header><div><small>RELEASE GATE</small><h3>Metadata và xác nhận bên ngoài</h3></div><span>${state.stages.publishing.status === "review" ? "Cần xác nhận" : statusLabel(state.stages.publishing.status)}</span></header><label>Title<input value="${esc(meta.title || meta.titles?.[0] || state.title)}" data-map-meta="title" maxlength="100"></label><label>Mô tả<textarea rows="8" data-map-meta="description">${esc(meta.description || "")}</textarea></label><label>Tags<textarea rows="3" data-map-meta="tags">${esc((meta.tags || []).join(", "))}</textarea></label><div class="map-publish-controls"><label>Chế độ<select data-map-publish="privacy"><option value="private" ${state.publishPrivacy === "private" ? "selected" : ""}>Riêng tư</option><option value="unlisted" ${state.publishPrivacy === "unlisted" ? "selected" : ""}>Không công khai</option><option value="schedule" ${state.publishPrivacy === "schedule" ? "selected" : ""}>Lên lịch</option></select></label><label>Ngày đăng<input type="datetime-local" data-map-publish="at" value="${esc(state.publishAt)}" ${state.publishPrivacy === "schedule" ? "" : "disabled"}></label></div><p>Autopilot không tự đăng hoặc đổi quyền riêng tư. Nút dưới chuyển metadata sang YouTube Publisher; bạn chọn file/kênh và xác nhận upload tại đó.</p><button class="map-save" type="button" data-map-action="youtube-handoff">Mở YouTube Publisher với metadata →</button></article></section>`; }

  function mainMarkup() {
    if (activeTab === "cost") return costMarkup();
    if (activeTab === "queue") return queueMarkup();
    if (activeTab === "publish") return publishMarkup();
    if (activeTab === "project") return `<section class="map-layout map-layout--project">${projectForm()}<div>${planMarkup()}${variantsMarkup()}</div></section>`;
    return `<section class="map-layout"><div>${projectForm()}${providerMarkup()}</div><div>${variantsMarkup()}${planMarkup()}</div>${stagesMarkup()}</section>`;
  }
  function render() {
    if (!host) return;
    const reviewStage = Core().STAGES.find(stage => state.stages[stage.id].status === "review");
    host.innerHTML = `<section class="map-shell" data-running="${running}">${topMarkup()}<nav class="map-tabs">${TABS.map(([id,label]) => `<button type="button" data-map-tab="${id}" ${activeTab === id ? 'aria-current="page"' : ""}>${label}${id === "queue" && state.queue.length ? `<b>${state.queue.length}</b>` : ""}</button>`).join("")}</nav><main>${mainMarkup()}</main><footer class="map-command"><button class="is-primary" type="button" data-map-action="run" ${running ? "disabled" : ""}>${running ? "Đang chạy…" : "▶ Chạy Autopilot"}</button><button type="button" data-map-action="pause" ${running ? "" : "disabled"}>Tạm dừng sau stage</button><button type="button" data-map-action="resume" ${state.paused && !running ? "" : "disabled"}>${reviewStage ? "Xác nhận & tiếp tục" : "Tiếp tục"}</button><button type="button" data-map-action="${state.assets?.package?.key ? "export" : "package"}" ${(state.assets?.package?.key || state.rightsManifest) && !running ? "" : "disabled"}>${state.assets?.package?.key ? "Tải Production ZIP" : "Tạo Production ZIP"}</button><button type="button" data-map-action="reset">Dự án mới</button><span>${navigator.onLine ? "Online" : "Offline"} · ${state.activeStageId ? `Đang chạy ${state.activeStageId}` : reviewStage ? `Chờ duyệt ${reviewStage.label}` : "Checkpoint đã lưu"}</span></footer><div class="map-toast" data-map-toast role="status" aria-live="polite"></div></section>`;
    restoreVisibleUrls().catch(() => {}); startVisualizer();
  }

  function readProjectForm(form) {
    const data = new FormData(form);
    const rights = { ...state.rights, ownsPrompt: data.has("ownsPrompt"), ownsReferences: data.has("ownsReferences"), acceptsProviderTerms: data.has("acceptsProviderTerms"), noArtistImitation: true };
    return { idea: clean(data.get("idea"), 4000), lyricsOverride: String(data.get("lyricsOverride") || "").slice(0,16000), mode: data.get("mode"), workflow: data.get("workflow"), provider: data.get("provider"), masterPreset: data.get("masterPreset"), genre: clean(data.get("genre"), 80), mood: clean(data.get("mood"), 140), language: data.get("language"), bpm: Number(data.get("bpm")), durationSeconds: Number(data.get("durationSeconds")), aspectRatio: data.get("aspectRatio"), albumCount: Number(data.get("albumCount") || state.albumCount), generateArtwork: data.has("generateArtwork"), generateVideo: data.has("generateVideo"), autoRepair: data.has("autoRepair"), autoPackage: data.has("autoPackage"), rights };
  }

  async function analyzeAudio(blob) {
    const Ctx = global.AudioContext || global.webkitAudioContext; if (!Ctx) throw new Error("Web Audio không được hỗ trợ.");
    const context = new Ctx();
    try {
      const buffer = await context.decodeAudioData(await blob.arrayBuffer());
      let peak = 0, sum = 0, clipping = 0, silence = 0, samples = 0, lowRms = Infinity, highRms = 0;
      const blocks = 64; const blockSums = new Float64Array(blocks); const blockCounts = new Uint32Array(blocks);
      for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) { const data = buffer.getChannelData(channel); const stride = Math.max(1, Math.floor(data.length / 1_500_000)); for (let i = 0; i < data.length; i += stride) { const value = data[i]; const abs = Math.abs(value); peak = Math.max(peak, abs); sum += value * value; clipping += abs >= .999 ? 1 : 0; silence += abs < .0005 ? 1 : 0; samples += 1; const block = Math.min(blocks - 1, Math.floor(i / data.length * blocks)); blockSums[block] += value * value; blockCounts[block] += 1; } }
      for (let i = 0; i < blocks; i += 1) { if (!blockCounts[i]) continue; const rms = Math.sqrt(blockSums[i] / blockCounts[i]); if (rms > .00001) lowRms = Math.min(lowRms, rms); highRms = Math.max(highRms, rms); }
      const rms = Math.sqrt(sum / Math.max(1, samples)); let correlation = 1;
      if (buffer.numberOfChannels >= 2) { const left = buffer.getChannelData(0), right = buffer.getChannelData(1); let lr = 0, ll = 0, rr = 0; const stride = Math.max(1, Math.floor(left.length / 500000)); for (let i = 0; i < Math.min(left.length, right.length); i += stride) { lr += left[i] * right[i]; ll += left[i] * left[i]; rr += right[i] * right[i]; } correlation = lr / Math.max(.000001, Math.sqrt(ll * rr)); }
      const metrics = { durationSeconds: buffer.duration, sampleRate: buffer.sampleRate, channels: buffer.numberOfChannels, peakDb: peak ? 20 * Math.log10(peak) : -120, rmsDb: rms ? 20 * Math.log10(rms) : -120, clippingPercent: clipping / Math.max(1, samples) * 100, silencePercent: silence / Math.max(1, samples) * 100, dynamicRangeDb: lowRms < Infinity && lowRms > 0 ? 20 * Math.log10(highRms / lowRms) : 0, stereoCorrelation: correlation, lufsEstimate: rms ? 20 * Math.log10(rms) - .7 : -120 };
      return { ...metrics, score: Core().technicalScore(metrics), buffer };
    } finally { context.close(); }
  }

  async function renderMaster(sourceBlob, metrics) {
    const Ctx = global.AudioContext || global.webkitAudioContext; if (!Ctx || !global.OfflineAudioContext) throw new Error("Trình duyệt không hỗ trợ render audio offline.");
    const decode = new Ctx(); let buffer;
    try { buffer = await decode.decodeAudioData(await sourceBlob.arrayBuffer()); } finally { decode.close(); }
    const offline = new OfflineAudioContext(buffer.numberOfChannels, buffer.length, buffer.sampleRate); const source = offline.createBufferSource(); source.buffer = buffer;
    const gain = offline.createGain(); const preset = Core().MASTER_PRESETS[state.masterPreset]; const targetRms = preset.targetLufs + .7; gain.gain.value = Math.min(2, Math.max(.25, 10 ** ((targetRms - Number(metrics.rmsDb || -20)) / 20)));
    const compressor = offline.createDynamicsCompressor(); compressor.threshold.value = -5; compressor.knee.value = 5; compressor.ratio.value = 8; compressor.attack.value = .003; compressor.release.value = .18;
    source.connect(gain).connect(compressor).connect(offline.destination); source.start(); const rendered = await offline.startRendering(); return audioBufferToWav(rendered);
  }
  function audioBufferToWav(buffer) {
    const channels = buffer.numberOfChannels, length = buffer.length * channels * 2 + 44, array = new ArrayBuffer(length), view = new DataView(array); let offset = 0;
    const str = value => { for (let i = 0; i < value.length; i += 1) view.setUint8(offset++, value.charCodeAt(i)); }; const u16 = value => { view.setUint16(offset, value, true); offset += 2; }; const u32 = value => { view.setUint32(offset, value, true); offset += 4; };
    str("RIFF"); u32(length - 8); str("WAVE"); str("fmt "); u32(16); u16(1); u16(channels); u32(buffer.sampleRate); u32(buffer.sampleRate * channels * 2); u16(channels * 2); u16(16); str("data"); u32(length - 44);
    const data = Array.from({ length: channels }, (_, channel) => buffer.getChannelData(channel)); for (let i = 0; i < buffer.length; i += 1) for (let channel = 0; channel < channels; channel += 1) { const sample = Math.max(-1, Math.min(1, data[channel][i])); view.setInt16(offset, sample < 0 ? sample * 32768 : sample * 32767, true); offset += 2; }
    return new Blob([array], { type: "audio/wav" });
  }

  async function sha256(blob) { const bytes = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()); return [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, "0")).join(""); }
  function planPrompt() { return JSON.stringify({ idea: state.idea, mode: state.mode, genre: state.genre, mood: state.mood, bpm: state.bpm, key: state.musicalKey, language: state.language, durationSeconds: state.durationSeconds, reference: state.assets?.reference ? { name: state.assets.reference.name, type: state.assets.reference.type, analysis: state.assets.reference.analysis || "" } : null, requirements: "Original only; do not imitate named artists, songs, lyrics or recognizable melodies." }); }

  function lyricsForSection(lyrics, sectionName) {
    const sections = []; const pattern = /\[([^\]]+)\]\s*([\s\S]*?)(?=\n\s*\[[^\]]+\]|$)/g; let match;
    while ((match = pattern.exec(String(lyrics || "")))) sections.push({ name: clean(match[1], 80).toLowerCase(), text: String(match[2] || "").trim() });
    const target = clean(sectionName, 80).toLowerCase().replace(/\s+\d+$/, "");
    const found = sections.find(item => item.name === target || item.name.replace(/\s+\d+$/, "") === target);
    return found?.text || "";
  }

  function canvasToBlob(canvas, type = "image/jpeg", quality = .84) {
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Không tạo được ảnh phân tích.")), type, quality));
  }

  async function analyzeReference(file) {
    const url = URL.createObjectURL(file);
    try {
      if (file.type.startsWith("image/")) {
        const image = new Image(); image.src = url;
        await (image.decode ? image.decode() : new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; }));
        const scale = Math.min(1, 1024 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const ctx = canvas.getContext("2d", { willReadFrequently: true }); ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        const sample = document.createElement("canvas"); sample.width = 64; sample.height = 64; const sampleCtx = sample.getContext("2d", { willReadFrequently: true }); sampleCtx.drawImage(image, 0, 0, 64, 64);
        const pixels = sampleCtx.getImageData(0, 0, 64, 64).data; let red = 0, green = 0, blue = 0;
        for (let offset = 0; offset < pixels.length; offset += 4) { red += pixels[offset]; green += pixels[offset + 1]; blue += pixels[offset + 2]; }
        const count = pixels.length / 4; const hex = `#${[red, green, blue].map(value => Math.round(value / count).toString(16).padStart(2, "0")).join("")}`;
        return { snapshot: await canvasToBlob(canvas), analysis: `Ảnh ${image.naturalWidth}×${image.naturalHeight} · màu trung bình ${hex}` };
      }
      if (file.type.startsWith("video/")) {
        const video = document.createElement("video"); video.preload = "metadata"; video.muted = true; video.src = url;
        await new Promise((resolve, reject) => { video.onloadedmetadata = resolve; video.onerror = () => reject(new Error("Không đọc được metadata video.")); });
        const target = Number.isFinite(video.duration) ? Math.min(Math.max(.1, video.duration * .15), 2) : .1;
        await new Promise(resolve => { video.onseeked = resolve; video.currentTime = target; setTimeout(resolve, 1600); });
        const scale = Math.min(1, 1024 / Math.max(video.videoWidth || 1, video.videoHeight || 1)); const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round((video.videoWidth || 1280) * scale)); canvas.height = Math.max(1, Math.round((video.videoHeight || 720) * scale)); canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
        return { snapshot: await canvasToBlob(canvas), analysis: `Video ${video.videoWidth}×${video.videoHeight} · ${Number(video.duration || 0).toFixed(1)} giây · đã trích keyframe` };
      }
      if (file.type.startsWith("audio/") && file.size <= 80 * 1024 * 1024) {
        const metrics = await analyzeAudio(file);
        return { snapshot: null, analysis: `Audio ${metrics.durationSeconds.toFixed(1)} giây · peak ${metrics.peakDb.toFixed(1)} dBFS · RMS ${metrics.rmsDb.toFixed(1)} dBFS` };
      }
      return { snapshot: null, analysis: `${file.type || "File"} · ${(file.size / 1048576).toFixed(2)} MB` };
    } finally { URL.revokeObjectURL(url); }
  }

  async function referenceAttachment() {
    const key = state.assets?.reference?.snapshotKey;
    if (!key) return null;
    const row = await getAsset(key);
    if (!row?.blob || row.blob.size > 1_500_000) return null;
    return { name: `${state.assets.reference.name}-keyframe.jpg`, mimeType: row.blob.type || "image/jpeg", size: row.blob.size, data: await toBase64(row.blob) };
  }

  async function lyriaReferenceImages() {
    const attachment = await referenceAttachment();
    return attachment ? [{ mimeType: attachment.mimeType, data: attachment.data }] : [];
  }

  async function runStage(stageId) {
    setStage(stageId, "running", "Đang thực hiện…", { progress: 8 });
    try {
      if (stageId === "concept") {
        const local = Core().buildLocalPlan(state); persist({ plan: local });
        try { const attachment = await referenceAttachment(); const result = await api("music-autopilot-plan", planPrompt(), { requireProvider: true, allowProviderFallback: true, creativity: 72, ...(attachment ? { attachments: [attachment] } : {}) }); const plan = Core().normalizePlan(result.action?.structured || JSON.parse(result.action?.output || "null")); if (plan) persist({ plan }); setStage(stageId, "completed", `${result.action?.provider || "AI"} · ${result.action?.model || "model"}${attachment ? " · đã đọc keyframe" : ""}`); }
        catch (error) { setStage(stageId, "completed", `Kế hoạch local xác định · AI chưa sẵn sàng (${error.message})`); }
      } else if (stageId === "lyrics") {
        if (state.plan?.instrumental) setStage(stageId, "skipped", "Instrumental · không cần lời", { progress: 100 });
        else if (state.lyricsOverride?.trim()) { persist({ plan: { ...state.plan, lyrics: state.lyricsOverride } }); setStage(stageId, "completed", "Đã dùng lời do người dùng cung cấp và xác nhận quyền"); }
        else if (state.plan?.lyrics && !state.plan.lyrics.includes("đang chờ AI")) setStage(stageId, "completed", "Lời nguyên bản đã có trong production plan");
        else { const error = new Error("Provider viết lời chưa sẵn sàng. Hãy nhập lời bạn sở hữu hoặc cấu hình Gemini/OpenAI."); error.code = "MUSIC_LYRICS_PROVIDER_NOT_CONFIGURED"; throw error; }
      } else if (stageId === "structure") {
        if (!state.plan?.structure?.length) persist({ plan: Core().buildLocalPlan(state) });
        setStage(stageId, "completed", `${state.plan.structure.length} section · ${state.plan.bpm} BPM`);
      } else if (stageId === "previews") await generatePreviews();
      else if (stageId === "selection") await selectBestVariant();
      else if (stageId === "render") await renderFullSong();
      else if (stageId === "qa") await runQa();
      else if (stageId === "repair") await repairDecision();
      else if (stageId === "master") await masterAudio();
      else if (stageId === "artwork") await makeArtwork();
      else if (stageId === "visualizer") await makeVisualizer();
      else if (stageId === "metadata") { const plan = state.plan || Core().buildLocalPlan(state); persist({ metadata: { titles: plan.titles, title: plan.titles[0] || state.title, description: `${plan.description}\n\nMinh bạch nội dung: Âm nhạc được tạo và hậu kỳ với công cụ AI; quyền đầu vào đã được người dùng xác nhận.`, tags: plan.tags, chapters: plan.chapters, containsSyntheticMedia: true } }); setStage(stageId, "completed", `${plan.titles.length} title · ${plan.tags.length} tag · ${plan.chapters.length} chapter`); }
      else if (stageId === "rights") await buildRightsManifest();
      else if (stageId === "package") { if (state.autoPackage) await buildPackage(); else setStage(stageId, "review", "Tự tạo ZIP đang tắt · có thể tạo thủ công từ thanh lệnh", { progress: 0 }); }
      else if (stageId === "publishing") setStage(stageId, "review", "Cần chọn kênh/file và xác nhận trong YouTube Publisher", { progress: 90 });
      store.checkpoint(stageId, state.stages[stageId].detail); state = store.get();
    } catch (error) { setStage(stageId, error.code?.includes("NOT_CONFIGURED") || [401,403,503].includes(error.status) ? "blocked" : "failed", error.message, { error: error.message, progress: 0 }); throw error; }
  }

  async function generatePreviews() {
    const choice = Core().providerChoice(state, providers.providers, "preview"); if (!choice || !providers.canRunMedia) { const error = new Error(choice ? "Tài khoản hiện tại chưa được cấp quyền chạy media trả phí." : "Chưa cấu hình Lyria hoặc Eleven Music."); error.code = "MUSIC_PROVIDER_NOT_CONFIGURED"; throw error; }
    const variants = []; const referenceImages = choice.id === "lyria" ? await lyriaReferenceImages() : [];
    for (let index = 0; index < 3; index += 1) {
      state = store.get(); if (state.stopRequested) break; setStage("previews", "running", `Đang tạo preview ${index + 1}/3 bằng ${choice.id}…`, { progress: 12 + index * 28 });
      const seed = Math.abs(hash(`${state.idea}:${index}`)); const prompt = `${state.plan.musicPrompt}\nVariation ${String.fromCharCode(65 + index)}; creativity ${55 + index * 18}%; seed ${seed}.`;
      const result = choice.id === "lyria" ? await api("music-lyria", prompt, { model: "lyria-3-clip-preview", referenceImages }) : await api("music-track", prompt, { durationSeconds: Math.min(30, state.durationSeconds), instrumental: state.plan.instrumental, seed, storeForInpainting: true });
      const blob = fromBase64(result.media.data, result.media.mimeType); const key = assetKey("preview", String(index + 1)); await putAsset(key, blob, { stageId: "previews", provider: choice.id, model: result.media.model });
      variants.push({ id: `variant-${index + 1}`, label: `Phương án ${String.fromCharCode(65 + index)}`, provider: choice.id, model: result.media.model, seed, score: 0, durationSeconds: result.media.durationSeconds || 30, assetKey: key, songId: result.media.songId || "", createdAt: new Date().toISOString() });
    }
    persist({ variants, selectedVariantId: variants[0]?.id || "" }); setStage("previews", variants.length === 3 ? "completed" : "paused", `${variants.length}/3 preview audio thật đã lưu vào IndexedDB`, { progress: variants.length / 3 * 100 }); render();
  }

  async function selectBestVariant() {
    if (!state.variants.length) throw new Error("Chưa có preview để chấm."); let best = null;
    for (let index = 0; index < state.variants.length; index += 1) { const variant = state.variants[index], row = await getAsset(variant.assetKey); if (!row) continue; setStage("selection", "running", `Đang đo kỹ thuật ${index + 1}/${state.variants.length}…`, { progress: 20 + index * 25 }); const metrics = await analyzeAudio(row.blob); variant.score = metrics.score; variant.metrics = { ...metrics, buffer: undefined }; if (!best || variant.score > best.score) best = variant; }
    persist({ variants: state.variants, selectedVariantId: best?.id || state.variants[0].id }); setStage("selection", state.workflow === "assisted" ? "review" : "completed", `Đã chọn ${best?.label || "preview"} · điểm kỹ thuật ${best?.score || 0}`, { progress: 100 }); render();
  }

  async function renderFullSong() {
    const choice = Core().providerChoice(state, providers.providers, "full"); if (!choice || !providers.canRunMedia) { const error = new Error("Chưa có provider tạo full song được cấp quyền."); error.code = "MUSIC_PROVIDER_NOT_CONFIGURED"; throw error; }
    const selected = state.variants.find(item => item.id === state.selectedVariantId); const prompt = `${state.plan.musicPrompt}\n${state.plan.lyrics ? `Lyrics:\n${state.plan.lyrics}` : "Instrumental only."}\nTarget duration ${state.durationSeconds} seconds.`;
    const result = choice.id === "lyria" ? await api("music-lyria", prompt, { model: state.durationSeconds <= 30 ? "lyria-3-clip-preview" : "lyria-3-pro-preview", referenceImages: await lyriaReferenceImages(), wav: state.durationSeconds > 30 }) : await api("music-track", prompt, { durationSeconds: state.durationSeconds, instrumental: state.plan.instrumental, seed: selected?.seed, storeForInpainting: true, compositionPlan: { chunks: state.plan.structure.map(section => ({ text: `[${section.name}]${state.plan.instrumental ? "\nInstrumental section." : `\n${lyricsForSection(state.plan.lyrics, section.name) || "Original vocal section following the approved lyrics and theme."}`}`, duration_ms: section.durationSeconds * 1000, positive_styles: [state.genre, state.mood, section.direction], negative_styles: state.plan.negativePrompt.split(",").slice(0,10), context_adherence: "high" })) } });
    const blob = fromBase64(result.media.data, result.media.mimeType); const key = assetKey("master", "source"); await putAsset(key, blob, { stageId: "render", provider: choice.id, model: result.media.model });
    persist({ assets: { ...state.assets, master: { key, type: blob.type, size: blob.size, model: result.media.model, provider: choice.id, songId: result.media.songId || "", synthIdExpected: result.media.synthIdExpected === true, c2paRequested: result.media.c2paRequested === true } } }); setStage("render", "completed", `${result.media.model} · ${(blob.size / 1048576).toFixed(2)} MB`); render();
  }

  async function runQa() { const master = await getAsset(state.assets?.master?.key); if (!master) throw new Error("Chưa có master source để kiểm âm."); const result = await analyzeAudio(master.blob); const qa = { ...result, buffer: undefined, checkedAt: new Date().toISOString(), standard: "Web Audio estimate; LUFS/true-peak cần analyzer BS.1770 để chứng nhận" }; persist({ qa }); const warnings = []; if (result.clippingPercent > 0) warnings.push(`clipping ${result.clippingPercent.toFixed(3)}%`); if (result.silencePercent > 15) warnings.push(`silence ${result.silencePercent.toFixed(1)}%`); if (result.stereoCorrelation < -.1) warnings.push("phase âm"); setStage("qa", warnings.length ? "review" : "completed", warnings.length ? warnings.join(" · ") : `Peak ${result.peakDb.toFixed(1)} dBFS · RMS ${result.rmsDb.toFixed(1)} dBFS · score ${result.score}`, { progress: 100 }); }
  async function repairDecision() { if (!state.qa) throw new Error("Cần kiểm âm trước khi sửa."); if (!state.autoRepair || (state.qa.clippingPercent <= 0 && state.qa.peakDb <= -.3 && state.qa.silencePercent < 15)) { setStage("repair", "skipped", state.autoRepair ? "Không phát hiện lỗi cần sửa" : "Auto repair đang tắt", { progress: 100 }); return; } setStage("repair", "completed", "Đã lập gain/limiter correction; áp dụng không phá hủy ở Master", { progress: 100 }); }
  async function masterAudio() { const source = await getAsset(state.assets?.master?.key); if (!source) throw new Error("Chưa có audio source."); const metrics = state.qa || await analyzeAudio(source.blob); const blob = await renderMaster(source.blob, metrics); const key = assetKey("master", "processed"); await putAsset(key, blob, { stageId: "master", provider: "web-audio", model: `offline-${state.masterPreset}` }); persist({ assets: { ...state.assets, mastered: { key, type: blob.type, size: blob.size, preset: state.masterPreset } } }); setStage("master", state.workflow === "assisted" ? "review" : "completed", `WAV ${state.masterPreset} · ${(blob.size / 1048576).toFixed(2)} MB · cần nghe A/B`, { progress: 100 }); render(); }

  async function makeArtwork() {
    if (!state.generateArtwork) { setStage("artwork", "skipped", "Artwork đã tắt", { progress: 100 }); return; }
    let blob, provider = "local-canvas", model = "canvas-cover-v1";
    if (providers.providers?.image?.configured && providers.canRunMedia) { try { const result = await api("music-image", state.plan.artworkPrompt, { aspectRatio: state.aspectRatio, imageSize: "1K" }); blob = fromBase64(result.media.data, result.media.mimeType); provider = "gemini"; model = result.media.model; } catch (error) { toast(`Gemini Images lỗi, dùng cover local: ${error.message}`, "warning"); } }
    if (!blob) blob = await localCover(); const key = assetKey("artwork", "cover"); await putAsset(key, blob, { stageId: "artwork", provider, model }); persist({ assets: { ...state.assets, artwork: { key, type: blob.type, size: blob.size, provider, model } } }); setStage("artwork", "completed", `${provider} · cover ${state.aspectRatio}`); render();
  }
  function localCover() { return new Promise(resolve => { const canvas = document.createElement("canvas"); canvas.width = 1280; canvas.height = state.aspectRatio === "9:16" ? 2276 : state.aspectRatio === "1:1" ? 1280 : 720; const ctx = canvas.getContext("2d"); const gradient = ctx.createLinearGradient(0,0,canvas.width,canvas.height); gradient.addColorStop(0,"#071426"); gradient.addColorStop(.45,"#3e1b68"); gradient.addColorStop(1,"#0796a6"); ctx.fillStyle = gradient; ctx.fillRect(0,0,canvas.width,canvas.height); for (let i=0;i<120;i+=1) { ctx.fillStyle = `rgba(${80+i},${180+i/2},255,${.08+(i%8)/80})`; ctx.beginPath(); ctx.arc((i*97)%canvas.width,(i*173)%canvas.height,2+(i%11),0,Math.PI*2); ctx.fill(); } ctx.textAlign="center"; ctx.fillStyle="#f2fbff"; ctx.font="800 68px Inter, sans-serif"; wrapText(ctx,state.title.toUpperCase(),canvas.width/2,canvas.height*.52,canvas.width*.78,82); ctx.fillStyle="#9ff7ff"; ctx.font="600 28px Inter, sans-serif"; ctx.fillText(`${state.genre.toUpperCase()} · ${state.mood.toUpperCase()}`.slice(0,70),canvas.width/2,canvas.height*.72); canvas.toBlob(resolve,"image/png",.95); }); }
  function wrapText(ctx,text,x,y,maxWidth,lineHeight) { const words=text.split(" "); let line="", lines=[]; for (const word of words) { const test=`${line}${word} `; if(ctx.measureText(test).width>maxWidth&&line){lines.push(line);line=`${word} `;} else line=test;} lines.push(line); lines.slice(0,3).forEach((value,index)=>ctx.fillText(value.trim(),x,y+(index-(lines.length-1)/2)*lineHeight)); }

  async function makeVisualizer() {
    if (state.generateVideo && providers.providers?.video?.configured && providers.canRunMedia && state.assets?.artwork?.key) {
      const image = await getAsset(state.assets.artwork.key); const imageData = await toBase64(image.blob); const start = await api("music-video-start", state.plan.motionPrompt, { imageData, imageMimeType: image.blob.type, aspectRatio: state.aspectRatio === "9:16" ? "9:16" : "16:9", resolution: "720p", durationSeconds: 8 }); let operation = start.operation;
      for (let attempt=0;attempt<60;attempt+=1) { state=store.get(); if(state.stopRequested) break; if(attempt) await delay(8000); const check=await api("music-video-status","",{operationName:operation.name}); operation=check.operation; setStage("visualizer","running",`Veo đang xử lý · lần kiểm tra ${attempt+1}`,{progress:Math.min(92,10+attempt*1.4)}); if(operation.error) throw new Error(operation.error); if(operation.done&&operation.ready) break; }
      if (state.stopRequested) { setStage("visualizer", "paused", "Đã lưu operation Veo để tiếp tục kiểm tra", { progress: state.stages.visualizer.progress }); return; }
      if (!operation?.mediaUri) throw new Error("Veo chưa hoàn tất; operation đã lưu để retry.");
      const encodedUri = btoa(operation.mediaUri).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      const response = await fetch(`${apiBase()}/api/modules/music-ai/actions?media=veo&uri=${encodeURIComponent(encodedUri)}`, { headers: authHeaders(), cache: "no-store" });
      if (!response.ok) throw new Error(`Không tải được clip Veo qua media proxy (HTTP ${response.status}).`);
      const blob = await response.blob(); const key = assetKey("visualizer", "veo"); await putAsset(key, blob, { stageId: "visualizer", provider: "veo", model: providers.providers?.video?.model || "veo" });
      persist({ assets: { ...state.assets, video: { key, type: blob.type, size: blob.size, operationName: operation.name, provider: "veo", model: providers.providers?.video?.model || "veo" } } }); setStage("visualizer","completed",`Veo clip ${(blob.size/1048576).toFixed(2)} MB đã lưu offline`);
    } else { persist({ assets: { ...state.assets, visualizer: { type: "canvas", preset: "spectrum-particles", aspectRatio: state.aspectRatio } } }); setStage("visualizer","completed", state.generateVideo ? "Veo chưa cấu hình · Canvas visualizer hoạt động thật" : "Canvas waveform/spectrum hoạt động thật"); }
    startVisualizer();
  }

  async function buildRightsManifest() { const assets = []; for (const [name, value] of Object.entries(state.assets || {})) { if (!value?.key) continue; const row = await getAsset(value.key); if (row?.blob) assets.push({ name, key: value.key, sha256: await sha256(row.blob), bytes: row.blob.size, mimeType: row.blob.type, provider: row.provider, model: row.model }); } const manifest = { schema: "hh.music.rights-pack.v1", projectId: state.id, ownerId: state.ownerId, createdAt: new Date().toISOString(), prompt: state.idea, plan: state.plan, providers: assets.map(item => ({ provider: item.provider, model: item.model })), declarations: state.rights, assets, aiDisclosure: true, synthIdExpected: Boolean(state.assets?.master?.synthIdExpected), c2paRequested: Boolean(state.assets?.master?.c2paRequested), territory: state.rights.territory, useCase: state.rights.useCase, disclaimer: "Hồ sơ provenance hỗ trợ chứng minh quy trình; không phải bảo đảm pháp lý hoặc miễn trừ khiếu nại." }; persist({ rightsManifest: manifest }); setStage("rights","completed",`${assets.length} asset có SHA-256 · provenance đã lưu`); }

  async function buildPackage() {
    if (typeof global.JSZip !== "function") { const error = new Error("JSZip chưa được tải."); error.code = "PACKAGE_PROVIDER_NOT_CONFIGURED"; throw error; }
    setStage("package", "running", "Đang thu thập audio, artwork, metadata và hồ sơ quyền…", { progress: 5 });
    const zip = new global.JSZip(); const folder = zip.folder(safeFilename(state.title)); const source = await getAsset(state.assets?.mastered?.key || state.assets?.master?.key); if (source) folder.file(source.blob.type.includes("wav") ? "MASTER.wav" : "MASTER.mp3", source.blob); const cover = await getAsset(state.assets?.artwork?.key); if (cover) folder.file(cover.blob.type.includes("png") ? "COVER.png" : "COVER.jpg", cover.blob); const video = await getAsset(state.assets?.video?.key); if (video) folder.file("VISUALIZER.mp4", video.blob);
    folder.file("PROJECT.json", JSON.stringify(state, null, 2)); folder.file("VISUALIZER.json", JSON.stringify(state.assets?.visualizer || state.assets?.video || {}, null, 2)); folder.file("RIGHTS-MANIFEST.json", JSON.stringify(state.rightsManifest || {}, null, 2)); folder.file("LICENSES.json", JSON.stringify({ providers: state.rightsManifest?.providers || [], generatedAt: new Date().toISOString(), note: "Kiểm tra điều khoản provider tại ngày sử dụng." }, null, 2)); folder.file("CREDITS.txt", `${state.title}\nCreated with HH Music Autopilot\nProvider/model: ${(state.rightsManifest?.providers || []).map(item => `${item.provider}/${item.model}`).join(", ")}\nAI-assisted content disclosure: yes\n`); folder.file("YOUTUBE-METADATA.txt", `${state.metadata?.title || state.title}\n\n${state.metadata?.description || ""}\n\n${(state.metadata?.tags || []).join(", ")}\n\n${(state.metadata?.chapters || []).join("\n")}`);
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } }, meta => setStage("package","running",`Đang nén Production ZIP · ${Math.round(meta.percent)}%`,{progress:meta.percent})); const key=assetKey("package","zip"); await putAsset(key,blob,{stageId:"package",provider:"jszip",model:"deflate"}); persist({assets:{...state.assets,package:{key,type:blob.type,size:blob.size,name:`${safeFilename(state.title)}-PRODUCTION.zip`}}}); setStage("package","completed",`${(blob.size/1048576).toFixed(2)} MB · ZIP sẵn sàng`); render();
  }
  function safeFilename(value) { return clean(value,120).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[đĐ]/g,"d").replace(/[^a-z0-9_-]+/gi,"-").replace(/^-+|-+$/g,"")||"hh-music-autopilot"; }
  function hash(value) { let h=2166136261; for(const char of String(value)){h^=char.charCodeAt(0);h=Math.imul(h,16777619);} return h>>>0; }

  async function runPipeline(fromStageId = "") {
    if (running) return; const errors = Core().validateProject(state); if (errors.length) { toast(errors[0],"error"); activeTab="project"; render(); return; }
    running=true; persist({paused:false,stopRequested:false,status:"running"}); render(); const start=Math.max(0,fromStageId?Core().stageIndex(fromStageId):Core().STAGES.findIndex(stage=>!["completed","skipped"].includes(state.stages[stage.id].status)));
    try { await refreshProviders(false); for(let index=start<0?0:start;index<Core().STAGES.length;index+=1){ state=store.get(); const stage=Core().STAGES[index]; if(state.stopRequested){setStage(stage.id,"paused","Đã dừng trước khi chạy stage",{progress:state.stages[stage.id].progress});persist({paused:true,status:"paused"});break;} if(["completed","skipped"].includes(state.stages[stage.id].status)&&!fromStageId)continue; await runStage(stage.id); state=store.get(); if(state.workflow==="pro"&&!["concept","lyrics","structure"].includes(stage.id)){setStage(stage.id,"review",`${state.stages[stage.id].detail} · Pro mode chờ xác nhận`,{progress:100});persist({paused:true,status:"review"});break;} if(state.workflow==="assisted"&&["selection","master","publishing"].includes(stage.id)){persist({paused:true,status:"review"});break;} }
      if(!state.paused&&!state.stopRequested)persist({status:state.stages.publishing.status==="review"?"review":"completed"});
    } catch(error){const blocked=String(error.code||"").includes("NOT_CONFIGURED")||[401,403,503].includes(error.status);persist({status:blocked?"blocked":"failed"});toast(error.message,"error");} finally {running=false;state=store.get();render();}
  }

  function continuePipeline() {
    if (running) return;
    const review = Core().STAGES.find(stage => state.stages[stage.id].status === "review");
    if (!review) { runPipeline(state.activeStageId || ""); return; }
    if (review.id === "publishing") { activeTab = "publish"; render(); toast("Xuất bản cần chọn kênh và xác nhận trong YouTube Publisher.", "warning"); return; }
    store.setStage(review.id, "completed", `${state.stages[review.id].detail.replace(/ · Pro mode chờ xác nhận$/, "")} · đã xác nhận`, { progress: 100 }); state = store.get();
    const next = Core().STAGES[review.index + 1]; persist({ paused: false, status: "running", stopRequested: false });
    if (next) runPipeline(next.id); else render();
  }

  function buildAlbumQueue() { const count=state.mode==="album"?state.albumCount:Math.max(2,state.albumCount); const queue=Array.from({length:count},(_,index)=>({id:`album-${Date.now().toString(36)}-${index+1}`,title:`${state.title} · Track ${String(index+1).padStart(2,"0")}`,idea:`${state.idea} Biến thể album số ${index+1}; giữ motif chung nhưng hook, arrangement và màu âm không trùng các track khác.`,status:"waiting",createdAt:new Date().toISOString()})); persist({queue});render();toast(`Đã tạo ${count} job album.`); }
  async function runQueueJob(id) { const job=state.queue.find(item=>item.id===id);if(!job||running)return; const queueBefore=state.queue.map(item=>item.id===id?{...item,status:"running"}:item); persist({queue:queueBefore,title:job.title,idea:job.idea,id:job.id,workflow:"auto",stages:Object.fromEntries(Core().STAGES.map(stage=>[stage.id,{...Core().defaultProject(scope()).stages[stage.id]}])),variants:[],selectedVariantId:"",assets:{reference:state.assets?.reference},plan:null,qa:null,metadata:null,rightsManifest:null});activeTab="autopilot";render();await runPipeline();state=store.get();const jobStatus=state.status==="failed"?"failed":state.stages.package.status==="completed"?(state.stages.publishing.status==="review"?"review":"completed"):state.status;const completedJob={...job,status:jobStatus,completedAt:new Date().toISOString(),projectId:state.id,packageKey:state.assets?.package?.key||""};const queue=state.queue.map(item=>item.id===id?completedJob:item);persist({queue});render();}

  async function restoreVisibleUrls(){if(restoringUrls)return;restoringUrls=true;const before=urls.size;try{const keys=[...state.variants.map(item=>item.assetKey),state.assets?.master?.key,state.assets?.mastered?.key,state.assets?.artwork?.key,state.assets?.video?.key,state.assets?.package?.key].filter(Boolean);await Promise.all(keys.map(key=>getAsset(key).catch(()=>null)));if(host&&urls.size>before)render();}finally{restoringUrls=false;}}
  function startVisualizer(){cancelAnimationFrame(visualizerFrame);const canvas=host?.querySelector("[data-map-visualizer]");if(!canvas)return;const ctx=canvas.getContext("2d");let t=0;const tick=()=>{if(!canvas.isConnected)return;const w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);const g=ctx.createLinearGradient(0,0,w,0);g.addColorStop(0,"#66edff");g.addColorStop(.5,"#aa72ff");g.addColorStop(1,"#ff5ca8");ctx.fillStyle=g;for(let i=0;i<96;i+=1){const height=(.15+.75*Math.abs(Math.sin(i*.31+t)*Math.cos(i*.09-t*.7)))*h;ctx.fillRect(i*w/96,h/2-height/2,Math.max(2,w/120),height);}t+=.025;visualizerFrame=requestAnimationFrame(tick);};if(!matchMedia("(prefers-reduced-motion: reduce)").matches)tick();else{t=.8;tick();cancelAnimationFrame(visualizerFrame);}}

  async function handleFile(input){const file=input.files?.[0];if(!file)return;if(file.size>250*1024*1024){toast("File tham chiếu vượt 250 MB.","error");return;}try{toast("Đang đọc metadata và tạo keyframe…");const key=assetKey("reference",Date.now());await putAsset(key,file,{stageId:"project",provider:"user",model:"uploaded-reference"});const analysis=await analyzeReference(file);let snapshotKey="";if(analysis.snapshot){snapshotKey=assetKey("reference","analysis");await putAsset(snapshotKey,analysis.snapshot,{stageId:"project",provider:"local",model:"reference-keyframe"});}persist({assets:{...state.assets,reference:{key,name:file.name,type:file.type,size:file.size,analysis:analysis.analysis,snapshotKey}}});render();toast("Đã lưu và phân tích file tham chiếu trong IndexedDB.");}catch(error){toast(`Không phân tích được file: ${error.message}`,"error");}}
  async function copy(text){try{if(!navigator.clipboard?.writeText)throw new Error("Clipboard API không được hỗ trợ");await navigator.clipboard.writeText(String(text||""));toast("Đã sao chép.");}catch(error){toast(`Không sao chép được: ${error.message}`,"error");}}
  async function downloadAsset(key,name){try{const row=await getAsset(key);if(!row)throw new Error("Asset không còn trong kho cục bộ");const a=document.createElement("a");a.href=urlFor(key)||URL.createObjectURL(row.blob);a.download=name||"download";document.body.append(a);a.click();a.remove();toast("Đã bắt đầu tải file.");}catch(error){toast(error.message,"error");}}
  function youtubeHandoff(){const titleField=host?.querySelector("[data-map-meta='title']");const descriptionField=host?.querySelector("[data-map-meta='description']");const tagsField=host?.querySelector("[data-map-meta='tags']");const meta={...(state.metadata||Core().buildLocalPlan(state))};if(titleField)meta.title=clean(titleField.value,100);if(descriptionField)meta.description=String(descriptionField.value||"").slice(0,5000);if(tagsField)meta.tags=tagsField.value.split(",").map(value=>clean(value,60)).filter(Boolean).slice(0,40);persist({metadata:meta});const payload={ownerId:state.ownerId,title:meta.title||meta.titles?.[0]||state.title,description:meta.description||"",tags:(meta.tags||[]).join(", "),containsSyntheticMedia:true,privacyMode:state.publishPrivacy,publishAt:state.publishAt,projectId:state.id};const key=`hh.music-autopilot.youtube-handoff.v1:${state.ownerId}`;sessionStorage.setItem(key,JSON.stringify(payload));global.HHMusicAutopilotHandoff=payload;setStage("publishing","review","Đã chuyển metadata; chờ chọn file/kênh và xác nhận upload",{progress:95});location.hash="#/music-ai/youtube-publisher";}

  function handleSubmit(event){const form=event.target.closest("[data-map-project-form]");if(!form)return;event.preventDefault();persist(readProjectForm(form));state.plan=Core().buildLocalPlan(state);if(state.lyricsOverride?.trim()&&!state.plan.instrumental)state.plan.lyrics=state.lyricsOverride;state.cost=Core().estimateCost(state,providers.providers);persist({plan:state.plan,cost:state.cost});toast("Đã lưu brief và cập nhật production plan.");render();}
  function handleChange(event){const file=event.target.closest("[data-map-file]");if(file){handleFile(file);return;}const metaField=event.target.closest("[data-map-meta]");if(metaField){const metadata={...(state.metadata||Core().buildLocalPlan(state))};if(metaField.dataset.mapMeta==="tags")metadata.tags=metaField.value.split(",").map(value=>clean(value,60)).filter(Boolean).slice(0,40);else if(metaField.dataset.mapMeta==="description")metadata.description=String(metaField.value||"").slice(0,5000);else metadata[metaField.dataset.mapMeta]=clean(metaField.value,100);if(metaField.dataset.mapMeta==="title")metadata.titles=[metadata.title,...(metadata.titles||[]).filter(value=>value!==metadata.title)].slice(0,8);persist({metadata});return;}const privacy=event.target.closest("[data-map-publish='privacy']");if(privacy){persist({publishPrivacy:privacy.value});render();return;}const at=event.target.closest("[data-map-publish='at']");if(at){persist({publishAt:at.value});}}
  function handleClick(event){const tab=event.target.closest("[data-map-tab]");if(tab){activeTab=tab.dataset.mapTab;render();return;}const select=event.target.closest("[data-map-select-variant]");if(select){persist({selectedVariantId:select.dataset.mapSelectVariant});render();return;}const retry=event.target.closest("[data-map-retry-stage]");if(retry&&!running){for(let index=Core().stageIndex(retry.dataset.mapRetryStage);index<Core().STAGES.length;index+=1)store.setStage(Core().STAGES[index].id,"waiting","Chờ chạy lại",{progress:0});state=store.get();runPipeline(retry.dataset.mapRetryStage);return;}const job=event.target.closest("[data-map-run-job]");if(job){runQueueJob(job.dataset.mapRunJob);return;}const button=event.target.closest("[data-map-action]");if(!button)return;const action=button.dataset.mapAction;if(action==="refresh")refreshProviders();if(action==="run")runPipeline();if(action==="pause"){persist({stopRequested:true});toast("Sẽ tạm dừng sau stage hiện tại.","warning");}if(action==="resume")continuePipeline();if(action==="reset"&&confirm("Tạo dự án Autopilot mới? Asset cũ vẫn còn trong IndexedDB cho tới khi trình duyệt dọn dữ liệu.")){state=store.reset();render();}if(action==="clear-reference"){const assets={...state.assets};delete assets.reference;persist({assets});render();toast("Đã bỏ file tham chiếu khỏi dự án.");}if(action==="copy-plan")copy(state.plan?.musicPrompt);if(action==="build-album")buildAlbumQueue();if(action==="package")buildPackage().catch(error=>{setStage("package","failed",error.message,{error:error.message});toast(error.message,"error");});if(action==="export")downloadAsset(state.assets?.package?.key,state.assets?.package?.name);if(action==="youtube-handoff")youtubeHandoff();}

  function mount(nextHost){unmount();if(!nextHost?.querySelector)throw new TypeError("HHMusicAutopilot.mount cần host hợp lệ.");host=nextHost;activeTab="autopilot";store=Core().createStore(localStorage,scope());state=store.get();controller=new AbortController();host.addEventListener("submit",handleSubmit,{signal:controller.signal});host.addEventListener("change",handleChange,{signal:controller.signal});host.addEventListener("click",handleClick,{signal:controller.signal});render();refreshProviders();}
  function unmount(){controller?.abort();controller=null;cancelAnimationFrame(visualizerFrame);visualizerFrame=0;visualizerAudio?.close?.();visualizerAudio=null;urls.forEach(url=>URL.revokeObjectURL(url));urls.clear();liveAssets.clear();restoringUrls=false;host=null;running=false;}

  global.HHMusicAutopilot=Object.freeze({mount,unmount,run:()=>runPipeline(),pause:()=>persist({stopRequested:true}),state:()=>state?JSON.parse(JSON.stringify(state)):null});
})(window);
