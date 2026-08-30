(function galaxyCommunityShowcaseBootstrap(global, factory) {
  "use strict";

  var api = factory(global || {});
  if (typeof module === "object" && module.exports) module.exports = api;
  if (global) global.HHGalaxyCommunityShowcase = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function galaxyCommunityShowcaseFactory(global) {
  "use strict";

  var VERSION = "1.0.0";
  var ROUTE = "/communication/community";
  var ROUTE_ALIASES = Object.freeze([ROUTE, "/galaxy/community-showcase"]);
  var instances = new WeakMap();
  var mountedRoots = new Set();
  var FILTERS = Object.freeze([
    ["all", "Nổi bật"], ["project", "Dự án"], ["artwork", "Tác phẩm"],
    ["music", "Âm nhạc"], ["video", "Video"], ["prompt", "Prompt"]
  ]);

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character];
    });
  }

  function clone(value) {
    try { return JSON.parse(JSON.stringify(value)); } catch (error) { return null; }
  }

  function cleanRoute(value) {
    var route = String(value || "").replace(/^#/, "").split("?")[0].split(";")[0].trim();
    if (!route) return ROUTE;
    route = route.charAt(0) === "/" ? route : "/" + route;
    return route.length > 1 ? route.replace(/\/+$/, "") : route;
  }

  function canHandle(route) { return ROUTE_ALIASES.indexOf(cleanRoute(route)) >= 0; }

  function postIdFromRoute(value) {
    var source = String(value || global.location && global.location.hash || "");
    var query = source.indexOf("?") >= 0 ? source.slice(source.indexOf("?") + 1).split("#")[0] : "";
    if (!query) return "";
    try {
      var params = new (global.URLSearchParams || URLSearchParams)(query);
      return String(params.get("post") || "").trim().slice(0, 160);
    } catch (error) {
      var match = query.match(/(?:^|&)post=([^&]*)/);
      try { return match ? decodeURIComponent(match[1]).trim().slice(0, 160) : ""; }
      catch (_) { return ""; }
    }
  }

  function safeUrl(value) {
    var raw = String(value || "").trim();
    if (!raw) return "";
    try {
      var url = new URL(raw, global.location && global.location.href || "https://hoang8.com/");
      return ["http:", "https:", "blob:"].indexOf(url.protocol) >= 0 ? url.href : "";
    } catch (error) { return ""; }
  }

  function finiteCount(value) {
    var count = Number(value);
    return Number.isFinite(count) && count >= 0 ? Math.floor(count) : null;
  }

  function list(value) { return Array.isArray(value) ? value : []; }

  function isRecord(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }

  function itemType(item) {
    var source = String(item.type || item.kind || item.mediaType || item.category || item.topic || "").toLowerCase();
    if (/video|film|reel/.test(source)) return "video";
    if (/music|audio|nhạc|podcast/.test(source)) return "music";
    if (/prompt/.test(source)) return "prompt";
    if (/art|image|ảnh|design|tác phẩm/.test(source)) return "artwork";
    if (/project|dự án/.test(source)) return "project";
    return "post";
  }

  function firstMedia(item) {
    var media = list(item.media || item.attachments)[0] || {};
    return safeUrl(item.thumbnail || item.coverUrl || media.thumbnail || media.url || item.mediaUrl || item.imageUrl);
  }

  function authorOf(item) {
    var source = item.author && typeof item.author === "object" ? item.author : {};
    return {
      id: String(source.id || source._id || item.authorId || ""),
      name: String(source.displayName || source.name || item.authorName || (typeof item.author === "string" ? item.author : "Thành viên HH")),
      avatar: safeUrl(source.avatar || source.avatarUrl || item.authorAvatar),
      verified: source.verified === true || item.authorVerified === true
    };
  }

  function normalizeItem(item, index) {
    var author = authorOf(item || {});
    var content = String(item.content || item.description || item.excerpt || "").trim();
    var title = String(item.title || content.split(/\r?\n/)[0] || "Bài chia sẻ cộng đồng").trim().slice(0, 180);
    return {
      id: String(item.id || item._id || "community-item-" + index),
      title: title,
      description: content && content !== title ? content.slice(0, 360) : "",
      type: itemType(item),
      media: firstMedia(item),
      author: author,
      createdAt: item.createdAt || item.publishedAt || item.updatedAt || "",
      reactions: finiteCount(item.reactionCount != null ? item.reactionCount : item.likes),
      comments: finiteCount(item.commentCount != null ? item.commentCount : list(item.comments).length),
      saves: finiteCount(item.saveCount),
      viewerReaction: String(item.viewerReaction || ""),
      saved: item.saved === true,
      source: item
    };
  }

  function normalizePerson(person, index) {
    person = person && typeof person === "object" ? person : {};
    return {
      id: String(person.id || person._id || "person-" + index),
      name: String(person.displayName || person.name || person.username || "Thành viên HH"),
      avatar: safeUrl(person.avatar || person.avatarUrl),
      role: String(person.role || person.tagline || person.bio || "Thành viên cộng đồng"),
      verified: person.verified === true,
      followers: finiteCount(person.followerCount != null ? person.followerCount : person.followers)
    };
  }

  function payloadData(payload) {
    payload = payload && typeof payload === "object" ? payload : {};
    var posts = list(payload.items).concat(list(payload.posts)).concat(list(payload.showcase));
    var unique = new Map();
    posts.forEach(function (item, index) {
      if (!isRecord(item)) return;
      var normalized = normalizeItem(item, index);
      if (!unique.has(normalized.id)) unique.set(normalized.id, normalized);
    });
    var suggestions = list(payload.suggestions || payload.creators).filter(isRecord).map(normalizePerson);
    var featured = isRecord(payload.featuredCreator) ? normalizePerson(payload.featuredCreator, 0) : null;
    var leaderboard = list(payload.leaderboard).filter(isRecord).map(normalizePerson);
    var tags = list(payload.trendingHashtags || payload.tags).map(function (tag) {
      return String(tag && tag.name || tag || "").replace(/^#/, "").trim();
    }).filter(Boolean).slice(0, 12);
    return {
      items: Array.from(unique.values()), suggestions: suggestions, featured: featured,
      leaderboard: leaderboard, tags: tags, stats: payload.stats && typeof payload.stats === "object" ? payload.stats : {},
      unread: finiteCount(payload.unread), fetchedAt: payload.checkedAt || new Date().toISOString()
    };
  }

  function authUser() {
    try { return JSON.parse(global.localStorage && global.localStorage.getItem("hh-auth-user") || "{}"); }
    catch (error) { return {}; }
  }

  function initials(name) {
    return String(name || "HH").trim().split(/\s+/).slice(-2).map(function (part) { return part.charAt(0); }).join("").toUpperCase();
  }

  function avatar(person, className) {
    return '<span class="gcs-avatar ' + (className || "") + '">' + (person.avatar ? '<img src="' + escapeHtml(person.avatar) + '" alt="">' : escapeHtml(initials(person.name))) + "</span>";
  }

  function dateLabel(value) {
    if (!value) return "Chưa ghi nhận thời gian";
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Chưa ghi nhận thời gian";
    return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(date);
  }

  function numberLabel(value) {
    return value == null ? "" : new Intl.NumberFormat("vi-VN", { notation: value >= 10000 ? "compact" : "standard" }).format(value);
  }

  function statusMarkup(runtime) {
    var labels = {
      loading: "Đang tải dữ liệu thật", ready: "Đã đồng bộ backend", cached: "Bản sao đã đồng bộ",
      empty: "Kho cộng đồng đang trống", offline: "Thiết bị đang ngoại tuyến",
      "configuration-required": "Cần cấu hình backend", error: "Không thể tải dữ liệu"
    };
    return '<span class="gcs-status" data-state="' + runtime.capability + '"><i></i>' + escapeHtml(labels[runtime.capability] || runtime.capability) + "</span>";
  }

  function emptyStateTitle(capability) {
    var labels = {
      empty: "Showcase chưa có nội dung",
      offline: "Không thể kết nối Community",
      "configuration-required": "Community backend chưa được cấu hình",
      error: "Không thể tải Community Showcase",
      cached: "Bản sao Community chưa có nội dung"
    };
    return labels[capability] || "Showcase chưa có nội dung";
  }

  function sortItems(runtime) {
    var direction = runtime.sort === "oldest" ? 1 : -1;
    runtime.data.items.sort(function (a, b) {
      var left = new Date(a.createdAt).getTime() || 0;
      var right = new Date(b.createdAt).getTime() || 0;
      return (left - right) * direction;
    });
  }

  function sidebarMarkup(runtime) {
    var user = authUser();
    var person = { name: user.name || user.displayName || "Thành viên HH", avatar: safeUrl(user.avatar) };
    return '<aside class="gcs-sidebar">' +
      '<a class="gcs-brand" href="#/home"><span>HH</span><strong>HOANG8.COM</strong><small>COMMUNITY</small></a>' +
      '<section class="gcs-profile">' + avatar(person) + '<div><strong>' + escapeHtml(person.name) + '</strong><small>' + (user.email ? "Tài khoản đã đăng nhập" : "Chưa xác minh tài khoản") + '</small></div></section>' +
      '<nav aria-label="Điều hướng Community">' +
        '<button type="button" class="is-active" data-gcs-nav="showcase" aria-current="page"><i>⌂</i><span>Showcase</span></button>' +
        '<button type="button" data-gcs-route="/communication/messenger"><i>✉</i><span>Messenger</span></button>' +
        '<button type="button" data-gcs-route="/communication/channels"><i>#</i><span>Kênh thảo luận</span></button>' +
        '<button type="button" data-gcs-route="/communication/forum"><i>▤</i><span>Forum</span></button>' +
        '<button type="button" data-gcs-route="/communication/live-room"><i>◉</i><span>Live Room</span></button>' +
        '<button type="button" data-gcs-route="/communication/moderation"><i>◇</i><span>An toàn</span></button>' +
      '</nav>' +
      '<section class="gcs-truth"><strong>Dữ liệu minh bạch</strong><p>Chỉ hiển thị lượt tương tác, người theo dõi và xếp hạng do backend trả về.</p></section>' +
      '<footer><button type="button" data-gcs-route="/galaxy/community">← Community Planet</button></footer>' +
    '</aside>';
  }

  function topbarMarkup(runtime) {
    return '<header class="gcs-topbar"><label><span>⌕</span><input type="search" data-gcs-search maxlength="120" placeholder="Tìm dự án, tác phẩm hoặc tác giả…" aria-label="Tìm trong Community Showcase"></label>' +
      '<div>' + statusMarkup(runtime) + '<button type="button" data-gcs-action="refresh" aria-label="Tải lại">↻</button><button class="gcs-primary" type="button" data-gcs-action="compose">＋ Chia sẻ tác phẩm</button></div></header>';
  }

  function metricMarkup(label, value, icon) {
    var count = finiteCount(value);
    if (count == null) return "";
    return '<article><i>' + icon + '</i><div><strong>' + numberLabel(count) + '</strong><small>' + escapeHtml(label) + '</small></div></article>';
  }

  function emptyMetricsMarkup() {
    return '<section class="gcs-metrics gcs-metrics--empty" aria-label="Thống kê đang chờ backend">' + [
      ["Dự án", "▧"], ["Tác phẩm", "◈"], ["Âm thanh", "♫"],
      ["Nhà sáng tạo", "◎"], ["Tương tác", "◇"], ["Quốc gia", "◉"]
    ].map(function (metric) {
      return '<article><i>' + metric[1] + '</i><div><strong aria-hidden="true">—</strong><small>' + escapeHtml(metric[0]) + '</small><em>Chưa có số liệu</em></div></article>';
    }).join("") + '</section>';
  }

  function emptyShowcaseMarkup(runtime) {
    var loading = runtime.capability === "loading";
    var title = loading ? "Đang tải Community Showcase" : emptyStateTitle(runtime.capability);
    var message = loading
      ? "Đang yêu cầu dữ liệu thật; các khung phía sau chỉ giữ bố cục trong lúc chờ."
      : (runtime.message || "Khi backend trả bài viết, nội dung sẽ xuất hiện tại đây.");
    var cards = Array.from({ length: 10 }, function (_, index) {
      return '<article class="gcs-card gcs-card--skeleton gcs-card--skeleton-' + ((index % 5) + 1) + '" aria-hidden="true">' +
        '<div class="gcs-card-media"><span class="gcs-skeleton-orbit"></span></div>' +
        '<div class="gcs-card-body"><span class="gcs-skeleton-line gcs-skeleton-line--title"></span><span class="gcs-skeleton-line gcs-skeleton-line--author"></span><footer><span class="gcs-skeleton-line gcs-skeleton-line--meta"></span></footer></div>' +
      '</article>';
    }).join("");
    return '<section class="gcs-empty-showcase" data-gcs-empty-state="' + escapeHtml(runtime.capability) + '">' +
      '<section class="gcs-grid gcs-skeleton-grid" aria-hidden="true">' + cards + '</section>' +
      '<section class="gcs-state gcs-state--overlay" role="status">' +
        (loading ? '<i aria-hidden="true"></i>' : '<span aria-hidden="true">◎</span>') +
        '<strong>' + escapeHtml(title) + '</strong><p>' + escapeHtml(message) + '</p>' +
        (loading ? '' : '<button type="button" data-gcs-action="refresh">Thử tải lại</button>') +
      '</section></section>';
  }

  function itemCard(item) {
    var counts = [];
    if (item.reactions != null) counts.push('<span title="Lượt bày tỏ cảm xúc">♡ ' + numberLabel(item.reactions) + "</span>");
    if (item.comments != null) counts.push('<span title="Bình luận">◌ ' + numberLabel(item.comments) + "</span>");
    if (item.saves != null) counts.push('<span title="Lượt lưu">◇ ' + numberLabel(item.saves) + "</span>");
    return '<article class="gcs-card" data-gcs-item="' + escapeHtml(item.id) + '" data-gcs-type="' + item.type + '">' +
      '<button class="gcs-card-media" type="button" data-gcs-action="detail" data-gcs-id="' + escapeHtml(item.id) + '" aria-label="Mở ' + escapeHtml(item.title) + '">' +
        (item.media ? '<img src="' + escapeHtml(item.media) + '" alt="" loading="lazy">' : '<span class="gcs-media-fallback"><i>✦</i><small>Không có ảnh đại diện</small></span>') +
        '<b>' + escapeHtml(item.type.toUpperCase()) + '</b>' +
      '</button>' +
      '<div class="gcs-card-body"><h3>' + escapeHtml(item.title) + '</h3>' +
        '<div class="gcs-author">' + avatar(item.author) + '<span><strong>' + escapeHtml(item.author.name) + (item.author.verified ? ' <i title="Đã xác minh">✓</i>' : "") + '</strong><small>' + escapeHtml(dateLabel(item.createdAt)) + '</small></span></div>' +
        '<footer><div>' + (counts.join("") || '<small>Backend chưa cung cấp lượt tương tác</small>') + '</div><button type="button" data-gcs-action="share" data-gcs-id="' + escapeHtml(item.id) + '" aria-label="Chia sẻ">↗</button></footer>' +
      '</div></article>';
  }

  function featuredMarkup(person) {
    if (!person) return '<section class="gcs-side-card gcs-side-empty"><span>◎</span><strong>Chưa có Featured Creator</strong><p>Thẻ này chỉ xuất hiện khi backend đề xuất tác giả nổi bật.</p></section>';
    return '<section class="gcs-side-card gcs-featured"><small>FEATURED CREATOR · BACKEND</small>' + avatar(person, "gcs-avatar--featured") + '<h3>' + escapeHtml(person.name) + (person.verified ? ' <i>✓</i>' : "") + '</h3><p>' + escapeHtml(person.role) + '</p>' + (person.followers == null ? '<small>Chưa có số người theo dõi</small>' : '<strong>' + numberLabel(person.followers) + ' người theo dõi</strong>') + '<button type="button" data-gcs-action="follow" data-gcs-person="' + escapeHtml(person.id) + '">Theo dõi</button></section>';
  }

  function leaderboardMarkup(rows) {
    return '<section class="gcs-side-card"><header><small>LEADERBOARD · BACKEND</small></header>' + (rows.length ? '<ol class="gcs-leaderboard">' + rows.slice(0, 6).map(function (person, index) {
      return '<li><b>' + (index + 1) + '</b>' + avatar(person) + '<span><strong>' + escapeHtml(person.name) + '</strong><small>' + escapeHtml(person.role) + '</small></span>' + (person.followers == null ? "" : '<em>' + numberLabel(person.followers) + '</em>') + '</li>';
    }).join("") + '</ol>' : '<div class="gcs-rail-empty"><strong>Chưa có bảng xếp hạng</strong><p>Không tạo thứ hạng hoặc điểm số minh họa.</p></div>') + '</section>';
  }

  function tagsMarkup(tags) {
    return '<section class="gcs-side-card"><header><small>CHỦ ĐỀ ĐANG CÓ DỮ LIỆU</small></header>' + (tags.length ? '<div class="gcs-tags">' + tags.map(function (tag) { return '<button type="button" data-gcs-tag="' + escapeHtml(tag) + '">#' + escapeHtml(tag) + '</button>'; }).join("") + '</div>' : '<div class="gcs-rail-empty"><p>Backend chưa trả chủ đề thịnh hành.</p></div>') + '</section>';
  }

  function contentMarkup(runtime) {
    var data = runtime.data;
    var items = data.items || [];
    var stats = data.stats || {};
    var metrics = [
      metricMarkup("Dự án", stats.projects, "▧"), metricMarkup("Tác phẩm", stats.artworks, "◈"),
      metricMarkup("Âm thanh", stats.music, "♫"), metricMarkup("Nhà sáng tạo", stats.creators, "◎"),
      metricMarkup("Tương tác", stats.interactions, "◇"), metricMarkup("Quốc gia", stats.countries, "◉")
    ].filter(Boolean).join("");
    var body;
    if (runtime.capability === "loading" || !items.length) body = emptyShowcaseMarkup(runtime);
    else body = '<section class="gcs-grid' + (runtime.view === "list" ? " is-list" : "") + '" data-gcs-grid data-gcs-view="' + runtime.view + '">' + items.map(itemCard).join("") + '</section><section class="gcs-no-match" data-gcs-no-match hidden><strong>Không tìm thấy nội dung phù hợp</strong><p>Hãy đổi từ khóa hoặc bộ lọc.</p></section>';
    return '<main class="gcs-main" data-gcs-active-view="' + runtime.view + '">' +
      '<section class="gcs-title"><div><span>COMMUNITY</span><h1>COMMUNITY <em>SHOWCASE - CỘNG ĐỒNG HH</em></h1><p>Khám phá dự án, tác phẩm và cuộc trò chuyện từ nguồn Community đã kết nối.</p></div><button type="button" data-gcs-action="compose">⇧ Chia sẻ</button></section>' +
      '<nav class="gcs-tabs" aria-label="Lọc loại nội dung">' + FILTERS.map(function (filter) { return '<button type="button" data-gcs-filter="' + filter[0] + '" aria-pressed="' + String(runtime.filter === filter[0]) + '">' + escapeHtml(filter[1]) + '</button>'; }).join("") + '<select data-gcs-sort aria-label="Sắp xếp"><option value="newest"' + (runtime.sort === "newest" ? " selected" : "") + '>Mới nhất</option><option value="oldest"' + (runtime.sort === "oldest" ? " selected" : "") + '>Cũ nhất</option></select><span class="gcs-view-switch" role="group" aria-label="Kiểu hiển thị"><button type="button" data-gcs-view="grid" aria-pressed="' + String(runtime.view !== "list") + '" aria-label="Dạng lưới">▦</button><button type="button" data-gcs-view="list" aria-pressed="' + String(runtime.view === "list") + '" aria-label="Dạng danh sách">☷</button></span></nav>' +
      '<div class="gcs-layout"><section class="gcs-feed">' + body + (metrics ? '<section class="gcs-metrics">' + metrics + '</section>' : emptyMetricsMarkup()) + '</section>' +
      '<aside class="gcs-right">' + featuredMarkup(data.featured) + leaderboardMarkup(data.leaderboard || []) + tagsMarkup(data.tags || []) + '</aside></div>' +
    '</main>';
  }

  function rootMarkup(runtime) {
    return '<section class="gcs-root" data-gcs-root data-gcs-capability="' + runtime.capability + '"><div class="gcs-space" aria-hidden="true"><i></i><i></i></div>' + sidebarMarkup(runtime) + '<div class="gcs-workspace">' + topbarMarkup(runtime) + '<div data-gcs-content>' + contentMarkup(runtime) + '</div></div><dialog class="gcs-dialog" data-gcs-dialog aria-label="Hộp thoại Community"></dialog><p class="gcs-live" data-gcs-live aria-live="polite"></p></section>';
  }

  function render(runtime, preserveFocus) {
    if (!runtime.root || !runtime.mounted) return;
    if (!runtime.root.querySelector("[data-gcs-root]")) runtime.root.innerHTML = rootMarkup(runtime);
    else {
      var container = runtime.root.querySelector("[data-gcs-content]");
      if (container) container.innerHTML = contentMarkup(runtime);
      var status = runtime.root.querySelector(".gcs-topbar .gcs-status");
      if (status) status.outerHTML = statusMarkup(runtime);
      runtime.root.querySelector("[data-gcs-root]").dataset.gcsCapability = runtime.capability;
    }
    applyFilters(runtime);
    var revealed = revealRequestedPost(runtime);
    if (preserveFocus && !revealed) global.requestAnimationFrame && global.requestAnimationFrame(function () { runtime.root.querySelector(preserveFocus)?.focus({ preventScroll: true }); });
  }

  function announce(runtime, message) {
    var live = runtime.root.querySelector("[data-gcs-live]");
    if (!live) return;
    live.textContent = "";
    global.requestAnimationFrame ? global.requestAnimationFrame(function () { live.textContent = message; }) : (live.textContent = message);
  }

  function cachedPayload() {
    try {
      var state = global.HHCommunity && global.HHCommunity.state && global.HHCommunity.state();
      if (!state || !state.lastSync || !Array.isArray(state.remotePosts)) return null;
      return { posts: state.remotePosts, suggestions: state.communitySuggestions, trendingHashtags: state.communityTrendingHashtags, fetchedAt: state.lastSync };
    } catch (error) { return null; }
  }

  async function requestPayload(runtime) {
    var adapter = runtime.options.adapter;
    if (adapter && typeof adapter.loadShowcase === "function") return adapter.loadShowcase({ signal: runtime.controller && runtime.controller.signal });
    if (global.HHCommunity && typeof global.HHCommunity.api === "function") return global.HHCommunity.api({ query: "?feed=ranked" });
    var base = String(runtime.options.apiBase || global.HH_REALTIME_URL || global.HH_API_BASE || "").replace(/\/$/, "");
    if (!base) throw Object.assign(new Error("Cần cấu hình Community API để tải nội dung thật."), { code: "CONFIG_REQUIRED" });
    var token = global.HHAuthSession && global.HHAuthSession.token && global.HHAuthSession.token();
    var response = await global.fetch(base + "/api/community?feed=ranked", { cache: "no-store", signal: runtime.controller && runtime.controller.signal, headers: token ? { Authorization: "Bearer " + token } : {} });
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(data.error || "Community API không phản hồi.");
    return data;
  }

  async function refresh(runtime) {
    if (!runtime || !runtime.mounted) return false;
    runtime.capability = "loading";
    runtime.message = "";
    render(runtime);
    try {
      var payload = await requestPayload(runtime);
      if (!runtime.mounted) return false;
      runtime.data = payloadData(payload);
      sortItems(runtime);
      runtime.capability = runtime.data.items.length ? "ready" : "empty";
      runtime.message = runtime.data.items.length ? "" : "Backend đã phản hồi nhưng chưa có bài viết Showcase.";
      runtime.lastVerifiedAt = new Date().toISOString();
      render(runtime, '[data-gcs-action="refresh"]');
      announce(runtime, "Đã tải lại Community Showcase.");
      return true;
    } catch (error) {
      if (!runtime.mounted || error && error.name === "AbortError") return false;
      var cache = cachedPayload();
      if (cache) {
        runtime.data = payloadData(cache);
        runtime.capability = "cached";
        runtime.message = "Đang hiển thị bản sao từ lần đồng bộ gần nhất.";
      } else {
        runtime.capability = error && error.code === "CONFIG_REQUIRED" ? "configuration-required" : (global.navigator && global.navigator.onLine === false ? "offline" : "error");
        runtime.message = String(error && error.message || "Không thể tải Community Showcase.");
      }
      render(runtime, '[data-gcs-action="refresh"]');
      announce(runtime, runtime.message);
      return false;
    }
  }

  function applyFilters(runtime) {
    var root = runtime.root;
    var query = String(root.querySelector("[data-gcs-search]")?.value || "").trim().toLocaleLowerCase("vi-VN");
    var filter = runtime.filter || "all";
    var visible = 0;
    root.querySelectorAll("[data-gcs-item]").forEach(function (card) {
      var matchType = filter === "all" || card.dataset.gcsType === filter;
      var matchText = !query || String(card.textContent || "").toLocaleLowerCase("vi-VN").includes(query);
      card.hidden = !(matchType && matchText);
      if (!card.hidden) visible += 1;
    });
    var noMatch = root.querySelector("[data-gcs-no-match]");
    if (noMatch) noMatch.hidden = Boolean(visible) || !(runtime.data.items || []).length;
  }

  function navigate(runtime, route) {
    route = cleanRoute(route);
    if (!route || route.indexOf("//") === 0) return;
    if (typeof runtime.options.navigate === "function") runtime.options.navigate(route);
    else if (global.location) global.location.hash = "#" + route;
  }

  function openDialog(runtime, markup, labelId) {
    var dialog = runtime.root.querySelector("[data-gcs-dialog]");
    if (!dialog) return null;
    dialog.innerHTML = markup;
    if (labelId) dialog.setAttribute("aria-labelledby", labelId); else dialog.removeAttribute("aria-labelledby");
    if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", "");
    return dialog;
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === "function") dialog.close(); else dialog.removeAttribute("open");
    dialog.innerHTML = "";
    dialog.removeAttribute("aria-labelledby");
  }

  function detailMarkup(item) {
    return '<article class="gcs-detail"><header><div><small>' + escapeHtml(item.type.toUpperCase()) + '</small><h2 id="gcs-detail-title">' + escapeHtml(item.title) + '</h2></div><button type="button" data-gcs-dialog-close aria-label="Đóng">×</button></header>' + (item.media ? '<img src="' + escapeHtml(item.media) + '" alt="">' : "") + '<div class="gcs-author">' + avatar(item.author) + '<span><strong>' + escapeHtml(item.author.name) + '</strong><small>' + escapeHtml(dateLabel(item.createdAt)) + '</small></span></div><p>' + escapeHtml(item.description || item.title) + '</p><footer><button type="button" data-gcs-action="share" data-gcs-id="' + escapeHtml(item.id) + '">Chia sẻ</button><button class="gcs-primary" type="button" data-gcs-dialog-close>Đóng</button></footer></article>';
  }

  function openItemDetail(runtime, item) {
    var dialog = openDialog(runtime, detailMarkup(item), "gcs-detail-title");
    dialog?.querySelector("[data-gcs-dialog-close]")?.focus();
    return Boolean(dialog);
  }

  function revealRequestedPost(runtime) {
    if (!runtime.requestedPostId || runtime.requestedPostHandled) return false;
    var item = (runtime.data.items || []).find(function (entry) { return entry.id === runtime.requestedPostId; });
    if (!item) return false;
    runtime.requestedPostHandled = true;
    var card = Array.from(runtime.root.querySelectorAll("[data-gcs-item]")).find(function (entry) { return entry.dataset.gcsItem === item.id; });
    card?.scrollIntoView?.({ block: "center", behavior: "auto" });
    return openItemDetail(runtime, item);
  }

  async function mutate(runtime, body) {
    var adapter = runtime.options.adapter;
    if (adapter && typeof adapter.mutate === "function") return adapter.mutate(body);
    if (global.HHCommunity && typeof global.HHCommunity.api === "function") return global.HHCommunity.api({ method: "POST", body: body });
    var base = String(runtime.options.apiBase || global.HH_REALTIME_URL || global.HH_API_BASE || "").replace(/\/$/, "");
    if (!base) throw new Error("Community API chưa được cấu hình.");
    var token = global.HHAuthSession && global.HHAuthSession.token && global.HHAuthSession.token();
    var response = await global.fetch(base + "/api/community", { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) }, body: JSON.stringify(body) });
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(data.error || "Không thể cập nhật Community.");
    return data;
  }

  async function handleAction(runtime, event) {
    var route = event.target.closest("[data-gcs-route]");
    if (route) { navigate(runtime, route.dataset.gcsRoute); return; }
    var filter = event.target.closest("[data-gcs-filter]");
    if (filter) {
      runtime.filter = filter.dataset.gcsFilter;
      runtime.root.querySelectorAll("[data-gcs-filter]").forEach(function (button) { button.setAttribute("aria-pressed", String(button === filter)); });
      applyFilters(runtime); return;
    }
    var view = event.target.closest("[data-gcs-view]");
    if (view) {
      runtime.view = view.dataset.gcsView === "list" ? "list" : "grid";
      render(runtime, '[data-gcs-view="' + runtime.view + '"]');
      announce(runtime, runtime.view === "list" ? "Đã chuyển sang dạng danh sách." : "Đã chuyển sang dạng lưới.");
      return;
    }
    var tag = event.target.closest("[data-gcs-tag]");
    if (tag) { var search = runtime.root.querySelector("[data-gcs-search]"); if (search) { search.value = tag.dataset.gcsTag; search.focus(); applyFilters(runtime); } return; }
    var action = event.target.closest("[data-gcs-action]");
    if (!action) return;
    if (action.dataset.gcsAction === "refresh") { await refresh(runtime); return; }
    if (action.dataset.gcsAction === "compose") {
      var composer = openDialog(runtime, '<form class="gcs-compose"><header><div><small>COMMUNITY CREATOR</small><h2 id="gcs-compose-title">Chia sẻ tác phẩm</h2></div><button type="button" data-gcs-dialog-close aria-label="Đóng">×</button></header><label><span>Nội dung</span><textarea name="content" maxlength="3000" required placeholder="Giới thiệu tác phẩm hoặc dự án của bạn…"></textarea></label><div><label><span>Chủ đề</span><select name="topic"><option>Dự án</option><option>Tác phẩm</option><option>Âm nhạc</option><option>Video</option><option>Prompt</option></select></label><label><span>Quyền xem</span><select name="privacy"><option value="public">Công khai</option><option value="followers">Người theo dõi</option><option value="private">Chỉ mình tôi</option></select></label></div><label><span>Liên kết ảnh/video HTTPS (không bắt buộc)</span><input name="mediaUrl" type="url" placeholder="https://…"></label><footer><button type="button" data-gcs-dialog-close>Hủy</button><button class="gcs-primary" type="submit">Đăng lên Community</button></footer></form>', "gcs-compose-title");
      composer?.querySelector("textarea")?.focus(); return;
    }
    var item = (runtime.data.items || []).find(function (entry) { return entry.id === action.dataset.gcsId; });
    if (action.dataset.gcsAction === "detail" && item) {
      openItemDetail(runtime, item); return;
    }
    if (action.dataset.gcsAction === "share" && item) {
      var url = String(global.location && global.location.href || "").split("#")[0] + "#/communication/community?post=" + encodeURIComponent(item.id);
      try {
        if (global.navigator && typeof global.navigator.share === "function") await global.navigator.share({ title: item.title, url: url });
        else if (global.navigator && global.navigator.clipboard) await global.navigator.clipboard.writeText(url);
        announce(runtime, "Đã chia sẻ liên kết tác phẩm.");
      } catch (error) { if (error && error.name !== "AbortError") announce(runtime, "Không thể chia sẻ liên kết."); }
      return;
    }
    if (action.dataset.gcsAction === "follow") {
      action.disabled = true;
      try { await mutate(runtime, { action: "follow", targetId: action.dataset.gcsPerson }); await refresh(runtime); }
      catch (error) { announce(runtime, String(error.message || error)); action.disabled = false; }
    }
  }

  function bind(runtime) {
    var signal = runtime.controller && runtime.controller.signal;
    var options = signal ? { signal: signal } : undefined;
    runtime.root.addEventListener("click", function (event) {
      var close = event.target.closest("[data-gcs-dialog-close]");
      if (close) { closeDialog(close.closest("dialog")); return; }
      handleAction(runtime, event).catch(function (error) { announce(runtime, String(error.message || error)); });
    }, options);
    runtime.root.addEventListener("input", function (event) { if (event.target.matches("[data-gcs-search]")) applyFilters(runtime); }, options);
    runtime.root.addEventListener("change", function (event) {
      if (!event.target.matches("[data-gcs-sort]")) return;
      runtime.sort = event.target.value === "oldest" ? "oldest" : "newest";
      sortItems(runtime);
      render(runtime, "[data-gcs-sort]");
    }, options);
    runtime.root.addEventListener("submit", function (event) {
      var form = event.target.closest(".gcs-compose");
      if (!form) return;
      event.preventDefault();
      var button = form.querySelector('[type="submit"]');
      var values = Object.fromEntries(new FormData(form));
      button.disabled = true;
      mutate(runtime, { action: "create", content: String(values.content || "").trim(), topic: values.topic, privacy: values.privacy, mediaUrl: safeUrl(values.mediaUrl), mediaType: /\.(mp4|webm|mov)(?:$|\?)/i.test(values.mediaUrl || "") ? "video" : "image" }).then(function () { closeDialog(form.closest("dialog")); return refresh(runtime); }).catch(function (error) { announce(runtime, String(error.message || error)); button.disabled = false; });
    }, options);
    global.document?.addEventListener("visibilitychange", function () {
      var root = runtime.root.querySelector("[data-gcs-root]");
      if (root) root.dataset.gcsMotionPaused = String(Boolean(global.document.hidden));
    }, options);
  }

  function mount(root, options) {
    options = options || {};
    if (!root || typeof root.querySelector !== "function" || !canHandle(options.route || ROUTE)) return false;
    unmount(root);
    var cached = cachedPayload();
    var runtime = {
      root: root, options: options, route: ROUTE, mounted: true,
      controller: typeof AbortController === "function" ? new AbortController() : null,
      capability: cached ? "cached" : "loading", data: cached ? payloadData(cached) : payloadData({}),
      filter: "all", view: options.view === "list" ? "list" : "grid", sort: options.sort === "oldest" ? "oldest" : "newest", message: cached ? "Đang xác minh dữ liệu mới với backend." : "", mountedAt: new Date().toISOString(), lastVerifiedAt: "",
      requestedPostId: postIdFromRoute(options.route), requestedPostHandled: false
    };
    sortItems(runtime);
    instances.set(root, runtime); mountedRoots.add(root);
    root.dataset.gcsMounted = "true";
    root.innerHTML = rootMarkup(runtime);
    bind(runtime);
    refresh(runtime);
    return true;
  }

  function unmount(root) {
    Array.from(mountedRoots).forEach(function (entry) {
      if (root && root !== entry) return;
      var runtime = instances.get(entry);
      if (!runtime) return;
      runtime.mounted = false;
      runtime.controller?.abort();
      entry.querySelectorAll("dialog[open]").forEach(closeDialog);
      delete entry.dataset.gcsMounted;
      entry.replaceChildren();
      instances.delete(entry); mountedRoots.delete(entry);
    });
  }

  function stateOf(runtime) {
    return { version: VERSION, route: ROUTE, mounted: runtime.mounted, capability: runtime.capability, itemCount: runtime.data.items.length, sourceVerifiedAt: runtime.lastVerifiedAt || null, filter: runtime.filter, view: runtime.view, sort: runtime.sort, mountedAt: runtime.mountedAt };
  }

  function getState(root) {
    if (root) { var runtime = instances.get(root); return runtime ? stateOf(runtime) : null; }
    return Array.from(mountedRoots).map(function (entry) { return stateOf(instances.get(entry)); });
  }

  return Object.freeze({ VERSION: VERSION, route: ROUTE, canHandle: canHandle, mount: mount, unmount: unmount, getState: getState, normalizePayload: payloadData });
});
