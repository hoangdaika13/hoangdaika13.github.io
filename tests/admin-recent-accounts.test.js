const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { ObjectId } = require("mongodb");
const { normalizeQuery, accountPipeline, presentAccount, sessionState, publicSession, maskIp, csvCell, listAccounts, requireAccess, handleAccounts } = require("../utils/admin-recent-accounts");
const now = new Date("2026-09-28T10:00:00Z");
const admin = { _id: new ObjectId(), systemRoles: ["admin"] };
const member = { _id: new ObjectId(), name: "Test", systemRoles: [] };
const active = { sessionId: "safe-session-id", createdAt: new Date("2026-09-28T09:00Z"), lastSeenAt: now, expiresAt: new Date("2026-09-29T00:00Z"), idleExpiresAt: new Date("2026-09-28T12:00Z"), device: { ip: "203.0.113.42", userAgent: "secret raw agent", browser: "Firefox", platform: "Linux" }, tokenHash: "never-return", token: "never-return", password: "never-return" };

test("pagination, sorting and malformed input are bounded", () => {
  const q = normalizeQuery({ page: "Infinity", limit: "NaN", sort: "__proto__", q: { $ne: "" } }, now);
  assert.equal(q.page, 1); assert.equal(q.limit, 20); assert.equal(q.sort, "login"); assert.equal(q.q, "");
  assert.equal(normalizeQuery({ page: -4, limit: 999 }, now).limit, 50);
  assert.equal(normalizeQuery({ page: 2.9 }, now).page, 2);
});
test("today respects supplied browser timezone; invalid custom date is rejected", () => {
  assert.equal(normalizeQuery({ range: "today", tz: -420 }, now).from.toISOString(), "2026-09-27T17:00:00.000Z");
  for (const q of [{ from: "bad", to: "bad" }, { from: "2026-09-29", to: "2026-09-28" }, { from: "2020-01-01", to: "2026-01-01" }]) assert.throws(() => normalizeQuery({ range: "custom", ...q }, now), /Khoảng thời gian/);
});
test("session status handles idle expiry, global revocation, logout and blocked accounts", () => {
  assert.equal(sessionState(active, {}, now), "active");
  assert.equal(sessionState({ ...active, idleExpiresAt: new Date(0) }, {}, now), "expired");
  assert.equal(sessionState({ ...active, expiresAt: null }, {}, now), "expired");
  assert.equal(sessionState(active, { sessionsRevokedAt: now }, now), "revoked");
  assert.equal(sessionState({ ...active, revokedAt: now, revokeReason: "logout" }, {}, now), "logged-out");
  assert.equal(sessionState({ ...active, revokedAt: now, revokeReason: "idle-timeout" }, {}, now), "expired");
  assert.equal(sessionState(active, { status: "locked" }, now), "blocked");
});
test("legacy sessions use real idle-window fallback", () => {
  assert.equal(sessionState({ ...active, idleExpiresAt: null, lastSeenAt: new Date("2026-09-27T09:00Z") }, {}, now), "expired");
  assert.equal(sessionState({ ...active, idleExpiresAt: null, remember: true, lastSeenAt: new Date("2026-09-27T09:00Z") }, {}, now), "active");
});
test("public session and account projections exclude secrets and mask IP", () => {
  const result = publicSession(active, {}, active.sessionId, now);
  assert.equal(result.current, true); assert.equal(result.ip, "203.0.*.*");
  assert.doesNotMatch(JSON.stringify(result), /never-return|userAgent|tokenHash|password/);
  const account = presentAccount({ ...member, passwordHash: "never-return", latestSession: active });
  assert.equal(account.lastLoginAt, null); assert.equal(account.ip, "203.0.*.*");
  assert.doesNotMatch(JSON.stringify(account), /never-return|passwordHash|token/);
  assert.equal(maskIp("2001:db8::123"), "2001:db8:…"); assert.equal(maskIp("nonsense"), "Chưa xác định");
});
test("CSV escapes formulas, delimiters and line breaks", () => {
  assert.equal(csvCell('=HYPERLINK("bad")'), '"\'=HYPERLINK(""bad"")"');
  assert.equal(csvCell("  @bad"), '"\'  @bad"');
  assert.equal(csvCell("a,b\nc"), '"a,b\nc"');
});
test("members and scoped custom roles cannot enumerate global account data", () => {
  assert.throws(() => requireAccess(member, "users.view"), { statusCode: 403 });
  const scoped = { _id: new ObjectId(), systemRoles: ["custom:test-role"], adminCustomPermissions: ["users.view"], __adminRoleAssignments: [{ roleId: "custom:test-role", status: "active", scope: { type: "account", ids: [String(member._id)] } }], __adminRoleDefinitions: [{ roleId: "custom:test-role", permissions: ["users.view"] }] };
  assert.throws(() => requireAccess(scoped, "users.view"), { statusCode: 403 });
  assert.doesNotThrow(() => requireAccess(admin, "users.view"));
});
test("pipeline uses escaped literal search, allowlisted projections and consent-bound presence", () => {
  const pipeline = accountPipeline(normalizeQuery({ q: ".*", range: "all", device: "Chrome", signal: "failed", workspace: "focus-room" }, now), true, now);
  assert.equal(pipeline[0].$match.$or[0].name.$regex, "\\.\\*");
  assert.match(JSON.stringify(pipeline), /"analyticsConsent":true/);
  assert.match(JSON.stringify(pipeline), /"failedLogins":\{"\$gt":0\}/);
  assert.doesNotMatch(JSON.stringify(pipeline), /passwordHash|tokenHash|cookie/);
  assert.doesNotMatch(JSON.stringify(accountPipeline(normalizeQuery({}, now), false, now)), /"from":"presence"/);
});
test("recent listing paginates at server and reports genuine empty data", async () => {
  let captured, config;
  const db = { collection: () => ({ aggregate: (p, c) => { captured = p; config = c; return { toArray: async () => [{ users: [], totals: [] }] }; } }) };
  const result = await listAccounts(db, admin, { page: 3, limit: 20 });
  assert.equal(result.pagination.total, 0); assert.equal(result.summary.sessions, 0);
  assert.equal(captured.at(-1).$facet.users[1].$skip, 40); assert.equal(config.maxTimeMS, 8000);
  await assert.rejects(listAccounts(db, { ...admin, systemRoles: ["support"] }, { workspace: "private" }), { statusCode: 403 });
});
test("oversized exports fail instead of silently truncating", async () => {
  const db = { collection: () => ({ aggregate: () => ({ toArray: async () => [{ users: [], totals: [{ accounts: 1001 }] }] }) }) };
  await assert.rejects(listAccounts(db, admin, {}, true), /1.000/);
});
test("detail authorization fails before database access", async () => {
  const db = { collection() { throw Error("must not read"); } };
  await assert.rejects(handleAccounts({ method: "GET", query: { view: "accounts-detail", id: String(member._id) }, headers: {} }, {}, { db, admin: member, body: {} }), { statusCode: 403 });
});
test("detail redaction and audit/activity permission boundaries", async () => {
  const touched = [];
  const cursor = rows => ({ sort() { return this; }, limit() { return this; }, toArray: async () => rows });
  const db = { collection(name) { touched.push(name); return {
    findOne: async () => name === "users" ? member : null,
    find: () => cursor(name === "authSessions" ? [active] : name === "loginEvents" ? [{ ...active, _id: "event", ip: "198.51.100.2", success: false }] : [])
  }; } };
  const response = { status() { return this; }, json(data) { this.data = data; return data; } };
  await handleAccounts({ method: "GET", query: { view: "accounts-detail", id: String(member._id) }, headers: {} }, response, { db, admin: { _id: new ObjectId(), systemRoles: ["custom:qa-reader"], adminCustomPermissions: ["users.view"] }, body: {}, hydrateAdminAccess: async () => {}, assertTargetAllowed: async () => {} });
  assert.equal(response.data.events[0].ip, "198.51.*.*");
  assert.doesNotMatch(JSON.stringify(response.data), /never-return|tokenHash|passwordHash|"password":|"userAgent":/);
  assert.equal(touched.includes("telemetryEvents"), false); assert.equal(touched.includes("communityAdminAuditLogs"), false); assert.equal(touched.includes("adminAccountNotes"), false);
});
test("new module is lazy-loaded before Admin and controls are escaped and scoped", () => {
  const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
  assert.match(read("performance-loader.js"), /scripts: \["admin-recent-accounts.js\?v=2", "community-admin.js\?v=17"\]/);
  const client = read("admin-recent-accounts.js");
  assert.match(client, /hh\.admin\.accounts\.filters\.v1/); assert.match(client, /pending.*new Set/);
  assert.doesNotMatch(client, /\b(?:alert|prompt|confirm)\s*\(/);
  assert.match(read("admin-recent-accounts.css"), /forced-colors/);
  assert.match(read("admin-recent-accounts.css"), /prefers-reduced-motion/);
});

function mutationHarness() {
  const vm = require("node:vm");
  const { createRequire } = require("node:module");
  const filename = path.join(__dirname, "../utils/admin-recent-accounts.js");
  const nativeRequire = createRequire(filename), audit = [], writes = [], state = { notes: [] };
  const module = { exports: {} };
  const sandbox = { module, exports: module.exports, require(name) {
    if (name === "./platform") return { ...nativeRequire(name), enforceRateLimit: async () => {} };
    if (name === "./community-admin") return { ...nativeRequire(name), writeAdminAudit: async (...args) => audit.push(args[3]) };
    return nativeRequire(name);
  }, Date, Object, Set, Map, Error, JSON, String, Number };
  vm.runInNewContext(fs.readFileSync(filename, "utf8"), sandbox, { filename });
  const db = { collection(name) { return {
    findOne: async () => name === "users" ? member : name === "authSessions" ? { _id: "current-session" } : null,
    find: () => ({ sort() { return this; }, limit() { return this; }, toArray: async () => [] }),
    insertOne: async record => { writes.push({ name, record }); state.notes.push(record); return { insertedId: new ObjectId() }; },
    updateOne: async (filter, update) => { writes.push({ name, filter, update }); return { modifiedCount: 1 }; },
    updateMany: async (filter, update) => { writes.push({ name, filter, update }); return { modifiedCount: 2 }; },
    deleteOne: async filter => { writes.push({ name, filter }); return { deletedCount: 1 }; },
    aggregate: () => ({ toArray: async () => [{ users: [{ ...member, name: '=formula', email: 'qa@example.invalid' }], totals: [{ accounts: 1 }] }] })
  }; } };
  const call = async (view, body, actor = admin) => {
    const res = { setHeader() {}, status(code) { this.code = code; return this; }, json(data) { this.data = data; return data; } };
    return module.exports.handleAccounts({ method: "POST", query: { view }, headers: { authorization: "Bearer qa-local-only" } }, res, { db, admin: actor, body, hydrateAdminAccess: async () => {}, assertTargetAllowed: async (a, t) => require("../utils/admin-control-plane").assertCanAdministerTarget(a, t, require("../utils/community-admin").ROLE_RANK) });
  };
  return { call, writes, audit, state };
}
test("notes and review flags persist only explicit fields and create audit records", async () => {
  const h = mutationHarness();
  await h.call("accounts-manage", { userId: String(member._id), action: "note:add", reason: "QA reason", text: "Test note", systemRoles: ["owner"] });
  assert.equal(h.state.notes[0].text, "Test note"); assert.equal(h.state.notes[0].systemRoles, undefined);
  assert.ok(h.state.notes[0].expiresAt > new Date()); assert.equal(h.audit[0].action, "accounts:note:add");
  assert.equal(h.audit[0].after.added, true); assert.equal(h.audit[0].after.text, undefined);
  await h.call("accounts-manage", { userId: String(member._id), action: "review:set", reason: "QA review", review: true });
  assert.equal(h.writes[1].update.$set.review, true); assert.equal(h.audit[1].action, "accounts:review:set");
});
test("note deletion is bound to target and author, and invalid reasons do not mutate", async () => {
  const h = mutationHarness();
  await assert.rejects(h.call("accounts-manage", { userId: String(member._id), action: "note:add", reason: "x", text: "bad" }), { statusCode: 400 });
  assert.equal(h.writes.length, 0);
  await h.call("accounts-manage", { userId: String(member._id), action: "note:delete", noteId: String(new ObjectId()), reason: "QA delete" });
  assert.equal(String(h.writes[0].filter.authorId), String(admin._id)); assert.equal(String(h.writes[0].filter.userId), String(member._id));
});
test("editing notes binds target and author, excludes content from audit and rejects labelled credentials", async () => {
  const h = mutationHarness(), noteId = String(new ObjectId());
  await h.call("accounts-manage", { userId: String(member._id), action: "note:edit", noteId, reason: "QA edit", text: "Updated plain text", systemRoles: ["owner"] });
  assert.equal(String(h.writes[0].filter.authorId), String(admin._id));
  assert.equal(String(h.writes[0].filter.userId), String(member._id));
  assert.equal(h.writes[0].update.$set.text, "Updated plain text");
  assert.equal(h.audit[0].after.text, undefined);
  await assert.rejects(h.call("accounts-manage", { userId: String(member._id), action: "note:add", reason: "QA secret", text: "password: should-never-be-saved" }), { statusCode: 400 });
  assert.equal(h.writes.length, 1);
});
test("review stores priority and schedule; invalid assignee or past schedule cannot mutate", async () => {
  const h = mutationHarness(), reviewAt = new Date(Date.now() + 86400000).toISOString();
  await h.call("accounts-manage", { userId: String(member._id), action: "review:set", review: true, priority: "high", reviewAt, reason: "QA review" });
  assert.equal(h.writes[0].update.$set.priority, "high");
  assert.equal(h.writes[0].update.$set.reviewAt, reviewAt);
  for(const body of [{assigneeId: "not-an-id"}, {assigneeId: String(member._id)}, {reviewAt:"2000-01-01"}]) await assert.rejects(h.call("accounts-manage", {userId:String(member._id),action:"review:set",review:true,reason:"QA review",...body}), {statusCode:400});
  assert.equal(h.writes.length, 1);
});
function detailHarness(target = member, collections = {}, actor = admin) {
  const touched = [];
  const db = {collection(name) { touched.push(name);return {findOne:async()=>name==="users"?target:null,find:()=>({sort(){return this;},limit(){return this;},toArray:async()=>collections[name]||[]})};}};
  const call = async section => { const res={status(){return this;},json(data){return data;}};return handleAccounts({method:"GET",query:{view:"accounts-detail",id:String(target._id),section},headers:{}},res,{db,admin:actor,body:{},hydrateAdminAccess:async()=>{},assertTargetAllowed:async()=>{}}); };
  return {call,touched};
}
test("profile tabs load only their requested read model and report unauthorized explicitly", async () => {
  const h = detailHarness(member, {}, {...admin,systemRoles:["custom:qa-reader"],adminCustomPermissions:["users.view"]});
  const data = await h.call("notes");
  assert.equal(data.canNotes,false);assert.equal(data.reviewDetail,null);
  assert.equal(h.touched.includes("adminAccountNotes"),false);
  assert.equal(h.touched.includes("loginEvents"),false);assert.equal(h.touched.includes("authSessions"),false);
  const audit = await h.call("audit");assert.equal(audit.canAudit,false);assert.equal(h.touched.includes("communityAdminAuditLogs"),false);
  await assert.rejects(h.call("not-valid"),{statusCode:400});
});
test("current consent revocation suppresses previously stored workspace telemetry", async () => {
  for(const value of [false,null]) {
    const h=detailHarness({...member,consentPreferences:{analytics:value}},{telemetryEvents:[{_id:"qa",module:"focus-room",createdAt:now}]});
    const data=await h.call("workspace");assert.equal(data.canActivity,false);assert.equal(data.activity.length,0);assert.equal(h.touched.includes("telemetryEvents"),false);
  }
  const h=detailHarness({...member,consent:true},{telemetryEvents:[{_id:"qa",module:"focus-room",createdAt:now,prompt:"never-return"}]});
  const data=await h.call("workspace");assert.equal(data.canActivity,true);assert.equal(data.activity[0].module,"focus-room");assert.doesNotMatch(JSON.stringify(data),/never-return/);
});
test("scoped reader may inspect its account but cannot inspect another account or enumerate globally", async () => {
  const role="custom:qa-scope",actor={...admin,systemRoles:[role],adminCustomPermissions:["users.view"],__adminRoleAssignments:[{roleId:role,status:"active",scope:{type:"account",accountIds:[String(member._id)]}}],__adminRoleDefinitions:[{roleId:role,permissions:["users.view"]}]};
  assert.equal((await detailHarness(member,{},actor).call("privacy")).user.id,String(member._id));
  await assert.rejects(detailHarness({...member,_id:new ObjectId()},{},actor).call("privacy"),{statusCode:403});
  assert.throws(()=>requireAccess(actor,"users.view"),{statusCode:403});
});
test("role and support projections expose safe metadata and actual expired grant state", async () => {
  const target={...member,systemRoles:["support"]};
  const h=detailHarness(target,{communityAccessGrants:[{_id:new ObjectId(),permission:"users.view",status:"active",expiresAt:new Date(0),scope:{type:"account",accountIds:[String(member._id)]},secret:"never-return"}],tickets:[{_id:new ObjectId(),status:"open",priority:"high",message:"never-return",email:"never-return"}]},{...admin,systemRoles:["super_admin"]});
  const access=await h.call("access");assert.ok(access.effectivePermissions.includes("users.view"));assert.equal(access.accessGrants[0].status,"expired");assert.doesNotMatch(JSON.stringify(access),/never-return/);
  const support=await h.call("support");assert.equal(support.support[0].status,"open");assert.doesNotMatch(JSON.stringify(support),/never-return/);
});
test("own other-session revocation preserves current session and cannot target another account", async () => {
  const h = mutationHarness();
  await assert.rejects(h.call("accounts-manage", { userId: String(member._id), action: "sessions:revoke-others", reason: "QA logout" }), { statusCode: 403 });
  await h.call("accounts-manage", { userId: String(admin._id), action: "sessions:revoke-others", reason: "QA logout" });
  assert.equal(String(h.writes[0].filter.userId), String(admin._id)); assert.equal(h.writes[0].filter._id.$ne, "current-session");
  assert.equal(h.audit[0].after.currentSessionPreserved, true);
});
test("export checks permission, allowlists fields, neutralizes formulas and audits count", async () => {
  const h = mutationHarness();
  await assert.rejects(h.call("accounts-export", { fields: ["email"] }, { ...admin, systemRoles: ["support"] }), { statusCode: 403 });
  const result = await h.call("accounts-export", { fields: ["name", "passwordHash", "token"], format: "csv", query: {} });
  assert.match(result.content, /'=formula/); assert.doesNotMatch(result.content, /passwordHash|token/);
  assert.equal(h.audit[0].action, "accounts:export"); assert.equal(h.audit[0].after.count, 1);
});
test("single-profile export enforces export permission and audits before returning bounded data", async () => {
  const h=mutationHarness();
  await assert.rejects(h.call("accounts-profile-export",{userId:String(member._id)},{...admin,systemRoles:["support"]}),{statusCode:403});
  const data=await h.call("accounts-profile-export",{userId:String(member._id),fields:["passwordHash"]});
  const result=JSON.parse(data.content);assert.equal(result.user.id,String(member._id));assert.equal(result.limits.events,100);
  assert.equal(h.audit[0].action,"accounts:profile-export");assert.doesNotMatch(data.content,/"passwordHash":|"token":|"userAgent":/);
});
