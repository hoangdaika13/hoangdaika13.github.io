/*
 * Build the small, separately versioned open-media expansion manifests.
 *
 * This script is intentionally kept out of the runtime.  It resolves source
 * metadata, pins the upstream revision, computes media/evidence hashes, and
 * writes manifests that the browser can consume fail-closed.  Run it from the
 * repository root with network access when curating another batch.
 */
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "assets", "open-media");
const TODAY = new Date().toISOString().slice(0, 10);
const TANNER_COMMIT = "f6bfe16f49feab2181075ab86b13b24740592aa6";
const LICENSE = "https://creativecommons.org/licenses/by/4.0/";
const TANNER_LICENSE = `https://github.com/tannerhelland/free-music/blob/${TANNER_COMMIT}/LICENSE.md`;

const musicSeeds = [
  ["github-tanner-clowns", "Clowns", "Clowns.mp3", ["Cinematic", "Playful"], ["Vui tươi", "Tinh nghịch"], ["#ff74c8", "#8b7bff", "#63eaff"]],
  ["github-tanner-cyarons-gate", "Cyaron's Gate", "Cyaron's Gate.mp3", ["Cinematic", "Fantasy"], ["Hùng tráng", "Phiêu lưu"], ["#63eaff", "#746bff", "#ffcc70"]],
  ["github-tanner-dark-knight", "Dark Knight", "Dark Knight.mp3", ["Cinematic", "Dark Ambient"], ["Bí ẩn", "Kịch tính"], ["#6d78ff", "#2ee7d4", "#ff5e9c"]],
  ["github-tanner-destiny", "Destiny", "Destiny.mp3", ["Cinematic", "Orchestral"], ["Hy vọng", "Truyền cảm"], ["#ffcc70", "#ff77b7", "#6df3d0"]],
  ["github-tanner-fate", "Fate", "Fate.mp3", ["Cinematic", "Piano"], ["Suy tư", "Điện ảnh"], ["#7ed8ff", "#9575ff", "#ff82b5"]]
];

const filmSeeds = [
  {
    id: "commons-hands-short-film", title: "Hands", creator: "Ramin Mazur", year: 2009,
    file: "Hands short film.webm", licenseCode: "CC-BY-3.0", licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
    genres: ["Phim ngắn", "Tâm lý"], countries: ["Moldova"], regions: ["Châu Âu"], languages: ["Không lời"],
    description: "Một trải nghiệm điện ảnh ngắn, tối giản và giàu chất quan sát về đôi bàn tay.", contentType: "Phim ngắn thử nghiệm", ageRating: "Mọi lứa tuổi"
  },
  {
    id: "commons-afternoon-class", title: "Afternoon Class", creator: "Osro", year: 2014,
    file: "Afternoon Class - Animation Short Film (2014).webm", licenseCode: "CC-BY-3.0", licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
    genres: ["Hoạt hình", "Hài"], countries: ["Hàn Quốc"], regions: ["Châu Á"], languages: ["Không lời"],
    description: "Một học sinh cố chống lại cơn buồn ngủ trong tiết học buổi chiều.", contentType: "Phim ngắn hoạt hình", ageRating: "Mọi lứa tuổi"
  },
  {
    id: "commons-zombie-claymation", title: "A Zombie Claymation", creator: "WillandWill", year: 2017,
    file: "A Zombie claymation (short stop motion film).webm", licenseCode: "CC-BY-3.0", licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
    genres: ["Hoạt hình", "Phiêu lưu"], countries: ["Hoa Kỳ"], regions: ["Bắc Mỹ"], languages: ["Tiếng Anh"],
    description: "Phim stop-motion ngắn về cuộc đối đầu kỳ ảo giữa hai cha con và lũ zombie.", contentType: "Phim ngắn stop-motion", ageRating: "13+"
  },
  {
    id: "commons-drama-film-pendek", title: "Drama Film Pendek", creator: "Ahmad Rizaldi", year: 2018,
    file: "Drama Film Pendek (2018).webm", licenseCode: "CC-BY-SA-4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    genres: ["Chính kịch", "Phim ngắn"], countries: ["Indonesia"], regions: ["Đông Nam Á"], languages: ["Tiếng Indonesia"],
    description: "Một phim ngắn độc lập bằng tiếng Indonesia, được phát hành với giấy phép chia sẻ tương tự.", contentType: "Phim ngắn độc lập", ageRating: "Mọi lứa tuổi"
  },
  {
    id: "commons-raya-film-pendek", title: "Raya", creator: "Abno Creative", year: 2025,
    file: "Raya - Film Pendek Lebaran (2025).webm", licenseCode: "CC-BY-4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    genres: ["Chính kịch", "Gia đình"], countries: ["Indonesia"], regions: ["Đông Nam Á"], languages: ["Tiếng Indonesia"],
    description: "Câu chuyện gia đình về lòng biết ơn, sự bền bỉ và niềm vui giản dị trong dịp Lebaran.", contentType: "Phim ngắn gia đình", ageRating: "Mọi lứa tuổi"
  },
  {
    id: "commons-knowledge-for-everyone", title: "Knowledge for Everyone", creator: "Wikimedia Foundation", year: 2011,
    file: "Knowledge for Everyone (short cut).webm", licenseCode: "CC-BY-SA-3.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
    genres: ["Tài liệu", "Giáo dục"], countries: ["Nam Phi"], regions: ["Châu Phi"], languages: ["Tiếng Anh"],
    description: "Phim tài liệu ngắn về quyền tiếp cận tri thức và Wikipedia cho cộng đồng.", contentType: "Phim tài liệu", ageRating: "Mọi lứa tuổi"
  }
];

const sha256 = (value) => `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;
const jsonHash = (value) => sha256(JSON.stringify(value));
const isoFile = (value) => encodeURIComponent(value).replace(/%2F/g, "/");
const ccLayer = (code, url, attribution, evidenceRef) => ({ status: "cleared", rightsBasis: "cc-license", licenseCode: code, licenseUrl: url, attributionText: attribution, evidenceRef });
const naLayer = (reason) => ({ status: "not-applicable", reason });

async function fetchJson(url) {
  const response = await fetch(url, { headers: { "User-Agent": "HH-Open-Media-Curator/1.0", Accept: "application/json" } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

async function buildMusic() {
  const template = (await fs.readFile(path.join(OUT_DIR, "curated-music-v1.json"), "utf8"));
  const base = JSON.parse(template).items.find((item) => item.id === "github-tanner-a-memory-away");
  const treePayload = await fetchJson(`https://api.github.com/repos/tannerhelland/free-music/git/trees/${TANNER_COMMIT}?recursive=1`);
  const blobByPath = new Map((treePayload?.tree || []).map((entry) => [String(entry.path || ""), String(entry.sha || "")]));
  const rows = [];
  for (const [id, title, filename, genres, moods, colors] of musicSeeds) {
    const encoded = isoFile(filename);
    const rawUrl = `https://github.com/tannerhelland/free-music/raw/${TANNER_COMMIT}/mp3/${encoded}`;
    const landingUrl = `https://github.com/tannerhelland/free-music/blob/${TANNER_COMMIT}/mp3/${encoded}`;
    const bytes = Buffer.from(await (await fetch(rawUrl)).arrayBuffer());
    const mediaHash = sha256(bytes).toLowerCase();
    const probe = execFileSync("C:\\ffmpe\\ffmpeg-8.1.1-essentials_build\\bin\\ffprobe.exe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", rawUrl], { encoding: "utf8" });
    const durationSeconds = Math.round(Number(probe.trim()) * 1000) / 1000;
    const attributionText = `${title} — Tanner Helland, CC BY 4.0. Source: https://github.com/tannerhelland/free-music.`;
    const snapshot = {
      sourceItemId: `mp3/${filename}`, sourceUrl: landingUrl, repositoryUrl: "https://github.com/tannerhelland/free-music", repositoryCommit: TANNER_COMMIT,
      gitBlobSha1: blobByPath.get(`mp3/${filename}`) || "", licenseEvidenceUrl: TANNER_LICENSE, creator: "Tanner Helland", licenseCode: "CC-BY-4.0", licenseUrl: LICENSE,
      attributionText, verifiedAt: TODAY, playbackUrl: rawUrl
    };
    const metadataRecord = JSON.stringify(snapshot);
    const rights = JSON.parse(JSON.stringify(base.rights));
    rights.attributionText = attributionText;
    rights.verifiedAt = TODAY;
    rights.layers = Object.fromEntries(Object.entries(rights.layers).map(([key, layer]) => [key, layer.status === "not-applicable" ? layer : { ...layer, attributionText, evidenceRef: TANNER_LICENSE }]));
    rights.evidence = {
      checkedAt: TODAY, sourceRevision: `github:tannerhelland/free-music@${TANNER_COMMIT}:mp3/${filename}`, sourceAuthority: "official-project-page",
      sourceMetadataSnapshot: snapshot, metadataChecksum: jsonHash(snapshot), metadataChecksumAlgorithm: "sha256", metadataChecksumSource: "inline-source-metadata-snapshot",
      mediaChecksumStatus: "verified", mediaChecksum: mediaHash, mediaChecksumAlgorithm: "sha256", mediaChecksumSource: `Downloaded pinned GitHub raw bytes at ${TANNER_COMMIT}; ${filename}`, checksumScope: "remote-media-bytes"
    };
    rows.push({ id, kind: "track", collection: "HH Expansion · 2026", title, creator: "Tanner Helland", album: "Free Original Music for Games and Film", genres, moods, region: "Bắc Mỹ", countryCode: "US", culturalContext: "Nhạc nền nguyên bản cho phim và trò chơi; không đại diện cho âm nhạc truyền thống của một quốc gia.", instrumental: true, durationSeconds, featured: false, colors,
      source: { provider: "GitHub - Tanner Helland Free Music", landingUrl, itemId: `mp3/${filename}`, primaryRightsRecord: true, rightsEvidenceUrl: TANNER_LICENSE, repositoryUrl: "https://github.com/tannerhelland/free-music", repositoryCommit: TANNER_COMMIT },
      rights, playback: { type: "audio", url: rawUrl, fallbackUrl: landingUrl } });
  }
  return { manifestVersion: 1, title: "HH Open Music — Expansion Pack", description: "Bổ sung các bản nguyên bản đã ghim revision và kiểm tra quyền.", verifiedAt: TODAY, sourcePolicy: "Pinned official repository records only.", governance: { defaultDeny: true, requiredLayers: ["composition", "performance", "masterRecording", "artwork"] }, items: rows };
}

async function buildFilms() {
  const rows = [];
  for (const seed of filmSeeds) {
    const title = `File:${seed.file}`;
    const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=info|imageinfo&iiprop=url|size|mime|extmetadata|sha1|duration&iiurlwidth=960&titles=${encodeURIComponent(title)}`;
    const payload = await fetchJson(apiUrl);
    const page = Object.values(payload?.query?.pages || {})[0];
    const info = page?.imageinfo?.[0];
    if (!info?.url || !info.sha1) throw new Error(`Thiếu imageinfo cho ${seed.file}`);
    const landingUrl = `https://commons.wikimedia.org/wiki/${encodeURIComponent(title).replace(/%3A/g, ":")}`;
    const playbackUrl = String(info.url).split("?")[0];
    const posterUrl = String(info.thumburl || `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(seed.file)}?width=960`).split("?")[0];
    const attributionText = `${seed.title} — ${seed.creator}, ${seed.licenseCode}; nguồn Wikimedia Commons.`;
    const metadataRecord = `id=${seed.id}\ntitle=${seed.title}\ncreator=${seed.creator}\nsource=${landingUrl}\nsha1=${info.sha1}\nlicense=${seed.licenseCode}\ncheckedAt=${TODAY}`;
    const rightsEvidenceUrl = landingUrl;
    const layers = {
      master: ccLayer(seed.licenseCode, seed.licenseUrl, attributionText, rightsEvidenceUrl),
      soundtrack: ccLayer(seed.licenseCode, seed.licenseUrl, attributionText, rightsEvidenceUrl),
      poster: ccLayer(seed.licenseCode, seed.licenseUrl, attributionText, rightsEvidenceUrl),
      subtitles: naLayer("Không lưu trữ hoặc cung cấp tệp phụ đề riêng."),
      privacyPublicity: naLayer("Không sử dụng hình ảnh quảng cáo riêng ngoài tác phẩm được cấp phép.")
    };
    rows.push({ ...seed, kind: "film", collection: "HH Expansion · 2026", durationSeconds: Number(info.duration) || 0, sensitiveContent: false, contentWarnings: [], poster: posterUrl, source: { provider: "Wikimedia Commons", itemId: title, landingUrl, rightsEvidenceUrl, playbackMirror: "Wikimedia Commons" }, rights: {
      reviewStatus: "published", rightsBasis: "cc-license", licenseCode: seed.licenseCode, licenseUrl: seed.licenseUrl, attributionText, verifiedAt: TODAY, jurisdiction: `Creative Commons ${seed.licenseCode}`, territories: ["WORLDWIDE"], commercialAllowed: true, derivativesAllowed: true, streamAllowed: true, rehostAllowed: false, downloadAllowed: false, shareAlike: seed.licenseCode.startsWith("CC-BY-SA-"), changesMade: false, changesDescription: "Không chỉnh sửa nội dung; phát trực tiếp bản chuyển mã do Wikimedia Commons cung cấp.", evidence: { sourceRevision: `${landingUrl}#oldid:${page.lastrevid || "current"}`, checkedAt: TODAY, metadataRecord, metadataChecksum: sha256(metadataRecord), metadataChecksumAlgorithm: "SHA-256", metadataChecksumScope: "embedded-evidence-record", mediaChecksum: `sha1:${info.sha1}`, mediaChecksumStatus: "verified-upstream", mediaChecksumAlgorithm: "sha1", mediaChecksumSource: "Wikimedia Commons structured data", checksumScope: "original-file" }, layers
    }, playback: { type: "video", url: playbackUrl, mimeType: info.mime || "video/webm", delivery: "remote-direct" } });
  }
  return { schemaVersion: 1, catalogId: "hh.open-media.films.expansion.v1", updatedAt: `${TODAY}T00:00:00.000Z`, servingTerritory: "WORLDWIDE", policy: { mode: "fail-closed", requiredTerritory: "WORLDWIDE", publishedStatuses: ["published"], publishedLicenses: ["CC-BY-3.0", "CC-BY-4.0", "CC-BY-SA-3.0", "CC-BY-SA-4.0"] }, items: rows, quarantineItems: [] };
}

await fs.mkdir(OUT_DIR, { recursive: true });
await fs.writeFile(path.join(OUT_DIR, "curated-music-expansion-v1.json"), `${JSON.stringify(await buildMusic(), null, 2)}\n`, "utf8");
await fs.writeFile(path.join(OUT_DIR, "curated-films-expansion-v1.json"), `${JSON.stringify(await buildFilms(), null, 2)}\n`, "utf8");
console.log("Built open-media expansion manifests.");
