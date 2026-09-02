(function galaxyLayerOneStorageBootstrap(root, factory) {
  "use strict";

  const api = factory(root || {});
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HHGalaxyLayerOneStorage = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createGalaxyLayerOneStorage(globalScope) {
  "use strict";

  const SCHEMA = "hh-galaxy-layer-one-storage";
  const VERSION = 1;
  const RECORD_STORE = "records";
  const META_STORE = "meta";
  const DEFAULT_LIMITS = Object.freeze({
    maxRecordBytes: 16 * 1024 * 1024,
    maxTotalBytes: 128 * 1024 * 1024,
    maxRecords: 1000,
    maxListResults: 250
  });
  const sessionNamespaces = new Map();

  function storageError(code, message, cause) {
    const error = new Error(message || code);
    error.name = "GalaxyStorageError";
    error.code = code;
    if (cause !== undefined) error.cause = cause;
    return error;
  }

  function normalizeError(error, fallbackCode) {
    if (error && error.name === "GalaxyStorageError" && error.code) return error;
    const code = fallbackCode || "STORAGE_FAILED";
    return storageError(code, error && error.message ? String(error.message) : code, error);
  }

  function positiveInteger(value, fallback, maximum) {
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number <= 0) return fallback;
    return Math.min(number, maximum || Number.MAX_SAFE_INTEGER);
  }

  function normalizeLimits(value) {
    const source = value && typeof value === "object" ? value : {};
    return Object.freeze({
      maxRecordBytes: positiveInteger(source.maxRecordBytes, DEFAULT_LIMITS.maxRecordBytes),
      maxTotalBytes: positiveInteger(source.maxTotalBytes, DEFAULT_LIMITS.maxTotalBytes),
      maxRecords: positiveInteger(source.maxRecords, DEFAULT_LIMITS.maxRecords, 100000),
      maxListResults: positiveInteger(source.maxListResults, DEFAULT_LIMITS.maxListResults, 5000)
    });
  }

  function validateRoute(value, allowedRoutes) {
    const route = String(value || "").trim();
    if (!route || route.length > 160 || !/^\/[a-z0-9][a-z0-9/_-]*$/i.test(route) || route.includes("//") || route.includes("..")) {
      throw storageError("ROUTE_INVALID", "Route lưu trữ không hợp lệ.");
    }
    if (allowedRoutes && !allowedRoutes.has(route)) throw storageError("ROUTE_NOT_ALLOWED", "Route không thuộc phạm vi được phép.");
    return route;
  }

  function validateId(value) {
    const id = String(value || "").trim();
    if (!/^[a-zA-Z0-9._-]{1,128}$/.test(id)) throw storageError("ID_INVALID", "ID bản ghi không hợp lệ.");
    return id;
  }

  function recordKey(route, id) {
    return route + "::" + id;
  }

  function cloneFallback(value, seen) {
    if (value === null || value === undefined) return value;
    const type = typeof value;
    if (["string", "number", "boolean", "bigint"].includes(type)) return value;
    if (type === "function" || type === "symbol") throw storageError("CLONE_FAILED", "Dữ liệu chứa kiểu không thể sao chép an toàn.");
    if (seen.has(value)) return seen.get(value);
    if (value instanceof Date) return new Date(value.getTime());
    if (value instanceof RegExp) return new RegExp(value.source, value.flags);
    if (typeof globalScope.Blob === "function" && value instanceof globalScope.Blob) return value.slice(0, value.size, value.type);
    if (value instanceof ArrayBuffer) return value.slice(0);
    if (ArrayBuffer.isView(value)) {
      if (value instanceof DataView) {
        const buffer = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
        return new DataView(buffer);
      }
      return new value.constructor(value);
    }
    if (value instanceof Map) {
      const result = new Map();
      seen.set(value, result);
      value.forEach(function cloneMapEntry(entryValue, entryKey) {
        result.set(cloneFallback(entryKey, seen), cloneFallback(entryValue, seen));
      });
      return result;
    }
    if (value instanceof Set) {
      const result = new Set();
      seen.set(value, result);
      value.forEach(function cloneSetEntry(entry) { result.add(cloneFallback(entry, seen)); });
      return result;
    }
    if (Array.isArray(value)) {
      const result = new Array(value.length);
      seen.set(value, result);
      Reflect.ownKeys(value).forEach(function cloneArrayEntry(key) {
        if (key === "length") return;
        if (typeof key === "symbol") throw storageError("CLONE_FAILED", "Dữ liệu chứa khóa Symbol không được hỗ trợ.");
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || typeof descriptor.get === "function" || typeof descriptor.set === "function") {
          throw storageError("CLONE_FAILED", "Dữ liệu chứa accessor không được hỗ trợ.");
        }
        if (!descriptor.enumerable) return;
        Object.defineProperty(result, key, {
          value: cloneFallback(descriptor.value, seen),
          enumerable: true,
          configurable: true,
          writable: true
        });
      });
      return result;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw storageError("CLONE_FAILED", "Dữ liệu chứa object không được hỗ trợ.");
    }
    const result = prototype === null ? Object.create(null) : {};
    seen.set(value, result);
    Reflect.ownKeys(value).forEach(function cloneObjectEntry(key) {
      if (typeof key === "symbol") throw storageError("CLONE_FAILED", "Dữ liệu chứa khóa Symbol không được hỗ trợ.");
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || typeof descriptor.get === "function" || typeof descriptor.set === "function") {
        throw storageError("CLONE_FAILED", "Dữ liệu chứa accessor không được hỗ trợ.");
      }
      if (!descriptor.enumerable) return;
      Object.defineProperty(result, key, {
        value: cloneFallback(descriptor.value, seen),
        enumerable: true,
        configurable: true,
        writable: true
      });
    });
    return result;
  }

  function cloneValue(value) {
    try {
      return cloneFallback(value, new WeakMap());
    } catch (error) {
      throw normalizeError(error, "CLONE_FAILED");
    }
  }

  function utf8Bytes(value) {
    const text = String(value || "");
    if (typeof globalScope.TextEncoder === "function") return new globalScope.TextEncoder().encode(text).byteLength;
    let bytes = 0;
    for (let index = 0; index < text.length; index += 1) {
      const code = text.charCodeAt(index);
      if (code < 0x80) bytes += 1;
      else if (code < 0x800) bytes += 2;
      else if (code >= 0xd800 && code <= 0xdbff && index + 1 < text.length) { bytes += 4; index += 1; }
      else bytes += 3;
    }
    return bytes;
  }

  function estimateBytes(value, seen) {
    if (value === null || value === undefined) return 4;
    const type = typeof value;
    if (type === "string") return utf8Bytes(value);
    if (type === "number") return 8;
    if (type === "boolean") return 4;
    if (type === "bigint") return utf8Bytes(value.toString());
    if (type === "function" || type === "symbol") throw storageError("CLONE_FAILED", "Dữ liệu chứa kiểu không thể lưu.");
    const visited = seen || new WeakSet();
    if (visited.has(value)) return 0;
    visited.add(value);
    if (value instanceof Date) return 16;
    if (value instanceof RegExp) return utf8Bytes(value.source + value.flags);
    if (typeof globalScope.Blob === "function" && value instanceof globalScope.Blob) return value.size;
    if (value instanceof ArrayBuffer) return value.byteLength;
    if (ArrayBuffer.isView(value)) return value.byteLength;
    if (value instanceof Map) {
      let total = 16;
      value.forEach(function measureMap(entryValue, entryKey) { total += estimateBytes(entryKey, visited) + estimateBytes(entryValue, visited); });
      return total;
    }
    if (value instanceof Set) {
      let total = 16;
      value.forEach(function measureSet(entry) { total += estimateBytes(entry, visited); });
      return total;
    }
    if (Array.isArray(value)) return value.reduce(function measureArray(total, entry) { return total + estimateBytes(entry, visited); }, 16);
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw storageError("CLONE_FAILED", "Dữ liệu chứa object không được hỗ trợ.");
    return Object.keys(value).reduce(function measureObject(total, key) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || typeof descriptor.get === "function" || typeof descriptor.set === "function") {
        throw storageError("CLONE_FAILED", "Dữ liệu chứa accessor không được hỗ trợ.");
      }
      return total + utf8Bytes(key) + estimateBytes(descriptor.value, visited);
    }, 16);
  }

  function safeIsoDate(value, now) {
    const time = Date.parse(String(value || ""));
    return Number.isFinite(time) ? new Date(time).toISOString() : new Date(now()).toISOString();
  }

  function createMemoryBackend(options) {
    const config = options && typeof options === "object" ? options : {};
    const namespace = String(config.namespace || "default").slice(0, 180) || "default";
    let records;
    if (config.isolated === true) records = new Map();
    else {
      if (!sessionNamespaces.has(namespace)) sessionNamespaces.set(namespace, new Map());
      records = sessionNamespaces.get(namespace);
    }
    if (Array.isArray(config.seed) && records.size === 0) {
      config.seed.forEach(function seedRecord(record) {
        const copy = cloneValue(record);
        const key = copy.key || recordKey(copy.route, copy.id);
        records.set(key, copy);
      });
    }
    let opened = false;
    let closed = false;
    let aborted = false;

    function assertReady() {
      if (aborted) throw storageError("ABORTED", "Memory backend đã bị hủy.");
      if (!opened || closed) throw storageError("BACKEND_CLOSED", "Memory backend chưa mở hoặc đã đóng.");
    }

    const backend = {
      kind: "memory",
      persistent: false,
      async open(context) {
        if (aborted) throw storageError("ABORTED", "Memory backend đã bị hủy.");
        const migrated = new Map();
        for (const value of records.values()) {
          const record = context.migrateRecord(value);
          migrated.set(record.key, cloneValue(record));
        }
        records.clear();
        migrated.forEach(function restoreRecord(value, key) { records.set(key, value); });
        opened = true;
        closed = false;
        return backend;
      },
      async get(key) { assertReady(); return records.has(key) ? cloneValue(records.get(key)) : null; },
      async list(route) {
        assertReady();
        return [...records.values()].filter(function routeRecord(record) { return record.route === route; }).map(cloneValue);
      },
      async put(record) { assertReady(); records.set(record.key, cloneValue(record)); return true; },
      async delete(key) { assertReady(); return records.delete(key); },
      async clear(route) {
        assertReady();
        let removed = 0;
        [...records.entries()].forEach(function clearEntry(entry) {
          if (entry[1].route === route) { records.delete(entry[0]); removed += 1; }
        });
        return removed;
      },
      async stats(route) {
        assertReady();
        const selected = route ? [...records.values()].filter(function routeRecord(record) { return record.route === route; }) : [...records.values()];
        return { records: selected.length, bytes: selected.reduce(function sum(total, record) { return total + Number(record.bytes || 0); }, 0) };
      },
      async close() { opened = false; closed = true; },
      async abort() { opened = false; aborted = true; },
      dump() { return [...records.values()].map(cloneValue); }
    };
    return Object.freeze(backend);
  }

  function createIndexedDbBackend(options) {
    const config = options && typeof options === "object" ? options : {};
    const indexedDB = config.indexedDB;
    if (!indexedDB || typeof indexedDB.open !== "function") throw storageError("INDEXEDDB_UNAVAILABLE", "IndexedDB không khả dụng.");
    const name = String(config.name || "hh-galaxy-layer-one-storage").slice(0, 180);
    const version = positiveInteger(config.version, VERSION, 1000);
    let database = null;
    let aborted = false;
    let closed = false;
    const transactions = new Set();

    function abortTransactions() {
      transactions.forEach(function abortTransaction(transaction) {
        try { transaction.abort(); } catch (_) { /* Transaction already settled. */ }
      });
      transactions.clear();
    }

    function assertReady() {
      if (aborted) throw storageError("ABORTED", "IndexedDB backend đã bị hủy.");
      if (!database || closed) throw storageError("BACKEND_CLOSED", "IndexedDB chưa mở hoặc đã đóng.");
    }

    function withStore(mode, operation) {
      assertReady();
      return new Promise(function indexedDbTransaction(resolve, reject) {
        let transaction;
        let result;
        try {
          transaction = database.transaction([RECORD_STORE], mode);
          transactions.add(transaction);
          const store = transaction.objectStore(RECORD_STORE);
          operation(store, function setResult(value) { result = value; }, transaction);
        } catch (error) {
          if (transaction) transactions.delete(transaction);
          reject(normalizeError(error, "INDEXEDDB_TRANSACTION_FAILED"));
          return;
        }
        transaction.oncomplete = function completeTransaction() { transactions.delete(transaction); resolve(cloneValue(result)); };
        transaction.onerror = function failTransaction() { transactions.delete(transaction); reject(normalizeError(transaction.error, "INDEXEDDB_TRANSACTION_FAILED")); };
        transaction.onabort = function abortTransaction() { transactions.delete(transaction); reject(normalizeError(transaction.error, aborted ? "ABORTED" : "INDEXEDDB_TRANSACTION_ABORTED")); };
      });
    }

    const backend = {
      kind: "indexeddb",
      persistent: true,
      open(context) {
        if (aborted) return Promise.reject(storageError("ABORTED", "IndexedDB backend đã bị hủy."));
        return new Promise(function openIndexedDb(resolve, reject) {
          let request;
          let upgradeError = null;
          let settled = false;
          function rejectOnce(error) {
            if (settled) return;
            settled = true;
            reject(error);
          }
          try { request = indexedDB.open(name, version); }
          catch (error) { rejectOnce(normalizeError(error, "INDEXEDDB_OPEN_FAILED")); return; }
          request.onupgradeneeded = function upgrade(event) {
            const db = request.result;
            const transaction = request.transaction;
            try {
              let store;
              if (!db.objectStoreNames.contains(RECORD_STORE)) {
                store = db.createObjectStore(RECORD_STORE, { keyPath: "key" });
              } else store = transaction.objectStore(RECORD_STORE);
              if (!store.indexNames.contains("route")) store.createIndex("route", "route", { unique: false });
              if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: "key" });
              transaction.objectStore(META_STORE).put({ key: "schema", schema: context.schema, version: context.version });
              const cursorRequest = store.openCursor();
              cursorRequest.onsuccess = function migrateCursor() {
                const cursor = cursorRequest.result;
                if (!cursor) return;
                try { cursor.update(context.migrateRecord(cursor.value)); cursor.continue(); }
                catch (error) { upgradeError = normalizeError(error, "MIGRATION_FAILED"); transaction.abort(); }
              };
            } catch (error) {
              upgradeError = normalizeError(error, "MIGRATION_FAILED");
              try { transaction.abort(); } catch (_) { /* Upgrade already aborted. */ }
            }
            void event;
          };
          request.onsuccess = function opened() {
            if (settled) {
              try { request.result.close(); } catch (_) { /* A blocked request completed after fallback. */ }
              return;
            }
            settled = true;
            database = request.result;
            closed = false;
            database.onversionchange = function versionChanged() {
              abortTransactions();
              try { database.close(); } catch (_) { /* Database already closed. */ }
              database = null;
              closed = true;
            };
            resolve(backend);
          };
          request.onerror = function openFailed() { rejectOnce(upgradeError || normalizeError(request.error, "INDEXEDDB_OPEN_FAILED")); };
          request.onblocked = function openBlocked() { rejectOnce(storageError("INDEXEDDB_BLOCKED", "IndexedDB đang bị một phiên bản khác khóa.")); };
        });
      },
      get(key) {
        return withStore("readonly", function getRecord(store, setResult) {
          const request = store.get(key);
          request.onsuccess = function gotRecord() { setResult(request.result || null); };
        });
      },
      list(route) {
        return withStore("readonly", function listRecords(store, setResult) {
          const result = [];
          const request = store.openCursor();
          request.onsuccess = function nextRecord() {
            const cursor = request.result;
            if (!cursor) { setResult(result); return; }
            if (cursor.value && cursor.value.route === route) result.push(cursor.value);
            cursor.continue();
          };
        });
      },
      put(record) {
        return withStore("readwrite", function putRecord(store, setResult) {
          const request = store.put(record);
          request.onsuccess = function storedRecord() { setResult(true); };
        });
      },
      delete(key) {
        return withStore("readwrite", function deleteRecord(store, setResult) {
          const getRequest = store.get(key);
          getRequest.onsuccess = function foundRecord() {
            if (getRequest.result === undefined) { setResult(false); return; }
            const deleteRequest = store.delete(key);
            deleteRequest.onsuccess = function deletedRecord() { setResult(true); };
          };
        });
      },
      clear(route) {
        return withStore("readwrite", function clearRoute(store, setResult) {
          let removed = 0;
          const request = store.openCursor();
          request.onsuccess = function nextRecord() {
            const cursor = request.result;
            if (!cursor) { setResult(removed); return; }
            if (cursor.value && cursor.value.route === route) { cursor.delete(); removed += 1; }
            cursor.continue();
          };
        });
      },
      stats(route) {
        return withStore("readonly", function storageStats(store, setResult) {
          const result = { records: 0, bytes: 0 };
          const request = store.openCursor();
          request.onsuccess = function nextRecord() {
            const cursor = request.result;
            if (!cursor) { setResult(result); return; }
            if (!route || (cursor.value && cursor.value.route === route)) {
              result.records += 1;
              result.bytes += Number(cursor.value && cursor.value.bytes || 0);
            }
            cursor.continue();
          };
        });
      },
      async close() {
        closed = true;
        abortTransactions();
        if (database) { try { database.close(); } catch (_) { /* Database already closed. */ } }
        database = null;
      },
      async abort() {
        aborted = true;
        abortTransactions();
        if (database) { try { database.close(); } catch (_) { /* Database already closed. */ } }
        database = null;
      }
    };
    return Object.freeze(backend);
  }

  function createEngine(options) {
    const config = options && typeof options === "object" ? options : {};
    const schema = String(config.schema || SCHEMA).slice(0, 180) || SCHEMA;
    const version = positiveInteger(config.version, VERSION, 1000);
    const databaseName = String(config.name || "hh-galaxy-layer-one-storage").slice(0, 180);
    const limits = normalizeLimits(config.limits);
    const allowedRoutes = Array.isArray(config.allowedRoutes) ? new Set(config.allowedRoutes.map(String)) : null;
    const migrations = config.migrations && typeof config.migrations === "object" ? config.migrations : {};
    const now = typeof config.now === "function" ? config.now : Date.now;
    let state = "idle";
    let backend = null;
    let backendKind = "none";
    let fallbackReason = "";
    let lastError = "";
    let openPromise = null;
    let operationTail = Promise.resolve();
    let signalCleanup = null;

    function migrateRecord(input) {
      if (!input || typeof input !== "object") throw storageError("MIGRATION_FAILED", "Bản ghi cũ không hợp lệ.");
      let record = cloneValue(input);
      if (record.schema && record.schema !== schema) throw storageError("SCHEMA_MISMATCH", "Bản ghi thuộc schema khác.");
      let currentVersion = Number(record.schemaVersion || 0);
      if (!Number.isInteger(currentVersion) || currentVersion < 0) currentVersion = 0;
      if (currentVersion > version) throw storageError("FUTURE_VERSION", "Bản ghi được tạo bởi phiên bản mới hơn.");
      for (let target = currentVersion + 1; target <= version; target += 1) {
        const migration = migrations[target];
        if (typeof migration === "function") {
          const next = migration(cloneValue(record), Object.freeze({ from: target - 1, to: target, schema: schema }));
          if (next && typeof next.then === "function") throw storageError("MIGRATION_ASYNC_UNSUPPORTED", "Migration IndexedDB phải đồng bộ.");
          if (!next || typeof next !== "object") throw storageError("MIGRATION_FAILED", "Migration không trả về bản ghi hợp lệ.");
          record = cloneValue(next);
        } else if (target === 1) {
          if (!Object.hasOwn(record, "value") && Object.hasOwn(record, "payload")) record.value = record.payload;
          if (!record.metadata && record.meta && typeof record.meta === "object") record.metadata = record.meta;
        } else {
          throw storageError("MIGRATION_MISSING", "Thiếu migration cho phiên bản " + target + ".");
        }
        record.schemaVersion = target;
      }
      const route = validateRoute(record.route, allowedRoutes);
      const id = validateId(record.id);
      const value = cloneValue(Object.hasOwn(record, "value") ? record.value : null);
      const metadata = cloneValue(record.metadata && typeof record.metadata === "object" ? record.metadata : {});
      const measured = estimateBytes({ route: route, id: id, value: value, metadata: metadata });
      return {
        schema: schema,
        schemaVersion: version,
        key: recordKey(route, id),
        route: route,
        id: id,
        value: value,
        metadata: metadata,
        bytes: measured,
        createdAt: safeIsoDate(record.createdAt, now),
        updatedAt: safeIsoDate(record.updatedAt || record.createdAt, now)
      };
    }

    const backendContext = Object.freeze({ schema: schema, version: version, migrateRecord: migrateRecord });

    function requireBackendAdapter(candidate) {
      const required = ["open", "get", "list", "put", "delete", "clear", "stats", "close", "abort"];
      if (!candidate || required.some(function missing(method) { return typeof candidate[method] !== "function"; })) {
        throw storageError("BACKEND_INVALID", "Storage backend không đủ lifecycle API.");
      }
      return candidate;
    }

    async function selectBackend() {
      if (config.backend) {
        const selected = requireBackendAdapter(config.backend);
        await selected.open(backendContext);
        backendKind = String(selected.kind || "adapter");
        backend = selected;
        return;
      }
      const indexedDB = Object.hasOwn(config, "indexedDB") ? config.indexedDB : globalScope.indexedDB;
      if (indexedDB && typeof indexedDB.open === "function") {
        let persistentBackend = null;
        try {
          persistentBackend = typeof config.indexedDbBackendFactory === "function"
            ? config.indexedDbBackendFactory(indexedDB, { name: databaseName, version: version })
            : createIndexedDbBackend({ indexedDB: indexedDB, name: databaseName, version: version });
          persistentBackend = requireBackendAdapter(persistentBackend);
          await persistentBackend.open(backendContext);
          backendKind = "indexeddb";
          backend = persistentBackend;
          return;
        } catch (error) {
          if (persistentBackend && typeof persistentBackend.close === "function") {
            try { await persistentBackend.close(); } catch (_) { /* Failed backend is discarded. */ }
          }
          if (config.allowMemoryFallback === false) throw normalizeError(error, "INDEXEDDB_OPEN_FAILED");
          fallbackReason = error && error.code ? error.code : "INDEXEDDB_OPEN_FAILED";
        }
      } else {
        if (config.allowMemoryFallback === false) throw storageError("INDEXEDDB_UNAVAILABLE", "IndexedDB không khả dụng và fallback đã tắt.");
        fallbackReason = "INDEXEDDB_UNAVAILABLE";
      }
      const memory = createMemoryBackend({ namespace: databaseName, isolated: config.isolatedMemory === true });
      await memory.open(backendContext);
      backendKind = "memory";
      backend = memory;
    }

    async function open() {
      if (state === "ready") return api;
      if (state === "closed") throw storageError("CLOSED", "Storage engine đã đóng.");
      if (state === "aborted") throw storageError("ABORTED", "Storage engine đã bị hủy.");
      if (openPromise) return openPromise;
      state = "opening";
      openPromise = (async function openOnce() {
        try {
          await selectBackend();
          if (state === "aborted") { await backend.abort(); throw storageError("ABORTED", "Storage engine đã bị hủy."); }
          if (state === "closed") { await backend.close(); throw storageError("CLOSED", "Storage engine đã đóng."); }
          state = "ready";
          return api;
        } catch (error) {
          const normalized = normalizeError(error, "OPEN_FAILED");
          lastError = normalized.code;
          if (state !== "closed" && state !== "aborted") state = "error";
          throw normalized;
        }
      })();
      return openPromise;
    }

    function assertUsable() {
      if (state === "closed") throw storageError("CLOSED", "Storage engine đã đóng.");
      if (state === "aborted") throw storageError("ABORTED", "Storage engine đã bị hủy.");
      if (state !== "ready" || !backend) throw storageError("NOT_READY", "Storage engine chưa sẵn sàng.");
    }

    async function operation(work) {
      await open();
      const task = operationTail.then(async function serializedOperation() {
        assertUsable();
        return work();
      });
      operationTail = task.catch(function releaseQueue() {});
      return task;
    }

    async function put(routeInput, idInput, valueInput, metadataInput) {
      const route = validateRoute(routeInput, allowedRoutes);
      const id = validateId(idInput);
      const value = cloneValue(valueInput);
      const metadata = cloneValue(metadataInput && typeof metadataInput === "object" ? metadataInput : {});
      return operation(async function storeRecord() {
        const key = recordKey(route, id);
        const existing = await backend.get(key);
        const timestamp = new Date(now()).toISOString();
        const bytes = estimateBytes({ route: route, id: id, value: value, metadata: metadata });
        if (bytes > limits.maxRecordBytes) throw storageError("RECORD_BYTES_EXCEEDED", "Bản ghi vượt giới hạn byte.");
        const usage = await backend.stats();
        const nextRecords = usage.records + (existing ? 0 : 1);
        const nextBytes = usage.bytes - Number(existing && existing.bytes || 0) + bytes;
        if (nextRecords > limits.maxRecords) throw storageError("RECORD_LIMIT_EXCEEDED", "Đã đạt giới hạn số bản ghi.");
        if (nextBytes > limits.maxTotalBytes) throw storageError("TOTAL_BYTES_EXCEEDED", "Đã đạt giới hạn dung lượng phiên.");
        const record = {
          schema: schema,
          schemaVersion: version,
          key: key,
          route: route,
          id: id,
          value: value,
          metadata: metadata,
          bytes: bytes,
          createdAt: existing ? existing.createdAt : timestamp,
          updatedAt: timestamp
        };
        await backend.put(record);
        return cloneValue(record);
      });
    }

    async function restore(recordInput) {
      if (!recordInput || typeof recordInput !== "object" || Array.isArray(recordInput)) {
        throw storageError("RECORD_INVALID", "Bản ghi khôi phục phải là một đối tượng.");
      }
      const route = validateRoute(recordInput.route, allowedRoutes);
      const id = validateId(recordInput.id);
      if (!Object.hasOwn(recordInput, "value")) throw storageError("RECORD_VALUE_REQUIRED", "Bản ghi khôi phục thiếu value.");
      if (Object.hasOwn(recordInput, "metadata") && (!recordInput.metadata || typeof recordInput.metadata !== "object" || Array.isArray(recordInput.metadata))) {
        throw storageError("RECORD_METADATA_INVALID", "Metadata khôi phục phải là một đối tượng.");
      }
      const value = cloneValue(recordInput.value);
      const metadata = cloneValue(recordInput.metadata || {});
      return operation(async function restoreRecord() {
        const key = recordKey(route, id);
        const existing = await backend.get(key);
        const timestamp = new Date(now()).toISOString();
        const createdAt = safeIsoDate(recordInput.createdAt, existing ? existing.createdAt : timestamp);
        const updatedAt = safeIsoDate(recordInput.updatedAt, createdAt);
        const bytes = estimateBytes({ route: route, id: id, value: value, metadata: metadata });
        if (bytes > limits.maxRecordBytes) throw storageError("RECORD_BYTES_EXCEEDED", "Bản ghi vượt giới hạn byte.");
        const usage = await backend.stats();
        const nextRecords = usage.records + (existing ? 0 : 1);
        const nextBytes = usage.bytes - Number(existing && existing.bytes || 0) + bytes;
        if (nextRecords > limits.maxRecords) throw storageError("RECORD_LIMIT_EXCEEDED", "Đã đạt giới hạn số bản ghi.");
        if (nextBytes > limits.maxTotalBytes) throw storageError("TOTAL_BYTES_EXCEEDED", "Đã đạt giới hạn dung lượng phiên.");
        const record = {
          schema: schema,
          schemaVersion: version,
          key: key,
          route: route,
          id: id,
          value: value,
          metadata: metadata,
          bytes: bytes,
          createdAt: createdAt,
          updatedAt: updatedAt
        };
        await backend.put(record);
        return cloneValue(record);
      });
    }

    async function get(routeInput, idInput) {
      const route = validateRoute(routeInput, allowedRoutes);
      const id = validateId(idInput);
      return operation(async function getRecord() {
        const record = await backend.get(recordKey(route, id));
        return record ? cloneValue(migrateRecord(record)) : null;
      });
    }

    async function list(routeInput, optionsInput) {
      const route = validateRoute(routeInput, allowedRoutes);
      const options = optionsInput && typeof optionsInput === "object" ? optionsInput : {};
      const offset = Math.max(0, Number.isSafeInteger(Number(options.offset)) ? Number(options.offset) : 0);
      const limit = Math.min(limits.maxListResults, positiveInteger(options.limit, limits.maxListResults, limits.maxListResults));
      const newestFirst = options.newestFirst !== false;
      return operation(async function listRecords() {
        const records = (await backend.list(route)).map(migrateRecord);
        records.sort(function orderRecords(left, right) {
          const time = Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
          const ordered = time || right.id.localeCompare(left.id);
          return newestFirst ? ordered : -ordered;
        });
        return records.slice(offset, offset + limit).map(cloneValue);
      });
    }

    async function deleteRecord(routeInput, idInput) {
      const route = validateRoute(routeInput, allowedRoutes);
      const id = validateId(idInput);
      return operation(function removeRecord() { return backend.delete(recordKey(route, id)); });
    }

    async function clear(routeInput) {
      const route = validateRoute(routeInput, allowedRoutes);
      return operation(function clearRoute() { return backend.clear(route); });
    }

    async function usage(routeInput) {
      const route = routeInput === undefined || routeInput === null ? null : validateRoute(routeInput, allowedRoutes);
      return operation(async function readUsage() {
        const result = await backend.stats(route);
        return Object.freeze({ records: Number(result.records || 0), bytes: Number(result.bytes || 0), route: route });
      });
    }

    function status() {
      return Object.freeze({
        schema: schema,
        version: version,
        state: state,
        backend: backendKind,
        persistent: Boolean(backend && backend.persistent === true),
        fallback: backendKind === "memory",
        fallbackReason: fallbackReason || null,
        error: lastError || null,
        limits: limits
      });
    }

    async function close() {
      if (state === "closed") return false;
      state = "closed";
      if (signalCleanup) { signalCleanup(); signalCleanup = null; }
      if (backend) await backend.close();
      return true;
    }

    async function abort(reason) {
      if (state === "aborted") return false;
      state = "aborted";
      lastError = reason ? String(reason).slice(0, 180) : "ABORTED";
      if (signalCleanup) { signalCleanup(); signalCleanup = null; }
      if (backend) await backend.abort(reason);
      return true;
    }

    const api = Object.freeze({
      schema: schema,
      version: version,
      limits: limits,
      open: open,
      put: put,
      restore: restore,
      get: get,
      list: list,
      delete: deleteRecord,
      clear: clear,
      usage: usage,
      status: status,
      close: close,
      abort: abort
    });

    const signal = config.signal;
    if (signal && typeof signal.addEventListener === "function") {
      const handleAbort = function handleExternalAbort() { void abort(signal.reason || "ABORTED"); };
      if (signal.aborted) handleAbort();
      else {
        signal.addEventListener("abort", handleAbort, { once: true });
        signalCleanup = function removeAbortListener() { signal.removeEventListener("abort", handleAbort); };
      }
    }
    return api;
  }

  return Object.freeze({
    schema: SCHEMA,
    version: VERSION,
    defaultLimits: DEFAULT_LIMITS,
    createEngine: createEngine,
    createMemoryBackend: createMemoryBackend,
    createIndexedDbBackend: createIndexedDbBackend,
    cloneValue: cloneValue,
    estimateBytes: estimateBytes
  });
});
