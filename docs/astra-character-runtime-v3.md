# HH Cinematic Character Runtime V3

## Compatibility map

The V3 runtime is a compatibility layer around the existing `astral-realms.js` character pipeline. It does not replace the licensed GLB loader, `AnimationMixer`, weapon manifest, calibrated anchors, legacy procedural fallback, world movement or server-authoritative combat.

| Existing owner | V3 responsibility | Integration |
| --- | --- | --- |
| `astral-realms.js` | scene, GLB/decoder pipeline, mixer, rendering, authored/procedural motion fallback | mounts each verified character into `window.HHAstraCharacterRuntimeV3` |
| `assets/astral-realms/animations/motion-library-v13.json` | authored clip metadata | registered through `AnimationRegistry`; missing clips remain reported as unavailable |
| weapon manifest and legacy calibration | weapon geometry, socket creation and visual QA | `WeaponGripSolver` records native/derived sockets and never marks a missing grip as calibrated |
| terrain sampler | gameplay terrain height and normals | `FootPlacementIK` receives smoothed per-foot targets from the live terrain |
| legacy movement | local prediction and visible transform | `LocomotionController` adds acceleration, 2D local blend state, turns, starts/stops and stride diagnostics without owning authoritative position |
| realtime server | movement, target, cooldown, damage, health and death authority | client sends an idempotent action sequence only at `active_start`; server rejects wrong markers and duplicate sequences |
| existing pointer/cursor runtime | canvas pointer lock and hybrid cursor | every UI/panel releases pointer lock; closing a panel never re-locks without a fresh canvas click |

## Module boundaries

- Contracts and validation: `CharacterDefinition`, `SkeletonProfile`, `CharacterAssetValidator`, `AnimationRegistry`, `AnimationRetargeter`.
- Motion: `AnimationStateMachine`, `AdditiveAnimationLayer`, `LocomotionController`, `MotionWarping`, `FootPlacementIK`, `FullBodyIK`, `LookAtController`.
- Weapons and combat: `WeaponGripSolver`, `CombatMarkerTimeline`, `CombatAnimationController`, `HitReactionController`, `RagdollController`.
- Performance: `FacialPerformanceController`, `LipSyncController`, `SecondaryMotionController`.
- World and online: `ContextualInteractionController`, `CharacterCollisionController`, `CharacterLODController`, `CharacterNetworkReplicator`, `CharacterPerformanceGovernor`.
- Presentation and tools: `CinematicCharacterDirector`, `ElementalCharacterIdentity`, `CharacterCustomizationController`, `CharacterDebugOverlay`.
- Lifecycle facade: `CharacterRuntimeV3`.

## Truthful fallback policy

- Missing model, license, skeleton bone, morph target, weapon socket, texture budget or animation is retained in diagnostics.
- Morph processing only touches mapped channels that physically exist on the mounted mesh.
- Timestamped visemes are distinguished from amplitude fallback.
- Ragdoll, knockdown and death require server confirmation.
- Contextual interactions require server validation.
- Derived weapon sockets remain marked `derived`; they are not presented as authored calibration.
- The runtime does not download models, animations or textures.

## Public facade

`window.HHAstraCharacterRuntimeV3` provides the required registration, mount, input, action, combat, look, facial, dialogue, hit, quality, diagnostics and disposal methods. `update()` and `setLabTab()` are additional integration methods used by HH ASTRA.

## Character Lab

The dedicated panel contains 11 live tabs: overview, locomotion, IK, weapons, combat, face, secondary motion, damage/ragdoll, LOD/performance, network and asset validation. It is gated to localhost or an owner/root/admin/developer role and does not appear for normal users.

## Asset work still requiring authored source

Runtime solvers and safe fallbacks are complete, but visual acceptance such as a native two-centimetre grip for every frame, high-quality cloth collision and exact viseme coverage can only be proven for an individual character/weapon combination when its GLB includes the required bones, morphs, clips and authored sockets. Character Lab reports those gaps per mounted asset instead of claiming a visual pass.
