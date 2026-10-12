(function initAllToolState(scope) {
  "use strict";
  let authUser, hasAuthEvent = false, accountChanging = false;
  const read = (storage, key) => { try { return JSON.parse(storage?.getItem(key) || "null"); } catch { return null; } };
  function currentUser() {
    if (hasAuthEvent) return authUser;
    return read(scope.sessionStorage, "hh.auth.guest-user") || read(scope.localStorage, "hh-auth-user");
  }
  function identityScope(user) {
    if (!user || user.guest === true) return "guest";
    const id = user.id || user._id || user.sub;
    if (id) return `account:${encodeURIComponent(String(id))}`;
    // A legacy profile without a stable identifier cannot claim another user's data.
    return "guest";
  }
  let observedScope = identityScope(currentUser());
  function accountScope(user = currentUser()) {
    return accountChanging ? "account-change-pending" : identityScope(user);
  }
  const key = (base, owner = accountScope()) => `${base}.${owner}`;
  function readJSON(base, fallback, owner) {
    try { const raw = scope.localStorage.getItem(key(base, owner)); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
  }
  function writeJSON(base, value, owner) {
    if (accountChanging) throw new Error("Phiên tài khoản đã thay đổi; tải lại trang trước khi lưu dữ liệu All Tool.");
    const serialized = JSON.stringify(value);
    if (serialized.length > 2 * 1024 * 1024) throw new Error("Dữ liệu tool vượt giới hạn 2 MB; hãy xuất hoặc giảm nội dung.");
    scope.localStorage.setItem(key(base, owner), serialized);
    return value;
  }
  const api = Object.freeze({ accountScope, currentUser, key, readJSON, writeJSON, isAccountChanging: () => accountChanging });
  if (scope?.addEventListener) scope.addEventListener("hh:auth-change", event => {
    authUser = event.detail?.user || null;
    hasAuthEvent = true;
    accountChanging = false;
    observedScope = identityScope(authUser);
  });
  if (scope?.addEventListener) scope.addEventListener("storage", event => {
    if (event.key !== null && event.key !== "hh-auth-user") return;
    const profile = read(scope.sessionStorage, "hh.auth.guest-user") || read(scope.localStorage, "hh-auth-user");
    if (identityScope(profile) === observedScope) return;
    // A public profile change does not prove the current tab's authenticated token changed.
    // Stop tool work until the normal auth bootstrap can resolve the session again.
    accountChanging = true;
    scope.dispatchEvent?.(new scope.CustomEvent("hh:alltools-account-change"));
  });
  if (scope) scope.HHAllToolState = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
