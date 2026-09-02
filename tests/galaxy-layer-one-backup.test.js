const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "galaxy-layer-one-backup.js"), "utf8");
const backup = require("../galaxy-layer-one-backup.js");
const FIXED_NOW = "2026-09-01T12:00:00.000Z";

function fixtures() {
  return {
    main: {
      version: 1,
      settings: { theme: "cosmic", analyticsConsent: false },
      items: [
        { id: "prompt-1", route: "/galaxy/ai", title: "Ý tưởng tiếng Việt", description: "Nội dung thật", source: "user" },
        { id: "demo-main", route: "/galaxy/ai", title: "Mẫu", isDemo: true, source: "local-template" }
      ],
      events: [{ id: "event-1", type: "route-view", route: "/galaxy/ai", at: FIXED_NOW }]
    },
    creatorExport: JSON.stringify({
      schema: backup.CREATOR_SCHEMA,
      schemaVersion: 1,
      appVersion: "1.0.0",
      projects: [
        { id: "project-1", title: "Phim tài liệu", source: "user", steps: { idea: { content: "Biển Việt Nam" } } },
        { id: "demo-project", title: "Dự án mẫu", isDemo: true, source: "local-template" }
      ],
      schedule: [
        { id: "schedule-1", projectId: "project-1", title: "Duyệt cảnh" },
        { id: "demo-schedule", projectId: "demo-project", title: "Lịch mẫu", isDemo: true }
      ]
    }),
    learningExport: {
      schema: backup.LEARNING_SCHEMA,
      schemaVersion: 1,
      appVersion: "1.0.0",
      decks: [
        {
          id: "deck-1", title: "Từ vựng", source: "user",
          cards: [
            { id: "card-1", front: "xin chào", back: "hello", source: "user" },
            { id: "sample-card", front: "mẫu", back: "sample", isSample: true, source: "sample" }
          ]
        },
        { id: "sample-deck", title: "Bộ mẫu", isSample: true, source: "sample", cards: [] }
      ],
      activities: [
        { id: "activity-1", deckId: "deck-1", cardId: "card-1", type: "review", at: FIXED_NOW },
        { id: "sample-activity", deckId: "sample-deck", type: "review", at: FIXED_NOW }
      ]
    },
    records: [
      { id: "record-1", route: "/galaxy/tools", metadata: { type: "json" }, value: { title: "Công cụ riêng", enabled: true } },
      { id: "sample-record", route: "/galaxy/tools", isSample: true, value: { title: "Mẫu" } }
    ]
  };
}

test("backup engine exposes one frozen UMD/CommonJS pure API", () => {
  assert.equal(global.HHGalaxyLayerOneBackup, backup);
  assert.equal(backup.SCHEMA, "hh-galaxy-layer-one-backup");
  assert.equal(backup.SCHEMA_VERSION, 2);
  assert.ok(Object.isFrozen(backup));
  assert.ok(Object.isFrozen(backup.LIMITS));
  for (const method of ["buildBackup", "serializeBackup", "parseBackup", "migrateV1", "inspectBackup", "createImportPlan"]) {
    assert.equal(typeof backup[method], "function", method);
  }
  assert.doesNotMatch(source, /\b(?:fetch|XMLHttpRequest|WebSocket|eval|Function)\s*\(|\bdocument\b|\blocalStorage\b|\bsessionStorage\b|\bindexedDB\b/);
});

test("multi-store backup round-trips UTF-8 and excludes every marked sample/demo", () => {
  const text = backup.serializeBackup(fixtures(), { now: FIXED_NOW });
  const parsed = backup.parseBackup(text);
  assert.equal(parsed.exportedAt, FIXED_NOW);
  assert.equal(parsed.stores.main.items.length, 1);
  assert.equal(parsed.stores.main.items[0].title, "Ý tưởng tiếng Việt");
  assert.deepEqual(parsed.stores.creator.projects.map((item) => item.id), ["project-1"]);
  assert.deepEqual(parsed.stores.creator.schedule.map((item) => item.id), ["schedule-1"]);
  assert.deepEqual(parsed.stores.learning.decks.map((item) => item.id), ["deck-1"]);
  assert.deepEqual(parsed.stores.learning.decks[0].cards.map((item) => item.id), ["card-1"]);
  assert.deepEqual(parsed.stores.learning.activities.map((item) => item.id), ["activity-1"]);
  assert.deepEqual(parsed.stores.records.map((item) => item.id), ["record-1"]);
  assert.doesNotMatch(text, /demo-main|demo-project|sample-card|sample-deck|sample-record/);
  assert.equal(backup.serializeBackup(parsed), text, "a parsed package must serialize canonically without drift");
});

test("inspect preview is deterministic and counts each store without mutating input", () => {
  const input = fixtures();
  const before = JSON.stringify(input);
  const text = backup.serializeBackup(input, { now: FIXED_NOW });
  const first = backup.inspectBackup(text);
  const second = backup.inspectBackup(text);
  assert.deepEqual(first, second);
  assert.equal(first.ok, true);
  assert.equal(first.stores.main.items, 1);
  assert.equal(first.stores.main.events, 1);
  assert.equal(first.stores.creator.projects, 1);
  assert.equal(first.stores.creator.schedule, 1);
  assert.equal(first.stores.learning.decks, 1);
  assert.equal(first.stores.learning.cards, 1);
  assert.equal(first.stores.learning.activities, 1);
  assert.equal(first.stores.records.records, 1);
  assert.equal(first.totalRecords, 8);
  assert.equal(JSON.stringify(input), before);
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(first.candidate));
});

test("legacy v1 backup migrates into the main store and remains preview-only", () => {
  const legacy = JSON.stringify({
    schema: backup.SCHEMA,
    version: 1,
    exportedAt: FIXED_NOW,
    data: {
      version: 1,
      settings: { theme: "midnight", analyticsConsent: false },
      items: [{ id: "legacy-item", route: "/galaxy/dev", title: "Dữ liệu cũ" }],
      events: []
    }
  });
  const migrated = backup.parseBackup(legacy);
  assert.equal(migrated.version, 2);
  assert.equal(migrated.migratedFrom, 1);
  assert.equal(migrated.stores.main.items[0].id, "legacy-item");
  assert.deepEqual(migrated.stores.creator.projects, []);
  assert.deepEqual(migrated.stores.learning.decks, []);
  assert.deepEqual(migrated.stores.records, []);
  const preview = backup.inspectBackup(legacy);
  assert.equal(preview.migratedFrom, 1);
  assert.equal(preview.totalRecords, 1);
});

test("malformed, prototype-bearing, executable, binary and secret values fail closed", () => {
  assert.throws(() => backup.parseBackup("{not-json"), { code: "BACKUP_JSON_INVALID" });
  assert.equal(backup.inspectBackup("{not-json").ok, false);
  assert.throws(
    () => backup.parseBackup('{"schema":"hh-galaxy-layer-one-backup","version":2,"schemaVersion":2,"exportedAt":"2026-09-01T12:00:00.000Z","stores":{"__proto__":{"polluted":true}}}'),
    { code: "PROTOTYPE_KEY_REJECTED" }
  );

  const withFunction = fixtures();
  withFunction.records[0].value.run = () => true;
  assert.throws(() => backup.buildBackup(withFunction, { now: FIXED_NOW }), { code: "NON_JSON_VALUE" });

  const custom = fixtures();
  custom.records[0].value = Object.create({ inherited: true });
  custom.records[0].value.title = "Không an toàn";
  assert.throws(() => backup.buildBackup(custom, { now: FIXED_NOW }), { code: "CUSTOM_PROTOTYPE" });

  const binary = fixtures();
  binary.records[0].value = new Uint8Array([1, 2, 3]);
  assert.throws(() => backup.buildBackup(binary, { now: FIXED_NOW }), { code: "BINARY_NOT_ALLOWED" });

  const malformedRecord = fixtures();
  malformedRecord.main.items = ["không phải object"];
  assert.throws(() => backup.buildBackup(malformedRecord, { now: FIXED_NOW }), { code: "RECORD_INVALID" });

  const malformedCards = fixtures();
  malformedCards.learningExport.decks[0].cards = { card: true };
  assert.throws(() => backup.buildBackup(malformedCards, { now: FIXED_NOW }), { code: "COLLECTION_INVALID" });

  const missingRecordValue = fixtures();
  delete missingRecordValue.records[0].value;
  assert.throws(() => backup.buildBackup(missingRecordValue, { now: FIXED_NOW }), { code: "RECORD_VALUE_REQUIRED" });

  const foreignRoute = fixtures();
  foreignRoute.records[0].route = "/settings";
  assert.throws(() => backup.buildBackup(foreignRoute, { now: FIXED_NOW }), { code: "RECORD_ROUTE_INVALID" });

  const reservedLearningRecord = fixtures();
  reservedLearningRecord.records[0] = { id: "learning-state-v1", route: "/galaxy/learning", value: { decks: [] }, metadata: {} };
  assert.throws(() => backup.buildBackup(reservedLearningRecord, { now: FIXED_NOW }), { code: "RESERVED_RECORD_ID" });

  const malformedMetadata = fixtures();
  malformedMetadata.records[0].metadata = "not-an-object";
  assert.throws(() => backup.buildBackup(malformedMetadata, { now: FIXED_NOW }), { code: "RECORD_METADATA_INVALID" });

  const secret = fixtures();
  secret.records[0].metadata.apiKey = "sk-proj-abcdefghijklmnopqrstuvwxyz123456";
  assert.throws(() => backup.buildBackup(secret, { now: FIXED_NOW }), { code: "SECRET_DETECTED" });
  assert.equal(backup.containsLikelySecret({ token: "ghp_abcdefghijklmnopqrstuvwxyz" }), true);
  assert.equal(backup.containsLikelySecret({ provider: "not-configured", note: "process.env.API_KEY" }), false);
  assert.equal(backup.containsLikelySecret({ code: "const client_secret = import.meta.env.CLIENT_SECRET;" }), false);
  assert.equal({}.polluted, undefined);
});

test("byte and record gates use real UTF-8 boundaries", () => {
  const tooMany = fixtures();
  tooMany.records = Array.from({ length: backup.LIMITS.maxRecords + 1 }, (_, index) => ({ id: `record-${index}`, content: null }));
  assert.throws(() => backup.buildBackup(tooMany, { now: FIXED_NOW }), { code: "RECORD_LIMIT_EXCEEDED" });

  const oversized = fixtures();
  oversized.records[0].value = "ữ".repeat(Math.ceil(backup.LIMITS.maxStringBytes / 2) + 1);
  assert.ok(backup.utf8ByteLength(oversized.records[0].value) > backup.LIMITS.maxStringBytes);
  assert.throws(() => backup.buildBackup(oversized, { now: FIXED_NOW }), { code: "STRING_TOO_LARGE" });

  const overFile = "ữ".repeat(Math.ceil(backup.LIMITS.maxBackupBytes / 2) + 1);
  assert.ok(backup.utf8ByteLength(overFile) > backup.LIMITS.maxBackupBytes);
  assert.throws(() => backup.parseBackup(overFile), { code: "BACKUP_TOO_LARGE" });
});

test("merge and replace return deterministic pure plans and preserve local Analytics consent", () => {
  const current = {
    main: {
      settings: { theme: "midnight", analyticsConsent: false },
      items: [{ id: "same", route: "/galaxy/ai", title: "Bản cục bộ" }],
      events: []
    },
    creator: { projects: [], schedule: [] },
    learning: { decks: [], activities: [] },
    records: [{ id: "local-record", route: "/galaxy/tools", value: { value: 1 } }]
  };
  const incomingText = backup.serializeBackup({
    main: {
      settings: { theme: "cosmic", analyticsConsent: true },
      items: [
        { id: "same", route: "/galaxy/ai", title: "Bản từ backup" },
        { id: "new", route: "/galaxy/video", title: "Mới" }
      ],
      events: [{ id: "remote-event", type: "route-view", route: "/galaxy/video", at: FIXED_NOW }]
    },
    records: [{ id: "incoming-record", route: "/galaxy/tools", value: { value: 2 } }]
  }, { now: FIXED_NOW });
  const currentBefore = JSON.stringify(current);

  const merged = backup.createImportPlan(current, incomingText, { mode: "merge", now: FIXED_NOW });
  assert.equal(merged.schema, backup.PLAN_SCHEMA);
  assert.equal(merged.mode, "merge");
  assert.equal(merged.stores.main.items.find((item) => item.id === "same").title, "Bản cục bộ");
  assert.equal(merged.stores.main.items.some((item) => item.id === "new"), true);
  assert.equal(merged.stores.main.settings.theme, "midnight");
  assert.equal(merged.stores.main.settings.analyticsConsent, false);
  assert.deepEqual(merged.stores.main.events, [], "backup data cannot create telemetry while local consent is off");
  assert.equal(merged.changes.conflicts, 1);

  const replaced = backup.createImportPlan(current, incomingText, { mode: "replace", now: FIXED_NOW });
  assert.equal(replaced.stores.main.items.find((item) => item.id === "same").title, "Bản từ backup");
  assert.equal(replaced.stores.main.items.some((item) => item.id === "new"), true);
  assert.equal(replaced.stores.main.settings.analyticsConsent, false);
  assert.deepEqual(replaced.stores.main.events, []);
  assert.equal(replaced.stores.records.some((item) => item.id === "local-record"), false);
  assert.equal(JSON.stringify(current), currentBefore, "planning must not mutate the current stores");
  assert.ok(Object.isFrozen(merged));
  assert.deepEqual(
    backup.createImportPlan(current, incomingText, { mode: "merge", now: FIXED_NOW }),
    merged,
    "the same inputs must produce the same plan"
  );
  assert.throws(() => backup.createImportPlan(current, incomingText, { mode: "append" }), { code: "IMPORT_MODE_INVALID" });
});
