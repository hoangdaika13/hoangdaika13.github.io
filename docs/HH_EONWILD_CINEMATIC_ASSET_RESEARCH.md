# HH EonWild — cinematic asset research gate

Last reviewed: 2026-08-24

This document records candidates only. A link in this file is **not** permission to ship an asset. Runtime assets must first pass the repository manifest validator with an official download receipt, author, license URL, exact byte size, SHA-256, modification history and scientific review. No candidate below is marked `production`.

## Assets already admitted to the repository

The authoritative records are `assets/eonwild/asset-manifest.v1.json` and the provenance receipts it references. The current runtime contains four Poly Haven CC0 environment assets and two Quaternius CC0 animated dinosaur prototypes. The two dinosaur files remain stylized prototype/fallback assets because they do not meet the production PBR, four-LOD, animation and scientific-review gates.

## Clean candidates for a future production pass

| Candidate | Official source | Declared license | Permitted next use | Current gate |
| --- | --- | --- | --- | --- |
| Animated LowPoly Dinosaurs | https://quaternius.itch.io/animated-lowpoly-dinosaurs | CC0 | Prototype, distant LOD and animation-pipeline testing | Low-poly; incomplete production animation/PBR/LOD |
| Ultimate Animated Animal Pack | https://quaternius.com/packs/ultimateanimatedanimals.html | CC0 | Wildlife prototype and animation-pipeline testing | Low-poly and untextured; not a photoreal production asset |
| Khronos Fox | https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Fox | Model CC0; rig/animation/conversion CC-BY-4.0 | glTF rig and animation regression fixture with attribution | Only three clips; wrong species for the flagship list |
| Khronos Barramundi Fish | https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/BarramundiFish | CC0 | Static aquatic pipeline and PBR test | Static; requires a species review, rig, swim clips and web optimization |
| Smithsonian Triceratops skeleton | https://3d.si.edu/object/3d/triceratops-horridus-marsh-1889%3Ad8c623be-4ebc-11ea-b77f-2e728ce88125 | Public domain / CC0 as stated by source | Museum/Codex specimen and anatomical reference | Skeleton is not a living creature mesh |
| Smithsonian Mammoth skeleton | https://3d.si.edu/object/3d/mammuthus-primigenius-blumbach%3A341c96cd-f967-4540-8ed1-d3fc56d31f12 | Public domain / CC0 as stated by source | Museum/Codex specimen and anatomical reference | Skeleton is not a living creature mesh |
| Dryad T. rex cranial model | https://doi.org/10.5061/dryad.c75j9 | CC0-1.0 | Cranial and jaw anatomy reference | Not a full-body playable model |

Downloadable CC-BY candidates on Sketchfab may be evaluated only through the official Download API after the owner signs in. The application must retain the API receipt and original author attribution. A temporary download URL is never stored as an immutable production URL. Static candidates still need retopology, UV/PBR work, a bespoke rig, the required animation set and four verified LODs.

## Automatic rejection list

Reject an upload even when an uploader selected a permissive license if its model, description, texture names, comments or binary evidence indicate that it was extracted from The Isle, ARK, Jurassic World Evolution/JWE2, Jurassic Park/World, Primal Carnage or another commercial title. Also reject:

- fan extractions and reuploads with no original author receipt;
- a CC-BY reupload of a CC-BY-NC source;
- “personal use only” files presented under a contradictory marketplace license;
- CadNav/aggregator files with no traceable creator;
- one species relabelled as another;
- Google Images results used as a download source;
- an OAuth-protected asset obtained by bypassing authentication.

## Production promotion checklist

A creature can change from `prototype` to `production` only when all checks pass together:

1. The species identity and real scale are reviewed against a credible scientific source.
2. The original author and official source receipt match the ingested binary.
3. The license permits the intended website use and attribution is complete.
4. The GLB SHA-256, byte size, polygon count, texture inventory and processing history are recorded.
5. LOD0, LOD1, LOD2 and an impostor/distant mesh are present.
6. Albedo, normal, roughness, ambient occlusion and wetness/dirt channels are present.
7. The full required locomotion, survival, combat, injury, nesting, care-young and death animation contract is present.
8. Foot placement, animation blends and ground/water intersection pass browser QA.
9. The asset stays inside measured RAM/VRAM and frame-time budgets at 1440p and 4K.
10. The validator and production provenance receipt both approve the exact build.

Until then the UI must say `prototype`, `scientific reference`, `wildlife AI` or `catalog-only` as appropriate. It must never claim that the present low-poly models are photoreal or AAA production creatures.
