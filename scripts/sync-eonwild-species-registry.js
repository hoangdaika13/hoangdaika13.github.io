#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = path.resolve(__dirname, "..");
const outputPath = path.join(root, "hh-eonwild-species-registry.js");
const API_BASE = "https://api.inaturalist.org/v1";
const USER_AGENT = "HH-EonWild-SpeciesRegistry/1.0 (+https://hoang8.com)";
const REQUEST_TIMEOUT_MS = 20000;
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
const MIN_REQUEST_INTERVAL_MS = 1000;
const GROUPS = Object.freeze([
  { id: "mammals", taxonId: 40151, count: 55, labelVi: "Động vật có vú", className: "Mammalia", biomes: ["forest", "grassland", "wetland", "tundra"], locomotion: ["walk", "run"], shelter: "hang, tổ hoặc nơi trú tự nhiên", reproduction: "live-birth" },
  { id: "birds", taxonId: 3, count: 55, labelVi: "Chim", className: "Aves", biomes: ["forest", "wetland", "coast", "grassland"], locomotion: ["fly", "walk"], shelter: "tổ", reproduction: "egg" },
  { id: "reptiles", taxonId: 26036, count: 30, labelVi: "Bò sát", className: "Reptilia", biomes: ["forest", "desert", "wetland", "coast"], locomotion: ["crawl", "walk", "swim"], shelter: "hang đất, hốc đá hoặc tổ", reproduction: "egg-or-live-birth" },
  { id: "amphibians", taxonId: 20978, count: 25, labelVi: "Lưỡng cư", className: "Amphibia", biomes: ["wetland", "river", "rainforest"], locomotion: ["amphibious", "swim"], shelter: "thảm lá, bờ nước hoặc hang ẩm", reproduction: "egg" },
  { id: "ray-finned-fishes", taxonId: 47178, count: 45, labelVi: "Cá vây tia", className: "Actinopterygii", biomes: ["river", "lake", "reef", "ocean"], locomotion: ["swim"], shelter: "rạn, thảm thực vật hoặc tầng nước", reproduction: "egg-or-live-birth" },
  { id: "molluscs", taxonId: 47115, count: 25, labelVi: "Thân mềm", className: "Mollusca", biomes: ["reef", "ocean", "wetland", "forest"], locomotion: ["crawl", "swim"], shelter: "vỏ, khe đá hoặc nền đáy", reproduction: "egg" },
  { id: "insects", taxonId: 47158, count: 40, labelVi: "Côn trùng", className: "Insecta", biomes: ["forest", "grassland", "wetland", "desert"], locomotion: ["fly", "crawl"], shelter: "tổ, kén, đất hoặc mô thực vật", reproduction: "egg" },
  { id: "arachnids", taxonId: 47119, count: 15, labelVi: "Hình nhện", className: "Arachnida", biomes: ["forest", "grassland", "desert", "cave"], locomotion: ["crawl"], shelter: "hang, mạng hoặc khe đá", reproduction: "egg-or-live-birth" },
  { id: "malacostracans", taxonId: 47187, count: 10, labelVi: "Giáp xác Malacostraca", className: "Malacostraca", biomes: ["reef", "ocean", "river", "wetland"], locomotion: ["crawl", "swim"], shelter: "hang đá, nền đáy hoặc rạn", reproduction: "egg" }
]);

if (GROUPS.reduce((sum, group) => sum + group.count, 0) !== 300) throw new Error("Registry group target must remain exactly 300");

const safeId = (value) => String(value || "species").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72) || "species";
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
let lastRequestStartedAt = 0;

async function waitForRequestSlot() {
  const remaining = MIN_REQUEST_INTERVAL_MS - (Date.now() - lastRequestStartedAt);
  if (remaining > 0) await delay(remaining);
  lastRequestStartedAt = Date.now();
}

async function readJsonBounded(response, maximumBytes = MAX_RESPONSE_BYTES) {
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > maximumBytes) throw new Error("Remote taxonomy response exceeds the bounded byte budget");
  if (!response.body || typeof response.body.getReader !== "function") {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > maximumBytes) throw new Error("Remote taxonomy response exceeds the bounded byte budget");
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = value instanceof Uint8Array ? value : new Uint8Array(value || 0);
      total += chunk.byteLength;
      if (total > maximumBytes) {
        await reader.cancel("response-too-large").catch(() => {});
        throw new Error("Remote taxonomy response exceeds the bounded byte budget");
      }
      chunks.push(chunk);
    }
  } finally {
    try { reader.releaseLock(); } catch {}
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

async function getJson(url, attempt = 0) {
  await waitForRequestSlot();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json", "User-Agent": USER_AGENT } });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await readJsonBounded(response);
  } catch (error) {
    if (attempt >= 2) throw new Error(`Taxonomy request failed: ${url} (${error.message})`);
    await delay(350 * (attempt + 1));
    return getJson(url, attempt + 1);
  } finally {
    clearTimeout(timer);
  }
}

function rankValue(taxon, rank) {
  const ancestor = (taxon.ancestors || []).find((row) => row.rank === rank);
  return ancestor?.name || (taxon.rank === rank ? taxon.name : null);
}

function vernacularStatus(taxon) {
  if (taxon.preferred_common_name && taxon.preferred_common_name !== taxon.name) return "vi-preferred";
  return "scientific-fallback-needs-vietnamese-review";
}

function normalizeSpecies(taxon, group, observationCount) {
  const scientificName = String(taxon.name || "").trim();
  const genus = rankValue(taxon, "genus") || scientificName.split(/\s+/)[0] || null;
  const vietnameseName = String(taxon.preferred_common_name || scientificName).slice(0, 140);
  const englishName = String(taxon.english_common_name || scientificName).slice(0, 140);
  const taxonUrl = `https://www.inaturalist.org/taxa/${Number(taxon.id)}`;
  return {
    id: `${safeId(scientificName)}-${Number(taxon.id)}`,
    taxonId: Number(taxon.id),
    vietnameseName,
    englishName,
    scientificName,
    vernacularStatus: vernacularStatus(taxon),
    taxonomy: {
      kingdom: rankValue(taxon, "kingdom") || "Animalia",
      phylum: rankValue(taxon, "phylum"),
      class: rankValue(taxon, "class") || group.className,
      order: rankValue(taxon, "order"),
      family: rankValue(taxon, "family"),
      genus
    },
    groupId: group.id,
    groupLabelVi: group.labelVi,
    eraRealm: "modern",
    period: "present",
    regionIds: ["modern-global"],
    biomes: group.biomes,
    diet: { profile: "species-review-required", reviewed: false },
    morphology: { massKg: null, lengthM: null, heightM: null, reviewed: false },
    lifespanYears: null,
    speedKph: null,
    locomotion: group.locomotion,
    senses: ["species-review-required"],
    activityCycle: "varies-by-population",
    reproduction: { strategy: group.reproduction, season: "varies-by-population", offspringCount: null, reviewed: false },
    social: { groupSize: null, territoriality: "species-review-required", reviewed: false },
    ecology: { predatorIds: [], preyIds: [], competitorIds: [], shelter: group.shelter, reviewed: false },
    conservation: { status: "not-reviewed", sourceUrl: taxonUrl },
    observationCount: Math.max(0, Number(observationCount) || Number(taxon.observations_count) || 0),
    scientificSources: [
      { provider: "iNaturalist Taxonomy", url: taxonUrl, apiUrl: `${API_BASE}/taxa/${Number(taxon.id)}`, retrievedAt: new Date().toISOString().slice(0, 10) }
    ],
    model: { status: "catalog-only", sourceUrl: null, author: null, license: null, sha256: null, productionApproved: false },
    tier: "catalog-only",
    simulationAllowed: false,
    qualityFlags: ["taxonomy-imported", "ecology-not-reviewed", "model-not-assigned"]
  };
}

async function loadGroup(group) {
  const countsUrl = `${API_BASE}/observations/species_counts?taxon_id=${group.taxonId}&locale=vi&per_page=${group.count}&quality_grade=research&order=desc&order_by=observations_count`;
  const counts = await getJson(countsUrl);
  const rows = Array.isArray(counts.results) ? counts.results.slice(0, group.count) : [];
  if (rows.length !== group.count) throw new Error(`${group.id} returned ${rows.length}/${group.count} species`);
  const ids = rows.map((row) => Number(row.taxon?.id)).filter(Number.isFinite);
  const detailById = new Map();
  for (let offset = 0; offset < ids.length; offset += 30) {
    const batch = ids.slice(offset, offset + 30);
    const details = await getJson(`${API_BASE}/taxa/${batch.join(",")}?locale=vi`);
    (details.results || []).forEach((taxon) => detailById.set(Number(taxon.id), taxon));
  }
  return rows.map((row) => {
    const id = Number(row.taxon?.id);
    const detail = detailById.get(id) || row.taxon;
    return normalizeSpecies(detail, group, row.count);
  });
}

function moduleSource(registry) {
  const literal = JSON.stringify(registry);
  return `(function(root,factory){"use strict";const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.HHEonWildSpeciesRegistry=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){"use strict";const REGISTRY=${literal};const freeze=(value,seen)=>{if(!value||typeof value!=="object"||Object.isFrozen(value))return value;const visited=seen||new Set();if(visited.has(value))return value;visited.add(value);Object.freeze(value);Object.values(value).forEach((item)=>freeze(item,visited));return value;};const byId=Object.fromEntries(REGISTRY.species.map((species)=>[species.id,species]));const byTaxonId=Object.fromEntries(REGISTRY.species.map((species)=>[String(species.taxonId),species]));function list(filter={}){const groupId=String(filter.groupId||"");const query=String(filter.query||"").trim().toLocaleLowerCase("vi").slice(0,120);const limit=Math.min(500,Math.max(1,Number(filter.limit)||500));return REGISTRY.species.filter((species)=>(!groupId||species.groupId===groupId)&&(!query||[species.vietnameseName,species.englishName,species.scientificName,species.taxonomy.family,species.taxonomy.order].some((value)=>String(value||"").toLocaleLowerCase("vi").includes(query)))).slice(0,limit);}function validate(){const errors=[];const ids=new Set(),names=new Set(),taxa=new Set();if(REGISTRY.species.length<300||REGISTRY.species.length>REGISTRY.maximumSpecies)errors.push("Registry count is outside 300..maximumSpecies");REGISTRY.species.forEach((species)=>{if(ids.has(species.id))errors.push("Duplicate id: "+species.id);if(names.has(species.scientificName))errors.push("Duplicate scientific name: "+species.scientificName);if(taxa.has(species.taxonId))errors.push("Duplicate taxon id: "+species.taxonId);ids.add(species.id);names.add(species.scientificName);taxa.add(species.taxonId);if(species.taxonomy.kingdom!=="Animalia")errors.push("Non-animal taxon: "+species.id);if(species.tier!=="catalog-only"||species.simulationAllowed!==false||species.model.productionApproved!==false)errors.push("Unreviewed import was promoted: "+species.id);if(!species.scientificSources.length)errors.push("Missing source: "+species.id);});return freeze({valid:errors.length===0,errors:errors.slice(0,128),count:REGISTRY.species.length});}const api={...REGISTRY,SPECIES:REGISTRY.species,SPECIES_BY_ID:freeze(byId),SPECIES_BY_TAXON_ID:freeze(byTaxonId),list,getById:(id)=>byId[String(id)]||null,getByTaxonId:(id)=>byTaxonId[String(id)]||null,validate};api.VALIDATION=validate();return freeze(api);});\n`;
}

async function main() {
  const species = [];
  for (const group of GROUPS) {
    process.stdout.write(`Fetching ${group.id} (${group.count})... `);
    const rows = await loadGroup(group);
    species.push(...rows);
    process.stdout.write("done\n");
  }
  const ids = new Set(species.map((row) => row.id));
  const names = new Set(species.map((row) => row.scientificName));
  const taxonIds = new Set(species.map((row) => row.taxonId));
  if (species.length !== 300 || ids.size !== 300 || names.size !== 300 || taxonIds.size !== 300) throw new Error("Generated species are not exactly 300 unique taxa");
  const speciesSha256 = crypto.createHash("sha256").update(JSON.stringify(species)).digest("hex");
  const registry = {
    format: "hh-eonwild-species-registry-v1",
    version: 1,
    generatedAt: new Date().toISOString(),
    targetSpecies: 400,
    minimumSpecies: 300,
    maximumSpecies: 500,
    source: {
      provider: "iNaturalist public API",
      apiBase: API_BASE,
      termsUrl: "https://www.inaturalist.org/pages/terms",
      recommendedPracticesUrl: "https://www.inaturalist.org/pages/api+recommended+practices",
      method: "top research-grade observed species per animal taxonomic group; taxonomy and aggregate observation count only; no remote media or model",
      runtimeAssetsImported: false
    },
    policy: {
      animalOnly: true,
      importedTaxaDefaultTier: "catalog-only",
      importedTaxaSimulationAllowed: false,
      unknownModelLicenseAllowed: false,
      ecologyRequiresManualReview: true,
      vietnameseFallbackMustBeLabelled: true
    },
    groups: GROUPS.map(({ taxonId, count, id, labelVi, className }) => ({ id, taxonId, count, labelVi, className })),
    speciesSha256,
    species
  };
  fs.writeFileSync(outputPath, moduleSource(registry), "utf8");
  console.log(`Wrote ${path.relative(root, outputPath)} with ${species.length} animal taxa (${speciesSha256})`);
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
