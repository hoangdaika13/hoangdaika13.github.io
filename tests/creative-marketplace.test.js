const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "creative-marketplace.js"), "utf8");
const css = fs.readFileSync(path.join(root, "creative-marketplace.css"), "utf8");
const marketplace = require(path.join(root, "creative-marketplace.js"));

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    dump: () => Object.fromEntries(values)
  };
}

function projectStore() {
  let state = {
    activeProjectId: "project-one",
    projects: [{ id: "project-one", name: "Campaign", assets: [] }]
  };
  return {
    getState: () => JSON.parse(JSON.stringify(state)),
    addAsset(projectId, asset) {
      assert.equal(projectId, "project-one");
      const inserted = { ...asset, id: asset.id || "asset-one" };
      state.projects[0].assets.unshift(inserted);
      return JSON.parse(JSON.stringify(inserted));
    },
    updateProject(projectId, patch) {
      assert.equal(projectId, "project-one");
      state.projects[0] = { ...state.projects[0], ...JSON.parse(JSON.stringify(patch)) };
      return JSON.parse(JSON.stringify(state.projects[0]));
    }
  };
}

test("Marketplace exposes the requested UMD API and versioned local contract", () => {
  assert.equal(marketplace.VERSION, 1);
  assert.equal(marketplace.FORMAT, "hh-creative-marketplace");
  assert.equal(marketplace.STORAGE_KEY, "hh.creative-marketplace.v1");
  assert.equal(marketplace.VIEW, "marketplace");
  assert.equal(typeof marketplace.mount, "function");
  assert.equal(typeof marketplace.unmount, "function");
  assert.match(source, /globalScope\.HHCreativeMarketplace = api/);
});

test("Built-in catalog covers every requested pack family", () => {
  const types = new Set(marketplace.BUILT_IN_CATALOG.map((pack) => pack.type));
  assert.deepEqual([...marketplace.TYPES].sort(), [...types].sort());
  assert.ok(marketplace.BUILT_IN_CATALOG.length >= 14);
  marketplace.BUILT_IN_CATALOG.forEach((pack) => {
    assert.ok(pack.name);
    assert.ok(pack.permissions.every((permission) => marketplace.ALLOWED_PERMISSIONS.includes(permission)));
    assert.equal(pack.source, "built-in");
  });
});

test("Manifest normalization bounds input and drops executable or secret fields", () => {
  const pack = marketplace.normalizeManifest({
    id: " Unsafe ID ",
    name: `\u0001${"x".repeat(180)}`,
    type: "workflow",
    permissions: ["write-project-workflow", "write-project-workflow"],
    tags: Array.from({ length: 40 }, (_, index) => `tag-${index}`),
    apiKey: "secret-value",
    code: "alert(1)",
    html: "<script>alert(1)</script>",
    preview: { headline: "<img onerror=alert(1)>", accent: "red" }
  });
  assert.equal(pack.id, "unsafe-id");
  assert.equal(pack.name.length, 100);
  assert.doesNotMatch(pack.name, /\u0001/);
  assert.deepEqual(pack.permissions, ["write-project-workflow"]);
  assert.equal(pack.tags.length, 16);
  assert.equal(Object.hasOwn(pack, "apiKey"), false);
  assert.equal(Object.hasOwn(pack, "code"), false);
  assert.equal(Object.hasOwn(pack, "html"), false);
  assert.equal(pack.preview.accent, "#62D7E7");
});

test("Validation rejects unknown permissions instead of silently granting them", () => {
  const result = marketplace.validateManifest({
    format: marketplace.FORMAT,
    name: "Unsafe plugin",
    type: "template",
    permissions: ["write-project-assets", "network", "execute-code"],
    contents: ["Template"]
  });
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /network/);
  assert.match(result.errors.join(" "), /execute-code/);
  assert.deepEqual(result.manifest.permissions, ["write-project-assets"]);
});

test("Manifest parser rejects malformed, oversized and foreign documents", () => {
  assert.throws(() => marketplace.parseManifestJson("{"), /JSON không hợp lệ/);
  assert.throws(() => marketplace.parseManifestJson("x".repeat(marketplace.MAX_IMPORT_BYTES + 1)), /250 KB/);
  assert.throws(() => marketplace.parseManifestJson(JSON.stringify({ format: "other", name: "Pack", type: "template" })), /định dạng/i);
});

test("Exported manifest is data-only and excludes runtime source metadata", () => {
  const json = marketplace.exportManifest({
    id: "pack", name: "Pack", type: "template", permissions: ["write-project-assets"],
    apiKey: "never-export", code: "danger", source: "remote"
  });
  const parsed = JSON.parse(json);
  assert.equal(parsed.format, marketplace.FORMAT);
  assert.equal(Object.hasOwn(parsed, "source"), false);
  assert.equal(Object.hasOwn(parsed, "unknownPermissions"), false);
  assert.equal(json.includes("never-export"), false);
  assert.equal(json.includes("danger"), false);
});

test("Local state persists favorites, imported manifests and install receipts", () => {
  const storage = memoryStorage();
  const store = marketplace.createMarketplaceStore({ storage });
  store.toggleFavorite("social-motion-kit");
  store.addImported({ name: "My Pack", type: "lut", permissions: ["write-project-assets"], contents: ["LUT"] });
  store.markInstalled({ packId: "social-motion-kit", projectId: "project-one", assetId: "asset-one", version: "1.0.0" });
  const next = marketplace.createMarketplaceStore({ storage }).getState();
  assert.deepEqual(next.favorites, ["social-motion-kit"]);
  assert.equal(next.imported[0].name, "My Pack");
  assert.equal(next.installed[0].projectId, "project-one");
  assert.ok(storage.dump()[marketplace.STORAGE_KEY]);
});

test("Catalog filtering supports query, family and favorites", () => {
  const catalog = marketplace.BUILT_IN_CATALOG;
  assert.ok(marketplace.filterCatalog(catalog, "anime", "all", []).some((pack) => pack.id === "anime-explorer"));
  assert.ok(marketplace.filterCatalog(catalog, "", "workflow", []).every((pack) => pack.type === "workflow"));
  const favorites = marketplace.filterCatalog(catalog, "", "favorites", ["aurora-brand"]);
  assert.deepEqual(favorites.map((pack) => pack.id), ["aurora-brand"]);
});

test("Installation requires explicit confirmation and a real project store", () => {
  const pack = marketplace.BUILT_IN_CATALOG[0];
  assert.throws(() => marketplace.installPack(pack, { store: projectStore() }), (error) => error.code === "INSTALL_CONFIRMATION_REQUIRED");
  assert.throws(() => marketplace.installPack(pack, { confirmed: true }), /tạo hoặc chọn/);
});

test("Confirmed install delegates once to onInstall and records its real asset receipt", () => {
  const store = projectStore();
  let callback = null;
  const pack = marketplace.BUILT_IN_CATALOG.find((item) => item.id === "shorts-factory");
  const receipt = marketplace.installPack(pack, {
    confirmed: true,
    store,
    currentUser: { name: "Huy Hoàng" },
    onInstall: (payload) => {
      callback = payload;
      return store.addAsset("project-one", payload.asset);
    }
  });
  const asset = store.getState().projects[0].assets[0];
  assert.equal(receipt.packId, "shorts-factory");
  assert.equal(receipt.projectId, "project-one");
  assert.equal(receipt.installedBy, "Huy Hoàng");
  assert.ok(asset.tags.includes("marketplace"));
  assert.ok(asset.tags.includes("pack:shorts-factory"));
  assert.equal(callback.id, "shorts-factory");
  assert.equal(asset.id, receipt.assetId);
});

test("A pack cannot be installed twice into the same active project", () => {
  const store = projectStore();
  const pack = marketplace.BUILT_IN_CATALOG[0];
  marketplace.installPack(pack, { confirmed: true, store });
  assert.throws(() => marketplace.installPack(pack, { confirmed: true, store }), /đã có/);
});

test("Integration callback assets are repaired with traceable pack tags", () => {
  const store = projectStore();
  const pack = marketplace.BUILT_IN_CATALOG.find((item) => item.id === "aurora-brand");
  const receipt = marketplace.installPack(pack, {
    confirmed: true,
    store,
    onInstall: (payload) => store.addAsset("project-one", { name: payload.name, type: "marketplace" })
  });
  const asset = store.getState().projects[0].assets.find((item) => item.id === receipt.assetId);
  assert.ok(asset.tags.includes("pack:aurora-brand"));
  assert.equal(asset.kind, "marketplace-pack");
});

test("Uninstall removes only the matching Marketplace asset", () => {
  const store = projectStore();
  const first = marketplace.BUILT_IN_CATALOG[0];
  const second = marketplace.BUILT_IN_CATALOG[1];
  marketplace.installPack(first, { confirmed: true, store });
  marketplace.installPack(second, { confirmed: true, store });
  const result = marketplace.uninstallPack(first.id, "project-one", store);
  assert.equal(result.removed, true);
  const assets = store.getState().projects[0].assets;
  assert.equal(assets.length, 1);
  assert.ok(assets[0].tags.includes(`pack:${second.id}`));
});

test("Preview document escapes manifest text and contains no network capability", () => {
  const html = marketplace.buildPreviewDocument({
    name: "<script>bad()</script>",
    type: "template",
    summary: "<img src=x onerror=bad()>",
    permissions: []
  });
  assert.equal(html.includes("<script>bad()</script>"), false);
  assert.equal(html.includes("<img src=x"), false);
  assert.match(html, /HH local preview/);
  assert.doesNotMatch(html, /fetch\s*\(/);
  assert.doesNotMatch(html, /XMLHttpRequest|WebSocket/);
});

test("Preview message allowlist checks both frame source and message type", () => {
  const frame = {};
  assert.equal(marketplace.isAllowedPreviewMessage({ source: frame, data: { type: "hh-marketplace.preview-ready" } }, frame), true);
  assert.equal(marketplace.isAllowedPreviewMessage({ source: {}, data: { type: "hh-marketplace.preview-ready" } }, frame), false);
  assert.equal(marketplace.isAllowedPreviewMessage({ source: frame, data: { type: "execute" } }, frame), false);
  assert.equal(marketplace.isAllowedPreviewMessage({ source: frame, data: "ready" }, frame), false);
});

test("Source never fetches or executes third-party code and iframe is tightly sandboxed", () => {
  assert.doesNotMatch(source, /\beval\s*\(/);
  assert.doesNotMatch(source, /new\s+Function\s*\(/);
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /document\.write\s*\(/);
  assert.match(source, /sandbox="allow-scripts"/);
  assert.doesNotMatch(source, /allow-same-origin|allow-forms|allow-popups|allow-top-navigation/);
  assert.match(source, /PREVIEW_MESSAGE_TYPES/);
});

test("UI contract includes search, filters, preview, permissions, install manager and custom confirmation", () => {
  [
    "data-field=\"query\"", "data-filter=", "data-action=\"preview\"", "data-action=\"favorite\"",
    "data-action=\"confirm-install\"", "data-action=\"uninstall\"", "data-field=\"manifest-file\"",
    "role=\"dialog\"", "aria-modal=\"true\"", "PROJECT PACK MANAGER"
  ].forEach((needle) => assert.ok(source.includes(needle), needle));
  assert.doesNotMatch(source, /window\.confirm|globalScope\.confirm|window\.prompt|globalScope\.prompt/);
});

test("Styles provide responsive 375px layout, visible focus and reduced motion", () => {
  assert.match(css, /@media\(max-width:560px\)/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css, /grid-template-columns:1fr/);
  assert.match(css, /overflow-x:auto/);
  assert.doesNotMatch(css, /letter-spacing:\s*-\d/);
});
