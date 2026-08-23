(function initHHSchoolSync(root) {
  "use strict";
  const cleanPath = (value) => String(value || "/api/education").replace(/\/+$/, "");
  class HHSchoolSync {
    constructor(options = {}) { this.base = cleanPath(options.apiBase); this.fetch = options.fetch || root.fetch?.bind(root); }
    async request(path, options = {}) {
      if (!this.fetch) throw Object.assign(new Error("Trình duyệt không hỗ trợ đồng bộ mạng."), { code: "FETCH_UNAVAILABLE" });
      const response = await this.fetch(`${this.base}${path}`, { credentials: "include", cache: "no-store", headers: { "Content-Type": "application/json", ...(options.headers || {}) }, ...options });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error(data.error || `Đồng bộ lỗi HTTP ${response.status}.`), { code: data.code || "SYNC_FAILED", status: response.status, data });
      return data;
    }
    load(profileId, scope = "own", accessId = "") { return this.request(`/progress?learnerProfileId=${encodeURIComponent(profileId)}${scope === "linked" ? `&scope=linked&accessId=${encodeURIComponent(accessId)}` : ""}`); }
    save(profileId, state, baseRevision = Number(state?.serverRevision || 0)) { return this.request("/progress", { method: "PUT", body: JSON.stringify({ learnerProfileId: profileId, state, baseRevision }) }); }
    assignments(profileId) { return this.request(`/assignments?learnerProfileId=${encodeURIComponent(profileId)}`); }
    createAssignment(payload) { return this.request("/assignments", { method: "POST", body: JSON.stringify(payload) }); }
    submissions(query = "") { return this.request(`/submissions${query ? `?${query}` : ""}`); }
    submitAssignment(payload) { return this.request("/submissions", { method: "POST", body: JSON.stringify(payload) }); }
    gradeSubmission(payload) { return this.request("/submissions", { method: "PATCH", body: JSON.stringify(payload) }); }
    classes() { return this.request("/classes"); }
    createClass(payload) { return this.request("/classes", { method: "POST", body: JSON.stringify(payload) }); }
    updateClass(payload) { return this.request("/classes", { method: "PATCH", body: JSON.stringify(payload) }); }
    archiveClass(classId) { return this.request(`/classes?classId=${encodeURIComponent(classId)}`, { method: "DELETE" }); }
    joinClass(inviteCode, learnerProfileId) { return this.request("/enrollments", { method: "POST", body: JSON.stringify({ inviteCode, learnerProfileId }) }); }
    family(payload, method = "POST") { return this.request("/family", { method, body: JSON.stringify(payload) }); }
    aiTutor(payload) { return this.request("/ai-tutor", { method: "POST", body: JSON.stringify(payload) }); }
    reportTutor(payload) { return this.aiTutor({ ...payload, action: "report" }); }
    reviewQueue() { return this.request("/admin?view=review-queue"); }
    content() { return this.request("/admin?view=content"); }
    createDraft(payload) { return this.request("/admin", { method: "POST", body: JSON.stringify({ ...payload, action: "create-draft" }) }); }
    review(payload) { return this.request("/admin", { method: "PATCH", body: JSON.stringify(payload) }); }
  }
  root.HHSchoolSync = HHSchoolSync;
  if (typeof module !== "undefined" && module.exports) module.exports = HHSchoolSync;
})(typeof window !== "undefined" ? window : globalThis);
