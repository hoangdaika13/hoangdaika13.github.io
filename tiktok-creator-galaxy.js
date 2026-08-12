(function tiktokCreatorGalaxy(global) {
  "use strict";

  let host = null;
  let state = null;
  let remote = { configured: false, audited: false, connections: [], jobs: [], snapshots: [], projects: [], audits: [], providers: {}, security: {} };
  let busy = "";
  let toastTimer = 0;
  let toastState = null;
  let activeMediaFile = null;
  let activeMediaUrl = "";
  let profile = null;
  let accountVideos = [];
  let creatorInfoData = null;
  let publishFile = null;
  let publishFileUrl = "";
  let publishMedia = null;
  let uploadRuntime = { jobId: "", status: "idle", percent: 0, detail: "", retry: 0 };
  let uploadController = null;

  const core = () => global.HHTikTokCreatorCore;
  const connections = () => global.HHTikTokCreatorConnections;
  const analytics = () => global.HHTikTokCreatorAnalytics;
  const publishing = () => global.HHTikTokCreatorPublishing;
  const esc = (value) => core().escapeHtml(value);
  const activeWorkspace = () => core().WORKSPACES.find((item) => item.id === state.workspace) || core().WORKSPACES[0];
  const activeConnection = () => remote.connections?.find((item) => item.connectionId === state.connectionId) || remote.connections?.find((item) => item.active) || null;
  const formatNumber = (value) => Number(value || 0).toLocaleString("vi-VN", { maximumFractionDigits: 2 });
  const formatDate = (value) => { const date = new Date(value); return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date) : "—"; };
  const routeTo = (route) => { global.location.hash = `#${route}`; };
  const dataset = (id = state.workspace) => Array.isArray(state.datasets?.[id]) ? state.datasets[id] : [];

  function save() { state = core().saveState(state); }
  function statusBadge(statusKey, compact = false) {
    const status = core().STATUS[statusKey] || core().STATUS.unsupported;
    return `<span class="ttg-status ttg-status--${esc(status.tone)}" title="${esc(status.label)}"><i></i>${compact ? "" : esc(status.label)}</span>`;
  }
  function notify(message, kind = "success") {
    if (!host) return;
    toastState = { message: String(message || ""), kind: kind === "error" ? "error" : "success" };
    clearTimeout(toastTimer); render();
    toastTimer = setTimeout(() => { toastState = null; host?.querySelector(".ttg-toast")?.remove(); }, 4800);
  }
  function setBusy(value) { busy = value; render(); }

  function connectionButton() {
    const account = activeConnection();
    if (account) return `<button class="ttg-account-pill" type="button" data-action="workspace" data-workspace="developer"><span>${account.avatarUrl ? `<img src="${esc(account.avatarUrl)}" alt="">` : "TT"}</span><b>${esc(account.displayName || account.username || "TikTok")}</b><small>${account.active ? "Đang dùng" : "Đã kết nối"}</small></button>`;
    return `<button class="ttg-btn ttg-btn--primary" type="button" data-action="connect" ${busy ? "disabled" : ""}>Kết nối TikTok</button>`;
  }

  function topbar() {
    return `<header class="ttg-topbar">
      <div class="ttg-brand"><span><i></i></span><div><strong>TikTok Creator Galaxy</strong><small>18 workspace · local-first · API chính thức</small></div></div>
      <div class="ttg-top-status"><span class="${navigator.onLine ? "is-online" : "is-offline"}">${navigator.onLine ? "Online" : "Offline"}</span><span>${remote.configured ? "Login Kit sẵn sàng" : "Login Kit chưa cấu hình"}</span><span>${remote.audited ? "Content Posting đã audit" : "Chưa audit · SELF_ONLY"}</span></div>
      <div class="ttg-top-actions"><button class="ttg-icon-btn" type="button" data-action="refresh" aria-label="Đồng bộ" title="Đồng bộ">↻</button>${connectionButton()}</div>
    </header>`;
  }

  function sidebar() {
    return `<aside class="ttg-sidebar" aria-label="Hệ sinh thái TikTok">
      <div class="ttg-sidebar-head"><strong>6 trung tâm</strong><small>${core().WORKSPACES.length} công cụ</small></div>
      <nav>${core().HUBS.map((hub) => {
        const items = core().WORKSPACES.filter((item) => item.hub === hub.id); const open = state.hub === hub.id || items.some((item) => item.id === state.workspace);
        return `<section class="ttg-hub ${open ? "is-open" : ""}" style="--hub:${hub.color}">
          <button type="button" data-action="hub" data-hub="${hub.id}" aria-expanded="${open}"><i>${hub.icon}</i><b>${hub.label}</b><small>${items.length}</small><span>⌄</span></button>
          <div>${items.map((item) => `<button type="button" class="ttg-tool ${item.id === state.workspace ? "is-active" : ""}" data-action="workspace" data-workspace="${item.id}"><i>${item.icon}</i><span><b>${item.title}</b><small>${item.description}</small></span>${statusBadge(item.status, true)}</button>`).join("")}</div>
        </section>`;
      }).join("")}</nav>
    </aside>`;
  }

  function heading(extra = "") {
    const workspace = activeWorkspace();
    return `<div class="ttg-heading"><div><small>WORKSPACE ${String(workspace.no).padStart(2, "0")} · ${esc(core().HUBS.find((hub) => hub.id === workspace.hub)?.label || "")}</small><h2>${workspace.icon} ${workspace.title}</h2><p>${workspace.description}</p></div><div>${statusBadge(workspace.status)}${workspace.official ? `<a class="ttg-btn" href="${workspace.official}" target="_blank" rel="noopener noreferrer">Mở nguồn chính thức ↗</a>` : ""}${extra}</div></div>`;
  }
  function emptyImport(title, description, type = state.workspace) {
    return `<div class="ttg-empty"><span>⇧</span><strong>${esc(title)}</strong><p>${esc(description)}</p><label class="ttg-btn ttg-btn--primary">Chọn CSV / JSON<input hidden type="file" accept=".csv,.tsv,.json,application/json,text/csv" data-import="${esc(type)}"></label></div>`;
  }
  function importToolbar(type, label = "Nhập snapshot") {
    const rows = dataset(type);
    return `<div class="ttg-toolbar"><label class="ttg-btn">${label}<input hidden type="file" accept=".csv,.tsv,.json,application/json,text/csv" data-import="${esc(type)}"></label>${rows.length ? `<button class="ttg-btn" type="button" data-action="export-dataset" data-dataset="${esc(type)}">Xuất JSON</button><button class="ttg-btn ttg-btn--danger" type="button" data-action="clear-dataset" data-dataset="${esc(type)}">Xóa dữ liệu cục bộ</button>` : ""}<span>${rows.length.toLocaleString("vi-VN")} record · nguồn người dùng cung cấp</span></div>`;
  }
  function genericTable(rows, max = 50) {
    if (!rows.length) return "";
    const keys = [...new Set(rows.slice(0, max).flatMap((row) => Object.keys(row || {})))].slice(0, 8);
    return `<div class="ttg-table-wrap"><table><thead><tr><th>#</th>${keys.map((key) => `<th>${esc(key)}</th>`).join("")}</tr></thead><tbody>${rows.slice(0, max).map((row, index) => `<tr><td>${index + 1}</td>${keys.map((key) => `<td title="${esc(row[key])}">${esc(row[key])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>${rows.length > max ? `<p class="ttg-table-note">Đang preview ${max}/${rows.length} record. Toàn bộ dữ liệu vẫn được giữ cục bộ.</p>` : ""}`;
  }

  function trendsView() {
    const rows = dataset("trends"); const ranked = analytics().analyzeTrends(rows);
    return `${heading()}${importToolbar("trends", "Nhập trend CSV / JSON")}${!rows.length ? emptyImport("Bắt đầu bằng snapshot hợp lệ", "Cột gợi ý: name, views, previous_views, posts, relevance. Creative Center chỉ được mở bằng liên kết chính thức.", "trends") : `<div class="ttg-metrics"><article><small>Trend đã nhập</small><strong>${ranked.length}</strong><span>Dữ liệu cục bộ</span></article><article><small>Điểm cao nhất</small><strong>${ranked[0]?.score || 0}</strong><span>Điểm giải thích được</span></article><article><small>Tăng nhanh</small><strong>${ranked.filter((item) => item.velocity > 20).length}</strong><span>So với snapshot trước</span></article><article><small>Nguồn</small><strong>User</strong><span>Không scrape TikTok</span></article></div><div class="ttg-card"><h3>Trend radar</h3><div class="ttg-trends">${ranked.slice(0, 30).map((item, index) => `<article><b>${index + 1}</b><div><strong>${esc(item.name)}</strong><small>${formatNumber(item.views)} lượt xem · ${item.posts} video · saturation ${item.saturation}%</small></div><span class="${item.velocity >= 0 ? "is-up" : "is-down"}">${item.velocity >= 0 ? "+" : ""}${item.velocity}%</span><em style="--score:${item.score}%"><i></i>${item.score}</em></article>`).join("")}</div></div>`}<div class="ttg-source-note">TikTok Creative Center không có API công khai dùng cho workspace này. <a href="${core().OFFICIAL_LINKS.creativeCenter}" target="_blank" rel="noopener noreferrer">Mở Creative Center ↗</a></div>`;
  }

  function seoView() {
    const result = state.seoResult;
    return `${heading()}<div class="ttg-split"><form class="ttg-card ttg-form" data-form="seo"><h3>Search brief cục bộ</h3><label><span>Keyword hoặc chủ đề</span><input name="keyword" required maxlength="180" value="${esc(result?.raw || "")}" placeholder="Ví dụ: học edit video trên điện thoại"></label><label><span>Khán giả</span><input name="audience" maxlength="160" value="${esc(result?.audience || "người mới tại Việt Nam")}"></label><button class="ttg-btn ttg-btn--primary" type="submit">Tạo brief có giải thích</button><p class="ttg-honest">Không dùng dữ liệu tìm kiếm trực tiếp và không hứa video viral.</p></form><div class="ttg-card">${!result ? `<div class="ttg-empty ttg-empty--small"><span>⌕</span><strong>Chưa có brief</strong><p>Nhập chủ đề để tạo keyword cluster, hook, caption và hashtag.</p></div>` : `<h3>${esc(result.keyword)}</h3><div class="ttg-keyword-intent">Intent: <b>${esc(result.intent)}</b></div><h4>Long-tail</h4><div class="ttg-chip-list">${result.longTail.map((item) => `<span>${esc(item)}</span>`).join("")}</div><h4>Hook</h4><ol class="ttg-copy-list">${result.hooks.map((item) => `<li><span>${esc(item)}</span><button type="button" data-action="copy" data-copy="${esc(item)}">Sao chép</button></li>`).join("")}</ol><h4>Caption</h4><p>${esc(result.caption)}</p><div class="ttg-chip-list">${result.hashtags.map((item) => `<span>${esc(item)}</span>`).join("")}</div><p class="ttg-honest">${esc(result.note)}</p>`}</div></div>`;
  }

  function analyticsView() {
    const account = activeConnection(); const metrics = analytics().accountMetrics(profile || account || {}, accountVideos);
    if (!account) return `${heading()}<div class="ttg-gate"><span>TT</span><h3>Kết nối tài khoản của chính bạn</h3><p>Hệ thống chỉ đọc dữ liệu được scope TikTok trả về. Mỗi tài khoản HH có kho token riêng phía server.</p><button class="ttg-btn ttg-btn--primary" type="button" data-action="connect">Kết nối bằng Login Kit</button></div>`;
    return `${heading(`<button class="ttg-btn" type="button" data-action="load-account">Tải dữ liệu mới</button>`)}<div class="ttg-profile-strip">${account.avatarUrl ? `<img src="${esc(account.avatarUrl)}" alt="">` : `<span>TT</span>`}<div><strong>${esc(profile?.display_name || account.displayName || "Tài khoản TikTok")}</strong><small>@${esc(profile?.username || account.username || "—")} · nguồn: tài khoản đã kết nối</small></div></div><div class="ttg-metrics"><article><small>Follower</small><strong>${formatNumber(metrics.follower)}</strong><span>Display API</span></article><article><small>Video</small><strong>${formatNumber(metrics.videos)}</strong><span>${accountVideos.length} item đã tải</span></article><article><small>Views đã tải</small><strong>${formatNumber(metrics.views)}</strong><span>Không đại diện toàn lịch sử</span></article><article><small>Engagement</small><strong>${metrics.engagementRate}%</strong><span>Ước tính từ video trả về</span></article></div><div class="ttg-card"><h3>Video của tài khoản</h3>${accountVideos.length ? `<div class="ttg-video-grid">${accountVideos.map((video) => `<article>${video.cover_image_url ? `<img src="${esc(video.cover_image_url)}" alt="">` : `<span>▶</span>`}<div><strong>${esc(video.title || video.video_description || "Video TikTok")}</strong><small>${formatNumber(video.view_count)} views · ${formatNumber(video.like_count)} likes</small></div>${video.embed_link ? `<a href="${esc(video.embed_link)}" target="_blank" rel="noopener noreferrer">Mở ↗</a>` : ""}</article>`).join("")}</div>` : `<p class="ttg-honest">Bấm “Tải dữ liệu mới”. Nếu thiếu scope video.list, TikTok sẽ trả trạng thái thật.</p>`}</div>`;
  }

  function datasetView(options) {
    const rows = dataset(options.id);
    return `${heading()}${importToolbar(options.id, options.importLabel || "Nhập CSV / JSON")}${!rows.length ? emptyImport(options.emptyTitle, options.emptyDescription, options.id) : `${options.summary ? options.summary(rows) : ""}<div class="ttg-card"><h3>${esc(options.tableTitle || "Dữ liệu do người dùng cung cấp")}</h3>${genericTable(rows)}</div>`}${options.after || ""}`;
  }

  function videoView() {
    return `${heading(`<button class="ttg-btn ttg-btn--primary" type="button" data-action="route" data-route="/davinci-resolve/davinci">Mở trình biên tập ↗</button>`)}<div class="ttg-split"><div class="ttg-card"><h3>Kiểm tra video nguồn</h3><label class="ttg-dropzone"><input type="file" accept="video/*" data-media="video"><span>＋</span><strong>Chọn video trên máy</strong><small>File chỉ được đọc cục bộ cho đến khi bạn tự xác nhận upload.</small></label>${state.media ? mediaDetails(state.media) : ""}</div><div class="ttg-card"><h3>Chuẩn TikTok 9:16</h3><div class="ttg-safe-preview">${activeMediaUrl ? `<video src="${esc(activeMediaUrl)}" controls playsinline></video>` : `<span>1080 × 1920<small>Safe-zone preview</small></span>`}<i class="top"></i><i class="bottom"></i></div><ul class="ttg-checks"><li class="${state.media?.aspectOk ? "is-pass" : ""}">Tỉ lệ 9:16</li><li class="${state.media?.duration ? "is-pass" : ""}">Metadata thời lượng</li><li class="${state.media?.type?.startsWith("video/") ? "is-pass" : ""}">MIME video thật từ trình duyệt</li></ul></div></div>`;
  }
  function mediaDetails(media) { return `<dl class="ttg-details"><div><dt>Tên file</dt><dd>${esc(media.name)}</dd></div><div><dt>Dung lượng</dt><dd>${esc(core().formatBytes(media.size))}</dd></div><div><dt>Khung hình</dt><dd>${media.width || "—"} × ${media.height || "—"}</dd></div><div><dt>Thời lượng</dt><dd>${Number(media.duration || 0).toFixed(1)} giây</dd></div><div><dt>SHA-256</dt><dd title="${esc(media.checksum || "")}">${esc(media.checksum ? `${media.checksum.slice(0, 18)}…` : "Đang tính / chưa có")}</dd></div></dl>`; }

  function aiVideoView() {
    return `${heading()}<div class="ttg-launchpad"><div><small>TÁI SỬ DỤNG PIPELINE HIỆN CÓ</small><h3>AI Video Remake Studio</h3><p>Text → video, image → video, product → video, storyboard nhiều cảnh, queue pause/resume/retry và chi phí trước render.</p><ul><li>Không gửi media trước khi người dùng chọn model và xác nhận chi phí.</li><li>Nội dung tạo bằng AI phải được đánh dấu AIGC khi đăng.</li><li>API key luôn nằm ở backend hiện có.</li></ul><button class="ttg-btn ttg-btn--primary" type="button" data-action="route" data-route="/davinci-resolve/ai-video-remake">Mở AI Video Remake ↗</button></div><span class="ttg-ai-orb">AI<i></i></span></div>`;
  }

  function scriptView() {
    const script = state.activeScript;
    return `${heading()}<div class="ttg-split"><form class="ttg-card ttg-form" data-form="script"><h3>Script Director cục bộ</h3><label><span>Chủ đề</span><input name="topic" required maxlength="240" value="${esc(script?.topic || "")}" placeholder="Ví dụ: 3 cách chụp ảnh sản phẩm đẹp"></label><div class="ttg-two"><label><span>Thời lượng</span><select name="duration"><option value="15">15 giây</option><option value="30" selected>30 giây</option><option value="60">60 giây</option><option value="180">180 giây</option></select></label><label><span>Tone</span><select name="tone"><option>Tự nhiên</option><option>Năng động</option><option>Chuyên gia</option><option>Kể chuyện</option><option>Nhẹ nhàng</option></select></label></div><label><span>Khán giả</span><input name="audience" value="người xem Việt Nam" maxlength="180"></label><button class="ttg-btn ttg-btn--primary" type="submit">Tạo hook + shot list</button><p class="ttg-honest">Fallback này chạy cục bộ và xác định; không tự nhận là kết quả Gemini/OpenAI.</p></form><div class="ttg-card">${script ? `<div class="ttg-script-head"><h3>${esc(script.topic)}</h3><button class="ttg-btn" type="button" data-action="save-script-project">Lưu dự án</button></div><blockquote>${esc(script.hook)}</blockquote><h4>Voice-over</h4><p>${esc(script.voiceover)}</p><h4>Shot list</h4><ol class="ttg-shot-list">${script.shots.map((shot) => `<li>${esc(shot)}</li>`).join("")}</ol><h4>Caption & CTA</h4><p>${esc(script.caption)}<br>${esc(script.cta)}</p><div class="ttg-toolbar"><button class="ttg-btn" type="button" data-action="copy" data-copy="${esc(`${script.hook}\n\n${script.voiceover}\n\n${script.caption}\n${script.cta}`)}">Sao chép toàn bộ</button><button class="ttg-btn" type="button" data-action="download-script">Tải TXT</button></div>` : `<div class="ttg-empty ttg-empty--small"><span>✎</span><strong>Chưa có kịch bản</strong><p>Form bên trái tạo một bản nháp có thể dùng ngay mà không cần API.</p></div>`}</div></div>`;
  }

  function voiceView() {
    const cues = state.subtitle?.cues || [];
    return `${heading()}<div class="ttg-split"><div class="ttg-card"><h3>Giọng Việt cục bộ</h3><label class="ttg-field"><span>Nội dung nghe thử</span><textarea data-voice-text>Xin chào, đây là bản đọc thử tiếng Việt cho video TikTok của bạn.</textarea></label><div class="ttg-toolbar"><button class="ttg-btn ttg-btn--primary" type="button" data-action="voice-preview">Nghe thử</button><button class="ttg-btn" type="button" data-action="voice-stop">Dừng</button></div><p class="ttg-honest">Dùng Speech Synthesis của thiết bị. Giọng nữ Việt Nam được ưu tiên khi trình duyệt cung cấp; không gọi đây là chấm phát âm.</p></div><div class="ttg-card"><h3>Subtitle SRT / VTT</h3><label class="ttg-dropzone"><input type="file" accept=".srt,.vtt,text/vtt" data-subtitle><span>CC</span><strong>Chọn SRT hoặc VTT</strong><small>Parser và converter chạy hoàn toàn trên thiết bị.</small></label>${cues.length ? `<div class="ttg-subtitle-preview">${cues.slice(0, 10).map((cue) => `<article><time>${cue.start.toFixed(2)} → ${cue.end.toFixed(2)}</time><p>${esc(cue.text)}</p></article>`).join("")}</div><div class="ttg-toolbar"><button class="ttg-btn" type="button" data-action="subtitle-download" data-format="srt">Xuất SRT</button><button class="ttg-btn" type="button" data-action="subtitle-download" data-format="vtt">Xuất VTT</button></div>` : ""}</div></div>`;
  }

  function schedulerView() {
    const account = activeConnection(); const jobs = remote.jobs || [];
    const creator = creatorInfoData;
    const directMode = state.publishDraft?.mode === "direct";
    const canPublishDirect = account?.scopes?.includes("video.publish");
    const privacyOptions = creator?.privacyOptions?.length ? creator.privacyOptions : [];
    const selectedPrivacy = state.publishDraft?.privacyLevel || "";
    const runtimeJob = (job) => uploadRuntime.jobId === job.id ? uploadRuntime : null;
    const creatorPanel = account ? `<section class="ttg-creator-info ${creator ? "is-ready" : ""}">
      <header><div><small>CREATOR INFO MỚI NHẤT · DIRECT POST</small><strong>${esc(creator?.nickname || account.displayName || account.username || "TikTok Creator")}</strong></div>${canPublishDirect ? `<button class="ttg-btn" type="button" data-action="creator-info">${creator ? "Làm mới" : "Tải Creator Info"}</button>` : `<button class="ttg-btn" type="button" data-action="connect-direct">Cấp quyền Direct Post</button>`}</header>
      ${creator ? `<div><span><b>${creator.maxDuration || "—"}s</b><small>Thời lượng tối đa</small></span><span><b>${creator.privacyOptions.length}</b><small>Privacy option thật</small></span><span class="${creator.commentDisabled ? "is-off" : "is-on"}"><b>${creator.commentDisabled ? "Tắt" : "Cho phép"}</b><small>Comment</small></span><span class="${creator.duetDisabled ? "is-off" : "is-on"}"><b>${creator.duetDisabled ? "Tắt" : "Cho phép"}</b><small>Duet</small></span><span class="${creator.stitchDisabled ? "is-off" : "is-on"}"><b>${creator.stitchDisabled ? "Tắt" : "Cho phép"}</b><small>Stitch</small></span></div><p>Cập nhật ${formatDate(creator.fetchedAt)}. Quyền riêng tư bên dưới chỉ lấy từ phản hồi Creator Info này.</p>` : `<p>Phải tải Creator Info ngay trước Direct Post để xác nhận nickname, giới hạn và các lựa chọn hiện còn hiệu lực.</p>`}
    </section>` : "";
    const filePanel = `<section class="ttg-publish-media"><label class="ttg-dropzone ttg-dropzone--publish"><input type="file" accept="video/mp4,video/quicktime,video/webm" data-publish-video><span>▶</span><strong>${publishFile ? "Đổi video" : "Chọn video để preview"}</strong><small>MP4, MOV hoặc WebM · tối đa 4 GB · chưa upload khi chỉ chọn file</small></label>${publishFile ? `<div class="ttg-publish-preview"><video src="${esc(publishFileUrl)}" controls playsinline preload="metadata"></video><dl><div><dt>Tên</dt><dd>${esc(publishFile.name)}</dd></div><div><dt>MIME</dt><dd>${esc(publishFile.type)}</dd></div><div><dt>Dung lượng</dt><dd>${core().formatBytes(publishFile.size)}</dd></div><div><dt>Thời lượng</dt><dd>${Number(publishMedia?.duration || 0).toFixed(1)} giây</dd></div></dl></div>` : ""}</section>`;
    return `${heading()}${creatorPanel}<div class="ttg-publish-grid"><form class="ttg-card ttg-form" data-form="publish"><h3>Preflight Content Posting</h3>${filePanel}<label><span>Tài khoản đích</span><select name="connectionId" data-publish-connection required><option value="">Chọn tài khoản…</option>${remote.connections.map((item) => `<option value="${esc(item.connectionId)}" ${item.connectionId === state.connectionId ? "selected" : ""}>${esc(item.displayName || item.username || item.connectionId)}</option>`).join("")}</select></label><label><span>Caption</span><textarea name="title" maxlength="2200" placeholder="Caption có thể chỉnh sửa trước khi truyền">${esc(state.publishDraft?.title || "")}</textarea></label><div class="ttg-two"><label><span>Chế độ</span><select name="mode" data-publish-mode><option value="draft" ${!directMode ? "selected" : ""}>Upload Draft</option><option value="direct" ${directMode ? "selected" : ""}>Direct Post</option></select></label><label><span>Quyền riêng tư · không đặt mặc định</span><select name="privacyLevel" ${directMode ? "required" : ""} ${directMode && !creator ? "disabled" : ""}><option value="">${directMode ? (creator ? "Chọn quyền riêng tư…" : "Tải Creator Info trước…") : "Chọn trong ứng dụng TikTok"}</option>${directMode ? privacyOptions.map((id) => `<option value="${esc(id)}" ${selectedPrivacy === id ? "selected" : ""}>${esc(publishing().privacyLabel(id))}</option>`).join("") : ""}</select></label></div><label><span>Lịch nội bộ (không phải TikTok Scheduling API)</span><input type="datetime-local" name="scheduledFor" value="${esc(state.publishDraft?.scheduledFor || "")}"></label><p class="ttg-schedule-warning">Lịch chỉ lưu tác vụ và nhắc việc trong HH Platform. Đến giờ hệ thống không tự upload, không tự gửi TikTok; chủ tài khoản vẫn phải bấm “Bắt đầu upload”.</p><div class="ttg-switches ${directMode ? "" : "is-disabled"}"><label class="${creator?.commentDisabled ? "is-disabled" : ""}"><input type="checkbox" name="commentEnabled" ${!directMode || creator?.commentDisabled ? "disabled" : ""}><span>Cho phép bình luận</span></label><label class="${creator?.duetDisabled ? "is-disabled" : ""}"><input type="checkbox" name="duetEnabled" ${!directMode || creator?.duetDisabled ? "disabled" : ""}><span>Cho phép Duet</span></label><label class="${creator?.stitchDisabled ? "is-disabled" : ""}"><input type="checkbox" name="stitchEnabled" ${!directMode || creator?.stitchDisabled ? "disabled" : ""}><span>Cho phép Stitch</span></label><label><input type="checkbox" name="aigc"><span>Nội dung AI · is_aigc</span></label></div><fieldset class="ttg-commercial"><legend>Công bố nội dung thương mại</legend><label><input type="checkbox" name="commercialContent" ${!directMode ? "disabled" : ""}><span>Nội dung này quảng bá thương hiệu, sản phẩm hoặc dịch vụ</span></label><div><label><input type="checkbox" name="ownBrand" disabled><span>Thương hiệu của tôi · Promotional content</span></label><label><input type="checkbox" name="brandedContent" disabled><span>Thương hiệu bên thứ ba · Paid partnership</span></label></div></fieldset><div class="ttg-consents"><label><input type="checkbox" name="previewed" required><span>Tôi đã phát preview của đúng video sẽ truyền.</span></label><label><input type="checkbox" name="musicConfirmed" required><span>By posting, you agree to TikTok's Music Usage Confirmation.</span></label><label><input type="checkbox" name="brandedPolicyConfirmed" disabled><span>Nếu có nội dung tài trợ, tôi đồng ý TikTok's Branded Content Policy.</span></label><label><input type="checkbox" name="confirmed" required><span>Tôi đồng ý tạo tác vụ cho tài khoản TikTok đang hiển thị.</span></label></div><button class="ttg-btn ttg-btn--primary" type="submit" ${!account || !publishFile || (directMode && !creator) ? "disabled" : ""}>${!account ? "Cần kết nối TikTok" : !publishFile ? "Chọn video trước" : directMode && !creator ? "Tải Creator Info trước" : "Xác nhận và chuẩn bị tác vụ"}</button></form><div class="ttg-card"><h3>Hàng đợi xuất bản</h3>${jobs.length ? `<div class="ttg-job-list">${jobs.map((job) => { const runtime = runtimeJob(job); const progress = runtime ? runtime.percent : Math.round(job.progress || 0); return `<article><span class="ttg-job-state">${esc(runtime?.status || job.status)}</span><div><strong>${esc(job.kind)}</strong><small>${job.scheduledFor ? `Lịch nội bộ: ${formatDate(job.scheduledFor)} · không tự gửi` : formatDate(job.createdAt)} · retry ${(job.retryCount || 0) + (runtime?.retry || 0)}</small></div><em>${progress}%</em><progress max="100" value="${progress}"></progress>${runtime?.detail ? `<p>${esc(runtime.detail)}</p>` : ""}<div>${runtime?.status === "uploading" || runtime?.status === "polling" ? `<button type="button" data-action="cancel-upload" data-job="${job.id}">Dừng truyền</button>` : `<button type="button" class="ttg-job-upload" data-action="start-upload" data-job="${job.id}" ${!publishFile || !["ready", "scheduled-internal", "paused"].includes(job.status) ? "disabled" : ""}>Bắt đầu upload</button>`}<button type="button" data-action="poll-status" data-job="${job.id}" ${!job.providerReference && runtime?.status !== "polling" ? "disabled" : ""}>Kiểm tra trạng thái</button>${job.status === "paused" ? `<button type="button" data-action="job" data-control="resume" data-job="${job.id}">Tiếp tục queue</button>` : `<button type="button" data-action="job" data-control="pause" data-job="${job.id}">Tạm dừng queue</button>`}<button type="button" data-action="job" data-control="retry" data-job="${job.id}">Retry queue</button></div></article>`; }).join("")}</div>` : `<div class="ttg-empty ttg-empty--small"><span>◷</span><strong>Chưa có tác vụ</strong><p>Chuẩn bị job trước; video chỉ truyền sau một lần bấm “Bắt đầu upload” riêng biệt.</p></div>`}</div></div>`;
  }

  function communityView() {
    const rows = dataset("community");
    return `${heading()}${importToolbar("community", "Nhập comment / inbox được phép")}${!rows.length ? emptyImport("Community ở chế độ dữ liệu nhập", "Display API không cấp comment hoặc inbox. Nhập CSV/JSON bạn có quyền sử dụng để gắn nhãn và phân tích cục bộ.", "community") : `<div class="ttg-card"><h3>Hộp dữ liệu cục bộ</h3>${genericTable(rows)}</div>`}<div class="ttg-source-note">Sentiment nếu bổ sung sau này phải ghi rõ “AI ước tính”. Business Messaging chỉ bật khi app được TikTok duyệt.</div>`;
  }

  function liveView() {
    const plan = state.livePlan;
    return `${heading()}<div class="ttg-split"><form class="ttg-card ttg-form" data-form="live"><h3>Run-of-show</h3><label><span>Chủ đề LIVE</span><input name="title" required value="${esc(plan?.title || "")}"></label><div class="ttg-two"><label><span>Bắt đầu</span><input type="datetime-local" name="startsAt" value="${esc(plan?.startsAt || "")}"></label><label><span>Thời lượng phút</span><input type="number" min="10" max="480" name="duration" value="${plan?.duration || 60}"></label></div><label><span>Các phân đoạn, mỗi dòng một mục</span><textarea name="segments" placeholder="00:00 Chào khán giả&#10;05:00 Giới thiệu nội dung&#10;15:00 Demo"></textarea></label><label><span>Từ khóa moderation, phân cách dấu phẩy</span><input name="blocked" value="${esc(plan?.blocked?.join(", ") || "")}"></label><button class="ttg-btn ttg-btn--primary" type="submit">Lưu kế hoạch cục bộ</button></form><div class="ttg-card"><h3>Cue sheet</h3>${plan ? `<div class="ttg-cue-list"><strong>${esc(plan.title)}</strong><small>${formatDate(plan.startsAt)} · ${plan.duration} phút</small>${plan.segments.map((item, index) => `<p><i>${String(index + 1).padStart(2, "0")}</i>${esc(item)}</p>`).join("")}<button class="ttg-btn" type="button" data-action="export-live">Xuất cue JSON</button></div>` : `<div class="ttg-empty ttg-empty--small"><span>●</span><strong>Chưa có cue</strong><p>Tool này không tự lấy stream key và không vượt điều kiện LIVE của TikTok.</p></div>`}</div></div>`;
  }

  function gateView(kind) {
    const config = {
      shop: { title: "TikTok Shop Partner", text: "Catalog, order, inventory, logistics và finance chỉ chạy sau Seller OAuth và quyền Partner theo thị trường.", link: core().OFFICIAL_LINKS.shop, linkLabel: "Mở Partner Center", type: "shop", import: "Nhập export Seller Center" },
      affiliate: { title: "Affiliate workspace", text: "Theo dõi shortlist, commission và campaign từ CSV. Không scrape FastMoss, Kalodata hoặc TikTok Shop.", link: "https://seller-vn.tiktok.com/affiliate", linkLabel: "Mở Affiliate Center", type: "affiliate", import: "Nhập Affiliate CSV" },
      ads: { title: "TikTok for Business", text: "Campaign, report và creative API chỉ bật sau khi app được duyệt. Thay đổi budget/publish luôn cần xác nhận tác động.", link: core().OFFICIAL_LINKS.business, linkLabel: "Mở Business API", type: "ads", import: "Nhập report Ads" }
    }[kind];
    const rows = dataset(config.type);
    return `${heading()}<div class="ttg-gate ttg-gate--horizontal"><span>${kind === "ads" ? "AD" : kind === "shop" ? "SHOP" : "%"}</span><div><h3>${config.title}</h3><p>${config.text}</p><div class="ttg-toolbar"><a class="ttg-btn ttg-btn--primary" href="${config.link}" target="_blank" rel="noopener noreferrer">${config.linkLabel} ↗</a><label class="ttg-btn">${config.import}<input hidden type="file" accept=".csv,.tsv,.json" data-import="${config.type}"></label></div></div></div>${rows.length ? `<div class="ttg-card"><h3>Dữ liệu nhập thủ công · chưa đồng bộ API</h3>${genericTable(rows)}</div>` : ""}`;
  }

  function developerView() {
    const account = activeConnection();
    return `${heading()}<div class="ttg-developer-grid"><div class="ttg-card"><h3>Connection Vault</h3>${remote.connections.length ? `<div class="ttg-connection-list">${remote.connections.map((item) => `<article class="${item.connectionId === (account?.connectionId || "") ? "is-active" : ""}">${item.avatarUrl ? `<img src="${esc(item.avatarUrl)}" alt="">` : `<span>TT</span>`}<div><strong>${esc(item.displayName || item.username || "TikTok")}</strong><small>${esc((item.scopes || []).join(" · ") || "user.info.basic")}</small></div><button type="button" data-action="select-connection" data-connection="${esc(item.connectionId)}">Chọn</button><button type="button" class="is-danger" data-action="disconnect" data-connection="${esc(item.connectionId)}">Ngắt</button></article>`).join("")}</div>` : `<p class="ttg-honest">Chưa có kết nối. Client không bao giờ nhận access token hoặc refresh token.</p>`}<button class="ttg-btn ttg-btn--primary" type="button" data-action="connect">Thêm tài khoản bằng Login Kit</button></div><div class="ttg-card"><h3>API readiness</h3><div class="ttg-readiness"><p class="${remote.configured ? "is-pass" : ""}"><i>${remote.configured ? "✓" : "!"}</i><span><b>Login Kit</b><small>${remote.configured ? "Server đã có cấu hình" : "Thiếu biến môi trường phía server"}</small></span></p><p class="${remote.audited ? "is-pass" : ""}"><i>${remote.audited ? "✓" : "!"}</i><span><b>Content Posting audit</b><small>${remote.audited ? "Đã được đánh dấu audit" : "Chỉ SELF_ONLY"}</small></span></p><p class="${remote.webhook?.configured ? "is-pass" : ""}"><i>${remote.webhook?.configured ? "✓" : "!"}</i><span><b>Webhook ký HMAC</b><small>${remote.webhook?.configured ? "Sẵn sàng · chống replay/idempotent" : "Chưa cấu hình signing secret"}</small></span></p><p class="${remote.providers?.business ? "is-pass" : ""}"><i>${remote.providers?.business ? "✓" : "!"}</i><span><b>TikTok for Business</b><small>${remote.providers?.business ? "Adapter có cấu hình" : "Chưa cấu hình / chưa duyệt"}</small></span></p><p class="${remote.providers?.shop ? "is-pass" : ""}"><i>${remote.providers?.shop ? "✓" : "!"}</i><span><b>Shop Partner</b><small>${remote.providers?.shop ? "Adapter có cấu hình" : "Chưa cấu hình / chưa duyệt"}</small></span></p></div></div><div class="ttg-card ttg-card--full"><h3>Security & audit</h3><div class="ttg-security-strip"><span><b>Owner isolation</b>${remote.security?.ownerIsolation ? "Bật" : "Chưa xác nhận"}</span><span><b>Token Vault</b>${esc(remote.security?.tokenVault || "Server-only")}</span><span><b>OAuth state</b>${esc(remote.security?.oauthState || "Single-use state")}</span><span><b>Consent</b>${esc(remote.security?.directPostConsent || "Bắt buộc")}</span></div><div class="ttg-audit-list">${(remote.audits || []).slice(0, 12).map((item) => `<p><time>${formatDate(item.createdAt)}</time><b>${esc(item.action)}</b><span>${esc(item.result)}</span></p>`).join("") || `<p>Chưa có audit event cho owner hiện tại.</p>`}</div></div></div>`;
  }

  function mediaView() {
    return `${heading()}<div class="ttg-split"><div class="ttg-card"><h3>Media inspector & checksum</h3><label class="ttg-dropzone"><input type="file" accept="video/*,audio/*,image/*" data-media="utility"><span>▧</span><strong>Chọn media cục bộ</strong><small>Metadata và SHA-256 không rời thiết bị.</small></label>${state.media ? mediaDetails(state.media) : ""}</div><div class="ttg-card"><h3>Tiện ích an toàn</h3><div class="ttg-utility-list"><article><b>Aspect-ratio checker</b><span>${state.media?.width ? `${state.media.width}:${state.media.height} · ${state.media.aspectOk ? "phù hợp 9:16" : "cần crop/reframe"}` : "Chờ media"}</span></article><article><b>Subtitle converter</b><span>${state.subtitle?.cues?.length || 0} cue đã parse</span><button type="button" data-action="workspace" data-workspace="voice">Mở</button></article><article><b>Batch rename</b><span>Dùng file gốc và metadata quyền</span><button type="button" data-action="route" data-route="/davinci-resolve/image-text">Mở tool ảnh</button></article><article><b>Video editor</b><span>Crop, resize, compress và export</span><button type="button" data-action="route" data-route="/davinci-resolve/davinci">Mở editor</button></article></div><p class="ttg-honest">Không cung cấp TikTok downloader hoặc xóa watermark.</p></div></div>`;
  }

  function workspace() {
    switch (state.workspace) {
      case "trends": return trendsView();
      case "seo": return seoView();
      case "analytics": return analyticsView();
      case "competitors": return datasetView({ id: "competitors", importLabel: "Nhập competitor snapshot", emptyTitle: "So sánh dữ liệu bạn có quyền dùng", emptyDescription: "Cột gợi ý: account, followers, posts, views, likes, topic, captured_at.", tableTitle: "Competitor dataset" });
      case "video": return videoView();
      case "ai-video": return aiVideoView();
      case "script": return scriptView();
      case "voice": return voiceView();
      case "scheduler": return schedulerView();
      case "community": return communityView();
      case "shop": return gateView("shop");
      case "affiliate": return gateView("affiliate");
      case "products": return datasetView({ id: "products", importLabel: "Nhập dữ liệu shop", emptyTitle: "Product Research có nguồn rõ ràng", emptyDescription: "Nhập export của shop: product, revenue, orders, conversion, refund, price. Không dùng dữ liệu giả toàn thị trường.", tableTitle: "Product dataset" });
      case "live": return liveView();
      case "ads": return gateView("ads");
      case "influencers": return datasetView({ id: "influencers", importLabel: "Nhập Creator CRM", emptyTitle: "Tạo shortlist creator hợp lệ", emptyDescription: "Nhập creator thủ công hoặc CSV: name, contact, niche, fee, rights_period, deliverable, status.", tableTitle: "Creator CRM", after: `<div class="ttg-source-note"><a href="https://creatormarketplace.tiktok.com/" target="_blank" rel="noopener noreferrer">Mở TikTok One Creator Marketplace ↗</a> · Không tự quét creator hàng loạt.</div>` });
      case "developer": return developerView();
      case "media": return mediaView();
      default: return trendsView();
    }
  }

  function inspector() {
    const workspace = activeWorkspace(); const account = activeConnection(); const recentJobs = remote.jobs?.slice(0, 3) || [];
    return `<aside class="ttg-inspector ${state.compactInspector ? "is-compact" : ""}"><header><div><small>LIVE INSPECTOR</small><strong>${esc(workspace.title)}</strong></div><button type="button" data-action="toggle-inspector" aria-label="Thu gọn">${state.compactInspector ? "‹" : "›"}</button></header><div class="ttg-inspector-body"><section><h3>Kết nối</h3><div class="ttg-inspector-account">${account?.avatarUrl ? `<img src="${esc(account.avatarUrl)}" alt="">` : `<span>TT</span>`}<div><b>${esc(account?.displayName || "Chưa kết nối")}</b><small>${account ? `${account.scopes?.length || 0} scope đã cấp` : "Dữ liệu local vẫn dùng được"}</small></div></div></section><section><h3>Khả năng</h3>${statusBadge(workspace.status)}<p>${esc(core().STATUS[workspace.status]?.label || "")}</p></section><section><h3>Quyền & dữ liệu</h3><dl><div><dt>Owner</dt><dd>${esc(core().currentOwnerId())}</dd></div><div><dt>Local records</dt><dd>${dataset().length}</dd></div><div><dt>Audit</dt><dd>${remote.audited ? "Đã duyệt" : "Chưa duyệt"}</dd></div><div><dt>Privacy</dt><dd>${remote.audited ? "Theo Creator Info" : "SELF_ONLY"}</dd></div></dl></section><section><h3>Tác vụ gần đây</h3>${recentJobs.length ? recentJobs.map((job) => `<p class="ttg-mini-job"><b>${esc(job.kind)}</b><span>${esc(job.status)} · ${Math.round(job.progress || 0)}%</span></p>`).join("") : `<p>Chưa có tác vụ xuất bản.</p>`}</section><section><h3>Nguồn sự thật</h3><a href="${core().OFFICIAL_LINKS.developer}" target="_blank" rel="noopener noreferrer">TikTok Developer ↗</a><a href="${core().OFFICIAL_LINKS.posting}" target="_blank" rel="noopener noreferrer">Content Posting API ↗</a></section></div></aside>`;
  }

  function actionbar() {
    return `<footer class="ttg-actionbar"><button type="button" data-action="workspace" data-workspace="video"><i>＋</i><span>Upload</span></button><button type="button" data-action="workspace" data-workspace="script"><i>✎</i><span>Viết kịch bản</span></button><button type="button" data-action="route" data-route="/davinci-resolve/ai-video-remake"><i>AI</i><span>Tạo video</span></button><button type="button" data-action="workspace" data-workspace="scheduler"><i>◷</i><span>Lập lịch</span></button><button type="button" class="is-primary" data-action="workspace" data-workspace="scheduler"><i>↗</i><span>Đăng TikTok</span></button></footer>`;
  }

  function render() {
    if (!host || !core()) return;
    host.innerHTML = `<div class="ttg-shell" aria-busy="${Boolean(busy)}">${topbar()}<main class="ttg-main ${state.compactInspector ? "is-inspector-compact" : ""}">${sidebar()}<section class="ttg-workspace">${workspace()}</section>${inspector()}</main>${actionbar()}${busy ? `<div class="ttg-busy"><span></span><b>${esc(busy)}</b></div>` : ""}${toastState ? `<div class="ttg-toast ttg-toast--${toastState.kind}" role="status">${esc(toastState.message)}</div>` : ""}</div>`;
  }

  async function refresh(silent = true) {
    if (!connections()) return;
    try {
      if (!silent) setBusy("Đang đồng bộ TikTok…");
      remote = await connections().status();
      const account = activeConnection() || remote.connections?.find((item) => item.active) || remote.connections?.[0];
      if (account && !state.connectionId) { state.connectionId = account.connectionId; save(); }
      render(); if (!silent) notify("Đã đồng bộ trạng thái thật từ server.");
    } catch (error) { render(); if (!silent || error.status !== 401) notify(error.message, "error"); }
    finally { busy = ""; render(); }
  }

  async function importFile(input) {
    const file = input.files?.[0]; if (!file) return;
    const type = input.dataset.import || state.workspace;
    try {
      setBusy(`Đang đọc ${file.name}…`); const rows = core().parseImport(await file.text(), file.name); if (!rows.length) throw new Error("Không tìm thấy record hợp lệ.");
      state.datasets[type] = rows; save(); render(); notify(`Đã nhập ${rows.length} record vào kho riêng của tài khoản.`);
      if (["trends", "competitors", "products"].includes(type) && activeConnection()) analytics().importSnapshot(rows, type === "trends" ? "trend" : type, state.connectionId).then(() => refresh(true)).catch(() => {});
    } catch (error) { notify(error.message, "error"); }
    finally { busy = ""; input.value = ""; render(); }
  }

  async function sha256(file) { if (!global.crypto?.subtle) return "Không hỗ trợ Web Crypto"; const data = await file.arrayBuffer(); const digest = await global.crypto.subtle.digest("SHA-256", data); return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join(""); }
  async function inspectMedia(input) {
    const file = input.files?.[0]; if (!file) return;
    if (activeMediaUrl) URL.revokeObjectURL(activeMediaUrl); activeMediaFile = file; activeMediaUrl = URL.createObjectURL(file); setBusy("Đang đọc metadata và SHA-256…");
    try {
      const metadata = await new Promise((resolve) => {
        if (file.type.startsWith("image/")) {
          const image = new Image(); image.onload = () => resolve({ width: image.naturalWidth || 0, height: image.naturalHeight || 0, duration: 0 }); image.onerror = () => resolve({}); image.src = activeMediaUrl; return;
        }
        if (!file.type.startsWith("video/") && !file.type.startsWith("audio/")) return resolve({});
        const media = document.createElement(file.type.startsWith("video/") ? "video" : "audio"); media.preload = "metadata"; media.onloadedmetadata = () => { resolve({ width: media.videoWidth || 0, height: media.videoHeight || 0, duration: media.duration || 0 }); media.src = ""; }; media.onerror = () => resolve({}); media.src = activeMediaUrl;
      });
      const checksum = await sha256(file); const ratio = metadata.width && metadata.height ? metadata.width / metadata.height : 0;
      state.media = { name: file.name, size: file.size, type: file.type, lastModified: file.lastModified, ...metadata, checksum, aspectOk: ratio ? Math.abs(ratio - 9 / 16) < .035 : false }; save();
    } catch (error) { notify(error.message, "error"); }
    finally { busy = ""; render(); }
  }

  async function subtitleFile(input) {
    const file = input.files?.[0]; if (!file) return;
    try { const cues = core().parseSubtitles(await file.text()); if (!cues.length) throw new Error("Không tìm thấy cue subtitle hợp lệ."); state.subtitle = { name: file.name, cues }; save(); render(); notify(`Đã đọc ${cues.length} cue.`); }
    catch (error) { notify(error.message, "error"); }
    finally { input.value = ""; }
  }

  async function publishVideoFile(input) {
    const file = input.files?.[0]; if (!file) return;
    if (!["video/mp4", "video/quicktime", "video/webm"].includes(file.type)) { input.value = ""; return notify("Chỉ hỗ trợ video MP4, MOV hoặc WebM.", "error"); }
    if (!file.size || file.size > 4 * 1024 ** 3) { input.value = ""; return notify("Video phải lớn hơn 0 B và không quá 4 GB.", "error"); }
    if (publishFileUrl) URL.revokeObjectURL(publishFileUrl); publishFile = file; publishFileUrl = URL.createObjectURL(file); creatorInfoData = null;
    setBusy("Đang đọc metadata video trước khi upload…");
    try {
      publishMedia = await new Promise((resolve, reject) => { const video = document.createElement("video"); video.preload = "metadata"; video.onloadedmetadata = () => { resolve({ duration: Number(video.duration || 0), width: video.videoWidth || 0, height: video.videoHeight || 0 }); video.src = ""; }; video.onerror = () => reject(new Error("Không đọc được metadata video.")); video.src = publishFileUrl; });
      state.publishDraft = { ...(state.publishDraft || {}), fileName: file.name, fileSize: file.size, fileType: file.type }; save(); notify("Đã chọn video. Hãy xem preview rồi tải Creator Info mới nhất.");
    } catch (error) { publishFile = null; URL.revokeObjectURL(publishFileUrl); publishFileUrl = ""; notify(error.message, "error"); }
    finally { busy = ""; render(); input.value = ""; }
  }

  async function loadCreatorInfo(connectionId = state.connectionId) {
    if (!connectionId) return notify("Chưa chọn tài khoản TikTok.", "error");
    if (!activeConnection()?.scopes?.includes("video.publish")) return notify("Tài khoản chưa cấp video.publish. Hãy cấp quyền Direct Post trước.", "error");
    setBusy("Đang tải Creator Info mới nhất từ TikTok…");
    try {
      creatorInfoData = await publishing().creatorInfo(connectionId); state.connectionId = connectionId;
      if (creatorInfoData.maxDuration && publishMedia?.duration > creatorInfoData.maxDuration) notify(`Video dài ${publishMedia.duration.toFixed(1)}s, vượt giới hạn ${creatorInfoData.maxDuration}s.`, "error");
      else notify("Đã cập nhật nickname, privacy options và giới hạn Creator Info.");
    } catch (error) { creatorInfoData = null; notify(error.message, "error"); }
    finally { busy = ""; save(); render(); }
  }

  async function startUpload(jobId) {
    const job = remote.jobs?.find((item) => item.id === jobId); if (!job) return notify("Không tìm thấy tác vụ của owner hiện tại.", "error");
    if (!publishFile) return notify("Chọn lại đúng video trước khi upload. File không được lưu qua lần tải trang.", "error");
    if (job.scheduledFor && new Date(job.scheduledFor).getTime() > Date.now() && !global.confirm("Tác vụ có lịch nội bộ trong tương lai. Upload ngay bây giờ?")) return;
    uploadController?.abort(); uploadController = new AbortController(); uploadRuntime = { jobId, status: "initializing", percent: 1, detail: "Đang khởi tạo phiên upload TikTok…", retry: 0 }; render();
    try {
      const result = await publishing().uploadJob(jobId, publishFile, {
        signal: uploadController.signal,
        duration: Number(publishMedia?.duration || 0),
        onInitialized: (data) => { uploadRuntime = { ...uploadRuntime, status: "uploading", detail: `${data.totalChunkCount} chunk · URL hết hạn sau ${data.expiresIn || 3600}s` }; render(); },
        onProgress: (data) => { uploadRuntime = { ...uploadRuntime, status: data.percent >= 99 ? "polling" : "uploading", percent: data.percent, detail: `${core().formatBytes(data.uploaded)} / ${core().formatBytes(data.total)} · chunk ${data.chunk}/${data.chunks}` }; render(); },
        onRetry: ({ attempt, wait }) => { uploadRuntime = { ...uploadRuntime, retry: attempt, detail: `Mạng/API tạm lỗi · thử lại sau ${(wait / 1000).toFixed(1)}s` }; render(); },
        onStatus: (data) => { uploadRuntime = { ...uploadRuntime, status: data.job?.status || "processing", percent: data.job?.progress || 99, detail: data.job?.error || "TikTok đang xử lý video…" }; render(); }
      });
      uploadRuntime = { ...uploadRuntime, status: result?.job?.status || "processing", percent: result?.job?.progress || 100, detail: result?.job?.error || "TikTok đã nhận và xử lý xong trạng thái hiện tại." }; await refresh(true); notify("Upload hoàn tất; trạng thái lấy từ TikTok.");
    } catch (error) { uploadRuntime = { ...uploadRuntime, status: error?.name === "AbortError" ? "cancelled" : "failed", detail: error.message }; notify(error.message, error?.name === "AbortError" ? "success" : "error"); }
    finally { uploadController = null; render(); }
  }

  async function pollJob(jobId) {
    uploadController?.abort(); uploadController = new AbortController(); uploadRuntime = { jobId, status: "polling", percent: Math.max(2, uploadRuntime.jobId === jobId ? uploadRuntime.percent : 2), detail: "Đang hỏi trạng thái từ TikTok…", retry: 0 }; render();
    try { const result = await publishing().pollStatus(jobId, { signal: uploadController.signal, onStatus: (data) => { uploadRuntime = { ...uploadRuntime, status: data.job?.status || "processing", percent: data.job?.progress || 99, detail: data.job?.error || "TikTok đang xử lý…" }; render(); } }); await refresh(true); notify(`Trạng thái: ${result?.job?.status || "processing"}.`); }
    catch (error) { uploadRuntime = { ...uploadRuntime, status: error?.name === "AbortError" ? "cancelled" : "failed", detail: error.message }; notify(error.message, error?.name === "AbortError" ? "success" : "error"); }
    finally { uploadController = null; render(); }
  }

  async function loadAccount() {
    const account = activeConnection(); if (!account) return notify("Chưa kết nối TikTok.", "error");
    setBusy("Đang đọc dữ liệu tài khoản đã cấp quyền…");
    try { const [profileData, videosData] = await Promise.all([connections().profile(account.connectionId), connections().videos(account.connectionId, 20)]); profile = profileData.profile || {}; accountVideos = videosData.data?.videos || videosData.videos || []; notify("Đã tải dữ liệu được TikTok cấp quyền."); }
    catch (error) { notify(error.message, "error"); }
    finally { busy = ""; render(); }
  }

  async function onClick(event) {
    const button = event.target.closest("[data-action]"); if (!button || !host?.contains(button)) return;
    const action = button.dataset.action;
    if (action === "hub") { state.hub = button.dataset.hub; const first = core().WORKSPACES.find((item) => item.hub === state.hub); if (first) state.workspace = first.id; save(); render(); return; }
    if (action === "workspace") { const target = core().WORKSPACES.find((item) => item.id === button.dataset.workspace); if (target) { state.workspace = target.id; state.hub = target.hub; save(); render(); } return; }
    if (action === "toggle-inspector") { state.compactInspector = !state.compactInspector; save(); render(); return; }
    if (action === "route") { routeTo(button.dataset.route); return; }
    if (action === "refresh") { refresh(false); return; }
    if (action === "connect") { try { const scopes = state.workspace === "analytics" ? ["user.info.basic", "user.info.profile", "user.info.stats", "video.list"] : state.workspace === "scheduler" ? ["user.info.basic", "video.upload", "video.publish"] : ["user.info.basic"]; setBusy("Đang tạo phiên OAuth state bảo mật…"); await connections().connect(scopes); } catch (error) { busy = ""; render(); notify(error.message, "error"); } return; }
    if (action === "connect-direct") { try { setBusy("Đang xin quyền Direct Post…"); await connections().connect(["user.info.basic", "video.publish"]); } catch (error) { busy = ""; render(); notify(error.message, "error"); } return; }
    if (action === "select-connection") { try { setBusy("Đang đổi tài khoản…"); await connections().select(button.dataset.connection); state.connectionId = button.dataset.connection; creatorInfoData = null; save(); await refresh(true); notify("Đã chọn tài khoản TikTok. Hãy tải Creator Info mới trước khi đăng."); } catch (error) { notify(error.message, "error"); } finally { busy = ""; render(); } return; }
    if (action === "disconnect") { if (!global.confirm("Ngắt kết nối TikTok này? Token phía server sẽ bị thu hồi/xóa.")) return; try { setBusy("Đang thu hồi kết nối…"); await connections().disconnect(button.dataset.connection); if (state.connectionId === button.dataset.connection) state.connectionId = ""; save(); await refresh(true); notify("Đã ngắt kết nối."); } catch (error) { notify(error.message, "error"); } finally { busy = ""; render(); } return; }
    if (action === "load-account") { loadAccount(); return; }
    if (action === "creator-info") { loadCreatorInfo(); return; }
    if (action === "copy") { try { await navigator.clipboard.writeText(button.dataset.copy || ""); notify("Đã sao chép."); } catch { notify("Trình duyệt không cho phép clipboard.", "error"); } return; }
    if (action === "export-dataset") { const id = button.dataset.dataset; core().download(`tiktok-${id}-${Date.now()}.json`, JSON.stringify(dataset(id), null, 2), "application/json"); return; }
    if (action === "clear-dataset") { const id = button.dataset.dataset; if (global.confirm("Xóa bộ dữ liệu cục bộ này?")) { delete state.datasets[id]; save(); render(); } return; }
    if (action === "download-script" && state.activeScript) { core().download(`tiktok-script-${Date.now()}.txt`, `${state.activeScript.hook}\n\n${state.activeScript.voiceover}\n\n${state.activeScript.shots.join("\n")}\n\n${state.activeScript.caption}\n${state.activeScript.cta}`); return; }
    if (action === "save-script-project" && state.activeScript) { try { setBusy("Đang lưu dự án…"); await publishing().saveProject({ title: state.activeScript.topic, script: state.activeScript.voiceover, captions: `${state.activeScript.caption}\n${state.activeScript.cta}`, aigc: true, rights: { owned: true, musicConfirmed: false } }); await refresh(true); notify("Đã lưu dự án vào backend riêng của tài khoản."); } catch (error) { notify(error.message, "error"); } finally { busy = ""; render(); } return; }
    if (action === "voice-preview") { const text = host.querySelector("[data-voice-text]")?.value?.trim(); if (!text || !global.speechSynthesis) return notify("Thiết bị không hỗ trợ Speech Synthesis.", "error"); global.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); const voices = global.speechSynthesis.getVoices(); utterance.voice = voices.find((voice) => /^vi-/i.test(voice.lang) && /female|nữ|linh|mai|an/i.test(voice.name)) || voices.find((voice) => /^vi-/i.test(voice.lang)) || null; utterance.lang = "vi-VN"; global.speechSynthesis.speak(utterance); return; }
    if (action === "voice-stop") { global.speechSynthesis?.cancel(); return; }
    if (action === "subtitle-download") { const cues = state.subtitle?.cues || []; const format = button.dataset.format; core().download(`subtitle.${format}`, format === "vtt" ? core().subtitlesToVtt(cues) : core().subtitlesToSrt(cues), format === "vtt" ? "text/vtt" : "application/x-subrip"); return; }
    if (action === "job") { try { setBusy("Đang cập nhật queue…"); await publishing().control(button.dataset.job, button.dataset.control); await refresh(true); notify("Đã cập nhật tác vụ."); } catch (error) { notify(error.message, "error"); } finally { busy = ""; render(); } return; }
    if (action === "start-upload") { startUpload(button.dataset.job); return; }
    if (action === "poll-status") { pollJob(button.dataset.job); return; }
    if (action === "cancel-upload") { uploadController?.abort(); return; }
    if (action === "export-live" && state.livePlan) { core().download(`tiktok-live-plan-${Date.now()}.json`, JSON.stringify(state.livePlan, null, 2), "application/json"); }
  }

  async function onSubmit(event) {
    const form = event.target.closest("[data-form]"); if (!form || !host?.contains(form)) return; event.preventDefault(); const data = new FormData(form); const kind = form.dataset.form;
    if (kind === "seo") { const result = core().buildSeoBrief(data.get("keyword"), data.get("audience")); state.seoResult = { ...result, raw: String(data.get("keyword") || ""), audience: String(data.get("audience") || "") }; save(); render(); return; }
    if (kind === "script") { const script = core().buildScript(Object.fromEntries(data)); state.activeScript = script; state.scripts = [...(state.scripts || []), script].slice(-20); save(); render(); return; }
    if (kind === "live") { state.livePlan = { title: String(data.get("title") || ""), startsAt: String(data.get("startsAt") || ""), duration: Number(data.get("duration") || 60), segments: String(data.get("segments") || "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean), blocked: String(data.get("blocked") || "").split(",").map((item) => item.trim()).filter(Boolean), source: "local", updatedAt: new Date().toISOString() }; save(); render(); notify("Đã lưu kế hoạch LIVE cục bộ."); return; }
    if (kind === "publish") {
      const payload = { connectionId: String(data.get("connectionId") || ""), title: String(data.get("title") || ""), mode: String(data.get("mode") || "draft"), privacyLevel: String(data.get("privacyLevel") || ""), scheduledFor: String(data.get("scheduledFor") || "") || null, commentEnabled: data.get("commentEnabled") === "on", duetEnabled: data.get("duetEnabled") === "on", stitchEnabled: data.get("stitchEnabled") === "on", aigc: data.get("aigc") === "on", commercialContent: data.get("commercialContent") === "on", ownBrand: data.get("ownBrand") === "on", brandedContent: data.get("brandedContent") === "on", previewed: data.get("previewed") === "on", musicConfirmed: data.get("musicConfirmed") === "on", brandedPolicyConfirmed: data.get("brandedPolicyConfirmed") === "on", confirmed: data.get("confirmed") === "on", mediaType: "video", uploadSource: "FILE_UPLOAD", duration: Number(publishMedia?.duration || 0) };
      if (payload.mode === "direct" && (!creatorInfoData || String(creatorInfoData.fetchedAt || "") === "" || Date.now() - new Date(creatorInfoData.fetchedAt).getTime() > 5 * 60 * 1000)) return notify("Creator Info đã thiếu hoặc cũ quá 5 phút. Hãy tải lại trước khi chuẩn bị Direct Post.", "error");
      const errors = publishing().validate(payload, remote, creatorInfoData, publishFile); if (errors.length) return notify(errors.join(" "), "error");
      state.publishDraft = { title: payload.title, mode: payload.mode, privacyLevel: payload.privacyLevel, scheduledFor: payload.scheduledFor || "" }; save();
      try { setBusy("Đang chuẩn bị tác vụ đã xác nhận…"); const result = await publishing().prepare(payload, remote, creatorInfoData, publishFile); await refresh(true); uploadRuntime = { jobId: result.job?.id || "", status: result.job?.status || "ready", percent: 0, detail: payload.scheduledFor ? "Lịch nội bộ đã lưu · không tự upload" : "Đã chuẩn bị · bấm Bắt đầu upload để truyền file", retry: 0 }; notify(result.note || "Đã chuẩn bị tác vụ. Video chưa được upload."); }
      catch (error) { notify(error.message, "error"); }
      finally { busy = ""; render(); }
    }
  }

  function onChange(event) {
    if (event.target.matches("[data-import]")) importFile(event.target);
    else if (event.target.matches("[data-media]")) inspectMedia(event.target);
    else if (event.target.matches("[data-subtitle]")) subtitleFile(event.target);
    else if (event.target.matches("[data-publish-video]")) publishVideoFile(event.target);
    else if (event.target.matches("[data-publish-connection]")) { state.connectionId = event.target.value; creatorInfoData = null; save(); render(); }
    else if (event.target.matches("[data-publish-mode]")) { state.publishDraft = { ...(state.publishDraft || {}), mode: event.target.value, privacyLevel: "" }; creatorInfoData = null; save(); render(); }
    else if (event.target.matches('[name="commercialContent"]')) {
      const form = event.target.form; const enabled = event.target.checked;
      for (const name of ["ownBrand", "brandedContent", "brandedPolicyConfirmed"]) { const input = form?.elements?.namedItem(name); if (input) { input.disabled = !enabled; if (!enabled) input.checked = false; } }
    }
    else if (event.target.matches('[name="brandedContent"], [name="privacyLevel"]')) {
      const form = event.target.form, branded = form?.elements?.namedItem("brandedContent")?.checked === true, privacy = form?.elements?.namedItem("privacyLevel");
      if (branded && privacy?.value === "SELF_ONLY") { privacy.value = ""; notify("Nội dung tài trợ không thể dùng quyền riêng tư Chỉ mình tôi.", "error"); }
    }
  }

  function handleOauthResult() {
    const params = new URLSearchParams(global.location.search); const connected = params.get("tiktokConnected"); const error = params.get("tiktokError");
    if (!connected && !error) return;
    params.delete("tiktokConnected"); params.delete("tiktokError"); global.history.replaceState({}, "", `${global.location.pathname}${params.toString() ? `?${params}` : ""}${global.location.hash}`);
    setTimeout(() => notify(error || "Đã kết nối TikTok thành công.", error ? "error" : "success"), 0);
  }

  function mount(target) {
    if (!target || !core() || !connections() || !analytics() || !publishing()) { if (target) target.innerHTML = `<div class="ttg-load-error">TikTok Creator Galaxy chưa tải đủ service module.</div>`; return; }
    if (host && host !== target) unmount(); if (host === target) return;
    host = target; state = core().loadState(); remote = { configured: false, audited: false, connections: [], jobs: [], snapshots: [], projects: [], audits: [], providers: {}, security: {} }; profile = null; accountVideos = []; creatorInfoData = null; publishFile = null; publishMedia = null; uploadRuntime = { jobId: "", status: "idle", percent: 0, detail: "", retry: 0 }; toastState = null;
    host.addEventListener("click", onClick); host.addEventListener("submit", onSubmit); host.addEventListener("change", onChange); global.addEventListener("online", render); global.addEventListener("offline", render);
    handleOauthResult(); render(); refresh(true);
  }
  function unmount() {
    if (!host) return; host.removeEventListener("click", onClick); host.removeEventListener("submit", onSubmit); host.removeEventListener("change", onChange); global.removeEventListener("online", render); global.removeEventListener("offline", render); global.speechSynthesis?.cancel();
    if (activeMediaUrl) URL.revokeObjectURL(activeMediaUrl); if (publishFileUrl) URL.revokeObjectURL(publishFileUrl); uploadController?.abort(); uploadController = null; activeMediaFile = null; activeMediaUrl = ""; publishFile = null; publishFileUrl = ""; publishMedia = null; creatorInfoData = null; clearTimeout(toastTimer); toastState = null; host.innerHTML = ""; host = null; state = null; profile = null; accountVideos = [];
  }

  global.HHTikTokCreatorGalaxy = Object.freeze({ mount, unmount, VERSION: 1 });
  global.dispatchEvent(new CustomEvent("hh:tiktok-creator-galaxy-ready"));
})(window);
