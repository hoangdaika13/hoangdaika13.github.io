(function initHHSearchQuickOverlay(scope) {
  "use strict";

  let root = null;
  let provider = "google";
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const core = () => scope.HHSearchPlatform;

  function recentMarkup() {
    const items = core()?.list("searches") || [];
    if (!items.length) return '<p>Chưa có tìm kiếm gần đây.</p>';
    return items.slice(0, 6).map((item) => `<button type="button" data-sqo-recent-provider="${item.provider}" data-sqo-recent="${esc(item.query)}"><i>${item.provider === "youtube" ? "▶" : "G"}</i><span>${esc(item.query)}</span></button>`).join("");
  }

  function create() {
    root = document.createElement("section");
    root.className = "search-quick-overlay";
    root.setAttribute("aria-hidden", "true");
    root.innerHTML = `<div class="sqo-backdrop" data-sqo-close></div><section class="sqo-dialog" role="dialog" aria-modal="true" aria-labelledby="sqoTitle"><header><div><span>HH</span><div><small>QUICK SEARCH</small><h2 id="sqoTitle">Tìm nhanh trong HH</h2></div></div><button type="button" data-sqo-close aria-label="Đóng">×</button></header><nav aria-label="Chọn dịch vụ"><button type="button" data-sqo-provider="google"><i>G</i><span><strong>Google</strong><small>Web · ảnh · tài liệu</small></span></button><button type="button" data-sqo-provider="youtube"><i>▶</i><span><strong>YouTube</strong><small>Video · playlist · player</small></span></button></nav><form data-sqo-form><span>⌕</span><input type="search" name="q" placeholder="Bạn muốn tìm gì?" autocomplete="off" required><button type="submit">Mở workspace →</button></form><section><header><span>GẦN ĐÂY</span><button type="button" data-sqo-clear>Xóa</button></header><div data-sqo-recent>${recentMarkup()}</div></section><footer><span><kbd>Alt G</kbd> Google</span><span><kbd>Alt Y</kbd> YouTube</span><span><kbd>Esc</kbd> Đóng</span></footer></section>`;
    document.body.append(root);
    root.addEventListener("click", onClick);
    root.addEventListener("submit", onSubmit);
  }

  function setProvider(value) {
    provider = value === "youtube" ? "youtube" : "google";
    if (!root) return;
    root.dataset.provider = provider;
    root.querySelectorAll("[data-sqo-provider]").forEach((button) => button.classList.toggle("is-active", button.dataset.sqoProvider === provider));
    const input = root.querySelector('[data-sqo-form] input');
    input.placeholder = provider === "youtube" ? "Tìm video hoặc dán liên kết YouTube…" : "Tìm website, hình ảnh hoặc tài liệu…";
  }

  function open(value = "google", query = "") {
    if (!root) create();
    setProvider(value);
    const input = root.querySelector('[data-sqo-form] input');
    input.value = String(query || "").slice(0, 180);
    root.querySelector("[data-sqo-recent]").innerHTML = recentMarkup();
    root.classList.add("is-open");
    root.setAttribute("aria-hidden", "false");
    document.body.classList.add("search-quick-open");
    setTimeout(() => input.focus(), 60);
  }

  function close() {
    if (!root) return;
    root.classList.remove("is-open");
    root.setAttribute("aria-hidden", "true");
    document.body.classList.remove("search-quick-open");
  }

  function navigate(value, query = "") {
    const target = value === "youtube" ? "youtube" : "google";
    core()?.savePending(target, query);
    close();
    const route = `/${target}`;
    const current = location.hash.replace(/^#/, "").split("?")[0];
    if (current === route) scope.dispatchEvent(new CustomEvent("hh:search-pending", { detail: { provider: target, query } }));
    else location.hash = `#${route}`;
  }

  function onSubmit(event) {
    if (!event.target.matches("[data-sqo-form]")) return;
    event.preventDefault();
    navigate(provider, new FormData(event.target).get("q"));
  }

  function onClick(event) {
    if (event.target.closest("[data-sqo-close]")) return close();
    const choice = event.target.closest("[data-sqo-provider]");
    if (choice) { setProvider(choice.dataset.sqoProvider); root.querySelector('[data-sqo-form] input').focus(); return; }
    const recent = event.target.closest("[data-sqo-recent]");
    if (recent) return navigate(recent.dataset.sqoRecentProvider, recent.dataset.sqoRecent);
    if (event.target.closest("[data-sqo-clear]")) {
      core()?.clear("searches");
      root.querySelector("[data-sqo-recent]").innerHTML = recentMarkup();
    }
  }

  document.addEventListener("click", (event) => {
    const launcher = event.target.closest("[data-search-watch-open]");
    if (!launcher) return;
    event.preventDefault();
    open(launcher.dataset.searchWatchOpen || "google");
  }, true);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && root?.classList.contains("is-open")) close();
    if (event.altKey && !event.ctrlKey && !event.metaKey && ["g", "y"].includes(event.key.toLowerCase())) {
      event.preventDefault();
      open(event.key.toLowerCase() === "y" ? "youtube" : "google");
    }
  });

  scope.HHSearchWatch = Object.freeze({
    open,
    close,
    play: (value) => navigate("youtube", String(value || ""))
  });
})(window);
