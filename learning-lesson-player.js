(function learningLessonPlayerFactory(globalScope) {
  "use strict";

  const VIEWS = Object.freeze(["lesson", "lesson-player"]);
  const DRAFT_STORAGE_KEY = "hh.learning.lesson.drafts.v1";
  const DRAFT_VERSION = 1;
  const MAX_DRAFTS = 24;
  const MAX_ANSWER = 2400;
  const REVIEW_RATINGS = Object.freeze(["again", "hard", "good", "easy"]);
  let active = null;

  const safeText = (value, limit = MAX_ANSWER) => String(value == null ? "" : value)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, limit);
  const escapeHtml = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
  const normalizeAnswer = (value) => safeText(value, MAX_ANSWER).toLocaleLowerCase("vi").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, Number(value) || 0));
  const supports = (view) => VIEWS.includes(String(view || ""));

  const TRACK_KITS = Object.freeze({
    communication: { term: "introduce", meaning: "giới thiệu", context: "gặp một người mới", sentence: "Let me introduce myself." },
    ielts: { term: "evidence", meaning: "bằng chứng", context: "trình bày một luận điểm", sentence: "The evidence supports this conclusion." },
    toeic: { term: "deadline", meaning: "hạn chót", context: "cập nhật tiến độ công việc", sentence: "We can meet the deadline." },
    vstep: { term: "opinion", meaning: "quan điểm", context: "thảo luận một chủ đề", sentence: "In my opinion, this plan is practical." },
    technology: { term: "deploy", meaning: "triển khai", context: "phát hành phần mềm", sentence: "We deploy the update after testing." },
    design: { term: "contrast", meaning: "độ tương phản", context: "trình bày thiết kế", sentence: "The contrast improves readability." },
    media: { term: "timeline", meaning: "dòng thời gian", context: "biên tập video", sentence: "Place the clip on the timeline." },
    marketing: { term: "audience", meaning: "đối tượng", context: "lập kế hoạch chiến dịch", sentence: "Our audience prefers short videos." },
    business: { term: "proposal", meaning: "đề xuất", context: "trình bày kế hoạch", sentence: "I will send the proposal today." },
    hospitality: { term: "reservation", meaning: "đặt chỗ", context: "hỗ trợ khách hàng", sentence: "I can confirm your reservation." },
    healthcare: { term: "symptom", meaning: "triệu chứng", context: "hỏi thông tin bệnh nhân", sentence: "Please describe your main symptom." },
    engineering: { term: "specification", meaning: "thông số kỹ thuật", context: "kiểm tra thiết bị", sentence: "Check the safety specification first." },
    finance: { term: "revenue", meaning: "doanh thu", context: "đọc báo cáo tài chính", sentence: "Revenue increased this quarter." },
    logistics: { term: "shipment", meaning: "lô hàng", context: "theo dõi vận chuyển", sentence: "The shipment arrives on Friday." },
    interview: { term: "strength", meaning: "điểm mạnh", context: "phỏng vấn xin việc", sentence: "My main strength is problem solving." },
    academic: { term: "hypothesis", meaning: "giả thuyết", context: "trình bày nghiên cứu", sentence: "The experiment tests our hypothesis." }
  });

  function lessonKit(lesson) {
    return TRACK_KITS[lesson && lesson.trackId] || TRACK_KITS.communication;
  }

  function buildLessonContent(lesson) {
    const source = lesson && typeof lesson === "object" ? lesson : {};
    const kit = lessonKit(source);
    const title = safeText(source.title || "Bài học HH", 140);
    const level = safeText(source.level || "A0", 8);
    const sentenceParts = kit.sentence.replace(/[.!?]+$/, "").split(/\s+/);
    const shuffled = sentenceParts.length > 3 ? [sentenceParts[2], sentenceParts[0], ...sentenceParts.slice(3), sentenceParts[1]] : [...sentenceParts].reverse();
    return [
      {
        id: "read", type: "read", label: "Đọc hiểu", skillId: "reading", title: `${title}: ngữ cảnh`,
        body: `Trong tình huống ${kit.context}, từ khóa hôm nay là “${kit.term}” (${kit.meaning}). Hãy đọc ví dụ, xác định mục đích của câu và chú ý cách từ khóa kết nối với ngữ cảnh nghề nghiệp.`,
        example: kit.sentence, explanation: "Đọc chủ động giúp bạn nhận ra từ khóa trước khi luyện nghe và nói."
      },
      {
        id: "video", type: "video", label: "Video", skillId: "listening", title: "Video hoặc hướng dẫn cục bộ",
        body: "Chọn một video từ thiết bị để luyện theo nội dung của bạn. Tệp chỉ được phát trong trình duyệt và không tự tải lên máy chủ.",
        transcript: `${kit.sentence} Listen once for meaning, then repeat for rhythm.`, explanation: "Không có video vẫn có thể tiếp tục bằng transcript an toàn."
      },
      {
        id: "flashcard", type: "flashcard", label: "Thẻ nhớ", skillId: "vocabulary", title: kit.term,
        prompt: kit.term, answer: kit.meaning, example: kit.sentence, explanation: `“${kit.term}” có nghĩa là “${kit.meaning}”.`
      },
      {
        id: "fill", type: "fill", label: "Điền từ", skillId: "vocabulary", title: "Hoàn thành câu",
        prompt: kit.sentence.replace(new RegExp(kit.term, "i"), "____"), answer: kit.term,
        explanation: `Từ đúng là “${kit.term}” vì phù hợp cả nghĩa và ngữ cảnh.`
      },
      {
        id: "drag", type: "drag", label: "Sắp xếp", skillId: "grammar", title: "Xếp câu đúng thứ tự",
        tokens: shuffled, answer: sentenceParts.join(" "), explanation: `Trật tự chuẩn: “${sentenceParts.join(" ")}”.`
      },
      {
        id: "match", type: "match", label: "Ghép cặp", skillId: "vocabulary", title: "Ghép từ và nghĩa",
        pairs: [[kit.term, kit.meaning], ["context", "ngữ cảnh"], ["practice", "luyện tập"]],
        explanation: "Ghép theo nghĩa, sau đó đọc lại từng cặp thành tiếng."
      },
      {
        id: "listen", type: "listen", label: "Nghe", skillId: "listening", title: "Nghe và chọn",
        speech: kit.sentence, options: [kit.sentence, "The lesson has no context.", "Please cancel the practice."], answer: kit.sentence,
        explanation: "Nghe từ khóa, trọng âm và ý chính thay vì cố nhận ra mọi âm tiết."
      },
      {
        id: "record", type: "record", label: "Phát âm", skillId: "speaking", title: "Ghi âm và tự đối chiếu",
        prompt: kit.sentence, explanation: "Nghe lại bản ghi, so sánh nhịp câu và từ được nhấn với câu mẫu."
      },
      {
        id: "write", type: "write", label: "Viết", skillId: "writing", title: "Viết câu theo nghề nghiệp",
        prompt: `Viết 1–2 câu dùng “${kit.term}” trong tình huống ${kit.context}.`, requiredTerm: kit.term,
        explanation: `Một câu tốt cần đúng ngữ cảnh và dùng từ “${kit.term}” rõ nghĩa.`
      },
      {
        id: "roleplay", type: "roleplay", label: "Roleplay", skillId: "speaking", title: "Phản hồi trong hội thoại",
        prompt: `Bạn đang ${kit.context}. Phản hồi nào tự nhiên nhất?`,
        partner: `We are practising ${kit.context}. What would you say next?`,
        options: [kit.sentence, "I do not understand anything and will leave.", "This sentence is unrelated."], answer: kit.sentence,
        explanation: "Phản hồi đúng trực tiếp giải quyết tình huống và dùng ngôn ngữ lịch sự."
      },
      {
        id: "quiz", type: "quiz", label: "Kiểm tra", skillId: "vocabulary", title: "Kiểm tra cuối bài",
        prompt: `“${kit.term}” gần nghĩa nhất với lựa chọn nào?`, options: [kit.meaning, "một lỗi ngữ pháp", "một loại âm thanh"], answer: kit.meaning,
        explanation: `Đáp án là “${kit.meaning}”. Bài luyện tiếp theo sẽ dùng lại từ này trong ngữ cảnh mới.`
      }
    ].map((step, index) => ({ ...step, index, level }));
  }

  function evaluateStep(step, answer) {
    const response = answer == null ? "" : answer;
    if (!step || ["article", "read", "video", "record"].includes(step.type)) {
      return { correct: true, score: 100, userAnswer: safeText(response), expected: "", explanation: safeText(step && step.explanation) };
    }
    if (step.type === "match") {
      const pairs = Array.isArray(step.pairs) ? step.pairs : [];
      const values = response && typeof response === "object" ? response : {};
      const correctCount = pairs.filter(([left, right]) => normalizeAnswer(values[left]) === normalizeAnswer(right)).length;
      const score = pairs.length ? Math.round(correctCount / pairs.length * 100) : 0;
      return { correct: score === 100, score, userAnswer: safeText(Object.values(values).join(", ")), expected: pairs.map((pair) => pair.join(" = ")).join("; "), explanation: safeText(step.explanation) };
    }
    if (step.type === "write") {
      const normalized = normalizeAnswer(response);
      const hasTerm = normalized.includes(normalizeAnswer(step.requiredTerm));
      const enoughWords = normalized.split(/\s+/).filter(Boolean).length >= 5;
      const score = (hasTerm ? 60 : 0) + (enoughWords ? 40 : 0);
      return { correct: score >= 60, score, userAnswer: safeText(response), expected: `Một câu có từ “${safeText(step.requiredTerm)}”`, explanation: safeText(step.explanation) };
    }
    const expected = step.type === "drag" ? safeText(step.answer) : safeText(step.answer);
    const actual = Array.isArray(response) ? response.join(" ") : response;
    const correct = normalizeAnswer(actual) === normalizeAnswer(expected);
    return { correct, score: correct ? 100 : 0, userAnswer: safeText(actual), expected, explanation: safeText(step.explanation) };
  }

  function findLesson(core, state, requestedId) {
    const lessons = Array.isArray(core && core.lessons) ? core.lessons : [];
    return lessons.find((lesson) => lesson.id === requestedId)
      || lessons.find((lesson) => lesson.id === state?.activeLessonId)
      || lessons[0]
      || { id: "local-lesson", trackId: "communication", level: "A0", title: "Bài học HH", minutes: 8, skills: ["vocabulary"], xp: 20 };
  }

  function remainingTokens(tokens, selected) {
    const counts = new Map();
    (Array.isArray(selected) ? selected : []).forEach((token) => counts.set(token, (counts.get(token) || 0) + 1));
    return (Array.isArray(tokens) ? tokens : []).filter((token) => {
      const count = counts.get(token) || 0;
      if (!count) return true;
      counts.set(token, count - 1);
      return false;
    });
  }

  function pronunciationEstimate(expected, transcript) {
    const target = normalizeAnswer(expected).split(/\s+/).filter(Boolean);
    const spoken = normalizeAnswer(transcript).split(/\s+/).filter(Boolean);
    if (!target.length || !spoken.length) return { score: 0, matched: 0, total: target.length, missing: target };
    const available = [...spoken];
    let matched = 0;
    const missing = [];
    target.forEach((word) => {
      const index = available.indexOf(word);
      if (index >= 0) { matched += 1; available.splice(index, 1); }
      else missing.push(word);
    });
    return { score: Math.round(matched / target.length * 100), matched, total: target.length, missing };
  }

  function recordingResult(step, rating, transcript) {
    const selfScores = { again: 25, hard: 55, good: 82, easy: 96 };
    const estimate = pronunciationEstimate(step.prompt, transcript);
    const hasTranscript = Boolean(normalizeAnswer(transcript));
    const score = hasTranscript ? Math.round(estimate.score * 0.65 + selfScores[rating] * 0.35) : selfScores[rating];
    const detail = hasTranscript
      ? `Trình duyệt nhận ra ${estimate.matched}/${estimate.total} từ${estimate.missing.length ? `; nên luyện lại: ${estimate.missing.join(", ")}` : "."}`
      : "Thiết bị không cung cấp transcript; kết quả dựa trên phần tự đánh giá sau khi nghe lại.";
    return {
      correct: score >= 60,
      score,
      userAnswer: transcript || rating,
      expected: step.prompt,
      explanation: `${step.explanation} ${detail} Đây là phản hồi luyện tập tự động, không phải điểm phát âm chính thức.`
    };
  }

  function nextLesson(core, state, lessonId) {
    const path = typeof core?.pathForProfile === "function" ? core.pathForProfile(state && state.profile) : (core?.lessons || []);
    const index = path.findIndex((lesson) => lesson.id === lessonId);
    return index >= 0 ? (path[index + 1] || null) : (path.find((lesson) => state?.progress?.[lesson.id]?.status !== "completed") || null);
  }

  function draftId(lessonId) { return safeText(lessonId, 100) || "lesson"; }

  function loadDraft(scope, lessonId) {
    try {
      const parsed = JSON.parse(scope?.localStorage?.getItem?.(DRAFT_STORAGE_KEY) || "null");
      const item = parsed?.version === DRAFT_VERSION && parsed.drafts && parsed.drafts[draftId(lessonId)];
      if (!item || typeof item !== "object") return null;
      return {
        stepIndex: clamp(item.stepIndex, 0, 10),
        answers: item.answers && typeof item.answers === "object" ? item.answers : {},
        results: item.results && typeof item.results === "object" ? item.results : {},
        updatedAt: safeText(item.updatedAt, 40)
      };
    } catch { return null; }
  }

  function saveDraft(scope, lessonId, draft) {
    try {
      const parsed = JSON.parse(scope?.localStorage?.getItem?.(DRAFT_STORAGE_KEY) || "null");
      const drafts = parsed?.version === DRAFT_VERSION && parsed.drafts && typeof parsed.drafts === "object" ? parsed.drafts : {};
      drafts[draftId(lessonId)] = {
        stepIndex: clamp(draft.stepIndex, 0, 10),
        answers: draft.answers || {}, results: draft.results || {}, updatedAt: new Date().toISOString()
      };
      const bounded = Object.fromEntries(Object.entries(drafts).sort((a, b) => String(b[1]?.updatedAt || "").localeCompare(String(a[1]?.updatedAt || ""))).slice(0, MAX_DRAFTS));
      scope?.localStorage?.setItem?.(DRAFT_STORAGE_KEY, JSON.stringify({ version: DRAFT_VERSION, drafts: bounded }));
      return true;
    } catch { return false; }
  }

  function clearDraft(scope, lessonId) {
    try {
      const parsed = JSON.parse(scope?.localStorage?.getItem?.(DRAFT_STORAGE_KEY) || "null");
      if (!parsed?.drafts) return false;
      delete parsed.drafts[draftId(lessonId)];
      scope?.localStorage?.setItem?.(DRAFT_STORAGE_KEY, JSON.stringify(parsed));
      return true;
    } catch { return false; }
  }

  function renderStepper(runtime) {
    return runtime.steps.map((step, index) => {
      const result = runtime.results[step.id];
      return `<button type="button" class="hlp-step-dot${index === runtime.stepIndex ? " is-current" : ""}${result ? " is-done" : ""}${result && !result.correct ? " is-error" : ""}" data-hlp-go="${index}" aria-label="Bước ${index + 1}: ${escapeHtml(step.label)}"${index === runtime.stepIndex ? ' aria-current="step"' : ""}><span>${index + 1}</span><small>${escapeHtml(step.label)}</small></button>`;
    }).join("");
  }

  function resultMarkup(result) {
    if (!result) return "";
    return `<section class="hlp-feedback ${result.correct ? "is-correct" : "is-wrong"}" role="status" aria-live="polite"><strong>${result.correct ? "Đã hoàn thành" : "Cần xem lại"}</strong><p>${escapeHtml(result.explanation)}</p>${!result.correct && result.expected ? `<p><b>Đáp án gợi ý:</b> ${escapeHtml(result.expected)}</p>` : ""}</section>`;
  }

  function answerFor(runtime, step) { return runtime.answers[step.id]; }

  function renderStep(runtime, step) {
    const answer = answerFor(runtime, step);
    const result = runtime.results[step.id];
    if (["article", "read"].includes(step.type)) return `<article class="hlp-reading"><p>${escapeHtml(step.body)}</p><blockquote lang="en">${escapeHtml(step.example)}</blockquote><div class="hlp-reading-check"><span aria-hidden="true">✓</span><p>Tìm từ khóa, đọc câu mẫu thành tiếng rồi đánh dấu hoàn thành.</p></div><button type="button" class="hlp-primary" data-hlp-action="mark-step">Đã đọc và hiểu</button></article>`;
    if (step.type === "video") return `<div class="hlp-video"><div class="hlp-local-media"><video controls playsinline hidden data-hlp-video aria-label="Video bài học cục bộ"></video><div data-hlp-video-empty><span aria-hidden="true">▶</span><strong>Video chỉ ở trên thiết bị</strong><p>${escapeHtml(step.body)}</p></div></div><label class="hlp-file"><input type="file" accept="video/mp4,video/webm,video/ogg" data-hlp-local-video>Chọn video từ máy</label><details><summary>Đọc transcript thay thế</summary><p lang="en">${escapeHtml(step.transcript)}</p></details><button type="button" class="hlp-primary" data-hlp-action="mark-step">Tiếp tục không cần video</button></div>`;
    if (step.type === "flashcard") return `<div class="hlp-flashcard"><button type="button" data-hlp-action="flip-card" aria-expanded="${runtime.cardOpen ? "true" : "false"}"><small>${runtime.cardOpen ? "Mặt sau" : "Mặt trước"}</small><strong lang="en">${escapeHtml(step.prompt)}</strong><span>${runtime.cardOpen ? escapeHtml(step.answer) : "Chạm hoặc nhấn Enter để lật"}</span></button><p lang="en">${escapeHtml(step.example)}</p><div class="hlp-rating" role="group" aria-label="Tự đánh giá thẻ nhớ">${[["again", "Quên", "10 phút"], ["hard", "Khó", "ôn sớm"], ["good", "Tốt", "ôn chuẩn"], ["easy", "Dễ", "giãn lịch"]].map(([value, label, hint]) => `<button type="button" data-hlp-flash-rating="${value}" ${runtime.cardOpen ? "" : "disabled"}><b>${label}</b><small>${hint}</small></button>`).join("")}</div></div>${resultMarkup(result)}`;
    if (step.type === "fill") return `<form data-hlp-form="fill"><p class="hlp-question" lang="en">${escapeHtml(step.prompt)}</p><label>Từ còn thiếu<input name="answer" autocomplete="off" value="${escapeHtml(answer || "")}" data-hlp-answer="${step.id}"></label><button class="hlp-primary" type="submit">Kiểm tra</button></form>${resultMarkup(result)}`;
    if (step.type === "drag") {
      const selected = Array.isArray(answer) ? answer : [];
      const remaining = remainingTokens(step.tokens, selected);
      return `<div class="hlp-sort"><p>Chọn từng từ để đưa vào câu. Có thể kéo thả hoặc dùng bàn phím.</p><div class="hlp-dropzone" data-hlp-dropzone tabindex="0" role="list" aria-label="Câu đang sắp xếp">${selected.length ? selected.map((token, index) => `<button type="button" role="listitem" data-hlp-remove-token="${index}">${escapeHtml(token)} <span aria-hidden="true">×</span></button>`).join("") : `<span>Chọn từ bên dưới</span>`}</div><div class="hlp-token-bank" role="list" aria-label="Các từ có thể chọn">${remaining.map((token) => `<button type="button" draggable="true" role="listitem" data-hlp-token="${escapeHtml(token)}">${escapeHtml(token)}</button>`).join("")}</div><button type="button" class="hlp-primary" data-hlp-action="check-drag">Kiểm tra câu</button></div>${resultMarkup(result)}`;
    }
    if (step.type === "match") {
      const values = answer && typeof answer === "object" ? answer : {};
      const meanings = step.pairs.map((pair) => pair[1]).reverse();
      return `<form data-hlp-form="match" class="hlp-match">${step.pairs.map(([left]) => `<label><span lang="en">${escapeHtml(left)}</span><select name="${escapeHtml(left)}" data-hlp-match="${escapeHtml(left)}"><option value="">Chọn nghĩa</option>${meanings.map((meaning) => `<option value="${escapeHtml(meaning)}"${values[left] === meaning ? " selected" : ""}>${escapeHtml(meaning)}</option>`).join("")}</select></label>`).join("")}<button class="hlp-primary" type="submit">Kiểm tra các cặp</button></form>${resultMarkup(result)}`;
    }
    if (step.type === "listen") return `<div class="hlp-listen"><div class="hlp-listen-tools"><button type="button" class="hlp-speak" data-hlp-action="speak" aria-label="Phát câu tiếng Anh"><span aria-hidden="true">◖</span> Nghe câu</button><div role="group" aria-label="Tốc độ đọc">${[[.7, "0.7×"], [.86, "0.9×"], [1, "1×"]].map(([rate, label]) => `<button type="button" data-hlp-speech-rate="${rate}" class="${runtime.speechRate === rate ? "is-active" : ""}">${label}</button>`).join("")}</div></div>${step.options.map((option) => `<label><input type="radio" name="listen-answer" value="${escapeHtml(option)}" data-hlp-choice="${step.id}"${answer === option ? " checked" : ""}><span lang="en">${escapeHtml(option)}</span></label>`).join("")}<button type="button" class="hlp-primary" data-hlp-action="check-choice">Kiểm tra</button></div>${resultMarkup(result)}`;
    if (step.type === "record") return `<div class="hlp-record"><p class="hlp-question" lang="en">${escapeHtml(step.prompt)}</p><div class="hlp-record-actions"><button type="button" class="hlp-speak" data-hlp-action="speak-record">Nghe mẫu</button><button type="button" class="hlp-primary" data-hlp-action="${runtime.recording ? "stop-recording" : "start-recording"}">${runtime.recording ? "Dừng ghi âm" : "Bắt đầu ghi âm"}</button></div><p class="hlp-permission-note">Micro chỉ được yêu cầu sau khi bạn bấm nút. Bản ghi không tự tải lên. Transcript chỉ là ước tính của trình duyệt.</p><audio controls hidden data-hlp-record-playback aria-label="Bản ghi phát âm"></audio><div class="hlp-live" data-hlp-record-live aria-live="polite">${escapeHtml(runtime.recordStatus || "Chưa ghi âm")}</div>${runtime.recordTranscript ? `<div class="hlp-transcript"><span>TRÌNH DUYỆT NHẬN DIỆN</span><p lang="en">${escapeHtml(runtime.recordTranscript)}</p></div>` : ""}${runtime.recorded ? `<div class="hlp-record-rating" role="group" aria-label="Tự đánh giá phát âm">${[["again", "Cần luyện"], ["hard", "Khó"], ["good", "Khá"], ["easy", "Tốt"]].map(([value, label]) => `<button type="button" data-hlp-record-rating="${value}">${label}</button>`).join("")}</div>` : ""}</div>${resultMarkup(result)}`;
    if (step.type === "write") return `<form data-hlp-form="write"><p class="hlp-question">${escapeHtml(step.prompt)}</p><label>Bài viết<textarea name="answer" rows="7" maxlength="${MAX_ANSWER}" data-hlp-answer="${step.id}" placeholder="Viết câu trả lời của bạn...">${escapeHtml(answer || "")}</textarea></label><div class="hlp-writing-meta"><span>${safeText(answer || "").split(/\s+/).filter(Boolean).length} từ</span><span>Tự động lưu trên thiết bị</span></div><button class="hlp-primary" type="submit">Nhận phản hồi</button></form>${resultMarkup(result)}`;
    if (["scenario", "roleplay"].includes(step.type)) return `<div class="hlp-roleplay"><div class="hlp-dialogue"><div><span>AI PARTNER</span><p lang="en">${escapeHtml(step.partner || step.prompt)}</p></div><div class="is-user"><span>LƯỢT CỦA BẠN</span><p>${escapeHtml(step.prompt)}</p></div></div><div class="hlp-choice">${step.options.map((option, index) => `<label><input type="radio" name="${step.id}-answer" value="${escapeHtml(option)}" data-hlp-choice="${step.id}"${answer === option ? " checked" : ""}><span><b>${String.fromCharCode(65 + index)}</b>${escapeHtml(option)}</span></label>`).join("")}<button type="button" class="hlp-primary" data-hlp-action="check-choice">Gửi phản hồi</button></div></div>${resultMarkup(result)}`;
    if (step.type === "quiz") return `<div class="hlp-choice"><p class="hlp-question">${escapeHtml(step.prompt)}</p>${step.options.map((option, index) => `<label><input type="radio" name="${step.id}-answer" value="${escapeHtml(option)}" data-hlp-choice="${step.id}"${answer === option ? " checked" : ""}><span><b>${String.fromCharCode(65 + index)}</b>${escapeHtml(option)}</span></label>`).join("")}<button type="button" class="hlp-primary" data-hlp-action="check-choice">Kiểm tra</button></div>${resultMarkup(result)}`;
    return `<p>Hoạt động này đang được chuẩn bị.</p>`;
  }

  function render(runtime, focusSelector) {
    const step = runtime.steps[runtime.stepIndex];
    const lesson = runtime.lesson;
    const completed = Object.keys(runtime.results).length;
    const percent = Math.round(completed / runtime.steps.length * 100);
    runtime.host.innerHTML = `<section class="hlplayer-shell" data-hlp-root>
      <header class="hlp-head">
        <button type="button" class="hlp-icon-button" data-hlp-action="exit" aria-label="Rời bài học">←</button>
        <div><span>${escapeHtml(lesson.level)} · ${escapeHtml(lesson.trackId)}</span><h2>${escapeHtml(lesson.title)}</h2><p>${clamp(lesson.minutes, 5, 12)} phút · ${escapeHtml((lesson.skills || []).join(" · "))}</p></div>
        <div class="hlp-progress" aria-label="Tiến độ ${percent}%"><strong>${percent}%</strong><span><i style="width:${percent}%"></i></span><small>Đã tự động lưu</small></div>
      </header>
      <nav class="hlp-stepper" aria-label="Các bước bài học">${renderStepper(runtime)}</nav>
      <main class="hlp-workspace">
        <aside class="hlp-context"><span>BƯỚC ${runtime.stepIndex + 1}/${runtime.steps.length}</span><h3>${escapeHtml(step.label)}</h3><p>${escapeHtml(step.title)}</p><div><b>${escapeHtml(step.skillId)}</b><small>${escapeHtml(lesson.level)}</small></div></aside>
        <article class="hlp-stage" tabindex="-1" data-hlp-stage><header><span>${escapeHtml(step.type)}</span><h1>${escapeHtml(step.title)}</h1></header>${renderStep(runtime, step)}</article>
      </main>
      <footer class="hlp-footer"><button type="button" data-hlp-action="previous"${runtime.stepIndex === 0 ? " disabled" : ""}>← Trước</button><p aria-live="polite">${escapeHtml(runtime.status || `${completed}/${runtime.steps.length} hoạt động đã hoàn thành`)}</p><button type="button" class="hlp-primary" data-hlp-action="next">${runtime.stepIndex === runtime.steps.length - 1 ? "Hoàn thành bài" : "Tiếp theo →"}</button></footer>
    </section>`;
    hydrateMedia(runtime);
    if (focusSelector) runtime.host.querySelector?.(focusSelector)?.focus?.();
  }

  function hydrateMedia(runtime) {
    if (runtime.localVideoUrl) {
      const video = runtime.host.querySelector?.("[data-hlp-video]");
      const empty = runtime.host.querySelector?.("[data-hlp-video-empty]");
      if (video) { video.src = runtime.localVideoUrl; video.hidden = false; }
      if (empty) empty.hidden = true;
    }
    if (runtime.recordingUrl) {
      const audio = runtime.host.querySelector?.("[data-hlp-record-playback]");
      if (audio) { audio.src = runtime.recordingUrl; audio.hidden = false; }
    }
  }

  function persistDraft(runtime) {
    return saveDraft(runtime.scope, runtime.lesson.id, { stepIndex: runtime.stepIndex, answers: runtime.answers, results: runtime.results });
  }

  function recordMistake(runtime, step, result, options = {}) {
    if (result.correct || typeof runtime.store?.update !== "function") return;
    runtime.store.update((state) => {
      const now = new Date().toISOString();
      const prompt = safeText(step.prompt || step.title, 300);
      const answer = safeText([result.expected, result.explanation ? `Giải thích: ${result.explanation}` : ""].filter(Boolean).join(" · "), 600);
      state.mistakes = Array.isArray(state.mistakes) ? state.mistakes : [];
      const existingMistake = state.mistakes.find((item) => !item.resolved && item.lessonId === runtime.lesson.id
        && item.skillId === step.skillId && normalizeAnswer(item.prompt) === normalizeAnswer(prompt));
      if (existingMistake) {
        existingMistake.answer = answer;
        existingMistake.userAnswer = result.userAnswer;
        existingMistake.createdAt = now;
      } else {
        state.mistakes.unshift({ id: runtime.core.uid?.("mistake") || `mistake-${Date.now()}`, lessonId: runtime.lesson.id, skillId: step.skillId, prompt, answer, userAnswer: result.userAnswer, createdAt: now, resolved: false });
      }
      state.reviews = Array.isArray(state.reviews) ? state.reviews : [];
      if (options.scheduleReview !== false) {
        const existingIndex = state.reviews.findIndex((item) => item.trackId === runtime.lesson.trackId
          && item.skillId === step.skillId && normalizeAnswer(item.prompt) === normalizeAnswer(prompt));
        const card = existingIndex >= 0 ? state.reviews[existingIndex] : { id: runtime.core.uid?.("review") || `review-${Date.now()}`, prompt, answer, trackId: runtime.lesson.trackId, skillId: step.skillId, difficulty: runtime.lesson.difficulty || 3, stability: 1, intervalDays: 0, lapses: 0, dueAt: now };
        card.answer = answer || card.answer;
        const scheduled = typeof runtime.core.scheduleReview === "function" ? runtime.core.scheduleReview(card, "again", Date.now(), state.profile?.retentionGoal) : card;
        if (existingIndex >= 0) state.reviews[existingIndex] = scheduled;
        else state.reviews.unshift(scheduled);
      }
      return state;
    });
  }

  function setResult(runtime, step, answer, override, options = {}) {
    runtime.answers[step.id] = answer;
    const result = override || evaluateStep(step, answer);
    runtime.results[step.id] = result;
    recordMistake(runtime, step, result, options);
    runtime.status = result.correct ? "Tốt! Bạn có thể sang bước tiếp theo." : "Đã thêm lỗi này vào Sổ lỗi và lịch ôn tập.";
    persistDraft(runtime);
    render(runtime, "[data-hlp-stage]");
    return result;
  }

  function scheduleFlashcard(runtime, step, rating) {
    if (!REVIEW_RATINGS.includes(rating) || typeof runtime.store?.update !== "function") return null;
    let scheduled = null;
    runtime.store.update((state) => {
      state.reviews = Array.isArray(state.reviews) ? state.reviews : [];
      const index = state.reviews.findIndex((item) => item.trackId === runtime.lesson.trackId
        && item.skillId === step.skillId && normalizeAnswer(item.prompt) === normalizeAnswer(step.prompt));
      const source = index >= 0 ? state.reviews[index] : {
        id: runtime.core.uid?.("review") || `review-${Date.now()}`,
        prompt: step.prompt,
        answer: `${step.answer} · ${step.example}`,
        trackId: runtime.lesson.trackId,
        skillId: step.skillId,
        difficulty: runtime.lesson.difficulty || 3,
        stability: 1,
        intervalDays: 0,
        lapses: 0,
        dueAt: new Date().toISOString()
      };
      scheduled = typeof runtime.core.scheduleReview === "function"
        ? runtime.core.scheduleReview(source, rating, Date.now(), state.profile?.retentionGoal)
        : { ...source, lastRating: rating };
      if (index >= 0) state.reviews[index] = scheduled;
      else state.reviews.unshift(scheduled);
      return state;
    });
    return scheduled;
  }

  function answerFromForm(form) {
    if (!form) return "";
    if (form.dataset.hlpForm === "match") return Object.fromEntries(Array.from(form.querySelectorAll?.("[data-hlp-match]") || []).map((field) => [field.dataset.hlpMatch, field.value]));
    return form.querySelector?.('[name="answer"]')?.value || "";
  }

  function speak(runtime, text) {
    const synth = runtime.scope?.speechSynthesis;
    const Utterance = runtime.scope?.SpeechSynthesisUtterance || globalScope?.SpeechSynthesisUtterance;
    if (!synth || typeof synth.speak !== "function" || typeof Utterance !== "function") {
      runtime.status = "Thiết bị này chưa hỗ trợ đọc câu bằng giọng hệ thống.";
      render(runtime);
      return false;
    }
    synth.cancel?.();
    const utterance = new Utterance(safeText(text, 600));
    utterance.lang = "en-US";
    utterance.rate = clamp(runtime.speechRate || 0.86, 0.5, 1.25);
    synth.speak(utterance);
    return true;
  }

  async function startRecording(runtime) {
    if (runtime.recording) return true;
    const mediaDevices = runtime.scope?.navigator?.mediaDevices;
    if (!mediaDevices || typeof mediaDevices.getUserMedia !== "function") {
      runtime.recordStatus = "Trình duyệt không hỗ trợ ghi âm.";
      render(runtime);
      return false;
    }
    try {
      const stream = await mediaDevices.getUserMedia({ audio: true, video: false });
      runtime.mediaStream = stream;
      const Recorder = runtime.scope?.MediaRecorder || globalScope?.MediaRecorder;
      if (typeof Recorder !== "function") {
        stream.getTracks?.().forEach((track) => track.stop?.());
        runtime.mediaStream = null;
        runtime.recordStatus = "Thiết bị đã cấp micro nhưng chưa hỗ trợ MediaRecorder.";
        render(runtime);
        return false;
      }
      runtime.recordChunks = [];
      runtime.recordTranscript = "";
      runtime.mediaRecorder = new Recorder(stream);
      runtime.mediaRecorder.addEventListener?.("dataavailable", (event) => { if (event.data?.size) runtime.recordChunks.push(event.data); });
      runtime.mediaRecorder.addEventListener?.("stop", () => finishRecording(runtime));
      runtime.mediaRecorder.start();
      runtime.recording = true;
      runtime.recordStatus = "Đang ghi âm…";
      const Recognition = runtime.scope?.SpeechRecognition || runtime.scope?.webkitSpeechRecognition;
      if (typeof Recognition === "function") {
        try {
          runtime.recognition = new Recognition();
          runtime.recognition.lang = "en-US";
          runtime.recognition.continuous = true;
          runtime.recognition.interimResults = true;
          runtime.recognition.addEventListener?.("result", (event) => {
            const transcript = Array.from(event.results || []).map((result) => result?.[0]?.transcript || "").join(" ");
            runtime.recordTranscript = safeText(transcript, 600);
            const live = runtime.host.querySelector?.("[data-hlp-record-live]");
            if (live && runtime.recordTranscript) live.textContent = `Đang nhận diện: ${runtime.recordTranscript}`;
          });
          runtime.recognition.addEventListener?.("error", () => {
            runtime.recordStatus = "Đang ghi âm; nhận diện giọng nói không khả dụng trên thiết bị này.";
          });
          runtime.recognition.start();
        } catch { runtime.recognition = null; }
      }
      render(runtime);
      return true;
    } catch (error) {
      runtime.recordStatus = error?.name === "NotAllowedError" ? "Bạn chưa cấp quyền micro. Có thể tiếp tục các bước khác." : "Không thể bắt đầu ghi âm trên thiết bị này.";
      render(runtime);
      return false;
    }
  }

  function finishRecording(runtime) {
    runtime.mediaStream?.getTracks?.().forEach((track) => track.stop?.());
    runtime.mediaStream = null;
    runtime.recognition?.stop?.();
    runtime.recognition = null;
    runtime.recording = false;
    if (runtime.recordChunks?.length && runtime.scope?.Blob && runtime.scope?.URL?.createObjectURL) {
      if (runtime.recordingUrl) {
        runtime.scope.URL.revokeObjectURL?.(runtime.recordingUrl);
        runtime.objectUrls.delete(runtime.recordingUrl);
      }
      runtime.recordingUrl = runtime.scope.URL.createObjectURL(new runtime.scope.Blob(runtime.recordChunks, { type: runtime.mediaRecorder?.mimeType || "audio/webm" }));
      runtime.objectUrls.add(runtime.recordingUrl);
      runtime.recorded = true;
      runtime.recordStatus = runtime.recordTranscript
        ? "Đã ghi xong và nhận diện được lời nói. Hãy nghe lại rồi tự đánh giá."
        : "Đã ghi xong. Hãy nghe lại trước khi tự đánh giá.";
    } else runtime.recordStatus = "Đã dừng ghi âm.";
    runtime.mediaRecorder = null;
    if (active === runtime) render(runtime);
  }

  function stopRecording(runtime) {
    if (runtime.mediaRecorder?.state === "recording") runtime.mediaRecorder.stop();
    else finishRecording(runtime);
  }

  function replaceObjectUrl(runtime, key, file) {
    const URLApi = runtime.scope?.URL;
    if (!file || !URLApi?.createObjectURL) return false;
    if (runtime[key]) { URLApi.revokeObjectURL?.(runtime[key]); runtime.objectUrls.delete(runtime[key]); }
    runtime[key] = URLApi.createObjectURL(file);
    runtime.objectUrls.add(runtime[key]);
    return true;
  }

  function completeLesson(runtime) {
    const missingIndex = runtime.steps.findIndex((step) => !runtime.results[step.id]);
    if (missingIndex >= 0) {
      runtime.stepIndex = missingIndex;
      runtime.status = "Hãy hoàn thành các hoạt động còn thiếu trước khi kết thúc bài.";
      persistDraft(runtime);
      render(runtime, "[data-hlp-stage]");
      return false;
    }
    const scored = Object.values(runtime.results).filter((result) => Number.isFinite(result?.score));
    const score = scored.length ? Math.round(scored.reduce((sum, result) => sum + result.score, 0) / scored.length) : 0;
    const mistakes = scored.filter((result) => !result.correct).length;
    const state = runtime.store?.recordStudy?.({ type: "lesson", lessonId: runtime.lesson.id, completed: true, minutes: clamp(runtime.lesson.minutes, 5, 12), score, xp: runtime.lesson.xp || 20, skills: runtime.lesson.skills || [] }) || runtime.store?.get?.() || {};
    clearDraft(runtime.scope, runtime.lesson.id);
    runtime.completed = true;
    runtime.next = nextLesson(runtime.core, state, runtime.lesson.id);
    runtime.host.innerHTML = `<section class="hlp-complete" data-hlp-root><span aria-hidden="true">✓</span><p>HOÀN THÀNH BÀI HỌC</p><h2>${escapeHtml(runtime.lesson.title)}</h2><strong>${score} điểm</strong><div><b>+${clamp(runtime.lesson.xp || 20, 1, 500)} XP</b><b>${clamp(runtime.lesson.minutes, 5, 12)} phút</b><b>${mistakes ? `${mistakes} mục cần ôn` : "Không có lỗi"}</b><b>${escapeHtml((runtime.lesson.skills || []).join(" · "))}</b></div><p>${mistakes ? "Giải thích và thẻ cần ôn đã được lưu vào Sổ lỗi sai và Smart Review." : "Tiến độ, streak và mastery đã được cập nhật trong HH Learning."}</p><div class="hlp-complete-actions"><button type="button" data-hlp-action="exit">Về Learning Home</button>${runtime.next ? `<button type="button" class="hlp-primary" data-hlp-action="next-lesson">Bài tiếp theo →</button>` : ""}</div></section>`;
    return true;
  }

  function handleClick(runtime, event) {
    const target = event.target?.closest?.("[data-hlp-action],[data-hlp-go],[data-hlp-token],[data-hlp-remove-token],[data-hlp-flash-rating],[data-hlp-record-rating],[data-hlp-speech-rate]");
    if (!target) return;
    if (target.dataset.hlpGo != null) {
      runtime.stepIndex = clamp(target.dataset.hlpGo, 0, runtime.steps.length - 1); persistDraft(runtime); render(runtime, "[data-hlp-stage]"); return;
    }
    const step = runtime.steps[runtime.stepIndex];
    if (target.dataset.hlpToken != null) {
      const selected = Array.isArray(runtime.answers[step.id]) ? runtime.answers[step.id] : [];
      runtime.answers[step.id] = [...selected, target.dataset.hlpToken]; persistDraft(runtime); render(runtime, "[data-hlp-dropzone]"); return;
    }
    if (target.dataset.hlpRemoveToken != null) {
      const selected = Array.isArray(runtime.answers[step.id]) ? [...runtime.answers[step.id]] : [];
      selected.splice(Number(target.dataset.hlpRemoveToken), 1); runtime.answers[step.id] = selected; persistDraft(runtime); render(runtime, "[data-hlp-dropzone]"); return;
    }
    if (target.dataset.hlpFlashRating) {
      const rating = target.dataset.hlpFlashRating;
      scheduleFlashcard(runtime, step, rating);
      const correct = rating !== "again";
      return setResult(runtime, step, rating, { correct, score: { again: 20, hard: 60, good: 85, easy: 100 }[rating], userAnswer: rating, expected: step.answer, explanation: `${step.explanation} Thẻ đã được xếp lịch theo mức “${target.textContent.trim()}”.` }, { scheduleReview: false });
    }
    if (target.dataset.hlpRecordRating) {
      const rating = target.dataset.hlpRecordRating;
      return setResult(runtime, step, runtime.recordTranscript || rating, recordingResult(step, rating, runtime.recordTranscript));
    }
    if (target.dataset.hlpSpeechRate) {
      runtime.speechRate = clamp(target.dataset.hlpSpeechRate, 0.5, 1.25);
      runtime.status = `Tốc độ đọc ${runtime.speechRate}×.`;
      render(runtime, '[data-hlp-action="speak"]');
      return;
    }
    const action = target.dataset.hlpAction;
    if (action === "flip-card") { runtime.cardOpen = !runtime.cardOpen; render(runtime, '[data-hlp-action="flip-card"]'); }
    else if (action === "mark-step") setResult(runtime, step, "completed");
    else if (action === "check-drag") setResult(runtime, step, runtime.answers[step.id] || []);
    else if (action === "check-choice") setResult(runtime, step, runtime.answers[step.id] || "");
    else if (action === "speak") speak(runtime, step.speech);
    else if (action === "speak-record") speak(runtime, step.prompt);
    else if (action === "start-recording") startRecording(runtime);
    else if (action === "stop-recording") stopRecording(runtime);
    else if (action === "previous") { runtime.stepIndex = Math.max(0, runtime.stepIndex - 1); persistDraft(runtime); render(runtime, "[data-hlp-stage]"); }
    else if (action === "next") {
      if (!runtime.results[step.id]) { runtime.status = "Hãy hoàn thành hoạt động hiện tại trước khi tiếp tục."; render(runtime); return; }
      if (runtime.stepIndex === runtime.steps.length - 1) completeLesson(runtime);
      else { runtime.stepIndex += 1; persistDraft(runtime); render(runtime, "[data-hlp-stage]"); }
    } else if (action === "next-lesson" && runtime.next) loadLesson(runtime, runtime.next.id);
    else if (action === "exit") emitNavigation(runtime, "home");
  }

  function handleInput(runtime, event) {
    const stepId = event.target?.dataset?.hlpAnswer;
    if (!stepId) return;
    runtime.answers[stepId] = safeText(event.target.value);
    if (runtime.autosaveTimer) runtime.scope.clearTimeout?.(runtime.autosaveTimer);
    runtime.autosaveTimer = runtime.scope.setTimeout?.(() => persistDraft(runtime), 180) || null;
    const count = runtime.host.querySelector?.(".hlp-writing-meta span");
    if (count && event.target.tagName === "TEXTAREA") count.textContent = `${safeText(event.target.value).split(/\s+/).filter(Boolean).length} từ`;
  }

  function handleChange(runtime, event) {
    const step = runtime.steps[runtime.stepIndex];
    if (event.target?.dataset?.hlpChoice) {
      runtime.answers[event.target.dataset.hlpChoice] = safeText(event.target.value); persistDraft(runtime);
    } else if (event.target?.dataset?.hlpMatch) {
      runtime.answers[step.id] = { ...(runtime.answers[step.id] || {}), [event.target.dataset.hlpMatch]: safeText(event.target.value) }; persistDraft(runtime);
    } else if (event.target?.matches?.("[data-hlp-local-video]")) {
      const file = event.target.files?.[0];
      if (!file || !/^video\/(mp4|webm|ogg)$/i.test(file.type || "")) { runtime.status = "Hãy chọn tệp video MP4, WebM hoặc OGG."; render(runtime); return; }
      if (replaceObjectUrl(runtime, "localVideoUrl", file)) { runtime.status = "Video đang phát cục bộ trên thiết bị."; render(runtime); }
    }
  }

  function handleSubmit(runtime, event) {
    const form = event.target?.closest?.("[data-hlp-form]");
    if (!form) return;
    event.preventDefault();
    const step = runtime.steps[runtime.stepIndex];
    setResult(runtime, step, answerFromForm(form));
  }

  function handleDrag(runtime, event) {
    const token = event.target?.closest?.("[data-hlp-token]");
    if (!token) return;
    event.dataTransfer?.setData?.("text/plain", token.dataset.hlpToken);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  }

  function handleDrop(runtime, event) {
    if (!event.target?.closest?.("[data-hlp-dropzone]")) return;
    event.preventDefault();
    const token = safeText(event.dataTransfer?.getData?.("text/plain"), 80);
    if (!token) return;
    const step = runtime.steps[runtime.stepIndex];
    if (!Array.isArray(step.tokens) || !step.tokens.includes(token)) return;
    runtime.answers[step.id] = [...(Array.isArray(runtime.answers[step.id]) ? runtime.answers[step.id] : []), token];
    persistDraft(runtime); render(runtime, "[data-hlp-dropzone]");
  }

  function emitNavigation(runtime, view, lessonId) {
    try {
      const EventCtor = runtime.scope.CustomEvent || globalScope.CustomEvent;
      runtime.scope.dispatchEvent?.(new EventCtor("hh:learning:navigate", { detail: { view, lessonId } }));
    } catch {}
  }

  function loadLesson(runtime, lessonId) {
    cleanupMedia(runtime);
    const state = runtime.store?.get?.() || {};
    runtime.lesson = findLesson(runtime.core, state, lessonId);
    runtime.steps = buildLessonContent(runtime.lesson);
    const draft = loadDraft(runtime.scope, runtime.lesson.id);
    runtime.stepIndex = draft?.stepIndex || 0;
    runtime.answers = draft?.answers || {};
    runtime.results = draft?.results || {};
    runtime.cardOpen = false; runtime.completed = false; runtime.next = null; runtime.recorded = false; runtime.recordTranscript = ""; runtime.recordStatus = ""; runtime.status = draft ? "Đã khôi phục bản học tự động lưu." : "";
    render(runtime, "[data-hlp-stage]");
  }

  function cleanupMedia(runtime) {
    if (!runtime) return;
    if (runtime.mediaRecorder?.state === "recording") {
      try { runtime.mediaRecorder.stop(); } catch {}
    }
    runtime.mediaStream?.getTracks?.().forEach((track) => track.stop?.());
    runtime.mediaStream = null;
    try { runtime.recognition?.abort?.(); } catch {}
    runtime.recognition = null;
    runtime.scope?.speechSynthesis?.cancel?.();
    for (const url of runtime.objectUrls || []) {
      try { runtime.scope?.URL?.revokeObjectURL?.(url); } catch {}
    }
    runtime.objectUrls?.clear?.();
    runtime.localVideoUrl = ""; runtime.recordingUrl = ""; runtime.recordTranscript = "";
  }

  function mount(host, options = {}) {
    if (!host) return null;
    unmount();
    const scope = options.scope || globalScope;
    const core = options.core || scope.HHLearningCore || globalScope.HHLearningCore;
    if (!core) {
      host.innerHTML = '<section class="hlp-error" role="alert"><h2>Chưa tải Learning Core</h2><p>Lesson Player cần learning-platform-core.js để hoạt động.</p></section>';
      return null;
    }
    const store = options.store || core.store || core.createStore?.(scope.localStorage);
    const state = store?.get?.() || core.defaultState?.() || {};
    const lesson = findLesson(core, state, options.lessonId);
    const draft = loadDraft(scope, lesson.id);
    const runtime = {
      host, scope, core, store, lesson, steps: buildLessonContent(lesson), stepIndex: draft?.stepIndex || 0,
      answers: draft?.answers || {}, results: draft?.results || {}, listeners: [], objectUrls: new Set(), cardOpen: false,
      recording: false, recorded: false, recordStatus: "", recordTranscript: "", recordChunks: [], speechRate: 0.86,
      status: draft ? "Đã khôi phục bản học tự động lưu." : ""
    };
    const on = (target, type, handler) => {
      if (!target?.addEventListener) return;
      target.addEventListener(type, handler);
      runtime.listeners.push([target, type, handler]);
    };
    on(host, "click", (event) => handleClick(runtime, event));
    on(host, "input", (event) => handleInput(runtime, event));
    on(host, "change", (event) => handleChange(runtime, event));
    on(host, "submit", (event) => handleSubmit(runtime, event));
    on(host, "dragstart", (event) => handleDrag(runtime, event));
    on(host, "dragover", (event) => { if (event.target?.closest?.("[data-hlp-dropzone]")) event.preventDefault(); });
    on(host, "drop", (event) => handleDrop(runtime, event));
    active = runtime;
    render(runtime);
    return Object.freeze({ view: supports(options.view) ? options.view : "lesson-player", lessonId: lesson.id, getState: () => ({ lessonId: runtime.lesson.id, stepIndex: runtime.stepIndex, answers: { ...runtime.answers }, results: { ...runtime.results } }), startRecording: () => startRecording(runtime) });
  }

  function unmount() {
    if (!active) return false;
    if (active.autosaveTimer) active.scope.clearTimeout?.(active.autosaveTimer);
    persistDraft(active);
    cleanupMedia(active);
    active.listeners.forEach(([target, type, handler]) => target?.removeEventListener?.(type, handler));
    if (active.host) active.host.innerHTML = "";
    active = null;
    return true;
  }

  const publicApi = Object.freeze({ supports, mount, unmount });
  if (globalScope) globalScope.HHLearningLessonPlayer = publicApi;
  if (typeof module !== "undefined" && module.exports) module.exports = Object.freeze({
    VIEWS, DRAFT_STORAGE_KEY, DRAFT_VERSION, supports, escapeHtml, normalizeAnswer, buildLessonContent,
    evaluateStep, remainingTokens, pronunciationEstimate, recordingResult, nextLesson, loadDraft, saveDraft,
    clearDraft, startRecording, cleanupMedia, publicApi
  });
})(typeof window !== "undefined" ? window : globalThis);
