const { ObjectId } = require("mongodb");
const { clean, currentUser, enforceRateLimit, withApi } = require("../utils/platform");
const gamesHandler = require("../utils/games-api");

const VISIBILITY = new Set(["public", "friends", "private"]);
const FRIEND_REQUEST_PERMISSIONS = new Set(["everyone", "friends_of_friends", "none"]);
const FOLLOW_PERMISSIONS = new Set(["everyone", "none"]);
const RELATION_TYPES = new Set(["follow", "block", "restrict", "mute", "snooze", "priority", "close_friend", "acquaintance"]);
const FRIEND_STATES = new Set(["pending", "accepted", "declined", "cancelled", "removed"]);
const RESERVED_USERNAMES = new Set([
  "admin", "api", "auth", "community", "help", "login", "logout", "me", "moderator",
  "pages", "privacy", "register", "root", "settings", "social", "support", "system"
]);
const RESERVED_PAGE_SLUGS = new Set(["admin", "api", "community", "create", "discover", "pages", "social"]);
const PROFILE_STRING_FIELDS = {
  bio: 1000,
  gender: 60,
  pronouns: 80,
  city: 120,
  hometown: 120,
  workplace: 180,
  school: 180,
  relationship: 80
};
const DEFAULT_PRIVACY = Object.freeze({
  profileVisibility: "public",
  friendsVisibility: "friends",
  activityVisibility: "friends",
  birthdayVisibility: "friends",
  detailsVisibility: "public",
  contactVisibility: "public",
  futurePostsVisibility: "friends",
  friendRequestPermission: "everyone",
  followPermission: "everyone",
  publicComments: "everyone",
  taggingPermission: "friends",
  storyVisibility: "friends",
  emailLookup: "friends",
  phoneLookup: "none",
  discoverable: true,
  searchIndexing: false,
  tagReview: true,
  timelineReview: true,
  activeStatus: true,
  readReceipts: true,
  locationAccess: false,
  oldPostsLimited: false
});
const BOOLEAN_PRIVACY_KEYS = new Set([
  "discoverable", "searchIndexing", "tagReview", "timelineReview", "activeStatus",
  "readReceipts", "locationAccess", "oldPostsLimited"
]);
const PRIVACY_ALLOWED_VALUES = {
  profileVisibility: VISIBILITY,
  friendsVisibility: VISIBILITY,
  activityVisibility: VISIBILITY,
  birthdayVisibility: VISIBILITY,
  detailsVisibility: VISIBILITY,
  contactVisibility: VISIBILITY,
  futurePostsVisibility: new Set(["public", "friends", "followers", "private"]),
  friendRequestPermission: FRIEND_REQUEST_PERMISSIONS,
  followPermission: FOLLOW_PERMISSIONS,
  publicComments: new Set(["everyone", "followers", "friends"]),
  taggingPermission: new Set(["everyone", "friends", "none"]),
  storyVisibility: new Set(["public", "friends", "close_friends", "private"]),
  emailLookup: new Set(["everyone", "friends", "none"]),
  phoneLookup: new Set(["everyone", "friends", "none"])
};
const PRIVACY_KEYS = new Map([
  ["profile", "profileVisibility"],
  ["profilevisibility", "profileVisibility"],
  ["profile_visibility", "profileVisibility"],
  ["friends", "friendsVisibility"],
  ["friendslist", "friendsVisibility"],
  ["friendsvisibility", "friendsVisibility"],
  ["friends_visibility", "friendsVisibility"],
  ["friendslistvisibility", "friendsVisibility"],
  ["friend_list_visibility", "friendsVisibility"],
  ["activity", "activityVisibility"],
  ["activityvisibility", "activityVisibility"],
  ["activity_visibility", "activityVisibility"],
  ["birthday", "birthdayVisibility"],
  ["birthdayvisibility", "birthdayVisibility"],
  ["birthday_visibility", "birthdayVisibility"],
  ["details", "detailsVisibility"],
  ["detailsvisibility", "detailsVisibility"],
  ["details_visibility", "detailsVisibility"],
  ["contact", "contactVisibility"],
  ["contactvisibility", "contactVisibility"],
  ["contact_visibility", "contactVisibility"],
  ["futureposts", "futurePostsVisibility"],
  ["futurepostsvisibility", "futurePostsVisibility"],
  ["future_posts_visibility", "futurePostsVisibility"],
  ["friendrequests", "friendRequestPermission"],
  ["friendrequestpermission", "friendRequestPermission"],
  ["friend_request_permission", "friendRequestPermission"],
  ["followers", "followPermission"],
  ["followpermission", "followPermission"],
  ["follow_permission", "followPermission"],
  ["publiccomments", "publicComments"],
  ["public_comments", "publicComments"],
  ["tagging", "taggingPermission"],
  ["taggingpermission", "taggingPermission"],
  ["tagging_permission", "taggingPermission"],
  ["storyprivacy", "storyVisibility"],
  ["storyvisibility", "storyVisibility"],
  ["story_visibility", "storyVisibility"],
  ["emaillookup", "emailLookup"],
  ["email_lookup", "emailLookup"],
  ["phonelookup", "phoneLookup"],
  ["phone_lookup", "phoneLookup"],
  ["discoverable", "discoverable"],
  ["searchable", "discoverable"],
  ["searchindexing", "searchIndexing"],
  ["search_indexing", "searchIndexing"],
  ["tagreview", "tagReview"],
  ["tag_review", "tagReview"],
  ["timelinereview", "timelineReview"],
  ["timeline_review", "timelineReview"],
  ["activestatus", "activeStatus"],
  ["active_status", "activeStatus"],
  ["readreceipts", "readReceipts"],
  ["read_receipts", "readReceipts"],
  ["locationaccess", "locationAccess"],
  ["location_access", "locationAccess"],
  ["oldpostslimited", "oldPostsLimited"],
  ["old_posts_limited", "oldPostsLimited"]
]);

let indexesReady;

function fail(statusCode, message, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  throw error;
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value || {}, key);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function idOf(value, label = "id") {
  const raw = clean(value, 80);
  if (!/^[a-f0-9]{24}$/i.test(raw)) fail(400, `Invalid ${label}.`, "INVALID_OBJECT_ID");
  return new ObjectId(raw);
}

function pagination(query = {}, fallback = 24) {
  const page = Math.min(1000, Math.max(1, Number.parseInt(clean(query.page, 8), 10) || 1));
  const limit = Math.min(50, Math.max(1, Number.parseInt(clean(query.limit, 8), 10) || fallback));
  return { page, limit, skip: (page - 1) * limit };
}

function nonnegativeInt(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function safeStoredUrl(value, imageOnly = false, max = 1200) {
  const raw = clean(value, max);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (imageOnly ? url.protocol !== "https:" : !["http:", "https:"].includes(url.protocol)) return "";
    if (url.username || url.password) return "";
    return clean(url.toString(), max);
  } catch {
    return "";
  }
}

function inputUrl(value, label, options = {}) {
  const max = options.max || 1200;
  const raw = clean(value, max);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    const allowed = options.imageOnly ? url.protocol === "https:" : ["http:", "https:"].includes(url.protocol);
    if (!allowed || url.username || url.password) throw new Error("unsafe URL");
    return clean(url.toString(), max);
  } catch {
    fail(400, `${label} must be a valid ${options.imageOnly ? "HTTPS" : "HTTP(S)"} URL.`, "INVALID_URL");
  }
}

function asciiSlug(value, max = 60) {
  return clean(value, 160)
    .toLocaleLowerCase("en-US")
    .replace(/\u0111/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .slice(0, max)
    .replace(/-+$/g, "");
}

function normalizedUsername(value) {
  return clean(value, 40).toLocaleLowerCase("en-US").replace(/^@+/, "");
}

function validUsername(value) {
  return value.length >= 3 && value.length <= 30 && /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])$/.test(value) && !RESERVED_USERNAMES.has(value);
}

function normalizeBirthday(value) {
  const birthday = clean(value, 10);
  if (!birthday) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthday)) fail(400, "Birthday must use YYYY-MM-DD.", "INVALID_BIRTHDAY");
  const [year, month, day] = birthday.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  const today = new Date();
  if (
    year < 1900 || parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day || parsed > today
  ) fail(400, "Birthday is not valid.", "INVALID_BIRTHDAY");
  return birthday;
}

function stringList(value, label, maxItems, maxLength) {
  if (value === null || value === undefined || value === "") return [];
  const source = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : null;
  if (!source) fail(400, `${label} must be an array of strings.`, "INVALID_LIST");
  const result = [];
  const seen = new Set();
  for (const item of source.slice(0, maxItems * 2)) {
    const entry = clean(item, maxLength);
    const key = entry.toLocaleLowerCase("en-US");
    if (entry && !seen.has(key)) {
      seen.add(key);
      result.push(entry);
    }
    if (result.length >= maxItems) break;
  }
  return result;
}

function socialLinks(value) {
  if (value === null || value === undefined || value === "") return [];
  let source;
  if (Array.isArray(value)) source = value;
  else if (isPlainObject(value)) source = Object.entries(value).map(([platform, url]) => ({ platform, url }));
  else fail(400, "socialLinks must be an array or object.", "INVALID_SOCIAL_LINKS");

  const result = [];
  const seen = new Set();
  for (const item of source.slice(0, 24)) {
    const record = typeof item === "string" ? { platform: "website", url: item } : item;
    if (!isPlainObject(record)) fail(400, "Each social link must contain a URL.", "INVALID_SOCIAL_LINK");
    const platform = clean(record.platform || record.label || "website", 30)
      .toLocaleLowerCase("en-US").replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-");
    const label = clean(record.label || platform || "Website", 50);
    const url = inputUrl(record.url, "Social link", { max: 800 });
    const key = `${platform}:${url}`;
    if (url && !seen.has(key)) {
      seen.add(key);
      result.push({ platform: platform || "website", label, url });
    }
    if (result.length >= 12) break;
  }
  return result;
}

function privacyFor(profile) {
  const stored = isPlainObject(profile?.privacy) ? profile.privacy : {};
  const result = { ...DEFAULT_PRIVACY };
  for (const key of Object.keys(DEFAULT_PRIVACY)) {
    if (BOOLEAN_PRIVACY_KEYS.has(key)) {
      if (typeof stored[key] === "boolean") result[key] = stored[key];
    } else if (typeof stored[key] === "string") {
      result[key] = stored[key];
    }
  }
  for (const [key, allowed] of Object.entries(PRIVACY_ALLOWED_VALUES)) {
    if (!allowed.has(result[key])) result[key] = DEFAULT_PRIVACY[key];
  }
  return result;
}

function privacyPatch(value) {
  if (!isPlainObject(value)) fail(400, "privacy must be an object.", "INVALID_PRIVACY");
  const result = {};
  for (const [rawKey, rawValue] of Object.entries(value)) {
    const key = PRIVACY_KEYS.get(clean(rawKey, 60).toLocaleLowerCase("en-US"));
    if (!key) fail(400, `Unsupported privacy setting: ${clean(rawKey, 60)}.`, "INVALID_PRIVACY_KEY");
    if (BOOLEAN_PRIVACY_KEYS.has(key)) {
      if (typeof rawValue !== "boolean") fail(400, `${key} must be boolean.`, "INVALID_PRIVACY_VALUE");
      result[key] = rawValue;
      continue;
    }
    let setting = clean(rawValue, 40).toLocaleLowerCase("en-US").replace(/[ -]/g, "_");
    if (["everyone", "all"].includes(setting) && key.endsWith("Visibility")) setting = "public";
    if (["only_me", "onlyme"].includes(setting) && key.endsWith("Visibility")) setting = "private";
    if (["friendsoffriends", "friendsfriends", "friends_of_friend"].includes(setting)) setting = "friends_of_friends";
    if (setting === "friends_only" && key.endsWith("Visibility")) setting = "friends";
    if (["public", "all"].includes(setting) && key === "followPermission") setting = "everyone";
    if (["private", "disabled", "off"].includes(setting) && key === "followPermission") setting = "none";
    const allowed = PRIVACY_ALLOWED_VALUES[key];
    if (!allowed.has(setting)) fail(400, `Invalid value for ${key}.`, "INVALID_PRIVACY_VALUE");
    result[key] = setting;
  }
  if (!Object.keys(result).length) fail(400, "No supported privacy settings were supplied.", "EMPTY_PRIVACY_UPDATE");
  return result;
}

function visibilityAllows(level, owner, friend) {
  return owner || level === "public" || (level === "friends" && friend);
}

async function ensureIndexes(db) {
  if (!indexesReady) {
    const profiles = db.collection("communityProfiles");
    const friendships = db.collection("communityFriendships");
    const relations = db.collection("communityRelations");
    const pages = db.collection("communityPages");
    const pageFollows = db.collection("communityPageFollows");
    const activity = db.collection("communityActivity");
    const collections = db.collection("communityCollections");
    indexesReady = Promise.all([
      profiles.createIndex({ userId: 1 }, { unique: true, name: "community_profiles_user_unique" }),
      profiles.createIndex({ username: 1 }, {
        unique: true,
        name: "community_profiles_username_unique",
        partialFilterExpression: { username: { $type: "string" } }
      }),
      friendships.createIndex({ userAId: 1, userBId: 1 }, {
        unique: true,
        name: "community_friendships_pair_unique",
        partialFilterExpression: { userAId: { $type: "objectId" }, userBId: { $type: "objectId" } }
      }),
      friendships.createIndex({ recipientId: 1, status: 1, updatedAt: -1 }, { name: "community_friendships_incoming" }),
      friendships.createIndex({ requesterId: 1, status: 1, updatedAt: -1 }, { name: "community_friendships_outgoing" }),
      relations.createIndex({ actorId: 1, targetId: 1, type: 1 }, { unique: true, name: "community_relations_unique" }),
      relations.createIndex({ targetId: 1, type: 1, active: 1, updatedAt: -1 }, { name: "community_relations_target" }),
      relations.createIndex({ actorId: 1, type: 1, active: 1, expiresAt: 1 }, { name: "community_relations_feed_controls" }),
      pages.createIndex({ slug: 1 }, { unique: true, name: "community_pages_slug_unique" }),
      pages.createIndex({ ownerId: 1, status: 1, createdAt: -1 }, { name: "community_pages_owner" }),
      pages.createIndex({ status: 1, followerCount: -1, createdAt: -1 }, { name: "community_pages_discover" }),
      pageFollows.createIndex({ pageId: 1, userId: 1 }, { unique: true, name: "community_page_follows_unique" }),
      pageFollows.createIndex({ userId: 1, active: 1, updatedAt: -1 }, { name: "community_page_follows_user" }),
      activity.createIndex({ ownerId: 1, createdAt: -1 }, { name: "community_activity_owner" }),
      collections.createIndex({ ownerId: 1, slug: 1 }, { unique: true, name: "community_collections_owner_slug" }),
      collections.createIndex({ ownerId: 1, updatedAt: -1 }, { name: "community_collections_owner_updated" }),
      db.collection("communityPosts").createIndex({ savedBy: 1, createdAt: -1 }, { name: "community_posts_saved" })
    ]).catch((error) => {
      indexesReady = null;
      throw error;
    });
  }
  return indexesReady;
}

function profileDocument(user, username) {
  const now = new Date();
  return {
    userId: user._id,
    username,
    bio: "",
    cover: "",
    birthday: "",
    gender: "",
    pronouns: "",
    city: "",
    hometown: "",
    workplace: "",
    school: "",
    relationship: "",
    website: "",
    socialLinks: [],
    interests: [],
    languages: [],
    privacy: { ...DEFAULT_PRIVACY },
    status: "active",
    createdAt: now,
    updatedAt: now
  };
}

async function ensureProfile(db, user) {
  const profiles = db.collection("communityProfiles");
  const existing = await profiles.findOne({ userId: user._id });
  if (existing) return existing;

  const base = asciiSlug(user.name || "member", 18) || "member";
  const userSeed = String(user._id).slice(-8);
  const candidates = [
    `${base.slice(0, 21)}-${userSeed}`,
    `member-${String(user._id).slice(-12)}`,
    `member-${String(new ObjectId()).slice(-12)}`
  ];
  for (const candidate of candidates) {
    try {
      const doc = profileDocument(user, candidate);
      const result = await profiles.insertOne(doc);
      return { ...doc, _id: result.insertedId };
    } catch (error) {
      if (error?.code !== 11000) throw error;
      const raced = await profiles.findOne({ userId: user._id });
      if (raced) return raced;
    }
  }
  fail(409, "Could not allocate a unique username.", "USERNAME_CONFLICT");
}

async function accountById(db, userId) {
  return db.collection("users").findOne(
    { _id: userId, status: { $ne: "deleted" } },
    { projection: { name: 1, avatar: 1, status: 1, createdAt: 1, lastSeenAt: 1 } }
  );
}

async function loadPeople(db, ids) {
  const unique = [...new Set(ids.filter(Boolean).map((id) => String(id)))].map((id) => new ObjectId(id));
  const people = new Map();
  if (!unique.length) return people;
  const [accounts, profiles] = await Promise.all([
    db.collection("users").find(
      { _id: { $in: unique }, status: { $ne: "deleted" } },
      { projection: { name: 1, avatar: 1, status: 1, createdAt: 1, lastSeenAt: 1 } }
    ).toArray(),
    db.collection("communityProfiles").find({ userId: { $in: unique }, status: { $ne: "deleted" } }).toArray()
  ]);
  const profileMap = new Map(profiles.map((profile) => [String(profile.userId), profile]));
  for (const account of accounts) {
    people.set(String(account._id), { account, profile: profileMap.get(String(account._id)) || null });
  }
  return people;
}

function basicPerson(record, fallbackId = "") {
  const account = record?.account || {};
  const profile = record?.profile || {};
  return {
    id: String(account._id || profile.userId || fallbackId || ""),
    username: clean(profile.username, 30),
    name: clean(account.name || profile.username || "HH member", 100),
    avatar: safeStoredUrl(account.avatar, true)
  };
}

function pairFor(firstId, secondId) {
  return String(firstId) < String(secondId)
    ? { userAId: firstId, userBId: secondId }
    : { userAId: secondId, userBId: firstId };
}

async function friendshipBetween(db, firstId, secondId) {
  return db.collection("communityFriendships").findOne(pairFor(firstId, secondId));
}

async function areFriends(db, firstId, secondId) {
  if (!firstId || !secondId || String(firstId) === String(secondId)) return false;
  return Boolean(await db.collection("communityFriendships").findOne({ ...pairFor(firstId, secondId), status: "accepted" }, { projection: { _id: 1 } }));
}

async function friendIds(db, userId, limit = 1000) {
  const docs = await db.collection("communityFriendships").find({
    status: "accepted",
    $or: [{ userAId: userId }, { userBId: userId }]
  }, { projection: { userAId: 1, userBId: 1 } }).limit(limit).toArray();
  return docs.map((item) => String(item.userAId) === String(userId) ? item.userBId : item.userAId);
}

async function hasMutualFriend(db, firstId, secondId) {
  const firstFriends = await friendIds(db, firstId, 1000);
  if (!firstFriends.length) return false;
  return Boolean(await db.collection("communityFriendships").findOne({
    status: "accepted",
    $or: [
      { userAId: secondId, userBId: { $in: firstFriends } },
      { userBId: secondId, userAId: { $in: firstFriends } }
    ]
  }, { projection: { _id: 1 } }));
}

async function relationshipContext(db, viewerId, targetId) {
  if (!viewerId) return {
    owner: false, friend: false, blocked: false, following: false, followedBy: false,
    restricted: false, muted: false, snoozed: false, priority: false, closeFriend: false, acquaintance: false,
    friendStatus: "", requestDirection: ""
  };
  if (String(viewerId) === String(targetId)) return {
    owner: true, friend: false, blocked: false, following: false, followedBy: false,
    restricted: false, muted: false, snoozed: false, priority: false, closeFriend: false, acquaintance: false,
    friendStatus: "", requestDirection: ""
  };
  const [friendship, relations] = await Promise.all([
    friendshipBetween(db, viewerId, targetId),
    db.collection("communityRelations").find({
      active: true,
      $or: [
        { actorId: viewerId, targetId },
        { actorId: targetId, targetId: viewerId }
      ]
    }).toArray()
  ]);
  const outgoing = (type) => relations.some((item) => item.type === type && String(item.actorId) === String(viewerId));
  const incoming = (type) => relations.some((item) => item.type === type && String(item.actorId) === String(targetId));
  return {
    owner: false,
    friend: friendship?.status === "accepted",
    blocked: outgoing("block") || incoming("block"),
    following: outgoing("follow"),
    followedBy: incoming("follow"),
    restricted: outgoing("restrict"),
    muted: outgoing("mute"),
    snoozed: outgoing("snooze"),
    priority: outgoing("priority"),
    closeFriend: outgoing("close_friend"),
    acquaintance: outgoing("acquaintance"),
    friendStatus: FRIEND_STATES.has(friendship?.status) ? friendship.status : "",
    requestDirection: friendship?.status === "pending"
      ? String(friendship.requesterId) === String(viewerId) ? "outgoing" : "incoming"
      : ""
  };
}

async function assertNotBlocked(db, firstId, secondId) {
  const blocked = await db.collection("communityRelations").findOne({
    type: "block",
    active: true,
    $or: [
      { actorId: firstId, targetId: secondId },
      { actorId: secondId, targetId: firstId }
    ]
  }, { projection: { _id: 1 } });
  if (blocked) fail(409, "This interaction is not available.", "INTERACTION_BLOCKED");
}

async function profileStats(db, userId) {
  const pairFilter = { status: "accepted", $or: [{ userAId: userId }, { userBId: userId }] };
  const [friends, followers, following, pages] = await Promise.all([
    db.collection("communityFriendships").countDocuments(pairFilter),
    db.collection("communityRelations").countDocuments({ targetId: userId, type: "follow", active: true }),
    db.collection("communityRelations").countDocuments({ actorId: userId, type: "follow", active: true }),
    db.collection("communityPages").countDocuments({ ownerId: userId, status: "active" })
  ]);
  return { friends, followers, following, pages };
}

function serializeProfile(profile, account, context, stats = { friends: 0, followers: 0, following: 0, pages: 0 }) {
  const privacy = privacyFor(profile);
  const owner = Boolean(context.owner);
  const friend = Boolean(context.friend);
  const profileVisible = visibilityAllows(privacy.profileVisibility, owner, friend);
  const detailsVisible = profileVisible && visibilityAllows(privacy.detailsVisibility, owner, friend);
  const birthdayVisible = profileVisible && visibilityAllows(privacy.birthdayVisibility, owner, friend);
  const contactVisible = profileVisible && visibilityAllows(privacy.contactVisibility, owner, friend);
  const friendsVisible = visibilityAllows(privacy.friendsVisibility, owner, friend);
  return {
    id: String(profile.userId || account._id || ""),
    username: clean(profile.username, 30),
    name: clean(account.name || profile.username || "HH member", 100),
    avatar: safeStoredUrl(account.avatar, true),
    bio: profileVisible ? clean(profile.bio, 1000) : "",
    cover: profileVisible ? safeStoredUrl(profile.cover, true) : "",
    birthday: birthdayVisible ? clean(profile.birthday, 10) : "",
    gender: detailsVisible ? clean(profile.gender, 60) : "",
    pronouns: detailsVisible ? clean(profile.pronouns, 80) : "",
    city: detailsVisible ? clean(profile.city, 120) : "",
    hometown: detailsVisible ? clean(profile.hometown, 120) : "",
    workplace: detailsVisible ? clean(profile.workplace, 180) : "",
    school: detailsVisible ? clean(profile.school, 180) : "",
    relationship: detailsVisible ? clean(profile.relationship, 80) : "",
    website: contactVisible ? safeStoredUrl(profile.website) : "",
    socialLinks: contactVisible && Array.isArray(profile.socialLinks)
      ? profile.socialLinks.slice(0, 12).map((item) => ({
        platform: clean(item.platform, 30), label: clean(item.label, 50), url: safeStoredUrl(item.url, false, 800)
      })).filter((item) => item.url)
      : [],
    interests: detailsVisible && Array.isArray(profile.interests) ? profile.interests.slice(0, 24).map((item) => clean(item, 80)).filter(Boolean) : [],
    languages: detailsVisible && Array.isArray(profile.languages) ? profile.languages.slice(0, 16).map((item) => clean(item, 80)).filter(Boolean) : [],
    limited: !profileVisible,
    owned: owner,
    connection: {
      friend: friend,
      friendStatus: clean(context.friendStatus, 20),
      requestDirection: clean(context.requestDirection, 20),
      following: Boolean(context.following),
      followedBy: Boolean(context.followedBy),
      restricted: Boolean(context.restricted),
      muted: Boolean(context.muted),
      snoozed: Boolean(context.snoozed),
      priority: Boolean(context.priority),
      closeFriend: Boolean(context.closeFriend),
      acquaintance: Boolean(context.acquaintance)
    },
    stats: {
      friends: friendsVisible ? Number(stats.friends || 0) : null,
      followers: Number(stats.followers || 0),
      following: Number(stats.following || 0),
      pages: Number(stats.pages || 0)
    },
    privacy: owner ? privacy : null,
    createdAt: profile.createdAt || account.createdAt || null,
    updatedAt: profile.updatedAt || profile.createdAt || null
  };
}

async function profilePayload(db, viewer, profile, account) {
  const context = await relationshipContext(db, viewer?._id || null, profile.userId);
  if (context.blocked) fail(404, "Profile not found.", "PROFILE_NOT_FOUND");
  const stats = await profileStats(db, profile.userId);
  return serializeProfile(profile, account, context, stats);
}

async function resolveProfileTarget(db, viewer, query = {}) {
  const profiles = db.collection("communityProfiles");
  let profile = null;
  let targetId = null;
  const usernameInput = clean(query.username, 40).replace(/^@+/, "").toLocaleLowerCase("en-US");
  const idInput = query.userId ?? query.profileId ?? query.id;
  if (usernameInput) {
    profile = await profiles.findOne({ username: usernameInput, status: { $ne: "deleted" } });
    if (!profile) fail(404, "Profile not found.", "PROFILE_NOT_FOUND");
    targetId = profile.userId;
  } else if (idInput !== undefined && clean(idInput, 80)) {
    targetId = idOf(idInput, "user id");
    profile = await profiles.findOne({ userId: targetId, status: { $ne: "deleted" } });
  } else if (viewer) {
    targetId = viewer._id;
    profile = await ensureProfile(db, viewer);
  } else {
    fail(401, "Authentication or a profile identifier is required.", "AUTH_REQUIRED");
  }
  const account = String(viewer?._id || "") === String(targetId) ? viewer : await accountById(db, targetId);
  if (!account) fail(404, "Profile not found.", "PROFILE_NOT_FOUND");
  if (!profile) profile = {
    ...profileDocument(account, ""),
    userId: targetId,
    createdAt: account.createdAt || null,
    updatedAt: account.createdAt || null
  };
  return { profile, account };
}

function otherUserId(friendship, userId) {
  return String(friendship.userAId) === String(userId) ? friendship.userBId : friendship.userAId;
}

function serializeFriendRequest(item, viewerId, people) {
  const counterpartId = otherUserId(item, viewerId);
  return {
    id: String(item._id),
    status: FRIEND_STATES.has(item.status) ? item.status : "",
    direction: String(item.requesterId) === String(viewerId) ? "outgoing" : "incoming",
    person: basicPerson(people.get(String(counterpartId)), counterpartId),
    requestedAt: item.requestedAt || item.createdAt || null,
    updatedAt: item.updatedAt || item.createdAt || null
  };
}

async function loadFriendBundle(db, targetId, viewerId, query = {}, includeRequests = false) {
  const { page, limit, skip } = pagination(query, 24);
  const friendships = db.collection("communityFriendships");
  const acceptedFilter = { status: "accepted", $or: [{ userAId: targetId }, { userBId: targetId }] };
  const [total, accepted] = await Promise.all([
    friendships.countDocuments(acceptedFilter),
    friendships.find(acceptedFilter).sort({ friendsAt: -1, updatedAt: -1 }).skip(skip).limit(limit).toArray()
  ]);
  const acceptedIds = accepted.map((item) => otherUserId(item, targetId));
  let incoming = [];
  let outgoing = [];
  let incomingTotal = 0;
  let outgoingTotal = 0;
  if (includeRequests && String(targetId) === String(viewerId)) {
    [incomingTotal, outgoingTotal, incoming, outgoing] = await Promise.all([
      friendships.countDocuments({ recipientId: targetId, status: "pending" }),
      friendships.countDocuments({ requesterId: targetId, status: "pending" }),
      friendships.find({ recipientId: targetId, status: "pending" }).sort({ requestedAt: -1 }).limit(50).toArray(),
      friendships.find({ requesterId: targetId, status: "pending" }).sort({ requestedAt: -1 }).limit(50).toArray()
    ]);
  }
  const requestIds = [...incoming, ...outgoing].map((item) => otherUserId(item, targetId));
  const people = await loadPeople(db, [...acceptedIds, ...requestIds]);
  return {
    friends: accepted.map((item) => {
      const friendId = otherUserId(item, targetId);
      return { ...basicPerson(people.get(String(friendId)), friendId), friendsSince: item.friendsAt || item.updatedAt || null };
    }).filter((item) => item.id),
    requests: {
      incoming: incoming.map((item) => serializeFriendRequest(item, targetId, people)),
      outgoing: outgoing.map((item) => serializeFriendRequest(item, targetId, people)),
      incomingTotal,
      outgoingTotal
    },
    total,
    page,
    limit
  };
}

async function blockedUserIds(db, userId) {
  const docs = await db.collection("communityRelations").find({
    type: "block",
    active: true,
    $or: [{ actorId: userId }, { targetId: userId }]
  }, { projection: { actorId: 1, targetId: 1 } }).toArray();
  return docs.map((item) => String(item.actorId) === String(userId) ? item.targetId : item.actorId);
}

async function loadOwnedRelations(db, userId) {
  const now = new Date();
  const docs = await db.collection("communityRelations").find({
    actorId: userId,
    type: { $in: ["block", "restrict", "mute", "snooze", "priority", "close_friend", "acquaintance", "follow"] },
    active: true,
    $or: [{ type: { $ne: "snooze" } }, { expiresAt: { $gt: now } }]
  }).sort({ updatedAt: -1 }).limit(500).toArray();
  const people = await loadPeople(db, docs.map((item) => item.targetId));
  const result = { blocked: [], restricted: [], muted: [], snoozed: [], priority: [], closeFriends: [], acquaintances: [], following: [] };
  for (const item of docs) {
    const person = basicPerson(people.get(String(item.targetId)), item.targetId);
    if (!person.id) continue;
    const entry = { ...person, relationUpdatedAt: item.updatedAt || item.createdAt || null, expiresAt: item.expiresAt || null };
    if (item.type === "block") result.blocked.push(entry);
    if (item.type === "restrict") result.restricted.push(entry);
    if (item.type === "mute") result.muted.push(entry);
    if (item.type === "snooze") result.snoozed.push(entry);
    if (item.type === "priority") result.priority.push(entry);
    if (item.type === "close_friend") result.closeFriends.push(entry);
    if (item.type === "acquaintance") result.acquaintances.push(entry);
    if (item.type === "follow") result.following.push(entry);
  }
  return result;
}

function serializeCollection(item) {
  return {
    id: String(item._id),
    name: clean(item.name, 100),
    description: clean(item.description, 400),
    privacy: ["public", "friends", "private"].includes(item.privacy) ? item.privacy : "private",
    color: clean(item.color, 20),
    itemCount: Array.isArray(item.postIds) ? item.postIds.length : 0,
    postIds: Array.isArray(item.postIds) ? item.postIds.slice(0, 500).map(String) : [],
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || item.createdAt || null
  };
}

async function loadCollections(db, userId) {
  const items = await db.collection("communityCollections").find({ ownerId: userId, deletedAt: { $exists: false } })
    .sort({ updatedAt: -1 }).limit(100).toArray();
  return items.map(serializeCollection);
}

function postAuthor(post) {
  const author = isPlainObject(post.author) ? post.author : {};
  return {
    id: String(author.id || author._id || post.userId || ""),
    name: clean(author.name || "HH member", 100),
    avatar: safeStoredUrl(author.avatar, true)
  };
}

function serializeSavedPost(post, viewerId) {
  const reactions = Array.isArray(post.reactions) ? post.reactions : [];
  const comments = Array.isArray(post.comments) ? post.comments : [];
  return {
    id: String(post._id),
    author: postAuthor(post),
    content: clean(post.content, 5000),
    topic: clean(post.topic, 80),
    privacy: ["public", "followers", "friends", "private"].includes(post.privacy) ? post.privacy : "public",
    mediaUrl: safeStoredUrl(post.mediaUrl, true),
    mediaType: post.mediaType === "video" ? "video" : post.mediaType === "image" ? "image" : "",
    media: Array.isArray(post.media) ? post.media.slice(0, 4).map((item) => ({
      id: String(item.id || ""), type: item.type === "video" ? "video" : "image"
    })) : [],
    feeling: clean(post.feeling, 80),
    location: clean(post.location, 120),
    reactionCount: reactions.length,
    commentCount: comments.length,
    shares: nonnegativeInt(post.shares),
    viewerReaction: clean(reactions.find((item) => String(item.userId) === String(viewerId))?.type, 20),
    saved: true,
    owned: String(post.userId || "") === String(viewerId),
    createdAt: post.createdAt || null,
    updatedAt: post.updatedAt || post.createdAt || null
  };
}

async function loadSavedPosts(db, user, query = {}) {
  const { page, limit, skip } = pagination(query, 20);
  const [blocked, socialFollowing, legacyFollowing, friends] = await Promise.all([
    blockedUserIds(db, user._id),
    db.collection("communityRelations").find({ actorId: user._id, type: "follow", active: true }, { projection: { targetId: 1 } }).toArray(),
    db.collection("communityFollows").find({ followerId: user._id }, { projection: { targetId: 1 } }).toArray(),
    friendIds(db, user._id)
  ]);
  const followingIds = [...new Map([...socialFollowing, ...legacyFollowing].map((item) => [String(item.targetId), item.targetId])).values()];
  const visibility = [
    { privacy: "public" },
    { privacy: { $exists: false } },
    { userId: user._id }
  ];
  if (followingIds.length) visibility.push({ privacy: "followers", userId: { $in: followingIds } });
  if (friends.length) visibility.push({ privacy: "friends", userId: { $in: friends } });
  const filter = {
    savedBy: user._id,
    ...(blocked.length ? { userId: { $nin: blocked } } : {}),
    $or: visibility
  };
  const posts = db.collection("communityPosts");
  const [total, items] = await Promise.all([
    posts.countDocuments(filter),
    posts.find(filter).sort({ updatedAt: -1, createdAt: -1 }).skip(skip).limit(limit).toArray()
  ]);
  return { items: items.map((item) => serializeSavedPost(item, user._id)), total, page, limit };
}

function activityMetadata(value) {
  if (!isPlainObject(value)) return {};
  const result = {};
  const stringFields = { fields: 300, pageName: 120, pageSlug: 80, response: 20, relation: 20, reason: 80 };
  for (const [key, max] of Object.entries(stringFields)) {
    if (hasOwn(value, key)) result[key] = clean(value[key], max);
  }
  if (typeof value.active === "boolean") result.active = value.active;
  return result;
}

async function logActivity(db, options) {
  const ownerIds = [...new Map((options.ownerIds || [options.actorId]).filter(Boolean).map((id) => [String(id), id])).values()];
  if (!ownerIds.length) return;
  const now = new Date();
  const docs = ownerIds.map((ownerId) => ({
    ownerId,
    actorId: options.actorId,
    type: clean(options.type, 60),
    ...(options.targetId ? { targetId: options.targetId } : {}),
    ...(options.entityId ? { entityId: options.entityId } : {}),
    entityType: clean(options.entityType, 30),
    metadata: activityMetadata(options.metadata),
    visibility: ["public", "friends", "private"].includes(options.visibility) ? options.visibility : "private",
    createdAt: now
  }));
  await db.collection("communityActivity").insertMany(docs);
}

async function loadActivity(db, targetId, viewerId, visibility, query = {}) {
  const { page, limit, skip } = pagination(query, 24);
  const owner = String(targetId) === String(viewerId || "");
  const allowed = owner ? ["public", "friends", "private"]
    : visibility === "friends" ? ["public", "friends"] : ["public"];
  const filter = { ownerId: targetId, visibility: { $in: allowed } };
  const activity = db.collection("communityActivity");
  const [total, items] = await Promise.all([
    activity.countDocuments(filter),
    activity.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray()
  ]);
  const people = await loadPeople(db, items.map((item) => item.actorId));
  return {
    items: items.map((item) => ({
      id: String(item._id),
      type: clean(item.type, 60),
      actor: basicPerson(people.get(String(item.actorId)), item.actorId),
      targetId: item.targetId ? String(item.targetId) : "",
      entity: { type: clean(item.entityType, 30), id: item.entityId ? String(item.entityId) : "" },
      metadata: activityMetadata(item.metadata),
      visibility: allowed.includes(item.visibility) ? item.visibility : "private",
      createdAt: item.createdAt || null
    })),
    total,
    page,
    limit
  };
}

function serializePage(page, ownerRecord, following, viewerId) {
  return {
    id: String(page._id),
    owner: basicPerson(ownerRecord, page.ownerId),
    name: clean(page.name, 120),
    slug: clean(page.slug, 60),
    category: clean(page.category, 80),
    description: clean(page.description, 1200),
    avatar: safeStoredUrl(page.avatar, true),
    cover: safeStoredUrl(page.cover, true),
    website: safeStoredUrl(page.website),
    address: clean(page.address, 240),
    phone: clean(page.phone, 40),
    businessHours: clean(page.businessHours, 240),
    actionButton: clean(page.actionButton, 80),
    socialLinks: Array.isArray(page.socialLinks) ? page.socialLinks.slice(0, 12).map((item) => ({
      platform: clean(item.platform, 30), label: clean(item.label, 50), url: safeStoredUrl(item.url, false, 800)
    })).filter((item) => item.url) : [],
    followerCount: nonnegativeInt(page.followerCount),
    following: Boolean(following),
    owned: String(page.ownerId) === String(viewerId || ""),
    roles: String(page.ownerId) === String(viewerId || "") ? (page.roles || []).slice(0, 50).map((item) => ({ userId: String(item.userId), role: clean(item.role, 30) })) : [],
    insights: String(page.ownerId) === String(viewerId || "") ? {
      reach: nonnegativeInt(page.insights?.reach),
      engagement: nonnegativeInt(page.insights?.engagement),
      videoViews: nonnegativeInt(page.insights?.videoViews)
    } : null,
    createdAt: page.createdAt || null,
    updatedAt: page.updatedAt || page.createdAt || null
  };
}

async function loadPages(db, viewer, query = {}) {
  const { page, limit, skip } = pagination(query, 20);
  const filter = { status: "active" };
  const pageIdInput = query.pageId ?? query.id;
  if (pageIdInput !== undefined && clean(pageIdInput, 80)) filter._id = idOf(pageIdInput, "page id");
  const slug = asciiSlug(query.slug || "", 60);
  if (slug) filter.slug = slug;
  const detailRequested = filter._id instanceof ObjectId || Boolean(filter.slug);
  const ownerInput = query.ownerId;
  if (ownerInput !== undefined && clean(ownerInput, 80)) filter.ownerId = idOf(ownerInput, "owner id");
  const scope = clean(query.scope, 30).toLocaleLowerCase("en-US");
  if (["mine", "owned"].includes(scope)) {
    if (!viewer) fail(401, "Authentication is required.", "AUTH_REQUIRED");
    filter.ownerId = viewer._id;
  } else if (scope === "following") {
    if (!viewer) fail(401, "Authentication is required.", "AUTH_REQUIRED");
    const followed = await db.collection("communityPageFollows").find(
      { userId: viewer._id, active: true }, { projection: { pageId: 1 } }
    ).toArray();
    if (!followed.length) return { pages: [], total: 0, page, limit, detail: detailRequested };
    const followedIds = followed.map((item) => item.pageId);
    if (filter._id instanceof ObjectId) {
      if (!followedIds.some((id) => String(id) === String(filter._id))) {
        return { pages: [], total: 0, page, limit, detail: true };
      }
    } else {
      filter._id = { $in: followedIds };
    }
  }
  const search = clean(query.q || query.search, 100);
  if (search) filter.$or = [
    { name: { $regex: escapeRegex(search), $options: "i" } },
    { description: { $regex: escapeRegex(search), $options: "i" } },
    { category: { $regex: escapeRegex(search), $options: "i" } }
  ];
  if (viewer) {
    const blocked = await blockedUserIds(db, viewer._id);
    if (blocked.length) {
      const blockedSet = new Set(blocked.map(String));
      if (filter.ownerId instanceof ObjectId && blockedSet.has(String(filter.ownerId))) {
        return { pages: [], total: 0, page, limit, detail: detailRequested };
      }
      if (!filter.ownerId) filter.ownerId = { $nin: blocked };
    }
  }
  const pagesCollection = db.collection("communityPages");
  const [total, items] = await Promise.all([
    pagesCollection.countDocuments(filter),
    pagesCollection.find(filter).sort({ followerCount: -1, createdAt: -1 }).skip(skip).limit(limit).toArray()
  ]);
  const [owners, follows] = await Promise.all([
    loadPeople(db, items.map((item) => item.ownerId)),
    viewer && items.length ? db.collection("communityPageFollows").find({
      userId: viewer._id, pageId: { $in: items.map((item) => item._id) }, active: true
    }, { projection: { pageId: 1 } }).toArray() : []
  ]);
  const followedIds = new Set(follows.map((item) => String(item.pageId)));
  const result = items.map((item) => serializePage(
    item, owners.get(String(item.ownerId)), followedIds.has(String(item._id)), viewer?._id
  ));
  return { pages: result, total, page, limit, detail: detailRequested };
}

async function loadSuggestions(db, viewer, limit = 12) {
  const excluded = [];
  if (viewer) {
    const [friends, blocked, pending] = await Promise.all([
      friendIds(db, viewer._id),
      blockedUserIds(db, viewer._id),
      db.collection("communityFriendships").find({
        status: "pending",
        $or: [{ userAId: viewer._id }, { userBId: viewer._id }]
      }, { projection: { userAId: 1, userBId: 1 } }).toArray()
    ]);
    const pendingIds = pending.map((item) => otherUserId(item, viewer._id));
    excluded.push(viewer._id, ...friends, ...blocked, ...pendingIds);
  }
  const filter = {
    status: { $ne: "deleted" },
    "privacy.discoverable": { $ne: false },
    $or: [
      { "privacy.profileVisibility": "public" },
      { "privacy.profileVisibility": { $exists: false } }
    ],
    ...(excluded.length ? { userId: { $nin: excluded } } : {})
  };
  const profiles = await db.collection("communityProfiles").find(filter).sort({ updatedAt: -1 }).limit(Math.min(24, limit)).toArray();
  const people = await loadPeople(db, profiles.map((item) => item.userId));
  return profiles.map((profile) => {
    const record = people.get(String(profile.userId));
    if (!record) return null;
    return serializeProfile(profile, record.account, {
      owner: false, friend: false, following: false, followedBy: false, restricted: false, muted: false,
      friendStatus: "", requestDirection: ""
    });
  }).filter(Boolean);
}

async function getProfile(db, viewer, query) {
  const { profile, account } = await resolveProfileTarget(db, viewer, query);
  return { profile: await profilePayload(db, viewer, profile, account) };
}

async function getFriends(db, viewer, query) {
  const { profile, account } = await resolveProfileTarget(db, viewer, query);
  const context = await relationshipContext(db, viewer?._id || null, profile.userId);
  if (context.blocked) fail(404, "Profile not found.", "PROFILE_NOT_FOUND");
  const privacy = privacyFor(profile);
  if (!visibilityAllows(privacy.friendsVisibility, context.owner, context.friend)) {
    fail(403, "This friend list is private.", "FRIENDS_PRIVATE");
  }
  const bundle = await loadFriendBundle(db, profile.userId, viewer?._id || null, query, context.owner);
  return { profile: basicPerson({ account, profile }), ...bundle };
}

async function getActivity(db, viewer, query) {
  const { profile, account } = await resolveProfileTarget(db, viewer, query);
  const context = await relationshipContext(db, viewer?._id || null, profile.userId);
  if (context.blocked) fail(404, "Profile not found.", "PROFILE_NOT_FOUND");
  const privacy = privacyFor(profile);
  if (!visibilityAllows(privacy.activityVisibility, context.owner, context.friend)) {
    fail(403, "This activity log is private.", "ACTIVITY_PRIVATE");
  }
  const result = await loadActivity(db, profile.userId, viewer?._id || null, privacy.activityVisibility, query);
  return { profile: basicPerson({ account, profile }), activity: result.items, total: result.total, page: result.page, limit: result.limit };
}

async function getBootstrap(db, viewer) {
  if (!viewer) {
    const [pageResult, suggestions] = await Promise.all([
      loadPages(db, null, { limit: 12 }),
      loadSuggestions(db, null, 12)
    ]);
    return {
      signedIn: false,
      profile: null,
      friends: [],
      requests: { incoming: [], outgoing: [], incomingTotal: 0, outgoingTotal: 0 },
      blocked: [],
      restricted: [],
      muted: [],
      snoozed: [],
      priority: [],
      closeFriends: [],
      acquaintances: [],
      following: [],
      saved: [],
      activity: [],
      pages: pageResult.pages,
      collections: [],
      privacy: null,
      suggestions,
      counts: { friends: 0, followers: 0, following: 0, pages: pageResult.total, saved: 0 }
    };
  }
  const profile = await ensureProfile(db, viewer);
  const [profileResult, friends, relations, saved, activity, pageResult, suggestions, collections] = await Promise.all([
    profilePayload(db, viewer, profile, viewer),
    loadFriendBundle(db, viewer._id, viewer._id, { limit: 12 }, true),
    loadOwnedRelations(db, viewer._id),
    loadSavedPosts(db, viewer, { limit: 8 }),
    loadActivity(db, viewer._id, viewer._id, "private", { limit: 12 }),
    loadPages(db, viewer, { limit: 12 }),
    loadSuggestions(db, viewer, 12),
    loadCollections(db, viewer._id)
  ]);
  return {
    signedIn: true,
    profile: profileResult,
    friends: friends.friends,
    requests: friends.requests,
    blocked: relations.blocked,
    restricted: relations.restricted,
    muted: relations.muted,
    snoozed: relations.snoozed,
    priority: relations.priority,
    closeFriends: relations.closeFriends,
    acquaintances: relations.acquaintances,
    following: relations.following,
    saved: saved.items,
    activity: activity.items,
    pages: pageResult.pages,
    collections,
    privacy: profileResult.privacy,
    suggestions,
    counts: {
      friends: friends.total,
      followers: profileResult.stats.followers,
      following: profileResult.stats.following,
      pages: profileResult.stats.pages,
      saved: saved.total
    }
  };
}

function profileUpdate(input) {
  if (!isPlainObject(input)) fail(400, "profile must be an object.", "INVALID_PROFILE");
  const patch = {};
  if (hasOwn(input, "username")) {
    const username = normalizedUsername(input.username);
    if (!validUsername(username)) fail(400, "Username must be 3-30 safe characters and not reserved.", "INVALID_USERNAME");
    patch.username = username;
  }
  for (const [field, max] of Object.entries(PROFILE_STRING_FIELDS)) {
    if (hasOwn(input, field)) patch[field] = clean(input[field], max);
  }
  if (hasOwn(input, "cover")) patch.cover = inputUrl(input.cover, "Cover", { imageOnly: true, max: 1200 });
  if (hasOwn(input, "birthday")) patch.birthday = normalizeBirthday(input.birthday);
  if (hasOwn(input, "website")) patch.website = inputUrl(input.website, "Website", { max: 800 });
  if (hasOwn(input, "socialLinks")) patch.socialLinks = socialLinks(input.socialLinks);
  if (hasOwn(input, "interests")) patch.interests = stringList(input.interests, "interests", 24, 80);
  if (hasOwn(input, "languages")) patch.languages = stringList(input.languages, "languages", 16, 80);
  return patch;
}

async function updateProfile(db, user, body) {
  await enforceRateLimit(db, `social:profile:${user._id}`, 30, 60 * 60 * 1000);
  await ensureProfile(db, user);
  const input = isPlainObject(body.profile) ? body.profile : body;
  const patch = profileUpdate(input);
  const accountPatch = {};
  if (hasOwn(input, "displayName") || hasOwn(input, "name")) {
    const name = clean(input.displayName ?? input.name, 100);
    if (name.length < 2) fail(400, "Display name must contain at least 2 characters.", "INVALID_DISPLAY_NAME");
    accountPatch.name = name;
  }
  if (hasOwn(input, "avatar")) accountPatch.avatar = inputUrl(input.avatar, "Avatar", { imageOnly: true, max: 1200 });
  if (!Object.keys(patch).length && !Object.keys(accountPatch).length) fail(400, "No supported profile fields were supplied.", "EMPTY_PROFILE_UPDATE");
  if (patch.username) {
    const conflict = await db.collection("communityProfiles").findOne({
      username: patch.username, userId: { $ne: user._id }
    }, { projection: { _id: 1 } });
    if (conflict) fail(409, "Username is already in use.", "USERNAME_TAKEN");
  }
  let updated;
  try {
    updated = await db.collection("communityProfiles").findOneAndUpdate(
      { userId: user._id, status: { $ne: "deleted" } },
      { $set: { ...patch, updatedAt: new Date() } },
      { returnDocument: "after" }
    );
  } catch (error) {
    if (error?.code === 11000) fail(409, "Username is already in use.", "USERNAME_TAKEN");
    throw error;
  }
  if (!updated) fail(404, "Profile not found.", "PROFILE_NOT_FOUND");
  if (Object.keys(accountPatch).length) {
    await db.collection("users").updateOne({ _id: user._id, status: { $ne: "deleted" } }, { $set: { ...accountPatch, updatedAt: new Date() } });
  }
  await logActivity(db, {
    actorId: user._id,
    type: "profile.updated",
    entityType: "profile",
    entityId: updated._id,
    metadata: { fields: [...Object.keys(patch), ...Object.keys(accountPatch)].join(",") },
    visibility: "private"
  });
  const updatedAccount = { ...user, ...accountPatch };
  return { ok: true, profile: await profilePayload(db, updatedAccount, updated, updatedAccount) };
}

async function updatePrivacy(db, user, body) {
  await enforceRateLimit(db, `social:privacy:${user._id}`, 30, 60 * 60 * 1000);
  await ensureProfile(db, user);
  const input = isPlainObject(body.privacy) ? body.privacy : isPlainObject(body.settings) ? body.settings : null;
  const patch = privacyPatch(input);
  const set = { updatedAt: new Date() };
  for (const [key, value] of Object.entries(patch)) set[`privacy.${key}`] = value;
  const updated = await db.collection("communityProfiles").findOneAndUpdate(
    { userId: user._id, status: { $ne: "deleted" } }, { $set: set }, { returnDocument: "after" }
  );
  if (!updated) fail(404, "Profile not found.", "PROFILE_NOT_FOUND");
  await logActivity(db, {
    actorId: user._id,
    type: "privacy.updated",
    entityType: "profile",
    entityId: updated._id,
    metadata: { fields: Object.keys(patch).join(",") },
    visibility: "private"
  });
  return { ok: true, privacy: privacyFor(updated) };
}

async function targetAccount(db, user, body) {
  const raw = body.targetId ?? body.userId ?? body.friendId;
  const targetId = idOf(raw, "target user id");
  if (String(targetId) === String(user._id)) fail(400, "You cannot target your own account.", "SELF_TARGET");
  const account = await accountById(db, targetId);
  if (!account) fail(404, "User not found.", "USER_NOT_FOUND");
  return { targetId, account };
}

async function sendFriendRequest(db, user, body) {
  const { targetId, account } = await targetAccount(db, user, body);
  await Promise.all([
    enforceRateLimit(db, `social:friend-send:${user._id}`, 20, 24 * 60 * 60 * 1000),
    enforceRateLimit(db, `social:friend-pair:${user._id}:${targetId}`, 3, 24 * 60 * 60 * 1000),
    assertNotBlocked(db, user._id, targetId)
  ]);
  const profiles = db.collection("communityProfiles");
  const targetProfile = await profiles.findOne({ userId: targetId, status: { $ne: "deleted" } });
  const privacy = privacyFor(targetProfile);
  if (privacy.friendRequestPermission === "none") fail(403, "This user is not accepting friend requests.", "FRIEND_REQUESTS_DISABLED");
  if (privacy.friendRequestPermission === "friends_of_friends" && !await hasMutualFriend(db, user._id, targetId)) {
    fail(403, "A mutual friend is required.", "MUTUAL_FRIEND_REQUIRED");
  }

  const friendships = db.collection("communityFriendships");
  const pair = pairFor(user._id, targetId);
  const existing = await friendships.findOne(pair);
  if (existing?.status === "accepted") fail(409, "You are already friends.", "ALREADY_FRIENDS");
  if (existing?.status === "pending") fail(409, "A friend request is already pending.", "FRIEND_REQUEST_PENDING");
  const now = new Date();
  let request;
  if (existing) {
    request = await friendships.findOneAndUpdate(
      { _id: existing._id, status: { $in: ["declined", "cancelled", "removed"] } },
      {
        $set: { requesterId: user._id, recipientId: targetId, status: "pending", requestedAt: now, updatedAt: now },
        $unset: { respondedAt: "", cancelledAt: "", removedAt: "", friendsAt: "", endedReason: "" },
        $push: { history: { $each: [{ status: "pending", actorId: user._id, at: now }], $slice: -20 } }
      },
      { returnDocument: "after" }
    );
  } else {
    const doc = {
      ...pair,
      requesterId: user._id,
      recipientId: targetId,
      status: "pending",
      requestedAt: now,
      createdAt: now,
      updatedAt: now,
      history: [{ status: "pending", actorId: user._id, at: now }]
    };
    try {
      const result = await friendships.insertOne(doc);
      request = { ...doc, _id: result.insertedId };
    } catch (error) {
      if (error?.code === 11000) fail(409, "A friend relationship already exists.", "FRIENDSHIP_CONFLICT");
      throw error;
    }
  }
  if (!request) fail(409, "Friend request state changed. Try again.", "FRIENDSHIP_CONFLICT");
  await logActivity(db, {
    ownerIds: [user._id, targetId], actorId: user._id, targetId,
    type: "friend.requested", entityType: "friendship", entityId: request._id, visibility: "private"
  });
  const people = new Map([[String(targetId), { account, profile: targetProfile }]]);
  return { ok: true, request: serializeFriendRequest(request, user._id, people) };
}

async function friendRecordForAction(db, user, body) {
  const friendships = db.collection("communityFriendships");
  if (hasOwn(body, "requestId") && clean(body.requestId, 80)) {
    const requestId = idOf(body.requestId, "friend request id");
    const item = await friendships.findOne({ _id: requestId });
    if (!item) fail(404, "Friend request not found.", "FRIEND_REQUEST_NOT_FOUND");
    return item;
  }
  const raw = body.targetId ?? body.userId ?? body.friendId;
  const targetId = idOf(raw, "target user id");
  if (String(targetId) === String(user._id)) fail(400, "You cannot target your own account.", "SELF_TARGET");
  const item = await friendships.findOne(pairFor(user._id, targetId));
  if (!item) fail(404, "Friend relationship not found.", "FRIENDSHIP_NOT_FOUND");
  return item;
}

function friendDecision(body) {
  if (typeof body.accepted === "boolean") return body.accepted ? "accept" : "decline";
  const raw = clean(body.response || body.decision || body.status, 20).toLocaleLowerCase("en-US");
  if (["accept", "accepted", "approve", "approved"].includes(raw)) return "accept";
  if (["decline", "declined", "reject", "rejected"].includes(raw)) return "decline";
  fail(400, "response must be accept or decline.", "INVALID_FRIEND_RESPONSE");
}

async function respondFriendRequest(db, user, body) {
  await enforceRateLimit(db, `social:friend-respond:${user._id}`, 40, 24 * 60 * 60 * 1000);
  const item = await friendRecordForAction(db, user, body);
  if (item.status !== "pending") fail(409, "This friend request is no longer pending.", "FRIEND_REQUEST_NOT_PENDING");
  if (String(item.recipientId) !== String(user._id)) fail(403, "Only the recipient can respond.", "NOT_REQUEST_RECIPIENT");
  const targetId = item.requesterId;
  await assertNotBlocked(db, user._id, targetId);
  const decision = friendDecision(body);
  const now = new Date();
  const status = decision === "accept" ? "accepted" : "declined";
  const set = { status, respondedAt: now, updatedAt: now };
  if (status === "accepted") set.friendsAt = now;
  const updated = await db.collection("communityFriendships").findOneAndUpdate(
    { _id: item._id, recipientId: user._id, status: "pending" },
    {
      $set: set,
      ...(status === "declined" ? { $unset: { friendsAt: "" } } : {}),
      $push: { history: { $each: [{ status, actorId: user._id, at: now }], $slice: -20 } }
    },
    { returnDocument: "after" }
  );
  if (!updated) fail(409, "Friend request state changed. Refresh and try again.", "FRIENDSHIP_CONFLICT");
  await logActivity(db, {
    ownerIds: [user._id, targetId], actorId: user._id, targetId,
    type: status === "accepted" ? "friend.accepted" : "friend.declined",
    entityType: "friendship", entityId: item._id,
    metadata: { response: decision }, visibility: status === "accepted" ? "friends" : "private"
  });
  const people = await loadPeople(db, [targetId]);
  return { ok: true, request: serializeFriendRequest(updated, user._id, people), friends: status === "accepted" };
}

async function cancelFriendRequest(db, user, body) {
  await enforceRateLimit(db, `social:friend-cancel:${user._id}`, 40, 24 * 60 * 60 * 1000);
  const item = await friendRecordForAction(db, user, body);
  if (item.status !== "pending") fail(409, "This friend request is no longer pending.", "FRIEND_REQUEST_NOT_PENDING");
  if (String(item.requesterId) !== String(user._id)) fail(403, "Only the requester can cancel.", "NOT_REQUEST_OWNER");
  const now = new Date();
  const updated = await db.collection("communityFriendships").findOneAndUpdate(
    { _id: item._id, requesterId: user._id, status: "pending" },
    {
      $set: { status: "cancelled", cancelledAt: now, updatedAt: now },
      $push: { history: { $each: [{ status: "cancelled", actorId: user._id, at: now }], $slice: -20 } }
    },
    { returnDocument: "after" }
  );
  if (!updated) fail(409, "Friend request state changed. Refresh and try again.", "FRIENDSHIP_CONFLICT");
  const targetId = item.recipientId;
  await logActivity(db, {
    ownerIds: [user._id, targetId], actorId: user._id, targetId,
    type: "friend.cancelled", entityType: "friendship", entityId: item._id, visibility: "private"
  });
  return { ok: true, status: "cancelled" };
}

async function removeFriend(db, user, body) {
  await enforceRateLimit(db, `social:friend-remove:${user._id}`, 30, 24 * 60 * 60 * 1000);
  const item = await friendRecordForAction(db, user, body);
  if (item.status !== "accepted") fail(409, "This friendship is not active.", "NOT_FRIENDS");
  const member = String(item.userAId) === String(user._id) || String(item.userBId) === String(user._id);
  if (!member) fail(403, "You do not own this friendship state.", "NOT_FRIENDSHIP_MEMBER");
  const targetId = otherUserId(item, user._id);
  const now = new Date();
  const updated = await db.collection("communityFriendships").findOneAndUpdate(
    {
      _id: item._id,
      status: "accepted",
      $or: [{ userAId: user._id }, { userBId: user._id }]
    },
    {
      $set: { status: "removed", removedAt: now, updatedAt: now, endedReason: "removed" },
      $push: { history: { $each: [{ status: "removed", actorId: user._id, at: now }], $slice: -20 } }
    },
    { returnDocument: "after" }
  );
  if (!updated) fail(409, "Friendship state changed. Refresh and try again.", "FRIENDSHIP_CONFLICT");
  await logActivity(db, {
    ownerIds: [user._id, targetId], actorId: user._id, targetId,
    type: "friend.removed", entityType: "friendship", entityId: item._id, visibility: "private"
  });
  return { ok: true, status: "removed" };
}

function requestedState(body, current) {
  for (const key of ["enabled", "active"]) {
    if (hasOwn(body, key)) {
      if (typeof body[key] !== "boolean") fail(400, `${key} must be boolean.`, "INVALID_RELATION_STATE");
      return body[key];
    }
  }
  return !current;
}

async function setRelation(db, user, body, type) {
  if (!RELATION_TYPES.has(type)) fail(400, "Unsupported relationship type.", "INVALID_RELATION");
  const { targetId } = await targetAccount(db, user, body);
  await enforceRateLimit(db, `social:relation:${type}:${user._id}`, type === "block" ? 40 : 80, 60 * 60 * 1000);
  const relations = db.collection("communityRelations");
  const existing = await relations.findOne({ actorId: user._id, targetId, type });
  const active = requestedState(body, Boolean(existing?.active));
  if (type !== "block" && active) await assertNotBlocked(db, user._id, targetId);
  if (["close_friend", "acquaintance"].includes(type) && active && !await areFriends(db, user._id, targetId)) {
    fail(409, "Only accepted friends can be added to this list.", "FRIEND_LIST_REQUIRES_FRIENDSHIP");
  }
  if (type === "follow" && active) {
    const targetProfile = await db.collection("communityProfiles").findOne({ userId: targetId, status: { $ne: "deleted" } });
    if (privacyFor(targetProfile).followPermission === "none") fail(403, "This user is not accepting followers.", "FOLLOWS_DISABLED");
  }
  const now = new Date();
  const snoozeDays = Math.max(1, Math.min(30, Number.parseInt(body.days, 10) || 30));
  const expiresAt = type === "snooze" && active ? new Date(now.getTime() + snoozeDays * 24 * 60 * 60 * 1000) : null;
  await relations.updateOne(
    { actorId: user._id, targetId, type },
    {
      $set: {
        active,
        updatedAt: now,
        ...(expiresAt ? { expiresAt } : {}),
        ...(active ? { activatedAt: now } : { disabledAt: now })
      },
      $setOnInsert: { actorId: user._id, targetId, type, createdAt: now },
      ...(active ? { $unset: { disabledAt: "", ...(type !== "snooze" ? { expiresAt: "" } : {}) } } : { $unset: { expiresAt: "" } })
    },
    { upsert: true }
  );
  if (active && type === "close_friend") await relations.updateOne({ actorId: user._id, targetId, type: "acquaintance", active: true }, { $set: { active: false, disabledAt: now, updatedAt: now } });
  if (active && type === "acquaintance") await relations.updateOne({ actorId: user._id, targetId, type: "close_friend", active: true }, { $set: { active: false, disabledAt: now, updatedAt: now } });
  if (type === "block" && active) {
    const pair = pairFor(user._id, targetId);
    const event = { status: "removed", actorId: user._id, at: now };
    await Promise.all([
      db.collection("communityFriendships").updateOne(
        { ...pair, status: { $in: ["pending", "accepted"] } },
        {
          $set: { status: "removed", removedAt: now, updatedAt: now, endedReason: "blocked" },
          $push: { history: { $each: [event], $slice: -20 } }
        }
      ),
      relations.updateMany({
        type: "follow",
        active: true,
        $or: [
          { actorId: user._id, targetId },
          { actorId: targetId, targetId: user._id }
        ]
      }, { $set: { active: false, disabledAt: now, updatedAt: now, endedReason: "blocked" } })
    ]);
  }
  const privateAction = ["block", "restrict", "mute", "snooze", "priority", "close_friend", "acquaintance"].includes(type);
  await logActivity(db, {
    ownerIds: privateAction ? [user._id] : [user._id, targetId],
    actorId: user._id,
    targetId,
    type: `${type}.${active ? "enabled" : "disabled"}`,
    entityType: "relation",
    metadata: { relation: type, active, ...(expiresAt ? { expiresAt } : {}) },
    visibility: privateAction || !active ? "private" : "public"
  });
  const responseKey = type === "follow" ? "following"
    : type === "block" ? "blocked"
      : type === "restrict" ? "restricted"
        : type === "mute" ? "muted"
          : type === "snooze" ? "snoozed"
            : type === "priority" ? "priority"
              : type === "close_friend" ? "closeFriend" : "acquaintance";
  return { ok: true, relation: type, active, expiresAt, [responseKey]: active };
}

function pageSlug(value) {
  const slug = asciiSlug(value, 60);
  if (slug.length < 3 || slug.length > 60 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])$/.test(slug) || RESERVED_PAGE_SLUGS.has(slug)) {
    fail(400, "Page slug must be 3-60 safe characters and not reserved.", "INVALID_PAGE_SLUG");
  }
  return slug;
}

async function createPage(db, user, body) {
  await enforceRateLimit(db, `social:page-create:${user._id}`, 5, 24 * 60 * 60 * 1000);
  await ensureProfile(db, user);
  const pages = db.collection("communityPages");
  const ownedCount = await pages.countDocuments({ ownerId: user._id, status: "active" });
  if (ownedCount >= 20) fail(409, "Page ownership limit reached.", "PAGE_LIMIT_REACHED");
  const input = isPlainObject(body.page) ? body.page : body;
  const name = clean(input.name, 120);
  if (name.length < 3) fail(400, "Page name must contain at least 3 characters.", "INVALID_PAGE_NAME");
  const slug = pageSlug(input.slug || name);
  const now = new Date();
  const doc = {
    ownerId: user._id,
    name,
    slug,
    category: clean(input.category, 80),
    description: clean(input.description, 1200),
    avatar: hasOwn(input, "avatar") ? inputUrl(input.avatar, "Page avatar", { imageOnly: true, max: 1200 }) : "",
    cover: hasOwn(input, "cover") ? inputUrl(input.cover, "Page cover", { imageOnly: true, max: 1200 }) : "",
    website: hasOwn(input, "website") ? inputUrl(input.website, "Page website", { max: 800 }) : "",
    address: clean(input.address, 240),
    phone: clean(input.phone, 40),
    businessHours: clean(input.businessHours, 240),
    actionButton: clean(input.actionButton || "Theo dõi", 80),
    socialLinks: hasOwn(input, "socialLinks") ? socialLinks(input.socialLinks) : [],
    roles: [{ userId: user._id, role: "owner", createdAt: now }],
    insights: { reach: 0, engagement: 0, videoViews: 0 },
    followerCount: 1,
    status: "active",
    createdAt: now,
    updatedAt: now
  };
  let result;
  try {
    result = await pages.insertOne(doc);
  } catch (error) {
    if (error?.code === 11000) fail(409, "Page slug is already in use.", "PAGE_SLUG_TAKEN");
    throw error;
  }
  const page = { ...doc, _id: result.insertedId };
  await Promise.all([
    db.collection("communityPageFollows").insertOne({
      pageId: page._id, userId: user._id, active: true, createdAt: now, activatedAt: now, updatedAt: now
    }),
    logActivity(db, {
      actorId: user._id, type: "page.created", entityType: "page", entityId: page._id,
      metadata: { pageName: name, pageSlug: slug }, visibility: "public"
    })
  ]);
  return { ok: true, page: serializePage(page, { account: user, profile: await ensureProfile(db, user) }, true, user._id) };
}

async function followPage(db, user, body) {
  await enforceRateLimit(db, `social:page-follow:${user._id}`, 80, 60 * 60 * 1000);
  const pageId = idOf(body.pageId ?? body.targetId, "page id");
  const pages = db.collection("communityPages");
  const page = await pages.findOne({ _id: pageId, status: "active" });
  if (!page) fail(404, "Page not found.", "PAGE_NOT_FOUND");
  const follows = db.collection("communityPageFollows");
  let existing = await follows.findOne({ pageId, userId: user._id });
  const active = requestedState(body, Boolean(existing?.active));
  if (active && String(page.ownerId) !== String(user._id)) await assertNotBlocked(db, user._id, page.ownerId);
  const now = new Date();
  let changed = false;
  if (existing) {
    const result = await follows.updateOne(
      { _id: existing._id, active: { $ne: active } },
      {
        $set: { active, updatedAt: now, ...(active ? { activatedAt: now } : { disabledAt: now }) },
        ...(active ? { $unset: { disabledAt: "" } } : {})
      }
    );
    changed = result.modifiedCount === 1;
  } else if (active) {
    try {
      await follows.insertOne({ pageId, userId: user._id, active: true, createdAt: now, activatedAt: now, updatedAt: now });
      changed = true;
    } catch (error) {
      if (error?.code !== 11000) throw error;
      existing = await follows.findOne({ pageId, userId: user._id });
      const result = await follows.updateOne(
        { _id: existing._id, active: { $ne: true } },
        { $set: { active: true, activatedAt: now, updatedAt: now }, $unset: { disabledAt: "" } }
      );
      changed = result.modifiedCount === 1;
    }
  }
  if (changed) {
    const delta = active ? 1 : -1;
    await pages.updateOne({ _id: pageId, status: "active" }, [{
      $set: {
        followerCount: { $max: [0, { $add: [{ $ifNull: ["$followerCount", 0] }, delta] }] },
        updatedAt: now
      }
    }]);
    await logActivity(db, {
      actorId: user._id,
      type: `page.${active ? "followed" : "unfollowed"}`,
      entityType: "page",
      entityId: pageId,
      metadata: { pageName: page.name, pageSlug: page.slug, active },
      visibility: active ? "public" : "private"
    });
  }
  const updatedPage = await pages.findOne({ _id: pageId, status: "active" });
  const owners = await loadPeople(db, [updatedPage.ownerId]);
  return { ok: true, following: active, page: serializePage(updatedPage, owners.get(String(updatedPage.ownerId)), active, user._id) };
}

async function updatePage(db, user, body) {
  await enforceRateLimit(db, `social:page-update:${user._id}`, 40, 60 * 60 * 1000);
  const pageId = idOf(body.pageId ?? body.id, "page id");
  const pages = db.collection("communityPages");
  const page = await pages.findOne({ _id: pageId, status: "active" });
  if (!page) fail(404, "Page not found.", "PAGE_NOT_FOUND");
  const role = (page.roles || []).find((item) => String(item.userId) === String(user._id))?.role;
  if (String(page.ownerId) !== String(user._id) && !["admin", "editor"].includes(role)) fail(403, "You cannot edit this Page.", "PAGE_FORBIDDEN");
  const input = isPlainObject(body.page) ? body.page : body;
  const patch = { updatedAt: new Date() };
  if (hasOwn(input, "name")) {
    patch.name = clean(input.name, 120);
    if (patch.name.length < 3) fail(400, "Page name must contain at least 3 characters.", "INVALID_PAGE_NAME");
  }
  if (hasOwn(input, "slug")) patch.slug = pageSlug(input.slug);
  if (hasOwn(input, "category")) patch.category = clean(input.category, 80);
  if (hasOwn(input, "description")) patch.description = clean(input.description, 1200);
  if (hasOwn(input, "website")) patch.website = inputUrl(input.website, "Page website", { max: 800 });
  if (hasOwn(input, "avatar")) patch.avatar = inputUrl(input.avatar, "Page avatar", { imageOnly: true, max: 1200 });
  if (hasOwn(input, "cover")) patch.cover = inputUrl(input.cover, "Page cover", { imageOnly: true, max: 1200 });
  for (const [field, max] of [["address", 240], ["phone", 40], ["businessHours", 240], ["actionButton", 80]]) {
    if (hasOwn(input, field)) patch[field] = clean(input[field], max);
  }
  if (hasOwn(input, "socialLinks")) patch.socialLinks = socialLinks(input.socialLinks);
  try { await pages.updateOne({ _id: pageId }, { $set: patch }); }
  catch (error) { if (error?.code === 11000) fail(409, "Page slug is already in use.", "PAGE_SLUG_TAKEN"); throw error; }
  await logActivity(db, { actorId: user._id, type: "page.updated", entityType: "page", entityId: pageId, metadata: { fields: Object.keys(patch).join(",") }, visibility: "private" });
  const updated = await pages.findOne({ _id: pageId });
  return { ok: true, page: serializePage(updated, { account: user, profile: await ensureProfile(db, user) }, true, user._id) };
}

async function createCollection(db, user, body) {
  await enforceRateLimit(db, `social:collection-create:${user._id}`, 30, 24 * 60 * 60 * 1000);
  const input = isPlainObject(body.collection) ? body.collection : body;
  const name = clean(input.name, 100);
  if (name.length < 2) fail(400, "Collection name must contain at least 2 characters.", "INVALID_COLLECTION_NAME");
  const baseSlug = asciiSlug(name, 48) || `collection-${String(new ObjectId()).slice(-8)}`;
  const now = new Date();
  const doc = {
    ownerId: user._id,
    name,
    slug: `${baseSlug}-${String(new ObjectId()).slice(-6)}`,
    description: clean(input.description, 400),
    privacy: ["public", "friends", "private"].includes(input.privacy) ? input.privacy : "private",
    color: /^#[0-9a-f]{6}$/i.test(clean(input.color, 20)) ? clean(input.color, 20).toUpperCase() : "#62D7E7",
    postIds: [],
    createdAt: now,
    updatedAt: now
  };
  const result = await db.collection("communityCollections").insertOne(doc);
  await logActivity(db, {
    actorId: user._id, type: "collection.created", entityType: "collection", entityId: result.insertedId,
    metadata: { fields: name }, visibility: "private"
  });
  return { ok: true, collection: serializeCollection({ ...doc, _id: result.insertedId }) };
}

async function updateCollectionItem(db, user, body) {
  await enforceRateLimit(db, `social:collection-item:${user._id}`, 120, 60 * 60 * 1000);
  const collectionId = idOf(body.collectionId, "collection id");
  const postId = idOf(body.postId ?? body.targetId, "post id");
  const collection = await db.collection("communityCollections").findOne({ _id: collectionId, ownerId: user._id, deletedAt: { $exists: false } });
  if (!collection) fail(404, "Collection not found.", "COLLECTION_NOT_FOUND");
  const post = await db.collection("communityPosts").findOne({ _id: postId, deletedAt: { $exists: false }, savedBy: user._id }, { projection: { _id: 1 } });
  if (!post) fail(409, "Save the post before adding it to a collection.", "POST_NOT_SAVED");
  const contains = (collection.postIds || []).some((id) => String(id) === String(postId));
  const active = requestedState(body, contains);
  await db.collection("communityCollections").updateOne(
    { _id: collectionId, ownerId: user._id },
    { [active ? "$addToSet" : "$pull"]: { postIds: postId }, $set: { updatedAt: new Date() } }
  );
  const updated = await db.collection("communityCollections").findOne({ _id: collectionId, ownerId: user._id });
  return { ok: true, active, collection: serializeCollection(updated) };
}

async function deleteCollection(db, user, body) {
  const collectionId = idOf(body.collectionId ?? body.id, "collection id");
  const now = new Date();
  const updated = await db.collection("communityCollections").findOneAndUpdate(
    { _id: collectionId, ownerId: user._id, deletedAt: { $exists: false } },
    { $set: { deletedAt: now, updatedAt: now } },
    { returnDocument: "after" }
  );
  if (!updated) fail(404, "Collection not found.", "COLLECTION_NOT_FOUND");
  return { ok: true, deleted: true };
}

function canonicalAction(value) {
  const action = clean(value, 50).toLocaleLowerCase("en-US").replace(/_/g, "-");
  const aliases = new Map([
    ["profile", "profile:update"], ["profile:update", "profile:update"], ["profile-update", "profile:update"], ["update-profile", "profile:update"],
    ["privacy", "privacy:update"], ["privacy:update", "privacy:update"], ["privacy-update", "privacy:update"], ["update-privacy", "privacy:update"],
    ["send", "friend:send"], ["friend:send", "friend:send"], ["friend-request:send", "friend:send"], ["friend-request-send", "friend:send"], ["friendrequest:send", "friend:send"], ["send-request", "friend:send"],
    ["respond", "friend:respond"], ["friend:respond", "friend:respond"], ["friend-request:respond", "friend:respond"], ["friend-request-respond", "friend:respond"], ["friendrequest:respond", "friend:respond"],
    ["cancel", "friend:cancel"], ["friend:cancel", "friend:cancel"], ["friend-request:cancel", "friend:cancel"], ["friend-request-cancel", "friend:cancel"], ["friendrequest:cancel", "friend:cancel"],
    ["remove", "friend:remove"], ["friend:remove", "friend:remove"], ["friend-request-remove", "friend:remove"], ["friendrequest:remove", "friend:remove"], ["remove-friend", "friend:remove"],
    ["follow", "relation:follow"], ["relation:follow", "relation:follow"], ["user:follow", "relation:follow"],
    ["block", "relation:block"], ["relation:block", "relation:block"], ["user:block", "relation:block"],
    ["restrict", "relation:restrict"], ["relation:restrict", "relation:restrict"], ["user:restrict", "relation:restrict"],
    ["mute", "relation:mute"], ["relation:mute", "relation:mute"], ["user:mute", "relation:mute"],
    ["snooze", "relation:snooze"], ["relation:snooze", "relation:snooze"],
    ["priority", "relation:priority"], ["relation:priority", "relation:priority"],
    ["close-friend", "relation:close-friend"], ["relation:close-friend", "relation:close-friend"],
    ["acquaintance", "relation:acquaintance"], ["relation:acquaintance", "relation:acquaintance"],
    ["page:create", "page:create"], ["pages:create", "page:create"], ["create-page", "page:create"],
    ["page:follow", "page:follow"], ["pages:follow", "page:follow"], ["follow-page", "page:follow"],
    ["page:update", "page:update"], ["pages:update", "page:update"], ["update-page", "page:update"],
    ["collection:create", "collection:create"], ["create-collection", "collection:create"],
    ["collection:item", "collection:item"], ["collection:add", "collection:item"], ["collection:remove", "collection:item"],
    ["collection:delete", "collection:delete"], ["delete-collection", "collection:delete"]
  ]);
  return aliases.get(action) || "";
}

module.exports = async function handler(req, res) {
  if (String(req.query?.service || "").toLowerCase() === "games") return gamesHandler(req, res);
  return withApi(req, res, async ({ db, body }) => {
    await ensureIndexes(db);
    const user = await currentUser(req);
    const query = req.query || {};

    if (req.method === "GET") {
      const view = clean(query.view || query.resource || query.action || "bootstrap", 30).toLocaleLowerCase("en-US");
      if (view === "bootstrap") return res.status(200).json(await getBootstrap(db, user));
      if (view === "profile") return res.status(200).json(await getProfile(db, user, query));
      if (view === "friends") return res.status(200).json(await getFriends(db, user, query));
      if (view === "saved") {
        if (!user) fail(401, "Authentication is required.", "AUTH_REQUIRED");
        const result = await loadSavedPosts(db, user, query);
        return res.status(200).json({ saved: result.items, collections: await loadCollections(db, user._id), total: result.total, page: result.page, limit: result.limit });
      }
      if (view === "activity") return res.status(200).json(await getActivity(db, user, query));
      if (view === "pages") {
        const result = await loadPages(db, user, query);
        if (result.detail && !result.pages.length) fail(404, "Page not found.", "PAGE_NOT_FOUND");
        return res.status(200).json({
          pages: result.pages,
          page: result.detail ? result.pages[0] || null : null,
          total: result.total,
          currentPage: result.page,
          limit: result.limit
        });
      }
      fail(400, "Unknown social view.", "INVALID_VIEW");
    }

    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST, OPTIONS");
      fail(405, "Method not allowed.", "METHOD_NOT_ALLOWED");
    }
    if (!user) fail(401, "Authentication is required.", "AUTH_REQUIRED");
    await enforceRateLimit(db, `social:write:${user._id}`, 150, 10 * 60 * 1000);
    const action = canonicalAction(body.action || query.action);
    if (!action) fail(400, "Unknown social action.", "INVALID_ACTION");

    if (action === "profile:update") return res.status(200).json(await updateProfile(db, user, body));
    if (action === "privacy:update") return res.status(200).json(await updatePrivacy(db, user, body));
    if (action === "friend:send") return res.status(201).json(await sendFriendRequest(db, user, body));
    if (action === "friend:respond") return res.status(200).json(await respondFriendRequest(db, user, body));
    if (action === "friend:cancel") return res.status(200).json(await cancelFriendRequest(db, user, body));
    if (action === "friend:remove") return res.status(200).json(await removeFriend(db, user, body));
    if (action === "relation:follow") return res.status(200).json(await setRelation(db, user, body, "follow"));
    if (action === "relation:block") return res.status(200).json(await setRelation(db, user, body, "block"));
    if (action === "relation:restrict") return res.status(200).json(await setRelation(db, user, body, "restrict"));
    if (action === "relation:mute") return res.status(200).json(await setRelation(db, user, body, "mute"));
    if (action === "relation:snooze") return res.status(200).json(await setRelation(db, user, body, "snooze"));
    if (action === "relation:priority") return res.status(200).json(await setRelation(db, user, body, "priority"));
    if (action === "relation:close-friend") return res.status(200).json(await setRelation(db, user, body, "close_friend"));
    if (action === "relation:acquaintance") return res.status(200).json(await setRelation(db, user, body, "acquaintance"));
    if (action === "page:create") return res.status(201).json(await createPage(db, user, body));
    if (action === "page:follow") return res.status(200).json(await followPage(db, user, body));
    if (action === "page:update") return res.status(200).json(await updatePage(db, user, body));
    if (action === "collection:create") return res.status(201).json(await createCollection(db, user, body));
    if (action === "collection:item") return res.status(200).json(await updateCollectionItem(db, user, body));
    if (action === "collection:delete") return res.status(200).json(await deleteCollection(db, user, body));
    fail(400, "Unknown social action.", "INVALID_ACTION");
  });
};
