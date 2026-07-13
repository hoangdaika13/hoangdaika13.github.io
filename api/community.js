const { ObjectId } = require("mongodb");
const { clean, currentUser, enforceRateLimit, withApi } = require("./_lib/platform");

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

function socialUser(user) {
  if (!user) return { id: "", name: "Thành viên HH", avatar: "" };
  return {
    id: String(user.id || user._id || ""),
    name: clean(user.name || "Thành viên HH", 100),
    avatar: safeMedia(user.avatar)
  };
}

function present(post, viewerId) {
  const reactions = Array.isArray(post.reactions) ? post.reactions : [];
  const summary = reactions.reduce((result, item) => {
    result[item.type] = (result[item.type] || 0) + 1;
    return result;
  }, {});
  return {
    id: String(post._id),
    author: socialUser(post.author),
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
    viewerReaction: reactions.find((item) => String(item.userId) === viewerId)?.type || "",
    saved: (post.savedBy || []).some((id) => String(id) === viewerId),
    owned: String(post.userId || "") === viewerId,
    comments: (post.comments || []).slice(-80).map((comment) => ({
      id: String(comment._id), author: socialUser(comment.author), text: comment.text,
      parentId: comment.parentId || "", createdAt: comment.createdAt
    }))
  };
}

async function notify(db, userId, actor, type, message, recordId) {
  if (!userId || String(userId) === String(actor._id)) return;
  await db.collection("communityNotifications").insertOne({
    userId, actor: socialUser(actor), type, message: clean(message, 240), recordId,
    read: false, createdAt: new Date()
  });
}

module.exports = async function handler(req, res) {
  return withApi(req, res, async ({ db, body }) => {
    const posts = db.collection("communityPosts");
    const stories = db.collection("communityStories");
    const follows = db.collection("communityFollows");
    await Promise.all([
      posts.createIndex({ createdAt: -1 }),
      stories.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      follows.createIndex({ followerId: 1, targetId: 1 }, { unique: true })
    ]);
    const user = await currentUser(req);
    const viewerId = user ? String(user._id) : "";

    if (req.method === "GET") {
      const query = clean(req.query.q, 100);
      const topic = clean(req.query.topic, 60);
      const followingDocs = user ? await follows.find({ followerId: user._id }).toArray() : [];
      const followingIds = followingDocs.map((item) => item.targetId);
      const visibleToViewer = [{ privacy: "public" }, { privacy: { $exists: false } }];
      if (user) visibleToViewer.push({ userId: user._id });
      if (followingIds.length) visibleToViewer.push({ privacy: "followers", userId: { $in: followingIds } });
      const filter = { $or: visibleToViewer, ...(TOPICS.has(topic) ? { topic } : {}) };
      if (query) filter.$text = { $search: query };
      try { await posts.createIndex({ content: "text", topic: "text", "author.name": "text" }); } catch { /* Existing index is usable. */ }
      const [items, activeStories, suggestions, notifications, groups, communityEvents] = await Promise.all([
        posts.find(filter).sort({ pinned: -1, createdAt: -1 }).limit(40).toArray(),
        stories.find({ expiresAt: { $gt: new Date() }, $or: [{ privacy: "public" }, ...(user ? [{ userId: user._id }] : [])] }).sort({ createdAt: -1 }).limit(24).toArray(),
        user ? db.collection("users").find({ _id: { $ne: user._id } }, { projection: { name: 1, avatar: 1 } }).limit(8).toArray() : [],
        user ? db.collection("communityNotifications").find({ userId: user._id }).sort({ createdAt: -1 }).limit(20).toArray() : [],
        db.collection("communityGroups").find({ visibility: "public" }).sort({ createdAt: -1 }).limit(12).toArray(),
        db.collection("communityEvents").find({ startsAt: { $gte: new Date(Date.now() - 86400000) } }).sort({ startsAt: 1 }).limit(12).toArray()
      ]);
      return res.status(200).json({
        posts: items.map((item) => present(item, viewerId)),
        stories: activeStories.map((item) => ({ id: String(item._id), author: socialUser(item.author), content: item.content, mediaUrl: item.mediaUrl || "", createdAt: item.createdAt, expiresAt: item.expiresAt })),
        suggestions: suggestions.map((item) => ({ ...socialUser(item), following: followingIds.some((id) => String(id) === String(item._id)) })),
        notifications: notifications.map((item) => ({ id: String(item._id), actor: socialUser(item.actor), type: item.type, message: item.message, recordId: String(item.recordId || ""), read: Boolean(item.read), createdAt: item.createdAt })),
        groups: groups.map((item) => ({ id: String(item._id), name: item.name, description: item.description, owner: socialUser(item.owner), memberCount: (item.memberIds || []).length })),
        events: communityEvents.map((item) => ({ id: String(item._id), name: item.name, description: item.description, startsAt: item.startsAt, owner: socialUser(item.owner) })),
        unread: notifications.filter((item) => !item.read).length,
        signedIn: Boolean(user)
      });
    }

    if (!user) return res.status(401).json({ error: "Bạn cần đăng nhập để tương tác trong cộng đồng." });
    await enforceRateLimit(db, `community:${user._id}:${req.method}`, 100, 10 * 60 * 1000);

    if (req.method === "DELETE") {
      const postId = idOf(req.query.id);
      if (!postId) return res.status(400).json({ error: "Bài viết không hợp lệ." });
      const result = await posts.deleteOne({ _id: postId, userId: user._id });
      return result.deletedCount ? res.status(200).json({ ok: true }) : res.status(403).json({ error: "Bạn không thể xóa bài viết này." });
    }

    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const action = clean(body.action || "create", 40);

    if (action === "story:create") {
      const content = clean(body.content, 600);
      const mediaUrl = safeMedia(body.mediaUrl);
      if (!content && !mediaUrl) return res.status(400).json({ error: "Tin đang trống." });
      const doc = { userId: user._id, author: socialUser(user), content, mediaUrl, privacy: "public", createdAt: new Date(), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) };
      const result = await stories.insertOne(doc);
      return res.status(201).json({ ok: true, story: { ...doc, id: String(result.insertedId) } });
    }

    if (action === "follow") {
      const targetId = idOf(body.targetId);
      if (!targetId || String(targetId) === viewerId) return res.status(400).json({ error: "Thành viên không hợp lệ." });
      const existing = await follows.findOne({ followerId: user._id, targetId });
      if (existing) await follows.deleteOne({ _id: existing._id });
      else {
        await follows.insertOne({ followerId: user._id, targetId, createdAt: new Date() });
        await notify(db, targetId, user, "follow", `${user.name || "Một thành viên"} đã theo dõi bạn.`, user._id);
      }
      return res.status(200).json({ ok: true, following: !existing });
    }

    if (action === "group:create") {
      const name = clean(body.name, 100);
      if (name.length < 3) return res.status(400).json({ error: "Tên nhóm cần ít nhất 3 ký tự." });
      const doc = { name, description: clean(body.description, 500), ownerId: user._id, owner: socialUser(user), memberIds: [user._id], visibility: "public", createdAt: new Date() };
      const result = await db.collection("communityGroups").insertOne(doc);
      return res.status(201).json({ ok: true, group: { ...doc, id: String(result.insertedId) } });
    }

    if (action === "event:create") {
      const name = clean(body.name, 100);
      const startsAt = new Date(body.startsAt);
      if (name.length < 3 || Number.isNaN(startsAt.getTime())) return res.status(400).json({ error: "Tên hoặc thời gian sự kiện không hợp lệ." });
      const doc = { name, description: clean(body.description, 500), startsAt, ownerId: user._id, owner: socialUser(user), createdAt: new Date() };
      const result = await db.collection("communityEvents").insertOne(doc);
      return res.status(201).json({ ok: true, event: { ...doc, id: String(result.insertedId) } });
    }

    if (action === "notifications:read") {
      await db.collection("communityNotifications").updateMany({ userId: user._id, read: false }, { $set: { read: true, readAt: new Date() } });
      return res.status(200).json({ ok: true });
    }

    if (action === "create") {
      const content = clean(body.content, 5000);
      const mediaUrl = safeMedia(body.mediaUrl);
      if (!content && !mediaUrl) return res.status(400).json({ error: "Hãy nhập nội dung hoặc thêm liên kết media." });
      const doc = {
        userId: user._id, author: socialUser(user), content,
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
      if (body.type !== "remove") await notify(db, post.userId, user, "reaction", `${user.name || "Một thành viên"} đã bày tỏ cảm xúc về bài viết của bạn.`, postId);
    } else if (action === "comment") {
      const text = clean(body.text, 1200);
      if (!text) return res.status(400).json({ error: "Bình luận đang trống." });
      await posts.updateOne({ _id: postId }, { $push: { comments: { _id: new ObjectId(), author: socialUser(user), text, parentId: clean(body.parentId, 40), createdAt: new Date() } }, $set: { updatedAt: new Date() } });
      await notify(db, post.userId, user, "comment", `${user.name || "Một thành viên"} đã bình luận bài viết của bạn.`, postId);
    } else if (action === "save") {
      const saved = (post.savedBy || []).some((id) => String(id) === viewerId);
      await posts.updateOne({ _id: postId }, saved ? { $pull: { savedBy: user._id } } : { $addToSet: { savedBy: user._id } });
    } else if (action === "edit") {
      if (String(post.userId) !== viewerId) return res.status(403).json({ error: "Bạn chỉ có thể sửa bài viết của mình." });
      const content = clean(body.content, 5000);
      if (!content) return res.status(400).json({ error: "Nội dung bài viết đang trống." });
      await posts.updateOne({ _id: postId }, { $set: { content, updatedAt: new Date() } });
    } else if (action === "report") {
      await db.collection("communityReports").updateOne({ postId, reporterId: user._id }, { $setOnInsert: { postId, reporterId: user._id, reason: clean(body.reason || "Nội dung không phù hợp", 300), createdAt: new Date(), status: "pending" } }, { upsert: true });
    } else {
      return res.status(400).json({ error: "Tác vụ không được hỗ trợ." });
    }

    const updated = await posts.findOne({ _id: postId });
    return res.status(200).json({ ok: true, post: present(updated, viewerId) });
  });
};
