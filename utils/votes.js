const { createHmac } = require("crypto");
const { clean, enforceRateLimit, withApi } = require("./platform");

const collectionName = process.env.MONGODB_COLLECTION || "votes";
const siteId = process.env.SITE_ID || "hoangdaika13.github.io";
let indexesReady = false;

function normalize(doc) {
  const stats = doc || { likes: 0, votes: [0, 0, 0, 0, 0] };
  return {
    likes: Math.max(0, Number(stats.likes || 0)),
    votes: Array.from({ length: 5 }, (_, index) => Math.max(0, Number(stats.votes?.[index] || 0)))
  };
}

function actorHash(req) {
  const ip = clean(String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0], 80);
  const userAgent = clean(req.headers["user-agent"], 300);
  const secret = String(process.env.GATEWAY_AUDIT_SALT || process.env.JWT_SECRET || "");
  if (secret.length < 32) {
    const error = new Error("Server security configuration is incomplete");
    error.statusCode = 503;
    error.code = "SECURITY_CONFIG_MISSING";
    throw error;
  }
  return createHmac("sha256", secret).update(`votes:${siteId}\0${ip}\0${userAgent}`).digest("hex");
}

module.exports = async function votesHandler(req, res) {
  return withApi(req, res, async ({ db, body }) => {
    const collection = db.collection(collectionName);
    const actors = db.collection("voteActors");
    if (!indexesReady) {
      await Promise.all([
        collection.createIndex({ siteId: 1 }, { unique: true }),
        actors.createIndex({ siteId: 1, actorHash: 1 }, { unique: true })
      ]);
      indexesReady = true;
    }
    if (req.method === "GET") return res.status(200).json(normalize(await collection.findOne({ siteId })));
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const identity = actorHash(req);
    await enforceRateLimit(db, `votes:${siteId}:${identity}`, 60, 60 * 60 * 1000);
    const now = new Date();
    let actorUpdate;
    let nextRating = 0;
    if (body.action === "like") {
      if (typeof body.liked !== "boolean") return res.status(400).json({ error: "Invalid like state" });
      actorUpdate = { $set: { liked: body.liked, updatedAt: now }, $setOnInsert: { siteId, actorHash: identity, createdAt: now } };
    } else if (body.action === "rating") {
      nextRating = Number(body.rating);
      if (!Number.isInteger(nextRating) || nextRating < 1 || nextRating > 5) return res.status(400).json({ error: "Invalid rating" });
      actorUpdate = { $set: { rating: nextRating, updatedAt: now }, $setOnInsert: { siteId, actorHash: identity, createdAt: now } };
    } else {
      return res.status(400).json({ error: "Invalid action" });
    }

    const previous = await actors.findOneAndUpdate(
      { siteId, actorHash: identity },
      actorUpdate,
      { upsert: true, returnDocument: "before", includeResultMetadata: false }
    );
    const increments = {};
    if (body.action === "like") {
      increments.likes = Number(body.liked) - Number(Boolean(previous?.liked));
    } else {
      if (previous?.rating && previous.rating !== nextRating) increments[`votes.${previous.rating - 1}`] = -1;
      if (previous?.rating !== nextRating) increments[`votes.${nextRating - 1}`] = 1;
    }

    await collection.updateOne(
      { siteId },
      { $setOnInsert: { siteId, likes: 0, votes: [0, 0, 0, 0, 0], createdAt: now } },
      { upsert: true }
    );
    if (Object.values(increments).some(Boolean)) {
      await collection.updateOne({ siteId }, { $inc: increments, $set: { updatedAt: now } });
    }
    return res.status(200).json(normalize(await collection.findOne({ siteId })));
  });
};

module.exports.__test = Object.freeze({ actorHash, normalize });
