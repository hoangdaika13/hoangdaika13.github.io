(function(global) {
  "use strict";
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const C = global.HHDharmaCurriculum;
  const topicButton = item => item ? `<button type="button" data-open-teaching="${esc(item.id)}">${esc(item.title)} →</button>` : "";
  function needsReview(teachings,state) { return teachings.filter(item => item.quiz && Number.isInteger(state.studyLab.answers[item.id]) && state.studyLab.answers[item.id] !== item.quiz.answer); }
  function dashboard({teachings,state}) {
    const study=state.studyLab, plan=C.plan(study.plan.days), nextId=plan.find(id=>!study.completed.includes(id)&&!study.plan.skipped.includes(id));
    const next=teachings.find(item=>item.id===nextId), recent=study.recent.map(id=>teachings.find(item=>item.id===id)).filter(Boolean);
    const review=needsReview(teachings,state), saved=teachings.filter(item=>study.saved.includes(item.id));
    return `<section class="dharma-learning-home dharma-paper-card" aria-label="Bàn học cá nhân"><header><small>BÀN HỌC CÁ NHÂN · LƯU TRÊN THIẾT BỊ</small><h2>Tiếp nối một việc vừa sức</h2><p>Không chuỗi ngày, không xếp hạng. Các buổi là gợi ý học; bạn tự chọn lịch và có thể nghỉ.</p></header><div class="dharma-learning-columns"><section><h3>Đọc gần đây</h3>${recent.length?recent.slice(0,3).map(topicButton).join(""):"<p>Chưa mở bài giáo lý nào trên tài khoản này.</p>"}<details><summary>Đã lưu · ${saved.length} bài</summary>${saved.map(topicButton).join("")||"<p>Mở bài và chọn Lưu chủ đề.</p>"}</details><details><summary>Cần ôn lại · ${review.length} câu</summary>${review.map(topicButton).join("")||"<p>Chưa có câu trả lời cần xem lại.</p>"}</details></section><section><h3>Lộ trình tự chọn</h3><label>Số buổi gợi ý<select data-study-plan-days>${[7,14,30].map(n=>`<option value="${n}" ${study.plan.days===n?"selected":""}>${n} buổi · tự chọn ngày học</option>`).join("")}</select></label><p>${plan.filter(id=>study.completed.includes(id)).length}/${plan.length} bài đánh dấu đã học · ${plan.filter(id=>study.plan.skipped.includes(id)&&!study.completed.includes(id)).length} bài bỏ qua.</p>${study.plan.paused?"<p>Kế hoạch đang tạm nghỉ. Bạn vẫn có thể mở mọi bài.</p>":next?`<p>Gợi ý tiếp theo:</p>${topicButton(next)}<button type="button" data-study-skip="${next.id}">Bỏ qua gợi ý này</button>`:"<p>Đã đi hết gợi ý. Có thể học lại hoặc chọn bài khác.</p>"}<div class="dharma-study-actions"><button type="button" data-study-plan-pause>${study.plan.paused?"Tiếp tục kế hoạch":"Tạm nghỉ kế hoạch"}</button><button type="button" data-study-plan-unskip>Đưa bài bỏ qua trở lại</button></div><small>Đổi kế hoạch không xóa ghi chú, đáp án hoặc bài đã học.</small></section></div></section>`;
  }
  function levelFilter(level="all") {
    return `<label>Mức đọc<select name="level"><option value="all">Mọi mức</option>${Object.entries(C.levels).map(([id,label])=>`<option value="${id}" ${level===id?"selected":""}>${label}</option>`).join("")}</select></label>`;
  }
  function readerTools(item,state) {
    const r=state.studyLab.reader;
    return `<details class="dharma-study-reader-tools"><summary>Hiển thị & xuất ghi chú</summary><div class="dharma-study-filters"><label>Cỡ chữ<select data-study-reader="size">${[18,20,24,28,32].map(n=>`<option value="${n}" ${r.size===n?"selected":""}>${n}px</option>`).join("")}</select></label><label>Giãn dòng<select data-study-reader="line">${[1.6,1.9,2.2].map(n=>`<option value="${n}" ${r.line===n?"selected":""}>${n}</option>`).join("")}</select></label><label>Chiều rộng<select data-study-reader="width"><option value="comfortable" ${r.width==="comfortable"?"selected":""}>Vừa đọc</option><option value="wide" ${r.width==="wide"?"selected":""}>Rộng</option></select></label><label>Màu bài đọc<select data-study-reader="mode"><option value="paper" ${r.mode==="paper"?"selected":""}>Giấy ấm</option><option value="night" ${r.mode==="night"?"selected":""}>Ban đêm</option></select></label></div><div class="dharma-study-actions"><button type="button" data-study-export="${esc(item.id)}">Xuất ghi chú Markdown</button><button type="button" data-study-link="${esc(item.id)}">Sao chép đường dẫn bài</button></div><p>Chỉ xuất ghi chú cá nhân và thông tin nguồn. Không xuất nhật ký mã hóa.</p></details>`;
  }
  function objectives(item,teachings) {
    return `<section class="dharma-study-objective"><small>${esc(C.levels[item.level]||C.levels.intro)} · mọi mức đều mở</small><h3>Mục tiêu của bài</h3><p>${esc(item.goal)}</p>${item.prerequisites?.length?`<h3>Nên đọc trước · không bắt buộc</h3><div class="dharma-study-actions">${item.prerequisites.map(id=>topicButton(teachings.find(t=>t.id===id))).join("")}</div>`:""}</section>`;
  }
  function mapFilters({query="",filter="all",teachings}) {
    return `<form data-study-map-form class="dharma-study-filters"><label>Tìm trên bản đồ<input type="search" name="query" maxlength="120" value="${esc(query)}" placeholder="Nhập khái niệm có dấu hoặc không dấu"></label><label>Nhóm trên bản đồ<select name="filter"><option value="all">Tất cả</option>${[...new Set(teachings.map(t=>t.category))].map(c=>`<option value="${esc(c)}" ${filter===c?"selected":""}>${esc(c)}</option>`).join("")}</select></label><button type="submit">Tìm trên bản đồ</button><button type="button" data-study-map-clear>Xóa bộ lọc bản đồ</button></form>`;
  }
  function noteExport(item,note) {
    return [`# Ghi chú cá nhân · ${item.title}`,"","> Ghi chú do người dùng nhập, không phải nguyên văn kinh hay bản dịch.","",String(note||"Chưa có ghi chú."),"","## Bài tham chiếu HH",item.title,"HH biên soạn; cần đọc nguồn trong bối cảnh.",...(item.references||[]).map(r=>`- ${r.label}: ${r.url}`)].join("\n");
  }
  global.HHDharmaLearningTools=Object.freeze({dashboard,levelFilter,readerTools,objectives,mapFilters,needsReview,noteExport});
})(window);
