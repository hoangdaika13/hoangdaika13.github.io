const { MongoClient } = require("mongodb");

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "hoangdaika13_site";
const collectionName = process.env.MONGODB_COLLECTION || "votes";
const siteId = process.env.SITE_ID || "hoangdaika13.github.io";

let cachedClient;

async function getCollection() {
  if (!uri) throw new Error("Missing MONGODB_URI");
  if (!cachedClient) {
    cachedClient = new MongoClient(uri);
    await cachedClient.connect();
  }
  return cachedClient.db(dbName).collection(collectionName);
}

function normalize(doc) {
  const stats = doc || { likes: 0, votes: [0, 0, 0, 0, 0] };
  return {
    likes: Number(stats.likes || 0),
    votes: Array.from({ length: 5 }, (_, index) => Number(stats.votes?.[index] || 0))
  };
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
}

module.exports = async function votesHandler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const collection = await getCollection();
    if (req.method === "GET") return res.status(200).json(normalize(await collection.findOne({ siteId })));
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const update = { $setOnInsert: { siteId, createdAt: new Date() }, $set: { updatedAt: new Date() } };
    if (body.action === "like") {
      update.$inc = { likes: body.liked ? 1 : -1 };
    } else if (body.action === "rating") {
      const rating = Math.max(1, Math.min(5, Number(body.rating || 0)));
      const previous = Math.max(0, Math.min(5, Number(body.previous || 0)));
      update.$inc = { [`votes.${rating - 1}`]: 1 };
      if (previous && previous !== rating) update.$inc[`votes.${previous - 1}`] = -1;
    } else {
      return res.status(400).json({ error: "Invalid action" });
    }

    await collection.updateOne({ siteId }, update, { upsert: true });
    return res.status(200).json(normalize(await collection.findOne({ siteId })));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
