"use strict";

const { clean, currentUser, withApi } = require("../utils/platform");
const { cancelJob, findJob, jobPublic, listJobs } = require("../services/toolGateway");

module.exports = async function handler(req, res) {
  return withApi(req, res, async ({ db }) => {
    const user = await currentUser(req);
    if (!user) return res.status(401).json({ error: "Bạn cần đăng nhập để xem tác vụ.", code: "AUTH_REQUIRED" });
    const id = clean(req.query?.id, 80);
    if (req.method === "GET") {
      if (id) {
        const job = await findJob(db, user, id);
        return job ? res.status(200).json({ job: jobPublic(job) }) : res.status(404).json({ error: "Không tìm thấy tác vụ.", code: "JOB_NOT_FOUND" });
      }
      return res.status(200).json({ jobs: await listJobs(db, user, req.query?.limit) });
    }
    if (req.method === "DELETE") {
      const job = await cancelJob(db, user, id);
      return job ? res.status(200).json({ ok: true, job }) : res.status(404).json({ error: "Không tìm thấy tác vụ.", code: "JOB_NOT_FOUND" });
    }
    return res.status(405).json({ error: "Method not allowed" });
  });
};
