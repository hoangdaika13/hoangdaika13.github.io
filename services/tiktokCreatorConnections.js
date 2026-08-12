(function tiktokCreatorConnections(global) {
  "use strict";

  const apiOrigin = () => String(global.HH_API_ORIGIN || global.location?.origin || "").replace(/\/$/, "");
  const authHeaders = () => {
    const token = global.HHAuthSession?.token?.() || "";
    return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  };
  async function request(path, options = {}) {
    const method = options.method || "GET";
    const url = new URL(`${apiOrigin()}/api/tiktok/${String(path).replace(/^\//, "")}`);
    Object.entries(options.query || {}).forEach(([key, value]) => value !== undefined && value !== "" && url.searchParams.set(key, String(value)));
    const response = await fetch(url, { method, headers: authHeaders(), credentials: "include", cache: "no-store", ...(options.body ? { body: JSON.stringify(options.body) } : {}) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error(data.error || data.message || `TikTok API HTTP ${response.status}`); error.status = response.status; error.code = data.code || "TIKTOK_API_ERROR"; throw error; }
    return data;
  }
  function normalizeConnection(item = {}) { return { ...item, connectionId: String(item.connectionId || item.id || "") }; }
  async function status() {
    const result = await request("status");
    return { ...result, connections: Array.isArray(result.connections) ? result.connections.map(normalizeConnection) : [] };
  }
  async function connect(scopes = ["user.info.basic"]) {
    const result = await request("oauth/start", { method: "POST", body: { scopes, returnTo: global.location.origin, returnHash: "#/davinci-resolve/tiktok" } });
    if (!/^https:\/\/(?:www\.)?tiktok\.com\//i.test(result.authorizeUrl || "")) throw new Error("TikTok không trả về địa chỉ OAuth hợp lệ.");
    global.location.assign(result.authorizeUrl);
    return result;
  }
  async function select(connectionId) { if (!connectionId) throw new Error("Chưa chọn tài khoản TikTok."); return request("connection/select", { method: "POST", body: { connectionId } }); }
  async function disconnect(connectionId) { if (!connectionId) throw new Error("Chưa chọn tài khoản TikTok."); return request("connection/disconnect", { method: "POST", body: { connectionId } }); }
  async function profile(connectionId) { return request("profile", { query: { connectionId } }); }
  async function videos(connectionId, limit = 20) { return request("videos", { method: "GET", query: { connectionId, limit } }); }
  global.HHTikTokCreatorConnections = Object.freeze({ request, normalizeConnection, status, connect, select, disconnect, profile, videos });
})(window);
