(function tiktokCreatorAnalytics(global) {
  "use strict";

  const numeric = (row, names) => { for (const name of names) { const raw = String(row?.[name] ?? "").trim(); if (!raw) continue; const suffix = raw.match(/\s*([kmb])\s*%?$/i)?.[1]?.toLowerCase(); const value = Number(raw.replace(/,/g, "").replace(/[^\d.-]/g, "")); if (Number.isFinite(value)) return value * (suffix === "k" ? 1e3 : suffix === "m" ? 1e6 : suffix === "b" ? 1e9 : 1); } return 0; };
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
  const textValue = (row, names) => { for (const name of names) { const value = String(row?.[name] ?? "").trim(); if (value) return value; } return ""; };
  const average = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  function summarizeDataset(kind, rows = []) {
    const items = Array.isArray(rows) ? rows : [];
    if (!items.length) return { kind, count: 0, metrics: [], top: [] };
    const ranked = (aliases) => items.map((row, index) => ({ index, row, value: numeric(row, aliases), name: textValue(row, ["name", "account", "username", "product", "product-name", "creator", "campaign", "title"]) || `Record ${index + 1}` })).filter((item) => item.value > 0).sort((a, b) => b.value - a.value);
    if (kind === "competitors") {
      const views = items.map((row) => numeric(row, ["views", "view-count", "view_count"])); const followers = items.map((row) => numeric(row, ["followers", "follower-count", "follower_count"])); const engagement = items.map((row) => numeric(row, ["engagement", "engagement-rate", "engagement_rate"]));
      return { kind, count: items.length, metrics: [{ label: "Tài khoản", value: items.length }, { label: "Tổng lượt xem", value: views.reduce((a, b) => a + b, 0) }, { label: "Follower trung bình", value: Math.round(average(followers)) }, { label: "Engagement nhập", value: Math.round(average(engagement) * 100) / 100, suffix: "%" }], top: ranked(["views", "view-count", "view_count"]).slice(0, 5), note: "So sánh cục bộ từ snapshot người dùng nhập; không phải analytics nội bộ của đối thủ." };
    }
    if (kind === "products" || kind === "shop") {
      const revenue = items.map((row) => numeric(row, ["revenue", "gmv", "sales", "amount"])); const orders = items.map((row) => numeric(row, ["orders", "order-count", "order_count", "sold"])); const refunds = items.map((row) => numeric(row, ["refund-rate", "refund_rate", "refund"]));
      return { kind, count: items.length, metrics: [{ label: "Sản phẩm", value: items.length }, { label: "Doanh thu nhập", value: Math.round(revenue.reduce((a, b) => a + b, 0) * 100) / 100 }, { label: "Đơn hàng", value: orders.reduce((a, b) => a + b, 0) }, { label: "Refund trung bình", value: Math.round(average(refunds) * 100) / 100, suffix: "%" }], top: ranked(["revenue", "gmv", "sales", "amount"]).slice(0, 5), note: "Chỉ tổng hợp export của shop; không đại diện toàn thị trường TikTok." };
    }
    if (kind === "influencers") {
      const fees = items.map((row) => numeric(row, ["fee", "rate", "cost"])); const followers = items.map((row) => numeric(row, ["followers", "follower-count", "follower_count"])); const ready = items.filter((row) => /ready|approved|active|đã duyệt|sẵn sàng/i.test(textValue(row, ["status"]))).length;
      return { kind, count: items.length, metrics: [{ label: "Creator", value: items.length }, { label: "Phí trung bình", value: Math.round(average(fees) * 100) / 100 }, { label: "Follower trung bình", value: Math.round(average(followers)) }, { label: "Sẵn sàng", value: ready }], top: ranked(["followers", "follower-count", "follower_count", "engagement"]).slice(0, 5), note: "Creator CRM cục bộ; dữ liệu liên hệ và phí do người dùng cung cấp." };
    }
    if (kind === "affiliate") {
      const commission = items.map((row) => numeric(row, ["commission", "commission-amount", "commission_amount"])); const orders = items.map((row) => numeric(row, ["orders", "order-count", "order_count"]));
      return { kind, count: items.length, metrics: [{ label: "Record", value: items.length }, { label: "Hoa hồng", value: Math.round(commission.reduce((a, b) => a + b, 0) * 100) / 100 }, { label: "Đơn hàng", value: orders.reduce((a, b) => a + b, 0) }], top: ranked(["commission", "commission-amount", "commission_amount"]).slice(0, 5), note: "Tổng hợp từ file Affiliate Center được nhập thủ công." };
    }
    if (kind === "ads") {
      const spend = items.map((row) => numeric(row, ["spend", "cost"])); const conversions = items.map((row) => numeric(row, ["conversions", "conversion", "results"])); const roas = items.map((row) => numeric(row, ["roas"]));
      return { kind, count: items.length, metrics: [{ label: "Chiến dịch", value: items.length }, { label: "Chi tiêu", value: Math.round(spend.reduce((a, b) => a + b, 0) * 100) / 100 }, { label: "Chuyển đổi", value: conversions.reduce((a, b) => a + b, 0) }, { label: "ROAS trung bình", value: Math.round(average(roas) * 100) / 100 }], top: ranked(["roas", "conversions", "results"]).slice(0, 5), note: "Báo cáo từ file người dùng nhập; không phải đồng bộ Marketing API." };
    }
    if (kind === "community") {
      const unread = items.filter((row) => /unread|new|chưa đọc|mới/i.test(textValue(row, ["status", "state"]))).length; const labels = new Map(); items.forEach((row) => { const label = textValue(row, ["sentiment", "label", "tag"]); if (label) labels.set(label, (labels.get(label) || 0) + 1); });
      return { kind, count: items.length, metrics: [{ label: "Nội dung", value: items.length }, { label: "Chưa đọc (file nhập)", value: unread }, { label: "Nhãn có sẵn", value: labels.size }], top: [...labels.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, value], index) => ({ index, name, value })), note: "Chỉ đếm nhãn đã có trong file; không tự suy đoán sentiment." };
    }
    return { kind, count: items.length, metrics: [{ label: "Record", value: items.length }], top: [], note: "Tổng hợp cục bộ từ dữ liệu người dùng cung cấp." };
  }
  async function importSnapshot(rows, snapshotType = "trend", connectionId = "") { if (!Array.isArray(rows) || !rows.length) throw new Error("Tệp nhập không có record hợp lệ."); return global.HHTikTokCreatorConnections.request("snapshot/import", { method: "POST", body: { rows: rows.slice(0, 1000), snapshotType, connectionId, source: "user-import" } }); }
  global.HHTikTokCreatorAnalytics = Object.freeze({ normalizeTrend, scoreTrend, analyzeTrends, accountMetrics, summarizeDataset, importSnapshot });
})(window);
