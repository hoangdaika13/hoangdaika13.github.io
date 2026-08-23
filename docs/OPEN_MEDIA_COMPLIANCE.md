# HH Open Media compliance runbook

This runbook governs every film, recording, subtitle, poster, and downloadable
asset published by the Cinema and Music workspaces. It is an operational risk
control, not a promise that a claim can never be filed and not legal advice.

## Default decision

Content is unavailable until the rights registry marks it `published`. Discovery
metadata is never permission to stream, rehost, download, edit, or synchronize a
work with video.

The automatic allowlist is intentionally narrow:

- `CC0-1.0`
- `CC-BY-2.5`, `CC-BY-3.0`, `CC-BY-4.0`
- `CC-BY-SA-3.0`, `CC-BY-SA-4.0`

The exact license code must match its canonical Creative Commons URL. Licenses
containing NC, ND, Sampling, unknown terms, “educational use only”, “royalty
free”, or “all rights reserved” are rejected. PDM, government works, NASA media,
and custom permissions always require human review and a territorial decision.

## Required rights layers

Films require separate clearance for the master, soundtrack, poster/stills,
subtitles/dubs, and privacy/publicity issues. Music requires separate clearance
for the composition, performance, master recording, and artwork. Every required
layer must be `cleared` or `not-applicable`; `manual-review` and `blocked` prevent
publication.

## Evidence

Every approval revision preserves:

- canonical source and license URLs;
- creator, source item ID, upstream revision, and retrieval time;
- exact attribution and a description of changes;
- commercial, derivative, stream, rehost, download, synchronization, and
  ShareAlike flags;
- territories and jurisdiction basis;
- source snapshot metadata, a SHA-256 value for that metadata, and a truthful
  upstream media fingerprint when one exists;
- reviewer identity, decision, and decision time.

Evidence is append-only. A newer review creates a new revision rather than
overwriting the prior record.

`metadataChecksum` is SHA-256 of the exact normalized metadata snapshot stored
with that revision. It must never be a hash invented from a playback URL. For
media bytes, preserve the upstream fingerprint exactly as published:

- `mediaChecksumStatus`: `verified-upstream` or `unavailable`;
- `mediaChecksum`: `sha1:<40 hex>` or `sha256:<64 hex>` only when it is a real
  fingerprint for the exact scope being served;
- `mediaChecksumAlgorithm`, `mediaChecksumSource`, and `mediaChecksumScope`
  record the algorithm, provenance, and whether the hash covers an original,
  transcode, remote stream, or rehosted file;
- when no exact fingerprint exists, use `mediaChecksumStatus: unavailable`, set
  checksum and algorithm to `null`, record a specific reason, and keep
  `rehostAllowed` and `downloadAllowed` false. This exception also requires an
  official primary rights record or a recorded human approval.

## Publication workflow

`discovered -> quarantine -> evidence captured -> automatic validation -> human
review -> approved -> published`

High-risk sources, PDM, government works, special guidelines, territorial
restrictions, and ShareAlike adaptations require a second review. The importer
must not approve their own high-risk item.

The public player must always expose Title, Author, Source, License, territory,
verification date, and changes. Downloads and creator exports include
`CREDITS.txt` and `LICENSES.json`. Do not describe content as “copyright free”.
Use “public domain” or “open licensed”, followed by the exact rights basis.

Availability is computed per request. `validateGovernanceItem` must pass for the
trusted viewer territory, the item status must be `published`, and MongoDB must
not contain an active `openMediaRestrictions` block. The viewer country comes
from Vercel's trusted country header. A missing header is treated as
`WORLDWIDE`, making territory-only records fail closed. Rights responses are
private/no-store so one territory cannot receive another territory's result.

## Revalidation

- Check playback availability and asset integrity at least weekly.
- Re-check source, creator, license, and revision every 30 days.
- Re-check PDM, government, NASA, and territorial items before a release and at
  least every 14 days.
- Immediately re-check after an upstream deletion, metadata change, complaint,
  or Content ID claim.

A missing source, license downgrade, creator mismatch, blocked layer, expired
permission, or territory mismatch changes the item to `suspended`, removes it
from the public catalog, and purges public delivery copies. Evidence remains
preserved under legal hold.

## Complaint response

1. Create an immutable case record and acknowledge receipt.
2. Change the affected publication to `taken_down` or `suspended` and disable
   playback promptly.
3. Preserve the source, evidence revisions, access logs needed for the case, and
   the exact public page that was reported.
4. Notify the responsible reviewer and obtain legal review when ownership,
   territory, privacy/publicity, trademark, or counter-notice issues exist.
5. Never restore automatically. Restoration requires a recorded decision and a
   new publication revision.

The public form posts only to same-origin `/api/open-media/notices`. A valid
notice is rate-limited and stored in MongoDB before the server optionally calls
Resend. `RESEND_API_KEY` remains server-only. Missing or failed email delivery
does not discard the case. The public contact is `nhhoang130803@gmail.com` and
may be overridden server-side with `COPYRIGHT_EMAIL`.

When an administrator moves a notice to `suspended`, its reported item ID is
upserted into `openMediaRestrictions` and public playback is blocked. Resolving
a notice does not unblock the item. Restoration is a separate administrator
action that requires a written decision and an HTTPS evidence URL; its audit
history is retained.

Content ID disputes are also reviewed by a person. A license dossier may support
a dispute, but attribution, lack of monetization, or “public domain” text alone
is not proof of rights.

## Source rules

- Wikimedia Commons: verify the individual file page; do not rely on category
  membership alone.
- GitHub: a repository license for source code does not automatically license
  audio. Accept only an official creator repository that explicitly applies an
  allowlisted Creative Commons license to its original music. Pin playback to a
  reviewed commit, store the license blob/revision and a per-file Git blob ID,
  then hash the downloaded bytes. Exclude covers, arrangements, remixes, and
  any track whose underlying composition may belong to somebody else. Dataset
  and aggregator repositories are discovery-only.
- Blender Open Movies: verify the official film page and retain the full credit
  roll when distributing the complete film.
- Library of Congress, NARA, and other U.S. government collections: record the
  territorial basis; U.S. public-domain status is not automatically worldwide.
- NASA: publish only as factual/informational media, acknowledge NASA, exclude
  marked third-party material, and do not imply endorsement.
- Internet Archive, Openverse, DPLA, and generic aggregators: discovery only
  unless an independent primary source proves the rights.
- ccMixter: accept only exact allowlisted licenses and preserve TASL.
- FMA and Musopen: curated/manual intake only.
- Jamendo and other commercial catalogs: disabled until a written agreement
  explicitly covers the HH website use case.

The current GitHub intake is `tannerhelland/free-music` at commit
`f6bfe16f49feab2181075ab86b13b24740592aa6`. Its author states that the music is
original and released under CC BY 4.0. HH publishes only the reviewed original
titles in its manifest and keeps direct TASL attribution. Run
`node scripts/verify-open-music-media.js` during revalidation; use `--write`
only after separately confirming that the pinned source and rights evidence
remain valid.

The runtime also loads the separately versioned expansion manifests
`curated-music-expansion-v1.json` and `curated-films-expansion-v1.json`. They are
merged with the base catalogs only after the same rights gate succeeds; an
unavailable expansion never hides the base catalog. Rebuild a reviewed batch
with `node scripts/generate-open-media-expansion.mjs`, inspect the generated
evidence, then run the full media test suite before publishing.

## Production checklist

- Rights registry validation passes.
- All rights layers are cleared.
- Territory is eligible for the viewer.
- Attribution renders correctly in the card, player, fullscreen rights panel,
  and exports.
- No third-party artwork, subtitle, lyrics, audio, or recognizable-person issue
  remains unresolved.
- Source and playback health checks pass.
- Copyright contact, complaint form, and emergency suspension path work.
- A qualified intellectual-property lawyer reviews the policy before enabling
  user uploads, advertising, subscriptions, or large-scale rehosting.
