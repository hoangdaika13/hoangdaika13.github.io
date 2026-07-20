(function (globalScope) {
  "use strict";

  const VERSION = 1;
  const FORMAT = "hhdesign-package";
  const DB_NAME = "hh-graphic-projects";
  const DB_VERSION = 1;
  const MAX_ASSET_BYTES = 25 * 1024 * 1024;
  const STORE_NAMES = Object.freeze(["projects", "assets", "snapshots", "sessions"]);
  const instances = new WeakMap();

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function now() {
    return new Date().toISOString();
  }

  function clone(value) {
    if (typeof structuredClone === "function") return structuredClone(value);
    if (value == null) return value;
    return JSON.parse(JSON.stringify(value));
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function safeName(value, fallback) {
    const text = String(value || fallback || "Dự án chưa đặt tên").trim();
    return text.slice(0, 160) || "Dự án chưa đặt tên";
  }

  function normalizeProject(input) {
    const source = input && typeof input === "object" ? input : {};
    const timestamp = now();
    return {
      id: String(source.id || uid("project")).slice(0, 120),
      name: safeName(source.name),
      description: String(source.description || "").slice(0, 1200),
      branch: String(source.branch || "main").slice(0, 80),
      parentBranch: source.parentBranch ? String(source.parentBranch).slice(0, 80) : null,
      status: ["draft", "review", "approved", "changes-requested"].includes(source.status) ? source.status : "draft",
      createdAt: source.createdAt || timestamp,
      updatedAt: timestamp,
      data: source.data && typeof source.data === "object" ? clone(source.data) : {},
      assetIds: Array.isArray(source.assetIds) ? [...new Set(source.assetIds.map(String))].slice(0, 2000) : [],
      tags: Array.isArray(source.tags) ? [...new Set(source.tags.map(String))].slice(0, 50) : []
    };
  }

  function assetKind(type, name) {
    const mime = String(type || "").toLowerCase();
    const extension = String(name || "").split(".").pop().toLowerCase();
    if (mime.includes("svg") || extension === "svg") return "svg";
    if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif"].includes(extension)) return "image";
    if (mime.startsWith("video/") || ["mp4", "webm", "mov"].includes(extension)) return "video";
    if (mime.includes("font") || ["ttf", "otf", "woff", "woff2"].includes(extension)) return "font";
    if (extension === "json" || extension === "lottie") return "lottie";
    if (["glb", "gltf"].includes(extension)) return "3d";
    return "other";
  }

  function normalizeAsset(input) {
    const source = input && typeof input === "object" ? input : {};
    const blob = source.blob instanceof Blob ? source.blob : null;
    const size = Number(source.size ?? blob?.size ?? 0) || 0;
    const type = String(source.type || blob?.type || "application/octet-stream").slice(0, 120);
    return {
      id: String(source.id || uid("asset")).slice(0, 120),
      projectId: String(source.projectId || "").slice(0, 120),
      name: safeName(source.name, "asset.bin"),
      type,
      kind: source.kind || assetKind(type, source.name),
      size,
      checksum: String(source.checksum || "").slice(0, 160),
      createdAt: source.createdAt || now(),
      updatedAt: now(),
      blob,
      metadata: source.metadata && typeof source.metadata === "object" ? clone(source.metadata) : {}
    };
  }

  function diffValues(before, after, path, changes) {
    const currentPath = path || "$";
    if (Object.is(before, after)) return changes;
    const beforeObject = before && typeof before === "object" && !(before instanceof Blob);
    const afterObject = after && typeof after === "object" && !(after instanceof Blob);
    if (!beforeObject || !afterObject) {
      changes.push({ path: currentPath, before: clone(before), after: clone(after) });
      return changes;
    }
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    keys.forEach((key) => diffValues(before[key], after[key], `${currentPath}.${key}`, changes));
    return changes;
  }

  function diff(before, after) {
    return diffValues(before, after, "$", []);
  }

  function createMemoryBackend() {
    const stores = Object.fromEntries(STORE_NAMES.map((name) => [name, new Map()]));
    return {
      type: "memory",
      async get(store, key) { return clone(stores[store].get(key)); },
      async put(store, value) { stores[store].set(value.id, clone(value)); return clone(value); },
      async delete(store, key) { return stores[store].delete(key); },
      async all(store) { return [...stores[store].values()].map(clone); },
      async clear(store) { stores[store].clear(); },
      close() {}
    };
  }

  function requestPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("IndexedDB request failed"));
    });
  }

  async function createIndexedDbBackend(indexedDb, name) {
    const request = indexedDb.open(name, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      STORE_NAMES.forEach((store) => {
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: "id" });
      });
    };
    const db = await requestPromise(request);
    const transact = (store, mode, operation) => {
      const transaction = db.transaction(store, mode);
      return operation(transaction.objectStore(store));
    };
    return {
      type: "indexeddb",
      get: (store, key) => requestPromise(transact(store, "readonly", (objectStore) => objectStore.get(key))),
      put: (store, value) => requestPromise(transact(store, "readwrite", (objectStore) => objectStore.put(value))).then(() => clone(value)),
      delete: (store, key) => requestPromise(transact(store, "readwrite", (objectStore) => objectStore.delete(key))).then(() => true),
      all: (store) => requestPromise(transact(store, "readonly", (objectStore) => objectStore.getAll())),
      clear: (store) => requestPromise(transact(store, "readwrite", (objectStore) => objectStore.clear())),
      close: () => db.close()
    };
  }

  async function createBackend(options) {
    if (options?.backend) return options.backend;
    const indexedDb = Object.prototype.hasOwnProperty.call(options || {}, "indexedDB") ? options.indexedDB : globalScope.indexedDB;
    if (!indexedDb || typeof indexedDb.open !== "function") return createMemoryBackend();
    try {
      return await createIndexedDbBackend(indexedDb, options?.dbName || DB_NAME);
    } catch (_) {
      return createMemoryBackend();
    }
  }

  async function blobToDataUrl(blob) {
    if (!(blob instanceof Blob)) return null;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    const encode = typeof btoa === "function" ? btoa : (value) => Buffer.from(value, "binary").toString("base64");
    return `data:${blob.type || "application/octet-stream"};base64,${encode(binary)}`;
  }

  function dataUrlToBlob(dataUrl) {
    const match = /^data:([^;,]*)(?:;[^,]*)?;base64,(.*)$/i.exec(String(dataUrl || ""));
    if (!match) return null;
    const decode = typeof atob === "function" ? atob : (value) => Buffer.from(value, "base64").toString("binary");
    const binary = decode(match[2]);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new Blob([bytes], { type: match[1] || "application/octet-stream" });
  }

  function createStore(options) {
    const backendPromise = createBackend(options || {});
    const withBackend = async (callback) => callback(await backendPromise);

    async function saveProject(input) {
      const existing = input?.id ? await withBackend((backend) => backend.get("projects", input.id)) : null;
      const project = normalizeProject({ ...existing, ...input, createdAt: existing?.createdAt || input?.createdAt });
      await withBackend((backend) => backend.put("projects", project));
      return clone(project);
    }

    async function getProject(id) {
      return withBackend((backend) => backend.get("projects", id));
    }

    async function listProjects() {
      const projects = await withBackend((backend) => backend.all("projects"));
      return projects.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    }

    async function deleteProject(id) {
      const assets = await listAssets(id);
      const snapshots = await listSnapshots(id);
      await Promise.all([
        withBackend((backend) => backend.delete("projects", id)),
        ...assets.map((asset) => withBackend((backend) => backend.delete("assets", asset.id))),
        ...snapshots.map((snapshot) => withBackend((backend) => backend.delete("snapshots", snapshot.id)))
      ]);
      return true;
    }

    async function saveAsset(input) {
      const asset = normalizeAsset(input);
      if (!asset.projectId) throw new Error("Asset cần projectId");
      await withBackend((backend) => backend.put("assets", asset));
      const project = await getProject(asset.projectId);
      if (project && !project.assetIds.includes(asset.id)) await saveProject({ ...project, assetIds: [...project.assetIds, asset.id] });
      return clone(asset);
    }

    async function listAssets(projectId) {
      const assets = await withBackend((backend) => backend.all("assets"));
      return assets.filter((asset) => !projectId || asset.projectId === projectId).sort((a, b) => a.name.localeCompare(b.name));
    }

    async function removeAsset(id) {
      const asset = await withBackend((backend) => backend.get("assets", id));
      await withBackend((backend) => backend.delete("assets", id));
      if (asset?.projectId) {
        const project = await getProject(asset.projectId);
        if (project) await saveProject({ ...project, assetIds: project.assetIds.filter((assetId) => assetId !== id) });
      }
      return true;
    }

    async function validateAssets(projectId, limit) {
      const project = await getProject(projectId);
      const assets = await listAssets(projectId);
      const ids = new Set(assets.map((asset) => asset.id));
      const warnings = [];
      (project?.assetIds || []).forEach((id) => {
        if (!ids.has(id)) warnings.push({ level: "error", code: "missing", assetId: id, message: `Thiếu asset ${id}` });
      });
      assets.forEach((asset) => {
        if (asset.size > (limit || MAX_ASSET_BYTES)) warnings.push({ level: "warning", code: "oversize", assetId: asset.id, message: `${asset.name} vượt ${Math.round((limit || MAX_ASSET_BYTES) / 1048576)} MB` });
        if (!asset.blob) warnings.push({ level: "warning", code: "blob-missing", assetId: asset.id, message: `${asset.name} chỉ còn metadata` });
      });
      return warnings;
    }

    async function createSnapshot(projectId, label, note) {
      const project = await getProject(projectId);
      if (!project) throw new Error("Không tìm thấy dự án");
      const snapshot = {
        id: uid("snapshot"), projectId, label: safeName(label, "Snapshot"), note: String(note || "").slice(0, 500),
        branch: project.branch, status: project.status, createdAt: now(), project: clone(project)
      };
      await withBackend((backend) => backend.put("snapshots", snapshot));
      return clone(snapshot);
    }

    async function listSnapshots(projectId) {
      const snapshots = await withBackend((backend) => backend.all("snapshots"));
      return snapshots.filter((item) => item.projectId === projectId).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    }

    async function restoreSnapshot(snapshotId) {
      const snapshot = await withBackend((backend) => backend.get("snapshots", snapshotId));
      if (!snapshot) throw new Error("Không tìm thấy snapshot");
      return saveProject({ ...snapshot.project, updatedAt: now() });
    }

    async function compareSnapshot(snapshotId, projectId) {
      const snapshot = await withBackend((backend) => backend.get("snapshots", snapshotId));
      const project = await getProject(projectId || snapshot?.projectId);
      if (!snapshot || !project) throw new Error("Không đủ dữ liệu để so sánh");
      return diff(snapshot.project, project);
    }

    async function createBranch(projectId, name) {
      const project = await getProject(projectId);
      if (!project) throw new Error("Không tìm thấy dự án");
      const branchName = String(name || "feature").trim().replace(/\s+/g, "-").slice(0, 80);
      return saveProject({ ...project, id: uid("project"), name: `${project.name} · ${branchName}`, parentBranch: project.branch, branch: branchName, status: "draft", createdAt: now() });
    }

    async function requestReview(projectId) {
      const project = await getProject(projectId);
      if (!project) throw new Error("Không tìm thấy dự án");
      return saveProject({ ...project, status: "review" });
    }

    async function setReviewStatus(projectId, status) {
      if (!["draft", "review", "approved", "changes-requested"].includes(status)) throw new Error("Trạng thái không hợp lệ");
      const project = await getProject(projectId);
      if (!project) throw new Error("Không tìm thấy dự án");
      return saveProject({ ...project, status });
    }

    function createAutosaveSession(projectId, sessionOptions) {
      const delay = Math.max(20, Number(sessionOptions?.delay) || 900);
      const sessionId = uid("session");
      let timer = 0;
      let pending = null;
      let disposed = false;
      async function flush() {
        if (!pending || disposed) return null;
        clearTimeout(timer);
        const payload = pending;
        pending = null;
        const saved = await saveProject({ ...payload, id: projectId });
        await withBackend((backend) => backend.put("sessions", { id: sessionId, projectId, savedAt: now(), data: clone(saved.data) }));
        sessionOptions?.onSaved?.(clone(saved));
        return saved;
      }
      return {
        id: sessionId,
        schedule(data) { if (disposed) return; pending = normalizeProject({ ...data, id: projectId }); clearTimeout(timer); timer = setTimeout(flush, delay); },
        flush,
        async dispose(options) { if (options?.flush !== false) await flush(); disposed = true; clearTimeout(timer); },
        get pending() { return Boolean(pending); }
      };
    }

    async function exportPackage(projectId) {
      const project = await getProject(projectId);
      if (!project) throw new Error("Không tìm thấy dự án");
      const assets = await listAssets(projectId);
      const snapshots = await listSnapshots(projectId);
      const serializedAssets = [];
      for (const asset of assets) {
        const { blob, ...metadata } = asset;
        serializedAssets.push({ ...metadata, dataUrl: await blobToDataUrl(blob) });
      }
      return JSON.stringify({ format: FORMAT, version: VERSION, exportedAt: now(), project, snapshots, assets: serializedAssets }, null, 2);
    }

    async function importPackage(input) {
      const parsed = typeof input === "string" ? JSON.parse(input) : input;
      if (!parsed || parsed.format !== FORMAT || parsed.version > VERSION || !parsed.project) throw new Error("Tệp .hhdesign không hợp lệ");
      const sourceId = parsed.project.id;
      const project = await saveProject({ ...parsed.project, id: uid("project"), name: safeName(parsed.project.name), createdAt: now() });
      const idMap = new Map();
      for (const source of Array.isArray(parsed.assets) ? parsed.assets : []) {
        const asset = await saveAsset({ ...source, id: uid("asset"), projectId: project.id, blob: dataUrlToBlob(source.dataUrl) });
        idMap.set(source.id, asset.id);
      }
      await saveProject({ ...project, assetIds: (parsed.project.assetIds || []).map((id) => idMap.get(id)).filter(Boolean) });
      for (const source of Array.isArray(parsed.snapshots) ? parsed.snapshots : []) {
        await withBackend((backend) => backend.put("snapshots", { ...source, id: uid("snapshot"), projectId: project.id, project: { ...source.project, id: project.id } }));
      }
      return { project: await getProject(project.id), sourceId, importedAssets: idMap.size };
    }

    return {
      ready: async () => ({ backend: (await backendPromise).type }),
      saveProject, getProject, listProjects, deleteProject,
      saveAsset, listAssets, removeAsset, validateAssets,
      createSnapshot, listSnapshots, restoreSnapshot, compareSnapshot,
      createBranch, requestReview, setReviewStatus, createAutosaveSession,
      exportPackage, importPackage,
      close: async () => (await backendPromise).close()
    };
  }

  function addStyles() {
    if (typeof document === "undefined" || document.getElementById("hh-project-store-style")) return;
    const style = document.createElement("style");
    style.id = "hh-project-store-style";
    style.textContent = `
      .hps{--cyan:#65dce8;--pink:#f25cb4;--lime:#b9e86c;--ink:#09101a;--panel:#101924;--line:#29394a;--muted:#91a2b5;color:#edf7ff;background:#080d15;border:1px solid var(--line);border-radius:12px;overflow:hidden;font:500 13px/1.45 Inter,system-ui,sans-serif}.hps *{box-sizing:border-box}.hps button,.hps input,.hps select{font:inherit}.hps button{min-height:34px;padding:7px 11px;border:1px solid #395064;border-radius:7px;background:#142130;color:#eaf8ff;cursor:pointer}.hps button:hover,.hps button:focus-visible{border-color:var(--cyan);outline:0;box-shadow:0 0 0 2px rgba(101,220,232,.15)}.hps-primary{background:linear-gradient(135deg,var(--cyan),#a8e99a)!important;color:#071018!important;border:0!important;font-weight:800}.hps-head{display:flex;align-items:center;gap:12px;padding:16px 18px;border-bottom:1px solid var(--line);background:linear-gradient(110deg,rgba(101,220,232,.11),transparent 52%,rgba(242,92,180,.11))}.hps-head h2{margin:0;font-size:18px}.hps-head p{margin:2px 0 0;color:var(--muted);font-size:11px}.hps-head-actions{display:flex;gap:7px;margin-left:auto}.hps-grid{display:grid;grid-template-columns:250px minmax(320px,1fr) 310px;min-height:560px}.hps-pane{padding:14px;border-right:1px solid var(--line);background:rgba(11,18,29,.86)}.hps-pane:last-child{border:0}.hps-pane h3{margin:0 0 10px;color:var(--cyan);font-size:11px;text-transform:uppercase}.hps-list{display:grid;gap:7px}.hps-item{display:block;width:100%;text-align:left}.hps-item.is-active{border-color:var(--pink);background:linear-gradient(100deg,rgba(242,92,180,.16),rgba(101,220,232,.08))}.hps-item strong,.hps-item span{display:block}.hps-item span{margin-top:2px;color:var(--muted);font-size:10px}.hps-card{padding:12px;border:1px solid var(--line);border-radius:9px;background:var(--panel);margin-bottom:10px}.hps-row{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.hps-row+.hps-row{margin-top:8px}.hps input,.hps select{width:100%;min-height:36px;padding:7px 9px;border:1px solid var(--line);border-radius:7px;background:#090f18;color:#edf7ff}.hps-drop{display:grid;place-items:center;min-height:120px;padding:16px;border:1px dashed #4c687d;border-radius:9px;text-align:center;color:var(--muted)}.hps-drop.is-over{border-color:var(--cyan);background:rgba(101,220,232,.08)}.hps-asset{display:grid;grid-template-columns:34px 1fr auto;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid #1c2a39}.hps-asset b{display:grid;place-items:center;width:34px;height:34px;border-radius:7px;background:#172838;color:var(--cyan);font-size:9px}.hps-asset strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.hps-asset small{color:var(--muted)}.hps-warning{padding:8px;border-left:2px solid #f2c15c;background:rgba(242,193,92,.08);margin-top:7px;font-size:11px}.hps-status{color:var(--muted);font-size:11px}.hps-badge{padding:3px 7px;border:1px solid #375167;border-radius:999px;color:var(--cyan);font-size:10px}.hps-empty{padding:28px 12px;text-align:center;color:var(--muted)}
      @media(max-width:1000px){.hps-grid{grid-template-columns:220px 1fr}.hps-pane:last-child{grid-column:1/-1;border-top:1px solid var(--line);display:grid;grid-template-columns:1fr 1fr;gap:12px}}@media(max-width:680px){.hps-head{align-items:flex-start;flex-wrap:wrap}.hps-head-actions{width:100%;margin-left:0;overflow:auto}.hps-grid{display:block}.hps-pane{border-right:0;border-bottom:1px solid var(--line)}.hps-pane:last-child{display:block}.hps-row>*{flex:1 1 120px}}@media(prefers-reduced-motion:reduce){.hps *{animation-duration:.001ms!important;transition-duration:.001ms!important}}
    `;
    document.head.appendChild(style);
  }

  function download(text, filename, type) {
    const url = URL.createObjectURL(new Blob([text], { type: type || "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = filename; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async function mount(root, options) {
    if (!root || typeof root.querySelector !== "function") return null;
    if (instances.has(root)) return instances.get(root);
    addStyles();
    const store = options?.store || createStore(options);
    root.classList.add("hps");
    root.innerHTML = `<header class="hps-head"><div><h2>Project & Version System</h2><p>IndexedDB · autosave · snapshot · branch · Asset Manager · .hhdesign</p></div><div class="hps-head-actions"><button type="button" data-hps-new>Dự án mới</button><button type="button" data-hps-import>Nhập .hhdesign</button><button type="button" class="hps-primary" data-hps-export>Xuất gói</button></div></header><div class="hps-grid"><aside class="hps-pane"><h3>Dự án</h3><div class="hps-list" data-hps-projects></div></aside><main class="hps-pane"><div data-hps-editor class="hps-empty">Đang mở kho dự án…</div></main><aside class="hps-pane"><section><h3>Phiên bản</h3><div data-hps-versions></div></section><section><h3>Cảnh báo asset</h3><div data-hps-warnings></div></section></aside></div><input hidden type="file" accept=".hhdesign,application/json" data-hps-import-file><input hidden type="file" multiple accept="image/*,video/*,.ttf,.otf,.woff,.woff2,.svg,.json,.lottie,.glb,.gltf" data-hps-asset-file><div class="hps-status" role="status" aria-live="polite" data-hps-status></div>`;
    let selectedId = null;
    let projects = [];
    let session = null;
    const qs = (selector) => root.querySelector(selector);
    const status = (message) => { qs("[data-hps-status]").textContent = message; };

    async function ensureProject() {
      projects = await store.listProjects();
      if (!projects.length) projects = [await store.saveProject({ name: "Dự án thiết kế đầu tiên", data: { canvas: { width: 1920, height: 1080 } } })];
      if (!selectedId || !projects.some((project) => project.id === selectedId)) selectedId = projects[0].id;
    }

    async function renderProjects() {
      projects = await store.listProjects();
      qs("[data-hps-projects]").innerHTML = projects.map((project) => `<button type="button" class="hps-item ${project.id === selectedId ? "is-active" : ""}" data-hps-project="${escapeHtml(project.id)}"><strong>${escapeHtml(project.name)}</strong><span>${escapeHtml(project.branch)} · ${escapeHtml(project.status)} · ${new Date(project.updatedAt).toLocaleString("vi-VN")}</span></button>`).join("");
    }

    async function renderEditor() {
      const project = await store.getProject(selectedId);
      if (!project) return;
      const assets = await store.listAssets(selectedId);
      const editor = qs("[data-hps-editor]");
      editor.className = "";
      editor.innerHTML = `<section class="hps-card"><div class="hps-row"><label style="flex:1">Tên dự án<input data-hps-name value="${escapeHtml(project.name)}" maxlength="160"></label><label>Nhánh<input data-hps-branch value="${escapeHtml(project.branch)}" maxlength="80"></label><label>Trạng thái<select data-hps-review><option value="draft">Bản nháp</option><option value="review">Chờ duyệt</option><option value="approved">Đã duyệt</option><option value="changes-requested">Cần sửa</option></select></label></div><div class="hps-row"><button type="button" data-hps-snapshot>Tạo snapshot</button><button type="button" data-hps-branch-new>Tạo nhánh</button><button type="button" data-hps-review-request>Gửi duyệt</button><span class="hps-badge">Autosave phiên</span></div></section><section class="hps-card"><h3>Asset Manager</h3><button type="button" class="hps-drop" data-hps-drop><span><strong>Thả font, ảnh, video, SVG, Lottie hoặc GLB</strong><br>Hoặc bấm để chọn từ thiết bị</span></button><div data-hps-assets>${assets.map((asset) => `<div class="hps-asset"><b>${escapeHtml(asset.kind.toUpperCase())}</b><div><strong>${escapeHtml(asset.name)}</strong><small>${(asset.size / 1048576).toFixed(2)} MB · ${escapeHtml(asset.type)}</small></div><button type="button" data-hps-remove-asset="${escapeHtml(asset.id)}" aria-label="Xóa ${escapeHtml(asset.name)}">Xóa</button></div>`).join("") || `<div class="hps-empty">Chưa có asset.</div>`}</div></section>`;
      qs("[data-hps-review]").value = project.status;
      session?.dispose({ flush: true });
      session = store.createAutosaveSession(project.id, { delay: 600, onSaved: () => status("Đã tự lưu phiên làm việc.") });
    }

    async function renderVersions() {
      const snapshots = await store.listSnapshots(selectedId);
      qs("[data-hps-versions]").innerHTML = snapshots.map((snapshot) => `<div class="hps-card"><strong>${escapeHtml(snapshot.label)}</strong><div class="hps-status">${new Date(snapshot.createdAt).toLocaleString("vi-VN")} · ${escapeHtml(snapshot.branch)}</div><div class="hps-row"><button type="button" data-hps-restore="${escapeHtml(snapshot.id)}">Khôi phục</button><button type="button" data-hps-diff="${escapeHtml(snapshot.id)}">So sánh</button></div></div>`).join("") || `<div class="hps-empty">Chưa có snapshot.</div>`;
      const warnings = await store.validateAssets(selectedId);
      qs("[data-hps-warnings]").innerHTML = warnings.map((warning) => `<div class="hps-warning">${escapeHtml(warning.message)}</div>`).join("") || `<div class="hps-status">Tất cả asset hợp lệ.</div>`;
    }

    async function render() {
      await ensureProject(); await renderProjects(); await renderEditor(); await renderVersions();
    }

    async function addFiles(files) {
      for (const file of files) await store.saveAsset({ projectId: selectedId, name: file.name, type: file.type, size: file.size, blob: file });
      status(`Đã thêm ${files.length} asset vào IndexedDB.`); await renderEditor(); await renderVersions();
    }

    const onClick = async (event) => {
      const target = event.target.closest("button"); if (!target || !root.contains(target)) return;
      if (target.dataset.hpsProject) { await session?.dispose(); selectedId = target.dataset.hpsProject; return render(); }
      if (target.matches("[data-hps-new]")) { const project = await store.saveProject({ name: `Dự án ${projects.length + 1}` }); selectedId = project.id; return render(); }
      if (target.matches("[data-hps-import]")) return qs("[data-hps-import-file]").click();
      if (target.matches("[data-hps-export]")) { const project = await store.getProject(selectedId); download(await store.exportPackage(selectedId), `${project.name.replace(/[^a-z0-9]+/gi, "-") || "project"}.hhdesign`); return status("Đã đóng gói project và asset."); }
      if (target.matches("[data-hps-drop]")) return qs("[data-hps-asset-file]").click();
      if (target.dataset.hpsRemoveAsset) { await store.removeAsset(target.dataset.hpsRemoveAsset); return render(); }
      if (target.matches("[data-hps-snapshot]")) { await session?.flush(); await store.createSnapshot(selectedId, `Snapshot ${new Date().toLocaleTimeString("vi-VN")}`); status("Đã tạo snapshot bất biến."); return renderVersions(); }
      if (target.matches("[data-hps-branch-new]")) { const project = await store.createBranch(selectedId, `feature-${Date.now().toString(36)}`); selectedId = project.id; status("Đã tạo nhánh thiết kế mới."); return render(); }
      if (target.matches("[data-hps-review-request]")) { await store.requestReview(selectedId); status("Đã chuyển dự án sang chờ duyệt."); return render(); }
      if (target.dataset.hpsRestore) { await store.restoreSnapshot(target.dataset.hpsRestore); status("Đã khôi phục snapshot."); return render(); }
      if (target.dataset.hpsDiff) { const changes = await store.compareSnapshot(target.dataset.hpsDiff, selectedId); return status(`Có ${changes.length} thay đổi so với snapshot.`); }
    };
    const onInput = async (event) => {
      if (!event.target.matches("[data-hps-name],[data-hps-branch]")) return;
      const project = await store.getProject(selectedId);
      session?.schedule({ ...project, name: qs("[data-hps-name]").value, branch: qs("[data-hps-branch]").value });
      status("Đang chờ tự lưu…");
    };
    const onChange = async (event) => {
      if (event.target.matches("[data-hps-review]")) { await store.setReviewStatus(selectedId, event.target.value); status("Đã cập nhật trạng thái duyệt."); return renderProjects(); }
      if (event.target.matches("[data-hps-asset-file]") && event.target.files.length) return addFiles([...event.target.files]);
      if (event.target.matches("[data-hps-import-file]") && event.target.files[0]) { const result = await store.importPackage(await event.target.files[0].text()); selectedId = result.project.id; status(`Đã nhập ${result.importedAssets} asset.`); return render(); }
    };
    const dragTarget = (event) => event.target.closest && event.target.closest("[data-hps-drop]");
    const onDragOver = (event) => { const drop = dragTarget(event); if (!drop) return; event.preventDefault(); drop.classList.add("is-over"); };
    const onDragLeave = (event) => { const drop = dragTarget(event); if (drop) drop.classList.remove("is-over"); };
    const onDrop = (event) => { const drop = dragTarget(event); if (!drop) return; event.preventDefault(); drop.classList.remove("is-over"); addFiles([...event.dataTransfer.files]); };
    root.addEventListener("click", onClick); root.addEventListener("input", onInput); root.addEventListener("change", onChange);
    root.addEventListener("dragover", onDragOver); root.addEventListener("dragleave", onDragLeave); root.addEventListener("drop", onDrop);
    await render();
    const controller = { store, getProject: () => store.getProject(selectedId), render, async unmount() { await session?.dispose(); root.removeEventListener("click", onClick); root.removeEventListener("input", onInput); root.removeEventListener("change", onChange); root.removeEventListener("dragover", onDragOver); root.removeEventListener("dragleave", onDragLeave); root.removeEventListener("drop", onDrop); root.replaceChildren(); root.classList.remove("hps"); instances.delete(root); } };
    instances.set(root, controller);
    return controller;
  }

  function unmount(root) {
    const controller = instances.get(root);
    if (!controller) return false;
    controller.unmount();
    return true;
  }

  const api = Object.freeze({
    VERSION, FORMAT, DB_NAME, DB_VERSION, MAX_ASSET_BYTES, STORE_NAMES,
    normalizeProject, normalizeAsset, assetKind, diff, createMemoryBackend, createStore,
    blobToDataUrl, dataUrlToBlob, mount, unmount
  });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  globalScope.HHGraphicProjectStore = api;
}(typeof globalThis !== "undefined" ? globalThis : this));
