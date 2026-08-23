const registry = require("../../assets/open-media/rights-registry-v2.json");
const films = require("../../assets/open-media/curated-films-v1.json");
const music = require("../../assets/open-media/curated-music-v1.json");
const filmExpansion = require("../../assets/open-media/curated-films-expansion-v1.json");
const musicExpansion = require("../../assets/open-media/curated-music-expansion-v1.json");
const rightsEngine = require("../open-media-rights");
const { clean, withApi } = require("../platform");

const catalog = Object.freeze([...(films.items || []), ...(filmExpansion.items || []), ...(music.items || []), ...(musicExpansion.items || [])]);
const quarantined = new Map((registry.quarantineItems || []).map((item) => [String(item.id), item]));
const PUBLICATION_TERRITORY = "WORLDWIDE";

function viewerTerritory(req) {
  const country = clean(req.headers?.["x-vercel-ip-country"], 8).toUpperCase();
  return /^[A-Z]{2}$/.test(country) ? country : "WORLDWIDE";
}

function publicCatalogRecord(item, options = {}) {
  const viewerTerritory = options.territory || "WORLDWIDE";
  const assessment = rightsEngine.validateGovernanceItem(item, { requiredTerritory: PUBLICATION_TERRITORY });
  const quarantine = quarantined.get(String(item?.id || ""));
  const restriction = options.restriction || null;
  const blocked = Boolean(restriction?.blocked);
  const available = Boolean(assessment.publiclyAvailable && !quarantine && !blocked);
  return {
    id: clean(item?.id, 160),
    kind: item?.kind === "track" ? "track" : "film",
    title: clean(item?.title, 300),
    creator: clean(item?.creator, 300),
    source: {
      provider: clean(item?.source?.provider, 160),
      landingUrl: rightsEngine.isSafeHttpsUrl(item?.source?.landingUrl) ? item.source.landingUrl : ""
    },
    license: {
      code: assessment.licenseCode,
      url: rightsEngine.isSafeHttpsUrl(item?.rights?.licenseUrl) ? item.rights.licenseUrl : "",
      attributionText: clean(item?.rights?.attributionText, 1200),
      verifiedAt: clean(item?.rights?.verifiedAt, 20)
    },
    reviewStatus: blocked ? "suspended" : quarantine ? "quarantine" : assessment.status || "quarantine",
    available,
    territoryEligible: !assessment.errors.includes("territory-not-cleared"),
    publicationTerritory: PUBLICATION_TERRITORY,
    viewerTerritory,
    restriction: blocked ? {
      blocked: true,
      reasonCode: clean(restriction.reasonCode || "rights-notice", 80),
      blockedAt: restriction.blockedAt || restriction.updatedAt || null
    } : null,
    quarantine: quarantine ? {
      reasonCode: quarantine.reasonCode,
      reason: quarantine.reason,
      action: quarantine.action,
      territories: quarantine.territories
    } : null,
    evidence: rightsEngine.publicRightsRecord(item, { requiredTerritory: PUBLICATION_TERRITORY }).evidence,
    validationErrors: available ? [] : assessment.errors
  };
}

function summary(options = {}) {
  const restrictions = options.restrictions || new Map();
  const territory = options.territory || "WORLDWIDE";
  const records = catalog.map((item) => publicCatalogRecord(item, { territory, restriction: restrictions.get(String(item.id)) }));
  const catalogIds = new Set(records.map((item) => item.id));
  const detachedQuarantine = (registry.quarantineItems || []).filter((item) => !catalogIds.has(String(item.id)));
  const quarantineRecords = detachedQuarantine.map((item) => ({
    id: clean(item.id, 160),
    kind: item.kind === "track" ? "track" : "film",
    title: clean(item.title || item.id, 300),
    creator: "",
    source: { provider: clean(item.rightsBasis, 160), landingUrl: rightsEngine.isSafeHttpsUrl(item.sourceUrl) ? item.sourceUrl : "" },
    license: { code: "", url: "", attributionText: "", verifiedAt: "" },
    reviewStatus: "quarantine",
    available: false,
    territoryEligible: false,
    viewerTerritory: territory,
    publicationTerritory: PUBLICATION_TERRITORY,
    restriction: null,
    quarantine: {
      reasonCode: clean(item.reasonCode, 80),
      reason: clean(item.reason, 1200),
      action: clean(item.action, 1200),
      territories: Array.isArray(item.territories) ? item.territories.map((entry) => clean(entry, 20)) : []
    },
    evidence: null,
    validationErrors: ["quarantined-before-publication"]
  }));
  const allRecords = [...records, ...quarantineRecords];
  return {
    schemaVersion: registry.schemaVersion,
    registryId: registry.registryId,
    updatedAt: registry.updatedAt,
    legalNotice: registry.legalNotice,
    publicContact: registry.publicContact,
    viewerTerritory: territory,
    publicationTerritory: PUBLICATION_TERRITORY,
    counts: {
      total: allRecords.length,
      films: allRecords.filter((item) => item.kind === "film").length,
      tracks: allRecords.filter((item) => item.kind === "track").length,
      available: records.filter((item) => item.available).length,
      quarantine: allRecords.filter((item) => item.reviewStatus === "quarantine").length,
      review: records.filter((item) => item.reviewStatus === "review").length,
      suspended: records.filter((item) => item.reviewStatus === "suspended").length
    },
    policy: registry.policy,
    sourceRules: registry.sourceRules,
    complaints: registry.complaints,
    quarantineItems: registry.quarantineItems,
    items: allRecords
  };
}

module.exports = async function handler(req, res) {
  return withApi(req, res, async ({ db }) => {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
    const id = clean(req.query?.id, 160);
    const territory = viewerTerritory(req);
    const ids = id ? [id] : catalog.map((item) => String(item.id));
    const rows = await db.collection("openMediaRestrictions").find({ itemId: { $in: ids }, blocked: true }).toArray();
    const restrictions = new Map(rows.map((row) => [String(row.itemId), row]));
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("Vary", "Origin, Cookie, X-Vercel-IP-Country");
    if (id) {
      const item = catalog.find((entry) => String(entry.id) === id);
      if (!item) return res.status(404).json({ error: "Không tìm thấy hồ sơ quyền của nội dung." });
      return res.status(200).json({
        viewerTerritory: territory,
        item: publicCatalogRecord(item, { territory, restriction: restrictions.get(id) }),
        legalNotice: registry.legalNotice
      });
    }
    return res.status(200).json(summary({ territory, restrictions }));
  });
};

module.exports.__test = Object.freeze({ PUBLICATION_TERRITORY, viewerTerritory, publicCatalogRecord, summary });
