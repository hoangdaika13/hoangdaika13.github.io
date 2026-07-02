const $ = (selector) => document.querySelector(selector);
const byId = (id) => document.getElementById(id);

const canvas = $(".ambient-canvas");
const context = canvas?.getContext("2d");
const scrollMeter = $(".scroll-meter");
const themeToggle = $(".theme-toggle");
const colors = ["#ff4f9a", "#ffd84d", "#27d98b", "#29c7ff", "#3f63ff", "#ff7a59"];
let particles = [];

function resizeCanvas() {
  if (!canvas || !context) return;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.floor(window.innerWidth * ratio);
  canvas.height = Math.floor(window.innerHeight * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  particles = Array.from({ length: Math.min(80, Math.floor(window.innerWidth / 16)) }, () => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    radius: 2 + Math.random() * 5,
    speed: 0.18 + Math.random() * 0.55,
    drift: -0.25 + Math.random() * 0.5,
    color: colors[Math.floor(Math.random() * colors.length)]
  }));
}

function drawParticles() {
  if (!canvas || !context) return;
  context.clearRect(0, 0, window.innerWidth, window.innerHeight);
  for (const particle of particles) {
    particle.y += particle.speed;
    particle.x += particle.drift;
    if (particle.y > window.innerHeight + 16) {
      particle.y = -16;
      particle.x = Math.random() * window.innerWidth;
    }
    context.beginPath();
    context.globalAlpha = 0.34;
    context.fillStyle = particle.color;
    context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    context.fill();
  }
  requestAnimationFrame(drawParticles);
}

function updateScrollMeter() {
  if (!scrollMeter) return;
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  const progress = maxScroll > 0 ? window.scrollY / maxScroll : 0;
  scrollMeter.style.width = `${Math.min(progress * 100, 100)}%`;
}

function initReveal() {
  const targets = document.querySelectorAll(".section, .project-card, .quote-band, .tool-app");
  if (!targets.length) return;
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.14 }
  );
  targets.forEach((target) => {
    target.classList.add("reveal");
    observer.observe(target);
  });
}

function initTheme() {
  if (!themeToggle) return;
  const saved = localStorage.getItem("hoangdaika13-theme");
  if (saved === "dark") document.body.classList.add("dark");
  themeToggle.textContent = document.body.classList.contains("dark") ? "Tối" : "Sáng";
  themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    const isDark = document.body.classList.contains("dark");
    themeToggle.textContent = isDark ? "Tối" : "Sáng";
    localStorage.setItem("hoangdaika13-theme", isDark ? "dark" : "light");
  });
}

function valueOf(id) {
  return byId(id)?.value.trim() || "";
}

function setValue(id, value) {
  const el = byId(id);
  if (el) el.value = value;
}

function setText(id, value) {
  const el = byId(id);
  if (el) el.textContent = value;
}

function setStatus(message) {
  setText("toolStatus", message);
}

function words(text) {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter((word) => word.length > 1);
}

function wordCount(text) {
  return words(text).length;
}

function sentences(text) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?。！？])\s+|[\r\n]+/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function topKeywords(text, limit = 12) {
  const stop = new Set("và là của có cho một những các trong với được không khi đã này người để thì vào như từ".split(" "));
  const counts = new Map();
  for (const word of words(text)) {
    if (stop.has(word) || word.length < 3) continue;
    counts.set(word, (counts.get(word) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}

function cleanText(text) {
  return text
    .replace(/\d{1,2}:\d{2}(?::\d{2})?(?:[,.]\d+)?/g, "")
    .replace(/^\s*\d+\s*$/gm, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function config() {
  return {
    projectName: valueOf("projectName") || "Dự án kể chuyện 40+",
    title: valueOf("storyTitle") || "Một câu chuyện đời thường nhiều cảm xúc",
    duration: valueOf("duration") || "8-12 phút",
    audience: valueOf("audience") || "Người xem 40+",
    tone: valueOf("tone") || "Ấm áp, chân thật, giàu cảm xúc",
    mode: valueOf("rewriteMode") || "Kể chuyện 40+ - nhanh và cảm xúc"
  };
}

function buildPrompt() {
  const cfg = config();
  const source = valueOf("sourceText") || "Chưa có nội dung nguồn. Hãy tự xây một câu chuyện mới theo chủ đề.";
  return `Bạn là biên kịch YouTube chuyên viết kịch bản kể chuyện.

Dự án: ${cfg.projectName}
Tiêu đề/chủ đề: ${cfg.title}
Thời lượng mục tiêu: ${cfg.duration}
Người xem: ${cfg.audience}
Tone: ${cfg.tone}
Chế độ viết: ${cfg.mode}

Yêu cầu:
1. Viết thành kịch bản hoàn chỉnh, không viết outline, không viết bảng.
2. Mở đầu có hook mạnh trong 20 giây đầu.
3. Mạch truyện rõ: mở chuyện, xung đột, bí mật, cao trào, giải quyết, bài học.
4. Không dùng timestamp, không ghi chú ngoài lề.
5. Ngôn ngữ tự nhiên, giàu cảm xúc, hợp để đọc voice YouTube.
6. Nếu nguồn ngắn, phát triển chi tiết hợp lý nhưng giữ ý lõi.
7. Kết thúc có dư âm và CTA mềm.

Nội dung nguồn:
${source}`;
}

function buildDraft() {
  const cfg = config();
  const source = valueOf("sourceText") || "Một nhân vật chính từng bị hiểu lầm, nhưng cuối cùng sự thật được hé lộ.";
  return `TIÊU ĐỀ: ${cfg.title}

ĐỊNH HƯỚNG
- Dự án: ${cfg.projectName}
- Người xem: ${cfg.audience}
- Thời lượng: ${cfg.duration}
- Tone: ${cfg.tone}
- Chế độ: ${cfg.mode}

HOOK MỞ ĐẦU
Không phải ai im lặng cũng là người sai. Có những sự thật bị chôn giấu rất lâu, chỉ chờ một ngày bình thường để khiến cả gia đình phải nhìn lại mọi chuyện.

TÓM TẮT NGUỒN
${source}

BẢN NHÁP KỊCH BẢN
Ngày hôm đó bắt đầu như bao ngày khác. Nhưng chỉ một câu nói vô tình đã kéo mọi người trở về với những vết thương tưởng như đã ngủ yên. Nhân vật chính không vội giải thích. Người ấy chỉ lặng lẽ nhìn từng người, như thể đã quen với việc bị hiểu lầm.

Trong quá khứ, có một quyết định rất khó khăn đã được đưa ra. Quyết định ấy khiến nhiều người tổn thương, nhưng phía sau nó lại là một lý do không ai biết. Càng đi sâu vào câu chuyện, người xem càng nhận ra điều đáng sợ nhất không phải là nghèo khó hay mất mát, mà là khi người thân không còn đủ kiên nhẫn để lắng nghe nhau.

Mâu thuẫn tăng lên khi một bằng chứng cũ xuất hiện: một lá thư, một cuộc gọi, một món đồ hoặc một người chứng kiến. Từ đây, những lời trách móc dần đổi thành im lặng. Người từng bị xem là vô tâm hóa ra lại là người âm thầm gánh phần nặng nhất.

CAO TRÀO
Sự thật được nói ra vào đúng lúc không ai còn có thể trốn tránh. Người gây tổn thương phải đối diện với lỗi lầm của mình, còn người chịu đựng cuối cùng cũng được trả lại sự công bằng.

KẾT
Câu chuyện khép lại bằng một bài học nhẹ nhưng sâu: trong gia đình, đôi khi điều cần nhất không phải là thắng trong một cuộc tranh cãi, mà là đủ thương để hỏi: "Ngày đó, bạn đã đau như thế nào?"`;
}

function analyzeText(text) {
  const sents = sentences(text);
  const kws = topKeywords(text);
  const wc = wordCount(text);
  const minutes = Math.max(1, wc / 145);
  return `Số từ: ${wc}
Số câu/đoạn: ${sents.length}
Ước lượng voice: ${minutes.toFixed(1)} phút

Keyword nổi bật:
${kws.map(([word, count]) => `- ${word}: ${count}`).join("\n") || "- Chưa đủ dữ liệu"}

Beat gợi ý:
- Hook: ${sents[0] || "Cần thêm mở đầu mạnh hơn."}
- Xung đột: cần làm rõ nhân vật muốn gì và bị cản bởi điều gì.
- Cao trào: nên có bằng chứng, đối thoại hoặc lựa chọn khó.
- Kết: nên có bài học hoặc dư âm cảm xúc.`;
}

function summarizeText(text) {
  const sents = sentences(text);
  if (!sents.length) return "Chưa có nội dung để tóm tắt.";
  return sents.slice(0, 7).map((sent, index) => `${index + 1}. ${sent}`).join("\n");
}

function compareTexts(source, draft) {
  const left = new Set(words(source));
  const right = new Set(words(draft));
  const shared = [...left].filter((word) => right.has(word)).length;
  const total = new Set([...left, ...right]).size || 1;
  const similarity = Math.round((shared / total) * 100);
  const originality = Math.max(0, 100 - similarity);
  const risk = similarity >= 55 ? "Cao" : similarity >= 32 ? "Vừa" : "Thấp";
  return { similarity, originality, risk };
}

function updateMetas() {
  setText("sourceMeta", `${wordCount(valueOf("sourceText"))} từ`);
  setText("draftMeta", `${wordCount(valueOf("outputText"))} từ`);
}

function setOutput(text, message) {
  setValue("outputText", text);
  setValue("draftText", text);
  setText("geminiOutput", text);
  updateMetas();
  setStatus(message);
}

function showMiniTab(tab) {
  const button = document.querySelector(`.mini-tab[data-mini-tab="${tab}"]`);
  if (button) button.click();
}

function currentProjectPayload() {
  return {
    projectName: valueOf("projectName"),
    storyTitle: valueOf("storyTitle"),
    duration: valueOf("duration"),
    audience: valueOf("audience"),
    tone: valueOf("tone"),
    niche: valueOf("niche"),
    cta: valueOf("cta"),
    mode: valueOf("rewriteMode"),
    source: valueOf("sourceText"),
    output: valueOf("outputText"),
    savedAt: new Date().toISOString()
  };
}

function loadProjectPayload(payload) {
  setValue("projectName", payload.projectName || "");
  setValue("storyTitle", payload.storyTitle || "");
  setValue("duration", payload.duration || "");
  setValue("audience", payload.audience || "");
  setValue("tone", payload.tone || "");
  setValue("niche", payload.niche || "");
  setValue("cta", payload.cta || "");
  setValue("rewriteMode", payload.mode || "");
  setValue("sourceText", payload.source || "");
  setValue("outputText", payload.output || "");
  updateMetas();
}

function downloadText(filename, text, type = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function callGemini() {
  const apiKey = valueOf("apiKey");
  const model = valueOf("modelName") || "gemini-1.5-flash";
  if (!apiKey) {
    setStatus("Bạn cần nhập API key Gemini nếu muốn gọi AI thật.");
    return;
  }
  setStatus("Đang gọi Gemini...");
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt() }] }],
        generationConfig: { temperature: 0.8, topP: 0.95, maxOutputTokens: 4096 }
      })
    });
    if (!response.ok) throw new Error(await response.text());
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text).join("\n") || "";
    setOutput(text || "Gemini không trả về nội dung.", "Gemini đã trả kết quả.");
  } catch (error) {
    console.error(error);
    setStatus("Không gọi được Gemini. Hãy kiểm tra API key, model hoặc mạng/CORS.");
  }
}

function initMiniTabs() {
  document.querySelectorAll(".mini-tab").forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.miniTab;
      document.querySelectorAll(".mini-tab").forEach((item) => item.classList.toggle("active", item === button));
      document.querySelectorAll(".mini-panel").forEach((panel) => panel.classList.toggle("active", panel.id === `mini-${tab}`));
    });
  });
}

function bind(id, event, handler) {
  byId(id)?.addEventListener(event, handler);
}

function initTool() {
  if (!byId("sourceText") && !byId("outputText")) return;

  bind("sourceText", "input", updateMetas);
  bind("outputText", "input", updateMetas);
  bind("scriptFile", "change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setValue("sourceText", await file.text());
    updateMetas();
    setStatus(`Đã nhập file: ${file.name}`);
  });
  bind("pasteSource", "click", async () => {
    try {
      const text = await navigator.clipboard.readText();
      setValue("sourceText", text);
      updateMetas();
      setStatus("Đã dán nội dung từ clipboard.");
    } catch {
      setStatus("Trình duyệt chưa cho phép đọc clipboard. Hãy dán bằng Ctrl+V.");
    }
  });
  bind("cleanSource", "click", () => {
    setValue("sourceText", cleanText(valueOf("sourceText")));
    updateMetas();
    setStatus("Đã làm sạch text/phụ đề.");
  });
  bind("makeDraft", "click", () => setOutput(buildDraft(), "Đã tạo bản nháp local."));
  bind("oneClick", "click", () => {
    const cleaned = cleanText(valueOf("sourceText"));
    setValue("sourceText", cleaned);
    const draft = buildDraft();
    setOutput(draft, "Đã xử lý 1 chạm: làm sạch, phân tích nhanh và tạo bản nháp.");
    setText("analysisOutput", analyzeText(cleaned));
  });
  bind("makePrompt", "click", () => setOutput(buildPrompt(), "Đã tạo prompt."));
  bind("callGemini", "click", callGemini);
  const makeTitleHandler = () => {
    const source = valueOf("sourceText");
    const kw = topKeywords(source, 4).map(([word]) => word).join(" ");
    setValue("storyTitle", kw ? `Sự thật phía sau ${kw}` : "Một bí mật khiến cả gia đình im lặng");
    setStatus("Đã tạo title local.");
  };
  bind("makeTitle", "click", makeTitleHandler);
  bind("makeTitle2", "click", makeTitleHandler);
  bind("copyOutput", "click", async () => {
    const text = valueOf("outputText");
    if (!text) return setStatus("Chưa có nội dung để copy.");
    await navigator.clipboard.writeText(text);
    setStatus("Đã copy kết quả.");
  });
  bind("downloadOutput", "click", () => {
    const text = valueOf("outputText");
    if (!text) return setStatus("Chưa có nội dung để tải.");
    downloadText("kich-ban-ai.txt", text);
    setStatus("Đã tạo file TXT.");
  });
  bind("writerGenerate", "click", () => {
    const draft = buildDraft();
    setOutput(draft, "Gemini Writer: đã tạo bản viết mới local.");
    showMiniTab("writer");
  });
  bind("writerImprove", "click", () => {
    const improved = `${valueOf("outputText") || buildDraft()}\n\nPHIÊN BẢN NÂNG CẤP\n- Tăng hook mở đầu.\n- Thêm đối thoại ở cao trào.\n- Làm rõ bài học cuối câu chuyện.\n- Giảm câu giống nguồn, tăng chi tiết mới.`;
    setOutput(improved, "Đã nâng cấp bản nháp local.");
    showMiniTab("writer");
  });
  bind("writerPrompt", "click", () => {
    setOutput(buildPrompt(), "Đã tạo prompt đầy đủ.");
    showMiniTab("writer");
  });
  bind("analyzeScript", "click", () => {
    setText("analysisOutput", analyzeText(valueOf("sourceText")));
    setStatus("Đã phân tích nguồn.");
  });
  bind("storyScore", "click", () => {
    const draft = valueOf("outputText");
    const score = Math.min(100, 35 + Math.round(wordCount(draft) / 30) + topKeywords(draft, 8).length * 3);
    setText("analysisOutput", `Story score 40+: ${score}/100\n\nGợi ý:\n- Tăng hook mở đầu nếu score dưới 70.\n- Thêm cao trào, đối thoại và plot twist.\n- Kết thúc nên có bài học hoặc CTA mềm.`);
    setStatus(`Story score: ${score}/100`);
  });
  bind("summarizeScript", "click", () => {
    const sourceSummary = summarizeText(valueOf("sourceText"));
    const draftSummary = summarizeText(valueOf("outputText"));
    setText("summaryOutput", `TÓM TẮT NGUỒN\n${sourceSummary}\n\nTÓM TẮT BẢN MỚI\n${draftSummary}`);
    setStatus("Đã tóm tắt.");
    showMiniTab("summary");
  });
  bind("compareScript", "click", () => {
    const report = compareTexts(valueOf("sourceText"), valueOf("outputText"));
    setText("similarityPercent", `${report.similarity}%`);
    setText("originalityPercent", `${report.originality}%`);
    setText("riskLevel", report.risk);
    setText("compareOutput", `Độ giống: ${report.similarity}%\nĐộ mới: ${report.originality}%\nRủi ro: ${report.risk}\n\nKhuyến nghị:\n- Nếu rủi ro cao, đổi cấu trúc cảnh, nhân vật, tình huống và cách mở nút.\n- Giữ ý lõi nhưng thay diễn biến và câu chữ.\n- Tăng chi tiết mới ở phần giữa và cao trào.`);
    setStatus("Đã so sánh độ giống.");
    showMiniTab("compare");
  });
  bind("sendChat", "click", () => {
    const question = valueOf("chatInput");
    if (!question) return setStatus("Chưa có câu hỏi chat.");
    const answer = `Bạn: ${question}\n\nAI local: Dựa trên kịch bản hiện tại, nên tăng xung đột ở phần giữa, thêm một bằng chứng rõ ràng và làm đoạn kết có dư âm hơn.\n\n`;
    setText("chatLog", `${byId("chatLog")?.textContent || ""}${answer}`);
    setValue("chatInput", "");
    setStatus("Chat AI đã trả lời local.");
  });
  bind("clearChat", "click", () => {
    setText("chatLog", "Chat log.");
    setStatus("Đã xóa chat.");
  });
  bind("batchFiles", "change", async (event) => {
    const files = [...(event.target.files || [])];
    const rows = [];
    for (const file of files) {
      const text = await file.text();
      rows.push({ name: file.name, words: wordCount(text), summary: summarizeText(text).slice(0, 220) });
    }
    setText("batchOutput", JSON.stringify(rows, null, 2));
    setStatus(`Đã nạp ${rows.length} file batch.`);
  });
  bind("runBatch", "click", () => {
    const output = byId("batchOutput")?.textContent || "[]";
    setText("batchOutput", `${output}\n\nBatch local đã sẵn sàng. Với GitHub Pages, xử lý AI hàng loạt cần API key Gemini và xác nhận từng lượt gọi.`);
    setStatus("Đã chạy batch local.");
  });
  bind("downloadBatch", "click", () => downloadText("batch-results.json", byId("batchOutput")?.textContent || "[]", "application/json;charset=utf-8"));
  bind("parseUrls", "click", () => {
    const urls = valueOf("urlInput").split(/\s+/).filter(Boolean);
    const prompt = `Hãy đọc và viết lại nội dung từ các URL sau theo cấu hình hiện tại:\n\n${urls.map((url, i) => `${i + 1}. ${url}`).join("\n")}\n\n${buildPrompt()}`;
    setText("urlOutput", prompt);
    setStatus(`Đã tạo prompt cho ${urls.length} URL.`);
  });
  bind("clearUrls", "click", () => {
    setValue("urlInput", "");
    setText("urlOutput", "Chưa có URL.");
    setStatus("Đã xóa URL.");
  });
  bind("translateLocal", "click", () => {
    setValue("sourceTranslation", `[Bản dịch kiểm tra local]\n${valueOf("sourceText")}`);
    setValue("draftTranslation", `[Bản dịch kiểm tra local]\n${valueOf("outputText")}`);
    setStatus("Đã tạo bản dịch kiểm tra local.");
  });
  bind("copyTranslation", "click", async () => {
    await navigator.clipboard.writeText(`${valueOf("sourceTranslation")}\n\n${valueOf("draftTranslation")}`);
    setStatus("Đã copy bản dịch.");
  });
  bind("makePlan", "click", () => {
    const title = valueOf("storyTitle") || "Series kể chuyện 40+";
    setText("plannerOutput", `KẾ HOẠCH SERIES: ${title}\n\nTập 1: Hook bí mật gia đình\nTập 2: Nhân vật chính bị hiểu lầm\nTập 3: Bằng chứng cũ xuất hiện\nTập 4: Cao trào đối mặt\nTập 5: Sự thật và bài học\n\nLịch đăng: 3 video/tuần\nCTA: bình luận trải nghiệm cá nhân ở cuối mỗi tập.`);
    setStatus("Đã tạo kế hoạch nội dung.");
  });
  bind("ideaBank", "click", () => {
    setText("plannerOutput", "KHO Ý TƯỞNG 40+\n- Người mẹ bị con hiểu lầm\n- Di chúc mở ra bí mật cũ\n- Người cha nghèo âm thầm trả nợ cho con\n- Cuộc gọi cuối cùng trước ngày đoàn tụ\n- Hàng xóm giữ bí mật suốt 20 năm");
    setStatus("Đã mở kho ý tưởng.");
  });
  bind("saveProject", "click", () => {
    const payload = currentProjectPayload();
    localStorage.setItem("kich-ban-ai-project", JSON.stringify(payload));
    setText("projectOutput", JSON.stringify(payload, null, 2));
    setStatus("Đã lưu dự án local.");
  });
  bind("loadProject", "click", () => {
    const raw = localStorage.getItem("kich-ban-ai-project");
    if (!raw) return setStatus("Chưa có dự án local.");
    const payload = JSON.parse(raw);
    loadProjectPayload(payload);
    setText("projectOutput", JSON.stringify(payload, null, 2));
    setStatus("Đã mở dự án local.");
  });
  bind("exportProject", "click", () => downloadText("kich-ban-ai-project.json", JSON.stringify(currentProjectPayload(), null, 2), "application/json;charset=utf-8"));
  bind("deleteProject", "click", () => {
    localStorage.removeItem("kich-ban-ai-project");
    setText("projectOutput", "Đã xóa dự án local.");
    setStatus("Đã xóa dự án local.");
  });
  updateMetas();
}

resizeCanvas();
drawParticles();
updateScrollMeter();
initReveal();
initTheme();
initMiniTabs();
initTool();

window.addEventListener("resize", resizeCanvas);
window.addEventListener("scroll", updateScrollMeter, { passive: true });
