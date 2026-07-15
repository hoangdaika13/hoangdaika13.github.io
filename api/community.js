const { ObjectId } = require("mongodb");
const { clean, currentUser, enforceRateLimit, withApi } = require("../utils/platform");

const REACTIONS = new Set(["like", "love", "care", "haha", "wow", "sad", "angry"]);
const TOPICS = new Set(["Thông báo", "AI & Công nghệ", "Website", "Âm nhạc", "Góp ý", "Đời sống"]);
const MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "video/mp4", "video/webm", "video/quicktime"]);
const MAX_MEDIA_BYTES = 2.5 * 1024 * 1024;

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

async function blockedBetween(db, firstId, secondId) {
  if (!firstId || !secondId) return false;
  const [relation, legacy] = await Promise.all([
    db.collection("communityRelations").findOne({
      type: "block",
      active: true,
      $or: [{ actorId: firstId, targetId: secondId }, { actorId: secondId, targetId: firstId }]
    }, { projection: { _id: 1 } }),
    db.collection("communityBlocks").findOne({
      $or: [{ blockerId: firstId, targetId: secondId }, { blockerId: secondId, targetId: firstId }]
    }, { projection: { _id: 1 } })
  ]);
  return Boolean(relation || legacy);
}

async function areFriends(db, firstId, secondId) {
  if (!firstId || !secondId) return false;
  return Boolean(await db.collection("communityFriendships").findOne({
    $or: [
      { userAId: firstId, userBId: secondId, status: "accepted" },
      { userAId: secondId, userBId: firstId, status: "accepted" },
      { userIds: { $all: [firstId, secondId] }, status: { $ne: "removed" } }
    ]
  }, { projection: { _id: 1 } }));
}

async function friendIdsFor(db, userId) {
  if (!userId) return [];
  const records = await db.collection("communityFriendships").find({
    $and: [
      { $or: [{ userAId: userId }, { userBId: userId }, { userIds: userId }] },
      { $or: [{ status: "accepted" }, { userIds: { $exists: true }, status: { $ne: "removed" } }] }
    ]
  }, { projection: { userAId: 1, userBId: 1, userIds: 1 } }).limit(1000).toArray();
  const ids = records.flatMap((item) => item.userIds || [item.userAId, item.userBId]);
  return [...new Map(ids.filter(Boolean).filter((id) => String(id) !== String(userId)).map((id) => [String(id), id])).values()];
}

async function isFollowing(db, followerId, targetId) {
  if (!followerId || !targetId) return false;
  const [relation, legacy] = await Promise.all([
    db.collection("communityRelations").findOne({ actorId: followerId, targetId, type: "follow", active: true }, { projection: { _id: 1 } }),
    db.collection("communityFollows").findOne({ followerId, targetId }, { projection: { _id: 1 } })
  ]);
  return Boolean(relation || legacy);
}

async function canViewPost(db, post, user) {
  if (!post) return false;
  const viewerId = user?._id;
  const ownerId = post.userId;
  if (viewerId && String(viewerId) === String(ownerId)) return true;
  if (post.deletedAt || post.archived || (post.scheduledAt && new Date(post.scheduledAt) > new Date())) return false;
  if (viewerId && await blockedBetween(db, viewerId, ownerId)) return false;
  const privacy = post.privacy || "public";
  if (privacy === "public") return true;
  if (!viewerId || privacy === "private") return false;
  if (privacy === "followers") return isFollowing(db, viewerId, ownerId);
  if (privacy === "friends") return areFriends(db, viewerId, ownerId);
  if (privacy === "friends-of-friends") {
    if (await areFriends(db, viewerId, ownerId)) return true;
    const viewerFriendIds = await friendIdsFor(db, viewerId);
    if (!viewerFriendIds.length) return false;
    const ownerFriendIds = await friendIdsFor(db, ownerId);
    const ownerSet = new Set(ownerFriendIds.map(String));
    return viewerFriendIds.some((id) => ownerSet.has(String(id)));
  }
  return false;
}

async function canViewStory(db, story, user) {
  if (!story || story.deletedAt || new Date(story.expiresAt) <= new Date()) return false;
  const viewerId = user?._id;
  if (viewerId && String(viewerId) === String(story.userId)) return true;
  if (viewerId && await blockedBetween(db, viewerId, story.userId)) return false;
  if ((story.privacy || "public") === "public") return true;
  if (!viewerId || story.privacy === "private") return false;
  return areFriends(db, viewerId, story.userId);
}

function rankFeed(items, context = {}) {
  const now = Date.now();
  const following = new Set((context.followingIds || []).map(String));
  const friends = new Set((context.friendIds || []).map(String));
  const priority = new Set((context.priorityUserIds || []).map(String));
  const interests = new Set((context.interests || []).map((item) => String(item).toLocaleLowerCase("vi")));
  const scored = items.map((post) => {
    const authorId = String(post.userId || post.author?.id || "");
    const ageHours = Math.max(0, (now - new Date(post.createdAt || 0).getTime()) / 3600000);
    const freshness = Math.max(0, 36 - Math.log2(ageHours + 1) * 7);
    const engagement = Math.log2(1 + (post.reactions?.length || 0) + (post.comments?.length || 0) * 2 + Number(post.shares || 0) * 2) * 4;
    const relation = (friends.has(authorId) ? 18 : 0) + (following.has(authorId) ? 10 : 0) + (priority.has(authorId) ? 24 : 0);
    const topic = String(post.topic || "").toLocaleLowerCase("vi");
    const interest = [...interests].some((item) => item && (topic.includes(item) || String(post.content || "").toLocaleLowerCase("vi").includes(item))) ? 8 : 0;
    const media = post.mediaType === "video" ? 3 : (post.media || []).length ? 2 : 0;
    return { post, score: (post.pinned ? (String(post.userId) === String(context.viewerId || "") ? 10000 : 5) : 0) + freshness + engagement + relation + interest + media };
  }).sort((a, b) => b.score - a.score || new Date(b.post.createdAt) - new Date(a.post.createdAt));

  const diversified = [];
  while (scored.length && diversified.length < 40) {
    const previous = diversified.at(-1)?.post;
    const beforePrevious = diversified.at(-2)?.post;
    let index = scored.findIndex(({ post }) => {
      if (!previous || !beforePrevious) return true;
      const sameAuthor = String(post.userId) === String(previous.userId) && String(post.userId) === String(beforePrevious.userId);
      const sameTopic = post.topic === previous.topic && post.topic === beforePrevious.topic;
      return !sameAuthor && !sameTopic;
    });
    if (index < 0) index = 0;
    diversified.push(scored.splice(index, 1)[0]);
  }
  return diversified.map(({ post, score }) => ({ ...post, feedScore: Math.round(score * 10) / 10 }));
}

function present(post, viewerId) {
  const reactions = Array.isArray(post.reactions) ? post.reactions : [];
  const pollVotes = Array.isArray(post.poll?.votes) ? post.poll.votes : [];
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
    media: (post.media || []).slice(0, 4).map((item) => ({ id: String(item.id || ""), type: item.type === "video" ? "video" : "image" })),
    pinned: Boolean(post.pinned),
    feeling: clean(post.feeling, 80),
    location: clean(post.location, 120),
    shares: Number(post.shares || 0),
    canReshare: post.canReshare !== false,
    commentsEnabled: post.commentsEnabled !== false,
    hideReactionCounts: Boolean(post.hideReactionCounts),
    archived: Boolean(post.archived),
    scheduledAt: post.scheduledAt || null,
    background: clean(post.background, 40),
    taggedUsers: (post.taggedUsers || []).slice(0, 20).map(socialUser),
    poll: post.poll?.question ? {
      question: clean(post.poll.question, 220),
      options: (post.poll.options || []).slice(0, 6).map((option) => ({
        id: String(option.id),
        text: clean(option.text, 160),
        votes: pollVotes.filter((vote) => String(vote.optionId) === String(option.id)).length
      })),
      totalVotes: pollVotes.length,
      viewerVote: String(pollVotes.find((vote) => String(vote.userId) === viewerId)?.optionId || "")
    } : null,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    reactionCount: reactions.length,
    reactions: summary,
    viewerReaction: reactions.find((item) => String(item.userId) === viewerId)?.type || "",
    saved: (post.savedBy || []).some((id) => String(id) === viewerId),
    owned: String(post.userId || "") === viewerId,
    comments: (post.comments || []).filter((comment) => !comment.deletedAt).slice(-80).map((comment) => {
      const commentReactions = Array.isArray(comment.reactions) ? comment.reactions : [];
      return {
        id: String(comment._id), author: socialUser(comment.author), text: comment.text,
        parentId: comment.parentId || "", createdAt: comment.createdAt, updatedAt: comment.updatedAt,
        owned: String(comment.author?.id || "") === viewerId,
        reactionCount: commentReactions.length,
        viewerReaction: commentReactions.find((item) => String(item.userId) === viewerId)?.type || "",
        pinned: Boolean(comment.pinned)
      };
    })
  };
}

async function notify(db, userId, actor, type, message, recordId) {
  if (!userId || String(userId) === String(actor._id)) return;
  const now = new Date();
  const groupKey = `${clean(type, 40)}:${String(actor._id)}:${String(recordId || "")}`;
  await db.collection("communityNotifications").updateOne(
    { userId, groupKey, read: false },
    {
      $set: { actor: socialUser(actor), type: clean(type, 40), message: clean(message, 240), recordId, updatedAt: now },
      $inc: { count: 1 },
      $setOnInsert: { userId, groupKey, read: false, createdAt: now }
    },
    { upsert: true }
  );
}

module.exports = async function handler(req, res) {
  return withApi(req, res, async ({ db, body }) => {
    const posts = db.collection("communityPosts");
    const stories = db.collection("communityStories");
    const follows = db.collection("communityFollows");
    const mediaFiles = db.collection("communityMedia");
    await Promise.all([
      posts.createIndex({ createdAt: -1 }),
      posts.createIndex({ userId: 1, deletedAt: 1, archived: 1, createdAt: -1 }),
      posts.createIndex({ privacy: 1, scheduledAt: 1, createdAt: -1 }),
      stories.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      follows.createIndex({ followerId: 1, targetId: 1 }, { unique: true }),
      db.collection("communityFeedPreferences").createIndex({ userId: 1 }, { unique: true }),
      mediaFiles.createIndex({ userId: 1, createdAt: -1 }),
      mediaFiles.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
    ]);
    const user = await currentUser(req);
    const viewerId = user ? String(user._id) : "";

    if (req.method === "GET" && req.query.media) {
      const mediaId = idOf(req.query.media);
      if (!mediaId) return res.status(400).json({ error: "Media không hợp lệ." });
      const item = await mediaFiles.findOne({ _id: mediaId });
      if (!item) return res.status(404).json({ error: "Không tìm thấy media." });
      const linkedPost = item.postId ? await posts.findOne({ _id: item.postId }) : null;
      const linkedStory = !linkedPost ? await stories.findOne({ mediaId }) : null;
      const allowed = linkedPost ? await canViewPost(db, linkedPost, user) : linkedStory ? await canViewStory(db, linkedStory, user) : Boolean(user && String(item.userId) === viewerId);
      if (!allowed) return res.status(404).json({ error: "Không tìm thấy media." });
      const bytes = Buffer.isBuffer(item.data) ? item.data : Buffer.from(item.data?.buffer || item.data || []);
      res.setHeader("Content-Type", item.mimeType || "application/octet-stream");
      res.setHeader("Content-Length", bytes.length);
      res.setHeader("Content-Disposition", `inline; filename="${String(item.filename || "community-media").replace(/[\r\n"\\]/g, "")}"`);
      const publicMedia = linkedPost ? (linkedPost.privacy || "public") === "public" : linkedStory ? (linkedStory.privacy || "public") === "public" : false;
      res.setHeader("Cache-Control", publicMedia ? "public, max-age=3600" : "private, no-store");
      return res.status(200).send(bytes);
    }

    if (req.method === "GET") {
      const query = clean(req.query.q, 100);
      const topic = clean(req.query.topic, 60);
      const feedMode = clean(req.query.feed || "ranked", 20);
      const [legacyFollowingDocs, relationFollowingDocs, friendshipDocs, legacyBlockDocs, relationBlockDocs, mutedRelationDocs, feedPreferences, viewerProfile] = user ? await Promise.all([
        follows.find({ followerId: user._id }).toArray(),
        db.collection("communityRelations").find({ actorId: user._id, type: "follow", active: true }).toArray(),
        db.collection("communityFriendships").find({
          $and: [
            { $or: [{ userAId: user._id }, { userBId: user._id }, { userIds: user._id }] },
            { $or: [{ status: "accepted" }, { userIds: { $exists: true }, status: { $ne: "removed" } }] }
          ]
        }).toArray(),
        db.collection("communityBlocks").find({ $or: [{ blockerId: user._id }, { targetId: user._id }] }).toArray(),
        db.collection("communityRelations").find({ type: "block", active: true, $or: [{ actorId: user._id }, { targetId: user._id }] }).toArray(),
        db.collection("communityRelations").find({ actorId: user._id, type: "mute", active: true }).toArray(),
        db.collection("communityFeedPreferences").findOne({ userId: user._id }),
        db.collection("communityProfiles").findOne({ userId: user._id })
      ]) : [[], [], [], [], [], [], null, null];
      const followingIds = [...new Map([...legacyFollowingDocs, ...relationFollowingDocs].map((item) => [String(item.targetId), item.targetId])).values()];
      const friendIds = [...new Map(friendshipDocs.flatMap((item) => item.userIds || [item.userAId, item.userBId]).filter(Boolean).filter((id) => String(id) !== viewerId).map((id) => [String(id), id])).values()];
      const friendOfFriendDocs = friendIds.length ? await db.collection("communityFriendships").find({
        status: "accepted",
        $or: [{ userAId: { $in: friendIds } }, { userBId: { $in: friendIds } }]
      }, { projection: { userAId: 1, userBId: 1 } }).limit(5000).toArray() : [];
      const directFriendSet = new Set(friendIds.map(String));
      const friendOfFriendIds = [...new Map(friendOfFriendDocs.flatMap((item) => [item.userAId, item.userBId]).filter(Boolean).filter((id) => String(id) !== viewerId && !directFriendSet.has(String(id))).map((id) => [String(id), id])).values()];
      const blockedIds = [...new Map([
        ...legacyBlockDocs.map((item) => String(item.blockerId) === viewerId ? item.targetId : item.blockerId),
        ...relationBlockDocs.map((item) => String(item.actorId) === viewerId ? item.targetId : item.actorId)
      ].filter(Boolean).map((id) => [String(id), id])).values()];
      const mutedIds = [...new Map([...(feedPreferences?.mutedUserIds || []).map(idOf).filter(Boolean), ...mutedRelationDocs.map((item) => item.targetId)].map((id) => [String(id), id])).values()];
      const excludedAuthorIds = [...blockedIds, ...mutedIds];
      const hiddenPostIds = [...(feedPreferences?.hiddenPostIds || []), ...(feedPreferences?.uninterestedPostIds || [])].map(idOf).filter(Boolean);
      const visibleToViewer = [{ privacy: "public" }, { privacy: { $exists: false } }];
      if (user) visibleToViewer.push({ userId: user._id });
      if (followingIds.length) visibleToViewer.push({ privacy: "followers", userId: { $in: followingIds } });
      if (friendIds.length) visibleToViewer.push({ privacy: { $in: ["friends", "friends-of-friends"] }, userId: { $in: friendIds } });
      if (friendOfFriendIds.length) visibleToViewer.push({ privacy: "friends-of-friends", userId: { $in: friendOfFriendIds } });
      const now = new Date();
      const filter = {
        $and: [
          { $or: visibleToViewer },
          { deletedAt: { $exists: false } },
          { archived: { $ne: true } },
          { $or: [{ scheduledAt: { $exists: false } }, { scheduledAt: null }, { scheduledAt: { $lte: now } }] },
          ...(excludedAuthorIds.length ? [{ userId: { $nin: excludedAuthorIds } }] : []),
          ...(hiddenPostIds.length ? [{ _id: { $nin: hiddenPostIds } }] : []),
          ...(TOPICS.has(topic) ? [{ topic }] : [])
        ]
      };
      if (query) filter.$text = { $search: query };
      try { await posts.createIndex({ content: "text", topic: "text", "author.name": "text" }); } catch { /* Existing index is usable. */ }
      const [rawItems, activeStories, rawSuggestions, notifications, groups, communityEvents] = await Promise.all([
        posts.find(filter).sort({ pinned: -1, createdAt: -1 }).limit(feedMode === "latest" ? 40 : 120).toArray(),
        stories.find({ expiresAt: { $gt: new Date() }, deletedAt: { $exists: false } }).sort({ createdAt: -1 }).limit(80).toArray(),
        user ? db.collection("users").find({ _id: { $nin: [user._id, ...blockedIds] }, status: { $nin: ["deleted", "suspended", "locked"] } }, { projection: { name: 1, avatar: 1 } }).limit(16).toArray() : [],
        user ? db.collection("communityNotifications").find({ userId: user._id }).sort({ createdAt: -1 }).limit(20).toArray() : [],
        db.collection("communityGroups").find(user ? {
          status: { $ne: "deleted" },
          $or: [{ visibility: "public" }, { ownerId: user._id }, { memberIds: user._id }]
        } : { visibility: "public", status: { $ne: "deleted" } }).sort({ createdAt: -1 }).limit(24).toArray(),
        db.collection("communityEvents").find(user ? {
          startsAt: { $gte: new Date(Date.now() - 86400000) },
          status: { $ne: "deleted" },
          $or: [{ privacy: { $in: ["public", null] } }, { privacy: { $exists: false } }, { ownerId: user._id }, { attendeeIds: user._id }]
        } : { startsAt: { $gte: new Date(Date.now() - 86400000) }, status: { $ne: "deleted" }, $or: [{ privacy: "public" }, { privacy: { $exists: false } }] }).sort({ startsAt: 1 }).limit(24).toArray()
      ]);
      const requestTargetIds = user ? [...new Map((await Promise.all([
        db.collection("communityFriendRequests").distinct("targetId", { requesterId: user._id, status: "pending" }),
        db.collection("communityFriendships").distinct("recipientId", { requesterId: user._id, status: "pending" })
      ])).flat().filter(Boolean).map((id) => [String(id), id])).values()] : [];
      const suggestions = rawSuggestions.filter((item) => !friendIds.some((id) => String(id) === String(item._id)) && !requestTargetIds.some((id) => String(id) === String(item._id))).slice(0, 8);
      const visibleStories = [];
      for (const story of activeStories) {
        if (visibleStories.length >= 24) break;
        if (await canViewStory(db, story, user)) visibleStories.push(story);
      }
      const items = feedMode === "latest" ? rawItems : feedMode === "friends"
        ? rawItems.filter((item) => friendIds.some((id) => String(id) === String(item.userId))).slice(0, 40)
        : rankFeed(rawItems, { viewerId, followingIds, friendIds, priorityUserIds: feedPreferences?.priorityUserIds || [], interests: viewerProfile?.interests || [] });
      return res.status(200).json({
        posts: items.map((item) => present(item, viewerId)),
        stories: visibleStories.map((item) => ({ id: String(item._id), author: socialUser(item.author), content: item.content, mediaUrl: item.mediaUrl || "", mediaId: item.mediaId ? String(item.mediaId) : "", mediaType: item.mediaType || "image", background: item.background || "", musicUrl: item.musicUrl || "", location: item.location || "", linkUrl: item.linkUrl || "", privacy: item.privacy || "public", viewerSeen: (item.views || []).some((view) => String(view.userId) === viewerId), viewerCount: (item.views || []).length, createdAt: item.createdAt, expiresAt: item.expiresAt })),
        suggestions: suggestions.map((item) => ({ ...socialUser(item), following: followingIds.some((id) => String(id) === String(item._id)) })),
        notifications: notifications.map((item) => ({ id: String(item._id), actor: socialUser(item.actor), type: item.type, message: item.message, recordId: String(item.recordId || ""), count: Math.max(1, Number(item.count || 1)), read: Boolean(item.read), createdAt: item.createdAt, updatedAt: item.updatedAt || item.createdAt })),
        groups: groups.map((item) => ({ id: String(item._id), name: item.name, description: item.description, owner: socialUser(item.owner), visibility: item.visibility || "public", postApproval: item.postApproval || "off", memberCount: (item.memberIds || []).length, joined: (item.memberIds || []).some((id) => String(id) === viewerId), pending: (item.joinRequests || []).some((entry) => String(entry.userId) === viewerId && entry.status === "pending") })),
        events: communityEvents.map((item) => ({ id: String(item._id), name: item.name, description: item.description, startsAt: item.startsAt, endsAt: item.endsAt || null, eventType: item.eventType || "online", online: (item.eventType || "online") === "online", location: item.location || "", meetingUrl: item.meetingUrl || "", owner: socialUser(item.owner), attendeeCount: (item.attendeeIds || []).length, going: (item.attendeeIds || []).some((id) => String(id) === viewerId) })),
        unread: notifications.filter((item) => !item.read).length,
        feedMode,
        signedIn: Boolean(user)
      });
    }

    if (!user) return res.status(401).json({ error: "Bạn cần đăng nhập để tương tác trong cộng đồng." });
    await enforceRateLimit(db, `community:${user._id}:${req.method}`, 100, 10 * 60 * 1000);

    if (req.method === "DELETE") {
      const postId = idOf(req.query.id);
      if (!postId) return res.status(400).json({ error: "Bài viết không hợp lệ." });
      const ownedPost = await posts.findOne({ _id: postId, userId: user._id, deletedAt: { $exists: false } });
      if (!ownedPost) return res.status(403).json({ error: "Bạn không thể xóa bài viết này." });
      const now = new Date();
      const result = await posts.updateOne({ _id: postId, userId: user._id }, { $set: { deletedAt: now, updatedAt: now } });
      await db.collection("communityAuditLogs").insertOne({ actorId: user._id, action: "post:trash", targetType: "post", targetId: postId, before: { deletedAt: null }, after: { deletedAt: now }, createdAt: now });
      return result.modifiedCount ? res.status(200).json({ ok: true, softDeleted: true }) : res.status(403).json({ error: "Bạn không thể xóa bài viết này." });
    }

    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const action = clean(body.action || "create", 40);

    if (action === "media:upload") {
      const mimeType = clean(body.mimeType, 80).toLowerCase();
      const encoded = clean(body.data, 4000000).replace(/\s/g, "");
      if (!MEDIA_TYPES.has(mimeType)) return res.status(400).json({ error: "Chỉ hỗ trợ ảnh JPG, PNG, WebP, GIF, AVIF và video MP4, WebM, MOV." });
      if (!encoded || !/^[a-z0-9+/]+={0,2}$/i.test(encoded)) return res.status(400).json({ error: "Dữ liệu media không hợp lệ." });
      const bytes = Buffer.from(encoded, "base64");
      if (!bytes.length || bytes.length > MAX_MEDIA_BYTES) return res.status(413).json({ error: "Mỗi ảnh hoặc video cộng đồng cần nhỏ hơn 2,5 MB." });
      const now = new Date();
      const doc = {
        userId: user._id,
        filename: clean(body.filename || "community-media", 180),
        mimeType,
        size: bytes.length,
        data: bytes,
        createdAt: now,
        expiresAt: new Date(now.getTime() + 60 * 60 * 1000)
      };
      const result = await mediaFiles.insertOne(doc);
      return res.status(201).json({ ok: true, media: { id: String(result.insertedId), type: mimeType.startsWith("video/") ? "video" : "image", size: bytes.length } });
    }

    if (action === "story:create") {
      const content = clean(body.content, 600);
      const mediaUrl = safeMedia(body.mediaUrl);
      const mediaId = idOf(body.mediaId);
      const storedMedia = mediaId ? await mediaFiles.findOne({ _id: mediaId, userId: user._id }) : null;
      if (mediaId && !storedMedia) return res.status(400).json({ error: "Media của Tin không hợp lệ hoặc đã hết hạn." });
      if (!content && !mediaUrl && !storedMedia) return res.status(400).json({ error: "Tin đang trống." });
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const doc = { userId: user._id, author: socialUser(user), content, mediaUrl, ...(storedMedia ? { mediaId: storedMedia._id, mediaType: storedMedia.mimeType.startsWith("video/") ? "video" : "image" } : {}), privacy: ["public", "friends", "close-friends", "private"].includes(body.privacy) ? body.privacy : "public", background: clean(body.background, 40), musicUrl: safeMedia(body.musicUrl), location: clean(body.location, 120), linkUrl: safeMedia(body.linkUrl), views: [], reactions: [], archived: false, createdAt: new Date(), expiresAt };
      const result = await stories.insertOne(doc);
      if (storedMedia) await mediaFiles.updateOne({ _id: storedMedia._id }, { $set: { expiresAt: new Date(expiresAt.getTime() + 60 * 60 * 1000) } });
      return res.status(201).json({ ok: true, story: { ...doc, id: String(result.insertedId) } });
    }

    if (["story:view", "story:react", "story:highlight", "story:delete"].includes(action)) {
      const storyId = idOf(body.storyId);
      if (!storyId) return res.status(400).json({ error: "Tin không hợp lệ." });
      const story = await stories.findOne({ _id: storyId });
      if (!story) return res.status(404).json({ error: "Tin không còn tồn tại." });
      if (!await canViewStory(db, story, user) && String(story.userId) !== viewerId) return res.status(404).json({ error: "Tin không còn tồn tại." });
      if (action === "story:view") await stories.updateOne({ _id: storyId, "views.userId": { $ne: user._id } }, { $push: { views: { userId: user._id, viewedAt: new Date() } } });
      if (action === "story:react") {
        const type = REACTIONS.has(body.type) ? body.type : "like";
        await stories.updateOne({ _id: storyId }, { $pull: { reactions: { userId: user._id } } });
        await stories.updateOne({ _id: storyId }, { $push: { reactions: { userId: user._id, type, createdAt: new Date() } } });
        await notify(db, story.userId, user, "story-reaction", `${user.name || "Một thành viên"} đã bày tỏ cảm xúc về Tin của bạn.`, storyId);
      }
      if (action === "story:highlight") {
        if (String(story.userId) !== viewerId) return res.status(403).json({ error: "Bạn chỉ có thể ghim Tin của mình." });
        await db.collection("communityStoryHighlights").updateOne({ userId: user._id, storyId }, { $setOnInsert: { userId: user._id, storyId, title: clean(body.title || "Tin nổi bật", 80), story: { content: story.content, mediaUrl: story.mediaUrl || "", mediaId: story.mediaId || null, mediaType: story.mediaType || "image" }, createdAt: new Date() } }, { upsert: true });
      }
      if (action === "story:delete") {
        if (String(story.userId) !== viewerId) return res.status(403).json({ error: "Bạn chỉ có thể xóa Tin của mình." });
        await stories.updateOne({ _id: storyId }, { $set: { expiresAt: new Date(), deletedAt: new Date() } });
      }
      return res.status(200).json({ ok: true });
    }

    if (action === "follow") {
      const targetId = idOf(body.targetId);
      if (!targetId || String(targetId) === viewerId) return res.status(400).json({ error: "Thành viên không hợp lệ." });
      if (await blockedBetween(db, user._id, targetId)) return res.status(403).json({ error: "Không thể theo dõi tài khoản này." });
      const relations = db.collection("communityRelations");
      const existing = await relations.findOne({ actorId: user._id, targetId, type: "follow" });
      const following = !existing?.active;
      const now = new Date();
      await relations.updateOne(
        { actorId: user._id, targetId, type: "follow" },
        { $set: { active: following, updatedAt: now, ...(following ? { activatedAt: now } : { disabledAt: now }) }, $setOnInsert: { actorId: user._id, targetId, type: "follow", createdAt: now }, ...(following ? { $unset: { disabledAt: "" } } : {}) },
        { upsert: true }
      );
      if (following) {
        await notify(db, targetId, user, "follow", `${user.name || "Một thành viên"} đã theo dõi bạn.`, user._id);
      }
      return res.status(200).json({ ok: true, following });
    }

    if (action === "group:create") {
      const name = clean(body.name, 100);
      if (name.length < 3) return res.status(400).json({ error: "Tên nhóm cần ít nhất 3 ký tự." });
      const now = new Date();
      const doc = { name, description: clean(body.description, 500), ownerId: user._id, owner: socialUser(user), memberIds: [user._id], roles: [{ userId: user._id, role: "owner", createdAt: now }], joinRequests: [], rules: [], visibility: ["public", "private"].includes(body.visibility) ? body.visibility : "public", postApproval: body.postApproval === "on" ? "on" : "off", status: "active", createdAt: now, updatedAt: now };
      const result = await db.collection("communityGroups").insertOne(doc);
      return res.status(201).json({ ok: true, group: { ...doc, id: String(result.insertedId) } });
    }

    if (action === "group:join") {
      const groupId = idOf(body.groupId);
      if (!groupId) return res.status(400).json({ error: "Nhóm không hợp lệ." });
      const group = await db.collection("communityGroups").findOne({ _id: groupId });
      if (!group) return res.status(404).json({ error: "Không tìm thấy nhóm." });
      const joined = (group.memberIds || []).some((id) => String(id) === viewerId);
      if (String(group.ownerId) === viewerId && joined) return res.status(409).json({ error: "Chủ sở hữu không thể rời nhóm trước khi chuyển quyền." });
      if (!joined && group.visibility === "private") {
        const pending = (group.joinRequests || []).some((item) => String(item.userId) === viewerId && item.status === "pending");
        if (!pending) await db.collection("communityGroups").updateOne({ _id: groupId }, { $push: { joinRequests: { userId: user._id, user: socialUser(user), status: "pending", createdAt: new Date() } }, $set: { updatedAt: new Date() } });
        return res.status(200).json({ ok: true, joined: false, pending: true });
      }
      await db.collection("communityGroups").updateOne({ _id: groupId }, joined ? { $pull: { memberIds: user._id }, $set: { updatedAt: new Date() } } : { $addToSet: { memberIds: user._id }, $set: { updatedAt: new Date() } });
      return res.status(200).json({ ok: true, joined: !joined, pending: false });
    }

    if (action === "event:create") {
      const name = clean(body.name, 100);
      const startsAt = new Date(body.startsAt);
      if (name.length < 3 || Number.isNaN(startsAt.getTime())) return res.status(400).json({ error: "Tên hoặc thời gian sự kiện không hợp lệ." });
      const endsAtValue = body.endsAt ? new Date(body.endsAt) : new Date(startsAt.getTime() + 60 * 60 * 1000);
      const doc = { name, description: clean(body.description, 500), startsAt, endsAt: Number.isNaN(endsAtValue.getTime()) ? new Date(startsAt.getTime() + 60 * 60 * 1000) : endsAtValue, eventType: body.eventType === "in-person" ? "in-person" : "online", location: clean(body.location, 180), meetingUrl: safeMedia(body.meetingUrl), timezone: clean(body.timezone || "Asia/Bangkok", 80), privacy: ["public", "private"].includes(body.privacy) ? body.privacy : "public", ownerId: user._id, owner: socialUser(user), attendeeIds: [user._id], status: "active", createdAt: new Date(), updatedAt: new Date() };
      const result = await db.collection("communityEvents").insertOne(doc);
      return res.status(201).json({ ok: true, event: { ...doc, id: String(result.insertedId) } });
    }

    if (action === "event:rsvp") {
      const eventId = idOf(body.eventId);
      if (!eventId) return res.status(400).json({ error: "Sự kiện không hợp lệ." });
      const item = await db.collection("communityEvents").findOne({ _id: eventId });
      if (!item) return res.status(404).json({ error: "Không tìm thấy sự kiện." });
      const going = (item.attendeeIds || []).some((id) => String(id) === viewerId);
      await db.collection("communityEvents").updateOne({ _id: eventId }, going ? { $pull: { attendeeIds: user._id } } : { $addToSet: { attendeeIds: user._id } });
      return res.status(200).json({ ok: true, going: !going });
    }

    if (action === "notifications:read") {
      const notificationId = idOf(body.notificationId);
      const filter = { userId: user._id, read: false, ...(notificationId ? { _id: notificationId } : {}) };
      await db.collection("communityNotifications").updateMany(filter, { $set: { read: true, readAt: new Date() } });
      return res.status(200).json({ ok: true });
    }

    if (action === "notifications:delete") {
      const notificationId = idOf(body.notificationId);
      if (!notificationId) return res.status(400).json({ error: "Thông báo không hợp lệ." });
      await db.collection("communityNotifications").deleteOne({ _id: notificationId, userId: user._id });
      return res.status(200).json({ ok: true });
    }

    if (action === "notifications:settings") {
      const allowedKeys = ["friendRequests", "reactions", "comments", "mentions", "messages", "groups", "pages", "events", "birthdays", "security", "emailDigest", "push", "quietHours"];
      const settings = {};
      for (const key of allowedKeys) if (Object.prototype.hasOwnProperty.call(body.settings || {}, key)) settings[key] = typeof body.settings[key] === "boolean" ? body.settings[key] : clean(body.settings[key], 80);
      await db.collection("communityNotificationPreferences").updateOne({ userId: user._id }, { $set: { settings, updatedAt: new Date() }, $setOnInsert: { userId: user._id, createdAt: new Date() } }, { upsert: true });
      return res.status(200).json({ ok: true, settings });
    }

    if (action === "create") {
      const content = clean(body.content, 5000);
      const mediaUrl = safeMedia(body.mediaUrl);
      const requestedIds = [...new Set((Array.isArray(body.mediaIds) ? body.mediaIds : body.mediaId ? [body.mediaId] : []).slice(0, 4).map(String))];
      const objectIds = requestedIds.map(idOf).filter(Boolean);
      const storedMedia = objectIds.length ? await mediaFiles.find({ _id: { $in: objectIds }, userId: user._id }).toArray() : [];
      if (requestedIds.length !== objectIds.length || storedMedia.length !== requestedIds.length) return res.status(400).json({ error: "Một hoặc nhiều tệp media không hợp lệ hoặc đã hết hạn." });
      const media = requestedIds.map((id) => {
        const item = storedMedia.find((entry) => String(entry._id) === id);
        return { id: item._id, type: item.mimeType.startsWith("video/") ? "video" : "image" };
      });
      if (!content && !mediaUrl && !media.length) return res.status(400).json({ error: "Hãy nhập nội dung hoặc thêm ảnh/video." });
      const pollQuestion = clean(body.pollQuestion, 220);
      const pollOptions = [...new Set((Array.isArray(body.pollOptions) ? body.pollOptions : []).map((item) => clean(item, 160)).filter(Boolean))].slice(0, 6);
      const poll = pollQuestion && pollOptions.length >= 2 ? {
        question: pollQuestion,
        options: pollOptions.map((text) => ({ id: String(new ObjectId()), text })),
        votes: []
      } : null;
      const scheduledAtValue = clean(body.scheduledAt, 60);
      const scheduledAt = scheduledAtValue ? new Date(scheduledAtValue) : null;
      if (scheduledAtValue && (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() > Date.now() + 365 * 86400000)) return res.status(400).json({ error: "Thời gian lên lịch không hợp lệ." });
      const taggedIds = [...new Set((Array.isArray(body.taggedUserIds) ? body.taggedUserIds : []).slice(0, 20).map(String))].map(idOf).filter(Boolean);
      const taggedUsers = taggedIds.length ? await db.collection("users").find({ _id: { $in: taggedIds } }, { projection: { name: 1, avatar: 1 } }).toArray() : [];
      const doc = {
        userId: user._id, author: socialUser(user), content,
        topic: TOPICS.has(body.topic) ? body.topic : "Góp ý",
        privacy: ["public", "friends", "friends-of-friends", "followers", "private"].includes(body.privacy) ? body.privacy : "public",
        mediaUrl, mediaType: media[0]?.type || (body.mediaType === "video" ? "video" : mediaUrl ? "image" : ""), media,
        feeling: clean(body.feeling, 80), location: clean(body.location, 120), poll, taggedUsers: taggedUsers.map(socialUser),
        background: clean(body.background, 40), canReshare: body.canReshare !== false, commentsEnabled: body.commentsEnabled !== false,
        hideReactionCounts: Boolean(body.hideReactionCounts), scheduledAt,
        pinned: false, archived: false, reactions: [], comments: [], savedBy: [], shares: 0, createdAt: new Date(), updatedAt: new Date()
      };
      const result = await posts.insertOne(doc);
      if (media.length) await mediaFiles.updateMany({ _id: { $in: media.map((item) => item.id) }, userId: user._id }, { $unset: { expiresAt: "" }, $set: { postId: result.insertedId } });
      await db.collection("events").insertOne({ type: "community:post", userId: user._id, recordId: result.insertedId, createdAt: new Date() });
      return res.status(201).json({ ok: true, post: present({ ...doc, _id: result.insertedId }, viewerId) });
    }

    const postId = idOf(body.postId);
    if (!postId) return res.status(400).json({ error: "Bài viết không hợp lệ." });
    const post = await posts.findOne({ _id: postId });
    if (!post) return res.status(404).json({ error: "Không tìm thấy bài viết." });
    const ownsPost = String(post.userId) === viewerId;
    if (post.deletedAt && !ownsPost) return res.status(404).json({ error: "Không tìm thấy bài viết." });
    if (!ownsPost && !await canViewPost(db, post, user)) return res.status(404).json({ error: "Không tìm thấy bài viết." });

    if (action === "post:hide" || action === "post:not-interested") {
      const field = action === "post:hide" ? "hiddenPostIds" : "uninterestedPostIds";
      await db.collection("communityFeedPreferences").updateOne({ userId: user._id }, { $addToSet: { [field]: postId }, $set: { updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
      await db.collection("communityActivity").insertOne({ ownerId: user._id, actorId: user._id, type: action, entityType: "post", entityId: postId, targetId: postId, visibility: "private", createdAt: new Date() });
      return res.status(200).json({ ok: true, hidden: true });
    }

    if (["post:archive", "post:restore", "post:pin", "post:settings"].includes(action)) {
      if (!ownsPost) return res.status(403).json({ error: "Bạn không có quyền quản lý bài viết này." });
      const now = new Date();
      const changes = {};
      if (action === "post:archive") changes.archived = true;
      if (action === "post:restore") changes.archived = false;
      if (action === "post:pin") changes.pinned = !post.pinned;
      if (action === "post:settings") {
        if (typeof body.commentsEnabled === "boolean") changes.commentsEnabled = body.commentsEnabled;
        if (typeof body.hideReactionCounts === "boolean") changes.hideReactionCounts = body.hideReactionCounts;
        if (typeof body.canReshare === "boolean") changes.canReshare = body.canReshare;
      }
      changes.updatedAt = now;
      await posts.updateOne({ _id: postId, userId: user._id }, { $set: changes, ...(action === "post:restore" ? { $unset: { deletedAt: "" } } : {}) });
      await db.collection("communityAuditLogs").insertOne({ actorId: user._id, action, targetType: "post", targetId: postId, before: { archived: post.archived, pinned: post.pinned, commentsEnabled: post.commentsEnabled, hideReactionCounts: post.hideReactionCounts, canReshare: post.canReshare, deletedAt: post.deletedAt || null }, after: { ...changes, ...(action === "post:restore" ? { deletedAt: null } : {}) }, createdAt: now });
      const updatedPost = await posts.findOne({ _id: postId });
      return res.status(200).json({ ok: true, post: present(updatedPost, viewerId) });
    }

    if (["comment:react", "comment:edit", "comment:delete", "comment:pin", "comment:report"].includes(action)) {
      const commentId = clean(body.commentId, 40);
      const comments = Array.isArray(post.comments) ? post.comments : [];
      const comment = comments.find((item) => String(item._id) === commentId);
      if (!comment || comment.deletedAt) return res.status(404).json({ error: "Không tìm thấy bình luận." });
      const ownsComment = String(comment.author?.id || "") === viewerId;
      if (action === "comment:report") {
        await db.collection("communityReports").updateOne({ targetType: "comment", targetId: comment._id, reporterId: user._id }, { $setOnInsert: { targetType: "comment", targetId: comment._id, postId, reporterId: user._id, reason: clean(body.reason || "Bình luận không phù hợp", 300), status: "pending", createdAt: new Date() } }, { upsert: true });
        return res.status(200).json({ ok: true });
      }
      const commentQuery = { _id: postId, "comments._id": comment._id };
      const commentOptions = { arrayFilters: [{ "comment._id": comment._id }] };
      if (action === "comment:edit") {
        if (!ownsComment) return res.status(403).json({ error: "Bạn chỉ có thể sửa bình luận của mình." });
        const text = clean(body.text, 1200);
        if (!text) return res.status(400).json({ error: "Bình luận đang trống." });
        const now = new Date();
        await posts.updateOne(commentQuery, {
          $set: { "comments.$[comment].text": text, "comments.$[comment].updatedAt": now, updatedAt: now },
          $push: { "comments.$[comment].editHistory": { $each: [{ text: comment.text, editedAt: now }], $slice: -20 } }
        }, commentOptions);
      }
      if (action === "comment:delete") {
        if (!ownsComment && !ownsPost) return res.status(403).json({ error: "Bạn không có quyền xóa bình luận này." });
        const now = new Date();
        await posts.updateOne(commentQuery, { $set: { "comments.$[comment].deletedAt": now, "comments.$[comment].text": "", updatedAt: now } }, commentOptions);
      }
      if (action === "comment:pin") {
        if (!ownsPost) return res.status(403).json({ error: "Chỉ chủ bài viết có thể ghim bình luận." });
        await posts.updateOne({ _id: postId }, { $set: { "comments.$[].pinned": false, updatedAt: new Date() } });
        if (!comment.pinned) await posts.updateOne(commentQuery, { $set: { "comments.$[comment].pinned": true, updatedAt: new Date() } }, commentOptions);
      }
      if (action === "comment:react") {
        const type = REACTIONS.has(body.type) ? body.type : "like";
        await posts.updateOne(commentQuery, { $pull: { "comments.$[comment].reactions": { userId: user._id } }, $set: { updatedAt: new Date() } }, commentOptions);
        if (body.type !== "remove") await posts.updateOne(commentQuery, { $push: { "comments.$[comment].reactions": { userId: user._id, type, createdAt: new Date() } }, $set: { updatedAt: new Date() } }, commentOptions);
      }
      const updatedPost = await posts.findOne({ _id: postId });
      return res.status(200).json({ ok: true, post: present(updatedPost, viewerId) });
    }

    if (action === "react") {
      const type = REACTIONS.has(body.type) ? body.type : "like";
      await posts.updateOne({ _id: postId }, { $pull: { reactions: { userId: user._id } }, $set: { updatedAt: new Date() } });
      if (body.type !== "remove") await posts.updateOne({ _id: postId }, { $push: { reactions: { userId: user._id, type, createdAt: new Date() } }, $set: { updatedAt: new Date() } });
      if (body.type !== "remove") await notify(db, post.userId, user, "reaction", `${user.name || "Một thành viên"} đã bày tỏ cảm xúc về bài viết của bạn.`, postId);
    } else if (action === "comment") {
      if (post.commentsEnabled === false) return res.status(403).json({ error: "Bình luận đã bị tắt cho bài viết này." });
      const text = clean(body.text, 1200);
      if (!text) return res.status(400).json({ error: "Bình luận đang trống." });
      await posts.updateOne({ _id: postId }, { $push: { comments: { _id: new ObjectId(), author: socialUser(user), text, parentId: clean(body.parentId, 40), createdAt: new Date() } }, $set: { updatedAt: new Date() } });
      await notify(db, post.userId, user, "comment", `${user.name || "Một thành viên"} đã bình luận bài viết của bạn.`, postId);
    } else if (action === "save") {
      const saved = (post.savedBy || []).some((id) => String(id) === viewerId);
      await posts.updateOne({ _id: postId }, saved ? { $pull: { savedBy: user._id } } : { $addToSet: { savedBy: user._id } });
    } else if (action === "share") {
      if (post.canReshare === false || post.privacy === "private") return res.status(403).json({ error: "Bài viết này không cho phép chia sẻ lại." });
      await posts.updateOne({ _id: postId }, { $inc: { shares: 1 }, $set: { updatedAt: new Date() } });
      await notify(db, post.userId, user, "share", `${user.name || "Một thành viên"} đã chia sẻ bài viết của bạn.`, postId);
    } else if (action === "poll:vote") {
      const optionId = clean(body.optionId, 40);
      if (!post.poll?.options?.some((option) => String(option.id) === optionId)) return res.status(400).json({ error: "Lựa chọn khảo sát không hợp lệ." });
      await posts.updateOne({ _id: postId }, { $pull: { "poll.votes": { userId: user._id } }, $set: { updatedAt: new Date() } });
      await posts.updateOne({ _id: postId }, { $push: { "poll.votes": { userId: user._id, optionId, createdAt: new Date() } }, $set: { updatedAt: new Date() } });
    } else if (action === "edit") {
      if (!ownsPost) return res.status(403).json({ error: "Bạn chỉ có thể sửa bài viết của mình." });
      const content = clean(body.content, 5000);
      if (!content) return res.status(400).json({ error: "Nội dung bài viết đang trống." });
      await posts.updateOne({ _id: postId }, { $push: { editHistory: { content: post.content, editedAt: new Date(), editorId: user._id } }, $set: { content, updatedAt: new Date() } });
    } else if (action === "report") {
      await db.collection("communityReports").updateOne({ postId, reporterId: user._id }, { $setOnInsert: { postId, reporterId: user._id, reason: clean(body.reason || "Nội dung không phù hợp", 300), createdAt: new Date(), status: "pending" } }, { upsert: true });
    } else {
      return res.status(400).json({ error: "Tác vụ không được hỗ trợ." });
    }

    const updated = await posts.findOne({ _id: postId });
    return res.status(200).json({ ok: true, post: present(updated, viewerId) });
  });
};
