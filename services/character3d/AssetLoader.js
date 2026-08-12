(function initHHCharacter3DAssetLoader(global) {
  "use strict";

  const DEFAULT_MAX_BYTES = 80 * 1024 * 1024;
  const ACCEPTED_EXTENSIONS = new Set(["glb", "vrm"]);
  const ACCEPTED_MIME = new Set([
    "application/octet-stream",
    "model/gltf-binary",
    "model/vrm",
    "application/x-virtual-reality-model",
    ""
  ]);
  const GLB_MAGIC = 0x46546c67;

  const clean = (value) => String(value == null ? "" : value).trim();
  const extensionOf = (name) => clean(name).toLowerCase().split(".").pop();
  const abortError = () => typeof DOMException === "function" ? new DOMException("Loading was cancelled.", "AbortError") : new Error("Loading was cancelled.");
  const ensureNotAborted = (signal) => { if (signal?.aborted) throw abortError(); };

  class AssetLoadError extends Error {
    constructor(message, code = "ASSET_LOAD_ERROR", details = {}) {
      super(message);
      this.name = "AssetLoadError";
      this.code = code;
      this.status = Number(details.status) || 0;
      this.url = clean(details.url);
    }
  }

  function readMagic(buffer) {
    if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 12) return { valid: false, reason: "File is shorter than a GLB header." };
    const view = new DataView(buffer, 0, Math.min(buffer.byteLength, 20));
    const magic = view.getUint32(0, true);
    const version = view.getUint32(4, true);
    const declaredLength = view.getUint32(8, true);
    return {
      valid: magic === GLB_MAGIC && version === 2 && declaredLength >= 12 && declaredLength === buffer.byteLength,
      magic,
      version,
      declaredLength,
      reason: magic !== GLB_MAGIC ? "Magic bytes are not glTF binary." : version !== 2 ? "Only glTF 2.0 is supported." : declaredLength !== buffer.byteLength ? "GLB header length does not match the file size." : ""
    };
  }

  function inspectGlbStructure(buffer) {
    const magic = readMagic(buffer);
    if (!magic.valid) return { valid: false, errors: [magic.reason], externalReferences: [], json: null };
    const errors = [];
    const externalReferences = [];
    let offset = 12;
    let json = null;
    while (offset + 8 <= buffer.byteLength) {
      const header = new DataView(buffer, offset, 8);
      const chunkLength = header.getUint32(0, true);
      const chunkType = header.getUint32(4, true);
      offset += 8;
      if (offset + chunkLength > buffer.byteLength) { errors.push("GLB contains an invalid chunk length."); break; }
      if (chunkType === 0x4e4f534a && !json) {
        try {
          const bytes = new Uint8Array(buffer, offset, chunkLength);
          json = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/[\u0000\u0020]+$/g, ""));
        } catch (_) { errors.push("The GLB JSON chunk is malformed."); }
      }
      offset += chunkLength;
    }
    if (!json || json.asset?.version !== "2.0") errors.push("GLB is missing a valid glTF 2.0 JSON chunk.");
    [...(json?.buffers || []), ...(json?.images || [])].forEach((entry) => {
      if (!entry?.uri || /^data:/i.test(entry.uri)) return;
      externalReferences.push(String(entry.uri));
    });
    if (externalReferences.length) errors.push("GLB/VRM references external files; package textures and buffers inside the model before import.");
    return { valid: errors.length === 0, errors, externalReferences, json };
  }

  function inspectScene(gltf, byteLength = 0) {
    const root = gltf?.scene;
    let triangles = 0;
    let vertices = 0;
    let bones = 0;
    let meshes = 0;
    let morphTargets = 0;
    let morphBindings = 0;
    const textures = new Set();
    const materials = new Set();
    const materialNames = new Set();
    const shapeKeyNames = new Set();
    root?.traverse?.((object) => {
      if (object.isBone) bones += 1;
      if (!object.isMesh && !object.isSkinnedMesh) return;
      meshes += 1;
      const geometry = object.geometry;
      const position = geometry?.attributes?.position;
      const count = geometry?.index?.count || position?.count || 0;
      triangles += Math.floor(count / 3);
      vertices += position?.count || 0;
      const dictionaryEntries = Object.entries(object.morphTargetDictionary || {});
      dictionaryEntries.forEach(([name]) => shapeKeyNames.add(name));
      morphBindings += dictionaryEntries.length;
      const geometryTargetCount = Math.max(0, ...Object.values(geometry?.morphAttributes || {}).map((targets) => targets?.length || 0));
      morphTargets += dictionaryEntries.length || geometryTargetCount;
      const list = Array.isArray(object.material) ? object.material : [object.material];
      list.filter(Boolean).forEach((material) => {
        materials.add(material.uuid || material.name || material);
        materialNames.add(material.name || `(unnamed ${material.type || "material"})`);
        Object.values(material).forEach((value) => { if (value?.isTexture) textures.add(value.uuid || value); });
      });
    });
    return Object.freeze({
      byteLength: Number(byteLength) || 0,
      triangles,
      vertices,
      meshes,
      bones,
      morphTargets,
      morphBindings,
      shapeKeyNames: [...shapeKeyNames],
      textures: textures.size,
      materials: materials.size,
      materialNames: [...materialNames],
      animations: Array.isArray(gltf?.animations) ? gltf.animations.length : 0,
      animationNames: (gltf?.animations || []).map((clip) => clip.name || "Untitled clip"),
      animationDurations: (gltf?.animations || []).map((clip) => Number(clip.duration) || 0),
      cameras: Array.isArray(gltf?.cameras) ? gltf.cameras.length : 0,
      hasSkin: bones > 0,
      isVRM: Boolean(gltf?.userData?.vrm || gltf?.parser?.json?.extensions?.VRM || gltf?.parser?.json?.extensions?.VRMC_vrm),
      extensionsUsed: Array.from(new Set(gltf?.parser?.json?.extensionsUsed || []))
    });
  }

  function disposeObject3D(root) {
    if (!root?.traverse) return;
    const textures = new Set();
    const materials = new Set();
    const geometries = new Set();
    root.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      const list = Array.isArray(object.material) ? object.material : [object.material];
      list.filter(Boolean).forEach((material) => {
        materials.add(material);
        Object.values(material).forEach((value) => { if (value?.isTexture) textures.add(value); });
      });
      object.skeleton?.dispose?.();
    });
    textures.forEach((texture) => texture.dispose?.());
    materials.forEach((material) => material.dispose?.());
    geometries.forEach((geometry) => geometry.dispose?.());
    root.removeFromParent?.();
  }

  class AssetLoader {
    constructor(options = {}) {
      this.maxBytes = Math.max(1024, Number(options.maxBytes) || DEFAULT_MAX_BYTES);
      this.basePath = clean(options.basePath || "./");
      this.allowOrigins = new Set((options.allowOrigins || []).filter(Boolean));
      this.allowSameOrigin = options.allowSameOrigin === true;
      this.dracoDecoderPath = options.dracoDecoderPath || "./vendor/addons/libs/draco/gltf/";
      this.ktx2TranscoderPath = options.ktx2TranscoderPath || "./vendor/addons/libs/basis/";
      this.renderer = options.renderer || null;
      this._modulePromise = null;
      this._objectUrls = new Set();
      this._loadedRoots = new Set();
      this._loaders = [];
      this.disposed = false;
    }

    async modules() {
      if (this.disposed) throw new Error("AssetLoader has been disposed.");
      if (!this._modulePromise) this._modulePromise = Promise.all([
        import("../../vendor/addons/loaders/GLTFLoader.js"),
        import("../../vendor/addons/loaders/DRACOLoader.js"),
        import("../../vendor/addons/loaders/KTX2Loader.js"),
        import("../../vendor/addons/libs/meshopt_decoder.module.js")
      ]).then(([gltf, draco, ktx2, meshopt]) => ({
        GLTFLoader: gltf.GLTFLoader,
        DRACOLoader: draco.DRACOLoader,
        KTX2Loader: ktx2.KTX2Loader,
        MeshoptDecoder: meshopt.MeshoptDecoder
      }));
      return this._modulePromise;
    }

    async createLoader() {
      const modules = await this.modules();
      const loader = new modules.GLTFLoader();
      const draco = new modules.DRACOLoader().setDecoderPath(this.dracoDecoderPath);
      loader.setDRACOLoader(draco);
      if (modules.MeshoptDecoder) loader.setMeshoptDecoder(modules.MeshoptDecoder);
      let ktx2 = null;
      if (this.renderer) {
        ktx2 = new modules.KTX2Loader().setTranscoderPath(this.ktx2TranscoderPath);
        try { ktx2.detectSupport(this.renderer); loader.setKTX2Loader(ktx2); }
        catch (_) { ktx2.dispose?.(); ktx2 = null; }
      }
      this._loaders.push({ loader, draco, ktx2 });
      return loader;
    }

    validateFile(file) {
      if (!(file instanceof Blob)) throw new TypeError("A browser File or Blob is required.");
      const name = clean(file.name || "asset.glb");
      const extension = extensionOf(name);
      const errors = [];
      const warnings = [];
      if (!ACCEPTED_EXTENSIONS.has(extension)) errors.push("Chỉ chấp nhận file .glb hoặc .vrm.");
      if (file.size <= 0) errors.push("File rỗng.");
      if (file.size > this.maxBytes) errors.push(`File vượt giới hạn ${Math.round(this.maxBytes / 1048576)} MB.`);
      const mime = clean(file.type).toLowerCase();
      if (!ACCEPTED_MIME.has(mime)) warnings.push(`MIME ${mime || "unknown"} không chuẩn; sẽ xác minh magic bytes.`);
      return Object.freeze({ valid: errors.length === 0, errors, warnings, name, extension, mime, size: file.size });
    }

    validateUrl(input) {
      let url;
      try { url = new URL(input, global.location?.href || this.basePath); }
      catch (_) { throw new Error("URL tài sản không hợp lệ."); }
      if (!new Set(["http:", "https:"]).has(url.protocol)) throw new Error("Chỉ cho phép URL HTTP(S).");
      const sameOrigin = Boolean(global.location?.origin && url.origin === global.location.origin);
      const trustedInternal = sameOrigin && /^\/assets\/character-3d\/[a-z0-9._/-]+\.(?:glb|vrm)$/i.test(url.pathname);
      if (trustedInternal) {
        if (url.username || url.password || url.search) throw new Error("Internal asset URL may not include credentials or query parameters.");
        return url.href;
      }
      if (!(sameOrigin && this.allowSameOrigin) && !this.allowOrigins.has(url.origin)) throw new Error("Nguồn bên ngoài chưa nằm trong allowlist.");
      if (url.username || url.password) throw new Error("Không cho phép credentials trong URL tài sản.");
      return url.href;
    }

    async loadFile(file, options = {}) {
      ensureNotAborted(options.signal);
      const validation = this.validateFile(file);
      if (!validation.valid) throw new Error(validation.errors.join(" "));
      const buffer = await file.arrayBuffer();
      ensureNotAborted(options.signal);
      const magic = readMagic(buffer);
      if (!magic.valid) throw new Error(magic.reason || "GLB/VRM không hợp lệ.");
      const structure = inspectGlbStructure(buffer);
      if (!structure.valid) throw new Error(structure.errors.join(" "));
      const hash = options.hash === false || !global.crypto?.subtle ? "" : await global.HHCharacter3DRightsRegistry?.RightsRegistry.sha256(buffer).catch(() => "");
      ensureNotAborted(options.signal);
      return this.parse(buffer, { fileName: validation.name, byteLength: buffer.byteLength, sha256: hash, warnings: validation.warnings, signal: options.signal });
    }

    async loadUrl(input, options = {}) {
      ensureNotAborted(options.signal);
      if (options.trustedInternal !== true) throw new Error("URL import is disabled. Choose a local GLB/VRM file; only reviewed internal assets may use this path.");
      const url = this.validateUrl(input);
      const response = await fetch(url, { credentials: "same-origin", cache: options.cache || "no-store", signal: options.signal });
      if (!response.ok) {
        const missing = response.status === 404 || response.status === 410;
        throw new AssetLoadError(
          missing ? "Bản dựng GLB nội bộ chưa tồn tại." : `Không tải được model nội bộ (${response.status}).`,
          missing ? "ASSET_NOT_FOUND" : "ASSET_HTTP_ERROR",
          { status: response.status, url }
        );
      }
      const length = Number(response.headers.get("content-length")) || 0;
      if (length > this.maxBytes) throw new AssetLoadError("Model từ URL vượt giới hạn dung lượng.", "ASSET_TOO_LARGE", { status: response.status, url });
      const buffer = await response.arrayBuffer();
      ensureNotAborted(options.signal);
      if (buffer.byteLength > this.maxBytes) throw new AssetLoadError("Model từ URL vượt giới hạn dung lượng.", "ASSET_TOO_LARGE", { status: response.status, url });
      const magic = readMagic(buffer);
      if (!magic.valid) {
        const contentType = clean(response.headers.get("content-type")).toLowerCase();
        const missing = contentType.includes("text/html");
        throw new AssetLoadError(
          missing ? "Bản dựng GLB nội bộ chưa tồn tại; máy chủ trả về trang HTML thay cho asset." : (magic.reason || "Dữ liệu URL không phải GLB/VRM hợp lệ."),
          missing ? "ASSET_NOT_FOUND" : "INVALID_GLB",
          { status: response.status, url }
        );
      }
      const structure = inspectGlbStructure(buffer);
      if (!structure.valid) throw new AssetLoadError(structure.errors.join(" "), "INVALID_GLB", { status: response.status, url });
      const hash = options.hash === false || !global.crypto?.subtle ? "" : await global.HHCharacter3DRightsRegistry?.RightsRegistry.sha256(buffer).catch(() => "");
      ensureNotAborted(options.signal);
      return this.parse(buffer, { fileName: url.split("/").pop() || "asset.glb", sourceUrl: url, byteLength: buffer.byteLength, sha256: hash, signal: options.signal });
    }

    async parse(buffer, metadata = {}) {
      ensureNotAborted(metadata.signal);
      if (buffer.byteLength > this.maxBytes) throw new Error("Model vượt giới hạn dung lượng.");
      const structure = inspectGlbStructure(buffer);
      if (!structure.valid) throw new Error(structure.errors.join(" "));
      const loader = await this.createLoader();
      ensureNotAborted(metadata.signal);
      const gltf = await new Promise((resolve, reject) => loader.parse(buffer, this.basePath, resolve, reject));
      ensureNotAborted(metadata.signal);
      if (!gltf?.scene) throw new Error("Model không chứa scene có thể hiển thị.");
      this._loadedRoots.add(gltf.scene);
      const report = inspectScene(gltf, metadata.byteLength || buffer.byteLength);
      const asset = {
        id: `asset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        name: clean(metadata.fileName || gltf.scene.name || "Character"),
        sourceUrl: metadata.sourceUrl || "",
        sha256: metadata.sha256 || "",
        warnings: Array.isArray(metadata.warnings) ? metadata.warnings.slice() : [],
        gltf,
        scene: gltf.scene,
        animations: gltf.animations || [],
        report,
        dispose: () => { disposeObject3D(gltf.scene); this._loadedRoots.delete(gltf.scene); }
      };
      return Object.freeze(asset);
    }

    createObjectURL(blob) {
      const url = URL.createObjectURL(blob);
      this._objectUrls.add(url);
      return url;
    }

    revokeObjectURL(url) {
      if (!this._objectUrls.has(url)) return false;
      URL.revokeObjectURL(url); this._objectUrls.delete(url); return true;
    }

    release(asset) {
      if (!asset?.scene) return false;
      disposeObject3D(asset.scene);
      this._loadedRoots.delete(asset.scene);
      return true;
    }

    dispose() {
      if (this.disposed) return;
      this.disposed = true;
      this._loadedRoots.forEach(disposeObject3D);
      this._loadedRoots.clear();
      this._objectUrls.forEach((url) => URL.revokeObjectURL(url));
      this._objectUrls.clear();
      this._loaders.forEach(({ draco, ktx2 }) => { draco?.dispose?.(); ktx2?.dispose?.(); });
      this._loaders.length = 0;
      this._modulePromise = null;
    }
  }

  global.HHCharacter3DAssetLoader = Object.freeze({ AssetLoader, AssetLoadError, inspectScene, readMagic, inspectGlbStructure, disposeObject3D, DEFAULT_MAX_BYTES, ACCEPTED_EXTENSIONS });
  global.HHCharacter3D = global.HHCharacter3D || {};
  global.HHCharacter3D.AssetLoader = AssetLoader;
})(typeof window !== "undefined" ? window : globalThis);
