"use strict";

const PEPPER_CARROT_EVIDENCE_URL = "https://www.peppercarrot.com/en/about/index.html";
const PEPPER_CARROT_LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/";

/**
 * Server-owned allowlist. A catalog entry belongs here only after HH has
 * captured a first-party rights page. Repository licenses and client-supplied
 * metadata must never be promoted into this map automatically.
 */
const TRUSTED_OPEN_COMICS = Object.freeze({
  "github-open:pepper-and-carrot": Object.freeze({
    status: "allowed",
    licenseCode: "CC-BY-4.0",
    licenseVersion: "4.0",
    licenseUrl: PEPPER_CARROT_LICENSE_URL,
    sourceUrl: "https://www.peppercarrot.com/en/webcomic/index.html",
    evidenceUrl: PEPPER_CARROT_EVIDENCE_URL,
    author: "David Revoy",
    artist: "David Revoy",
    commercialUseAllowed: true,
    derivativesAllowed: true,
    redistributionAllowed: true,
    territory: "worldwide",
    attributionText: "Pepper & Carrot © David Revoy · CC BY 4.0 · https://www.peppercarrot.com",
    evidenceId: "hh-first-party:peppercarrot-about:2026-08-14",
    evidenceFile: "assets/comics/rights-evidence/pepper-carrot-2026-08-14.json",
    evidenceHash: "0bfe0530dbc113382722b8fba80bdb633fb85f48c51de7d6c9a5fadcaefcfd9e",
    evidenceCapturedAt: new Date("2026-08-14T00:00:00.000Z"),
    reviewerId: "hh-trusted-catalog-v2",
    reviewStatus: "approved",
    reviewedAt: new Date("2026-08-14T00:00:00.000Z")
  })
});

function trustedRightsForSeries(seriesId) {
  return TRUSTED_OPEN_COMICS[String(seriesId || "")] || null;
}

module.exports = { TRUSTED_OPEN_COMICS, trustedRightsForSeries };
