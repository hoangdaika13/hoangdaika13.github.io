(function tiktokCreatorAnalytics(global) {
  "use strict";

  const numeric = (row, names) => { for (const name of names) { const raw = String(row?.[name] ?? "").trim(); if (!raw) continue; const value = Number(raw.replace(/[^\d.-]/g, "")); if (Number.isFinite(value)) return value; } return 0; };
  function normalizeTrend(row, index = 0) {
    const views = numeric(row, ["views", "view-count", "view_count", "plays"]); const previous = numeric(row, ["previous-views", "previous_views", "views-before", "previous"]); const posts = Math.max(1, numeric(row, ["posts", "video-count", "video_count", "count"])); const engagement = numeric(row, ["engagement", "engagement-rate", "engagement_rate"]); const delta = previous > 0 ? (views - previous) / previous : views > 0 ? 1 : 0;
    return { id: row.id || `trend-${index + 1}`, name: String(row.name || row.keyword || row.hashtag || row.sound || row.title || `Trend ${index + 1}`), views, previous, posts, engagement, velocity: Math.round(delta * 1000) / 10, saturation: Math.min(100, Math.round(Math.log10(posts + 1) * 28)), relevance: Math.min(100, Math.max(0, numeric(row, ["relevance", "relevance-score", "relevance_score"]) || 55)), source: String(row.source || "user-import") };
  }
  function scoreTrend(item) { const growth = Math.max(-100, Math.min(300, item.velocity)); return Math.max(0, Math.min(100, Math.round(35 + growth * .18 + item.relevance * .35 - item.saturation * .18 + Math.log10(item.views + 1) * 5))); }
  function analyzeTrends(rows) { return (rows || []).map(normalizeTrend).map((item) => ({ ...item, score: scoreTrend(item) })).sort((a, b) => b.score - a.score); }
  function accountMetrics(profile = {}, videos = []) {
    const follower = Number(profile.follower_count || profile.followers || 0); const totals = videos.reduce((sum, video) => ({ views: sum.views + Number(video.view_count || 0), likes: sum.likes + Number(video.like_count || 0), comments: sum.comments + Number(video.comment_count || 0), shares: sum.shares + Number(video.share_count || 0) }), { views: 0, likes: 0, comments: 0, shares: 0 });
    return { follower, videos: Number(profile.video_count || videos.length || 0), likes: Number(profile.likes_count || totals.likes || 0), views: totals.views, engagementRate: totals.views ? Math.round((totals.likes + totals.comments + totals.shares) / totals.views * 10000) / 100 : 0, source: "connected-account" };
  }
  async function importSnapshot(rows, snapshotType = "trend", connectionId = "") { if (!Array.isArray(rows) || !rows.length) throw new Error("Tệp nhập không có record hợp lệ."); return global.HHTikTokCreatorConnections.request("snapshot/import", { method: "POST", body: { rows: rows.slice(0, 1000), snapshotType, connectionId, source: "user-import" } }); }
  global.HHTikTokCreatorAnalytics = Object.freeze({ normalizeTrend, scoreTrend, analyzeTrends, accountMetrics, importSnapshot });
})(window);
