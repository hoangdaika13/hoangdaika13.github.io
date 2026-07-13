const { ObjectId } = require("mongodb");
const { clean, currentUser, enforceRateLimit, publicUser, withApi } = require("./_lib/platform");

const REACTIONS = new Set(["like", "love", "care", "haha", "wow", "sad"]);
const TOPICS = new Set(["Thông báo", "AI & Công nghệ", "Website", "Âm nhạc", "Góp ý", "Đời sống"]);

function idOf(value) {
  try { return new ObjectId(String(value || "")); } catch { return null; }
}

function safeMedia(value) {
  const raw = clean(value, 1200);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.toString() : "";
  } catch { return ""; }
}

function present(post, viewerId) {
  const reactions = Array.isArray(post.reactions) ? post.reactions : [];
  const summary = reactions.reduce((result, item) => {
    result[item.type] = (result[item.type] || 0) + 1;
    return result;
  }, {});
  const viewerReaction = reactions.find((item) => String(item.userId) === viewerId)?.type || "";
  return {
    id: String(post._id),
    author: post.author,
    content: post.content,
    topic: post.topic,
    privacy: post.privacy,
    mediaUrl: post.mediaUrl || "",
    mediaType: post.mediaType || "",
    pinned: Boolean(post.pinned),
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    reactionCount: reactions.length,
    reactions: summary,
    viewerReaction,
    saved: (post.savedBy || []).some((id) => String(id) === viewerId),
    comments: (post.comments || []).slice(-80).map((comment) => ({
      id: String(comment._id), author: comment.author, text: comment.text,
      parentId: comment.parentId || "", createdAt: comment.createdAt
    }))
  };
}

module.exports = async function handler(req, res) {
  return withApi(req, res, async ({ db, body }) => {
    const posts = db.collection("communityPosts");
    await posts.createIndex({ createdAt: -1 });
    const user = await currentUser(req);
    const viewerId = user ? String(user._id) : "";

    if (req.method === "GET") {
      const query = clean(req.query.q, 100);
      const topic = clean(req.query.topic, 60);
      const visibleToViewer = [{ privacy: "public" }, { privacy: { $exists: false } }];
      if (user) visibleToViewer.push({ userId: user._id });
      const filter = { $or: visibleToViewer, ...(TOPICS.has(topic) ? { topic } : {}) };
      if (query) filter.$text = { $search: query };
      try { await posts.createIndex({ content: "text", topic: "text", "author.name": "text" }); } catch { /* Existing index is usable. */ }
      const items = await posts.find(filter).sort({ pinned: -1, createdAt: -1 }).limit(40).toArray();
      return res.status(200).json({ posts: items.map((item) => present(item, viewerId)), signedIn: Boolean(user) });
    }

    if (!user) return res.status(401).json({ error: "Bạn cần đăng nhập để tương tác trong cộng đồng." });
    await enforceRateLimit(db, `community:${user._id}:${req.method}`, 80, 10 * 60 * 1000);

    if (req.method === "DELETE") {
      const postId = idOf(req.query.id);
      if (!postId) return res.status(400).json({ error: "Bài viết không hợp lệ." });
      const result = await posts.deleteOne({ _id: postId, userId: user._id });
      return result.deletedCount ? res.status(200).json({ ok: true }) : res.status(403).json({ error: "Bạn không thể xóa bài viết này." });
    }

    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const action = clean(body.action || "create", 40);

    if (action === "create") {
      const content = clean(body.content, 5000);
      const mediaUrl = safeMedia(body.mediaUrl);
      if (!content && !mediaUrl) return res.status(400).json({ error: "Hãy nhập nội dung hoặc thêm liên kết media." });
      const doc = {
        userId: user._id, author: publicUser(user), content,
        topic: TOPICS.has(body.topic) ? body.topic : "Góp ý",
        privacy: ["public", "followers", "private"].includes(body.privacy) ? body.privacy : "public",
        mediaUrl, mediaType: body.mediaType === "video" ? "video" : mediaUrl ? "image" : "",
        pinned: false, reactions: [], comments: [], savedBy: [], createdAt: new Date(), updatedAt: new Date()
      };
      const result = await posts.insertOne(doc);
      await db.collection("events").insertOne({ type: "community:post", userId: user._id, recordId: result.insertedId, createdAt: new Date() });
      return res.status(201).json({ ok: true, post: present({ ...doc, _id: result.insertedId }, viewerId) });
    }

    const postId = idOf(body.postId);
    if (!postId) return res.status(400).json({ error: "Bài viết không hợp lệ." });
    const post = await posts.findOne({ _id: postId });
    if (!post) return res.status(404).json({ error: "Không tìm thấy bài viết." });

    if (action === "react") {
      const type = REACTIONS.has(body.type) ? body.type : "like";
      const reactions = (post.reactions || []).filter((item) => String(item.userId) !== viewerId);
      if (body.type !== "remove") reactions.push({ userId: user._id, type, createdAt: new Date() });
      await posts.updateOne({ _id: postId }, { $set: { reactions, updatedAt: new Date() } });
    } else if (action === "comment") {
      const text = clean(body.text, 1200);
      if (!text) return res.status(400).json({ error: "Bình luận đang trống." });
      await posts.updateOne({ _id: postId }, { $push: { comments: { _id: new ObjectId(), author: publicUser(user), text, parentId: clean(body.parentId, 40), createdAt: new Date() } }, $set: { updatedAt: new Date() } });
    } else if (action === "save") {
      const saved = (post.savedBy || []).some((id) => String(id) === viewerId);
      await posts.updateOne({ _id: postId }, saved ? { $pull: { savedBy: user._id } } : { $addToSet: { savedBy: user._id } });
    } else {
      return res.status(400).json({ error: "Tác vụ không được hỗ trợ." });
    }

    const updated = await posts.findOne({ _id: postId });
    return res.status(200).json({ ok: true, post: present(updated, viewerId) });
  });
};
