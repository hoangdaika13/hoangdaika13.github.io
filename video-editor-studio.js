(() => {
  "use strict";

  const base = window.HHMediaDesign;
  if (!base) return;

  const TOOL = "Video Editor";
  const PROJECT_KEY = "hh.video-editor.project.v1";
  const DB_NAME = "hh-video-editor-media";
  const DB_STORE = "assets";
  const $ = (root, selector) => root?.querySelector(selector);
  const $$ = (root, selector) => [...(root?.querySelectorAll(selector) || [])];
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const uid = (prefix) => `${prefix}-${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
  const formatTime = (value, frames = false) => {
    const seconds = Math.max(0, Number(value) || 0), hours = Math.floor(seconds / 3600), minutes = Math.floor(seconds % 3600 / 60), secs = Math.floor(seconds % 60);
    const baseTime = [hours, minutes, secs].map((part) => String(part).padStart(2, "0")).join(":");
    return frames ? `${baseTime}:${String(Math.floor(seconds % 1 * 30)).padStart(2, "0")}` : `${minutes}:${String(seconds % 60).padStart(4, "0")}`;
  };
  const bytes = (value) => value < 1048576 ? `${(value / 1024).toFixed(1)} KB` : `${(value / 1048576).toFixed(1)} MB`;
  const defaultProject = () => ({
    name: "HH Sequence 01", width: 1920, height: 1080, fps: 30, zoom: 18, playhead: 0, tool: "select", snap: true,
    clips: [], titles: [], markers: [], selected: "", disabledTracks: [], lockedTracks: [], monitorMode: "program", history: [], historyIndex: -1
  });
  const state = { outer: null, work: null, project: defaultProject(), assets: [], urls: [], playing: false, raf: 0, lastFrame: 0, activeClip: "", recorder: null, chunks: [], exporting: false, drag: null, lucidePromise: null };

  const openDb = () => new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(DB_STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const dbPut = async (record) => { const db = await openDb(); await new Promise((resolve, reject) => { const tx = db.transaction(DB_STORE, "readwrite"); tx.objectStore(DB_STORE).put(record); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); db.close(); };
  const dbList = async () => { const db = await openDb(); const rows = await new Promise((resolve, reject) => { const request = db.transaction(DB_STORE).objectStore(DB_STORE).getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); db.close(); return rows; };
  const dbDelete = async (id) => { const db = await openDb(); await new Promise((resolve, reject) => { const tx = db.transaction(DB_STORE, "readwrite"); tx.objectStore(DB_STORE).delete(id); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); db.close(); };

  const ensureLucide = () => {
    const render = () => window.lucide?.createIcons?.({ attrs: { width: 15, height: 15, "stroke-width": 1.75 } });
    if (window.lucide) { render(); return Promise.resolve(); }
    if (!state.lucidePromise) state.lucidePromise = new Promise((resolve) => {
      const script = document.createElement("script"); script.src = "vendor/lucide.min.js?v=1.24.0"; script.onload = resolve; script.onerror = resolve; document.head.append(script);
    });
    return state.lucidePromise.then(render);
  };
  const icon = (name) => `<i data-lucide="${name}"></i>`;
  const action = (id, label, iconName, shortcut = "") => `<button type="button" data-ve-action="${id}" title="${label}${shortcut ? ` (${shortcut})` : ""}">${icon(iconName)}<span>${label}</span>${shortcut ? `<kbd>${shortcut}</kbd>` : ""}</button>`;
  const menu = (label, rows) => `<details class="ve-menu"><summary>${label}</summary><div>${rows.join("")}</div></details>`;

  function markup() {
    return `<div class="ve-app" data-ve-editor>
      <header class="ve-menubar">
        <div class="ve-brand">${icon("clapperboard")}<b>HH</b><span>Video Editor</span></div>
        ${menu("File", [action("new", "Project mới", "file-plus-2", "Ctrl+N"), action("import", "Nhập media", "folder-input", "Ctrl+I"), action("project-open", "Mở project JSON", "folder-open"), action("save", "Lưu project", "save", "Ctrl+S"), action("project-export", "Xuất project JSON", "file-json"), action("render", "Export Media", "share-2", "Ctrl+M")])}
        ${menu("Edit", [action("undo", "Undo", "undo-2", "Ctrl+Z"), action("redo", "Redo", "redo-2", "Ctrl+Shift+Z"), action("duplicate", "Duplicate", "copy", "Ctrl+D"), action("delete", "Delete", "trash-2", "Delete")])}
        ${menu("Clip", [action("split", "Add Edit", "scissors", "Ctrl+K"), action("trim-start", "Trim Start to Playhead", "move-left"), action("trim-end", "Trim End to Playhead", "move-right"), action("speed", "Speed / Duration", "gauge")])}
        ${menu("Sequence", [action("sequence-start", "Go to Start", "skip-back", "Home"), action("sequence-end", "Go to End", "skip-forward", "End"), action("render", "Render Sequence", "film")])}
        ${menu("Markers", [action("marker", "Add Marker", "map-pin", "M"), action("marker-clear", "Clear Markers", "map-pin-off")])}
        ${menu("Graphics", [action("title", "New Title", "type", "T"), action("caption", "Caption Card", "subtitles")])}
        ${menu("Window", [action("fullscreen", "Fullscreen", "maximize-2"), action("reset-layout", "Reset Workspace", "panels-top-left")])}
        ${menu("Help", [action("shortcuts", "Keyboard Shortcuts", "keyboard"), action("about", "About Engine", "info")])}
        <span class="ve-menu-spacer"></span><strong data-ve-project-name>HH Sequence 01</strong>
        <button class="ve-export" type="button" data-ve-action="render">${icon("share-2")} Export</button>
      </header>
      <div class="ve-toolbar">
        ${action("import", "Import", "folder-input")}${action("save", "Save", "save")}${action("undo", "Undo", "undo-2")}${action("redo", "Redo", "redo-2")}
        <span></span><label>Workspace<select data-ve-workspace><option>Editing</option><option>Color</option><option>Audio</option><option>Graphics</option></select></label>
        <label>Sequence<select data-ve-sequence><option value="1920x1080">Full HD 1920×1080</option><option value="1280x720">HD 1280×720</option><option value="1080x1920">Vertical 1080×1920</option><option value="1080x1080">Square 1080×1080</option></select></label>
        <label class="ve-snap"><input type="checkbox" data-ve-snap checked>${icon("magnet")} Snap</label>
      </div>
      <main class="ve-workspace">
        <section class="ve-panel ve-project-panel">
          <header><div class="ve-tabs"><button class="is-active" data-ve-panel-tab="project">Project</button><button data-ve-panel-tab="effects">Effects</button><button data-ve-panel-tab="audio">Audio</button></div><button data-ve-action="import" title="Import media">${icon("plus")}</button></header>
          <div class="ve-panel-pane is-active" data-ve-panel="project">
            <label class="ve-search">${icon("search")}<input type="search" data-ve-search placeholder="Search project"></label>
            <div class="ve-bin-head"><span>Name</span><span>Duration</span></div><div class="ve-assets" data-ve-assets></div>
          </div>
          <div class="ve-panel-pane" data-ve-panel="effects" hidden>
            <label class="ve-search">${icon("search")}<input type="search" data-ve-effect-search placeholder="Search effects"></label>
            <div class="ve-effects">${[["none","Reset","circle-off"],["cinema","Lumetri Cinema","film"],["vivid","Vibrance","sun"],["mono","Black & White","contrast"],["warm","Warm Look","sunset"],["cool","Cool Look","snowflake"],["blur","Gaussian Blur","droplets"],["fade","Dip to Black","circle-dot"]].map(([id,label,name]) => `<button data-ve-effect="${id}">${icon(name)}<span>${label}</span></button>`).join("")}</div>
          </div>
          <div class="ve-panel-pane" data-ve-panel="audio" hidden><div class="ve-audio-mixer"><header><strong>Audio Track Mixer</strong><span>A1</span></header><div class="ve-meter"><i data-ve-meter-left></i><i data-ve-meter-right></i></div><label>Master <input type="range" min="0" max="150" value="100" data-ve-master-volume><b data-ve-master-value>0.0 dB</b></label><button data-ve-action="normalize">Auto Normalize</button></div></div>
          <footer><span data-ve-asset-count>0 items</span><button data-ve-action="asset-view">${icon("list")}</button><button data-ve-action="asset-clear">${icon("trash-2")}</button></footer>
        </section>

        <section class="ve-monitor-panel">
          <header class="ve-monitor-tabs"><button class="is-active" data-ve-monitor-tab="source">Source</button><button data-ve-monitor-tab="program">Program: <span data-ve-sequence-name>HH Sequence 01</span></button><span></span><button data-ve-action="safe-margins" title="Safe margins">${icon("scan")}</button><button data-ve-action="monitor-settings" title="Monitor settings">${icon("settings-2")}</button></header>
          <div class="ve-monitor" data-ve-monitor>
            <video data-ve-video playsinline preload="metadata"></video>
            <canvas data-ve-export-canvas width="1280" height="720" hidden></canvas>
            <div class="ve-safe-margins" data-ve-safe hidden><i></i></div>
            <div class="ve-title-overlay" data-ve-title-overlay></div>
            <div class="ve-monitor-empty" data-ve-empty>${icon("film")}<strong>Program Monitor</strong><span>Import media hoặc kéo clip vào timeline</span><button data-ve-action="import">Import media</button></div>
          </div>
          <div class="ve-monitor-controls">
            <span data-ve-inout>In --:-- · Out --:--</span><div>${action("prev-edit", "Previous Edit", "skip-back")}${action("step-back", "Step Back", "step-back")}${action("play", "Play / Pause", "play")}${action("step-forward", "Step Forward", "step-forward")}${action("next-edit", "Next Edit", "skip-forward")}${action("marker", "Marker", "map-pin")}</div><strong data-ve-timecode>00:00:00:00</strong>
          </div>
        </section>

        <aside class="ve-panel ve-properties">
          <header><div class="ve-tabs"><button class="is-active" data-ve-inspector-tab="effect">Effect Controls</button><button data-ve-inspector-tab="graphics">Graphics</button><button data-ve-inspector-tab="metadata">Metadata</button></div></header>
          <div class="ve-inspector-pane is-active" data-ve-inspector="effect"><div data-ve-properties-empty><strong>No clip selected</strong><span>Select a clip in the timeline.</span></div><form data-ve-properties hidden>
            <section><header>${icon("move-3d")}<strong>Motion</strong><button type="button" data-ve-action="reset-motion">Reset</button></header><div class="ve-property-grid"><label>Position X<input type="number" data-ve-prop="x"></label><label>Position Y<input type="number" data-ve-prop="y"></label><label>Scale<input type="number" min="10" max="400" data-ve-prop="scale"></label><label>Rotation<input type="number" min="-360" max="360" data-ve-prop="rotation"></label></div></section>
            <section><header>${icon("blend")}<strong>Opacity</strong></header><label>Opacity <b data-ve-value="opacity">100%</b><input type="range" min="0" max="100" data-ve-prop="opacity"></label><label>Blend mode<select data-ve-prop="blend"><option>Normal</option><option>Multiply</option><option>Screen</option><option>Overlay</option></select></label></section>
            <section><header>${icon("timer")}<strong>Time Remapping</strong></header><div class="ve-property-grid"><label>Start<input type="number" min="0" step="0.01" data-ve-prop="start"></label><label>Speed %<input type="number" min="10" max="800" data-ve-prop="speed"></label><label>Source In<input type="number" min="0" step="0.01" data-ve-prop="in"></label><label>Source Out<input type="number" min="0" step="0.01" data-ve-prop="out"></label></div></section>
            <section><header>${icon("volume-2")}<strong>Volume</strong></header><label>Level <b data-ve-value="volume">100%</b><input type="range" min="0" max="150" data-ve-prop="volume"></label><label><input type="checkbox" data-ve-prop="muted"> Mute clip</label></section>
          </form></div>
          <div class="ve-inspector-pane" data-ve-inspector="graphics" hidden><section class="ve-graphics"><header><strong>Essential Graphics</strong><button data-ve-action="title">New Layer</button></header><label>Text<textarea rows="3" data-ve-title-text>HH CREATIVE</textarea></label><div class="ve-property-grid"><label>Font size<input type="number" min="12" max="240" value="64" data-ve-title-size></label><label>Color<input type="color" value="#ffffff" data-ve-title-color></label><label>Background<input type="color" value="#111827" data-ve-title-bg></label><label>Position<select data-ve-title-position><option value="center">Center</option><option value="lower">Lower Third</option><option value="top">Top</option></select></label></div><button data-ve-action="title">Add to Timeline</button></section><div class="ve-title-list" data-ve-title-list></div></div>
          <div class="ve-inspector-pane" data-ve-inspector="metadata" hidden><dl data-ve-metadata><dt>Project</dt><dd>Local project</dd><dt>Frame rate</dt><dd>30 fps</dd><dt>Color</dt><dd>Rec. 709</dd></dl></div>
        </aside>

        <section class="ve-timeline-panel">
          <header class="ve-timeline-toolbar">
            <div class="ve-toolbox">${[["select","mouse-pointer-2","V"],["track","move-horizontal","A"],["razor","scissors","C"],["slip","move","Y"],["hand","hand","H"],["zoom","search","Z"]].map(([id,name,key]) => `<button class="${id === "select" ? "is-active" : ""}" data-ve-tool="${id}" title="${id} (${key})">${icon(name)}<kbd>${key}</kbd></button>`).join("")}</div>
            <div class="ve-sequence-actions">${action("split", "Add Edit", "scissors")}${action("title", "Title", "type")}${action("marker", "Marker", "map-pin")}${action("ripple-delete", "Ripple Delete", "between-horizontal-end")}</div>
            <label>${icon("zoom-out")}<input type="range" min="6" max="70" value="18" data-ve-zoom>${icon("zoom-in")}</label><strong data-ve-duration>00:00:00:00</strong>
          </header>
          <div class="ve-timeline" data-ve-timeline>
            <aside class="ve-track-heads"><div class="ve-ruler-head">Tracks</div>${["V2","V1","A1"].map((track) => `<div><b>${track}</b><button data-ve-track-toggle="${track}" title="Track output">${track === "A1" ? icon("volume-2") : icon("eye")}</button><button data-ve-track-lock="${track}" title="Lock track">${icon("lock-open")}</button></div>`).join("")}</aside>
            <div class="ve-track-scroll" data-ve-track-scroll><div class="ve-track-content" data-ve-track-content><div class="ve-ruler" data-ve-ruler></div><div class="ve-markers" data-ve-markers></div><div class="ve-track ve-track-v2" data-ve-track="V2"></div><div class="ve-track ve-track-v1" data-ve-track="V1"></div><div class="ve-track ve-track-a1" data-ve-track="A1"></div><div class="ve-playhead" data-ve-playhead><i></i></div></div></div>
          </div>
          <footer><span data-ve-status>Ready · files stay on this device</span><span>Sequence: <b data-ve-footer-sequence>1920×1080 · 30fps</b></span><span>Selected: <b data-ve-selected-label>None</b></span></footer>
        </section>
      </main>
      <input type="file" accept="video/*,audio/*" multiple data-ve-file hidden><input type="file" accept="application/json,.json" data-ve-project-file hidden>
      <div class="ve-dialog" data-ve-dialog="shortcuts" hidden><section><header>${icon("keyboard")}<div><strong>Keyboard Shortcuts</strong><span>Editing workspace</span></div><button data-ve-action="dialog-close">${icon("x")}</button></header><div class="ve-shortcuts">${[["Space","Play / Pause"],["V","Selection Tool"],["C","Razor Tool"],["Ctrl K","Add Edit"],["I / O","Mark In / Out"],["M","Add Marker"],["J K L","Shuttle playback"],["← / →","Previous / Next frame"],["↑ / ↓","Previous / Next edit"],["Home / End","Sequence bounds"],["Ctrl Z","Undo"],["Ctrl Shift Z","Redo"],["Delete","Delete clip"],["Shift Delete","Ripple delete"],["Ctrl D","Duplicate clip"],["Ctrl S","Save project"],["Ctrl M","Export media"],["+ / -","Timeline zoom"]].map(([key,label]) => `<span><kbd>${key}</kbd>${label}</span>`).join("")}</div></section></div>
      <div class="ve-dialog" data-ve-dialog="export" hidden><section><header>${icon("share-2")}<div><strong>Export Media</strong><span>Render sequence in real time</span></div><button data-ve-action="dialog-close">${icon("x")}</button></header><div class="ve-export-settings"><label>File name<input value="hh-sequence" data-ve-export-name></label><label>Format<select data-ve-export-format><option value="video/webm;codecs=vp9,opus">WebM · VP9</option><option value="video/webm;codecs=vp8,opus">WebM · VP8</option></select></label><label>Resolution<select data-ve-export-size><option value="1280x720">1280 × 720</option><option value="1920x1080">1920 × 1080</option><option value="1080x1920">1080 × 1920</option><option value="1080x1080">1080 × 1080</option></select></label><label>Video bitrate<select data-ve-export-bitrate><option value="4000000">4 Mbps</option><option value="8000000">8 Mbps</option><option value="12000000">12 Mbps</option></select></label><p>Export chạy theo thời lượng thực của timeline. Trình duyệt sẽ tạo WebM và tự tải xuống khi hoàn tất.</p><div class="ve-export-progress"><i data-ve-export-progress></i><span data-ve-export-status>Ready to export</span></div></div><footer><button data-ve-action="dialog-close">Cancel</button><button class="is-primary" data-ve-action="render-confirm">Export</button></footer></section></div>
    </div>`;
  }

  function projectDuration() {
    const clipEnd = state.project.clips.reduce((max, clip) => Math.max(max, clip.start + (clip.out - clip.in) / clip.speed), 0);
    const titleEnd = state.project.titles.reduce((max, title) => Math.max(max, title.start + title.duration), 0);
    return Math.max(clipEnd, titleEnd, state.project.clips.length || state.project.titles.length ? .1 : 5);
  }
  const clipById = (id = state.project.selected) => state.project.clips.find((clip) => clip.id === id);
  const titleById = (id = state.project.selected) => state.project.titles.find((title) => title.id === id);
  const assetById = (id) => state.assets.find((asset) => asset.id === id);
  const clipDuration = (clip) => Math.max(.04, (clip.out - clip.in) / clip.speed);
  const snapshot = () => JSON.parse(JSON.stringify({ clips: state.project.clips, titles: state.project.titles, markers: state.project.markers, selected: state.project.selected }));
  function pushHistory(label) {
    state.project.history.splice(state.project.historyIndex + 1);
    state.project.history.push({ label, at: Date.now(), value: snapshot() });
    if (state.project.history.length > 50) state.project.history.shift();
    state.project.historyIndex = state.project.history.length - 1;
  }
  function restoreHistory(index) {
    const entry = state.project.history[index]; if (!entry) return;
    Object.assign(state.project, JSON.parse(JSON.stringify(entry.value))); state.project.historyIndex = index; renderAll(); status(`Undo: ${entry.label}`);
  }
  function status(message, kind = "info") { const node = $(state.work, "[data-ve-status]"); if (node) { node.textContent = message; node.dataset.state = kind; } }
  function saveProject(notify = true) {
    const saved = { ...state.project, history: [], historyIndex: -1, savedAt: new Date().toISOString() };
    localStorage.setItem(PROJECT_KEY, JSON.stringify(saved));
    if (notify) status("Project saved locally.", "success");
  }
  function loadSavedProject() {
    try { const saved = JSON.parse(localStorage.getItem(PROJECT_KEY) || "null"); if (saved) state.project = { ...defaultProject(), ...saved, history: [], historyIndex: -1 }; } catch {}
  }
  function downloadBlob(blob, name) { const anchor = document.createElement("a"); const url = URL.createObjectURL(blob); state.urls.push(url); anchor.href = url; anchor.download = name; anchor.click(); }

  async function assetDuration(url, type) {
    if (!type.startsWith("video") && !type.startsWith("audio")) return 5;
    return new Promise((resolve) => { const media = document.createElement(type.startsWith("audio") ? "audio" : "video"); media.preload = "metadata"; media.onloadedmetadata = () => resolve(Number.isFinite(media.duration) ? media.duration : 5); media.onerror = () => resolve(5); media.src = url; });
  }
  async function importFiles(files) {
    const accepted = files.filter((file) => file.type.startsWith("video/") || file.type.startsWith("audio/"));
    for (const file of accepted) {
      const id = uid("asset"), url = URL.createObjectURL(file), duration = await assetDuration(url, file.type);
      state.urls.push(url); state.assets.push({ id, name: file.name, type: file.type, size: file.size, duration, url, file });
      await dbPut({ id, name: file.name, type: file.type, size: file.size, duration, file });
    }
    renderAssets(); status(`Imported ${accepted.length} media file(s).`, "success");
    if (!state.project.clips.length && accepted.length) addAssetToTimeline(state.assets.at(-accepted.length).id);
  }
  async function restoreAssets() {
    try {
      const records = await dbList();
      records.forEach((record) => { const url = URL.createObjectURL(record.file); state.urls.push(url); state.assets.push({ ...record, url }); });
      renderAssets(); renderTimeline(); syncPreview(true);
    } catch (error) { status(`IndexedDB unavailable: ${error.message}`, "error"); }
  }
  function addAssetToTimeline(assetId, requestedStart, requestedTrack) {
    const asset = assetById(assetId); if (!asset) return;
    const start = Number.isFinite(requestedStart) ? Math.max(0, requestedStart) : state.project.clips.reduce((max, clip) => Math.max(max, clip.start + clipDuration(clip)), 0);
    const defaultTrack = asset.type.startsWith("audio") ? "A1" : "V1", track = requestedTrack === "A1" ? "A1" : defaultTrack;
    const clip = { id: uid("clip"), assetId, name: asset.name, start, in: 0, out: Math.max(.04, asset.duration), speed: 1, volume: 1, muted: false, opacity: 1, scale: 100, x: 0, y: 0, rotation: 0, blend: "Normal", effect: "none", track, color: asset.type.startsWith("audio") ? "#48b989" : ["#4b8fd8", "#8f6ed5", "#d05a9d", "#d18a45"][state.project.clips.length % 4] };
    state.project.clips.push(clip); state.project.selected = clip.id; pushHistory("Add clip"); renderAll(); syncPreview(true);
  }
  function removeSelected(ripple = false) {
    const clip = clipById(); const title = titleById(); if (!clip && !title) return;
    const removedStart = (clip || title).start, removedDuration = clip ? clipDuration(clip) : title.duration;
    state.project.clips = state.project.clips.filter((item) => item.id !== state.project.selected);
    state.project.titles = state.project.titles.filter((item) => item.id !== state.project.selected);
    if (ripple) state.project.clips.forEach((item) => { if (item.start > removedStart) item.start = Math.max(0, item.start - removedDuration); });
    state.project.selected = ""; pushHistory(ripple ? "Ripple delete" : "Delete"); renderAll(); syncPreview(true);
  }
  function splitSelected() {
    const clip = clipById(); if (!clip) return;
    const offset = state.project.playhead - clip.start;
    if (offset <= .04 || offset >= clipDuration(clip) - .04) return status("Move playhead inside the selected clip to split.", "error");
    const sourceAt = clip.in + offset * clip.speed, next = { ...clip, id: uid("clip"), start: state.project.playhead, in: sourceAt, name: `${clip.name} B` };
    clip.out = sourceAt; clip.name = clip.name.replace(/ [AB]$/, "") + " A"; state.project.clips.push(next); state.project.selected = next.id; pushHistory("Add Edit"); renderAll();
  }
  function duplicateSelected() {
    const clip = clipById(); const title = titleById(); const item = clip || title; if (!item) return;
    const copy = { ...item, id: uid(clip ? "clip" : "title"), start: item.start + (clip ? clipDuration(clip) : item.duration), name: `${item.name || "Title"} Copy` };
    (clip ? state.project.clips : state.project.titles).push(copy); state.project.selected = copy.id; pushHistory("Duplicate"); renderAll();
  }
  function addTitle(caption = false) {
    const text = caption ? "Caption text" : ($(state.work, "[data-ve-title-text]")?.value || "HH CREATIVE");
    const title = { id: uid("title"), name: caption ? "Caption" : "Title", text, start: state.project.playhead, duration: caption ? 3 : 5, size: Number($(state.work, "[data-ve-title-size]")?.value || 64), color: $(state.work, "[data-ve-title-color]")?.value || "#ffffff", background: $(state.work, "[data-ve-title-bg]")?.value || "#111827", position: $(state.work, "[data-ve-title-position]")?.value || (caption ? "lower" : "center") };
    state.project.titles.push(title); state.project.selected = title.id; pushHistory("Add title"); renderAll(); syncPreview();
  }
  function addMarker() { state.project.markers.push({ id: uid("marker"), time: state.project.playhead, name: `Marker ${state.project.markers.length + 1}`, color: "#59d7e8" }); pushHistory("Add marker"); renderTimeline(); }

  function renderAssets(query = "") {
    const list = $(state.work, "[data-ve-assets]"); if (!list) return;
    const term = query.toLowerCase(); const rows = state.assets.filter((asset) => asset.name.toLowerCase().includes(term));
    list.innerHTML = rows.length ? rows.map((asset) => `<article draggable="true" data-ve-asset="${asset.id}"><span>${icon(asset.type.startsWith("audio") ? "audio-waveform" : "film")}</span><button type="button" data-ve-action="asset-add" data-asset-id="${asset.id}"><strong>${esc(asset.name)}</strong><small>${bytes(asset.size)} · ${asset.type.split("/")[1]?.toUpperCase()}</small></button><b>${formatTime(asset.duration)}</b><button data-ve-action="asset-remove" data-asset-id="${asset.id}" title="Remove">${icon("x")}</button></article>`).join("") : `<div class="ve-bin-empty">${icon("folder-open")}<strong>Project bin is empty</strong><span>Import video or audio from this device.</span><button data-ve-action="import">Import media</button></div>`;
    $(state.work, "[data-ve-asset-count]").textContent = `${state.assets.length} items`; ensureLucide();
  }
  function timelineWidth() { return Math.max(900, Math.ceil(projectDuration() + 12) * state.project.zoom); }
  function renderTimeline() {
    if (!state.work) return;
    const width = timelineWidth(), content = $(state.work, "[data-ve-track-content]"); content.style.width = `${width}px`;
    const duration = projectDuration(), ruler = $(state.work, "[data-ve-ruler]");
    ruler.innerHTML = Array.from({ length: Math.ceil(duration + 12) }, (_, second) => `<span style="left:${second * state.project.zoom}px"><i></i>${second % 5 === 0 ? formatTime(second) : ""}</span>`).join("");
    ["V2", "V1", "A1"].forEach((track) => {
      const node = $(state.work, `[data-ve-track="${track}"]`), clips = state.project.clips.filter((clip) => track === "A1" ? clip.track === "A1" || (clip.track === "V1" && assetById(clip.assetId)?.type.startsWith("video")) : clip.track === track);
      const clipMarkup = clips.map((clip) => `<button class="ve-clip ${state.project.selected === clip.id ? "is-selected" : ""}" style="left:${clip.start * state.project.zoom}px;width:${Math.max(26, clipDuration(clip) * state.project.zoom)}px;--clip-color:${clip.color}" data-ve-clip="${clip.id}" data-ve-clip-track="${track}"><i data-ve-trim="start"></i><span>${track === "A1" ? icon("audio-waveform") : icon("film")}<b>${esc(clip.name)}</b></span><small>${formatTime(clipDuration(clip))}</small><i data-ve-trim="end"></i></button>`).join("");
      const titleMarkup = track === "V2" ? state.project.titles.map((title) => `<button class="ve-clip ve-title-clip ${state.project.selected === title.id ? "is-selected" : ""}" style="left:${title.start * state.project.zoom}px;width:${Math.max(28, title.duration * state.project.zoom)}px" data-ve-title="${title.id}">${icon("type")}<b>${esc(title.text)}</b></button>`).join("") : "";
      node.innerHTML = clipMarkup + titleMarkup;
    });
    $(state.work, "[data-ve-markers]").innerHTML = state.project.markers.map((marker) => `<button style="left:${marker.time * state.project.zoom}px" data-ve-marker="${marker.id}" title="${esc(marker.name)} · ${formatTime(marker.time, true)}"><i></i></button>`).join("");
    updatePlayhead(); $(state.work, "[data-ve-duration]").textContent = formatTime(duration, true); ensureLucide();
  }
  function renderTitles() {
    const list = $(state.work, "[data-ve-title-list]"); if (!list) return;
    list.innerHTML = state.project.titles.map((title) => `<button class="${state.project.selected === title.id ? "is-active" : ""}" data-ve-title-select="${title.id}"><span>T</span><div><strong>${esc(title.text)}</strong><small>${formatTime(title.start)} · ${title.duration.toFixed(1)}s</small></div></button>`).join("") || "<p>No graphic layers.</p>";
  }
  function renderProperties() {
    const clip = clipById(), form = $(state.work, "[data-ve-properties]"), empty = $(state.work, "[data-ve-properties-empty]");
    form.hidden = !clip; empty.hidden = Boolean(clip);
    if (!clip) return;
    const values = { x: clip.x, y: clip.y, scale: clip.scale, rotation: clip.rotation, opacity: Math.round(clip.opacity * 100), blend: clip.blend, start: clip.start.toFixed(2), speed: Math.round(clip.speed * 100), in: clip.in.toFixed(2), out: clip.out.toFixed(2), volume: Math.round(clip.volume * 100), muted: clip.muted };
    Object.entries(values).forEach(([key, value]) => { const field = $(form, `[data-ve-prop="${key}"]`); if (field) field.type === "checkbox" ? field.checked = value : field.value = value; });
    $(state.work, '[data-ve-value="opacity"]').textContent = `${values.opacity}%`; $(state.work, '[data-ve-value="volume"]').textContent = `${values.volume}%`;
  }
  function renderMetadata() {
    const clip = clipById(), asset = clip && assetById(clip.assetId), node = $(state.work, "[data-ve-metadata]"); if (!node) return;
    node.innerHTML = clip && asset ? `<dt>File</dt><dd>${esc(asset.name)}</dd><dt>Media type</dt><dd>${esc(asset.type)}</dd><dt>Source duration</dt><dd>${formatTime(asset.duration, true)}</dd><dt>Clip duration</dt><dd>${formatTime(clipDuration(clip), true)}</dd><dt>Frame rate</dt><dd>${state.project.fps} fps</dd><dt>Storage</dt><dd>IndexedDB · ${bytes(asset.size)}</dd>` : `<dt>Project</dt><dd>${esc(state.project.name)}</dd><dt>Frame rate</dt><dd>${state.project.fps} fps</dd><dt>Color space</dt><dd>Rec. 709</dd><dt>Storage</dt><dd>Local device</dd>`;
  }
  function renderAll() { renderAssets($(state.work, "[data-ve-search]")?.value || ""); renderTimeline(); renderTitles(); renderProperties(); renderMetadata(); const selected = clipById()?.name || titleById()?.text || "None"; $(state.work, "[data-ve-selected-label]").textContent = selected; saveProject(false); }

  function activeTitle(time = state.project.playhead) { return state.project.disabledTracks.includes("V2") ? null : state.project.titles.find((title) => time >= title.start && time < title.start + title.duration); }
  function activeTimelineClip(time = state.project.playhead) { const video = state.project.disabledTracks.includes("V1") ? null : state.project.clips.filter((clip) => clip.track === "V1" && time >= clip.start && time < clip.start + clipDuration(clip)).sort((a, b) => b.start - a.start)[0]; return video || (state.project.disabledTracks.includes("A1") ? null : state.project.clips.find((clip) => clip.track === "A1" && time >= clip.start && time < clip.start + clipDuration(clip))); }
  function applyPreviewStyle(clip) {
    const video = $(state.work, "[data-ve-video]"); if (!video || !clip) return;
    const local = state.project.playhead - clip.start, duration = clipDuration(clip), edge = Math.min(.45, duration / 4), fade = clip.effect === "fade" ? Math.min(1, local / edge, (duration - local) / edge) : 1;
    const filters = { none: "none", cinema: "contrast(1.2) saturate(.84) sepia(.08)", vivid: "contrast(1.08) saturate(1.45)", mono: "grayscale(1) contrast(1.14)", warm: "sepia(.18) saturate(1.16)", cool: "hue-rotate(10deg) saturate(1.08)", blur: "blur(5px)", fade: "none" };
    video.style.transform = `translate(${clip.x}px,${clip.y}px) scale(${clip.scale / 100}) rotate(${clip.rotation}deg)`; video.style.opacity = String(clip.opacity * fade); video.style.filter = filters[clip.effect] || "none"; video.style.mixBlendMode = clip.blend.toLowerCase().replace("normal", "normal"); video.volume = clip.muted || state.project.disabledTracks.includes("A1") ? 0 : clamp(clip.volume * Number($(state.work, "[data-ve-master-volume]")?.value || 100) / 100, 0, 1); video.playbackRate = clamp(clip.speed, .1, 8);
  }
  function syncPreview(force = false) {
    if (!state.work) return;
    const clip = activeTimelineClip(), video = $(state.work, "[data-ve-video]"), empty = $(state.work, "[data-ve-empty]");
    if (!clip) { video.pause(); video.removeAttribute("src"); video.load(); state.activeClip = ""; empty.hidden = false; drawTitleOverlay(); return; }
    const asset = assetById(clip.assetId); if (!asset) { empty.hidden = false; return; }
    empty.hidden = true;
    if (force || state.activeClip !== clip.id) { state.activeClip = clip.id; video.src = asset.url; video.load(); }
    const targetTime = clamp(clip.in + (state.project.playhead - clip.start) * clip.speed, clip.in, clip.out - .01);
    if (force || !state.playing || Math.abs(video.currentTime - targetTime) > .18) { try { video.currentTime = targetTime; } catch {} }
    applyPreviewStyle(clip); if (state.playing) video.play().catch(() => {}); drawTitleOverlay(); renderMeters();
  }
  function drawTitleOverlay() {
    const title = activeTitle(), overlay = $(state.work, "[data-ve-title-overlay]"); if (!overlay) return;
    if (!title) { overlay.innerHTML = ""; return; }
    overlay.innerHTML = `<span class="is-${title.position}" style="--title-color:${title.color};--title-bg:${title.background};--title-size:${title.size}px">${esc(title.text)}</span>`;
  }
  function renderMeters() {
    const clip = activeTimelineClip(), level = clip?.muted ? 0 : Math.min(100, (clip?.volume || 0) * (state.playing ? 78 + Math.sin(performance.now() / 90) * 17 : 18));
    const left = $(state.work, "[data-ve-meter-left]"), right = $(state.work, "[data-ve-meter-right]"); if (left) left.style.setProperty("--level", `${level}%`); if (right) right.style.setProperty("--level", `${Math.max(0, level - 5 + Math.sin(performance.now() / 120) * 7)}%`);
  }
  function updatePlayhead() {
    const playhead = $(state.work, "[data-ve-playhead]"); if (playhead) playhead.style.left = `${state.project.playhead * state.project.zoom}px`;
    const time = $(state.work, "[data-ve-timecode]"); if (time) time.textContent = formatTime(state.project.playhead, true);
    if (state.exporting) { const progress = Math.min(100, state.project.playhead / projectDuration() * 100); $(state.work, "[data-ve-export-progress]").style.width = `${progress}%`; $(state.work, "[data-ve-export-status]").textContent = `Rendering ${progress.toFixed(0)}% · ${formatTime(state.project.playhead, true)}`; }
  }
  function seek(time, force = true) { state.project.playhead = clamp(time, 0, projectDuration()); updatePlayhead(); syncPreview(force); }
  function playbackFrame(now) {
    if (!state.playing) return;
    const delta = Math.min(.08, (now - state.lastFrame) / 1000 || 0); state.lastFrame = now; state.project.playhead += delta;
    if (state.project.playhead >= projectDuration()) { seek(projectDuration()); pause(); if (state.recorder?.state === "recording") state.recorder.stop(); return; }
    updatePlayhead(); syncPreview(); drawExportFrame(); state.raf = requestAnimationFrame(playbackFrame);
  }
  function play() { if (!state.project.clips.length) return status("Import media before playback.", "error"); if (state.project.playhead >= projectDuration()) seek(0); state.playing = true; state.lastFrame = performance.now(); syncPreview(); state.raf = requestAnimationFrame(playbackFrame); const iconNode = $(state.work, '[data-ve-action="play"] i'); iconNode?.setAttribute("data-lucide", "pause"); ensureLucide(); }
  function pause() { state.playing = false; cancelAnimationFrame(state.raf); $(state.work, "[data-ve-video]")?.pause(); const iconNode = $(state.work, '[data-ve-action="play"] i'); iconNode?.setAttribute("data-lucide", "play"); ensureLucide(); }
  function togglePlay() { state.playing ? pause() : play(); }
  function drawExportFrame() {
    const canvas = $(state.work, "[data-ve-export-canvas]"), video = $(state.work, "[data-ve-video]"); if (!canvas) return;
    const ctx = canvas.getContext("2d"), clip = activeTimelineClip(), title = activeTitle(); ctx.fillStyle = "#000"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (clip && video?.readyState >= 2) {
      const ratio = Math.min(canvas.width / video.videoWidth, canvas.height / video.videoHeight), width = video.videoWidth * ratio * clip.scale / 100, height = video.videoHeight * ratio * clip.scale / 100;
      ctx.save(); ctx.globalAlpha = clip.opacity; ctx.translate(canvas.width / 2 + clip.x, canvas.height / 2 + clip.y); ctx.rotate(clip.rotation * Math.PI / 180); ctx.filter = { cinema: "contrast(120%) saturate(84%) sepia(8%)", vivid: "contrast(108%) saturate(145%)", mono: "grayscale(100%) contrast(114%)", warm: "sepia(18%) saturate(116%)", cool: "hue-rotate(10deg) saturate(108%)", blur: "blur(5px)" }[clip.effect] || "none"; ctx.drawImage(video, -width / 2, -height / 2, width, height); ctx.restore();
    }
    if (title) { ctx.font = `800 ${title.size * canvas.width / 1280}px "Be Vietnam Pro",sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; const y = title.position === "top" ? canvas.height * .16 : title.position === "lower" ? canvas.height * .78 : canvas.height / 2; const metrics = ctx.measureText(title.text), pad = 18; ctx.fillStyle = `${title.background}d9`; ctx.fillRect(canvas.width / 2 - metrics.width / 2 - pad, y - title.size * .65, metrics.width + pad * 2, title.size * 1.3); ctx.fillStyle = title.color; ctx.fillText(title.text, canvas.width / 2, y); }
  }
  async function renderExport() {
    if (!state.project.clips.length) return status("Timeline is empty.", "error");
    if (!window.MediaRecorder) return status("MediaRecorder is not supported by this browser.", "error");
    const [width, height] = $(state.work, "[data-ve-export-size]").value.split("x").map(Number), canvas = $(state.work, "[data-ve-export-canvas]"); canvas.width = width; canvas.height = height; canvas.hidden = false;
    const mime = $(state.work, "[data-ve-export-format]").value, supported = MediaRecorder.isTypeSupported(mime) ? mime : "video/webm", stream = canvas.captureStream(state.project.fps), video = $(state.work, "[data-ve-video]");
    try { const mediaStream = video.captureStream?.(); mediaStream?.getAudioTracks().forEach((track) => stream.addTrack(track)); } catch {}
    state.chunks = []; state.recorder = new MediaRecorder(stream, { mimeType: supported, videoBitsPerSecond: Number($(state.work, "[data-ve-export-bitrate]").value) });
    state.recorder.ondataavailable = (event) => { if (event.data.size) state.chunks.push(event.data); };
    state.recorder.onstop = () => { const blob = new Blob(state.chunks, { type: supported }); downloadBlob(blob, `${$(state.work, "[data-ve-export-name]").value || "hh-sequence"}.webm`); state.exporting = false; canvas.hidden = true; closeDialogs(); status(`Export complete · ${bytes(blob.size)}`, "success"); };
    state.exporting = true; seek(0); drawExportFrame(); state.recorder.start(1000); play(); $(state.work, "[data-ve-export-status]").textContent = "Rendering sequence…";
  }

  function selectItem(id) { state.project.selected = id; const clip = clipById(); if (clip) seek(Math.max(clip.start, state.project.playhead)); renderAll(); syncPreview(true); }
  function setTool(tool) { state.project.tool = tool; $$(state.work, "[data-ve-tool]").forEach((button) => button.classList.toggle("is-active", button.dataset.veTool === tool)); status(`${tool[0].toUpperCase() + tool.slice(1)} Tool active`); }
  function switchPanel(kind, id) {
    const tabAttr = kind === "panel" ? "data-ve-panel-tab" : "data-ve-inspector-tab", paneAttr = kind === "panel" ? "data-ve-panel" : "data-ve-inspector";
    $$ (state.work, `[${tabAttr}]`).forEach((button) => button.classList.toggle("is-active", button.getAttribute(tabAttr) === id));
    $$ (state.work, `[${paneAttr}]`).forEach((pane) => { const active = pane.getAttribute(paneAttr) === id; pane.classList.toggle("is-active", active); pane.hidden = !active; });
  }
  function openDialog(id) { const dialog = $(state.work, `[data-ve-dialog="${id}"]`); if (dialog) dialog.hidden = false; ensureLucide(); }
  function closeDialogs() { $$(state.work, "[data-ve-dialog]").forEach((dialog) => dialog.hidden = true); }
  function exportProjectFile() { const project = { ...state.project, history: [], historyIndex: -1, assets: state.assets.map(({ id, name, type, size, duration }) => ({ id, name, type, size, duration })) }; downloadBlob(new Blob([JSON.stringify(project, null, 2)], { type: "application/json" }), "hh-video-project.json"); }
  async function importProjectFile(file) { const project = JSON.parse(await file.text()); state.project = { ...defaultProject(), ...project, history: [], historyIndex: -1 }; pushHistory("Open project"); renderAll(); syncPreview(true); status("Project loaded. Missing media can be re-imported by file name.", "success"); }

  function pointerDown(event) {
    const clipNode = event.target.closest("[data-ve-clip]"), titleNode = event.target.closest("[data-ve-title]"); if (!clipNode && !titleNode) return;
    const id = clipNode?.dataset.veClip || titleNode?.dataset.veTitle; selectItem(id);
    if (state.project.tool === "razor" && clipNode) { seek(clipById(id).start + clamp((event.clientX - clipNode.getBoundingClientRect().left) / state.project.zoom, 0, clipDuration(clipById(id)))); splitSelected(); return; }
    const item = clipById(id) || titleById(id), itemTrack = clipNode?.dataset.veClipTrack || "V2", trim = event.target.closest("[data-ve-trim]")?.dataset.veTrim;
    if (state.project.lockedTracks.includes(itemTrack)) return status(`${itemTrack} is locked.`, "error");
    state.drag = { id, startX: event.clientX, originalStart: item.start, originalIn: item.in, originalOut: item.out, trim, moved: false };
    event.target.setPointerCapture?.(event.pointerId);
  }
  function pointerMove(event) {
    if (!state.drag) return; const item = clipById(state.drag.id) || titleById(state.drag.id); if (!item) return;
    const delta = (event.clientX - state.drag.startX) / state.project.zoom; state.drag.moved = Math.abs(delta) > .02;
    if (state.drag.trim === "start" && item.in != null) { const sourceDelta = clamp(delta * item.speed, -item.in, item.out - item.in - .04); item.in = state.drag.originalIn + sourceDelta; item.start = Math.max(0, state.drag.originalStart + sourceDelta / item.speed); }
    else if (state.drag.trim === "end" && item.out != null) item.out = clamp(state.drag.originalOut + delta * item.speed, item.in + .04, assetById(item.assetId)?.duration || state.drag.originalOut);
    else item.start = Math.max(0, state.drag.originalStart + delta);
    renderTimeline(); renderProperties();
  }
  function pointerUp() { if (!state.drag) return; if (state.drag.moved) { if (state.project.snap) { const item = clipById(state.drag.id) || titleById(state.drag.id); item.start = Math.round(item.start * state.project.fps) / state.project.fps; } pushHistory(state.drag.trim ? "Trim clip" : "Move clip"); renderAll(); syncPreview(true); } state.drag = null; }

  function setup(outer) {
    cleanupOwn(); state.outer = outer; outer.innerHTML = `<div class="media-design-workspace video-editor-workspace" data-md-tool="${TOOL}">${markup()}</div>`; state.work = $(outer, "[data-ve-editor]"); loadSavedProject();
    state.project.history = [{ label: "Project opened", at: Date.now(), value: snapshot() }]; state.project.historyIndex = 0;
    state.work.addEventListener("pointerdown", pointerDown); state.work.addEventListener("pointermove", pointerMove); state.work.addEventListener("pointerup", pointerUp); state.work.addEventListener("pointercancel", pointerUp);
    state.work.addEventListener("dragstart", (event) => { const asset = event.target.closest("[data-ve-asset]"); if (asset) event.dataTransfer.setData("text/hh-video-asset", asset.dataset.veAsset); });
    state.work.addEventListener("dragover", (event) => { if (event.target.closest("[data-ve-track]")) event.preventDefault(); });
    state.work.addEventListener("drop", (event) => { const track = event.target.closest("[data-ve-track]"); if (!track) return; event.preventDefault(); const id = event.dataTransfer.getData("text/hh-video-asset"); if (!id) return; const rect = $(state.work, "[data-ve-track-content]").getBoundingClientRect(); addAssetToTimeline(id, (event.clientX - rect.left) / state.project.zoom, track.dataset.veTrack); });
    $(state.work, "[data-ve-timeline]").addEventListener("click", (event) => { if (event.target.closest("[data-ve-clip],[data-ve-title],[data-ve-marker]")) return; const rect = $(state.work, "[data-ve-track-content]").getBoundingClientRect(); seek((event.clientX - rect.left) / state.project.zoom); });
    const sequence = $(state.work, "[data-ve-sequence]"); if (sequence) sequence.value = `${state.project.width}x${state.project.height}`;
    $(state.work, "[data-ve-project-name]").textContent = state.project.name; $(state.work, "[data-ve-sequence-name]").textContent = state.project.name;
    renderAll(); restoreAssets(); ensureLucide();
  }
  function cleanupOwn() { pause(); clearTimeout(state.timer); if (state.recorder?.state === "recording") state.recorder.stop(); state.urls.splice(0).forEach((url) => URL.revokeObjectURL(url)); Object.assign(state, { outer: null, work: null, assets: [], activeClip: "", recorder: null, exporting: false, drag: null }); }

  async function clickHandler(event) {
    const actionId = event.target.closest("[data-ve-action]")?.dataset.veAction;
    const panelTab = event.target.closest("[data-ve-panel-tab]"); if (panelTab) return switchPanel("panel", panelTab.dataset.vePanelTab);
    const inspectorTab = event.target.closest("[data-ve-inspector-tab]"); if (inspectorTab) return switchPanel("inspector", inspectorTab.dataset.veInspectorTab);
    const monitorTab = event.target.closest("[data-ve-monitor-tab]");
    if (monitorTab) { $$(state.work, "[data-ve-monitor-tab]").forEach((button) => button.classList.toggle("is-active", button === monitorTab)); state.project.monitorMode = monitorTab.dataset.veMonitorTab; if (state.project.monitorMode === "source") { const clip = clipById(); const asset = clip && assetById(clip.assetId), video = $(state.work, "[data-ve-video]"); if (asset) { state.activeClip = clip.id; video.src = asset.url; video.currentTime = clip.in; $(state.work, "[data-ve-empty]").hidden = true; drawTitleOverlay(); } else status("Select a clip to load Source Monitor."); } else syncPreview(true); return; }
    const trackToggle = event.target.closest("[data-ve-track-toggle]");
    if (trackToggle) { const track = trackToggle.dataset.veTrackToggle, disabled = state.project.disabledTracks.includes(track); state.project.disabledTracks = disabled ? state.project.disabledTracks.filter((item) => item !== track) : [...state.project.disabledTracks, track]; trackToggle.classList.toggle("is-off", !disabled); syncPreview(true); drawTitleOverlay(); saveProject(false); return; }
    const trackLock = event.target.closest("[data-ve-track-lock]");
    if (trackLock) { const track = trackLock.dataset.veTrackLock, locked = state.project.lockedTracks.includes(track); state.project.lockedTracks = locked ? state.project.lockedTracks.filter((item) => item !== track) : [...state.project.lockedTracks, track]; trackLock.classList.toggle("is-locked", !locked); trackLock.innerHTML = icon(locked ? "lock-open" : "lock"); ensureLucide(); saveProject(false); return; }
    const tool = event.target.closest("[data-ve-tool]"); if (tool) return setTool(tool.dataset.veTool);
    const clip = event.target.closest("[data-ve-clip]"); if (clip) return selectItem(clip.dataset.veClip);
    const title = event.target.closest("[data-ve-title],[data-ve-title-select]"); if (title) return selectItem(title.dataset.veTitle || title.dataset.veTitleSelect);
    const marker = event.target.closest("[data-ve-marker]"); if (marker) { const item = state.project.markers.find((row) => row.id === marker.dataset.veMarker); if (item) seek(item.time); return; }
    const effect = event.target.closest("[data-ve-effect]"); if (effect) { const selected = clipById(); if (!selected) return status("Select a video clip before applying an effect.", "error"); selected.effect = effect.dataset.veEffect; pushHistory("Apply effect"); syncPreview(); renderProperties(); return; }
    if (!actionId) return;
    document.querySelectorAll(".ve-menu[open]").forEach((node) => node.removeAttribute("open"));
    if (actionId === "import") return $(state.work, "[data-ve-file]").click();
    if (actionId === "project-open") return $(state.work, "[data-ve-project-file]").click();
    if (actionId === "new") { if (state.project.clips.length && !confirm("Create a new project and clear the current timeline?")) return; state.project = defaultProject(); pushHistory("New project"); renderAll(); syncPreview(true); return; }
    if (actionId === "save") return saveProject();
    if (actionId === "project-export") return exportProjectFile();
    if (actionId === "undo") return restoreHistory(state.project.historyIndex - 1);
    if (actionId === "redo") return restoreHistory(state.project.historyIndex + 1);
    if (actionId === "duplicate") return duplicateSelected();
    if (actionId === "delete") return removeSelected(false);
    if (actionId === "ripple-delete") return removeSelected(true);
    if (actionId === "split") return splitSelected();
    if (actionId === "trim-start") { const selected = clipById(); if (selected && state.project.playhead > selected.start) { selected.in += (state.project.playhead - selected.start) * selected.speed; selected.start = state.project.playhead; pushHistory("Trim start"); renderAll(); } return; }
    if (actionId === "trim-end") { const selected = clipById(); if (selected) { selected.out = clamp(selected.in + (state.project.playhead - selected.start) * selected.speed, selected.in + .04, selected.out); pushHistory("Trim end"); renderAll(); } return; }
    if (actionId === "speed") { const field = $(state.work, '[data-ve-prop="speed"]'); switchPanel("inspector", "effect"); field?.focus(); return; }
    if (actionId === "sequence-start") return seek(0);
    if (actionId === "sequence-end") return seek(projectDuration());
    if (actionId === "marker") return addMarker();
    if (actionId === "marker-clear") { state.project.markers = []; pushHistory("Clear markers"); renderTimeline(); return; }
    if (actionId === "title") return addTitle(false);
    if (actionId === "caption") return addTitle(true);
    if (actionId === "fullscreen") return document.fullscreenElement ? document.exitFullscreen() : state.work.requestFullscreen?.();
    if (actionId === "reset-layout") { $(state.work, "[data-ve-workspace]").value = "Editing"; status("Editing workspace restored."); return; }
    if (actionId === "shortcuts") return openDialog("shortcuts");
    if (actionId === "about") return status("HH Video Engine · Media Element + Canvas + MediaRecorder · local processing.", "success");
    if (actionId === "dialog-close") return closeDialogs();
    if (actionId === "render") return openDialog("export");
    if (actionId === "render-confirm") return renderExport();
    if (actionId === "play") return togglePlay();
    if (actionId === "step-back") return seek(state.project.playhead - 1 / state.project.fps);
    if (actionId === "step-forward") return seek(state.project.playhead + 1 / state.project.fps);
    if (actionId === "prev-edit" || actionId === "next-edit") { const edits = [0, ...state.project.clips.flatMap((item) => [item.start, item.start + clipDuration(item)])].sort((a, b) => a - b); const next = actionId === "next-edit" ? edits.find((time) => time > state.project.playhead + .01) : [...edits].reverse().find((time) => time < state.project.playhead - .01); return seek(next ?? (actionId === "next-edit" ? projectDuration() : 0)); }
    if (actionId === "safe-margins") { const safe = $(state.work, "[data-ve-safe]"); safe.hidden = !safe.hidden; return; }
    if (actionId === "monitor-settings") return status("Program Monitor · Fit · High quality playback");
    if (actionId === "asset-add") return addAssetToTimeline(event.target.closest("[data-asset-id]").dataset.assetId);
    if (actionId === "asset-remove") { const id = event.target.closest("[data-asset-id]").dataset.assetId; if (state.project.clips.some((item) => item.assetId === id)) return status("Remove clips using this media from the timeline first.", "error"); state.assets = state.assets.filter((item) => item.id !== id); await dbDelete(id); renderAssets(); return; }
    if (actionId === "asset-clear") { if (state.project.clips.length) return status("Clear timeline clips before emptying the project bin.", "error"); await Promise.all(state.assets.map((item) => dbDelete(item.id))); state.assets = []; renderAssets(); return; }
    if (actionId === "asset-view") { $(state.work, "[data-ve-assets]").classList.toggle("is-compact"); return; }
    if (actionId === "normalize") { const selected = clipById(); if (selected) { selected.volume = 1; renderProperties(); syncPreview(); status("Clip normalized to 0.0 dB."); } return; }
    if (actionId === "reset-motion") { const selected = clipById(); if (selected) { Object.assign(selected, { x: 0, y: 0, scale: 100, rotation: 0 }); pushHistory("Reset motion"); renderProperties(); syncPreview(); } }
  }
  function inputHandler(event) {
    if (event.target.matches("[data-ve-search]")) return renderAssets(event.target.value);
    if (event.target.matches("[data-ve-zoom]")) { state.project.zoom = Number(event.target.value); renderTimeline(); return; }
    if (event.target.matches("[data-ve-master-volume]")) { $(state.work, "[data-ve-master-value]").textContent = `${(20 * Math.log10(Math.max(.01, event.target.value / 100))).toFixed(1)} dB`; syncPreview(); return; }
    if (event.target.matches("[data-ve-prop]")) {
      const clip = clipById(); if (!clip) return; const key = event.target.dataset.veProp;
      if (key === "muted") clip[key] = event.target.checked;
      else if (["blend"].includes(key)) clip[key] = event.target.value;
      else { const value = Number(event.target.value); clip[key] = key === "opacity" || key === "volume" ? value / 100 : key === "speed" ? clamp(value / 100, .1, 8) : ["start", "in", "out", "scale"].includes(key) ? Math.max(0, value) : value; }
      if (key === "in") clip.in = clamp(clip.in, 0, clip.out - .04); if (key === "out") clip.out = clamp(clip.out, clip.in + .04, assetById(clip.assetId)?.duration || clip.out); renderTimeline(); syncPreview();
      if (key === "opacity" || key === "volume") $(state.work, `[data-ve-value="${key}"]`).textContent = `${Math.round(clip[key] * 100)}%`; return;
    }
  }
  async function changeHandler(event) {
    if (event.target.matches("[data-ve-file]")) { await importFiles([...event.target.files]); event.target.value = ""; return; }
    if (event.target.matches("[data-ve-project-file]")) { const file = event.target.files?.[0]; if (file) await importProjectFile(file); return; }
    if (event.target.matches("[data-ve-prop]")) { pushHistory("Change clip property"); renderAll(); return; }
    if (event.target.matches("[data-ve-snap]")) state.project.snap = event.target.checked;
    if (event.target.matches("[data-ve-sequence]")) { const [width, height] = event.target.value.split("x").map(Number); state.project.width = width; state.project.height = height; $(state.work, "[data-ve-footer-sequence]").textContent = `${width}×${height} · ${state.project.fps}fps`; saveProject(false); }
    if (event.target.matches("[data-ve-workspace]")) { const value = event.target.value; if (value === "Color") switchPanel("panel", "effects"); if (value === "Audio") switchPanel("panel", "audio"); if (value === "Graphics") switchPanel("inspector", "graphics"); if (value === "Editing") { switchPanel("panel", "project"); switchPanel("inspector", "effect"); } }
  }

  addEventListener("keydown", (event) => {
    if (!state.work?.isConnected || !location.hash.includes("/media-design/video-editor")) return;
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "")) return;
    const key = event.key.toLowerCase(), command = event.ctrlKey || event.metaKey;
    if (command && key === "z") { event.preventDefault(); return restoreHistory(state.project.historyIndex + (event.shiftKey ? 1 : -1)); }
    if (command && key === "n") { event.preventDefault(); return state.work.querySelector('[data-ve-action="new"]').click(); }
    if (command && key === "i") { event.preventDefault(); return $(state.work, "[data-ve-file]").click(); }
    if (command && key === "s") { event.preventDefault(); return saveProject(); }
    if (command && key === "m") { event.preventDefault(); return openDialog("export"); }
    if (command && key === "k") { event.preventDefault(); return splitSelected(); }
    if (command && key === "d") { event.preventDefault(); return duplicateSelected(); }
    if (event.key === " ") { event.preventDefault(); return togglePlay(); }
    if (key === "v") return setTool("select"); if (key === "c") return setTool("razor"); if (key === "h") return setTool("hand"); if (key === "z") return setTool("zoom");
    if (key === "m") return addMarker(); if (key === "t") return addTitle(false);
    if (key === "i" || key === "o") { const clip = clipById(); if (!clip) return; const sourceTime = clamp(clip.in + (state.project.playhead - clip.start) * clip.speed, 0, assetById(clip.assetId)?.duration || clip.out); if (key === "i" && sourceTime < clip.out) { clip.in = sourceTime; clip.start = state.project.playhead; } if (key === "o" && sourceTime > clip.in) clip.out = sourceTime; pushHistory(key === "i" ? "Mark In" : "Mark Out"); renderAll(); return; }
    if (key === "delete" || key === "backspace") { event.preventDefault(); return removeSelected(event.shiftKey); }
    if (key === "arrowleft") return seek(state.project.playhead - 1 / state.project.fps); if (key === "arrowright") return seek(state.project.playhead + 1 / state.project.fps);
    if (key === "arrowup" || key === "arrowdown") return state.work.querySelector(`[data-ve-action="${key === "arrowup" ? "prev-edit" : "next-edit"}"]`)?.click();
    if (key === "home") return seek(0); if (key === "end") return seek(projectDuration());
    if (["+", "="].includes(key)) { state.project.zoom = clamp(state.project.zoom + 4, 6, 70); $(state.work, "[data-ve-zoom]").value = state.project.zoom; return renderTimeline(); }
    if (key === "-") { state.project.zoom = clamp(state.project.zoom - 4, 6, 70); $(state.work, "[data-ve-zoom]").value = state.project.zoom; return renderTimeline(); }
    if (key === "l") { const video = $(state.work, "[data-ve-video]"); if (video) video.playbackRate = clamp(video.playbackRate + .5, .5, 4); return play(); }
    if (key === "k") return pause(); if (key === "j") { pause(); return seek(state.project.playhead - .5); }
  });

  window.HHMediaDesign = {
    supports: (name) => name === TOOL || base.supports(name),
    render(outer, name) { if (name === TOOL) setup(outer); else base.render(outer, name); },
    cleanup() { cleanupOwn(); base.cleanup?.(); },
    handleClick(event, outer, name) { if (name === TOOL) return clickHandler(event); return base.handleClick?.(event, outer, name); },
    handleInput(event, outer, name) { if (name === TOOL) return inputHandler(event); return base.handleInput?.(event, outer, name); },
    handleChange(event, outer, name) { if (name === TOOL) return changeHandler(event); return base.handleChange?.(event, outer, name); }
  };
})();
