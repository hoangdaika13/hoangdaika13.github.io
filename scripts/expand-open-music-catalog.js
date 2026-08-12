#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");

const ROOT = path.resolve(__dirname, "..");
const CATALOG_PATH = path.join(ROOT, "assets", "open-media", "curated-music-v1.json");
const REGISTRY_PATH = path.join(ROOT, "assets", "open-media", "rights-registry-v2.json");
const VERIFIED_AT = "2026-08-12";
const REPOSITORY_COMMIT = "f6bfe16f49feab2181075ab86b13b24740592aa6";
const LICENSE_BLOB_SHA = "d8d9916839d3598bb9c53160899c141295223c50";
const LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/";
const REPOSITORY_URL = "https://github.com/tannerhelland/free-music";
const LICENSE_EVIDENCE_URL = "https://github.com/tannerhelland/free-music/blob/master/LICENSE.md";

const tracks = [
  ["A Memory Away", 125.5, "9e87f558a1460f303b25d78bc9b447238f70a8d9", "Cinematic|Ambient", "HoÃ i niá»‡m|Nháº¹ nhÃ ng", "Báº¯c Má»¹", "US", "#7fdcff|#7167ff|#ff8eb5"],
  ["Assault on Mist Castle", 160.75, "146f30fcb9bdd8d1cb031669e116f5a3b5485268", "Cinematic|Fantasy", "HÃ¹ng trÃ¡ng|PhiÃªu lÆ°u", "Báº¯c Má»¹", "US", "#73e5ff|#454ac8|#ff916e"],
  ["Crossroads", 241.95, "b200ec70487b18eff394b3022a5da3d7bcf31c07", "Cinematic|Orchestral", "Suy tÆ°|HÃ nh trÃ¬nh", "Báº¯c Má»¹", "US", "#ffbe6b|#6f69ff|#5fe2c2"],
  ["Daybreak", 114.05, "383824196f822b07877547066a8975b8620956eb", "Ambient|Cinematic", "BÃ¬nh minh|Hy vá»ng", "Báº¯c Má»¹", "US", "#ffd476|#69d8ff|#a77aff"],
  ["Deeper", 257.91, "92aeb67f2b283744c99472f0a83a734e43ccb6d7", "Electronic|Ambient", "SÃ¢u láº¯ng|ÄÃªm", "Báº¯c Má»¹", "US", "#62ddff|#493caa|#e65cff"],
  ["Defiance", 164.49, "69728aa1ffe22b43b6dd8e75c6cc8770ead74d07", "Cinematic|Action", "Quyáº¿t liá»‡t|Chiáº¿n Ä‘áº¥u", "Báº¯c Má»¹", "US", "#ff6b5f|#b043ff|#52d7ff"],
  ["Deserve to be Loved", 205.48, "ce6d00a211cb05883106ca69150e0cfa4c746f7d", "Piano|Cinematic", "TÃ¬nh cáº£m|áº¤m Ã¡p", "Báº¯c Má»¹", "US", "#ff8eb7|#816cff|#ffd47a"],
  ["Faith", 306.4, "b9ad2b476b6145a758517a2e34d2444cacdd0595", "Cinematic|Orchestral", "Niá»m tin|Cáº£m xÃºc", "Báº¯c Má»¹", "US", "#6fe4ff|#6f5eff|#ffb66d"],
  ["Familiar Roads", 223.05, "9ec7e087c01ca0b4a7063b0e84085e7c03e052b5", "Acoustic|Cinematic", "ThÃ¢n quen|HÃ nh trÃ¬nh", "Báº¯c Má»¹", "US", "#ffc76f|#65d5bd|#6f77ff"],
  ["Find You", 102.68, "ba1a996c179952701b1b92ed45c75a9a87d34818", "Piano|Romantic", "TÃ¬m kiáº¿m|TÃ¬nh cáº£m", "Báº¯c Má»¹", "US", "#ff8caf|#8e6dff|#72d9ff"],
  ["From Here", 163.98, "b693f0bfef5513955e3421121039ccbc7905f122", "Cinematic|Ambient", "Khá»Ÿi Ä‘áº§u|MÆ¡ má»™ng", "Báº¯c Má»¹", "US", "#76edcf|#5576ff|#ff88bd"],
  ["Halls of Despair", 80.62, "f5d6dc559c3479ffc54e480b7557426eb0e54767", "Dark Ambient|Game", "U tá»‘i|CÄƒng tháº³ng", "Báº¯c Má»¹", "US", "#6d7a9c|#33255e|#c94a70"],
  ["Hidden Tears", 105.59, "e7957a0018aacc4ee6d53483eae5b971cddc84e3", "Piano|Ambient", "Buá»“n|SÃ¢u láº¯ng", "Báº¯c Má»¹", "US", "#7eb8df|#5e548d|#d477a7"],
  ["Home", 89.81, "ce4a2523f5676d6dcc3653b28f1788299a3898e3", "Acoustic|Piano", "BÃ¬nh yÃªn|áº¤m Ã¡p", "Báº¯c Má»¹", "US", "#ffd889|#70d5bb|#6995ff"],
  ["Honky-Tonk Villain", 59.76, "81a72f769bbdad75e1f109de6ab9f0fdfecbb145", "Honky Tonk|Comedy", "Tinh nghá»‹ch|Vui váº»", "Báº¯c Má»¹", "US", "#ffb84e|#ef6b6b|#58d6bd"],
  ["King of the Desert", 202.11, "1554e8b73c4ea50441f1a94d13a227588d155faf", "World|Cinematic", "Sa máº¡c|HÃ¹ng trÃ¡ng", "Báº¯c Má»¹", "US", "#f5a94c|#b85a33|#735cff"],
  ["Leaving Millie (live piano)", 153.37, "fccf27f0c45251a1bcfe2f0ef8ade179923076de", "Piano|Live", "Chia xa|SÃ¢u láº¯ng", "Báº¯c Má»¹", "US", "#9fd2ff|#7767c7|#ff9fbb"],
  ["Lost Islands", 94.07, "359a7cfb42adcadfc0d3831b90fe608b3d5c7adc", "Fantasy|Game", "KhÃ¡m phÃ¡|BÃ­ áº©n", "Báº¯c Má»¹", "US", "#4fdec9|#426bb9|#c768ff"],
  ["March of the Zargansk", 83.91, "06a232c7679c20de7e21cca44bd4b619d6a4d521", "March|Game", "HÃ nh quÃ¢n|Sá»­ thi", "Báº¯c Má»¹", "US", "#ff7a5c|#7446c8|#e5c164"],
  ["Nevermore", 146.42, "de5ac3bbfb3a9fbd9b30bbdd56762eacee1bc31e", "Dark Ambient|Cinematic", "Ãm áº£nh|BÃ­ áº©n", "Báº¯c Má»¹", "US", "#6e7caa|#49346e|#d24d82"],
  ["Now or Never", 85.97, "b33d0d7757ab6b7bfdb740ddf116be42629f2163", "Action|Cinematic", "Kháº©n trÆ°Æ¡ng|Quyáº¿t tÃ¢m", "Báº¯c Má»¹", "US", "#ff6f52|#efb542|#6967ff"],
  ["Ominosity", 88.33, "6567fdd48992d05553b7966c5cf4a4ced22a6e08", "Horror|Ambient", "Äiá»m bÃ¡o|CÄƒng tháº³ng", "Báº¯c Má»¹", "US", "#60768f|#38234f|#b9466e"],
  ["Purgatory's Mansion", 67.32, "8b9bd74fce82f9c3f4136f61df2e60e0f4912495", "Horror|Game", "RÃ¹ng rá»£n|BÃ­ áº©n", "Báº¯c Má»¹", "US", "#8750a2|#2c2548|#db536b"],
  ["Reign of Anarchy", 59.46, "d7aa6c172aa524f3ac09f81717e3cd55523e4568", "Action|Game", "Há»—n loáº¡n|Máº¡nh máº½", "Báº¯c Má»¹", "US", "#ff5b52|#9b3fd4|#f4bb48"],
  ["Remember", 62.59, "e3a8bf7a711295c9455d1668a84c216c4296c181", "Piano|Cinematic", "Há»“i tÆ°á»Ÿng|Dá»‹u dÃ ng", "Báº¯c Má»¹", "US", "#89c8ff|#7772c9|#ffb2bd"],
  ["Retribution", 206.71, "c266ac20861d5cc124385621ebab6cc738723208", "Epic|Cinematic", "Ká»‹ch tÃ­nh|HÃ¹ng trÃ¡ng", "Báº¯c Má»¹", "US", "#ff684f|#6f47ba|#52ccec"],
  ["Surreptitious", 73.02, "a56620247dd2b119235f744701b5e584674b2d78", "Spy|Cinematic", "LÃ©n lÃºt|Há»“i há»™p", "Báº¯c Má»¹", "US", "#78d8c4|#4a608d|#ce5c91"],
  ["Syntheticity", 204.99, "ed384a37e1a76a736daa1522d9bd2b2104590855", "Electronic|Synthwave", "TÆ°Æ¡ng lai|NÄƒng lÆ°á»£ng", "Báº¯c Má»¹", "US", "#54e9ff|#7950ff|#ff4fa7"],
  ["The Forest Awakes", 125.39, "6635a935d0090aee936f64a796bf9b92e641d283", "Fantasy|Ambient", "ThiÃªn nhiÃªn|Ká»³ áº£o", "Báº¯c Má»¹", "US", "#63d99a|#387bab|#d17bff"],
  ["The Haunting", 100.08, "1652d52041659241d8a1755a6a292f36600e3f71", "Horror|Ambient", "Ma má»‹|CÄƒng tháº³ng", "Báº¯c Má»¹", "US", "#70558e|#293149|#c84770"],
  ["The Journey (Kroc's Theme)", 112.75, "d6b5fd624a02d50889261aaab97995ccf603b0d7", "Adventure|Game", "HÃ nh trÃ¬nh|Hy vá»ng", "Báº¯c Má»¹", "US", "#6ee1bb|#5978d2|#ffa46e"],
  ["Thugs", 172.66, "f6ea0e3c5c6c6b9a7c75216e9ea66a9794c6e75d", "Action|Urban", "Máº¡nh máº½|CÄƒng tháº³ng", "Báº¯c Má»¹", "US", "#ff744e|#5e647c|#c14d9a"],
  ["Tiberian National Anthem", 53.19, "1f469ae8d48134dd70e5ffa89c93cc094a363262", "March|Orchestral", "Nghi lá»…|HÃ¹ng trÃ¡ng", "Báº¯c Má»¹", "US", "#d9b25f|#bf5c4f|#5068a7"],
  ["Unknown", 95.06, "4bb8f932c8b80a2766a85f960baaf2c02eb462dd", "Ambient|Experimental", "MÆ¡ há»“|KhÃ¡m phÃ¡", "Báº¯c Má»¹", "US", "#6ecad1|#7960b2|#d97fa6"],
  ["Wild Waters", 81.79, "c9cfb860f21b45ad8124090a9908f9ec1e1f2d28", "Adventure|Cinematic", "Biá»ƒn cáº£|PhiÃªu lÆ°u", "Báº¯c Má»¹", "US", "#4fcbef|#4164be|#60dfb2"]
];

const slug = (value) => value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const sha256 = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`;
const encodePath = (name) => encodeURIComponent(`${name}.mp3`).replace(/%2F/gi, "/");

function createTrack([title, durationSeconds, gitBlobSha1, genres, moods, region, countryCode, colors], index) {
  const fileName = `${title}.mp3`;
  const encoded = encodePath(title);
  const landingUrl = `${REPOSITORY_URL}/blob/master/mp3/${encoded}`;
  const playbackUrl = `${REPOSITORY_URL}/raw/${REPOSITORY_COMMIT}/mp3/${encoded}`;
  const attributionText = `${title} ${String.fromCodePoint(0x2014)} Tanner Helland, CC BY 4.0. Source: ${REPOSITORY_URL}.`;
  const snapshot = {
    sourceItemId: `mp3/${fileName}`,
    sourceUrl: landingUrl,
    repositoryUrl: REPOSITORY_URL,
    repositoryCommit: REPOSITORY_COMMIT,
    gitBlobSha1,
    licenseEvidenceUrl: LICENSE_EVIDENCE_URL,
    licenseEvidenceBlobSha: LICENSE_BLOB_SHA,
    creator: "Tanner Helland",
    licenseCode: "CC-BY-4.0",
    licenseUrl: LICENSE_URL,
    attributionText,
    verifiedAt: VERIFIED_AT,
    playbackUrl
  };
  const layer = {
    status: "cleared",
    rightsBasis: "cc-license",
    licenseCode: "CC-BY-4.0",
    licenseUrl: LICENSE_URL,
    attributionText,
    evidenceRef: LICENSE_EVIDENCE_URL,
    scope: "repository-wide-original-music-license"
  };
  return {
    id: `github-tanner-${slug(title)}`,
    kind: "track",
    title,
    creator: "Tanner Helland",
    album: "Free Original Music for Games and Film",
    genres: genres.split("|"),
    moods: moods.split("|"),
    region: countryCode === "US" ? "B\u1eafc M\u1ef9" : region,
    countryCode,
    culturalContext: "Nh\u1ea1c n\u1ec1n nguy\u00ean b\u1ea3n cho phim v\u00e0 tr\u00f2 ch\u01a1i; kh\u00f4ng \u0111\u1ea1i di\u1ec7n cho \u00e2m nh\u1ea1c truy\u1ec1n th\u1ed1ng c\u1ee7a m\u1ed9t qu\u1ed1c gia.",
    instrumental: true,
    durationSeconds,
    featured: index < 4,
    colors: colors.split("|"),
    source: {
      provider: "GitHub - Tanner Helland Free Music",
      landingUrl,
      itemId: `mp3/${fileName}`,
      primaryRightsRecord: true,
      rightsEvidenceUrl: LICENSE_EVIDENCE_URL,
      repositoryUrl: REPOSITORY_URL,
      repositoryCommit: REPOSITORY_COMMIT
    },
    rights: {
      licenseCode: "CC-BY-4.0",
      licenseUrl: LICENSE_URL,
      attributionText,
      verifiedAt: VERIFIED_AT,
      commercialAllowed: true,
      derivativesAllowed: true,
      reviewStatus: "published",
      rightsBasis: "cc-license",
      jurisdiction: "WORLDWIDE",
      territories: ["WORLDWIDE"],
      streamAllowed: true,
      rehostAllowed: false,
      downloadAllowed: false,
      syncAllowed: true,
      shareAlike: false,
      layers: {
        composition: { ...layer },
        performance: { ...layer },
        masterRecording: { ...layer },
        artwork: { status: "not-applicable", reason: "HH t\u1ea1o b\u00eca m\u00e0u c\u1ee5c b\u1ed9; kh\u00f4ng sao ch\u00e9p artwork t\u1eeb kho ngu\u1ed3n." }
      },
      evidence: {
        checkedAt: VERIFIED_AT,
        sourceRevision: `github:tannerhelland/free-music@${REPOSITORY_COMMIT}:mp3/${fileName}`,
        sourceAuthority: "official-project-page",
        sourceMetadataSnapshot: snapshot,
        metadataChecksum: sha256(JSON.stringify(snapshot)),
        metadataChecksumAlgorithm: "sha256",
        metadataChecksumSource: "inline-source-metadata-snapshot",
        mediaChecksumStatus: "verified-upstream",
        mediaChecksum: `sha1:${gitBlobSha1}`,
        mediaChecksumAlgorithm: "sha1",
        mediaChecksumSource: `Git object ID from GitHub Contents API at ${REPOSITORY_COMMIT}; run scripts/verify-open-music-media.js to record SHA-256 of downloaded bytes`,
        checksumScope: "remote-media-bytes"
      },
      flags: {
        sourceLicenseDeclared: true,
        primaryRightsRecord: true,
        metadataSnapshotStored: true,
        mediaChecksumAvailable: true,
        independentRightsAudit: false,
        contentIdRisk: "possible",
        userUpload: false,
        lyricsPresent: false,
        repositoryLicenseAppliesToTrack: true
      }
    },
    playback: { type: "audio", url: playbackUrl, fallbackUrl: landingUrl }
  };
}

const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
const previousById = new Map(catalog.items.map((item) => [item.id, item]));
const generated = tracks.map(createTrack).map((item) => {
  const previous = previousById.get(item.id);
  const currentEvidence = previous?.rights?.evidence;
  if (currentEvidence?.sourceRevision === item.rights.evidence.sourceRevision && currentEvidence.mediaChecksumStatus === "verified" && /^sha256:[a-f0-9]{64}$/.test(currentEvidence.mediaChecksum || "")) {
    item.rights.evidence.mediaChecksumStatus = currentEvidence.mediaChecksumStatus;
    item.rights.evidence.mediaChecksum = currentEvidence.mediaChecksum;
    item.rights.evidence.mediaChecksumAlgorithm = currentEvidence.mediaChecksumAlgorithm;
    item.rights.evidence.mediaChecksumSource = currentEvidence.mediaChecksumSource;
    item.rights.evidence.checksumScope = currentEvidence.checksumScope;
  }
  return item;
});
const generatedIds = new Set(generated.map((item) => item.id));
catalog.items = catalog.items.filter((item) => !generatedIds.has(item.id)).concat(generated);
catalog.verifiedAt = VERIFIED_AT;
catalog.sourcePolicy = "Every track must link to an official source file and rights record. Wikimedia uses an individual File page; GitHub uses only the author official repository with a fixed commit, an explicit music license and per-file byte evidence.";
catalog.sources = [
  { provider: "Wikimedia Commons", mode: "per-file-primary-rights-record", itemCount: catalog.items.filter((item) => item.source.provider === "Wikimedia Commons").length },
  { provider: "GitHub - Tanner Helland Free Music", mode: "official-author-repository-fixed-commit", repositoryUrl: REPOSITORY_URL, commit: REPOSITORY_COMMIT, licenseEvidenceUrl: LICENSE_EVIDENCE_URL, licenseCode: "CC-BY-4.0", itemCount: generated.length }
];
catalog.governance.sourceRequirements = {
  github: ["official-author-repository", "fixed-commit-playback", "repository-license-evidence", "per-file-git-blob-sha1", "commercial-and-derivative-rights"],
  blocked: ["aggregator-only-license", "unknown-author", "cover-or-remix-of-third-party-work", "NC", "ND", "Sampling", "all-rights-reserved"]
};
fs.writeFileSync(CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`);

const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8"));
registry.updatedAt = `${VERIFIED_AT}T00:00:00.000Z`;
registry.catalogSnapshot.tracks = catalog.items.length;
registry.catalogSnapshot.total = Number(registry.catalogSnapshot.films || 0) + catalog.items.length;
const githubRule = {
  provider: "GitHub",
  mode: "official-author-repository-fixed-commit-only",
  risk: "medium",
  note: "Only original tracks in the creator official repository: explicit audio license, commit-pinned playback and per-file Git blob evidence. Aggregator repositories remain discovery-only."
};
registry.sourceRules = registry.sourceRules.filter((rule) => rule.provider !== "GitHub");
registry.sourceRules.push(githubRule);
registry.catalogSources = [
  ...(Array.isArray(registry.catalogSources) ? registry.catalogSources.filter((row) => row.id !== "github-tanner-free-music") : []),
  {
    id: "github-tanner-free-music",
    provider: "GitHub",
    repository: "tannerhelland/free-music",
    repositoryUrl: REPOSITORY_URL,
    commit: REPOSITORY_COMMIT,
    licenseEvidenceUrl: LICENSE_EVIDENCE_URL,
    licenseEvidenceBlobSha: LICENSE_BLOB_SHA,
    licenseCode: "CC-BY-4.0",
    verifiedAt: VERIFIED_AT,
    tracksPublished: generated.length,
    publicationDecision: "approved-per-track",
    excludedPatterns: ["arrangement", "remix of", "cover", "third-party composition"],
    note: "License Pack must retain track title, Tanner Helland, source URL, CC BY 4.0 and a modification notice when applicable."
  }
];
fs.writeFileSync(REGISTRY_PATH, `${JSON.stringify(registry, null, 2)}\n`);

console.log(`Open music catalog: ${catalog.items.length} tracks (${generated.length} GitHub tracks generated).`);
