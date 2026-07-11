const { MongoClient, ObjectId } = require("mongodb");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "hoangdaika13_site";
const jwtSecret = process.env.JWT_SECRET || "change-this-jwt-secret";
let cachedClient;

async function database() {
  if (!uri) throw new Error("Missing MONGODB_URI");
  if (!cachedClient) {
    cachedClient = new MongoClient(uri);
    await cachedClient.connect();
  }
  return cachedClient.db(dbName);
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Cache-Control", "no-store");
}

function bodyOf(req) {
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  return req.body || {};
}

function clean(value, max = 2000) {
  return String(value || "").trim().slice(0, max);
}

function signUser(user) {
  return jwt.sign(
    { sub: String(user._id), email: user.email, name: user.name || "" },
    jwtSecret,
    { expiresIn: "30d" }
  );
}

function signOAuthState(provider, returnTo) {
  return jwt.sign(
    { type: "oauth", provider, returnTo },
    jwtSecret,
    { expiresIn: "10m" }
  );
}

function verifyOAuthState(state, provider) {
  try {
    const value = jwt.verify(String(state || ""), jwtSecret);
    return value?.type === "oauth" && value.provider === provider ? value : null;
  } catch {
    return null;
  }
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: String(user._id),
    name: user.name || "",
    email: user.email || "",
    provider: user.provider || "local",
    avatar: user.avatar || "",
    consent: Boolean(user.consent)
  };
}

async function currentUser(req) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  try {
    const payload = jwt.verify(token, jwtSecret);
    const db = await database();
    return db.collection("users").findOne({ _id: new ObjectId(payload.sub) }, { projection: { passwordHash: 0 } });
  } catch {
    return null;
  }
}

function ownerFrom(user, body = {}) {
  return user
    ? { userId: user._id, user: publicUser(user) }
    : { anonymousId: clean(body.anonymousId, 160), user: null };
}

async function withApi(req, res, handler) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  try {
    return await handler({ db: await database(), body: bodyOf(req) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

module.exports = {
  bcrypt,
  bodyOf,
  clean,
  currentUser,
  database,
  ownerFrom,
  publicUser,
  setCors,
  signOAuthState,
  signUser,
  verifyOAuthState,
  withApi
};
