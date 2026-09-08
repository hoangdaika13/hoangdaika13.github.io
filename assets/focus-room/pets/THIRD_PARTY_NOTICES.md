# Focus Room 3D pet notices

The Focus Room serves these files from the repository. It does not hotlink the creators' hosts.

## Bicolor Cat by kenchoo

- Local file: `bicolor-cat.glb`
- Work: **Bicolor Cat**, a textured, rigged and animated domestic cat
- Creator: **kenchoo**; based on the attributed Fripouille cat by Guillaume Bolis as stated on the source page
- Canonical source: https://sketchfab.com/3d-models/bicolor-cat-e623a618ca344a8393d7ba4d63ec23cf
- GitHub distribution reviewed: https://github.com/code4fukui/vr-cats/blob/main/bicolor_cat.glb
- License: Creative Commons Attribution 4.0 International (CC BY 4.0)
- License text: https://creativecommons.org/licenses/by/4.0/legalcode
- Downloaded: 2026-09-07
- Upstream downloaded GLB SHA-256: `4B395BA943D647F4C490C982A70FA2175EF91569615773DA7EF3429E427ED21A`
- Local transformed GLB SHA-256: `631DF22885E06E48185BF73B0711413F90DEB34AC71B2AB1DE99C3CD27C25131`
- Externalized original textures: `bicolor-cat-texture.png` (`376D72A0C89CE257874DDB4369E4CD32EB1134466C36316FF735E73D594802DA`), `bicolor-cat-texture-2.png` (`F7A8DA7B92814E69F0DDDE9DC95E421FDE59CAEC56B91E6649813E3960CBE888`) and `bicolor-cat-texture-3.jpg` (`38B6602BF0BD48E185BBC666087DFAAD4179F5A651E0F3FF76194760D101CB5F`)

The HH Focus Room uses the embedded 8.71-second skeletal animation, its PBR diffuse/normal/roughness material and a small bounded quadruped gait overlay while walking. Attribution is shown in the application's scene panel and this notice. No ownership of the original model is claimed.

## Animated Dog, Shiba Inu by quander

- Local file: `quander-shiba.glb`
- Work: **Animated Dog, Shiba Inu**, a textured, rigged dog with facial and body bones
- Creator: **quander**
- Canonical source: https://sketchfab.com/3d-models/animated-dog-shiba-inu-9abfce885a834399b2c3ccaed51cd474
- GitHub distribution reviewed: https://github.com/hmgovt/bitcoinweighin/tree/main/static/models/references/shiba_inu
- License: Creative Commons Attribution 4.0 International (CC BY 4.0)
- License text: https://creativecommons.org/licenses/by/4.0/legalcode
- Downloaded: 2026-09-07
- Upstream downloaded GLB SHA-256: `81F227F600A5FB9E908602B5967A368C1509C569BC6B2C7220B182D2203B6118`
- Local transformed GLB SHA-256: `02979B1497D192CB9F47620D97D543FDFD10B161E18BFF5B8C92A04731066F03`
- Externalized original textures: `quander-shiba-texture.webp` (`71A1B81C7FAE9586FF82D715549FF8076FF3EEB4DC2821AF840716CA318B7F73`) and `quander-shiba-texture-2.webp` (`055D0C38E9A6BA5C08DCC2353BF744E2BAE04F84B92CC3923E6A2CAE4C50B16A`)

The HH Focus Room uses the supplied `standing`, `sitting` and `play_dead` skeletal clips for natural standing, expression and lying poses. Walking keeps the supplied standing motion alive and adds a bounded four-leg, spine, head and tail gait; all state changes crossfade instead of scaling or distorting the animal mesh.

## Behavior reference

The optional automatic `walk → rest → idle` state cycle was informed by the general `idle`, `move` and `stay` behavior vocabulary documented by [M3-org/pets](https://github.com/M3-org/pets), licensed MIT. No M3 runtime code or model is bundled.
