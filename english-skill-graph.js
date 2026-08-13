(() => {
  "use strict";

  const root = typeof window !== "undefined" ? window : globalThis;
  const VERSION = "1.0.0";
  const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Number(value) || 0));
  const esc = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const percent = (value) => Math.round(clamp(value));

  // CEFR Companion Volume 2020-inspired learning domains. These are internal
  // progress descriptors, not an official CEFR examination or certificate.
  const domains = Object.freeze([
    { id: "reception", label: "Reception", vi: "Tiếp nhận", icon: "◖", color: "#63e8ff", detail: "Nghe và đọc để hiểu thông tin.", components: ["listening", "reading"] },
    { id: "production", label: "Production", vi: "Tạo lập", icon: "✎", color: "#ff70cf", detail: "Nói và viết để diễn đạt ý của bạn.", components: ["speaking", "writing"] },
    { id: "interaction", label: "Interaction", vi: "Tương tác", icon: "◉", color: "#ffe16b", detail: "Duy trì hội thoại trực tiếp và trực tuyến.", components: ["oral-interaction", "online-interaction"] },
    { id: "mediation", label: "Mediation", vi: "Chuyển đạt", icon: "⇄", color: "#80f4b4", detail: "Tóm tắt, giải thích và nối ý giữa người với người.", components: ["text-mediation", "concept-mediation", "communication-mediation"] },
    { id: "foundation", label: "Language control", vi: "Nền tảng ngôn ngữ", icon: "Aa", color: "#b99aff", detail: "Phát âm, từ vựng, ngữ pháp và mạch lạc.", components: ["pronunciation", "vocabulary", "grammar", "discourse"] }
  ]);

  const componentMeta = Object.freeze({
    listening: { label: "Nghe", domain: "reception", action: "listening", unit: "bài nghe / câu đã hoàn thành", canDo: "Hiểu ý chính và chi tiết của thông tin được nói ở tốc độ phù hợp." },
    reading: { label: "Đọc", domain: "reception", action: "reading", unit: "đoạn đọc / bài đã hoàn thành", canDo: "Tìm thông tin, suy luận và theo dõi văn bản theo cấp độ." },
    speaking: { label: "Nói", domain: "production", action: "speaking", unit: "lượt nói có transcript", canDo: "Diễn đạt một ý rõ ràng và nói lại câu theo tình huống." },
    writing: { label: "Viết", domain: "production", action: "writing", unit: "bài viết đã lưu", canDo: "Viết một văn bản phù hợp mục đích, người đọc và cấp độ." },
    "oral-interaction": { label: "Hội thoại trực tiếp", domain: "interaction", action: "speaking", unit: "roleplay đã lưu", canDo: "Phản hồi, hỏi lại và duy trì lượt nói trong một tình huống." },
    "online-interaction": { label: "Tương tác trực tuyến", domain: "interaction", action: "writing", unit: "bài viết / roleplay", canDo: "Viết phản hồi lịch sự, rõ ràng trong trao đổi trực tuyến." },
    "text-mediation": { label: "Chuyển đạt văn bản", domain: "mediation", action: "writing", unit: "bài tóm tắt", canDo: "Tóm tắt thông tin chính mà không làm sai ý nguồn." },
    "concept-mediation": { label: "Giải thích khái niệm", domain: "mediation", action: "writing", unit: "bài giải thích", canDo: "Giải thích một ý khó bằng ngôn ngữ dễ hiểu hơn." },
    "communication-mediation": { label: "Kết nối giao tiếp", domain: "mediation", action: "speaking", unit: "nhiệm vụ hội thoại", canDo: "Giúp hai phía hiểu nhau và xử lý điểm chưa rõ." },
    pronunciation: { label: "Phát âm", domain: "foundation", action: "speaking", unit: "lượt shadowing", canDo: "Nói rõ các âm trọng tâm và giữ nhịp câu dễ hiểu." },
    vocabulary: { label: "Từ vựng", domain: "foundation", action: "vocabulary", unit: "từ có điểm nhớ", canDo: "Nhận ra và chủ động dùng từ đúng ngữ cảnh." },
    grammar: { label: "Ngữ pháp", domain: "foundation", action: "practice", unit: "bài luyện đúng", canDo: "Chọn và dùng cấu trúc phù hợp ý định giao tiếp." },
    discourse: { label: "Mạch lạc & sắc thái", domain: "foundation", action: "writing", unit: "bài viết / roleplay", canDo: "Liên kết ý và điều chỉnh mức lịch sự theo tình huống." }
  });

  const levelBands = Object.freeze([
    ["A0", 0, "Bắt đầu", "Nhận ra mẫu câu và hoàn thành nhiệm vụ có hướng dẫn."],
    ["A1", 18, "Cơ bản", "Xử lý trao đổi ngắn về chủ đề quen thuộc."],
    ["A2", 34, "Sơ trung cấp", "Hiểu và tạo thông tin thường ngày có cấu trúc."],
    ["B1", 50, "Trung cấp", "Thực hiện nhiệm vụ quen thuộc với mức hỗ trợ vừa phải."],
    ["B2", 66, "Trên trung cấp", "Giải thích, thảo luận và xử lý tài liệu tương đối phức tạp."],
    ["C1", 81, "Nâng cao", "Diễn đạt linh hoạt, có sắc thái trong học tập và công việc."],
    ["C2", 92, "Tinh thông", "Xử lý ngôn ngữ tinh tế, mạch lạc trong hầu hết bối cảnh."]
  ]);

  const levelFor = (score) => {
    let selected = levelBands[0];
    levelBands.forEach((band) => { if (Number(score) >= band[1]) selected = band; });
    return { id: selected[0], name: selected[2], detail: selected[3] };
  };
  const average = (values) => values.length ? values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length : 0;
  const completedLessons = (state, context) => {
    const lessons = Array.isArray(context?.allLessons) ? context.allLessons : [];
    return lessons.filter((lesson) => state?.completed?.[lesson.id]);
  };
  const scorePractice = (state, skill, context) => {
    const levels = context?.levelOrder || [];
    const values = levels.map((level) => Number(state?.practiceByLevel?.[level]?.[skill] || 0)).filter((value) => value > 0);
    if (!values.length && skill === "grammar") values.push(Number(state?.practice?.grammar || 0));
    return average(values);
  };
  const speakingScores = (state) => (Array.isArray(state?.speakingAttempts) ? state.speakingAttempts : []).map((item) => Number(item.score || 0)).filter((value) => value > 0);
  const roleplayScores = (state) => (Array.isArray(state?.speakingRoleplays) ? state.speakingRoleplays : []).map((item) => Number(item.score || 0)).filter((value) => value > 0);
  const listeningEvidence = (state) => {
    const rows = Object.values(state?.galaxy?.listeningProgress || {});
    const completion = rows.map((item) => {
      const done = Array.isArray(item.completedSentences) ? item.completedSentences.length : 0;
      const total = Number(item.totalSentences || 0);
      const attempts = Array.isArray(item.attempts) ? item.attempts.map((entry) => Number(entry.score || 0)) : [];
      return total ? done / total * 100 : average(attempts);
    }).filter((value) => value > 0);
    return { score: average(completion), count: completion.length };
  };
  const readingEvidence = (state) => {
    const rows = Object.values(state?.galaxy?.readingProgress || {});
    const completion = rows.map((item) => Number(item.percent || 0)).filter((value) => value > 0);
    return { score: average(completion), count: completion.length };
  };

  const buildComponent = (id, state, context, lessons) => {
    const meta = componentMeta[id];
    const bySkill = lessons.filter((lesson) => {
      const skill = String(lesson.primarySkill || "").toLowerCase();
      return skill === id || (id === "grammar" && /grammar|usage/.test(skill)) || (id === "vocabulary" && /vocab/.test(skill));
    }).length;
    let score = 0; let evidence = bySkill; const details = [];
    if (id === "listening") { const item = listeningEvidence(state); score = item.count ? item.score : scorePractice(state, "listening", context); evidence += item.count; if (item.count) details.push(`${item.count} bài nghe có tiến độ`); }
    else if (id === "reading") { const item = readingEvidence(state); score = item.count ? item.score : scorePractice(state, "reading", context); evidence += item.count; if (item.count) details.push(`${item.count} bài đọc có tiến độ`); }
    else if (id === "speaking") { const attempts = speakingScores(state); score = attempts.length ? average(attempts) : bySkill ? Math.min(45, bySkill * 15) : 0; evidence += attempts.length; if (attempts.length) details.push(`${attempts.length} lượt transcript`); }
    else if (id === "writing") { const history = Array.isArray(state?.writingHistory) ? state.writingHistory : []; score = history.length ? Math.min(100, average(history.slice(0, 20).map((item) => Math.min(100, Number(item.words || 0) * 2)))) : bySkill ? Math.min(35, bySkill * 12) : 0; evidence += history.length; if (history.length) details.push(`${history.length} bài viết đã lưu`); }
    else if (id === "oral-interaction") { const scores = roleplayScores(state); score = scores.length ? average(scores) : 0; evidence += scores.length; if (scores.length) details.push(`${scores.length} lượt roleplay`); }
    else if (id === "online-interaction") { const scores = [...roleplayScores(state), ...((state?.writingHistory || []).map((item) => Math.min(100, Number(item.words || 0) * 2)))]; score = average(scores); evidence += scores.length; if (scores.length) details.push(`${scores.length} đầu ra tương tác`); }
    else if (/mediation/.test(id)) { const outputs = (state?.writingHistory || []).filter((item) => /summary|tóm|explain|giải thích|mediat/i.test(`${item.prompt || ""} ${item.body || ""}`)); score = outputs.length ? Math.min(100, average(outputs.map((item) => Math.min(100, Number(item.words || 0) * 2)))) : 0; evidence += outputs.length; if (outputs.length) details.push(`${outputs.length} đầu ra chuyển đạt`); }
    else if (id === "pronunciation") { const attempts = speakingScores(state); score = attempts.length ? average(attempts) : bySkill ? Math.min(35, bySkill * 15) : 0; evidence += attempts.length; details.push("Transcript không phải điểm phoneme"); }
    else if (id === "vocabulary") { const mastery = Object.values(state?.wordMastery || {}).map((item) => Number(item.score || 0)).filter((value) => value > 0); score = mastery.length ? average(mastery) : 0; evidence += mastery.length; if (mastery.length) details.push(`${mastery.length} từ đã có điểm nhớ`); }
    else if (id === "grammar") { score = scorePractice(state, "grammar", context); evidence += score > 0 ? 1 : 0; }
    else if (id === "discourse") { const outputs = [...(state?.writingHistory || []), ...(state?.speakingRoleplays || [])]; score = outputs.length ? Math.min(100, outputs.length * 12 + average(outputs.map((item) => Number(item.score || 0))) * .35) : 0; evidence += outputs.length; if (outputs.length) details.push(`${outputs.length} đầu ra được lưu`); }
    const confidence = clamp(evidence * 12, 0, 100);
    const band = levelFor(score);
    return { ...meta, id, score: percent(score), evidence, confidence: percent(confidence), band, details, status: evidence ? (confidence >= 48 ? "Có bằng chứng" : "Cần thêm dữ liệu") : "Chưa có bằng chứng" };
  };

  const buildSkillGraph = (state = {}, context = {}) => {
    const lessons = completedLessons(state, context);
    const components = Object.keys(componentMeta).map((id) => buildComponent(id, state, context, lessons));
    const byId = Object.fromEntries(components.map((item) => [item.id, item]));
    const graphDomains = domains.map((domain) => {
      const parts = domain.components.map((id) => byId[id]);
      const score = average(parts.map((item) => item.score));
      const evidence = parts.reduce((sum, item) => sum + item.evidence, 0);
      const confidence = average(parts.map((item) => item.confidence));
      return { ...domain, score: percent(score), evidence, confidence: percent(confidence), band: levelFor(score), components: parts };
    });
    const weakest = [...graphDomains].sort((a, b) => a.score - b.score || a.confidence - b.confidence)[0] || graphDomains[0];
    const overall = average(graphDomains.map((item) => item.score));
    return {
      version: VERSION,
      disclaimer: "Skill Graph là bản theo dõi nội bộ dựa trên bằng chứng học đã lưu; không phải chứng chỉ CEFR chính thức.",
      source: { title: "Council of Europe · CEFR Companion Volume 2020", url: "https://www.coe.int/en/web/common-european-framework-reference-languages/cefr-descriptors" },
      overall: { score: percent(overall), band: levelFor(overall), confidence: percent(average(graphDomains.map((item) => item.confidence))), evidence: lessons.length },
      domains: graphDomains,
      components,
      mission: { domain: weakest.id, title: `I can… ${weakest.components[0]?.canDo || weakest.detail}`, action: weakest.components[0]?.action || "dashboard", detail: weakest.confidence < 35 ? "Hãy tạo một đầu ra ngắn để HH có bằng chứng rõ hơn." : `Ưu tiên ${weakest.vi.toLowerCase()} vì đây là vùng đang thấp nhất.` }
    };
  };

  const bar = (value, color) => `<i class="hhesg-meter" style="--p:${percent(value)}%;--meter:${esc(color)}" aria-hidden="true"></i>`;
  const renderView = (state = {}, context = {}) => {
    const graph = buildSkillGraph(state, context);
    const domainCards = graph.domains.map((domain) => `<article class="hhesg-domain" style="--domain:${esc(domain.color)}"><header><span>${esc(domain.icon)}</span><div><small>${esc(domain.label)}</small><h3>${esc(domain.vi)}</h3></div><strong>${domain.score}%</strong></header><p>${esc(domain.detail)}</p>${bar(domain.score, domain.color)}<footer><span>${esc(domain.band.id)} · ${esc(domain.band.name)}</span><small>${domain.evidence} bằng chứng · độ tin cậy ${domain.confidence}%</small></footer><div class="hhesg-components">${domain.components.map((item) => `<button type="button" data-hhe-view="${esc(item.action)}" title="Mở ${esc(item.label)}"><span>${esc(item.label)}</span><b>${item.score}%</b></button>`).join("")}</div></article>`).join("");
    const componentRows = graph.components.map((item) => `<tr><th scope="row">${esc(item.label)}</th><td><strong>${item.score}%</strong>${bar(item.score, domains.find((domain) => domain.id === item.domain)?.color || "#63e8ff")}</td><td>${esc(item.status)}</td><td>${esc(item.details.join(" · ") || item.unit)}</td></tr>`).join("");
    return `<section class="hhesg" data-hhesg-version="${VERSION}"><header class="hhesg-hero"><div><small>HH ENGLISH · CEFR 2020 SKILL GRAPH</small><h2>Tiến bộ theo năng lực sử dụng</h2><p>${esc(graph.disclaimer)}</p><a href="${esc(graph.source.url)}" target="_blank" rel="noopener">Xem khung mô tả CEFR Companion Volume ↗</a></div><aside><span>MỨC TỔNG QUAN NỘI BỘ</span><strong>${esc(graph.overall.band.id)}</strong><b>${graph.overall.score}%</b><small>${graph.overall.evidence} bài học đã hoàn thành · độ tin cậy ${graph.overall.confidence}%</small></aside></header><section class="hhesg-mission"><div><small>WEEKLY CAN-DO MISSION</small><h3>${esc(graph.mission.title)}</h3><p>${esc(graph.mission.detail)}</p></div><button type="button" class="primary" data-hhe-view="${esc(graph.mission.action)}">Bắt đầu nhiệm vụ →</button></section><section class="hhesg-domain-grid" aria-label="Bốn miền năng lực CEFR và nền tảng ngôn ngữ">${domainCards}</section><section class="hhesg-evidence"><header><div><small>EVIDENCE LEDGER</small><h3>Bằng chứng tạo nên điểm số</h3></div><span>Không dùng điểm đoán</span></header><div class="hhesg-table-wrap"><table><thead><tr><th>Năng lực</th><th>Điểm nội bộ</th><th>Trạng thái</th><th>Nguồn dữ liệu</th></tr></thead><tbody>${componentRows}</tbody></table></div></section><footer class="hhesg-footer"><span>Reception · Production · Interaction · Mediation · Language control</span><button type="button" data-hhe-view="progress">← Quay lại Tiến độ</button><button type="button" data-hhe-view="settings">Điều chỉnh mục tiêu</button></footer></section>`;
  };

  const api = { VERSION, domains, componentMeta, levelBands, levelFor, buildSkillGraph, renderView };
  root.HHEnglishSkillGraph = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
