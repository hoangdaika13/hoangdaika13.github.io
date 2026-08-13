(function initHHSchoolSync(root) {
  "use strict";
  const cleanPath = (value) => String(value || "/api/education").replace(/\/+$/, "");
  class HHSchoolSync {
    constructor(options = {}) { this.base = cleanPath(options.apiBase); this.fetch = options.fetch || root.fetch?.bind(root); }
    async request(path, options = {}) {
      if (!this.fetch) throw Object.assign(new Error("Trình duyệt không hỗ trợ đồng bộ mạng."), { code: "FETCH_UNAVAILABLE" });
      const response = await this.fetch(`${this.base}${path}`, { credentials: "include", cache: "no-store", headers: { "Content-Type": "application/json", ...(options.headers || {}) }, ...options });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error(data.error || `Đồng bộ lỗi HTTP ${response.status}.`), { code: data.code || "SYNC_FAILED", status: response.status });
      return data;
    }
    load(profileId) { return this.request(`/progress?learnerProfileId=${encodeURIComponent(profileId)}`); }
    save(profileId, state) { return this.request("/progress", { method: "PUT", body: JSON.stringify({ learnerProfileId: profileId, state }) }); }
    assignments(profileId) { return this.request(`/assignments?learnerProfileId=${encodeURIComponent(profileId)}`); }
    createAssignment(payload) { return this.request("/assignments", { method: "POST", body: JSON.stringify(payload) }); }
    classes() { return this.request("/classes"); }
    createClass(payload) { return this.request("/classes", { method: "POST", body: JSON.stringify(payload) }); }
    aiTutor(payload) { return this.request("/ai-tutor", { method: "POST", body: JSON.stringify(payload) }); }
    reviewQueue() { return this.request("/admin?view=review-queue"); }
  }
  root.HHSchoolSync = HHSchoolSync;
  if (typeof module !== "undefined" && module.exports) module.exports = HHSchoolSync;
})(typeof window !== "undefined" ? window : globalThis);
