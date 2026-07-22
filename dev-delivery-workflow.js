(function (globalScope) {
  "use strict";

  const VERSION = 1;
  const SCHEMA = "hh.dev.delivery-workflow.v1";
  const STORAGE_KEY = SCHEMA;
  const TOOL_IDS = Object.freeze(["delivery-workflow"]);
  const MAX_DIFF_LENGTH = 240000;
  const MAX_AUDIT_ENTRIES = 80;
  const ALLOWED_PERMISSIONS = Object.freeze([
    "repository:read",
    "issues:read",
    "branches:write",
    "pull-requests:write"
  ]);
  const SAFE_SANDBOX_COMMANDS = Object.freeze([
    "npm test",
    "npm run test",
    "npm run lint",
    "npm run build",
    "node --test"
  ]);
  const CHECK_IDS = Object.freeze(["sandbox", "review", "dependency", "secrets"]);
  const APPROVAL_PHRASES = Object.freeze({
    merge: "APPROVE MERGE",
    deploy: "APPROVE DEPLOY",
    rollback: "APPROVE ROLLBACK"
  });
  const instances = new WeakMap();

  const SENSITIVE_KEY_RE = /(?:(?:token|secret)(?:$|[_-])|private[_-]?key|password|passwd|authorization|credential|cookie|session)/i;
  const SECRET_RULES = Object.freeze([
    { type: "private-key", severity: "critical", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g, replacement: "[REDACTED_PRIVATE_KEY]" },
    { type: "bearer-token", severity: "critical", pattern: /\bBearer\s+[A-Za-z0-9._~+\/-]{12,}={0,2}/gi, replacement: "Bearer [REDACTED]" },
    { type: "github-token", severity: "critical", pattern: /\bgh(?:p|o|u|s|r)_[A-Za-z0-9]{20,}\b/g, replacement: "[REDACTED_GITHUB_TOKEN]" },
    { type: "assigned-secret", severity: "high", pattern: /\b(?:api[_-]?key|client[_-]?secret|access[_-]?token|password|passwd)\s*[:=]\s*["']?[^\s,"']{8,}/gi, replacement: "secret=[REDACTED]" }
  ]);

  function clone(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
  }

  function safeText(value, maxLength = 12000) {
    return String(value == null ? "" : value)
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
      .slice(0, maxLength);
  }

  function escapeHtml(value) {
    return safeText(value, MAX_DIFF_LENGTH)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function nowIso(now) {
    const value = typeof now === "function" ? now() : now;
    return new Date(Number.isFinite(Number(value)) ? Number(value) : Date.now()).toISOString();
  }

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function redactSecrets(value) {
    let text = safeText(value, MAX_DIFF_LENGTH);
    SECRET_RULES.forEach((rule) => {
      rule.pattern.lastIndex = 0;
      text = text.replace(rule.pattern, rule.replacement);
    });
    return text;
  }

  function stripSensitive(value, depth = 0, seen) {
    if (depth > 7) return "[TRUNCATED]";
    if (value == null || typeof value === "number" || typeof value === "boolean") return value;
    if (typeof value === "string") return redactSecrets(value);
    if (typeof value !== "object") return undefined;
    const references = seen || new WeakSet();
    if (references.has(value)) return "[CIRCULAR]";
    references.add(value);
    if (Array.isArray(value)) return value.slice(0, 200).map((item) => stripSensitive(item, depth + 1, references));
    const output = {};
    Object.keys(value).slice(0, 160).forEach((key) => {
      if (SENSITIVE_KEY_RE.test(key)) return;
      const clean = stripSensitive(value[key], depth + 1, references);
      if (clean !== undefined) output[safeText(key, 80)] = clean;
    });
    return output;
  }

  function scanSecrets(value) {
    const text = safeText(value, MAX_DIFF_LENGTH);
    const findings = [];
    SECRET_RULES.forEach((rule) => {
      rule.pattern.lastIndex = 0;
      let match;
      while ((match = rule.pattern.exec(text)) && findings.length < 60) {
        const nextIndex = rule.pattern.lastIndex;
        findings.push({
          id: `${rule.type}-${match.index}`,
          type: rule.type,
          severity: rule.severity,
          line: text.slice(0, match.index).split("\n").length,
          preview: safeText(rule.replacement, 100)
        });
        rule.pattern.lastIndex = nextIndex;
        if (match[0] === "") rule.pattern.lastIndex += 1;
      }
    });
    return findings;
  }

  function normalizeGitHubRepositoryUrl(value) {
    const raw = safeText(value, 500).trim();
    if (!raw) return { valid: false, value: "", error: "Hãy nhập URL repository GitHub." };
    try {
      const url = new URL(raw);
      if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "github.com") throw new Error("Chỉ chấp nhận URL HTTPS trên github.com.");
      const parts = url.pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
      if (parts.length !== 2) throw new Error("URL phải có dạng https://github.com/owner/repository.");
      const owner = parts[0];
      const name = parts[1].replace(/\.git$/i, "");
      if (!/^[A-Za-z0-9_.-]{1,100}$/.test(owner) || !/^[A-Za-z0-9_.-]{1,100}$/.test(name)) throw new Error("Owner hoặc repository không hợp lệ.");
      return { valid: true, owner, name, value: `https://github.com/${owner}/${name}` };
    } catch (error) {
      return { valid: false, value: raw, error: safeText(error.message || "URL repository không hợp lệ.", 200) };
    }
  }

  function safePreviewUrl(value) {
    try {
      const url = new URL(safeText(value, 2048));
      const local = /^(?:localhost|127\.0\.0\.1|\[::1\])$/i.test(url.hostname);
      return url.protocol === "https:" || (url.protocol === "http:" && local) ? url.href : "";
    } catch (_) {
      return "";
    }
  }

  function normalizePermissions(input) {
    const source = Array.isArray(input) ? input : [];
    return [...new Set(source.map((item) => safeText(item, 80)).filter((item) => ALLOWED_PERMISSIONS.includes(item)))];
  }

  function emptyApproval(gate) {
    return { gate, approved: false, reviewer: "", phrase: "", revision: "", targetId: "", approvedAt: "" };
  }

  function emptyCheck(id) {
    return { id, status: "idle", summary: "Chưa chạy", findings: [], completedAt: "", source: "" };
  }

  function defaultState() {
    return {
      schema: SCHEMA,
      version: VERSION,
      activeView: "workflow",
      provider: {
        status: "unknown",
        configured: false,
        connected: false,
        account: "",
        permissions: [],
        message: "Chưa kiểm tra adapter GitHub server-side.",
        checkedAt: ""
      },
      repository: {
        status: "idle",
        url: "",
        owner: "",
        name: "",
        defaultBranch: "main",
        baseSha: "",
        snapshotId: "",
        importedAt: ""
      },
      issue: { number: "", title: "", body: "", url: "" },
      change: {
        status: "idle",
        planId: "",
        branch: "",
        diff: "",
        tests: [],
        steps: [],
        source: "",
        sourceLabel: "",
        revision: "",
        createdAt: ""
      },
      checks: Object.fromEntries(CHECK_IDS.map((id) => [id, emptyCheck(id)])),
      approvals: {
        merge: emptyApproval("merge"),
        deploy: emptyApproval("deploy"),
        rollback: emptyApproval("rollback")
      },
      delivery: {
        pullRequestId: "",
        pullRequestUrl: "",
        mergeStatus: "idle",
        preview: { status: "idle", id: "", url: "", revision: "", deployedAt: "" },
        rollback: { status: "idle", id: "", targetId: "", completedAt: "" }
      },
      audit: [],
      updatedAt: ""
    };
  }

  function normalizeCheck(value, id) {
    const source = value && typeof value === "object" ? value : {};
    const statuses = ["idle", "running", "passed", "failed", "blocked", "unsupported", "error"];
    return {
      id,
      status: statuses.includes(source.status) ? source.status : "idle",
      summary: safeText(source.summary || "Chưa chạy", 300),
      findings: Array.isArray(source.findings) ? stripSensitive(source.findings).slice(0, 60) : [],
      completedAt: safeText(source.completedAt, 50),
      source: safeText(source.source, 100)
    };
  }

  function normalizeApproval(value, gate) {
    const source = value && typeof value === "object" ? value : {};
    const expected = APPROVAL_PHRASES[gate];
    const phrase = safeText(source.phrase, 40);
    const approved = source.approved === true && phrase === expected;
    return {
      gate,
      approved,
      reviewer: approved ? safeText(source.reviewer, 100) : "",
      phrase: approved ? phrase : "",
      revision: approved ? safeText(source.revision, 100) : "",
      targetId: approved ? safeText(source.targetId, 120) : "",
      approvedAt: approved ? safeText(source.approvedAt, 50) : ""
    };
  }

  function revisionFor(input) {
    const text = safeText(input, MAX_DIFF_LENGTH);
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `rev-${(hash >>> 0).toString(16).padStart(8, "0")}`;
  }

  function normalizeState(input) {
    const fallback = defaultState();
    const source = input && typeof input === "object" ? stripSensitive(input) : {};
    const repositoryUrl = normalizeGitHubRepositoryUrl(source.repository && source.repository.url || "");
    const repository = source.repository && typeof source.repository === "object" ? source.repository : {};
    const issue = source.issue && typeof source.issue === "object" ? source.issue : {};
    const change = source.change && typeof source.change === "object" ? source.change : {};
    const provider = source.provider && typeof source.provider === "object" ? source.provider : {};
    const providerStatuses = ["unknown", "checking", "unconfigured", "disconnected", "connected", "unsupported", "error"];
    const changeStatuses = ["idle", "planning", "drafted", "blocked", "error"];
    const cleanDiff = redactSecrets(safeText(change.diff, MAX_DIFF_LENGTH));
    const tests = Array.isArray(change.tests) ? change.tests.map((item) => safeText(item, 100)).filter((item) => SAFE_SANDBOX_COMMANDS.includes(item)).slice(0, 12) : [];
    const branch = safeText(change.branch, 160).replace(/[^A-Za-z0-9._\/-]/g, "-").replace(/\.{2,}/g, ".").replace(/^[-/.]+|[-/.]+$/g, "");
    const computedRevision = cleanDiff && branch ? revisionFor(`${branch}\n${cleanDiff}\n${tests.join("\n")}`) : "";
    const result = {
      ...fallback,
      activeView: source.activeView === "audit" ? "audit" : "workflow",
      provider: {
        status: providerStatuses.includes(provider.status) ? provider.status : "unknown",
        configured: provider.configured === true,
        connected: provider.connected === true && provider.status === "connected",
        account: safeText(provider.account, 120),
        permissions: normalizePermissions(provider.permissions),
        message: safeText(provider.message || fallback.provider.message, 300),
        checkedAt: safeText(provider.checkedAt, 50)
      },
      repository: {
        status: ["idle", "importing", "imported", "error"].includes(repository.status) ? repository.status : "idle",
        url: repositoryUrl.valid ? repositoryUrl.value : "",
        owner: repositoryUrl.valid ? repositoryUrl.owner : safeText(repository.owner, 100),
        name: repositoryUrl.valid ? repositoryUrl.name : safeText(repository.name, 100),
        defaultBranch: safeText(repository.defaultBranch || "main", 160).replace(/[^A-Za-z0-9._\/-]/g, "-") || "main",
        baseSha: safeText(repository.baseSha, 100),
        snapshotId: safeText(repository.snapshotId, 120),
        importedAt: safeText(repository.importedAt, 50)
      },
      issue: {
        number: safeText(issue.number, 20).replace(/[^0-9]/g, ""),
        title: safeText(issue.title, 240),
        body: redactSecrets(safeText(issue.body, 12000)),
        url: safeText(issue.url, 500)
      },
      change: {
        status: changeStatuses.includes(change.status) ? change.status : "idle",
        planId: safeText(change.planId, 120),
        branch,
        diff: cleanDiff,
        tests,
        steps: Array.isArray(change.steps) ? change.steps.map((item) => safeText(item, 300)).filter(Boolean).slice(0, 20) : [],
        source: ["server-ai", "local-deterministic", "manual"].includes(change.source) ? change.source : "",
        sourceLabel: safeText(change.sourceLabel, 120),
        revision: computedRevision,
        createdAt: safeText(change.createdAt, 50)
      },
      checks: Object.fromEntries(CHECK_IDS.map((id) => [id, normalizeCheck(source.checks && source.checks[id], id)])),
      approvals: {
        merge: normalizeApproval(source.approvals && source.approvals.merge, "merge"),
        deploy: normalizeApproval(source.approvals && source.approvals.deploy, "deploy"),
        rollback: normalizeApproval(source.approvals && source.approvals.rollback, "rollback")
      },
      delivery: {
        pullRequestId: safeText(source.delivery && source.delivery.pullRequestId, 120),
        pullRequestUrl: safePreviewUrl(source.delivery && source.delivery.pullRequestUrl),
        mergeStatus: ["idle", "running", "merged", "failed", "blocked"].includes(source.delivery && source.delivery.mergeStatus) ? source.delivery.mergeStatus : "idle",
        preview: {
          status: ["idle", "running", "succeeded", "failed", "blocked"].includes(source.delivery && source.delivery.preview && source.delivery.preview.status) ? source.delivery.preview.status : "idle",
          id: safeText(source.delivery && source.delivery.preview && source.delivery.preview.id, 120),
          url: safePreviewUrl(source.delivery && source.delivery.preview && source.delivery.preview.url),
          revision: safeText(source.delivery && source.delivery.preview && source.delivery.preview.revision, 100),
          deployedAt: safeText(source.delivery && source.delivery.preview && source.delivery.preview.deployedAt, 50)
        },
        rollback: {
          status: ["idle", "running", "succeeded", "failed", "blocked"].includes(source.delivery && source.delivery.rollback && source.delivery.rollback.status) ? source.delivery.rollback.status : "idle",
          id: safeText(source.delivery && source.delivery.rollback && source.delivery.rollback.id, 120),
          targetId: safeText(source.delivery && source.delivery.rollback && source.delivery.rollback.targetId, 120),
          completedAt: safeText(source.delivery && source.delivery.rollback && source.delivery.rollback.completedAt, 50)
        }
      },
      audit: Array.isArray(source.audit) ? source.audit.slice(-MAX_AUDIT_ENTRIES).map((entry) => ({
        id: safeText(entry.id || uid("audit"), 120),
        type: safeText(entry.type, 80),
        status: safeText(entry.status, 40),
        message: redactSecrets(safeText(entry.message, 300)),
        at: safeText(entry.at, 50)
      })) : [],
      updatedAt: safeText(source.updatedAt, 50)
    };
    CHECK_IDS.forEach((id) => {
      if (result.checks[id].status === "running") result.checks[id] = { ...result.checks[id], status: "blocked", summary: "Phiên trước đã kết thúc; cần chạy lại." };
    });
    if (result.provider.status === "checking") result.provider = { ...result.provider, status: "unknown", connected: false, message: "Cần kiểm tra lại adapter server-side." };
    if (result.repository.status === "importing") result.repository.status = "idle";
    if (result.change.status === "planning") result.change.status = "blocked";
    return result;
  }

  function stateForStorage(state) {
    const clean = normalizeState(state);
    clean.provider = {
      ...clean.provider,
      status: "unknown",
      connected: false,
      account: "",
      message: "Cần kiểm tra lại phiên OAuth server-side sau khi tải trang.",
      checkedAt: ""
    };
    CHECK_IDS.forEach((id) => {
      if (clean.checks[id].status === "running") clean.checks[id] = emptyCheck(id);
    });
    return clean;
  }

  function serializeState(state) {
    return JSON.stringify(stateForStorage(state));
  }

  function createStore(storage) {
    const target = storage === undefined ? globalScope.localStorage : storage;
    return {
      load() {
        if (!target || typeof target.getItem !== "function") return defaultState();
        try { return normalizeState(JSON.parse(target.getItem(STORAGE_KEY) || "null")); } catch (_) { return defaultState(); }
      },
      save(state) {
        const clean = normalizeState(state);
        if (target && typeof target.setItem === "function") {
          try { target.setItem(STORAGE_KEY, serializeState(clean)); } catch (_) { /* localStorage may be unavailable */ }
        }
        return clean;
      }
    };
  }

  function addAudit(stateInput, type, status, message, now) {
    const state = normalizeState(stateInput);
    state.audit.push({ id: uid("audit"), type: safeText(type, 80), status: safeText(status, 40), message: redactSecrets(safeText(message, 300)), at: nowIso(now) });
    state.audit = state.audit.slice(-MAX_AUDIT_ENTRIES);
    state.updatedAt = nowIso(now);
    return state;
  }

  function revokeApprovals(stateInput, reason, now) {
    let state = normalizeState(stateInput);
    const revoked = Object.values(state.approvals).some((approval) => approval.approved);
    state.approvals = { merge: emptyApproval("merge"), deploy: emptyApproval("deploy"), rollback: emptyApproval("rollback") };
    if (revoked) state = addAudit(state, "approval.revoked", "blocked", reason || "Revision hoặc kết quả kiểm tra đã thay đổi.", now);
    return state;
  }

  function applyProviderStatus(stateInput, payload, now) {
    let state = normalizeState(stateInput);
    const result = stripSensitive(payload || {});
    const status = safeText(result.status, 40);
    const requestedPermissions = Array.isArray(result.permissions) ? result.permissions.map((item) => safeText(item, 80)) : [];
    const forbidden = requestedPermissions.filter((item) => !ALLOWED_PERMISSIONS.includes(item));
    if (forbidden.length) {
      state.provider = { ...defaultState().provider, status: "error", message: "Adapter yêu cầu quyền vượt giới hạn; kết nối đã bị từ chối.", checkedAt: nowIso(now) };
      return addAudit(state, "provider.status", "error", "Từ chối adapter GitHub vì có quyền vượt giới hạn.", now);
    }
    if (status === "unconfigured" || result.configured !== true) {
      state.provider = { ...defaultState().provider, status: "unconfigured", message: safeText(result.message || "Backend GitHub OAuth chưa được cấu hình.", 300), checkedAt: nowIso(now) };
    } else if (status === "connected" && result.authenticated === true) {
      state.provider = {
        status: "connected", configured: true, connected: true,
        account: safeText(result.account, 120), permissions: normalizePermissions(requestedPermissions),
        message: safeText(result.message || "Phiên OAuth server-side đang hoạt động.", 300), checkedAt: nowIso(now)
      };
    } else if (["disconnected", "ready"].includes(status)) {
      state.provider = {
        status: "disconnected", configured: true, connected: false,
        account: "", permissions: normalizePermissions(requestedPermissions),
        message: safeText(result.message || "Backend sẵn sàng; cần kết nối GitHub.", 300), checkedAt: nowIso(now)
      };
    } else {
      state.provider = { ...defaultState().provider, status: "error", configured: result.configured === true, message: "Phản hồi trạng thái adapter không hợp lệ.", checkedAt: nowIso(now) };
    }
    return addAudit(state, "provider.status", state.provider.status, state.provider.message, now);
  }

  function validateRepositoryResult(payload) {
    const result = stripSensitive(payload || {});
    if (result.ok !== true || result.status !== "imported") throw new Error("Backend chưa xác nhận repository đã được nhập.");
    const repoUrl = normalizeGitHubRepositoryUrl(result.repository && result.repository.url);
    if (!repoUrl.valid) throw new Error(repoUrl.error || "Repository backend trả về không hợp lệ.");
    const snapshotId = safeText(result.repository && result.repository.snapshotId, 120);
    const baseSha = safeText(result.repository && result.repository.baseSha, 100);
    if (!snapshotId || !baseSha) throw new Error("Repository thiếu snapshotId hoặc base SHA đã xác minh.");
    return {
      url: repoUrl.value, owner: repoUrl.owner, name: repoUrl.name,
      defaultBranch: safeText(result.repository.defaultBranch || "main", 160),
      baseSha, snapshotId
    };
  }

  function applyRepositoryResult(stateInput, payload, now) {
    let state = normalizeState(stateInput);
    const repository = validateRepositoryResult(payload);
    state.repository = { status: "imported", ...repository, importedAt: nowIso(now) };
    state.issue = defaultState().issue;
    state.change = defaultState().change;
    state.checks = defaultState().checks;
    state.delivery = defaultState().delivery;
    state = revokeApprovals(state, "Repository snapshot đã thay đổi.", now);
    return addAudit(state, "repository.import", "imported", `${repository.owner}/${repository.name} · ${repository.baseSha.slice(0, 12)}`, now);
  }

  function safeBranchName(issue) {
    const number = safeText(issue && issue.number, 20).replace(/[^0-9]/g, "") || "work";
    const slug = safeText(issue && issue.title, 160).toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "issue";
    return `ai/issue-${number}-${slug}`;
  }

  function buildLocalIssueBrief(issueInput) {
    const issue = issueInput && typeof issueInput === "object" ? issueInput : {};
    const title = safeText(issue.title, 240).trim();
    if (!title) throw new Error("Issue cần tiêu đề trước khi lập kế hoạch.");
    const body = redactSecrets(safeText(issue.body, 12000));
    const bullets = body.split(/\r?\n/).map((line) => line.replace(/^[-*\s]+/, "").trim()).filter(Boolean).slice(0, 6);
    return {
      branch: safeBranchName(issue),
      steps: [
        `Xác nhận phạm vi: ${title}`,
        ...(bullets.length ? bullets.map((item) => `Tiêu chí: ${item}`) : ["Bổ sung tiêu chí chấp nhận trước khi sửa code."]),
        "Tạo diff trên nhánh riêng, chạy test trong sandbox và chờ review."
      ].slice(0, 10),
      tests: ["npm test"],
      source: "local-deterministic",
      sourceLabel: "HH Local Planner · deterministic",
      status: "brief-only"
    };
  }

  function validateIssuePlanResult(payload) {
    const raw = payload && typeof payload === "object" ? payload : {};
    const findings = scanSecrets(raw.diff || "");
    const result = stripSensitive(raw);
    if (result.ok !== true || result.status !== "drafted") throw new Error("Backend AI chưa xác nhận bản nháp branch/diff/test.");
    const branch = safeText(result.branch, 160).replace(/[^A-Za-z0-9._\/-]/g, "-").replace(/^[-/.]+|[-/.]+$/g, "");
    const diff = redactSecrets(safeText(result.diff, MAX_DIFF_LENGTH));
    const tests = Array.isArray(result.tests) ? result.tests.map((item) => safeText(item, 100)).filter((item) => SAFE_SANDBOX_COMMANDS.includes(item)).slice(0, 12) : [];
    if (!safeText(result.planId, 120)) throw new Error("Bản nháp thiếu planId đã xác minh.");
    if (!branch || !diff || !/^diff --git /m.test(diff)) throw new Error("Bản nháp phải có branch và unified diff thực tế.");
    if (!tests.length) throw new Error("Bản nháp không có lệnh test sandbox nằm trong allowlist.");
    return {
      planId: safeText(result.planId, 120), branch, diff, tests,
      steps: Array.isArray(result.steps) ? result.steps.map((item) => safeText(item, 300)).filter(Boolean).slice(0, 20) : [],
      source: "server-ai", sourceLabel: safeText(result.sourceLabel || "AI server-side", 120), findings
    };
  }

  function applyIssuePlanResult(stateInput, payload, now) {
    let state = normalizeState(stateInput);
    const plan = validateIssuePlanResult(payload);
    const revision = revisionFor(`${plan.branch}\n${plan.diff}\n${plan.tests.join("\n")}`);
    state.change = {
      status: "drafted", planId: plan.planId, branch: plan.branch, diff: plan.diff,
      tests: plan.tests, steps: plan.steps, source: plan.source, sourceLabel: plan.sourceLabel,
      revision, createdAt: nowIso(now)
    };
    state.checks = defaultState().checks;
    if (plan.findings.length) {
      state.checks.secrets = {
        id: "secrets", status: "failed", summary: `${plan.findings.length} dấu hiệu secret đã bị che khỏi bản nháp.`,
        findings: clone(plan.findings), completedAt: nowIso(now), source: "HH local secret scanner"
      };
    }
    state = revokeApprovals(state, "AI đã tạo revision mới.", now);
    return addAudit(state, "change.plan", plan.findings.length ? "blocked" : "drafted", `${plan.branch} · ${revision}`, now);
  }

  function reviewDiff(diffInput, diagnosticsApi) {
    const diff = safeText(diffInput, MAX_DIFF_LENGTH);
    const findings = [];
    const rules = [
      [/\beval\s*\(/, "critical", "Không dùng eval trong code thay đổi."],
      [/new\s+Function\s*\(/, "critical", "Không tạo hàm động từ chuỗi."],
      [/innerHTML\s*=\s*[^`"']/, "high", "Kiểm tra dữ liệu chưa escape trước khi gán innerHTML."],
      [/\b(?:TODO|FIXME)\b/, "medium", "Diff còn TODO/FIXME cần làm rõ."],
      [/^\+.*console\.(?:log|debug)\s*\(/m, "low", "Xem lại log debug được thêm mới."],
      [/^\+.*\bfetch\s*\(\s*["']http:\/\//m, "high", "Request HTTP không mã hóa được thêm mới."]
    ];
    rules.forEach(([pattern, severity, message], index) => {
      if (pattern.test(diff)) findings.push({ id: `review-${index + 1}`, severity, message });
    });
    if (diagnosticsApi && typeof diagnosticsApi.reviewCode === "function") {
      try {
        const extra = diagnosticsApi.reviewCode(diff);
        const source = Array.isArray(extra) ? extra : extra && Array.isArray(extra.findings) ? extra.findings : [];
        source.slice(0, 20).forEach((item, index) => findings.push({
          id: `diagnostics-${index + 1}`,
          severity: safeText(item.severity || "medium", 20),
          message: safeText(item.message || item.title || item, 300)
        }));
      } catch (_) { /* the built-in review remains available */ }
    }
    const blocking = findings.filter((item) => ["critical", "high"].includes(item.severity));
    return {
      status: blocking.length ? "failed" : "passed",
      summary: blocking.length ? `${blocking.length} vấn đề blocking trong code review.` : `Review hoàn tất; ${findings.length} lưu ý không blocking.`,
      findings, source: diagnosticsApi ? "HHDevDiagnosticsAI + local policy" : "HH local review policy"
    };
  }

  function validateSandboxPlan(commands) {
    const list = Array.isArray(commands) ? commands.map((item) => safeText(item, 100).trim()).filter(Boolean) : [];
    if (!list.length) throw new Error("Chưa có lệnh test sandbox.");
    const forbidden = list.filter((item) => !SAFE_SANDBOX_COMMANDS.includes(item));
    if (forbidden.length) throw new Error("Sandbox từ chối lệnh ngoài allowlist.");
    return list.slice(0, 12);
  }

  function validateCheckResult(payload, checkId) {
    const result = stripSensitive(payload || {});
    if (result.ok !== true || result.status !== "completed") throw new Error(`Backend chưa xác nhận ${checkId} đã hoàn tất.`);
    const conclusion = safeText(result.conclusion, 20);
    if (!['passed', 'failed'].includes(conclusion)) throw new Error(`Kết quả ${checkId} thiếu conclusion rõ ràng.`);
    return {
      id: checkId,
      status: conclusion,
      summary: safeText(result.summary || `${checkId}: ${conclusion}`, 300),
      findings: Array.isArray(result.findings) ? stripSensitive(result.findings).slice(0, 60) : [],
      completedAt: safeText(result.completedAt, 50) || nowIso(),
      source: safeText(result.source || "server sandbox", 100)
    };
  }

  function recordCheck(stateInput, checkId, resultInput, now) {
    if (!CHECK_IDS.includes(checkId)) throw new Error("Check không hợp lệ.");
    let state = normalizeState(stateInput);
    const result = normalizeCheck({ ...resultInput, completedAt: resultInput.completedAt || nowIso(now) }, checkId);
    state.checks[checkId] = result;
    state = revokeApprovals(state, `Kết quả ${checkId} đã thay đổi.`, now);
    return addAudit(state, `check.${checkId}`, result.status, result.summary, now);
  }

  function runLocalSecretCheck(stateInput, securityApi, now) {
    const state = normalizeState(stateInput);
    let findings = scanSecrets(state.change.diff);
    if (securityApi && typeof securityApi.scanSecrets === "function") {
      try {
        const external = securityApi.scanSecrets(state.change.diff);
        if (Array.isArray(external)) findings = findings.concat(external.map((item, index) => ({
          id: safeText(item.id || `security-${index + 1}`, 100),
          type: safeText(item.type || "secret", 80), severity: safeText(item.severity || "high", 20),
          line: Number(item.line) || 0, preview: redactSecrets(item.preview || item.match || "[REDACTED]")
        }))).filter((item, index, list) => list.findIndex((candidate) => candidate.id === item.id) === index).slice(0, 60);
      } catch (_) { /* built-in scanner remains authoritative */ }
    }
    return recordCheck(state, "secrets", {
      status: findings.length ? "failed" : "passed",
      summary: findings.length ? `${findings.length} dấu hiệu secret; diff đã được che.` : "Không phát hiện secret theo bộ quy tắc cục bộ.",
      findings,
      source: securityApi ? "HHDevDataSecurity" : "HH local secret scanner"
    }, now);
  }

  function allChecksPassed(stateInput) {
    const state = normalizeState(stateInput);
    return CHECK_IDS.every((id) => state.checks[id].status === "passed");
  }

  function approveGate(stateInput, gate, reviewer, phrase, now, targetId) {
    if (!Object.prototype.hasOwnProperty.call(APPROVAL_PHRASES, gate)) throw new Error("Approval gate không hợp lệ.");
    let state = normalizeState(stateInput);
    const cleanReviewer = safeText(reviewer, 100).trim();
    const cleanPhrase = safeText(phrase, 40).trim();
    if (!cleanReviewer) throw new Error("Cần ghi tên người duyệt.");
    if (cleanPhrase !== APPROVAL_PHRASES[gate]) throw new Error(`Nhập chính xác ${APPROVAL_PHRASES[gate]} để xác nhận.`);
    if (gate === "rollback") {
      const target = safeText(targetId || state.delivery.preview.id, 120);
      if (!target || state.delivery.preview.status !== "succeeded") throw new Error("Chưa có preview deployment để rollback.");
      state.approvals.rollback = { gate, approved: true, reviewer: cleanReviewer, phrase: cleanPhrase, revision: state.change.revision, targetId: target, approvedAt: nowIso(now) };
    } else {
      if (!state.change.revision || !allChecksPassed(state)) throw new Error("Bốn kiểm tra bắt buộc phải pass trên revision hiện tại.");
      state.approvals[gate] = { gate, approved: true, reviewer: cleanReviewer, phrase: cleanPhrase, revision: state.change.revision, targetId: "", approvedAt: nowIso(now) };
    }
    return addAudit(state, `approval.${gate}`, "approved", `${cleanReviewer} đã duyệt thủ công ${gate}.`, now);
  }

  function canPerform(stateInput, action) {
    const state = normalizeState(stateInput);
    const reasons = [];
    if (!state.provider.connected) reasons.push("Phiên GitHub OAuth server-side chưa kết nối.");
    if (state.repository.status !== "imported") reasons.push("Repository chưa được nhập từ snapshot đã xác minh.");
    if (!state.change.revision) reasons.push("Chưa có revision branch/diff/test.");
    if (action !== "rollback" && !allChecksPassed(state)) reasons.push("Sandbox, review, dependency scan và secret scan phải pass.");
    if (action === "merge") {
      const approval = state.approvals.merge;
      if (!approval.approved || approval.revision !== state.change.revision) reasons.push("Merge chưa được human approval cho revision hiện tại.");
      if (!state.provider.permissions.includes("pull-requests:write")) reasons.push("Thiếu quyền pull-requests:write giới hạn.");
    }
    if (action === "deploy") {
      const approval = state.approvals.deploy;
      if (!approval.approved || approval.revision !== state.change.revision) reasons.push("Deploy chưa được human approval cho revision hiện tại.");
    }
    if (action === "rollback") {
      const approval = state.approvals.rollback;
      if (state.delivery.preview.status !== "succeeded") reasons.push("Chưa có preview deployment thành công.");
      if (!approval.approved || approval.targetId !== state.delivery.preview.id || approval.revision !== state.change.revision) reasons.push("Rollback chưa được human approval cho đúng deployment.");
    }
    return { allowed: reasons.length === 0, reasons };
  }

  function validateDeliveryResult(payload, action) {
    const result = stripSensitive(payload || {});
    const expectedStatus = action === "merge" ? "merged" : "succeeded";
    if (result.ok !== true || result.status !== expectedStatus) throw new Error(`Backend chưa xác nhận ${action} ${expectedStatus}.`);
    if (!safeText(result.id, 120)) throw new Error(`${action} thiếu operation id.`);
    const url = result.url ? safePreviewUrl(result.url) : "";
    if (result.url && !url) throw new Error(`${action} trả về URL không an toàn.`);
    return { id: safeText(result.id, 120), status: expectedStatus, url, completedAt: safeText(result.completedAt, 50) || nowIso() };
  }

  function recordDelivery(stateInput, action, payload, now) {
    let state = normalizeState(stateInput);
    const readiness = canPerform(state, action);
    if (!readiness.allowed) throw new Error(readiness.reasons.join(" "));
    const result = validateDeliveryResult(payload, action);
    if (action === "merge") {
      state.delivery.mergeStatus = "merged";
      state.delivery.pullRequestId = result.id;
      state.delivery.pullRequestUrl = result.url;
    } else if (action === "deploy") {
      state.delivery.preview = { status: "succeeded", id: result.id, url: result.url, revision: state.change.revision, deployedAt: result.completedAt };
      state.approvals.rollback = emptyApproval("rollback");
    } else {
      state.delivery.rollback = { status: "succeeded", id: result.id, targetId: state.delivery.preview.id, completedAt: result.completedAt };
    }
    return addAudit(state, `delivery.${action}`, result.status, `${action} · ${result.id}`, now);
  }

  function createServerAdapter(options = {}) {
    const fetchImpl = options.fetchImpl || globalScope.fetch;
    const locationObject = options.location || globalScope.location;
    const endpoint = safeText(options.endpoint || "/api/dev/github", 300).replace(/\/+$/, "");
    if (!endpoint.startsWith("/api/")) throw new Error("GitHub adapter phải dùng endpoint cùng-origin dưới /api/.");

    async function request(path, init = {}) {
      if (typeof fetchImpl !== "function") throw new Error("Trình duyệt không hỗ trợ fetch; adapter không khả dụng.");
      const response = await fetchImpl(`${endpoint}${path}`, {
        method: init.method || "GET",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-HH-Requested-With": "dev-workflow", ...(init.headers || {}) },
        body: init.body === undefined ? undefined : JSON.stringify(stripSensitive(init.body))
      });
      let data = {};
      try { data = await response.json(); } catch (_) { data = {}; }
      if (!response.ok) throw new Error(safeText(data.message || data.error || `GitHub adapter HTTP ${response.status}.`, 300));
      return stripSensitive(data);
    }

    return Object.freeze({
      kind: "server-side-github-oauth",
      permissions: [...ALLOWED_PERMISSIONS],
      status: () => request("/status"),
      beginOAuth(returnTo) {
        if (!locationObject || typeof locationObject.assign !== "function") throw new Error("Không thể mở OAuth trong môi trường này.");
        const returnPath = safeText(returnTo || locationObject.pathname + locationObject.hash, 500);
        locationObject.assign(`${endpoint}/connect?returnTo=${encodeURIComponent(returnPath)}`);
        return { status: "redirecting" };
      },
      importRepository(repositoryUrl) {
        const parsed = normalizeGitHubRepositoryUrl(repositoryUrl);
        if (!parsed.valid) return Promise.reject(new Error(parsed.error));
        return request("/repository/import", { method: "POST", body: { repositoryUrl: parsed.value } });
      },
      planIssue(context) {
        return request("/issue/plan", { method: "POST", body: {
          snapshotId: safeText(context.snapshotId, 120), baseSha: safeText(context.baseSha, 100), issue: stripSensitive(context.issue)
        } });
      },
      runSandbox(context) {
        return request("/sandbox/run", { method: "POST", body: {
          snapshotId: safeText(context.snapshotId, 120), planId: safeText(context.planId, 120), revision: safeText(context.revision, 100), commands: validateSandboxPlan(context.commands)
        } });
      },
      scanDependencies(context) {
        return request("/scan/dependencies", { method: "POST", body: {
          snapshotId: safeText(context.snapshotId, 120), planId: safeText(context.planId, 120), revision: safeText(context.revision, 100)
        } });
      },
      merge(context) { return request("/merge", { method: "POST", body: stripSensitive(context) }); },
      deployPreview(context) { return request("/deploy/preview", { method: "POST", body: stripSensitive(context) }); },
      rollback(context) { return request("/deploy/rollback", { method: "POST", body: stripSensitive(context) }); }
    });
  }

  function statusLabel(status) {
    return ({
      unknown: "Chưa kiểm tra", checking: "Đang kiểm tra", unconfigured: "Chưa cấu hình",
      disconnected: "Chờ OAuth", connected: "Đã kết nối", unsupported: "Không hỗ trợ",
      error: "Có lỗi", idle: "Chưa chạy", running: "Đang chạy", passed: "Đạt",
      failed: "Không đạt", blocked: "Đang khóa", drafted: "Bản nháp", imported: "Đã nhập",
      succeeded: "Thành công", merged: "Đã merge"
    })[status] || safeText(status || "Không rõ", 40);
  }

  function checkCard(check) {
    const labels = { sandbox: "Sandbox test", review: "Code review", dependency: "Dependency scan", secrets: "Secret scan" };
    return `<article class="hdw-check is-${escapeHtml(check.status)}">
      <header><span aria-hidden="true">${({ sandbox: "SB", review: "RV", dependency: "DP", secrets: "SC" })[check.id]}</span><div><h4>${labels[check.id]}</h4><small>${escapeHtml(check.source || "Chưa có nguồn")}</small></div><b>${statusLabel(check.status)}</b></header>
      <p>${escapeHtml(check.summary)}</p>
      ${check.findings.length ? `<details><summary>${check.findings.length} phát hiện</summary><ul>${check.findings.slice(0, 8).map((item) => `<li><b>${escapeHtml(item.severity || item.type || "info")}</b> ${escapeHtml(item.message || item.preview || item.type || "Phát hiện")}</li>`).join("")}</ul></details>` : ""}
    </article>`;
  }

  function approvalCard(state, gate) {
    const approval = state.approvals[gate];
    const phrase = APPROVAL_PHRASES[gate];
    const title = ({ merge: "Merge pull request", deploy: "Deploy preview", rollback: "Rollback preview" })[gate];
    const ready = gate === "rollback" ? state.delivery.preview.status === "succeeded" : allChecksPassed(state);
    return `<article class="hdw-approval ${approval.approved ? "is-approved" : ""}">
      <header><div><small>HUMAN GATE</small><h4>${title}</h4></div><b>${approval.approved ? "ĐÃ DUYỆT" : "ĐANG KHÓA"}</b></header>
      <p>${approval.approved ? `${escapeHtml(approval.reviewer)} · ${escapeHtml(approval.approvedAt)}` : ready ? `Nhập ${escapeHtml(phrase)} để duyệt đúng revision.` : "Chưa đủ điều kiện để phê duyệt."}</p>
      <label><span>Người duyệt</span><input type="text" data-hdw-reviewer="${gate}" autocomplete="name" maxlength="100" value="${escapeHtml(approval.reviewer)}"></label>
      <label><span>Cụm xác nhận</span><input type="text" data-hdw-phrase="${gate}" autocomplete="off" maxlength="40" placeholder="${escapeHtml(phrase)}"></label>
      <button type="button" data-hdw-action="approve-${gate}" ${ready && !approval.approved ? "" : "disabled"}>Phê duyệt thủ công</button>
    </article>`;
  }

  function workflowMarkup(state) {
    const provider = state.provider;
    const repoReady = state.repository.status === "imported";
    const changeReady = Boolean(state.change.revision);
    const mergeReady = canPerform(state, "merge");
    const deployReady = canPerform(state, "deploy");
    const rollbackReady = canPerform(state, "rollback");
    const stages = [
      ["Repo", repoReady], ["Issue → diff", changeReady], ["4 checks", allChecksPassed(state)],
      ["Deploy", state.delivery.preview.status === "succeeded"], ["Merge", state.delivery.mergeStatus === "merged"]
    ];
    return `<main class="hdw" data-hdw-root>
      <header class="hdw-hero">
        <div><small>HH DEV · DELIVERY WORKFLOW</small><h2>Từ GitHub issue đến preview có kiểm soát.</h2><p>OAuth ở server, test trong sandbox, scan trước delivery và human approval bắt buộc cho merge/deploy.</p></div>
        <aside class="hdw-provider is-${escapeHtml(provider.status)}" aria-label="Trạng thái GitHub adapter">
          <span><i></i>${statusLabel(provider.status)}</span><strong>GitHub server-side</strong><small>${escapeHtml(provider.message)}</small>
          <div><button type="button" data-hdw-action="check-provider">Kiểm tra adapter</button><button type="button" data-hdw-action="oauth" ${provider.configured && !provider.connected ? "" : "disabled"}>Kết nối OAuth</button></div>
        </aside>
      </header>

      <ol class="hdw-stage" aria-label="Tiến độ workflow">${stages.map(([label, done], index) => `<li class="${done ? "is-done" : ""}"><span>${index + 1}</span><b>${label}</b></li>`).join("")}</ol>

      <section class="hdw-boundary" aria-labelledby="hdw-boundary-title">
        <div><small>SECURITY BOUNDARY</small><h3 id="hdw-boundary-title">Quyền tối thiểu, không token ở client</h3><p>Frontend chỉ dùng cookie phiên cùng-origin. Client secret, access token và refresh token không được nhập, xuất hoặc lưu localStorage.</p></div>
        <ul>${ALLOWED_PERMISSIONS.map((permission) => `<li class="${provider.permissions.includes(permission) ? "is-granted" : ""}">${escapeHtml(permission)}</li>`).join("")}</ul>
      </section>

      <div class="hdw-layout">
        <section class="hdw-panel hdw-source" aria-labelledby="hdw-source-title">
          <header><div><small>01 · SOURCE</small><h3 id="hdw-source-title">Repository & issue</h3></div><b>${statusLabel(state.repository.status)}</b></header>
          <label><span>URL repository GitHub</span><input type="url" data-hdw-repo-url placeholder="https://github.com/owner/repository" value="${escapeHtml(state.repository.url)}"></label>
          <button type="button" data-hdw-action="import-repository" ${provider.connected ? "" : "disabled"}>Nhập snapshot qua server</button>
          ${repoReady ? `<dl><div><dt>Repository</dt><dd>${escapeHtml(`${state.repository.owner}/${state.repository.name}`)}</dd></div><div><dt>Base</dt><dd><code>${escapeHtml(state.repository.baseSha.slice(0, 12))}</code></dd></div><div><dt>Snapshot</dt><dd><code>${escapeHtml(state.repository.snapshotId)}</code></dd></div></dl>` : `<p class="hdw-note">Không clone bằng token ở trình duyệt. Backend phải trả snapshotId và base SHA rõ ràng.</p>`}
          <fieldset ${repoReady ? "" : "disabled"}><legend>GitHub issue</legend>
            <div class="hdw-inline"><label><span>Số issue</span><input type="text" inputmode="numeric" data-hdw-issue="number" value="${escapeHtml(state.issue.number)}"></label><label><span>Tiêu đề</span><input type="text" data-hdw-issue="title" maxlength="240" value="${escapeHtml(state.issue.title)}"></label></div>
            <label><span>Mô tả / acceptance criteria</span><textarea data-hdw-issue="body" rows="6">${escapeHtml(state.issue.body)}</textarea></label>
            <div class="hdw-actions"><button type="button" data-hdw-action="local-brief">Lập brief local</button><button type="button" data-hdw-action="plan-issue">AI server tạo branch/diff/test</button></div>
          </fieldset>
        </section>

        <section class="hdw-panel hdw-change" aria-labelledby="hdw-change-title">
          <header><div><small>02 · CHANGESET</small><h3 id="hdw-change-title">Branch, diff & test plan</h3></div><b>${statusLabel(state.change.status)}</b></header>
          ${changeReady ? `<dl><div><dt>Branch</dt><dd><code>${escapeHtml(state.change.branch)}</code></dd></div><div><dt>Revision</dt><dd><code>${escapeHtml(state.change.revision)}</code></dd></div><div><dt>Nguồn</dt><dd>${escapeHtml(state.change.sourceLabel)}</dd></div></dl>
            <details open><summary>Unified diff · ${state.change.diff.split("\n").length} dòng</summary><pre tabindex="0">${escapeHtml(state.change.diff)}</pre></details>
            <div class="hdw-test-plan"><strong>Lệnh sandbox allowlist</strong><ul>${state.change.tests.map((item) => `<li><code>${escapeHtml(item)}</code></li>`).join("")}</ul></div>
          ` : state.change.steps.length ? `<div class="hdw-brief"><strong>${escapeHtml(state.change.sourceLabel)}</strong><ol>${state.change.steps.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol><p>Brief local không phải code diff và không mở gate delivery.</p></div>` : `<div class="hdw-empty"><span>DIFF</span><strong>Chưa có changeset đã xác minh</strong><p>AI server phải trả unified diff thật và test command trong allowlist.</p></div>`}
        </section>
      </div>

      <section class="hdw-panel hdw-checks" aria-labelledby="hdw-checks-title">
        <header><div><small>03 · VERIFY</small><h3 id="hdw-checks-title">Bốn kiểm tra bắt buộc</h3></div><div class="hdw-actions"><button type="button" data-hdw-action="run-sandbox" ${changeReady ? "" : "disabled"}>Chạy sandbox</button><button type="button" data-hdw-action="run-review" ${changeReady ? "" : "disabled"}>Review code</button><button type="button" data-hdw-action="run-scans" ${changeReady ? "" : "disabled"}>Quét dependency + secret</button></div></header>
        <div class="hdw-check-grid">${CHECK_IDS.map((id) => checkCard(state.checks[id])).join("")}</div>
      </section>

      <section class="hdw-panel hdw-gates" aria-labelledby="hdw-gates-title">
        <header><div><small>04 · APPROVAL</small><h3 id="hdw-gates-title">Human approval không thể bỏ qua</h3></div><p>Mỗi approval gắn với revision hiện tại và tự mất hiệu lực khi check/diff thay đổi.</p></header>
        <div>${approvalCard(state, "deploy")}${approvalCard(state, "merge")}${approvalCard(state, "rollback")}</div>
      </section>

      <section class="hdw-panel hdw-delivery" aria-labelledby="hdw-delivery-title">
        <header><div><small>05 · DELIVERY</small><h3 id="hdw-delivery-title">Preview, merge & rollback</h3></div><b>Không auto-deploy</b></header>
        <div class="hdw-delivery-grid">
          <article><span>PV</span><div><strong>Preview deployment</strong><small>${escapeHtml(state.delivery.preview.id || statusLabel(state.delivery.preview.status))}</small>${state.delivery.preview.url ? `<a href="${escapeHtml(state.delivery.preview.url)}" target="_blank" rel="noopener noreferrer">Mở preview</a>` : ""}</div><button type="button" data-hdw-action="deploy" ${deployReady.allowed ? "" : "disabled"}>Deploy preview</button></article>
          <article><span>PR</span><div><strong>Merge pull request</strong><small>${escapeHtml(state.delivery.pullRequestId || statusLabel(state.delivery.mergeStatus))}</small>${state.delivery.pullRequestUrl ? `<a href="${escapeHtml(state.delivery.pullRequestUrl)}" target="_blank" rel="noopener noreferrer">Mở pull request</a>` : ""}</div><button type="button" data-hdw-action="merge" ${mergeReady.allowed ? "" : "disabled"}>Merge đã duyệt</button></article>
          <article><span>RB</span><div><strong>Rollback deployment</strong><small>${escapeHtml(state.delivery.rollback.id || statusLabel(state.delivery.rollback.status))}</small></div><button type="button" data-hdw-action="rollback" ${rollbackReady.allowed ? "" : "disabled"}>Rollback đã duyệt</button></article>
        </div>
        <details class="hdw-blockers"><summary>Điều kiện gate hiện tại</summary><div><p><b>Deploy:</b> ${escapeHtml(deployReady.allowed ? "Sẵn sàng" : deployReady.reasons.join(" "))}</p><p><b>Merge:</b> ${escapeHtml(mergeReady.allowed ? "Sẵn sàng" : mergeReady.reasons.join(" "))}</p><p><b>Rollback:</b> ${escapeHtml(rollbackReady.allowed ? "Sẵn sàng" : rollbackReady.reasons.join(" "))}</p></div></details>
      </section>

      <section class="hdw-panel hdw-audit" aria-labelledby="hdw-audit-title">
        <header><div><small>LOCAL AUDIT</small><h3 id="hdw-audit-title">Nhật ký quyết định</h3></div><b>${state.audit.length} mục</b></header>
        ${state.audit.length ? `<ol>${state.audit.slice().reverse().slice(0, 20).map((entry) => `<li><time>${escapeHtml(entry.at)}</time><span class="is-${escapeHtml(entry.status)}">${escapeHtml(entry.type)}</span><p>${escapeHtml(entry.message)}</p></li>`).join("")}</ol>` : `<p class="hdw-note">Chưa có hành động. Audit chỉ lưu metadata đã loại bỏ credential.</p>`}
      </section>

      <footer class="hdw-footer"><span><i></i>Local-first metadata</span><code>${STORAGE_KEY}</code><span data-hdw-live role="status" aria-live="polite">Sẵn sàng</span></footer>
    </main>`;
  }

  function mount(root, options = {}) {
    if (!root) return false;
    if (instances.has(root)) instances.get(root).destroy();
    const store = options.store || createStore(Object.prototype.hasOwnProperty.call(options, "storage") ? options.storage : undefined);
    const adapter = options.adapter || createServerAdapter({ endpoint: options.endpoint, fetchImpl: options.fetchImpl, location: options.location });
    const diagnosticsApi = options.diagnosticsApi || globalScope.HHDevDiagnosticsAI;
    const securityApi = options.securityApi || globalScope.HHDevDataSecurity;
    const now = options.now;
    let state = normalizeState(options.state || store.load());
    let busy = false;
    let destroyed = false;

    function persist() {
      state = store.save(state);
      return state;
    }

    function render(message) {
      if (destroyed) return;
      root.innerHTML = workflowMarkup(state);
      if (message) {
        const live = root.querySelector("[data-hdw-live]");
        if (live) live.textContent = safeText(message, 300);
      }
    }

    function setIssueField(name, value) {
      if (!Object.prototype.hasOwnProperty.call(state.issue, name)) return;
      state.issue[name] = name === "body" ? redactSecrets(safeText(value, 12000)) : safeText(value, name === "title" ? 240 : 500);
      state.change = defaultState().change;
      state.checks = defaultState().checks;
      state = revokeApprovals(state, "Issue đã thay đổi.", now);
      persist();
    }

    async function perform(action, worker) {
      if (busy) return;
      busy = true;
      render(`${action}: đang xử lý…`);
      try {
        await worker();
        persist();
        render(`${action}: hoàn tất.`);
      } catch (error) {
        state = addAudit(state, `ui.${action}`, "error", error.message || "Thao tác thất bại.", now);
        persist();
        render(`${action}: ${safeText(error.message || "thất bại", 240)}`);
      } finally {
        busy = false;
      }
    }

    async function onClick(event) {
      const button = event.target.closest("[data-hdw-action]");
      if (!button || button.disabled) return;
      const action = button.dataset.hdwAction;
      if (action === "check-provider") return perform("Kiểm tra adapter", async () => {
        state.provider.status = "checking"; render("Đang kiểm tra adapter server-side…");
        const result = await adapter.status();
        state = applyProviderStatus(state, result, now);
      });
      if (action === "oauth") {
        try { adapter.beginOAuth(options.returnTo || "/#/dev-tools/delivery-workflow"); }
        catch (error) { state = addAudit(state, "provider.oauth", "error", error.message, now); persist(); render(error.message); }
        return;
      }
      if (action === "import-repository") return perform("Nhập repository", async () => {
        if (!state.provider.connected || !state.provider.permissions.includes("repository:read")) throw new Error("Cần phiên OAuth với quyền repository:read.");
        const result = await adapter.importRepository(state.repository.url);
        state = applyRepositoryResult(state, result, now);
      });
      if (action === "local-brief") {
        try {
          const brief = buildLocalIssueBrief(state.issue);
          state.change = { ...defaultState().change, status: "blocked", branch: brief.branch, tests: brief.tests, steps: brief.steps, source: brief.source, sourceLabel: brief.sourceLabel };
          state = revokeApprovals(state, "Brief issue đã thay đổi.", now);
          state = addAudit(state, "issue.brief", "blocked", "Đã lập brief local; chưa có code diff thực tế.", now);
          persist(); render("Brief deterministic đã tạo; delivery vẫn khóa.");
        } catch (error) { render(error.message); }
        return;
      }
      if (action === "plan-issue") return perform("AI lập changeset", async () => {
        if (!state.provider.connected || state.repository.status !== "imported") throw new Error("Cần repository snapshot và OAuth server-side.");
        const result = await adapter.planIssue({ snapshotId: state.repository.snapshotId, baseSha: state.repository.baseSha, issue: state.issue });
        state = applyIssuePlanResult(state, result, now);
      });
      if (action === "run-sandbox") return perform("Sandbox", async () => {
        const commands = validateSandboxPlan(state.change.tests);
        const result = await adapter.runSandbox({ snapshotId: state.repository.snapshotId, planId: state.change.planId, revision: state.change.revision, commands });
        state = recordCheck(state, "sandbox", validateCheckResult(result, "sandbox"), now);
      });
      if (action === "run-review") {
        const result = reviewDiff(state.change.diff, diagnosticsApi);
        state = recordCheck(state, "review", result, now); persist(); render(result.summary); return;
      }
      if (action === "run-scans") return perform("Security scans", async () => {
        state = runLocalSecretCheck(state, securityApi, now);
        const result = await adapter.scanDependencies({ snapshotId: state.repository.snapshotId, planId: state.change.planId, revision: state.change.revision });
        state = recordCheck(state, "dependency", validateCheckResult(result, "dependency"), now);
      });
      if (action.startsWith("approve-")) {
        const gate = action.slice(8);
        const reviewer = root.querySelector(`[data-hdw-reviewer="${gate}"]`)?.value || "";
        const phrase = root.querySelector(`[data-hdw-phrase="${gate}"]`)?.value || "";
        try { state = approveGate(state, gate, reviewer, phrase, now); persist(); render(`${gate}: đã ghi human approval.`); }
        catch (error) { render(error.message); }
        return;
      }
      if (["merge", "deploy", "rollback"].includes(action)) return perform(action, async () => {
        const readiness = canPerform(state, action);
        if (!readiness.allowed) throw new Error(readiness.reasons.join(" "));
        const approval = state.approvals[action];
        const context = {
          snapshotId: state.repository.snapshotId, planId: state.change.planId, revision: state.change.revision,
          approval: { reviewer: approval.reviewer, approvedAt: approval.approvedAt, revision: approval.revision, targetId: approval.targetId }
        };
        const result = action === "merge" ? await adapter.merge(context) : action === "deploy" ? await adapter.deployPreview(context) : await adapter.rollback(context);
        state = recordDelivery(state, action, result, now);
      });
    }

    function onInput(event) {
      if (event.target.matches("[data-hdw-repo-url]")) {
        const parsed = normalizeGitHubRepositoryUrl(event.target.value);
        state.repository.url = parsed.valid ? parsed.value : safeText(event.target.value, 500);
        state.repository.status = "idle";
        state = revokeApprovals(state, "Repository URL đã thay đổi.", now);
        persist();
      }
      if (event.target.matches("[data-hdw-issue]")) setIssueField(event.target.dataset.hdwIssue, event.target.value);
    }

    root.addEventListener("click", onClick);
    root.addEventListener("input", onInput);
    render();
    const controller = {
      getState: () => clone(state),
      setState(value) { state = normalizeState(value); persist(); render(); return clone(state); },
      render,
      destroy() {
        if (destroyed) return;
        destroyed = true;
        root.removeEventListener("click", onClick);
        root.removeEventListener("input", onInput);
        root.replaceChildren();
        instances.delete(root);
      }
    };
    instances.set(root, controller);
    return controller;
  }

  function unmount(root) {
    const controller = instances.get(root);
    if (!controller) return false;
    controller.destroy();
    return true;
  }

  const api = Object.freeze({
    VERSION, SCHEMA, STORAGE_KEY, TOOL_IDS, ALLOWED_PERMISSIONS, SAFE_SANDBOX_COMMANDS, CHECK_IDS, APPROVAL_PHRASES,
    safeText, escapeHtml, redactSecrets, stripSensitive, scanSecrets, normalizeGitHubRepositoryUrl, safePreviewUrl,
    defaultState, normalizeState, stateForStorage, serializeState, createStore, addAudit, revokeApprovals,
    revisionFor, applyProviderStatus, validateRepositoryResult, applyRepositoryResult, safeBranchName, buildLocalIssueBrief,
    validateIssuePlanResult, applyIssuePlanResult, reviewDiff, validateSandboxPlan, validateCheckResult, recordCheck,
    runLocalSecretCheck, allChecksPassed, approveGate, canPerform, validateDeliveryResult, recordDelivery,
    createServerAdapter, workflowMarkup, mount, unmount
  });

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  globalScope.HHDevDeliveryWorkflow = api;
}(typeof globalThis !== "undefined" ? globalThis : this));
