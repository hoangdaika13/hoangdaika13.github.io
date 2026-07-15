(() => {
  "use strict";

  const DRAFT_KEY = "hh-community-draft";
  const $ = (root, selector) => root?.querySelector(selector);
  const $$ = (root, selector) => [...(root?.querySelectorAll(selector) || [])];
  const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  const readState = () => {
    try { return JSON.parse(localStorage.getItem("hh-community-center") || "{}"); }
    catch { return {}; }
  };

  function postRecord(id) {
    const state = readState();
    return (state.remotePosts || state.posts || []).find((post) => String(post.id) === String(id));
  }

  function toast(message, type = "success") {
    window.HHCommunity?.notice?.(message, type);
  }

  async function mutate(body) {
    if (!window.HHCommunity?.mutate) throw new Error("Dịch vụ cộng đồng chưa sẵn sàng.");
    return window.HHCommunity.mutate(body);
  }

  function createDialog(className, content) {
    document.querySelector(`.${className}`)?.remove();
    const dialog = document.createElement("dialog");
    dialog.className = className;
    dialog.innerHTML = content;
    document.body.append(dialog);
    const close = () => { if (dialog.open) dialog.close(); dialog.remove(); };
    dialog.addEventListener("cancel", (event) => { event.preventDefault(); close(); });
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog || event.target.closest("[data-social-close]")) close();
    });
    dialog.showModal();
    return { dialog, close };
  }

  function enhanceComposer(root) {
    const form = $(root, "[data-community-form]");
    if (!form || form.dataset.socialPro) return;
    form.dataset.socialPro = "true";
    const input = $(form, "[data-community-input]");
    const saved = localStorage.getItem(DRAFT_KEY) || "";
    if (saved && !input.value) input.value = saved;

    const status = document.createElement("div");
    status.className = "hh-composer-status";
    status.innerHTML = `<span data-social-draft>${saved ? "Đã khôi phục bản nháp" : "Bản nháp tự động"}</span><b data-social-count>${input.value.length}/5000</b>`;
    input.closest("div")?.after(status);

    const tools = form.querySelector("footer > div");
    tools?.insertAdjacentHTML("beforeend", `
      <button class="interactive" type="button" data-social-live><span>●</span> Trực tiếp</button>
      <button class="interactive" type="button" data-social-poll><span>▥</span> Khảo sát</button>
      <button class="interactive" type="button" data-social-emoji><span>☺</span> Emoji</button>
      <button class="interactive" type="button" data-social-gif><span>GIF</span> GIF</button>`);

    let timer;
    input.addEventListener("input", () => {
      $(form, "[data-social-count]").textContent = `${input.value.length}/5000`;
      clearTimeout(timer);
      timer = setTimeout(() => {
        localStorage.setItem(DRAFT_KEY, input.value);
        $(form, "[data-social-draft]").textContent = input.value ? "Đã lưu bản nháp" : "Bản nháp tự động";
      }, 300);
    });
  }

  function reactionSummary(post) {
    const icons = { like: "👍", love: "❤", care: "🤗", haha: "😆", wow: "😮", sad: "😢", angry: "😡" };
    return Object.entries(post.reactions || {}).filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([type]) => icons[type]).join("");
  }

  function pollMarkup(post) {
    if (!post.poll?.options?.length) return "";
    const total = Math.max(1, Number(post.poll.totalVotes || 0));
    return `<section class="hh-post-poll" data-social-poll-card>
      <header><div><small>KHẢO SÁT CỘNG ĐỒNG</small><strong>${esc(post.poll.question)}</strong></div><span>${post.poll.totalVotes || 0} lượt chọn</span></header>
      <div>${post.poll.options.map((option) => {
        const percent = Math.round(Number(option.votes || 0) / total * 100);
        return `<button class="${String(post.poll.viewerVote) === String(option.id) ? "active" : ""}" type="button" data-social-poll-vote="${esc(post.id)}" data-option-id="${esc(option.id)}"><i style="--poll:${percent}%"></i><span>${esc(option.text)}</span><b>${percent}%</b></button>`;
      }).join("")}</div>
    </section>`;
  }

  function upgradePosts(root) {
    $$(root, "[data-post-id]").forEach((node) => {
      const post = postRecord(node.dataset.postId);
      if (!post) return;
      const proof = $(node, ".post-social-proof");
      if (proof && !proof.querySelector(".hh-reaction-summary")) {
        const summary = reactionSummary(post);
        proof.firstElementChild?.insertAdjacentHTML("afterbegin", `<b class="hh-reaction-summary">${summary || "♡"}</b>`);
      }
      if ((post.feeling || post.location) && !node.querySelector(".hh-post-context")) {
        node.querySelector("header")?.insertAdjacentHTML("afterend", `<div class="hh-post-context">${post.feeling ? `<span>☺ ${esc(post.feeling)}</span>` : ""}${post.location ? `<span>⌖ ${esc(post.location)}</span>` : ""}</div>`);
      }
      if (post.poll && !node.querySelector("[data-social-poll-card]")) {
        const media = node.querySelector(".community-media-grid");
        const content = node.querySelector(":scope > p");
        (media || content || node.querySelector("header"))?.insertAdjacentHTML("afterend", pollMarkup(post));
      }
      const comments = $(node, ".post-comments");
      if (comments && !comments.querySelector(".hh-comment-toolbar")) {
        comments.insertAdjacentHTML("afterbegin", `<div class="hh-comment-toolbar"><span>${(post.comments || []).length} bình luận</span><select data-social-comment-sort aria-label="Sắp xếp bình luận"><option value="relevant">Phù hợp nhất</option><option value="newest">Mới nhất</option><option value="oldest">Cũ nhất</option></select></div>`);
      }
      $$(comments, ":scope > .community-comment").forEach((comment, index) => {
        comment.dataset.createdAt = post.comments?.[index]?.createdAt || "";
        comment.dataset.commentId = post.comments?.[index]?.id || "";
        comment.dataset.parentId = post.comments?.[index]?.parentId || "";
      });
    });
    const linkedPost = new URLSearchParams(location.search).get("post");
    if (linkedPost && root.dataset.socialLinkedPost !== linkedPost) {
      const target = root.querySelector(`[data-post-id="${CSS.escape(linkedPost)}"]`);
      if (target) {
        root.dataset.socialLinkedPost = linkedPost;
        requestAnimationFrame(() => target.scrollIntoView({ behavior: "smooth", block: "center" }));
      }
    }
  }

  function setComposerMeta(form, kind, value) {
    const selector = kind === "feeling" ? "[data-community-feeling-value]" : "[data-community-location-value]";
    let hidden = form.querySelector(selector);
    if (!hidden) {
      hidden = document.createElement("input");
      hidden.type = "hidden";
      hidden.dataset[kind === "feeling" ? "communityFeelingValue" : "communityLocationValue"] = "";
      form.append(hidden);
    }
    hidden.value = value;
    let context = form.querySelector("[data-social-composer-context]");
    if (!context) {
      context = document.createElement("div");
      context.className = "hh-composer-context";
      context.dataset.socialComposerContext = "";
      form.querySelector("footer")?.before(context);
    }
    const feeling = form.querySelector("[data-community-feeling-value]")?.value;
    const location = form.querySelector("[data-community-location-value]")?.value;
    context.innerHTML = `${feeling ? `<button type="button" data-social-clear-meta="feeling">☺ ${esc(feeling)} ×</button>` : ""}${location ? `<button type="button" data-social-clear-meta="location">⌖ ${esc(location)} ×</button>` : ""}`;
    context.hidden = !feeling && !location;
  }

  function showComposerChoice(form, kind) {
    const isFeeling = kind === "feeling";
    const values = isFeeling
      ? [["Vui vẻ", "☺"], ["Biết ơn", "♡"], ["Hào hứng", "✦"], ["Được truyền cảm hứng", "☀"], ["Thư giãn", "◌"], ["Tự hào", "♛"], ["Đang suy nghĩ", "◈"], ["Mệt mỏi", "☾"]]
      : [["Hưng Yên", "⌖"], ["Hà Nội", "⌖"], ["TP. Hồ Chí Minh", "⌖"], ["Đang làm việc tại nhà", "⌂"], ["Đang đi du lịch", "◇"], ["Không gian sáng tạo HH", "✦"]];
    const title = isFeeling ? "Bạn đang cảm thấy thế nào?" : "Bạn đang ở đâu?";
    const { dialog, close } = createDialog("hh-composer-dialog", `<section><header><div><small>THÊM VÀO BÀI VIẾT</small><h5>${title}</h5></div><button type="button" data-social-close>×</button></header><label><span>⌕</span><input type="search" placeholder="Tìm kiếm..."></label><div>${values.map(([label, icon]) => `<button type="button" data-social-meta-value="${esc(label)}"><i>${icon}</i><span>${esc(label)}</span></button>`).join("")}</div></section>`);
    const search = dialog.querySelector("input");
    search?.addEventListener("input", () => {
      const query = search.value.trim().toLocaleLowerCase("vi");
      dialog.querySelectorAll("[data-social-meta-value]").forEach((button) => { button.hidden = !button.textContent.toLocaleLowerCase("vi").includes(query); });
    });
    dialog.querySelectorAll("[data-social-meta-value]").forEach((button) => button.addEventListener("click", () => {
      setComposerMeta(form, kind, button.dataset.socialMetaValue);
      close();
    }));
    search?.focus();
  }

  function renderDirectory(root, mode) {
    root.querySelector("[data-social-directory]")?.remove();
    const state = readState();
    const panel = document.createElement("section");
    panel.className = "hh-social-directory";
    panel.dataset.socialDirectory = mode;
    const close = `<button type="button" data-social-directory-close aria-label="Đóng">×</button>`;
    if (mode === "groups") {
      const groups = state.communityGroups || [];
      panel.innerHTML = `<header><div><small>KHÔNG GIAN KẾT NỐI</small><h5>Nhóm cộng đồng</h5><p>Tham gia thảo luận theo chủ đề và dự án.</p></div><div><button class="primary" type="button" data-social-group-create>＋ Tạo nhóm</button>${close}</div></header><div class="hh-directory-grid">${groups.map((item) => `<article><i>G</i><div><strong>${esc(item.name)}</strong><p>${esc(item.description || "Nhóm công khai trong HH Social")}</p><small>${item.memberCount || 0} thành viên</small></div><button class="${item.joined ? "active" : ""}" type="button" data-social-group-join="${esc(item.id)}">${item.joined ? "Đã tham gia" : "Tham gia"}</button></article>`).join("") || "<p>Chưa có nhóm. Hãy tạo nhóm đầu tiên cho cộng đồng.</p>"}</div>`;
    } else if (mode === "events") {
      const events = state.communityEvents || [];
      panel.innerHTML = `<header><div><small>LỊCH CỘNG ĐỒNG</small><h5>Sự kiện sắp tới</h5><p>Gặp gỡ, workshop và hoạt động trực tuyến.</p></div><div><button class="primary" type="button" data-social-event-create>＋ Tạo sự kiện</button>${close}</div></header><div class="hh-directory-grid">${events.map((item) => `<article><time>${new Date(item.startsAt).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}</time><div><strong>${esc(item.name)}</strong><p>${esc(item.description || "Sự kiện cộng đồng HH")}</p><small>${item.attendeeCount || 0} người tham dự · ${new Date(item.startsAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</small></div><button class="${item.going ? "active" : ""}" type="button" data-social-event-rsvp="${esc(item.id)}">${item.going ? "Sẽ tham gia" : "Quan tâm"}</button></article>`).join("") || "<p>Chưa có sự kiện sắp tới.</p>"}</div>`;
    } else {
      const users = state.communitySuggestions || [];
      panel.innerHTML = `<header><div><small>MỌI NGƯỜI QUANH BẠN</small><h5>Khám phá thành viên</h5><p>Kết nối với những người có cùng sở thích.</p></div>${close}</header><div class="hh-people-grid">${users.map((user) => `<article><span>${esc(String(user.name || "HH").split(/\s+/).slice(-2).map((part) => part[0]).join("").toUpperCase())}</span><strong>${esc(user.name)}</strong><small>Thành viên HH</small><button class="${user.following ? "active" : ""}" type="button" data-community-follow="${esc(user.id)}">${user.following ? "Đang theo dõi" : "Theo dõi"}</button></article>`).join("") || "<p>Chưa có thành viên mới để gợi ý.</p>"}</div>`;
    }
    root.querySelector(".community-hero")?.after(panel);
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function setFeedMode(root, mode) {
    $$(root, "[data-social-tab]").forEach((button) => button.classList.toggle("active", button.dataset.socialTab === mode));
    root.querySelector("[data-social-directory]")?.remove();
    const posts = $$(root, "[data-post-id]");
    if (mode === "video") {
      posts.forEach((node) => { const post = postRecord(node.dataset.postId); node.hidden = !(post?.media || []).some((item) => item.type === "video") && post?.mediaType !== "video"; });
      toast("Đang hiển thị video và reels trong bảng tin.");
    } else if (["friends", "groups", "events"].includes(mode)) {
      posts.forEach((node) => { node.hidden = false; });
      renderDirectory(root, mode);
    } else {
      posts.forEach((node) => { node.hidden = false; });
    }
  }

  function enhance(root) {
    if (!root || root.dataset.socialPro) return;
    root.dataset.socialPro = "true";
    root.querySelector(".community-hero")?.insertAdjacentHTML("afterend", `<nav class="hh-social-tabs" aria-label="Điều hướng cộng đồng"><button class="active" type="button" data-social-tab="feed"><span>⌂</span>Dành cho bạn</button><button type="button" data-social-tab="friends"><span>◎</span>Bạn bè</button><button type="button" data-social-tab="video"><span>▶</span>Video & Reels</button><button type="button" data-social-tab="groups"><span>♙</span>Nhóm</button><button type="button" data-social-tab="events"><span>◇</span>Sự kiện</button></nav>`);
    enhanceComposer(root);
    upgradePosts(root);
  }

  function showStory(button) {
    const storyId = button.dataset.storyId || "";
    const media = button.dataset.storyMedia || button.querySelector("img,video")?.src || "";
    const name = button.querySelector("strong")?.textContent || "Tin HH";
    const content = button.dataset.storyContent || "Khoảnh khắc được chia sẻ trong HH Social.";
    const type = button.querySelector("video") || /\.(mp4|webm|mov)(\?|$)/i.test(media) ? "video" : "image";
    const { dialog, close } = createDialog("hh-story-viewer", `<section><div class="hh-story-progress"><i></i></div><header><span>${esc(name.slice(0, 2).toUpperCase())}</span><div><strong>${esc(name)}</strong><small>Tin · 24 giờ</small></div><button type="button" data-social-close>×</button></header><main>${media ? type === "video" ? `<video src="${esc(media)}" autoplay controls playsinline></video>` : `<img src="${esc(media)}" alt="${esc(name)}">` : `<div class="hh-story-text">${esc(content)}</div>`}</main><footer><input aria-label="Trả lời tin" placeholder="Trả lời ${esc(name)}..."><button type="button" data-story-heart>❤</button><button type="button" data-story-reply>Gửi</button></footer></section>`);
    if (storyId) mutate({ action: "story:view", storyId }).catch(() => {});
    dialog.querySelector("[data-story-heart]")?.addEventListener("click", async () => {
      try {
        if (storyId) await mutate({ action: "story:react", storyId, type: "love" });
        toast(`Đã gửi cảm xúc tới ${name}.`);
      } catch (error) { toast(error.message, "error"); }
    });
    dialog.querySelector("[data-story-reply]")?.addEventListener("click", () => {
      const reply = dialog.querySelector("footer input")?.value.trim();
      if (!reply) return dialog.querySelector("footer input")?.focus();
      localStorage.setItem("hh-chat-draft", reply);
      close();
      location.hash = "community";
      toast("Đã chuyển câu trả lời sang Messenger HH.");
    });
    const timer = setTimeout(close, 8000);
    dialog.addEventListener("close", () => clearTimeout(timer), { once: true });
  }

  function showLightbox(image) {
    createDialog("hh-media-lightbox", `<section><button type="button" data-social-close aria-label="Đóng">×</button><img src="${esc(image.src)}" alt="${esc(image.alt)}"><footer><span>Ảnh trong HH Social</span><a href="${esc(image.src)}" target="_blank" rel="noopener">Mở ảnh gốc</a></footer></section>`);
  }

  function showNotifications(root) {
    root.querySelector("[data-social-notification-drawer]")?.remove();
    const state = readState();
    const notifications = state.communityNotifications || [];
    const drawer = document.createElement("aside");
    drawer.className = "hh-notification-drawer";
    drawer.dataset.socialNotificationDrawer = "";
    drawer.innerHTML = `<header><div><small>TRUNG TÂM CẬP NHẬT</small><h5>Thông báo</h5></div><button type="button" data-social-notification-close>×</button></header><nav><button class="active" type="button" data-social-notification-filter="all">Tất cả</button><button type="button" data-social-notification-filter="unread">Chưa đọc</button></nav><div>${notifications.length ? notifications.slice(0, 20).map((item) => `<button class="${item.read ? "is-read" : ""}" type="button" data-social-notification-post="${esc(item.recordId || "")}"><span>${esc(String(item.actor?.name || "HH").slice(0, 2).toUpperCase())}</span><div><strong>${esc(item.actor?.name || "HH Social")}</strong><p>${esc(item.message || "Có cập nhật mới trong cộng đồng.")}</p><small>${new Date(item.createdAt).toLocaleString("vi-VN")}</small></div>${item.read ? "" : "<i></i>"}</button>`).join("") : `<section><b>✓</b><strong>Bạn đã xem hết thông báo</strong><p>Các lượt thích, bình luận, theo dõi và chia sẻ mới sẽ xuất hiện tại đây.</p></section>`}</div><footer><button type="button" data-social-notification-read>Đánh dấu tất cả đã đọc</button></footer>`;
    root.append(drawer);
    requestAnimationFrame(() => drawer.classList.add("is-open"));
  }

  function addExtra(form, type) {
    form.querySelector("[data-social-composer-extra]")?.remove();
    const box = document.createElement("section");
    box.className = "hh-composer-extra";
    box.dataset.socialComposerExtra = type;
    if (type === "poll") box.innerHTML = `<header><strong>▥ Tạo khảo sát</strong><button type="button" data-social-extra-close>×</button></header><input data-community-poll-question maxlength="220" placeholder="Đặt câu hỏi..."><div><input data-community-poll-option maxlength="160" placeholder="Lựa chọn 1"><input data-community-poll-option maxlength="160" placeholder="Lựa chọn 2"><input data-community-poll-option maxlength="160" placeholder="Lựa chọn 3 (không bắt buộc)"></div>`;
    else if (type === "emoji") box.innerHTML = `<header><strong>Chọn cảm xúc</strong><button type="button" data-social-extra-close>×</button></header><div class="hh-emoji-grid">${["😀","😂","😍","🥰","😎","🤗","👏","🔥","❤","🎉","💡","🚀","🎵","📸","✨","👍"].map((icon) => `<button type="button" data-social-emoji-value="${icon}">${icon}</button>`).join("")}</div>`;
    form.querySelector("footer")?.before(box);
  }

  document.addEventListener("click", async (event) => {
    const root = event.target.closest("[data-community-center]");
    if (!root) return;
    const story = event.target.closest("[data-story-id],[data-story-demo],[data-story]");
    if (story) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showStory(story);
      return;
    }
    const media = event.target.closest("[data-community-center] .community-media-grid img");
    if (media) { event.preventDefault(); event.stopImmediatePropagation(); showLightbox(media); return; }
    if (event.target.closest("[data-community-notifications]")) {
      event.preventDefault(); event.stopImmediatePropagation(); showNotifications(root); return;
    }
    if (event.target.closest("[data-social-notification-close]")) {
      root.querySelector("[data-social-notification-drawer]")?.remove(); return;
    }
    const notificationFilter = event.target.closest("[data-social-notification-filter]");
    if (notificationFilter) {
      const drawer = notificationFilter.closest("[data-social-notification-drawer]");
      drawer.querySelectorAll("[data-social-notification-filter]").forEach((button) => button.classList.toggle("active", button === notificationFilter));
      drawer.querySelectorAll("[data-social-notification-post]").forEach((item) => { item.hidden = notificationFilter.dataset.socialNotificationFilter === "unread" && item.classList.contains("is-read"); });
      return;
    }
    if (event.target.closest("[data-social-notification-read]")) {
      try {
        await mutate({ action: "notifications:read" });
        root.querySelector("[data-social-notification-drawer]")?.remove();
        toast("Đã đánh dấu toàn bộ thông báo là đã đọc.");
      } catch (error) { toast(error.message, "error"); }
      return;
    }
    const notificationPost = event.target.closest("[data-social-notification-post]");
    if (notificationPost) {
      const post = root.querySelector(`[data-post-id="${CSS.escape(notificationPost.dataset.socialNotificationPost)}"]`);
      root.querySelector("[data-social-notification-drawer]")?.remove();
      post?.scrollIntoView({ behavior: "smooth", block: "center" });
      post?.animate([{ outlineColor: "transparent" }, { outlineColor: "#57dce5" }, { outlineColor: "transparent" }], { duration: 1200 });
      return;
    }

    const tab = event.target.closest("[data-social-tab]");
    if (tab) { setFeedMode(root, tab.dataset.socialTab); return; }
    if (event.target.closest("[data-social-directory-close]")) { root.querySelector("[data-social-directory]")?.remove(); setFeedMode(root, "feed"); return; }
    if (event.target.closest("[data-social-group-create]")) {
      const { dialog } = createDialog("hh-community-create-dialog", `<form data-social-create-group><header><div><small>NHÓM HH</small><h5>Tạo nhóm cộng đồng</h5></div><button type="button" data-social-close>×</button></header><label><span>Tên nhóm</span><input name="name" required minlength="3" maxlength="100" placeholder="Ví dụ: Nhà sáng tạo HH"></label><label><span>Mô tả</span><textarea name="description" maxlength="500" placeholder="Mục tiêu và chủ đề của nhóm..."></textarea></label><footer><button type="button" data-social-close>Hủy</button><button class="primary" type="submit">Tạo nhóm</button></footer></form>`);
      dialog.querySelector("form")?.addEventListener("submit", async (submitEvent) => {
        submitEvent.preventDefault();
        const values = Object.fromEntries(new FormData(submitEvent.currentTarget));
        try { await mutate({ action: "group:create", ...values }); dialog.close(); dialog.remove(); renderDirectory(root, "groups"); toast("Nhóm mới đã sẵn sàng."); }
        catch (error) { toast(error.message, "error"); }
      });
      return;
    }
    if (event.target.closest("[data-social-event-create]")) {
      const minimum = new Date(Date.now() + 15 * 60000).toISOString().slice(0, 16);
      const { dialog } = createDialog("hh-community-create-dialog", `<form data-social-create-event><header><div><small>SỰ KIỆN HH</small><h5>Tạo sự kiện</h5></div><button type="button" data-social-close>×</button></header><label><span>Tên sự kiện</span><input name="name" required minlength="3" maxlength="100" placeholder="Workshop hoặc buổi gặp mặt"></label><label><span>Thời gian bắt đầu</span><input name="startsAt" type="datetime-local" min="${minimum}" required></label><label><span>Mô tả</span><textarea name="description" maxlength="500" placeholder="Nội dung và hình thức tham gia..."></textarea></label><footer><button type="button" data-social-close>Hủy</button><button class="primary" type="submit">Tạo sự kiện</button></footer></form>`);
      dialog.querySelector("form")?.addEventListener("submit", async (submitEvent) => {
        submitEvent.preventDefault();
        const values = Object.fromEntries(new FormData(submitEvent.currentTarget));
        try { await mutate({ action: "event:create", ...values }); dialog.close(); dialog.remove(); renderDirectory(root, "events"); toast("Sự kiện đã được công bố."); }
        catch (error) { toast(error.message, "error"); }
      });
      return;
    }
    const form = root.querySelector("[data-community-form]");
    if (event.target.closest("[data-community-feeling]")) {
      event.preventDefault(); event.stopImmediatePropagation(); showComposerChoice(form, "feeling"); return;
    }
    if (event.target.closest("[data-community-checkin]")) {
      event.preventDefault(); event.stopImmediatePropagation(); showComposerChoice(form, "location"); return;
    }
    const clearMeta = event.target.closest("[data-social-clear-meta]");
    if (clearMeta) { setComposerMeta(form, clearMeta.dataset.socialClearMeta, ""); return; }
    if (event.target.closest("[data-social-poll]")) { addExtra(form, "poll"); return; }
    if (event.target.closest("[data-social-emoji]")) { addExtra(form, "emoji"); return; }
    if (event.target.closest("[data-social-extra-close]")) { event.target.closest("[data-social-composer-extra]")?.remove(); return; }
    const emoji = event.target.closest("[data-social-emoji-value]");
    if (emoji) { const input = form.querySelector("[data-community-input]"); input.value += emoji.dataset.socialEmojiValue; input.dispatchEvent(new Event("input")); input.focus(); return; }
    if (event.target.closest("[data-social-gif]")) {
      const fields = form.querySelector("[data-community-media-fields]");
      fields.hidden = false;
      const input = fields.querySelector("[data-community-media]");
      input.placeholder = "Dán liên kết HTTPS của GIF";
      fields.querySelector("[data-community-media-type]").value = "image";
      input.focus();
      return;
    }
    if (event.target.closest("[data-social-live]")) {
      const { dialog } = createDialog("hh-live-dialog", `<section><header><div><small>HH LIVE</small><h5>Phát trực tiếp cùng cộng đồng</h5></div><button type="button" data-social-close>×</button></header><div class="hh-live-preview"><span>●</span><strong>Kiểm tra camera và micro trước khi bắt đầu</strong><p>Livestream trực tiếp cần phòng WebRTC. Hiện tại bạn có thể mở phòng Messenger HH để trò chuyện thời gian thực.</p></div><footer><button type="button" data-social-close>Để sau</button><button class="primary" type="button" data-social-open-messenger>Mở Messenger HH</button></footer></section>`);
      dialog.querySelector("[data-social-open-messenger]")?.addEventListener("click", () => { dialog.close(); dialog.remove(); location.hash = "community"; });
      return;
    }
    const vote = event.target.closest("[data-social-poll-vote]");
    if (vote) { vote.disabled = true; try { await mutate({ action: "poll:vote", postId: vote.dataset.socialPollVote, optionId: vote.dataset.optionId }); toast("Đã ghi nhận lựa chọn của bạn."); } catch (error) { toast(error.message, "error"); } return; }
    const group = event.target.closest("[data-social-group-join]");
    if (group) { group.disabled = true; try { const data = await mutate({ action: "group:join", groupId: group.dataset.socialGroupJoin }); group.classList.toggle("active", data.joined); group.textContent = data.pending ? "Đang chờ duyệt" : data.joined ? "Đã tham gia" : "Tham gia"; if (!data.pending) group.disabled = false; renderDirectory(root, "groups"); } catch (error) { toast(error.message, "error"); group.disabled = false; } return; }
    const rsvp = event.target.closest("[data-social-event-rsvp]");
    if (rsvp) { rsvp.disabled = true; try { const data = await mutate({ action: "event:rsvp", eventId: rsvp.dataset.socialEventRsvp }); rsvp.classList.toggle("active", data.going); rsvp.textContent = data.going ? "Sẽ tham gia" : "Quan tâm"; rsvp.disabled = false; renderDirectory(root, "events"); } catch (error) { toast(error.message, "error"); rsvp.disabled = false; } return; }
    const share = event.target.closest("[data-post-share]");
    if (share) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const sharedUrl = new URL(location.href);
      sharedUrl.searchParams.set("post", share.dataset.postShare);
      sharedUrl.hash = "/communication/community";
      const url = sharedUrl.href;
      try {
        if (navigator.share) await navigator.share({ title: "Bài viết HH Social", url });
        else await navigator.clipboard.writeText(url);
        await mutate({ action: "share", postId: share.dataset.postShare });
        toast("Đã chia sẻ bài viết.");
      } catch (error) { if (error.name !== "AbortError") toast(error.message, "error"); }
    }
  }, true);

  document.addEventListener("change", (event) => {
    const select = event.target.closest("[data-social-comment-sort]");
    if (!select) return;
    const container = select.closest(".post-comments");
    if (!container) return;
    const toolbar = container.querySelector(".hh-comment-toolbar");
    const form = container.querySelector("form");
    const comments = [...container.children].filter((child) => child !== toolbar && child !== form);
    comments.sort((a, b) => {
      const aTime = Date.parse(a.querySelector("time")?.dateTime || a.dataset.createdAt || "") || 0;
      const bTime = Date.parse(b.querySelector("time")?.dateTime || b.dataset.createdAt || "") || 0;
      if (select.value === "oldest") return aTime - bTime;
      if (select.value === "newest") return bTime - aTime;
      const aReplies = comments.filter((item) => item.dataset.parentId && item.dataset.parentId === a.dataset.commentId).length;
      const bReplies = comments.filter((item) => item.dataset.parentId && item.dataset.parentId === b.dataset.commentId).length;
      return bReplies - aReplies || bTime - aTime;
    });
    comments.forEach((comment) => container.insertBefore(comment, form));
  });

  let socialFrame = 0;
  const observer = new MutationObserver(() => {
    if (socialFrame) return;
    socialFrame = requestAnimationFrame(() => {
      socialFrame = 0;
      const root = document.querySelector("[data-community-center]");
      if (root) { enhance(root); upgradePosts(root); }
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  const initial = document.querySelector("[data-community-center]");
  if (initial) enhance(initial);
})();
