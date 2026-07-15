(() => {
  "use strict";

  const API_BASE = String(window.HH_REALTIME_URL || "").replace(/\/$/, "");
  const $ = (root, selector) => root?.querySelector(selector);
  const $$ = (root, selector) => [...(root?.querySelectorAll(selector) || [])];
  const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  const initials = (name = "HH") => String(name).trim().split(/\s+/).slice(-2).map((part) => part[0] || "").join("").toUpperCase();
  const dateText = (value) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? "Gần đây" : date.toLocaleString("vi-VN"); };
  const authUser = () => { try { return JSON.parse(localStorage.getItem("hh-auth-user") || "{}"); } catch { return {}; } };
  const communityState = () => window.HHCommunity?.state?.() || {};
  let socialData = null;
  let currentView = "feed";
  let loadingPromise = null;
  let reelObserver = null;

  function toast(message, type = "success") {
    window.HHCommunity?.notice?.(message, type);
  }

  async function socialApi(options = {}) {
    if (!API_BASE) throw new Error("Backend Social chưa được cấu hình.");
    const token = localStorage.getItem("hh-auth-token") || "";
    const query = options.query ? `?${new URLSearchParams(options.query)}` : "";
    const response = await fetch(`${API_BASE}/api/social${query}`, {
      method: options.method || "GET",
      headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Không thể kết nối Social Hub.");
    return data;
  }

  function loadSocial(force = false) {
    if (socialData && !force) return Promise.resolve(socialData);
    if (loadingPromise && !force) return loadingPromise;
    loadingPromise = socialApi({ query: { view: "bootstrap" } }).then((data) => {
      socialData = data;
      return data;
    }).finally(() => { loadingPromise = null; });
    return loadingPromise;
  }

  function personOf(value = {}) {
    return value.person || value.user || value.requester || value.sender || value.target || value.profile || value;
  }

  function avatarMarkup(person, className = "") {
    const name = person?.displayName || person?.name || "Thành viên HH";
    return `<span class="${className}">${person?.avatar ? `<img src="${esc(person.avatar)}" alt="">` : esc(initials(name))}</span>`;
  }

  function head(title, description, actions = "", kicker = "HH SOCIAL HUB") {
    return `<header class="hh-v2-head"><div><small>${esc(kicker)}</small><h5>${esc(title)}</h5><p>${esc(description)}</p></div><div>${actions}</div></header>`;
  }

  function empty(icon, title, description, action = "") {
    return `<section class="hh-v2-empty"><i>${icon}</i><strong>${esc(title)}</strong><p>${esc(description)}</p>${action}</section>`;
  }

  function workspace(root) {
    let panel = $(root, "[data-social-v2-workspace]");
    if (!panel) {
      panel = document.createElement("section");
      panel.className = "hh-social-v2-workspace";
      panel.dataset.socialV2Workspace = "";
      panel.hidden = true;
      (root.querySelector(".hh-social-tabs") || root.querySelector(".community-hero"))?.after(panel);
    }
    return panel;
  }

  function updateNav(root) {
    const incoming = socialData?.requests?.incoming?.length || socialData?.incomingRequests?.length || 0;
    const saved = socialData?.saved?.length || socialData?.counts?.saved || 0;
    const pages = socialData?.pages?.length || 0;
    const badges = { friends: incoming, saved, pages };
    $$(root, "[data-social-v2-view]").forEach((button) => {
      button.classList.toggle("active", button.dataset.socialV2View === currentView);
      const badge = button.querySelector("b");
      if (badge) { const count = badges[button.dataset.socialV2View] || 0; badge.textContent = count; badge.hidden = !count; }
    });
  }

  function showFeed(root) {
    currentView = "feed";
    root.querySelector(".community-layout")?.removeAttribute("hidden");
    const panel = workspace(root);
    panel.hidden = true;
    updateNav(root);
  }

  function profileData() {
    const auth = authUser();
    const profile = socialData?.profile || socialData?.viewerProfile || {};
    return { id: profile.id || auth.id || "", displayName: profile.displayName || profile.name || auth.name || "Thành viên HH", username: profile.username || `hh_${String(auth.id || "member").slice(-6)}`, avatar: profile.avatar || auth.avatar || "", cover: profile.cover || "", bio: profile.bio || "Chia sẻ ý tưởng, kết nối và cùng sáng tạo trong cộng đồng HH.", city: profile.city || "", hometown: profile.hometown || "", workplace: profile.workplace || "", school: profile.school || "", relationship: profile.relationship || "", website: profile.website || "", birthday: profile.birthday || "", gender: profile.gender || "", pronouns: profile.pronouns || "", interests: Array.isArray(profile.interests) ? profile.interests : [], languages: Array.isArray(profile.languages) ? profile.languages : [], socialLinks: profile.socialLinks || {}, ...profile };
  }

  function renderProfile(panel) {
    const profile = profileData();
    const counts = socialData?.counts || {};
    const mine = (communityState().remotePosts || []).filter((post) => String(post.author?.id || "") === String(profile.id));
    const about = [
      ["⌖", profile.city && `Sống tại ${profile.city}`], ["⌂", profile.hometown && `Đến từ ${profile.hometown}`],
      ["▣", profile.workplace && `Làm việc tại ${profile.workplace}`], ["▤", profile.school && `Đã học tại ${profile.school}`],
      ["♡", profile.relationship], ["↗", profile.website]
    ].filter(([, value]) => value);
    panel.innerHTML = `<div class="hh-profile-cover" ${profile.cover ? `style="background-image:linear-gradient(0deg,rgba(4,8,12,.86),transparent 70%),url('${esc(profile.cover)}')"` : ""}></div>
      <section class="hh-profile-main">${avatarMarkup(profile, "hh-profile-avatar")}<div><h5>${esc(profile.displayName)}</h5><p>@${esc(profile.username)}</p><small>${esc(profile.bio)}</small></div><div><button class="hh-v2-action" type="button" data-v2-share-profile>Chia sẻ hồ sơ</button><button class="hh-v2-action primary" type="button" data-v2-edit-profile>Chỉnh sửa hồ sơ</button></div></section>
      <section class="hh-profile-stats"><article><strong>${counts.posts ?? mine.length}</strong><span>Bài viết</span></article><article><strong>${counts.friends ?? socialData?.friends?.length ?? 0}</strong><span>Bạn bè</span></article><article><strong>${counts.followers ?? 0}</strong><span>Người theo dõi</span></article><article><strong>${counts.following ?? 0}</strong><span>Đang theo dõi</span></article></section>
      <section class="hh-profile-grid"><article class="hh-v2-panel"><header><h6>Giới thiệu</h6><button type="button" data-v2-edit-profile>Chỉnh sửa</button></header><div class="hh-about-list">${about.map(([icon, value]) => `<p><i>${icon}</i><span>${esc(value)}</span></p>`).join("") || "<p>Hãy bổ sung thành phố, công việc và trường học để mọi người hiểu bạn hơn.</p>"}</div><div class="hh-interest-list">${profile.interests.map((item) => `<span>#${esc(item)}</span>`).join("")}</div></article><article class="hh-v2-panel"><header><h6>Bài viết gần đây</h6><button type="button" data-social-v2-view="feed">Mở bảng tin</button></header>${mine.length ? mine.slice(0, 5).map((post) => `<article class="hh-saved-card"><small>${dateText(post.createdAt)} · ${esc(post.privacy || "public")}</small><p>${esc(post.content || "Bài viết media")}</p><button class="hh-v2-action" type="button" data-v2-open-post="${esc(post.id)}">Xem bài viết</button></article>`).join("") : empty("＋", "Chưa có bài viết", "Bài viết bạn đăng sẽ xuất hiện tại đây.")}</article></section>`;
  }

  function personCard(item, mode) {
    const person = personOf(item);
    const id = person.id || person._id || item.targetId || item.requesterId || "";
    const name = person.displayName || person.name || "Thành viên HH";
    const mutual = item.mutualFriends || person.mutualFriends || 0;
    let actions = `<button class="primary" type="button" data-v2-relation="friend:request" data-target-id="${esc(id)}">Kết bạn</button><button type="button" data-v2-relation="follow:add" data-target-id="${esc(id)}">Theo dõi</button>`;
    if (mode === "incoming") actions = `<button class="primary" type="button" data-v2-relation="friend:accept" data-request-id="${esc(item.id || item._id || "")}">Chấp nhận</button><button type="button" data-v2-relation="friend:decline" data-request-id="${esc(item.id || item._id || "")}">Từ chối</button>`;
    const hasRelation = (key) => (socialData?.[key] || []).some((entry) => String(personOf(entry).id || personOf(entry)._id || entry.targetId) === String(id));
    const closeFriend = hasRelation("closeFriends");
    const priority = hasRelation("priority");
    const snoozed = hasRelation("snoozed");
    if (mode === "friend") actions = `<button type="button" data-v2-open-chat="${esc(id)}">Nhắn tin</button><button type="button" data-v2-relation="close-friend:${closeFriend ? "remove" : "add"}" data-target-id="${esc(id)}">${closeFriend ? "Bỏ bạn thân" : "Bạn thân"}</button><button type="button" data-v2-relation="priority:${priority ? "remove" : "add"}" data-target-id="${esc(id)}">${priority ? "Bỏ ưu tiên" : "Ưu tiên"}</button><button type="button" data-v2-relation="snooze:${snoozed ? "remove" : "add"}" data-target-id="${esc(id)}">${snoozed ? "Bỏ tạm ẩn" : "Tạm ẩn 30 ngày"}</button><button class="danger" type="button" data-v2-relation="friend:remove" data-target-id="${esc(id)}">Hủy kết bạn</button>`;
    if (mode === "close-friends") actions = `<button type="button" data-v2-open-chat="${esc(id)}">Nhắn tin</button><button class="danger" type="button" data-v2-relation="close-friend:remove" data-target-id="${esc(id)}">Bỏ bạn thân</button>`;
    if (mode === "priority") actions = `<button type="button" data-v2-open-chat="${esc(id)}">Nhắn tin</button><button class="danger" type="button" data-v2-relation="priority:remove" data-target-id="${esc(id)}">Bỏ ưu tiên</button>`;
    if (mode === "snoozed") actions = `<button class="primary" type="button" data-v2-relation="snooze:remove" data-target-id="${esc(id)}">Hiện lại ngay</button>`;
    if (mode === "blocked") actions = `<button class="primary" type="button" data-v2-relation="block:remove" data-target-id="${esc(id)}">Bỏ chặn</button><button type="button" data-social-v2-view="privacy">Quyền riêng tư</button>`;
    return `<article class="hh-person-card"><header>${avatarMarkup(person)}<div><strong>${esc(name)}</strong><small>@${esc(person.username || "hh_member")} · ${mutual} bạn chung</small></div></header><p>${esc(person.bio || person.city || "Thành viên cộng đồng HH")}</p><div class="hh-card-actions">${actions}</div></article>`;
  }

  function renderFriends(panel) {
    const incoming = socialData?.requests?.incoming || socialData?.incomingRequests || [];
    const friends = socialData?.friends || [];
    const suggestions = socialData?.suggestions || [];
    const blocked = socialData?.blocked || [];
    panel.innerHTML = `${head("Bạn bè & kết nối", "Quản lý lời mời, danh sách thân thiết, ưu tiên bảng tin và quyền tương tác trong một nơi.", `<button class="hh-v2-action" type="button" data-v2-friend-tab="blocked">Đã chặn</button><button class="hh-v2-action primary" type="button" data-v2-friend-tab="suggestions">Khám phá</button>`)}<section class="hh-v2-section"><nav class="hh-v2-tabs"><button class="active" type="button" data-v2-friend-tab="requests">Lời mời (${incoming.length})</button><button type="button" data-v2-friend-tab="friends">Bạn bè (${friends.length})</button><button type="button" data-v2-friend-tab="close-friends">Bạn thân (${(socialData?.closeFriends || []).length})</button><button type="button" data-v2-friend-tab="priority">Ưu tiên (${(socialData?.priority || []).length})</button><button type="button" data-v2-friend-tab="snoozed">Tạm ẩn (${(socialData?.snoozed || []).length})</button><button type="button" data-v2-friend-tab="suggestions">Có thể bạn biết</button><button type="button" data-v2-friend-tab="blocked">Đã chặn (${blocked.length})</button></nav><div class="hh-card-grid" data-v2-friend-grid>${(incoming.length ? incoming.map((item) => personCard(item, "incoming")) : suggestions.map((item) => personCard(item, "suggestion"))).join("") || empty("◎", "Không có lời mời mới", "Khi ai đó gửi lời mời kết bạn, thông tin sẽ xuất hiện tại đây.")}</div></section>`;
  }

  function mediaSource(item, post) {
    if (item?.id) return `${API_BASE}/api/community?media=${encodeURIComponent(item.id)}`;
    return item?.url || post?.mediaUrl || "";
  }

  function renderReels(panel) {
    const posts = communityState().remotePosts || [];
    const videos = posts.filter((post) => post.mediaType === "video" || (post.media || []).some((media) => media.type === "video"));
    panel.innerHTML = `${head("HH Reels", "Video dọc tự động phát, có âm thanh, reaction, lưu và chia sẻ trong cộng đồng.", `<button class="hh-v2-action" type="button" data-v2-reel-sound>Âm thanh: tắt</button><button class="hh-v2-action primary" type="button" data-v2-create-reel>Tạo video ngắn</button>`, "VIDEO NGẮN")}
      <section class="hh-v2-section"><div class="hh-reels-grid">${videos.map((post) => { const media = (post.media || []).find((item) => item.type === "video") || {}; return `<article class="hh-reel-card" data-v2-reel="${esc(post.id)}"><video src="${esc(mediaSource(media, post))}" muted loop playsinline preload="metadata"></video><aside><button type="button" data-post-react="${esc(post.id)}">♡</button><button type="button" data-v2-open-post="${esc(post.id)}">◌</button><button type="button" data-post-share="${esc(post.id)}">↗</button><button type="button" data-post-save="${esc(post.id)}">☆</button></aside><div><strong>${esc(post.author?.name || "HH Creator")}</strong><p>${esc(post.content || "Video mới trong HH Social")}</p><small>#HHReels · ${post.reactionCount || 0} cảm xúc</small></div></article>`; }).join("") || empty("▶", "Chưa có video ngắn", "Đăng video ở bảng tin để bắt đầu thư viện HH Reels.", `<button class="hh-v2-action primary" type="button" data-social-v2-view="feed">Mở trình đăng bài</button>`)}</div></section>`;
    observeReels(panel);
  }

  function observeReels(panel) {
    reelObserver?.disconnect();
    reelObserver = new IntersectionObserver((entries) => entries.forEach((entry) => {
      const video = entry.target;
      if (entry.isIntersecting && entry.intersectionRatio > .65) video.play().catch(() => {}); else video.pause();
    }), { threshold: [.2, .65] });
    $$(panel, ".hh-reel-card video").forEach((video) => reelObserver.observe(video));
  }

  function renderPages(panel) {
    const pages = socialData?.pages || [];
    panel.innerHTML = `${head("Trang & người sáng tạo", "Xây dựng thương hiệu, quản lý vai trò và theo dõi hiệu quả nội dung.", `<button class="hh-v2-action primary" type="button" data-v2-create-page>Tạo Trang</button>`, "CREATOR PAGES")}<section class="hh-v2-section"><div class="hh-card-grid">${pages.map((page) => `<article class="hh-page-card"><header>${avatarMarkup(page)}<div><strong>${esc(page.name)}</strong><small>@${esc(page.slug || page.username || "hh-page")} · ${esc(page.category || "Người sáng tạo")}</small></div></header><p>${esc(page.description || "Trang trong hệ sinh thái HH")}</p><small>${page.followerCount || 0} người theo dõi</small><div class="hh-card-actions"><button class="primary" type="button" data-v2-page-follow="${esc(page.id)}">${page.following ? "Đang theo dõi" : "Theo dõi"}</button><button type="button" data-v2-page-open="${esc(page.id)}">Xem Trang</button></div></article>`).join("") || empty("P", "Chưa có Trang", "Tạo Trang cho thương hiệu, tổ chức hoặc hồ sơ người sáng tạo của bạn.", `<button class="hh-v2-action primary" type="button" data-v2-create-page>Tạo Trang đầu tiên</button>`)}</div></section>`;
  }

  function renderGroups(panel) {
    const groups = communityState().communityGroups || [];
    const memberTotal = groups.reduce((sum, item) => sum + Number(item.memberCount || 0), 0);
    panel.innerHTML = `${head("Nhóm cộng đồng", "Tạo không gian theo sở thích, chia sẻ tài liệu và kết nối thành viên cùng chủ đề.", `<button class="hh-v2-action primary" type="button" data-v2-create-group>Tạo nhóm</button>`, "COMMUNITY GROUPS")}
      <section class="hh-v2-metric-row"><article><small>Nhóm khám phá</small><strong>${groups.length}</strong><span>Công khai trong HH</span></article><article><small>Thành viên</small><strong>${memberTotal.toLocaleString("vi-VN")}</strong><span>Tổng quy mô cộng đồng</span></article><article><small>Kiểm duyệt</small><strong>Chủ động</strong><span>Report và nội quy nhóm</span></article></section>
      <section class="hh-v2-section"><header class="hh-v2-section-title"><div><small>KHÁM PHÁ</small><h6>Nhóm phù hợp với bạn</h6></div><label class="hh-v2-inline-search"><span>⌕</span><input type="search" data-v2-group-search placeholder="Tìm nhóm..."></label></header><div class="hh-card-grid" data-v2-group-grid>${groups.map((group) => `<article class="hh-group-card" data-v2-group-card="${esc(group.name)}"><div class="hh-group-cover"><span>${esc(initials(group.name))}</span><i>${group.joined ? "Đã tham gia" : group.pending ? "Chờ duyệt" : group.visibility === "private" ? "Riêng tư" : "Công khai"}</i></div><div><small>NHÓM HH</small><strong>${esc(group.name)}</strong><p>${esc(group.description || "Không gian trao đổi dành cho thành viên HH.")}</p><span>${Number(group.memberCount || 0).toLocaleString("vi-VN")} thành viên</span></div><footer><button class="${group.joined || group.pending ? "" : "primary"}" type="button" data-v2-group-join="${esc(group.id)}" ${group.pending ? "disabled" : ""}>${group.joined ? "Đã tham gia" : group.pending ? "Đang chờ duyệt" : "Tham gia nhóm"}</button><button type="button" data-v2-group-open="${esc(group.id)}">Xem nhóm</button></footer></article>`).join("") || empty("G", "Chưa có nhóm công khai", "Hãy tạo cộng đồng đầu tiên theo chủ đề bạn quan tâm.", `<button class="hh-v2-action primary" type="button" data-v2-create-group>Tạo nhóm đầu tiên</button>`)}</div></section>`;
  }

  function renderEvents(panel) {
    const events = communityState().communityEvents || [];
    panel.innerHTML = `${head("Sự kiện & lịch cộng đồng", "Theo dõi buổi gặp, workshop, livestream và thêm lịch chỉ với một thao tác.", `<button class="hh-v2-action primary" type="button" data-v2-create-event>Tạo sự kiện</button>`, "EVENTS")}
      <section class="hh-v2-section"><div class="hh-event-list">${events.map((item) => { const date = new Date(item.startsAt); return `<article class="hh-event-card"><time><b>${Number.isNaN(date.getTime()) ? "--" : date.getDate()}</b><span>${Number.isNaN(date.getTime()) ? "SẮP TỚI" : date.toLocaleDateString("vi-VN", { month: "short" }).toUpperCase()}</span></time><div><small>${item.online ? "TRỰC TUYẾN" : "SỰ KIỆN HH"}</small><strong>${esc(item.name)}</strong><p>${esc(item.description || "Cập nhật mới từ cộng đồng HH.")}</p><span>${dateText(item.startsAt)} · ${Number(item.attendeeCount || 0)} người quan tâm</span></div><footer><button class="${item.going ? "" : "primary"}" type="button" data-v2-event-rsvp="${esc(item.id)}">${item.going ? "Sẽ tham gia" : "Quan tâm"}</button><button type="button" data-v2-event-calendar="${esc(item.id)}">Thêm vào lịch</button></footer></article>`; }).join("") || empty("E", "Chưa có sự kiện sắp tới", "Tạo workshop, buổi gặp hoặc livestream cho cộng đồng.", `<button class="hh-v2-action primary" type="button" data-v2-create-event>Tạo sự kiện</button>`)}</div></section>`;
  }

  function renderMemories(panel) {
    const today = new Date();
    const posts = communityState().remotePosts || [];
    const memories = posts.filter((post) => { const date = new Date(post.createdAt); return !Number.isNaN(date.getTime()) && date.getFullYear() < today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate(); });
    const older = [...posts].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).slice(0, 8);
    panel.innerHTML = `${head("Kỷ niệm của bạn", "Nhìn lại nội dung bạn vẫn còn quyền truy cập và chia sẻ lại khi sẵn sàng.", "", "ON THIS DAY")}
      <section class="hh-memory-hero"><small>${today.toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long" })}</small><h5>${memories.length ? `${memories.length} kỷ niệm vào ngày này` : "Mỗi khoảnh khắc đều có câu chuyện"}</h5><p>HH chỉ hiển thị nội dung vẫn còn đúng quyền riêng tư hiện tại.</p></section>
      <section class="hh-v2-section"><header class="hh-v2-section-title"><div><small>DÒNG THỜI GIAN</small><h6>${memories.length ? "Ngày này năm xưa" : "Những bài viết đầu tiên"}</h6></div></header><div class="hh-memory-grid">${(memories.length ? memories : older).map((post) => `<article><small>${dateText(post.createdAt)}</small><strong>${esc(post.author?.name || "HH Social")}</strong><p>${esc(post.content || "Một khoảnh khắc media")}</p><footer><button type="button" data-v2-open-post="${esc(post.id)}">Xem lại</button>${post.canReshare !== false ? `<button class="primary" type="button" data-post-share="${esc(post.id)}">Chia sẻ</button>` : ""}</footer></article>`).join("") || empty("◷", "Chưa có kỷ niệm", "Hãy bắt đầu đăng bài; kỷ niệm sẽ xuất hiện theo thời gian.")}</div></section>`;
  }

  function renderSaved(panel) {
    const saved = socialData?.saved || [];
    const collections = socialData?.collections || [];
    panel.innerHTML = `${head("Đã lưu & bộ sưu tập", "Giữ lại bài viết, video, sự kiện và liên kết để xem sau.", `<button class="hh-v2-action primary" type="button" data-v2-create-collection>Tạo bộ sưu tập</button>`, "PERSONAL LIBRARY")}
      <section class="hh-v2-section"><header class="hh-v2-section-title"><div><small>BỘ SƯU TẬP</small><h6>Sắp xếp theo chủ đề</h6></div><span>${collections.length} bộ sưu tập</span></header><div class="hh-collection-strip">${collections.map((item) => `<button type="button" data-v2-collection-open="${esc(item.id)}" style="--collection:${esc(item.color || "#62d7e7")}"><i>☆</i><strong>${esc(item.name)}</strong><small>${item.itemCount || 0} mục · ${esc(item.privacy || "private")}</small></button>`).join("") || `<button type="button" data-v2-create-collection><i>＋</i><strong>Tạo bộ sưu tập đầu tiên</strong><small>Nhóm nội dung muốn xem lại</small></button>`}</div></section>
      <section class="hh-v2-section"><nav class="hh-v2-tabs"><button class="active" type="button" data-v2-saved-filter="all">Tất cả</button><button type="button" data-v2-saved-filter="post">Bài viết</button><button type="button" data-v2-saved-filter="video">Video</button></nav><div class="hh-card-grid" data-v2-saved-grid>${saved.map((item) => { const post = item.post || item; return `<article class="hh-saved-card" data-saved-type="${post.mediaType === "video" ? "video" : "post"}"><small>${esc(post.topic || item.type || "Bài viết")} · ${dateText(item.savedAt || post.createdAt)}</small><strong>${esc(post.author?.name || item.title || "Nội dung đã lưu")}</strong><p>${esc(post.content || item.description || "Nội dung trong bộ sưu tập cá nhân")}</p><div class="hh-card-actions"><button class="primary" type="button" data-v2-open-post="${esc(post.id || item.targetId || "")}">Mở</button><button type="button" data-v2-add-collection="${esc(post.id || item.targetId || "")}">Thêm vào bộ sưu tập</button><button type="button" data-post-save="${esc(post.id || item.targetId || "")}">Bỏ lưu</button></div></article>`; }).join("") || empty("☆", "Chưa lưu nội dung", "Nhấn Lưu ở một bài viết hoặc video để nội dung xuất hiện tại đây.")}</div></section>`;
  }

  function renderActivity(panel) {
    const activity = socialData?.activity || [];
    panel.innerHTML = `${head("Nhật ký hoạt động", "Xem lại bài đăng, reaction, quan hệ xã hội và thay đổi quyền riêng tư của tài khoản.", `<button class="hh-v2-action" type="button" data-v2-export-activity>Xuất JSON</button>`, "ACCOUNT HISTORY")}<section class="hh-v2-section"><nav class="hh-v2-tabs"><button class="active" type="button" data-v2-activity-filter="all">Tất cả</button><button type="button" data-v2-activity-filter="post">Bài viết</button><button type="button" data-v2-activity-filter="friend">Kết nối</button><button type="button" data-v2-activity-filter="privacy">Quyền riêng tư</button></nav><div class="hh-activity-list">${activity.map((item) => `<article class="hh-activity-item" data-activity-type="${esc(item.type || "system")}"><i>${item.type?.includes("friend") ? "◎" : item.type?.includes("post") ? "P" : item.type?.includes("privacy") ? "◈" : "•"}</i><div><strong>${esc(item.title || item.type || "Hoạt động tài khoản")}</strong><p>${esc(item.description || item.message || "Đã cập nhật dữ liệu trong HH Social")}</p></div><time>${dateText(item.createdAt)}</time></article>`).join("") || empty("◷", "Chưa có hoạt động", "Hoạt động mới của tài khoản sẽ được ghi lại minh bạch tại đây.")}</div></section>`;
  }

  const privacyFields = [
    ["profileVisibility", "Hồ sơ", "Ai có thể xem trang cá nhân", ["public", "friends", "private"]],
    ["detailsVisibility", "Thông tin cá nhân", "Ai có thể xem nơi sống, học tập và công việc", ["public", "friends", "private"]],
    ["friendsVisibility", "Danh sách bạn bè", "Ai có thể xem danh sách bạn bè", ["public", "friends", "private"]],
    ["activityVisibility", "Nhật ký hoạt động", "Ai có thể xem hoạt động công khai", ["public", "friends", "private"]],
    ["birthdayVisibility", "Ngày sinh", "Ai có thể xem ngày sinh", ["public", "friends", "private"]],
    ["contactVisibility", "Liên hệ", "Ai có thể xem website và liên kết xã hội", ["public", "friends", "private"]],
    ["futurePostsVisibility", "Bài viết trong tương lai", "Đối tượng mặc định khi đăng bài", ["public", "friends", "followers", "private"]],
    ["friendRequestPermission", "Lời mời kết bạn", "Ai có thể gửi lời mời kết bạn", ["everyone", "friends_of_friends", "none"]],
    ["followPermission", "Theo dõi", "Ai có thể theo dõi tài khoản", ["everyone", "none"]],
    ["publicComments", "Bình luận công khai", "Ai có thể bình luận bài công khai", ["everyone", "followers", "friends"]],
    ["taggingPermission", "Gắn thẻ", "Ai có thể gắn thẻ bạn", ["everyone", "friends", "none"]],
    ["storyVisibility", "Quyền riêng tư của Tin", "Đối tượng mặc định của Tin", ["public", "friends", "close_friends", "private"]],
    ["emailLookup", "Tìm bằng email", "Ai có thể tìm hồ sơ qua email", ["everyone", "friends", "none"]],
    ["phoneLookup", "Tìm bằng số điện thoại", "Ai có thể tìm hồ sơ qua số điện thoại", ["everyone", "friends", "none"]]
  ];

  function renderPrivacy(panel) {
    const settings = socialData?.privacy || socialData?.profile?.privacy || {};
    const labels = { public: "Công khai", friends: "Bạn bè", followers: "Người theo dõi", private: "Chỉ mình tôi", everyone: "Mọi người", friends_of_friends: "Bạn của bạn bè", none: "Không ai", close_friends: "Bạn thân" };
    panel.innerHTML = `${head("Trung tâm quyền riêng tư", "Kiểm tra từng lớp quyền xem, kết nối, gắn thẻ và trạng thái hoạt động.", `<button class="hh-v2-action primary" type="button" data-v2-save-privacy>Lưu thay đổi</button>`, "PRIVACY CHECKUP")}<section class="hh-v2-section"><form class="hh-privacy-layout" data-v2-privacy-form><article class="hh-v2-panel hh-privacy-score"><b>${settings.score || 86}</b><strong>Điểm kiểm soát</strong><p>Điểm này phản ánh số thiết lập riêng tư bạn đã chủ động cấu hình.</p><div class="hh-privacy-pills"><span>${(socialData?.blocked || []).length} đã chặn</span><span>${(socialData?.restricted || []).length} hạn chế</span><span>${(socialData?.muted || []).length} tắt tiếng</span></div></article><article class="hh-v2-panel"><header><h6>Kiểm tra quyền theo từng bước</h6></header><div class="hh-setting-list">${privacyFields.map(([key, title, description, options]) => `<label class="hh-setting-row"><div><strong>${title}</strong><small>${description}</small></div><select name="${key}">${options.map((value) => `<option value="${value}" ${settings[key] === value ? "selected" : ""}>${labels[value] || value}</option>`).join("")}</select></label>`).join("")}<label class="hh-setting-row"><div><strong>Xét duyệt gắn thẻ</strong><small>Kiểm tra nội dung trước khi xuất hiện trên hồ sơ</small></div><input name="tagReview" type="checkbox" ${settings.tagReview !== false ? "checked" : ""}></label><label class="hh-setting-row"><div><strong>Xét duyệt dòng thời gian</strong><small>Duyệt bài người khác đăng lên hồ sơ của bạn</small></div><input name="timelineReview" type="checkbox" ${settings.timelineReview !== false ? "checked" : ""}></label><label class="hh-setting-row"><div><strong>Trạng thái hoạt động</strong><small>Cho phép bạn bè xem khi bạn đang online</small></div><input name="activeStatus" type="checkbox" ${settings.activeStatus !== false ? "checked" : ""}></label><label class="hh-setting-row"><div><strong>Biên nhận đã đọc</strong><small>Gửi trạng thái đã xem trong Messenger HH</small></div><input name="readReceipts" type="checkbox" ${settings.readReceipts !== false ? "checked" : ""}></label><label class="hh-setting-row"><div><strong>Quyền vị trí</strong><small>Chỉ dùng khi bạn chủ động chọn địa điểm check-in</small></div><input name="locationAccess" type="checkbox" ${settings.locationAccess ? "checked" : ""}></label><label class="hh-setting-row"><div><strong>Cho phép công cụ tìm kiếm</strong><small>Cho phép liên kết hồ sơ xuất hiện ngoài HH Platform</small></div><input name="searchIndexing" type="checkbox" ${settings.searchIndexing ? "checked" : ""}></label></div></article></form></section>`;
  }

  async function showView(root, view) {
    if (view === "feed") return showFeed(root);
    currentView = view;
    root.querySelector(".community-layout")?.setAttribute("hidden", "");
    const panel = workspace(root);
    panel.hidden = false;
    panel.innerHTML = `<div class="hh-v2-loading"><div><i></i><p>Đang tải Social Hub...</p></div></div>`;
    updateNav(root);
    try {
      await loadSocial();
      if (!root.isConnected || currentView !== view) return;
      if (view === "profile") renderProfile(panel);
      else if (view === "friends") renderFriends(panel);
      else if (view === "reels") renderReels(panel);
      else if (view === "pages") renderPages(panel);
      else if (view === "groups") renderGroups(panel);
      else if (view === "events") renderEvents(panel);
      else if (view === "memories") renderMemories(panel);
      else if (view === "saved") renderSaved(panel);
      else if (view === "activity") renderActivity(panel);
      else if (view === "privacy") renderPrivacy(panel);
      else showFeed(root);
      updateNav(root);
    } catch (error) {
      panel.innerHTML = `${head("Không thể tải Social Hub", error.message)}${empty("!", "Kết nối chưa sẵn sàng", "Hãy thử lại sau khi backend hoàn tất triển khai.", `<button class="hh-v2-action primary" type="button" data-v2-retry>Thử lại</button>`)}`;
    }
  }

  function decoratePosts(root) {
    const posts = communityState().remotePosts || [];
    $$(root, "[data-post-id]").forEach((node) => {
      const post = posts.find((item) => String(item.id) === String(node.dataset.postId));
      if (!post) return;
      if (post.hideReactionCounts) node.querySelector(".post-social-proof span")?.replaceChildren(document.createTextNode("Số cảm xúc đã được ẩn"));
      const share = node.querySelector("[data-post-share]");
      if (share && post.canReshare === false) { share.disabled = true; share.title = "Chủ bài viết đã tắt chia sẻ lại"; }
      const commentForm = node.querySelector("[data-comment-form]");
      if (commentForm && post.commentsEnabled === false) { commentForm.innerHTML = "<p>Bình luận đã được tắt cho bài viết này.</p>"; }
      $$(node, ".community-comment").forEach((commentNode, index) => {
        const sourceId = commentNode.querySelector("[data-comment-reply]")?.dataset.commentReply || commentNode.dataset.commentId;
        const comment = post.comments?.find((item) => String(item.id) === String(sourceId)) || post.comments?.[index];
        if (!comment || commentNode.dataset.v2Actions) return;
        commentNode.dataset.v2Actions = "true";
        commentNode.dataset.commentId = comment.id;
        commentNode.querySelector("small")?.insertAdjacentHTML("beforeend", ` · <button type="button" data-v2-comment-react="${esc(comment.id)}">${comment.viewerReaction ? "Đã thích" : "Thích"}</button> · <button type="button" data-v2-comment-more="${esc(comment.id)}">Tùy chọn</button>${comment.pinned ? " · Đã ghim" : ""}`);
      });
    });
  }

  function enhance(root) {
    if (!root || root.dataset.socialV2) return;
    root.dataset.socialV2 = "true";
    const profileCard = root.querySelector(".community-profile-card");
    profileCard?.insertAdjacentHTML("afterend", `<section class="hh-v2-nav"><strong>Không gian của bạn</strong>${[["feed","⌂","Bảng tin","#62d7e7"],["profile","ID","Hồ sơ cá nhân","#f05caf"],["friends","◎","Bạn bè & kết nối","#67dba1"],["reels","▶","Video ngắn","#f4d77d"],["groups","G","Nhóm cộng đồng","#67dba1"],["pages","P","Trang sáng tạo","#79a8ff"],["events","E","Sự kiện","#f0a174"],["memories","◷","Kỷ niệm","#f05caf"],["saved","☆","Đã lưu","#b991ff"],["activity","↺","Nhật ký hoạt động","#f0a174"],["privacy","◈","Quyền riêng tư","#67dba1"]].map(([id, icon, label, color]) => `<button type="button" data-social-v2-view="${id}" style="--item:${color}"><i>${icon}</i><span>${label}</span><b hidden>0</b></button>`).join("")}</section>`);
    const posts = root.querySelector("[data-community-posts]");
    posts?.insertAdjacentHTML("beforebegin", `<section class="hh-feed-control"><div><strong>Bảng tin thông minh</strong><small>Xếp hạng đa dạng, không chỉ dựa vào lượt thích</small></div><label><span>Sắp xếp</span><select data-v2-feed-mode><option value="ranked">Dành cho bạn</option><option value="latest">Mới nhất</option><option value="friends">Bạn bè</option></select><button type="button" data-v2-refresh-feed>↻ Làm mới</button></label></section>`);
    const composer = root.querySelector("[data-community-form]");
    const privacy = composer?.querySelector("[data-community-privacy]");
    if (privacy && !privacy.querySelector('[value="friends"]')) privacy.querySelector('[value="followers"]')?.insertAdjacentHTML("beforebegin", '<option value="friends">Bạn bè</option><option value="friends-of-friends">Bạn của bạn bè</option><option value="friends-except">Bạn bè ngoại trừ...</option><option value="specific">Bạn bè cụ thể...</option>');
    const composerActions = composer?.querySelector("footer > div");
    if (composerActions && !composerActions.querySelector("[data-v2-post-options]")) composerActions.insertAdjacentHTML("beforeend", '<button class="interactive" type="button" data-v2-post-options>⚙ Tùy chọn</button>');
    workspace(root);
    decoratePosts(root);
    loadSocial().then(() => updateNav(root)).catch(() => {});
  }

  function dialog(title, content, submitLabel = "Lưu thay đổi") {
    document.querySelector(".hh-social-v2-dialog")?.remove();
    const element = document.createElement("dialog");
    element.className = "hh-v2-dialog";
    element.innerHTML = `<form method="dialog"><header><div><small>HH SOCIAL</small><h5>${esc(title)}</h5></div><button type="button" data-v2-dialog-close>×</button></header><div class="hh-v2-form-grid">${content}</div><footer><button type="button" data-v2-dialog-close>Hủy</button><button class="primary" type="submit">${esc(submitLabel)}</button></footer></form>`;
    document.body.append(element);
    element.querySelectorAll("[data-v2-dialog-close]").forEach((button) => button.addEventListener("click", () => { element.close(); element.remove(); }));
    element.addEventListener("cancel", () => element.remove(), { once: true });
    element.showModal();
    return element;
  }

  function editProfile(root) {
    const profile = profileData();
    const fields = [["displayName","Tên hiển thị",profile.displayName],["username","Username duy nhất",profile.username],["bio","Tiểu sử",profile.bio,"textarea","wide"],["cover","Liên kết ảnh bìa",profile.cover],["avatar","Liên kết ảnh đại diện",profile.avatar],["birthday","Ngày sinh",profile.birthday,"date"],["gender","Giới tính",profile.gender],["pronouns","Đại từ xưng hô",profile.pronouns],["city","Nơi sống",profile.city],["hometown","Quê quán",profile.hometown],["workplace","Nơi làm việc",profile.workplace],["school","Trường học",profile.school],["relationship","Tình trạng quan hệ",profile.relationship],["website","Website",profile.website],["interests","Sở thích, phân cách bằng dấu phẩy",profile.interests.join(", "),"text","wide"],["languages","Ngôn ngữ, phân cách bằng dấu phẩy",profile.languages.join(", "),"text","wide"]];
    const modal = dialog("Chỉnh sửa hồ sơ", fields.map(([name, label, value, type = "text", className = ""]) => `<label class="${className}"><span>${label}</span>${type === "textarea" ? `<textarea name="${name}">${esc(value)}</textarea>` : `<input name="${name}" type="${type}" value="${esc(value)}">`}</label>`).join(""));
    modal.querySelector("form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const values = Object.fromEntries(new FormData(form));
      values.interests = String(values.interests || "").split(",").map((item) => item.trim()).filter(Boolean);
      values.languages = String(values.languages || "").split(",").map((item) => item.trim()).filter(Boolean);
      const submit = form.querySelector('[type="submit"]'); submit.disabled = true; submit.textContent = "Đang lưu...";
      try { await socialApi({ method: "POST", body: { action: "profile:update", ...values } }); modal.close(); modal.remove(); await loadSocial(true); renderProfile(workspace(root)); toast("Hồ sơ xã hội đã được cập nhật."); }
      catch (error) { toast(error.message, "error"); submit.disabled = false; submit.textContent = "Lưu thay đổi"; }
    });
  }

  function createPage(root) {
    const modal = dialog("Tạo Trang mới", `<label><span>Tên Trang</span><input name="name" required minlength="3" placeholder="HH Creator Studio"></label><label><span>Đường dẫn Trang</span><input name="slug" required pattern="[a-zA-Z0-9-]{3,60}" placeholder="hh-creator"></label><label><span>Danh mục</span><select name="category"><option>Người sáng tạo</option><option>Doanh nghiệp</option><option>Thương hiệu</option><option>Cộng đồng</option><option>Nghệ sĩ</option><option>Tổ chức</option></select></label><label class="wide"><span>Mô tả</span><textarea name="description" placeholder="Giới thiệu Trang..."></textarea></label>`, "Tạo Trang");
    modal.querySelector("form").addEventListener("submit", async (event) => { event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget)); try { await socialApi({ method: "POST", body: { action: "page:create", ...values } }); modal.close(); modal.remove(); await loadSocial(true); renderPages(workspace(root)); toast("Trang mới đã được tạo."); } catch (error) { toast(error.message, "error"); } });
  }

  function createGroup(root) {
    const modal = dialog("Tạo nhóm cộng đồng", `<label class="wide"><span>Tên nhóm</span><input name="name" required minlength="3" maxlength="100" placeholder="AI Creator Việt Nam"></label><label class="wide"><span>Giới thiệu</span><textarea name="description" maxlength="500" placeholder="Mục tiêu và nội dung của nhóm..."></textarea></label><label><span>Chủ đề</span><input name="topic" maxlength="80" placeholder="AI & Công nghệ"></label><label><span>Thẻ khám phá</span><input name="tags" maxlength="240" placeholder="AI, sáng tạo, video"></label><label class="wide"><span>Nội quy, mỗi dòng một mục</span><textarea name="rules" maxlength="1200" placeholder="Tôn trọng thành viên&#10;Không spam"></textarea></label><label class="wide"><span>Câu hỏi duyệt thành viên</span><textarea name="questions" maxlength="600" placeholder="Bạn muốn tham gia nhóm vì điều gì?"></textarea></label><label><span>Quyền riêng tư</span><select name="visibility"><option value="public">Công khai</option><option value="private">Riêng tư</option></select></label><label><span>Khả năng khám phá</span><select name="discovery"><option value="visible">Hiện khi tìm kiếm</option><option value="hidden">Ẩn khỏi khám phá</option></select></label><label><span>Kiểm duyệt bài</span><select name="postApproval"><option value="off">Đăng trực tiếp</option><option value="on">Duyệt trước khi đăng</option></select></label><label class="hh-setting-row"><div><strong>Bài ẩn danh</strong><small>Cho phép gửi bài không hiện tên</small></div><input name="anonymousPosts" type="checkbox"></label>`, "Tạo nhóm");
    modal.querySelector("form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const values = Object.fromEntries(formData);
      values.anonymousPosts = formData.has("anonymousPosts");
      try { await window.HHCommunity.mutate({ action: "group:create", ...values }); await window.HHCommunity.refresh({ silent: true }); modal.close(); modal.remove(); renderGroups(workspace(root)); toast("Nhóm mới đã được tạo."); }
      catch (error) { toast(error.message, "error"); }
    });
  }

  function createEvent(root) {
    const minimum = new Date(Date.now() + 15 * 60000).toISOString().slice(0, 16);
    const modal = dialog("Tạo sự kiện", `<label class="wide"><span>Tên sự kiện</span><input name="name" required minlength="3" maxlength="100" placeholder="Workshop sáng tạo cùng HH"></label><label><span>Bắt đầu</span><input name="startsAt" type="datetime-local" min="${minimum}" required></label><label><span>Kết thúc</span><input name="endsAt" type="datetime-local" min="${minimum}"></label><label><span>Hình thức</span><select name="eventType"><option value="online">Trực tuyến</option><option value="in-person">Trực tiếp</option></select></label><label><span>Quyền xem</span><select name="privacy"><option value="public">Công khai</option><option value="private">Riêng tư</option></select></label><label><span>Sức chứa</span><input name="capacity" type="number" min="0" max="100000" value="0" placeholder="0 = không giới hạn"></label><label><span>Lặp lại</span><select name="recurrence"><option value="none">Không lặp</option><option value="daily">Hàng ngày</option><option value="weekly">Hàng tuần</option><option value="monthly">Hàng tháng</option></select></label><label class="wide"><span>Địa điểm hoặc phòng họp</span><input name="location" maxlength="180" placeholder="Địa chỉ trực tiếp hoặc tên phòng"></label><label class="wide"><span>Liên kết tham gia</span><input name="meetingUrl" type="url" placeholder="https://..."></label><label class="wide"><span>Liên kết vé</span><input name="ticketUrl" type="url" placeholder="https://..."></label><label class="wide"><span>Mô tả</span><textarea name="description" maxlength="1000" placeholder="Nội dung, lịch trình và thông tin tham gia..."></textarea></label>`, "Đăng sự kiện");
    modal.querySelector("form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(event.currentTarget));
      try { await window.HHCommunity.mutate({ action: "event:create", ...values }); await window.HHCommunity.refresh({ silent: true }); modal.close(); modal.remove(); renderEvents(workspace(root)); toast("Sự kiện đã được công bố."); }
      catch (error) { toast(error.message, "error"); }
    });
  }

  async function performRelation(root, button) {
    button.disabled = true;
    const requested = button.dataset.v2Relation;
    const mapping = {
      "friend:request": { action: "friend:send" },
      "friend:accept": { action: "friend:respond", response: "accept" },
      "friend:decline": { action: "friend:respond", response: "decline" },
      "friend:cancel": { action: "friend:cancel" },
      "friend:remove": { action: "friend:remove" },
      "follow:add": { action: "relation:follow", active: true },
      "follow:remove": { action: "relation:follow", active: false },
      "block:add": { action: "relation:block", active: true },
      "block:remove": { action: "relation:block", active: false },
      "restrict:add": { action: "relation:restrict", active: true },
      "restrict:remove": { action: "relation:restrict", active: false },
      "mute:add": { action: "relation:mute", active: true },
      "mute:remove": { action: "relation:mute", active: false },
      "snooze:add": { action: "relation:snooze", active: true, days: 30 },
      "snooze:remove": { action: "relation:snooze", active: false },
      "priority:add": { action: "relation:priority", active: true },
      "priority:remove": { action: "relation:priority", active: false },
      "close-friend:add": { action: "relation:close-friend", active: true },
      "close-friend:remove": { action: "relation:close-friend", active: false },
      "acquaintance:add": { action: "relation:acquaintance", active: true },
      "acquaintance:remove": { action: "relation:acquaintance", active: false }
    };
    const payload = mapping[requested] || { action: requested };
    try {
      await socialApi({ method: "POST", body: { ...payload, targetId: button.dataset.targetId || "", requestId: button.dataset.requestId || "" } });
      await loadSocial(true);
      renderFriends(workspace(root));
      updateNav(root);
      toast("Quan hệ kết nối đã được cập nhật.");
    } catch (error) { toast(error.message, "error"); button.disabled = false; }
  }

  function setComposerValue(form, name, value) {
    let field = form.querySelector(`[data-v2-composer-value="${name}"]`);
    if (!field) {
      field = document.createElement("input");
      field.type = "hidden";
      field.dataset.v2ComposerValue = name;
      form.append(field);
    }
    field.value = String(value ?? "");
  }

  function choosePostAudience(select) {
    const mode = select.value;
    if (!["friends-except", "specific"].includes(mode)) {
      setComposerValue(select.form, "audienceIncludeIds", "[]");
      setComposerValue(select.form, "audienceExcludeIds", "[]");
      return;
    }
    const friends = socialData?.friends || [];
    if (!friends.length) {
      select.value = "friends";
      toast("Bạn cần có bạn bè trước khi tạo đối tượng tùy chỉnh.", "error");
      return;
    }
    const key = mode === "specific" ? "audienceIncludeIds" : "audienceExcludeIds";
    let selected = [];
    try { selected = JSON.parse(select.form.querySelector(`[data-v2-composer-value="${key}"]`)?.value || "[]"); } catch {}
    const modal = dialog(mode === "specific" ? "Chọn người có thể xem" : "Ẩn bài viết với bạn bè", `<section class="wide hh-v2-audience-list"><p>${mode === "specific" ? "Chỉ những người được chọn bên dưới có thể xem bài viết." : "Các bạn bè được chọn sẽ không nhìn thấy bài viết này."}</p>${friends.map((friend) => { const id = friend.id || friend._id || friend.userId; return `<label><input type="checkbox" name="audience" value="${esc(id)}" ${selected.includes(String(id)) ? "checked" : ""}>${avatarMarkup(friend)}<span><strong>${esc(friend.displayName || friend.name || friend.username || "Thành viên HH")}</strong><small>@${esc(friend.username || "hh-member")}</small></span></label>`; }).join("")}</section>`, "Áp dụng đối tượng");
    let saved = false;
    modal.querySelector("form").addEventListener("submit", (event) => {
      event.preventDefault();
      const ids = new FormData(event.currentTarget).getAll("audience").map(String);
      if (mode === "specific" && !ids.length) { toast("Hãy chọn ít nhất một người có thể xem.", "error"); return; }
      setComposerValue(select.form, "audienceIncludeIds", JSON.stringify(mode === "specific" ? ids : []));
      setComposerValue(select.form, "audienceExcludeIds", JSON.stringify(mode === "friends-except" ? ids : []));
      saved = true;
      modal.close(); modal.remove();
      toast(mode === "specific" ? `Đã chọn ${ids.length} người xem.` : `Đã loại trừ ${ids.length} bạn bè.`);
    });
    modal.querySelectorAll("[data-v2-dialog-close]").forEach((button) => button.addEventListener("click", () => { if (!saved) select.value = "friends"; }));
    modal.addEventListener("cancel", () => { if (!saved) select.value = "friends"; }, { once: true });
  }

  function postOptions(root) {
    const form = root.querySelector("[data-community-form]");
    if (!form) return;
    const value = (name, fallback = "") => form.querySelector(`[data-v2-composer-value="${name}"]`)?.value ?? fallback;
    const checked = (name, fallback) => value(name, String(fallback)) === "true";
    const modal = dialog("Tùy chọn bài viết", `<label><span>Lên lịch đăng</span><input name="scheduledAt" type="datetime-local" value="${esc(value("scheduledAt"))}"></label><label><span>Nền bài viết</span><select name="background"><option value="">Mặc định</option><option value="aurora" ${value("background") === "aurora" ? "selected" : ""}>Aurora</option><option value="sunset" ${value("background") === "sunset" ? "selected" : ""}>Hoàng hôn</option><option value="ocean" ${value("background") === "ocean" ? "selected" : ""}>Đại dương</option><option value="neon" ${value("background") === "neon" ? "selected" : ""}>Neon</option></select></label><label class="wide"><span>Ai có thể bình luận</span><select name="commentPermission"><option value="everyone" ${value("commentPermission", "everyone") === "everyone" ? "selected" : ""}>Mọi người</option><option value="friends" ${value("commentPermission") === "friends" ? "selected" : ""}>Bạn bè</option><option value="followers" ${value("commentPermission") === "followers" ? "selected" : ""}>Người theo dõi</option></select></label><label class="hh-setting-row wide"><div><strong>Cho phép chia sẻ lại</strong><small>Người xem có thể chia sẻ bài viết</small></div><input name="canReshare" type="checkbox" ${checked("canReshare", true) ? "checked" : ""}></label><label class="hh-setting-row wide"><div><strong>Cho phép bình luận</strong><small>Tắt khi bạn chỉ muốn phát thông báo</small></div><input name="commentsEnabled" type="checkbox" ${checked("commentsEnabled", true) ? "checked" : ""}></label><label class="hh-setting-row wide"><div><strong>Ẩn số cảm xúc</strong><small>Vẫn lưu reaction nhưng không công khai tổng số</small></div><input name="hideReactionCounts" type="checkbox" ${checked("hideReactionCounts", false) ? "checked" : ""}></label>`, "Áp dụng");
    modal.querySelector("form").addEventListener("submit", (event) => {
      event.preventDefault();
      const values = new FormData(event.currentTarget);
      setComposerValue(form, "scheduledAt", values.get("scheduledAt") || "");
      setComposerValue(form, "background", values.get("background") || "");
      setComposerValue(form, "commentPermission", values.get("commentPermission") || "everyone");
      ["canReshare", "commentsEnabled", "hideReactionCounts"].forEach((name) => setComposerValue(form, name, values.has(name)));
      modal.close(); modal.remove();
      toast(values.get("scheduledAt") ? "Đã lên lịch và lưu tùy chọn bài viết." : "Đã lưu tùy chọn bài viết.");
    });
  }

  async function editPost(root, post) {
    const modal = dialog("Chỉnh sửa bài viết", `<label class="wide"><span>Nội dung</span><textarea name="content" maxlength="5000" required>${esc(post.content || "")}</textarea></label>`, "Lưu bài viết");
    modal.querySelector("form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const content = String(new FormData(event.currentTarget).get("content") || "").trim();
      if (!content) return;
      try { await window.HHCommunity.mutate({ action: "edit", postId: post.id, content }); modal.close(); modal.remove(); decoratePosts(root); toast("Đã cập nhật bài viết."); }
      catch (error) { toast(error.message, "error"); }
    });
  }

  function editPostSettings(root, post) {
    const modal = dialog("Quyền bình luận & chia sẻ", `<label class="wide"><span>Ai có thể bình luận</span><select name="commentPermission"><option value="everyone" ${post.commentPermission === "everyone" || !post.commentPermission ? "selected" : ""}>Mọi người</option><option value="friends" ${post.commentPermission === "friends" ? "selected" : ""}>Bạn bè</option><option value="followers" ${post.commentPermission === "followers" ? "selected" : ""}>Người theo dõi</option></select></label><label class="hh-setting-row wide"><div><strong>Cho phép bình luận</strong><small>Thành viên có thể gửi phản hồi</small></div><input name="commentsEnabled" type="checkbox" ${post.commentsEnabled !== false ? "checked" : ""}></label><label class="hh-setting-row wide"><div><strong>Cho phép chia sẻ lại</strong><small>Giữ quyền xem của bài gốc khi chia sẻ</small></div><input name="canReshare" type="checkbox" ${post.canReshare !== false ? "checked" : ""}></label><label class="hh-setting-row wide"><div><strong>Ẩn số cảm xúc</strong><small>Không hiển thị tổng reaction công khai</small></div><input name="hideReactionCounts" type="checkbox" ${post.hideReactionCounts ? "checked" : ""}></label>`, "Lưu thiết lập");
    modal.querySelector("form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const values = new FormData(event.currentTarget);
      try { await window.HHCommunity.mutate({ action: "post:settings", postId: post.id, commentPermission: values.get("commentPermission") || "everyone", commentsEnabled: values.has("commentsEnabled"), canReshare: values.has("canReshare"), hideReactionCounts: values.has("hideReactionCounts") }); modal.close(); modal.remove(); decoratePosts(root); toast("Đã lưu quyền của bài viết."); }
      catch (error) { toast(error.message, "error"); }
    });
  }

  async function showPostMenu(root, postId) {
    const post = (communityState().remotePosts || []).find((item) => String(item.id) === String(postId));
    if (!post) return;
    const actions = post.owned ? [["edit","Sửa bài viết"],["pin",post.pinned?"Bỏ ghim":"Ghim bài"],["settings","Quyền bình luận & chia sẻ"],["archive","Lưu trữ"],["trash","Chuyển vào thùng rác"]] : [["notify",post.notificationSubscribed?"Tắt thông báo bài viết":"Bật thông báo bài viết"],["hide","Ẩn bài viết"],["not-interested","Xem ít nội dung tương tự"],["report","Báo cáo bài viết"]];
    const modal = dialog("Tùy chọn bài viết", actions.map(([id, label]) => `<button class="hh-v2-action ${id === "trash" || id === "report" ? "danger" : ""}" type="button" data-v2-post-action="${id}" data-post-id="${esc(postId)}">${label}</button>`).join(""), "Đóng");
    modal.querySelector("footer .primary").remove();
    modal.querySelectorAll("[data-v2-post-action]").forEach((button) => button.addEventListener("click", async () => {
      const action = button.dataset.v2PostAction;
      try {
        if (action === "edit") {
          modal.close(); modal.remove(); editPost(root, post); return;
        } else if (action === "settings") {
          modal.close(); modal.remove(); editPostSettings(root, post); return;
        } else if (action === "trash") {
          await window.HHCommunity.api({ method: "DELETE", query: `?id=${encodeURIComponent(postId)}` });
          await window.HHCommunity.refresh({ silent: true });
        } else if (action === "report") {
          await window.HHCommunity.mutate({ action: "report", postId, reason: "Người dùng gửi từ menu Social Hub" });
        } else if (action === "notify") {
          await window.HHCommunity.mutate({ action: "post:notifications", postId, active: !post.notificationSubscribed });
        } else await window.HHCommunity.mutate({ action: action === "pin" ? "post:pin" : action === "archive" ? "post:archive" : action === "hide" ? "post:hide" : "post:not-interested", postId });
        modal.close(); modal.remove(); toast("Đã cập nhật bài viết.");
      } catch (error) { toast(error.message, "error"); }
    }));
  }

  document.addEventListener("click", async (event) => {
    const root = event.target.closest("[data-community-center]");
    if (!root) return;
    const view = event.target.closest("[data-social-v2-view]");
    if (view) { event.preventDefault(); showView(root, view.dataset.socialV2View); return; }
    if (event.target.closest("[data-v2-retry]")) { socialData = null; showView(root, currentView); return; }
    if (event.target.closest("[data-v2-edit-profile]")) { editProfile(root); return; }
    if (event.target.closest("[data-v2-share-profile]")) { const url = `${location.origin}${location.pathname}?profile=${encodeURIComponent(profileData().username)}#/communication/community`; if (navigator.share) navigator.share({ title: profileData().displayName, url }).catch(() => {}); else navigator.clipboard.writeText(url).then(() => toast("Đã sao chép liên kết hồ sơ.")); return; }
    if (event.target.closest("[data-v2-create-page]")) { createPage(root); return; }
    if (event.target.closest("[data-v2-create-group]")) { createGroup(root); return; }
    if (event.target.closest("[data-v2-create-event]")) { createEvent(root); return; }
    if (event.target.closest("[data-v2-post-options]")) { postOptions(root); return; }
    const relation = event.target.closest("[data-v2-relation]"); if (relation) { performRelation(root, relation); return; }
    const friendTab = event.target.closest("[data-v2-friend-tab]");
    if (friendTab) { const mode = friendTab.dataset.v2FriendTab; const sources = { requests: socialData?.requests?.incoming || socialData?.incomingRequests || [], friends: socialData?.friends || [], blocked: socialData?.blocked || [], "close-friends": socialData?.closeFriends || [], priority: socialData?.priority || [], snoozed: socialData?.snoozed || [], suggestions: socialData?.suggestions || [] }; const list = sources[mode] || []; $$(root, "[data-v2-friend-tab]").forEach((button) => button.classList.toggle("active", button.dataset.v2FriendTab === mode)); const grid = $(root, "[data-v2-friend-grid]"); if (grid) grid.innerHTML = list.map((item) => personCard(item, mode === "requests" ? "incoming" : mode === "friends" ? "friend" : mode === "blocked" ? "blocked" : mode)).join("") || empty("◎", "Không có dữ liệu", "Danh sách này hiện đang trống."); return; }
    if (event.target.closest("[data-v2-refresh-feed]")) { await window.HHCommunity?.loadMode?.($(root, "[data-v2-feed-mode]")?.value || "ranked"); decoratePosts(root); return; }
    const openPost = event.target.closest("[data-v2-open-post]"); if (openPost) { showFeed(root); requestAnimationFrame(() => root.querySelector(`[data-post-id="${CSS.escape(openPost.dataset.v2OpenPost)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" })); return; }
    const more = event.target.closest("[data-post-more]"); if (more) { event.preventDefault(); event.stopImmediatePropagation(); showPostMenu(root, more.dataset.postMore); return; }
    const pageFollow = event.target.closest("[data-v2-page-follow]"); if (pageFollow) { try { await socialApi({ method: "POST", body: { action: "page:follow", pageId: pageFollow.dataset.v2PageFollow } }); await loadSocial(true); renderPages(workspace(root)); } catch (error) { toast(error.message, "error"); } return; }
    const groupJoin = event.target.closest("[data-v2-group-join]"); if (groupJoin) { groupJoin.disabled = true; try { await window.HHCommunity.mutate({ action: "group:join", groupId: groupJoin.dataset.v2GroupJoin }); await window.HHCommunity.refresh({ silent: true }); renderGroups(workspace(root)); } catch (error) { toast(error.message, "error"); groupJoin.disabled = false; } return; }
    const groupOpen = event.target.closest("[data-v2-group-open]"); if (groupOpen) { const group = (communityState().communityGroups || []).find((item) => String(item.id) === groupOpen.dataset.v2GroupOpen); if (!group) return; const modal = dialog(group.name, `<section class="wide hh-group-detail"><div class="hh-group-cover"><span>${esc(initials(group.name))}</span><i>${group.joined ? "Thành viên" : "Công khai"}</i></div><p>${esc(group.description || "Nhóm cộng đồng HH")}</p><strong>${Number(group.memberCount || 0).toLocaleString("vi-VN")} thành viên</strong><ul><li>Tôn trọng thành viên và quyền riêng tư.</li><li>Không spam, giả mạo hoặc chia sẻ nội dung nguy hiểm.</li><li>Dùng chức năng báo cáo khi cần hỗ trợ kiểm duyệt.</li></ul></section>`, "Đóng"); modal.querySelector("footer .primary")?.addEventListener("click", () => { modal.close(); modal.remove(); }); return; }
    const eventRsvp = event.target.closest("[data-v2-event-rsvp]"); if (eventRsvp) { eventRsvp.disabled = true; try { await window.HHCommunity.mutate({ action: "event:rsvp", eventId: eventRsvp.dataset.v2EventRsvp }); await window.HHCommunity.refresh({ silent: true }); renderEvents(workspace(root)); } catch (error) { toast(error.message, "error"); eventRsvp.disabled = false; } return; }
    const eventCalendar = event.target.closest("[data-v2-event-calendar]"); if (eventCalendar) { const item = (communityState().communityEvents || []).find((entry) => String(entry.id) === eventCalendar.dataset.v2EventCalendar); if (!item) return; const start = new Date(item.startsAt); const end = new Date(start.getTime() + 60 * 60 * 1000); const stamp = (date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//HH Platform//Community Event//VI\r\nBEGIN:VEVENT\r\nUID:${item.id}@hoangdaika13.github.io\r\nDTSTAMP:${stamp(new Date())}\r\nDTSTART:${stamp(start)}\r\nDTEND:${stamp(end)}\r\nSUMMARY:${String(item.name || "Sự kiện HH").replace(/[\r\n,;]/g, " ")}\r\nDESCRIPTION:${String(item.description || "").replace(/[\r\n]/g, " ")}\r\nEND:VEVENT\r\nEND:VCALENDAR`; const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" })); link.download = `hh-event-${item.id}.ics`; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); toast("Đã tạo tệp lịch cho sự kiện."); return; }
    const openChat = event.target.closest("[data-v2-open-chat]"); if (openChat) { localStorage.setItem("hh-pending-chat-user", openChat.dataset.v2OpenChat); location.hash = `chat-room-direct-${encodeURIComponent(openChat.dataset.v2OpenChat)}`; return; }
    const pageOpen = event.target.closest("[data-v2-page-open]"); if (pageOpen) { const page = (socialData?.pages || []).find((item) => String(item.id) === pageOpen.dataset.v2PageOpen); if (page) { const modal = dialog(page.name, `<section class="hh-page-preview wide">${avatarMarkup(page)}<div><small>${esc(page.category || "Trang cộng đồng")}</small><h4>${esc(page.name)}</h4><p>${esc(page.description || "Trang trong hệ sinh thái HH")}</p><strong>${Number(page.followerCount || 0).toLocaleString("vi-VN")} người theo dõi</strong></div></section>`, "Đóng"); modal.querySelector("footer .primary").addEventListener("click", () => { modal.close(); modal.remove(); }); } return; }
    if (event.target.closest("[data-v2-create-collection]")) { const modal = dialog("Tạo bộ sưu tập", '<label class="wide"><span>Tên bộ sưu tập</span><input name="name" maxlength="100" required placeholder="Ý tưởng muốn xem lại"></label><label class="wide"><span>Mô tả</span><textarea name="description" maxlength="400" placeholder="Mô tả ngắn..."></textarea></label><label><span>Quyền xem</span><select name="privacy"><option value="private">Chỉ mình tôi</option><option value="friends">Bạn bè</option><option value="public">Công khai</option></select></label><label><span>Màu nhận diện</span><input name="color" type="color" value="#62d7e7"></label>', "Tạo bộ sưu tập"); modal.querySelector("form").addEventListener("submit", async (submitEvent) => { submitEvent.preventDefault(); const values = Object.fromEntries(new FormData(submitEvent.currentTarget)); try { await socialApi({ method: "POST", body: { action: "collection:create", collection: values } }); modal.close(); modal.remove(); await loadSocial(true); renderSaved(workspace(root)); toast("Đã tạo bộ sưu tập cá nhân."); } catch (error) { toast(error.message, "error"); } }); return; }
    const addCollection = event.target.closest("[data-v2-add-collection]"); if (addCollection) { const collections = socialData?.collections || []; if (!collections.length) { event.target.closest("[data-v2-create-collection]")?.click(); toast("Hãy tạo một bộ sưu tập trước.", "error"); return; } const modal = dialog("Thêm vào bộ sưu tập", `<label class="wide"><span>Chọn bộ sưu tập</span><select name="collectionId">${collections.map((item) => `<option value="${esc(item.id)}">${esc(item.name)} (${item.itemCount || 0})</option>`).join("")}</select></label>`, "Thêm nội dung"); modal.querySelector("form").addEventListener("submit", async (submitEvent) => { submitEvent.preventDefault(); const collectionId = new FormData(submitEvent.currentTarget).get("collectionId"); try { await socialApi({ method: "POST", body: { action: "collection:item", collectionId, postId: addCollection.dataset.v2AddCollection, active: true } }); modal.close(); modal.remove(); await loadSocial(true); renderSaved(workspace(root)); toast("Đã thêm vào bộ sưu tập."); } catch (error) { toast(error.message, "error"); } }); return; }
    const openCollection = event.target.closest("[data-v2-collection-open]"); if (openCollection) { const collection = (socialData?.collections || []).find((item) => String(item.id) === openCollection.dataset.v2CollectionOpen); if (!collection) return; const posts = (socialData?.saved || []).filter((item) => collection.postIds?.includes(String((item.post || item).id))); const modal = dialog(collection.name, `<section class="wide"><p>${esc(collection.description || "Bộ sưu tập cá nhân")}</p><div class="hh-v2-collection-list">${posts.map((item) => { const post = item.post || item; return `<button type="button" data-v2-open-post="${esc(post.id)}"><strong>${esc(post.author?.name || "HH Social")}</strong><span>${esc(post.content || "Nội dung media")}</span></button>`; }).join("") || "<p>Chưa có nội dung trong bộ sưu tập này.</p>"}</div></section>`, "Đóng"); modal.querySelector("footer .primary")?.addEventListener("click", () => { modal.close(); modal.remove(); }); return; }
    const savedFilter = event.target.closest("[data-v2-saved-filter]"); if (savedFilter) { const mode = savedFilter.dataset.v2SavedFilter; $$(root, "[data-v2-saved-filter]").forEach((button) => button.classList.toggle("active", button === savedFilter)); $$(root, "[data-saved-type]").forEach((item) => { item.hidden = mode !== "all" && item.dataset.savedType !== mode; }); return; }
    if (event.target.closest("[data-v2-reel-sound]")) { const videos = $$(root, ".hh-reel-card video"); const muted = videos.every((video) => video.muted); videos.forEach((video) => { video.muted = !muted; }); event.target.closest("[data-v2-reel-sound]").textContent = `Âm thanh: ${muted ? "bật" : "tắt"}`; return; }
    if (event.target.closest("[data-v2-create-reel]")) { showFeed(root); setTimeout(() => root.querySelector("[data-community-add-media]")?.click(), 80); return; }
    const activityFilter = event.target.closest("[data-v2-activity-filter]"); if (activityFilter) { const mode = activityFilter.dataset.v2ActivityFilter; $$(root, "[data-v2-activity-filter]").forEach((button) => button.classList.toggle("active", button === activityFilter)); $$(root, ".hh-activity-item").forEach((item) => { item.hidden = mode !== "all" && !item.dataset.activityType.includes(mode); }); return; }
    if (event.target.closest("[data-v2-export-activity]")) { const blob = new Blob([JSON.stringify(socialData?.activity || [], null, 2)], { type: "application/json" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `hh-activity-${new Date().toISOString().slice(0, 10)}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); return; }
    if (event.target.closest("[data-v2-save-privacy]")) { $(root, "[data-v2-privacy-form]")?.requestSubmit(); return; }
    const commentReact = event.target.closest("[data-v2-comment-react]"); if (commentReact) { const postId = commentReact.closest("[data-post-id]")?.dataset.postId; const post = (communityState().remotePosts || []).find((item) => String(item.id) === postId); const comment = post?.comments?.find((item) => String(item.id) === commentReact.dataset.v2CommentReact); await window.HHCommunity.mutate({ action: "comment:react", postId, commentId: commentReact.dataset.v2CommentReact, type: comment?.viewerReaction ? "remove" : "like" }); return; }
    const commentMore = event.target.closest("[data-v2-comment-more]"); if (commentMore) { const postId = commentMore.closest("[data-post-id]")?.dataset.postId; const post = (communityState().remotePosts || []).find((item) => String(item.id) === String(postId)); const comment = post?.comments?.find((item) => String(item.id) === commentMore.dataset.v2CommentMore); if (!post || !comment) return; const actions = `${comment.owned ? '<button class="hh-v2-action" type="button" data-v2-comment-action="edit">Sửa bình luận</button><button class="hh-v2-action danger" type="button" data-v2-comment-action="delete">Xóa bình luận</button>' : '<button class="hh-v2-action danger" type="button" data-v2-comment-action="report">Báo cáo bình luận</button>'}${post.owned ? '<button class="hh-v2-action" type="button" data-v2-comment-action="pin">Ghim / bỏ ghim</button>' : ''}`; const modal = dialog("Tùy chọn bình luận", actions, "Đóng"); modal.querySelector("footer .primary")?.remove(); modal.querySelectorAll("[data-v2-comment-action]").forEach((button) => button.addEventListener("click", async () => { const action = button.dataset.v2CommentAction; try { if (action === "edit") { modal.close(); modal.remove(); const editor = dialog("Sửa bình luận", `<label class="wide"><span>Nội dung</span><textarea name="text" required maxlength="1200">${esc(comment.text || "")}</textarea></label>`, "Lưu bình luận"); editor.querySelector("form").addEventListener("submit", async (editEvent) => { editEvent.preventDefault(); const text = String(new FormData(editEvent.currentTarget).get("text") || "").trim(); if (!text) return; await window.HHCommunity.mutate({ action: "comment:edit", postId, commentId: comment.id, text }); editor.close(); editor.remove(); decoratePosts(root); toast("Đã sửa bình luận."); }); return; } await window.HHCommunity.mutate({ action: `comment:${action}`, postId, commentId: comment.id, reason: "Bình luận không phù hợp" }); modal.close(); modal.remove(); decoratePosts(root); toast("Đã cập nhật bình luận."); } catch (error) { toast(error.message, "error"); } })); return; }
  }, true);

  document.addEventListener("submit", async (event) => {
    const form = event.target.closest("[data-v2-privacy-form]");
    if (!form) return;
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form));
    form.querySelectorAll('input[type="checkbox"]').forEach((input) => { values[input.name] = input.checked; });
    try { await socialApi({ method: "POST", body: { action: "privacy:update", settings: values } }); await loadSocial(true); renderPrivacy(workspace(form.closest("[data-community-center]"))); toast("Đã lưu cài đặt quyền riêng tư."); } catch (error) { toast(error.message, "error"); }
  });

  document.addEventListener("change", async (event) => {
    const privacy = event.target.closest("[data-community-privacy]");
    if (privacy) {
      choosePostAudience(privacy);
      return;
    }
    const feedMode = event.target.closest("[data-v2-feed-mode]");
    if (!feedMode) return;
    const root = feedMode.closest("[data-community-center]");
    if (!root) return;
    feedMode.disabled = true;
    try { await window.HHCommunity?.loadMode?.(feedMode.value); decoratePosts(root); }
    catch (error) { toast(error.message, "error"); }
    finally { feedMode.disabled = false; }
  });

  document.addEventListener("input", (event) => {
    const search = event.target.closest("[data-v2-group-search]");
    if (!search) return;
    const term = search.value.trim().toLocaleLowerCase("vi");
    $$(search.closest("[data-social-v2-workspace]"), "[data-v2-group-card]").forEach((card) => {
      card.hidden = Boolean(term) && !card.textContent.toLocaleLowerCase("vi").includes(term);
    });
  });

  let enhanceFrame = 0;
  const observer = new MutationObserver(() => {
    if (enhanceFrame) return;
    enhanceFrame = requestAnimationFrame(() => {
      enhanceFrame = 0;
      const root = document.querySelector("[data-community-center]");
      if (root) { enhance(root); decoratePosts(root); }
      else reelObserver?.disconnect();
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  const initial = document.querySelector("[data-community-center]");
  if (initial) enhance(initial);
})();
