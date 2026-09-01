# HH Galaxy function portal artwork

This directory contains project-local raster artwork generated for the eleven
Layer One function portals. Labels and UI controls remain HTML/CSS so the
artwork contains no embedded interface text.

Visual contract:

- cinematic 16:9 cosmic portal composition;
- deep navy space, violet/cyan light, restrained gold accents;
- no people, brand marks, readable text, UI chrome, or watermarks;
- each file represents one distinct function and is safe to crop responsively.

## Final selection

| Function | Final asset | Visual subject |
| --- | --- | --- |
| AI Universe | `ai-universe-v1.png` | Neural constellation brain-orb |
| Music Planet | `music-planet-v1.png` | Musical planet and orbital sound waves |
| Video Planet | `video-planet-v1.png` | Lens planet and holographic film paths |
| Creator Studio | `creator-studio-v1.png` | Cosmic stylus and creative prism |
| Games World | `games-world-v1.png` | Floating playable realm and portal |
| Dev Planet | `dev-planet-v2.png` | Engineering cube and circuit city |
| Learning Star | `learning-star-v1.png` | Knowledge star and luminous book |
| Community | `community-v1.png` | Welcoming constellation network |
| Tools Galaxy | `tools-galaxy-v1.png` | Modular utility crystal system |
| Analytics | `analytics-v1.png` | Crystal observatory and abstract charts |
| Settings | `settings-v2.png` | Celestial configuration mechanism |

The original `dev-planet-v1.png` and `settings-v1.png` generations are retained
non-destructively and recorded under `retainedAssets` with their own size and
SHA-256, but are not selected or served. The `v2` files remove a
pseudo-signature artifact and a human-shaped glyph respectively.

## Integrity and delivery

`asset-manifest.v1.json` is the canonical machine-readable selection. It records
the byte size, `1672×941` intrinsic dimensions and SHA-256 digest of each final
PNG. Contract tests recalculate those values from the files so a changed or
truncated asset fails before release.

Portal images are not part of the service worker's install-time core. The
current route requests one hero image, and the existing same-origin
stale-while-revalidate handler stores it only after first use. This avoids
preloading roughly 24 MB of artwork when a user opens the Galaxy shell.

No WebP or AVIF derivatives are declared because this repository does not yet
ship a deterministic image conversion pipeline. The source PNGs remain the
single provenance-preserving release artifacts until that pipeline exists.

## Prompt set

Base prompt used for the collection:

> Create a cinematic premium 3D, 16:9 HH Galaxy website portal-card artwork.
> Use a deep midnight navy space backdrop, refined magenta/cyan light and
> restrained warm-gold accents, realistic glass/metal/crystal materials,
> volumetric glow, one crisp central subject and safe breathing room for
> responsive cropping. No people, readable text, letters, numbers, logos,
> watermarks or UI frames.

Each asset substitutes the subject listed in the table above. The Dev Planet
and Settings `v2` files received one precise cleanup edit while preserving the
rest of their generated composition.
