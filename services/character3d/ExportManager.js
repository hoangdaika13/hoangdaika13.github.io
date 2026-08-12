(function initHHCharacter3DExportManager(global) {
  "use strict";

  const VIDEO_CANDIDATES = Object.freeze([
    "video/mp4;codecs=h264,aac", "video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"
  ]);
  const clampDimension = (value, fallback) => Math.min(4096, Math.max(64, Math.round(Number(value) || fallback)));
  const safeName = (value, extension) => {
    const base = String(value || "character-3d").normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "character-3d";
    return base.toLowerCase().endsWith(`.${extension}`) ? base : `${base}.${extension}`;
  };
  const download = (blob, fileName) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = fileName; anchor.rel = "noopener"; anchor.hidden = true;
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
    return fileName;
  };
  const canvasToBlob = (canvas, type = "image/png", quality) => new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Trình duyệt không tạo được ảnh từ canvas.")), type, quality);
  });

  class ExportManager {
    constructor(options = {}) {
      this.renderer = options.renderer || null;
      this.scene = options.scene || null;
      this.camera = options.camera || null;
      this.canvas = options.canvas || this.renderer?.domElement || null;
      this.rightsRegistry = options.rightsRegistry || null;
      this.activeRecorder = null;
      this.activeStream = null;
      this.chunks = [];
      this.disposed = false;
    }

    bind({ renderer, scene, camera, canvas, rightsRegistry } = {}) {
      this.renderer = renderer || this.renderer;
      this.scene = scene || this.scene;
      this.camera = camera || this.camera;
      this.canvas = canvas || renderer?.domElement || this.canvas;
      this.rightsRegistry = rightsRegistry || this.rightsRegistry;
      return this;
    }

    assertRights(assetIds, purpose = "export") {
      if (!this.rightsRegistry) {
        if (purpose !== "preview") throw new Error("Chưa gắn Rights Registry; chỉ cho phép preview và lưu project cục bộ.");
        return { allowed: true, warnings: ["Rights Registry chưa được gắn; chỉ nên lưu dự án cục bộ."] };
      }
      const ids = Array.isArray(assetIds) ? assetIds : assetIds ? [assetIds] : [];
      if (purpose === "publish" && !ids.length) throw new Error("Không thể xuất bản công khai khi chưa chọn hồ sơ quyền của tài sản.");
      if (purpose === "export" && !ids.length) throw new Error("Chưa chọn hồ sơ quyền của tài sản để xuất file.");
      const checks = ids.map((id) => this.rightsRegistry.evaluate(id, purpose));
      const errors = checks.flatMap((result) => result.errors || []);
      if (errors.length) throw new Error(errors.join(" "));
      return { allowed: true, warnings: checks.flatMap((result) => result.warnings || []) };
    }

    codecSupport() {
      const supported = typeof MediaRecorder !== "undefined" && typeof MediaRecorder.isTypeSupported === "function"
        ? VIDEO_CANDIDATES.filter((type) => MediaRecorder.isTypeSupported(type)) : [];
      return Object.freeze({ mediaRecorder: typeof MediaRecorder !== "undefined", captureStream: Boolean(this.canvas?.captureStream), webCodecs: typeof VideoEncoder !== "undefined", supported });
    }

    preferredCodec(preferred) {
      const support = this.codecSupport();
      if (preferred && support.supported.includes(preferred)) return preferred;
      return support.supported[0] || "";
    }

    async capturePng(options = {}) {
      if (!this.canvas) throw new Error("Viewport canvas chưa sẵn sàng.");
      this.assertRights(options.assetIds, options.public ? "publish" : (options.localPreview ? "preview" : "export"));
      const width = clampDimension(options.width, this.canvas.width || 1280);
      const height = clampDimension(options.height, this.canvas.height || 720);
      let sourceCanvas = this.canvas;
      let restore = null;
      if (this.renderer && this.scene && this.camera) {
        const previousSize = this.renderer.getSize?.({ set(x, y) { this.x = x; this.y = y; return this; } });
        const previousPixelRatio = this.renderer.getPixelRatio?.() || 1;
        const previousAlpha = this.renderer.getClearAlpha?.();
        const Color = global.HHCharacter3DRuntime?.THREE?.Color;
        const previousColor = Color && this.renderer.getClearColor ? this.renderer.getClearColor(new Color()).clone() : null;
        const previousAspect = this.camera.aspect;
        this.renderer.setPixelRatio?.(1);
        this.renderer.setSize?.(width, height, false);
        if ("aspect" in this.camera) { this.camera.aspect = width / height; this.camera.updateProjectionMatrix?.(); }
        if (options.transparent) this.renderer.setClearAlpha?.(0);
        else if (options.background) this.renderer.setClearColor?.(options.background, 1);
        this.renderer.render(this.scene, this.camera);
        sourceCanvas = this.renderer.domElement;
        restore = () => {
          if (previousSize) this.renderer.setSize?.(previousSize.x, previousSize.y, false);
          this.renderer.setPixelRatio?.(previousPixelRatio);
          if (previousColor) this.renderer.setClearColor?.(previousColor, previousAlpha ?? 1);
          else if (typeof previousAlpha === "number") this.renderer.setClearAlpha?.(previousAlpha);
          if ("aspect" in this.camera && previousAspect) { this.camera.aspect = previousAspect; this.camera.updateProjectionMatrix?.(); }
          this.renderer.render?.(this.scene, this.camera);
        };
      }
      let blob;
      try {
        if (sourceCanvas.width === width && sourceCanvas.height === height) blob = await canvasToBlob(sourceCanvas, "image/png");
        else {
          const output = document.createElement("canvas"); output.width = width; output.height = height;
          if (!options.transparent) { const context = output.getContext("2d"); context.fillStyle = options.background || "#070a12"; context.fillRect(0, 0, width, height); }
          output.getContext("2d").drawImage(sourceCanvas, 0, 0, width, height);
          blob = await canvasToBlob(output, "image/png");
        }
      } finally { restore?.(); }
      const result = { blob, width, height, mimeType: "image/png", fileName: safeName(options.fileName, "png") };
      if (options.download !== false) download(blob, result.fileName);
      return result;
    }

    captureThumbnail(options = {}) { return this.capturePng(Object.assign({ width: 1280, height: 720, fileName: "character-thumbnail.png" }, options)); }
    capturePortrait(options = {}) { return this.capturePng(Object.assign({ width: 1080, height: 1920, fileName: "character-portrait.png" }, options)); }

    async startVideo(options = {}) {
      if (!this.canvas?.captureStream || typeof MediaRecorder === "undefined") throw new Error("Trình duyệt chưa hỗ trợ canvas.captureStream + MediaRecorder.");
      if (this.activeRecorder) throw new Error("Đang có một phiên ghi video hoạt động.");
      this.assertRights(options.assetIds, options.public ? "publish" : (options.localPreview ? "preview" : "export"));
      const mimeType = this.preferredCodec(options.mimeType);
      if (!mimeType) throw new Error("Không có codec WebM/MP4 phù hợp trong trình duyệt này.");
      const fps = Math.min(60, Math.max(1, Math.round(Number(options.fps) || 30)));
      this.activeStream = this.canvas.captureStream(fps);
      if (typeof global.MediaStream !== "undefined" && options.audioStream instanceof global.MediaStream) options.audioStream.getAudioTracks().forEach((track) => this.activeStream.addTrack(track));
      const recorder = new MediaRecorder(this.activeStream, { mimeType, videoBitsPerSecond: Math.max(500000, Number(options.videoBitsPerSecond) || 8000000) });
      this.chunks = [];
      recorder.ondataavailable = (event) => { if (event.data?.size) this.chunks.push(event.data); };
      recorder.start(Math.max(100, Number(options.timeslice) || 1000));
      this.activeRecorder = recorder;
      return Object.freeze({ recording: true, mimeType, state: recorder.state });
    }

    pauseVideo() { if (this.activeRecorder?.state === "recording") { this.activeRecorder.pause(); return true; } return false; }
    resumeVideo() { if (this.activeRecorder?.state === "paused") { this.activeRecorder.resume(); return true; } return false; }

    async stopVideo(options = {}) {
      const recorder = this.activeRecorder;
      if (!recorder) throw new Error("Không có phiên ghi video hoạt động.");
      const mimeType = recorder.mimeType || "video/webm";
      await new Promise((resolve) => { recorder.addEventListener("stop", resolve, { once: true }); recorder.stop(); });
      this.activeStream?.getTracks?.().forEach((track) => track.stop());
      const blob = new Blob(this.chunks, { type: mimeType });
      this.activeRecorder = null; this.activeStream = null; this.chunks = [];
      const extension = mimeType.includes("mp4") ? "mp4" : "webm";
      const fileName = safeName(options.fileName || `character-recording.${extension}`, extension);
      if (options.download !== false) download(blob, fileName);
      return { blob, fileName, mimeType, size: blob.size };
    }

    exportProject(project, options = {}) {
      const clean = JSON.parse(JSON.stringify(project || {}));
      const payload = { schema: "https://hoang8.com/schemas/character-3d-project/v1", version: 1, exportedAt: new Date().toISOString(), project: clean };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const fileName = safeName(options.fileName || "character-project.json", "json");
      if (options.download !== false) download(blob, fileName);
      return { blob, fileName, payload };
    }

    async exportCharacterPack(project, options = {}) {
      if (typeof global.JSZip !== "function") throw new Error("JSZip chưa được tải; vẫn có thể xuất Project JSON riêng.");
      this.assertRights(options.assetIds, options.public ? "publish" : (options.localPreview ? "preview" : "export"));
      const zip = new global.JSZip();
      const projectResult = this.exportProject(project, { download: false });
      zip.file("project.json", projectResult.blob);
      if (options.thumbnail instanceof Blob) zip.file("thumbnail.png", options.thumbnail);
      if (this.rightsRegistry) {
        const manifest = this.rightsRegistry.attributionManifest(options.assetIds);
        zip.file("LICENSES.json", JSON.stringify(manifest, null, 2));
        zip.file("ATTRIBUTION.txt", this.rightsRegistry.attributionText(options.assetIds));
      }
      if (options.readme) zip.file("README.txt", String(options.readme));
      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
      const fileName = safeName(options.fileName || "character-pack.zip", "zip");
      if (options.download !== false) download(blob, fileName);
      return { blob, fileName, size: blob.size };
    }

    capabilities() {
      return Object.freeze({
        png: Boolean(this.canvas?.toBlob), thumbnail: Boolean(this.canvas?.toBlob), portrait: Boolean(this.canvas?.toBlob),
        video: this.codecSupport(), projectJson: true, characterPackZip: typeof global.JSZip === "function",
        glbExport: false, vrmExport: false,
        notes: ["GLB/VRM round-trip is disabled unless a dedicated exporter pipeline is installed.", "GLTFExporter does not guarantee preservation of VRM extensions."]
      });
    }

    dispose() {
      if (this.activeRecorder?.state !== "inactive") this.activeRecorder?.stop?.();
      this.activeStream?.getTracks?.().forEach((track) => track.stop());
      this.activeRecorder = null; this.activeStream = null; this.chunks = [];
      this.renderer = null; this.scene = null; this.camera = null; this.canvas = null; this.disposed = true;
    }
  }

  global.HHCharacter3DExportManager = Object.freeze({ ExportManager, VIDEO_CANDIDATES, download, canvasToBlob });
  global.HHCharacter3D = global.HHCharacter3D || {};
  global.HHCharacter3D.ExportManager = ExportManager;
})(typeof window !== "undefined" ? window : globalThis);
