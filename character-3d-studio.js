(function initHHCharacter3DStudio(global) {
  "use strict";

  const PROJECT_VERSION = 2;
  const ASTRA_RELEASE_MANIFEST = "assets/character-3d/astra-h08/output/ASTRA_H08.release.json";
  const ASTRA_RELEASE_GLB = "assets/character-3d/astra-h08/output/ASTRA_H08.glb";
  const DB_NAME = "hh-character-3d-studio";
  const TRACKS = ["Body animation", "Facial expression", "Lip-sync", "Voice / audio", "Camera", "Lighting", "Effects"];
  const esc = (value) => String(value == null ? "" : value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  const ownerId = (user) => String(user?.id || user?.userId || user?.email || "local-owner").toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(0, 90) || "local-owner";
  const waitRuntime = () => global.HHCharacter3DRuntimeReady ? Promise.resolve(global.HHCharacter3DRuntime) : new Promise((resolve, reject) => {
    const ready = () => { cleanup(); resolve(global.HHCharacter3DRuntime); }; const failed = (event) => { cleanup(); reject(new Error(event.detail?.message || "Không tải được Three.js runtime.")); };
    const timeout = setTimeout(() => { cleanup(); reject(new Error("Three.js runtime tải quá thời gian cho phép.")); }, 15000);
    const cleanup = () => { clearTimeout(timeout); global.removeEventListener("hh:character-3d-runtime-ready", ready); global.removeEventListener("hh:character-3d-runtime-error", failed); };
    global.addEventListener("hh:character-3d-runtime-ready", ready, { once: true }); global.addEventListener("hh:character-3d-runtime-error", failed, { once: true });
  });

  const database = {
    promise: null,
    open() {
      if (!global.indexedDB) return Promise.resolve(null);
      if (this.promise) return this.promise;
      this.promise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, PROJECT_VERSION);
        request.onupgradeneeded = () => { const db = request.result; if (!db.objectStoreNames.contains("projects")) db.createObjectStore("projects", { keyPath: "key" }); };
        request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
      }); return this.promise;
    },
    async put(record) { const db = await this.open(); if (!db) { localStorage.setItem(record.key, JSON.stringify(record)); return record; } return new Promise((resolve, reject) => { const tx = db.transaction("projects", "readwrite"); tx.objectStore("projects").put(record); tx.oncomplete = () => resolve(record); tx.onerror = () => reject(tx.error); }); },
    async get(key) { const db = await this.open(); if (!db) { try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; } } return new Promise((resolve, reject) => { const tx = db.transaction("projects", "readonly"); const request = tx.objectStore("projects").get(key); request.onsuccess = () => resolve(request.result || null); request.onerror = () => reject(request.error); }); }
  };

  const markup = (project) => `
    <section class="c3d-studio" data-c3d-studio>
      <div class="c3d-topbar">
        <label class="c3d-topbar__identity"><small>HH CHARACTER STUDIO · PROJECT V${PROJECT_VERSION}</small><input value="${esc(project.name)}" data-c3d-project-name aria-label="Tên dự án"></label>
        <select data-c3d-quality aria-label="Chất lượng"><option value="mobile">Mobile</option><option value="balanced" selected>Cân bằng</option><option value="cinematic">Điện ảnh</option><option value="static">Tĩnh</option></select>
        <select data-c3d-projection aria-label="Kiểu camera"><option value="perspective">Perspective</option><option value="orthographic">Orthographic</option></select>
        <button type="button" data-c3d-action="save">Lưu dự án</button><button type="button" data-c3d-action="project-json">Project JSON</button><button class="is-primary" type="button" data-c3d-action="capture" data-c3d-requires-asset disabled>Chụp PNG</button>
      </div>
      <div class="c3d-workspace">
        <aside class="c3d-panel c3d-left"><header><div><span>CHARACTER LIBRARY</span><h3>Nhân vật & chuyển động</h3></div></header>
          <div class="c3d-section"><button class="c3d-asset-card" type="button" data-c3d-action="concept"><img src="assets/character-3d/astra-h08/concept/astra-h08-character-sheet-v1.png" alt="Concept Astra H-08"><div><b>Astra H-08</b><small data-c3d-build-state>Build pending · chưa có GLB đã QA</small><small>Chỉ ảnh 2D sở hữu dự án được dùng làm input</small></div></button><button type="button" data-c3d-action="concept">Xem character sheet & nguồn</button></div>
          <div class="c3d-section"><strong>Import cục bộ</strong><label class="c3d-upload" data-c3d-drop>Thả hoặc chọn GLB / VRM (tối đa 80 MB)<input type="file" accept=".glb,.vrm,model/gltf-binary,model/vrm" data-c3d-model-file></label><p class="c3d-note">File chỉ được preview cục bộ. Quyền không rõ sẽ chặn xuất bản/chia sẻ; URL ngoài không được nhập.</p></div>
          <div class="c3d-section"><strong>Animation actions từ asset</strong><div class="c3d-clip-grid" data-c3d-actions><span class="c3d-empty-capability">Chưa có GLB · 0 actions</span></div><label class="c3d-field"><span>Tốc độ animation</span><input type="range" min="0.25" max="2" step="0.05" value="1" data-c3d-speed disabled></label><p class="c3d-note" data-c3d-animation-note>Build pending. Chỉ action/clip thật đọc từ GLB mới được hiển thị.</p></div>
          <div class="c3d-section"><strong>Kết nối bằng Project ID</strong><button type="button" data-c3d-send="hikari">Gửi sang Hikari</button><button type="button" data-c3d-send="astral">Gửi sang Astral Realms</button><button type="button" data-c3d-send="ai-video">Gửi sang AI Video</button><button type="button" data-c3d-send="thumbnail">Gửi sang Thumbnail</button></div>
        </aside>
        <main class="c3d-viewport-shell" data-c3d-viewport-shell><div class="c3d-viewport" data-c3d-viewport></div>
          <div class="c3d-viewport-toolbar"><button type="button" data-c3d-camera="face">Cận mặt</button><button type="button" data-c3d-camera="half">Bán thân</button><button type="button" data-c3d-camera="full">Toàn thân</button><button type="button" data-c3d-action="reset-camera">Reset</button><button type="button" data-c3d-action="fullscreen">Toàn màn hình</button></div>
          <div class="c3d-diagnostics" data-c3d-diagnostics><b>WebGL đang khởi tạo</b><span>FPS -- · Triangles --</span><span>GPU resources của viewport</span></div><div class="c3d-status" data-c3d-status role="status" aria-live="polite">Đang khởi tạo Astra H-08…</div>
          <div class="c3d-fallback" data-c3d-fallback><img src="assets/character-3d/astra-h08/concept/astra-h08-character-sheet-v1.png" alt="Concept art Astra H-08"><div><h3>WebGL không khả dụng</h3><p>Dùng ảnh concept 2D dự phòng. Studio không giả lập viewport 3D bằng ảnh.</p></div></div>
        </main>
        <aside class="c3d-panel c3d-right"><header><div><span>INSPECTOR</span><h3>Ngoại hình & xuất bản</h3></div></header>
          <div class="c3d-section"><strong>Materials từ asset</strong><div class="c3d-capability-list" data-c3d-materials><span class="c3d-empty-capability">Chưa có GLB · 0 materials</span></div><p class="c3d-note" data-c3d-customizer-note>Build pending. Không tạo material hoặc control giả khi chưa có asset.</p></div>
          <div class="c3d-section"><strong>Shape keys từ asset</strong><div class="c3d-expression-grid" data-c3d-shape-keys><span class="c3d-empty-capability">Chưa có GLB · 0 shape keys</span></div><label class="c3d-field"><span>Cường độ shape key</span><input type="range" min="0" max="1" value="1" step="0.05" data-c3d-expression-level disabled></label></div>
          <div class="c3d-section"><strong>Giọng nữ tiếng Việt</strong><label class="c3d-field"><span>Lời thoại</span><textarea data-c3d-speech>Xin chào, tôi là Astra H-08. Tôi đang hoạt động trong HH Character Studio.</textarea></label><select data-c3d-voice aria-label="Chọn giọng tiếng Việt"><option>Đang đọc giọng hệ thống…</option></select><div class="c3d-preset-grid"><button type="button" data-c3d-action="speak">Nói</button><button type="button" data-c3d-action="stop-voice">Dừng</button></div><label class="c3d-upload">Tải audio để lip-sync<input type="file" accept="audio/*" data-c3d-audio-file></label><p class="c3d-note">SpeechSynthesis miễn phí. Nếu không có timestamp viseme, chuyển động miệng là lip-sync ước tính, không phải nhận diện phoneme.</p></div>
          <div class="c3d-section"><strong>Viewport</strong><label class="c3d-toggle">Grid<input type="checkbox" checked data-c3d-grid></label><label class="c3d-toggle">Nền trong suốt<input type="checkbox" checked data-c3d-transparent></label><label class="c3d-field"><span>Nền sân khấu</span><input type="color" value="#070a12" data-c3d-background></label></div>
          <div class="c3d-section"><strong>Asset report</strong><div class="c3d-report" data-c3d-report>${["Triangles","Bones","Shape keys","Materials","Textures","Animations","Size"].map((key) => `<span>${key}<b>--</b></span>`).join("")}</div></div>
          <div class="c3d-section"><strong>Rights Registry</strong><div class="c3d-rights" data-c3d-rights><strong data-state="review">PROVENANCE-REVIEW · review</strong><span>Build pending · không có model để xuất bản</span><span>Public export: đang khóa</span><button type="button" data-c3d-action="edit-rights">Hồ sơ quyền asset</button></div></div>
          <div class="c3d-section"><strong>Xuất</strong><button type="button" data-c3d-action="thumbnail" data-c3d-requires-asset disabled>PNG 1280×720</button><button type="button" data-c3d-action="portrait" data-c3d-requires-asset disabled>PNG 1080×1920</button><button type="button" data-c3d-action="video" data-c3d-requires-asset disabled>Bắt đầu ghi video</button><button type="button" disabled title="Cần MediaPipe Face/Pose trong Worker" data-c3d-action="mocap">Webcam mocap · P1</button></div>
        </aside>
        <section class="c3d-timeline"><header><button type="button" data-c3d-action="play" disabled>▶</button><button type="button" data-c3d-action="pause" disabled>Ⅱ</button><button type="button" data-c3d-action="stop" disabled>■</button><strong>Timeline · dữ liệu clip từ GLB</strong><label>Loop <input type="checkbox" checked data-c3d-loop disabled></label><input type="range" min="0" max="0" value="0" step="0.01" data-c3d-scrub aria-label="Scrub timeline" disabled></header><div class="c3d-tracks"><div class="c3d-track-labels">${TRACKS.map((track) => `<span>${track}</span>`).join("")}</div><div class="c3d-track-body" style="height:${TRACKS.length*20}px" data-c3d-track-body></div></div></section>
      </div>
      <div class="c3d-modal" data-c3d-modal><article class="c3d-modal__card" data-c3d-modal-card></article></div>
    </section>`;

  class Character3DStudio {
    constructor(host, options = {}) {
      this.host = host; this.options = options; this.owner = ownerId(options.currentUser); this.projectId = `astra-h08-${this.owner}`; this.projectKey = `hh.character3d.project.v${PROJECT_VERSION}.${this.owner}.${this.projectId}`;
      this.project = { version: PROJECT_VERSION, id: this.projectId, ownerId: this.owner, name: "Astra H-08 Studio", assetId: "astra-h08-concept-sheet-v1", quality: "balanced", projection: "perspective", expression: "neutral", updatedAt: new Date().toISOString() };
      this.runtime = this.loader = this.animation = this.expression = this.customizer = this.voice = this.exporter = this.rights = null; this.currentAsset = null; this.autosave = 0; this.diagTimer = 0; this.destroyed = false;
      this.boundClick = (event) => this.onClick(event); this.boundInput = (event) => this.onInput(event); this.boundFile = (event) => this.onFile(event); this.quickCapture = () => this.capture("thumbnail");
    }

    async init() {
      const saved = await database.get(this.projectKey).catch(() => null); if (saved?.ownerId === this.owner && saved.project?.ownerId === this.owner) this.project = Object.assign(this.project, saved.project);
      this.host.innerHTML = markup(this.project); this.root = this.host.querySelector("[data-c3d-studio]"); this.statusNode = this.root.querySelector("[data-c3d-status]");
      this.root.addEventListener("click", this.boundClick); this.root.addEventListener("input", this.boundInput); this.root.addEventListener("change", this.boundFile);
      document.querySelector("[data-character-3d-quick-capture]")?.addEventListener("click", this.quickCapture);
      this.bindDrop(); this.setStatus("Đang tải Three.js r184 và decoder cục bộ…");
      const modules = await waitRuntime(); const C = global.HHCharacter3D;
      this.rights = new C.RightsRegistry({ ownerId: this.owner });
      this.registerConceptRights();
      this.animation = new C.AnimationController({ THREE: modules.THREE, crossfadeDuration: .32, reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches });
      this.expression = new C.ExpressionController();
      this.runtime = new C.AvatarRuntime(this.root.querySelector("[data-c3d-viewport]"), { THREE: modules.THREE, quality: this.project.quality, transparent: true, reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches });
      await this.runtime.init(); this.runtime.attachControllers({ animation: this.animation, expression: this.expression });
      this.customizer = new C.CharacterCustomizer({ THREE: modules.THREE }); this.customizer.bind(this.runtime.modelRoot);
      this.voice = new C.VoiceLipSync({ expressionController: this.expression, onState: (state) => this.setStatus(state.state === "speaking" ? `Đang nói · lip-sync ${state.accuracy === "estimated" ? "ước tính" : "theo timestamp"}` : "Giọng nói đã dừng", "success") });
      this.loader = new C.AssetLoader({ renderer: this.runtime.renderer, allowSameOrigin: false, allowOrigins: [] });
      this.exporter = new C.ExportManager({ renderer: this.runtime.renderer, scene: this.runtime.scene, camera: this.runtime.camera, canvas: this.runtime.renderer.domElement, rightsRegistry: this.rights });
      this.populateVoices(); speechSynthesis?.addEventListener?.("voiceschanged", () => this.populateVoices());
      this.applyProject(); this.updateReport({ triangles: 0, bones: 0, morphTargets: 0, textures: 0, animations: 0, byteLength: 0 }); this.updateRights();
      this.setAssetControls(false); this.updateReport();
      await this.loadApprovedAstraRelease();
      if (!this.currentAsset) this.setStatus("Astra H-08 build pending: chưa có GLB đã qua visual/animation QA. Viewport không hiển thị model giả.", "info");
      this.diagTimer = setInterval(() => this.updateDiagnostics(), 1000); global.dispatchEvent(new CustomEvent("hh:character-3d-ready")); return this;
    }

    registerConceptRights() {
      this.rights.register({ assetId: "astra-h08-concept-sheet-v1", title: "Astra H-08 project-owned 2D character sheet", author: "HH Platform / OpenAI ImageGen assisted", sourceUrl: "local://assets/character-3d/astra-h08/concept/astra-h08-character-sheet-v1.png", licenseId: "PROVENANCE-REVIEW", commercialUse: false, modification: true, redistribution: false, avatarUse: false, attribution: "Astra H-08 original concept — HH Platform", status: "review", provenance: "Only permitted input for the self-contained Blender generator" });
    }

    async loadApprovedAstraRelease() {
      try {
        const manifestResponse = await fetch(ASTRA_RELEASE_MANIFEST, { cache: "no-store", credentials: "same-origin" });
        if (!manifestResponse.ok) { this.setStatus("Astra H-08 build pending: chưa có release manifest local. Viewport không hiển thị model giả.", "info"); return false; }
        const manifest = await manifestResponse.json();
        if (manifest?.status !== "ready" || manifest?.approvedForRelease !== true || manifest?.model?.path !== ASTRA_RELEASE_GLB) { this.setStatus("Astra H-08 build pending: release manifest chưa xác nhận đúng asset/QA. Viewport không hiển thị model giả.", "info"); return false; }
        const assetPath = manifest.model.path;
        const asset = await this.loader.loadUrl(assetPath, { trustedInternal: true, cache: "no-store" });
        if (manifest.model?.sha256 && asset.sha256 && manifest.model.sha256.toLowerCase() !== asset.sha256.toLowerCase()) throw new Error("Manifest SHA-256 không khớp GLB local.");
        if (this.currentAsset) this.loader.release(this.currentAsset);
        this.currentAsset = asset;
        this.runtime.setModel(asset.scene, { animations: asset.animations, report: asset.report, disposePrevious: true, bindControllers: false });
        await this.animation.bind(asset.scene, asset.animations);
        const caps = this.customizer.bind(asset.scene); this.expression.bind(asset.scene);
        const id = "astra-h08-release-v1";
        this.project.assetId = id; this.project.assetName = asset.name; this.project.assetHash = manifest.model?.sha256 || asset.sha256; this.project.privatePreviewOnly = false;
        this.rights.register({ assetId: id, title: "Astra H-08 approved release GLB", author: "HH Platform", sourceUrl: assetPath, licenseId: "HH-ORIGINAL-1.0", commercialUse: true, modification: true, redistribution: true, avatarUse: true, attribution: "Astra H-08 — HH Platform", sha256: this.project.assetHash, status: "approved", provenance: "Self-contained Blender build; manifest is generated only after visual and animation QA approval" });
        this.updateReport(asset.report); this.setAssetControls(true); this.updateRights();
        this.root.querySelector("[data-c3d-customizer-note]").textContent = caps.morphs.length ? `${caps.morphs.length} morph và ${caps.colors.length} nhóm material có thể chỉnh thật.` : `Model có ${caps.colors.length} nhóm material; không phát hiện morph target để chỉnh hình.`;
        this.root.querySelector("[data-c3d-animation-note]").textContent = asset.animations.length ? `${asset.animations.length} clip thật; chuyển clip crossfade 320ms.` : "Model không có animation clip.";
        this.setStatus(`Đã tải ASTRA_H08.glb local sau khi manifest xác nhận QA. ${asset.animations.length} actions, ${asset.report.morphTargets} shape keys/morph và ${asset.report.materials} materials được đo từ asset thật.`, "success");
        return true;
      } catch (error) {
        this.setStatus(`ASTRA_H08 build pending/error: không thể tải asset local đã QA (${error.message || "manifest/GLB không hợp lệ"}). Viewport không dùng mannequin giả.`, "error");
        return false;
      }
    }

    applyProject() { this.root.querySelector("[data-c3d-project-name]").value = this.project.name; this.root.querySelector("[data-c3d-quality]").value = this.project.quality || "balanced"; this.root.querySelector("[data-c3d-projection]").value = this.project.projection || "perspective"; this.runtime.applyQuality(this.project.quality || "balanced"); if ((this.project.projection || "perspective") !== this.runtime.projection) this.runtime.setProjection(this.project.projection); }
    setStatus(message, kind = "info") { if (!this.statusNode) return; this.statusNode.textContent = message; this.statusNode.dataset.kind = kind; }
    setAssetControls(enabled) { this.root?.querySelectorAll("[data-c3d-requires-asset]").forEach((node) => { node.disabled = !enabled; }); }
    populateVoices() { const select = this.root?.querySelector("[data-c3d-voice]"); if (!select || !this.voice) return; const voices = this.voice.listVoices(); const preferred = this.voice.defaultVietnameseFemaleVoice(); select.innerHTML = voices.length ? voices.map((voice) => `<option value="${esc(voice.voiceURI)}" ${voice === preferred ? "selected" : ""}>${esc(voice.name)} · ${esc(voice.lang)}${voice === preferred ? " · mặc định" : ""}</option>`).join("") : `<option value="">Giọng nữ vi-VN mặc định của hệ thống</option>`; }
    bindDrop() { const zone = this.root.querySelector("[data-c3d-drop]"); ["dragenter","dragover"].forEach((type) => zone.addEventListener(type, (event) => { event.preventDefault(); zone.classList.add("is-dragging"); })); ["dragleave","drop"].forEach((type) => zone.addEventListener(type, (event) => { event.preventDefault(); zone.classList.remove("is-dragging"); })); zone.addEventListener("drop", (event) => { const file = event.dataTransfer?.files?.[0]; if (file) this.importModel(file); }); }

    async importModel(file) {
      try {
        this.setStatus(`Đang xác minh ${file.name}: extension, MIME, magic bytes và dung lượng…`);
        const asset = await this.loader.loadFile(file); if (this.currentAsset) this.loader.release(this.currentAsset);
        this.currentAsset = asset; this.runtime.setModel(asset.scene, { animations: asset.animations, report: asset.report, disposePrevious: true, bindControllers: false }); await this.animation.bind(asset.scene, asset.animations); const caps = this.customizer.bind(asset.scene); this.expression.bind(asset.scene);
        const id = `local-${asset.sha256 || Date.now().toString(36)}`; this.project.assetId = id; this.project.assetName = asset.name; this.project.assetHash = asset.sha256; this.project.privatePreviewOnly = true;
        this.rights.register({ assetId: id, title: asset.name, author: "", sourceUrl: "local://user-import", licenseId: "UNKNOWN", commercialUse: false, modification: false, redistribution: false, avatarUse: false, attribution: "", sha256: asset.sha256, status: "review", provenance: "User-selected local file" });
        this.updateReport(asset.report); this.setAssetControls(true); this.updateRights(); this.root.querySelector("[data-c3d-customizer-note]").textContent = caps.morphs.length ? `${caps.morphs.length} morph và ${caps.colors.length} nhóm material có thể chỉnh thật.` : `Model có ${caps.colors.length} nhóm material; không phát hiện morph target để chỉnh hình.`;
        this.root.querySelector("[data-c3d-animation-note]").textContent = asset.animations.length ? `${asset.animations.length} clip thật; chuyển clip crossfade 320ms.` : "Model không có animation clip; giữ idle procedural nhẹ, không giả có clip.";
        this.setStatus(`Đã mở ${asset.name} ở chế độ private preview. License unknown đang chặn xuất bản/chia sẻ.`, "success"); this.scheduleSave();
      } catch (error) { this.setStatus(error.message || String(error), "error"); }
    }

    updateReport(report = {}) {
      const values = [Number(report.triangles || 0).toLocaleString("vi-VN"), report.bones || 0, report.morphTargets || 0, report.materials || 0, report.textures || 0, report.animations || 0, report.byteLength ? `${(report.byteLength/1048576).toFixed(1)} MB` : "runtime"];
      this.root.querySelectorAll("[data-c3d-report] b").forEach((node, index) => node.textContent = values[index] ?? "0");
      const actionBox = this.root.querySelector("[data-c3d-actions]");
      if (actionBox) actionBox.innerHTML = (report.animationNames || []).length ? report.animationNames.map((name) => `<button type="button" data-c3d-clip="${esc(name)}">${esc(name)}</button>`).join("") : `<span class="c3d-empty-capability">Chưa có GLB · 0 actions</span>`;
      const materialBox = this.root.querySelector("[data-c3d-materials]");
      if (materialBox) materialBox.innerHTML = (report.materialNames || []).length ? report.materialNames.map((name) => `<span>${esc(name)}</span>`).join("") : `<span class="c3d-empty-capability">Chưa có GLB · 0 materials</span>`;
      const shapeBox = this.root.querySelector("[data-c3d-shape-keys]");
      if (shapeBox) shapeBox.innerHTML = (report.shapeKeyNames || []).length ? report.shapeKeyNames.map((name) => `<button type="button" data-c3d-morph="${esc(name)}">${esc(name)}</button>`).join("") : `<span class="c3d-empty-capability">Chưa có GLB · 0 shape keys</span>`;
      const hasAnimations = Boolean(report.animations || report.animationNames?.length);
      const hasShapeKeys = Boolean(report.morphTargets || report.shapeKeyNames?.length);
      this.root.querySelectorAll("[data-c3d-speed], [data-c3d-action='play'], [data-c3d-action='pause'], [data-c3d-action='stop'], [data-c3d-loop], [data-c3d-scrub]").forEach((node) => { node.disabled = !hasAnimations; });
      this.root.querySelectorAll("[data-c3d-expression-level]").forEach((node) => { node.disabled = !hasShapeKeys; });
    }
    updateRights() { const result = this.rights.evaluate(this.project.assetId, "publish"); const record = result.record; const box = this.root.querySelector("[data-c3d-rights]"); box.innerHTML = `<strong data-state="${esc(record?.status || "review")}">${esc(record?.licenseId || "UNKNOWN")} · ${esc(record?.status || "review")}</strong><span>Commercial ${record?.commercialUse ? "✓" : "?"} · Modify ${record?.modification ? "✓" : "?"} · Avatar ${record?.avatarUse ? "✓" : "?"}</span><span>Public export: ${result.allowed ? "được phép" : "đang khóa"}</span><button type="button" data-c3d-action="edit-rights">Hồ sơ quyền asset</button>`; }
    updateDiagnostics() { const data = this.runtime?.diagnostics?.(); if (!data) return; this.syncTimeline(true); const box = this.root.querySelector("[data-c3d-diagnostics]"); box.innerHTML = `<b>${data.fps || "--"} FPS · ${esc(data.quality)}</b><span>${Number(data.render?.triangles || 0).toLocaleString("vi-VN")} triangles · ${data.render?.calls || 0} calls</span><span>${data.gpuResources?.geometries || 0} geometry · ${data.gpuResources?.textures || 0} texture (viewport)</span>`; }
    readProject() { this.project.name = this.root.querySelector("[data-c3d-project-name]").value.trim().slice(0,120) || "Character 3D Project"; this.project.quality = this.root.querySelector("[data-c3d-quality]").value; this.project.projection = this.root.querySelector("[data-c3d-projection]").value; this.project.ownerId = this.owner; this.project.updatedAt = new Date().toISOString(); return structuredClone ? structuredClone(this.project) : JSON.parse(JSON.stringify(this.project)); }
    async save(options = {}) { const project = this.readProject(); await database.put({ key: this.projectKey, ownerId: this.owner, projectId: this.projectId, project, updatedAt: project.updatedAt }); if (!options.silent) this.setStatus("Dự án đã lưu trong IndexedDB theo đúng ownerId.", "success"); return project; }
    scheduleSave() { clearTimeout(this.autosave); this.autosave = setTimeout(() => this.save({ silent: true }).catch(() => {}), 700); }

    async capture(kind) { try { const options = { assetIds: [this.project.assetId], localPreview: true, fileName: `${this.project.name}-${kind}.png`, transparent: this.root.querySelector("[data-c3d-transparent]").checked }; const result = kind === "portrait" ? await this.exporter.capturePortrait(options) : kind === "thumbnail" ? await this.exporter.captureThumbnail(options) : await this.exporter.capturePng(options); this.setStatus(`Đã xuất ${result.fileName} (${result.width}×${result.height}) cho sử dụng cục bộ.`, "success"); } catch (error) { this.setStatus(error.message, "error"); } }
    async toggleVideo(button) { try { if (!this.exporter.activeRecorder) { const result = await this.exporter.startVideo({ assetIds: [this.project.assetId], localPreview: true, fps: this.project.quality === "cinematic" ? 60 : 30 }); button.textContent = "Dừng & tải video"; this.setStatus(`Đang ghi realtime ${result.mimeType}.`, "success"); } else { const result = await this.exporter.stopVideo({ fileName: `${this.project.name}-recording` }); button.textContent = "Bắt đầu ghi video"; this.setStatus(`Đã xuất ${result.fileName}.`, "success"); } } catch (error) { this.setStatus(error.message, "error"); } }
    showModal(content) { const modal = this.root.querySelector("[data-c3d-modal]"); modal.querySelector("[data-c3d-modal-card]").innerHTML = content; modal.classList.add("is-open"); }
    closeModal() { this.root.querySelector("[data-c3d-modal]")?.classList.remove("is-open"); }
    rightsModal() { const record = this.rights.get(this.project.assetId); this.showModal(`<header><h2>Rights Registry</h2><button type="button" data-c3d-action="close-modal">Đóng</button></header><p>Mỗi asset cần tác giả, URL nguồn, license chính xác, quyền thương mại/sửa đổi/phân phối/avatar, attribution, SHA-256, ngày duyệt và trạng thái.</p><pre><code>${esc(JSON.stringify(record, null, 2))}</code></pre><p>${record?.status === "review" ? "Asset đang review: chỉ private preview, chưa được public/export sang module khác." : "Cổng quyền áp dụng theo từng mục đích sử dụng."}</p>`); }
    conceptModal() { this.showModal(`<header><h2>Astra H-08 · concept-only</h2><button type="button" data-c3d-action="close-modal">Đóng</button></header><img src="assets/character-3d/astra-h08/concept/astra-h08-character-sheet-v1.png" alt="Character sheet Astra H-08"><p>AI-assisted original concept cho HH Platform. Ảnh này không phải model 3D, không có rig, retopology, UV, weight paint, shape key hay Spring Bone. Prompt và metadata được lưu cạnh asset.</p>`); }
    sendProject(target) { const gate = this.rights.evaluate(this.project.assetId, "publish"); if (!gate.allowed) return this.setStatus(`Không thể gửi sang ${target}: ${gate.errors.join(" ")}`, "error"); const payload = { projectId: this.projectId, characterId: this.project.assetId, ownerId: this.owner, target, time: new Date().toISOString() }; localStorage.setItem(`hh.character3d.integration.${this.owner}.${target}`, JSON.stringify(payload)); global.dispatchEvent(new CustomEvent("hh:character-3d-project-link", { detail: payload })); this.setStatus(`Đã gửi Project ID sang ${target}; không nhân bản file model.`, "success"); }

    onClick(event) {
      const action = event.target.closest("[data-c3d-action]")?.dataset.c3dAction; const state = event.target.closest("[data-c3d-state]")?.dataset.c3dState; const expression = event.target.closest("[data-c3d-expression]")?.dataset.c3dExpression; const morph = event.target.closest("[data-c3d-morph]")?.dataset.c3dMorph; const camera = event.target.closest("[data-c3d-camera]")?.dataset.c3dCamera; const target = event.target.closest("[data-c3d-send]")?.dataset.c3dSend;
      const clipName = event.target.closest("[data-c3d-clip]")?.dataset.c3dClip;
      if (clipName) { const supported = this.animation.playClip(clipName, { loop: this.root.querySelector("[data-c3d-loop]")?.checked !== false }); this.syncTimeline(); this.setStatus(supported ? `Action ${clipName} đang chạy.` : `Action ${clipName} không có trong asset hiện tại.`, supported ? "success" : "info"); return; }
      if (morph) { const supported = this.customizer.setMorph(morph, Number(this.root.querySelector("[data-c3d-expression-level]").value)); this.setStatus(supported ? `Shape key ${morph} đã áp dụng trên mesh thật.` : `Shape key ${morph} không có binding trong asset.`, supported ? "success" : "info"); return; }
      if (state) { const supported = this.animation.setState(state, { force: true }); this.setStatus(supported ? `State ${state} đang chạy/crossfade.` : `Model hiện tại không có clip ${state}; không giả lập clip.`, supported ? "success" : "info"); return; }
      if (expression) { const level = Number(this.root.querySelector("[data-c3d-expression-level]").value); const supported = this.expression.preset(expression, level); this.project.expression = expression; this.setStatus(supported ? `Biểu cảm ${expression} đang chuyển mượt.` : `Model hiện tại không có morph ${expression}.`, supported ? "success" : "info"); this.scheduleSave(); return; }
      if (camera) return void this.runtime.setCameraPreset(camera);
      if (target) return void this.sendProject(target);
      if (!action) { if (event.target === this.root.querySelector("[data-c3d-modal]")) this.closeModal(); return; }
      if (action === "save") this.save().catch((error) => this.setStatus(error.message,"error"));
      else if (action === "project-json") this.exporter.exportProject(this.readProject(), { fileName: this.project.name });
      else if (action === "capture") this.capture("canvas"); else if (action === "thumbnail") this.capture("thumbnail"); else if (action === "portrait") this.capture("portrait");
      else if (action === "concept") this.conceptModal(); else if (action === "edit-rights") this.rightsModal(); else if (action === "close-modal") this.closeModal();
      else if (action === "reset-camera") this.runtime.setCameraPreset("full"); else if (action === "fullscreen") this.runtime.fullscreen().catch(() => this.setStatus("Fullscreen bị trình duyệt từ chối.","error"));
      else if (action === "speak") { const voiceURI = this.root.querySelector("[data-c3d-voice]").value; this.animation.setState("speaking", { force: true }); this.voice.speak(this.root.querySelector("[data-c3d-speech]").value, { voiceURI, onFallback: (message) => this.setStatus(`TTS backend lỗi; dùng trình duyệt: ${message}`) }).finally(() => this.animation.setState("idle", { force: true })).catch((error) => this.setStatus(error.message,"error")); }
      else if (action === "stop-voice") { this.voice.stop(); this.animation.setState("idle", { force: true }); }
      else if (action === "video") this.toggleVideo(event.target.closest("button")); else if (action === "play") { this.animation.setPaused(false); this.runtime.setPaused(false); } else if (action === "pause") this.animation.setPaused(true); else if (action === "stop") { this.animation.resetPose(); this.runtime.setCameraPreset("full"); }
    }

    onInput(event) {
      if (event.target.matches("[data-c3d-quality]")) { this.project.quality = event.target.value; this.runtime.applyQuality(event.target.value); this.scheduleSave(); }
      else if (event.target.matches("[data-c3d-projection]")) { this.project.projection = event.target.value; this.runtime.setProjection(event.target.value); this.exporter.bind({ camera: this.runtime.camera }); this.scheduleSave(); }
      else if (event.target.matches("[data-c3d-color]")) { const count = this.customizer.setColor(event.target.dataset.c3dColor, event.target.value, { intensity: 2.5 }); this.setStatus(count ? `Đã chỉnh ${count} material thật.` : "Model không có material tương ứng; không thay đổi giả.", count ? "success" : "info"); }
      else if (event.target.matches("[data-c3d-speed]")) this.animation.setSpeed(event.target.value);
      else if (event.target.matches("[data-c3d-loop]")) this.animation.setLoop(event.target.checked);
      else if (event.target.matches("[data-c3d-grid]")) this.runtime.setGrid(event.target.checked);
      else if (event.target.matches("[data-c3d-transparent]")) this.runtime.setTransparent(event.target.checked);
      else if (event.target.matches("[data-c3d-background]")) this.runtime.setBackground(event.target.value);
      else if (event.target.matches("[data-c3d-scrub]")) this.animation.scrub(Number(event.target.value));
      else if (event.target.matches("[data-c3d-project-name]")) this.scheduleSave();
    }

    syncTimeline(followPlayback = false) {
      const scrub = this.root?.querySelector("[data-c3d-scrub]");
      if (!scrub) return;
      const duration = Number(this.animation?.activeAction?.getClip?.()?.duration) || 0;
      scrub.max = String(Math.max(0, duration));
      const playbackTime = Number(this.animation?.activeAction?.time) || 0;
      const requestedTime = followPlayback ? playbackTime : (Number(scrub.value) || 0);
      scrub.value = String(Math.min(requestedTime, duration));
    }

    onFile(event) { if (event.target.matches("[data-c3d-model-file]") && event.target.files?.[0]) this.importModel(event.target.files[0]); if (event.target.matches("[data-c3d-audio-file]") && event.target.files?.[0]) { this.animation.setState("speaking", { force: true }); this.voice.playFile(event.target.files[0]).finally(() => this.animation.setState("idle", { force: true })).catch((error) => this.setStatus(error.message,"error")); } }
    unmount() { if (this.destroyed) return; this.destroyed = true; clearTimeout(this.autosave); clearInterval(this.diagTimer); document.querySelector("[data-character-3d-quick-capture]")?.removeEventListener("click", this.quickCapture); this.root?.removeEventListener("click", this.boundClick); this.root?.removeEventListener("input", this.boundInput); this.root?.removeEventListener("change", this.boundFile); this.exporter?.dispose?.(); this.voice?.dispose?.(); this.loader?.dispose?.(); this.customizer?.reset?.(); this.runtime?.dispose?.(); this.host?.replaceChildren(); }
  }

  let active = null;
  const api = Object.freeze({
    async mount(host, options = {}) { active?.unmount(); active = new Character3DStudio(host, options); try { await active.init(); } catch (error) { const fallback = host.querySelector("[data-c3d-fallback]"); fallback?.classList.add("is-visible"); active?.setStatus(error.message, "error"); } return active; },
    unmount() { active?.unmount(); active = null; }, get active() { return active; }, PROJECT_VERSION
  });
  global.HHCharacter3DStudio = api;
  global.HHCharacter3DStudioTest = Object.freeze({ ownerId, databaseName: DB_NAME, projectVersion: PROJECT_VERSION });
})(window);
