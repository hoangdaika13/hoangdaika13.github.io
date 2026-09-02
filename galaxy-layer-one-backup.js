(function galaxyLayerOneBackupBootstrap(root, factory) {
  "use strict";

  var api = factory(root || {});
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HHGalaxyLayerOneBackup = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createGalaxyLayerOneBackup() {
  "use strict";

  var SCHEMA = "hh-galaxy-layer-one-backup";
  var SCHEMA_VERSION = 2;
  var LEGACY_SCHEMA_VERSION = 1;
  var PLAN_SCHEMA = "hh-galaxy-layer-one-import-plan";
  var CREATOR_SCHEMA = "hh-galaxy.creator-studio.export";
  var LEARNING_SCHEMA = "hh-galaxy.learning.export";

  var LIMITS = deepFreeze({
    maxBackupBytes: 8 * 1024 * 1024,
    maxTotalRecords: 30000,
    maxMainItems: 120,
    maxMainEvents: 300,
    maxCreatorProjects: 500,
    maxCreatorSchedule: 1000,
    maxLearningDecks: 100,
    maxLearningCards: 5000,
    maxLearningActivities: 20000,
    // The runtime content engine holds 800 records total; one slot is reserved
    // for Learning Star's dedicated state record.
    maxRecords: 799,
    maxDepth: 32,
    maxObjectKeys: 10000,
    maxArrayLength: 30000,
    maxStringBytes: 2 * 1024 * 1024,
    maxIdChars: 160,
    maxRouteChars: 180
  });

  var DANGEROUS_KEYS = Object.freeze(["__proto__", "prototype", "constructor"]);
  var SAMPLE_SOURCES = Object.freeze(["sample", "demo", "local-template"]);
  var PORTABLE_ROUTES = Object.freeze([
    "/galaxy/ai", "/galaxy/music", "/galaxy/video", "/galaxy/creator", "/galaxy/games",
    "/galaxy/dev", "/galaxy/learning", "/galaxy/community", "/galaxy/tools", "/galaxy/analytics", "/galaxy/settings"
  ]);
  var RESERVED_RECORD_IDENTITIES = Object.freeze(["/galaxy/learning\u0000learning-state-v1"]);
  var SECRET_KEY = /^(?:api[-_]?key|secret|client[-_]?secret|access[-_]?token|refresh[-_]?token|auth(?:orization)?|password|passwd|private[-_]?key|cookie|session[-_]?token)$/i;
  var SECRET_VALUE_PATTERNS = Object.freeze([
    /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/i,
    /\bAKIA[A-Z0-9]{16}\b/,
    /\bAIza[A-Za-z0-9_-]{30,}\b/,
    /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
    /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/,
    /\bAuthorization\s*:\s*Bearer\s+[A-Za-z0-9._~+\/-]{20,}/i,
    /\b(?:api[-_]?key|client[-_]?secret|access[-_]?token|refresh[-_]?token|password|private[-_]?key)\s*[:=]\s*["']?(?!(?:process\.env|import\.meta\.env)\.)[A-Za-z0-9._~+\/-]{12,}/i
  ]);

  function deepFreeze(value, seen) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    var visited = seen || new WeakSet();
    if (visited.has(value)) return value;
    visited.add(value);
    Object.keys(value).forEach(function freezeChild(key) { deepFreeze(value[key], visited); });
    return Object.freeze(value);
  }

  function backupError(code, message, details) {
    var error = new Error(message || code);
    error.code = code;
    if (details !== undefined) error.details = details;
    return error;
  }

  function fail(code, message, details) {
    throw backupError(code, message, details);
  }

  function utf8ByteLength(value) {
    var text = String(value == null ? "" : value);
    var bytes = 0;
    for (var index = 0; index < text.length; index += 1) {
      var code = text.charCodeAt(index);
      if (code <= 0x7F) bytes += 1;
      else if (code <= 0x7FF) bytes += 2;
      else if (code >= 0xD800 && code <= 0xDBFF && index + 1 < text.length && text.charCodeAt(index + 1) >= 0xDC00 && text.charCodeAt(index + 1) <= 0xDFFF) {
        bytes += 4;
        index += 1;
      } else bytes += 3;
    }
    return bytes;
  }

  function canonicalStringify(value) {
    return JSON.stringify(value, function sortObjectKeys(_key, entry) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return entry;
      var result = {};
      Object.keys(entry).sort().forEach(function copyKey(key) { result[key] = entry[key]; });
      return result;
    });
  }

  function isPlainObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    var prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function isBinary(value) {
    if (!value || typeof value !== "object") return false;
    if (typeof ArrayBuffer !== "undefined" && (value instanceof ArrayBuffer || (typeof ArrayBuffer.isView === "function" && ArrayBuffer.isView(value)))) return true;
    var tag = Object.prototype.toString.call(value);
    return tag === "[object Blob]" || tag === "[object File]" || tag === "[object ArrayBuffer]" || /Array\]$/.test(tag) && tag !== "[object Array]";
  }

  function cloneJson(value, path, depth, seen) {
    var currentPath = path || "$";
    var currentDepth = depth || 0;
    if (currentDepth > LIMITS.maxDepth) fail("MAX_DEPTH_EXCEEDED", "Dữ liệu sao lưu lồng quá sâu.", { path: currentPath, maximum: LIMITS.maxDepth });
    if (value === null || typeof value === "boolean") return value;
    if (typeof value === "string") {
      var normalized = typeof value.normalize === "function" ? value.normalize("NFC") : value;
      if (utf8ByteLength(normalized) > LIMITS.maxStringBytes) fail("STRING_TOO_LARGE", "Một trường văn bản vượt giới hạn sao lưu.", { path: currentPath, maximumBytes: LIMITS.maxStringBytes });
      return normalized;
    }
    if (typeof value === "number") {
      if (!Number.isFinite(value)) fail("INVALID_NUMBER", "Dữ liệu sao lưu chứa số không hợp lệ.", { path: currentPath });
      return value;
    }
    if (["undefined", "function", "symbol", "bigint"].includes(typeof value)) {
      fail("NON_JSON_VALUE", "Dữ liệu sao lưu chỉ được chứa giá trị JSON thuần.", { path: currentPath });
    }
    if (isBinary(value)) fail("BINARY_NOT_ALLOWED", "Sao lưu Lớp 1 không chứa Blob hoặc dữ liệu nhị phân.", { path: currentPath });

    var visited = seen || new WeakSet();
    if (visited.has(value)) fail("CYCLIC_VALUE", "Dữ liệu sao lưu không được chứa tham chiếu vòng.", { path: currentPath });
    visited.add(value);

    if (Array.isArray(value)) {
      if (value.length > LIMITS.maxArrayLength) fail("ARRAY_LIMIT_EXCEEDED", "Mảng dữ liệu vượt giới hạn sao lưu.", { path: currentPath, maximum: LIMITS.maxArrayLength });
      var array = [];
      for (var index = 0; index < value.length; index += 1) {
        if (!Object.prototype.hasOwnProperty.call(value, index)) fail("NON_JSON_VALUE", "Mảng thưa không được hỗ trợ trong sao lưu.", { path: currentPath + "[" + index + "]" });
        array.push(cloneJson(value[index], currentPath + "[" + index + "]", currentDepth + 1, visited));
      }
      visited.delete(value);
      return array;
    }

    if (!isPlainObject(value)) fail("CUSTOM_PROTOTYPE", "Dữ liệu sao lưu không được chứa prototype tùy chỉnh.", { path: currentPath });
    var keys = Object.keys(value);
    if (keys.length > LIMITS.maxObjectKeys) fail("OBJECT_KEY_LIMIT", "Đối tượng có quá nhiều trường.", { path: currentPath, maximum: LIMITS.maxObjectKeys });
    var object = {};
    keys.forEach(function copyProperty(key) {
      if (DANGEROUS_KEYS.includes(key)) fail("PROTOTYPE_KEY_REJECTED", "Dữ liệu chứa khóa có thể làm thay đổi prototype.", { path: currentPath + "." + key });
      var descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || typeof descriptor.get === "function" || typeof descriptor.set === "function") {
        fail("ACCESSOR_NOT_ALLOWED", "Dữ liệu sao lưu không được chứa getter hoặc setter.", { path: currentPath + "." + key });
      }
      object[key] = cloneJson(descriptor.value, currentPath + "." + key, currentDepth + 1, visited);
    });
    visited.delete(value);
    return object;
  }

  function hasMeaningfulSecretValue(value) {
    if (value == null || value === false || value === "") return false;
    if (typeof value === "string") {
      var trimmed = value.trim();
      if (!trimmed || /^(?:not[-_ ]?configured|unset|none|null|redacted|\*+|process\.env\.|import\.meta\.env\.)/i.test(trimmed)) return false;
    }
    return true;
  }

  function assertNoSecrets(value, path) {
    var currentPath = path || "$";
    if (typeof value === "string") {
      if (SECRET_VALUE_PATTERNS.some(function matches(pattern) { return pattern.test(value); })) {
        fail("SECRET_DETECTED", "Phát hiện dữ liệu có thể là thông tin bí mật; sao lưu đã bị chặn.", { path: currentPath });
      }
      return;
    }
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(function inspectEntry(entry, index) { assertNoSecrets(entry, currentPath + "[" + index + "]"); });
      return;
    }
    Object.keys(value).forEach(function inspectKey(key) {
      if (SECRET_KEY.test(key) && hasMeaningfulSecretValue(value[key])) {
        fail("SECRET_DETECTED", "Sao lưu không được chứa khóa, token, mật khẩu hoặc cookie.", { path: currentPath + "." + key });
      }
      assertNoSecrets(value[key], currentPath + "." + key);
    });
  }

  function dataProperty(value, key) {
    if (!value || typeof value !== "object") return undefined;
    var descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && !descriptor.get && !descriptor.set ? descriptor.value : undefined;
  }

  function isSampleRecord(value) {
    if (!isPlainObject(value)) return false;
    if (dataProperty(value, "isDemo") === true || dataProperty(value, "isSample") === true) return true;
    var source = String(dataProperty(value, "source") || "").trim().toLowerCase();
    return SAMPLE_SOURCES.includes(source);
  }

  function safeCollection(value, path, maximum) {
    if (value == null) return [];
    if (!Array.isArray(value)) fail("COLLECTION_INVALID", "Kho dữ liệu phải là một mảng.", { path: path });
    if (value.length > maximum) fail("RECORD_LIMIT_EXCEEDED", "Kho dữ liệu vượt số bản ghi cho phép.", { path: path, maximum: maximum });
    return value.filter(function excludeSamples(entry) { return !isSampleRecord(entry); });
  }

  function cleanId(value, path) {
    var id = String(value == null ? "" : value).trim();
    if (!id) fail("RECORD_ID_REQUIRED", "Bản ghi thiếu ID.", { path: path });
    if (id.length > LIMITS.maxIdChars) fail("RECORD_ID_TOO_LONG", "ID bản ghi vượt giới hạn.", { path: path, maximum: LIMITS.maxIdChars });
    return id;
  }

  function cloneUniqueCollection(value, path, maximum) {
    var seen = new Set();
    return safeCollection(value, path, maximum).map(function copyEntry(entry, index) {
      var entryPath = path + "[" + index + "]";
      if (!isPlainObject(entry)) fail("RECORD_INVALID", "Mỗi bản ghi phải là một đối tượng JSON.", { path: entryPath });
      var copy = cloneJson(entry, entryPath);
      var id = cleanId(copy.id, entryPath + ".id");
      if (seen.has(id)) fail("DUPLICATE_RECORD_ID", "ID bản ghi bị trùng trong cùng kho.", { path: path, id: id });
      seen.add(id);
      copy.id = id;
      return copy;
    });
  }

  function parseEmbeddedExport(value, path) {
    if (value == null || value === "") return {};
    if (typeof value !== "string") return value;
    if (utf8ByteLength(value) > LIMITS.maxBackupBytes) fail("STORE_TOO_LARGE", "Kho con vượt giới hạn dung lượng.", { path: path });
    try { return JSON.parse(value); }
    catch (_error) { fail("STORE_JSON_INVALID", "Kho con không phải JSON hợp lệ.", { path: path }); }
  }

  function normalizeMain(value) {
    var source = value == null ? {} : value;
    if (!isPlainObject(source)) fail("MAIN_STORE_INVALID", "State chính phải là một đối tượng JSON.");
    var items = cloneUniqueCollection(dataProperty(source, "items"), "$.stores.main.items", LIMITS.maxMainItems);
    var events = cloneUniqueCollection(dataProperty(source, "events"), "$.stores.main.events", LIMITS.maxMainEvents);
    var settingsInput = dataProperty(source, "settings");
    if (settingsInput != null && !isPlainObject(settingsInput)) fail("MAIN_SETTINGS_INVALID", "Cài đặt trong state chính phải là một đối tượng JSON.");
    var settings = settingsInput == null ? {} : cloneJson(settingsInput, "$.stores.main.settings");
    var result = { version: 1, settings: settings, items: items, events: events };
    assertNoSecrets(result, "$.stores.main");
    return result;
  }

  function normalizeCreator(value) {
    var source = parseEmbeddedExport(value, "$.stores.creator");
    if (!isPlainObject(source)) fail("CREATOR_STORE_INVALID", "Creator export phải là một đối tượng JSON.");
    var declaredSchema = dataProperty(source, "schema");
    var declaredVersion = Number(dataProperty(source, "schemaVersion") == null ? 1 : dataProperty(source, "schemaVersion"));
    if (declaredSchema && declaredSchema !== CREATOR_SCHEMA) fail("CREATOR_SCHEMA_INVALID", "Creator export không đúng schema.");
    if (declaredVersion !== 1) fail("CREATOR_VERSION_UNSUPPORTED", "Phiên bản Creator export chưa được hỗ trợ.");
    var projectInput = dataProperty(source, "projects");
    var rawProjects = safeCollection(projectInput, "$.stores.creator.projects", LIMITS.maxCreatorProjects);
    var excludedProjectIds = new Set();
    (Array.isArray(dataProperty(source, "projects")) ? dataProperty(source, "projects") : []).forEach(function rememberSample(project) {
      if (isSampleRecord(project)) excludedProjectIds.add(String(dataProperty(project, "id") || ""));
    });
    var projects = cloneUniqueCollection(rawProjects, "$.stores.creator.projects", LIMITS.maxCreatorProjects);
    var schedule = cloneUniqueCollection(dataProperty(source, "schedule"), "$.stores.creator.schedule", LIMITS.maxCreatorSchedule)
      .filter(function omitDemoSchedule(item) { return !excludedProjectIds.has(String(dataProperty(item, "projectId") || "")); })
      .map(function keepSchedule(item) { return item; });
    var result = {
      schema: CREATOR_SCHEMA,
      schemaVersion: 1,
      appVersion: String(dataProperty(source, "appVersion") || "").slice(0, 40),
      projects: projects,
      schedule: schedule
    };
    assertNoSecrets(result, "$.stores.creator");
    return result;
  }

  function normalizeLearning(value) {
    var source = parseEmbeddedExport(value, "$.stores.learning");
    if (!isPlainObject(source)) fail("LEARNING_STORE_INVALID", "Learning export phải là một đối tượng JSON.");
    var declaredSchema = dataProperty(source, "schema");
    var declaredVersion = Number(dataProperty(source, "schemaVersion") == null ? 1 : dataProperty(source, "schemaVersion"));
    if (declaredSchema && declaredSchema !== LEARNING_SCHEMA) fail("LEARNING_SCHEMA_INVALID", "Learning export không đúng schema.");
    if (declaredVersion !== 1) fail("LEARNING_VERSION_UNSUPPORTED", "Phiên bản Learning export chưa được hỗ trợ.");
    var rawDecks = safeCollection(dataProperty(source, "decks"), "$.stores.learning.decks", LIMITS.maxLearningDecks);
    var deckIds = new Set();
    var cardKeys = new Set();
    var cardCount = 0;
    var decks = rawDecks.map(function copyDeck(deck, deckIndex) {
      if (!isPlainObject(deck)) fail("RECORD_INVALID", "Mỗi bộ thẻ phải là một đối tượng JSON.", { path: "$.stores.learning.decks[" + deckIndex + "]" });
      var copied = cloneJson(deck, "$.stores.learning.decks[" + deckIndex + "]");
      var deckId = cleanId(copied.id, "$.stores.learning.decks[" + deckIndex + "].id");
      if (deckIds.has(deckId)) fail("DUPLICATE_RECORD_ID", "ID bộ thẻ bị trùng.", { store: "learning", id: deckId });
      deckIds.add(deckId);
      var cardInput = dataProperty(deck, "cards");
      if (cardInput != null && !Array.isArray(cardInput)) fail("COLLECTION_INVALID", "Danh sách thẻ học phải là một mảng.", { path: "$.stores.learning.decks[" + deckIndex + "].cards" });
      var rawCards = cardInput || [];
      copied.cards = rawCards.filter(function excludeSampleCard(card) { return !isSampleRecord(card); }).map(function copyCard(card, cardIndex) {
        if (!isPlainObject(card)) fail("RECORD_INVALID", "Mỗi thẻ học phải là một đối tượng JSON.", { path: "$.stores.learning.decks[" + deckIndex + "].cards[" + cardIndex + "]" });
        var result = cloneJson(card, "$.stores.learning.decks[" + deckIndex + "].cards[" + cardIndex + "]");
        var cardId = cleanId(result.id, "$.stores.learning.decks[" + deckIndex + "].cards[" + cardIndex + "].id");
        var key = deckId + "\u0000" + cardId;
        if (cardKeys.has(key)) fail("DUPLICATE_RECORD_ID", "ID thẻ học bị trùng trong cùng bộ thẻ.", { store: "learning", id: cardId });
        cardKeys.add(key);
        cardCount += 1;
        if (cardCount > LIMITS.maxLearningCards) fail("RECORD_LIMIT_EXCEEDED", "Tổng số thẻ học vượt giới hạn.", { maximum: LIMITS.maxLearningCards });
        return result;
      });
      return copied;
    });
    var activities = cloneUniqueCollection(dataProperty(source, "activities"), "$.stores.learning.activities", LIMITS.maxLearningActivities)
      .filter(function keepLinkedActivity(activity) {
        var deckId = String(dataProperty(activity, "deckId") || "");
        var cardId = String(dataProperty(activity, "cardId") || "");
        return deckIds.has(deckId) && (!cardId || cardKeys.has(deckId + "\u0000" + cardId));
      });
    var result = {
      schema: LEARNING_SCHEMA,
      schemaVersion: 1,
      appVersion: String(dataProperty(source, "appVersion") || "").slice(0, 40),
      decks: decks,
      activities: activities
    };
    assertNoSecrets(result, "$.stores.learning");
    return result;
  }

  function normalizeRecords(value) {
    var source = value == null || value === "" ? [] : parseEmbeddedExport(value, "$.stores.records");
    if (isPlainObject(source) && dataProperty(source, "records") !== undefined) source = dataProperty(source, "records");
    var records = safeCollection(source, "$.stores.records", LIMITS.maxRecords);
    var identities = new Set();
    var result = records.map(function copyRecord(record, index) {
      if (!isPlainObject(record)) fail("RECORD_INVALID", "Mỗi metadata/content record phải là một đối tượng JSON.", { path: "$.stores.records[" + index + "]" });
      var copy = cloneJson(record, "$.stores.records[" + index + "]");
      var id = cleanId(copy.id, "$.stores.records[" + index + "].id");
      var route = String(copy.route || "").trim();
      if (!PORTABLE_ROUTES.includes(route)) fail("RECORD_ROUTE_INVALID", "Route bản ghi không thuộc Layer 1.", { path: "$.stores.records[" + index + "].route", route: route });
      if (route.length > LIMITS.maxRouteChars) fail("ROUTE_TOO_LONG", "Route bản ghi vượt giới hạn.", { path: "$.stores.records[" + index + "].route" });
      var identity = route + "\u0000" + id;
      if (RESERVED_RECORD_IDENTITIES.includes(identity)) fail("RESERVED_RECORD_ID", "Bản ghi dành riêng phải đi qua kho chuyên biệt.", { store: "records", id: id, route: route });
      if (identities.has(identity)) fail("DUPLICATE_RECORD_ID", "ID bản ghi bị trùng trong cùng route.", { store: "records", id: id, route: route });
      if (!Object.prototype.hasOwnProperty.call(copy, "value")) fail("RECORD_VALUE_REQUIRED", "Bản ghi nội dung thiếu trường value.", { path: "$.stores.records[" + index + "].value" });
      if (Object.prototype.hasOwnProperty.call(copy, "metadata") && !isPlainObject(copy.metadata)) fail("RECORD_METADATA_INVALID", "Metadata bản ghi phải là một đối tượng JSON.", { path: "$.stores.records[" + index + "].metadata" });
      identities.add(identity);
      copy.id = id;
      copy.route = route;
      return copy;
    });
    assertNoSecrets(result, "$.stores.records");
    return result;
  }

  function countStores(stores) {
    var learningCards = stores.learning.decks.reduce(function countCards(total, deck) { return total + deck.cards.length; }, 0);
    var counts = {
      main: { records: stores.main.items.length + stores.main.events.length, count: stores.main.items.length + stores.main.events.length, items: stores.main.items.length, events: stores.main.events.length },
      creator: { records: stores.creator.projects.length + stores.creator.schedule.length, count: stores.creator.projects.length + stores.creator.schedule.length, projects: stores.creator.projects.length, schedule: stores.creator.schedule.length },
      learning: { records: stores.learning.decks.length + learningCards + stores.learning.activities.length, count: stores.learning.decks.length + learningCards + stores.learning.activities.length, decks: stores.learning.decks.length, cards: learningCards, activities: stores.learning.activities.length },
      records: { records: stores.records.length, count: stores.records.length }
    };
    counts.totalRecords = counts.main.records + counts.creator.records + counts.learning.records + counts.records.records;
    return counts;
  }

  function normalizeStores(value) {
    if (value != null && !isPlainObject(value)) fail("STORES_INVALID", "Danh sách kho sao lưu phải là một đối tượng JSON.");
    var source = value || {};
    var stores = {
      main: normalizeMain(dataProperty(source, "main")),
      creator: normalizeCreator(dataProperty(source, "creator")),
      learning: normalizeLearning(dataProperty(source, "learning")),
      records: normalizeRecords(dataProperty(source, "records"))
    };
    var counts = countStores(stores);
    if (counts.totalRecords > LIMITS.maxTotalRecords) fail("TOTAL_RECORD_LIMIT_EXCEEDED", "Tổng số bản ghi trong sao lưu vượt giới hạn.", { maximum: LIMITS.maxTotalRecords });
    return stores;
  }

  function isoDate(value, fallback) {
    var date = value instanceof Date ? value : new Date(value == null ? "" : value);
    if (Number.isFinite(date.getTime())) return date.toISOString();
    if (fallback !== undefined) return fallback;
    fail("DATE_INVALID", "Thời điểm xuất sao lưu không hợp lệ.");
  }

  function packageFromStores(stores, exportedAt, migratedFrom) {
    var result = {
      schema: SCHEMA,
      version: SCHEMA_VERSION,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: exportedAt,
      stores: stores
    };
    if (migratedFrom) result.migratedFrom = migratedFrom;
    var text = canonicalStringify(result);
    var bytes = utf8ByteLength(text);
    if (bytes > LIMITS.maxBackupBytes) fail("BACKUP_TOO_LARGE", "Tệp sao lưu vượt giới hạn dung lượng.", { bytes: bytes, maximumBytes: LIMITS.maxBackupBytes });
    return deepFreeze(result);
  }

  function inputStores(input) {
    var source = input && isPlainObject(input) ? input : {};
    var declaredStores = dataProperty(source, "stores");
    if (declaredStores !== undefined) {
      if (!isPlainObject(declaredStores)) fail("STORES_INVALID", "Danh sách kho sao lưu phải là một đối tượng JSON.");
      return declaredStores;
    }
    return {
      main: dataProperty(source, "main") !== undefined ? dataProperty(source, "main") : (dataProperty(source, "mainState") !== undefined ? dataProperty(source, "mainState") : dataProperty(source, "state")),
      creator: dataProperty(source, "creator") !== undefined ? dataProperty(source, "creator") : dataProperty(source, "creatorExport"),
      learning: dataProperty(source, "learning") !== undefined ? dataProperty(source, "learning") : dataProperty(source, "learningExport"),
      records: dataProperty(source, "records") !== undefined ? dataProperty(source, "records") : (dataProperty(source, "jsonRecords") !== undefined ? dataProperty(source, "jsonRecords") : dataProperty(source, "contentRecords"))
    };
  }

  function buildBackup(input, options) {
    if (input != null && !isPlainObject(input)) fail("BACKUP_INPUT_INVALID", "Đầu vào sao lưu phải là một đối tượng JSON.");
    var source = input ? cloneJson(input, "$") : {};
    var settings = options && typeof options === "object" ? options : {};
    var timestamp = settings.now !== undefined ? settings.now : (dataProperty(source, "exportedAt") || new Date());
    return packageFromStores(normalizeStores(inputStores(source)), isoDate(timestamp), null);
  }

  function migrateV1(value, options) {
    var source = value;
    if (!isPlainObject(source)) fail("BACKUP_INVALID", "Sao lưu phiên bản 1 phải là một đối tượng JSON.");
    source = cloneJson(source, "$");
    if (dataProperty(source, "schema") !== SCHEMA) fail("BACKUP_SCHEMA_INVALID", "Tệp không thuộc định dạng HH Galaxy Layer One.");
    var legacyVersion = Number(dataProperty(source, "schemaVersion") == null ? dataProperty(source, "version") : dataProperty(source, "schemaVersion"));
    if (legacyVersion !== LEGACY_SCHEMA_VERSION) fail("LEGACY_VERSION_REQUIRED", "Chỉ sao lưu phiên bản 1 mới được đưa qua migration này.");
    var legacyData = dataProperty(source, "data");
    var legacyStores = dataProperty(source, "stores");
    var stores = legacyStores && isPlainObject(legacyStores)
      ? legacyStores
      : { main: legacyData, creator: null, learning: null, records: [] };
    var settings = options && typeof options === "object" ? options : {};
    var timestamp = dataProperty(source, "exportedAt") || settings.now || new Date(0);
    return packageFromStores(normalizeStores(stores), isoDate(timestamp), LEGACY_SCHEMA_VERSION);
  }

  function parseRaw(input) {
    if (typeof input !== "string") return input;
    var bytes = utf8ByteLength(input);
    if (!input.trim()) fail("BACKUP_EMPTY", "Tệp sao lưu đang trống.");
    if (bytes > LIMITS.maxBackupBytes) fail("BACKUP_TOO_LARGE", "Tệp sao lưu vượt giới hạn dung lượng.", { bytes: bytes, maximumBytes: LIMITS.maxBackupBytes });
    try { return JSON.parse(input); }
    catch (_error) { fail("BACKUP_JSON_INVALID", "Tệp sao lưu không phải JSON hợp lệ."); }
  }

  function parseBackup(input, options) {
    var source = parseRaw(input);
    if (!isPlainObject(source)) fail("BACKUP_INVALID", "Tệp sao lưu phải là một đối tượng JSON.");
    // Validate the complete envelope before selecting known fields. This makes
    // unknown prototype keys, accessors and executable values fail closed
    // instead of being silently discarded during normalization.
    source = cloneJson(source, "$");
    if (dataProperty(source, "schema") !== SCHEMA) fail("BACKUP_SCHEMA_INVALID", "Tệp không thuộc định dạng HH Galaxy Layer One.");
    var version = Number(dataProperty(source, "schemaVersion") == null ? dataProperty(source, "version") : dataProperty(source, "schemaVersion"));
    if (version === LEGACY_SCHEMA_VERSION) return migrateV1(source, options);
    if (version !== SCHEMA_VERSION) fail("BACKUP_VERSION_UNSUPPORTED", "Phiên bản sao lưu chưa được hỗ trợ.", { supported: [LEGACY_SCHEMA_VERSION, SCHEMA_VERSION] });
    return packageFromStores(normalizeStores(dataProperty(source, "stores")), isoDate(dataProperty(source, "exportedAt")), dataProperty(source, "migratedFrom") === 1 ? 1 : null);
  }

  function serializeBackup(input, options) {
    var candidate = input && isPlainObject(input) && dataProperty(input, "schema") === SCHEMA
      ? parseBackup(input, options)
      : buildBackup(input, options);
    return canonicalStringify(candidate);
  }

  function storeBytes(value) {
    return utf8ByteLength(canonicalStringify(value));
  }

  function emptyPreviewStores() {
    return {
      main: { records: 0, count: 0, items: 0, events: 0, bytes: 0 },
      creator: { records: 0, count: 0, projects: 0, schedule: 0, bytes: 0 },
      learning: { records: 0, count: 0, decks: 0, cards: 0, activities: 0, bytes: 0 },
      records: { records: 0, count: 0, bytes: 0 }
    };
  }

  function inspectBackup(input, options) {
    var inputBytes = typeof input === "string" ? utf8ByteLength(input) : 0;
    try {
      var candidate = parseBackup(input, options);
      var counts = countStores(candidate.stores);
      var stores = {
        main: Object.assign({}, counts.main, { bytes: storeBytes(candidate.stores.main) }),
        creator: Object.assign({}, counts.creator, { bytes: storeBytes(candidate.stores.creator) }),
        learning: Object.assign({}, counts.learning, { bytes: storeBytes(candidate.stores.learning) }),
        records: Object.assign({}, counts.records, { bytes: storeBytes(candidate.stores.records) })
      };
      return deepFreeze({
        ok: true,
        error: null,
        schema: SCHEMA,
        version: SCHEMA_VERSION,
        migratedFrom: candidate.migratedFrom || null,
        exportedAt: candidate.exportedAt,
        inputBytes: inputBytes || storeBytes(candidate),
        normalizedBytes: storeBytes(candidate),
        totalRecords: counts.totalRecords,
        counts: counts,
        stores: stores,
        candidate: candidate
      });
    } catch (error) {
      return deepFreeze({
        ok: false,
        error: error && error.code || "BACKUP_INVALID",
        message: error && error.message || "Tệp sao lưu không hợp lệ.",
        inputBytes: inputBytes,
        normalizedBytes: 0,
        totalRecords: 0,
        counts: Object.assign({ totalRecords: 0 }, emptyPreviewStores()),
        stores: emptyPreviewStores(),
        candidate: null
      });
    }
  }

  function identityOf(value, prefix, fallbackIndex) {
    var id = value && value.id != null ? String(value.id) : String(fallbackIndex);
    var route = value && value.route != null ? String(value.route) : "";
    return prefix + "\u0000" + route + "\u0000" + id;
  }

  function mergeCollection(current, incoming, prefix) {
    var byIdentity = new Map();
    current.forEach(function keepCurrent(entry, index) { byIdentity.set(identityOf(entry, prefix, index), entry); });
    incoming.forEach(function addIncoming(entry, index) {
      var identity = identityOf(entry, prefix, index);
      if (!byIdentity.has(identity)) byIdentity.set(identity, entry);
    });
    return Array.from(byIdentity.values());
  }

  function mergeLearning(current, incoming) {
    var decks = new Map();
    current.decks.forEach(function keepDeck(deck) { decks.set(String(deck.id), deck); });
    incoming.decks.forEach(function mergeDeck(deck) {
      var id = String(deck.id);
      if (!decks.has(id)) { decks.set(id, deck); return; }
      var local = decks.get(id);
      var cards = mergeCollection(local.cards, deck.cards, "card:" + id);
      decks.set(id, Object.assign({}, local, { cards: cards }));
    });
    return {
      schema: LEARNING_SCHEMA,
      schemaVersion: 1,
      appVersion: current.appVersion || incoming.appVersion,
      decks: Array.from(decks.values()),
      activities: mergeCollection(current.activities, incoming.activities, "activity")
    };
  }

  function mergeStores(current, incoming) {
    return normalizeStores({
      main: {
        version: 1,
        settings: current.main.settings,
        items: mergeCollection(current.main.items, incoming.main.items, "main-item"),
        events: mergeCollection(current.main.events, incoming.main.events, "main-event")
      },
      creator: {
        schema: CREATOR_SCHEMA,
        schemaVersion: 1,
        appVersion: current.creator.appVersion || incoming.creator.appVersion,
        projects: mergeCollection(current.creator.projects, incoming.creator.projects, "creator-project"),
        schedule: mergeCollection(current.creator.schedule, incoming.creator.schedule, "creator-schedule")
      },
      learning: mergeLearning(current.learning, incoming.learning),
      records: mergeCollection(current.records, incoming.records, "record")
    });
  }

  function flattenIdentities(stores) {
    var identities = [];
    stores.main.items.forEach(function add(value, index) { identities.push(identityOf(value, "main:item", index)); });
    stores.main.events.forEach(function add(value, index) { identities.push(identityOf(value, "main:event", index)); });
    stores.creator.projects.forEach(function add(value, index) { identities.push(identityOf(value, "creator:project", index)); });
    stores.creator.schedule.forEach(function add(value, index) { identities.push(identityOf(value, "creator:schedule", index)); });
    stores.learning.decks.forEach(function addDeck(deck, deckIndex) {
      identities.push(identityOf(deck, "learning:deck", deckIndex));
      deck.cards.forEach(function addCard(card, cardIndex) { identities.push("learning:card\u0000" + deck.id + "\u0000" + identityOf(card, "", cardIndex)); });
    });
    stores.learning.activities.forEach(function add(value, index) { identities.push(identityOf(value, "learning:activity", index)); });
    stores.records.forEach(function add(value, index) { identities.push(identityOf(value, "record", index)); });
    return new Set(identities);
  }

  function changeCounts(beforeStores, incomingStores, afterStores, mode) {
    var before = flattenIdentities(beforeStores);
    var incoming = flattenIdentities(incomingStores);
    var after = flattenIdentities(afterStores);
    var conflicts = 0;
    var added = 0;
    var removed = 0;
    incoming.forEach(function countIncoming(id) {
      if (before.has(id)) conflicts += 1;
      else if (after.has(id)) added += 1;
    });
    if (mode === "replace") before.forEach(function countRemoved(id) { if (!after.has(id)) removed += 1; });
    return { added: added, conflicts: conflicts, replaced: mode === "replace" ? conflicts : 0, removed: removed };
  }

  function normalizeCurrent(value, options) {
    if (value && isPlainObject(value) && dataProperty(value, "schema") === SCHEMA) return parseBackup(value, options);
    return buildBackup(value || {}, { now: options && options.now !== undefined ? options.now : new Date(0) });
  }

  function createImportPlan(currentInput, backupInput, options) {
    var settings = options && typeof options === "object" ? options : {};
    var mode = settings.mode === "merge" ? "merge" : settings.mode === "replace" ? "replace" : null;
    if (!mode) fail("IMPORT_MODE_INVALID", "Chế độ nhập phải là merge hoặc replace.");
    var current = normalizeCurrent(currentInput, settings);
    var incoming = parseBackup(backupInput, settings);
    var nextStores = mode === "merge" ? mergeStores(current.stores, incoming.stores) : normalizeStores(incoming.stores);
    var localConsent = current.stores.main.settings.analyticsConsent === true;
    nextStores.main.settings.analyticsConsent = localConsent;
    if (!localConsent) nextStores.main.events = mode === "merge" ? current.stores.main.events.slice() : [];
    nextStores = normalizeStores(nextStores);
    var counts = {
      before: countStores(current.stores),
      incoming: countStores(incoming.stores),
      after: countStores(nextStores)
    };
    var changes = changeCounts(current.stores, incoming.stores, nextStores, mode);
    return deepFreeze({
      schema: PLAN_SCHEMA,
      version: 1,
      mode: mode,
      source: {
        schema: incoming.schema,
        version: incoming.version,
        exportedAt: incoming.exportedAt,
        migratedFrom: incoming.migratedFrom || null
      },
      counts: counts,
      changes: changes,
      stores: nextStores
    });
  }

  var api = Object.freeze({
    VERSION: SCHEMA_VERSION,
    SCHEMA: SCHEMA,
    SCHEMA_VERSION: SCHEMA_VERSION,
    LEGACY_SCHEMA_VERSION: LEGACY_SCHEMA_VERSION,
    PLAN_SCHEMA: PLAN_SCHEMA,
    CREATOR_SCHEMA: CREATOR_SCHEMA,
    LEARNING_SCHEMA: LEARNING_SCHEMA,
    PORTABLE_ROUTES: PORTABLE_ROUTES,
    LIMITS: LIMITS,
    utf8ByteLength: utf8ByteLength,
    canonicalStringify: function safeCanonicalStringify(value) { return canonicalStringify(cloneJson(value, "$")); },
    containsLikelySecret: function containsLikelySecret(value) {
      try { assertNoSecrets(cloneJson(value, "$"), "$"); return false; }
      catch (error) { return Boolean(error && error.code === "SECRET_DETECTED"); }
    },
    buildBackup: buildBackup,
    createBackup: buildBackup,
    serializeBackup: serializeBackup,
    parseBackup: parseBackup,
    migrateV1: migrateV1,
    inspectBackup: inspectBackup,
    createImportPlan: createImportPlan,
    planImport: createImportPlan
  });

  return api;
});
