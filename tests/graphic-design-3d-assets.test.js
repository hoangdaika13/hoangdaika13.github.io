const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const studio = require("../graphic-design-3d.js");

function file(name, bytes, type = "application/octet-stream") {
  const blob = new Blob([bytes], { type });
  Object.defineProperty(blob, "name", { value: name });
  return blob;
}

// This double models transaction commit/abort, not only individual request success.
// Real IndexedDB and the WebGL hydration path are separately exercised in browser QA.
function memoryIDB() {
  const data = new Map();
  const api = { data, commits: 0, closes: 0, abortNextCommit: false, quota: false, deferOpen: false, opens: [] };
  const db = {
    objectStoreNames: { contains: () => true },
    close() { api.closes += 1; },
    transaction() {
      let pending = 0, finished = false;
      const writes = [];
      const tx = {
        error: null,
        abort() { if (finished) return; finished = true; queueMicrotask(() => tx.onabort?.()); },
        objectStore() { return store; }
      };
      function finish() {
        if (finished || pending) return;
        if (api.abortNextCommit) { api.abortNextCommit = false; tx.error = new Error("Commit aborted"); tx.abort(); return; }
        finished = true; writes.forEach((write) => write()); api.commits += 1; tx.oncomplete?.();
      }
      function request(read, write) {
        const req = {}; pending += 1;
        queueMicrotask(() => {
          if (finished) return;
          if (write && api.quota) { req.error = new Error("QuotaExceededError"); req.onerror?.(); if (!finished) tx.abort(); }
          else { req.result = read(); if (write) writes.push(write); req.onsuccess?.(); }
          pending -= 1; queueMicrotask(finish);
        });
        return req;
      }
      const store = {
        get(id) { return request(() => structuredClone(data.get(id))); },
        index() { return { getAll(scope) { return request(() => [...data.values()].filter((record) => record.scope === scope).map((record) => structuredClone(record))); } }; },
        put(record) { const copy = structuredClone(record); return request(() => record.id, () => data.set(record.id, copy)); },
        delete(id) { return request(() => undefined, () => data.delete(id)); }
      };
      queueMicrotask(finish);
      return tx;
    }
  };
  api.open = () => {
    const request = { result: db };
    const resolve = () => request.onsuccess?.();
    if (api.deferOpen) api.opens.push(resolve); else queueMicrotask(resolve);
    return request;
  };
  return api;
}

function vault(indexedDB, accountId = "a", projectId = "p") {
  return studio.createBinaryAssetStore({ indexedDB, projectContext: { accountId, projectId } });
}

function triangleDocument() {
  const bytes = new Float32Array([-1, 0, 0, 1, 0, 0, 0, 1, 0]);
  return {
    asset: { version: "2.0" },
    buffers: [{ uri: `data:application/octet-stream;base64,${Buffer.from(bytes.buffer).toString("base64")}`, byteLength: bytes.byteLength }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: bytes.byteLength }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: "VEC3" }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    nodes: [{ mesh: 0 }], scenes: [{ nodes: [0] }], scene: 0
  };
}

test("3D original asset bundle bytes/names/MIME survive a committed vault round trip", async () => {
  const idb = memoryIDB(), store = vault(idb);
  const original = file("triangle.gltf", JSON.stringify(triangleDocument()), "model/gltf+json");
  const texture = file("fabric.png", Uint8Array.from([0, 12, 255, 87]), "image/png");
  const saved = await store.put([original, texture], "model");
  assert.equal(saved.fileCount, 2); assert.equal(saved.bytes, original.size + texture.size);
  assert.equal(idb.data.size, 1); assert.equal(idb.commits, 1);
  const restored = await store.get(saved.id), files = studio.recordFiles(restored);
  assert.equal(restored.kind, "model"); assert.equal(files[0].name, original.name);
  assert.equal(files[0].type, "model/gltf+json");
  assert.deepEqual(new Uint8Array(await files[0].arrayBuffer()), new Uint8Array(await original.arrayBuffer()));
  assert.deepEqual(new Uint8Array(await files[1].arrayBuffer()), Uint8Array.from([0, 12, 255, 87]));
  store.close(); assert.equal(idb.closes, 1);
});

test("3D binary references cannot read assets from another account/project or missing record", async () => {
  const idb = memoryIDB(), a = vault(idb, "alice", "first");
  const saved = await a.put([file("surface.webp", "actual-binary", "image/webp")], "texture");
  assert.equal(await vault(idb, "bob", "first").get(saved.id), null);
  assert.equal(await vault(idb, "alice", "second").get(saved.id), null);
  assert.equal(await a.get("asset-missing"), null);
  assert.equal(await a.get("../../another-key"), null);
  assert.ok(await a.get(saved.id));
});

test("3D vault fails closed without explicit identity or IndexedDB", async () => {
  const original = file("image.png", "bytes", "image/png");
  await assert.rejects(studio.createBinaryAssetStore({ indexedDB: memoryIDB() }).put([original], "texture"), /tài khoản.*dự án/);
  await assert.rejects(studio.createBinaryAssetStore({ indexedDB: null, projectContext: { accountId: "a", projectId: "p" } }).put([original], "texture"), /IndexedDB/);
});

test("3D request success is not save success when transaction later aborts", async () => {
  const idb = memoryIDB(), store = vault(idb); idb.abortNextCommit = true;
  await assert.rejects(store.put([file("image.png", "bytes", "image/png")], "texture"), /Commit aborted/);
  assert.equal(idb.data.size, 0); assert.equal(idb.commits, 0);
  const saved = await store.put([file("image.png", "retry", "image/png")], "texture");
  assert.ok(await store.get(saved.id));
});

test("3D quota failure remains a failure and cannot manufacture a stored asset", async () => {
  const idb = memoryIDB(), store = vault(idb); idb.quota = true;
  await assert.rejects(store.put([file("image.png", "bytes", "image/png")], "texture"), /QuotaExceededError/);
  assert.equal(idb.data.size, 0);
});

test("3D asset caps, duplicate filenames and unsupported texture types reject before a write", async () => {
  const idb = memoryIDB(), store = vault(idb);
  await assert.rejects(store.put([file("a.hdr", "hdr")], "environment"), /HDR\/EXR/);
  await assert.rejects(store.put([file("x.png", "1"), file("x.png", "2")], "model"), /trùng/);
  await assert.rejects(store.put([{ name: "huge.png", size: studio.constants.MAX_ASSET_BYTES + 1, arrayBuffer() {} }], "texture"), /16 MiB/);
  await assert.rejects(store.put(Array.from({ length: 5 }, (_, i) => ({ name: `huge${i}.bin`, size: studio.constants.MAX_ASSET_BYTES, arrayBuffer() {} })), "model"), /64 MiB/);
  assert.equal(idb.data.size, 0);
});

test("3D project byte cap is isolated and no automatic garbage collection deletes old originals", async () => {
  const idb = memoryIDB(), store = vault(idb);
  const original = await store.put([file("old.png", "retain-original")], "texture");
  const record = [...idb.data.values()][0]; record.bytes = studio.constants.MAX_PROJECT_BYTES;
  await assert.rejects(store.put([file("extra.png", "more")], "texture"), /128 MiB/);
  assert.ok(await store.get(original.id));
  assert.ok((await vault(idb, "other", "p").put([file("extra.png", "more")], "texture")).id);
  await assert.rejects(store.remove(original.id), /xác nhận/);
  assert.equal(await store.remove(original.id, true), true);
  assert.equal(await store.get(original.id), null);
});

test("3D vault closes a database resolving after unmount and never writes stale data", async () => {
  const idb = memoryIDB(); idb.deferOpen = true;
  const store = vault(idb), pending = store.put([file("late.png", "late")], "texture");
  await new Promise((resolve) => setImmediate(resolve));
  store.close(); idb.opens.forEach((resolve) => resolve());
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(idb.closes, 1); assert.equal(idb.data.size, 0);
});

test("3D model+material asset references remain backward compatible through normalization", () => {
  const scene = studio.createDefaultScene();
  scene.objects.push(studio.makeObject("model", { asset: { storageId: "asset-model", fileName: "mesh.glb" }, material: { textureAssetId: "asset-texture", normalAssetId: "asset-normal" } }));
  const restored = studio.normalizeScene(JSON.parse(JSON.stringify(scene))).objects.at(-1);
  assert.equal(restored.asset.storageId, "asset-model"); assert.equal(restored.material.textureAssetId, "asset-texture"); assert.equal(restored.material.normalAssetId, "asset-normal");
  assert.equal(studio.makeObject("model", { asset: { storageId: "../bad" } }).asset.storageId, "");
  assert.equal(studio.normalizeScene({ objects: [{ type: "model", asset: { fileName: "legacy.glb" } }] }).objects[0].asset.storageId, "");
});

test("3D local decoder rejects unsupported extensions, skins, sparse accessors and cyclic hierarchy", () => {
  for (const mutate of [
    (gltf) => { gltf.extensionsRequired = ["KHR_draco_mesh_compression"]; },
    (gltf) => { gltf.nodes[0].skin = 0; },
    (gltf) => { gltf.accessors[0].sparse = {}; },
    (gltf) => { gltf.nodes[0].children = [0]; },
    (gltf) => { gltf.accessors[0].componentType = 5123; }
  ]) { const gltf = triangleDocument(); mutate(gltf); assert.throws(() => studio.validateGltfDocument(gltf)); }
});

test("3D decoder renders a stored self-contained original with actual Three geometry and never fetches URL buffers", async () => {
  const THREE = await import(pathToFileURL(path.resolve(__dirname, "../vendor/three.module.min.js")).href);
  const idb = memoryIDB(), store = vault(idb);
  const saved = await store.put([file("triangle.gltf", JSON.stringify(triangleDocument()), "model/gltf+json")], "model");
  const imported = await studio.importGltfBundle(studio.recordFiles(await store.get(saved.id)), THREE);
  assert.equal(imported.vertices, 3); assert.equal(imported.triangles, 1);
  let meshes = 0; imported.root.traverse((node) => { if (node.isMesh) { meshes += 1; assert.equal(node.geometry.getAttribute("position").count, 3); node.geometry.dispose(); node.material.dispose(); } });
  assert.equal(meshes, 1);
  const external = triangleDocument(); external.buffers[0].uri = "https://example.invalid/private.bin";
  await assert.rejects(studio.importGltfBundle([file("external.gltf", JSON.stringify(external))], THREE), /URL bên ngoài/);
  const empty = triangleDocument(); empty.scenes[0].nodes = [];
  await assert.rejects(studio.importGltfBundle([file("empty.gltf", JSON.stringify(empty))], THREE), /không có mesh/);
});

test("3D GLB original and selected external BIN both rehydrate actual triangle geometry", async () => {
  const THREE = await import(pathToFileURL(path.resolve(__dirname, "../vendor/three.module.min.js")).href);
  const source = triangleDocument(), binary = new Uint8Array(studio.decodeDataUri(source.buffers[0].uri));
  delete source.buffers[0].uri;
  const encoded = new TextEncoder().encode(JSON.stringify(source));
  const jsonLength = Math.ceil(encoded.length / 4) * 4;
  const glb = new Uint8Array(12 + 8 + jsonLength + 8 + binary.length), header = new DataView(glb.buffer);
  header.setUint32(0, 0x46546c67, true); header.setUint32(4, 2, true); header.setUint32(8, glb.length, true);
  header.setUint32(12, jsonLength, true); header.setUint32(16, 0x4e4f534a, true);
  glb.fill(0x20, 20, 20 + jsonLength); glb.set(encoded, 20);
  header.setUint32(20 + jsonLength, binary.length, true); header.setUint32(24 + jsonLength, 0x004e4942, true); glb.set(binary, 28 + jsonLength);
  const idb = memoryIDB(), store = vault(idb);
  const saved = await store.put([file("triangle.glb", glb, "model/gltf-binary")], "model");
  const decoded = await studio.importGltfBundle(studio.recordFiles(await store.get(saved.id)), THREE);
  assert.equal(decoded.format, "glb"); assert.equal(decoded.triangles, 1);
  const split = triangleDocument(); split.buffers[0].uri = "parts/triangle.bin";
  const bundle = await store.put([file("triangle.gltf", JSON.stringify(split)), file("triangle.bin", binary)], "model");
  const external = await studio.importGltfBundle(studio.recordFiles(await store.get(bundle.id)), THREE);
  assert.equal(external.vertices, 3); assert.equal(external.triangles, 1);
  await assert.rejects(studio.importGltfBundle([file("missing.gltf", JSON.stringify(split))], THREE), /Thiếu file buffer/);
  const malformed = glb.slice(); new DataView(malformed.buffer).setUint32(8, malformed.length + 1, true);
  assert.throws(() => studio.parseGlb(malformed.buffer), /Độ dài GLB/);
});

test("3D cumulative geometry and instancing budgets reject repeated accessor amplification before allocation", () => {
  const repeated = triangleDocument(); repeated.accessors[0].count = 300000;
  repeated.meshes[0].primitives = Array.from({ length: 7 }, () => ({ attributes: { POSITION: 0 } }));
  assert.throws(() => studio.validateGltfDocument(repeated), /ngân sách/);
  const instances = triangleDocument(); instances.accessors[0].count = 300000;
  instances.nodes = Array.from({ length: 7 }, () => ({ mesh: 0 }));
  assert.throws(() => studio.validateGltfDocument(instances), /ngân sách/);
  const primitives = triangleDocument(); primitives.meshes[0].primitives = Array.from({ length: 4097 }, () => ({ attributes: { POSITION: 0 } }));
  assert.throws(() => studio.validateGltfDocument(primitives), /4096 primitive/);
  const components = triangleDocument(); components.accessors[0].count = 999999;
  components.accessors.push({ bufferView: 0, componentType: 5126, count: 999999, type: "VEC3" }, { bufferView: 0, componentType: 5126, count: 999999, type: "VEC2" }, { bufferView: 0, componentType: 5125, count: 9000000, type: "SCALAR" });
  Object.assign(components.meshes[0].primitives[0], { attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3 });
  assert.throws(() => studio.validateGltfDocument(components), /16 triệu thành phần/);
  const transform = triangleDocument(); transform.nodes[0].translation = [0, Infinity, 0];
  assert.throws(() => studio.validateGltfDocument(transform), /Transform glTF/);
  const incomplete = triangleDocument(); incomplete.accessors[0].count = 4;
  assert.throws(() => studio.validateGltfDocument(incomplete), /chia hết cho 3/);
});

test("3D invalid GPU attributes and triangle indices dispose every partial material/geometry", async () => {
  const THREE = await import(pathToFileURL(path.resolve(__dirname, "../vendor/three.module.min.js")).href);
  for (const invalid of ["position", "index"]) {
    const allocations = [];
    class TrackedGeometry extends THREE.BufferGeometry { constructor() { super(); this.disposals = 0; allocations.push(this); } dispose() { this.disposals += 1; super.dispose(); } }
    class TrackedMaterial extends THREE.MeshStandardMaterial { constructor(options) { super(options); this.disposals = 0; allocations.push(this); } dispose() { this.disposals += 1; super.dispose(); } }
    const instrumented = { ...THREE, BufferGeometry: TrackedGeometry, MeshStandardMaterial: TrackedMaterial };
    const gltf = triangleDocument(); gltf.materials = [{}]; gltf.meshes[0].primitives[0].material = 0;
    if (invalid === "position") {
      const positions = new Float32Array([-1, 0, 0, 1, 0, 0, 0, NaN, 0]);
      gltf.buffers[0].uri = `data:application/octet-stream;base64,${Buffer.from(positions.buffer).toString("base64")}`;
    } else {
      const indices = new Uint16Array([0, 1, 9]);
      gltf.buffers.push({ uri: `data:application/octet-stream;base64,${Buffer.from(indices.buffer).toString("base64")}`, byteLength: indices.byteLength });
      gltf.bufferViews.push({ buffer: 1, byteOffset: 0, byteLength: indices.byteLength });
      gltf.accessors.push({ bufferView: 1, componentType: 5123, count: 3, type: "SCALAR" });
      gltf.meshes[0].primitives[0].indices = 1;
    }
    await assert.rejects(studio.importGltfBundle([file(`${invalid}.gltf`, JSON.stringify(gltf))], instrumented), invalid === "position" ? /NaN\/Infinity/ : /Index glTF/);
    assert.equal(allocations.length, 2); assert.ok(allocations.every((resource) => resource.disposals === 1));
  }
});

test("3D texture URLs and async results have disposal/generation guards; JSON export stays honest", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../graphic-design-3d.js"), "utf8");
  assert.match(source, /finally \{ if \(objectUrls.delete\(url\)\) URL.revokeObjectURL\(url\)/);
  assert.match(source, /generation!==assetGeneration\|\|textureRevisions.get\(key\)!==revision/);
  assert.match(source, /texture.dispose\(\);throw abortError\(\)/);
  assert.match(source, /if\(disposed\)\{created\?\.destroy\(\);return;\}/);
  assert.match(source, /controller.ready=createThreeEngine/);
  assert.match(source, /Asset nhị phân không được nhúng/);
  assert.match(source, /if\(!editing\)renderInspector\(\)/);
  assert.match(source, /refreshUI=syncEngine\|\|!hasRendered\|\|renderedSelection!==selectedId/);
  assert.match(source, /\.g3d-stage\{grid-template-rows:auto auto minmax\(400px,1fr\) auto auto\}/);
});
