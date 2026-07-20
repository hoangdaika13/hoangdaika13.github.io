(function aiCenterAdvancedFactory(globalScope) {
  "use strict";

  const STORAGE_KEY = "hh-ai-center-advanced-v1";
  const MAX_RUNS = 15;
  const MAX_VERSIONS = 3;
  const MAX_TEMPLATES = 12;
  const MAX_PROMPT_LENGTH = 6000;
  const MAX_OUTPUT_LENGTH = 12000;

  const DEFAULT_TEMPLATES = [
    {
      id: "content-brief",
      name: "Content brief",
      taskType: "creative",
      template: "Lập content brief về {{chủ_đề}} cho {{đối_tượng}}. Mục tiêu: {{mục_tiêu}}. Trình bày insight, thông điệp, cấu trúc và checklist xuất bản."
    },
    {
      id: "deep-analysis",
      name: "Phân tích có kiểm chứng",
      taskType: "analysis",
      template: "Phân tích {{vấn_đề}} trong bối cảnh {{bối_cảnh}}. Tách dữ kiện, giả định, rủi ro, phương án và tiêu chí quyết định. Không bịa dữ liệu chưa được cung cấp."
    },
    {
      id: "code-review",
      name: "Code review",
      taskType: "coding",
      template: "Review đoạn mã hoặc lỗi sau: {{đầu_vào}}. Môi trường: {{môi_trường}}. Ưu tiên bug, bảo mật, hiệu năng và test; đưa bản sửa tối thiểu có thể kiểm chứng."
    },
    {
      id: "research-plan",
      name: "Kế hoạch nghiên cứu",
      taskType: "research",
      template: "Nghiên cứu {{chủ_đề}} để trả lời {{câu_hỏi}}. Nêu phạm vi, từ khóa, nguồn ưu tiên, điểm cần kiểm chứng và cấu trúc báo cáo."
    },
    {
      id: "executive-summary",
      name: "Tóm tắt điều hành",
      taskType: "summarize",
      template: "Tóm tắt nội dung sau cho {{người_đọc}} trong {{độ_dài}}: {{nội_dung}}. Giữ số liệu quan trọng, quyết định, rủi ro và hành động tiếp theo."
    }
  ];

  const TASK_LABELS = {
    auto: "Tự nhận diện",
    creative: "Sáng tạo",
    coding: "Lập trình",
    analysis: "Phân tích",
    research: "Nghiên cứu",
    summarize: "Tóm tắt",
    translate: "Dịch thuật",
    workflow: "Workflow"
  };

  const MODEL_LABELS = {
    auto: "Router tự động",
    "gemini-3.5-flash": "Gemini 3.5 Flash",
    "gemini-3.1-flash-lite": "Gemini 3.1 Flash Lite",
    local: "HH Local"
  };

  const clampText = (value, limit) => String(value == null ? "" : value).slice(0, limit);
  const safeId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const escapeHtml = (value) => String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  function extractVariables(template) {
    const matches = String(template || "").matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g);
    return [...new Set(Array.from(matches, (match) => match[1].trim()).filter(Boolean))].slice(0, 20);
  }

  function fillTemplate(template, values = {}) {
    return clampText(String(template || "").replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (match, name) => {
      const value = clampText(values[String(name).trim()] || "", 1200).trim();
      return value || `[${String(name).trim()}]`;
    }), MAX_PROMPT_LENGTH);
  }

  function inferTaskType(input) {
    const text = String(input || "").toLowerCase();
    if (/code|html|css|javascript|typescript|python|bug|lỗi|api|sql|regex/.test(text)) return "coding";
    if (/nghiên cứu|research|nguồn|dẫn chứng|thị trường|đối thủ/.test(text)) return "research";
    if (/phân tích|so sánh|rủi ro|đánh giá|decision|insight/.test(text)) return "analysis";
    if (/dịch|translate|tiếng anh|english|tiếng việt/.test(text)) return "translate";
    if (/tóm tắt|summary|rút gọn|ý chính/.test(text)) return "summarize";
    if (/workflow|quy trình|pipeline|tự động hóa/.test(text)) return "workflow";
    return "creative";
  }

  function routeModel(taskType, input = "", preference = "auto") {
    if (preference && preference !== "auto") {
      return {
        taskType: taskType === "auto" ? inferTaskType(input) : taskType,
        model: preference,
        reason: preference === "local" ? "Ưu tiên xử lý qua backend local." : "Model do người dùng khóa thủ công."
      };
    }
    const resolvedTask = taskType === "auto" || !TASK_LABELS[taskType] ? inferTaskType(input) : taskType;
    const qualityTasks = new Set(["coding", "analysis", "research", "workflow"]);
    return qualityTasks.has(resolvedTask)
      ? { taskType: resolvedTask, model: "gemini-3.5-flash", reason: "Tác vụ cần suy luận, cấu trúc hoặc kiểm chứng sâu." }
      : { taskType: resolvedTask, model: "gemini-3.1-flash-lite", reason: "Tác vụ ưu tiên phản hồi nhanh và chi phí thấp." };
  }

  function estimateTokens(text) {
    const value = String(text || "").trim();
    if (!value) return 0;
    return Math.max(1, Math.ceil(value.length / 4));
  }

  function normalizeUsage(usage, input, output) {
    const source = usage && typeof usage === "object" ? usage : {};
    const inputTokens = Number(source.promptTokenCount || source.inputTokenCount || source.input_tokens || source.inputTokens || 0) || estimateTokens(input);
    const outputTokens = Number(source.candidatesTokenCount || source.outputTokenCount || source.output_tokens || source.outputTokens || 0) || estimateTokens(output);
    const providerTotal = Number(source.totalTokenCount || source.total_tokens || source.totalTokens || 0);
    const totalTokens = providerTotal || inputTokens + outputTokens;
    return { inputTokens, outputTokens, totalTokens, estimated: typeof source.estimated === "boolean" ? source.estimated : !providerTotal };
  }

  function normalizeVersion(version = {}) {
    const prompt = clampText(version.prompt, MAX_PROMPT_LENGTH);
    const output = clampText(version.output, MAX_OUTPUT_LENGTH);
    return {
      id: clampText(version.id || safeId("version"), 100),
      createdAt: version.createdAt || new Date().toISOString(),
      prompt,
      output,
      model: MODEL_LABELS[version.model] ? version.model : "local",
      provider: clampText(version.provider || "unknown", 80),
      latencyMs: Math.max(0, Math.round(Number(version.latencyMs) || 0)),
      usage: normalizeUsage(version.usage, prompt, output),
      status: ["success", "error", "cancelled"].includes(version.status) ? version.status : "success",
      error: clampText(version.error, 500)
    };
  }

  function normalizeState(raw = {}) {
    const templates = (Array.isArray(raw.templates) ? raw.templates : []).slice(0, MAX_TEMPLATES).map((template) => ({
      id: clampText(template.id || safeId("template"), 100),
      name: clampText(template.name || "Prompt tùy chỉnh", 100),
      taskType: TASK_LABELS[template.taskType] ? template.taskType : "auto",
      template: clampText(template.template, 4000),
      updatedAt: template.updatedAt || new Date().toISOString()
    })).filter((template) => template.template);
    const runs = (Array.isArray(raw.runs) ? raw.runs : []).slice(0, MAX_RUNS).map((run) => ({
      id: clampText(run.id || safeId("run"), 100),
      title: clampText(run.title || "AI run", 120),
      taskType: TASK_LABELS[run.taskType] ? run.taskType : "auto",
      createdAt: run.createdAt || new Date().toISOString(),
      versions: (Array.isArray(run.versions) ? run.versions : []).slice(-MAX_VERSIONS).map(normalizeVersion)
    })).filter((run) => run.versions.length);
    const selectedTemplateId = clampText(raw.selectedTemplateId || DEFAULT_TEMPLATES[0].id, 100);
    const templateValues = {};
    Object.entries(raw.templateValues && typeof raw.templateValues === "object" ? raw.templateValues : {}).slice(0, 30).forEach(([key, values]) => {
      templateValues[clampText(key, 100)] = Object.fromEntries(Object.entries(values && typeof values === "object" ? values : {}).slice(0, 20).map(([name, value]) => [clampText(name, 80), clampText(value, 1200)]));
    });
    return {
      version: 1,
      activeView: ["lab", "workflow", "runs"].includes(raw.activeView) ? raw.activeView : "lab",
      taskType: TASK_LABELS[raw.taskType] ? raw.taskType : "auto",
      modelPreference: MODEL_LABELS[raw.modelPreference] ? raw.modelPreference : "auto",
      selectedTemplateId,
      selectedRunId: runs.some((run) => run.id === raw.selectedRunId) ? raw.selectedRunId : (runs[0]?.id || ""),
      templateValues,
      templates,
      runs,
      workflow: {
        input: clampText(raw.workflow?.input, MAX_PROMPT_LENGTH),
        review: clampText(raw.workflow?.review, MAX_OUTPUT_LENGTH),
        phase: ["input", "ai", "review", "export"].includes(raw.workflow?.phase) ? raw.workflow.phase : "input",
        runId: clampText(raw.workflow?.runId, 100)
      }
    };
  }

  function telemetryFromRuns(runs = []) {
    const versions = runs.flatMap((run) => run.versions || []);
    const completed = versions.filter((version) => version.status === "success");
    const tokenTotal = completed.reduce((sum, version) => sum + Number(version.usage?.totalTokens || 0), 0);
    const latencyTotal = completed.reduce((sum, version) => sum + Number(version.latencyMs || 0), 0);
    return {
      runs: runs.length,
      versions: versions.length,
      success: completed.length,
      tokenTotal,
      averageLatency: completed.length ? Math.round(latencyTotal / completed.length) : 0
    };
  }

  const publicApi = {
    extractVariables,
    fillTemplate,
    inferTaskType,
    routeModel,
    estimateTokens,
    normalizeUsage,
    normalizeState,
    telemetryFromRuns,
    limits: { MAX_RUNS, MAX_VERSIONS, MAX_TEMPLATES, MAX_PROMPT_LENGTH, MAX_OUTPUT_LENGTH }
  };

  if (typeof module === "object" && module.exports) module.exports = publicApi;
  if (!globalScope || typeof document === "undefined") return;

  const storage = globalScope.localStorage;
  const controllers = new WeakMap();

  function readState() {
    try { return normalizeState(JSON.parse(storage.getItem(STORAGE_KEY) || "{}")); }
    catch { return normalizeState(); }
  }

  function writeState(state) {
    const normalized = normalizeState(state);
    try { storage.setItem(STORAGE_KEY, JSON.stringify(normalized)); }
    catch {
      normalized.runs = normalized.runs.slice(0, Math.max(3, Math.floor(MAX_RUNS / 2)));
      try { storage.setItem(STORAGE_KEY, JSON.stringify(normalized)); } catch {}
    }
    return normalized;
  }

  function ensureAnonymousId() {
    let id = storage.getItem("hh-anonymous-id");
    if (!id) {
      id = globalScope.crypto?.randomUUID?.() || safeId("guest");
      storage.setItem("hh-anonymous-id", id);
    }
    return id;
  }

  async function requestAI(input, actionType, meta, signal) {
    const base = String(globalScope.HH_REALTIME_URL || globalScope.location.origin).replace(/\/$/, "");
    const token = storage.getItem("hh-auth-token") || "";
    const response = await fetch(`${base}/api/modules/ai-center/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ input, actionType, meta, anonymousId: ensureAnonymousId() }),
      signal,
      cache: "no-store"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "AI Center chưa phản hồi.");
    return data.action || {};
  }

  function download(filename, content, type = "text/plain;charset=utf-8") {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(String(text || "")); }
    catch {
      const area = document.createElement("textarea");
      area.value = String(text || "");
      document.body.append(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
  }

  function allTemplates(state) {
    return [...DEFAULT_TEMPLATES, ...state.templates];
  }

  function selectedTemplate(state) {
    return allTemplates(state).find((template) => template.id === state.selectedTemplateId) || DEFAULT_TEMPLATES[0];
  }

  function latestVersion(run) {
    return run?.versions?.[run.versions.length - 1] || null;
  }

  function templateOptions(state) {
    return allTemplates(state).map((template) => `<option value="${escapeHtml(template.id)}" ${template.id === state.selectedTemplateId ? "selected" : ""}>${escapeHtml(template.name)}</option>`).join("");
  }

  function taskOptions(selected) {
    return Object.entries(TASK_LABELS).map(([value, label]) => `<option value="${value}" ${value === selected ? "selected" : ""}>${label}</option>`).join("");
  }

  function modelOptions(selected) {
    return Object.entries(MODEL_LABELS).map(([value, label]) => `<option value="${value}" ${value === selected ? "selected" : ""}>${label}</option>`).join("");
  }

  function runHistoryMarkup(state) {
    if (!state.runs.length) return '<div class="aica-empty"><i>RUN</i><strong>Chưa có AI run</strong><span>Kết quả thành công, lỗi và lần retry sẽ xuất hiện ở đây.</span></div>';
    return state.runs.map((run) => {
      const version = latestVersion(run);
      return `<button class="aica-run-card ${run.id === state.selectedRunId ? "is-active" : ""}" type="button" data-aica-select-run="${escapeHtml(run.id)}">
        <span class="aica-run-state is-${escapeHtml(version.status)}"></span>
        <span><strong>${escapeHtml(run.title)}</strong><small>${escapeHtml(TASK_LABELS[run.taskType] || run.taskType)} · ${run.versions.length} phiên bản · ${new Date(version.createdAt).toLocaleString("vi-VN")}</small></span>
        <b>${version.usage.totalTokens.toLocaleString("vi-VN")} tk</b>
      </button>`;
    }).join("");
  }

  function compareMarkup(state) {
    const run = state.runs.find((item) => item.id === state.selectedRunId) || state.runs[0];
    if (!run) return '<div class="aica-empty"><i>V</i><strong>Chưa có phiên bản để so sánh</strong><span>Chạy một prompt hoặc workflow trước.</span></div>';
    const leftIndex = Math.max(0, run.versions.length - 2);
    const rightIndex = run.versions.length - 1;
    const left = run.versions[leftIndex];
    const right = run.versions[rightIndex];
    const options = run.versions.map((version, index) => `<option value="${index}">v${index + 1} · ${MODEL_LABELS[version.model] || version.model}</option>`).join("");
    const card = (side, version, index) => `<article class="aica-compare-card">
      <header><label>${side}<select data-aica-compare-${side === "Bản A" ? "left" : "right"}>${run.versions.map((item, itemIndex) => `<option value="${itemIndex}" ${itemIndex === index ? "selected" : ""}>v${itemIndex + 1} · ${escapeHtml(MODEL_LABELS[item.model] || item.model)}</option>`).join("")}</select></label><span>${version.latencyMs} ms · ${version.usage.totalTokens} token</span></header>
      <pre>${escapeHtml(version.output || version.error || "Không có output")}</pre>
    </article>`;
    return `<div class="aica-compare-head"><div><strong>${escapeHtml(run.title)}</strong><span>So sánh output, model, token và độ trễ giữa các lần chạy.</span></div><span hidden>${options}</span><div><button type="button" data-aica-retry="${escapeHtml(run.id)}">Chạy lại</button><button type="button" data-aica-copy-run="${escapeHtml(run.id)}">Sao chép</button><button type="button" data-aica-export-run="${escapeHtml(run.id)}">Xuất Markdown</button></div></div><div class="aica-compare-grid" data-aica-compare-grid>${card("Bản A", left, leftIndex)}${card("Bản B", right, rightIndex)}</div>`;
  }

  function renderShell(instance) {
    const state = instance.state;
    const template = selectedTemplate(state);
    const variables = extractVariables(template.template);
    const values = state.templateValues[template.id] || {};
    const prompt = fillTemplate(template.template, values);
    const routing = routeModel(state.taskType === "auto" ? template.taskType : state.taskType, prompt, state.modelPreference);
    const telemetry = telemetryFromRuns(state.runs);
    const latestRun = state.runs.find((run) => run.id === state.selectedRunId) || state.runs[0];
    const latest = latestVersion(latestRun);
    const phases = ["input", "ai", "review", "export"];
    const activePhaseIndex = phases.indexOf(state.workflow.phase);
    const phaseLabel = { input: "Input", ai: "AI", review: "Review", export: "Export" };

    instance.shell.innerHTML = `
      <header class="aica-header">
        <div><span class="aica-kicker">ADVANCED RUN LAB</span><h5>Lịch sử, router và workflow có kiểm soát</h5><p>Mọi request đi qua backend hiện có. Output chỉ xuất hiện sau khi endpoint trả về đầy đủ.</p></div>
        <div class="aica-header-actions"><span class="aica-live ${instance.running ? "is-running" : ""}"><i></i>${instance.running ? "Đang chạy" : "Sẵn sàng"}</span><button type="button" data-aica-stop ${instance.running ? "" : "disabled"}>Dừng yêu cầu</button><button type="button" data-aica-collapse>${instance.collapsed ? "Mở Run Lab" : "Thu gọn"}</button></div>
      </header>
      <div class="aica-body" ${instance.collapsed ? "hidden" : ""}>
        <nav class="aica-tabs" aria-label="AI Center nâng cao">${[["lab", "Prompt & Router"], ["workflow", "Workflow"], ["runs", `Run history · ${state.runs.length}`]].map(([id, label]) => `<button type="button" class="${state.activeView === id ? "is-active" : ""}" data-aica-view="${id}">${label}</button>`).join("")}</nav>
        <section class="aica-pane ${state.activeView === "lab" ? "is-active" : ""}" data-aica-pane="lab">
          <div class="aica-lab-grid">
            <section class="aica-card aica-template-card">
              <header><div><span>PROMPT TEMPLATE</span><strong>Biến động theo dữ liệu</strong></div><button type="button" data-aica-save-template>Lưu bản tùy chỉnh</button></header>
              <div class="aica-form-row"><label>Mẫu<select data-aica-template>${templateOptions(state)}</select></label><label>Loại tác vụ<select data-aica-task>${taskOptions(state.taskType)}</select></label></div>
              <label>Nội dung template<textarea data-aica-template-source rows="5">${escapeHtml(template.template)}</textarea></label>
              <div class="aica-variable-grid" data-aica-variables>${variables.length ? variables.map((name) => `<label><span>{{${escapeHtml(name)}}}</span><input data-aica-variable="${escapeHtml(name)}" value="${escapeHtml(values[name] || "")}" placeholder="Nhập ${escapeHtml(name.replace(/_/g, " "))}"></label>`).join("") : '<p>Thêm biến dạng <code>{{tên_biến}}</code> vào template.</p>'}</div>
              <div class="aica-template-actions"><button type="button" data-aica-preview>Áp dụng biến</button><button class="is-primary" type="button" data-aica-run>Chạy AI</button></div>
            </section>
            <section class="aica-card aica-router-card">
              <header><div><span>MODEL ROUTER</span><strong>Tự chọn model theo tác vụ</strong></div><b>${escapeHtml(TASK_LABELS[routing.taskType])}</b></header>
              <label>Chế độ model<select data-aica-model>${modelOptions(state.modelPreference)}</select></label>
              <div class="aica-route-result"><i>AI</i><div><span>Đề xuất</span><strong>${escapeHtml(MODEL_LABELS[routing.model] || routing.model)}</strong><p>${escapeHtml(routing.reason)}</p></div></div>
              <div class="aica-prompt-preview"><span>Prompt sau khi áp dụng biến · ~${estimateTokens(prompt)} token</span><pre data-aica-prompt-preview>${escapeHtml(prompt)}</pre></div>
            </section>
          </div>
          <section class="aica-telemetry">
            <article><span>Runs</span><strong>${telemetry.runs}</strong><i style="--aica-level:${Math.min(100, telemetry.runs * 7)}%"></i></article>
            <article><span>Phiên bản</span><strong>${telemetry.versions}</strong><i style="--aica-level:${Math.min(100, telemetry.versions * 5)}%"></i></article>
            <article><span>Token${latest?.usage?.estimated ? " ước tính" : ""}</span><strong>${telemetry.tokenTotal.toLocaleString("vi-VN")}</strong><i style="--aica-level:${Math.min(100, telemetry.tokenTotal / 80)}%"></i></article>
            <article><span>Độ trễ TB</span><strong>${telemetry.averageLatency ? `${telemetry.averageLatency}ms` : "--"}</strong><i style="--aica-level:${Math.min(100, telemetry.averageLatency / 40)}%"></i></article>
          </section>
          <section class="aica-latest-output"><header><div><span>OUTPUT GẦN NHẤT</span><strong>${escapeHtml(latestRun?.title || "Chưa có kết quả")}</strong></div>${latest ? `<div><button type="button" data-aica-retry="${escapeHtml(latestRun.id)}">Retry</button><button type="button" data-aica-copy-run="${escapeHtml(latestRun.id)}">Copy</button><button type="button" data-aica-export-run="${escapeHtml(latestRun.id)}">Export</button></div>` : ""}</header><pre>${escapeHtml(latest?.output || latest?.error || "Chạy một prompt để nhận output từ backend AI Center.")}</pre></section>
        </section>
        <section class="aica-pane ${state.activeView === "workflow" ? "is-active" : ""}" data-aica-pane="workflow">
          <div class="aica-workflow-rail">${phases.map((phase, index) => `<span class="${index < activePhaseIndex ? "is-done" : index === activePhaseIndex ? "is-active" : ""}"><i>${index + 1}</i><b>${phaseLabel[phase]}</b></span>`).join("")}</div>
          <div class="aica-workflow-grid">
            <section class="aica-card"><header><div><span>01 · INPUT</span><strong>Đầu vào có mục tiêu</strong></div></header><label>Dữ liệu / yêu cầu<textarea rows="10" data-aica-workflow-input placeholder="Dán brief, nội dung hoặc dữ liệu cần xử lý...">${escapeHtml(state.workflow.input)}</textarea></label><button class="is-primary" type="button" data-aica-run-workflow ${instance.running ? "disabled" : ""}>Chạy Input → AI</button></section>
            <section class="aica-card"><header><div><span>02 · AI / 03 · REVIEW</span><strong>Duyệt trước khi xuất</strong></div><span>${state.workflow.phase === "review" ? "Chờ duyệt" : state.workflow.phase === "export" ? "Đã duyệt" : "Chưa có output"}</span></header><label>Bản review<textarea rows="10" data-aica-workflow-review placeholder="Output AI sẽ xuất hiện tại đây để bạn chỉnh sửa...">${escapeHtml(state.workflow.review)}</textarea></label><div class="aica-template-actions"><button type="button" data-aica-approve-review ${state.workflow.review ? "" : "disabled"}>Duyệt bản này</button><button type="button" data-aica-export-workflow ${state.workflow.review ? "" : "disabled"}>Export Markdown</button></div></section>
          </div>
        </section>
        <section class="aica-pane ${state.activeView === "runs" ? "is-active" : ""}" data-aica-pane="runs">
          <div class="aica-runs-layout"><aside><header><span>AI RUN HISTORY</span><button type="button" data-aica-export-history>Xuất JSON</button></header><div class="aica-run-list">${runHistoryMarkup(state)}</div></aside><main>${compareMarkup(state)}</main></div>
        </section>
        <footer class="aica-status" data-aica-status><span>${escapeHtml(instance.status)}</span><small>Local history giới hạn ${MAX_RUNS} run × ${MAX_VERSIONS} phiên bản.</small></footer>
      </div>`;
  }

  function templatePromptFromDom(instance) {
    const template = selectedTemplate(instance.state);
    const source = instance.shell.querySelector("[data-aica-template-source]")?.value || template.template;
    const values = Object.fromEntries(Array.from(instance.shell.querySelectorAll("[data-aica-variable]")).map((input) => [input.dataset.aicaVariable, input.value]));
    instance.state.templateValues[template.id] = values;
    return fillTemplate(source, values);
  }

  function appendVersion(state, runId, runData, version) {
    let run = state.runs.find((item) => item.id === runId);
    if (!run) {
      run = { id: runId || safeId("run"), title: clampText(runData.title || "AI run", 120), taskType: runData.taskType, createdAt: new Date().toISOString(), versions: [] };
      state.runs.unshift(run);
    }
    run.versions = [...run.versions, normalizeVersion(version)].slice(-MAX_VERSIONS);
    state.runs = [run, ...state.runs.filter((item) => item.id !== run.id)].slice(0, MAX_RUNS);
    state.selectedRunId = run.id;
    return run;
  }

  async function runPrompt(instance, options = {}) {
    if (instance.running) return;
    const prompt = clampText(options.prompt || templatePromptFromDom(instance), MAX_PROMPT_LENGTH).trim();
    if (!prompt) {
      instance.status = "Nhập dữ liệu trước khi chạy.";
      renderShell(instance);
      return;
    }
    const state = instance.state;
    const template = selectedTemplate(state);
    const requestedTask = options.taskType || (state.taskType === "auto" ? template.taskType : state.taskType);
    const routing = routeModel(requestedTask, prompt, state.modelPreference);
    const actionType = options.actionType || (routing.taskType === "workflow" ? "workflow" : routing.taskType === "translate" ? "translate" : routing.taskType === "analysis" ? "analysis" : routing.taskType === "research" ? "research" : "chat");
    const runId = options.runId || safeId("run");
    const controller = new AbortController();
    controllers.set(instance.root, controller);
    instance.running = true;
    instance.status = `Đang chạy ${MODEL_LABELS[routing.model] || routing.model} qua backend...`;
    if (options.workflow) {
      state.workflow.phase = "ai";
      state.workflow.input = prompt;
    }
    renderShell(instance);
    const startedAt = performance.now();
    let output = "";
    let action = null;
    let status = "success";
    let errorMessage = "";
    try {
      const backendInput = actionType === "workflow" ? JSON.stringify({
        input: prompt,
        platform: "General",
        language: "Tiếng Việt",
        style: "Chuyên nghiệp",
        steps: ["Phân tích đầu vào", "Tạo bản nháp", "Tự kiểm tra và chuẩn bị review"].map((id) => ({ id, enabled: true }))
      }) : prompt;
      action = await requestAI(backendInput, actionType, {
        model: routing.model,
        mode: "advanced-run-lab",
        taskType: routing.taskType,
        useGoogleSearch: routing.taskType === "research"
      }, controller.signal);
      output = clampText(action.output || "", MAX_OUTPUT_LENGTH);
      if (!output) throw new Error("Backend không trả về output.");
      instance.status = `Hoàn tất bằng ${action.provider || "backend"} · ${action.model || routing.model}.`;
    } catch (error) {
      status = error.name === "AbortError" ? "cancelled" : "error";
      errorMessage = status === "cancelled" ? "Yêu cầu đã được dừng trên thiết bị." : clampText(error.message, 500);
      instance.status = errorMessage;
    } finally {
      const latencyMs = Math.round(performance.now() - startedAt);
      const run = appendVersion(state, runId, { title: options.title || template.name || prompt.slice(0, 64), taskType: routing.taskType }, {
        id: safeId("version"),
        createdAt: new Date().toISOString(),
        prompt,
        output,
        model: routing.model,
        provider: action?.provider || (status === "cancelled" ? "cancelled" : "backend"),
        latencyMs,
        usage: normalizeUsage(action?.usage, prompt, output),
        status,
        error: errorMessage
      });
      if (options.workflow && status === "success") {
        state.workflow.review = output;
        state.workflow.phase = "review";
        state.workflow.runId = run.id;
        state.activeView = "workflow";
      }
      instance.state = writeState(state);
      instance.running = false;
      controllers.delete(instance.root);
      renderShell(instance);
    }
  }

  function rerenderComparison(instance) {
    const run = instance.state.runs.find((item) => item.id === instance.state.selectedRunId) || instance.state.runs[0];
    const target = instance.shell.querySelector("[data-aica-compare-grid]");
    if (!run || !target) return;
    const leftIndex = Math.max(0, Math.min(run.versions.length - 1, Number(instance.shell.querySelector("[data-aica-compare-left]")?.value || 0)));
    const rightIndex = Math.max(0, Math.min(run.versions.length - 1, Number(instance.shell.querySelector("[data-aica-compare-right]")?.value || run.versions.length - 1)));
    const card = (side, version, selectedIndex) => `<article class="aica-compare-card"><header><label>${side}<select data-aica-compare-${side === "Bản A" ? "left" : "right"}>${run.versions.map((item, index) => `<option value="${index}" ${index === selectedIndex ? "selected" : ""}>v${index + 1} · ${escapeHtml(MODEL_LABELS[item.model] || item.model)}</option>`).join("")}</select></label><span>${version.latencyMs} ms · ${version.usage.totalTokens} token</span></header><pre>${escapeHtml(version.output || version.error || "Không có output")}</pre></article>`;
    target.innerHTML = `${card("Bản A", run.versions[leftIndex], leftIndex)}${card("Bản B", run.versions[rightIndex], rightIndex)}`;
  }

  function handleClick(instance, event) {
    const target = event.target;
    if (target.closest("[data-aica-collapse]")) {
      instance.collapsed = !instance.collapsed;
      renderShell(instance);
      return;
    }
    const view = target.closest("[data-aica-view]");
    if (view) {
      instance.state.activeView = view.dataset.aicaView;
      instance.state = writeState(instance.state);
      renderShell(instance);
      return;
    }
    if (target.closest("[data-aica-stop]")) {
      controllers.get(instance.root)?.abort();
      return;
    }
    if (target.closest("[data-aica-preview]")) {
      const preview = instance.shell.querySelector("[data-aica-prompt-preview]");
      if (preview) preview.textContent = templatePromptFromDom(instance);
      instance.state = writeState(instance.state);
      instance.status = "Đã áp dụng biến vào prompt.";
      return;
    }
    if (target.closest("[data-aica-run]")) {
      runPrompt(instance);
      return;
    }
    if (target.closest("[data-aica-save-template]")) {
      const source = clampText(instance.shell.querySelector("[data-aica-template-source]")?.value, 4000).trim();
      if (!source) return;
      const base = selectedTemplate(instance.state);
      const saved = { id: safeId("template"), name: `${base.name} · tùy chỉnh`, taskType: instance.state.taskType, template: source, updatedAt: new Date().toISOString() };
      instance.state.templates = [saved, ...instance.state.templates].slice(0, MAX_TEMPLATES);
      instance.state.selectedTemplateId = saved.id;
      instance.state = writeState(instance.state);
      instance.status = "Đã lưu template tùy chỉnh trên thiết bị.";
      renderShell(instance);
      return;
    }
    const selectedRun = target.closest("[data-aica-select-run]");
    if (selectedRun) {
      instance.state.selectedRunId = selectedRun.dataset.aicaSelectRun;
      instance.state = writeState(instance.state);
      renderShell(instance);
      return;
    }
    const retry = target.closest("[data-aica-retry]");
    if (retry) {
      const run = instance.state.runs.find((item) => item.id === retry.dataset.aicaRetry);
      const version = latestVersion(run);
      if (run && version) runPrompt(instance, { prompt: version.prompt, runId: run.id, taskType: run.taskType, title: run.title });
      return;
    }
    const copy = target.closest("[data-aica-copy-run]");
    if (copy) {
      const run = instance.state.runs.find((item) => item.id === copy.dataset.aicaCopyRun);
      copyText(latestVersion(run)?.output || "");
      instance.status = "Đã sao chép output.";
      return;
    }
    const exportRun = target.closest("[data-aica-export-run]");
    if (exportRun) {
      const run = instance.state.runs.find((item) => item.id === exportRun.dataset.aicaExportRun);
      const version = latestVersion(run);
      if (run && version) download(`hh-ai-${run.id}.md`, `# ${run.title}\n\n## Prompt\n${version.prompt}\n\n## Output\n${version.output || version.error}\n\n---\nModel: ${MODEL_LABELS[version.model] || version.model} · ${version.latencyMs}ms · ${version.usage.totalTokens} token\n`);
      return;
    }
    if (target.closest("[data-aica-export-history]")) {
      download("hh-ai-run-history.json", JSON.stringify({ exportedAt: new Date().toISOString(), runs: instance.state.runs }, null, 2), "application/json;charset=utf-8");
      return;
    }
    if (target.closest("[data-aica-run-workflow]")) {
      const input = clampText(instance.shell.querySelector("[data-aica-workflow-input]")?.value, MAX_PROMPT_LENGTH).trim();
      instance.state.workflow.input = input;
      instance.state = writeState(instance.state);
      runPrompt(instance, { prompt: input, taskType: "workflow", actionType: "workflow", title: "Workflow Input → Review", workflow: true });
      return;
    }
    if (target.closest("[data-aica-approve-review]")) {
      instance.state.workflow.review = clampText(instance.shell.querySelector("[data-aica-workflow-review]")?.value, MAX_OUTPUT_LENGTH);
      instance.state.workflow.phase = "export";
      instance.state = writeState(instance.state);
      instance.status = "Bản review đã được duyệt.";
      renderShell(instance);
      return;
    }
    if (target.closest("[data-aica-export-workflow]")) {
      const review = clampText(instance.shell.querySelector("[data-aica-workflow-review]")?.value, MAX_OUTPUT_LENGTH);
      if (review) download("hh-ai-workflow-output.md", `# HH AI Workflow\n\n${review}`);
    }
  }

  function handleChange(instance, event) {
    const target = event.target;
    if (target.matches("[data-aica-template]")) {
      instance.state.selectedTemplateId = target.value;
      const template = selectedTemplate(instance.state);
      if (instance.state.taskType === "auto") instance.state.taskType = template.taskType;
      instance.state = writeState(instance.state);
      renderShell(instance);
      return;
    }
    if (target.matches("[data-aica-task]")) {
      instance.state.taskType = target.value;
      instance.state = writeState(instance.state);
      renderShell(instance);
      return;
    }
    if (target.matches("[data-aica-model]")) {
      instance.state.modelPreference = target.value;
      instance.state = writeState(instance.state);
      renderShell(instance);
      return;
    }
    if (target.matches("[data-aica-compare-left], [data-aica-compare-right]")) rerenderComparison(instance);
  }

  let inputSaveTimer = 0;
  function handleInput(instance, event) {
    const target = event.target;
    clearTimeout(inputSaveTimer);
    inputSaveTimer = setTimeout(() => {
      if (target.matches("[data-aica-workflow-input]")) instance.state.workflow.input = clampText(target.value, MAX_PROMPT_LENGTH);
      if (target.matches("[data-aica-workflow-review]")) instance.state.workflow.review = clampText(target.value, MAX_OUTPUT_LENGTH);
      if (target.matches("[data-aica-variable]")) {
        const template = selectedTemplate(instance.state);
        instance.state.templateValues[template.id] = instance.state.templateValues[template.id] || {};
        instance.state.templateValues[template.id][target.dataset.aicaVariable] = clampText(target.value, 1200);
      }
      instance.state = writeState(instance.state);
    }, 220);
  }

  function mount(root) {
    if (!root || root.dataset.aiCenterAdvancedMounted === "true") return;
    const toolbar = root.querySelector(".ai-center-toolbar");
    if (!toolbar) return;
    root.dataset.aiCenterAdvancedMounted = "true";
    const shell = document.createElement("section");
    shell.className = "ai-center-advanced";
    shell.dataset.aiCenterAdvanced = "";
    toolbar.insertAdjacentElement("afterend", shell);
    const instance = { root, shell, state: readState(), running: false, collapsed: false, status: "Sẵn sàng chạy qua backend AI Center." };
    shell.addEventListener("click", (event) => handleClick(instance, event));
    shell.addEventListener("change", (event) => handleChange(instance, event));
    shell.addEventListener("input", (event) => handleInput(instance, event));
    renderShell(instance);
  }

  function ensureStyles() {
    if (document.querySelector("link[data-ai-center-advanced-style]")) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.dataset.aiCenterAdvancedStyle = "";
    const source = document.currentScript?.src || document.baseURI;
    link.href = new URL("ai-center-advanced.css", source).href;
    document.head.append(link);
  }

  let mountFrame = 0;
  function mountAll() {
    cancelAnimationFrame(mountFrame);
    mountFrame = requestAnimationFrame(() => document.querySelectorAll("[data-ai-center]").forEach(mount));
  }

  ensureStyles();
  mountAll();
  new MutationObserver(mountAll).observe(document.documentElement, { childList: true, subtree: true });
  globalScope.HHAICenterAdvanced = { ...publicApi, mountAll };
})(typeof window !== "undefined" ? window : null);
